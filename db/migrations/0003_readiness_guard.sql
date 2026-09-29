CREATE OR REPLACE FUNCTION enforce_study_item_readiness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'STUDY_READY' AND NOT EXISTS (
    SELECT 1
    FROM senses se
    JOIN lexical_entries le ON le.id = se.lexical_entry_id
    JOIN occurrences o ON o.id = NEW.preferred_occurrence_id
    JOIN occurrence_translations ot ON ot.id = NEW.preferred_translation_id
    WHERE se.id = NEW.sense_id
      AND o.sense_id = se.id
      AND nullif(btrim(le.part_of_speech), '') IS NOT NULL
      AND nullif(btrim(le.ipa), '') IS NOT NULL
      AND nullif(btrim(se.definition_fr), '') IS NOT NULL
      AND nullif(btrim(se.definition_zh), '') IS NOT NULL
      AND nullif(btrim(se.short_gloss_zh), '') IS NOT NULL
      AND se.verification_status IN ('verified', 'auto_validated')
      AND nullif(btrim(o.sentence_fr), '') IS NOT NULL
      AND ot.occurrence_id = o.id
      AND ot.language = 'zh'
      AND ot.is_preferred
      AND ot.status IN ('source_provided', 'translated')
      AND nullif(btrim(ot.text), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM study_item_issues issue
        WHERE issue.study_item_id = NEW.id
          AND issue.resolved_at IS NULL
          AND issue.severity = 'error'
      )
  ) THEN
    RAISE EXCEPTION 'study item % is missing reviewed mandatory content', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER study_items_readiness_guard
BEFORE INSERT OR UPDATE OF status, sense_id, preferred_occurrence_id, preferred_translation_id
ON study_items
FOR EACH ROW EXECUTE FUNCTION enforce_study_item_readiness();
--> statement-breakpoint
ALTER TABLE ingestion_runs
  ADD CONSTRAINT ingestion_runs_status_check CHECK (status IN ('running', 'completed', 'failed'));
ALTER TABLE enrichment_jobs
  ADD CONSTRAINT enrichment_jobs_status_check CHECK (status IN ('queued', 'submitted', 'needs_review', 'completed', 'failed', 'cancelled'));
ALTER TABLE content_review_tasks
  ADD CONSTRAINT content_review_tasks_status_check CHECK (status IN ('open', 'accepted', 'rejected'));
