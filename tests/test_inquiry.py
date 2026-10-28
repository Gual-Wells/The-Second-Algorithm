from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

from second_algorithm.inquiry import PHASES, _frontier, checkpoint, check_handoff, open_study, seal_handoff, study_status
from second_algorithm.storage import read_json, write_json
from second_algorithm.workflow import init_job

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / ".local/inquiry-tests"
TEMP.mkdir(parents=True, exist_ok=True)


def chapter_coordination_fixture(root, folder, chapter="unit", relationship="separate"):
    """Actual prior source identities with synthetic comparative reasoning, never curriculum."""
    frontier = _frontier(root, chapter)
    ledger = read_json(folder / "ledger.json")
    dossier = read_json(folder / "dossier.json")
    rows = []
    for prior in frontier["chapters"]:
        source = "chapter:" + prior["id"]
        mid = "prior-" + prior["id"]
        note = (folder / "chapter-notes" / (prior["id"] + ".md")).relative_to(root).as_posix()
        target = root / note
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("Synthetic comparison of actual prior contract " + prior["contract"]
                          + "; compare mechanism and boundaries without excluding required repeated explanations.\n", encoding="utf-8")
        entry = next((row for row in ledger["entries"] if row["id"] == source), None)
        if entry is None:
            entry = {"id": source}
            ledger["entries"].append(entry)
        entry.update(relevance="excluded", reason="Comparison context is analyzed, not a canonical source for adopting this fixture algorithm",
                     locator=prior["contract"], readState="analyzed", materialIds=[mid], core=False)
        old = next((row for row in dossier["materials"] if row["id"] == mid), None)
        material = {"id": mid, "source": source, "locator": prior["contract"] + " scope/paradigm and actual source references",
                    "readState": "analyzed", "note": note, "disposition": "excluded",
                    "reason": "Retain as scope-comparison evidence, not an adopted algorithm teaching source"}
        if old is None:
            dossier["materials"].append(material)
        else:
            old.update(material)
        rows.append({"chapter": prior["id"], "relationship": relationship,
                     "reason": "Compare actual prior mechanism with independent fixture proposal",
                     "overlapTreatment": "Keep required current-domain explanations even when prior material overlaps; adjacency is permitted",
                     "note": note, "materialIds": [mid]})
    write_json(folder / "ledger.json", ledger)
    write_json(folder / "dossier.json", dossier)
    return {"chapters": rows, "domainIndependence": "The fixture scope has its own shared solving mechanism",
            "globalBreadth": "Inspect the whole prior catalogue; do not choose only a continuation of its closest topic",
            "scopeDecision": "Retain the independently chosen fixture scope after actual comparison",
            "emptyReason": "No prior published formal chapter exists; do not invent a comparison" if not rows else ""}


def seed_study(root, job="fixture-study", chapter="unit", paradigm="Binary search", branch="ordered", material="outside", note="work/material.md", problem_type="boundary-unit", exercise="https://example.com/task", chapter_relationship="separate"):
    """Synthetic structural fixture, deliberately not a real domain-completeness claim."""
    for filename, key in (("books", "books"), ("sources", "sources")):
        if not (root / "catalog" / (filename + ".json")).exists():
            write_json(root / "catalog" / (filename + ".json"), {key: []})
    if not (root / "catalog/chapters.json").exists():
        write_json(root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": []})
    if not (root / "carrier/publications.json").exists():
        write_json(root / "carrier/publications.json", {"schemaVersion": 2, "state": "withdrawn", "collections": []})
    if not (root / "work/jobs" / job / "job.json").exists():
        init_job(root, job, "Synthetic research provenance fixture only")
    open_study(root, job, chapter)
    folder = root / "work/jobs" / job / "study"
    target = root / note
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_text("Fixture actual statement and method inspection; synthetic, not a publishable chapter.\n", encoding="utf-8")
    ledger = read_json(folder / "ledger.json")
    for row in ledger["entries"]:
        row.update(relevance="excluded", reason="Unrelated synthetic fixture source; only metadata inspected", locator="fixture directory", readState="directory")
    ledger["entries"].append({"id": "external:fixture", "url": "https://example.com/task", "relevance": "related", "reason": "Fixture exact boundary problem", "locator": "fixture task body", "readState": "analyzed", "materialIds": [material], "core": True})
    dossier = {"schemaVersion": 1, "materials": [{"id": material, "source": "external:fixture", "locator": "fixture task statement/solution", "readState": "analyzed", "note": note, "disposition": "included", "reason": "Documents partition invariant", "mechanism": "Discard half partition", "conditions": "Monotone predicate", "variants": "Equal boundaries differ in predicate", "crossParadigms": [], "exerciseUrls": ["https://example.com/task"]}],
               "findings": [{"id": "invariant", "materialIds": [material], "branchIds": [branch], "claim": "Maintain unexcluded boundary range", "note": note, "problem": "First true predicate", "mechanism": "Halve candidates", "conditions": "Partitioned input", "variants": "First >= / >", "crossParadigms": [], "exerciseLinks": [{"title": "Fixture", "url": "https://example.com/task"}]}],
               "questions": [], "searches": [{"id": "lookup", "query": "fixture boundary contract", "source": "external:fixture", "result": "Read original fixture constraints", "note": note}]}
    scope = {"schemaVersion": 1, "paradigm": paradigm, "title": "Synthetic boundary fixture", "mechanism": "Halve a partitioned candidate space", "branches": [{"id": branch, "title": "Ordered boundary", "status": "included", "reason": "Fixture relevant mechanism", "materialIds": [material]}], "exclusions": [], "completenessArgument": "Structural fixture only, not real domain completeness", "prelude": "Explain invariant, partition condition and bounds", "problemTypes": [{"id": problem_type, "title": "Locate boundary", "branchIds": [branch], "materialIds": [material], "exerciseUrls": ["https://example.com/task"], "problem": "Find first valid position", "variation": "Strict and non-strict predicates"}]}
    for name, value in (("ledger", ledger), ("dossier", dossier), ("scope", scope)):
        write_json(folder / (name + ".json"), value)
    coordination = chapter_coordination_fixture(root, folder, chapter, chapter_relationship)
    dossier = read_json(folder / "dossier.json")
    common = {"summary": "Synthetic actual stage reasoning", "notes": [note]}
    session = {"question": "What invariant survives each discarded half?", "materialIds": [material], "findings": "Retain potential boundary in half-open interval", "implications": "Use corresponding comparison and preserve end sentinel"}
    records = {
        "overview": dict(common, corpusUnderstanding="Compare metadata of all registered fixture sources", publicationReview="Inspect current actual publication frontier", candidateBasis="Shared mechanism and application branches"),
        "scope": dict(common, candidates=[{"name": paradigm, "decision": "selected", "reason": "Fixture target"}], selectionReason="Representative fixture mechanism; not a production recommendation",
                      independentBasis="Read original fixture problem/method before prior chapter scope comparisons", basisMaterialIds=[material]),
        "alignment": dict(common, chapterCoordination=copy.deepcopy(coordination)),
        "collection": dict(common, extractionSummary="Original fixture task and contracts extracted", limitations="Synthetic fixture is not an entire real domain"),
        "synthesis": dict(common, sessions=[session], unresolved="No unresolved fixture issue"),
        "scope-review": dict(common, decisions=[{"branch": branch, "action": "retain", "reason": "Fixture independent check agrees", "materialIds": [material]}], challenge={"researcher": "fixture-independent-reader", "perspective": "Inspect omitted boundary conditions before reading author categorization", "independent": True, "inputMaterialIds": [material], "findings": "Empty range and end sentinel must survive", "responses": "Retain branch with explicit sentinel conditions", "note": note}, scopeConclusion="Retain fixture scope with explicit conditions", chapterCoordination=copy.deepcopy(coordination)),
        "resynthesis": dict(common, sessions=[session], resolvedChanges="Rechecked empty/end boundaries after challenge", finalArgument="Complete only for synthetic test contract")}
    # records/scope.json is separate from the mutable scope.json domain map.
    if exercise != "https://example.com/task":
        dossier["materials"][0]["exerciseUrls"] = [exercise]
        dossier["findings"][0]["exerciseLinks"][0]["url"] = exercise
        scope["problemTypes"][0]["exerciseUrls"] = [exercise]
        write_json(folder / "dossier.json", dossier)
        write_json(folder / "scope.json", scope)
    for phase, record in records.items():
        write_json(folder / "records" / (phase + ".json"), record)
    return folder


def complete_study_fixture(root, job="fixture-study", chapter="unit", paradigm="Binary search", branch="ordered", material="outside", note="work/material.md", problem_type="boundary-unit", exercise="https://example.com/task", chapter_relationship="separate"):
    folder = seed_study(root, job, chapter, paradigm, branch, material, note, problem_type, exercise, chapter_relationship)
    for phase in PHASES:
        checkpoint(root, job, phase, (folder / "records" / (phase + ".json")).relative_to(root).as_posix())
    result = seal_handoff(root, job)
    if not result["ok"]:
        raise AssertionError(result)
    return result["path"]


class InquiryTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir=TEMP)
        self.root = Path(self.temporary.name).resolve()
        write_json(self.root / "catalog/books.json", {"books": [{"id": "book"}]})
        write_json(self.root / "catalog/sources.json", {"sources": [{"id": "site"}]})
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "state": "withdrawn", "collections": []})
        self.folder = seed_study(self.root)

    def tearDown(self):
        self.temporary.cleanup()

    def step(self, phase):
        return checkpoint(self.root, "fixture-study", phase, (self.folder / "records" / (phase + ".json")).relative_to(self.root).as_posix())

    def complete(self):
        for phase in PHASES:
            self.step(phase)
        return seal_handoff(self.root, "fixture-study")

    def modify(self, name, callback):
        filename = self.folder / (name + ".json")
        value = read_json(filename)
        callback(value)
        write_json(filename, value)

    def prior(self, identity="prior", visibility="published", kind="chapter"):
        base = "content/" + identity + "/Lesson"
        source = self.root / (base + ".source.md")
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("Actual prior fixture algorithm source and explanation", encoding="utf-8")
        contract = "content/" + identity + "/chapter.contract.json"
        write_json(self.root / contract, {"chapter": identity, "paradigm": {"name": "Prior fixture paradigm"},
                                          "scope": {"core": "Prior fixture problem domain"}})
        index = read_json(self.root / "catalog/chapters.json", {"chapters": []})
        index["chapters"].append({"id": identity, "collection": identity, "contract": contract})
        write_json(self.root / "catalog/chapters.json", index)
        publication = read_json(self.root / "carrier/publications.json")
        publication.update(state="active")
        publication["collections"].append({"id": identity, "title": identity, "visibility": visibility, "kind": kind,
                                            "documents": [{"id": identity + "-doc", "path": base}]})
        write_json(self.root / "carrier/publications.json", publication)
        coordination = chapter_coordination_fixture(self.root, self.folder)
        for phase in ("alignment", "scope-review"):
            self.modify("records/" + phase, lambda data: data.update(chapterCoordination=copy.deepcopy(coordination)))
        return source

    def test_can_complete_before_any_course_or_author_files_exist(self):
        result = self.complete()
        self.assertTrue(result["ok"], result)
        self.assertFalse((self.root / "catalog/learning.json").exists())
        self.assertTrue(any(row["path"].endswith("study.json") for row in result["inputs"]))
        self.assertFalse(result["automaticSemanticCertification"])

    def test_phase_skip_is_not_a_complete_research_receipt(self):
        with self.assertRaisesRegex(ValueError, "skipped"):
            self.step("synthesis")
        with self.assertRaisesRegex(ValueError, "not ready"):
            seal_handoff(self.root, "fixture-study")

    def test_independent_scope_then_alignment_are_separate_required_stages(self):
        self.step("overview"); self.step("scope")
        with self.assertRaisesRegex(ValueError, "skipped"):
            self.step("collection")
        state = read_json(self.folder / "study.json")
        self.assertEqual(2, state["schemaVersion"])
        proposal_pointer = state["active"][-1]
        proposal_bytes = (self.root / proposal_pointer["path"]).read_bytes()
        self.modify("scope", lambda data: data.update(paradigm="Revised domain after comparison"))
        self.step("alignment")
        status = study_status(self.root, "fixture-study")
        self.assertEqual("Binary search", status["independentScope"]["paradigm"])
        self.assertEqual("Revised domain after comparison", status["alignedScope"]["paradigm"])
        self.assertEqual(proposal_bytes, (self.root / proposal_pointer["path"]).read_bytes())

    def test_first_chapter_alignment_requires_honest_empty_explanation(self):
        self.step("overview"); self.step("scope")
        self.modify("records/alignment", lambda data: data["chapterCoordination"].pop("emptyReason"))
        with self.assertRaisesRegex(ValueError, "empty prior"):
            self.step("alignment")
        self.modify("records/alignment", lambda data: data["chapterCoordination"].update(emptyReason="No previous formal chapters exist"))
        self.step("alignment")
        self.assertEqual("collection", study_status(self.root, "fixture-study")["nextPhase"])

    def test_prior_inventory_may_remain_unassessed_until_independent_scope(self):
        self.prior()
        self.modify("ledger", lambda data: next(row for row in data["entries"] if row["id"] == "chapter:prior").update(relevance="pending"))
        self.step("overview"); self.step("scope")
        with self.assertRaisesRegex(ValueError, "during alignment"):
            self.step("alignment")
        self.modify("ledger", lambda data: next(row for row in data["entries"] if row["id"] == "chapter:prior").update(relevance="excluded"))
        self.step("alignment")

    def test_prior_chapter_cannot_be_the_independent_scope_basis(self):
        self.prior()
        self.step("overview")
        self.modify("records/scope", lambda data: data.update(basisMaterialIds=["prior-prior"]))
        with self.assertRaisesRegex(ValueError, "before chapter alignment"):
            self.step("scope")

    def test_overlap_and_adjacent_are_allowed_without_removing_current_content(self):
        self.prior()
        for relation in ("overlapping", "adjacent"):
            for phase in ("alignment", "scope-review"):
                self.modify("records/" + phase, lambda data: data["chapterCoordination"]["chapters"][0].update(relationship=relation))
            for phase in PHASES: self.step(phase)
            result = seal_handoff(self.root, "fixture-study")
            self.assertTrue(result["ok"], result)
            self.assertEqual(["ordered"], [row["id"] for row in result["scope"]["branches"]])
            self.assertEqual(["boundary-unit"], [row["id"] for row in result["scope"]["problemTypes"]])

    def test_scope_review_must_research_prior_chapters_again_with_actual_materials(self):
        self.prior()
        for phase in PHASES[:PHASES.index("scope-review")]: self.step(phase)
        self.modify("records/scope-review", lambda data: data["chapterCoordination"].update(chapters=[]))
        with self.assertRaisesRegex(ValueError, "every current published"):
            self.step("scope-review")
        coordination = chapter_coordination_fixture(self.root, self.folder)
        self.modify("records/scope-review", lambda data: data.update(chapterCoordination=coordination))
        self.modify("records/scope-review", lambda data: data["chapterCoordination"]["chapters"][0].update(materialIds=["outside"]))
        with self.assertRaisesRegex(ValueError, "that actual prior chapter"):
            self.step("scope-review")

    def test_current_chapter_material_cannot_disappear_after_scope_review(self):
        self.prior()
        for phase in PHASES[:-1]: self.step(phase)
        self.modify("dossier", lambda data: data.update(materials=[row for row in data["materials"] if row["id"] != "prior-prior"]))
        self.modify("ledger", lambda data: next(row for row in data["entries"] if row["id"] == "chapter:prior").update(materialIds=[]))
        with self.assertRaisesRegex(ValueError, "chapter comparison materials"):
            self.step("resynthesis")

    def test_hidden_draft_withdrawn_are_not_existing_formal_chapters(self):
        self.prior("hidden", visibility="hidden")
        self.prior("draft", visibility="hidden", kind="draft")
        self.assertEqual([], _frontier(self.root, "unit")["chapters"])
        self.prior("withdrawn")
        publication = read_json(self.root / "carrier/publications.json")
        for collection in publication["collections"]:
            collection["visibility"] = "hidden"
        publication["state"] = "withdrawn"
        write_json(self.root / "carrier/publications.json", publication)
        self.assertEqual([], _frontier(self.root, "unit")["chapters"])

    def test_target_chapter_id_does_not_hide_another_chapters_collection(self):
        self.prior("old")
        publication = read_json(self.root / "carrier/publications.json")
        publication["collections"][0]["id"] = "unit"
        index = read_json(self.root / "catalog/chapters.json")
        index["chapters"][0]["collection"] = "unit"
        write_json(self.root / "carrier/publications.json", publication)
        write_json(self.root / "catalog/chapters.json", index)
        self.assertEqual(["old"], [row["id"] for row in _frontier(self.root, "unit")["chapters"]])

    def test_prior_contract_is_required_and_part_of_research_identity(self):
        self.prior()
        result = self.complete()
        path = self.root / "content/prior/chapter.contract.json"
        value = read_json(path)
        value["scope"]["core"] = "Changed prior domain coverage"
        write_json(path, value)
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])
        path.unlink()
        with self.assertRaisesRegex(ValueError, "missing or mismatched"):
            _frontier(self.root, "unit")

    def test_malformed_prior_registries_report_structured_errors(self):
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": ["bad registration"]})
        with self.assertRaisesRegex(ValueError, "registration"):
            _frontier(self.root, "unit")
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": []})
        write_json(self.root / "carrier/publications.json", {"schemaVersion": 2, "collections": ["bad collection"]})
        with self.assertRaisesRegex(ValueError, "publication registry"):
            _frontier(self.root, "unit")

    def test_old_six_stage_study_is_not_automatically_adopted_as_new_protocol(self):
        state = read_json(self.folder / "study.json")
        state["schemaVersion"] = 1
        write_json(self.folder / "study.json", state)
        result = study_status(self.root, "fixture-study")
        self.assertFalse(result["readyForHandoff"])
        self.assertIn("schemaVersion 2", result["errors"][0])

    def test_whole_registry_dispositions_required(self):
        self.modify("ledger", lambda data: data["entries"].pop(0))
        with self.assertRaisesRegex(ValueError, "whole"):
            self.step("overview")

    def test_untouched_pending_overview_cannot_select_scope(self):
        self.modify("ledger", lambda data: data["entries"][0].update(relevance="pending"))
        with self.assertRaisesRegex(ValueError, "pending sources"):
            self.step("overview")

    def test_missing_or_malformed_corpus_does_not_mean_empty(self):
        write_json(self.root / "catalog/books.json", {"books": "accidentally missing list"})
        with self.assertRaisesRegex(ValueError, "whole-base registry"):
            self.step("overview")
        (self.root / "catalog/books.json").unlink()
        with self.assertRaisesRegex(ValueError, "whole-base registry"):
            self.step("overview")

    def test_malformed_checkpoint_preserves_last_good_phase(self):
        self.step("overview")
        self.modify("records/scope", lambda data: data.update(candidates=["bad row"]))
        with self.assertRaisesRegex(ValueError, "rows must be objects"):
            self.step("scope")
        status = study_status(self.root, "fixture-study")
        self.assertEqual("overview", status["phase"])
        self.assertEqual(1, status["historyCount"])

    def test_material_merge_cycle_is_not_deduplication(self):
        def cycle(data):
            data["materials"][0].update(disposition="merged", mergedInto="copy")
            data["materials"].append(dict(data["materials"][0], id="copy", mergedInto="outside"))
        self.modify("dossier", cycle)
        with self.assertRaisesRegex(ValueError, "merge cycle"):
            self.step("overview")

    def test_type_cannot_adopt_excluded_material_or_unanalyzed_merge(self):
        for phase in PHASES[:-1]: self.step(phase)
        self.modify("dossier", lambda data: data["materials"][0].update(disposition="excluded"))
        with self.assertRaisesRegex(ValueError, "excluded material"):
            self.step("resynthesis")
        self.modify("dossier", lambda data: data["materials"][0].update(disposition="included"))
        self.modify("dossier", lambda data: data["materials"].append(dict(data["materials"][0], id="merged", disposition="merged", mergedInto="outside", readState="directory")))
        with self.assertRaisesRegex(ValueError, "must be analyzed"):
            self.step("resynthesis")

    def test_deleted_initial_scope_branch_requires_explicit_reassessment(self):
        self.step("overview"); self.step("scope"); self.step("alignment"); self.step("collection")
        self.modify("scope", lambda data: data["branches"][0].update(id="revised"))
        self.modify("scope", lambda data: data["problemTypes"][0].update(branchIds=["revised"]))
        self.modify("dossier", lambda data: data["findings"][0].update(branchIds=["revised"]))
        self.step("synthesis")
        self.modify("records/scope-review", lambda data: data["decisions"][0].update(branch="revised"))
        with self.assertRaisesRegex(ValueError, "prior and revised"):
            self.step("scope-review")
        self.modify("records/scope-review", lambda data: data["decisions"].append({"branch": "ordered", "action": "merge", "mergedInto": "revised", "reason": "Initial terminology merged into revised branch", "materialIds": ["outside"]}))
        self.step("scope-review"); self.step("resynthesis")
        self.assertTrue(seal_handoff(self.root, "fixture-study")["ok"])

    def test_pending_collection_blocks_but_honest_unavailable_noncore_can_finish(self):
        self.step("overview"); self.step("scope"); self.step("alignment")
        self.modify("ledger", lambda data: data["entries"][0].update(relevance="pending"))
        with self.assertRaisesRegex(ValueError, "Pending"):
            self.step("collection")
        self.modify("ledger", lambda data: data["entries"][0].update(relevance="unavailable", readState="unavailable", reason="404; alternate source checked", core=False))
        for phase in PHASES[PHASES.index("collection"):]: self.step(phase)
        self.assertTrue(seal_handoff(self.root, "fixture-study")["ok"])

    def test_material_unknown_source_and_branch_are_rejected(self):
        self.modify("dossier", lambda data: data["materials"][0].update(source="source:unknown"))
        with self.assertRaisesRegex(ValueError, "different source"):
            self.step("overview")
        self.modify("dossier", lambda data: data["materials"][0].update(source="external:fixture"))
        self.modify("dossier", lambda data: data["findings"][0].update(branchIds=["missing"]))
        with self.assertRaisesRegex(ValueError, "finding branches"):
            self.step("overview")

    def test_historical_snapshots_survive_ordinary_dossier_evolution(self):
        first = self.step("overview")["checkpoint"]
        self.modify("dossier", lambda data: data["materials"][0].update(reason="Refined material analysis after scope selection"))
        for phase in PHASES[1:]: self.step(phase)
        result = seal_handoff(self.root, "fixture-study")
        self.assertTrue(result["ok"], result)
        self.assertEqual(first["sha256"], read_json(self.folder / "study.json")["history"][0]["sha256"])

    def test_scope_change_after_review_requires_re_review(self):
        for phase in PHASES[:-1]: self.step(phase)
        self.modify("scope", lambda data: data.update(mechanism="Refined partition meaning"))
        with self.assertRaisesRegex(ValueError, "repeat scope-review"):
            self.step("resynthesis")
        self.step("scope-review"); self.step("resynthesis")
        self.assertTrue(seal_handoff(self.root, "fixture-study")["ok"])
        self.assertEqual(len(PHASES) + 1, study_status(self.root, "fixture-study")["historyCount"])

    def test_final_core_question_and_orphan_material_block(self):
        for phase in PHASES[:-1]: self.step(phase)
        self.modify("dossier", lambda data: data["questions"].append({"id": "gap", "status": "deferred", "core": True, "reason": "Not understood yet"}))
        with self.assertRaisesRegex(ValueError, "Unresolved core"):
            self.step("resynthesis")
        self.modify("dossier", lambda data: data["questions"][0].update(status="resolved"))
        self.modify("dossier", lambda data: data["materials"].append(dict(data["materials"][0], id="orphan")))
        with self.assertRaisesRegex(ValueError, "Orphan"):
            self.step("resynthesis")

    def test_exercises_must_be_researched_before_planning(self):
        for phase in PHASES[:-1]: self.step(phase)
        self.modify("scope", lambda data: data["problemTypes"][0].update(exerciseUrls=["https://unread.example/new"]))
        self.step("scope-review")
        with self.assertRaisesRegex(ValueError, "already researched"):
            self.step("resynthesis")

    def test_real_note_change_and_handoff_tampering_are_stale(self):
        result = self.complete()
        (self.root / "work/material.md").write_text("New factual discovery changes prior conclusions", encoding="utf-8")
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])
        self.step("resynthesis")
        new_result = seal_handoff(self.root, "fixture-study")
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])
        self.assertTrue(new_result["ok"])
        handoff = read_json(self.root / new_result["path"])
        handoff["scope"]["paradigm"] = "Fake revised name"
        write_json(self.root / new_result["path"], handoff)
        self.assertFalse(check_handoff(self.root, new_result["path"])["ok"])

    def test_invalid_current_dossier_preserves_immutable_resume_frontier(self):
        result = self.complete()
        pointer = study_status(self.root, "fixture-study")["lastHandoff"]
        (self.folder / "dossier.json").write_text('{"interrupted edit":', encoding="utf-8")
        status = study_status(self.root, "fixture-study")
        self.assertFalse(status["readyForHandoff"])
        self.assertEqual("unit", status["chapter"])
        self.assertEqual("resynthesis", status["phase"])
        self.assertEqual(len(PHASES), status["historyCount"])
        self.assertEqual(pointer, status["lastHandoff"])
        self.assertEqual("Binary search", status["scope"]["paradigm"])
        self.assertEqual("Binary search", status["independentScope"]["paradigm"])
        self.assertEqual("Binary search", status["alignedScope"]["paradigm"])
        self.assertEqual("repair-current-dossier", status["nextPhase"])
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])

    def test_catalog_change_requires_new_overview_and_keeps_history(self):
        self.complete()
        write_json(self.root / "catalog/books.json", {"books": [{"id": "book"}, {"id": "new"}]})
        self.assertEqual("overview", study_status(self.root, "fixture-study")["nextPhase"])
        with self.assertRaisesRegex(ValueError, "refresh overview"):
            self.step("scope-review")
        self.modify("ledger", lambda data: data["entries"].append({"id": "book:new", "relevance": "excluded", "reason": "No related material from new directory", "locator": "directory", "readState": "directory", "materialIds": [], "core": False}))
        self.step("overview")
        status = study_status(self.root, "fixture-study")
        self.assertEqual(len(PHASES) + 1, status["historyCount"])
        self.assertEqual("scope", status["nextPhase"])

    def test_own_publication_allowed_different_collection_other_publication_stales(self):
        result = self.complete()
        write_json(self.root / "catalog/chapters.json", {"schemaVersion": 1, "chapters": [{"id": "unit", "collection": "own-collection"}]})
        publication = {"schemaVersion": 2, "state": "active", "collections": [{"id": "own-collection", "visibility": "published", "kind": "chapter", "documents": [{"id": "self"}]}]}
        write_json(self.root / "carrier/publications.json", publication)
        self.assertTrue(check_handoff(self.root, result["path"])["ok"])
        self.prior("other")
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])

    def test_prior_body_changes_without_registry_edits_stale_overview(self):
        prior = self.prior()
        result = self.complete()
        prior.write_text("Changed prior chapter coverage", encoding="utf-8")
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])
        self.assertEqual("overview", study_status(self.root, "fixture-study")["nextPhase"])

    def test_proven_adopted_research_remains_historical_when_other_chapters_and_books_arrive(self):
        result = self.complete()
        write_json(self.root / "catalog/books.json", {"books": [{"id": "book"}, {"id": "new"}]})
        write_json(self.root / "carrier/publications.json", {"collections": [{"id": "later", "documents": []}]})
        strict = check_handoff(self.root, result["path"])
        self.assertFalse(strict["ok"])
        self.assertFalse(strict["baseCurrent"])
        adopted = check_handoff(self.root, result["path"], adopted=True)
        self.assertTrue(adopted["ok"], adopted)
        self.assertTrue(adopted["adopted"])
        self.assertFalse(adopted["baseCurrent"])
        self.assertFalse(any(row["path"] == "catalog/books.json" for row in adopted["inputs"]))
        with self.assertRaisesRegex(ValueError, "not ready"):
            seal_handoff(self.root, "fixture-study")

    def test_adopted_mode_still_rejects_current_notes_and_archive_changes(self):
        result = self.complete()
        note = self.root / "work/material.md"
        original = note.read_bytes()
        note.write_text("Changed methods after adoption", encoding="utf-8")
        self.assertFalse(check_handoff(self.root, result["path"], adopted=True)["ok"])
        note.write_bytes(original)
        self.assertTrue(check_handoff(self.root, result["path"], adopted=True)["ok"])
        archive = next(row["path"] for row in result["inputs"] if "/files/" in row["path"])
        (self.root / archive).write_text("Corrupted immutable proof", encoding="utf-8")
        self.assertFalse(check_handoff(self.root, result["path"], adopted=True)["ok"])

    def test_adopted_mode_rejects_scope_rework_or_superseded_handoff(self):
        result = self.complete()
        self.modify("scope", lambda data: data.update(mechanism="New algorithmic conditions"))
        self.assertFalse(check_handoff(self.root, result["path"], adopted=True)["ok"])
        self.step("scope-review"); self.step("resynthesis")
        replacement = seal_handoff(self.root, "fixture-study")
        self.assertTrue(replacement["ok"])
        self.assertFalse(check_handoff(self.root, result["path"], adopted=True)["ok"])

    def test_archive_changed_and_wrong_chapter_reject(self):
        result = self.complete()
        self.assertFalse(check_handoff(self.root, result["path"], "another-chapter")["ok"])
        archive = next(row["path"] for row in result["inputs"] if "/files/" in row["path"])
        (self.root / archive).write_text("Corrupted checkpoint evidence", encoding="utf-8")
        self.assertFalse(check_handoff(self.root, result["path"])["ok"])

    def test_private_or_outside_evidence_is_not_archived(self):
        (self.root / ".local").mkdir(exist_ok=True)
        (self.root / ".local/private.md").write_text("Private original", encoding="utf-8")
        self.modify("records/overview", lambda data: data.update(notes=[".local/private.md"]))
        with self.assertRaisesRegex(ValueError, "durable"):
            self.step("overview")


if __name__ == "__main__":
    unittest.main()
