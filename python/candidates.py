from __future__ import annotations

import json
import re
from pathlib import Path

from .ingest import context_sentence, docx_paragraphs
from .dictionary import CONTENT_PARTS_OF_SPEECH, is_content_entry, load_french_chinese_dictionary, lookup_french_chinese

WORD_PATTERN = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+)?")
STOPWORDS = {
    "alors", "avec", "avoir", "ce", "cela", "ces", "comme", "dans", "de", "des", "du", "elle", "elles", "en", "est", "et", "eux", "faire", "il", "ils", "je", "la", "le", "les", "leur", "leurs", "mais", "me", "mes", "mon", "ne", "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "que", "quel", "quelle", "quelles", "quels", "qui", "sans", "se", "ses", "son", "sont", "sur", "ta", "te", "tes", "toi", "ton", "tous", "tout", "tres", "tu", "un", "une", "vos", "votre", "vous", "y", "a", "au", "aux", "d", "l", "j", "c", "s", "m", "n", "p", "qu",
}


def extract_candidate_words(source_dir: Path) -> list[dict[str, object]]:
    candidates: dict[str, dict[str, object]] = {}
    for source_path in sorted(source_dir.glob("*.docx")):
        for paragraph_index, text in enumerate(docx_paragraphs(source_path)):
            for match in WORD_PATTERN.finditer(text):
                surface = match.group(0)
                normalized = surface.casefold().replace("’", "'")
                if len(normalized) < 3 or normalized in STOPWORDS or normalized.isnumeric():
                    continue
                candidate = candidates.setdefault(normalized, {"surface": normalized, "occurrences": []})
                occurrences = candidate["occurrences"]
                assert isinstance(occurrences, list)
                if len(occurrences) < 5:
                    occurrences.append({"sourceDocument": source_path.name, "paragraphIndex": paragraph_index, "sentence": context_sentence(text, surface), "sourceText": text})
                candidate["frequency"] = int(candidate.get("frequency", 0)) + 1
    return sorted(candidates.values(), key=lambda item: (-int(item["frequency"]), str(item["surface"])))


def analyze_candidates(source_dir: Path, reviewed_path: Path, dictionary_path: Path | None = None) -> list[dict[str, object]]:
    reviewed = json.loads(reviewed_path.read_text(encoding="utf-8"))
    reviewed_by_surface = {str(record["surface"]).casefold(): record for record in reviewed}
    dictionary = load_french_chinese_dictionary(dictionary_path) if dictionary_path else {}
    analyzed = []
    for candidate in extract_candidate_words(source_dir):
        surface = str(candidate["surface"])
        occurrences = candidate["occurrences"]
        has_sentence = bool(occurrences) and all(bool(item.get("sentence")) for item in occurrences if isinstance(item, dict))
        meaning = reviewed_by_surface.get(surface)
        dictionary_meaning = lookup_french_chinese(dictionary, surface)
        has_meaning = bool(meaning and meaning.get("chineseGloss")) or bool(dictionary_meaning and is_content_entry(dictionary_meaning))
        is_content_word = bool(meaning and meaning.get("partOfSpeech") in CONTENT_PARTS_OF_SPEECH) or bool(dictionary_meaning and is_content_entry(dictionary_meaning))
        analyzed.append({
            **candidate,
            "sentence_available": has_sentence,
            "sentence_status": "direct_source_sentence" if has_sentence else "needs_sentence_review",
            "chinese_meaning_verified": has_meaning,
            "meaning_status": "reviewed_source" if meaning else ("kaikki_dictionary" if has_meaning else "needs_dictionary_or_review"),
            "production_ready": has_sentence and has_meaning and is_content_word,
        })
    return analyzed


def write_candidate_review_queue(source_dir: Path, output_path: Path) -> None:
    candidates = extract_candidate_words(source_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")


def write_candidate_analysis(source_dir: Path, reviewed_path: Path, output_path: Path, dictionary_path: Path | None = None) -> None:
    analyzed = analyze_candidates(source_dir, reviewed_path, dictionary_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(analyzed, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create a review queue from listening DOCX files.")
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--reviewed", type=Path)
    parser.add_argument("--dictionary", type=Path)
    arguments = parser.parse_args()
    if arguments.reviewed:
        write_candidate_analysis(arguments.source_dir, arguments.reviewed, arguments.output, arguments.dictionary)
    else:
        write_candidate_review_queue(arguments.source_dir, arguments.output)
    print(f"Wrote {arguments.output}")
