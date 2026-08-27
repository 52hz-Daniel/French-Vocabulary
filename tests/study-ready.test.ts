import { describe, expect, it } from "vitest";
import { fixtureDataset } from "@/data/fixture";
import { assembleLegacyLearningEntry, validateStudyReady } from "@/domain/study-ready";
import type { Dataset } from "@/domain/types";

function readyDataset(): Dataset {
  const lexeme = fixtureDataset.lexemes[0];
  const occurrence = lexeme.occurrences[0];
  const sense = lexeme.senses[0];
  const sourceId = "fixture-source";
  const translationId = "fixture-translation";
  return {
    ...fixtureDataset,
    schemaVersion: 2,
    sources: [{ id: sourceId, kind: "curriculum", label: "Fixture source" }],
    senses: [{ ...sense, definitionFr: "Préparer quelque chose.", definitionZh: sense.chineseGloss }],
    occurrences: [{ ...occurrence, evidence: { ...occurrence.evidence, sourceId }, sentenceTranslationId: translationId }],
    sentenceTranslations: [{ id: translationId, sentenceFr: occurrence.sentence, sentenceZh: "为明天准备一个重要项目。", provider: "fixture", status: "translated", sourceId }],
    learningEntries: [{ id: "fixture-entry", sourceId, lexemeId: lexeme.id, senseId: sense.id, preferredOccurrenceId: occurrence.id, sentenceTranslationId: translationId, status: "STUDY_READY", priority: lexeme.priority, collectionIds: lexeme.collectionIds }],
  };
}

describe("study-ready invariant", () => {
  it("accepts a complete persisted learning entry", () => {
    const dataset = readyDataset();
    expect(validateStudyReady(dataset.learningEntries![0], dataset)).toEqual({ ready: true, reasons: [] });
  });

  it("assembles the learner-facing shape from normalized entities", async () => {
    const dataset = readyDataset();
    const { assembleLearningEntry } = await import("@/domain/study-ready");
    expect(assembleLearningEntry(dataset.learningEntries![0], dataset)).toMatchObject({ word: "préparer", exampleChinese: "为明天准备一个重要项目。" });
  });

  it("reports missing fields and rejects legacy partial records", () => {
    const lexeme = fixtureDataset.lexemes[0];
    const entry = assembleLegacyLearningEntry(lexeme, fixtureDataset);
    const result = validateStudyReady(entry, fixtureDataset);
    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(["definition_fr", "definition_zh", "preferred_example_sentence_zh", "source_provenance"]));
  });
});
