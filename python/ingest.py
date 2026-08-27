from __future__ import annotations

import json
import re
import sys
import zipfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

from .linguistics import ReviewedFrenchAnalyzer

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


@dataclass(frozen=True)
class SourceBlock:
    question_id: str
    exact_text: str
    paragraph_index: int


def docx_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    return ["".join(node.text or "" for node in paragraph.iter(f"{W}t")) for paragraph in root.iter(f"{W}p")]


def extract_numbered_blocks(path: Path) -> list[SourceBlock]:
    paragraphs = docx_paragraphs(path)
    blocks: list[SourceBlock] = []
    current_id: str | None = None
    for index, text in enumerate(paragraphs):
        marker = re.fullmatch(r"(\d+-\d+)\.", text.strip())
        if marker:
            current_id = marker.group(1)
            continue
        if current_id and text.strip() and not set(text.strip()) <= {"-"}:
            blocks.append(SourceBlock(current_id, text, index))
            current_id = None
    return blocks


def context_sentence(text: str, surface: str) -> str:
    """Return one complete punctuation-delimited sentence containing the word."""
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]
    surface_pattern = re.compile(rf"(?<!\w){re.escape(surface)}(?!\w)", re.IGNORECASE)
    return next((sentence for sentence in sentences if surface_pattern.search(sentence)), text.strip())


def build_dataset(source_path: Path, reviewed_path: Path) -> dict:
    reviewed = json.loads(reviewed_path.read_text(encoding="utf-8"))
    blocks = extract_numbered_blocks(source_path)
    analyzer = ReviewedFrenchAnalyzer()
    lexemes = []
    for position, record in enumerate(reviewed):
        pattern = re.compile(rf"(?<!\w){re.escape(record['surface'])}(?!\w)", re.IGNORECASE)
        match = next(((block, pattern.search(block.exact_text)) for block in blocks if pattern.search(block.exact_text)), None)
        if not match:
            raise ValueError(f"Reviewed surface not found in source: {record['surface']}")
        block, surface_match = match
        actual_surface = surface_match.group(0)
        analysis = analyzer.analyze(actual_surface, record["lemma"], record["partOfSpeech"])
        analysis = analysis.__class__(analysis.surface, record["lemma"], record["partOfSpeech"], record.get("morphology", analysis.morphology), record.get("confidence", analysis.confidence), record.get("verification", analysis.verification))
        lexeme_id = f"co1-{record['lemma'].replace(' ', '-')}"
        lexemes.append({
            "id": lexeme_id,
            "lemma": record["lemma"],
            "ipa": record.get("ipa"),
            "partOfSpeech": record["partOfSpeech"],
            "priority": 100 - position,
            "collectionIds": ["tcf-listening"],
            "senses": [{
                "id": f"{lexeme_id}-sense-1", "partOfSpeech": record["partOfSpeech"],
                "chineseGloss": record["chineseGloss"], "synonyms": record.get("synonyms", []),
                "evidence": {"sourceType": "manual_review", "sourceLabel": "Local reviewed-senses.json", "verification": "verified", "confidence": 1},
            }],
            "occurrences": [{
                "id": f"{lexeme_id}-occurrence-{block.question_id}", "surfaceForm": actual_surface,
                "sentence": context_sentence(block.exact_text, actual_surface), "sourceText": block.exact_text, "sourceDocument": source_path.name,
                "sourceReference": f"Listening CO 1 · Question {block.question_id}", "lemma": record["lemma"],
                "partOfSpeech": record["partOfSpeech"], "morphology": analysis.morphology or None,
                "evidence": {"sourceType": "exam", "sourceLabel": f"{source_path.name} · paragraph {block.paragraph_index}", "verification": analysis.verification, "confidence": analysis.confidence},
            }],
        })
    return {
        "sourceMode": "private", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "collections": [
            {"id": "tcf-listening", "name": "TCF Listening", "description": "Exact occurrences from the private listening corpus", "kind": "exam", "itemCount": len(lexemes), "available": True},
            {"id": "tcf-reading", "name": "TCF Reading", "description": "Private reading evidence", "kind": "exam", "itemCount": 0, "available": False},
            {"id": "tcf-tef", "name": "TCF + TEF Vocabulary", "description": "Private vocabulary curriculum", "kind": "curriculum", "itemCount": 0, "available": False},
            {"id": "nihao-a1", "name": "你好！法语 A1", "description": "Foundation curriculum", "kind": "curriculum", "itemCount": 0, "available": False},
            {"id": "nihao-a2", "name": "你好！法语 A2", "description": "Foundation curriculum", "kind": "curriculum", "itemCount": 0, "available": False},
            {"id": "nihao-b1", "name": "你好！法语 B1", "description": "Foundation curriculum", "kind": "curriculum", "itemCount": 0, "available": False},
        ], "lexemes": lexemes,
    }


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: python -m python.ingest SOURCE.docx REVIEWED.json OUTPUT.json")
    source, reviewed, output = map(Path, sys.argv[1:])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build_dataset(source, reviewed), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
