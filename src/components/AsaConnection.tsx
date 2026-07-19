"use client";

import { useEffect, useRef, useState } from "react";

type Status = { mode: string; connecting: boolean; connected: boolean } | null;

export function AsaConnection() {
  const [status, setStatus] = useState<Status>(null);
  const [checking, setChecking] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus(): Promise<Status> {
    const res = await fetch("/api/asa/status");
    return res.json();
  }

  async function refresh() {
    setChecking(true);
    try {
      setStatus(await fetchStatus());
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      const s = await fetchStatus();
      setStatus(s);
      // Stop once the login is no longer in progress (connected or gave up).
      if (!s?.connecting || tries > 110) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }

  async function connect() {
    await fetch("/api/asa/login", { method: "POST" });
    setStatus((s) => (s ? { ...s, connecting: true } : s));
    startPolling();
  }

  const connecting = status?.connecting;
  const connected = status?.connected;

  return (
    <div className="card px-5 py-4">
      <div className="text-[13px] font-semibold mb-1">Apple Ads — keyword popularity session</div>
      <p className="text-[12.5px] text-muted leading-relaxed mb-3">
        Popularity (5–100) comes from the Apple Ads dashboard. Sign in once in the browser window
        that opens; the session persists at <code>~/.appscope/asa-browser</code> and stays
        authenticated automatically — no cookie pasting. Re-connect only if Apple fully signs you
        out.
      </p>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{
              background: checking
                ? "var(--muted)"
                : connecting
                  ? "var(--series-3)"
                  : connected
                    ? "var(--good)"
                    : "var(--bad)",
            }}
          />
          {checking
            ? "Checking…"
            : connecting
              ? "Waiting for sign-in…"
              : connected
                ? "Connected"
                : "Not connected"}
        </span>

        <button className="btn btn-primary" onClick={connect} disabled={connecting}>
          {connecting ? "Sign in in the browser window" : connected ? "Re-connect" : "Connect Apple Ads"}
        </button>
        <button className="btn" onClick={refresh} disabled={checking || connecting}>
          Refresh
        </button>
      </div>

      {connecting && (
        <p className="text-[12px] text-muted mt-2">
          A browser window should have opened. Complete Apple ID sign-in + 2FA there; this flips to
          “Connected” automatically and the window closes on its own.
        </p>
      )}
      {status?.mode === "cookie" && (
        <p className="text-[12px] text-muted mt-2">
          Mode is <code>cookie</code> (manual). Set <code>ASA_SESSION_MODE=playwright</code> in{" "}
          <code>.env.local</code> for the automatic session.
        </p>
      )}
    </div>
  );
}
