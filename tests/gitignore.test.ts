import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("protects every private-data path", () => {
  const paths = ["data-private/example", "reference-private/example", "vocabulary resources/example", "Reference App/example", "Not in use plan and thoughts/example", ".env", ".env.local"];
  for (const path of paths) expect(() => execFileSync("git", ["check-ignore", "-q", path])).not.toThrow();
});
