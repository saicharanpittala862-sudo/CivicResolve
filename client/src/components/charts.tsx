/** Small dependency-free SVG charts that follow the theme tokens. Each has a text alternative. */
const PALETTE = ["var(--blue)", "var(--violet)", "var(--green)", "var(--amber)", "var(--red)", "var(--slate)", "var(--faint)", "var(--line)"];

export function BarChart({ data, label }: { data: { name: string; count: number; overdue?: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure aria-label={label}>
      <div className="flex h-56 items-end gap-5 border-b border-line px-2">
        {data.map((d) => (
          <div key={d.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-semibold">{d.count}</span>
            <div className="w-full max-w-24 rounded-t-xl bg-blue" style={{ height: `${(d.count / max) * 78}%`, minHeight: d.count ? 6 : 2 }} title={`${d.name}: ${d.count}`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-5 px-2">{data.map((d) => <p key={d.name} className="min-w-0 flex-1 text-center text-xs font-medium text-mute">{d.name}{d.overdue ? <span className="block text-red">{d.overdue} overdue</span> : null}</p>)}</div>
    </figure>
  );
}

export function HBarChart({ data, label }: { data: { name: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul aria-label={label} className="space-y-4">
      {data.map((d) => (
        <li key={d.name}>
          <div className="flex justify-between text-sm"><span className="font-medium">{d.name}</span><span className="font-semibold">{d.count}</span></div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-violet" style={{ width: `${(d.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ data, label, centre }: { data: { name: string; count: number; color?: string }[]; label: string; centre: string }) {
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <figure aria-label={label} className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface2)" strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.count / total) * C, off = -acc;
          acc += len;
          return <circle key={d.name} cx="70" cy="70" r={R} fill="none" stroke={d.color ?? PALETTE[i % PALETTE.length]} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off}><title>{`${d.name}: ${d.count}`}</title></circle>;
        })}
        <text x="70" y="76" textAnchor="middle" transform="rotate(90 70 70)" className="fill-current font-display text-3xl" style={{ fontSize: 30 }}>{centre}</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {data.map((d, i) => <li key={d.name} className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} aria-hidden /><span className="text-mute">{d.name}</span><b>{d.count}</b></li>)}
      </ul>
    </figure>
  );
}
