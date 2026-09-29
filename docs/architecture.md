# Architecture decisions

The application is a modular Next.js monolith backed by PostgreSQL 16+. PostgreSQL is authoritative for vocabulary and personal learning state. Drizzle defines the typed schema, while reviewed migrations in `db/migrations/` are the only production schema-change mechanism. JSON exports under `data-private/` are import and rollback artifacts, never a runtime data source.

## Catalog and provenance

`lexemes` holds language-level headwords; `lexical_entries` separates homographs by part of speech and gender; `senses` holds canonical bilingual meaning; and `forms` holds inflections and conjugations. `sources`, `source_documents`, and `occurrences` preserve exact provenance. `study_items` selects one sense and preferred example for a collection without duplicating the catalog.

The ingestion boundary is intentionally two-stage. `catalog-candidates.json` is a broad, ignored build artifact assembled from local Kaikki, Lexique, FLELex, and Wiktionnaire resources. A catalog candidate can have a lemma, part of speech, frequency, CEFR signal, gloss, or definition without having an example sentence or Chinese sentence translation. The database import/review pipeline remains responsible for turning a candidate into a complete study item.

Correctness-sensitive fields are persisted and reviewed: definitions, IPA, morphology, translations, preferred examples, source location, level, priority, evidence, and status. Search results, due queues, dashboard totals, quiz distractors, browser TTS, hints, mnemonics, and alternate examples are computed on demand. Once a quiz is shown, its seed, prompt, and ordered options become an immutable snapshot.

The database trigger `study_items_readiness_guard` prevents incomplete or unreviewed content from becoming `STUDY_READY`. AI enrichment is queued in `enrichment_jobs`; Batch/Responses output creates a `content_review_tasks` proposal and never edits canonical study content until a reviewer accepts it.

## Personal learning

User-owned tables store sessions, question snapshots, immutable encounter events, bookmarks, daily projections, and `ts-fsrs` card state. Answer submission is one transaction: validate and lock the question/card, enforce the idempotency key, append the event, update FSRS state, and update daily metrics.

Every user-owned table has PostgreSQL row-level security. Application transactions set local `app.user_id`; policies restrict rows to that UUID. The seeded development identity is only for local use. Public deployment requires authentication and removal of the fallback.

## Search and scale

Normalized French removes accents for matching while canonical spelling remains untouched. B-tree, trigram GIN, French full-text GIN, due-queue partial, event composite, and event BRIN indexes cover the first scaling stage. Events remain unpartitioned until measured volume justifies monthly partitions. API responses use bounded cursor pagination instead of sending the complete catalog to the browser.

Python remains responsible for source parsing and linguistic preparation. Importers stage validated data with PostgreSQL `COPY` and perform transactional, idempotent upserts. Morphalou SQLite is an ingestion-only index; accepted forms are copied into PostgreSQL.

## Content expansion priority

1. Build and inspect the broad catalog; measure coverage by source, CEFR band, part of speech, and missing fields.
2. Import catalog candidates as non-study content, preserving every source claim and leaving missing examples/translations nullable.
3. Attach occurrences from the 42 listening documents, the supplied A1/B1 books, and the TEF/TCF core PDF where exact provenance is available.
4. Enrich high-priority gaps in batches: French definitions and IPA first, then authentic examples, then Chinese sentence translations.
5. Promote only reviewed items to `STUDY_READY`, prioritizing A1-B2 frequency and exam relevance over uniform completion of the entire catalog.

Do not scrape arbitrary web pages into canonical content. Prefer downloadable datasets or stable public APIs with explicit license/citation metadata, and store provider, version, retrieval time, and citation with each imported claim.
