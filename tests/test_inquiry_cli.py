"""Exercise the operator entry point before any course or author files exist."""
from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from second_algorithm.cli import main
from second_algorithm.storage import read_json, write_json


class InquiryCliTest(unittest.TestCase):
    def test_new_research_can_start_and_report_its_frontier_without_author_course(self):
        temporary = Path(__file__).resolve().parents[1] / ".local/inquiry-cli-tests"
        temporary.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temporary) as location:
            root = Path(location)
            write_json(root / "catalog/books.json", {"books": [{"id": "reference"}]})
            write_json(root / "catalog/sources.json", {"sources": [{"id": "problem-site"}]})

            def invoke(*arguments):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    code = main(["--root", str(root), "research", *arguments])
                return code, json.loads(output.getvalue())

            self.assertEqual(invoke("init", "first-study", "--goal", "Synthetic CLI research only")[0], 0)
            code, opened = invoke("open-study", "first-study", "--chapter", "future-chapter")
            self.assertEqual(code, 0, opened)
            self.assertFalse(opened["readyForHandoff"])
            code, status = invoke("study-status", "first-study")
            self.assertEqual(code, 0, status)
            self.assertEqual(status["nextPhase"], "overview")
            ledger = read_json(root / "work/jobs/first-study/study/ledger.json")
            self.assertEqual({row["id"] for row in ledger["entries"]},
                             {"book:reference", "source:problem-site"})
            self.assertTrue(all(row["relevance"] == "pending" for row in ledger["entries"]))
            self.assertFalse((root / "catalog/learning.json").exists())
            code, resumed = invoke("resume", "first-study")
            self.assertEqual(code, 0, resumed)
            self.assertEqual(resumed["researchStudy"]["nextPhase"], "overview")
            self.assertFalse(resumed["readyForReleasePreparation"])
            self.assertTrue(resumed["nextActions"])
            code, rejection = invoke("seal-handoff", "first-study")
            self.assertEqual(code, 1)
            self.assertFalse(rejection["ok"])
            self.assertFalse(list((root / "work/jobs/first-study/study").glob("handoffs/*")))
            code, rejection = invoke("checkpoint", "first-study", "--phase", "synthesis",
                                     "--record", "work/not-a-real-record.json")
            self.assertEqual(code, 1)
            self.assertIn("skip", rejection["error"])
