import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function DocketSearch({ initial = "", className = "" }: { initial?: string; className?: string }) {
  const [, go] = useLocation();
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = v.trim().toUpperCase();
    if (!/^GRV-\d{4}-\d{5}$/.test(t)) return setErr("Tracking numbers look like GRV-2026-00001.");
    setErr(""); go(`/track/${t}`);
  }
  return (
    <form onSubmit={submit} className={className} role="search">
      <div className="mx-auto flex max-w-[768px] items-center gap-3 rounded-full border border-line bg-surface p-2.5 pl-6 shadow-[0_12px_40px_-24px_rgba(20,30,80,.35)]">
        <Search size={22} className="shrink-0 text-ink/70" aria-hidden />
        <input aria-label="Tracking number" value={v} onChange={(e) => setV(e.target.value)} placeholder="E.G. GRV-2026-00001" autoComplete="off" spellCheck={false}
          className="h-12 min-w-0 flex-1 bg-transparent font-mono text-base uppercase tracking-wider text-ink placeholder:text-faint focus:outline-none" />
        <button className="inline-flex h-[54px] shrink-0 cursor-pointer items-center gap-2 rounded-full bg-blue px-7 text-base font-semibold text-blue-ink transition hover:brightness-110">Track Case <ArrowRight size={18} /></button>
      </div>
      {err && <p role="alert" className="mt-3 text-center text-sm font-medium text-red">{err}</p>}
    </form>
  );
}
