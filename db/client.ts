import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __tcfPool: Pool | undefined;
}

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and configure PostgreSQL.");
  return value;
}

export function pool(): Pool {
  if (!globalThis.__tcfPool) globalThis.__tcfPool = new Pool({ connectionString: databaseUrl(), max: Number(process.env.DATABASE_POOL_MAX ?? 10), idleTimeoutMillis: 30_000 });
  return globalThis.__tcfPool;
}

export function db() {
  return drizzle(pool(), { schema });
}
