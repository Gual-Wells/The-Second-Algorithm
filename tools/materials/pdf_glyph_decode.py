"""Opt-in extraction repair for explicitly verified broken PDF ToUnicode maps.

Only simple-font Encoding Differences are handled. No PDF bytes are edited.
The temporary pdfminer patch is process-global: do not use concurrently.
"""

from collections import Counter, defaultdict
from pdfminer.encodingdb import name2unicode
from pdfminer.pdffont import PDFSimpleFont
from pdfminer.pdftypes import list_value, resolve1
from pdfminer.psparser import PSLiteral, literal_name


# Named TeX symbols observed in source PDFs. These are semantic translations,
# not substitutes for retaining the symbol's original position and size.
TEX_NAMES = {
    "floorleft": "⌊", "floorright": "⌋", "ceilingleft": "⌈", "ceilingright": "⌉",
    "prime": "′", "summationtext": "∑", "summationdisplay": "∑",
    "integraltext": "∫", "producttext": "∏", "productdisplay": "∏",
    "uniontext": "∪", "intersectiontext": "∩", "epsilon1": "ϵ",
    "angbracketleft": "⟨", "angbracketright": "⟩", "negationslash": "̸",
    "bracketleftbigg": "[", "bracketrightbigg": "]",
    "bracketleftbig": "[", "bracketrightbig": "]",
    "parenleftbigg": "(", "parenrightbigg": ")",
    "parenleftbig": "(", "parenrightbig": ")", "radicalbig": "√",
    # This glyph is the circle component; a separate c may be overlaid by TeX.
    "circlecopyrt": "○",
}
_ACTIVE = False


class ExplicitGlyphDecoder:
    """Prefer explicit glyph names over ToUnicode, retaining an audit trail."""

    def __init__(self):
        self.page = None
        self.mappings = {}
        self.calls = Counter()
        self.unresolved = defaultdict(set)

    def set_page(self, physical_page):
        self.page = physical_page

    def page_issues(self, physical_page):
        return [self.mappings[k] for k in sorted(self.unresolved[physical_page])]

    def audit(self):
        return {
            "method": "explicit Encoding Differences names override parser ToUnicode; PDF unchanged",
            "limits": "simple fonts only; explicit opt-in; unknown names remain replacement characters",
            "manual_tex_mapping": TEX_NAMES,
            "mappings": [dict(row, decoder_calls=self.calls[key])
                         for key, row in sorted(self.mappings.items())],
            "unresolved_pages": [
                {"physical_page": p, "glyphs": self.page_issues(p)}
                for p in sorted(self.unresolved) if self.unresolved[p]
            ],
        }

    def __enter__(self):
        global _ACTIVE
        if _ACTIVE:
            raise RuntimeError("Glyph decoder cannot be nested or used concurrently")
        _ACTIVE = True
        self.original_init = PDFSimpleFont.__init__
        self.original_decode = PDFSimpleFont.to_unichr
        owner = self

        def initialize(font, descriptor, widths, spec):
            owner.original_init(font, descriptor, widths, spec)
            font._explicit_glyph_overrides = {}
            enc = resolve1(spec.get("Encoding")) if spec.get("Encoding") is not None else None
            if not isinstance(enc, dict):
                return
            base = spec.get("BaseFont")
            name = literal_name(base) if isinstance(base, PSLiteral) else str(base)
            code = 0
            for item in list_value(enc.get("Differences", [])):
                if isinstance(item, int):
                    code = item
                    continue
                glyph = literal_name(item) if isinstance(item, PSLiteral) else str(item).lstrip("/")
                try:
                    text = name2unicode(glyph)
                    method = "Adobe glyph-name mapping"
                except Exception:
                    text = TEX_NAMES.get(glyph, "�")
                    method = "explicit TeX glyph-name semantic" if glyph in TEX_NAMES else "unresolved glyph name"
                try:
                    original = owner.original_decode(font, code)
                except Exception:
                    original = None
                key = (name, code, glyph)
                owner.mappings[key] = {
                    "font": name, "character_code": code, "glyph_name": glyph,
                    "original_parser_text": original, "corrected_text": text, "method": method,
                }
                font._explicit_glyph_overrides[code] = (text, key)
                code += 1

        def decode(font, cid):
            item = getattr(font, "_explicit_glyph_overrides", {}).get(cid)
            if item is None:
                return owner.original_decode(font, cid)
            text, key = item
            owner.calls[key] += 1
            if text == "�":
                owner.unresolved[owner.page].add(key)
            return text

        PDFSimpleFont.__init__ = initialize
        PDFSimpleFont.to_unichr = decode
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        global _ACTIVE
        PDFSimpleFont.__init__ = self.original_init
        PDFSimpleFont.to_unichr = self.original_decode
        _ACTIVE = False

