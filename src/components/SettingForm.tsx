"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SettingForm({
  settingKey,
  label,
  placeholder,
  hasValue,
  textarea,
}: {
  settingKey: string;
  label: string;
  placeholder: string;
  hasValue: boolean;
  textarea?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string) {
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: settingKey, value: next }),
      });
      setValue("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[13px] font-medium">{label}</span>
        {hasValue ? (
          <span className="text-[11.5px] rounded-full px-2 py-0.5" style={{ background: "color-mix(in oklab, var(--good), transparent 85%)", color: "var(--good)" }}>
            set
          </span>
        ) : (
          <span className="text-[11.5px] rounded-full px-2 py-0.5 bg-grid text-ink-2">not set</span>
        )}
      </div>
      <div className="flex gap-2 items-start">
        {textarea ? (
          <textarea
            className="input w-full h-20 font-mono !text-[12px]"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <input
            className="input w-full font-mono !text-[12px]"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <button className="btn" disabled={busy || !value.trim()} onClick={() => save(value.trim())}>
          Save
        </button>
        {hasValue && (
          <button className="btn" disabled={busy} onClick={() => save("")}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
