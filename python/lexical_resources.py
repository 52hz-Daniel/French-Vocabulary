from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import shutil
import subprocess
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


CONTENT_POS = {"noun", "verb", "adj", "adv", "adjective", "adverb", "prep", "preposition", "conj", "conjunction", "interj", "interjection"}


def normalized(value: str) -> str:
    return unicodedata.normalize("NFC", value.casefold().replace("’", "'")).strip()


def espeak_ipa(value: str) -> str | None:
    executable = shutil.which("espeak-ng") or shutil.which("espeak")
    if not executable:
        return None
    result = subprocess.run([executable, "-q", "--ipa", "-v", "fr-fr", value], capture_output=True, text=True, check=False)
    ipa = re.sub(r"\s+", " ", result.stdout).strip()
    return ipa or None


def _targets(paths: Iterable[Path]) -> set[str]:
    result: set[str] = set()
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        result.update(normalized(str(item["lemma"])) for item in payload.get("lexemes", []))
        result.update(normalized(str(item["word"])) for item in payload.get("entries", []))
    return result


def load_lexique(path: Path, targets: set[str]) -> dict[str, dict[str, Any]]:
    matches: dict[str, list[dict[str, str]]] = defaultdict(list)
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source, delimiter="\t"):
            key = normalized(row.get("4_Lemme", ""))
            if key in targets:
                matches[key].append(row)
    output: dict[str, dict[str, Any]] = {}
    for key, rows in matches.items():
        rows.sort(key=lambda row: (row.get("14_IsLem") != "1", -float(row.get("12_FreqLemme") or 0)))
        row = rows[0]
        output[key] = {
            "ipa": row.get("3_Phono_IPA") or None,
            "frequency": float(row.get("12_FreqLemme") or 0),
            "partOfSpeech": row.get("5_Cgram") or None,
            "gender": row.get("7_Genre") or None,
            "source": "Lexique 4.00",
            "license": "CC BY-SA 4.0",
            "citation": "https://www.lexique.org/",
        }
    return output


def load_flelex(path: Path, targets: set[str]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source, delimiter="\t"):
            key = normalized(row.get("word", ""))
            if key not in targets:
                continue
            candidate = {
                "level": row.get("level") or None,
                "frequency": float(row.get("freq_total") or 0),
                "partOfSpeech": row.get("tag") or None,
                "source": "FLELex / Beacco",
                "license": "CC BY-NC-SA 4.0",
                "citation": "https://cental.uclouvain.be/cefrlex/flelex/",
            }
            if key not in output or candidate["frequency"] > output[key]["frequency"]:
                output[key] = candidate
    return output


def _clean_definition(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^\([^)]*\)\s*", "", value)
    return value


def load_wiktionary(path: Path, targets: set[str]) -> dict[str, dict[str, Any]]:
    candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if record.get("lang_code") != "fr":
                continue
            key = normalized(str(record.get("word", "")))
            if key not in targets or record.get("pos") not in CONTENT_POS:
                continue
            definitions: list[str] = []
            examples: list[dict[str, str]] = []
            topics: list[str] = []
            for sense in record.get("senses", []):
                tags = set(sense.get("tags", []))
                if "form-of" in tags or sense.get("form_of"):
                    continue
                definitions.extend(_clean_definition(str(value)) for value in sense.get("glosses", []) if str(value).strip())
                topics.extend(str(value) for value in sense.get("topics", []) if str(value).strip())
                for example in sense.get("examples", []):
                    text = str(example.get("text", "")).strip()
                    if text and len(text) <= 500:
                        examples.append({"text": text, "citation": str(example.get("ref", "")).strip()})
            sounds = [str(sound.get("ipa", "")).strip(" \\/[]") for sound in record.get("sounds", []) if sound.get("ipa")]
            if definitions:
                candidates[key].append({
                    "word": record.get("word"),
                    "partOfSpeech": record.get("pos"),
                    "definitionFr": definitions[0],
                    "definitionsFr": list(dict.fromkeys(definitions[:4])),
                    "exampleFr": examples[0]["text"] if examples else None,
                    "exampleCitation": examples[0]["citation"] if examples else None,
                    "ipa": sounds[0] if sounds else None,
                    "topics": list(dict.fromkeys(topics[:8])),
                    "source": "Wiktionnaire français via Kaikki.org",
                    "license": "CC BY-SA / GFDL",
                    "citation": f"https://fr.wiktionary.org/wiki/{record.get('word', '')}",
                    "rawLine": line_number,
                })
    output: dict[str, dict[str, Any]] = {}
    for key, rows in candidates.items():
        rows.sort(key=lambda item: (not item.get("exampleFr"), not item.get("ipa"), len(item.get("definitionFr", ""))))
        output[key] = rows[0]
    return output


def build_index(target_paths: list[Path], lexique_path: Path, flelex_path: Path, wiktionary_path: Path, output_path: Path) -> dict[str, Any]:
    targets = _targets(target_paths)
    print(f"Indexing resources for {len(targets)} normalized target lemmas", flush=True)
    lexique = load_lexique(lexique_path, targets)
    flelex = load_flelex(flelex_path, targets)
    wiktionary = load_wiktionary(wiktionary_path, targets)
    entries = {key: {"lexique": lexique.get(key), "flelex": flelex.get(key), "wiktionary": wiktionary.get(key)} for key in sorted(targets)}
    payload = {
        "schemaVersion": 1,
        "sources": {
            "lexique": {"path": lexique_path.name, "license": "CC BY-SA 4.0"},
            "flelex": {"path": flelex_path.name, "license": "CC BY-NC-SA 4.0"},
            "wiktionary": {"path": wiktionary_path.name, "license": "CC BY-SA / GFDL"},
        },
        "entries": entries,
        "coverage": {"targets": len(targets), "lexique": len(lexique), "flelex": len(flelex), "wiktionary": len(wiktionary)},
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload["coverage"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build a target-only licensed French lexical resource index.")
    parser.add_argument("--target", action="append", type=Path, required=True)
    parser.add_argument("--lexique", type=Path, required=True)
    parser.add_argument("--flelex", type=Path, required=True)
    parser.add_argument("--wiktionary", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build_index(args.target, args.lexique, args.flelex, args.wiktionary, args.output), ensure_ascii=False))
