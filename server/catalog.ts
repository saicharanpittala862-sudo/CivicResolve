import { and, eq } from "drizzle-orm";
import { categories, departments } from "../drizzle/schema";
import { db } from "./db";

export const CATALOG = [
  { name: "Public Works", slug: "public-works", slaHours: 72, description: "Roads, street lighting, drainage and public infrastructure maintenance.",
    categories: [
      ["Pothole Repair", "Say which road and the nearest landmark. Note if it is a danger to two-wheelers."],
      ["Street Lighting Outage", "Give the pole number if visible, or the nearest junction."],
      ["Drainage & Flooding", "Describe how deep the water gets and how long it has been blocked."],
      ["Footpath & Signage", "Mention damaged pavements, missing signs or faulty signals."],
    ] },
  { name: "Water and Sanitation", slug: "water-sanitation", slaHours: 48, description: "Drinking water, sewerage, waste collection and sanitation services.",
    categories: [
      ["Water Supply Disruption", "Say since when there has been no or low supply and how many homes are affected."],
      ["Sewerage Overflow", "Note the exact spot and whether it is reaching homes or roads."],
      ["Waste Collection", "Mention the usual collection day and how many days were missed."],
      ["Water Quality", "Describe the colour, smell or taste and how long it has been happening."],
    ] },
  { name: "Community Services", slug: "community-services", slaHours: 96, description: "Public safety, parks, community facilities and neighbourhood concerns.",
    categories: [
      ["Public Safety", "For emergencies call your local emergency number first. Describe the hazard here."],
      ["Parks & Open Spaces", "Describe damaged equipment, lighting or maintenance problems."],
      ["Facilities & Buildings", "Name the building or facility and the room or floor affected."],
      ["Noise & Nuisance", "Give times and frequency so inspectors can plan a visit."],
    ] },
] as const;

/** Idempotent: safe to run on every start. */
export function seedCatalog() {
  for (const d of CATALOG) {
    db.insert(departments).values({ name: d.name, slug: d.slug, description: d.description, slaHours: d.slaHours }).onConflictDoNothing().run();
    const dept = db.select().from(departments).where(eq(departments.slug, d.slug)).get()!;
    for (const [name, guidance] of d.categories) {
      const exists = db.select().from(categories).where(and(eq(categories.departmentId, dept.id), eq(categories.name, name))).get();
      if (!exists) db.insert(categories).values({ departmentId: dept.id, name, guidance }).run();
    }
  }
}
