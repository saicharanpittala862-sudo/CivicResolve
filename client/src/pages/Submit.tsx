import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, FileText, Landmark, Lightbulb, Lock, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "wouter";
import { saveCode } from "../_core/codes";
import { checkFile, copyText, MAX_FILES, toBase64 } from "../_core/files";
import { errorMessage, trpc } from "../_core/trpc";
import { PriorityBadge } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Button, ButtonLink, Card, ErrorNote, Eyebrow, Field, inputCls, Pill, textareaCls } from "../components/ui";
import { useDebounce } from "../hooks/useDebounce";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

const STEPS = [
  { n: "01", title: "Service", sub: "Department & category", head: "Service Routing" },
  { n: "02", title: "Concern", sub: "Title, details & location", head: "Describe the Concern" },
  { n: "03", title: "Documentation", sub: "Optional proof attachment", head: "Supporting Evidence" },
  { n: "04", title: "Review & File", sub: "Verifiable docket preview", head: "Review & File" },
];

export default function Submit() {
  useDocumentTitle("File Grievance");
  const notify = useToast();
  const catalog = trpc.public.catalog.useQuery();
  const create = trpc.portal.create.useMutation();
  const upload = trpc.portal.uploadAttachment.useMutation();
  const [step, setStep] = useState(0);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [catId, setCatId] = useState<number | null>(null);
  const [f, setF] = useState({ title: "", description: "", location: "", contactEmail: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState<{ trackingNumber: string; title: string } | null>(null);
  const [done, setDone] = useState<{ trackingNumber: string; accessCode: string; failed: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const drop = useRef<HTMLInputElement>(null);

  const depts = catalog.data?.departments ?? [];
  const cats = (catalog.data?.categories ?? []).filter((c) => c.departmentId === deptId);
  const dept = depts.find((d) => d.id === deptId);
  const cat = cats.find((c) => c.id === catId);
  const text = useDebounce(`${f.title} ${f.description}`, 450);
  const loc = useDebounce(f.location, 450);
  const hint = trpc.public.suggest.useQuery({ text, location: loc }, { enabled: text.trim().length >= 15 });
  const sug = hint.data;

  const valid = [
    !!catId,
    f.title.trim().length >= 5 && f.description.trim().length >= 10 && f.location.trim().length >= 3 && (!f.contactEmail || /^\S+@\S+\.\S+$/.test(f.contactEmail)),
    true, true,
  ];
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setDup(null); };

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    for (const x of incoming) { const p = checkFile(x); if (p) return setErr(p); }
    if (files.length + incoming.length > MAX_FILES) return setErr(`Attach up to ${MAX_FILES} files.`);
    setErr(""); setFiles([...files, ...incoming]);
  }

  async function submit(force = false) {
    if (!catId) return;
    setErr(""); setBusy(true);
    try {
      const r = await create.mutateAsync({ categoryId: catId, ...f, contactEmail: f.contactEmail || undefined, force });
      if (!r.created) { setDup(r.duplicate); setBusy(false); return; }
      saveCode(r.trackingNumber, r.accessCode);
      const failed: string[] = [];
      for (const file of files) {
        try { await upload.mutateAsync({ trackingNumber: r.trackingNumber, accessCode: r.accessCode, filename: file.name, dataBase64: await toBase64(file) }); }
        catch { failed.push(file.name); }
      }
      setDone({ trackingNumber: r.trackingNumber, accessCode: r.accessCode, failed });
    } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  }

  if (done) {
    return (
      <SidebarShell mode="public" crumb="Submit Grievance">
        <Eyebrow>Filed successfully</Eyebrow>
        <h1 className="mt-2 text-[clamp(3rem,4.7vw,5.6rem)] leading-[1.08]">Your concern has been registered.</h1>
        <p className="mt-5 max-w-2xl text-lg text-mute">Keep these two details. The tracking number lets anyone follow progress. The access code is private to you and lets you add evidence, rate the outcome or reopen the case.</p>
        <Card className="mt-10 p-8 sm:p-10">
          <div className="grid gap-8 sm:grid-cols-2">
            {[["Tracking number", done.trackingNumber], ["Private access code", done.accessCode]].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{l}</p>
                <p className="mt-2 break-all font-mono text-3xl font-medium tracking-wider sm:text-4xl">{v}</p>
                <button onClick={async () => notify((await copyText(v)) ? `${l} copied.` : "Could not copy. Select it manually.")} className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue hover:underline"><Copy size={15} aria-hidden />Copy</button>
              </div>
            ))}
          </div>
          <p className="mt-8 flex gap-3 rounded-2xl bg-amber-soft p-4 text-sm font-medium text-amber"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />The access code is shown only once. We saved it in this browser, but write it down in case you use another device.</p>
          {done.failed.length > 0 && <ErrorNote>These files could not be attached: {done.failed.join(", ")}. You can add them from the tracking page.</ErrorNote>}
          <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href={`/track/${done.trackingNumber}`} size="lg">Track this case <ArrowRight size={18} /></ButtonLink><Button size="lg" variant="outline" onClick={() => { setDone(null); setStep(0); setF({ title: "", description: "", location: "", contactEmail: "" }); setFiles([]); setCatId(null); setDeptId(null); }}>File another</Button></div>
        </Card>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell mode="public" crumb="Submit Grievance">
      <Eyebrow>Open Public Redress</Eyebrow>
      <h1 className="mt-2 text-[clamp(3rem,4.7vw,5.6rem)] leading-[1.08]">Tell us what needs attention.</h1>
      <p className="mt-5 max-w-[1100px] text-lg text-mute sm:text-xl">Four short steps route your concern directly to the responsible department. No citizen sign-in or password is required.</p>

      <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STEPS.map((s, i) => {
          const active = i === step, complete = i < step;
          return (
            <li key={s.n}>
              <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={active ? "step" : undefined}
                className={`flex w-full items-center gap-4 rounded-[28px] border p-5 text-left transition ${active ? "border-blue bg-blue-soft" : "border-line bg-surface"} ${i > step ? "cursor-default" : "cursor-pointer"}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${active ? "bg-blue text-blue-ink" : complete ? "bg-green-soft text-green" : "bg-surface2 text-faint"}`}>{complete ? <Check size={20} aria-hidden /> : s.n}</span>
                <span><span className="block text-[17px] font-semibold">{s.title}</span><span className="block text-[15px] text-mute">{s.sub}</span></span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card className="mt-10 rounded-[32px] p-7 sm:p-12">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-blue-soft text-blue">{[<Landmark key="a" size={24} />, <FileText key="b" size={24} />, <Upload key="c" size={24} />, <Check key="d" size={24} />][step]}</span>
          <h2 className="text-4xl sm:text-5xl">{STEPS[step].head}</h2>
        </div>

        {step === 0 && (
          <div className="mt-10">
            {catalog.isLoading && <p className="text-mute">Loading departments…</p>}
            <fieldset><legend className="mb-3 text-sm font-semibold">Responsible department</legend>
              <div className="grid gap-4 md:grid-cols-3" role="radiogroup">
                {depts.map((d) => (
                  <button type="button" key={d.id} role="radio" aria-checked={d.id === deptId} onClick={() => { setDeptId(d.id); setCatId(null); }}
                    className={`cursor-pointer rounded-3xl border p-5 text-left transition ${d.id === deptId ? "border-blue bg-blue-soft" : "border-line hover:bg-surface2"}`}>
                    <p className="font-display text-2xl">{d.name}</p><p className="mt-1 text-sm text-mute">{d.description}</p><p className="mt-3 text-xs font-semibold text-blue">{d.slaHours}-hour resolution window</p>
                  </button>
                ))}
              </div>
            </fieldset>
            {dept && (
              <fieldset className="mt-8"><legend className="mb-3 text-sm font-semibold">What kind of issue is it?</legend>
                <div className="flex flex-wrap gap-3" role="radiogroup">
                  {cats.map((c) => <button type="button" key={c.id} role="radio" aria-checked={c.id === catId} onClick={() => setCatId(c.id)} className={`cursor-pointer rounded-full border px-5 py-2.5 text-[15px] font-medium transition ${c.id === catId ? "border-blue bg-blue text-blue-ink" : "border-line hover:bg-surface2"}`}>{c.name}</button>)}
                </div>
              </fieldset>
            )}
            {cat?.guidance && <p className="mt-6 flex gap-3 rounded-2xl bg-surface2 p-4 text-[15px] text-mute"><Lightbulb size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />{cat.guidance}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="mt-10">
            <Field label="Short title" right={`${f.title.trim().length}/200 · min 5`}><input className={inputCls} value={f.title} onChange={set("title")} maxLength={200} placeholder="For example, Deep pothole near the bus stop" /></Field>
            <Field label="What is happening?" right={`${f.description.trim().length}/4000 · min 10`} hint="Say how long it has been going on and anything that makes it urgent."><textarea className={`${textareaCls} min-h-36`} value={f.description} onChange={set("description")} maxLength={4000} /></Field>
            <Field label="Location or landmark" hint="Shared only with the responsible department so field crews can find it."><input className={inputCls} value={f.location} onChange={set("location")} maxLength={200} placeholder="For example, 5th Avenue near building 42" /></Field>
            <Field label="Email (optional)" hint="Used only for staff follow-up. It is masked everywhere it appears, and we do not send email yet."><input type="email" className={inputCls} value={f.contactEmail} onChange={set("contactEmail")} autoComplete="email" /></Field>
            {sug?.category && sug.category.id !== catId && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-blue-soft p-4 text-[15px]"><Lightbulb size={18} className="text-blue" aria-hidden /><span>Smart routing suggests <b>{depts.find((d) => d.id === sug.category!.departmentId)?.name} → {sug.category.name}</b>.</span><Button size="sm" variant="dark" onClick={() => { setDeptId(sug.category!.departmentId); setCatId(sug.category!.id); }}>Use this</Button></div>
            )}
            {sug?.duplicate && <p className="mt-4 rounded-2xl bg-amber-soft p-4 text-[15px] text-amber">A similar open report exists: <Link href={`/track/${sug.duplicate.trackingNumber}`} className="font-mono font-semibold underline">{sug.duplicate.trackingNumber}</Link> “{sug.duplicate.title}”. You may not need to file again.</p>}
          </div>
        )}

        {step === 2 && (
          <div className="mt-10">
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }} className="rounded-3xl border-2 border-dashed border-line p-10 text-center">
              <Upload size={34} className="mx-auto text-blue" aria-hidden />
              <p className="mt-4 text-lg font-semibold">Drag photos or documents here</p>
              <p className="mt-1 text-sm text-mute">PDF, PNG, JPG or WebP · up to {MAX_FILES} files · 2 MB each</p>
              <input ref={drop} id="evidence" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <label htmlFor="evidence" className="mt-6 inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-7 text-[15px] font-semibold hover:bg-surface2">Choose files</label>
            </div>
            {files.length > 0 && <ul className="mt-6 space-y-2">{files.map((x, i) => <li key={i} className="flex items-center justify-between rounded-2xl bg-surface2 px-5 py-3 text-[15px]"><span className="truncate">{x.name} <span className="text-faint">· {(x.size / 1024).toFixed(0)} KB</span></span><button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${x.name}`} className="cursor-pointer text-mute hover:text-red"><X size={18} /></button></li>)}</ul>}
            <p className="mt-6 text-sm text-mute">Evidence is optional. Files are checked by their contents, not their names, and are visible only to the responsible department and to you.</p>
          </div>
        )}

        {step === 3 && (
          <div className="mt-10">
            <dl className="divide-y divide-line rounded-3xl border border-line">
              {[["Department", dept?.name], ["Category", cat?.name], ["Title", f.title], ["Details", f.description], ["Location", f.location], ["Email", f.contactEmail || "Not provided"], ["Attachments", files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "None"]].map(([k, v]) => (
                <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[170px_1fr]"><dt className="text-sm font-semibold text-mute">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px]">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-mute"><Pill tone="blue">{dept?.slaHours}-hour statutory window</Pill>{sug && <>Estimated priority <PriorityBadge priority={sug.priority} /></>}</div>
            <p className="mt-6 flex gap-3 rounded-2xl bg-green-soft p-4 text-[15px] text-green"><Lock size={18} className="mt-0.5 shrink-0" aria-hidden />Your email and location are never shown publicly. You will get a tracking number and a private access code.</p>
            {dup && (
              <div role="alert" className="mt-6 rounded-2xl bg-amber-soft p-5 text-[15px] text-amber"><b>A similar open report already exists:</b> <span className="font-mono">{dup.trackingNumber}</span> “{dup.title}”.
                <div className="mt-4 flex flex-wrap gap-3"><ButtonLink href={`/track/${dup.trackingNumber}`} size="sm" variant="dark">View that case</ButtonLink><Button size="sm" variant="outline" onClick={() => void submit(true)} disabled={busy}>File mine anyway</Button></div></div>
            )}
          </div>
        )}

        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
          <Button variant="ghost" size="lg" disabled={step === 0} onClick={() => { setStep(step - 1); setErr(""); }}><ArrowLeft size={18} />Back</Button>
          {step < 3 ? <Button size="lg" disabled={!valid[step]} onClick={() => { setStep(step + 1); setErr(""); }}>Continue <ArrowRight size={18} /></Button>
            : <Button size="lg" disabled={busy || !!dup} onClick={() => void submit(false)}>{busy ? "Filing…" : "Submit Grievance"}<ArrowRight size={18} /></Button>}
        </div>
      </Card>
    </SidebarShell>
  );
}
