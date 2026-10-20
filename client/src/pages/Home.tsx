import { ArrowRight, Building2, Clock, EyeOff, FileSearch, HeartHandshake, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../_core/trpc";
import { PriorityBadge, SlaChip, StatusBadge, Stars, fmtDate } from "../components/CaseParts";
import DocketSearch from "../components/DocketSearch";
import PublicShell from "../components/PublicShell";
import { ButtonLink, Card, Empty, Label, Pill } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const ICON: Record<string, React.ReactNode> = { "public-works": <Zap size={24} />, "water-sanitation": <Sparkles size={24} />, "community-services": <Building2 size={24} /> };

export default function Home() {
  useDocumentTitle("Online Grievance Redressal");
  const catalog = trpc.public.catalog.useQuery();
  const board = trpc.public.board.useQuery({ limit: 6 });
  const stats = trpc.public.stats.useQuery();
  const rated = (board.data ?? []).filter((c) => c.feedbackScore);
  const s = stats.data;

  return (
    <PublicShell>
      <section className="px-5 pb-24 pt-12 text-center sm:px-12 sm:pt-16">
        <Pill tone="blue" className="!px-4 !py-2 !text-sm"><span className="pulse-dot h-2 w-2 rounded-full bg-blue" aria-hidden />Public grievance intake is open · no sign-in required</Pill>
        <p className="mt-8 font-script text-5xl leading-tight text-blue sm:text-[4.4rem]">Civic Infrastructure &amp; Redress</p>
        <h1 className="drop mx-auto mt-2 max-w-[1400px] text-[clamp(3.4rem,9.3vw,8.8rem)] leading-[1.2] tracking-[-0.03em]">Every concern deserves<br className="hidden md:block" /> to be heard.</h1>
        <p className="mx-auto mt-8 max-w-[1040px] text-xl text-mute sm:text-[1.7rem] sm:leading-snug">Submit, track, and resolve municipal and campus grievances with guaranteed response SLAs, live departmental updates, and zero login barriers.</p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/cases/new" size="lg">File a Grievance <ArrowRight size={20} /></ButtonLink>
          <ButtonLink href="/track" size="lg" variant="outline">Track Case Status</ButtonLink>
        </div>
        <DocketSearch className="mt-14" />
        {s && s.total > 0 && (
          <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4 text-center">
            {[[s.total, "Concerns filed"], [`${s.withinSlaPct}%`, "Resolved within deadline"], [`${s.avgResolutionHours}h`, "Average time to resolve"]].map(([v, l]) => (
              <div key={l as string}><dd className="font-display text-5xl font-medium tracking-tight">{v}</dd><dt className="mt-1 text-sm text-mute">{l}</dt></div>
            ))}
          </dl>
        )}
      </section>

      <section id="services" className="border-t border-line bg-surface2/50 px-5 py-24 sm:px-12">
        <div className="mx-auto max-w-[1300px]">
          <Label>Service Routing</Label>
          <h2 className="mt-3 max-w-3xl text-5xl leading-[1.1] sm:text-6xl">Public Service Departments &amp; Live Case Triage</h2>
          <p className="mt-5 max-w-2xl text-lg text-mute">Every concern is routed to the department that owns it, with a statutory window to resolve it. Anything that misses its deadline is escalated automatically.</p>
          <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-5">
              {(catalog.data?.departments ?? []).map((d) => (
                <Card key={d.id} className="p-7">
                  <div className="flex items-start gap-5">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-soft text-blue">{ICON[d.slug] ?? <Building2 size={24} />}</span>
                    <div className="min-w-0">
                      <h3 className="text-3xl">{d.name}</h3>
                      <p className="mt-2 text-[15px] text-mute">{d.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2"><Pill tone="slate"><Clock size={13} aria-hidden />{d.slaHours}h resolution window</Pill><Pill tone="blue">{d.activeCases} active</Pill></div>
                    </div>
                  </div>
                </Card>
              ))}
              <p className="flex items-center gap-2 px-2 text-sm text-mute"><ShieldCheck size={16} className="text-green" aria-hidden />Auto-escalation checks run every 15 minutes.</p>
            </div>
            <Card className="p-7 sm:p-9">
              <div className="flex items-center justify-between gap-3"><h3 className="text-3xl">Live case triage</h3><Link href="/board" className="text-sm font-semibold text-blue hover:underline">View public ledger →</Link></div>
              <p className="mt-1 text-sm text-mute">Recent civic activity. Names, contact details and street addresses are never shown.</p>
              {board.isLoading ? <Empty>Loading…</Empty> : !board.data?.length ? <Empty>No cases yet. Be the first to file one.</Empty> : (
                <ul className="mt-6 divide-y divide-line">
                  {board.data.map((c) => (
                    <li key={c.trackingNumber}>
                      <Link href={`/track/${c.trackingNumber}`} className="block rounded-2xl px-3 py-4 transition hover:bg-surface2">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-medium text-faint">{c.trackingNumber}</span><StatusBadge status={c.status} /></div>
                        <p className="mt-1.5 text-[17px] font-semibold leading-snug">{c.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">{c.department} · {fmtDate(c.createdAt)}<SlaChip status={c.status} targetDate={c.targetDate} resolvedAt={c.resolvedAt} /></p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </section>

      <section id="standards" className="px-5 py-24 sm:px-12">
        <div className="mx-auto max-w-[1300px]">
          <Label>Our Commitment to Civic Trust</Label>
          <h2 className="mt-3 max-w-4xl text-5xl leading-[1.1] sm:text-6xl">Institutional Accountability &amp; Human Care</h2>
          <blockquote className="mt-8 max-w-3xl border-l-2 border-blue pl-6 font-display text-3xl leading-snug text-ink/90 sm:text-4xl">A complaint should never disappear into paperwork. Every step is visible to the person who raised it.</blockquote>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              [<FileSearch size={26} key="a" />, "Total Transparency", "Every status change is written to a public timeline. You can see who is handling your case by role, and when each step happened."],
              [<Clock size={26} key="b" />, "Timely Redress", "Each department has a statutory resolution window. Cases that run past it are escalated to critical priority automatically."],
              [<HeartHandshake size={26} key="c" />, "Human-Centric Care", "No account, no phone verification. File in minutes, add photos if you have them, and rate the outcome when it is done."],
            ].map(([icon, h, p]) => (
              <Card key={h as string}><span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-soft text-blue">{icon}</span><h3 className="mt-6 text-3xl">{h as string}</h3><p className="mt-3 text-[15px] leading-relaxed text-mute">{p as string}</p></Card>
            ))}
          </div>
          <Card className="mt-8 p-8 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-4xl">Citizen Charter Standards</h3><Pill tone="green"><ShieldCheck size={13} aria-hidden />What you can rely on</Pill></div>
            <ul className="mt-8 grid gap-x-10 gap-y-5 md:grid-cols-2">
              {[
                "You can file and track a case without creating an account.",
                "Your email and street address are never shown on public pages.",
                "You receive a tracking number and a private access code at filing.",
                "Each department publishes the number of hours it has to resolve your case.",
                "Cases that miss their deadline are escalated automatically.",
                "If the fix did not work, you can reopen the case with a reason.",
                "You can rate the outcome once, after resolution.",
                "Only the assigned department and administrators can see your location.",
              ].map((t) => <li key={t} className="flex gap-3 text-[15px]"><EyeOff size={0} className="hidden" /><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue" aria-hidden />{t}</li>)}
            </ul>
          </Card>
          {rated.length > 0 && (
            <div className="mt-14">
              <h3 className="text-4xl">Recent citizen feedback</h3>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {rated.slice(0, 2).map((c) => (
                  <Card key={c.trackingNumber} className="p-6"><Stars value={c.feedbackScore ?? 0} size={20} /><p className="mt-3 text-lg font-semibold">{c.title}</p><p className="mt-1 text-sm text-mute">{c.department} · {c.trackingNumber}</p><PriorityBadge priority={c.priority} /></Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
