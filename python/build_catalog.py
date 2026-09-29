from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .dictionary import CONTENT_PARTS_OF_SPEECH, load_french_chinese_dictionary
from .lexical_resources import load_flelex, load_lexique, load_wiktionary, normalized

POS_ALIASES = {
    "adj": "adjective", "adjective": "adjective", "adv": "adverb", "adverb": "adverb",
    "n": "noun", "nom": "noun", "noun": "noun", "v": "verb", "verb": "verb",
}


def canonical_pos(value: str | None) -> str | None:
    return POS_ALIASES.get((value or "").strip().casefold())


def entry_id(lemma: str, part_of_speech: str) -> str:
    digest = hashlib.sha1(f"{lemma}\0{part_of_speech}".encode("utf-8")).hexdigest()[:12]
    return f"catalog-{digest}"


def build_catalog(
    dictionary_path: Path,
    lexique_path: Path,
    flelex_path: Path,
    wiktionary_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    dictionary = load_french_chinese_dictionary(dictionary_path)
    dictionary_keys = {normalized(word) for word in dictionary}
    lexique_rows: dict[str, dict[str, Any]] = {}
    with lexique_path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source, delimiter="\t"):
            lemma = str(row.get("4_Lemme", "")).strip()
            key = normalized(lemma)
            if not key or (key in lexique_rows and row.get("14_IsLem") != "1"):
                continue
            lexique_rows[key] = row

    targets = set(dictionary_keys) | set(lexique_rows)
    lexique = load_lexique(lexique_path, targets)
    flelex = load_flelex(flelex_path, targets)
    wiktionary = load_wiktionary(wiktionary_path, targets)
    entries: list[dict[str, Any]] = []
    for key in sorted(targets):
        dictionary_entry = dictionary.get(key)
        lexique_entry = lexique.get(key, {})
        flelex_entry = flelex.get(key, {})
        wiktionary_entry = wiktionary.get(key, {})
        part_of_speech = (
            canonical_pos(dictionary_entry.get("partOfSpeech") if dictionary_entry else None)
            or canonical_pos(lexique_entry.get("partOfSpeech"))
            or canonical_pos(flelex_entry.get("partOfSpeech"))
            or canonical_pos(wiktionary_entry.get("partOfSpeech"))
        )
        if part_of_speech not in CONTENT_PARTS_OF_SPEECH | {"adjective", "adverb"}:
            continue
        lemma = str((dictionary_entry or {}).get("word") or lexique_entry.get("lemma") or wiktionary_entry.get("word") or key)
        evidence: list[dict[str, Any]] = []
        if dictionary_entry:
            evidence.append({"source": "Kaikki.org French-Chinese dictionary", "uri": dictionary_entry.get("sourceUrl")})
        if lexique_entry:
            evidence.append({"source": "Lexique 4.00", "uri": lexique_entry.get("citation")})
        if flelex_entry:
            evidence.append({"source": "FLELex / Beacco", "uri": flelex_entry.get("citation")})
        if wiktionary_entry:
            evidence.append({"source": "Wiktionnaire francais via Kaikki.org", "uri": wiktionary_entry.get("citation")})
        entries.append({
            "id": entry_id(lemma, part_of_speech),
            "lemma": lemma,
            "normalizedLemma": key,
            "partOfSpeech": part_of_speech,
            "chineseGloss": (dictionary_entry or {}).get("chineseGloss"),
            "definitionFr": wiktionary_entry.get("definitionFr"),
            "ipa": wiktionary_entry.get("ipa") or lexique_entry.get("ipa"),
            "targetLevel": flelex_entry.get("level"),
            "frequency": round(float(lexique_entry.get("frequency") or flelex_entry.get("frequency") or 0)),
            "exampleFr": wiktionary_entry.get("exampleFr"),
            "exampleCitation": wiktionary_entry.get("exampleCitation"),
            "evidence": evidence,
            "status": "catalog_only",
            "studyReady": False,
        })

    payload = {
        "schemaVersion": 1,
        "sourceMode": "local-licensed-resources",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {"name": "Kaikki.org French-Chinese dictionary", "path": dictionary_path.name},
            {"name": "Lexique 4.00", "path": lexique_path.name},
            {"name": "FLELex / Beacco", "path": flelex_path.name},
            {"name": "Wiktionnaire francais via Kaikki.org", "path": wiktionary_path.name},
        ],
        "coverage": {
            "candidateLemmas": len(targets),
            "catalogEntries": len(entries),
            "withChineseGloss": sum(bool(item.get("chineseGloss")) for item in entries),
            "withFrenchDefinition": sum(bool(item.get("definitionFr")) for item in entries),
            "withCefrLevel": sum(bool(item.get("targetLevel")) for item in entries),
            "withExample": sum(bool(item.get("exampleFr")) for item in entries),
        },
        "entries": entries,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build a broad French catalog candidate artifact from local lexical resources.")
    parser.add_argument("--dictionary", type=Path, required=True)
    parser.add_argument("--lexique", type=Path, required=True)
    parser.add_argument("--flelex", type=Path, required=True)
    parser.add_argument("--wiktionary", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build_catalog(args.dictionary, args.lexique, args.flelex, args.wiktionary, args.output)
    print(json.dumps(result["coverage"], ensure_ascii=False))