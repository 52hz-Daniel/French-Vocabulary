import "./load-env";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_INGEST_URL ?? process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");
const pool = new Pool({ connectionString, max: 1 });
try {
  const result = await pool.query(`
    UPDATE study_items si SET status='STUDY_READY',updated_at=now()
    FROM senses se
    JOIN lexical_entries le ON le.id=se.lexical_entry_id
    JOIN occurrences o ON o.sense_id=se.id
    JOIN occurrence_translations ot ON ot.occurrence_id=o.id
    WHERE si.sense_id=se.id
      AND si.preferred_occurrence_id=o.id
      AND si.preferred_translation_id=ot.id
      AND si.status<>'STUDY_READY'
      AND nullif(btrim(le.ipa),'') IS NOT NULL
      AND nullif(btrim(se.definition_fr),'') IS NOT NULL
      AND nullif(btrim(se.definition_zh),'') IS NOT NULL
      AND nullif(btrim(se.short_gloss_zh),'') IS NOT NULL
      AND se.verification_status IN ('verified','auto_validated')
      AND ot.language='zh' AND ot.is_preferred AND ot.status IN ('source_provided','translated')
      AND NOT EXISTS (SELECT 1 FROM study_item_issues issue WHERE issue.study_item_id=si.id AND issue.resolved_at IS NULL AND issue.severity='error')
    RETURNING si.id
  `);
  console.log(JSON.stringify({ promoted: result.rowCount }, null, 2));
} finally {
  await pool.end();
}
