import Link from "next/link";
import { COUNTRIES, expandKeyword, extractKeywords, searchApps } from "@/lib/appstore";
import { listKeywordOpportunities, listSeedTerms } from "@/lib/service";
import { Gauge } from "@/components/Gauge";
import { ScoreButton } from "@/components/ScoreButton";
import { SeedTermsForm } from "@/components/SeedTermsForm";

export const dynamic = "force-dynamic";

const FLAG_LABELS: Record<string, { label: string; color: string; title: string }> = {
  "low-competition": {
    label: "low competition",
    color: "var(--good)",
    title: "Real search demand with an easy top 10 (popularity ≥ 40, difficulty ≤ 40)",
  },
  "ranking-gap": {
    label: "ranking gap",
    color: "var(--accent)",
    title: "Decent popularity but none of your tracked apps rank in the top 20",
  },
  "weak-incumbents": {
    label: "weak incumbents",
    color: "var(--bad)",
    title: "At least 4 of the top-10 apps are poorly rated or barely rated",
  },
};

export default async function ResearchPage(props: {
  searchParams: Promise<{
    term?: string;
    country?: string;
    minPop?: string;
    maxDiff?: string;
    flag?: string;
  }>;
}) {
  const { term, country = "us", minPop, maxDiff, flag } = await props.searchParams;

  const [suggestions, topApps, opportunities, seeds] = await Promise.all([
    term ? expandKeyword(term, country) : Promise.resolve([]),
    term ? searchApps(term, country, 10) : Promise.resolve([]),
    listKeywordOpportunities({
      country,
      minPopularity: minPop ? Number(minPop) : undefined,
      maxDifficulty: maxDiff ? Number(maxDiff) : undefined,
      flags: flag ? [flag] : undefined,
    }),
    listSeedTerms(country),
  ]);
  const competitorKeywords = topApps.length ? extractKeywords(topApps, 30) : [];
  const scoreSource =
    "pop = Apple Ads popularity (higher = more demand, green) · diff = top-10 entrenchment (lower = easier to rank, green)";
  const scannedAt = opportunities[0]?.scannedAt ?? null;
  const asaMissing = opportunities.length > 0 && opportunities.every((o) => o.popularity == null);

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
        <div className="grid grid-cols-2 gap-5 items-start mb-6">
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

      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Opportunities <span className="text-muted font-normal">({country.toUpperCase()})</span>
        </h2>
        <span className="text-[12px] text-muted">
          {scannedAt
            ? `last scan ${new Date(scannedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`
            : "not scanned yet"}
        </span>
      </div>
      <p className="text-[12px] text-muted mb-3">
        Auto-discovered from your tracked apps plus the seed terms below, scored during the daily
        snapshot.
        {asaMissing && (
          <>
            {" "}
            Popularity is unavailable —{" "}
            <Link href="/settings" className="text-accent hover:underline">
              reconnect Apple Ads
            </Link>{" "}
            for real demand scores.
          </>
        )}
      </p>

      <div className="mb-4">
        <SeedTermsForm seeds={seeds} country={country} />
      </div>

      <form className="flex gap-2 mb-3" action="/research">
        <input type="hidden" name="country" value={country} />
        <input
          className="input w-32"
          name="minPop"
          type="number"
          placeholder="Min pop"
          defaultValue={minPop ?? ""}
        />
        <input
          className="input w-32"
          name="maxDiff"
          type="number"
          placeholder="Max diff"
          defaultValue={maxDiff ?? ""}
        />
        <select className="input" name="flag" defaultValue={flag ?? ""}>
          <option value="">Any flag</option>
          <option value="low-competition">Low competition</option>
          <option value="ranking-gap">Ranking gap</option>
          <option value="weak-incumbents">Weak incumbents</option>
        </select>
        <button className="btn" type="submit">
          Filter
        </button>
      </form>

      {opportunities.length === 0 ? (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2">
          {scannedAt
            ? "No keywords match these filters."
            : "No scan results yet — run `npm run snapshot` (or the run_snapshot MCP tool) to build the opportunity table."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Keyword</th>
                <th className="px-3 py-2.5 font-medium w-36">Popularity</th>
                <th className="px-3 py-2.5 font-medium w-36">Difficulty</th>
                <th className="px-3 py-2.5 font-medium w-16 text-right" title="√(popularity × ease)">
                  Opp
                </th>
                <th className="px-3 py-2.5 font-medium w-20 text-right">Best rank</th>
                <th className="px-3 py-2.5 font-medium">Flags</th>
                <th className="px-3 py-2.5 font-medium w-36">Source</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      href={`/research?term=${encodeURIComponent(o.term)}&country=${country}`}
                      className="hover:text-accent"
                    >
                      {o.term}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Gauge
                      label="pop"
                      value={o.popularity}
                      goodDirection="high"
                      title="Apple Search Ads popularity (5–100). n/a = Apple Ads session not connected."
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Gauge
                      label="diff"
                      value={o.difficulty}
                      goodDirection="low"
                      title="Difficulty heuristic (0–100): top-10 entrenchment. Lower = easier to rank."
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular font-medium">
                    {Math.round(o.opportunityScore)}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {o.bestRank == null ? <span className="text-muted">&gt;200</span> : `#${o.bestRank}`}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {(o.flags as string[]).map((f) => {
                        const s = FLAG_LABELS[f];
                        return s ? (
                          <span
                            key={f}
                            className="rounded-full border px-2 py-0.5 text-[11px]"
                            style={{ color: s.color, borderColor: s.color }}
                            title={s.title}
                          >
                            {s.label}
                          </span>
                        ) : null;
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-ink-2">{o.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
