"""Convert Tavotto handoff vectors with the pinned PyMuPDF runtime."""

import argparse
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "site-packages"))
import pymupdf


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("svg-to-pdf", "pdf-to-svg"))
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    source = args.source.resolve(strict=True)
    destination = args.destination.resolve()
    expected = ".svg" if args.mode == "svg-to-pdf" else ".pdf"
    if source.suffix.lower() != expected or source.stat().st_size > 64 * 1024 * 1024:
        raise ValueError("Unsupported input type or size")
    if source == destination:
        raise ValueError("Input and output must differ")

    with pymupdf.open(str(source)) as document:
        if document.page_count != 1:
            raise ValueError("Expected exactly one vector page")
        if args.mode == "svg-to-pdf":
            payload = document.convert_to_pdf()
        else:
            payload = document[0].get_svg_image(text_as_path=True).encode("utf-8")

    limit = 32 * 1024 * 1024 if args.mode == "svg-to-pdf" else 4 * 1024 * 1024
    if not payload or len(payload) > limit:
        raise ValueError("Converted output is empty or exceeds its size limit")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.name}.{os.getpid()}.tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
