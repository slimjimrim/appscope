import {
  bigint,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const trackedApps = pgTable("tracked_apps", {
  appId: bigint("app_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull().default("us"),
  bundleId: text("bundle_id"),
  developer: text("developer"),
  artworkUrl: text("artwork_url"),
  metadata: jsonb("metadata"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywords = pgTable(
  "keywords",
  {
    id: serial("id").primaryKey(),
    term: text("term").notNull(),
    country: text("country").notNull().default("us"),
    appId: bigint("app_id", { mode: "number" })
      .notNull()
      .references(() => trackedApps.appId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("keywords_term_country_app").on(t.term, t.country, t.appId)],
);

export const keywordRanks = pgTable(
  "keyword_ranks",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    // null = not in top 200
    rank: integer("rank"),
    totalResults: integer("total_results"),
    topResults: jsonb("top_results"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("keyword_ranks_keyword_time").on(t.keywordId, t.snapshotAt)],
);

export const keywordPopularity = pgTable(
  "keyword_popularity",
  {
    id: serial("id").primaryKey(),
    term: text("term").notNull(),
    country: text("country").notNull().default("us"),
    score: real("score").notNull(),
    // "asa" (Apple Search Ads popularity) or "heuristic" (our difficulty estimate)
    source: text("source").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("keyword_popularity_term_country").on(t.term, t.country, t.snapshotAt)],
);

export const ratingSnapshots = pgTable(
  "rating_snapshots",
  {
    id: serial("id").primaryKey(),
    appId: bigint("app_id", { mode: "number" })
      .notNull()
      .references(() => trackedApps.appId, { onDelete: "cascade" }),
    country: text("country").notNull().default("us"),
    avgRating: real("avg_rating"),
    ratingCount: integer("rating_count"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rating_snapshots_app_time").on(t.appId, t.snapshotAt)],
);

export const chartSnapshots = pgTable(
  "chart_snapshots",
  {
    id: serial("id").primaryKey(),
    country: text("country").notNull(),
    chartType: text("chart_type").notNull(), // top-free | top-paid
    rank: integer("rank").notNull(),
    appId: bigint("app_id", { mode: "number" }).notNull(),
    appName: text("app_name").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chart_snapshots_country_type_time").on(t.country, t.chartType, t.snapshotAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    appId: bigint("app_id", { mode: "number" }).notNull(),
    country: text("country").notNull(),
    reviewId: text("review_id").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body"),
    version: text("version"),
    author: text("author"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_review_id").on(t.reviewId),
    index("reviews_app_country").on(t.appId, t.country),
  ],
);

export const apiCache = pgTable("api_cache", {
  cacheKey: text("cache_key").primaryKey(),
  response: jsonb("response").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
