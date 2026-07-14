"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TrackButton({
  appId,
  country = "us",
  tracked,
  small,
}: {
  appId: number;
  country?: string;
  tracked: boolean;
  small?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (tracked) {
        await fetch(`/api/track?appId=${appId}`, { method: "DELETE" });
      } else {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, country }),
        });
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn ${tracked ? "" : "btn-primary"} ${small ? "!px-2 !py-1 !text-[12px]" : ""}`}
      onClick={toggle}
      disabled={busy || pending}
    >
      {busy || pending ? "…" : tracked ? "Untrack" : "Track"}
    </button>
  );
}
