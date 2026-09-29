import "./load-env";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import type { Dataset } from "@/domain/types";

const inputPath = process.argv[2] ?? "data-private/generated/items-enriched.json";
const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_INGEST_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_INGEST_URL is required");

const dataset = JSON.parse(await readFile(inputPath, "utf8")) as Dataset;
const expected = {
  lexemes: dataset.lexemes.length,
  senses: dataset.senses?.length ?? dataset.lexemes.length,
  occurrences: dataset.occurrences?.length ?? dataset.lexemes.reduce((sum, item) => sum + item.occurrences.length, 0),
  studyItems: dataset.learningEntries?.length ?? dataset.lexemes.length,
};
const pool = new Pool({ connectionString, max: 1 });

try {
  const counts = (await pool.query(`
    SELECT
      count(DISTINCT l.id)::int AS lexemes,
      count(DISTINCT se.id)::int AS senses,
      count(DISTINCT o.id)::int AS occurrences,
      count(DISTINCT si.id)::int AS study_items
    FROM collections c
    JOIN study_items si ON si.collection_id=c.id
    JOIN senses se ON se.id=si.sense_id
    JOIN lexical_entries le ON le.id=se.lexical_entry_id
    JOIN lexemes l ON l.id=le.lexeme_id
    JOIN occurrences o ON o.sense_id=se.id
    WHERE c.slug='tcf-listening'
  `)).rows[0];
  const actual = { lexemes: counts.lexemes, senses: counts.senses, occurrences: counts.occurrences, studyItems: counts.study_items };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Reconciliation failed: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);

  const completeness = (await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE nullif(btrim(le.ipa),'') IS NOT NULL)::int AS ipa,
      count(*) FILTER (WHERE nullif(btrim(se.definition_fr),'') IS NOT NULL)::int AS definition_fr,
      count(*) FILTER (WHERE nullif(btrim(se.definition_zh),'') IS NOT NULL)::int AS definition_zh,
      count(*) FILTER (WHERE si.preferred_translation_id IS NOT NULL)::int AS preferred_translation,
      count(*) FILTER (WHERE si.status='STUDY_READY')::int AS study_ready,
      count(*) FILTER (WHERE issue.open_issues > 0)::int AS items_with_open_issues
    FROM study_items si
    JOIN collections c ON c.id=si.collection_id
    JOIN senses se ON se.id=si.sense_id
    JOIN lexical_entries le ON le.id=se.lexical_entry_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS open_issues FROM study_item_issues i
      WHERE i.study_item_id=si.id AND i.resolved_at IS NULL
    ) issue ON true
    WHERE c.slug='tcf-listening'
  `)).rows[0];
  const rls = (await pool.query(`
    SELECT relname AS table_name, relrowsecurity AS enabled
    FROM pg_class
    WHERE relname = ANY($1::text[])
    ORDER BY relname
  `, [["app_users", "encounter_events", "review_cards", "review_question_options", "review_questions", "study_sessions", "user_bookmarks", "user_daily_metrics"]])).rows;
  if (rls.length !== 8 || rls.some((row) => !row.enabled)) throw new Error(`RLS verification failed: ${JSON.stringify(rls)}`);

  const plans = {
    dueQueue: (await pool.query("EXPLAIN (FORMAT JSON) SELECT * FROM review_cards WHERE user_id=$1 AND due_at<=now() AND state<>'suspended' ORDER BY due_at LIMIT 50", ["00000000-0000-4000-8000-000000000001"])).rows[0]["QUERY PLAN"],
    exactLemma: (await pool.query("EXPLAIN (FORMAT JSON) SELECT * FROM lexemes WHERE language='fr' AND normalized_lemma=$1", ["etre"])).rows[0]["QUERY PLAN"],
  };
  console.log(JSON.stringify({ reconciliation: { expected, actual }, completeness, rls, plans }, null, 2));
} finally {
  await pool.end();
}
