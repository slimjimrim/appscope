"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Adds/removes a genre from the daily chart-snapshot list (settings.snapshot_genres). */
export function TrackGenreToggle({
  genreId,
  snapshotGenres,
}: {
  genreId: number;
  snapshotGenres: number[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const enabled = snapshotGenres.includes(genreId);

  async function toggle() {
    const next = enabled
      ? snapshotGenres.filter((g) => g !== genreId)
      : [...snapshotGenres, genreId].sort((a, b) => a - b);
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "snapshot_genres", value: JSON.stringify(next) }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 cursor-pointer select-none"
      title="Capture this category's chart in the daily snapshot so fast-climber detection has history"
    >
      <input type="checkbox" checked={enabled} disabled={busy} onChange={toggle} />
      Snapshot this category daily
    </label>
  );
}
