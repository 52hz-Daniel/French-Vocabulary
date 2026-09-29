import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("deployment assets", () => {
  it("uses a standalone, non-root production image", async () => {
    const [config, dockerfile] = await Promise.all([
      readFile("next.config.ts", "utf8"),
      readFile("Dockerfile", "utf8"),
    ]);
    expect(config).toContain('output: "standalone"');
    expect(dockerfile).toContain("FROM node:22-alpine AS runtime");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("keeps secrets and private study sources out of the image", async () => {
    const ignore = await readFile(".dockerignore", "utf8");
    expect(ignore).toContain(".env*");
    expect(ignore).toContain("data-private");
    expect(ignore).toContain("vocabulary resources");
  });
});
