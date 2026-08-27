# AI Agent Guide

This repository is a local-first TCF French learning instrument built with Next.js, React, TypeScript, Python, and browser speech synthesis.

## Non-negotiable design rule
Always obey the `Design/` folder. Read `Design/l_instrument/DESIGN.md` and the relevant prototype under `Design/` before changing UI, UX, layout, typography, color, or interaction behavior.

## Architecture

- `app/`: Next.js App Router pages and API routes.
- `components/`: client-side learning and table interfaces.
- `domain/`: TypeScript contracts, question generation, stats, TTS, and study-readiness rules.
- `python/`: DOCX/PDF ingestion, Kaikki dictionary enrichment, Morphalou morphology, OCR, and batch translation.
- `data-private/`: ignored private sources and generated datasets.
- `open-data/morphalou/`: Morphalou download metadata and ignored raw/index files.
- `data-private/generated/items.json`: local production dataset.

## Data rules

Only `STUDY_READY` learning entries may enter the normal learning queue. Keep `RAW`, `ENRICHMENT_PENDING`, and `NEEDS_REVIEW` records visible in review/debug views with missing-field reasons.

Never match dictionary records by exact surface form only. Use Morphalou to map inflected forms to canonical lemmas, preserve all analyses when ambiguous, and do not guess an ambiguous lemma. Preserve `surface -> lemma -> morphology` for inflected occurrences.

Persist core correctness-sensitive data: French/Chinese definitions, preferred example sentence and translation, source provenance, morphology, and translation provider metadata. Keep TTS and optional enrichment lazy/cacheable.

Keep source occurrences normalized and preserve every occurrence. Use `preferredOccurrenceId`; do not rely on array position.

Generate MCQ distractors from persisted verified senses at question creation time and preserve the question/session seed and shown options for reproducibility. Do not permanently attach one distractor set to a vocabulary item.

## Commands

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm morphalou:download
pnpm morphalou:build
pnpm promote:listening
pnpm translations:queue
pnpm enrich:production
```

Public dictionary/translation APIs may rate-limit. Enrichment must remain resumable and must record failures explicitly; never promote failed or incomplete records.

## Working style

Keep edits focused, preserve private-data boundaries, add a focused test for behavior changes, and run the narrowest validation immediately after editing. Do not commit or reset user changes.
