/** Grievance lifecycle as an explicit finite state machine with per-actor authority. */
export const STATUSES = ["submitted", "acknowledged", "assigned", "in_progress", "escalated", "resolved", "reopened", "closed"] as const;
export type Status = (typeof STATUSES)[number];
export type Actor = "citizen" | "officer" | "admin" | "system";

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted", acknowledged: "Acknowledged", assigned: "Assigned", in_progress: "In Progress",
  escalated: "Escalated", resolved: "Resolved", reopened: "Reopened", closed: "Closed",
};

/** from>to -> who may perform it. Anything not listed is illegal. */
const RULES: Record<string, readonly Actor[]> = {
  "submitted>acknowledged": ["admin", "officer"],
  "acknowledged>assigned": ["admin", "officer"],
  "assigned>in_progress": ["admin", "officer"],
  "in_progress>escalated": ["system"],
  "in_progress>resolved": ["admin", "officer"],
  "escalated>in_progress": ["admin", "officer"],
  "resolved>closed": ["admin", "officer"],
  "resolved>reopened": ["citizen"],
  "reopened>in_progress": ["admin", "officer"],
};

export const OPEN_STATUSES: readonly Status[] = ["submitted", "acknowledged", "assigned", "in_progress", "escalated", "reopened"];
export const isOpen = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);
export const isStatus = (s: string): s is Status => (STATUSES as readonly string[]).includes(s);

export const isLegal = (from: string, to: string) => `${from}>${to}` in RULES;
export const canMove = (from: string, to: string, actor: Actor) => RULES[`${from}>${to}`]?.includes(actor) ?? false;
export const nextStatuses = (from: string, actor: Actor): Status[] =>
  STATUSES.filter((to) => canMove(from, to, actor));

/** Position on the four-step public progress bar. */
export const MILESTONES = ["Submitted", "Acknowledged", "In Progress", "Resolved"] as const;
export function milestoneIndex(s: string): number {
  if (s === "submitted") return 0;
  if (s === "acknowledged" || s === "assigned") return 1;
  if (s === "in_progress" || s === "escalated" || s === "reopened") return 2;
  return 3;
}
