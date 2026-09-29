from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from shutil import which
from statistics import median
from typing import Any

from pypdf import PdfReader


def _runs(values: list[int], gap: int = 2) -> list[list[int]]:
    groups: list[list[int]] = []
    for value in values:
        if not groups or value - groups[-1][-1] > gap:
            groups.append([value])
        else:
            groups[-1].append(value)
    return groups


def _table_geometry(image: Any) -> tuple[int, int, int, list[int]] | None:
    """Return left edge, divider, right edge, and row boundaries for a ruled table."""
    gray = image.convert("L")
    width, _ = gray.size
    pixels = gray.load()
    horizontal: list[tuple[int, int, int]] = []
    for y in range(0, gray.height, 2):
        dark = [x for x in range(width) if pixels[x, y] < 220]
        runs = _runs(dark, gap=1)
        longest = max(runs, key=len, default=[])
        if len(longest) >= width * 0.27:
            horizontal.append((y, longest[0], longest[-1]))
    if not horizontal:
        return None
    # A page can contain decorative horizontal rules. Keep the dominant table
    # span, whose boundaries repeat at nearly identical x coordinates.
    span_groups: dict[tuple[int, int], list[tuple[int, int, int]]] = {}
    bucket = max(8, width // 100)
    for item in horizontal:
        span_groups.setdefault((round(item[1] / bucket), round(item[2] / bucket)), []).append(item)
    table_lines = max(span_groups.values(), key=len)
    boundaries = [round(median(group)) for group in _runs([item[0] for item in table_lines], gap=4)]
    if len(boundaries) < 8:
        return None
    spans = [(left, right) for _, left, right in table_lines]
    left = round(median(item[0] for item in spans))
    right = round(median(item[1] for item in spans))
    table_height = boundaries[-1] - boundaries[0]
    candidates: list[tuple[int, int]] = []
    for x in range(left + int((right - left) * .12), left + int((right - left) * .58), 2):
        count = sum(pixels[x, y] < 190 for y in range(boundaries[0], boundaries[-1], 2))
        candidates.append((count, x))
    divider = max(candidates)[1]
    if max(candidates)[0] < table_height * .22:
        divider = left + round((right - left) * .30)
    return left, divider, right, boundaries


def _ocr_cell(image: Any, language: str, psm: int = 7) -> str:
    import pytesseract

    cell = image.convert("L")
    cell = cell.resize((cell.width * 2, cell.height * 2))
    cell = cell.point(lambda value: 0 if value < 185 else 255)
    text = pytesseract.image_to_string(cell, lang=language, config=f"--psm {psm}")
    return re.sub(r"\s+", " ", text).strip(" |\n\t")


def _extract_rows(image: Any, page_number: int, language: str) -> list[dict[str, Any]]:
    geometry = _table_geometry(image)
    if geometry is None:
        return []
    left, divider, right, boundaries = geometry
    rows: list[dict[str, Any]] = []
    for row_number, (top, bottom) in enumerate(zip(boundaries, boundaries[1:]), start=1):
        if bottom - top < 12:
            continue
        inset = max(2, round((bottom - top) * .07))
        word = _ocr_cell(image.crop((left + 3, top + inset, divider - 3, bottom - inset)), "fra")
        detail = _ocr_cell(image.crop((divider + 3, top + inset, right - 3, bottom - inset)), language)
        if word or detail:
            rows.append({"page": page_number, "row": row_number, "wordCell": word, "detailCell": detail, "bounds": [left, top, right, bottom]})
    return rows


def extract_pdf_ocr(pdf_path: Path, language: str = "chi_sim", dpi: int = 300) -> list[dict[str, object]]:
    try:
        from PIL import Image
        import pytesseract  # noqa: F401
    except ImportError as error:
        raise RuntimeError("Install OCR dependencies with: python3 -m pip install -r requirements.txt") from error
    if not which("pdftoppm"):
        raise RuntimeError("pdftoppm is required. On macOS install it with: brew install poppler")

    page_count = len(PdfReader(str(pdf_path)).pages)
    pages: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="tcf-core-ocr-") as directory:
        output_root = Path(directory) / "page"
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", str(pdf_path), str(output_root)], check=True, stdout=subprocess.DEVNULL)
        rendered = sorted(Path(directory).glob("page-*.png"), key=lambda path: int(path.stem.rsplit("-", 1)[1]))
        for page_number, path in enumerate(rendered, start=1):
            with Image.open(path) as image:
                rows = _extract_rows(image, page_number, language)
            pages.append({"page": page_number, "rows": rows, "status": "table_ocr" if rows else "no_table"})
            print(f"OCR page {page_number}/{page_count}: {len(rows)} table rows", flush=True)
    return pages


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR ruled vocabulary PDFs into page- and row-attributed JSON.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--lang", default="chi_sim", help="Tesseract language for the Chinese-heavy detail column")
    parser.add_argument("--dpi", type=int, default=300)
    arguments = parser.parse_args()
    pages = extract_pdf_ocr(arguments.pdf, arguments.lang, arguments.dpi)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps({"source": arguments.pdf.name, "dpi": arguments.dpi, "pages": pages}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {arguments.output} ({len(pages)} pages, {sum(len(page['rows']) for page in pages)} rows)")


if __name__ == "__main__":
    main()
