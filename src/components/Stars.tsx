export function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted">—</span>;
  const full = Math.round(rating);
  return (
    <span className="text-[13px] tracking-tight" title={rating.toFixed(2)}>
      <span style={{ color: "var(--series-3)" }}>{"★".repeat(full)}</span>
      <span className="text-grid">{"★".repeat(5 - full)}</span>
    </span>
  );
}
