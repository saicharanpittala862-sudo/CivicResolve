import { LayoutList, Columns3, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../_core/trpc";
import { useAuth } from "../_core/useAuth";
import { PriorityBadge, SlaChip, StatusBadge, STATUS_LABEL, STATUS_ORDER } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Card, Empty, IconInput, PageHeader, selectCls, Spinner, Stat } from "../components/ui";
import { useDebounce } from "../hooks/useDebounce";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const COLUMNS = [
  { name: "To do", statuses: ["submitted", "acknowledged", "assigned"] },
  { name: "In progress", statuses: ["in_progress", "escalated", "reopened"] },
  { name: "Resolved", statuses: ["resolved"] },
  { name: "Closed", statuses: ["closed"] },
];
const DOT: Record<string, string> = { low: "bg-faint", medium: "bg-blue", high: "bg-amber", critical: "bg-red" };

export default function Manage() {
  useDocumentTitle("Operations Queue");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const search = useDebounce(q);
  const queue = trpc.officer.queue.useQuery({
    search: search || undefined, status: (status || undefined) as undefined, priority: (priority || undefined) as undefined, overdueOnly: overdue || undefined,
  });
  const k = queue.data?.kpis;
  const rows = queue.data?.cases ?? [];

  return (
    <SidebarShell mode="staff" crumb="Operations Queue">
      <PageHeader eyebrow="Operations Workspace" title="Operational queue & SLA board" sub={user?.role === "officer" ? "Cases for your department, most urgent deadline first." : "Cases across every department, most urgent deadline first."} />
      {k && (
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Total cases" value={k.total} /><Stat label="Open" value={k.open} /><Stat label="Overdue" value={k.overdue} tone={k.overdue ? "red" : undefined} />
          <Stat label="Avg. resolution" value={`${k.avgResolutionHours}h`} /><Stat label="Completion" value={`${k.completionPct}%`} />
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1"><IconInput icon={<Search size={19} />} aria-label="Search cases" placeholder="Search title, tracking number or location" value={q} onChange={(e) => setQ(e.target.value)} className="!h-12" /></div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectCls} !h-12 !w-auto`}><option value="">Any status</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={`${selectCls} !h-12 !w-auto`}><option value="">Any priority</option>{["low", "medium", "high", "critical"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select>
        <label className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-medium"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
        <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
          {([["board", <Columns3 key="b" size={17} />, "Board"], ["list", <LayoutList key="l" size={17} />, "List"]] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold ${view === v ? "bg-dark text-dark-ink" : "text-mute"}`}>{icon}{label}</button>
          ))}
        </div>
      </div>

      {queue.isLoading ? <Spinner /> : view === "board" ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = rows.filter((c) => col.statuses.includes(c.status));
            return (
              <section key={col.name} aria-label={col.name} className="rounded-3xl bg-surface2/70 p-4">
                <h2 className="px-2 pb-3 font-sans text-sm font-semibold tracking-normal">{col.name} <span className="ml-1 text-faint">{items.length}</span></h2>
                <ul className="space-y-3">
                  {items.map((c) => (
                    <li key={c.trackingNumber}>
                      <Link href={`/officer/cases/${c.trackingNumber}`} className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-blue">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-blue">{c.department}</span><span className={`h-2.5 w-2.5 rounded-full ${DOT[c.priority]}`} title={`${c.priority} priority`} /></div>
                        <p className="mt-2 text-[15px] font-semibold leading-snug">{c.title}</p>
                        <p className="mt-1 font-mono text-[11px] text-faint">{c.trackingNumber}</p>
                        <div className="mt-3 flex flex-wrap gap-2">{c.status === "escalated" || c.escalated ? <StatusBadge status="escalated" /> : null}<SlaChip status={c.status} targetDate={c.targetDate} resolvedAt={c.resolvedAt} /></div>
                      </Link>
                    </li>
                  ))}
                  {!items.length && <li className="px-2 py-6 text-center text-sm text-faint">Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="mt-8 overflow-hidden p-0">
          {!rows.length ? <Empty>No cases match these filters.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
              <thead><tr className="border-b border-line bg-surface2/60 text-xs uppercase tracking-wider text-faint"><th className="px-6 py-4">Case</th><th className="px-3 py-4">Issue</th><th className="px-3 py-4">Priority</th><th className="px-3 py-4">Status</th><th className="px-6 py-4">Deadline</th></tr></thead>
              <tbody>{rows.map((c) => (
                <tr key={c.trackingNumber} className="border-b border-line last:border-0 hover:bg-surface2/50">
                  <td className="px-6 py-4"><Link href={`/officer/cases/${c.trackingNumber}`} className="font-mono text-[13px] font-medium text-blue hover:underline">{c.trackingNumber}</Link></td>
                  <td className="px-3 py-4 font-medium">{c.title}<p className="text-xs font-normal text-mute">{c.location}</p></td>
                  <td className="px-3 py-4"><PriorityBadge priority={c.priority} /></td><td className="px-3 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-6 py-4"><SlaChip status={c.status} targetDate={c.targetDate} resolvedAt={c.resolvedAt} /></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </SidebarShell>
  );
}
