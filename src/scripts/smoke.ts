import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { searchApps, lookupApp, fetchReviews, fetchTopChart, searchHints, getKeywordRank, keywordDifficulty, extractKeywords } =
    await import("../lib/appstore");
  const { pool } = await import("../lib/db");

  const results = await searchApps("meditation", "us", 10);
  console.log("search:", results.length, "first:", results[0]?.name, results[0]?.appId);

  const app = await lookupApp(results[0].appId);
  console.log("lookup:", app?.name, "rating:", app?.rating, "count:", app?.ratingCount);

  const reviews = await fetchReviews(results[0].appId, "us", 1);
  console.log("reviews page1:", reviews.length, "sample:", reviews[0]?.rating, reviews[0]?.title?.slice(0, 40));

  const chart = await fetchTopChart("us", "top-free", 5);
  console.log("chart:", chart.map((c) => `${c.rank}.${c.name}`).join(" | "));

  const hints = await searchHints("medita", "us");
  console.log("hints:", hints.slice(0, 5).join(", "));

  const rank = await getKeywordRank("meditation", "us", results[2].appId);
  console.log("rank of", results[2].name, "for 'meditation':", rank.rank, "/", rank.totalResults);

  const diff = await keywordDifficulty("meditation", "us");
  console.log("difficulty:", diff.score, "median ratings:", diff.medianRatingCount);

  const extracted = extractKeywords(results);
  console.log("extracted:", extracted.slice(0, 8).map((k) => `${k.term}(${k.count})`).join(", "));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
