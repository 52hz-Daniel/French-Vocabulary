import "./load-env";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { from as copyFrom } from "pg-copy-streams";
import { Pool, type PoolClient } from "pg";
import type { Dataset, Lexeme, MorphologyAnalysis, SentenceTranslation } from "@/domain/types";
import { normalizeFrench, normalizeFrenchIdentity } from "@/domain/normalize";

const inputPath = process.argv[2] ?? "data-private/generated/core-vocabulary-enriched.json";
const connectionString = process.env.DATABASE_INGEST_URL ?? process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");

function paragraph(reference: string): number | null {
  const match = reference.match(/paragraph\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function preparedLexemes(dataset: Dataset) {
  const canonicalSenses = new Map((dataset.senses ?? []).map((sense) => [sense.id, sense]));
  const translations = new Map((dataset.sentenceTranslations ?? []).map((translation) => [translation.id, translation]));
  const entries = new Map((dataset.learningEntries ?? []).map((entry) => [entry.lexemeId, entry]));
  return dataset.lexemes.map((lexeme) => {
    const entry = entries.get(lexeme.id);
    const sense = { ...lexeme.senses[0], ...(canonicalSenses.get(lexeme.senses[0]?.id) ?? {}) };
    const forms = [
      ...(lexeme.morphologyAnalyses ?? []).map((form, index) => prepareForm(form, `analysis:${index}`, "analysis")),
      ...(lexeme.conjugations ?? []).map((form, index) => prepareForm(form, `conjugation:${index}`, "conjugation")),
    ];
    const occurrences = lexeme.occurrences.map((occurrence) => {
      const isPreferred = entry?.preferredOccurrenceId === occurrence.id;
      const translation = isPreferred ? translations.get(entry?.sentenceTranslationId ?? "") : translations.get(occurrence.sentenceTranslationId ?? "");
      return { ...occurrence, _paragraph: paragraph(occurrence.sourceReference), _translation: translation ?? null };
    });
    return { ...lexeme, _normalizedLemma: normalizeFrenchIdentity(lexeme.lemma), _searchLemma: normalizeFrench(lexeme.lemma), _sense: sense, _forms: forms, _occurrences: occurrences, _entry: entry ?? null };
  });
}

function prepareForm(form: MorphologyAnalysis, key: string, kind: string) {
  return { ...form, _externalKey: `${key}:${form.surface}:${form.mood ?? ""}:${form.tense ?? ""}:${form.person ?? ""}:${form.number ?? ""}`, _kind: kind, _normalizedSurface: normalizeFrench(form.surface) };
}

function csvJson(rows: unknown[]): Readable {
  return Readable.from(rows.map((row) => `"${JSON.stringify(row).replace(/"/g, '""')}"\n`));
}

async function copyStaging(client: PoolClient, rows: unknown[]) {
  const stream = client.query(copyFrom("COPY staging_lexemes (payload) FROM STDIN WITH (FORMAT csv)"));
  csvJson(rows).pipe(stream);
  await finished(stream);
}

async function importDataset(client: PoolClient, dataset: Dataset, checksum: string) {
  const rows = preparedLexemes(dataset);
  await client.query("BEGIN");
  try {
    await client.query(`
      INSERT INTO sources (slug, kind, title, language, uri, checksum, status)
      VALUES ('tef-tcf-core-pdf', 'exam', 'TEF/TCF Core Vocabulary PDF', 'fr', 'local://vocabulary resources/TEF:TCF core-vocabulary.pdf', $1, 'active')
      ON CONFLICT (slug) DO UPDATE SET checksum = EXCLUDED.checksum, updated_at = now()
    `, [checksum]);
    await client.query(`
      INSERT INTO collections (slug, title, description, kind, available)
      VALUES ('tef-tcf-core', 'TEF/TCF Core Vocabulary', 'Cleaned bilingual TEF/TCF core vocabulary with reviewed lexical enrichment', 'exam', true)
      ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, available = true, updated_at = now()
    `);
    await client.query(`
      INSERT INTO collection_sources (collection_id, source_id)
      SELECT c.id, s.id FROM collections c CROSS JOIN sources s WHERE c.slug = 'tef-tcf-core' AND s.slug = 'tef-tcf-core-pdf'
      ON CONFLICT DO NOTHING
    `);
    await client.query("CREATE TEMP TABLE staging_lexemes (payload jsonb NOT NULL) ON COMMIT DROP");
    await copyStaging(client, rows);
    await client.query(`
      INSERT INTO source_documents (source_id, external_key, title)
      SELECT DISTINCT s.id, occurrence->>'sourceDocument', occurrence->>'sourceDocument'
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(st.payload->'_occurrences') occurrence
      CROSS JOIN sources s
      WHERE s.slug = 'tef-tcf-core-pdf'
      ON CONFLICT (source_id, external_key) DO UPDATE SET title = EXCLUDED.title, updated_at = now();

      INSERT INTO lexemes (external_key, language, lemma, normalized_lemma, search_lemma, is_multiword)
      SELECT payload->>'id', 'fr', payload->>'lemma', payload->>'_normalizedLemma', payload->>'_searchLemma', (payload->>'lemma') ~ '\\s'
      FROM staging_lexemes
      ON CONFLICT (language, normalized_lemma) DO UPDATE SET external_key = EXCLUDED.external_key, lemma = EXCLUDED.lemma, search_lemma = EXCLUDED.search_lemma, updated_at = now();

      INSERT INTO lexical_entries (lexeme_id, part_of_speech, ipa, verification_status)
      SELECT l.id, st.payload->>'partOfSpeech', nullif(st.payload->>'ipa', ''), 'verified'
      FROM staging_lexemes st JOIN lexemes l ON l.language = 'fr' AND l.normalized_lemma = st.payload->>'_normalizedLemma'
      ON CONFLICT (lexeme_id, part_of_speech, (coalesce(gender, ''))) DO UPDATE SET ipa = coalesce(EXCLUDED.ipa, lexical_entries.ipa), verification_status = 'verified', updated_at = now();

      INSERT INTO senses (lexical_entry_id, sense_number, definition_fr, definition_zh, short_gloss_zh, verification_status, confidence)
      SELECT le.id, 1, nullif(st.payload#>>'{_sense,definitionFr}', ''), coalesce(nullif(st.payload#>>'{_sense,definitionZh}', ''), st.payload#>>'{_sense,chineseGloss}'), st.payload#>>'{_sense,chineseGloss}', coalesce(st.payload#>>'{_sense,evidence,verification}', 'unknown'), coalesce((st.payload#>>'{_sense,evidence,confidence}')::real, 0)
      FROM staging_lexemes st JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr' JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      ON CONFLICT (lexical_entry_id, sense_number) DO UPDATE SET definition_fr = EXCLUDED.definition_fr, definition_zh = EXCLUDED.definition_zh, short_gloss_zh = EXCLUDED.short_gloss_zh, verification_status = EXCLUDED.verification_status, confidence = EXCLUDED.confidence, updated_at = now();

      DELETE FROM sense_evidence ev
      USING staging_lexemes st
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      WHERE ev.sense_id = se.id AND ev.provider IN ('TEF/TCF Core Vocabulary PDF','Wiktionnaire français via Kaikki.org','Lexique 4.00','FLELex / Beacco');

      INSERT INTO sense_evidence (sense_id, provider, citation, verification_status, confidence, payload)
      SELECT se.id, 'TEF/TCF Core Vocabulary PDF', st.payload#>>'{_sense,evidence,sourceLabel}', 'verified', 1, st.payload#>'{_sense,evidence}'
      FROM staging_lexemes st
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1;

      INSERT INTO sense_evidence (sense_id, provider, citation, verification_status, confidence, payload)
      SELECT se.id, evidence->>'source', evidence->>'citation', 'auto_validated', 0.95, evidence
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(st.payload#>'{_sense,evidence,lexicalSources}', '[]'::jsonb)) evidence
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1;

      INSERT INTO forms (lexical_entry_id, external_key, surface, normalized_surface, form_kind, number, gender, mood, tense, person, ipa, morphalou_inflection_id, features)
      SELECT le.id, form->>'_externalKey', form->>'surface', form->>'_normalizedSurface', form->>'_kind', nullif(form->>'number','-'), coalesce(nullif(form->>'gender','-'), nullif(form->>'inflection_gender','-')), nullif(form->>'mood','-'), nullif(form->>'tense','-'), nullif(form->>'person','-'), nullif(form->>'inflection_phonetic',''), nullif(form->>'inflection_id',''), form - ARRAY['_externalKey','_normalizedSurface','_kind','surface','number','gender','inflection_gender','mood','tense','person','inflection_phonetic','inflection_id']
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(st.payload->'_forms') form
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      ON CONFLICT (lexical_entry_id, external_key) DO UPDATE SET surface = EXCLUDED.surface, normalized_surface = EXCLUDED.normalized_surface, features = EXCLUDED.features, updated_at = now();

      INSERT INTO occurrences (external_key, lexical_entry_id, sense_id, source_document_id, paragraph, sentence_fr, source_text, source_reference, verification_status, confidence)
      SELECT occurrence->>'id', le.id, se.id, sd.id, (occurrence->>'_paragraph')::integer, occurrence->>'sentence', nullif(occurrence->>'sourceText',''), occurrence->>'sourceReference', coalesce(occurrence#>>'{evidence,verification}','unknown'), coalesce((occurrence#>>'{evidence,confidence}')::real, 0)
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(st.payload->'_occurrences') occurrence
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      JOIN sources src ON src.slug = 'tef-tcf-core-pdf'
      JOIN source_documents sd ON sd.source_id = src.id AND sd.external_key = occurrence->>'sourceDocument'
      ON CONFLICT (external_key) DO UPDATE SET lexical_entry_id = EXCLUDED.lexical_entry_id, sense_id = EXCLUDED.sense_id, source_document_id = EXCLUDED.source_document_id, paragraph = EXCLUDED.paragraph, sentence_fr = EXCLUDED.sentence_fr, source_text = EXCLUDED.source_text, source_reference = EXCLUDED.source_reference, updated_at = now();

      UPDATE occurrence_translations ot
      SET is_preferred = false, updated_at = now()
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(st.payload->'_occurrences') occurrence
      JOIN occurrences o ON o.external_key = occurrence->>'id'
      WHERE ot.occurrence_id = o.id AND ot.language = 'zh' AND ot.is_preferred
        AND nullif(occurrence#>>'{_translation,sentenceZh}','') IS NOT NULL
        AND ot.content_hash <> md5(occurrence#>>'{_translation,sentenceZh}');

      INSERT INTO occurrence_translations (occurrence_id, language, text, provider_kind, provider_name, model_version, status, content_hash, is_preferred, verified_at)
      SELECT o.id, 'zh', occurrence#>>'{_translation,sentenceZh}', 'translation', coalesce(occurrence#>>'{_translation,provider}','unknown'), nullif(occurrence#>>'{_translation,modelVersion}',''), occurrence#>>'{_translation,status}', md5(occurrence#>>'{_translation,sentenceZh}'), true, CASE WHEN occurrence#>>'{_translation,status}' IN ('translated','source_provided') THEN now() END
      FROM staging_lexemes st CROSS JOIN LATERAL jsonb_array_elements(st.payload->'_occurrences') occurrence JOIN occurrences o ON o.external_key = occurrence->>'id'
      WHERE nullif(occurrence#>>'{_translation,sentenceZh}','') IS NOT NULL
      ON CONFLICT (occurrence_id, language, content_hash) DO UPDATE SET provider_name = EXCLUDED.provider_name, model_version = EXCLUDED.model_version, status = EXCLUDED.status, is_preferred = true, updated_at = now();

      INSERT INTO study_items (collection_id, sense_id, preferred_occurrence_id, preferred_translation_id, status, priority, source_frequency, target_level, study_role, quality_score)
      SELECT c.id, se.id, o.id, ot.id, CASE WHEN st.payload#>>'{_entry,status}' = 'STUDY_READY' THEN 'NEEDS_REVIEW' ELSE coalesce(st.payload#>>'{_entry,status}','ENRICHMENT_PENDING') END, coalesce((st.payload#>>'{_entry,priority}')::integer, (st.payload->>'priority')::integer, 0), coalesce((st.payload#>>'{_entry,sourceFrequency}')::integer,(st.payload->>'sourceFrequency')::integer,0), coalesce(st.payload#>>'{_entry,targetLevel}',st.payload->>'targetLevel','B2'), 'active', CASE WHEN coalesce(st.payload#>>'{_entry,status}','') = 'STUDY_READY' THEN 1 ELSE 0 END
      FROM staging_lexemes st
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      JOIN occurrences o ON o.external_key = st.payload#>>'{_entry,preferredOccurrenceId}'
      CROSS JOIN collections c LEFT JOIN occurrence_translations ot ON ot.occurrence_id = o.id AND ot.language = 'zh' AND ot.is_preferred
      WHERE c.slug = 'tef-tcf-core'
      ON CONFLICT (collection_id, sense_id) DO UPDATE SET preferred_occurrence_id = EXCLUDED.preferred_occurrence_id, preferred_translation_id = EXCLUDED.preferred_translation_id, status = EXCLUDED.status, priority = EXCLUDED.priority, source_frequency = EXCLUDED.source_frequency, target_level = EXCLUDED.target_level, study_role = EXCLUDED.study_role, quality_score = EXCLUDED.quality_score, updated_at = now();

      INSERT INTO tags (kind, slug, label)
      SELECT DISTINCT 'topic', lower(regexp_replace(topic #>> '{}', '[^[:alnum:]]+', '-', 'g')), topic #>> '{}'
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(st.payload->'topicTags', '[]'::jsonb)) topic
      WHERE nullif(topic #>> '{}', '') IS NOT NULL
      ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label;

      INSERT INTO sense_tags (sense_id, tag_id)
      SELECT se.id, tag.id
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(st.payload->'topicTags', '[]'::jsonb)) topic
      JOIN tags tag ON tag.kind='topic' AND tag.slug=lower(regexp_replace(topic #>> '{}', '[^[:alnum:]]+', '-', 'g'))
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      ON CONFLICT DO NOTHING;

      DELETE FROM study_item_issues WHERE study_item_id IN (SELECT si.id FROM study_items si JOIN collections c ON c.id = si.collection_id WHERE c.slug = 'tef-tcf-core') AND resolved_at IS NULL;
      INSERT INTO study_item_issues (study_item_id, code, severity)
      SELECT si.id, reason #>> '{}', 'error'
      FROM staging_lexemes st
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(st.payload#>'{_entry,reviewReasons}', '[]'::jsonb)) reason
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      JOIN study_items si ON si.sense_id = se.id
      ON CONFLICT DO NOTHING;

      UPDATE study_items si
      SET status = 'STUDY_READY', updated_at = now()
      FROM staging_lexemes st
      JOIN lexemes l ON l.normalized_lemma = st.payload->>'_normalizedLemma' AND l.language = 'fr'
      JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = st.payload->>'partOfSpeech'
      JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
      WHERE si.sense_id = se.id AND st.payload#>>'{_entry,status}' = 'STUDY_READY';
    `);
    const expected = { lexemes: dataset.lexemes.length, occurrences: dataset.occurrences?.length ?? dataset.lexemes.reduce((sum, item) => sum + item.occurrences.length, 0), senses: dataset.senses?.length ?? dataset.lexemes.length, studyItems: dataset.learningEntries?.length ?? dataset.lexemes.length };
    const actualResult = await client.query<{ lexemes: number; occurrences: number; senses: number; study_items: number }>(`
      SELECT
        (SELECT count(*)::int FROM lexemes l JOIN lexical_entries le ON le.lexeme_id=l.id JOIN senses se ON se.lexical_entry_id=le.id JOIN study_items si ON si.sense_id=se.id JOIN collections c ON c.id=si.collection_id WHERE c.slug='tef-tcf-core') AS lexemes,
        (SELECT count(*)::int FROM occurrences o JOIN source_documents d ON d.id=o.source_document_id JOIN sources s ON s.id=d.source_id WHERE s.slug='tef-tcf-core-pdf') AS occurrences,
        (SELECT count(*)::int FROM senses se JOIN study_items si ON si.sense_id=se.id JOIN collections c ON c.id=si.collection_id WHERE c.slug='tef-tcf-core') AS senses,
        (SELECT count(*)::int FROM study_items si JOIN collections c ON c.id=si.collection_id WHERE c.slug='tef-tcf-core') AS study_items
    `);
    const actual = actualResult.rows[0];
    if (actual.lexemes !== expected.lexemes || actual.occurrences !== expected.occurrences || actual.senses !== expected.senses || actual.study_items !== expected.studyItems) throw new Error(`Reconciliation failed: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
    const sourceId = (await client.query<{ id: string }>("SELECT id FROM sources WHERE slug='tef-tcf-core-pdf'" )).rows[0].id;
    await client.query(`INSERT INTO ingestion_runs (source_id, source_checksum, tool_version, configuration, counts, status, finished_at) VALUES ($1,$2,'postgres-import-v1',$3,$4,'completed',now()) ON CONFLICT (source_id, source_checksum, tool_version) DO UPDATE SET counts=EXCLUDED.counts,status='completed',finished_at=now(),error=NULL`, [sourceId, checksum, JSON.stringify({ inputPath }), JSON.stringify(actual)]);
    await client.query("COMMIT");
    return { expected, actual, checksum };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const raw = await readFile(inputPath);
const dataset = JSON.parse(raw.toString("utf8")) as Dataset;
const checksum = createHash("sha256").update(raw).digest("hex");
const pool = new Pool({ connectionString, max: 1 });
try {
  const client = await pool.connect();
  try { console.log(JSON.stringify(await importDataset(client, dataset, checksum), null, 2)); }
  finally { client.release(); }
} finally { await pool.end(); }
