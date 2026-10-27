from __future__ import annotations

import hashlib
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"


class ReadingPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.code, self.requests = [], [], [], []
        self.in_code = False
        self.current = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a" and "href" in a:
            self.links.append(a["href"])
        if tag in ("script", "img", "iframe") and a.get("src"):
            self.requests.append(a["src"])
        if tag == "link" and a.get("href"):
            self.requests.append(a["href"])
        if tag == "pre":
            self.in_code = True
            self.current = []

    def handle_data(self, data):
        if self.in_code:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "pre":
            self.code.append("".join(self.current).strip())
            self.in_code = False


class ReadingAssetTest(unittest.TestCase):
    def test_reading_build_and_displayed_code_match_authorities(self):
        publications = json.loads((ROOT / "carrier/publications.json").read_text(encoding="utf8"))
        documents = [d for c in publications["collections"] if c.get("visibility", "published") == "published"
                     for d in c["documents"]]
        if publications.get("state", "active") == "withdrawn":
            self.assertFalse(documents, "withdrawal cannot publish a document")
            learning = json.loads((ROOT / "catalog/learning.json").read_text(encoding="utf8"))
            for key in ("questions", "tasks", "targets"):
                self.assertEqual(learning[key], [], "withdrawal must clear the current learning registry")
        else:
            self.assertTrue(documents, "active release needs an actual published document")
        for document in documents:
            source = ROOT / (document["path"] + ".source.md")
            content = source.parent
            name = source.name.removesuffix(".source.md")
            with self.subTest(chapter=name):
                manifest = json.loads((content / "build" / (name + ".json")).read_text(encoding="utf8"))
                files = {"source": source, "code": content / (name + ".cpp"),
                         "markdown": content / (name + ".md"), "html": content / (name + ".html"),
                         "builder": ROOT / "tools/build_handbook.mjs",
                         "learning": ROOT / "catalog/learning.json",
                         "publications": ROOT / "carrier/publications.json"}
                for kind, path in files.items():
                    self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), manifest[kind + "Sha256"], str(path))
                cpp = files["code"].read_text(encoding="utf8")
                blocks = dict(re.findall(r"// BEGIN ([\w-]+)\n([\s\S]*?)// END \1", cpp))
                used = re.findall(r"\{\{(?:(?:code|code-block):)?([\w-]+)\}\}", source.read_text(encoding="utf8"))
                self.assertEqual(len(used), len(set(used)), "one authoritative placement per code block")
                self.assertEqual(set(used), set(blocks))
                self.assertEqual(used, manifest["codeBlocks"])
                html = files["html"].read_text(encoding="utf8")
                page = ReadingPage()
                page.feed(html)
                self.assertEqual(len(page.ids), len(set(page.ids)))
                self.assertFalse(page.requests, "reading pages must be self-contained")
                for block in blocks.values():
                    self.assertEqual(page.code.count(block.strip()), 1, "visible code differs from source")
                for href in page.links:
                    parsed = urlsplit(href)
                    if parsed.scheme or parsed.netloc:
                        continue
                    target = (content / unquote(parsed.path)).resolve() if parsed.path else files["html"]
                    self.assertTrue(target.exists(), href)
                    if parsed.fragment and target.suffix == ".html":
                        linked = page if target == files["html"] else ReadingPage()
                        if linked is not page:
                            linked.feed(target.read_text(encoding="utf8"))
                        self.assertIn(unquote(parsed.fragment), linked.ids, href)


if __name__ == "__main__":
    unittest.main()
