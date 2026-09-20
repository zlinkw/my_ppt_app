"""Convert Tavotto handoff vectors with the pinned PyMuPDF runtime."""

import argparse
import os
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent / "site-packages"))
import pymupdf


def validate_svg(source: Path) -> None:
    data = source.read_bytes()
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("SVG must not contain a DTD or entity")
    root = ET.fromstring(data)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Input is not a standard SVG")
    forbidden = {"script", "foreignObject", "iframe", "object", "embed", "image"}
    for element in root.iter():
        local_name = element.tag.rsplit("}", 1)[-1]
        if local_name in forbidden:
            raise ValueError("SVG contains unsupported embedded content")
        if local_name == "style" and re.search(r"@import|url\s*\(\s*['\"]?(?!#)", element.text or "", re.I):
            raise ValueError("SVG contains an external style reference")
        for key, value in element.attrib.items():
            name = key.rsplit("}", 1)[-1].lower()
            if name.startswith("on") or name == "base":
                raise ValueError("SVG contains an event or base attribute")
            if name in {"href", "src"} and not value.startswith("#"):
                raise ValueError("SVG contains an external reference")
            if re.search(r"javascript:|vbscript:|@import|url\s*\(\s*['\"]?(?!#)", value, re.I):
                raise ValueError("SVG contains an external style reference")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("svg-to-pdf", "pdf-to-svg"))
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    source = args.source.resolve(strict=True)
    destination = args.destination.resolve()
    expected = ".svg" if args.mode == "svg-to-pdf" else ".pdf"
    input_limit = 4 * 1024 * 1024 if args.mode == "svg-to-pdf" else 64 * 1024 * 1024
    if source.suffix.lower() != expected or source.stat().st_size > input_limit:
        raise ValueError("Unsupported input type or size")
    if source == destination:
        raise ValueError("Input and output must differ")
    if args.mode == "svg-to-pdf":
        validate_svg(source)

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
