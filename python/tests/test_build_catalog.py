import json
from pathlib import Path

from python.build_catalog import build_catalog


def test_build_catalog_merges_sources_without_requiring_examples(tmp_path: Path):
    dictionary = tmp_path / "dictionary.jsonl"
    dictionary.write_text('{"word":"budget","lang_code":"fr","pos":"noun","senses":[{"glosses":["n.m. 预算"]}]}\n', encoding="utf-8")
    lexique = tmp_path / "lexique.tsv"
    lexique.write_text("4_Lemme\t14_IsLem\t5_Cgram\t12_FreqLemme\t3_Phono_IPA\n budget\t1\tNOM\t42\tbydʒɛ\n".replace(" budget", "budget"), encoding="utf-8")
    flelex = tmp_path / "flelex.tsv"
    flelex.write_text("word\tlevel\tfreq_total\ttag\nbudget\tA2\t42\tnoun\n", encoding="utf-8")
    wiktionary = tmp_path / "wiktionary.jsonl"
    wiktionary.write_text(json.dumps({"word": "budget", "lang_code": "fr", "pos": "noun", "senses": [{"glosses": ["Somme prévue"]}]}) + "\n", encoding="utf-8")
    output = tmp_path / "catalog.json"

    result = build_catalog(dictionary, lexique, flelex, wiktionary, output)

    assert result["coverage"]["catalogEntries"] == 1
    assert result["entries"][0]["chineseGloss"] == "预算"
    assert result["entries"][0]["targetLevel"] == "A2"
    assert result["entries"][0]["studyReady"] is False
    assert result["entries"][0]["exampleFr"] is None