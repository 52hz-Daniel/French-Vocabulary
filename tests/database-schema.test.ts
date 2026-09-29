import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initial = readFileSync("db/migrations/0000_initial_postgres.sql", "utf8");
const readiness = readFileSync("db/migrations/0003_readiness_guard.sql", "utf8");
const reviewerConstraints = readFileSync("db/migrations/0004_fuzzy_nighthawk.sql", "utf8");
const ingestionEvidenceCleanup = readFileSync("db/migrations/0007_ingestion_evidence_cleanup.sql", "utf8");

describe("PostgreSQL migration contract", () => {
  it("enables required extensions and search indexes", () => {
    expect(initial).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(initial).toContain("CREATE EXTENSION IF NOT EXISTS unaccent");
    expect(initial).toContain("lexemes_normalized_trgm_idx");
    expect(initial).toContain("forms_normalized_trgm_idx");
    expect(initial).toContain("senses_definition_fr_fts_idx");
  });

  it("enables RLS for every user-owned table", () => {
    for (const table of ["app_users", "study_sessions", "review_questions", "review_question_options", "encounter_events", "review_cards", "user_bookmarks", "user_daily_metrics"]) {
      expect(initial).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(initial).toContain(`CREATE POLICY "${table.replace(/^review_question_options$/, "review_question_options").replace(/^review_questions$/, "review_questions").replace(/^encounter_events$/, "encounter_events").replace(/^review_cards$/, "review_cards").replace(/^study_sessions$/, "study_sessions").replace(/^user_bookmarks$/, "user_bookmarks").replace(/^user_daily_metrics$/, "user_daily_metrics").replace(/^app_users$/, "app_users")}_self"`);
    }
  });

  it("has event, due-queue, idempotency, and review constraints", () => {
    expect(initial).toContain("encounter_events_user_idempotency_uidx");
    expect(reviewerConstraints).toContain("encounter_events_one_answer_per_question_uidx");
    expect(initial).toContain("encounter_events_occurred_brin_idx");
    expect(initial).toContain("review_cards_due_idx");
    expect(initial).toContain("content_review_tasks_one_target_check");
    expect(readiness).toContain("study_items_readiness_guard");
    expect(readiness).toContain("missing reviewed mandatory content");
    expect(reviewerConstraints).toContain("senses_reviewed_by_app_users_id_fk");
    expect(reviewerConstraints).toContain("content_review_tasks_assigned_to_app_users_id_fk");
  });

  it("lets the ingestion role replace stale evidence idempotently", () => {
    expect(ingestionEvidenceCleanup).toContain('GRANT DELETE ON "sense_evidence" TO tcf_ingest');
  });
});
