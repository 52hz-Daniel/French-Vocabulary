import { sql } from "drizzle-orm";
import { bigserial, boolean, check, date, doublePrecision, foreignKey, index, integer, jsonb, pgTable, primaryKey, real, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  language: text("language").notNull().default("fr"),
  license: text("license"),
  uri: text("uri"),
  checksum: text("checksum"),
  status: text("status").notNull().default("active"),
  metadata: jsonb("metadata").notNull().default({}),
  ...auditColumns,
}, (table) => [check("sources_kind_check", sql`${table.kind} IN ('exam','curriculum','dictionary','corpus','manual')`)]);

export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  externalKey: text("external_key").notNull(),
  title: text("title").notNull(),
  unit: text("unit"),
  pageCount: integer("page_count"),
  checksum: text("checksum"),
  metadata: jsonb("metadata").notNull().default({}),
  ...auditColumns,
}, (table) => [uniqueIndex("source_documents_source_key_uidx").on(table.sourceId, table.externalKey), index("source_documents_source_idx").on(table.sourceId)]);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull(),
  available: boolean("available").notNull().default(false),
  ...auditColumns,
}, (table) => [check("collections_kind_check", sql`${table.kind} IN ('exam','curriculum')`)]);

export const collectionSources = pgTable("collection_sources", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "restrict" }),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
}, (table) => [primaryKey({ columns: [table.collectionId, table.sourceId] })]);

export const lexemes = pgTable("lexemes", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalKey: text("external_key").unique(),
  language: text("language").notNull().default("fr"),
  lemma: text("lemma").notNull(),
  normalizedLemma: text("normalized_lemma").notNull(),
  searchLemma: text("search_lemma").notNull(),
  isMultiword: boolean("is_multiword").notNull().default(false),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  ...auditColumns,
}, (table) => [uniqueIndex("lexemes_language_normalized_uidx").on(table.language, table.normalizedLemma), index("lexemes_search_trgm_idx").using("gin", table.searchLemma.asc().op("gin_trgm_ops"))]);

export const lexicalEntries = pgTable("lexical_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  lexemeId: uuid("lexeme_id").notNull().references(() => lexemes.id, { onDelete: "restrict" }),
  partOfSpeech: text("part_of_speech").notNull(),
  gender: text("gender"),
  ipa: text("ipa"),
  morphalouLemmaId: text("morphalou_lemma_id"),
  verificationStatus: text("verification_status").notNull().default("unknown"),
  ...auditColumns,
}, (table) => [index("lexical_entries_lexeme_idx").on(table.lexemeId), uniqueIndex("lexical_entries_identity_uidx").on(table.lexemeId, table.partOfSpeech, sql`coalesce(${table.gender}, '')`), check("lexical_entries_verification_check", sql`${table.verificationStatus} IN ('verified','auto_validated','needs_review','unknown')`)]);

export const senses = pgTable("senses", {
  id: uuid("id").primaryKey().defaultRandom(),
  lexicalEntryId: uuid("lexical_entry_id").notNull().references(() => lexicalEntries.id, { onDelete: "restrict" }),
  senseNumber: smallint("sense_number").notNull().default(1),
  definitionFr: text("definition_fr"),
  definitionZh: text("definition_zh"),
  shortGlossZh: text("short_gloss_zh"),
  verificationStatus: text("verification_status").notNull().default("unknown"),
  confidence: real("confidence").notNull().default(0),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...auditColumns,
}, (table) => [uniqueIndex("senses_entry_number_uidx").on(table.lexicalEntryId, table.senseNumber), index("senses_entry_idx").on(table.lexicalEntryId), index("senses_gloss_trgm_idx").using("gin", table.shortGlossZh.asc().op("gin_trgm_ops")), index("senses_definition_fr_fts_idx").using("gin", sql`to_tsvector('french', coalesce(${table.definitionFr}, ''))`), foreignKey({ columns: [table.reviewedBy], foreignColumns: [appUsers.id], name: "senses_reviewed_by_app_users_id_fk" }).onDelete("restrict"), check("senses_confidence_check", sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`), check("senses_verification_check", sql`${table.verificationStatus} IN ('verified','auto_validated','needs_review','unknown')`)]);

export const senseRelations = pgTable("sense_relations", {
  sourceSenseId: uuid("source_sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }),
  targetSenseId: uuid("target_sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }),
  relationKind: text("relation_kind").notNull(),
  verificationStatus: text("verification_status").notNull().default("unknown"),
}, (table) => [primaryKey({ columns: [table.sourceSenseId, table.targetSenseId, table.relationKind] }), check("sense_relations_not_self_check", sql`${table.sourceSenseId} <> ${table.targetSenseId}`)]);

export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  lexicalEntryId: uuid("lexical_entry_id").notNull().references(() => lexicalEntries.id, { onDelete: "restrict" }),
  externalKey: text("external_key").notNull(),
  surface: text("surface").notNull(),
  normalizedSurface: text("normalized_surface").notNull(),
  formKind: text("form_kind").notNull().default("inflection"),
  number: text("number"),
  gender: text("gender"),
  mood: text("mood"),
  tense: text("tense"),
  person: text("person"),
  ipa: text("ipa"),
  morphalouInflectionId: text("morphalou_inflection_id"),
  features: jsonb("features").notNull().default({}),
  ...auditColumns,
}, (table) => [uniqueIndex("forms_entry_external_key_uidx").on(table.lexicalEntryId, table.externalKey), index("forms_entry_idx").on(table.lexicalEntryId), index("forms_normalized_idx").on(table.normalizedSurface), index("forms_normalized_trgm_idx").using("gin", table.normalizedSurface.asc().op("gin_trgm_ops"))]);

export const occurrences = pgTable("occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalKey: text("external_key").notNull(),
  lexicalEntryId: uuid("lexical_entry_id").notNull().references(() => lexicalEntries.id, { onDelete: "restrict" }),
  senseId: uuid("sense_id").references(() => senses.id, { onDelete: "restrict" }),
  formId: uuid("form_id").references(() => forms.id, { onDelete: "restrict" }),
  sourceDocumentId: uuid("source_document_id").notNull().references(() => sourceDocuments.id, { onDelete: "restrict" }),
  page: integer("page"),
  unit: text("unit"),
  paragraph: integer("paragraph"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  sentenceFr: text("sentence_fr").notNull(),
  sourceText: text("source_text"),
  sourceReference: text("source_reference").notNull(),
  sourceChecksum: text("source_checksum"),
  verificationStatus: text("verification_status").notNull().default("unknown"),
  confidence: real("confidence").notNull().default(0),
  ...auditColumns,
}, (table) => [uniqueIndex("occurrences_external_key_uidx").on(table.externalKey), index("occurrences_entry_idx").on(table.lexicalEntryId), index("occurrences_sense_idx").on(table.senseId), index("occurrences_document_location_idx").on(table.sourceDocumentId, table.page, table.paragraph), check("occurrences_offsets_check", sql`(${table.startOffset} IS NULL AND ${table.endOffset} IS NULL) OR (${table.startOffset} >= 0 AND ${table.endOffset} >= ${table.startOffset})`)]);

export const occurrenceTranslations = pgTable("occurrence_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurrenceId: uuid("occurrence_id").notNull().references(() => occurrences.id, { onDelete: "restrict" }),
  language: text("language").notNull().default("zh"),
  text: text("text").notNull(),
  providerKind: text("provider_kind").notNull(),
  providerName: text("provider_name").notNull(),
  modelVersion: text("model_version"),
  status: text("status").notNull(),
  contentHash: text("content_hash").notNull(),
  isPreferred: boolean("is_preferred").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...auditColumns,
}, (table) => [index("occurrence_translations_occurrence_idx").on(table.occurrenceId), uniqueIndex("occurrence_translations_content_uidx").on(table.occurrenceId, table.language, table.contentHash), uniqueIndex("occurrence_translations_preferred_uidx").on(table.occurrenceId, table.language).where(sql`${table.isPreferred} = true`), check("occurrence_translations_status_check", sql`${table.status} IN ('source_provided','translated','needs_review','rejected')`)]);

export const studyItems = pgTable("study_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "restrict" }),
  senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }),
  preferredOccurrenceId: uuid("preferred_occurrence_id").notNull().references(() => occurrences.id, { onDelete: "restrict" }),
  preferredTranslationId: uuid("preferred_translation_id").references(() => occurrenceTranslations.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("RAW"),
  priority: integer("priority").notNull().default(0),
  sourceFrequency: integer("source_frequency").notNull().default(0),
  targetLevel: text("target_level"),
  studyRole: text("study_role").notNull().default("active"),
  qualityScore: real("quality_score").notNull().default(0),
  ...auditColumns,
}, (table) => [uniqueIndex("study_items_collection_sense_uidx").on(table.collectionId, table.senseId), index("study_items_collection_status_priority_idx").on(table.collectionId, table.status, table.priority), check("study_items_status_check", sql`${table.status} IN ('RAW','ENRICHMENT_PENDING','NEEDS_REVIEW','STUDY_READY')`), check("study_items_role_check", sql`${table.studyRole} IN ('active','passive')`)]);

export const tags = pgTable("tags", { id: uuid("id").primaryKey().defaultRandom(), kind: text("kind").notNull(), slug: text("slug").notNull(), label: text("label").notNull() }, (table) => [uniqueIndex("tags_kind_slug_uidx").on(table.kind, table.slug)]);
export const senseTags = pgTable("sense_tags", { senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }), tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }) }, (table) => [primaryKey({ columns: [table.senseId, table.tagId] })]);

export const senseEvidence = pgTable("sense_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  citation: text("citation"),
  verificationStatus: text("verification_status").notNull(),
  confidence: real("confidence").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sense_evidence_sense_idx").on(table.senseId)]);

export const studyItemIssues = pgTable("study_item_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  studyItemId: uuid("study_item_id").notNull().references(() => studyItems.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  severity: text("severity").notNull().default("error"),
  details: jsonb("details").notNull().default({}),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("study_item_issues_open_uidx").on(table.studyItemId, table.code).where(sql`${table.resolvedAt} IS NULL`), index("study_item_issues_item_idx").on(table.studyItemId)]);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(), sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }), sourceChecksum: text("source_checksum").notNull(), toolVersion: text("tool_version").notNull(), configuration: jsonb("configuration").notNull().default({}), counts: jsonb("counts").notNull().default({}), status: text("status").notNull(), startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), finishedAt: timestamp("finished_at", { withTimezone: true }), error: text("error")
}, (table) => [uniqueIndex("ingestion_runs_source_checksum_tool_uidx").on(table.sourceId, table.sourceChecksum, table.toolVersion)]);

export const enrichmentJobs = pgTable("enrichment_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), targetType: text("target_type").notNull(), targetId: uuid("target_id").notNull(), field: text("field").notNull(), provider: text("provider").notNull(), model: text("model"), inputHash: text("input_hash").notNull(), status: text("status").notNull().default("queued"), attempts: integer("attempts").notNull().default(0), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(), output: jsonb("output"), error: text("error"), ...auditColumns
}, (table) => [uniqueIndex("enrichment_jobs_target_field_input_uidx").on(table.targetType, table.targetId, table.field, table.inputHash), index("enrichment_jobs_claim_idx").on(table.status, table.nextAttemptAt)]);

export const contentReviewTasks = pgTable("content_review_tasks", {
  id: uuid("id").primaryKey().defaultRandom(), senseId: uuid("sense_id").references(() => senses.id, { onDelete: "restrict" }), occurrenceId: uuid("occurrence_id").references(() => occurrences.id, { onDelete: "restrict" }), studyItemId: uuid("study_item_id").references(() => studyItems.id, { onDelete: "restrict" }), field: text("field").notNull(), status: text("status").notNull().default("open"), proposedValue: jsonb("proposed_value"), evidence: jsonb("evidence").notNull().default({}), assignedTo: uuid("assigned_to"), resolvedAt: timestamp("resolved_at", { withTimezone: true }), ...auditColumns
}, (table) => [check("content_review_tasks_one_target_check", sql`num_nonnulls(${table.senseId}, ${table.occurrenceId}, ${table.studyItemId}) = 1`), foreignKey({ columns: [table.assignedTo], foreignColumns: [appUsers.id], name: "content_review_tasks_assigned_to_app_users_id_fk" }).onDelete("restrict"), index("content_review_tasks_status_idx").on(table.status, table.createdAt)]);

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(), authSubject: text("auth_subject").unique(), email: text("email"), timezone: text("timezone").notNull().default("UTC"), desiredRetention: real("desired_retention").notNull().default(0.9), preferences: jsonb("preferences").notNull().default({}), ...auditColumns
}, (table) => [check("app_users_retention_check", sql`${table.desiredRetention} >= 0.7 AND ${table.desiredRetention} <= 0.99`)]);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "restrict" }), mode: text("mode").notNull(), schedulerVersion: text("scheduler_version").notNull(), startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), completedAt: timestamp("completed_at", { withTimezone: true })
}, (table) => [index("study_sessions_user_started_idx").on(table.userId, table.startedAt)]);

export const reviewQuestions = pgTable("review_questions", {
  id: uuid("id").primaryKey().defaultRandom(), sessionId: uuid("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }), studyItemId: uuid("study_item_id").notNull().references(() => studyItems.id, { onDelete: "restrict" }), promptOccurrenceId: uuid("prompt_occurrence_id").references(() => occurrences.id, { onDelete: "restrict" }), correctSenseId: uuid("correct_sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }), mode: text("mode").notNull(), seed: integer("seed").notNull(), shownAt: timestamp("shown_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("review_questions_session_idx").on(table.sessionId)]);

export const reviewQuestionOptions = pgTable("review_question_options", { questionId: uuid("question_id").notNull().references(() => reviewQuestions.id, { onDelete: "cascade" }), position: smallint("position").notNull(), senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "restrict" }) }, (table) => [primaryKey({ columns: [table.questionId, table.position] }), uniqueIndex("review_question_options_unique_sense_uidx").on(table.questionId, table.senseId)]);

export const encounterEvents = pgTable("encounter_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(), idempotencyKey: uuid("idempotency_key").notNull(), userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "cascade" }), studyItemId: uuid("study_item_id").notNull().references(() => studyItems.id, { onDelete: "restrict" }), questionId: uuid("question_id").references(() => reviewQuestions.id, { onDelete: "restrict" }), occurrenceId: uuid("occurrence_id").references(() => occurrences.id, { onDelete: "restrict" }), eventType: text("event_type").notNull(), mode: text("mode"), answerSenseId: uuid("answer_sense_id").references(() => senses.id, { onDelete: "restrict" }), correct: boolean("correct"), responseMs: integer("response_ms"), rating: smallint("rating"), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(), payload: jsonb("payload").notNull().default({})
}, (table) => [uniqueIndex("encounter_events_user_idempotency_uidx").on(table.userId, table.idempotencyKey), uniqueIndex("encounter_events_one_answer_per_question_uidx").on(table.userId, table.questionId).where(sql`${table.eventType} = 'review_answer'`), index("encounter_events_user_time_idx").on(table.userId, table.occurredAt), index("encounter_events_user_item_time_idx").on(table.userId, table.studyItemId, table.occurredAt), index("encounter_events_occurred_brin_idx").using("brin", table.occurredAt), check("encounter_events_response_ms_check", sql`${table.responseMs} IS NULL OR ${table.responseMs} >= 0`), check("encounter_events_rating_check", sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 1 AND 4`)]);

export const reviewCards = pgTable("review_cards", {
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), studyItemId: uuid("study_item_id").notNull().references(() => studyItems.id, { onDelete: "restrict" }), dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(), stability: doublePrecision("stability").notNull().default(0), difficulty: doublePrecision("difficulty").notNull().default(0), elapsedDays: integer("elapsed_days").notNull().default(0), scheduledDays: integer("scheduled_days").notNull().default(0), learningSteps: integer("learning_steps").notNull().default(0), repetitions: integer("repetitions").notNull().default(0), lapses: integer("lapses").notNull().default(0), state: text("state").notNull().default("new"), schedulerVersion: text("scheduler_version").notNull(), lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }), ...auditColumns
}, (table) => [primaryKey({ columns: [table.userId, table.studyItemId] }), index("review_cards_due_idx").on(table.userId, table.dueAt).where(sql`${table.state} <> 'suspended'`)]);

export const userBookmarks = pgTable("user_bookmarks", { userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), studyItemId: uuid("study_item_id").notNull().references(() => studyItems.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() }, (table) => [primaryKey({ columns: [table.userId, table.studyItemId] })]);

export const userDailyMetrics = pgTable("user_daily_metrics", {
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), day: date("day").notNull(), encounters: integer("encounters").notNull().default(0), reviews: integer("reviews").notNull().default(0), correct: integer("correct").notNull().default(0), incorrect: integer("incorrect").notNull().default(0), studySeconds: integer("study_seconds").notNull().default(0), newItems: integer("new_items").notNull().default(0), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.userId, table.day] })]);

export const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
