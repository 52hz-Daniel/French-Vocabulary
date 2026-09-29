CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text,
	"email" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"desired_retention" real DEFAULT 0.9 NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_auth_subject_unique" UNIQUE("auth_subject"),
	CONSTRAINT "app_users_retention_check" CHECK ("app_users"."desired_retention" >= 0.7 AND "app_users"."desired_retention" <= 0.99)
);
--> statement-breakpoint
CREATE TABLE "collection_sources" (
	"collection_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "collection_sources_collection_id_source_id_pk" PRIMARY KEY("collection_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"available" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug"),
	CONSTRAINT "collections_kind_check" CHECK ("collections"."kind" IN ('exam','curriculum'))
);
--> statement-breakpoint
CREATE TABLE "content_review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sense_id" uuid,
	"occurrence_id" uuid,
	"study_item_id" uuid,
	"field" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"proposed_value" jsonb,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_review_tasks_one_target_check" CHECK (num_nonnulls("content_review_tasks"."sense_id", "content_review_tasks"."occurrence_id", "content_review_tasks"."study_item_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "encounter_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"study_item_id" uuid NOT NULL,
	"question_id" uuid,
	"occurrence_id" uuid,
	"event_type" text NOT NULL,
	"mode" text,
	"answer_sense_id" uuid,
	"correct" boolean,
	"response_ms" integer,
	"rating" smallint,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "encounter_events_response_ms_check" CHECK ("encounter_events"."response_ms" IS NULL OR "encounter_events"."response_ms" >= 0),
	CONSTRAINT "encounter_events_rating_check" CHECK ("encounter_events"."rating" IS NULL OR "encounter_events"."rating" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "enrichment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"field" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"input_hash" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lexical_entry_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"normalized_surface" text NOT NULL,
	"form_kind" text DEFAULT 'inflection' NOT NULL,
	"number" text,
	"gender" text,
	"mood" text,
	"tense" text,
	"person" text,
	"ipa" text,
	"morphalou_inflection_id" text,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_checksum" text NOT NULL,
	"tool_version" text NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "lexemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"lemma" text NOT NULL,
	"normalized_lemma" text NOT NULL,
	"is_multiword" boolean DEFAULT false NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexical_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lexeme_id" uuid NOT NULL,
	"part_of_speech" text NOT NULL,
	"gender" text,
	"ipa" text,
	"morphalou_lemma_id" text,
	"verification_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lexical_entries_verification_check" CHECK ("lexical_entries"."verification_status" IN ('verified','auto_validated','needs_review','unknown'))
);
--> statement-breakpoint
CREATE TABLE "occurrence_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"language" text DEFAULT 'zh' NOT NULL,
	"text" text NOT NULL,
	"provider_kind" text NOT NULL,
	"provider_name" text NOT NULL,
	"model_version" text,
	"status" text NOT NULL,
	"content_hash" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_translations_status_check" CHECK ("occurrence_translations"."status" IN ('source_provided','translated','needs_review','rejected'))
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lexical_entry_id" uuid NOT NULL,
	"sense_id" uuid,
	"form_id" uuid,
	"source_document_id" uuid NOT NULL,
	"page" integer,
	"unit" text,
	"paragraph" integer,
	"start_offset" integer,
	"end_offset" integer,
	"sentence_fr" text NOT NULL,
	"source_text" text,
	"source_reference" text NOT NULL,
	"source_checksum" text,
	"verification_status" text DEFAULT 'unknown' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrences_offsets_check" CHECK (("occurrences"."start_offset" IS NULL AND "occurrences"."end_offset" IS NULL) OR ("occurrences"."start_offset" >= 0 AND "occurrences"."end_offset" >= "occurrences"."start_offset"))
);
--> statement-breakpoint
CREATE TABLE "review_cards" (
	"user_id" uuid NOT NULL,
	"study_item_id" uuid NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stability" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 0 NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"scheduler_version" text NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_cards_user_id_study_item_id_pk" PRIMARY KEY("user_id","study_item_id")
);
--> statement-breakpoint
CREATE TABLE "review_question_options" (
	"question_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"sense_id" uuid NOT NULL,
	CONSTRAINT "review_question_options_question_id_position_pk" PRIMARY KEY("question_id","position")
);
--> statement-breakpoint
CREATE TABLE "review_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"study_item_id" uuid NOT NULL,
	"prompt_occurrence_id" uuid,
	"correct_sense_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"seed" integer NOT NULL,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sense_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sense_id" uuid NOT NULL,
	"source_id" uuid,
	"provider" text NOT NULL,
	"citation" text,
	"verification_status" text NOT NULL,
	"confidence" real NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sense_relations" (
	"source_sense_id" uuid NOT NULL,
	"target_sense_id" uuid NOT NULL,
	"relation_kind" text NOT NULL,
	"verification_status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "sense_relations_source_sense_id_target_sense_id_relation_kind_pk" PRIMARY KEY("source_sense_id","target_sense_id","relation_kind"),
	CONSTRAINT "sense_relations_not_self_check" CHECK ("sense_relations"."source_sense_id" <> "sense_relations"."target_sense_id")
);
--> statement-breakpoint
CREATE TABLE "sense_tags" (
	"sense_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "sense_tags_sense_id_tag_id_pk" PRIMARY KEY("sense_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "senses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lexical_entry_id" uuid NOT NULL,
	"sense_number" smallint DEFAULT 1 NOT NULL,
	"definition_fr" text,
	"definition_zh" text,
	"short_gloss_zh" text,
	"verification_status" text DEFAULT 'unknown' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "senses_confidence_check" CHECK ("senses"."confidence" >= 0 AND "senses"."confidence" <= 1),
	CONSTRAINT "senses_verification_check" CHECK ("senses"."verification_status" IN ('verified','auto_validated','needs_review','unknown'))
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_key" text NOT NULL,
	"title" text NOT NULL,
	"unit" text,
	"page_count" integer,
	"checksum" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"license" text,
	"uri" text,
	"checksum" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sources_kind_check" CHECK ("sources"."kind" IN ('exam','curriculum','dictionary','corpus','manual'))
);
--> statement-breakpoint
CREATE TABLE "study_item_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_item_id" uuid NOT NULL,
	"code" text NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"sense_id" uuid NOT NULL,
	"preferred_occurrence_id" uuid NOT NULL,
	"preferred_translation_id" uuid,
	"status" text DEFAULT 'RAW' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"source_frequency" integer DEFAULT 0 NOT NULL,
	"target_level" text,
	"study_role" text DEFAULT 'active' NOT NULL,
	"quality_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_items_status_check" CHECK ("study_items"."status" IN ('RAW','ENRICHMENT_PENDING','NEEDS_REVIEW','STUDY_READY')),
	CONSTRAINT "study_items_role_check" CHECK ("study_items"."study_role" IN ('active','passive'))
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"collection_id" uuid,
	"mode" text NOT NULL,
	"scheduler_version" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"user_id" uuid NOT NULL,
	"study_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_bookmarks_user_id_study_item_id_pk" PRIMARY KEY("user_id","study_item_id")
);
--> statement-breakpoint
CREATE TABLE "user_daily_metrics" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"encounters" integer DEFAULT 0 NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"incorrect" integer DEFAULT 0 NOT NULL,
	"study_seconds" integer DEFAULT 0 NOT NULL,
	"new_items" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_daily_metrics_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "collection_sources" ADD CONSTRAINT "collection_sources_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_sources" ADD CONSTRAINT "collection_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_tasks" ADD CONSTRAINT "content_review_tasks_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_tasks" ADD CONSTRAINT "content_review_tasks_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_tasks" ADD CONSTRAINT "content_review_tasks_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_question_id_review_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."review_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter_events" ADD CONSTRAINT "encounter_events_answer_sense_id_senses_id_fk" FOREIGN KEY ("answer_sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_lexical_entry_id_lexical_entries_id_fk" FOREIGN KEY ("lexical_entry_id") REFERENCES "public"."lexical_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexical_entries" ADD CONSTRAINT "lexical_entries_lexeme_id_lexemes_id_fk" FOREIGN KEY ("lexeme_id") REFERENCES "public"."lexemes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence_translations" ADD CONSTRAINT "occurrence_translations_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_lexical_entry_id_lexical_entries_id_fk" FOREIGN KEY ("lexical_entry_id") REFERENCES "public"."lexical_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_question_options" ADD CONSTRAINT "review_question_options_question_id_review_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."review_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_question_options" ADD CONSTRAINT "review_question_options_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_prompt_occurrence_id_occurrences_id_fk" FOREIGN KEY ("prompt_occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_correct_sense_id_senses_id_fk" FOREIGN KEY ("correct_sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_evidence" ADD CONSTRAINT "sense_evidence_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_evidence" ADD CONSTRAINT "sense_evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_relations" ADD CONSTRAINT "sense_relations_source_sense_id_senses_id_fk" FOREIGN KEY ("source_sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_relations" ADD CONSTRAINT "sense_relations_target_sense_id_senses_id_fk" FOREIGN KEY ("target_sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_tags" ADD CONSTRAINT "sense_tags_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sense_tags" ADD CONSTRAINT "sense_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senses" ADD CONSTRAINT "senses_lexical_entry_id_lexical_entries_id_fk" FOREIGN KEY ("lexical_entry_id") REFERENCES "public"."lexical_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_item_issues" ADD CONSTRAINT "study_item_issues_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_preferred_occurrence_id_occurrences_id_fk" FOREIGN KEY ("preferred_occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_preferred_translation_id_occurrence_translations_id_fk" FOREIGN KEY ("preferred_translation_id") REFERENCES "public"."occurrence_translations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_study_item_id_study_items_id_fk" FOREIGN KEY ("study_item_id") REFERENCES "public"."study_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_daily_metrics" ADD CONSTRAINT "user_daily_metrics_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_review_tasks_status_idx" ON "content_review_tasks" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "encounter_events_user_idempotency_uidx" ON "encounter_events" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "encounter_events_user_time_idx" ON "encounter_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "encounter_events_user_item_time_idx" ON "encounter_events" USING btree ("user_id","study_item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "encounter_events_occurred_brin_idx" ON "encounter_events" USING brin ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_jobs_target_field_input_uidx" ON "enrichment_jobs" USING btree ("target_type","target_id","field","input_hash");--> statement-breakpoint
CREATE INDEX "enrichment_jobs_claim_idx" ON "enrichment_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "forms_entry_idx" ON "forms" USING btree ("lexical_entry_id");--> statement-breakpoint
CREATE INDEX "forms_normalized_idx" ON "forms" USING btree ("normalized_surface");--> statement-breakpoint
CREATE INDEX "forms_normalized_trgm_idx" ON "forms" USING gin ("normalized_surface" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_runs_source_checksum_tool_uidx" ON "ingestion_runs" USING btree ("source_id","source_checksum","tool_version");--> statement-breakpoint
CREATE UNIQUE INDEX "lexemes_language_normalized_uidx" ON "lexemes" USING btree ("language","normalized_lemma");--> statement-breakpoint
CREATE INDEX "lexemes_normalized_trgm_idx" ON "lexemes" USING gin ("normalized_lemma" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lexical_entries_lexeme_idx" ON "lexical_entries" USING btree ("lexeme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lexical_entries_identity_uidx" ON "lexical_entries" USING btree ("lexeme_id","part_of_speech",coalesce("gender", ''));--> statement-breakpoint
CREATE INDEX "occurrence_translations_occurrence_idx" ON "occurrence_translations" USING btree ("occurrence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_translations_content_uidx" ON "occurrence_translations" USING btree ("occurrence_id","language","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_translations_preferred_uidx" ON "occurrence_translations" USING btree ("occurrence_id","language") WHERE "occurrence_translations"."is_preferred" = true;--> statement-breakpoint
CREATE INDEX "occurrences_entry_idx" ON "occurrences" USING btree ("lexical_entry_id");--> statement-breakpoint
CREATE INDEX "occurrences_sense_idx" ON "occurrences" USING btree ("sense_id");--> statement-breakpoint
CREATE INDEX "occurrences_document_location_idx" ON "occurrences" USING btree ("source_document_id","page","paragraph");--> statement-breakpoint
CREATE INDEX "review_cards_due_idx" ON "review_cards" USING btree ("user_id","due_at") WHERE "review_cards"."state" <> 'suspended';--> statement-breakpoint
CREATE UNIQUE INDEX "review_question_options_unique_sense_uidx" ON "review_question_options" USING btree ("question_id","sense_id");--> statement-breakpoint
CREATE INDEX "review_questions_session_idx" ON "review_questions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sense_evidence_sense_idx" ON "sense_evidence" USING btree ("sense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "senses_entry_number_uidx" ON "senses" USING btree ("lexical_entry_id","sense_number");--> statement-breakpoint
CREATE INDEX "senses_entry_idx" ON "senses" USING btree ("lexical_entry_id");--> statement-breakpoint
CREATE INDEX "senses_gloss_trgm_idx" ON "senses" USING gin ("short_gloss_zh" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "senses_definition_fr_fts_idx" ON "senses" USING gin (to_tsvector('french', coalesce("definition_fr", '')));--> statement-breakpoint
CREATE UNIQUE INDEX "source_documents_source_key_uidx" ON "source_documents" USING btree ("source_id","external_key");--> statement-breakpoint
CREATE INDEX "source_documents_source_idx" ON "source_documents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_item_issues_open_uidx" ON "study_item_issues" USING btree ("study_item_id","code") WHERE "study_item_issues"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "study_item_issues_item_idx" ON "study_item_issues" USING btree ("study_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_items_collection_sense_uidx" ON "study_items" USING btree ("collection_id","sense_id");--> statement-breakpoint
CREATE INDEX "study_items_collection_status_priority_idx" ON "study_items" USING btree ("collection_id","status","priority");--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_kind_slug_uidx" ON "tags" USING btree ("kind","slug");
--> statement-breakpoint
INSERT INTO "app_users" ("id", "auth_subject", "email", "timezone")
VALUES ('00000000-0000-4000-8000-000000000001', 'development-user', 'local@tcf.invalid', 'America/Toronto')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounter_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_bookmarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_daily_metrics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "app_users_self" ON "app_users" USING ("id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("id" = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY "study_sessions_self" ON "study_sessions" USING ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY "review_questions_self" ON "review_questions" USING (EXISTS (SELECT 1 FROM "study_sessions" s WHERE s."id" = "review_questions"."session_id" AND s."user_id" = nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK (EXISTS (SELECT 1 FROM "study_sessions" s WHERE s."id" = "review_questions"."session_id" AND s."user_id" = nullif(current_setting('app.user_id', true), '')::uuid));
CREATE POLICY "review_question_options_self" ON "review_question_options" USING (EXISTS (SELECT 1 FROM "review_questions" q JOIN "study_sessions" s ON s."id" = q."session_id" WHERE q."id" = "review_question_options"."question_id" AND s."user_id" = nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK (EXISTS (SELECT 1 FROM "review_questions" q JOIN "study_sessions" s ON s."id" = q."session_id" WHERE q."id" = "review_question_options"."question_id" AND s."user_id" = nullif(current_setting('app.user_id', true), '')::uuid));
CREATE POLICY "encounter_events_self" ON "encounter_events" USING ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY "review_cards_self" ON "review_cards" USING ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY "user_bookmarks_self" ON "user_bookmarks" USING ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY "user_daily_metrics_self" ON "user_daily_metrics" USING ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("user_id" = nullif(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT ON "sources", "source_documents", "collections", "collection_sources", "lexemes", "lexical_entries", "senses", "sense_relations", "forms", "occurrences", "occurrence_translations", "study_items", "tags", "sense_tags", "sense_evidence" TO tcf_app;
GRANT SELECT ON "app_users", "study_sessions", "review_questions", "review_question_options", "encounter_events", "review_cards", "user_bookmarks", "user_daily_metrics" TO tcf_app;
GRANT INSERT, UPDATE ON "app_users", "study_sessions", "review_questions", "review_question_options", "review_cards", "user_bookmarks", "user_daily_metrics" TO tcf_app;
GRANT DELETE ON "user_bookmarks" TO tcf_app;
GRANT INSERT ON "encounter_events" TO tcf_app;
GRANT USAGE, SELECT ON SEQUENCE "encounter_events_id_seq" TO tcf_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO tcf_ingest;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tcf_ingest;
