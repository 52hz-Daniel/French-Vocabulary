import { drizzle } from "drizzle-orm/node-postgres";
import "./load-env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required to run migrations");
const pool = new Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
  console.log("PostgreSQL migrations applied");
} finally {
  await pool.end();
}
