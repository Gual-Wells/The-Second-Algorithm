import copy
import unittest

from second_algorithm.chapters import _extension_contract, _prose_outline


class WholeSectionExtensionTests(unittest.TestCase):
    def setUp(self):
        self.units = [{"id": "offline", "locations": [{"document": "lesson", "anchor": "stable-offline"}]}]
        self.contract = {"schemaVersion": 3, "reading": {"extensions": [
            {"sectionId": "offline", "tags": ["离线分治"], "reason": "核心依赖事件稳定分流与状态回滚。"}]}}
        self.outlines = {"lesson": _prose_outline('<a id="pre"></a>\n## PRE、Theory\n'
            '<a id="stable-offline"></a>\n## 一、Offline\n'
            '<a id="implementation"></a>\n### （1）Hcode：Implementation\n')}

    def check(self):
        errors = []
        _extension_contract(self.contract, "lesson", self.units, self.outlines, {"lesson"}, errors)
        return errors

    def test_valid_whole_section_and_explicit_empty_or_legacy_absence(self):
        self.assertFalse(self.check())
        self.contract["reading"]["extensions"] = []
        self.assertFalse(self.check())
        del self.contract["reading"]["extensions"]
        self.assertFalse(self.check())

    def test_pre_and_subheading_cannot_be_routed_as_extensions(self):
        for anchor in ("pre", "implementation", "absent"):
            with self.subTest(anchor=anchor):
                self.units[0]["locations"][0]["anchor"] = anchor
                self.assertTrue(self.check())
        for identity in ("pre", "implementation", "unknown", [], None):
            with self.subTest(identity=identity):
                self.contract["reading"]["extensions"][0]["sectionId"] = identity
                self.assertIn("formal section", " ".join(self.check()))

    def test_duplicate_section_and_aliases_cannot_double_route_a_section(self):
        entry = self.contract["reading"]["extensions"][0]
        self.contract["reading"]["extensions"].append(copy.deepcopy(entry))
        self.assertIn("duplicate extension section", " ".join(self.check()))
        self.units.append({"id": "same-h2", "locations": copy.deepcopy(self.units[0]["locations"])})
        self.contract["reading"]["extensions"][1]["sectionId"] = "same-h2"
        self.assertIn("alias the same H2", " ".join(self.check()))

    def test_tags_and_internal_reason_must_be_real_nonempty_values(self):
        entry = self.contract["reading"]["extensions"][0]
        for tags in (None, [], [""], [" "], ["A", " A "], ["A", "A"], [3], ["<b>A</b>"], ["A\nB"]):
            with self.subTest(tags=tags):
                entry["tags"] = tags
                self.assertTrue(self.check())
        entry["tags"] = ["离线分治"]
        for reason in (None, "", " ", 3):
            with self.subTest(reason=reason):
                entry["reason"] = reason
                self.assertIn("reason", " ".join(self.check()))

    def test_no_partial_or_cross_document_locations(self):
        for locations in ([], [{"document": "other", "anchor": "stable-offline"}],
                          [{"document": [], "anchor": []}], self.units[0]["locations"] * 2):
            with self.subTest(locations=locations):
                self.units[0]["locations"] = locations
                self.assertTrue(self.check())
        self.contract["schemaVersion"] = 2
        self.assertIn("schemaVersion 3", " ".join(self.check()))


if __name__ == "__main__":
    unittest.main()
