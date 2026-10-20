import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage, trpc } from "../_core/trpc";
import { fmtDate } from "../components/CaseParts";
import SidebarShell from "../components/SidebarShell";
import { Button, Card, Empty, ErrorNote, Field, IconInput, inputCls, PageHeader, Pill, selectCls, Spinner, textareaCls } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

function useForm<T extends Record<string, string>>(initial: T) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  return { v, err, setErr, set: (k: keyof T) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }), reset: () => setV(initial) };
}

export function AdminDepartments() {
  useDocumentTitle("Departments");
  const notify = useToast();
  const utils = trpc.useUtils();
  const catalog = trpc.public.catalog.useQuery();
  const f = useForm({ name: "", description: "", slaHours: "72" });
  const [edits, setEdits] = useState<Record<number, string>>({});
  const create = trpc.admin.createDepartment.useMutation({ onSuccess: (d) => { notify(`${d.name} established.`); f.reset(); f.setErr(""); utils.public.catalog.invalidate(); }, onError: (e) => f.setErr(errorMessage(e)) });
  const save = trpc.admin.updateDepartmentSla.useMutation({ onSuccess: (d) => { notify(`${d.name} now has a ${d.slaHours}-hour window. It applies to new cases.`); utils.public.catalog.invalidate(); }, onError: (e) => notify(errorMessage(e), "bad") });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ name: f.v.name, description: f.v.description, slaHours: Number(f.v.slaHours) }); };
  return (
    <SidebarShell mode="staff" crumb="Departments">
      <PageHeader eyebrow="Administrative Infrastructure" title="Municipal departments" sub="Set up departments and the number of hours each has to resolve a case." />
      <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_1.4fr]">
        <Card><h2 className="text-3xl">Add a department</h2>
          <form onSubmit={submit} className="mt-4">
            <Field label="Name" right={`${f.v.name.trim().length} · min 3`}><input className={inputCls} value={f.v.name} onChange={f.set("name")} maxLength={80} /></Field>
            <Field label="Jurisdiction"><textarea className={`${textareaCls} min-h-24`} value={f.v.description} onChange={f.set("description")} maxLength={400} /></Field>
            <Field label="Resolution window (hours)" hint="Between 1 and 720 hours."><input type="number" min={1} max={720} className={inputCls} value={f.v.slaHours} onChange={f.set("slaHours")} /></Field>
            {f.err && <ErrorNote>{f.err}</ErrorNote>}
            <Button className="mt-6" disabled={create.isPending}>+ Establish department</Button>
          </form>
        </Card>
        <div className="space-y-4">
          {catalog.isLoading ? <Spinner /> : (catalog.data?.departments ?? []).map((d) => (
            <Card key={d.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-3xl">{d.name}</h3><p className="mt-1 text-sm text-mute">{d.description}</p></div><Pill tone="green">Accepting complaints</Pill></div>
              <div className="mt-5 flex flex-wrap items-end gap-4">
                <label className="text-sm font-semibold">SLA window (hours)<input type="number" min={1} max={720} aria-label={`SLA hours for ${d.name}`} className={`${inputCls} mt-2 !h-11 !w-32`} value={edits[d.id] ?? String(d.slaHours)} onChange={(e) => setEdits({ ...edits, [d.id]: e.target.value })} /></label>
                <Button size="sm" variant="dark" disabled={save.isPending || edits[d.id] === undefined || Number(edits[d.id]) === d.slaHours} onClick={() => save.mutate({ id: d.id, slaHours: Number(edits[d.id]) })}>Save</Button>
                <span className="text-sm text-mute">{d.activeCases} active case{d.activeCases === 1 ? "" : "s"}</span>
              </div>
            </Card>
          ))}
          <p className="px-2 text-sm text-mute">Changing a window affects cases filed from now on. Existing deadlines are not moved.</p>
        </div>
      </div>
    </SidebarShell>
  );
}

export function AdminCategories() {
  useDocumentTitle("Categories");
  const notify = useToast();
  const utils = trpc.useUtils();
  const catalog = trpc.public.catalog.useQuery();
  const f = useForm({ departmentId: "", name: "", guidance: "" });
  const create = trpc.admin.createCategory.useMutation({ onSuccess: (c) => { notify(`${c.name} added.`); f.reset(); f.setErr(""); utils.public.catalog.invalidate(); }, onError: (e) => f.setErr(errorMessage(e)) });
  const depts = catalog.data?.departments ?? [];
  return (
    <SidebarShell mode="staff" crumb="Categories">
      <PageHeader eyebrow="Taxonomy Governance" title="Grievance categories" sub="Categories route a citizen's concern to the right department and show filing guidance on the form." />
      <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_1.4fr]">
        <Card><h2 className="text-3xl">Add a category</h2>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ departmentId: Number(f.v.departmentId), name: f.v.name, guidance: f.v.guidance }); }}>
            <Field label="Parent department"><select className={selectCls} value={f.v.departmentId} onChange={f.set("departmentId")} required><option value="">Choose…</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Category title"><input className={inputCls} value={f.v.name} onChange={f.set("name")} maxLength={80} required /></Field>
            <Field label="Filing guidance" hint="Shown to citizens when they pick this category."><textarea className={`${textareaCls} min-h-24`} value={f.v.guidance} onChange={f.set("guidance")} maxLength={400} /></Field>
            {f.err && <ErrorNote>{f.err}</ErrorNote>}
            <Button className="mt-6" disabled={create.isPending}>+ Add category</Button>
          </form>
        </Card>
        <div className="space-y-6">
          {depts.map((d) => (
            <div key={d.id}><h3 className="px-2 text-2xl">{d.name}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">{(catalog.data?.categories ?? []).filter((c) => c.departmentId === d.id).map((c) => (
                <Card key={c.id} className="p-5"><Pill tone="blue">{d.name}</Pill><p className="mt-3 text-lg font-semibold">{c.name}</p><p className="mt-1 text-sm text-mute">{c.guidance || "No guidance yet."}</p><Pill tone="green" className="mt-3">Verified topic</Pill></Card>
              ))}</div>
            </div>
          ))}
        </div>
      </div>
    </SidebarShell>
  );
}

export function AdminOfficers() {
  useDocumentTitle("Officers");
  const notify = useToast();
  const utils = trpc.useUtils();
  const officers = trpc.admin.officers.useQuery();
  const catalog = trpc.public.catalog.useQuery();
  const dash = trpc.admin.dashboard.useQuery();
  const f = useForm({ name: "", email: "", password: "", departmentId: "", title: "" });
  const create = trpc.admin.createOfficer.useMutation({ onSuccess: (u) => { notify(`${u.name} can now sign in.`); f.reset(); f.setErr(""); utils.admin.officers.invalidate(); utils.admin.users.invalidate(); }, onError: (e) => f.setErr(errorMessage(e)) });
  const depts = catalog.data?.departments ?? [];
  const load = new Map((dash.data?.officerLoad ?? []).map((o) => [o.name, o.active]));
  return (
    <SidebarShell mode="staff" crumb="Officer Assignments">
      <PageHeader eyebrow="Human Resources & Dispatch" title="Field officers" sub="Create officer accounts and link them to a department. Officers can only see and work cases in their own department." />
      <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_1.3fr]">
        <Card><h2 className="text-3xl">Authorize an officer</h2>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ name: f.v.name, email: f.v.email, password: f.v.password, departmentId: Number(f.v.departmentId), title: f.v.title }); }}>
            <Field label="Full name"><input className={inputCls} value={f.v.name} onChange={f.set("name")} required minLength={2} /></Field>
            <Field label="Official email"><input type="email" className={inputCls} value={f.v.email} onChange={f.set("email")} required /></Field>
            <Field label="Temporary password" hint="At least 8 characters. Share it securely."><input type="password" autoComplete="new-password" className={inputCls} value={f.v.password} onChange={f.set("password")} required minLength={8} /></Field>
            <Field label="Department"><select className={selectCls} value={f.v.departmentId} onChange={f.set("departmentId")} required><option value="">Choose…</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Official title"><input className={inputCls} value={f.v.title} onChange={f.set("title")} required minLength={2} placeholder="For example, Senior Inspector" /></Field>
            {f.err && <ErrorNote>{f.err}</ErrorNote>}
            <Button className="mt-6" disabled={create.isPending}>Authorize officer</Button>
          </form>
        </Card>
        <div className="space-y-4">
          <h2 className="px-2 text-3xl">Active officers</h2>
          {officers.isLoading ? <Spinner /> : !officers.data?.length ? <Empty>No officers yet.</Empty> : officers.data.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div><p className="text-lg font-semibold">{o.name}</p><p className="text-sm text-mute">{o.title} · {depts.find((d) => d.id === o.departmentId)?.name}</p><p className="font-mono text-xs text-faint">{o.email}</p></div>
              <div className="text-right"><Pill tone="green">Available for triage</Pill><p className="mt-2 text-sm text-mute">{load.get(o.name) ?? 0} active case{(load.get(o.name) ?? 0) === 1 ? "" : "s"}</p></div>
            </Card>
          ))}
        </div>
      </div>
    </SidebarShell>
  );
}

export function AdminUsers() {
  useDocumentTitle("Users");
  const users = trpc.admin.users.useQuery();
  const [q, setQ] = useState("");
  const rows = (users.data ?? []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <SidebarShell mode="staff" crumb="User & Account Registry">
      <PageHeader eyebrow="Access & Identity" title="Staff accounts" sub="Every account that can sign in, its role, and when it was created. Password data is never sent to the browser." />
      <div className="mt-10 max-w-xl"><IconInput icon={<Search size={19} />} aria-label="Search accounts" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="!h-12" /></div>
      <Card className="mt-6 overflow-hidden p-0">
        {users.isLoading ? <Spinner /> : !rows.length ? <Empty>No accounts match.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-line bg-surface2/60 text-xs uppercase tracking-wider text-faint"><th className="px-6 py-4">Account</th><th className="px-3 py-4">Role</th><th className="px-3 py-4">Sign-in</th><th className="px-6 py-4">Created</th></tr></thead>
            <tbody>{rows.map((u) => <tr key={u.id} className="border-b border-line last:border-0"><td className="px-6 py-4 font-medium">{u.name}<p className="font-mono text-xs font-normal text-mute">{u.email}</p></td><td className="px-3 py-4"><Pill tone={u.role === "admin" ? "violet" : "blue"} className="capitalize">{u.role}</Pill></td><td className="px-3 py-4 capitalize text-mute">{u.authSource}</td><td className="px-6 py-4 text-mute">{fmtDate(u.createdAt)}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <p className="mt-6 text-sm text-mute">Authorised access ensures accountable governance.</p>
    </SidebarShell>
  );
}
