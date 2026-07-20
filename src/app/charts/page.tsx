import Link from "next/link";
import { COUNTRIES, GENRES, type ChartType } from "@/lib/appstore";
import { getChartOpportunities, type ChartFlag } from "@/lib/opportunities";
import { getSnapshotGenres, listTrackedApps } from "@/lib/service";
import { fmtCount } from "@/lib/format";
import { Delta } from "@/components/Delta";
import { Stars } from "@/components/Stars";
import { TrackGenreToggle } from "@/components/TrackGenreToggle";

export const dynamic = "force-dynamic";

const FLAG_LABELS: Record<ChartFlag, { label: string; color: string; title: string }> = {
  "weak-incumbent": {
    label: "weak",
    color: "var(--bad)",
    title: "Charting despite a rating under 4.0 — proven demand, unhappy users",
  },
  "fast-climber": {
    label: "climber",
    color: "var(--good)",
    title: "Climbed 20+ positions since the baseline snapshot — something is working",
  },
  "new-entrant": {
    label: "new",
    color: "var(--accent)",
    title: "Released within the last 90 days and already in the top 100",
  },
};

export default async function ChartsPage(props: {
  searchParams: Promise<{ country?: string; type?: string; genre?: string }>;
}) {
  const { country = "us", type = "top-free", genre } = await props.searchParams;
  const chartType = (type === "top-paid" ? "top-paid" : "top-free") as ChartType;
  const genreId = genre && GENRES[Number(genre)] ? Number(genre) : null;

  const [{ entries, baselineAt }, tracked, snapshotGenres] = await Promise.all([
    getChartOpportunities(country, chartType, genreId, 100),
    listTrackedApps(),
    getSnapshotGenres(),
  ]);
  const trackedIds = new Set(tracked.map((t) => t.appId));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Top charts</h1>

      <form className="flex gap-2 mb-2" action="/charts">
        <select className="input" name="country" defaultValue={country}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
        <select className="input" name="type" defaultValue={chartType}>
          <option value="top-free">Top free</option>
          <option value="top-paid">Top paid</option>
        </select>
        <select className="input" name="genre" defaultValue={genreId ?? ""}>
          <option value="">All categories</option>
          {Object.entries(GENRES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Load
        </button>
        {genreId != null && (
          <span className="self-center ml-2">
            <TrackGenreToggle genreId={genreId} snapshotGenres={snapshotGenres} />
          </span>
        )}
      </form>
      <p className="text-[12px] text-muted mb-6">
        <span style={{ color: "var(--bad)" }}>weak</span> = charting with a rating under 4.0 ·{" "}
        <span style={{ color: "var(--good)" }}>climber</span> = up 20+ positions vs{" "}
        {baselineAt
          ? new Date(baselineAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "a ~7-day-old snapshot (needs snapshot history)"}{" "}
        · <span style={{ color: "var(--accent)" }}>new</span> = released in the last 90 days.
      </p>

      <div className="card divide-y divide-[var(--border)]">
        {entries.map((e) => (
          <div
            key={e.appId}
            className={`flex items-center gap-4 px-4 py-2 ${
              trackedIds.has(e.appId) ? "bg-[color-mix(in_oklab,var(--accent),transparent_92%)]" : ""
            }`}
          >
            <span className="w-8 text-right text-[13px] text-muted tabular">{e.rank}</span>
            <span className="w-12 text-right">
              <Delta current={e.rank} previous={e.previousRank} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.artworkUrl} alt="" className="size-9 rounded-lg border border-line" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/app/${e.appId}?country=${country}`}
                className="text-[13.5px] font-medium hover:text-accent truncate block"
              >
                {e.name}
              </Link>
              <div className="text-[12px] text-ink-2 truncate">{e.developer}</div>
            </div>
            <span className="flex items-center gap-2 shrink-0">
              <Stars rating={e.rating} />
              {e.ratingCount != null && (
                <span className="text-[12px] text-muted tabular">{fmtCount(e.ratingCount)}</span>
              )}
            </span>
            <span className="flex gap-1 shrink-0 w-40 justify-end">
              {e.flags.map((f) => {
                const s = FLAG_LABELS[f];
                return (
                  <span
                    key={f}
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    style={{ color: s.color, borderColor: s.color }}
                    title={f === "fast-climber" && e.delta != null ? `Up ${e.delta} positions` : s.title}
                  >
                    {f === "fast-climber" && e.delta != null ? `climber +${e.delta}` : s.label}
                  </span>
                );
              })}
            </span>
            {trackedIds.has(e.appId) && (
              <span className="text-[11.5px] text-accent font-medium shrink-0">tracked</span>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="px-5 py-4 text-[13.5px] text-ink-2">
            No chart data for this country/category combination.
          </div>
        )}
      </div>
    </div>
  );
}
