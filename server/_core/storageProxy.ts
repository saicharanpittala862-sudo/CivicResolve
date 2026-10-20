import type { Express } from "express";
import { attachmentByKey, caseById, caseByTracking, officerOf, verifyAccess } from "../db";
import { storage } from "../storage";
import { getSessionUser } from "./sdk";

/**
 * Evidence downloads. Allowed for: an admin, the officer of the case's department,
 * or a citizen presenting the matching tracking number and access code.
 */
export function registerStorageProxy(app: Express) {
  app.get("/api/attachments/:key", async (req, res) => {
    const a = attachmentByKey(req.params.key);
    const c = a ? caseById(a.caseId) : undefined;
    if (!a || !c) return void res.status(404).json({ error: "Not found" });

    const user = await getSessionUser(req);
    const staffOk = !!user && (user.role === "admin" || officerOf(user.id)?.departmentId === c.departmentId);
    const tn = String(req.query.trackingNumber ?? "");
    const citizenOk = !staffOk && tn.toUpperCase() === c.trackingNumber && verifyAccess(c, String(req.query.accessCode ?? ""));
    if (!staffOk && !citizenOk) return void res.status(404).json({ error: "Not found" }); // same answer as missing

    const data = await storage.get(a.key);
    if (!data) return void res.status(404).json({ error: "Not found" });
    res.set({
      "Content-Type": a.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:",
      "Content-Disposition": `inline; filename="${a.filename.replace(/"/g, "")}"`,
    });
    res.send(data);
  });
}
