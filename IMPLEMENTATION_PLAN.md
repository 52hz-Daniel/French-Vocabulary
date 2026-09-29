# Content expansion plan

The MVP vertical slice is complete enough to support a larger content program. The next goal is a useful learning catalog, not merely a larger set of fully enriched cards.

## Current baseline

- The generated listening dataset contains about 1,200 lexemes and is already importable.
- The cleaned TEF/TCF core PDF contains 874 unique headwords.
- The repository already includes 42 listening documents, a French-Chinese dictionary, Lexique 4.00, FLELex, Wiktionnaire-derived data, and Morphalou.
- These sources are sufficient to produce a broad 10k+ candidate catalog before examples and translations are complete.

## Priorities

1. Run `pnpm catalog:build` and inspect the coverage report. Treat this as the new content baseline.
2. Add a catalog import path that persists incomplete candidates as non-study content. Keep `STUDY_READY` behind the existing database guard.
3. Merge exact occurrences from listening transcripts, A1/B1 books, and the TEF/TCF PDF without inventing provenance.
4. Enrich in this order: part of speech and lemma validation, Chinese gloss, French definition and IPA, CEFR/frequency ranking, authentic example, Chinese example translation.
5. Review and promote a first learning tranche of roughly 2,000 high-priority A1-B2/exam-relevant items, then expand toward 10k+.
6. Add coverage dashboards and reconciliation checks so every future source import reports new, matched, ambiguous, rejected, and incomplete records.

## Source policy

Use the supplied local datasets first. New internet sources must have a stable API or downloadable release, explicit license/terms, a citation, and a reproducible retrieval date. Store source evidence per claim. Do not make web-scraped or AI-generated text canonical without review.

## Historical MVP scope

Build one local, exam-first vertical slice around the private listening source
`data-private/exam/listening/CO 1.docx`. Preserve its text and provenance, but
keep the document and every derived private-data export outside Git.

The original MVP steps remain historical context:

1. Protect local material with root-anchored Git ignore rules and verify them
   with `git check-ignore` plus an automated test.
2. Add a Python ingestion module that extracts numbered listening prompts from
   DOCX without rewriting the source text. Normalize a deliberately small set
   of reviewed occurrences into lexemes, senses, morphology, and provenance.
3. Keep linguistic adapters explicit: deterministic reviewed records now;
   replaceable spaCy, Morphalou, and Lexique adapters later. Mark every claim
   with verification state and confidence.
4. Export an ignored JSON dataset from the real private document. When it is
   absent, load a committed golden fixture so the repository still runs.
5. Build a TypeScript/Next.js modular monolith with `/library`,
   `/collection/:id`, `/learn/:collectionId`, and `/debug` views. Use browser
   French speech synthesis behind a provider interface.
6. Generate reproducible four-choice questions with deterministic real-sense
   distractors, same-part-of-speech preference, synonym/correct-sense
   exclusions, and recorded option provenance.
7. Track local single-user study events and aggregate collection statistics in
   browser storage; keep scheduling and item priority as separate interfaces.
8. Test ingestion, morphology fixtures, source preservation, distractors,
   answer position, TTS abstraction, and Git ignore protection. Build the app,
   run the end-to-end local flow, and capture a learning-screen screenshot.

## Deliberate limits

- No bulk PDF/corpus parsing, auth, cloud services, paid TTS, or LLM-generated
  linguistic facts.
- The source transcript is real; the small Chinese sense set is explicitly
  labeled as manually reviewed fixture evidence until a private vocabulary-book
  importer can provide stronger evidence.
- Browser Web Speech audio is demonstrated through the provider and UI; actual
  voice availability depends on the user's installed `fr-FR` voices.
