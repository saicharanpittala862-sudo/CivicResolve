import { and, eq } from "drizzle-orm";
import { cases, categories, departments, officers } from "../drizzle/schema";
import { assignCase, createCase, db, insertUser, moveCase, officerOf, setFeedback, userByEmail } from "./db";
import { hashPassword } from "./internalAuth";
import { sweepSla } from "./sla";

export const demoEnabled = () => process.env.DEMO_MODE === "true";

export const DEMO_ACCOUNTS = [
  { label: "System Administrator", icon: "👑", role: "admin" as const, email: "admin@civicresolve.internal", password: "Admin@CivicResolve2026!", name: "System Administrator", dept: null, title: "" },
  { label: "Public Works Officer", icon: "🏗️", role: "officer" as const, email: "officer.works@civicresolve.internal", password: "Officer@CivicResolve2026!", name: "Marcus Vance", dept: "public-works", title: "Senior Public Works Inspector" },
  { label: "Water & Sanitation Officer", icon: "💧", role: "officer" as const, email: "officer.water@civicresolve.internal", password: "Officer@CivicResolve2026!", name: "Elena Kostova", dept: "water-sanitation", title: "Water Systems Officer" },
  { label: "Community Services Officer", icon: "🤝", role: "officer" as const, email: "officer.community@civicresolve.internal", password: "Officer@CivicResolve2026!", name: "David Kalu", dept: "community-services", title: "Community Liaison Officer" },
];

export async function ensureStaff(a: { email: string; name: string; role: "admin" | "officer"; password: string; dept: string | null; title: string }) {
  let u = userByEmail(a.email);
  if (!u) u = insertUser({ email: a.email, name: a.name, role: a.role, passwordHash: await hashPassword(a.password) });
  if (a.role === "officer" && a.dept && !officerOf(u.id)) {
    const d = db.select().from(departments).where(eq(departments.slug, a.dept)).get()!;
    db.insert(officers).values({ userId: u.id, departmentId: d.id, title: a.title }).run();
  }
  return u;
}

type Demo = [title: string, description: string, location: string, category: string, ageHours: number, final: string, rating?: number];
const DEMO_CASES: Demo[] = [
  ["Deep pothole near the bus stop", "A large pothole on the main road is damaging two-wheelers and causing near accidents every day.", "5th Avenue near building 42", "Pothole Repair", 30, "in_progress"],
  ["Streetlights dark on library road", "Four streetlights have been out for a week and the road is unsafe after sunset.", "Library Road", "Street Lighting Outage", 20, "assigned"],
  ["Drain blocked after rain", "The storm drain is blocked and water stands knee deep for two days after every shower.", "Market Junction", "Drainage & Flooding", 100, "in_progress"],
  ["Broken footpath tiles", "Several footpath tiles are cracked and loose near the school gate.", "School Lane", "Footpath & Signage", 200, "resolved", 5],
  ["No water supply for three days", "Our lane has had no water supply for three days and tankers are not coming.", "Lane 4, North Block", "Water Supply Disruption", 20, "acknowledged"],
  ["Sewage overflowing onto the road", "A manhole is overflowing and sewage is reaching the doorsteps of nearby homes.", "Canal Road", "Sewerage Overflow", 60, "in_progress"],
  ["Garbage not collected for a week", "The garbage truck has not come for a week and the dustbins are overflowing with bad smell.", "Sector 9 market", "Waste Collection", 150, "closed", 4],
  ["Muddy water from the tap", "The water from the tap has been muddy and smells bad since Monday.", "Green Park Colony", "Water Quality", 10, "submitted"],
  ["Playground swing broken", "A swing in the children's park has a broken chain and is dangerous for kids.", "Central Park", "Parks & Open Spaces", 40, "in_progress"],
  ["Loud music every night", "Very loud music plays every night past midnight and nobody can sleep.", "Hostel Block C", "Noise & Nuisance", 8, "submitted"],
  ["Lift out of service", "The lift in the administration building has not worked for two weeks.", "Administration building", "Facilities & Buildings", 320, "in_progress"],
  ["Unsafe wiring near classroom", "Exposed wires near the classroom entrance look unsafe and may cause an accident.", "Science block", "Public Safety", 12, "acknowledged"],
];

export function seedDemoCases(now = Date.now()) {
  if (db.select().from(cases).limit(1).get()) return;
  const H = 3_600_000;
  for (const [title, description, location, category, age, final, rating] of DEMO_CASES) {
    const cat = db.select().from(categories).where(eq(categories.name, category)).get()!;
    const dept = db.select().from(departments).where(eq(departments.id, cat.departmentId)).get()!;
    const officer = db.select().from(officers).where(eq(officers.departmentId, dept.id)).get();
    const t0 = now - age * H;
    let { case: c } = createCase({ title, description, location, categoryId: cat.id, priority: /accident|unsafe|sewage/i.test(description) ? "high" : "medium" }, t0);
    const path = ["acknowledged", "assigned", "in_progress", "resolved", "closed"];
    const stop = final === "escalated" ? "in_progress" : final;
    const admin = { type: "admin" as const, name: "System Administrator" };
    for (const [i, step] of path.entries()) {
      const at = t0 + ((now - t0) * (i + 1)) / (path.length + 2);
      if (step === "assigned" && officer) c = assignCase(c, officer.userId, admin, "the departmental officer", at);
      else if (step === "assigned") c = moveCase(c, step, admin, "", {}, at);
      else c = moveCase(c, step, { type: step === "resolved" || step === "closed" ? "officer" : "admin", name: "Staff" }, step === "resolved" ? "Repair completed and verified on site." : "", {}, at);
      if (step === stop) break;
    }
    if (rating) setFeedback(db.select().from(cases).where(and(eq(cases.id, c.id))).get()!, rating, rating >= 5 ? "Fixed quickly. Thank you." : "Good work, took a little long.");
  }
  sweepSla(now);
}
