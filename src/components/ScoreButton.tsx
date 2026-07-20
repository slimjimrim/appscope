"use client";

import { useState } from "react";
import { Gauge } from "./Gauge";

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
