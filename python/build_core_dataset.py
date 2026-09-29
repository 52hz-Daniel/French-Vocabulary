from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .lexical_resources import espeak_ipa, normalized
from .morphalou import MorphalouIndex


def identifier(value: str) -> str:
    readable = re.sub(r"[^a-z0-9]+", "-", normalized(value)).strip("-")[:45] or "word"
    return f"{readable}-{hashlib.sha1(value.encode('utf-8')).hexdigest()[:8]}"


def source_example(entry: dict[str, Any]) -> tuple[str | None, str | None]:
    word_key = normalized(entry["word"])
    candidates: list[str] = []
    for row in entry.get("sourceRows", []):
        detail = str(row.get("ocrDetail", ""))
        fragments = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ'’ -]{12,}", detail)
        candidates.extend(re.sub(r"\s+", " ", value).strip(" ,.;:=") for value in fragments)
    candidates = [value for value in candidates if len(value.split()) >= 3 and word_key in normalized(value)]
    return (candidates[0], "TEF/TCF Core Vocabulary PDF") if candidates else (None, None)


def build_core_dataset(clean_path: Path, resource_path: Path, morphalou_path: Path, output_path: Path) -> dict[str, int]:
    clean = json.loads(clean_path.read_text(encoding="utf-8"))
    resources = json.loads(resource_path.read_text(encoding="utf-8"))["entries"]
    lexemes: list[dict[str, Any]] = []
    senses: list[dict[str, Any]] = []
    occurrences: list[dict[str, Any]] = []
    learning_entries: list[dict[str, Any]] = []
    with MorphalouIndex(morphalou_path) as morphalou:
        for position, entry in enumerate(clean["entries"], start=1):
            word = entry["word"]
            key = normalized(word)
            resource = resources.get(key, {})
            wiktionary = resource.get("wiktionary") or {}
            lexique = resource.get("lexique") or {}
            flelex = resource.get("flelex") or {}
            definition_fr = wiktionary.get("definitionFr")
            chinese = entry.get("chineseGloss")
            ipa = wiktionary.get("ipa") or lexique.get("ipa") or espeak_ipa(word)
            part = entry.get("partOfSpeech")
            if part == "unknown":
                part = wiktionary.get("partOfSpeech") or "noun"
            example_fr = wiktionary.get("exampleFr")
            example_source = wiktionary.get("source") if example_fr else None
            example_citation = wiktionary.get("exampleCitation") if example_fr else None
            if not example_fr:
                example_fr, example_source = source_example(entry)
            if not example_fr and definition_fr:
                example_fr = f"Dans ce contexte, « {word} » signifie : {definition_fr[0].lower() + definition_fr[1:]}"
                example_source = "Deterministic pedagogical fallback"
            slug = identifier(word)
            lexeme_id = f"core-{slug}"
            sense_id = f"{lexeme_id}-sense-1"
            occurrence_id = f"{lexeme_id}-example-1"
            analyses = [item for item in morphalou.lookup(word) if item.get("category") in {"commonNoun", "adjective", "adverb", "verb"}]
            forms = [{k: row[k] for k in ("surface", "lemma", "category", "number", "mood", "tense", "person", "inflection_gender") if row.get(k) not in (None, "-")} for row in analyses]
            conjugations = [{k: row[k] for k in ("surface", "lemma", "category", "number", "mood", "tense", "person", "inflection_gender") if row.get(k) not in (None, "-")} for row in (morphalou.conjugations(word) if part == "verb" else [])]
            evidence = {
                "sourceType": "curriculum",
                "sourceLabel": "TEF/TCF Core Vocabulary PDF",
                "verification": "auto_validated",
                "confidence": 0.95,
                "sourceId": "source:tef-tcf-core-pdf",
                "sourceRows": [{"page": row["page"], "row": row["row"], "bounds": row.get("sourceBounds"), "glossSource": row.get("glossSource")} for row in entry.get("sourceRows", [])],
                "lexicalSources": [item for item in (
                    {k: wiktionary.get(k) for k in ("source", "license", "citation") if wiktionary.get(k)} if wiktionary else None,
                    {k: lexique.get(k) for k in ("source", "license", "citation") if lexique.get(k)} if lexique else None,
                    {k: flelex.get(k) for k in ("source", "license", "citation") if flelex.get(k)} if flelex else None,
                ) if item],
            }
            sense = {"id": sense_id, "partOfSpeech": part, "chineseGloss": chinese, "definitionZh": chinese, "definitionFr": definition_fr, "synonyms": [], "evidence": evidence}
            occurrence = {
                "id": occurrence_id,
                "surfaceForm": word,
                "sentence": example_fr,
                "sourceDocument": example_source or "missing-example",
                "sourceReference": example_citation or example_source or "missing example",
                "lemma": word,
                "partOfSpeech": part,
                "evidence": {"sourceType": "dictionary" if wiktionary.get("exampleFr") else "manual_review", "sourceLabel": example_source or "missing", "verification": "auto_validated", "confidence": .9 if wiktionary.get("exampleFr") else .7},
            }
            lexemes.append({
                "id": lexeme_id, "lemma": word, "ipa": ipa, "partOfSpeech": part,
                "priority": max(1, len(clean["entries"]) - position + 1), "collectionIds": ["tef-tcf-core"],
                "sourceFrequency": round(float(lexique.get("frequency") or 0)), "targetLevel": flelex.get("level") or "B2",
                "topicTags": wiktionary.get("topics") or [], "morphologyAnalyses": forms, "conjugations": conjugations,
                "senses": [sense], "occurrences": [occurrence], "sourceRows": entry.get("sourceRows", []),
            })
            senses.append(sense)
            occurrences.append(occurrence)
            reasons = [name for name, value in (("ipa", ipa), ("definition_fr", definition_fr), ("definition_zh", chinese), ("preferred_example_sentence_fr", example_fr)) if not value]
            learning_entries.append({
                "id": f"learning:{lexeme_id}", "sourceId": "source:tef-tcf-core-pdf", "lexemeId": lexeme_id, "senseId": sense_id,
                "preferredOccurrenceId": occurrence_id, "sentenceTranslationId": f"translation:{occurrence_id}",
                "status": "ENRICHMENT_PENDING", "priority": len(clean["entries"]) - position + 1,
                "sourceFrequency": round(float(lexique.get("frequency") or 0)), "targetLevel": flelex.get("level") or "B2",
                "collectionIds": ["tef-tcf-core"], "reviewReasons": reasons + ["preferred_example_sentence_zh"],
            })
    payload = {
        "schemaVersion": 2, "sourceMode": "private", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "collections": [{"id": "tef-tcf-core", "name": "TEF/TCF Core Vocabulary", "description": "Cleaned bilingual core vocabulary from the source PDF", "kind": "exam", "itemCount": len(lexemes), "available": True}],
        "sources": [{"id": "source:tef-tcf-core-pdf", "kind": "exam", "label": "TEF/TCF Core Vocabulary PDF", "uri": "local://vocabulary resources/TEF:TCF core-vocabulary.pdf"}],
        "lexemes": lexemes, "senses": senses, "occurrences": occurrences, "sentenceTranslations": [], "learningEntries": learning_entries,
        "reconciliation": clean.get("reconciliation", {}),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"lexemes": len(lexemes), "definitions": sum(bool(item.get("definitionFr")) for item in senses), "ipa": sum(bool(item.get("ipa")) for item in lexemes), "examples": sum(bool(item.get("sentence")) for item in occurrences), "chineseGlosses": sum(bool(item.get("definitionZh")) for item in senses)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the complete TEF/TCF Core production dataset.")
    parser.add_argument("clean", type=Path)
    parser.add_argument("resources", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--morphalou", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build_core_dataset(args.clean, args.resources, args.morphalou, args.output), ensure_ascii=False))
