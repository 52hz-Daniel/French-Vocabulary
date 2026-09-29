import { describe, expect, it } from "vitest";
import { normalizeFrench, normalizeFrenchIdentity } from "@/domain/normalize";

describe("French search normalization", () => {
  it("normalizes accents, curly apostrophes, case, and spacing", () => {
    expect(normalizeFrench("  L’ÉTÉ   prochain ")).toBe("l'ete prochain");
  });

  it("keeps a multiword expression as one normalized search key", () => {
    expect(normalizeFrench("avoir besoin de")).toBe("avoir besoin de");
  });

  it("preserves meaningful accents in database identity", () => {
    expect(normalizeFrenchIdentity("CÔTE")).toBe("côte");
    expect(normalizeFrenchIdentity("côté")).toBe("côté");
    expect(normalizeFrenchIdentity("CÔTE")).not.toBe(normalizeFrenchIdentity("côté"));
  });
});
