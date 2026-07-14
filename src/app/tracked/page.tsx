import Link from "next/link";
import { listKeywords, listTrackedApps } from "@/lib/service";
import { fmtCount, fmtRating } from "@/lib/format";
import { TrackButton } from "@/components/TrackButton";
import { Stars } from "@/components/Stars";
import type { AppSummary } from "@/lib/appstore";

export const dynamic = "force-dynamic";

export default async function TrackedPage() {
  const [apps, keywords] = await Promise.all([listTrackedApps(), listKeywords()]);
  const kwCount = new Map<number, number>();
  for (const k of keywords) kwCount.set(k.appId, (kwCount.get(k.appId) ?? 0) + 1);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Tracked apps</h1>

      {apps.length === 0 && (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2">
          Nothing tracked yet — <Link href="/" className="text-accent">search for an app</Link> and
          hit Track to start collecting rank, rating, and review history.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {apps.map((app) => {
          const meta = app.metadata as AppSummary | null;
          return (
            <div key={app.appId} className="card flex items-center gap-4 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={app.artworkUrl ?? ""} alt="" className="size-12 rounded-[10px] border border-line" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/${app.appId}?country=${app.country}`}
                  className="font-medium text-[14px] hover:text-accent"
                >
                  {app.name}
                </Link>
                <div className="text-[12.5px] text-ink-2">
                  {app.developer} · {app.country.toUpperCase()} ·{" "}
                  {kwCount.get(app.appId) ?? 0} keywords
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1.5">
                  <Stars rating={meta?.rating ?? null} />
                  <span className="text-[12.5px] text-ink-2 tabular">{fmtRating(meta?.rating)}</span>
                </div>
                <div className="text-[12px] text-muted tabular">
                  {fmtCount(meta?.ratingCount)} ratings
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Link href={`/keywords?appId=${app.appId}`} className="btn !px-2 !py-1 !text-[12px]">
                  Keywords
                </Link>
                <Link
                  href={`/reviews?appId=${app.appId}&country=${app.country}`}
                  className="btn !px-2 !py-1 !text-[12px]"
                >
                  Reviews
                </Link>
                <TrackButton appId={app.appId} tracked small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
