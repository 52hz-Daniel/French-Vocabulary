from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from pypdf import PdfReader


def extract_pdf_ocr(pdf_path: Path, language: str = "fra+chi_sim") -> list[dict[str, object]]:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as error:
        raise RuntimeError("Install OCR dependencies with: python3 -m pip install -r requirements.txt") from error

    reader = PdfReader(str(pdf_path))
    pages: list[dict[str, object]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        images = list(page.images)
        if not images:
            pages.append({"page": page_number, "text": "", "status": "no_image"})
            continue
        image = max(images, key=lambda item: len(item.data))
        with Image.open(io.BytesIO(image.data)) as opened:
            text = pytesseract.image_to_string(opened, lang=language, config="--psm 6")
        pages.append({"page": page_number, "image": image.name, "text": text.strip(), "status": "ocr"})
    return pages


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR image-based vocabulary PDFs into page-attributed JSON.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--lang", default="fra+chi_sim", help="Installed Tesseract languages, for example fra+chi_sim")
    arguments = parser.parse_args()
    pages = extract_pdf_ocr(arguments.pdf, arguments.lang)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps({"source": arguments.pdf.name, "pages": pages}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {arguments.output} ({len(pages)} pages)")


if __name__ == "__main__":
    main()
