import Link from "next/link";
import { COUNTRIES, expandKeyword, extractKeywords, searchApps } from "@/lib/appstore";
import { ScoreButton } from "@/components/ScoreButton";

export const dynamic = "force-dynamic";

export default async function ResearchPage(props: {
  searchParams: Promise<{ term?: string; country?: string }>;
}) {
  const { term, country = "us" } = await props.searchParams;

  const [suggestions, topApps] = await Promise.all([
    term ? expandKeyword(term, country) : Promise.resolve([]),
    term ? searchApps(term, country, 10) : Promise.resolve([]),
  ]);
  const competitorKeywords = topApps.length ? extractKeywords(topApps, 30) : [];
  const scoreSource =
    "pop = Apple Ads popularity (higher = more demand, green) · diff = top-10 entrenchment (lower = easier to rank, green)";

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-4">Keyword research</h1>

      <form className="flex gap-2 mb-2" action="/research">
        <input
          className="input w-80"
          name="term"
          placeholder="Seed keyword (e.g. sleep tracker)…"
          defaultValue={term ?? ""}
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
          Research
        </button>
      </form>
      <p className="text-[12px] text-muted mb-6">{scoreSource}.</p>

      {term && (
        <div className="grid grid-cols-2 gap-5 items-start">
          <div className="card px-5 py-4">
            <div className="text-[13px] font-semibold mb-3">
              Autocomplete suggestions ({suggestions.length})
            </div>
            <div className="flex flex-col gap-1">
              {suggestions.map((s) => (
                <div key={s} className="flex items-center justify-between gap-3 py-0.5">
                  <Link
                    href={`/research?term=${encodeURIComponent(s)}&country=${country}`}
                    className="text-[13.5px] hover:text-accent truncate"
                  >
                    {s}
                  </Link>
                  <ScoreButton term={s} country={country} />
                </div>
              ))}
              {suggestions.length === 0 && (
                <p className="text-[13px] text-muted">No suggestions for this seed.</p>
              )}
            </div>
          </div>

          <div className="card px-5 py-4">
            <div className="text-[13px] font-semibold mb-1">Competitor metadata keywords</div>
            <p className="text-[12px] text-muted mb-3">
              Terms shared across the top {topApps.length} apps ranking for “{term}”.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {competitorKeywords.map((k) => (
                <Link
                  key={k.term}
                  href={`/research?term=${encodeURIComponent(k.term)}&country=${country}`}
                  className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px] text-ink-2 hover:border-[var(--accent)] hover:text-accent"
                  title={k.apps.join(", ")}
                >
                  {k.term} <span className="text-muted">×{k.count}</span>
                </Link>
              ))}
            </div>

            {topApps.length > 0 && (
              <>
                <div className="text-[13px] font-semibold mt-5 mb-2">Top 10 for “{term}”</div>
                <ol className="flex flex-col gap-1">
                  {topApps.map((a, i) => (
                    <li key={a.appId} className="flex items-center gap-2.5 text-[13px]">
                      <span className="w-5 text-right text-muted tabular">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.artworkUrl} alt="" className="size-6 rounded-md border border-line" />
                      <Link href={`/app/${a.appId}?country=${country}`} className="hover:text-accent truncate">
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      )}

      {!term && (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2 leading-relaxed">
          Start from a seed keyword. You’ll get App Store autocomplete expansions (what users
          actually type), the keywords competitors share in their metadata, and a
          popularity/difficulty score per term.
        </div>
      )}
    </div>
  );
}
