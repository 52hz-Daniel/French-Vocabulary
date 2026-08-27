import { describe, expect, it } from "vitest";
import { fixtureDataset } from "@/data/fixture";
import { buildRecognitionQuestion } from "@/domain/questions";

describe("deterministic distractors", () => {
  it("uses four unique real senses and excludes the correct meaning", () => {
    const target = fixtureDataset.lexemes[0];
    const question = buildRecognitionQuestion(target, fixtureDataset.lexemes);
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options.map((option) => option.label)).size).toBe(4);
    expect(question.options.filter((option) => option.senseId === question.correctSenseId)).toHaveLength(1);
    expect(question.options.every((option) => option.provenance.includes("·"))).toBe(true);
  });

  it("randomizes answer position reproducibly across attempts", () => {
    const target = fixtureDataset.lexemes[0];
    const positions = new Set(Array.from({ length: 12 }, (_, attempt) => buildRecognitionQuestion(target, fixtureDataset.lexemes, attempt).options.findIndex((option) => option.senseId.endsWith("sense-1") && option.lexemeId === target.id)));
    expect(positions.size).toBeGreaterThan(1);
    expect(buildRecognitionQuestion(target, fixtureDataset.lexemes, 3)).toEqual(buildRecognitionQuestion(target, fixtureDataset.lexemes, 3));
  });
});
