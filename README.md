pnpm morphalou:download # download official Morphalou 3.1 CSV archive
pnpm morphalou:build # build fast inflection lookup index

# TCF Lab

A local-first French study instrument for TCF Canada preparation. It combines
exam listening material, source-based vocabulary, morphology, review history,
and browser audio in a calm editorial notebook interface.

## Product

The app is organized around Today, Learn, Review, Library, and Progress. The
normal learning queue accepts only complete `STUDY_READY` entries. Every such
entry has a French surface form, canonical lemma, part of speech, French and
Chinese meanings, a French example with Chinese translation, source provenance,
and morphology when relevant. Incomplete records remain visible for review.

The source model keeps `Lexeme`, `Sense`, `Occurrence`, `Source`, sentence
translations, morphology analyses, conjugation paradigms, and learning entries
separate. A word may have many source occurrences, while one preferred
occurrence is selected for the learner card. Inflected forms are mapped to
lemmas rather than matched only by exact spelling.

## Design

The interface follows the `L'Instrument` system in [Design](Design/): cool
paper surfaces, ink typography, Libre Caslon Text for French study content,
Public Sans for controls, thin notebook rules, restrained semantic color, and
no decorative shadows or gradients. The prototypes in each `Design/` subfolder
define the intended page and review flows.

## Technology

- Next.js App Router, React, TypeScript, and CSS
- Python ingestion for DOCX, OCR PDF review, enrichment, and dataset assembly
- Kaikki Chinese Wiktionary JSONL for French-to-Chinese dictionary senses
- Morphalou 3.1 from ATILF/ORTOLANG for deterministic lemma and inflection lookup
- SQLite index for fast Morphalou surface-form and conjugation queries
- Browser Web Speech API for French word and sentence audio
- Browser `localStorage` for single-user study history
- No authentication, cloud database, LLM dependency, or committed private data

## Run

```bash
pnpm install
python3 -m pip install -r requirements.txt
pnpm ingest   # optional; requires ignored private source + reviewed senses
pnpm candidates # scan all 42 listening transcripts into a review queue
pnpm analyze:candidates # label sentence-ready and meaning-reviewed words
pnpm promote:listening # publish candidates with Kaikki Chinese senses
brew install tesseract tesseract-lang
python3 -m pip install -r requirements.txt
pnpm ocr:pdf # OCR the scanned core-vocabulary PDF
pnpm parse:core-vocabulary # turn OCR text into a reviewable source queue
pnpm dev
```

Open <http://localhost:3000/library>. If the private generated dataset is
absent, the app switches to a committed synthetic fixture automatically.

Useful routes are `/library`, `/vocabulary`, `/debug`, `/collection/:id`, and
`/learn/:collectionId`. The learner API at `/api/learn` returns only validated
study-ready entries.

The current learning dataset is built from reviewed records. `pnpm candidates`
scans all 42 listening DOCX files into an ignored candidate queue; candidates
need lemma, part-of-speech, suitability, and meaning review before becoming
quiz items. The core-vocabulary PDF is image-based, so its words and
explanations require OCR or a text-exported copy before PDF ingestion.

Morphalou 3.1 from ATILF/ORTOLANG is used as the primary deterministic
morphology source for inflected-form lookup and verb conjugations. Its source,
version, download instructions, and LGPL-LR license are recorded in
`open-data/morphalou/README.md`. Multiple Morphalou analyses are preserved and
ambiguous forms are not automatically assigned to a lemma.

## Test

```bash
pnpm test
pnpm build
```

## Architecture

- Next.js App Router UI and dynamic local dataset endpoint
- TypeScript domain model for lexemes, senses, occurrences, evidence, questions,
  TTS, future prioritization, and review scheduling boundaries
- Python DOCX ingestion adapter using OOXML directly (no source rewriting)
- deterministic reviewed linguistic adapter, ready to be replaced/enriched by
  spaCy + Morphalou; Lexique remains secondary priority evidence
- browser Web Speech API (`fr-FR`) through a provider interface
- no auth, cloud services, database server, LLM dependency, or committed private data

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and
[docs/architecture.md](docs/architecture.md).
