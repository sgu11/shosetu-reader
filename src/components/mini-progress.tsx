interface Props {
  value: number;
  max?: number;
  color?: string;
  background?: string;
  className?: string;
}

export function MiniProgress({
  value,
  max = 100,
  color = "var(--accent)",
  background = "rgba(28,24,20,0.08)",
  className = "",
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`h-[2px] overflow-hidden rounded ${className}`}
      style={{ background }}
    >
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
