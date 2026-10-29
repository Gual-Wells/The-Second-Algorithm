"""Registry growth must not silently alter a prepared chapter's heading inputs."""
import json
import tempfile
import unittest
from pathlib import Path

from second_algorithm.storage import canonical_bytes, digest
from second_algorithm.subheadings import subheading_inputs


class SubheadingInputsTests(unittest.TestCase):
    def setUp(self):
        parent = Path(__file__).resolve().parents[1] / ".local/subheading-python-tests"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.root = Path(self.temporary.name)
        self.document = {"id": "sample"}
        self.composition = {"subheadings": "content/sample/chapter.subheadings.json"}
        self.entries = [{"id": identity, "prefix": prefix, "levels": [3, 4],
                         "purpose": identity, "boundary": identity, "aliases": [], "examples": []}
                        for identity, prefix in [("hcode", "Hcode"), ("scode", "Scode"), ("proof", "论证")]]
        self.snapshot_path = "work/sample/candidates.json"
        self.put(self.snapshot_path, {"schemaVersion": 1, "headings": []})
        self.put("tools/subheadings.mjs", "// fixture helper\n", text=True)
        self.plan = {"schemaVersion": 1, "document": "sample",
                     "candidateSnapshot": {"path": self.snapshot_path,
                                           "sha256": digest((self.root / self.snapshot_path).read_bytes())},
                     "registryEntries": {"hcode": digest(canonical_bytes(self.entries[0]))},
                     "decisions": [{"id": "sample-core", "typeId": "hcode", "subject": "维护候选范围",
                                    "depth": 3, "action": "reuse", "reason": "Present the manual core.",
                                    "implementationIds": ["manual-core"]}]}
        self.save()

    def tearDown(self):
        self.temporary.cleanup()

    def put(self, name, value, *, text=False):
        filename = self.root / name
        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_text(value if text else json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def save(self):
        self.put("catalog/subheadings.json", {"schemaVersion": 1, "entries": self.entries})
        self.put(self.composition["subheadings"], self.plan)

    def inputs(self):
        return subheading_inputs(self.root, self.document, self.composition)

    def test_only_real_files_enter_release_inputs(self):
        result = self.inputs()
        self.assertEqual(set(result), {self.composition["subheadings"], self.snapshot_path, "tools/subheadings.mjs"})
        for name, sha in result.items():
            self.assertEqual(sha, digest((self.root / name).read_bytes()))

    def test_unused_registry_extension_preserves_chapter_inputs(self):
        before = self.inputs()
        self.entries.append({"id": "variant", "prefix": "变型", "levels": [3, 4], "purpose": "changed problem",
                             "boundary": "not implementation", "aliases": [], "examples": []})
        self.save()
        self.assertEqual(before, self.inputs())

    def test_used_entry_change_requires_explicit_recoordination(self):
        before = self.inputs()
        self.entries[0]["boundary"] = "A materially revised responsibility."
        self.save()
        with self.assertRaisesRegex(ValueError, "Used subheading registry entry changed"):
            self.inputs()
        self.plan["registryEntries"]["hcode"] = digest(canonical_bytes(self.entries[0]))
        self.save()
        self.assertNotEqual(before, self.inputs())

    def test_snapshot_replacement_and_outside_paths_are_rejected(self):
        self.put(self.snapshot_path, {"schemaVersion": 1, "headings": ["changed"]})
        with self.assertRaisesRegex(ValueError, "candidate snapshot changed"):
            self.inputs()
        self.plan["candidateSnapshot"]["path"] = "work/../outside.json"
        self.save()
        with self.assertRaisesRegex(ValueError, "Invalid subheading input path"):
            self.inputs()

    def test_fixed_code_labels_and_exact_used_type_set(self):
        self.entries[0]["prefix"] = "Manual"
        self.save()
        with self.assertRaisesRegex(ValueError, "prefixes are fixed"):
            self.inputs()
        self.entries[0]["prefix"] = "Hcode"
        self.plan["registryEntries"]["proof"] = digest(canonical_bytes(self.entries[2]))
        self.save()
        with self.assertRaisesRegex(ValueError, "exactly the used types"):
            self.inputs()

    def test_missing_plan_cannot_bypass_actual_author_subheadings(self):
        source = "content/sample/author.source.md"
        composition = {"sourceFiles": [source]}
        for depth in (3, 4, 5, 6):
            with self.subTest(depth=depth):
                self.put(source, "# Chapter\n\n## A type\n\n" + "#" * depth
                         + " An actual author heading\n\nContent.\n", text=True)
                with self.assertRaisesRegex(ValueError, "require a coordinated plan"):
                    subheading_inputs(self.root, self.document, composition)

    def test_missing_plan_allows_no_subheadings_and_code_or_comment_examples(self):
        source = "content/sample/author.source.md"
        composition = {"sourceFiles": [source]}
        self.put(source, "# Chapter\n\n## A type\n\nOrdinary prose.\n\n"
                 "```cpp\n### Code fence example\n```\n\n"
                 "~~~text\n#### Another code example\n~~~\n\n"
                 "<!--\n### Comment example\n-->\n\n"
                 "    ### Indented code example\n", text=True)
        self.assertEqual(subheading_inputs(self.root, self.document, composition), {})


if __name__ == "__main__":
    unittest.main()
