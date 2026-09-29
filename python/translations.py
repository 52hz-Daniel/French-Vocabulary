from __future__ import annotations

import argparse
import json
import os
import sys
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


def translate_offline(queue_path: Path, runtime_path: Path, models_path: Path, data_path: Path) -> None:
    """Fill a translation queue with pinned local Argos models via fr→en→zh."""
    sys.path.insert(0, str(runtime_path.resolve()))
    os.environ["XDG_DATA_HOME"] = str((data_path / "share").resolve())
    os.environ["XDG_CONFIG_HOME"] = str((data_path / "config").resolve())
    os.environ["XDG_CACHE_HOME"] = str((data_path / "cache").resolve())
    os.environ["ARGOS_PACKAGES_DIR"] = str((data_path / "packages").resolve())
    os.environ["ARGOS_STANZA_AVAILABLE"] = "0"
    os.environ["ARGOS_CHUNK_TYPE"] = "MINISBD"
    from argostranslate import package, translate

    installed = {(item.from_code, item.to_code) for item in package.get_installed_packages()}
    for source_code, target_code, filename in (
        ("fr", "en", "translate-fr_en-1_9.argosmodel"),
        ("en", "zh", "translate-en_zh-1_9.argosmodel"),
    ):
        if (source_code, target_code) not in installed:
            model = models_path / filename
            if not model.exists():
                raise RuntimeError(f"Missing offline translation model: {model}")
            package.install_from_path(model)
    french = translate.get_translation_from_codes("fr", "en")
    chinese = translate.get_translation_from_codes("en", "zh")
    if french is None or chinese is None:
        raise RuntimeError("Argos French→English→Chinese translation chain is unavailable")
    class SingleSentence:
        def split_sentences(self, text: str) -> list[str]:
            return [text]
    def disable_external_sbd(item: Any, seen: set[int] | None = None) -> None:
        seen = seen or set()
        if id(item) in seen:
            return
        seen.add(id(item))
        if hasattr(item, "sentencizer"):
            item.sentencizer = SingleSentence()
        for attribute in ("underlying", "t1", "t2"):
            child = getattr(item, attribute, None)
            if child is not None:
                disable_external_sbd(child, seen)
    disable_external_sbd(french)
    disable_external_sbd(chinese)

    payload = json.loads(queue_path.read_text(encoding="utf-8"))
    translations = payload.get("translations", [])
    cache: dict[str, str] = {}
    for index, item in enumerate(translations, start=1):
        if item.get("sentenceZh"):
            continue
        sentence = str(item.get("sentenceFr", "")).strip()
        if not sentence:
            continue
        translated = cache.get(sentence)
        if translated is None:
            translated = chinese.translate(french.translate(sentence)).strip()
            cache[sentence] = translated
        if translated:
            item.update({
                "sentenceZh": translated,
                "provider": "Argos Translate (fr-en 1.9 + en-zh 1.9)",
                "modelVersion": "argos-fr_en-1.9+en_zh-1.9",
                "translationStatus": "translated",
                "translatedAt": datetime.now(timezone.utc).isoformat(),
            })
        if index % 25 == 0:
            queue_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Translated {index}/{len(translations)}", flush=True)
    queue_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    completed = sum(bool(item.get("sentenceZh")) for item in translations)
    print(f"Wrote {queue_path} ({completed}/{len(translations)} translated)")


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
    offline = subparsers.add_parser("offline")
    offline.add_argument("queue", type=Path)
    offline.add_argument("--runtime", type=Path, default=Path("reference-private/python"))
    offline.add_argument("--models", type=Path, default=Path("reference-private/argos/models"))
    offline.add_argument("--data", type=Path, default=Path("reference-private/argos/runtime"))
    args = parser.parse_args()
    if args.command == "queue":
        build_translation_queue(args.dataset, args.output)
    elif args.command == "merge":
        merge_translation_cache(args.dataset, args.cache, args.output)
    else:
        translate_offline(args.queue, args.runtime, args.models, args.data)
