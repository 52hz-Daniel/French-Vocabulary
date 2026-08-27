from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .candidates import extract_candidate_words
from .dictionary import is_content_entry, load_french_chinese_dictionary, lookup_french_chinese
from .morphalou import MorphalouIndex


def build_production_dataset(source_dir: Path, dictionary_path: Path, reviewed_path: Path | None = None, morphalou_path: Path | None = None) -> dict:
    dictionary = load_french_chinese_dictionary(dictionary_path)
    reviewed = json.loads(reviewed_path.read_text(encoding="utf-8")) if reviewed_path else []
    reviewed_by_surface = {str(record["surface"]).casefold(): record for record in reviewed}
    lexemes = []
    morphalou = MorphalouIndex(morphalou_path) if morphalou_path else None
    try:
        for position, candidate in enumerate(extract_candidate_words(source_dir)):
            surface = str(candidate["surface"])
            analyses = morphalou.lookup(surface) if morphalou else []
            lexical_analyses = [item for item in analyses if item["category"] in {"commonNoun", "adjective", "adverb", "verb"}]
            lemma_candidates = {item["lemma"] for item in lexical_analyses}
            if len(lemma_candidates) > 1:
                continue
            lemma = next(iter(lemma_candidates), surface)
            dictionary_meaning = lookup_french_chinese(dictionary, lemma) or lookup_french_chinese(dictionary, surface)
            meaning = dictionary_meaning if dictionary_meaning and is_content_entry(dictionary_meaning) else reviewed_by_surface.get(surface) or reviewed_by_surface.get(lemma)
            if not meaning or ("partOfSpeech" in meaning and not is_content_entry(meaning)):
                continue
            occurrence = candidate["occurrences"][0]
            if not isinstance(occurrence, dict):
                continue
            lexeme_id = f"listening-{lemma.replace(' ', '-') }".replace("'", "")
            pos = str(meaning["partOfSpeech"])
            lexemes.append({
                "id": lexeme_id,
                "lemma": lemma,
                "ipa": meaning.get("ipa"),
                "partOfSpeech": pos,
                "priority": int(candidate["frequency"]),
                "collectionIds": ["tcf-listening"],
                "morphologyAnalyses": [{key: item[key] for key in ("surface", "lemma", "category", "number", "mood", "tense", "person", "inflection_gender") if item.get(key) is not None} for item in lexical_analyses],
                "conjugations": [{key: item[key] for key in ("surface", "lemma", "category", "number", "mood", "tense", "person", "inflection_gender") if item.get(key) not in (None, "-")} for item in (morphalou.conjugations(lemma) if morphalou and pos == "verb" else [])],
                "senses": [{
                    "id": f"{lexeme_id}-sense-1",
                    "partOfSpeech": pos,
                    "chineseGloss": meaning["chineseGloss"],
                    "synonyms": [],
                    "evidence": {
                        "sourceType": "dictionary" if "sourceLabel" in meaning else "manual_review",
                        "sourceLabel": f"{meaning.get('sourceLabel', 'Local reviewed-senses.json')} · {meaning.get('sourceUrl', 'local source')}",
                        "verification": "verified",
                        "confidence": 1,
                    },
                }],
                "occurrences": [{
                    "id": f"{lexeme_id}-occurrence-{occurrence['sourceDocument']}-{occurrence['paragraphIndex']}-{surface}".replace(" ", "-").replace("'", ""),
                    "surfaceForm": surface,
                    "sentence": occurrence["sentence"],
                    "sourceText": occurrence.get("sourceText"),
                    "sourceDocument": occurrence["sourceDocument"],
                    "sourceReference": f"Listening corpus · {occurrence['sourceDocument']} · paragraph {occurrence['paragraphIndex']}",
                    "lemma": lemma,
                    "partOfSpeech": pos,
                    "evidence": {
                        "sourceType": "exam",
                        "sourceLabel": "Local listening transcript",
                        "verification": "verified",
                        "confidence": 1,
                    },
                }],
            })
    finally:
        if morphalou:
            morphalou.close()
    merged: dict[str, dict] = {}
    for lexeme in lexemes:
        current = merged.get(lexeme["id"])
        if current is None:
            merged[lexeme["id"]] = lexeme
            continue
        current["occurrences"].extend(lexeme["occurrences"])
        current["morphologyAnalyses"] = current.get("morphologyAnalyses", []) + [item for item in lexeme.get("morphologyAnalyses", []) if item not in current.get("morphologyAnalyses", [])]
        current["conjugations"] = current.get("conjugations", []) or lexeme.get("conjugations", [])
    source_id = "source:tcf-listening-corpus"
    sources = [{
        "id": source_id,
        "kind": "exam",
        "label": "TCF listening corpus",
        "uri": "local://vocabulary resources/听力文本（42套）",
    }]
    senses = []
    occurrences = []
    learning_entries = []
    for lexeme in merged.values():
        sense = lexeme["senses"][0]
        sense = {**sense, "definitionZh": sense["chineseGloss"]}
        senses.append(sense)
        for occurrence in lexeme["occurrences"]:
            occurrence["evidence"] = {**occurrence["evidence"], "sourceId": source_id}
            occurrences.append(occurrence)
        preferred = lexeme["occurrences"][0]
        learning_entries.append({
            "id": f"learning:{lexeme['id']}",
            "sourceId": source_id,
            "lexemeId": lexeme["id"],
            "senseId": sense["id"],
            "preferredOccurrenceId": preferred["id"],
            "sentenceTranslationId": f"translation:{preferred['id']}",
            "status": "ENRICHMENT_PENDING",
            "priority": lexeme["priority"],
            "collectionIds": lexeme["collectionIds"],
            "reviewReasons": ["definition_fr", "preferred_example_sentence_zh"],
        })
    return {
        "schemaVersion": 2,
        "sourceMode": "private",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "collections": [{
            "id": "tcf-listening",
            "name": "TCF Listening",
            "description": "Listening words with direct source sentences and Kaikki Chinese senses",
            "kind": "exam",
            "itemCount": len(merged),
            "available": True,
        }],
        "lexemes": list(merged.values()),
        "sources": sources,
        "senses": senses,
        "occurrences": occurrences,
        "sentenceTranslations": [],
        "learningEntries": learning_entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote listening candidates with Kaikki Chinese senses into production data.")
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("dictionary", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--reviewed", type=Path)
    parser.add_argument("--morphalou", type=Path)
    args = parser.parse_args()
    output = build_production_dataset(args.source_dir, args.dictionary, args.reviewed, args.morphalou)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.output} ({len(output['lexemes'])} items)")


if __name__ == "__main__":
    main()
