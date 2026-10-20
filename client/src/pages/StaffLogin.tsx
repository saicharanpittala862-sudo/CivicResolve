import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { errorMessage, trpc } from "../_core/trpc";
import { useAuth } from "../_core/useAuth";
import { LogoMark, Wordmark } from "../components/Logo";
import { ThemeToggle } from "../components/PublicShell";
import { ErrorNote, IconInput } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function StaffLogin() {
  useDocumentTitle("Staff Authentication");
  const [, go] = useLocation();
  const { user, refresh } = useAuth();
  const demo = trpc.auth.demoAccounts.useQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const login = trpc.auth.internalLogin.useMutation({ onSuccess: (u) => { refresh(); go(u.role === "admin" ? "/admin" : "/manage"); }, onError: (e) => setErr(errorMessage(e)) });
  useEffect(() => { if (user) go(user.role === "admin" ? "/admin" : "/manage"); }, [user, go]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between px-5 py-8 lg:px-[9.4vw]">
        <Link href="/" className="flex items-center gap-4" aria-label="CivicResolve home"><LogoMark /><Wordmark /></Link>
        <div className="flex items-center gap-4"><ThemeToggle /><Link href="/" className="hidden items-center gap-2 text-[16px] font-medium text-blue hover:underline sm:inline-flex"><ArrowLeft size={18} />Return to Public Home</Link></div>
      </header>
      <main id="main" className="px-5 pb-10 pt-6 lg:px-[9.4vw]">
        <div className="grid overflow-hidden rounded-[44px] border border-line bg-surface shadow-[0_30px_80px_-40px_rgba(10,20,60,.35)] lg:grid-cols-[1.1fr_1fr]">
          <section className="relative flex flex-col bg-[#08090c] p-8 text-white sm:p-[84px]" style={{ backgroundImage: "radial-gradient(900px 420px at 100% 0%, rgba(30,64,175,.38), transparent 60%)" }}>
            <span className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[15px] font-medium"><ShieldCheck size={18} className="text-emerald-400" aria-hidden />Restricted Departmental Triage</span>
            <h1 className="mt-12 font-display text-5xl leading-[1.15] tracking-tight text-white sm:text-[64px]">Public service with accountability.</h1>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-white/60">Sign in to review departmental case queues, record inspection progress, manage assignments, and enforce strict resolution SLAs across metropolitan services.</p>
            <div className="mt-14 space-y-5">
              {[["Departmental Officers", "Inspect assigned cases, update status logs, add progress notes, and resolve citizen requests."], ["Executive Administrators", "Access global case triage, manage departmental catalogs, oversee SLA compliance, and view analytics."]].map(([h, p]) => (
                <div key={h} className="rounded-3xl border border-white/10 bg-white/[0.04] p-7"><h2 className="font-sans text-lg font-semibold tracking-tight text-white">{h}</h2><p className="mt-2 text-[15px] leading-relaxed text-white/55">{p}</p></div>
              ))}
            </div>
            <p className="mt-14 border-t border-white/10 pt-8 text-[15px] text-white/45">CivicResolve Governance Security Protocol • Encrypted Session Active</p>
          </section>
          <section className="p-8 sm:p-[72px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue">Authorization Portal</p>
            <h2 className="mt-3 text-5xl">Staff Authentication</h2>
            <p className="mt-3 text-[17px] text-mute">Citizens can track and file cases freely without signing in.</p>
            <form className="mt-12" onSubmit={(e) => { e.preventDefault(); setErr(""); login.mutate({ email, password }); }}>
              <label className="block"><span className="text-[13px] font-semibold uppercase tracking-[0.12em]">Official email</span>
                <div className="mt-3"><IconInput icon={<Mail size={20} />} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@civicresolve.internal" className="!h-[72px] !rounded-[22px] !bg-surface2/50 !text-[17px]" /></div></label>
              <label className="mt-8 block"><span className="text-[13px] font-semibold uppercase tracking-[0.12em]">Security password</span>
                <div className="mt-3"><IconInput icon={<Lock size={20} />} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="!h-[72px] !rounded-[22px] !bg-surface2/50 !text-[17px]" /></div></label>
              {err && <ErrorNote>{err}</ErrorNote>}
              <button disabled={login.isPending} className="mt-10 inline-flex h-[72px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-dark text-[17px] font-semibold tracking-tight text-dark-ink transition hover:opacity-90 disabled:opacity-60">{login.isPending ? "Signing in…" : <>Sign In to Staff Workspace <ArrowRight size={19} /></>}</button>
            </form>
            {!!demo.data?.length && (
              <div className="mt-10 border-t border-line pt-8">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-mute">Demo staff accounts (click to autofill)</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {demo.data.map((a) => <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword(a.password); setErr(""); }} className="cursor-pointer rounded-full border border-line bg-surface2/60 px-5 py-3 text-[15px] font-medium transition hover:bg-surface2"><span aria-hidden>{a.icon}</span> {a.label}</button>)}
                </div>
              </div>
            )}
            <p className="mt-10 text-center"><Link href="/track" className="text-[16px] font-medium text-blue hover:underline">Need to track a citizen case? Use the open tracker →</Link></p>
          </section>
        </div>
        <p className="mt-10 text-center text-[16px] text-mute">CivicResolve Public Redress Infrastructure • Internal Operations Access</p>
      </main>
    </div>
  );
}
