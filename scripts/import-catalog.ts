import "./load-env";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

type CatalogEntry = {
  id: string;
  lemma: string;
  normalizedLemma: string;
  partOfSpeech: string;
  chineseGloss?: string;
  definitionFr?: string;
  ipa?: string;
  targetLevel?: string;
  frequency?: number;
  evidence: Array<{ source: string; uri?: string }>;
};

type CatalogPayload = { entries: CatalogEntry[] };

const inputPath = process.argv[2] ?? "data-private/generated/catalog-candidates.json";
const connectionString = process.env.DATABASE_INGEST_URL ?? process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");

const sourceDefinitions = [
  ["catalog-kaikki", "dictionary", "Kaikki.org French-Chinese dictionary", "https://kaikki.org/dictionary/French/"],
  ["catalog-lexique", "corpus", "Lexique 4.00", "https://www.lexique.org/"],
  ["catalog-flelex", "curriculum", "FLELex / Beacco", "https://cental.uclouvain.be/cefrlex/flelex/"],
  ["catalog-wiktionary", "dictionary", "Wiktionnaire francais via Kaikki.org", "https://fr.wiktionary.org/"],
] as const;

const dataset = JSON.parse(await readFile(inputPath, "utf8")) as CatalogPayload;
const checksum = createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  for (const [slug, kind, title, uri] of sourceDefinitions) {
    await client.query(`
      INSERT INTO sources (slug, kind, title, language, uri, checksum, status, metadata)
      VALUES ($1, $2, $3, 'fr', $4, $5, 'active', '{"role":"catalog-evidence"}'::jsonb)
      ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, uri = EXCLUDED.uri, checksum = EXCLUDED.checksum, updated_at = now()
    `, [slug, kind, title, uri, checksum]);
  }

  await client.query("CREATE TEMP TABLE staging_catalog (payload jsonb NOT NULL) ON COMMIT DROP");
  await client.query("INSERT INTO staging_catalog (payload) SELECT jsonb_array_elements($1::jsonb)", [JSON.stringify(dataset.entries)]);
  await client.query(`
    INSERT INTO lexemes (external_key, language, lemma, normalized_lemma, search_lemma, is_multiword)
    SELECT payload->>'id', 'fr', payload->>'lemma', payload->>'normalizedLemma',
      regexp_replace(unaccent(lower(payload->>'lemma')), '[^[:alnum:]]+', ' ', 'g'),
      (payload->>'lemma') ~ '\\s'
    FROM staging_catalog
    ON CONFLICT (language, normalized_lemma) DO UPDATE SET
      external_key = EXCLUDED.external_key, lemma = EXCLUDED.lemma, search_lemma = EXCLUDED.search_lemma, updated_at = now()
  `);
  await client.query(`
    INSERT INTO lexical_entries (lexeme_id, part_of_speech, ipa, verification_status)
    SELECT l.id, payload->>'partOfSpeech', nullif(payload->>'ipa', ''), 'auto_validated'
    FROM staging_catalog JOIN lexemes l ON l.language = 'fr' AND l.normalized_lemma = payload->>'normalizedLemma'
    ON CONFLICT (lexeme_id, part_of_speech, (coalesce(gender, ''))) DO UPDATE SET
      ipa = coalesce(EXCLUDED.ipa, lexical_entries.ipa), updated_at = now()
  `);
  await client.query(`
    INSERT INTO senses (lexical_entry_id, sense_number, definition_fr, definition_zh, short_gloss_zh, verification_status, confidence)
    SELECT le.id, 1, nullif(payload->>'definitionFr', ''), nullif(payload->>'chineseGloss', ''), nullif(payload->>'chineseGloss', ''),
      CASE WHEN payload->>'definitionFr' IS NOT NULL OR payload->>'chineseGloss' IS NOT NULL THEN 'auto_validated' ELSE 'unknown' END,
      CASE WHEN payload->>'definitionFr' IS NOT NULL AND payload->>'chineseGloss' IS NOT NULL THEN 0.9 ELSE 0.6 END
    FROM staging_catalog JOIN lexemes l ON l.language = 'fr' AND l.normalized_lemma = payload->>'normalizedLemma'
    JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = payload->>'partOfSpeech'
    ON CONFLICT (lexical_entry_id, sense_number) DO UPDATE SET
      definition_fr = coalesce(EXCLUDED.definition_fr, senses.definition_fr),
      definition_zh = coalesce(EXCLUDED.definition_zh, senses.definition_zh),
      short_gloss_zh = coalesce(EXCLUDED.short_gloss_zh, senses.short_gloss_zh),
      updated_at = now()
  `);
  await client.query(`
    DELETE FROM sense_evidence
    WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('catalog-kaikki', 'catalog-lexique', 'catalog-flelex', 'catalog-wiktionary'))
  `);
  await client.query(`
    INSERT INTO sense_evidence (sense_id, source_id, provider, citation, verification_status, confidence, payload)
    SELECT se.id, src.id, evidence->>'source', evidence->>'uri', 'auto_validated', 0.85,
      jsonb_build_object(
        'catalogEntryId', payload->>'id',
        'targetLevel', payload->>'targetLevel',
        'frequency', payload->>'frequency',
        'evidence', evidence
      )
    FROM staging_catalog CROSS JOIN LATERAL jsonb_array_elements(payload->'evidence') evidence
    JOIN sources src ON src.slug = CASE evidence->>'source'
      WHEN 'Kaikki.org French-Chinese dictionary' THEN 'catalog-kaikki'
      WHEN 'Lexique 4.00' THEN 'catalog-lexique'
      WHEN 'FLELex / Beacco' THEN 'catalog-flelex'
      WHEN 'Wiktionnaire francais via Kaikki.org' THEN 'catalog-wiktionary'
    END
    JOIN lexemes l ON l.language = 'fr' AND l.normalized_lemma = payload->>'normalizedLemma'
    JOIN lexical_entries le ON le.lexeme_id = l.id AND le.part_of_speech = payload->>'partOfSpeech'
    JOIN senses se ON se.lexical_entry_id = le.id AND se.sense_number = 1
  `);
  await client.query("COMMIT");
  console.log(JSON.stringify({ imported: dataset.entries.length, checksum }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}