import zipfile
import json
from pathlib import Path

from python.candidates import analyze_candidates, extract_candidate_words
from python.dictionary import is_content_entry, load_french_chinese_dictionary, lookup_french_chinese
from python.ocr_candidates import parse_ocr_entries
from python.morphalou import MorphalouIndex, build_index, lookup_json
from python.promote import build_production_dataset
from python.translations import build_translation_queue, merge_translation_cache
from python.ingest import context_sentence, extract_numbered_blocks


def test_french_tokenization_and_exact_source_preservation(tmp_path: Path):
    source = tmp_path / "fixture.docx"
    xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>1-1.</w:t></w:r></w:p><w:p><w:r><w:t>Aussitôt qu'il arrive, écoutez-le !</w:t></w:r></w:p>
    </w:body></w:document>"""
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("word/document.xml", xml)
    blocks = extract_numbered_blocks(source)
    assert blocks[0].question_id == "1-1"
    assert blocks[0].exact_text == "Aussitôt qu'il arrive, écoutez-le !"


def test_context_sentence_keeps_only_sentence_containing_surface():
    text = "Bonjour, je cherche ce courrier. La poste est à gauche. Merci beaucoup !"
    assert context_sentence(text, "courrier") == "Bonjour, je cherche ce courrier."


def test_candidate_queue_excludes_common_function_words(tmp_path: Path):
    source = tmp_path / "CO 1.docx"
    xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>1-1.</w:t></w:r></w:p><w:p><w:r><w:t>Je cherche une solution pratique.</w:t></w:r></w:p>
    </w:body></w:document>"""
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("word/document.xml", xml)
    words = extract_candidate_words(tmp_path)
    surfaces = {item["surface"] for item in words}
    assert "solution" in surfaces
    assert "cherche" in surfaces
    assert "une" not in surfaces
    solution = next(item for item in words if item["surface"] == "solution")
    assert solution["occurrences"][0]["sourceText"] == "Je cherche une solution pratique."


def test_candidate_analysis_labels_sentence_and_reviewed_meaning(tmp_path: Path):
    source = tmp_path / "CO 1.docx"
    xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>1-1.</w:t></w:r></w:p><w:p><w:r><w:t>Je cherche une solution pratique.</w:t></w:r></w:p>
    </w:body></w:document>"""
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("word/document.xml", xml)
    reviewed = tmp_path / "reviewed.json"
    reviewed.write_text('[{"surface":"solution","lemma":"solution","partOfSpeech":"noun","chineseGloss":"解决方案"}]', encoding="utf-8")
    result = {item["surface"]: item for item in analyze_candidates(tmp_path, reviewed)}
    assert result["solution"]["production_ready"] is True
    assert result["cherche"]["chinese_meaning_verified"] is False


def test_kaikki_dictionary_prefers_chinese_senses(tmp_path: Path):
    dictionary = tmp_path / "dictionary.jsonl"
    dictionary.write_text('{"word":"budget","lang_code":"fr","pos":"noun","senses":[{"glosses":["n.m. 预算"]}]}\n', encoding="utf-8")
    entries = load_french_chinese_dictionary(dictionary)
    assert lookup_french_chinese(entries, "budget")["chineseGloss"] == "预算"
    assert is_content_entry(entries["budget"])


def test_ocr_entries_keep_page_and_dictionary_provenance(tmp_path: Path):
    ocr = tmp_path / "ocr.json"
    ocr.write_text(json.dumps({"pages": [{"page": 4, "text": "budget n.m 预算\nnoise text"}],}), encoding="utf-8")
    dictionary = tmp_path / "dictionary.jsonl"
    dictionary.write_text('{"word":"budget","lang_code":"fr","pos":"noun","senses":[{"glosses":["预算"]}]}\n', encoding="utf-8")
    entries = parse_ocr_entries(ocr, dictionary)
    assert entries[0]["word"] == "budget"
    assert entries[0]["page"] == 4
    assert entries[0]["meaningStatus"] == "kaikki_dictionary"
    assert entries[0]["productionReady"] is False


def test_morphalou_index_returns_inflection_features_and_ambiguity(tmp_path: Path):
    archive = tmp_path / "morphalou.zip"
    csv = """header\nLEMME;;;;;;;;;;;;;;;;\nGRAPHIE;ID;CATÉGORIE;SOUS CATÉGORIE;LOCUTION;GENRE;AUTRES LEMMES LIÉS;PHONÉTIQUE;ORIGINES;GRAPHIE;ID;NOMBRE;MODE;GENRE;TEMPS;PERSONNE;PHONÉTIQUE;ORIGINES\nchercher;1;Verbe;;;-;;;source;cherchait;2;singular;indicative;-;imperfect;thirdPerson;;source\n;;;;;;;;;chercher;3;-;infinitive;-;-;-;;;source\n"""
    import zipfile
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("Morphalou3.1_formatCSV/verb_Morphalou3.1_CSV.csv", csv)
        handle.writestr("Morphalou3.1_formatCSV/commonNoun_Morphalou3.1_CSV.csv", csv.replace("chercher;1;Verbe", "porte;1;commonNoun").replace("cherchait", "porte"))
    database = tmp_path / "morphalou.sqlite"
    build_index(archive, database)
    with MorphalouIndex(database) as index:
        result = lookup_json(index, "cherchait")
        assert result["analyses"][0]["lemma"] == "chercher"
        assert result["analyses"][0]["tense"] == "imperfect"
        assert len(index.conjugations("chercher")) == 2


def test_promoted_entries_have_explanation_and_example_sentence(tmp_path: Path):
    source = tmp_path / "CO 1.docx"
    xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>1-1.</w:t></w:r></w:p><w:p><w:r><w:t>Les boutiques sont ouvertes.</w:t></w:r></w:p>
    </w:body></w:document>"""
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("word/document.xml", xml)
    dictionary = tmp_path / "dictionary.jsonl"
    dictionary.write_text('{"word":"boutique","lang_code":"fr","pos":"noun","senses":[{"glosses":["n.f. 商店"]}]}\n', encoding="utf-8")
    reviewed = tmp_path / "reviewed.json"
    reviewed.write_text('[{"surface":"boutiques","lemma":"boutique","partOfSpeech":"noun","chineseGloss":"商店"}]', encoding="utf-8")
    morphalou = tmp_path / "morphalou.sqlite"
    csv = """header\nLEMME;;;;;;;;;;;;;;;;\nGRAPHIE;ID;CATÉGORIE;SOUS CATÉGORIE;LOCUTION;GENRE;AUTRES LEMMES LIÉS;PHONÉTIQUE;ORIGINES;GRAPHIE;ID;NOMBRE;MODE;GENRE;TEMPS;PERSONNE;PHONÉTIQUE;ORIGINES\nboutique;1;commonNoun;;;feminine;;;source;boutiques;2;plural;-;-;-;;;source\n"""
    archive = tmp_path / "morphalou.zip"
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("Morphalou3.1_formatCSV/commonNoun_Morphalou3.1_CSV.csv", csv)
    build_index(archive, morphalou)
    dataset = build_production_dataset(tmp_path, dictionary, reviewed)
    assert dataset["collections"][0]["itemCount"] == 1
    assert dataset["lexemes"][0]["senses"][0]["chineseGloss"] == "商店"
    assert dataset["lexemes"][0]["occurrences"][0]["sentence"] == "Les boutiques sont ouvertes."


def test_translation_queue_is_persisted_and_mergeable(tmp_path: Path):
    dataset = tmp_path / "dataset.json"
    dataset.write_text(json.dumps({"lexemes": [{"id": "word-1", "occurrences": [{"id": "occ-1", "sentence": "Bonjour."}]}]}), encoding="utf-8")
    queue = tmp_path / "translations.json"
    build_translation_queue(dataset, queue)
    cache = json.loads(queue.read_text(encoding="utf-8"))
    cache["translations"][0].update({"sentenceZh": "你好。", "provider": "offline-batch", "modelVersion": "manual-v1", "translationStatus": "translated", "translatedAt": "2026-08-27T00:00:00Z"})
    queue.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    output = tmp_path / "enriched.json"
    merge_translation_cache(dataset, queue, output)
    merged = json.loads(output.read_text(encoding="utf-8"))
    assert merged["schemaVersion"] == 2
    assert merged["lexemes"][0]["occurrences"][0]["sentenceTranslation"] == "你好。"
