import { ArrowRight, Moon, ShieldCheck, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../_core/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import { LogoMark, Wordmark } from "./Logo";
import { ButtonLink } from "./ui";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid h-[52px] w-[52px] shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink shadow-sm transition hover:bg-surface2">
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

const NAV = [
  { to: "/", label: "Home" },
  { to: "/track", label: "Track Case" },
  { to: "/cases/new", label: "Submit Grievance" },
  { to: "/#standards", label: "Help & Standards" },
];

export default function PublicShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { user } = useAuth();
  const active = (to: string) => (to === "/" ? path === "/" : !to.includes("#") && path.startsWith(to));
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-dark focus:px-5 focus:py-3 focus:text-dark-ink">Skip to content</a>
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-[22px] sm:px-12">
          <Link href="/" className="flex items-center gap-4" aria-label="CivicResolve home"><LogoMark /><Wordmark /></Link>
          <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface2/70 p-1.5 md:order-none md:w-auto">
            {NAV.map((n) => (
              <Link key={n.to} href={n.to} aria-current={active(n.to) ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] font-medium transition ${active(n.to) ? "bg-surface text-ink shadow-sm" : "text-ink/80 hover:text-ink"}`}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 sm:gap-5">
            <ThemeToggle />
            <Link href={user ? "/manage" : "/staff/login"} className="hidden items-center gap-2 text-[15px] font-medium text-mute hover:text-ink sm:inline-flex"><ShieldCheck size={18} />{user ? "Workspace" : "Staff Sign-in"}</Link>
            <ButtonLink href="/cases/new" size="md" className="!h-[54px] !px-7 !text-base">File Grievance <ArrowRight size={18} /></ButtonLink>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-14 sm:px-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3"><LogoMark size={40} /><Wordmark className="text-2xl" /></div>
            <p className="mt-4 max-w-sm text-sm text-mute">Open, accountable grievance redressal. File without an account, follow every step, and hold departments to their service deadlines.</p>
          </div>
          {[
            ["Citizens", [["File a grievance", "/cases/new"], ["Track a case", "/track"], ["Public ledger", "/board"]]],
            ["Standards", [["Citizen charter", "/#standards"], ["Service commitments", "/#services"], ["Privacy", "/#standards"]]],
            ["Staff", [["Staff sign-in", "/staff/login"], ["Operations workspace", "/manage"]]],
          ].map(([h, links]) => (
            <div key={h as string}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{h as string}</p>
              <ul className="mt-4 space-y-3 text-sm">{(links as string[][]).map(([l, to]) => <li key={l}><Link href={to} className="text-mute hover:text-ink">{l}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-5 text-center text-xs text-faint sm:px-12">CivicResolve Public Redress Infrastructure · Contact details are never shown publicly.</p>
      </footer>
    </div>
  );
}
