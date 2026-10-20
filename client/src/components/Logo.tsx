export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-[16px] bg-dark" aria-hidden>
      <svg viewBox="0 0 40 40" width={size * 0.66} height={size * 0.66}>
        <circle cx="13" cy="24" r="4.4" fill="#3b82f6" /><circle cx="24" cy="15.5" r="4.4" fill="#ef4444" /><circle cx="24" cy="26.5" r="4.4" fill="#22c55e" />
      </svg>
    </span>
  );
}
export const Wordmark = ({ className = "text-[28px]" }: { className?: string }) => (
  <span className={`font-display font-semibold tracking-tight ${className}`}>CivicResolve</span>
);
