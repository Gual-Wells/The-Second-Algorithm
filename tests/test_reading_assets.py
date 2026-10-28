from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
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
        self.knowledge_links, self.knowledge_introductions = [], []
        self.in_code = False
        self.current = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a" and "href" in a:
            if a.get("data-knowledge"):
                self.knowledge_links.append((a["data-knowledge"], a.get("data-knowledge-anchor", "")))
            else:
                self.links.append(a["href"])
        if a.get("data-knowledge-introduction"):
            self.knowledge_introductions.append(a["data-knowledge-introduction"])
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
    def test_knowledge_assembly_keeps_literals_and_namespaces_inline_sections(self):
        scratch = ROOT / ".local/knowledge-builder-tests"
        scratch.mkdir(parents=True, exist_ok=True)
        script = r'''
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {readKnowledge, knowledgeTokens, expandKnowledgeReferences, expandKnowledgeIntroductions}=await import(process.argv[1]);
const root=process.argv[2];
await fs.mkdir(root+'/content/knowledge',{recursive:true});
const records=[{id:'Q000001',title:'范围',source:'content/knowledge/range.md',prerequisites:[],sources:['https://example.com/range']},
 {id:'Q000002',title:'另一个范围',source:'content/knowledge/other.md',prerequisites:['Q000001'],sources:['https://example.com/other']}];
await fs.writeFile(root+'/'+records[0].source,'# 范围\n\n<a id="range"></a>\n\n不含终点。\n'.replaceAll('\\n','\n'));
await fs.writeFile(root+'/'+records[1].source,'# 另一个范围\n\n<a id="range"></a>\n\n保留不同条件。\n'.replaceAll('\\n','\n'));
// Write real LF bytes: string escaping above remains literal so this test exercises the file reader.
for(const record of records){const file=root+'/'+record.source;await fs.writeFile(file,(await fs.readFile(file,'utf8')).replaceAll('\\n','\n'));}
const firstSource=root+'/'+records[0].source;
await fs.writeFile(firstSource,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),await fs.readFile(firstSource)]));
let map;
try{map=await readKnowledge(root,{schemaVersion:2,questions:records});}catch(error){throw new Error(error.message+' '+JSON.stringify(await fs.readFile(root+'/'+records[0].source,'utf8')));}
const input='[[Q000001#range|半开范围]] `[[Q999999]]`\n```cpp\n"[[Q999999]]";\n```\n<!-- [[Q999999]] -->';
const literalInput=input.replaceAll('\\n','\n');
const linked=expandKnowledgeReferences(literalInput,map);
const intro=expandKnowledgeIntroductions('{{knowledge:Q000001}}\n{{knowledge:Q000002}}',map,text=>text);
const tokens=knowledgeTokens(literalInput);
const bomShaMatches=map.get('Q000001').sourceSha256===createHash('sha256').update(await fs.readFile(firstSource)).digest('hex');
const priorSha=map.get('Q000001').sourceSha256;
await fs.appendFile(firstSource,'\n边界补充。\n');
const revisionChanged=(await readKnowledge(root,{schemaVersion:2,questions:records})).get('Q000001').sourceSha256!==priorSha;
let missing=false,visibleId=false,cycle=false;
try{expandKnowledgeReferences('[[Q000001#absent|规则]]',map);}catch{missing=true;}
try{expandKnowledgeReferences('[[Q000001|Q000001]]',map);}catch{visibleId=true;}
records[0].prerequisites=['Q000002'];try{await readKnowledge(root,{schemaVersion:2,questions:records});}catch(error){cycle=/cycle/.test(error.message);}
process.stdout.write(JSON.stringify({linked,intro,tokens,missing,visibleId,cycle,bomShaMatches,revisionChanged}));
'''
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            result = subprocess.run(["node", "--input-type=module", "-e", script,
                (ROOT / "tools/knowledge.mjs").as_uri(), directory], cwd=ROOT, text=True,
                encoding="utf-8", capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertIn('data-knowledge-anchor="range"', value["linked"])
        self.assertIn('>半开范围</a>', value["linked"])
        self.assertIn('`[[Q999999]]`', value["linked"])
        self.assertEqual(len(value["tokens"]["references"]), 1)
        self.assertIn('id="knowledge-Q000001-range"', value["intro"])
        self.assertIn('id="knowledge-Q000002-range"', value["intro"])
        self.assertTrue(value["missing"])
        self.assertTrue(value["visibleId"])
        self.assertTrue(value["cycle"])
        self.assertTrue(value["bomShaMatches"])
        self.assertTrue(value["revisionChanged"])

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
                self.assertEqual(hashlib.sha256((ROOT / "tools/knowledge.mjs").read_bytes()).hexdigest(), manifest["knowledgeHelperSha256"])
                for path, expected in manifest["knowledgeDependencies"].items():
                    self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(), expected, path)
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
                self.assertEqual(page.knowledge_introductions, manifest["knowledgeIntroductions"])
                self.assertEqual(len(page.knowledge_introductions), len(set(page.knowledge_introductions)))
                learning = json.loads(files["learning"].read_text(encoding="utf-8"))
                knowledge = {item["id"]: item for item in learning["questions"]}
                for qid, anchor in page.knowledge_links:
                    self.assertIn(qid, knowledge)
                    if anchor:
                        authority = (ROOT / knowledge[qid]["source"]).read_text(encoding="utf-8")
                        self.assertRegex(authority, r'<a\s+id=["\']' + re.escape(anchor) + r'["\']')
                self.assertFalse(any(re.search(r"\bQ\d{6,}\b", item["text"]) for item in manifest["headings"]), "internal knowledge IDs must not become reader headings")
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
