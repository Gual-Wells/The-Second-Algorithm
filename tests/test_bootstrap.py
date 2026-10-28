"""First publication is a real lifecycle transition, not a reduced curriculum.

These deliberately tiny synthetic contents test the facilities only. They are
not an assertion that a real algorithm domain has been researched completely.
"""
from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_inquiry import PHASES, seed_study, complete_study_fixture
from test_learning_workflow import LearningFixture
from second_algorithm.inquiry import checkpoint, check_handoff, study_status
from second_algorithm.learning import validate_learning
from second_algorithm.storage import read_json, write_json
from second_algorithm.workflow import init_job, job_status, verify_job, prepare_release, check_release


class BootstrapLifecycleTest(LearningFixture):
    def test_withdrawn_empty_course_can_publish_first_chapter_without_fabricated_history(self):
        publication = copy.deepcopy(self.publications)
        chapter_index = copy.deepcopy(self.chapter_index)
        model = copy.deepcopy(self.model)
        self.publications = {"schemaVersion": 2, "state": "withdrawn", "collections": []}
        self.model = {"schemaVersion": 2, "questions": [], "tasks": [], "targets": []}
        self.save()
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": []})
        init_job(self.root, "lesson-job", "Synthetic first-publication lifecycle")
        empty = verify_job(self.root, "lesson-job", None)
        self.assertTrue(empty["passed"], empty)
        self.assertEqual(empty["cppVerification"], "not-applicable")

        handoff_path = complete_study_fixture(self.root, job="bootstrap-study", chapter="unit")
        handoff = read_json(self.root / handoff_path)
        context = study_status(self.root, "bootstrap-study")["coordinationContext"]
        self.assertEqual(context["mode"], "no-prior-chapters")
        self.assertEqual(context["priorChapterIds"], [])
        self.assertFalse(context["comparisonApplicable"])
        self.assertEqual(handoff["base"]["publicationFrontier"]["chapters"], [])
        self.assertFalse(any(row["source"].startswith("chapter:") for row in handoff["dossier"]["materials"]))
        for pointer in handoff["checkpoints"]:
            stage = read_json(self.root / pointer["path"])
            if stage["phase"] in {"alignment", "scope-review"}:
                coordination = stage["record"]["chapterCoordination"]
                self.assertEqual(coordination["chapters"], [])
                self.assertTrue(coordination["emptyReason"].strip())
                self.assertTrue(coordination["domainIndependence"].strip())
                self.assertTrue(coordination["scopeDecision"].strip())

        self.publications, self.model, self.chapter_index = publication, model, chapter_index
        self.publications["state"] = "active"
        self.save()
        write_json(self.root / "catalog/chapters.json", self.chapter_index)
        self.contract["researchHandoff"] = handoff_path
        write_json(self.root / "content/unit/chapter.contract.json", self.contract)
        self.assertEqual(self.publications["collections"][0]["chapterNumber"], 1)
        # Registration of the first chapter must not make it its own predecessor.
        checked = check_handoff(self.root, handoff_path, chapter="unit")
        self.assertTrue(checked["ok"], checked)
        self.assertEqual(study_status(self.root, "bootstrap-study")["coordinationContext"], context)
        self.assertTrue(validate_learning(self.root)["ok"])
        self.notes()
        status = job_status(self.root, "lesson-job")
        self.assertFalse(status["verification"]["current"])
        self.assertFalse(status["readyForReleasePreparation"])
        with self.assertRaises(ValueError):
            prepare_release(self.root, "lesson-job")
        # The empty withdrawal receipt does not waive real first-content checks.
        with self.assertRaises(ValueError):
            verify_job(self.root, "lesson-job", None)
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            current = verify_job(self.root, "lesson-job", "fixture-c++")
        self.assertTrue(current["passed"], current)
        prepared = prepare_release(self.root, "lesson-job")
        self.assertEqual(prepared["release"]["operation"], "content-release")
        self.assertEqual(prepared["release"]["documents"], ["lesson"])
        self.assertEqual(len(prepared["release"]["researchHandoffs"]), 1)
        self.assertTrue(check_release(self.root, prepared["receipt"]["path"])["ok"])


class BootstrapBoundariesTest(unittest.TestCase):
    def setUp(self):
        temporary = Path(__file__).resolve().parents[1] / ".local/bootstrap-tests"
        temporary.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=temporary)
        self.root = Path(self.temporary.name).resolve()
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "state": "withdrawn", "collections": []})
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": []})
        self.folder = seed_study(self.root)

    def tearDown(self):
        self.temporary.cleanup()

    def step(self, phase):
        return checkpoint(self.root, "fixture-study", phase,
                          (self.folder / "records" / (phase + ".json")).relative_to(self.root).as_posix())

    def test_empty_target_still_requires_an_explicit_scope_review_record(self):
        for phase in PHASES[:PHASES.index("scope-review")]:
            self.step(phase)
        filename = self.folder / "records/scope-review.json"
        review = read_json(filename)
        review["chapterCoordination"].pop("emptyReason")
        write_json(filename, review)
        with self.assertRaisesRegex(ValueError, "empty prior"):
            self.step("scope-review")

    def test_first_chapter_cannot_manufacture_an_existing_chapter_comparison(self):
        self.step("overview")
        self.step("scope")
        filename = self.folder / "records/alignment.json"
        record = read_json(filename)
        record["chapterCoordination"]["chapters"] = [{"chapter": "invented"}]
        write_json(filename, record)
        with self.assertRaisesRegex(ValueError, "published formal chapter"):
            self.step("alignment")

    def test_a_chapter_arriving_during_first_research_invalidates_the_empty_baseline(self):
        self.step("overview")
        self.step("scope")
        self.step("alignment")
        write_json(self.root / "content/arrived/chapter.contract.json", {
            "schemaVersion": 2, "chapter": "arrived", "paradigm": {"name": "Another synthetic domain"},
            "scope": {"core": "Actual newly published fixture"}})
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": [{
            "id": "arrived", "collection": "arrived", "contract": "content/arrived/chapter.contract.json",
            "review": "content/arrived/chapter.review.json"}]})
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "state": "active", "collections": [{
            "id": "arrived", "title": "Arrived fixture", "kind": "chapter", "visibility": "published",
            "chapterNumber": 1, "documents": []}]})
        status = study_status(self.root, "fixture-study")
        self.assertFalse(status["readyForHandoff"])
        self.assertEqual(status["nextPhase"], "overview")
        self.assertTrue(any("base changed" in error for error in status["errors"]))
        with self.assertRaisesRegex(ValueError, "base changed"):
            self.step("collection")

    def test_malformed_publication_registry_is_not_an_empty_target(self):
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "collections": "broken"})
        with self.assertRaisesRegex(ValueError, "publication registry"):
            self.step("overview")

    def test_missing_registry_files_are_not_an_empty_target(self):
        for name in ("carrier/publications.json", "catalog/chapters.json"):
            with self.subTest(name=name):
                filename = self.root / name
                original = filename.read_bytes()
                filename.unlink()
                try:
                    with self.assertRaises(ValueError):
                        self.step("overview")
                finally:
                    filename.write_bytes(original)

    def prior_publication(self, *, state="active", omit_visibility=False):
        write_json(self.root / "content/prior/chapter.contract.json", {
            "schemaVersion": 2, "chapter": "prior", "paradigm": {"name": "Prior synthetic domain"},
            "scope": {"core": "Existing prior content"}})
        self.root.joinpath("content/prior/Lesson.source.md").write_text("Actual prior fixture body", encoding="utf-8")
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": [{
            "id": "prior", "collection": "prior", "contract": "content/prior/chapter.contract.json",
            "review": "content/prior/chapter.review.json"}]})
        collection = {"id": "prior", "title": "Prior fixture", "kind": "chapter", "visibility": "published",
                      "chapterNumber": 1, "documents": [{"id": "prior-doc", "title": "Prior body", "path": "content/prior/Lesson"}]}
        if omit_visibility:
            collection.pop("visibility")
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "state": state,
                                                            "collections": [collection]})

    def test_withdrawn_registry_with_published_content_is_not_a_bootstrap(self):
        self.prior_publication(state="withdrawn")
        with self.assertRaises(ValueError):
            self.step("overview")

    def test_published_default_visibility_cannot_be_used_as_an_empty_target(self):
        self.prior_publication(omit_visibility=True)
        folder = seed_study(self.root, job="default-visibility-study", chapter="next")
        context = study_status(self.root, "default-visibility-study")["coordinationContext"]
        self.assertEqual(context["mode"], "existing-chapters")
        self.assertEqual(context["priorChapterIds"], ["prior"])
        self.assertTrue(context["comparisonApplicable"])
        record = read_json(folder / "records/alignment.json")
        self.assertEqual([row["chapter"] for row in record["chapterCoordination"]["chapters"]], ["prior"])

    def test_real_prior_chapter_rejects_an_empty_state_claim(self):
        self.prior_publication()
        folder = seed_study(self.root, job="with-prior", chapter="next")
        for phase in ("overview", "scope"):
            checkpoint(self.root, "with-prior", phase,
                       (folder / "records" / (phase + ".json")).relative_to(self.root).as_posix())
        filename = folder / "records/alignment.json"
        record = read_json(filename)
        record["chapterCoordination"]["emptyReason"] = "There are no prior chapters"
        write_json(filename, record)
        with self.assertRaises(ValueError):
            checkpoint(self.root, "with-prior", "alignment", filename.relative_to(self.root).as_posix())

    def test_duplicate_target_registrations_cannot_hide_multiple_prior_collections(self):
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": [
            {"id": "unit", "collection": "own-one", "contract": "content/one/contract.json", "review": "content/one/review.json"},
            {"id": "unit", "collection": "own-two", "contract": "content/two/contract.json", "review": "content/two/review.json"}]})
        with self.assertRaises(ValueError):
            self.step("overview")
