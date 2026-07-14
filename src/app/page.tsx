import Link from "next/link";
import { searchApps, COUNTRIES } from "@/lib/appstore";
import { listTrackedApps } from "@/lib/service";
import { fmtCount, fmtPrice, fmtRating } from "@/lib/format";
import { TrackButton } from "@/components/TrackButton";
import { Stars } from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function SearchPage(props: {
  searchParams: Promise<{ q?: string; country?: string }>;
}) {
  const { q, country = "us" } = await props.searchParams;
  const [results, tracked] = await Promise.all([
    q ? searchApps(q, country, 50) : Promise.resolve([]),
    listTrackedApps(),
  ]);
  const trackedIds = new Set(tracked.map((t) => t.appId));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">App search</h1>
      <form className="flex gap-2 mb-6" action="/">
        <input
          className="input w-80"
          type="search"
          name="q"
          placeholder="Search the App Store…"
          defaultValue={q ?? ""}
          autoFocus
        />
        <select className="input" name="country" defaultValue={country}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>

      {q && results.length === 0 && (
        <p className="text-ink-2 text-sm">
          No results for “{q}” in {country.toUpperCase()}.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {results.map((app, i) => (
          <div key={app.appId} className="card flex items-center gap-4 px-4 py-3">
            <span className="w-6 text-right text-[13px] text-muted tabular">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={app.artworkUrl} alt="" className="size-12 rounded-[10px] border border-line" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/app/${app.appId}?country=${country}`}
                className="font-medium text-[14px] hover:text-accent truncate block"
              >
                {app.name}
              </Link>
              <div className="text-[12.5px] text-ink-2 truncate">
                {app.developer} · {app.genre}
              </div>
            </div>
            <div className="text-right shrink-0 w-44">
              <div className="flex items-center justify-end gap-1.5">
                <Stars rating={app.rating} />
                <span className="text-[12.5px] text-ink-2 tabular">{fmtRating(app.rating)}</span>
              </div>
              <div className="text-[12px] text-muted tabular">
                {fmtCount(app.ratingCount)} ratings · {fmtPrice(app.price, app.currency)}
              </div>
            </div>
            <TrackButton appId={app.appId} country={country} tracked={trackedIds.has(app.appId)} small />
          </div>
        ))}
      </div>

      {!q && (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2 leading-relaxed">
          Search any iOS app to inspect its metadata, reviews, and keywords. Track apps to build
          your research set — tracked apps get daily rank, rating, and review snapshots.
        </div>
      )}
    </div>
  );
}
