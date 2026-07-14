import Link from "next/link";
import { extractKeywords, lookupApps } from "@/lib/appstore";
import { listTrackedApps } from "@/lib/service";
import { fmtBytes, fmtCount, fmtDate, fmtPrice, fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ComparePage(props: {
  searchParams: Promise<{ ids?: string; country?: string }>;
}) {
  const { ids, country = "us" } = await props.searchParams;
  const appIds = (ids ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean)
    .slice(0, 4);

  const [apps, tracked] = await Promise.all([
    appIds.length ? lookupApps(appIds, country) : Promise.resolve([]),
    listTrackedApps(),
  ]);

  const rows: { label: string; value: (a: (typeof apps)[number]) => React.ReactNode }[] = [
    { label: "Developer", value: (a) => a.developer },
    { label: "Price", value: (a) => fmtPrice(a.price, a.currency) },
    { label: "Rating", value: (a) => fmtRating(a.rating) },
    { label: "Ratings count", value: (a) => fmtCount(a.ratingCount) },
    { label: "Category", value: (a) => a.genre },
    { label: "Last updated", value: (a) => fmtDate(a.lastUpdated) },
    { label: "Released", value: (a) => fmtDate(a.releaseDate) },
    { label: "Size", value: (a) => fmtBytes(a.fileSizeBytes) },
    { label: "Min iOS", value: (a) => a.minimumOsVersion ?? "—" },
    { label: "Languages", value: (a) => String(a.languages.length) },
    { label: "Screenshots", value: (a) => String(a.screenshotUrls.length) },
  ];

  const shared = apps.length >= 2 ? extractKeywords(apps, 15) : [];

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Compare apps</h1>

      <form className="flex gap-2 mb-6" action="/compare">
        <input
          className="input w-96"
          name="ids"
          placeholder="App IDs, comma-separated (e.g. 337472899,571800810)"
          defaultValue={ids ?? ""}
        />
        <button className="btn btn-primary" type="submit">
          Compare
        </button>
      </form>

      {tracked.length > 0 && (
        <div className="mb-5 text-[13px] text-ink-2">
          Tracked:{" "}
          {tracked.map((t, i) => (
            <span key={t.appId}>
              {i > 0 && " · "}
              <Link
                className="text-accent hover:underline"
                href={`/compare?ids=${ids ? `${ids},` : ""}${t.appId}`}
              >
                {t.name.split(/[:\-–]/)[0].trim()}
              </Link>
            </span>
          ))}
        </div>
      )}

      {apps.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className="w-36" />
                {apps.map((a) => (
                  <th key={a.appId} className="px-4 py-4 text-left align-top min-w-44">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.artworkUrl} alt="" className="size-14 rounded-xl border border-line mb-2" />
                    <Link href={`/app/${a.appId}`} className="font-semibold hover:text-accent">
                      {a.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="px-4 py-2 text-muted">{row.label}</td>
                  {apps.map((a) => (
                    <td key={a.appId} className="px-4 py-2 tabular">
                      {row.value(a)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shared.length > 0 && (
        <div className="card mt-5 px-5 py-4">
          <div className="text-[13px] font-semibold mb-2">Shared metadata keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {shared.map((k) => (
              <span
                key={k.term}
                className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px] text-ink-2"
                title={k.apps.join(", ")}
              >
                {k.term} <span className="text-muted">×{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
