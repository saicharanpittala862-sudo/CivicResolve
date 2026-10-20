import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../_core/trpc";
import { SlaChip, StatusBadge, fmtDate } from "../components/CaseParts";
import PublicShell from "../components/PublicShell";
import { Card, Empty, IconInput, PageHeader, Spinner } from "../components/ui";
import { useDebounce } from "../hooks/useDebounce";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function Board() {
  useDocumentTitle("Public Grievance Ledger");
  const [q, setQ] = useState("");
  const search = useDebounce(q);
  const board = trpc.public.board.useQuery({ search: search || undefined, limit: 50 });
  return (
    <PublicShell>
      <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-12">
        <PageHeader eyebrow="Public Grievance Ledger" title="Recent filings across all departments" sub="A transparent register of civic concerns. Names, contact details and street addresses are never shown." />
        <div className="mt-10 max-w-xl"><IconInput icon={<Search size={20} />} aria-label="Search the ledger" placeholder="Search by title, tracking number or area" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Card className="mt-8 overflow-hidden p-0">
          {board.isLoading ? <Spinner /> : !board.data?.length ? <Empty>No cases match your search.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr className="border-b border-line bg-surface2/60 text-xs uppercase tracking-wider text-faint"><th className="px-6 py-4 font-semibold">Case</th><th className="px-3 py-4 font-semibold">Issue</th><th className="px-3 py-4 font-semibold">Department</th><th className="px-3 py-4 font-semibold">Status</th><th className="px-6 py-4 font-semibold">Deadline</th></tr></thead>
                <tbody>
                  {board.data.map((c) => (
                    <tr key={c.trackingNumber} className="border-b border-line last:border-0 hover:bg-surface2/50">
                      <td className="px-6 py-4"><Link href={`/track/${c.trackingNumber}`} className="font-mono text-[13px] font-medium text-blue hover:underline">{c.trackingNumber}</Link><p className="text-xs text-faint">{fmtDate(c.createdAt)}</p></td>
                      <td className="px-3 py-4 font-medium">{c.title}<p className="text-xs font-normal text-mute">{c.category}</p></td>
                      <td className="px-3 py-4 text-mute">{c.department}</td>
                      <td className="px-3 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-6 py-4"><SlaChip status={c.status} targetDate={c.targetDate} resolvedAt={c.resolvedAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </PublicShell>
  );
}
