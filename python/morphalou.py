from __future__ import annotations

import csv
import io
import json
import sqlite3
import zipfile
from pathlib import Path
from typing import Any, Iterator

MORPHALOU_VERSION = "3.1"
MORPHALOU_SOURCE = "https://repository.ortolang.fr/api/content/morphalou/5/Morphalou3.1_formatCSV.zip"
MORPHALOU_LICENSE = "LGPL-LR"
CATEGORY_MAP = {"commonNoun": "noun", "verb": "verb", "Verbe": "verb", "adjective": "adjective", "adverb": "adverb"}
LEXICAL_CATEGORIES = set(CATEGORY_MAP)


def _value(row: list[str], index: int) -> str | None:
    value = row[index].strip() if index < len(row) else ""
    return value or None


def iter_records(archive_path: Path) -> Iterator[dict[str, Any]]:
    with zipfile.ZipFile(archive_path) as archive:
        for name in archive.namelist():
            if not name.endswith("_Morphalou3.1_CSV.csv"):
                continue
            category = name.rsplit("/", 1)[-1].split("_", 1)[0]
            if category not in LEXICAL_CATEGORIES:
                continue
            current_lemma: dict[str, Any] | None = None
            with archive.open(name) as binary:
                text = io.TextIOWrapper(binary, encoding="utf-8-sig", newline="")
                for row in csv.reader(text, delimiter=";"):
                    if len(row) < 18 or row[0].startswith("LEMME") or row[0].startswith("GRAPHIE"):
                        continue
                    if row[0].strip():
                        current_lemma = {
                            "lemma": _value(row, 0),
                            "lemma_id": _value(row, 1),
                            "category": category,
                            "subcategory": _value(row, 3),
                            "locution": _value(row, 4),
                            "lemma_gender": _value(row, 5),
                            "linked_lemmas": _value(row, 6),
                            "lemma_phonetic": _value(row, 7),
                            "lemma_origins": _value(row, 8),
                        }
                    if current_lemma is None:
                        continue
                    inflection = {
                        "surface": _value(row, 9),
                        "inflection_id": _value(row, 10),
                        "number": _value(row, 11),
                        "mood": _value(row, 12),
                        "inflection_gender": _value(row, 13),
                        "tense": _value(row, 14),
                        "person": _value(row, 15),
                        "inflection_phonetic": _value(row, 16),
                        "inflection_origins": _value(row, 17),
                    }
                    if current_lemma["lemma"] and inflection["surface"]:
                        yield {**current_lemma, **inflection}


def build_index(archive_path: Path, database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    try:
        connection.executescript("""
            DROP TABLE IF EXISTS analyses;
            DROP TABLE IF EXISTS forms;
            CREATE TABLE forms (
                surface TEXT NOT NULL,
                lemma TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory TEXT,
                lemma_gender TEXT,
                linked_lemmas TEXT,
                lemma_phonetic TEXT,
                lemma_origins TEXT,
                inflection_id TEXT,
                number TEXT,
                mood TEXT,
                inflection_gender TEXT,
                tense TEXT,
                person TEXT,
                inflection_phonetic TEXT,
                inflection_origins TEXT
            );
            CREATE INDEX forms_surface ON forms(surface COLLATE NOCASE);
            CREATE INDEX forms_lemma ON forms(lemma COLLATE NOCASE);
        """)
        connection.executemany(
            "INSERT INTO forms VALUES (:surface, :lemma, :category, :subcategory, :lemma_gender, :linked_lemmas, :lemma_phonetic, :lemma_origins, :inflection_id, :number, :mood, :inflection_gender, :tense, :person, :inflection_phonetic, :inflection_origins)",
            iter_records(archive_path),
        )
        connection.commit()
    finally:
        connection.close()


class MorphalouIndex:
    def __init__(self, database_path: Path):
        self.connection = sqlite3.connect(database_path)
        self.connection.row_factory = sqlite3.Row

    def close(self) -> None:
        self.connection.close()

    def lookup(self, surface: str) -> list[dict[str, Any]]:
        rows = self.connection.execute("SELECT * FROM forms WHERE surface = ? COLLATE NOCASE ORDER BY lemma, category, mood, tense, person", (surface,)).fetchall()
        return [dict(row) for row in rows]

    def conjugations(self, lemma: str) -> list[dict[str, Any]]:
        rows = self.connection.execute("SELECT * FROM forms WHERE lemma = ? COLLATE NOCASE ORDER BY category, mood, tense, person, number, surface", (lemma,)).fetchall()
        return [dict(row) for row in rows]

    def __enter__(self) -> "MorphalouIndex":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def lookup_json(index: MorphalouIndex, surface: str) -> dict[str, Any]:
    analyses = index.lookup(surface)
    unique_lemmas = {item["lemma"] for item in analyses}
    return {"surface": surface, "analyses": analyses, "ambiguous": len(unique_lemmas) > 1}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build or query a Morphalou 3.1 SQLite index.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build")
    build.add_argument("archive", type=Path)
    build.add_argument("database", type=Path)
    lookup = subparsers.add_parser("lookup")
    lookup.add_argument("database", type=Path)
    lookup.add_argument("surface")
    args = parser.parse_args()
    if args.command == "build":
        build_index(args.archive, args.database)
        print(f"Built {args.database}")
    else:
        with MorphalouIndex(args.database) as index:
            print(json.dumps(lookup_json(index, args.surface), ensure_ascii=False, indent=2))
