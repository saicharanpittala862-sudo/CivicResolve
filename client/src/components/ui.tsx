import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";

export type Tone = "blue" | "green" | "amber" | "red" | "violet" | "slate";
const TONES: Record<Tone, string> = {
  blue: "bg-blue-soft text-blue", green: "bg-green-soft text-green", amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red", violet: "bg-violet-soft text-violet", slate: "bg-slate-soft text-slate",
};
export const Pill = ({ tone = "blue", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}>{children}</span>
);

type Variant = "blue" | "dark" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";
const V: Record<Variant, string> = {
  blue: "bg-blue text-blue-ink shadow-[0_8px_24px_-10px_var(--blue)] hover:brightness-110",
  dark: "bg-dark text-dark-ink hover:opacity-90",
  outline: "border border-line bg-surface text-ink hover:bg-surface2",
  ghost: "text-mute hover:bg-surface2 hover:text-ink",
};
const S: Record<Size, string> = { sm: "h-9 px-4 text-sm", md: "h-11 px-6 text-[15px]", lg: "h-14 px-8 text-base" };
export const btn = (v: Variant = "blue", s: Size = "md", extra = "") =>
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${V[v]} ${S[s]} ${extra}`;

export function Button({ variant, size, className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button {...p} className={btn(variant, size, className)} />;
}
export function ButtonLink({ href, variant, size, className = "", children }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return <Link href={href} className={btn(variant, size, className)}>{children}</Link>;
}

export const Card = ({ children, className = "p-7" }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-3xl border border-line bg-surface ${className}`}>{children}</section>
);
export const Eyebrow = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`font-script text-[2.6rem] leading-tight text-blue sm:text-[3.4rem] ${className}`}>{children}</p>
);
export const Label = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`text-xs font-semibold uppercase tracking-[0.16em] text-blue ${className}`}>{children}</p>
);

export function PageHeader({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <header className={center ? "text-center" : ""}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 text-[clamp(3rem,4.7vw,5.6rem)] leading-[1.08]">{title}</h1>
      {sub && <p className={`mt-5 max-w-3xl text-lg text-mute sm:text-xl ${center ? "mx-auto" : ""}`}>{sub}</p>}
    </header>
  );
}

export const inputCls = "h-14 w-full rounded-2xl border border-line bg-surface px-5 text-[15px] text-ink placeholder:text-faint focus:border-blue";
export const textareaCls = "w-full rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] text-ink placeholder:text-faint focus:border-blue";
export const selectCls = `${inputCls} appearance-none bg-no-repeat pr-10`;

export function Field({ label, hint, right, children }: { label: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <label className="mt-6 block first:mt-0">
      <span className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold"><span>{label}</span>{right && <span className="text-xs font-normal text-faint">{right}</span>}</span>
      {children}
      {hint && <span className="mt-2 block text-sm text-mute">{hint}</span>}
    </label>
  );
}
export function IconInput({ icon, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-faint">{icon}</span>
      <input {...p} className={`${inputCls} pl-14 ${className}`} />
    </div>
  );
}

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="mt-4 rounded-2xl bg-red-soft px-4 py-3 text-sm font-medium text-red">{children}</p>
);
export const Empty = ({ children }: { children: ReactNode }) => <p className="py-10 text-center text-sm text-mute">{children}</p>;
export const Spinner = () => <p className="py-10 text-center text-sm text-mute" role="status">Loading…</p>;

export function Stat({ label, value, tone, note }: { label: string; value: ReactNode; tone?: "red"; note?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6">
      <p className="text-sm font-medium text-mute">{label}</p>
      <p className={`mt-2 font-display text-5xl font-medium tracking-tight ${tone === "red" ? "text-red" : ""}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-faint">{note}</p>}
    </div>
  );
}
