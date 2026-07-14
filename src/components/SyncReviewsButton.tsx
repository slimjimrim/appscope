"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SyncReviewsButton({ appId, country }: { appId: number; country: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, countries: [country] }),
      });
      const json = await res.json();
      setResult(`+${json.inserted} new`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn" onClick={sync} disabled={busy}>
        {busy ? "Fetching from Apple…" : `Sync ${country.toUpperCase()} reviews`}
      </button>
      {result && <span className="text-[12.5px] text-good">{result}</span>}
    </span>
  );
}
