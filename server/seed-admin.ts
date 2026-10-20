import { seedCatalog } from "./catalog";
import { DEMO_ACCOUNTS, demoEnabled, ensureStaff, seedDemoCases } from "./demo";

/**
 * Safe to re-run. Always seeds the department/category catalog.
 *  - DEMO_MODE=true: creates the four demo staff accounts and sample cases (publicly visible credentials; demos only).
 *  - otherwise: creates one admin from ADMIN_EMAIL / ADMIN_PASSWORD, and optionally one officer per department.
 */
seedCatalog();
if (demoEnabled()) {
  for (const a of DEMO_ACCOUNTS) { await ensureStaff(a); console.log(`demo account ${a.email}`); }
  seedDemoCases();
  console.log("Demo cases ready.");
} else {
  const email = process.env.ADMIN_EMAIL ?? "admin@civicresolve.internal";
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) { console.error("Set ADMIN_PASSWORD (at least 12 characters), or set DEMO_MODE=true for demo data."); process.exit(1); }
  await ensureStaff({ email, name: "System Administrator", role: "admin", password, dept: null, title: "" });
  console.log(`admin ready: ${email}`);
  if (process.env.OFFICER_PASSWORD) {
    for (const a of DEMO_ACCOUNTS.filter((x) => x.role === "officer")) {
      await ensureStaff({ ...a, email: a.email.replace("@civicresolve.internal", "@civicresolve.local"), password: process.env.OFFICER_PASSWORD });
      console.log(`officer ready: ${a.email.replace("@civicresolve.internal", "@civicresolve.local")}`);
    }
  }
}
