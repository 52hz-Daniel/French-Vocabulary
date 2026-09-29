from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .dictionary import load_french_chinese_dictionary, lookup_french_chinese
from .lexical_resources import normalized


POS_MAP = {
    "nom": "noun", "n": "noun", "nm": "noun", "nf": "noun",
    "verb": "verb", "v": "verb", "vt": "verb", "vi": "verb",
    "adj": "adjective", "adjectif": "adjective",
    "adv": "adverb", "adverbe": "adverb",
}
CORRECTION_OVERRIDES = {
    "mœurs": "mœurs", "surchargé": "surchargé", "ouer": "louer",
    "nausse": "hausse", "œuvvre": "œuvre", "entrainer": "entraîner",
    "instar à l'instar de": "à l'instar de",
}
POS_OVERRIDES = {
    "formation": "noun", "à l'instar de": "preposition", "œuvre": "noun",
    "puissance": "noun", "s'efforcer": "verb", "fonctionner": "verb",
    "fréquenter": "verb", "louer": "verb", "mettre au point": "verb",
    "occasion": "noun", "au sein de": "preposition", "entraîner": "verb", "hausse": "noun",
}
GLOSS_OVERRIDES = {
    "conscience": "意识；良心", "militantisme": "积极活动；斗争精神",
    "susceptible": "易受影响的；敏感的；可能的", "accueillir": "接待；欢迎",
}
REJECTED_HEADWORDS = {"une douleur aiguë"}


def pos_from(value: str | None) -> str | None:
    compact = re.sub(r"[^a-z]", "", (value or "").casefold())
    for prefix, result in sorted(POS_MAP.items(), key=lambda item: -len(item[0])):
        if compact.startswith(prefix):
            return result
    return None


def edit_distance(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, start=1):
        current = [i]
        for j, b in enumerate(right, start=1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = current
    return previous[-1]


def lexique_lemmas(path: Path) -> tuple[dict[str, str], dict[str, str]]:
    lemmas: dict[str, str] = {}
    parts: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source, delimiter="\t"):
            lemma = row.get("4_Lemme", "").strip()
            key = normalized(lemma)
            if not key:
                continue
            if row.get("14_IsLem") == "1" or key not in lemmas:
                lemmas[key] = lemma
                parts[key] = pos_from(row.get("5_Cgram")) or parts.get(key, "")
    return lemmas, parts


def best_correction(word: str, vocabulary: dict[str, str], buckets: dict[tuple[str, int], list[str]]) -> tuple[str, int] | None:
    key = normalized(word)
    if key in vocabulary:
        return vocabulary[key], 0
    candidates: list[tuple[int, str]] = []
    for size in range(max(2, len(key) - 2), len(key) + 3):
        for candidate in buckets.get((key[:1], size), []):
            distance = edit_distance(key, candidate)
            limit = 1 if len(key) < 8 else 2
            if distance <= limit:
                candidates.append((distance, candidate))
    candidates.sort(key=lambda item: (item[0], item[1]))
    if not candidates or (len(candidates) > 1 and candidates[0][0] == candidates[1][0]):
        return None
    return vocabulary[candidates[0][1]], candidates[0][0]


def clean_core(review_path: Path, lexique_path: Path, dictionary_path: Path, output_path: Path) -> dict[str, int]:
    review = json.loads(review_path.read_text(encoding="utf-8"))["entries"]
    lemmas, lexique_pos = lexique_lemmas(lexique_path)
    dictionary = load_french_chinese_dictionary(dictionary_path)
    vocabulary = dict(lemmas)
    for key, entry in dictionary.items():
        vocabulary.setdefault(normalized(key), str(entry["word"]))
    buckets: dict[tuple[str, int], list[str]] = defaultdict(list)
    for key in vocabulary:
        buckets[(key[:1], len(key))].append(key)

    cleaned_rows: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for row in review:
        original = str(row["word"])
        correction = best_correction(original, vocabulary, buckets)
        corrected = CORRECTION_OVERRIDES.get(original.casefold(), correction[0] if correction else original.casefold())
        key = normalized(corrected)
        dictionary_entry = lookup_french_chinese(dictionary, corrected)
        part = POS_OVERRIDES.get(corrected) or pos_from(row.get("ocrPartOfSpeech")) or (str(dictionary_entry.get("partOfSpeech")) if dictionary_entry else None) or lexique_pos.get(key)
        gloss = str(row.get("ocrChineseGloss", "")).strip() or (str(dictionary_entry.get("chineseGloss", "")) if dictionary_entry else "") or GLOSS_OVERRIDES.get(corrected, "")
        # Unknown short OCR fragments with neither lexical evidence nor a POS are not headwords.
        if original.casefold() in REJECTED_HEADWORDS or (not part and not gloss):
            rejected.append({**row, "reason": "not_a_lexical_headword"})
            continue
        cleaned_rows.append({
            **row,
            "word": corrected,
            "normalizedWord": key,
            "partOfSpeech": part or "unknown",
            "chineseGloss": gloss,
            "correction": {"original": original, "distance": correction[1]} if correction and corrected.casefold() != original.casefold() else None,
            "lexicalValidation": "exact" if correction and correction[1] == 0 else ("fuzzy_corrected" if correction else "source_only"),
        })

    grouped: dict[str, dict[str, Any]] = {}
    for row in cleaned_rows:
        current = grouped.get(row["normalizedWord"])
        if current is None:
            grouped[row["normalizedWord"]] = {
                "word": row["word"],
                "normalizedWord": row["normalizedWord"],
                "partOfSpeech": row["partOfSpeech"],
                "chineseGloss": row["chineseGloss"],
                "sourceRows": [row],
            }
            continue
        current["sourceRows"].append(row)
        if (not current["chineseGloss"] or row.get("glossSource") == "source_pdf") and row["chineseGloss"]:
            current["chineseGloss"] = row["chineseGloss"]
        if current["partOfSpeech"] == "unknown" and row["partOfSpeech"] != "unknown":
            current["partOfSpeech"] = row["partOfSpeech"]

    payload = {
        "schemaVersion": 1,
        "sourceMode": "tef-tcf-core-clean",
        "entries": sorted(grouped.values(), key=lambda item: (min(row["page"] for row in item["sourceRows"]), min(row["row"] for row in item["sourceRows"]))),
        "rejectedRows": rejected,
        "reconciliation": {
            "ocrReviewRows": len(review),
            "acceptedRows": len(cleaned_rows),
            "uniqueHeadwords": len(grouped),
            "rejectedRows": len(rejected),
            "correctedRows": sum(bool(row.get("correction")) for row in cleaned_rows),
            "missingChineseGloss": sum(not item["chineseGloss"] for item in grouped.values()),
            "missingPartOfSpeech": sum(item["partOfSpeech"] == "unknown" for item in grouped.values()),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload["reconciliation"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean and reconcile row-aware TEF/TCF Core OCR.")
    parser.add_argument("review", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--lexique", type=Path, required=True)
    parser.add_argument("--dictionary", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(clean_core(args.review, args.lexique, args.dictionary, args.output), ensure_ascii=False))
