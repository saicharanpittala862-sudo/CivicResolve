import { AlertTriangle } from "lucide-react";
import { trpc, errorMessage } from "../_core/trpc";
import { BarChart, Donut, HBarChart } from "../components/charts";
import { STATUS_LABEL } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Button, Card, Empty, PageHeader, Spinner, Stat } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

const STATUS_COLOR: Record<string, string> = { submitted: "var(--faint)", acknowledged: "var(--blue)", assigned: "var(--violet)", in_progress: "#0e9fbd", escalated: "var(--red)", resolved: "var(--green)", reopened: "var(--amber)", closed: "var(--slate)" };

export default function Admin() {
  useDocumentTitle("Executive Analytics");
  const notify = useToast();
  const utils = trpc.useUtils();
  const dash = trpc.admin.dashboard.useQuery(undefined, { refetchInterval: 30_000 });
  const sweep = trpc.admin.sweep.useMutation({
    onSuccess: (r) => { notify(r.escalated ? `Escalated ${r.escalated} overdue case(s).` : "Nothing is overdue."); utils.admin.dashboard.invalidate(); },
    onError: (e) => notify(errorMessage(e), "bad"),
  });
  const d = dash.data;
  return (
    <SidebarShell mode="staff" crumb="Executive Analytics">
      <PageHeader eyebrow="Executive Governance" title="SLA telemetry & oversight" sub="Caseload, resolution speed and deadline compliance across every department. Refreshes every 30 seconds." />
      {dash.isLoading ? <Spinner /> : !d ? null : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Open cases" value={d.open} /><Stat label="Total registered" value={d.total} /><Stat label="Overdue (SLA)" value={d.overdue} tone={d.overdue ? "red" : undefined} />
            <Stat label="Avg. turnaround" value={`${d.mttrHours}h`} note="Mean time to resolution" /><Stat label="Escalations" value={d.escalated} />
          </div>
          {d.overdue > 0 && (
            <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-red-soft p-5 text-red">
              <p className="flex items-center gap-3 font-semibold"><AlertTriangle size={20} aria-hidden />{d.overdue} case{d.overdue > 1 ? "s have" : " has"} passed the statutory deadline. Executive attention is needed.</p>
              <Button variant="dark" size="sm" disabled={sweep.isPending} onClick={() => sweep.mutate()}>Escalate overdue now</Button>
            </div>
          )}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card><h2 className="text-3xl">Department caseload</h2><div className="mt-6"><BarChart label="Cases per department" data={d.byDepartment} /></div></Card>
            <Card><h2 className="text-3xl">Status mix</h2><div className="mt-6">{d.total ? <Donut label="Cases by status" centre={String(d.total)} data={d.byStatus.map((s) => ({ name: STATUS_LABEL[s.status] ?? s.status, count: s.count, color: STATUS_COLOR[s.status] }))} /> : <Empty>No cases yet.</Empty>}</div></Card>
            <Card><h2 className="text-3xl">Most reported issues</h2><div className="mt-6">{d.byCategory.length ? <HBarChart label="Cases per category" data={d.byCategory} /> : <Empty>No cases yet.</Empty>}</div></Card>
            <Card>
              <h2 className="text-3xl">Officer workload</h2>
              {!d.officerLoad.length ? <Empty>No officers yet.</Empty> : (
                <table className="mt-6 w-full text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wider text-faint"><th className="py-3 font-semibold">Officer</th><th className="py-3 font-semibold">Department</th><th className="py-3 text-right font-semibold">Active</th></tr></thead>
                  <tbody>{d.officerLoad.map((o) => <tr key={o.name} className="border-b border-line last:border-0"><td className="py-3 font-medium">{o.name}<p className="text-xs font-normal text-mute">{o.title}</p></td><td className="py-3 text-mute">{o.department}</td><td className="py-3 text-right font-semibold">{o.active}</td></tr>)}</tbody></table>
              )}
            </Card>
          </div>
        </>
      )}
    </SidebarShell>
  );
}
