import { Activity, BarChart3, Building2, FilePlus2, KanbanSquare, LayoutGrid, LogOut, Menu, Plus, ShieldCheck, Sparkles, Table2, Tags, UserCog, Users, X, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../_core/trpc";
import { useAuth } from "../_core/useAuth";
import { LogoMark, Wordmark } from "./Logo";
import { ThemeToggle } from "./PublicShell";
import { Pill } from "./ui";

type Item = { to: string; label: string; icon: ReactNode; match?: string[] };
const PUBLIC: Item[] = [
  { to: "/", label: "Home", icon: <LayoutGrid size={20} /> },
  { to: "/track", label: "Track a Case", icon: <Activity size={20} />, match: ["/track"] },
  { to: "/cases/new", label: "Submit Grievance", icon: <FilePlus2 size={20} />, match: ["/cases"] },
  { to: "/staff/login", label: "Staff Sign-in", icon: <ShieldCheck size={20} /> },
];
const STAFF: Item[] = [
  { to: "/manage", label: "Operations Queue", icon: <KanbanSquare size={20} />, match: ["/manage", "/officer"] },
];
const ADMIN: Item[] = [
  { to: "/admin", label: "Executive Analytics", icon: <BarChart3 size={20} /> },
  { to: "/admin/cases", label: "Case Triage", icon: <Table2 size={20} /> },
  { to: "/admin/departments", label: "Departments", icon: <Building2 size={20} /> },
  { to: "/admin/categories", label: "Categories", icon: <Tags size={20} /> },
  { to: "/admin/officers", label: "Officers", icon: <UserCog size={20} /> },
  { to: "/admin/users", label: "Users", icon: <Users size={20} /> },
];
const DEPT_ICON: Record<string, ReactNode> = { "community-services": <Building2 size={19} />, "public-works": <Zap size={19} />, "water-sanitation": <Sparkles size={19} /> };

export default function SidebarShell({ mode, crumb, children }: { mode: "public" | "staff"; crumb: string; children: ReactNode }) {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const catalog = trpc.public.catalog.useQuery(undefined, { enabled: mode === "public" });
  const items = mode === "public" ? PUBLIC : [...STAFF, ...(isAdmin ? ADMIN : [])];
  const active = (i: Item) => (i.to === "/" || i.to === "/admin" ? path === i.to : (i.match ?? [i.to]).some((m) => path.startsWith(m)));
  const depts = [...(catalog.data?.departments ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-7 pb-2 pt-8">
        <Link href="/" className="flex items-center gap-3.5" aria-label="CivicResolve home"><LogoMark size={52} /><Wordmark className="text-[27px]" /></Link>
        <button className="rounded-full p-2 text-mute hover:bg-surface2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={22} /></button>
      </div>
      <nav aria-label="Primary" className="mt-9 space-y-2 px-4">
        {items.map((i) => (
          <Link key={i.to} href={i.to} onClick={() => setOpen(false)} aria-current={active(i) ? "page" : undefined}
            className={`flex h-14 items-center gap-4 rounded-full px-5 text-[16px] font-semibold tracking-tight transition ${active(i) ? "bg-dark text-dark-ink" : "text-ink/85 hover:bg-surface2"}`}>{i.icon}{i.label}</Link>
        ))}
      </nav>
      {mode === "public" ? (
        <div className="mt-10 px-8">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-mute">Departments</p>
            <Link href="/cases/new" aria-label="File a grievance" className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-surface2 hover:text-ink"><Plus size={20} /></Link>
          </div>
          <ul className="mt-5 space-y-1">
            {depts.map((d) => <li key={d.id} className="flex items-center gap-4 rounded-full px-1 py-2.5 text-[16px] text-ink/85"><span className="text-faint">{DEPT_ICON[d.slug] ?? <Building2 size={19} />}</span>{d.name}</li>)}
          </ul>
        </div>
      ) : (
        <div className="mt-8 px-8"><Link href="/" className="text-sm font-medium text-mute hover:text-ink">← Public site</Link></div>
      )}
      <div className="mt-auto border-t border-line px-7 py-5">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><Pill tone={user.role === "admin" ? "violet" : "blue"} className="mt-1 capitalize">{user.role}</Pill></div>
            <button onClick={logout} className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-mute hover:bg-surface2 hover:text-ink" aria-label="Sign out" title="Sign out"><LogOut size={19} /></button>
          </div>
        ) : (
          <Link href="/staff/login" className="flex items-center gap-3 text-[15px] font-medium text-ink/85 hover:text-ink"><ShieldCheck size={19} />Staff Sign-in</Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-dark focus:px-5 focus:py-3 focus:text-dark-ink">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 border-r border-line bg-surface xl:w-[383px] lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><aside className="relative h-full w-[320px] max-w-[88vw] bg-surface shadow-2xl">{nav}</aside></div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-[98px] items-center justify-between border-b border-line px-5 sm:px-12">
          <div className="flex items-center gap-3">
            <button className="rounded-full p-2 hover:bg-surface2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-[17px]"><span className="hidden text-mute sm:inline">CivicResolve</span><span className="hidden text-faint sm:inline">/</span>{mode === "staff" && <><span className="text-mute">Workspace</span><span className="text-faint">/</span></>}<span className="font-semibold">{crumb}</span></nav>
          </div>
          <ThemeToggle />
        </div>
        <main id="main" className="max-w-[1560px] px-5 py-10 sm:px-12 sm:py-14 xl:px-[86px]">{children}</main>
      </div>
    </div>
  );
}
