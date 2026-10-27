from __future__ import annotations

import contextlib
import copy
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from second_algorithm.cli import main
from second_algorithm.learning import course_snapshot, course_targets, search_learning, validate_learning
from second_algorithm.storage import read_json, write_json
from second_algorithm.workflow import (add_evidence, check_release, init_job, job_status, prepare_release,
                                       resume_job, verify_course, verify_job)

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / ".local/learning-workflow-tests"
TEMP.mkdir(parents=True, exist_ok=True)
COMPILER = os.environ.get("ALGORITHM_TEST_CXX") or shutil.which("g++")
if not COMPILER:
    installed = Path("D:/CodexStorage/tools/w64devkit-2.10.1/w64devkit/bin/c++.exe")
    COMPILER = str(installed) if installed.is_file() else None


class LearningFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir=TEMP)
        self.root = Path(self.temporary.name).resolve()
        self.source = "content/unit/Lesson.cpp"
        self.draft = "content/unit/Lesson.source.md"
        self.put(self.source, '''#include <vector>
#include <algorithm>
// BEGIN manual
int lower_manual(const std::vector<int>& a, int x) {
    int l = 0, r = static_cast<int>(a.size());
    while (l < r) { int m = l + (r-l)/2; if (a[m] < x) l=m+1; else r=m; }
    return l;
}
// END manual
// BEGIN standard
int lower_standard(const std::vector<int>& a, int x) {
    return static_cast<int>(std::lower_bound(a.begin(), a.end(), x)-a.begin());
}
// END standard
''')
        self.put(self.draft, '# Lesson\n\n<a id="q000001"></a>\n\n### Q000001 · 边界在哪里\n\n实际解释。\n\n{{manual}}\n\n{{standard}}\n')
        self.put("tests/cpp/check.cpp", '''#include "../../content/unit/Lesson.cpp"
#include <cassert>
int main() {
  for (const auto a : {std::vector<int>{}, std::vector<int>{1,1,3}})
    for (int x=-1;x<=4;++x) {
      int expected=0; while(expected < static_cast<int>(a.size()) && a[expected]<x) ++expected;
      assert(lower_manual(a,x)==expected); assert(lower_standard(a,x)==expected);
    }
}
''')
        self.publications = {"schemaVersion": 2, "collections": [{"id": "unit", "title": "Unit", "kind": "chapter",
            "chapterNumber": 1, "visibility": "published", "documents": [{"id": "lesson", "title": "Lesson", "path": "content/unit/Lesson"}]}]}
        self.model = {"schemaVersion": 1,
            "questions": [{"id": "Q000001", "title": "边界在哪里", "document": "lesson", "anchor": "q000001",
                           "prerequisites": [], "sources": ["https://eel.is/c++draft/lower.bound"]}],
            "tasks": [{"id": "boundary", "title": "边界", "document": "lesson", "contract": "Sorted input; unchanged; first >= x or size.",
                "sourceUrls": ["https://example.com/task"], "methods": [{"id": "binary", "title": "二分", "invariant": "[l,r) contains boundary",
                "implementations": [{"id": "manual-boundary", "kind": "manual", "symbol": "lower_manual", "source": self.source,
                    "standard": "c++17", "regions": ["manual"], "questions": ["Q000001"], "complexity": {"time": "O(log n)", "space": "O(1)"}, "target": "boundaries"},
                    {"id": "standard-boundary", "kind": "standard", "symbol": "lower_standard", "source": self.source,
                     "standard": "c++17", "regions": ["standard"], "questions": ["Q000001"], "complexity": {"time": "O(log n)", "space": "O(1)"}, "target": "boundaries"}]}]}],
            "targets": [{"id": "boundaries", "kind": "run", "source": "tests/cpp/check.cpp", "standard": "c++17", "timeoutSeconds": 30}]}
        self.save()

    def tearDown(self):
        self.temporary.cleanup()

    def put(self, path, content):
        filename = self.root / path
        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_text(content, encoding="utf-8")

    def save(self):
        write_json(self.root / "catalog/learning.json", self.model)
        write_json(self.root / "carrier/publications.json", self.publications)

    def implementation(self):
        return self.model["tasks"][0]["methods"][0]["implementations"][0]

    def invalid(self, phrase):
        self.save()
        checked = validate_learning(self.root)
        self.assertFalse(checked["ok"], checked)
        self.assertIn(phrase, "\n".join(checked["errors"]))

    def notes(self):
        self.put("work/research.md", "Actually read the fixture task and library contract; scope is this fixture.\n")
        self.put("work/review.md", "Actually reviewed both source variants, Q placement and finite boundary oracle.\n")
        for kind in ("research", "review"):
            add_evidence(self.root, "lesson-job", kind=kind, path="work/"+kind+".md",
                         summary="Explicit fixture " + kind, outcome="accepted")

    @staticmethod
    def process_success(command, *args):
        return {"exit": 0, "stdout": "fixture compiler\n" if "--version" in command else "", "stderr": "", "timeout": False}

    def verified_job(self):
        init_job(self.root, "lesson-job", "Research the two implementations")
        self.notes()
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            self.assertTrue(verify_job(self.root, "lesson-job", "fixture-c++")["passed"])


class LearningModelTest(LearningFixture):
    def test_empty_course_requires_explicit_withdrawal_and_empty_registries(self):
        self.publications["collections"][0]["visibility"] = "hidden"
        self.model = {"schemaVersion": 1, "questions": [], "tasks": [], "targets": []}
        self.invalid("requires published documents")
        self.publications["state"] = "active"
        self.invalid("requires published documents")
        self.publications["state"] = "withdrawn"
        self.save()
        checked = validate_learning(self.root)
        self.assertTrue(checked["ok"], checked)
        self.assertEqual(checked["operation"], "withdrawal")
        self.assertEqual(course_targets(self.root), [])
        self.assertEqual(course_snapshot(self.root)["documents"], [])
        self.publications["state"] = "unknown"
        self.invalid("expected active or withdrawn")

    def test_withdrawal_rejects_published_authority_and_each_nonempty_registry(self):
        original = copy.deepcopy(self.model)
        self.publications["state"] = "withdrawn"
        self.invalid("Withdrawn publication requires")
        self.publications["collections"][0]["visibility"] = "hidden"
        for key in ("questions", "tasks", "targets"):
            with self.subTest(registry=key):
                self.model = {"schemaVersion": 1, "questions": [], "tasks": [], "targets": []}
                self.model[key] = original[key]
                self.invalid("Withdrawn publication requires")

    def test_valid_course_has_separate_coverage_and_search(self):
        result = validate_learning(self.root)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["counts"]["implementations"], 2)
        self.assertFalse(result["semanticCompletenessCertified"])
        self.assertEqual(search_learning(self.root, "Q000001")[0]["id"], "Q000001")
        self.assertEqual(course_targets(self.root)[0]["id"], "boundaries")
        # Unrelated historical records do not define current-course coverage.
        self.put("catalog/patterns.jsonl", "not valid JSON and not current course\n")
        self.assertTrue(validate_learning(self.root)["ok"])

    def test_duplicate_question_id_is_rejected(self):
        self.model["questions"].append(copy.deepcopy(self.model["questions"][0]))
        self.invalid("duplicate ID")

    def test_second_complete_heading_is_rejected_but_numbered_reference_is_valid(self):
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + "\n[[Q000001]]\n")
        self.assertTrue(validate_learning(self.root)["ok"])
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + "\n### Q000001 · 重讲\n")
        self.assertIn("exactly one", " ".join(validate_learning(self.root)["errors"]))

    def test_code_example_does_not_create_a_second_main_heading(self):
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + "\n```text\n### Q000001 · 示例字符串\n```\n")
        self.assertTrue(validate_learning(self.root)["ok"])

    def test_missing_main_and_unknown_reference_are_rejected(self):
        self.put(self.draft, "# Missing\n\n[[Q999999]]\n")
        errors = " ".join(validate_learning(self.root)["errors"])
        self.assertIn("main heading", errors)
        self.assertIn("unknown question", errors)

    def test_hidden_document_cannot_satisfy_a_published_question(self):
        self.publications["collections"][0]["visibility"] = "hidden"
        self.invalid("published document")

    def test_draft_is_hidden_unnumbered_and_track_is_forbidden(self):
        self.publications["collections"][0]["kind"] = "draft"
        self.invalid("drafts must be hidden")
        self.publications["collections"][0]["kind"] = "chapter"
        self.publications["collections"][0]["track"] = "algorithm"
        self.invalid("track is not part")

    def test_prerequisites_must_exist_and_be_acyclic(self):
        second = {**self.model["questions"][0], "id": "Q000002", "anchor": "q000002", "prerequisites": ["Q000001"]}
        self.model["questions"].append(second)
        self.model["questions"][0]["prerequisites"] = ["Q000002"]
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + '\n<a id="q000002"></a>\n\n### Q000002 · 第二问\n\n解释\n')
        self.invalid("cycle")
        self.model["questions"][0]["prerequisites"] = ["Q999999"]
        self.invalid("unknown prerequisite")

    def test_region_and_symbol_must_be_real(self):
        self.implementation()["regions"] = ["not-a-region"]
        self.invalid("missing source region")
        self.implementation()["regions"] = ["standard"]
        self.invalid("symbol absent")

    def test_target_must_reach_actual_source_and_support_its_standard(self):
        self.put("tests/cpp/unrelated.cpp", "int main() {}\n")
        self.model["targets"][0]["source"] = "tests/cpp/unrelated.cpp"
        self.invalid("does not depend")
        self.model["targets"][0]["source"] = "tests/cpp/check.cpp"
        self.implementation()["standard"] = "c++20"
        self.invalid("older than implementation")

    def test_local_dependency_changes_invalidate_the_fingerprint(self):
        self.put("content/unit/support.hpp", "#pragma once\nconstexpr int support=1;\n")
        self.put(self.source, '#include "support.hpp"\n' + (self.root/self.source).read_text(encoding="utf-8"))
        first = course_snapshot(self.root)
        self.assertIn("content/unit/support.hpp", first["inputs"])
        self.put("content/unit/support.hpp", "#pragma once\nconstexpr int support=2;\n")
        self.assertNotEqual(first["inputHash"], course_snapshot(self.root)["inputHash"])

    def test_reader_source_is_bound_but_runtime_cache_is_not(self):
        self.put("web/app.js", "const version = 1;\n")
        first = course_snapshot(self.root)
        self.put("server/node_modules/example/runtime.js", "ephemeral dependency cache\n")
        self.assertEqual(first["inputHash"], course_snapshot(self.root)["inputHash"])
        self.put("web/app.js", "const version = 2;\n")
        self.assertNotEqual(first["inputHash"], course_snapshot(self.root)["inputHash"])
        current = course_snapshot(self.root)
        self.put("web/assets/reader.woff2", "future copied static font bytes\n")
        self.assertIn("web/assets/reader.woff2", course_snapshot(self.root)["inputs"])
        self.assertNotEqual(current["inputHash"], course_snapshot(self.root)["inputHash"])

    def test_remote_configuration_and_all_effective_rules_are_bound(self):
        first = course_snapshot(self.root)
        files = ["wrangler.jsonc", "migrations/nested/0002_state.sql", "protocol/IMPLEMENTATION_STANDARD.md",
                 "protocol/TASK_EXECUTION.md", ".github/workflows/validate.yml", "second_algorithm/storage.py",
                 "second_algorithm/cli.py", "test/carrier-deploy.test.mjs", "tests/test_reading_assets.py"]
        for filename in files:
            with self.subTest(filename=filename):
                self.put(filename, "effective input\n")
                after = course_snapshot(self.root)
                self.assertIn(filename, after["inputs"])
                self.assertNotEqual(first["inputHash"], after["inputHash"])
                (self.root / filename).unlink()
                self.assertEqual(first["inputHash"], course_snapshot(self.root)["inputHash"])

    def test_path_escape_and_temporary_question_ids_fail_closed(self):
        self.model["targets"][0]["source"] = "../outside.cpp"
        self.invalid("Path escapes repository")
        self.model["targets"][0]["source"] = "tests/cpp/check.cpp"
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + "\ndraftq:job:agent:new\n")
        self.assertIn("temporary question", " ".join(validate_learning(self.root)["errors"]))


class ResearchWorkflowTest(LearningFixture):
    def test_withdrawal_keeps_evidence_gate_and_never_claims_cpp_compilation(self):
        self.publications.update(state="withdrawn", collections=[])
        self.model = {"schemaVersion": 1, "questions": [], "tasks": [], "targets": []}
        self.save()
        init_job(self.root, "lesson-job", "Withdraw previous content")
        with patch("second_algorithm.workflow._process") as process:
            result = verify_job(self.root, "lesson-job", None)
        process.assert_not_called()
        self.assertTrue(result["passed"])
        self.assertEqual(result["cppVerification"], "not-applicable")
        self.assertIsNone(result["compiler"])
        self.assertEqual(result["targets"], [])
        self.assertFalse(job_status(self.root, "lesson-job")["readyForReleasePreparation"])
        with self.assertRaisesRegex(ValueError, "Release not ready"):
            prepare_release(self.root, "lesson-job")
        self.notes()
        prepared = prepare_release(self.root, "lesson-job")
        self.assertEqual(prepared["release"]["operation"], "withdrawal")
        checked = check_release(self.root, prepared["receipt"]["path"])
        self.assertEqual(checked["publicationState"], "withdrawn")
        self.assertEqual(checked["documents"], [])
        packet_path = self.root / prepared["receipt"]["path"]
        packet_bytes = packet_path.read_bytes()
        wrong_operation = read_json(packet_path)
        wrong_operation["operation"] = "content-release"
        write_json(packet_path, wrong_operation)
        with self.assertRaisesRegex(ValueError, "lifecycle"):
            check_release(self.root, prepared["receipt"]["path"])
        packet_path.write_bytes(packet_bytes)
        self.publications["state"] = "active"
        self.save()
        with self.assertRaises(ValueError):
            check_release(self.root, prepared["receipt"]["path"])

    def test_active_verification_still_requires_explicit_compiler(self):
        with patch("second_algorithm.workflow._process") as process:
            with self.assertRaisesRegex(ValueError, "explicitly selected C\\+\\+ compiler"):
                verify_course(self.root, None)
        process.assert_not_called()

    def test_prepare_requires_actual_note_records_and_verification(self):
        init_job(self.root, "lesson-job", "Research this course")
        with self.assertRaisesRegex(ValueError, "Release not ready"):
            prepare_release(self.root, "lesson-job")
        self.notes()
        self.assertFalse(job_status(self.root, "lesson-job")["readyForReleasePreparation"])

    def test_release_becomes_stale_on_source_change_without_overwriting_last_good(self):
        self.verified_job()
        prepared = prepare_release(self.root, "lesson-job")
        self.assertFalse(prepared["release"]["deployed"])
        path = self.root/"work/jobs/lesson-job/job.json"
        before = read_json(path)
        self.put(self.source, (self.root/self.source).read_text(encoding="utf-8") + "\n// actual changed input\n")
        status = resume_job(self.root, "lesson-job")
        self.assertFalse(status["readyForReleasePreparation"])
        self.assertEqual(status["evidence"]["review"]["reason"], "stale-inputs")
        with self.assertRaises(ValueError):
            prepare_release(self.root, "lesson-job")
        self.assertEqual(before, read_json(path))

    def test_changed_semantic_note_and_new_needs_work_review_block_release(self):
        self.verified_job()
        self.put("work/review.md", "Changed since this review was registered.\n")
        self.assertEqual(job_status(self.root, "lesson-job")["evidence"]["review"]["reason"], "evidence-changed")
        add_evidence(self.root, "lesson-job", kind="review", path="work/review.md", summary="Found unresolved issue", outcome="needs-work")
        with self.assertRaises(ValueError):
            prepare_release(self.root, "lesson-job")

    def test_failed_latest_attempt_preserves_last_good_but_blocks_preparation(self):
        self.verified_job()
        filename = self.root/"work/jobs/lesson-job/job.json"
        previous = read_json(filename)["lastGoodVerification"]

        def failure(command, *args):
            if "--version" in command:
                return self.process_success(command)
            return {"exit": 1, "stdout": "", "stderr": "fixture compile failure", "timeout": False}
        with patch("second_algorithm.workflow._process", side_effect=failure):
            self.assertFalse(verify_job(self.root, "lesson-job", "fixture-c++")["passed"])
        self.assertEqual(previous, read_json(filename)["lastGoodVerification"])
        self.assertEqual(job_status(self.root, "lesson-job")["verification"]["reason"], "latest-attempt-failed")
        with self.assertRaises(ValueError):
            prepare_release(self.root, "lesson-job")

    def test_receipt_tampering_is_detected(self):
        self.verified_job()
        pointer = read_json(self.root/"work/jobs/lesson-job/job.json")["lastGoodVerification"]
        filename = self.root/pointer["path"]
        filename.write_text(filename.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        self.assertFalse(job_status(self.root, "lesson-job")["verification"]["current"])

    def test_deployment_packet_check_rejects_missing_and_stale_inputs(self):
        self.verified_job()
        prepared = prepare_release(self.root, "lesson-job")
        packet = prepared["receipt"]["path"]
        self.assertTrue(check_release(self.root, packet)["ok"])
        with self.assertRaises(ValueError):
            check_release(self.root, "work/jobs/lesson-job/releases/missing.json")
        self.put(self.source, (self.root/self.source).read_text(encoding="utf-8") + "\n// changed source\n")
        with self.assertRaisesRegex(ValueError, "stale"):
            check_release(self.root, packet)

    def test_prepared_packet_cannot_authorize_changed_remote_side_effects_or_rules(self):
        files = ["wrangler.jsonc", "migrations/0001.sql", "protocol/TASK_EXECUTION.md",
                 ".github/workflows/validate.yml", "second_algorithm/storage.py"]
        for filename in files:
            self.put(filename, "reviewed input\n")
        self.verified_job()
        packet = prepare_release(self.root, "lesson-job")["receipt"]["path"]
        for filename in files:
            with self.subTest(filename=filename):
                self.put(filename, "changed input after review\n")
                with self.assertRaisesRegex(ValueError, "stale"):
                    check_release(self.root, packet)
                self.put(filename, "reviewed input\n")
                self.assertTrue(check_release(self.root, packet)["ok"])
        self.put("migrations/new/0002.sql", "new remote operation\n")
        with self.assertRaisesRegex(ValueError, "stale"):
            check_release(self.root, packet)

    def test_ephemeral_note_cannot_be_smuggled_through_a_normalized_path(self):
        init_job(self.root, "lesson-job", "Goal")
        self.put(".local/note.md", "Not a durable note\n")
        with self.assertRaisesRegex(ValueError, "durable"):
            add_evidence(self.root, "lesson-job", kind="review", path="work/../.local/note.md", summary="No", outcome="accepted")

    def test_existing_packet_cannot_override_a_later_negative_review(self):
        self.verified_job()
        packet = prepare_release(self.root, "lesson-job")["receipt"]["path"]
        add_evidence(self.root, "lesson-job", kind="review", path="work/review.md", summary="A newly identified unresolved contract", outcome="needs-work")
        with self.assertRaisesRegex(ValueError, "no longer current"):
            check_release(self.root, packet)

    def test_status_and_resume_are_read_only_and_init_never_replaces_job(self):
        init_job(self.root, "lesson-job", "Real research goal")
        filename = self.root/"work/jobs/lesson-job/job.json"
        original = filename.read_bytes()
        job_status(self.root, "lesson-job")
        resume_job(self.root, "lesson-job")
        with self.assertRaises(ValueError):
            init_job(self.root, "lesson-job", "Overwrite")
        self.assertEqual(filename.read_bytes(), original)

    def test_timeout_is_failure_and_does_not_create_last_good(self):
        with patch("second_algorithm.workflow.subprocess.run", side_effect=subprocess.TimeoutExpired("fixture", 1)):
            result = verify_course(self.root, "fixture-c++")
        self.assertFalse(result["passed"])
        self.assertTrue(result["compiler"]["timeout"])
        self.assertFalse((self.root/".local/course-verification/last-good.json").exists())

    def test_cli_targets_is_json_and_invalid_model_has_nonzero_exit(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(["--root", str(self.root), "course", "targets"]), 0)
        self.assertEqual(json.loads(output.getvalue())[0]["id"], "boundaries")
        self.implementation()["target"] = "missing"
        self.save()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(["--root", str(self.root), "course", "validate"]), 1)

    @unittest.skipUnless(COMPILER, "No existing C++ compiler found; no installation attempted")
    def test_real_cpp17_toolchain_runs_both_implementations_and_diagnostic_target(self):
        self.put("tests/cpp/invalid.cpp", "int main() { int* value = 42; }\n")
        self.model["targets"].append({"id": "invalid-program", "kind": "compile-fail", "source": "tests/cpp/invalid.cpp", "standard": "c++17", "timeoutSeconds": 30})
        self.save()
        result = verify_course(self.root, COMPILER)
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["targets"][0]["run"]["exit"], 0)
        self.assertIsNone(result["targets"][1]["run"])
        self.assertEqual(result["targets"][1]["compile"]["exit"], 1)


if __name__ == "__main__":
    unittest.main()
