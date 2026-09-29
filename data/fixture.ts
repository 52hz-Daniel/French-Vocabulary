 import type { Dataset, Lexeme } from "@/domain/types";

const fixtureWords: Array<[string, string, string, string]> = [
  ["préparer", "准备", "verb", "Je prépare un projet important pour demain."],
  ["choisir", "选择", "verb", "Nous devons choisir une solution adaptée."],
  ["expliquer", "解释", "verb", "Elle explique clairement son idée."],
  ["améliorer", "改善；提高", "verb", "La pratique régulière améliore la compréhension."],
  ["occasion", "机会；时机", "noun", "C'est une bonne occasion de pratiquer."],
  ["démarche", "步骤；做法", "noun", "Cette démarche demande de la patience."],
  ["objectif", "目标", "noun", "Son objectif est de mieux comprendre."],
  ["résultat", "结果", "noun", "Le résultat dépend du travail régulier."],
];

const lexemes: Lexeme[] = fixtureWords.map(([lemma, gloss, pos, sentence], index) => ({
  id: `fixture-${lemma}`,
  lemma,
  partOfSpeech: pos,
  priority: 50 - index,
  collectionIds: ["demo"],
  senses: [{
    id: `fixture-${lemma}-sense-1`,
    partOfSpeech: pos,
    chineseGloss: gloss,
    synonyms: [],
    evidence: { sourceType: "manual_review", sourceLabel: "Committed synthetic golden fixture", verification: "verified", confidence: 1 },
  }],
  occurrences: [{
    id: `fixture-${lemma}-occurrence-1`,
    surfaceForm: lemma,
    sentence,
    sourceText: sentence,
    sourceDocument: "synthetic-golden-fixture.json",
    sourceReference: `Fixture ${index + 1}`,
    lemma,
    partOfSpeech: pos,
    evidence: { sourceType: "manual_review", sourceLabel: "Synthetic non-exam sentence", verification: "verified", confidence: 1 },
  }],
}));

export const fixtureDataset: Dataset = {
  sourceMode: "fixture",
  collections: [
    { id: "demo", name: "Demo français", description: "Synthetic fallback data; no private files found.", kind: "curriculum", itemCount: lexemes.length, available: true },
    { id: "tcf-listening", name: "TCF Listening", description: "Private listening evidence", kind: "exam", itemCount: 0, available: false },
    { id: "tcf-reading", name: "TCF Reading", description: "Private reading evidence", kind: "exam", itemCount: 0, available: false },
    { id: "tcf-tef", name: "TCF + TEF Vocabulary", description: "Private vocabulary curriculum", kind: "curriculum", itemCount: 0, available: false },
    { id: "nihao-a1", name: "你好！法语 A1", description: "Foundation curriculum", kind: "curriculum", itemCount: 0, available: false },
    { id: "nihao-a2", name: "你好！法语 A2", description: "Foundation curriculum", kind: "curriculum", itemCount: 0, available: false },
    { id: "nihao-b1", name: "你好！法语 B1", description: "Foundation curriculum", kind: "curriculum", itemCount: 0, available: false },
  ],
  lexemes,
};
