from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from .dictionary import load_french_chinese_dictionary, lookup_french_chinese

ENTRY_PATTERN = re.compile(
    r"^(?P<word>[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ'’-]*)"
    r"(?:\s+(?P<pos>n\.?m\.?|n\.?f\.?|n\.?|v\.?t\.?|v\.?i\.?|v\.?|adj\.?|adv\.?))?"
    r"\s+(?P<gloss>.*)$",
    re.IGNORECASE,
)


def parse_ocr_entries(ocr_path: Path, dictionary_path: Path | None = None) -> list[dict[str, Any]]:
    source = json.loads(ocr_path.read_text(encoding="utf-8"))
    dictionary = load_french_chinese_dictionary(dictionary_path) if dictionary_path else {}
    entries: list[dict[str, Any]] = []
    for page in source.get("pages", []):
        for line in str(page.get("text", "")).splitlines():
            line = line.strip()
            match = ENTRY_PATTERN.match(line)
            if not match or not re.search(r"[\u4e00-\u9fff]", match.group("gloss")):
                continue
            word = match.group("word")
            if len(word) < 3 or word.isupper() or (word[0].isupper() and word[1:].islower()):
                continue
            dictionary_entry = lookup_french_chinese(dictionary, word)
            entries.append({
                "word": word,
                "page": page.get("page"),
                "ocrPartOfSpeech": match.group("pos"),
                "ocrChineseGloss": match.group("gloss"),
                "dictionaryMatch": dictionary_entry,
                "meaningStatus": "kaikki_dictionary" if dictionary_entry else "ocr_needs_review",
                "sentenceStatus": "needs_source_sentence",
                "productionReady": False,
            })
    unique: dict[tuple[str, int], dict[str, Any]] = {}
    for entry in entries:
        unique[(entry["word"].casefold(), int(entry["page"]))] = entry
    return list(unique.values())


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse OCR vocabulary entries into a review queue.")
    parser.add_argument("ocr", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dictionary", type=Path)
    args = parser.parse_args()
    entries = parse_ocr_entries(args.ocr, args.dictionary)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"sourceMode": "tef-tcf-core-ocr", "entries": entries}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.output} ({len(entries)} entries)")


if __name__ == "__main__":
    main()
