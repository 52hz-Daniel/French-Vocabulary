import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Dataset, LearningEntry, Occurrence, Sense, SentenceTranslation, Source } from "@/domain/types";
import { assembleLegacyLearningEntry } from "@/domain/study-ready";
import { fixtureDataset } from "./fixture";

export async function loadDataset(): Promise<Dataset> {
  const privatePath = path.join(process.cwd(), "data-private", "generated", "items.json");
  try {
    const parsed = JSON.parse(await readFile(privatePath, "utf8")) as Dataset;
    return hydrateDataset({ ...parsed, sourceMode: "private" });
  } catch {
    return hydrateDataset(fixtureDataset);
  }
}

export function hydrateDataset(dataset: Dataset): Dataset {
  if (dataset.schemaVersion === 2 && dataset.learningEntries) return dataset;
  const sources: Source[] = [];
  const senses: Sense[] = [];
  const occurrences: Occurrence[] = [];
  const sentenceTranslations: SentenceTranslation[] = [];
  const learningEntries: LearningEntry[] = [];
  for (const lexeme of dataset.lexemes) {
    for (const sense of lexeme.senses) senses.push(sense);
    for (const occurrence of lexeme.occurrences) {
      const sourceId = occurrence.evidence.sourceId ?? `legacy:${occurrence.sourceDocument}`;
      if (!sources.some((source) => source.id === sourceId)) sources.push({ id: sourceId, kind: occurrence.evidence.sourceType === "exam" ? "exam" : "curriculum", label: occurrence.sourceDocument });
      occurrences.push({ ...occurrence, evidence: { ...occurrence.evidence, sourceId } });
      if (occurrence.sentenceTranslation) sentenceTranslations.push({ id: `legacy-translation:${occurrence.id}`, sentenceFr: occurrence.sentence, sentenceZh: occurrence.sentenceTranslation, provider: "source", status: "source_provided", sourceId });
    }
    learningEntries.push(assembleLegacyLearningEntry(lexeme, dataset));
  }
  return { ...dataset, schemaVersion: 2, sources, senses, occurrences, sentenceTranslations, learningEntries };
}
