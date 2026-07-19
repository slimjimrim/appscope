import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { deleteSetting, getSetting, setSetting } from "../service";

/**
 * Persistent Apple Ads dashboard session for keyword popularity.
 *
 * Two artifacts on disk (both under ~/.appscope, never committed):
 *   - USER_DATA_DIR — a persistent Chromium profile used ONLY for the headed
 *     login, so Apple's "trust this browser" device token survives and future
 *     logins can skip 2FA.
 *   - STATE_FILE — a Playwright storageState snapshot (cookies incl. session
 *     cookies + localStorage). Apple's auth cookies (myacinfo/itctx) are
 *     *session* cookies, which a persistent profile discards on close — so we
 *     snapshot them here and load them into each headless fetch context. Every
 *     successful fetch re-saves the snapshot, so an active session keeps itself
 *     alive as Apple rotates its tokens.
 *
 * Fetches never touch USER_DATA_DIR (they use ephemeral contexts + STATE_FILE),
 * so login and fetches can't contend on the profile lock.
 */

export const USER_DATA_DIR = join(homedir(), ".appscope", "asa-browser");
const STATE_FILE = join(homedir(), ".appscope", "asa-state.json");
const DASHBOARD = "https://app-ads.apple.com";
const LOGIN_HOST = "idmsa.apple.com";
const LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

// Serialize browser work so we never launch a swarm of browsers at Apple at once.
let chain: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn);
  chain = result.then(
    () => {},
    () => {},
  );
  return result;
}

let loginInProgress = false;

export interface SessionState {
  connecting: boolean;
  connected: boolean;
}

/** Status for the UI — flag only, never launches a browser (so polling can't hammer Apple). */
export async function getSessionState(): Promise<SessionState> {
  if (loginInProgress) return { connecting: true, connected: false };
  const flag = await getSetting("asa_connected");
  return { connecting: false, connected: Boolean(flag) };
}

/** Navigate with retry on Apple's transient 5xx (nginx "Service Unavailable"). */
async function gotoWithRetry(page: Page, url: string, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!resp || resp.status() < 500) return resp;
    } catch {
      // network error — fall through to backoff
    }
    await page.waitForTimeout(3000 * (i + 1));
  }
  return null;
}

/** "yes" = API answered 200, "busy" = Apple 5xx, "no" = signed out / unauthorized. */
async function probeAuth(page: Page): Promise<"yes" | "busy" | "no"> {
  if (page.url().includes(LOGIN_HOST)) return "no";
  try {
    const status = await page.evaluate(async () => {
      const r = await fetch("/cm/api/v1/apps?ownedApps=true", { headers: { Accept: "application/json" } });
      return r.status;
    });
    if (status === 200) return "yes";
    if (status >= 500) return "busy";
    return "no";
  } catch {
    return "no";
  }
}

function saveState(ctx: BrowserContext) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  return ctx.storageState({ path: STATE_FILE });
}

/** Run work in an ephemeral headless context seeded from the saved session snapshot. */
async function withFetchContext<T>(fn: (ctx: BrowserContext, page: Page) => Promise<T>): Promise<T> {
  return runExclusive(async () => {
    const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
    try {
      const ctx = await browser.newContext(
        existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {},
      );
      const page = await ctx.newPage();
      try {
        return await fn(ctx, page);
      } finally {
        await ctx.close().catch(() => {});
      }
    } finally {
      await browser.close().catch(() => {});
    }
  });
}

/** Live check — seeds the saved session and probes the API. */
export async function isAuthenticated(): Promise<boolean> {
  if (loginInProgress || !existsSync(STATE_FILE)) return false;
  try {
    return await withFetchContext(async (ctx, page) => {
      await gotoWithRetry(page, `${DASHBOARD}/cm/app`);
      const ok = (await probeAuth(page)) === "yes";
      if (ok) await saveState(ctx); // refresh snapshot with any rotated cookies
      return ok;
    });
  } catch {
    return false;
  }
}

async function discoverAdamId(page: Page): Promise<string | null> {
  const cached = await getSetting("asa_adam_id");
  if (cached) return cached;
  await gotoWithRetry(page, `${DASHBOARD}/cm/app`);
  if (page.url().includes(LOGIN_HOST)) return null;
  const adamId = await page.evaluate(async () => {
    const r = await fetch("/cm/api/v1/apps?ownedApps=true", { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.adamId ?? null;
  });
  if (adamId) await setSetting("asa_adam_id", String(adamId));
  return adamId ? String(adamId) : null;
}

export type PopularityFetch =
  | { ok: true; scores: Map<string, number> }
  | { ok: false; reason: "needs_login" | "no_owned_app" | "error" };

/** Fetch popularity through the saved session; refreshes the snapshot + keeps the flag honest. */
export async function fetchPopularityViaSession(
  terms: string[],
  country: string,
): Promise<PopularityFetch> {
  if (loginInProgress) return { ok: false, reason: "needs_login" };
  if (!existsSync(STATE_FILE)) return { ok: false, reason: "needs_login" };

  let result: PopularityFetch;
  try {
    result = await withFetchContext(async (ctx, page) => {
      const adamId = await discoverAdamId(page);
      if (!adamId) return { ok: false, reason: "needs_login" as const };

      await gotoWithRetry(page, `${DASHBOARD}/cm/app/${adamId}`);
      if (page.url().includes(LOGIN_HOST)) return { ok: false, reason: "needs_login" as const };

      const resp = await page.evaluate(
        async ({ adamId, storefront, terms }) => {
          const r = await fetch(`/cm/api/v2/keywords/popularities?adamId=${adamId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ storefronts: [storefront], terms }),
          });
          return { status: r.status, text: await r.text() };
        },
        { adamId, storefront: country.toUpperCase(), terms },
      );

      if (resp.status === 401 || resp.status === 403) return { ok: false, reason: "needs_login" as const };
      if (resp.status !== 200) return { ok: false, reason: "error" as const };

      const json = JSON.parse(resp.text) as { data?: { name?: string; popularity?: number }[] };
      const scores = new Map<string, number>();
      for (const row of json.data ?? []) {
        if (row.name && row.popularity != null) scores.set(row.name.toLowerCase(), row.popularity);
      }
      await saveState(ctx); // keep the session alive with any rotated cookies
      return { ok: true as const, scores };
    });
  } catch {
    result = { ok: false, reason: "error" };
  }

  if (result.ok) await setSetting("asa_connected", new Date().toISOString());
  else if (result.reason === "needs_login") await deleteSetting("asa_connected");
  return result;
}

/**
 * Drive the headed login persistent context to the dashboard, waiting until the
 * API confirms authentication, then snapshot the session to STATE_FILE.
 * Returns whether it connected. Shared by startLogin and the CLI.
 */
async function runLoginFlow(timeoutMs: number): Promise<boolean> {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: LAUNCH_ARGS,
  });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await gotoWithRetry(page, `${DASHBOARD}/cm/app`);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2500);
      let url: string;
      try {
        url = page.url();
      } catch {
        break; // window closed
      }
      // Confirm via the API — a 503 page is still on the dashboard host.
      if (url && !url.includes(LOGIN_HOST) && url.startsWith(DASHBOARD)) {
        if ((await probeAuth(page)) === "yes") {
          await saveState(ctx); // capture session cookies before closing
          await deleteSetting("asa_adam_id");
          await setSetting("asa_connected", new Date().toISOString());
          return true;
        }
      }
    }
    return false;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Non-blocking interactive login for the API route. Poll getSessionState() for progress. */
export function startLogin(timeoutMs = 5 * 60_000): void {
  if (loginInProgress) return;
  loginInProgress = true;
  runExclusive(async () => {
    try {
      await runLoginFlow(timeoutMs);
    } catch {
      // treated as not connected
    } finally {
      loginInProgress = false;
    }
  });
}

/** Blocking login for the CLI (`npm run asa:login`), which runs in its own process. */
export async function login(timeoutMs = 5 * 60_000): Promise<boolean> {
  return runLoginFlow(timeoutMs);
}
