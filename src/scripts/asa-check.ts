import { config } from "dotenv";
config({ path: new URL("../../.env.local", import.meta.url).pathname });

/** Verify official Apple Ads API credentials: token exchange + two live calls. */
async function main() {
  const { getAccessToken } = await import("../lib/searchads/auth");
  const { getCampaigns, searchAppsAsa } = await import("../lib/searchads/client");

  const token = await getAccessToken();
  console.log("token exchange: OK (", token.slice(0, 16), "…)");

  const campaigns = await getCampaigns();
  console.log(
    "campaigns:",
    campaigns.length,
    campaigns.map((c) => `${c.name} [${c.status}]`).join(", ") || "(none yet)",
  );

  const apps = await searchAppsAsa("golf", 5);
  console.log(
    "catalog search 'golf':",
    apps.map((a) => `${a.appName ?? a.name} (${a.adamId})`).join(", "),
  );
}

main().catch((err) => {
  console.error("FAILED:", err.message ?? err);
  process.exit(1);
});
