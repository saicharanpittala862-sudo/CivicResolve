import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Case } from "../drizzle/schema";
import * as q from "./db";
import { boardRow, publicCase, staffCase } from "./dto";
import { DEMO_ACCOUNTS, demoEnabled } from "./demo";
import { hashPassword, signSession, verifyPassword } from "./internalAuth";
import { sweepSla } from "./sla";
import { EXT, MAX_UPLOAD_BYTES, newKey, storage } from "./storage";
import { detectMime } from "./storageProvider";
import { suggest } from "./triage";
import { canMove, isOpen, STATUSES, type Actor } from "./workflow";
import { adminProcedure, publicProcedure, router, staffProcedure } from "./_core/trpc";
import { db } from "./db";
import { departments, categories, officers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const tracking = z.string().trim().toUpperCase().regex(/^GRV-\d{4}-\d{5}$/, "Tracking numbers look like GRV-2026-00001");
const access = z.string().trim().min(8).max(20);
const email = z.string().trim().toLowerCase().email().max(200);
const userView = (u: { id: number; name: string; email: string; role: string }) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "We could not find a case with that tracking number." });
function byTracking(tn: string): Case {
  const c = q.caseByTracking(tn);
  if (!c) throw notFound();
  return c;
}
/** Citizens prove ownership with the access code shown once at filing. */
function owned(tn: string, code: string): Case {
  const c = byTracking(tn);
  if (!q.verifyAccess(c, code)) throw new TRPCError({ code: "FORBIDDEN", message: "That access code does not match this case." });
  return c;
}
function inScope(ctx: { departmentId: number | null }, c: Case): Case {
  if (ctx.departmentId !== null && c.departmentId !== ctx.departmentId) throw notFound();
  return c;
}
const conflict = (e: unknown): never => {
  if ((e as Error).message === "CONFLICT") throw new TRPCError({ code: "CONFLICT", message: "Someone else just updated this case. Refresh and try again." });
  throw e;
};

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const o = ctx.user.role === "officer" ? q.officerOf(ctx.user.id) : null;
      return { ...userView(ctx.user), departmentId: o?.departmentId ?? null, title: o?.title ?? null };
    }),
    internalLogin: publicProcedure.input(z.object({ email, password: z.string().min(1).max(100) })).mutation(async ({ input, ctx }) => {
      const u = q.userByEmail(input.email);
      const ok = u ? await verifyPassword(input.password, u.passwordHash) : false;
      if (!u || !ok || !u.active) throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong email or password" });
      ctx.session.set(await signSession(u.id, u.role));
      return userView(u);
    }),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.session.clear(); return true; }),
    /** Only in DEMO_MODE: powers the one-click credential chips on the staff sign-in page. */
    demoAccounts: publicProcedure.query(() => (demoEnabled() ? DEMO_ACCOUNTS.map(({ label, icon, email, password }) => ({ label, icon, email, password })) : [])),
  }),

  public: router({
    catalog: publicProcedure.query(() => {
      const all = q.listCases({ pageSize: 100 }).rows; // small deployments; replace with a grouped count when volumes grow
      return {
        departments: q.allDepartments().filter((d) => d.active).map((d) => ({ ...d, activeCases: all.filter((c) => c.departmentId === d.id && isOpen(c.status)).length })),
        categories: q.allCategories().filter((c) => c.active),
      };
    }),
    stats: publicProcedure.query(() => q.publicStats()),
    board: publicProcedure.input(z.object({ search: z.string().max(100).optional(), limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(({ input }) => {
        const { rows } = q.listCases({ search: input?.search, pageSize: 100 });
        return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, input?.limit ?? 20).map(boardRow);
      }),
    lookup: publicProcedure.input(z.object({ trackingNumber: tracking })).query(({ input }) => {
      const c = q.caseByTracking(input.trackingNumber);
      return c ? boardRow(c) : null;
    }),
    suggest: publicProcedure.input(z.object({ text: z.string().max(4200), location: z.string().max(200).default("") })).query(({ input }) => {
      const s = suggest(input.text);
      const category = s.categoryName ? q.allCategories().find((c) => c.name === s.categoryName) ?? null : null;
      const dup = category ? q.findDuplicate(input.text, input.location, category.departmentId) : null;
      return { category, priority: s.priority, confidence: s.confidence, duplicate: dup ? { trackingNumber: dup.trackingNumber, title: dup.title } : null };
    }),
  }),

  portal: router({
    create: publicProcedure.input(z.object({
      categoryId: z.number().int().positive(), title: z.string().trim().min(5).max(200), description: z.string().trim().min(10).max(4000),
      location: z.string().trim().min(3).max(200), contactEmail: email.optional().or(z.literal("").transform(() => undefined)), force: z.boolean().optional(),
    })).mutation(({ input }) => {
      const cat = q.allCategories().find((c) => c.id === input.categoryId && c.active);
      if (!cat) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid service category." });
      const text = `${input.title} ${input.description}`;
      if (!input.force) {
        const dup = q.findDuplicate(text, input.location, cat.departmentId);
        if (dup) return { created: false as const, duplicate: { trackingNumber: dup.trackingNumber, title: dup.title } };
      }
      const { case: c, accessCode } = q.createCase({ title: input.title, description: input.description, location: input.location, categoryId: cat.id, contactEmail: input.contactEmail, priority: suggest(text).priority });
      return { created: true as const, trackingNumber: c.trackingNumber, accessCode, case: publicCase(c) };
    }),
    detail: publicProcedure.input(z.object({ trackingNumber: tracking })).query(({ input }) => publicCase(byTracking(input.trackingNumber))),
    checkAccess: publicProcedure.input(z.object({ trackingNumber: tracking, accessCode: access })).query(({ input }) => q.verifyAccess(byTracking(input.trackingNumber), input.accessCode)),

    uploadAttachment: publicProcedure.input(z.object({ trackingNumber: tracking, accessCode: access, filename: z.string().trim().min(1).max(120), dataBase64: z.string().max(3_000_000) }))
      .mutation(async ({ input }) => {
        const c = owned(input.trackingNumber, input.accessCode);
        if (!isOpen(c.status)) throw new TRPCError({ code: "CONFLICT", message: "Evidence can only be added while a case is open." });
        if (q.attachmentsFor(c.id).length >= 5) throw new TRPCError({ code: "BAD_REQUEST", message: "Up to 5 files per case." });
        const data = Buffer.from(input.dataBase64, "base64");
        if (!data.length || data.length > MAX_UPLOAD_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Each file must be under 2 MB." });
        const mime = detectMime(data); // trust the bytes, not the browser
        if (!mime) throw new TRPCError({ code: "BAD_REQUEST", message: "Only PDF, PNG, JPG and WebP files are accepted." });
        const key = newKey(mime);
        await storage.put(key, data);
        const a = q.addAttachment({ caseId: c.id, key, filename: input.filename.replace(/[^\w. -]/g, "_").replace(/\.[^.]*$/, "") + "." + EXT[mime], mime, size: data.length });
        return { key: a.key, filename: a.filename };
      }),

    feedback: publicProcedure.input(z.object({ trackingNumber: tracking, accessCode: access, score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).default("") }))
      .mutation(({ input }) => {
        const c = owned(input.trackingNumber, input.accessCode);
        if (c.status !== "resolved" && c.status !== "closed") throw new TRPCError({ code: "CONFLICT", message: "Feedback opens once the case is resolved." });
        const updated = q.setFeedback(c, input.score, input.comment);
        if (!updated) throw new TRPCError({ code: "CONFLICT", message: "Feedback has already been submitted for this case." });
        return publicCase(updated);
      }),

    reopen: publicProcedure.input(z.object({ trackingNumber: tracking, accessCode: access, reason: z.string().trim().min(10, "Please explain why in a sentence or two.").max(1000) }))
      .mutation(({ input }) => {
        const c = owned(input.trackingNumber, input.accessCode);
        if (!canMove(c.status, "reopened", "citizen")) throw new TRPCError({ code: "CONFLICT", message: "Only resolved cases can be reopened." });
        try { return publicCase(q.moveCase(c, "reopened", { type: "citizen", name: "Citizen" }, input.reason)); } catch (e) { return conflict(e); }
      }),
  }),

  officer: router({
    queue: staffProcedure.input(z.object({
      status: z.enum(STATUSES).optional(), priority: z.enum(["low", "medium", "high", "critical"]).optional(), categoryId: z.number().int().optional(),
      search: z.string().max(100).optional(), overdueOnly: z.boolean().optional(), departmentId: z.number().int().optional(),
    }).optional()).query(({ input, ctx }) => {
      const dept = ctx.departmentId ?? input?.departmentId;
      const { rows } = q.listCases({ ...input, departmentId: dept, pageSize: 100 });
      const all = q.listCases({ departmentId: dept, pageSize: 100 }).rows;
      const resolved = all.filter((c) => c.resolvedAt !== null);
      return {
        cases: rows.map((c) => ({ ...boardRow(c), assignedOfficerId: c.assignedOfficerId, location: c.location, overdue: isOpen(c.status) && c.targetDate < Date.now(), escalated: c.escalated })),
        kpis: {
          total: all.length, open: all.filter((c) => isOpen(c.status)).length, overdue: all.filter((c) => isOpen(c.status) && c.targetDate < Date.now()).length,
          completionPct: all.length ? Math.round((100 * resolved.length) / all.length) : 0,
          avgResolutionHours: resolved.length ? Math.round(resolved.reduce((a, c) => a + (c.resolvedAt! - c.createdAt), 0) / resolved.length / 3_600_000) : 0,
        },
      };
    }),
    case: staffProcedure.input(z.object({ trackingNumber: tracking })).query(({ input, ctx }) => staffCase(inScope(ctx, byTracking(input.trackingNumber)), ctx.user.role as "officer" | "admin")),

    updateCase: staffProcedure.input(z.object({ trackingNumber: tracking, to: z.enum(STATUSES), note: z.string().trim().max(1000).default("") })).mutation(({ input, ctx }) => {
      const c = inScope(ctx, byTracking(input.trackingNumber));
      const actor: Actor = ctx.user.role === "admin" ? "admin" : "officer";
      if (!canMove(c.status, input.to, actor)) throw new TRPCError({ code: "CONFLICT", message: `A case cannot move from ${c.status.replace("_", " ")} to ${input.to.replace("_", " ")} here.` });
      if (input.to === "resolved" && input.note.length < 10) throw new TRPCError({ code: "BAD_REQUEST", message: "Add resolution notes (at least 10 characters) before resolving." });
      if (actor === "officer" && c.assignedOfficerId && c.assignedOfficerId !== ctx.user.id && ["in_progress", "resolved"].includes(input.to))
        throw new TRPCError({ code: "FORBIDDEN", message: "This case is assigned to another officer." });
      const extra: Partial<Case> = {};
      if (input.to === "assigned") {
        if (actor === "officer") extra.assignedOfficerId = ctx.user.id;
        else if (!c.assignedOfficerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Assign an officer first." });
      }
      try { return staffCase(q.moveCase(c, input.to, { type: actor, name: ctx.user.name }, input.note, extra), actor); } catch (e) { return conflict(e); }
    }),

    addProgress: staffProcedure.input(z.object({ trackingNumber: tracking, note: z.string().trim().min(3).max(1000), internal: z.boolean().default(false) })).mutation(({ input, ctx }) => {
      const c = inScope(ctx, byTracking(input.trackingNumber));
      if (!isOpen(c.status)) throw new TRPCError({ code: "CONFLICT", message: "Closed cases cannot take new progress notes." });
      q.addProgress(c, { type: ctx.user.role === "admin" ? "admin" : "officer", name: ctx.user.name }, input.note, input.internal);
      return staffCase(byTracking(c.trackingNumber), ctx.user.role as "officer" | "admin");
    }),
  }),

  admin: router({
    dashboard: adminProcedure.query(() => q.dashboard()),
    cases: adminProcedure.input(z.object({
      page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(100).default(15), search: z.string().max(100).optional(),
      status: z.enum(STATUSES).optional(), priority: z.enum(["low", "medium", "high", "critical"]).optional(), categoryId: z.number().int().optional(),
    })).query(({ input }) => {
      const { rows, total } = q.listCases(input);
      return { total, page: input.page, pageSize: input.pageSize, rows: rows.map((c) => ({ ...boardRow(c), location: c.location, assignedOfficerId: c.assignedOfficerId, departmentId: c.departmentId, overdue: isOpen(c.status) && c.targetDate < Date.now(), escalated: c.escalated })) };
    }),
    assign: adminProcedure.input(z.object({ trackingNumber: tracking, officerUserId: z.number().int() })).mutation(({ input, ctx }) => {
      const c = byTracking(input.trackingNumber);
      if (!isOpen(c.status)) throw new TRPCError({ code: "CONFLICT", message: "Closed cases cannot be reassigned." });
      const off = q.listOfficers().find((o) => o.userId === input.officerUserId);
      if (!off) throw new TRPCError({ code: "BAD_REQUEST", message: "That user is not an officer." });
      if (off.departmentId !== c.departmentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an officer from the case's department." });
      if (c.status === "submitted") q.moveCase(c, "acknowledged", { type: "admin", name: ctx.user.name }, "Reviewed and acknowledged.");
      try { return boardRow(q.assignCase(byTracking(c.trackingNumber), off.userId, { type: "admin", name: ctx.user.name }, off.name)); } catch (e) { return conflict(e); }
    }),
    officers: adminProcedure.query(() => q.listOfficers()),
    createOfficer: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email, password: z.string().min(8).max(100), departmentId: z.number().int(), title: z.string().trim().min(2).max(120) })).mutation(async ({ input }) => {
      if (!q.allDepartments().some((d) => d.id === input.departmentId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown department." });
      if (q.userByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "That email already has an account." });
      const u = q.insertUser({ email: input.email, name: input.name, role: "officer", passwordHash: await hashPassword(input.password) });
      db.insert(officers).values({ userId: u.id, departmentId: input.departmentId, title: input.title }).run();
      return userView(u);
    }),
    users: adminProcedure.query(() => q.listUsers()),
    createDepartment: adminProcedure.input(z.object({ name: z.string().trim().min(3).max(80), description: z.string().trim().min(10).max(400), slaHours: z.number().int().min(1).max(720) })).mutation(({ input }) => {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (q.allDepartments().some((d) => d.slug === slug || d.name.toLowerCase() === input.name.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "A department with that name already exists." });
      return db.insert(departments).values({ ...input, slug }).returning().get();
    }),
    updateDepartmentSla: adminProcedure.input(z.object({ id: z.number().int(), slaHours: z.number().int().min(1).max(720) })).mutation(({ input }) => {
      const d = db.update(departments).set({ slaHours: input.slaHours }).where(eq(departments.id, input.id)).returning().get();
      if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
      return d; // applies to cases filed from now on; existing deadlines are unchanged
    }),
    createCategory: adminProcedure.input(z.object({ departmentId: z.number().int(), name: z.string().trim().min(3).max(80), guidance: z.string().trim().max(400).default("") })).mutation(({ input }) => {
      if (!q.allDepartments().some((d) => d.id === input.departmentId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown department." });
      if (q.allCategories().some((c) => c.departmentId === input.departmentId && c.name.toLowerCase() === input.name.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "That category already exists in this department." });
      return db.insert(categories).values(input).returning().get();
    }),
    sweep: adminProcedure.mutation(() => ({ escalated: sweepSla() })),
  }),
});

export type AppRouter = typeof appRouter;
