import Link from "next/link";
import { COUNTRIES, fetchTopChart, type ChartType } from "@/lib/appstore";
import { listTrackedApps } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function ChartsPage(props: {
  searchParams: Promise<{ country?: string; type?: string }>;
}) {
  const { country = "us", type = "top-free" } = await props.searchParams;
  const chartType = (type === "top-paid" ? "top-paid" : "top-free") as ChartType;

  const [entries, tracked] = await Promise.all([
    fetchTopChart(country, chartType, 100),
    listTrackedApps(),
  ]);
  const trackedIds = new Set(tracked.map((t) => t.appId));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Top charts</h1>

      <form className="flex gap-2 mb-6" action="/charts">
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
        <button className="btn btn-primary" type="submit">
          Load
        </button>
      </form>

      <div className="card divide-y divide-[var(--border)]">
        {entries.map((e) => (
          <div
            key={e.appId}
            className={`flex items-center gap-4 px-4 py-2 ${
              trackedIds.has(e.appId) ? "bg-[color-mix(in_oklab,var(--accent),transparent_92%)]" : ""
            }`}
          >
            <span className="w-8 text-right text-[13px] text-muted tabular">{e.rank}</span>
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
            {trackedIds.has(e.appId) && (
              <span className="text-[11.5px] text-accent font-medium shrink-0">tracked</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
