import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { and, asc, desc, eq, inArray, like, lt, or, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../drizzle/schema";
import { attachments, cases, categories, departments, officers, timelineEvents, users, type Case } from "../drizzle/schema";
import { similarity, type Priority } from "./triage";
import { OPEN_STATUSES, type Actor } from "./workflow";

const HOUR = 3_600_000;
const dbPath = process.env.DATABASE_PATH ?? "./data/civicresolve.db";
if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("synchronous = NORMAL");
export const db = drizzle(sqlite, { schema });

/** Minimal forward-only migrator: applies drizzle/migrations/*.sql once, in name order. */
function migrate() {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle/migrations");
  const done = new Set((sqlite.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    sqlite.transaction(() => {
      sqlite.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      sqlite.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
    })();
  }
}
migrate();

export interface ActorRef { type: Actor; name: string }

// ---- access codes (the secret half of a tracking token)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newAccessCode(): string {
  const b = randomBytes(8);
  const c = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
const hashCode = (code: string) => createHash("sha256").update(code.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
export function verifyAccess(c: Case, code: string | undefined): boolean {
  if (!code) return false;
  const a = Buffer.from(hashCode(code)), b = Buffer.from(c.accessHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- users, departments, categories, officers
export const userByEmail = (email: string) => db.select().from(users).where(eq(users.email, email)).get();
export const userById = (id: number) => db.select().from(users).where(eq(users.id, id)).get();
export const insertUser = (v: Omit<typeof users.$inferInsert, "id" | "createdAt">) => db.insert(users).values({ ...v, createdAt: Date.now() }).returning().get();
export const listUsers = () => db.select({ id: users.id, email: users.email, name: users.name, role: users.role, authSource: users.authSource, active: users.active, createdAt: users.createdAt }).from(users).orderBy(asc(users.id)).all();
export const allDepartments = () => db.select().from(departments).orderBy(asc(departments.id)).all();
export const allCategories = () => db.select().from(categories).orderBy(asc(categories.departmentId), asc(categories.id)).all();
export const officerOf = (userId: number) => db.select().from(officers).where(eq(officers.userId, userId)).get();
export const listOfficers = () => db.select({ id: officers.id, userId: officers.userId, name: users.name, email: users.email, title: officers.title, departmentId: officers.departmentId }).from(officers).innerJoin(users, eq(users.id, officers.userId)).all();

// ---- cases
export const caseByTracking = (tn: string) => db.select().from(cases).where(eq(cases.trackingNumber, tn.toUpperCase())).get();

export function createCase(
  input: { title: string; description: string; location: string; categoryId: number; contactEmail?: string | null; priority: Priority },
  now = Date.now(),
): { case: Case; accessCode: string } {
  const cat = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
  const dept = cat && db.select().from(departments).where(eq(departments.id, cat.departmentId)).get();
  if (!cat || !cat.active || !dept || !dept.active) throw new Error("BAD_CATEGORY");
  const accessCode = newAccessCode();
  const year = new Date(now).getUTCFullYear();
  for (let attempt = 0; ; attempt++) {
    try {
      const row = db.transaction((tx) => {
        const max = tx.select({ m: sql<number>`coalesce(max(${cases.seq}), 0)` }).from(cases).where(eq(cases.year, year)).get()!.m;
        const seq = max + 1;
        const c = tx.insert(cases).values({
          trackingNumber: `GRV-${year}-${String(seq).padStart(5, "0")}`, year, seq,
          title: input.title, description: input.description, location: input.location,
          categoryId: cat.id, departmentId: dept.id, priority: input.priority, status: "submitted",
          contactEmail: input.contactEmail || null, accessHash: hashCode(accessCode),
          targetDate: now + dept.slaHours * HOUR, createdAt: now, updatedAt: now,
        }).returning().get();
        tx.insert(timelineEvents).values({ caseId: c.id, actorType: "citizen", actorName: "Citizen", fromStatus: null, toStatus: "submitted", at: now,
          note: `Filed under ${dept.name} / ${cat.name}. Statutory resolution window: ${dept.slaHours} hours.` }).run();
        return c;
      });
      return { case: row, accessCode };
    } catch (e) {
      // Another writer took the same sequence number; retry with a fresh read.
      if (!String((e as Error).message).includes("UNIQUE") || attempt >= 5) throw e;
    }
  }
}

export function findDuplicate(text: string, location: string, departmentId: number): Case | null {
  const rows = db.select().from(cases).where(and(eq(cases.departmentId, departmentId), inArray(cases.status, [...OPEN_STATUSES])))
    .orderBy(desc(cases.createdAt)).limit(100).all();
  const loc = location.trim().toLowerCase();
  let best: Case | null = null, bestScore = 0.3;
  for (const c of rows) {
    const nearby = !loc || c.location.toLowerCase().includes(loc) || loc.includes(c.location.toLowerCase());
    const s = similarity(text, `${c.title} ${c.description}`);
    if (nearby && s >= bestScore) { best = c; bestScore = s; }
  }
  return best;
}

export interface CaseFilter {
  departmentId?: number; status?: string; priority?: string; categoryId?: number; search?: string;
  overdueOnly?: boolean; assignedOfficerId?: number; page?: number; pageSize?: number;
}
export function listCases(f: CaseFilter, now = Date.now()): { rows: Case[]; total: number } {
  const conds: SQL[] = [];
  if (f.departmentId) conds.push(eq(cases.departmentId, f.departmentId));
  if (f.status) conds.push(eq(cases.status, f.status));
  if (f.priority) conds.push(eq(cases.priority, f.priority as Priority));
  if (f.categoryId) conds.push(eq(cases.categoryId, f.categoryId));
  if (f.assignedOfficerId) conds.push(eq(cases.assignedOfficerId, f.assignedOfficerId));
  if (f.overdueOnly) conds.push(lt(cases.targetDate, now), inArray(cases.status, [...OPEN_STATUSES]));
  if (f.search?.trim()) {
    const q = `%${f.search.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(like(cases.title, q), like(cases.trackingNumber, q), like(cases.location, q), like(cases.description, q))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const pageSize = Math.min(f.pageSize ?? 25, 100), page = Math.max(f.page ?? 1, 1);
  const total = db.select({ n: sql<number>`count(*)` }).from(cases).where(where).get()!.n;
  const rows = db.select().from(cases).where(where).orderBy(asc(cases.targetDate)).limit(pageSize).offset((page - 1) * pageSize).all();
  return { rows, total };
}

export const eventsFor = (caseId: number, includeInternal: boolean) =>
  db.select().from(timelineEvents).where(includeInternal ? eq(timelineEvents.caseId, caseId) : and(eq(timelineEvents.caseId, caseId), eq(timelineEvents.internal, false)))
    .orderBy(asc(timelineEvents.id)).all();

/** Optimistic move: fails with CONFLICT if someone else changed the status first. */
export function moveCase(c: Case, to: string, actor: ActorRef, note: string, extra: Partial<Case> = {}, now = Date.now()): Case {
  return db.transaction((tx) => {
    const dept = tx.select().from(departments).where(eq(departments.id, c.departmentId)).get()!;
    const patch: Partial<Case> = { ...extra, status: to, updatedAt: now };
    if (to === "resolved") patch.resolvedAt = now;
    if (to === "reopened") { patch.resolvedAt = null; patch.escalated = false; patch.targetDate = now + (dept.slaHours * HOUR) / 2; }
    const updated = tx.update(cases).set(patch).where(and(eq(cases.id, c.id), eq(cases.status, c.status))).returning().get();
    if (!updated) throw new Error("CONFLICT");
    tx.insert(timelineEvents).values({ caseId: c.id, actorType: actor.type, actorName: actor.name, fromStatus: c.status, toStatus: to, note, at: now }).run();
    return updated;
  });
}

export function addProgress(c: Case, actor: ActorRef, note: string, internal: boolean, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(cases).set({ updatedAt: now }).where(eq(cases.id, c.id)).run();
    tx.insert(timelineEvents).values({ caseId: c.id, actorType: actor.type, actorName: actor.name, fromStatus: c.status, toStatus: c.status, note, internal, at: now }).run();
  });
}

export function assignCase(c: Case, officerUserId: number, actor: ActorRef, officerName: string, now = Date.now()): Case {
  return db.transaction((tx) => {
    const patch: Partial<Case> = { assignedOfficerId: officerUserId, updatedAt: now };
    const toAssigned = c.status === "acknowledged";
    if (toAssigned) patch.status = "assigned";
    const updated = tx.update(cases).set(patch).where(and(eq(cases.id, c.id), eq(cases.status, c.status))).returning().get();
    if (!updated) throw new Error("CONFLICT");
    tx.insert(timelineEvents).values({ caseId: c.id, actorType: actor.type, actorName: actor.name, fromStatus: c.status, toStatus: updated.status, at: now,
      note: `Assigned to ${officerName}.` }).run();
    return updated;
  });
}

export function setFeedback(c: Case, score: number, comment: string): Case | null {
  return db.update(cases).set({ feedbackScore: score, feedbackComment: comment, updatedAt: Date.now() })
    .where(and(eq(cases.id, c.id), sql`${cases.feedbackScore} is null`)).returning().get() ?? null;
}

// ---- attachments
export const attachmentsFor = (caseId: number) => db.select().from(attachments).where(eq(attachments.caseId, caseId)).all();
export const attachmentByKey = (key: string) => db.select().from(attachments).where(eq(attachments.key, key)).get();
export const addAttachment = (v: Omit<typeof attachments.$inferInsert, "id" | "createdAt">) => db.insert(attachments).values({ ...v, createdAt: Date.now() }).returning().get();
export const caseById = (id: number) => db.select().from(cases).where(eq(cases.id, id)).get();

// ---- reporting
export function publicStats(now = Date.now()) {
  const rows = db.select({ status: cases.status, created: cases.createdAt, resolved: cases.resolvedAt, target: cases.targetDate }).from(cases).all();
  const done = rows.filter((r) => r.resolved !== null);
  const within = done.filter((r) => r.resolved! <= r.target).length;
  return {
    total: rows.length, open: rows.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)).length, resolved: done.length,
    withinSlaPct: done.length ? Math.round((100 * within) / done.length) : 0,
    avgResolutionHours: done.length ? Math.round(done.reduce((a, r) => a + (r.resolved! - r.created), 0) / done.length / HOUR) : 0,
    asOf: now,
  };
}

export function dashboard(now = Date.now()) {
  const rows = db.select().from(cases).all();
  const depts = allDepartments(), cats = allCategories();
  const open = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);
  const resolved = rows.filter((r) => r.resolvedAt !== null);
  const loads = new Map<number, number>();
  for (const r of rows) if (r.assignedOfficerId && open(r.status)) loads.set(r.assignedOfficerId, (loads.get(r.assignedOfficerId) ?? 0) + 1);
  const count = <T,>(items: T[], key: (r: Case) => unknown) => items.map((it) => ({ it, n: rows.filter((r) => key(r) === (it as { id?: unknown }).id).length }));
  return {
    open: rows.filter((r) => open(r.status)).length, total: rows.length,
    overdue: rows.filter((r) => open(r.status) && r.targetDate < now).length,
    escalated: rows.filter((r) => r.escalated).length,
    mttrHours: resolved.length ? Math.round((resolved.reduce((a, r) => a + (r.resolvedAt! - r.createdAt), 0) / resolved.length / HOUR) * 10) / 10 : 0,
    byDepartment: count(depts, (r) => r.departmentId).map(({ it, n }) => ({ name: it.name, count: n, overdue: rows.filter((r) => r.departmentId === it.id && open(r.status) && r.targetDate < now).length })),
    byCategory: count(cats, (r) => r.categoryId).map(({ it, n }) => ({ name: it.name, count: n })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 8),
    byStatus: Object.entries(rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {})).map(([status, count]) => ({ status, count })),
    officerLoad: listOfficers().map((o) => ({ name: o.name, title: o.title, department: depts.find((d) => d.id === o.departmentId)?.name ?? "", active: loads.get(o.userId) ?? 0 })),
  };
}

export const dueForEscalation = (now: number) =>
  db.select().from(cases).where(and(inArray(cases.status, [...OPEN_STATUSES]), eq(cases.escalated, false), lt(cases.targetDate, now))).all();
