"""Export selected PDF pages and glyph geometry; no OCR or document rewriting."""

import argparse
from contextlib import nullcontext
import gzip
import hashlib
import json
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

from pdf_glyph_decode import ExplicitGlyphDecoder


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as source:
        while data := source.read(1024 * 1024):
            h.update(data)
    return h.hexdigest()


def bbox(obj):
    return [round(obj[k], 3) for k in ("x0", "top", "x1", "bottom")]


def geometry_lines(glyphs):
    """Reading candidates only; retained glyph coordinates remain authoritative."""
    clusters = []
    for i, g in sorted(enumerate(glyphs), key=lambda pair: (pair[1][5], pair[1][1])):
        target = next((c for c in reversed(clusters[-8:]) if abs(c["baseline"] - g[5]) <= .75), None)
        if target is None:
            target = {"baseline": g[5], "items": []}
            clusters.append(target)
        target["items"].append((i, g))
    lines = []
    for cluster in clusters:
        chunks = []
        for i, g in sorted(cluster["items"], key=lambda pair: pair[1][1]):
            if chunks and g[1] - chunks[-1][-1][1][3] < max(20, g[7] * 2.5):
                chunks[-1].append((i, g))
            else:
                chunks.append([(i, g)])
        for chunk in chunks:
            text = ""
            previous = None
            for _, g in chunk:
                if previous is not None and g[1] - previous[3] > max(1, min(g[7], previous[7]) * .18):
                    if not (text.endswith(" ") or g[0].startswith(" ")):
                        text += " "
                text += g[0]
                previous = g
            gs = [g for _, g in chunk]
            lines.append({
                "baseline_top": round(cluster["baseline"], 3),
                "bbox": [min(g[1] for g in gs), min(g[2] for g in gs), max(g[3] for g in gs), max(g[4] for g in gs)],
                "text": text.strip(), "glyph_indices": [i for i, _ in chunk],
            })
    return sorted(lines, key=lambda line: (line["baseline_top"], line["bbox"][0]))


def outlines(reader):
    sections, failures = [], []

    def visit(items, level=0):
        for item in items:
            if isinstance(item, list):
                visit(item, level + 1)
                continue
            title = str(item.title)
            try:
                page = reader.get_destination_page_number(item)
                if page is None or not 0 <= page < len(reader.pages):
                    raise ValueError("destination is not a source page")
                sections.append({"title": title, "level": level, "physical_start": page + 1})
            except Exception as exc:
                failures.append({"title": title, "error": type(exc).__name__})

    visit(reader.outline)
    for i, row in enumerate(sections):
        row["physical_end"] = next((r["physical_start"] - 1 for r in sections[i + 1:]
                                     if r["level"] <= row["level"] and r["physical_start"] > row["physical_start"]), len(reader.pages))
    return {"sections": sections, "unresolved_destinations": failures,
            "range_method": "next later same-or-shallower outline destination; candidate source ranges"}


def run(args):
    source = args.input.resolve(strict=True)
    reader = PdfReader(source)
    last = args.end or len(reader.pages)
    if not 1 <= args.start <= last <= len(reader.pages):
        raise ValueError("Use a valid inclusive 1-based physical page range")
    output = args.output_dir.resolve()
    files = {name: output / name for name in ("pages.jsonl.gz", "sections.json", "export.json", "glyph-audit.json")}
    if source in files.values():
        raise ValueError("Output must not overwrite the source PDF")
    if not args.overwrite and any(path.exists() for path in files.values()):
        raise FileExistsError("Output artifacts exist; use a new directory or explicit --overwrite")
    output.mkdir(parents=True, exist_ok=True)
    identity = {"sha256": digest(source), "bytes": source.stat().st_size,
                "total_physical_pages": len(reader.pages)}
    decoder = ExplicitGlyphDecoder() if args.prefer_glyph_names else None
    total_glyphs = 0
    rotated_pages = []
    with decoder if decoder else nullcontext():
        with pdfplumber.open(source) as pdf, gzip.open(files["pages.jsonl.gz"], "wt", encoding="utf-8") as target:
            for n in range(args.start, last + 1):
                if decoder:
                    decoder.set_page(n)
                page = pdf.pages[n - 1]
                names, font_ids, glyphs = [], {}, []
                for char in page.chars:
                    font = char.get("fontname", "")
                    if font not in font_ids:
                        font_ids[font] = len(names)
                        names.append(font)
                    matrix = list(char.get("matrix", ()))
                    baseline = page.height - matrix[5] if len(matrix) == 6 else char["bottom"]
                    glyphs.append([char["text"], *bbox(char), round(baseline, 3), font_ids[font],
                                   round(char["size"], 3), bool(char.get("upright", True)), matrix])
                lines = geometry_lines(glyphs)
                rotated = any(not g[8] for g in glyphs)
                if rotated:
                    rotated_pages.append(n)
                graphics = [{"kind": kind, "bbox": bbox(obj)} for kind, objects in (
                    ("image", page.images), ("rect", page.rects), ("curve", page.curves), ("line", page.lines)
                ) for obj in objects]
                record = {
                    "schema_version": 1, "document_id": args.document_id,
                    "source_sha256": identity["sha256"], "physical_page": n,
                    "page_size": [page.width, page.height], "parser_text": page.extract_text() or "",
                    "glyphs_schema": ["text", "x0", "top", "x1", "bottom", "baseline_top", "font_id", "size", "upright", "matrix"],
                    "glyph_font_names": names, "glyphs": glyphs, "reading_lines": lines,
                    "reading_text": "\n".join(line["text"] for line in lines), "graphics": graphics,
                    "unresolved_glyphs": decoder.page_issues(n) if decoder else [],
                    "review_state": "unproofread; geometric reading candidates, original page remains authoritative",
                    "rotation_warning": rotated,
                }
                target.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
                total_glyphs += len(glyphs)
                page.close()
    files["sections.json"].write_text(json.dumps(outlines(reader), ensure_ascii=False, indent=2), encoding="utf-8")
    if decoder:
        files["glyph-audit.json"].write_text(json.dumps(decoder.audit(), ensure_ascii=False, indent=2), encoding="utf-8")
    elif args.overwrite and files["glyph-audit.json"].exists():
        files["glyph-audit.json"].unlink()
    summary = {"schema_version": 1, "document_id": args.document_id, "source": identity,
               "physical_start": args.start, "physical_end": last, "exported_pages": last - args.start + 1,
               "glyphs": total_glyphs, "rotated_glyph_pages": rotated_pages,
               "decoder": "explicit-glyph-names" if decoder else "standard-pdfminer",
               "pdfplumber_version": pdfplumber.__version__,
               "scope": "page text, glyph/graphic geometry and source outlines; no OCR or semantic reconstruction"}
    files["export.json"].write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--document-id", default="document")
    parser.add_argument("--start", type=int, default=1, help="inclusive 1-based physical page")
    parser.add_argument("--end", type=int, help="inclusive physical page; default last page")
    parser.add_argument("--prefer-glyph-names", action="store_true", help="opt in only after confirming faulty ToUnicode")
    parser.add_argument("--overwrite", action="store_true")
    run(parser.parse_args())

