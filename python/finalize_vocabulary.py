from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .lexical_resources import espeak_ipa, normalized


def finalize_dataset(dataset_path: Path, resource_path: Path, translation_path: Path, output_path: Path) -> dict[str, int]:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    resources = json.loads(resource_path.read_text(encoding="utf-8"))["entries"]
    translation_payload = json.loads(translation_path.read_text(encoding="utf-8"))
    translations = {item["occurrenceId"]: item for item in translation_payload.get("translations", []) if item.get("sentenceZh")}
    senses = {item["id"]: item for item in dataset.get("senses", [])}
    occurrences = {item["id"]: item for item in dataset.get("occurrences", [])}
    all_translations: list[dict[str, Any]] = []

    for lexeme in dataset.get("lexemes", []):
        resource = resources.get(normalized(lexeme["lemma"]), {})
        wiktionary = resource.get("wiktionary") or {}
        lexique = resource.get("lexique") or {}
        flelex = resource.get("flelex") or {}
        lexeme["ipa"] = lexeme.get("ipa") or wiktionary.get("ipa") or lexique.get("ipa") or espeak_ipa(lexeme["lemma"])
        lexeme["sourceFrequency"] = round(float(lexique.get("frequency") or lexeme.get("priority") or 0))
        lexeme["targetLevel"] = flelex.get("level") or "B2"
        lexeme["topicTags"] = wiktionary.get("topics") or []
        sense = lexeme["senses"][0]
        canonical = senses.get(sense["id"], sense)
        definition = canonical.get("definitionFr") or wiktionary.get("definitionFr")
        if definition:
            sense["definitionFr"] = definition
            canonical["definitionFr"] = definition
        definition_zh = canonical.get("definitionZh") or sense.get("definitionZh") or sense.get("chineseGloss")
        sense["definitionZh"] = definition_zh
        canonical["definitionZh"] = definition_zh
        evidence = sense.setdefault("evidence", {})
        evidence["lexicalSources"] = [item for item in (
            {key: wiktionary.get(key) for key in ("source", "license", "citation") if wiktionary.get(key)} if wiktionary else None,
            {key: lexique.get(key) for key in ("source", "license", "citation") if lexique.get(key)} if lexique else None,
            {key: flelex.get(key) for key in ("source", "license", "citation") if flelex.get(key)} if flelex else None,
        ) if item]
        canonical.setdefault("evidence", {}).update(evidence)
        for nested in lexeme.get("occurrences", []):
            occurrence = occurrences.get(nested["id"], nested)
            translated = translations.get(occurrence["id"])
            if translated:
                translation_id = translated.get("translationId") or f"translation:{occurrence['id']}"
                occurrence["sentenceTranslationId"] = translation_id
                occurrence["sentenceTranslation"] = translated["sentenceZh"]
                nested["sentenceTranslationId"] = translation_id
                nested["sentenceTranslation"] = translated["sentenceZh"]
                all_translations.append({
                    "id": translation_id,
                    "sentenceFr": occurrence["sentence"],
                    "sentenceZh": translated["sentenceZh"],
                    "provider": translated.get("provider", "unknown"),
                    "modelVersion": translated.get("modelVersion"),
                    "status": translated.get("translationStatus", "translated"),
                    "translatedAt": translated.get("translatedAt"),
                })

    entries_by_lexeme = {item["lexemeId"]: item for item in dataset.get("learningEntries", [])}
    for lexeme in dataset.get("lexemes", []):
        entry = entries_by_lexeme.get(lexeme["id"])
        if not entry:
            continue
        sense = senses.get(entry["senseId"], lexeme["senses"][0])
        occurrence = occurrences.get(entry["preferredOccurrenceId"])
        translated = translations.get(entry["preferredOccurrenceId"])
        entry["sentenceTranslationId"] = translated.get("translationId", f"translation:{entry['preferredOccurrenceId']}") if translated else entry.get("sentenceTranslationId")
        entry["targetLevel"] = lexeme.get("targetLevel")
        entry["sourceFrequency"] = lexeme.get("sourceFrequency", 0)
        reasons = []
        if not lexeme.get("ipa"): reasons.append("ipa")
        if not sense.get("definitionFr"): reasons.append("definition_fr")
        if not sense.get("definitionZh"): reasons.append("definition_zh")
        if not occurrence or not occurrence.get("sentence"): reasons.append("preferred_example_sentence_fr")
        if not translated: reasons.append("preferred_example_sentence_zh")
        entry["reviewReasons"] = reasons
        entry["status"] = "STUDY_READY" if not reasons else "ENRICHMENT_PENDING"

    dataset["sentenceTranslations"] = list({item["id"]: item for item in all_translations}.values())
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    total = len(dataset.get("lexemes", []))
    return {
        "total": total,
        "ipa": sum(bool(item.get("ipa")) for item in dataset.get("lexemes", [])),
        "definitionFr": sum(bool(item.get("definitionFr")) for item in dataset.get("senses", [])),
        "translations": len(dataset["sentenceTranslations"]),
        "studyReady": sum(item.get("status") == "STUDY_READY" for item in dataset.get("learningEntries", [])),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Finalize a vocabulary dataset from licensed resources and translations.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("resources", type=Path)
    parser.add_argument("translations", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(finalize_dataset(args.dataset, args.resources, args.translations, args.output), ensure_ascii=False))
