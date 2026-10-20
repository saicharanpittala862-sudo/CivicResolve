import { Check, Star } from "lucide-react";
import { Pill, type Tone } from "./ui";

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", acknowledged: "Acknowledged", assigned: "Assigned", in_progress: "In Progress",
  escalated: "Escalated", resolved: "Resolved", reopened: "Reopened", closed: "Closed",
};
export const STATUS_ORDER = ["submitted", "acknowledged", "assigned", "in_progress", "escalated", "resolved", "reopened", "closed"];
export const STATUS_TONE: Record<string, Tone> = {
  submitted: "slate", acknowledged: "blue", assigned: "violet", in_progress: "blue", escalated: "red", resolved: "green", reopened: "amber", closed: "slate",
};
export const PRIORITY_TONE: Record<string, Tone> = { low: "slate", medium: "blue", high: "amber", critical: "red" };

export const StatusBadge = ({ status }: { status: string }) => <Pill tone={STATUS_TONE[status] ?? "slate"}>{STATUS_LABEL[status] ?? status}</Pill>;
export const PriorityBadge = ({ priority }: { priority: string }) => <Pill tone={PRIORITY_TONE[priority] ?? "slate"} className="capitalize">{priority}</Pill>;

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function span(ms: number) {
  const h = Math.round(ms / 3_600_000);
  return h < 48 ? `${Math.max(h, 1)}h` : `${Math.round(h / 24)}d`;
}
/** Live deadline indicator for open cases; outcome for finished ones. */
export function SlaChip({ status, targetDate, resolvedAt }: { status: string; targetDate: number; resolvedAt?: number | null }) {
  if (resolvedAt) return resolvedAt <= targetDate ? <Pill tone="green">Resolved within SLA</Pill> : <Pill tone="amber">Resolved after deadline</Pill>;
  if (status === "closed") return <Pill tone="slate">Closed</Pill>;
  const left = targetDate - Date.now();
  return left < 0 ? <Pill tone="red">Overdue by {span(-left)}</Pill> : <Pill tone="slate">Due in {span(left)}</Pill>;
}

const STEPS = ["Submitted", "Acknowledged", "In Progress", "Resolved"];
export function ProgressBar({ stage }: { stage: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Case progress">
      {STEPS.map((s, i) => (
        <li key={s} className="min-w-0" aria-current={i === stage ? "step" : undefined}>
          <div className={`h-1.5 rounded-full ${i <= stage ? "bg-blue" : "bg-line"}`} />
          <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold sm:text-sm ${i <= stage ? "text-ink" : "text-faint"}`}>
            {i < stage || (stage === 3 && i === 3) ? <Check size={14} className="text-blue" aria-hidden /> : null}<span className="truncate">{s}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Timeline({ items }: { items: { label: string; actor: string; note: string; at: number; internal?: boolean; statusChange?: boolean }[] }) {
  return (
    <ol className="relative ml-2 border-l-2 border-line pl-6">
      {items.map((e, i) => (
        <li key={i} className="relative pb-6 last:pb-0">
          <span className={`absolute -left-[33px] top-1.5 h-3 w-3 rounded-full ring-4 ring-surface ${e.statusChange === false ? "bg-faint" : "bg-blue"}`} aria-hidden />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <b className="text-[15px]">{e.statusChange === false ? "Update" : e.label}</b>
            <span className="text-faint">{fmtDateTime(e.at)} · {e.actor}</span>
            {e.internal && <Pill tone="amber">Internal</Pill>}
          </p>
          {e.note && <p className="mt-1 text-[15px] text-mute">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : "img"} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star size={size} className={n <= value ? "fill-amber text-amber" : "text-line"} aria-hidden />;
        return onChange ? <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="cursor-pointer">{star}</button> : <span key={n}>{star}</span>;
      })}
    </div>
  );
}
