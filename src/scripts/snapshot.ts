import { config } from "dotenv";
config({ path: new URL("../../.env.local", import.meta.url).pathname });

/**
 * Daily snapshot entry point. Run manually with `npm run snapshot` or on a
 * schedule via the launchd template in launchd/.
 */
async function main() {
  const { runSnapshot } = await import("../lib/snapshot-runner");
  const { pool } = await import("../lib/db");
  console.log(`[snapshot] ${new Date().toISOString()}`);
  await runSnapshot((line) => console.log(`  ${line}`));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
