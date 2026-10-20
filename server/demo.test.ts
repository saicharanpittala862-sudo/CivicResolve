import { describe, expect, it } from "vitest";
import { seedCatalog } from "./catalog";
import { db } from "./db";
import { cases } from "../drizzle/schema";
import { DEMO_ACCOUNTS, ensureStaff, seedDemoCases } from "./demo";
import { appRouter } from "./routers";

describe("demo data", () => {
  it("seeds accounts and a realistic spread of cases, idempotently", async () => {
    seedCatalog();
    for (const a of DEMO_ACCOUNTS) await ensureStaff(a);
    seedDemoCases();
    const rows = db.select().from(cases).all();
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.status)).size).toBeGreaterThanOrEqual(5);
    expect(rows.some((r) => r.escalated)).toBe(true);
    expect(rows.some((r) => r.feedbackScore !== null)).toBe(true);
    seedDemoCases();
    expect(db.select().from(cases).all()).toHaveLength(12);
    const caller = appRouter.createCaller({ user: null, session: { set() {}, clear() {} } });
    expect((await caller.public.stats()).total).toBe(12);
  });
  it("only advertises demo credentials when DEMO_MODE is on", async () => {
    const caller = appRouter.createCaller({ user: null, session: { set() {}, clear() {} } });
    expect(await caller.auth.demoAccounts()).toEqual([]);
    process.env.DEMO_MODE = "true";
    expect((await caller.auth.demoAccounts()).map((a) => a.label)).toContain("System Administrator");
    delete process.env.DEMO_MODE;
  });
});
