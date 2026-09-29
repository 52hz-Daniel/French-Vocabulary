import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://tcf_app:tcf_local@localhost:5432/tcf_lab" },
  strict: true,
  verbose: true,
});
