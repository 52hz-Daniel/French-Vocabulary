from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from .dictionary import load_french_chinese_dictionary, lookup_french_chinese

HAN = re.compile(r"[\u3400-\u9fff]")
WORD = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ'’ -]*(?:,\s*[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+)?$")
POS = re.compile(r"\b(n\.?\s*[mf]?\.?|v\.?\s*[ti]?\.?|adj\.?|adv\.?|prép\.?|conj\.?)\b", re.I)
NOISE = re.compile(r"(公众号|微信|真题|大脸原创|法国留学|更多|解析|答案|扫码|www\.|http|com$)", re.I)
LEGACY_ROW = re.compile(r"^(?P<word>[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ'’-]+)\s+(?P<detail>.+)$")


def normalize_word_cell(value: str) -> str:
    value = unicodedata.normalize("NFC", value).replace("|", "").replace("‘", "'").replace("’", "'")
    value = re.sub(r"\s+", " ", value).strip(" .,:;—-_")
    return re.sub(r"\s*,\s*", ",", value)


def chinese_gloss(value: str) -> str:
    value = unicodedata.normalize("NFC", value)
    first = HAN.search(value)
    if not first:
        return ""
    value = value[first.start():]
    value = re.sub(r"[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+(?:['’ -][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+)*", " ", value)
    value = re.sub(r"[^\u3400-\u9fff，、；：。！？（）()《》“”‘’/\s]", " ", value)
    return re.sub(r"\s+", "", value).strip("，、；：。/()（）")


def parse_gendered_lemma(value: str) -> tuple[str, str | None]:
    if "," not in value:
        return value, None
    masculine, feminine_suffix = value.split(",", 1)
    if not feminine_suffix or " " in feminine_suffix:
        return value, None
    return masculine, feminine_suffix


def parse_ocr_entries(ocr_path: Path, dictionary_path: Path | None = None) -> list[dict[str, Any]]:
    source = json.loads(ocr_path.read_text(encoding="utf-8"))
    dictionary = load_french_chinese_dictionary(dictionary_path) if dictionary_path else {}
    entries: list[dict[str, Any]] = []
    for page in source.get("pages", []):
        rows = list(page.get("rows", []))
        if not rows and page.get("text"):
            for row_number, line in enumerate(str(page["text"]).splitlines(), start=1):
                match = LEGACY_ROW.match(line.strip())
                if match:
                    rows.append({"page": page.get("page"), "row": row_number, "wordCell": match.group("word"), "detailCell": match.group("detail")})
        for row in rows:
            display_word = normalize_word_cell(str(row.get("wordCell", "")))
            detail = str(row.get("detailCell", ""))
            gloss = chinese_gloss(detail)
            if not display_word or not WORD.fullmatch(display_word) or len(display_word) > 55:
                continue
            if NOISE.search(display_word) or NOISE.search(gloss):
                continue
            lemma, feminine_suffix = parse_gendered_lemma(display_word)
            if len(lemma) < 2:
                continue
            dictionary_entry = lookup_french_chinese(dictionary, lemma)
            canonical_gloss = gloss or (str(dictionary_entry.get("chineseGloss", "")) if dictionary_entry else "")
            pos_match = POS.search(detail)
            entries.append({
                "word": lemma,
                "displayWord": display_word,
                "feminineSuffix": feminine_suffix,
                "page": int(row.get("page", page.get("page", 0))),
                "row": int(row.get("row", 0)),
                "sourceBounds": row.get("bounds"),
                "ocrPartOfSpeech": pos_match.group(0) if pos_match else None,
                "ocrChineseGloss": canonical_gloss,
                "glossSource": "source_pdf" if gloss else ("kaikki_dictionary_fallback" if canonical_gloss else "missing"),
                "ocrDetail": detail,
                "dictionaryMatch": dictionary_entry,
                "meaningStatus": "kaikki_dictionary" if dictionary_entry and not page.get("rows") else ("source_pdf_extracted" if gloss else ("dictionary_fallback" if canonical_gloss else "needs_review")),
                "sentenceStatus": "needs_source_sentence",
                "productionReady": False,
            })
    unique: dict[tuple[str, int], dict[str, Any]] = {}
    for entry in entries:
        unique[(entry["word"].casefold(), entry["page"])] = entry
    return sorted(unique.values(), key=lambda item: (item["page"], item["row"]))


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse row-aware OCR vocabulary entries into a review queue.")
    parser.add_argument("ocr", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dictionary", type=Path)
    args = parser.parse_args()
    entries = parse_ocr_entries(args.ocr, args.dictionary)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"sourceMode": "tef-tcf-core-ocr", "entries": entries}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.output} ({len(entries)} entries)")


if __name__ == "__main__":
    main()
