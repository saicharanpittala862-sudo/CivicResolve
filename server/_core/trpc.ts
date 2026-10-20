import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { officerOf } from "../db";
import { COOKIE_NAME, sessionCookieOptions } from "../internalAuth";
import { getSessionUser } from "./sdk";

export interface Context {
  user: User | null;
  session: { set(token: string): void; clear(): void };
}

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<Context> {
  return {
    user: await getSessionUser(req),
    session: {
      set: (token) => void res.cookie(COOKIE_NAME, token, sessionCookieOptions()),
      clear: () => void res.clearCookie(COOKIE_NAME, { path: "/" }),
    },
  };
}

const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  return next();
});
/** Officers and admins. `departmentId` is null for admins (all departments). */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "admin") return next({ ctx: { ...ctx, departmentId: null as number | null } });
  const officer = officerOf(ctx.user.id);
  if (!officer) throw new TRPCError({ code: "FORBIDDEN", message: "This account is not linked to a department" });
  return next({ ctx: { ...ctx, departmentId: officer.departmentId as number | null } });
});
