# AI Agent Guide

## Non-negotiable rules

Always obey `Design/`. Read `Design/l_instrument/DESIGN.md` and the relevant page prototype before changing UI, UX, typography, color, layout, or interaction behavior.

PostgreSQL is authoritative. Never restore runtime JSON loading or browser-only study state. Do not use Drizzle schema push in production; update `db/schema.ts`, generate and review a migration, and commit both. Never commit private sources, PDFs/books, large exports, generated databases, credentials, or `data-private/` content.

## Structure

- `db/schema.ts`: typed catalog, pipeline, review, and user-owned schema
- `db/migrations/`: reviewed PostgreSQL migrations, extensions, RLS, and readiness guard
- `db/*-repository.ts`: bounded database operations; user operations run through `withUserClient`
- `app/api/`: cursor-paginated library, study item, review, progress, bookmark, and legacy-import endpoints
- `domain/`: normalization, readiness, questions, TTS, stats, and FSRS adapter
- `domain/i18n.ts`: complete English, Chinese, and French interface catalogs
- `scripts/`: migrations, listening import/reconciliation, enrichment, review, and promotion
- `python/`: document extraction and linguistic preparation
- `data-private/`: ignored import and rollback artifacts only

## Data invariants

- Preserve `surface -> lexical entry -> lexeme`, every source occurrence, evidence, and stable external key.
- Do not guess ambiguous morphology or overwrite reviewed canonical material with AI output.
- Only `STUDY_READY` items enter review. The database trigger is the final enforcement layer.
- Definitions, IPA, translations, morphology, conjugations, provenance, levels, priorities, and preferred examples are static reviewed data.
- Search, filters, dashboards, due queues, distractors, hints, TTS, mnemonics, and alternate examples are ad hoc. Persist question options and seed as soon as shown.
- Answer submission must remain transactional, idempotent, and FSRS-versioned.
- Every new personal table requires RLS and a multi-user isolation test before public release.
- Add every new interface label to all three language catalogs; do not hard-code mixed-language controls in components.

## Current next steps

1. Build and inspect the broad catalog with `pnpm catalog:build`; verify source coverage and the 10k+ target.
2. Import catalog-only records with `pnpm db:import:catalog`, then attach exact exam/curriculum occurrences.
3. Review enrichment proposals and promote only complete records into `STUDY_READY`.
4. Add coverage dashboards and reconciliation for new, matched, ambiguous, rejected, and incomplete content.
5. Add real authentication and remove the development-user fallback before any public deployment.
6. Benchmark at 100k lexemes and one million occurrences/events; partition only after measurement.

Use `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, and `pnpm db:verify` for handoff. Keep edits focused and never reset unrelated user work.
