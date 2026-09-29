import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce the minimal, self-contained Node server copied by the runtime
  // stage in Dockerfile. Runtime data remains in PostgreSQL.
  output: "standalone",
};

export default nextConfig;
