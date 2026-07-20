"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface SeedTerm {
  id: number;
  term: string;
  country: string;
}

export function SeedTermsForm({ seeds, country }: { seeds: SeedTerm[]; country: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const terms = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length === 0) return;
    setBusy(true);
    try {
      await fetch("/api/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, country }),
      });
      setValue("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await fetch(`/api/seeds/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form className="flex gap-2" onSubmit={submit}>
        <input
          className="input w-96"
          placeholder="Add seed terms for the daily scan (comma-separated)…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
        <button className="btn" disabled={busy || !value.trim()}>
          {busy ? "…" : "Add seeds"}
        </button>
      </form>
      {seeds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {seeds.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12.5px] text-ink-2"
            >
              {s.term}
              <button
                className="text-muted hover:text-[var(--bad)]"
                title="Remove seed"
                disabled={busy}
                onClick={() => remove(s.id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
