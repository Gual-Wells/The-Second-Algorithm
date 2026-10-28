from __future__ import annotations

import contextlib
import copy
import io
import json
from unittest.mock import patch

from test_learning_workflow import LearningFixture
from second_algorithm.chapters import _research_binding, chapter_inputs, chapter_quality, render_chapters
from second_algorithm.cli import main
from second_algorithm.learning import course_snapshot, validate_learning
from second_algorithm.storage import digest, read_json, write_json
from second_algorithm.workflow import add_evidence, check_release, init_job, job_status, prepare_release, verify_job


class ChapterHelpers:
    def save_contract(self):
        write_json(self.root / "content/unit/chapter.contract.json", self.contract)

    def review(self):
        return read_json(self.root / "content/unit/chapter.review.json")

    def put_review(self, review):
        write_json(self.root / "content/unit/chapter.review.json", review)

    def accepted_fixture(self):
        init_job(self.root, "lesson-job", "Fixture editorial review")
        self.notes()


class ResearchAdoptionTest(ChapterHelpers, LearningFixture):
    """Real fixture packets/receipts exercise historical adoption, not content quality."""

    def published_fixture(self):
        self.put("wrangler.jsonc", '{"vars":{"APP_ORIGIN":"https://example.com"}}\n')
        self.verified_job()
        before = course_snapshot(self.root)["inputHash"]
        prepared = prepare_release(self.root, "lesson-job")
        packet = prepared["receipt"]["path"]
        receipt_path = "work/jobs/lesson-job/deployments/first.json"
        receipt = {"schemaVersion": 1, "packet": packet,
            "packetSha256": digest((self.root / packet).read_bytes()),
            "inputHash": prepared["release"]["inputHash"],
            "researchHandoffs": prepared["release"]["researchHandoffs"],
            "origin": "https://example.com", "deployedAt": "2026-10-28T10:00:00+00:00",
            "build": "synthetic-build", "anonymousBoundaryVerified": True, "passed": True}
        write_json(self.root / receipt_path, receipt)
        self.assertEqual(before, course_snapshot(self.root)["inputHash"])
        self.assertTrue(check_release(self.root, packet)["ok"])
        return receipt_path, packet

    def expand_base(self):
        books = read_json(self.root / "catalog/books.json")
        books["books"].append({"id": "later-book"})
        write_json(self.root / "catalog/books.json", books)

    def test_new_chapter_cannot_claim_adoption_without_verified_previous_publication(self):
        self.accepted_fixture()
        self.expand_base()
        self.contract["adopted"] = True  # A caller-written flag is not evidence.
        self.save_contract()
        self.notes()
        self.assertFalse(_research_binding(self.root, "unit", self.contract)["ok"])
        self.assertFalse(chapter_quality(self.root)["ok"])

    def test_published_handoff_survives_later_base_growth_and_can_publish_again(self):
        receipt_path, packet = self.published_fixture()
        self.expand_base()
        from second_algorithm.inquiry import check_handoff
        self.assertFalse(check_handoff(self.root, self.contract["researchHandoff"])["ok"])
        binding = _research_binding(self.root, "unit", self.contract)
        self.assertTrue(binding["ok"], binding)
        self.assertTrue(binding["adopted"])
        self.assertEqual(binding["adoptionProof"]["deployment"], receipt_path)
        inputs = course_snapshot(self.root)["inputs"]
        self.assertIn(receipt_path, inputs)
        self.assertIn(packet, inputs)
        self.notes()  # Current editorial impact review remains necessary.
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        next_release = prepare_release(self.root, "lesson-job")
        self.assertTrue(check_release(self.root, next_release["receipt"]["path"])["ok"])
        before = course_snapshot(self.root)["inputHash"]
        later_receipt = read_json(self.root / receipt_path)
        later_receipt.update(packet=next_release["receipt"]["path"],
                             packetSha256=next_release["receipt"]["sha256"],
                             inputHash=next_release["release"]["inputHash"],
                             researchHandoffs=next_release["release"]["researchHandoffs"],
                             deployedAt="2026-10-29T10:00:00+00:00")
        write_json(self.root / "work/jobs/lesson-job/deployments/later.json", later_receipt)
        self.assertEqual(before, course_snapshot(self.root)["inputHash"])
        self.assertTrue(check_release(self.root, next_release["receipt"]["path"])["ok"])

    def test_modified_deployment_or_packet_cannot_authorize_historical_adoption(self):
        receipt_path, packet_path = self.published_fixture()
        self.expand_base()
        self.assertTrue(_research_binding(self.root, "unit", self.contract)["ok"])
        original_receipt = (self.root / receipt_path).read_bytes()
        receipt = read_json(self.root / receipt_path)
        receipt["researchHandoffs"] = []
        write_json(self.root / receipt_path, receipt)
        self.assertFalse(_research_binding(self.root, "unit", self.contract)["ok"])
        (self.root / receipt_path).write_bytes(original_receipt)
        packet_bytes = (self.root / packet_path).read_bytes()
        (self.root / packet_path).write_bytes(packet_bytes + b"\n")
        self.assertFalse(_research_binding(self.root, "unit", self.contract)["ok"])
        (self.root / packet_path).write_bytes(packet_bytes)
        self.assertTrue(_research_binding(self.root, "unit", self.contract)["ok"])

    def test_historical_adoption_never_waives_changed_own_research_notes(self):
        self.published_fixture()
        self.expand_base()
        self.assertTrue(_research_binding(self.root, "unit", self.contract)["ok"])
        self.put("work/material.md", "Changed actual research evidence after publication.\n")
        self.assertFalse(_research_binding(self.root, "unit", self.contract)["ok"])

    def test_second_actual_chapter_can_publish_without_rebuilding_first_research(self):
        """Two tiny copies test lifecycle mechanics, never real chapter selection."""
        self.published_fixture()
        first_handoff = self.contract["researchHandoff"]
        first_handoff_bytes = (self.root / first_handoff).read_bytes()
        first_study = self.root / "work/jobs/fixture-study/study/study.json"
        first_study_bytes = first_study.read_bytes()
        second_source, second_draft = "content/second/Lesson.cpp", "content/second/Lesson.source.md"
        self.put(second_source, (self.root / self.source).read_text(encoding="utf-8"))
        self.put(second_draft, (self.root / self.draft).read_text(encoding="utf-8").replace(
            "{{knowledge:Q000001}}", "[[Q000001|边界在哪里]]"))
        self.put("tests/cpp/second.cpp", (self.root / "tests/cpp/check.cpp").read_text(encoding="utf-8").replace(
            "../../content/unit/Lesson.cpp", "../../content/second/Lesson.cpp"))
        second_collection = copy.deepcopy(self.publications["collections"][0])
        second_collection.update(id="second", title="Second synthetic chapter", chapterNumber=2,
            documents=[{"id": "lesson-second", "title": "Second fixture", "path": "content/second/Lesson"}])
        self.publications["collections"].append(second_collection)
        second_task = copy.deepcopy(self.model["tasks"][0])
        second_task.update(id="boundary-second", document="lesson-second")
        second_task["methods"][0]["id"] = "binary-second"
        for implementation in second_task["methods"][0]["implementations"]:
            implementation.update(id=implementation["id"] + "-second", source=second_source, target="boundaries-second")
        self.model["tasks"].append(second_task)
        self.model["targets"].append({"id": "boundaries-second", "kind": "run", "source": "tests/cpp/second.cpp",
                                      "standard": "c++17", "timeoutSeconds": 30})
        self.save()
        second_contract = copy.deepcopy(self.contract)
        second_contract.update(chapter="second", title="Second synthetic contract")
        second_contract.pop("researchHandoff")
        second_contract["materials"][0].update(id="outside-second", evidence="work/second-material.md")
        second_contract["paradigm"]["corpusEvidence"] = ["outside-second"]
        second_contract["paradigm"]["branches"][0]["materialIds"] = ["outside-second"]
        for promise in second_contract["commitments"]:
            promise.update(taskIds=["boundary-second"], materialIds=["outside-second"])
        second_contract["reading"]["units"][0].update(taskIds=["boundary-second"],
            manualImplementationIds=["manual-boundary-second"], standardImplementationIds=["standard-boundary-second"])

        def second_locations(value):
            if isinstance(value, dict):
                if value.get("document") == "lesson":
                    value["document"] = "lesson-second"
                for item in value.values():
                    second_locations(item)
            elif isinstance(value, list):
                for item in value:
                    second_locations(item)

        second_locations(second_contract)
        self.chapter_index["chapters"].append({"id": "second", "collection": "second",
            "contract": "content/second/chapter.contract.json", "review": "content/second/chapter.review.json"})
        write_json(self.root / "catalog/chapters.json", self.chapter_index)
        write_json(self.root / "content/second/chapter.contract.json", second_contract)
        from test_inquiry import complete_study_fixture
        second_contract["researchHandoff"] = complete_study_fixture(self.root, job="second-study", chapter="second",
            paradigm="Binary search", branch="ordered", material="outside-second", note="work/second-material.md",
            problem_type="boundary-unit")
        write_json(self.root / "content/second/chapter.contract.json", second_contract)
        self.assertTrue(validate_learning(self.root)["ok"], validate_learning(self.root))
        first_binding = _research_binding(self.root, "unit", self.contract)
        second_binding = _research_binding(self.root, "second", second_contract)
        self.assertTrue(first_binding["ok"], first_binding)
        self.assertTrue(first_binding["adopted"])
        self.assertTrue(second_binding["ok"], second_binding)
        self.assertFalse(second_binding["adopted"])
        self.notes()
        second_review = copy.deepcopy(self.review())
        second_review.update(chapter="second", outsideChallenge={"materialIds": ["outside-second"],
            "findings": "Independent fixture check of boundary conditions"})
        second_locations(second_review)
        write_json(self.root / "content/second/chapter.review.json", second_review)
        self.notes()  # Register current generic evidence after both reviews exist.
        self.assertTrue(chapter_quality(self.root)["ok"], chapter_quality(self.root))
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        release = prepare_release(self.root, "lesson-job")
        self.assertTrue(check_release(self.root, release["receipt"]["path"])["ok"])
        handoffs = {row["chapter"]: row for row in release["release"]["researchHandoffs"]}
        self.assertEqual(set(handoffs), {"unit", "second"})
        self.assertTrue(handoffs["unit"]["adopted"])
        self.assertFalse(handoffs["second"]["adopted"])
        self.assertEqual(first_handoff_bytes, (self.root / first_handoff).read_bytes())
        self.assertEqual(first_study_bytes, first_study.read_bytes())


class ChapterContractTest(ChapterHelpers, LearningFixture):
    def test_missing_chapter_index_cannot_disable_quality_gate(self):
        (self.root / "catalog/chapters.json").unlink()
        self.assertFalse(validate_learning(self.root)["ok"])
        self.assertFalse(chapter_quality(self.root)["ok"])

    def test_empty_registry_or_duplicate_collection_cannot_evade_one_contract_per_chapter(self):
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": []})
        self.assertIn("Every published chapter", " ".join(validate_learning(self.root)["errors"]))
        self.chapter_index["chapters"].append({**self.chapter_index["chapters"][0], "id": "other"})
        write_json(self.root / "catalog/chapters.json", self.chapter_index)
        self.assertIn("unique published chapter", " ".join(validate_learning(self.root)["errors"]))

    def test_open_gap_remains_structurally_valid_but_blocks_publication(self):
        promise = self.contract["commitments"][0]
        promise.update(status="open", gap="Actual difficulty relationship is not taught", locations=[])
        self.save_contract()
        self.accepted_fixture()
        self.assertTrue(validate_learning(self.root)["ok"])
        self.assertIn("open promise", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            self.assertTrue(verify_job(self.root, "lesson-job", "fixture-c++")["passed"])
        self.assertFalse(job_status(self.root, "lesson-job")["readyForReleasePreparation"])
        with self.assertRaisesRegex(ValueError, "chapter-quality"):
            prepare_release(self.root, "lesson-job")

    def test_generic_accepted_evidence_does_not_replace_chapter_review(self):
        init_job(self.root, "lesson-job", "Only generic notes")
        self.put("work/research.md", "Fixture research")
        self.put("work/review.md", "Generic accepted does not assess chapter promises")
        for kind in ("research", "review"):
            add_evidence(self.root, "lesson-job", kind=kind, path="work/" + kind + ".md", summary="generic", outcome="accepted")
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        self.assertFalse(job_status(self.root, "lesson-job")["readyForReleasePreparation"])

    def test_all_four_dimensions_and_meaningful_open_gap_are_required(self):
        self.contract["commitments"].pop()
        self.save_contract()
        self.assertIn("readability", " ".join(validate_learning(self.root)["errors"]))
        self.contract["commitments"][0].update(status="open", gap="")
        self.save_contract()
        self.assertIn("commitment.gap", " ".join(validate_learning(self.root)["errors"]))

    def test_real_prose_locations_and_material_task_relationships_are_required(self):
        self.contract["commitments"][0]["locations"][0]["anchor"] = "imagined"
        self.contract["commitments"][1]["taskIds"] = ["imagined"]
        self.contract["commitments"][2]["materialIds"] = ["imagined"]
        self.save_contract()
        errors = " ".join(validate_learning(self.root)["errors"])
        self.assertIn("missing explicit prose anchor", errors)
        self.assertIn("commitment task", errors)
        self.assertIn("unknown commitment material", errors)

    def test_commented_or_fenced_anchor_is_not_teaching_evidence(self):
        for addition in ('\n<!-- <a id="not-real"></a> -->\n', '\n```html\n<a id="not-real"></a>\n```\n',
                         '\n`<a id="not-real"></a>`\n', '\n    <a id="not-real"></a>\n',
                         '\n\t<a id="not-real"></a>\n', '\n`multiline\n<a id="not-real"></a>\nend`\n',
                         '\n~~~html\n<a id="not-real"></a>\n~~~\n'):
            with self.subTest(addition=addition):
                self.put(self.draft, '# Lesson\n\n<a id="q000001"></a>\n\n### Q000001 · 边界在哪里\n' + addition)
                self.contract["commitments"][0]["locations"][0]["anchor"] = "not-real"
                self.save_contract()
                self.assertIn("missing explicit prose anchor", " ".join(validate_learning(self.root)["errors"]))

    def test_malformed_task_collection_and_document_arrays_fail_clearly(self):
        for target in ("tasks", "collections", "documents"):
            with self.subTest(target=target):
                if target == "tasks":
                    self.model[target] = [None]
                elif target == "collections":
                    self.publications[target] = [None]
                else:
                    self.publications["collections"][0][target] = [None]
                self.save()
                result = validate_learning(self.root)
                self.assertFalse(result["ok"])
                self.assertIn("expected an object array", " ".join(result["errors"]))
                # Restore actual fixtures without invoking setUp twice.
                if target == "tasks":
                    self.model[target] = []
                elif target == "collections":
                    self.publications[target] = [{"id": "unit", "kind": "chapter", "chapterNumber": 1,
                        "title": "Unit", "documents": [{"id": "lesson", "title": "Lesson", "path": "content/unit/Lesson"}]}]

    def test_noncanonical_review_and_material_paths_cannot_hide_self_reference(self):
        self.accepted_fixture()
        for path in ("content/unit/./chapter.review.json", "content/unit/../unit/chapter.review.json", "content\\unit\\chapter.review.json"):
            with self.subTest(path=path):
                self.chapter_index["chapters"][0]["review"] = path
                write_json(self.root / "catalog/chapters.json", self.chapter_index)
                self.contract["materials"][0]["sourcePaths"] = ["content/unit/chapter.review.json"]
                self.save_contract()
                checked = validate_learning(self.root)
                self.assertFalse(checked["ok"])
                self.assertIn("canonical relative POSIX", " ".join(checked["errors"]))
        self.chapter_index["chapters"][0]["review"] = "content/unit/chapter.review.json"
        write_json(self.root / "catalog/chapters.json", self.chapter_index)
        self.contract["materials"][0]["sourcePaths"] = ["content/unit/./chapter.review.json"]
        self.save_contract()
        self.assertIn("canonical relative POSIX", " ".join(validate_learning(self.root)["errors"]))

    def test_reading_path_open_is_legal_but_missing_route_blocks_release(self):
        self.contract["reading"] = {"status": "open", "gap": "No coherent reader route yet"}
        if self.contract.get("schemaVersion") == 2:
            self.contract["paradigm"].update(status="open", gap="The type map is still being formed", branches=[])
        self.save_contract()
        self.accepted_fixture()
        self.assertTrue(validate_learning(self.root)["ok"])
        self.assertIn("reading structure is open", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
        self.assertIn("No coherent reader route", render_chapters(self.root, "unit"))

    def test_addressed_reading_path_requires_entry_units_map_and_real_task_coverage(self):
        for field in ("entry", "units", "selectionMap"):
            original = self.contract["reading"][field]
            self.contract["reading"][field] = []
            self.save_contract()
            self.assertFalse(validate_learning(self.root)["ok"])
            self.contract["reading"][field] = original
        self.contract["reading"]["units"][0]["taskIds"] = []
        self.save_contract()
        self.assertIn("every chapter task", " ".join(validate_learning(self.root)["errors"]))
        self.contract["reading"]["units"][0]["taskIds"] = ["not-a-task"]
        self.save_contract()
        self.assertIn("unit task", " ".join(validate_learning(self.root)["errors"]))

    def test_review_hash_has_no_self_reference_and_final_snapshot_binds_review_bytes(self):
        self.accepted_fixture()
        before = chapter_inputs(self.root, "unit")["inputHash"]
        full_before = course_snapshot(self.root)["inputHash"]
        review = self.review()
        review["comparison"]["findings"] += " Additional actual observation."
        self.put_review(review)
        self.assertEqual(before, chapter_inputs(self.root, "unit")["inputHash"])
        self.assertNotEqual(full_before, course_snapshot(self.root)["inputHash"])
        self.assertTrue(chapter_quality(self.root)["ok"])
        self.assertFalse(job_status(self.root, "lesson-job")["evidence"]["review"]["current"])

    def test_contract_source_material_rules_and_review_path_change_invalidate_review(self):
        self.accepted_fixture()
        for filename in (self.draft, self.source, "work/material.md", "content/unit/chapter.contract.json", "protocol/CHAPTER_STANDARD.md"):
            with self.subTest(filename=filename):
                path = self.root / filename
                original = path.read_bytes() if path.exists() else None
                self.put(filename, (original.decode("utf-8") if original else "# Rules") + "\n ")
                self.assertIn("stale", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
                if original is None:
                    path.unlink()
                else:
                    path.write_bytes(original)
        self.put("content/unit/other.review.json", json.dumps(self.review()))
        self.chapter_index["chapters"][0]["review"] = "content/unit/other.review.json"
        write_json(self.root / "catalog/chapters.json", self.chapter_index)
        self.assertIn("stale", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_each_promise_requires_reasoned_assessment_and_real_location(self):
        self.accepted_fixture()
        review = self.review()
        review["assessments"].pop()
        self.put_review(review)
        self.assertIn("every chapter promise", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
        self.notes()
        review = self.review()
        review["assessments"][0].update(reason="", locations=[])
        self.put_review(review)
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        self.assertIn("nonempty text", errors)
        self.assertIn("actual prose location", errors)

    def test_negative_review_cannot_be_covered_by_accepted_verdict(self):
        self.accepted_fixture()
        review = self.review()
        review["assessments"][0]["outcome"] = "gap"
        self.put_review(review)
        self.assertFalse(chapter_quality(self.root)["ok"])

    def test_outside_challenge_cannot_reference_only_author_material(self):
        self.accepted_fixture()
        self.contract["materials"][0]["kind"] = "task"
        self.save_contract()
        self.notes()
        self.assertIn("countercheck materials", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_review_cannot_be_its_own_material_input(self):
        self.accepted_fixture()
        self.contract["materials"][0]["sourcePaths"] = ["content/unit/chapter.review.json"]
        self.save_contract()
        self.assertIn("own review hash", " ".join(validate_learning(self.root)["errors"]))

    def test_chapter_commands_expose_gaps_as_readable_text_and_nonzero_quality_exit(self):
        self.contract["commitments"][0].update(status="open", gap="Missing method direction comparison")
        self.save_contract()
        self.assertIn("Missing method direction", render_chapters(self.root, "unit"))
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(["--root", str(self.root), "course", "quality"]), 1)
        self.assertIn("阻止发布", output.getvalue())
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(main(["--root", str(self.root), "course", "chapters", "unit"]), 0)
        self.assertIn("难度高度", output.getvalue())

    def test_withdrawal_ignores_retired_contract_and_review(self):
        self.publications.update(state="withdrawn", collections=[])
        self.model = {"schemaVersion": 1, "questions": [], "tasks": [], "targets": []}
        self.save()
        self.put("catalog/chapters.json", "retired invalid catalogue")
        self.assertTrue(validate_learning(self.root)["ok"])
        self.assertTrue(chapter_quality(self.root)["ok"])


class ParadigmContractTest(ChapterHelpers, LearningFixture):
    """Synthetic fixtures exercise relationships, never certify a real chapter."""

    def setUp(self):
        super().setUp()
        # A complete but intentionally tiny test corpus is not a production
        # recommendation for how broadly a real binary-search chapter should be.
        self.put(self.draft, '# Lesson\n\n<a id="prelude"></a>\n\n## Thought and scope\n\nFixture theory.\n'
                 '\n<a id="boundary-type"></a>\n\n## Ordered boundaries\n'
                 '\n<a id="q000001"></a>\n\n{{knowledge:Q000001}}\n'
                 '\n{{manual}}\n\n{{standard}}\n\n[Boundary](https://example.com/task)\n')
        self.model["schemaVersion"] = 2
        question = self.model["questions"][0]
        question.pop("document", None)
        question.pop("anchor", None)
        question["source"] = "content/knowledge/boundary.md"
        self.put(question["source"], "# 边界在哪里\n\n实际解释。\n")
        self.save()
        loc = [{"document": "lesson", "anchor": "boundary-type"}]
        self.contract.update(schemaVersion=2,
            paradigm={"status": "addressed", "name": "Binary search", "mechanism": "Halve a partitioned space",
                "coverageArgument": "Synthetic fixture only; not a claim of real domain completeness", "corpusEvidence": ["outside"],
                "branches": [{"id": "ordered", "title": "Ordered boundaries", "status": "addressed", "materialIds": ["outside"],
                              "sectionIds": ["boundary-unit"], "crossParadigms": []}]},
            prelude={"status": "addressed", "locations": [{"document": "lesson", "anchor": "prelude"}]})
        self.contract["reading"].update(entry=copy.deepcopy(self.contract["prelude"]["locations"]), selectionMap=copy.deepcopy(loc))
        self.contract["reading"]["units"] = [{"id": "boundary-unit", "title": "Ordered boundary problems", "taskIds": ["boundary"],
            "locations": copy.deepcopy(loc), "facets": {key: copy.deepcopy(loc) for key in
                ("problem", "fit", "variation", "manual", "manualExplanation", "standard", "standardExplanation", "engineering")},
            "manualImplementationIds": ["manual-boundary"], "standardImplementationIds": ["standard-boundary"],
            "standardRole": {"kind": "algorithm", "explanation": "The standard algorithm performs the boundary search"},
            "exercises": [{"title": "Boundary", "url": "https://example.com/task"}], "dependsOn": []}]
        self.save_contract()

    def test_complete_schema2_relationships_can_be_reviewed_and_prepared(self):
        self.assertTrue(validate_learning(self.root)["ok"], validate_learning(self.root))
        self.accepted_fixture()
        self.assertTrue(chapter_quality(self.root)["ok"], chapter_quality(self.root))
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        self.assertTrue(prepare_release(self.root, "lesson-job")["release"]["passed"])

    def test_generic_research_note_cannot_replace_actual_stage_handoff(self):
        self.accepted_fixture()
        self.contract.pop("researchHandoff")
        self.save_contract()
        review = self.review()
        review["inputHash"] = chapter_inputs(self.root, "unit")["inputHash"]
        self.put_review(review)
        for kind in ("research", "review"):
            add_evidence(self.root, "lesson-job", kind=kind, path="work/" + kind + ".md",
                         summary="Generic current note cannot replace stage history", outcome="accepted")
        self.assertTrue(validate_learning(self.root)["ok"])
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        self.assertIn("research handoff", errors)
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        with self.assertRaisesRegex(ValueError, "Release not ready"):
            prepare_release(self.root, "lesson-job")

    def test_author_cannot_silently_rename_domain_or_drop_researched_branch(self):
        self.accepted_fixture()
        self.contract["paradigm"]["name"] = "Convenient local tricks"
        self.save_contract()
        self.assertIn("paradigm differs", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
        self.contract["paradigm"]["name"] = "Binary search"
        self.contract["paradigm"]["branches"][0]["id"] = "convenient-subset"
        self.save_contract()
        self.assertIn("final included research branches", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_material_and_type_links_preserve_research_target(self):
        self.accepted_fixture()
        self.put("work/replacement.md", "Unrelated after-the-fact note\n")
        self.contract["materials"][0]["evidence"] = "work/replacement.md"
        self.save_contract()
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        self.assertIn("researched evidence note", errors)
        self.assertIn("formal type drops its researched material evidence", errors)
        self.contract["materials"][0]["evidence"] = "work/material.md"
        self.contract["reading"]["units"][0]["id"] = "unresearched-type"
        self.contract["paradigm"]["branches"][0]["sectionIds"] = ["unresearched-type"]
        self.save_contract()
        self.assertIn("research handoff type plan", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_new_exercise_and_changed_dossier_cannot_inherit_old_research(self):
        self.accepted_fixture()
        self.model["tasks"][0]["sourceUrls"].append("https://example.com/unresearched")
        self.contract["reading"]["units"][0]["exercises"] = [{"title": "New", "url": "https://example.com/unresearched"}]
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + "\n[New](https://example.com/unresearched)\n")
        self.save()
        self.save_contract()
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        self.assertIn("not obtained by the research type plan", errors)
        before = course_snapshot(self.root)["inputHash"]
        dossier = self.root / "work/jobs/fixture-study/study/dossier.json"
        dossier.write_text(dossier.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        self.assertNotEqual(before, course_snapshot(self.root)["inputHash"])
        self.assertIn("research handoff", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_legacy_contract_is_readable_but_not_eligible_for_new_publication(self):
        self.contract["schemaVersion"] = 1
        self.save_contract()
        self.accepted_fixture()
        self.assertTrue(validate_learning(self.root)["ok"])
        self.assertIn("legacy chapter contract", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))
        self.assertIn("旧问题专题", render_chapters(self.root))

    def test_new_contract_cannot_publish_legacy_visible_question_registry(self):
        self.model["schemaVersion"] = 1
        question = self.model["questions"][0]
        question.pop("source", None)
        question.update(document="lesson", anchor="q000001")
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8").replace(
            '{{knowledge:Q000001}}', '### Q000001 · 边界在哪里\n\n实际解释。'))
        self.save()
        self.accepted_fixture()
        self.assertTrue(validate_learning(self.root)["ok"])
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        self.assertIn("transparent knowledge registry requires learning schemaVersion 2", errors)
        with patch("second_algorithm.workflow._process", side_effect=self.process_success):
            verify_job(self.root, "lesson-job", "fixture-c++")
        with self.assertRaisesRegex(ValueError, "chapter-quality"):
            prepare_release(self.root, "lesson-job")

    def test_open_domain_branch_and_prelude_are_honest_release_blockers(self):
        self.contract["paradigm"].update(status="open", gap="Known main domain still unorganized")
        self.contract["prelude"].update(status="open", gap="The common mechanism is not yet explained")
        self.contract["paradigm"]["branches"][0].update(status="open", gap="Important variation not taught")
        self.save_contract()
        self.accepted_fixture()
        self.assertTrue(validate_learning(self.root)["ok"])
        errors = " ".join(chapter_quality(self.root)["chapters"][0]["errors"])
        for phrase in ("paradigm is open", "prelude is open", "branch is open"):
            self.assertIn(phrase, errors)

    def test_addressed_domain_requires_corpus_and_real_branch_coverage(self):
        self.contract["paradigm"].update(corpusEvidence=[], branches=[])
        self.save_contract()
        errors = " ".join(validate_learning(self.root)["errors"])
        self.assertIn("corpus extraction/merging evidence", errors)
        self.assertIn("actual coverage branches", errors)

    def test_branch_cannot_claim_imaginary_material_or_section(self):
        self.contract["paradigm"]["branches"][0].update(materialIds=["unread"], sectionIds=["missing-type"])
        self.save_contract()
        errors = " ".join(validate_learning(self.root)["errors"])
        self.assertIn("unknown material reference", errors)
        self.assertIn("unknown problem-type section", errors)

    def test_formal_section_requires_actual_h2_not_an_arbitrary_anchor(self):
        self.contract["reading"]["units"][0]["locations"] = [{"document": "lesson", "anchor": "q000001"}]
        self.save_contract()
        self.assertIn("actual H2 heading", " ".join(validate_learning(self.root)["errors"]))

    def test_extra_h2_cannot_compete_with_type_navigation(self):
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + '\n## An unrelated proof promoted to a section\n')
        self.assertIn("unassigned H2", " ".join(validate_learning(self.root)["errors"]))

    def test_theory_must_be_before_formal_sections(self):
        draft = (self.root/self.draft).read_text(encoding="utf-8")
        before, section = draft.split('<a id="boundary-type"></a>')
        self.put(self.draft, '# Lesson\n\n<a id="boundary-type"></a>' + section + '\n' + before.replace('# Lesson\n', '', 1))
        self.assertIn("prelude must precede", " ".join(validate_learning(self.root)["errors"]))

    def test_facet_cannot_point_to_another_part_of_the_chapter(self):
        self.contract["reading"]["units"][0]["facets"]["fit"] = [{"document": "lesson", "anchor": "prelude"}]
        self.save_contract()
        self.assertIn("within its own problem-type section", " ".join(validate_learning(self.root)["errors"]))

    def test_exercises_need_one_to_five_real_visible_task_links(self):
        unit = self.contract["reading"]["units"][0]
        unit["exercises"] = []
        self.save_contract()
        self.assertIn("1 to 5 exercises", " ".join(validate_learning(self.root)["errors"]))
        unit["exercises"] = [{"title": "Unrelated", "url": "https://example.com/unrelated"}]
        self.save_contract()
        self.assertIn("actual task sourceUrls", " ".join(validate_learning(self.root)["errors"]))
        unit["exercises"] = [{"title": "Boundary", "url": "https://example.com/task"}]
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8").replace('[Boundary](https://example.com/task)', ''))
        self.save_contract()
        self.assertIn("actual visible link", " ".join(validate_learning(self.root)["errors"]))

    def test_six_valid_exercises_still_exceed_the_per_type_limit(self):
        unit = self.contract["reading"]["units"][0]
        urls = ["https://example.com/task" + str(i) for i in range(6)]
        self.model["tasks"][0]["sourceUrls"] = urls
        unit["exercises"] = [{"title": "Variant " + str(i), "url": url} for i, url in enumerate(urls)]
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + '\n' +
                 '\n'.join('[Variant](' + url + ')' for url in urls))
        self.save()
        self.save_contract()
        self.assertIn("1 to 5 exercises", " ".join(validate_learning(self.root)["errors"]))

    def test_type_order_and_duplicate_h2_ownership_are_checked(self):
        original = self.contract["reading"]["units"][0]
        second = copy.deepcopy(original)
        second.update(id="second-type", title="A harder variant")
        self.contract["reading"]["units"].append(second)
        self.contract["paradigm"]["branches"][0]["sectionIds"].append("second-type")
        self.save_contract()
        self.assertIn("multiple problem-type sections", " ".join(validate_learning(self.root)["errors"]))
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") +
                 '\n<a id="harder-type"></a>\n\n## Harder variant\n\n[Boundary](https://example.com/task)\n')
        loc = [{"document": "lesson", "anchor": "harder-type"}]
        second.update(locations=loc, facets={key: copy.deepcopy(loc) for key in second["facets"]})
        self.contract["reading"]["units"].reverse()
        self.save_contract()
        self.assertIn("author prose order", " ".join(validate_learning(self.root)["errors"]))

    def test_entry_cannot_hide_an_unassigned_proof_heading(self):
        self.put(self.draft, (self.root/self.draft).read_text(encoding="utf-8") + '\n<a id="extra-proof"></a>\n\n## Separate proof\n')
        self.contract["reading"]["entry"].append({"document": "lesson", "anchor": "extra-proof"})
        self.save_contract()
        self.assertIn("entry must identify its theory prelude", " ".join(validate_learning(self.root)["errors"]))

    def test_implementation_paths_must_reference_real_section_tasks_and_roles(self):
        unit = self.contract["reading"]["units"][0]
        unit["manualImplementationIds"] = ["not-an-implementation"]
        unit["standardImplementationIds"] = ["manual-boundary"]
        self.save_contract()
        errors = " ".join(validate_learning(self.root)["errors"])
        self.assertIn("actual tasks", errors)
        self.assertIn("standard algorithm/structure", errors)
        unit["manualImplementationIds"] = ["manual-boundary"]
        unit["standardRole"] = {"kind": "shared-core", "explanation": "The handwritten core already uses the actual standard facility"}
        self.save_contract()
        self.assertTrue(validate_learning(self.root)["ok"], validate_learning(self.root))

    def test_known_corpus_changes_invalidate_the_bound_review(self):
        self.put("catalog/sources.json", '{"sources": []}')
        self.accepted_fixture()
        self.put("catalog/sources.json", '{"sources": [{"id": "new-site"}]}')
        self.assertIn("stale", " ".join(chapter_quality(self.root)["chapters"][0]["errors"]))

    def test_malformed_new_objects_fail_as_validation_not_exceptions(self):
        for key in ("paradigm", "prelude", "reading"):
            with self.subTest(key=key):
                original = self.contract[key]
                self.contract[key] = []
                self.save_contract()
                checked = validate_learning(self.root)
                self.assertFalse(checked["ok"])
                self.assertIn("expected", " ".join(checked["errors"]))
                self.contract[key] = original
