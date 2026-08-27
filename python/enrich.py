from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_USER_AGENT = "TCFVocabularyLab/0.1 educational local tool"
WIKTIONARY_API = "https://fr.wiktionary.org/w/api.php"
MYMEMORY_API = "https://api.mymemory.translated.net/get"


def _request_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": API_USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def french_definition(lemma: str) -> dict[str, Any] | None:
    query = urllib.parse.urlencode({"action": "query", "prop": "extracts", "explaintext": "1", "titles": lemma, "format": "json", "formatversion": "2"})
    page = _request_json(f"{WIKTIONARY_API}?{query}").get("query", {}).get("pages", [{}])[0]
    extract = str(page.get("extract", ""))
    section = re.search(r"=== (?:Nom|Nom commun|Verbe|Adjectif(?: qualificatif)?|Adverbe|Interjection|Pronom|Déterminant|Préposition|Conjonction|Article|Numéral|Nombre) ===\s*(.*?)(?=\n=== |\Z)", extract, re.S)
    if not section:
        return None
    lines = [re.sub(r"\n+", " ", line).strip() for line in section.group(1).splitlines()]
    definition = next((line for line in lines if line and not line.startswith(("====", "Prononciation", "Étymologie", "Dérivés", "Voir aussi", "Synonymes", "Antonymes")) and not line.startswith(lemma) and not any(token in line for token in ("\\\\", "transitif", "intransitif", "conjugaison"))), None)
    if not definition:
        return None
    return {"definitionFr": definition[:1200], "sourceLabel": "French Wiktionary API", "sourceUrl": f"https://fr.wiktionary.org/wiki/{urllib.parse.quote(lemma)}"}


def french_definitions(lemmas: list[str]) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for start in range(0, len(lemmas), 50):
        titles = "|".join(lemmas[start:start + 50])
        query = urllib.parse.urlencode({"action": "query", "prop": "extracts", "explaintext": "1", "titles": titles, "format": "json", "formatversion": "2"})
        try:
            pages = _request_json(f"{WIKTIONARY_API}?{query}").get("query", {}).get("pages", [])
        except Exception as error:
            for lemma in lemmas[start:start + 50]:
                results[lemma] = {"status": "error", "error": str(error)}
            continue
        for page in pages:
            lemma = str(page.get("title", ""))
            extract = str(page.get("extract", ""))
            section = re.search(r"=== (?:Nom|Nom commun|Verbe|Adjectif(?: qualificatif)?|Adverbe|Interjection|Pronom|Déterminant|Préposition|Conjonction|Article|Numéral|Nombre) ===\s*(.*?)(?=\n=== |\Z)", extract, re.S)
            lines = [re.sub(r"\n+", " ", line).strip() for line in section.group(1).splitlines()] if section else []
            definition = next((line for line in lines if line and not line.startswith(("====", "Prononciation", "Étymologie", "Dérivés", "Voir aussi", "Synonymes", "Antonymes")) and not line.startswith(lemma) and not any(token in line for token in ("\\\\", "transitif", "intransitif", "conjugaison"))), None)
            results[lemma] = {"definitionFr": definition[:1200], "sourceLabel": "French Wiktionary API", "sourceUrl": f"https://fr.wiktionary.org/wiki/{urllib.parse.quote(lemma)}"} if definition else {"status": "not_found"}
        time.sleep(2)
    return results


def translate_sentence(sentence: str) -> dict[str, Any] | None:
    query = urllib.parse.urlencode({"q": sentence, "langpair": "fr|zh-CN"})
    response = _request_json(f"{MYMEMORY_API}?{query}")
    text = str(response.get("responseData", {}).get("translatedText", "")).strip()
    if not text or text == sentence:
        return None
    return {"sentenceZh": text, "provider": "MyMemory", "modelVersion": "public-api", "status": "translated", "translatedAt": datetime.now(timezone.utc).isoformat()}


def enrich_dataset(dataset_path: Path, output_path: Path, cache_path: Path, definitions_only: bool = False, translations_only: bool = False) -> tuple[int, int]:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {"definitions": {}, "translations": {}}
    if isinstance(cache.get("translations"), list):
        cache["translations"] = {item["occurrenceId"]: item for item in cache["translations"]}
    definitions = cache.setdefault("definitions", {})
    translations = cache.setdefault("translations", {})
    def save_cache() -> None:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    lemmas = sorted({lexeme["lemma"] for lexeme in dataset.get("lexemes", [])})
    if not translations_only:
        missing_lemmas = [lemma for lemma in lemmas if not definitions.get(lemma, {}).get("definitionFr")]
        definitions.update(french_definitions(missing_lemmas))
        save_cache()
    occurrences = {item["id"]: item for item in dataset.get("occurrences", [])}
    for lexeme in dataset.get("lexemes", []):
        definition = definitions.get(lexeme["lemma"], {})
        sense = lexeme["senses"][0]
        if definition.get("definitionFr"):
            sense["definitionFr"] = definition["definitionFr"]
            sense["definitionZh"] = sense.get("definitionZh") or sense.get("chineseGloss")
            sense["evidence"]["sourceLabel"] += f"; French definition: {definition['sourceLabel']}"
    missing = [occurrence for occurrence in occurrences.values() if not definitions_only and not translations.get(occurrence["id"], {}).get("sentenceZh") and translations.get(occurrence["id"], {}).get("status") != "error"]
    with ThreadPoolExecutor(max_workers=1) as executor:
        translation_jobs = {executor.submit(translate_sentence, occurrence["sentence"]): occurrence for occurrence in missing}
        for job in as_completed(translation_jobs):
            occurrence = translation_jobs[job]
            try:
                translation = job.result()
            except Exception as error:
                translation = {"status": "error", "error": str(error)}
            translations[occurrence["id"]] = {"occurrenceId": occurrence["id"], "sentenceFr": occurrence["sentence"], "translationStatus": "not_found"} if not translation else {"occurrenceId": occurrence["id"], "sentenceFr": occurrence["sentence"], "translationStatus": translation["status"], **translation}
            save_cache()
    for occurrence in occurrences.values():
        translation = translations.get(occurrence["id"], {})
        if translation.get("sentenceZh"):
            occurrence["sentenceTranslation"] = translation["sentenceZh"]
            occurrence["sentenceTranslationId"] = f"translation:{occurrence['id']}"
    for lexeme in dataset.get("lexemes", []):
        for occurrence in lexeme.get("occurrences", []):
            normalized = occurrences.get(occurrence["id"], occurrence)
            if normalized.get("sentenceTranslationId"):
                occurrence["sentenceTranslationId"] = normalized["sentenceTranslationId"]
                occurrence["sentenceTranslation"] = normalized.get("sentenceTranslation")
    dataset["schemaVersion"] = 2
    dataset["sentenceTranslations"] = [{"id": f"translation:{item['occurrenceId']}", "sentenceFr": item["sentenceFr"], "sentenceZh": item["sentenceZh"], "provider": item["provider"], "modelVersion": item.get("modelVersion"), "status": item["translationStatus"], "translatedAt": item.get("translatedAt"), "sourceId": dataset.get("sources", [{}])[0].get("id")} for item in translations.values() if item.get("sentenceZh") and item.get("sentenceFr")]
    for entry in dataset.get("learningEntries", []):
        sense = next((item for item in dataset.get("senses", []) if item["id"] == entry["senseId"]), None)
        if sense:
            source_sense = next((item["senses"][0] for item in dataset["lexemes"] if item["id"] == entry["lexemeId"]), None)
            if source_sense:
                sense.update({key: source_sense[key] for key in ("definitionFr", "definitionZh") if key in source_sense})
        occurrence = occurrences.get(entry["preferredOccurrenceId"])
        translation = translations.get(entry["preferredOccurrenceId"], {})
        reasons = []
        if not sense or not sense.get("definitionFr"): reasons.append("definition_fr")
        if not sense or not sense.get("definitionZh"): reasons.append("definition_zh")
        if not occurrence or not occurrence.get("sentence"): reasons.append("preferred_example_sentence_fr")
        if not translation.get("sentenceZh"): reasons.append("preferred_example_sentence_zh")
        entry["status"] = "STUDY_READY" if not reasons else "ENRICHMENT_PENDING"
        entry["reviewReasons"] = reasons
    save_cache()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    return sum(bool(item.get("definitionFr")) for item in definitions.values()), sum(bool(item.get("sentenceZh")) for item in translations.values())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch-persist French definitions and Chinese sentence translations.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("cache", type=Path)
    parser.add_argument("--definitions-only", action="store_true")
    parser.add_argument("--translations-only", action="store_true")
    args = parser.parse_args()
    definitions, translations = enrich_dataset(args.dataset, args.output, args.cache, args.definitions_only, args.translations_only)
    print(f"Enriched definitions={definitions} translations={translations}")
