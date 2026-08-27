import type { Lexeme, QuestionOption, RecognitionQuestion, Sense } from "./types";

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function shuffled<T>(values: T[], seed: number): T[] {
  const result = [...values];
  let state = seed || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function conflicts(candidate: Sense, target: Sense): boolean {
  const candidateTerms = new Set([candidate.chineseGloss, ...candidate.synonyms].map((x) => x.trim().toLowerCase()));
  const targetTerms = [target.chineseGloss, ...target.synonyms].map((x) => x.trim().toLowerCase());
  return targetTerms.some((term) => candidateTerms.has(term));
}

export function buildRecognitionQuestion(target: Lexeme, pool: Lexeme[], attempt = 0): RecognitionQuestion {
  const correct = target.senses[0];
  if (!correct) throw new Error(`Lexeme ${target.id} has no verified sense`);
  const candidates = pool
    .filter((item) => item.id !== target.id)
    .flatMap((item) => item.senses.map((sense) => ({ item, sense })))
    .filter(({ sense }) => sense.evidence.verification === "verified" && !conflicts(sense, correct))
    .sort((a, b) => {
      const aPos = a.sense.partOfSpeech === correct.partOfSpeech ? 0 : 1;
      const bPos = b.sense.partOfSpeech === correct.partOfSpeech ? 0 : 1;
      return aPos - bPos || Math.abs(a.item.priority - target.priority) - Math.abs(b.item.priority - target.priority);
    });

  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) unique.set(candidate.sense.chineseGloss.trim(), candidate);
  const distractors = [...unique.values()].slice(0, 3);
  if (distractors.length < 3) throw new Error("At least three distinct verified distractors are required");

  const option = (lexemeId: string, sense: Sense): QuestionOption => ({
    senseId: sense.id,
    lexemeId,
    label: sense.chineseGloss,
    provenance: `${sense.evidence.sourceLabel} · ${sense.partOfSpeech}`,
  });
  const seed = hash(`${target.id}:${attempt}`);
  return {
    id: `${target.id}:${attempt}`,
    mode: "WORD_RECOGNITION",
    targetLexemeId: target.id,
    correctSenseId: correct.id,
    options: shuffled([option(target.id, correct), ...distractors.map(({ item, sense }) => option(item.id, sense))], seed),
    seed,
  };
}
