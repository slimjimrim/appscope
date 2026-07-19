"use client";

import { useState } from "react";

function Gauge({
  label,
  value,
  goodDirection,
  title,
}: {
  label: string;
  value: number | null;
  /** "high" = high values render green (popularity); "low" = low values render green (difficulty). */
  goodDirection: "high" | "low";
  title: string;
}) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1" title={title}>
        <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
        <span className="text-[12px] text-muted">n/a</span>
      </span>
    );
  }
  const level = value >= 67 ? 2 : value >= 34 ? 1 : 0; // 0=low, 1=mid, 2=high
  const lowToHigh = ["var(--bad)", "var(--series-3)", "var(--good)"];
  const color = goodDirection === "high" ? lowToHigh[level] : lowToHigh[2 - level];
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="w-14 h-1.5 rounded-full bg-grid overflow-hidden shrink-0">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: color }}
        />
      </span>
      <span className="tabular text-[12px] w-6 text-right">{Math.round(value)}</span>
    </span>
  );
}

export function ScoreButton({ term, country }: { term: string; country: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; popularity: number | null; difficulty: number; needsLogin: boolean }
  >({ status: "idle" });

  async function score() {
    setState({ status: "loading" });
    const res = await fetch("/api/research/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, country }),
    });
    const json = await res.json();
    setState({
      status: "done",
      popularity: json.popularity,
      difficulty: json.difficulty,
      needsLogin: Boolean(json.needsLogin),
    });
  }

  if (state.status === "done") {
    return (
      <span className="inline-flex items-center gap-3">
        <Gauge
          label="pop"
          value={state.popularity}
          goodDirection="high"
          title="Apple Search Ads popularity (5–100): how often users search this term. Higher = more demand. n/a = Apple Ads session not connected."
        />
        <Gauge
          label="diff"
          value={state.difficulty}
          goodDirection="low"
          title="Difficulty heuristic (0–100): how entrenched the current top-10 apps are (median rating count + avg rating). Lower = easier to rank."
        />
        {state.needsLogin && (
          <a
            href="/settings"
            className="text-[11px] text-accent hover:underline"
            title="Apple Ads session expired — reconnect to get popularity scores"
          >
            reconnect
          </a>
        )}
      </span>
    );
  }

  return (
    <button
      className="btn !px-2 !py-0.5 !text-[12px]"
      onClick={score}
      disabled={state.status === "loading"}
    >
      {state.status === "loading" ? "…" : "Score"}
    </button>
  );
}
