# Architecture decisions

The MVP is a modular monolith. The browser owns the study interaction and local
single-user state; the Next.js server owns access to ignored private exports;
Python owns source ingestion and linguistic adapter boundaries.

The central record is a `Lexeme`, which owns multiple `Sense` records and many
exact `Occurrence` records. Every sense and occurrence carries evidence,
verification state, and confidence. Multiword expressions fit the same lexeme
shape without turning every surface form into a separate item.

The importer reads OOXML paragraph text from the original DOCX and groups the
first substantive paragraph after each numbered marker. It never modifies raw
source text. A local reviewed-sense file selects a small set of occurrences and
supplies bilingual meaning evidence. This is intentionally conservative: the
source has no Chinese meanings, answer key, or reliable markup for utterance vs.
question boundaries.

Question generation uses only verified senses from other lexemes. It prefers
the same part of speech and similar priority, excludes duplicate/correct terms
and detectable synonyms, then applies seeded shuffling. Each option retains its
sense ID and evidence label.

Browser speech synthesis is the zero-key provider. A future OpenAI provider can
implement the same `TTSProvider`; paid output should be cached by normalized
text, voice, model, and speed. Review timing (future FSRS) and learning priority
remain separate concerns.
