export function Gauge({
  label,
  value,
  goodDirection,
  title,
}: {
  label: string;
  value: number | null;
  /** "high" = high values render green (popularity); "low" = low values render green (difficulty). */
  goodDirection: "high" | "low";
  title: string;
}) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1" title={title}>
        <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
        <span className="text-[12px] text-muted">n/a</span>
      </span>
    );
  }
  const level = value >= 67 ? 2 : value >= 34 ? 1 : 0; // 0=low, 1=mid, 2=high
  const lowToHigh = ["var(--bad)", "var(--series-3)", "var(--good)"];
  const color = goodDirection === "high" ? lowToHigh[level] : lowToHigh[2 - level];
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="w-14 h-1.5 rounded-full bg-grid overflow-hidden shrink-0">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: color }}
        />
      </span>
      <span className="tabular text-[12px] w-6 text-right">{Math.round(value)}</span>
    </span>
  );
}
