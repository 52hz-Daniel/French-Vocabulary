from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONTENT_PARTS_OF_SPEECH = {"noun", "verb", "adj", "adv"}


def _clean_gloss(gloss: str) -> str:
    value = gloss.strip()
    for prefix in ("n.m.", "n.f.", "n.", "v.t.", "v.i.", "v.", "adj.", "adv."):
        if value.startswith(prefix):
            value = value[len(prefix):].strip()
    return value


def load_french_chinese_dictionary(path: Path) -> dict[str, dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            record = json.loads(line)
            if record.get("lang_code") != "fr" or not record.get("word"):
                continue
            glosses = [_clean_gloss(gloss) for sense in record.get("senses", []) for gloss in sense.get("glosses", []) if gloss.strip()]
            if not glosses:
                continue
            word = str(record["word"]).casefold().replace("’", "'")
            entries.setdefault(word, {
                "word": record["word"],
                "partOfSpeech": record.get("pos", "unknown"),
                "chineseGloss": "；".join(dict.fromkeys(glosses[:3])),
                "ipa": next((sound.get("ipa", "").strip("/") for sound in record.get("sounds", []) if sound.get("ipa")), None),
                "sourceLabel": "Kaikki.org Chinese Wiktionary dataset",
                "sourceUrl": "https://kaikki.org/dictionary/French/",
            })
    return entries


def lookup_french_chinese(entries: dict[str, dict[str, Any]], word: str) -> dict[str, Any] | None:
    return entries.get(word.casefold().replace("’", "'"))


def is_content_entry(entry: dict[str, Any]) -> bool:
    return entry.get("partOfSpeech") in CONTENT_PARTS_OF_SPEECH
