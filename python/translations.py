from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def build_translation_queue(dataset_path: Path, output_path: Path) -> None:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    queue: list[dict[str, Any]] = []
    for lexeme in dataset.get("lexemes", []):
        for occurrence in lexeme.get("occurrences", []):
            if occurrence.get("sentenceTranslation") or occurrence.get("sentenceTranslationId"):
                continue
            queue.append({
                "translationId": f"translation:{occurrence['id']}",
                "lexemeId": lexeme["id"],
                "occurrenceId": occurrence["id"],
                "sentenceFr": occurrence["sentence"],
                "sentenceZh": "",
                "provider": "pending",
                "modelVersion": "",
                "translationStatus": "pending",
                "translatedAt": None,
            })
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "translations": queue}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output_path} ({len(queue)} translations pending)")


def load_translation_cache(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {item["occurrenceId"]: item for item in payload.get("translations", []) if item.get("sentenceZh") and item.get("translationStatus") in {"translated", "source_provided"}}


def merge_translation_cache(dataset_path: Path, cache_path: Path, output_path: Path) -> None:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    cache = load_translation_cache(cache_path)
    translations: list[dict[str, Any]] = []
    for lexeme in dataset.get("lexemes", []):
        for occurrence in lexeme.get("occurrences", []):
            item = cache.get(occurrence["id"])
            if not item:
                continue
            occurrence["sentenceTranslation"] = item["sentenceZh"]
            occurrence["sentenceTranslationId"] = item["translationId"]
            translations.append({
                "id": item["translationId"],
                "sentenceFr": occurrence["sentence"],
                "sentenceZh": item["sentenceZh"],
                "provider": item["provider"],
                "modelVersion": item.get("modelVersion") or None,
                "status": item["translationStatus"],
                "translatedAt": item.get("translatedAt"),
            })
    dataset["schemaVersion"] = 2
    dataset["sentenceTranslations"] = translations
    translations_by_occurrence = {item["occurrenceId"]: item for item in cache.values()}
    for entry in dataset.get("learningEntries", []):
        occurrence = next((item for item in dataset.get("occurrences", []) if item["id"] == entry["preferredOccurrenceId"]), None)
        sense = next((item for item in dataset.get("senses", []) if item["id"] == entry["senseId"]), None)
        translation = translations_by_occurrence.get(entry["preferredOccurrenceId"])
        reasons = []
        if not sense or not sense.get("definitionFr"):
            reasons.append("definition_fr")
        if not sense or not sense.get("definitionZh"):
            reasons.append("definition_zh")
        if not occurrence or not occurrence.get("sentence"):
            reasons.append("preferred_example_sentence_fr")
        if not translation or not translation.get("sentenceZh"):
            reasons.append("preferred_example_sentence_zh")
        entry["status"] = "STUDY_READY" if not reasons else "ENRICHMENT_PENDING"
        entry["reviewReasons"] = reasons
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output_path} ({len(translations)} translations merged)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or merge persisted sentence translations.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    queue = subparsers.add_parser("queue")
    queue.add_argument("dataset", type=Path)
    queue.add_argument("output", type=Path)
    merge = subparsers.add_parser("merge")
    merge.add_argument("dataset", type=Path)
    merge.add_argument("cache", type=Path)
    merge.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.command == "queue":
        build_translation_queue(args.dataset, args.output)
    else:
        merge_translation_cache(args.dataset, args.cache, args.output)
