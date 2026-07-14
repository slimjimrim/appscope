import Link from "next/link";
import { COUNTRIES } from "@/lib/appstore";
import { listTrackedApps, queryReviews, reviewStats } from "@/lib/service";
import { reviewWordFrequency } from "@/lib/insights";
import { fmtDate } from "@/lib/format";
import { SyncReviewsButton } from "@/components/SyncReviewsButton";

export const dynamic = "force-dynamic";

export default async function ReviewsPage(props: {
  searchParams: Promise<{
    appId?: string;
    country?: string;
    rating?: string;
    q?: string;
  }>;
}) {
  const { appId, country = "us", rating, q } = await props.searchParams;
  const apps = await listTrackedApps();
  const selected = appId ? Number(appId) : apps[0]?.appId;
  const app = apps.find((a) => a.appId === selected);

  const [reviews, stats, wordCorpus] = app
    ? await Promise.all([
        queryReviews({
          appId: app.appId,
          country: country || undefined,
          rating: rating ? Number(rating) : undefined,
          search: q || undefined,
          limit: 100,
        }),
        reviewStats(app.appId, country || undefined),
        queryReviews({
          appId: app.appId,
          country: country || undefined,
          rating: rating ? Number(rating) : undefined,
          search: q || undefined,
          limit: 1000,
        }),
      ])
    : [[], { total: 0, distribution: {} as Record<number, number> }, []];

  const words = reviewWordFrequency(wordCorpus);
  const maxDist = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Review mining</h1>

      {apps.length === 0 ? (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2">
          Track an app first — <Link href="/" className="text-accent">search</Link> and hit
          Track, then sync its reviews here.
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {apps.map((a) => (
              <Link
                key={a.appId}
                href={`/reviews?appId=${a.appId}&country=${a.country}`}
                className={`btn !text-[12.5px] ${a.appId === selected ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.artworkUrl ?? ""} alt="" className="size-4 rounded" />
                {a.name.split(/[:\-–]/)[0].trim()}
              </Link>
            ))}
          </div>

          {app && (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <form className="flex gap-2" action="/reviews">
                  <input type="hidden" name="appId" value={app.appId} />
                  <select className="input" name="country" defaultValue={country}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <select className="input" name="rating" defaultValue={rating ?? ""}>
                    <option value="">All ratings</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r}★
                      </option>
                    ))}
                  </select>
                  <input
                    className="input w-56"
                    name="q"
                    placeholder="Search review text…"
                    defaultValue={q ?? ""}
                  />
                  <button className="btn" type="submit">
                    Filter
                  </button>
                </form>
                <SyncReviewsButton appId={app.appId} country={country} />
              </div>

              <div className="grid grid-cols-[16rem_1fr] gap-5 items-start">
                <div className="flex flex-col gap-4 sticky top-6">
                  <div className="card px-4 py-3">
                    <div className="text-[12px] font-medium text-ink-2 mb-2">
                      {stats.total} reviews stored ({country.toUpperCase()})
                    </div>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <Link
                        key={star}
                        href={`/reviews?appId=${app.appId}&country=${country}&rating=${star}`}
                        className="flex items-center gap-2 py-0.5 group"
                      >
                        <span className="w-3 text-[12px] text-muted tabular">{star}</span>
                        <div className="flex-1 h-2 rounded-full bg-grid overflow-hidden">
                          <div
                            className="h-full rounded-full group-hover:opacity-80"
                            style={{
                              width: `${((stats.distribution[star] ?? 0) / maxDist) * 100}%`,
                              background: "var(--series-1)",
                            }}
                          />
                        </div>
                        <span className="w-9 text-right text-[12px] text-ink-2 tabular">
                          {stats.distribution[star] ?? 0}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {words.length > 0 && (
                    <div className="card px-4 py-3">
                      <div className="text-[12px] font-medium text-ink-2 mb-2">
                        Frequent terms{rating ? ` in ${rating}★ reviews` : ""}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {words.map((w) => (
                          <Link
                            key={w.term}
                            href={`/reviews?appId=${app.appId}&country=${country}${rating ? `&rating=${rating}` : ""}&q=${encodeURIComponent(w.term)}`}
                            className="rounded-full border border-line px-2 py-0.5 text-[12px] text-ink-2 hover:border-[var(--accent)] hover:text-accent"
                          >
                            {w.term} <span className="text-muted">{w.count}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-0">
                  {reviews.length === 0 && (
                    <div className="card px-5 py-4 text-[13.5px] text-ink-2">
                      No stored reviews match. Hit “Sync {country.toUpperCase()} reviews” to pull
                      the latest ~500 from Apple.
                    </div>
                  )}
                  {reviews.map((r) => (
                    <div key={r.reviewId} className="card px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ color: "var(--series-3)" }} className="text-[12px]">
                          {"★".repeat(r.rating)}
                        </span>
                        <span className="text-[13px] font-medium">{r.title}</span>
                      </div>
                      <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                        {r.body}
                      </p>
                      <div className="mt-1.5 text-[11.5px] text-muted">
                        {r.author} · v{r.version} · {fmtDate(r.reviewedAt)} ·{" "}
                        {r.country.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
