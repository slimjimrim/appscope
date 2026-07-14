"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AddKeywordForm({ appId, country }: { appId: number; country: string }) {
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
      await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, term: terms, country }),
      });
      setValue("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex gap-2" onSubmit={submit}>
      <input
        className="input w-96"
        placeholder="Add keywords (comma-separated)…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
      />
      <button className="btn btn-primary" disabled={busy || !value.trim()}>
        {busy ? "Checking ranks…" : "Add & check"}
      </button>
    </form>
  );
}
