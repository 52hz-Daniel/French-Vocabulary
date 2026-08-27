import type { Dataset, LearningEntry, Lexeme, SentenceTranslation } from "./types";

export interface StudyReadyResult {
  ready: boolean;
  reasons: string[];
}

export function validateStudyReady(entry: LearningEntry, dataset: Dataset): StudyReadyResult {
  const reasons: string[] = [];
  const lexeme = dataset.lexemes.find((item) => item.id === entry.lexemeId);
  const sense = dataset.senses?.find((item) => item.id === entry.senseId) ?? lexeme?.senses.find((item) => item.id === entry.senseId);
  const occurrence = dataset.occurrences?.find((item) => item.id === entry.preferredOccurrenceId) ?? lexeme?.occurrences.find((item) => item.id === entry.preferredOccurrenceId);
  const translation = dataset.sentenceTranslations?.find((item) => item.id === entry.sentenceTranslationId);

  if (!lexeme?.lemma) reasons.push("lemma");
  if (!lexeme?.partOfSpeech) reasons.push("part_of_speech");
  if (!sense?.definitionFr) reasons.push("definition_fr");
  if (!sense?.definitionZh) reasons.push("definition_zh");
  if (!occurrence?.sentence) reasons.push("preferred_example_sentence_fr");
  if (!translation?.sentenceZh || translation.status === "needs_review") reasons.push("preferred_example_sentence_zh");
  if (!entry.sourceId || !dataset.sources?.some((source) => source.id === entry.sourceId)) reasons.push("source_provenance");
  if (occurrence && occurrence.surfaceForm !== lexeme?.lemma && !occurrence.morphologyAnalysisId) reasons.push("resolved_morphology");

  return { ready: entry.status === "STUDY_READY" && reasons.length === 0, reasons };
}

export function getStudyReadyEntries(dataset: Dataset): LearningEntry[] {
  return (dataset.learningEntries ?? []).filter((entry) => validateStudyReady(entry, dataset).ready);
}

export function getEntryReadiness(entry: LearningEntry, dataset: Dataset): { status: LearningEntry["status"]; reasons: string[] } {
  const result = validateStudyReady(entry, dataset);
  return { status: result.ready ? "STUDY_READY" : entry.status, reasons: result.reasons };
}

export function assembleLearningEntry(entry: LearningEntry, dataset: Dataset) {
  const lexeme = dataset.lexemes.find((item) => item.id === entry.lexemeId);
  const sense = dataset.senses?.find((item) => item.id === entry.senseId) ?? lexeme?.senses.find((item) => item.id === entry.senseId);
  const occurrence = dataset.occurrences?.find((item) => item.id === entry.preferredOccurrenceId) ?? lexeme?.occurrences.find((item) => item.id === entry.preferredOccurrenceId);
  const translation = dataset.sentenceTranslations?.find((item) => item.id === entry.sentenceTranslationId);
  if (!lexeme || !sense || !occurrence || !translation) throw new Error(`Learning entry ${entry.id} references missing data`);
  return {
    id: entry.id,
    word: occurrence.surfaceForm,
    lemma: lexeme.lemma,
    partOfSpeech: lexeme.partOfSpeech,
    meaningFrench: sense.definitionFr,
    meaningChinese: sense.definitionZh ?? sense.chineseGloss,
    exampleFrench: occurrence.sentence,
    exampleChinese: translation.sentenceZh,
    morphology: occurrence.morphologyAnalysisId ? dataset.morphologyAnalyses?.find((item) => item.id === occurrence.morphologyAnalysisId) : undefined,
    conjugationParadigm: lexeme.conjugations,
    source: occurrence.sourceReference,
    audio: { word: occurrence.surfaceForm, sentence: occurrence.sentence },
  };
}

export function assembleLegacyLearningEntry(lexeme: Lexeme, dataset: Dataset): LearningEntry {
  const sense = lexeme.senses[0];
  const occurrence = lexeme.occurrences[0];
  const sourceId = occurrence.evidence.sourceId ?? `legacy:${occurrence.sourceDocument}`;
  const translation: SentenceTranslation = {
    id: `legacy-translation:${occurrence.id}`,
    sentenceFr: occurrence.sentence,
    sentenceZh: occurrence.sentenceTranslation ?? "",
    provider: occurrence.sentenceTranslation ? "source" : "pending",
    status: occurrence.sentenceTranslation ? "source_provided" : "needs_review",
    sourceId,
  };
  return {
    id: `legacy-entry:${lexeme.id}`,
    sourceId,
    lexemeId: lexeme.id,
    senseId: sense?.id ?? "",
    preferredOccurrenceId: occurrence?.id ?? "",
    sentenceTranslationId: translation.id,
    status: "ENRICHMENT_PENDING",
    priority: lexeme.priority,
    collectionIds: lexeme.collectionIds,
  };
}