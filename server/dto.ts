import type { Case } from "../drizzle/schema";
import { allCategories, allDepartments, attachmentsFor, eventsFor, userById } from "./db";
import { isOpen, milestoneIndex, nextStatuses, STATUS_LABEL, type Actor, type Status } from "./workflow";

export const maskEmail = (e?: string | null) => (e ? e.replace(/^(.)[^@]*(@.*)$/, "$1***$2") : null);

const GENERIC: Record<Actor, string> = { citizen: "Citizen", officer: "Assigned Officer", admin: "Administrator", system: "System" };

function names(c: Case) {
  return {
    department: allDepartments().find((d) => d.id === c.departmentId)?.name ?? "",
    category: allCategories().find((x) => x.id === c.categoryId)?.name ?? "",
  };
}

/** Row shape used by lists on the public ledger. No description, location, contact or staff identity. */
export function boardRow(c: Case) {
  const n = names(c);
  return { trackingNumber: c.trackingNumber, title: c.title, department: n.department, category: n.category, status: c.status,
    statusLabel: STATUS_LABEL[c.status as Status], priority: c.priority, createdAt: c.createdAt, targetDate: c.targetDate, resolvedAt: c.resolvedAt, feedbackScore: c.feedbackScore };
}

/** Citizen-facing case: masked email, no street location, no staff identities, no internal notes. */
export function publicCase(c: Case) {
  return {
    ...boardRow(c), description: c.description, maskedEmail: maskEmail(c.contactEmail), escalated: c.escalated,
    stage: milestoneIndex(c.status), slaMet: c.resolvedAt === null ? null : c.resolvedAt <= c.targetDate,
    canReopen: c.status === "resolved", canRate: (c.status === "resolved" || c.status === "closed") && c.feedbackScore === null,
    feedbackComment: c.feedbackComment,
    timeline: eventsFor(c.id, false).map((e) => ({ label: STATUS_LABEL[e.toStatus as Status] ?? e.toStatus, actor: GENERIC[e.actorType], note: e.note, at: e.at, statusChange: e.fromStatus !== e.toStatus })),
    attachments: attachmentsFor(c.id).map((a) => ({ key: a.key, filename: a.filename, mime: a.mime, size: a.size })),
  };
}

/** Staff view adds location, assignment, internal notes and the actions this actor may take. */
export function staffCase(c: Case, actor: "officer" | "admin") {
  const assignee = c.assignedOfficerId ? userById(c.assignedOfficerId) : undefined;
  return {
    ...boardRow(c), departmentId: c.departmentId, description: c.description, location: c.location, maskedEmail: maskEmail(c.contactEmail), escalated: c.escalated,
    assignedOfficerId: c.assignedOfficerId, assignedOfficerName: assignee?.name ?? null, overdue: isOpen(c.status) && c.targetDate < Date.now(),
    nextStatuses: nextStatuses(c.status, actor).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    timeline: eventsFor(c.id, true).map((e) => ({ label: STATUS_LABEL[e.toStatus as Status] ?? e.toStatus, actor: e.actorName, note: e.note, at: e.at, internal: e.internal, statusChange: e.fromStatus !== e.toStatus })),
    attachments: attachmentsFor(c.id).map((a) => ({ key: a.key, filename: a.filename, mime: a.mime, size: a.size })),
  };
}
