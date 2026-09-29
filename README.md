# TCF Lab

[GitHub](https://github.com/52hz-Daniel/French-Vocabulary) · Live demo: add the Azure Container Apps URL after the first deployment

TCF Lab is a local-first French learning platform for TCF Canada preparation. It builds a broad, traceable French vocabulary catalog from the supplied exam, curriculum, dictionary, corpus, and lexical resources, then promotes selected entries into study material with spaced repetition, review history, progress tracking, multilingual controls, and browser-based French audio.

Generic vocabulary lists lose the sentence and exam context that make a word useful. TCF Lab retains source occurrences and provenance while separating lexemes, meanings, forms, translations, and study state. Catalog candidates may exist with partial enrichment; only reviewed, complete items can become study-ready.

## Architecture and stack

- Next.js App Router, React, TypeScript, and CSS
- PostgreSQL 16+ as the sole runtime source for vocabulary and learning state
- Drizzle schema and committed SQL migrations; production never uses schema push
- `pg_trgm`, `unaccent`, French full-text search, and row-level security
- `ts-fsrs` scheduling with immutable question and answer history
- Python ingestion for DOCX/PDF/OCR, Kaikki enrichment, and Morphalou morphology
- Browser Web Speech API for initial French audio
- OpenAI Batch/Responses for optional draft enrichment, always requiring review
- A non-root, multi-stage Docker image deployed through Azure Container Registry and Azure Container Apps
- GitHub Actions tests, builds, pushes commit-addressed images, deploys revisions, and checks database health

The catalog separates lexemes, lexical entries, senses, forms, source occurrences, translations, collections, and study items. Personal sessions, cards, bookmarks, encounters, and metrics live in separate RLS-protected tables. See [architecture](docs/architecture.md).

PostgreSQL is the production runtime source of truth. Raw/private transcripts, licensed references, generated exports, and the Morphalou SQLite index are never included in the Docker image. The reviewed output is imported into managed PostgreSQL once and persists independently of container revisions.

> The current recruiter-demo model uses one seeded identity. It is appropriate for non-sensitive shared progress, but real multi-user deployment requires authentication.

The Settings page switches all application controls between English, Chinese, and French. French study material remains canonical source content. Library search supports collection/status/favorite filters and sortable spreadsheet-style columns; favorites persist per user in PostgreSQL.

## Run locally

Prerequisites: Node 22+, pnpm 10+, Python 3.9+, and Docker Desktop or another Docker Compose-compatible PostgreSQL runtime.

```bash
pnpm install
python3 -m pip install -r requirements.txt
cp .env.example .env.local
docker compose up -d --wait
pnpm db:migrate
pnpm db:import:listening
pnpm db:verify
pnpm dev
```

Open <http://localhost:3000>. The import command requires the ignored file `data-private/generated/items-enriched.json`. It is safe to rerun: the import is checksum-recorded, uses stable external keys and transactional upserts, and rolls back if reconciliation differs from the source counts.

If the Docker volume was created before `db/bootstrap.sql` existed, create the `tcf_app` and `tcf_ingest` roles manually or recreate only that named development volume. Managed PostgreSQL must provision equivalent roles before migrations run.

## Content workflow

Build the broad catalog before spending enrichment effort on every item:

```bash
pnpm catalog:build
```

This creates the ignored `data-private/generated/catalog-candidates.json` artifact from the local Kaikki French-Chinese dictionary, Lexique 4.00, FLELex, and Wiktionnaire data. It records coverage, frequency, CEFR level, definitions, examples, and source evidence when available. It does not bypass database readiness checks or make incomplete entries available for review.

```bash
pnpm db:queue:enrichment
pnpm db:enrich:submit
pnpm db:enrich:sync -- <batch-id>
pnpm db:review -- accept <task-id>  # or reject
pnpm db:promote-ready
pnpm db:verify
```

AI output remains a review proposal. PostgreSQL refuses to promote an item missing reviewed definitions, IPA, bilingual meaning, a matching preferred occurrence, an accepted Chinese translation, or with an unresolved error.

## Validate

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

Check runtime/database readiness at <http://localhost:3000/api/health>.

## Run with Docker

Start PostgreSQL and seed it first, then build and run the web image:

```bash
docker compose up -d --wait
pnpm db:migrate
pnpm db:import:listening
docker build -t tcf-lab:local .
docker run --rm -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL='postgresql://tcf_app:tcf_local@host.docker.internal:5432/tcf_lab' \
  -e DEV_USER_ID='00000000-0000-4000-8000-000000000001' \
  tcf-lab:local
```

An **image** is the immutable artifact stored in ACR; a **container** is a running instance. Dockerfile instructions create cacheable **layers**. The build stage has build dependencies, while the runtime stage contains only Next.js standalone output. `EXPOSE 3000` documents the internal port, `-p` maps it to the host, environment variables provide runtime configuration, and `CMD` starts `server.js`.

## Data pipeline

The Python pipeline first builds a broad catalog from local lexical resources, then adds exam and curriculum occurrences through OCR/DOCX extraction. Lexique supplies frequency and IPA, FLELex supplies CEFR signals, Kaikki supplies French-Chinese glosses, Wiktionnaire supplies definitions and authentic examples, and Morphalou supplies inflectional evidence. PostgreSQL importers stage those artifacts with `COPY` and perform transactional, idempotent upserts. Database guards prevent incomplete items from becoming `STUDY_READY`.

## CI/CD and Azure

The [CI/CD workflow](.github/workflows/ci-cd.yml) runs tests, the production build, and a Docker build on pull requests and pushes. Pushes to `master` or `main` authenticate to Azure with short-lived GitHub OIDC credentials, push an immutable image to ACR, deploy a Container Apps revision, and smoke-test `/api/health`.

Follow the [Azure deployment runbook](docs/deployment.md) for the one-time account setup, managed PostgreSQL seed, GitHub configuration, and final in-browser acceptance test.

## Screenshots

UI reference screenshots are under `Design/`. After the Azure deployment, capture the actual Today and Review screens under `docs/screenshots/`, embed them here, and add the Live Demo/GitHub links to the résumé.

Private source documents, PDFs, books, large datasets, generated databases, media, exports, and environment secrets are excluded by `.gitignore`. Keep `data-private/`, `vocabulary resources/`, raw Morphalou files, and all source PDFs/documents out of Git.
