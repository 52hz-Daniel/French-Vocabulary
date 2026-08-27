export type VerificationState = "verified" | "auto_validated" | "needs_review" | "unknown";
export type EnrichmentStatus = "RAW" | "ENRICHMENT_PENDING" | "NEEDS_REVIEW" | "STUDY_READY";

export interface Source {
  id: string;
  kind: "exam" | "curriculum" | "dictionary" | "corpus" | "manual";
  label: string;
  uri?: string;
  version?: string;
  license?: string;
}

export interface Evidence {
  sourceType: "exam" | "curriculum" | "manual_review" | "dictionary" | "linguistic_adapter";
  sourceLabel: string;
  verification: VerificationState;
  confidence: number;
  sourceId?: string;
  location?: { document?: string; page?: number; paragraph?: number; section?: string };
  retrievedAt?: string;
}

export interface Sense {
  id: string;
  partOfSpeech: string;
  chineseGloss: string;
  synonyms: string[];
  evidence: Evidence;
  definitionFr?: string;
  definitionZh?: string;
}

export interface Occurrence {
  id: string;
  surfaceForm: string;
  sentence: string;
  sourceText?: string;
  sentenceTranslation?: string;
  sourceDocument: string;
  sourceReference: string;
  lemma: string;
  partOfSpeech: string;
  morphology?: string;
  evidence: Evidence;
  sentenceTranslationId?: string;
  morphologyAnalysisId?: string;
}

export interface SentenceTranslation {
  id: string;
  sentenceFr: string;
  sentenceZh: string;
  provider: string;
  modelVersion?: string;
  status: "source_provided" | "translated" | "needs_review";
  translatedAt?: string;
  sourceId?: string;
}

export interface MorphologyAnalysis {
  id: string;
  surface: string;
  lemma: string;
  partOfSpeech?: string;
  number?: string;
  mood?: string;
  tense?: string;
  person?: string;
  gender?: string;
  ambiguous?: boolean;
  paradigmId?: string;
}

export interface ConjugationForm {
  form: string;
  mood?: string;
  tense?: string;
  person?: string;
  number?: string;
  gender?: string;
}

export interface ConjugationParadigm {
  id: string;
  lemma: string;
  partOfSpeech: string;
  forms: ConjugationForm[];
  sourceId?: string;
  version?: string;
}

export interface Lexeme {
  id: string;
  lemma: string;
  ipa?: string;
  partOfSpeech: string;
  senses: Sense[];
  occurrences: Occurrence[];
  priority: number;
  collectionIds: string[];
  morphologyAnalyses?: MorphologyAnalysis[];
  conjugations?: MorphologyAnalysis[];
  definitionFr?: string;
  definitionZh?: string;
}

export interface LearningEntry {
  id: string;
  sourceId: string;
  lexemeId: string;
  senseId: string;
  preferredOccurrenceId: string;
  sentenceTranslationId: string;
  status: EnrichmentStatus;
  priority: number;
  collectionIds: string[];
  reviewReasons?: string[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  kind: "exam" | "curriculum";
  itemCount: number;
  available: boolean;
}

export interface Dataset {
  schemaVersion?: 1 | 2;
  collections: Collection[];
  lexemes: Lexeme[];
  sources?: Source[];
  senses?: Sense[];
  occurrences?: Occurrence[];
  sentenceTranslations?: SentenceTranslation[];
  morphologyAnalyses?: MorphologyAnalysis[];
  conjugationParadigms?: ConjugationParadigm[];
  learningEntries?: LearningEntry[];
  generatedAt?: string;
  sourceMode: "private" | "fixture";
}

export interface QuestionOption {
  senseId: string;
  lexemeId: string;
  label: string;
  provenance: string;
}

export interface RecognitionQuestion {
  id: string;
  mode: "WORD_RECOGNITION";
  targetLexemeId: string;
  correctSenseId: string;
  options: QuestionOption[];
  seed: number;
}
