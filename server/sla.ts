import { eq } from "drizzle-orm";
import { cases, timelineEvents } from "../drizzle/schema";
import { db, dueForEscalation } from "./db";

/**
 * Escalate open cases past their statutory deadline: raise priority to critical, flag as escalated,
 * and move in-progress cases to `escalated`. Each case is escalated at most once per deadline.
 */
export function sweepSla(now = Date.now()): number {
  const due = dueForEscalation(now);
  db.transaction((tx) => {
    for (const c of due) {
      const to = c.status === "in_progress" ? "escalated" : c.status;
      tx.update(cases).set({ priority: "critical", escalated: true, status: to, updatedAt: now }).where(eq(cases.id, c.id)).run();
      tx.insert(timelineEvents).values({ caseId: c.id, actorType: "system", actorName: "SLA Monitor", fromStatus: c.status, toStatus: to, at: now,
        note: "Statutory deadline passed. Priority raised to critical and escalated for executive attention." }).run();
    }
  });
  return due.length;
}
