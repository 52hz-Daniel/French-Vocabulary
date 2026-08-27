# First MVP implementation plan

## Scope

Build one local, exam-first vertical slice around the private listening source
`data-private/exam/listening/CO 1.docx`. Preserve its text and provenance, but
keep the document and every derived private-data export outside Git.

## Steps

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
