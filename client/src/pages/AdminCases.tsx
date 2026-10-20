import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { errorMessage, trpc } from "../_core/trpc";
import { PriorityBadge, SlaChip, StatusBadge, STATUS_LABEL, STATUS_ORDER } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Button, Card, Empty, IconInput, PageHeader, selectCls, Spinner } from "../components/ui";
import { useDebounce } from "../hooks/useDebounce";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

export default function AdminCases() {
  useDocumentTitle("Case Triage");
  const notify = useToast();
  const utils = trpc.useUtils();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const search = useDebounce(q);
  const list = trpc.admin.cases.useQuery({ page, pageSize, search: search || undefined, status: (status || undefined) as undefined, priority: (priority || undefined) as undefined });
  const officers = trpc.admin.officers.useQuery();
  const assign = trpc.admin.assign.useMutation({
    onSuccess: (r) => { notify(`${r.trackingNumber} assigned.`); utils.admin.cases.invalidate(); },
    onError: (e) => notify(errorMessage(e), "bad"),
  });
  const total = list.data?.total ?? 0, pages = Math.max(1, Math.ceil(total / pageSize));
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <SidebarShell mode="staff" crumb="Case Triage">
      <PageHeader eyebrow="Comprehensive Triage" title="Every grievance, in one docket" sub="Inspect all recorded cases, check urgency, and dispatch each one to a field officer." />
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1"><IconInput icon={<Search size={19} />} aria-label="Search cases" placeholder="Search title, tracking number or location" value={q} onChange={(e) => reset(setQ)(e.target.value)} className="!h-12" /></div>
        <select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={`${selectCls} !h-12 !w-auto`}><option value="">Any status</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select aria-label="Priority" value={priority} onChange={(e) => reset(setPriority)(e.target.value)} className={`${selectCls} !h-12 !w-auto`}><option value="">Any priority</option>{["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <Card className="mt-6 overflow-hidden p-0">
        {list.isLoading ? <Spinner /> : !list.data?.rows.length ? <Empty>No cases match these filters.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
            <thead><tr className="border-b border-line bg-surface2/60 text-xs uppercase tracking-wider text-faint"><th className="px-6 py-4">Reference</th><th className="px-3 py-4">Title &amp; location</th><th className="px-3 py-4">Priority</th><th className="px-3 py-4">Status</th><th className="px-3 py-4">Deadline</th><th className="px-6 py-4">Field officer</th></tr></thead>
            <tbody>{list.data.rows.map((c) => {
              const options = (officers.data ?? []).filter((o) => o.departmentId === c.departmentId);
              const closed = c.status === "closed";
              return (
                <tr key={c.trackingNumber} className="border-b border-line last:border-0 hover:bg-surface2/50">
                  <td className="px-6 py-4"><Link href={`/officer/cases/${c.trackingNumber}`} className="font-mono text-[13px] font-medium text-blue hover:underline">{c.trackingNumber}</Link></td>
                  <td className="px-3 py-4 font-medium">{c.title}<p className="text-xs font-normal text-mute">{c.location}</p></td>
                  <td className="px-3 py-4"><PriorityBadge priority={c.priority} /></td><td className="px-3 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-4"><SlaChip status={c.status} targetDate={c.targetDate} resolvedAt={c.resolvedAt} /></td>
                  <td className="px-6 py-4"><select aria-label={`Assign ${c.trackingNumber}`} disabled={closed || assign.isPending} value={c.assignedOfficerId ?? ""} onChange={(e) => e.target.value && assign.mutate({ trackingNumber: c.trackingNumber, officerUserId: Number(e.target.value) })} className={`${selectCls} !h-10 !w-48 !rounded-xl !px-3 !text-sm`}><option value="">Unassigned</option>{options.map((o) => <option key={o.userId} value={o.userId}>{o.name}</option>)}</select></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm text-mute">
          <span>{total} case{total === 1 ? "" : "s"} · page {page} of {pages}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">Rows <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={`${selectCls} !h-9 !w-auto !rounded-xl !px-3 !text-sm`}>{[15, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></label>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></Button>
          </div>
        </div>
      </Card>
    </SidebarShell>
  );
}
