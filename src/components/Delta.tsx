/** Rank movement badge: lower rank number = better, so green when current < previous. */
export function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null || current === previous)
    return <span className="text-muted">·</span>;
  const improved = current < previous;
  return (
    <span style={{ color: improved ? "var(--good)" : "var(--bad)" }} className="tabular text-[12px]">
      {improved ? "▲" : "▼"} {Math.abs(current - previous)}
    </span>
  );
}
