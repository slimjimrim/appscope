"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface KeywordRow {
  id: number;
  term: string;
  country: string;
  appId: number;
  latestRank: number | null;
  latestCheckedAt: string | null;
  previousRank: number | null;
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null || current === previous)
    return <span className="text-muted">·</span>;
  const improved = current < previous; // lower rank number = better
  return (
    <span style={{ color: improved ? "var(--good)" : "var(--bad)" }} className="tabular text-[12px]">
      {improved ? "▲" : "▼"} {Math.abs(current - previous)}
    </span>
  );
}

function RankChart({ keywordId }: { keywordId: number }) {
  const [data, setData] = useState<{ rank: number | null; snapshotAt: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keywords/${keywordId}/history`)
      .then((r) => r.json())
      .then((rows) => {
        if (!cancelled) setData(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [keywordId]);

  if (data === null) {
    return <div className="px-4 py-6 text-[12.5px] text-muted">Loading history…</div>;
  }

  const points = data.map((d) => ({
    date: new Date(d.snapshotAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rank: d.rank,
  }));

  if (points.length < 2) {
    return (
      <div className="px-4 py-6 text-[12.5px] text-muted">
        Not enough snapshots yet — history builds up as the daily snapshot job runs.
      </div>
    );
  }

  return (
    <div className="h-44 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[1, "dataMax"]}
            allowDecimals={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--ink)",
            }}
            formatter={(v) => [v == null ? "not in top 200" : `#${v}`, "rank"]}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeywordTable({ rows }: { rows: KeywordRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  async function check(id: number) {
    setBusy(id);
    try {
      await fetch(`/api/keywords/${id}/check`, { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    setBusy(id);
    try {
      await fetch(`/api/keywords/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card px-5 py-4 text-[13.5px] text-ink-2">
        No keywords yet — add one above to start tracking its search rank.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Keyword</th>
            <th className="px-3 py-2.5 font-medium w-16">Store</th>
            <th className="px-3 py-2.5 font-medium w-20 text-right">Rank</th>
            <th className="px-3 py-2.5 font-medium w-16 text-right">Δ</th>
            <th className="px-3 py-2.5 font-medium w-40">Checked</th>
            <th className="px-3 py-2.5 w-44" />
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <Fragment key={k.id}>
              <tr className="border-t border-line">
                <td className="px-4 py-2 font-medium">{k.term}</td>
                <td className="px-3 py-2 text-ink-2">{k.country.toUpperCase()}</td>
                <td className="px-3 py-2 text-right tabular">
                  {k.latestRank == null ? <span className="text-muted">&gt;200</span> : `#${k.latestRank}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <Delta current={k.latestRank} previous={k.previousRank} />
                </td>
                <td className="px-3 py-2 text-ink-2 text-[12.5px]">
                  {k.latestCheckedAt
                    ? new Date(k.latestCheckedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn !px-2 !py-1 !text-[12px]" onClick={() => toggle(k.id)}>
                      {open.has(k.id) ? "Hide" : "Trend"}
                    </button>
                    <button
                      className="btn !px-2 !py-1 !text-[12px]"
                      disabled={busy === k.id}
                      onClick={() => check(k.id)}
                    >
                      {busy === k.id ? "…" : "Check"}
                    </button>
                    <button
                      className="btn !px-2 !py-1 !text-[12px]"
                      disabled={busy === k.id}
                      onClick={() => remove(k.id)}
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              {open.has(k.id) && (
                <tr className="border-t border-line">
                  <td colSpan={6}>
                    <RankChart keywordId={k.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
