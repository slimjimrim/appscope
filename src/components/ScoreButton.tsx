"use client";

import { useState } from "react";

export function ScoreButton({ term, country }: { term: string; country: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; score: number; source: string }
  >({ status: "idle" });

  async function score() {
    setState({ status: "loading" });
    const res = await fetch("/api/research/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, country }),
    });
    const json = await res.json();
    setState({ status: "done", score: json.score, source: json.source });
  }

  if (state.status === "done") {
    return (
      <span
        className="tabular text-[12.5px]"
        title={state.source === "asa" ? "Apple Search Ads popularity" : "difficulty heuristic (top-10 entrenchment)"}
      >
        <span
          className="inline-block size-2 rounded-full mr-1.5 align-middle"
          style={{
            background:
              state.score >= 67
                ? "var(--bad)"
                : state.score >= 34
                  ? "var(--series-3)"
                  : "var(--good)",
          }}
        />
        {Math.round(state.score)}
        <span className="text-muted ml-1">{state.source === "asa" ? "pop" : "diff"}</span>
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
