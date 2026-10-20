import { ArrowLeft, MapPin, Paperclip } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { errorMessage, trpc } from "../_core/trpc";
import { useAuth } from "../_core/useAuth";
import { PriorityBadge, ProgressBar, SlaChip, StatusBadge, Timeline } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Button, Card, ErrorNote, Field, Pill, selectCls, Spinner, textareaCls } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

const stageOf = (s: string) => (s === "submitted" ? 0 : s === "acknowledged" || s === "assigned" ? 1 : s === "resolved" || s === "closed" ? 3 : 2);

export default function CaseDetail() {
  const { trackingNumber = "" } = useParams<{ trackingNumber: string }>();
  useDocumentTitle(trackingNumber);
  const notify = useToast();
  const utils = trpc.useUtils();
  const { user, isAdmin } = useAuth();
  const c = trpc.officer.case.useQuery({ trackingNumber });
  const officers = trpc.admin.officers.useQuery(undefined, { enabled: isAdmin });
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState("");
  const [internal, setInternal] = useState(false);
  const [err, setErr] = useState("");
  const refresh = () => { utils.officer.case.invalidate(); utils.officer.queue.invalidate(); utils.admin.cases.invalidate(); };
  const onError = (e: unknown) => setErr(errorMessage(e));
  const update = trpc.officer.updateCase.useMutation({ onSuccess: (r) => { notify(`${r.trackingNumber} is now ${r.statusLabel}`); setNote(""); setErr(""); refresh(); }, onError });
  const addProgress = trpc.officer.addProgress.useMutation({ onSuccess: () => { notify("Update recorded."); setProgress(""); setErr(""); refresh(); }, onError });
  const assign = trpc.admin.assign.useMutation({ onSuccess: (r) => { notify(`${r.trackingNumber} assigned.`); refresh(); }, onError: (e) => notify(errorMessage(e), "bad") });

  return (
    <SidebarShell mode="staff" crumb={trackingNumber}>
      <Link href="/manage" className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:underline"><ArrowLeft size={16} />Back to queue</Link>
      {c.isLoading ? <Spinner /> : c.error || !c.data ? <Card className="mt-6"><p role="alert" className="font-semibold">That case was not found, or it belongs to another department.</p></Card> : (() => {
        const d = c.data;
        const deptOfficers = (officers.data ?? []).filter((o) => o.departmentId === d.departmentId);
        const mine = d.assignedOfficerId === user?.id;
        return (
          <div className="mt-6 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-8">
              <Card className="p-7 sm:p-9">
                <p className="font-mono text-sm font-medium tracking-wider text-faint">{d.trackingNumber}</p>
                <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{d.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-2"><StatusBadge status={d.status} /><PriorityBadge priority={d.priority} /><SlaChip status={d.status} targetDate={d.targetDate} resolvedAt={d.resolvedAt} />{d.escalated && <Pill tone="red">Escalated</Pill>}</div>
                <p className="mt-4 text-mute">{d.department} · {d.category}</p>
                <div className="mt-8"><ProgressBar stage={stageOf(d.status)} /></div>
                <h2 className="mt-9 text-2xl">Description</h2><p className="mt-2 whitespace-pre-wrap leading-relaxed text-mute">{d.description}</p>
                <p className="mt-5 flex items-center gap-2 text-[15px]"><MapPin size={17} className="text-blue" aria-hidden /><span className="font-medium">{d.location}</span></p>
                {d.maskedEmail && <p className="mt-2 text-sm text-mute">Contact on file: <span className="font-mono">{d.maskedEmail}</span></p>}
                {d.attachments.length > 0 && <ul className="mt-6 flex flex-wrap gap-3">{d.attachments.map((a) => <li key={a.key}><a href={`/api/attachments/${a.key}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-blue hover:bg-surface2"><Paperclip size={14} aria-hidden />{a.filename}</a></li>)}</ul>}
                {d.feedbackScore !== null && <p className="mt-6 text-sm text-mute">Citizen rating: <b className="text-ink">{d.feedbackScore}/5</b></p>}
              </Card>
              <Card className="p-7 sm:p-9"><h2 className="text-3xl">Audit trail</h2><div className="mt-6"><Timeline items={d.timeline} /></div></Card>
            </div>
            <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
              <Card>
                <h2 className="text-3xl">Move this case</h2>
                <p className="mt-1 text-sm text-mute">Only legal next steps are offered for your role.</p>
                <Field label="Note" hint="Resolution notes are required (10+ characters) when marking a case resolved."><textarea className={`${textareaCls} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></Field>
                <div className="mt-5 flex flex-wrap gap-3">
                  {d.nextStatuses.map((s) => <Button key={s.value} size="md" variant={s.value === "resolved" ? "blue" : "dark"} disabled={update.isPending} onClick={() => update.mutate({ trackingNumber, to: s.value as "closed", note })}>{s.value === "assigned" && !isAdmin ? "Assign to me" : `Mark ${s.label.toLowerCase()}`}</Button>)}
                  {d.status === "resolved" && <p className="w-full text-sm text-mute">Waiting for the citizen to confirm the fix. You can also close the case now.</p>}
                  {!d.nextStatuses.length && <p className="text-sm text-mute">No further actions.</p>}
                </div>
                {err && <ErrorNote>{err}</ErrorNote>}
              </Card>
              {isAdmin && !["closed"].includes(d.status) && (
                <Card>
                  <h2 className="text-3xl">Assignment</h2>
                  <p className="mt-1 text-sm text-mute">Currently: <b className="text-ink">{d.assignedOfficerName ?? "Unassigned"}</b></p>
                  <Field label="Assign an officer"><select className={selectCls} value={d.assignedOfficerId ?? ""} onChange={(e) => e.target.value && assign.mutate({ trackingNumber, officerUserId: Number(e.target.value) })} aria-label="Assign an officer"><option value="">Choose officer…</option>{deptOfficers.map((o) => <option key={o.userId} value={o.userId}>{o.name} · {o.title}</option>)}</select></Field>
                </Card>
              )}
              {!["closed"].includes(d.status) && (
                <Card>
                  <h2 className="text-3xl">Add a progress note</h2>
                  <textarea aria-label="Progress note" className={`${textareaCls} mt-4 min-h-24`} value={progress} onChange={(e) => setProgress(e.target.value)} maxLength={1000} placeholder="What was done on site?" />
                  <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal only (hidden from the citizen)</label>
                  <Button className="mt-4" disabled={progress.trim().length < 3 || addProgress.isPending} onClick={() => addProgress.mutate({ trackingNumber, note: progress, internal })}>Record update</Button>
                  {mine && <p className="mt-3 text-xs text-faint">This case is assigned to you.</p>}
                </Card>
              )}
            </aside>
          </div>
        );
      })()}
    </SidebarShell>
  );
}
