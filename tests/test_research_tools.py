from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from second_algorithm.catalog import report, search, validate
from second_algorithm.collect import collect, extract, identity, store_capture
from second_algorithm.storage import collection_lock, digest, read_json, write_json

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / ".local/test-tmp"
TEMP.mkdir(parents=True, exist_ok=True)
CSES = b'''<html><title>CSES Problem Set</title><h2>Sorting and Searching</h2>
<a href="/problemset/task/1620/">Factory Machines</a>
<a href="/problemset/task/1085/">Array Division</a>
<a href="/problemset/task/1620/">Factory Machines</a></html>'''


def registry():
    return {"schema_version": 1, "sources": [{"id": "cses", "name": "CSES", "homepage": "https://cses.fi/problemset/", "priority": "core", "roles": ["problem_catalog"], "languages": ["en"], "aliases": ["CSES"], "lineage": {"upstream": []}, "admission": {"state": "adopted"}, "verification": {"checked_at": "2026-10-26", "method": "fixture", "read_scope": "index only", "catalogue_state": "entry_read", "statement_scope": "none", "limitations": "synthetic test", "evidence_urls": []}, "entries": [{"id": "problemset", "url": "https://cses.fi/problemset/", "kind": "catalogue", "enumeration": {"adapter": "cses_html", "state": "implemented"}}]}]}


class ResearchToolsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir=TEMP)
        self.root = Path(self.temporary.name)
        write_json(self.root / "catalog/sources.json", registry())
        write_json(self.root / "catalog/books.json", {"books": []})
        self.entry = registry()["sources"][0]["entries"][0]

    def tearDown(self):
        self.temporary.cleanup()

    def capture(self, raw=CSES, **kwargs):
        return store_capture(self.root, "cses", self.entry, raw, self.entry["url"], **kwargs)

    def head(self):
        return read_json(self.root / "catalog/inventory-heads.json")["heads"]["cses/problemset"]

    def test_cses_metadata_deduplicates_and_keeps_section(self):
        result = extract(CSES, self.entry["url"], "cses_html")
        self.assertEqual(len(result["records"]), 2)
        self.assertEqual(result["records"][0]["section"], "Sorting and Searching")

    def test_codility_redirect_uses_registered_catalogue_scope(self):
        raw = b'''<title>Iterations</title><a href="/programmers/lessons/1-iterations/">Lesson 1</a>
        <a href="/programmers/lessons/14-binary_search_algorithm/">Lesson 14</a>
        <a href="/programmers/lessons/1-iterations/binary_gap/">BinaryGap</a>'''
        result = extract(raw, "https://app.codility.com/programmers/lessons/1-iterations/", "codility_html", registered_url="https://app.codility.com/programmers/lessons/")
        self.assertEqual({x["kind"] for x in result["records"]}, {"topic"})
        self.assertEqual(len(result["records"]), 2)

    def test_codility_lesson_does_not_collect_global_navigation(self):
        raw = b'''<a href="/programmers/lessons/1-iterations/">Lesson 1</a>
        <a href="/programmers/lessons/14-binary_search_algorithm/min_max_division/">MinMaxDivision</a>
        <a href="/programmers/lessons/14-binary_search_algorithm/min_max_division/">START</a>'''
        result = extract(raw, "https://app.codility.com/programmers/lessons/14-binary_search_algorithm/", "codility_html")
        self.assertEqual([r["id"] for r in result["records"]], ["codility:min-max-division"])

    def test_identity_normalizes_platform_variants(self):
        self.assertEqual(identity("https://codeforces.com/contest/123/problem/A"), identity("https://codeforces.com/problemset/problem/123/A"))
        self.assertEqual(identity("https://app.codility.com/programmers/lessons/14-binary_search_algorithm/min_max_division/"), "codility:min-max-division")

    def test_guide_original_tasks_include_www_and_query_identities(self):
        self.assertEqual(identity("https://www.usaco.org/index.php?page=viewproblem2&cpid=690"), "usaco:690")
        self.assertEqual(identity("https://usaco.org/index.php?cpid=690&page=viewproblem2"), "usaco:690")
        self.assertEqual(identity("https://www.codechef.com/problems/TRIPTASTIC"), "codechef:triptastic")
        self.assertEqual(identity("https://oj.uz/problem/view/BOI12_mobile"), "oj-uz:boi12_mobile")
        self.assertEqual(identity("https://onlinejudge.org/external/121/12192.pdf"), "uva:12192")
        self.assertEqual(identity("https://onlinejudge.org/external/17/p1753.pdf"), "uva:1753")
        entry = next(e for s in read_json(ROOT / "catalog/sources.json")["sources"] if s["id"] == "usaco-guide" for e in s["entries"] if e["id"] == "binary-search")
        raw = b'''<a href="http://www.usaco.org/index.php?page=viewproblem2&amp;cpid=690">Cow Dance</a>
        <a href="https://www.codechef.com/problems/TRIPTASTIC">TripTastic</a>
        <a href="https://oj.uz/problem/view/BOI12_mobile">Mobile</a>'''
        rows = extract(raw, entry["url"], "link_index", entry["enumeration"])["records"]
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(x["kind"] == "problem" for x in rows))

    def test_trailing_href_whitespace_does_not_corrupt_problem_identity(self):
        raw = b'<a href="https://open.kattis.com/problems/logo ">logo</a>'
        rows = extract(raw, "https://example.org/index", "link_index", {"include_url_regex": r"^https://open.kattis.com/problems/"})["records"]
        self.assertEqual(rows[0]["id"], "kattis:logo")
        self.assertEqual(rows[0]["url"], "https://open.kattis.com/problems/logo")

    def test_cp_author_rows_keep_unresolved_ids_and_method_classification(self):
        raw = b'''<table>
        <tr class="UVa starred"><td>00679</td><td id="679">Fetching from uHunt</td><td>3.3a, Binary Search</td></tr>
        <tr class="LeetCode nonstarred cp5"><td>lc1395</td><td id="lc1395">to replace with LeetCode link soon...</td><td>3.2x, Complete Search</td></tr>
        <tr class="Kattis starred"><td>logo</td><td id="logo"><a href="https://open.kattis.com/problems/logo ">logo</a></td><td>Math</td></tr>
        </table>'''
        rows = extract(raw, "https://cpbook.net/methodstosolve", "cpbook_table")["records"]
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(set(by_id), {"uva:679", "leetcode-number:1395", "kattis:logo"})
        self.assertEqual(by_id["uva:679"]["section"], "3.3a, Binary Search")
        self.assertEqual(by_id["uva:679"]["original_link_state"], "not_resolved")
        self.assertEqual(by_id["uva:679"]["title"], "UVa 679")
        self.assertEqual(by_id["kattis:logo"]["original_url"], "https://open.kattis.com/problems/logo")

    def test_link_filter_excludes_unrelated_links(self):
        raw = b'<a href="/contests/dp/tasks/dp_a">A</a><a href="/login">Login</a>'
        rows = extract(raw, "https://atcoder.jp/contests/dp/tasks", "link_index", {"include_url_regex": r"^https://atcoder.jp/contests/dp/tasks/dp_[a-z]+$"})["records"]
        self.assertEqual([r["id"] for r in rows], ["atcoder:dp:dp_a"])

    def test_declared_legacy_encoding_preserves_labels_without_lossy_fallback(self):
        raw = b'<meta charset="iso-8859-1"><a href="/exercises/">F\xf6rdjupning</a>'
        config = {"include_url_regex": r"/exercises/", "text_encoding": "iso-8859-1"}
        rows = extract(raw, "https://example.org/", "link_index", config)["records"]
        self.assertEqual(rows[0]["title"], "Fördjupning")
        with self.assertRaises(UnicodeDecodeError):
            extract(raw, "https://example.org/", "link_index", {"include_url_regex": r"/exercises/"})

    def test_encoding_changes_invalidate_a_previous_capture(self):
        self.capture()
        data = read_json(self.root / "catalog/sources.json")
        data["sources"][0]["entries"][0]["enumeration"]["text_encoding"] = "iso-8859-1"
        write_json(self.root / "catalog/sources.json", data)
        self.assertFalse(validate(self.root)["ok"])

    def test_empty_or_interstitial_does_not_promote_head(self):
        self.capture()
        old = self.head()
        for raw in (b'<html>No task links</html>', b'<title>Just a moment</title><a href="/problemset/task/1/">Fake</a>'):
            with self.assertRaises(ValueError):
                self.capture(raw)
        self.assertEqual(self.head(), old)

    def test_removed_records_require_review_and_preserve_previous(self):
        self.capture()
        old = self.head()
        short = b'<a href="/problemset/task/1620/">Factory Machines</a>'
        result = self.capture(short)
        self.assertEqual(result["state"], "review_required")
        self.assertEqual(self.head(), old)
        self.assertEqual(result["removed"], ["cses:1085"])
        accepted = self.capture(short, accept_change=True)
        self.assertEqual(accepted["state"], "captured")
        self.assertNotEqual(self.head(), old)
        self.assertTrue((self.root / old).exists())

    def test_pending_pagination_preserves_last_good(self):
        self.capture()
        old = self.head()
        result = self.capture(CSES + b'<a rel="next" href="?page=2">Next</a>')
        self.assertEqual(result["state"], "pagination_pending")
        self.assertEqual(self.head(), old)

    def test_explicit_single_page_does_not_confuse_next_lesson(self):
        raw = b'<a href="/item/1">One</a><a href="/another-module">Next</a>'
        result = extract(raw, "https://example.org/module", "link_index", {"include_url_regex": r"/item/", "pagination_mode": "single_page"})
        self.assertEqual(result["next_links"], [])

    def test_cosmetic_index_changes_reuse_inventory(self):
        first = self.capture()
        second = self.capture(CSES + b'<footer>different visit counter</footer>')
        self.assertEqual(second["state"], "unchanged")
        self.assertEqual(first["snapshot"], second["snapshot"])

    def test_truncated_private_cache_is_detected_and_repaired(self):
        self.capture()
        cache = self.root / ".local/materials" / digest(CSES) / "source.html"
        cache.write_bytes(b'truncated')
        self.assertFalse(validate(self.root)["ok"])
        self.capture()
        self.assertEqual(cache.read_bytes(), CSES)
        self.assertTrue(validate(self.root)["ok"])

    def test_checkout_without_private_cache_is_valid(self):
        self.capture()
        cache = self.root / ".local/materials" / digest(CSES) / "source.html"
        cache.unlink()
        self.assertTrue(validate(self.root)["ok"])

    def test_metadata_capture_never_marks_statements_read(self):
        self.capture()
        result = report(self.root)
        self.assertEqual(result["inventories"][0]["original_statements_recorded_read"], 0)
        self.assertEqual(result["inventories"][0]["problem_records_without_disposition"], 2)
        self.assertFalse(result["completeness_certified"])

    def test_unread_inventory_is_searchable_without_becoming_read(self):
        self.capture()
        found = search(self.root, "Factory Machines", "inventory")
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["record"]["disposition"], "unclassified")
        self.assertFalse(found[0]["record"]["statement_read"])

    def test_explicit_chinese_topic_alias_finds_existing_gap(self):
        write_json(self.root / "catalog/query-plans.json", {"topics": [{"id": "binary-search", "name": "二分", "aliases": ["二分", "binary search"]}]})
        (self.root / "catalog/patterns.jsonl").write_text(json.dumps({"id": "pattern:prefix-feasibility", "name": "操作前缀判定", "topic_ids": ["binary-search"], "state": "gap", "canonical": None}) + "\n", encoding="utf-8")
        found = search(self.root, "二分", "pattern")
        self.assertEqual([row["id"] for row in found], ["pattern:prefix-feasibility"])
        self.assertEqual(found[0]["record"]["state"], "gap")

    def test_false_case_mapping_is_rejected(self):
        (self.root / "catalog/cases.jsonl").write_text(json.dumps({"id": "cses:1620", "title": "Factory Machines", "source_id": "cses", "url": "https://cses.fi/problemset/task/1620/", "statement_read": False, "pattern_ids": [], "disposition": "mapped-existing"}) + "\n", encoding="utf-8")
        self.assertFalse(validate(self.root)["ok"])
        with self.assertRaises(ValueError):
            report(self.root)

    def test_head_cannot_be_rebound_to_another_source(self):
        self.capture()
        path = self.root / self.head()
        data = read_json(path)
        data["source_id"] = "codility"
        write_json(path, data)
        self.assertFalse(validate(self.root)["ok"])

    def test_scope_filter_change_requires_refresh(self):
        self.capture()
        data = read_json(self.root / "catalog/sources.json")
        data["sources"][0]["entries"][0]["url"] = "https://cses.fi/problemset/?filter=new"
        write_json(self.root / "catalog/sources.json", data)
        self.assertFalse(validate(self.root)["ok"])

    def test_collection_lock_prevents_overlapping_writers(self):
        with collection_lock(self.root):
            with self.assertRaises(ValueError):
                with collection_lock(self.root):
                    pass

    def test_receipt_failure_reports_actual_head_side_effect(self):
        original = write_json
        def fail_run_receipt(path, value, **kwargs):
            if ".local/runs" in path.as_posix():
                raise OSError("injected receipt failure")
            return original(path, value, **kwargs)
        with patch("second_algorithm.collect.fetch", return_value=(CSES, self.entry["url"])), patch("second_algorithm.collect.write_json", side_effect=fail_run_receipt):
            with self.assertRaises(OSError):
                collect(self.root, "cses", "problemset")
        failure = read_json(next((self.root / ".local/failures").glob("*.json")))
        self.assertFalse(failure["last_good_unchanged"])
        self.assertIsNotNone(failure["current_head"])
        self.assertFalse((self.root / ".local/collect.lock").exists())


if __name__ == "__main__":
    unittest.main()
