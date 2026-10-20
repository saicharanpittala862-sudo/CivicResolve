import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cases, departments, officers, type User } from "../drizzle/schema";
import { createApp } from "./_core/index";
import type { Context } from "./_core/trpc";
import { seedCatalog } from "./catalog";
import { db, insertUser } from "./db";
import { hashPassword } from "./internalAuth";
import { appRouter } from "./routers";

const ctx = (user: User | null = null): Context => ({ user, session: { set() {}, clear() {} } });
const as = (u: User | null) => appRouter.createCaller(ctx(u));
const anon = as(null);
const year = new Date().getUTCFullYear();

let admin: User, works: User, water: User, cat: Record<string, number>, dept: Record<string, number>;
const file = (over: Partial<Parameters<typeof anon.portal.create>[0]> = {}) => anon.portal.create({
  categoryId: cat["Pothole Repair"], title: "Deep pothole near the bus stop", description: "A large pothole on the main road is causing near accidents",
  location: "5th Avenue", contactEmail: "citizen@example.com", ...over,
});
async function filed(over = {}) { const r = await file(over); if (!r.created) throw new Error("duplicate"); return r; }
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32, 1)]).toString("base64");

beforeAll(async () => {
  seedCatalog();
  const cats = await anon.public.catalog();
  cat = Object.fromEntries(cats.categories.map((c) => [c.name, c.id]));
  dept = Object.fromEntries(cats.departments.map((d) => [d.name, d.id]));
  const pw = await hashPassword("password123");
  admin = insertUser({ email: "admin@x.com", name: "Admin", role: "admin", passwordHash: pw });
  works = insertUser({ email: "works@x.com", name: "Marcus", role: "officer", passwordHash: pw });
  water = insertUser({ email: "water@x.com", name: "Elena", role: "officer", passwordHash: pw });
  db.insert(officers).values({ userId: works.id, departmentId: dept["Public Works"], title: "Inspector" }).run();
  db.insert(officers).values({ userId: water.id, departmentId: dept["Water and Sanitation"], title: "Officer" }).run();
});

describe("catalog and filing", () => {
  it("seeds 3 departments and 12 categories with SLA windows", async () => {
    const c = await anon.public.catalog();
    expect(c.departments.map((d) => d.slaHours).sort((a, b) => a - b)).toEqual([48, 72, 96]);
    expect(c.categories).toHaveLength(12);
  });

  it("files without an account and returns a tracking number and a one-time access code", async () => {
    const r = await filed();
    expect(r.trackingNumber).toBe(`GRV-${year}-00001`);
    expect(r.accessCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await filed({ categoryId: cat["Waste Collection"], title: "Garbage not collected", description: "No garbage collection for a week, bins overflowing", location: "Sector 9" })).trackingNumber).toBe(`GRV-${year}-00002`);
  });

  it("detects duplicates unless forced, and validates input", async () => {
    const dup = await file();
    expect(dup).toMatchObject({ created: false, duplicate: { trackingNumber: `GRV-${year}-00001` } });
    expect((await file({ force: true })).created).toBe(true);
    await expect(file({ title: "x" })).rejects.toThrow();
    await expect(file({ categoryId: 9999 })).rejects.toThrow("valid service category");
    await expect(file({ contactEmail: "not-an-email" })).rejects.toThrow();
  });

  it("suggests a category, priority and nearby duplicate", async () => {
    const s = await anon.public.suggest({ text: "Deep pothole near the bus stop on the main road", location: "5th Avenue" });
    expect(s.category?.name).toBe("Pothole Repair");
    expect(s.duplicate?.trackingNumber).toBe(`GRV-${year}-00001`);
  });
});

describe("privacy", () => {
  it("public detail masks email and hides location, staff identities and internal notes", async () => {
    await as(works).officer.addProgress({ trackingNumber: `GRV-${year}-00001`, note: "Caller was aggressive, take care", internal: true });
    const d = await anon.portal.detail({ trackingNumber: `GRV-${year}-00001` });
    expect(d.maskedEmail).toBe("c***@example.com");
    const json = JSON.stringify(d);
    for (const secret of ["5th Avenue", "citizen@example.com", "aggressive", "Marcus", "accessHash"]) expect(json).not.toContain(secret);
    expect(d.timeline.every((t) => ["Citizen", "Assigned Officer", "Administrator", "System"].includes(t.actor))).toBe(true);
  });

  it("staff see location and internal notes, with real names", async () => {
    const d = await as(works).officer.case({ trackingNumber: `GRV-${year}-00001` });
    expect(d.location).toBe("5th Avenue");
    expect(d.timeline.some((t) => t.internal && t.note.includes("aggressive"))).toBe(true);
  });

  it("rejects malformed and unknown tracking numbers", async () => {
    await expect(anon.portal.detail({ trackingNumber: "nope" })).rejects.toThrow("GRV-2026-00001");
    await expect(anon.portal.detail({ trackingNumber: `GRV-${year}-09999` })).rejects.toThrow("could not find");
    expect(await anon.public.lookup({ trackingNumber: `GRV-${year}-09999` })).toBeNull();
  });

  it("public board lists cases without sensitive fields", async () => {
    const rows = await anon.public.board();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/5th Avenue|citizen@example/);
  });
});

describe("role-based access", () => {
  it("blocks unauthenticated and under-privileged calls", async () => {
    await expect(anon.officer.queue()).rejects.toThrow("Sign in");
    await expect(as(works).admin.dashboard()).rejects.toThrow("Administrator");
    await expect(as(works).admin.createOfficer({ name: "X Y", email: "x@y.com", password: "password123", departmentId: 1, title: "Officer" })).rejects.toThrow("Administrator");
  });
  it("scopes officers to their department and hides other cases as not found", async () => {
    const q = await as(water).officer.queue();
    expect(q.cases.every((c) => c.department === "Water and Sanitation")).toBe(true);
    await expect(as(water).officer.case({ trackingNumber: `GRV-${year}-00001` })).rejects.toThrow("could not find");
    await expect(as(water).officer.updateCase({ trackingNumber: `GRV-${year}-00001`, to: "acknowledged" })).rejects.toThrow("could not find");
    expect((await as(admin).officer.queue()).cases.length).toBeGreaterThanOrEqual(3);
  });
});

describe("lifecycle", () => {
  const tn = `GRV-${year}-00001`;
  it("walks the full path with resolution notes, citizen reopen, and closure", async () => {
    const o = as(works);
    await expect(o.officer.updateCase({ trackingNumber: tn, to: "resolved" })).rejects.toThrow("cannot move");
    await o.officer.updateCase({ trackingNumber: tn, to: "acknowledged" });
    const a = await o.officer.updateCase({ trackingNumber: tn, to: "assigned" });
    expect(a.assignedOfficerName).toBe("Marcus");
    await o.officer.updateCase({ trackingNumber: tn, to: "in_progress" });
    await expect(o.officer.updateCase({ trackingNumber: tn, to: "resolved", note: "done" })).rejects.toThrow("resolution notes");
    await o.officer.updateCase({ trackingNumber: tn, to: "resolved", note: "Pothole filled and surface levelled." });
    await expect(o.officer.updateCase({ trackingNumber: tn, to: "reopened" })).rejects.toThrow("cannot move");
  });

  it("lets only the citizen reopen, with an access code and a reason", async () => {
    const code = (await filed({ title: "Lamp post leaning", description: "Streetlight pole is leaning dangerously over the road", location: "Library Road", categoryId: cat["Street Lighting Outage"] })).accessCode;
    const t2 = `GRV-${year}-00004`;
    const o = as(works);
    for (const to of ["acknowledged", "assigned", "in_progress"] as const) await o.officer.updateCase({ trackingNumber: t2, to });
    await o.officer.updateCase({ trackingNumber: t2, to: "resolved", note: "Pole straightened and secured." });
    await expect(anon.portal.reopen({ trackingNumber: t2, accessCode: "WRONG-CODE", reason: "Still leaning badly" })).rejects.toThrow("does not match");
    await expect(anon.portal.reopen({ trackingNumber: t2, accessCode: code, reason: "no" })).rejects.toThrow("sentence");
    const re = await anon.portal.reopen({ trackingNumber: t2, accessCode: code, reason: "The pole is leaning again after the wind." });
    expect(re.status).toBe("reopened");
    await expect(anon.portal.reopen({ trackingNumber: t2, accessCode: code, reason: "Trying to reopen twice here" })).rejects.toThrow("Only resolved");
  });

  it("collects one rating per case, only after resolution, and only with the access code", async () => {
    const f = await filed({ title: "Cracked footpath tiles", description: "Footpath tiles near the school gate are cracked and loose", location: "School Lane", categoryId: cat["Footpath & Signage"] });
    const t3 = f.trackingNumber;
    await expect(anon.portal.feedback({ trackingNumber: t3, accessCode: f.accessCode, score: 5 })).rejects.toThrow("once the case is resolved");
    const o = as(works);
    for (const to of ["acknowledged", "assigned", "in_progress"] as const) await o.officer.updateCase({ trackingNumber: t3, to });
    await o.officer.updateCase({ trackingNumber: t3, to: "resolved", note: "Tiles replaced along the whole stretch." });
    await expect(anon.portal.feedback({ trackingNumber: t3, accessCode: "WRONG-CODE", score: 5 })).rejects.toThrow("does not match");
    await expect(anon.portal.feedback({ trackingNumber: t3, accessCode: f.accessCode, score: 6 })).rejects.toThrow();
    const rated = await anon.portal.feedback({ trackingNumber: t3, accessCode: f.accessCode, score: 4, comment: "Good, a little slow." });
    expect(rated).toMatchObject({ feedbackScore: 4, canRate: false });
    await expect(anon.portal.feedback({ trackingNumber: t3, accessCode: f.accessCode, score: 1 })).rejects.toThrow("already been submitted");
    await o.officer.updateCase({ trackingNumber: t3, to: "closed" });
    expect((await anon.portal.detail({ trackingNumber: t3 })).status).toBe("closed");
  });
});

describe("admin operations", () => {
  it("assigns only officers of the case's department and acknowledges new cases", async () => {
    const f = await filed({ title: "Pipe leaking badly", description: "Water pipeline is leaking on the street for days", location: "Canal Road", categoryId: cat["Water Supply Disruption"] });
    const officers = await as(admin).admin.officers();
    const wrong = officers.find((x) => x.name === "Marcus")!;
    const right = officers.find((x) => x.name === "Elena")!;
    await expect(as(admin).admin.assign({ trackingNumber: f.trackingNumber, officerUserId: wrong.userId })).rejects.toThrow("case's department");
    const r = await as(admin).admin.assign({ trackingNumber: f.trackingNumber, officerUserId: right.userId });
    expect(r.status).toBe("assigned");
  });
  it("manages departments, SLA hours and categories with validation", async () => {
    const d = await as(admin).admin.createDepartment({ name: "Parks and Recreation", description: "Parks, sports grounds and recreation spaces.", slaHours: 120 });
    await expect(as(admin).admin.createDepartment({ name: "parks and recreation", description: "Duplicate department name check.", slaHours: 10 })).rejects.toThrow("already exists");
    await expect(as(admin).admin.updateDepartmentSla({ id: d.id, slaHours: 0 })).rejects.toThrow();
    expect((await as(admin).admin.updateDepartmentSla({ id: d.id, slaHours: 36 })).slaHours).toBe(36);
    await as(admin).admin.createCategory({ departmentId: d.id, name: "Sports Ground Repair", guidance: "Say which ground." });
    await expect(as(admin).admin.createCategory({ departmentId: d.id, name: "sports ground repair" })).rejects.toThrow("already exists");
    expect((await anon.public.catalog()).categories.some((c) => c.name === "Sports Ground Repair")).toBe(true);
  });
  it("creates officers, lists users without password hashes, and paginates cases", async () => {
    await as(admin).admin.createOfficer({ name: "New Officer", email: "new@x.com", password: "password123", departmentId: dept["Community Services"], title: "Liaison" });
    await expect(as(admin).admin.createOfficer({ name: "New Officer", email: "new@x.com", password: "password123", departmentId: dept["Community Services"], title: "Liaison" })).rejects.toThrow("already has an account");
    expect(JSON.stringify(await as(admin).admin.users())).not.toMatch(/passwordHash|password_hash/);
    const page = await as(admin).admin.cases({ page: 1, pageSize: 5 });
    expect(page.rows).toHaveLength(5);
    expect(page.total).toBeGreaterThan(5);
  });
});

describe("SLA escalation", () => {
  it("escalates breached cases exactly once and moves in-progress ones to escalated", async () => {
    const f = await filed({ title: "Manhole overflowing", description: "Sewage manhole overflowing onto the street near homes", location: "Mill Road", categoryId: cat["Sewerage Overflow"] });
    const o = as(water);
    for (const to of ["acknowledged", "assigned", "in_progress"] as const) await o.officer.updateCase({ trackingNumber: f.trackingNumber, to });
    db.update(cases).set({ targetDate: Date.now() - 3_600_000 }).where(eq(cases.trackingNumber, f.trackingNumber)).run();
    expect((await as(admin).admin.sweep()).escalated).toBeGreaterThanOrEqual(1);
    const d = await anon.portal.detail({ trackingNumber: f.trackingNumber });
    expect(d).toMatchObject({ status: "escalated", priority: "critical", escalated: true });
    expect((await as(admin).admin.sweep()).escalated).toBe(0);
    await o.officer.updateCase({ trackingNumber: f.trackingNumber, to: "in_progress" });
    const dash = await as(admin).admin.dashboard();
    expect(dash.escalated).toBeGreaterThanOrEqual(1);
    expect(dash.byDepartment).toHaveLength(4);
  });
});

describe("HTTP layer", () => {
  let base = "";
  const server = createApp().listen(0);
  beforeAll(() => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
  afterAll(() => void server.close());
  const post = (path: string, body: unknown, cookie = "") => fetch(`${base}/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
  const login = async (email: string) => cookieOf(await post("auth.internalLogin", { email, password: "password123" }));

  it("signs staff in with an HttpOnly cookie and rejects bad passwords", async () => {
    expect((await post("auth.internalLogin", { email: "admin@x.com", password: "wrongwrong" })).status).toBe(401);
    const ok = await post("auth.internalLogin", { email: "admin@x.com", password: "password123" });
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const me = await (await fetch(`${base}/api/trpc/auth.me`, { headers: { cookie: cookieOf(ok) } })).json();
    expect(me.result.data).toMatchObject({ email: "admin@x.com", role: "admin" });
    expect(JSON.stringify(me)).not.toMatch(/passwordHash/);
    expect((await (await fetch(`${base}/api/trpc/auth.me`, { headers: { cookie: cookieOf(ok) + "x" } })).json()).result.data).toBeNull();
  });

  it("verifies uploads by content and serves evidence only to the right people", async () => {
    const f = await filed({ title: "Broken swing chain", description: "The swing chain in the playground is broken and dangerous", location: "Hill Park", categoryId: cat["Parks & Open Spaces"] });
    const base64 = png();
    await expect(anon.portal.uploadAttachment({ trackingNumber: f.trackingNumber, accessCode: "WRONG-CODE", filename: "a.png", dataBase64: base64 })).rejects.toThrow("does not match");
    await expect(anon.portal.uploadAttachment({ trackingNumber: f.trackingNumber, accessCode: f.accessCode, filename: "evil.png", dataBase64: Buffer.from("<script>alert(1)</script> pretend image").toString("base64") })).rejects.toThrow("Only PDF, PNG");
    await expect(anon.portal.uploadAttachment({ trackingNumber: f.trackingNumber, accessCode: f.accessCode, filename: "big.png", dataBase64: Buffer.alloc(2_200_000, 1).toString("base64") })).rejects.toThrow("under 2 MB");
    const up = await anon.portal.uploadAttachment({ trackingNumber: f.trackingNumber, accessCode: f.accessCode, filename: "photo.jpg", dataBase64: base64 });
    expect(up.filename).toBe("photo.png"); // extension follows the real type, not the claimed one

    const url = `${base}/api/attachments/${up.key}`;
    expect((await fetch(url)).status).toBe(404);
    expect((await fetch(`${url}?trackingNumber=${f.trackingNumber}&accessCode=AAAA-BBBB`)).status).toBe(404);
    const mine = await fetch(`${url}?trackingNumber=${f.trackingNumber}&accessCode=${f.accessCode}`);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await fetch(url, { headers: { cookie: await login("water@x.com") } })).status).toBe(404); // other department
    expect((await fetch(url, { headers: { cookie: await login("admin@x.com") } })).status).toBe(200);
    expect((await fetch(`${base}/api/attachments/..%2f..%2fetc%2fpasswd`)).status).toBe(404);
  });

  it("blocks cross-origin writes, sets security headers, hides demo credentials, exposes health", async () => {
    const r = await fetch(`${base}/api/trpc/auth.logout`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(403);
    const h = await fetch(`${base}/healthz`);
    expect(await h.json()).toEqual({ status: "ok" });
    expect(h.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(h.headers.get("x-powered-by")).toBeNull();
    expect((await (await fetch(`${base}/api/trpc/auth.demoAccounts`)).json()).result.data).toEqual([]);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });
});
