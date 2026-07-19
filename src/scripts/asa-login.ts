import { config } from "dotenv";
config({ path: new URL("../../.env.local", import.meta.url).pathname });

/**
 * Interactive Apple Ads login. Opens a real browser window; sign in with your
 * Apple ID (complete 2FA and choose "trust") until you land on the dashboard.
 * The session persists at ~/.appscope/asa-browser so popularity scoring stays
 * authenticated without re-pasting cookies.
 */
async function main() {
  const { login } = await import("../lib/searchads/session");
  const { pool } = await import("../lib/db");

  console.log("Opening Apple Ads in a browser window — sign in and complete 2FA…");
  const ok = await login();
  console.log(
    ok
      ? "✓ Signed in. Session saved — popularity scoring will stay authenticated."
      : "✗ Timed out before reaching the dashboard. Re-run `npm run asa:login` to retry.",
  );
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
