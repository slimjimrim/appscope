import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchReviews, lookupApp } from "@/lib/appstore";
import { listTrackedApps } from "@/lib/service";
import { fmtBytes, fmtCount, fmtDate, fmtPrice, fmtRating } from "@/lib/format";
import { TrackButton } from "@/components/TrackButton";
import { Stars } from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function AppDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { id } = await props.params;
  const { country = "us" } = await props.searchParams;
  const appId = Number(id);

  const [app, tracked, recentReviews] = await Promise.all([
    lookupApp(appId, country),
    listTrackedApps(),
    fetchReviews(appId, country, 3).catch(() => []),
  ]);
  if (!app) notFound();

  const isTracked = tracked.some((t) => t.appId === appId);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of recentReviews) dist[r.rating] = (dist[r.rating] ?? 0) + 1;
  const maxDist = Math.max(1, ...Object.values(dist));

  const meta: [string, string][] = [
    ["Version", app.version ?? "—"],
    ["Updated", fmtDate(app.lastUpdated)],
    ["Released", fmtDate(app.releaseDate)],
    ["Size", fmtBytes(app.fileSizeBytes)],
    ["Min iOS", app.minimumOsVersion ?? "—"],
    ["Content rating", app.contentRating ?? "—"],
    ["Languages", String(app.languages.length || "—")],
    ["Bundle ID", app.bundleId],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={app.artworkUrl} alt="" className="size-24 rounded-2xl border border-line" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{app.name}</h1>
          <div className="text-[13.5px] text-ink-2">
            {app.developer} · {app.genre} · {fmtPrice(app.price, app.currency)}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Stars rating={app.rating} />
            <span className="text-[13px] text-ink-2 tabular">
              {fmtRating(app.rating)} · {fmtCount(app.ratingCount)} ratings ({country.toUpperCase()})
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <TrackButton appId={appId} country={country} tracked={isTracked} />
            <Link href={`/reviews?appId=${appId}&country=${country}`} className="btn">
              Reviews
            </Link>
            <Link href={`/compare?ids=${appId}`} className="btn">
              Compare
            </Link>
            <a href={app.storeUrl} target="_blank" rel="noreferrer" className="btn">
              App Store ↗
            </a>
          </div>
        </div>

        <div className="card px-4 py-3 w-64 shrink-0">
          <div className="text-[12px] font-medium text-ink-2 mb-2">
            Recent reviews ({recentReviews.length} fetched)
          </div>
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="flex items-center gap-2 py-0.5">
              <span className="w-3 text-[12px] text-muted tabular">{star}</span>
              <div className="flex-1 h-2 rounded-full bg-grid overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(dist[star] / maxDist) * 100}%`,
                    background: "var(--series-1)",
                  }}
                />
              </div>
              <span className="w-8 text-right text-[12px] text-ink-2 tabular">{dist[star]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
        {meta.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[11.5px] uppercase tracking-wide text-muted">{k}</div>
            <div className="text-[13.5px] truncate" title={v}>
              {v}
            </div>
          </div>
        ))}
      </div>

      {app.screenshotUrls.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {app.screenshotUrls.slice(0, 8).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-72 rounded-xl border border-line shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {app.releaseNotes && (
        <div className="card px-5 py-4">
          <div className="text-[13px] font-semibold mb-1.5">
            What’s new in {app.version}
          </div>
          <p className="text-[13.5px] text-ink-2 whitespace-pre-wrap leading-relaxed">
            {app.releaseNotes}
          </p>
        </div>
      )}

      <details className="card px-5 py-4">
        <summary className="text-[13px] font-semibold cursor-pointer">Description</summary>
        <p className="mt-2 text-[13.5px] text-ink-2 whitespace-pre-wrap leading-relaxed">
          {app.description}
        </p>
      </details>
    </div>
  );
}
