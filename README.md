# AppScope

Local-first iOS App Store research & ASO tool (in the spirit of AppKittie / Astro), running
entirely on your machine against free Apple endpoints. Next.js + PostgreSQL + an MCP server
so Claude Code can pull the same data and generate insights.

## Features

- **App search & detail** — full iTunes metadata, screenshots, recent-review histogram
- **Compare** — 2–4 apps side by side + shared metadata keywords
- **Keyword tracking** — daily rank snapshots (position in App Store search, top 200), trend charts
- **Keyword research** — App Store autocomplete expansions, competitor keyword extraction,
  popularity/difficulty scoring
- **Review mining** — syncs the latest ~500 reviews per app/country, filters by star/text/country,
  word-frequency panel
- **Top charts** — top-free / top-paid by country, tracked apps highlighted
- **Daily snapshots** — launchd job records ranks, ratings, charts, and new reviews
- **MCP server** — 13 tools exposing everything above to Claude Code

## Data sources (all free)

| Source | Used for |
|---|---|
| `itunes.apple.com/search` / `/lookup` | app metadata, keyword ranks (throttled ~1 req/3.2s, cached in Postgres) |
| `itunes.apple.com/{cc}/rss/customerreviews` | ~500 most recent reviews per app per country |
| `rss.marketingtools.apple.com` | top charts |
| `MZSearchHints.woa` | search autocomplete (keyword suggestions) |
| Apple Search Ads (optional) | official API: catalog search, bid signals; dashboard session: popularity 5–100 |

Revenue/download estimates are intentionally out of scope — that data only exists behind
enterprise-priced providers (Sensor Tower, Appfigures).

## Setup

```bash
npm install
createdb appscope                      # Postgres must be running
npm run db:push                        # create tables
npm run dev                            # http://localhost:3000
```

`.env.local` holds `DATABASE_URL` (defaults to `postgres://sjr@localhost:5432/appscope`).

### Apple Search Ads (optional)

1. ASA UI → Account Settings → API: create an API user, generate/upload an ES256 key pair
2. Fill in `ASA_CLIENT_ID`, `ASA_TEAM_ID`, `ASA_KEY_ID`, `ASA_PRIVATE_KEY_PATH`, `ASA_ORG_ID`
   in `.env.local`
3. For real popularity scores (5–100): AppScope keeps a persistent Apple Ads dashboard session
   via a headless browser. Install the browser once with `npx playwright install chromium`, then
   run `npm run asa:login` (or click **Connect Apple Ads** in Settings) and sign in with your
   Apple ID + 2FA. The session persists at `~/.appscope/asa-browser` and stays authenticated
   automatically — no cookie pasting. Without it, research scores fall back to a local difficulty
   heuristic. (Set `ASA_SESSION_MODE=cookie` in `.env.local` to use the legacy manual-paste flow
   instead, or `off` to always use the heuristic.)

### Daily snapshots

```bash
npm run snapshot                       # run once manually
cp launchd/com.sjr.appscope.snapshot.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.sjr.appscope.snapshot.plist   # daily at 09:00
```

### Claude Code integration (MCP)

`.mcp.json` in this repo registers the `appscope` MCP server automatically for Claude Code
sessions started in this directory. Tools: `search_apps`, `get_app`, `get_reviews`,
`list_tracked_apps`, `track_app`, `add_keywords`, `get_keyword_ranks`, `keyword_suggestions`,
`keyword_popularity`, `compare_apps`, `get_top_charts`, `rating_history`, `run_snapshot`.

Example asks: *“Pull the 1-star reviews for my tracked app and summarize the top complaints”*,
*“Which keywords should I target for a sleep tracker? Score the candidates”*, *“Compare my app
against Calm and Headspace and tell me where I’m weak.”*

## Architecture

All data logic lives in `src/lib/` (`appstore/` Apple client with throttle+cache, `searchads/`,
`service.ts`, `insights.ts`, `snapshot-runner.ts`) and is shared by three consumers: the Next.js
UI/API routes, the MCP server (`src/mcp/server.ts`), and the snapshot script
(`src/scripts/snapshot.ts`). `src/scripts/smoke.ts` is a live end-to-end check of the Apple client.
