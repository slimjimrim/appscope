import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Shared by the Next.js server, the MCP server, and the snapshot script.
// The globalThis stash keeps Next.js dev hot-reload from leaking pools.
const globalForDb = globalThis as unknown as {
  appscopePool?: Pool;
};

function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://sjr@localhost:5432/appscope",
    max: 5,
  });
}

export const pool = globalForDb.appscopePool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.appscopePool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export * as tables from "./schema";
