import Link from "next/link";
import { listKeywords, listTrackedApps } from "@/lib/service";
import { AddKeywordForm } from "@/components/AddKeywordForm";
import { KeywordTable, type KeywordRow } from "@/components/KeywordTable";

export const dynamic = "force-dynamic";

export default async function KeywordsPage(props: {
  searchParams: Promise<{ appId?: string }>;
}) {
  const { appId } = await props.searchParams;
  const apps = await listTrackedApps();
  const selected = appId ? Number(appId) : apps[0]?.appId;
  const app = apps.find((a) => a.appId === selected);
  const keywords = app ? await listKeywords(app.appId) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Keyword tracking</h1>
        <Link href="/research" className="btn">
          Keyword research →
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="card px-5 py-4 text-[13.5px] text-ink-2">
          Track an app first — <Link href="/" className="text-accent">search</Link> and hit Track,
          then add keywords here.
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {apps.map((a) => (
              <Link
                key={a.appId}
                href={`/keywords?appId=${a.appId}`}
                className={`btn !text-[12.5px] ${a.appId === selected ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.artworkUrl ?? ""} alt="" className="size-4 rounded" />
                {a.name.split(/[:\-–]/)[0].trim()}
              </Link>
            ))}
          </div>

          {app && (
            <div className="flex flex-col gap-4">
              <AddKeywordForm appId={app.appId} country={app.country} />
              <KeywordTable rows={keywords as unknown as KeywordRow[]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
