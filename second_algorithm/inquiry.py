"""Durable, pre-author research. Structural provenance is not semantic certification."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from .storage import canonical_bytes, digest, now, read_json, safe_relative, valid_id, valid_url, write_json

PHASES = ("overview", "scope", "collection", "synthesis", "scope-review", "resynthesis")
MUTABLE = ("ledger.json", "dossier.json", "scope.json")
BASE = ("catalog/books.json", "catalog/sources.json", "protocol/RESEARCH_DEPARTMENT.md", "protocol/RESEARCH_FACILITIES.md")


def _folder(root, job):
    from .workflow import _job, _job_path
    _job(root, job)
    return _job_path(root, job).parent / "study"


def _state(root, job):
    folder = _folder(root, job)
    state = read_json(folder / "study.json")
    if not isinstance(state, dict) or state.get("schemaVersion") != 1 or state.get("job") != job:
        raise ValueError("No valid study; use research open-study first")
    if not isinstance(state.get("active"), list) or not isinstance(state.get("history"), list):
        raise ValueError("Invalid study journal")
    return folder, state


def _path(root, value):
    if not isinstance(value, str):
        raise ValueError("Research evidence needs a durable work/ path")
    filename = safe_relative(root, value)
    if not filename.is_relative_to((root / "work").resolve()) or filename.suffix not in {".md", ".json"}:
        raise ValueError("Research notes must be durable derived Markdown/JSON under work/; no raw textbooks")
    if not filename.is_file() or not filename.read_text(encoding="utf-8-sig").strip():
        raise ValueError("Missing or empty research evidence: " + value)
    return filename


def _text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Substantive " + label + " is required")


def _rows(data, key):
    rows = data.get(key)
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Invalid research " + key)
    ids = [row.get("id") for row in rows]
    if any(not valid_id(value) for value in ids) or len(ids) != len(set(ids)):
        raise ValueError("Research " + key + " require unique stable IDs")
    return rows


def _registry(root):
    identities = set()
    for filename, key, prefix in (("books.json", "books", "book:"), ("sources.json", "sources", "source:")):
        record = read_json(root / "catalog" / filename)
        if not isinstance(record, dict) or not isinstance(record.get(key), list):
            raise ValueError("Missing or malformed whole-base registry: catalog/" + filename)
        rows = record[key]
        if any(not isinstance(row, dict) or not valid_id(row.get("id")) for row in rows):
            raise ValueError("Invalid source/book registry identity")
        ids = [row["id"] for row in rows]
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate source/book registry identity")
        identities.update(prefix + identity for identity in ids)
    return identities


def _frontier(root, chapter):
    # The chapter being authored is not prior publication. Its collection may differ from its ID.
    own = {chapter}
    for row in read_json(root / "catalog/chapters.json", {"chapters": []}).get("chapters", []):
        if row.get("id") == chapter:
            own.add(row.get("collection"))
    publication = read_json(root / "carrier/publications.json", {"collections": []})
    collections = sorted([row for row in publication.get("collections", []) if row.get("id") not in own], key=lambda row: row["id"])
    paths, document_ids, knowledge_ids = set(), set(), set()
    for collection in collections:
        for document in collection.get("documents", []):
            document_ids.add(document.get("id"))
            base = document.get("path", "")
            if base:
                for suffix in (".source.md", ".cpp", ".md", ".html"):
                    candidate = safe_relative(root, base + suffix)
                    if candidate.is_file():
                        paths.add(candidate.relative_to(root).as_posix())
                        knowledge_ids.update(re.findall(r"Q[0-9]{6,}", candidate.read_text(encoding="utf-8-sig")))
    learning = read_json(root / "catalog/learning.json", {"questions": [], "tasks": []})
    prior_tasks = [row for row in learning.get("tasks", []) if row.get("document") in document_ids]
    for task in prior_tasks:
        if task.get("document") in document_ids:
            for method in task.get("methods", []):
                for implementation in method.get("implementations", []):
                    knowledge_ids.update(implementation.get("questions", []))
    questions = {row["id"]: row for row in learning.get("questions", [])}
    seen = set()
    while knowledge_ids - seen:
        identity = next(iter(knowledge_ids - seen))
        seen.add(identity)
        row = questions.get(identity)
        if row:
            knowledge_ids.update(row.get("prerequisites", []))
            if row.get("source"):
                source = safe_relative(root, row["source"])
                if source.is_file():
                    paths.add(source.relative_to(root).as_posix())
                    knowledge_ids.update(re.findall(r"Q[0-9]{6,}", source.read_text(encoding="utf-8-sig")))
    return {"collections": collections, "tasks": prior_tasks,
            "knowledge": [questions[identity] for identity in sorted(seen) if identity in questions],
            "inputs": [{"path": name, "sha256": digest((root / name).read_bytes())} for name in sorted(paths)]}


def _base(root, chapter):
    return {"inputs": [{"path": name, "sha256": digest((root / name).read_bytes())}
                        for name in BASE if (root / name).is_file()],
            "publicationFrontier": _frontier(root, chapter)}


def _documents(folder):
    values = [read_json(folder / name) for name in MUTABLE]
    if any(not isinstance(value, dict) or value.get("schemaVersion") != 1 for value in values):
        raise ValueError("Study ledger/dossier/scope require schemaVersion 1")
    return values


def _references(values, available, label, *, nonempty=False):
    if not isinstance(values, list) or (nonempty and not values) or any(not isinstance(value, str) or value not in available for value in values):
        raise ValueError("Invalid or missing " + label + " references")


def _validate_data(root, folder, *, final=False, collected=False, registry_ids=None):
    ledger, dossier, scope = _documents(folder)
    entries = _rows(ledger, "entries")
    materials, findings = _rows(dossier, "materials"), _rows(dossier, "findings")
    questions, searches = _rows(dossier, "questions"), _rows(dossier, "searches")
    branches = _rows(scope, "branches")
    sources = {row["id"]: row for row in entries}
    registry = _registry(root) if registry_ids is None else registry_ids
    mids, bids = {row["id"] for row in materials}, {row["id"] for row in branches}
    if set(registry) - set(sources):
        raise ValueError("The whole book/source registry must have a ledger disposition")
    for row in entries:
        if row["id"] not in registry and (not row["id"].startswith("external:") or not valid_url(row.get("url"))):
            raise ValueError("Unknown registry source; external sources need external: identity and URL")
        if row.get("relevance") not in {"related", "excluded", "unavailable", "pending"}:
            raise ValueError("Invalid source relevance")
        if row.get("readState") not in {"directory", "read", "analyzed", "unavailable"}:
            raise ValueError("Invalid source readState")
        _text(row.get("reason"), "source disposition reason")
        _text(row.get("locator"), "source reading locator")
        _references(row.get("materialIds"), mids, "ledger materials")
        if collected and row["relevance"] == "pending":
            raise ValueError("Pending source disposition blocks collection")
        if row["relevance"] == "related":
            if collected and not row["materialIds"]:
                raise ValueError("Related source needs extracted material")
            for mid in row["materialIds"]:
                if next(item for item in materials if item["id"] == mid).get("source") != row["id"]:
                    raise ValueError("Ledger material belongs to a different source")
        if final and row["relevance"] == "unavailable" and row.get("core", False):
            replacements = row.get("replacementMaterialIds", [])
            _references(replacements, mids, "unavailable core source replacements", nonempty=True)
            if any(next(material for material in materials if material["id"] == mid).get("disposition") != "included" for mid in replacements):
                raise ValueError("Unavailable core source needs included analyzed replacement materials")
    for row in materials:
        if row.get("source") not in sources:
            raise ValueError("Material references an unknown source")
        if row.get("readState") not in {"directory", "read", "analyzed", "unavailable"}:
            raise ValueError("Invalid material readState")
        if row.get("disposition") not in {"included", "merged", "excluded", "pending"}:
            raise ValueError("Material disposition is required")
        _text(row.get("locator"), "material locator")
        _text(row.get("reason"), "material disposition reason")
        _path(root, row.get("note"))
        if final and row["disposition"] in {"included", "merged"} and sources[row["source"]]["relevance"] != "related":
            raise ValueError("Included/merged material must come from an actually related available source")
        if row["disposition"] == "merged" and (row.get("mergedInto") not in mids or row.get("mergedInto") == row["id"]):
            raise ValueError("Merged material needs a different existing canonical material")
        if final and (row["disposition"] == "pending" or (row["disposition"] == "included" and row["readState"] != "analyzed")):
            raise ValueError("Final included materials must be analyzed; no pending dispositions")
        if final and row["disposition"] in {"included", "merged"}:
            if row["readState"] != "analyzed":
                raise ValueError("Merged and included final materials must be analyzed")
            for key in ("mechanism", "conditions", "variants"):
                _text(row.get(key), "material " + key)
            if not isinstance(row.get("crossParadigms"), list) or not isinstance(row.get("exerciseUrls"), list) or any(not valid_url(url) for url in row["exerciseUrls"]):
                raise ValueError("Analyzed material needs cross-paradigm assessment and exercise URLs")
        if row["disposition"] == "merged":
            seen, current = set(), row
            while current["disposition"] == "merged":
                if current["id"] in seen:
                    raise ValueError("Material merge cycle")
                seen.add(current["id"])
                target = current.get("mergedInto")
                current = next((item for item in materials if item["id"] == target), None)
                if current is None:
                    raise ValueError("Merged material target is missing")
            if final and current["disposition"] != "included":
                raise ValueError("Merged material must terminate in included canonical material")
    for row in branches:
        if row.get("status") not in {"included", "excluded"}:
            raise ValueError("Invalid scope branch status")
        for key in ("title", "reason"):
            _text(row.get(key), "scope branch " + key)
        _references(row.get("materialIds"), mids, "scope materials", nonempty=final and row["status"] == "included")
    for row in findings:
        _references(row.get("materialIds"), mids, "finding materials", nonempty=True)
        _references(row.get("branchIds"), bids, "finding branches", nonempty=True)
        _text(row.get("claim"), "finding claim")
        _path(root, row.get("note"))
        if final:
            for key in ("problem", "mechanism", "conditions", "variants"):
                _text(row.get(key), "finding " + key)
            if not isinstance(row.get("crossParadigms"), list) or not isinstance(row.get("exerciseLinks"), list):
                raise ValueError("Findings need cross-paradigm assessment and exercise links")
            if any(not isinstance(link, dict) or not valid_url(link.get("url")) or not link.get("title") for link in row["exerciseLinks"]):
                raise ValueError("Invalid researched exercise link")
    for row in questions:
        if row.get("status") not in {"open", "resolved", "deferred"} or not isinstance(row.get("core"), bool):
            raise ValueError("Questions require explicit status and core flag")
        _text(row.get("reason"), "question resolution/deferral")
        if final and row["core"] and row["status"] != "resolved":
            raise ValueError("Unresolved core research question")
    for row in searches:
        for key in ("query", "source", "result"):
            _text(row.get(key), "search " + key)
        _path(root, row.get("note"))
    if final:
        for key in ("paradigm", "title", "mechanism", "completenessArgument"):
            _text(scope.get(key), "scope " + key)
        included = {row["id"] for row in branches if row["status"] == "included"}
        if not included or not findings or not searches:
            raise ValueError("Final research needs included branches, actual findings and search records")
        covered = {bid for row in findings for bid in row["branchIds"]}
        used = {mid for row in findings for mid in row["materialIds"]}
        if included - covered or any(row["disposition"] == "included" and row["id"] not in used for row in materials):
            raise ValueError("Orphan included branch/material is not synthesized")
        for row in branches:
            if row["status"] == "included" and any(next(m for m in materials if m["id"] == mid)["disposition"] != "included" for mid in row["materialIds"]):
                raise ValueError("Included branch uses excluded material")
        _text(scope.get("prelude"), "planned prelude")
        types = _rows(scope, "problemTypes")
        type_coverage = set()
        if not types:
            raise ValueError("Final scope needs researched problem types")
        for row in types:
            for key in ("title", "problem", "variation"):
                _text(row.get(key), "problem type " + key)
            _references(row.get("branchIds"), included, "type branches", nonempty=True)
            _references(row.get("materialIds"), mids, "type materials", nonempty=True)
            if any(next(material for material in materials if material["id"] == mid)["disposition"] != "included" for mid in row["materialIds"]):
                raise ValueError("Problem types must use included canonical materials")
            exercises = row.get("exerciseUrls")
            available = {url for material in materials if material["id"] in row["materialIds"] for url in material.get("exerciseUrls", [])}
            if not isinstance(exercises, list) or not 1 <= len(exercises) <= 5 or any(not valid_url(url) or url not in available for url in exercises):
                raise ValueError("Each type needs 1-5 exercise URLs already researched in its materials")
            type_coverage.update(row["branchIds"])
        if included - type_coverage:
            raise ValueError("Included branches need researched problem-type plans")
    return ledger, dossier, scope


def _record(root, phase, record, dossier, scope):
    if not isinstance(record, dict):
        raise ValueError("A substantive JSON checkpoint record is required")
    _text(record.get("summary"), "checkpoint summary")
    notes = record.get("notes")
    if not isinstance(notes, list) or not notes:
        raise ValueError("Checkpoint needs its actual research notes")
    for value in notes:
        _path(root, value)
    required = {"overview": ("corpusUnderstanding", "publicationReview", "candidateBasis"),
                "scope": ("selectionReason",), "collection": ("extractionSummary", "limitations"),
                "synthesis": ("unresolved",), "scope-review": ("scopeConclusion",),
                "resynthesis": ("resolvedChanges", "finalArgument")}[phase]
    for key in required:
        _text(record.get(key), phase + " " + key)
    mids = {row["id"] for row in dossier["materials"]}
    if phase == "scope":
        candidates = record.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ValueError("Scope selection needs an actual candidate comparison")
        for row in candidates:
            if not isinstance(row, dict):
                raise ValueError("Candidate comparison rows must be objects")
            for key in ("name", "decision", "reason"):
                _text(row.get(key), "candidate " + key)
        for key in ("paradigm", "title", "mechanism", "completenessArgument"):
            _text(scope.get(key), "initial scope " + key)
        if not scope["branches"]:
            raise ValueError("Initial scope needs a branch map")
    if phase in {"synthesis", "resynthesis"}:
        sessions = record.get("sessions")
        if not isinstance(sessions, list) or not sessions:
            raise ValueError("Research synthesis needs actual study sessions and conclusions")
        for row in sessions:
            if not isinstance(row, dict):
                raise ValueError("Study sessions must be objects")
            for key in ("question", "findings", "implications"):
                _text(row.get(key), "research session " + key)
            _references(row.get("materialIds"), mids, "session materials", nonempty=True)
    if phase == "scope-review":
        decisions, challenge = record.get("decisions"), record.get("challenge")
        if (not isinstance(decisions, list) or any(not isinstance(row, dict) or not valid_id(row.get("branch")) for row in decisions)
                or not {row["id"] for row in scope["branches"]}.issubset({row.get("branch") for row in decisions})
                or len({row.get("branch") for row in decisions}) != len(decisions)):
            raise ValueError("Scope re-review must disposition every current branch")
        for row in decisions:
            if row.get("action") not in {"retain", "add", "merge", "exclude", "correct"}:
                raise ValueError("Invalid scope change decision")
            _text(row.get("reason"), "scope re-review reasoning")
            _references(row.get("materialIds"), mids, "scope review materials", nonempty=True)
        if not isinstance(challenge, dict) or challenge.get("independent") is not True:
            raise ValueError("A documented independent perspective is required")
        for key in ("researcher", "perspective", "findings", "responses"):
            _text(challenge.get(key), "independent challenge " + key)
        _references(challenge.get("inputMaterialIds"), mids, "challenge input materials", nonempty=True)
        _path(root, challenge.get("note"))


def _notes(record, dossier):
    values = set(record["notes"])
    if isinstance(record.get("challenge"), dict):
        values.add(record["challenge"]["note"])
    for key in ("materials", "findings", "searches"):
        values.update(row["note"] for row in dossier[key])
    return values


def _pointer(root, filename):
    return {"path": filename.relative_to(root).as_posix(), "sha256": digest(filename.read_bytes())}


def _load_pointer(root, pointer):
    filename = _path(root, pointer["path"])
    if digest(filename.read_bytes()) != pointer["sha256"]:
        raise ValueError("Changed immutable research receipt: " + pointer["path"])
    return read_json(filename)


def _chain(root, state):
    records, previous = [], None
    for pointer in state["active"]:
        item = _load_pointer(root, pointer)
        if item.get("previous") != previous or item.get("job") != state["job"] or item.get("chapter") != state["chapter"]:
            raise ValueError("Broken research checkpoint derivation")
        for row in item["files"]:
            archive = _path(root, row["archive"])
            if digest(archive.read_bytes()) != row["sha256"]:
                raise ValueError("Changed archived research evidence")
        records.append(item)
        if item.get("base") != records[0].get("base"):
            raise ValueError("Research checkpoint bases do not share one reviewed frontier")
        previous = pointer
    expected = list(PHASES[:len(records)])
    if [row["phase"] for row in records] != expected:
        raise ValueError("Research checkpoint order is invalid")
    return records


def open_study(root: Path, job_id: str, chapter: str) -> dict:
    if not valid_id(chapter):
        raise ValueError("A stable chapter identity is required")
    from .workflow import _lock
    folder = _folder(root, job_id)
    with _lock(root, job_id):
        if (folder / "study.json").exists():
            raise ValueError("Study already exists; inspect study-status and resume its files")
        entries = [{"id": identity, "relevance": "pending", "reason": "Not assessed yet", "locator": "Not read yet",
                    "readState": "directory", "materialIds": [], "core": False} for identity in sorted(_registry(root))]
        write_json(folder / "ledger.json", {"schemaVersion": 1, "entries": entries})
        write_json(folder / "dossier.json", {"schemaVersion": 1, "materials": [], "findings": [], "questions": [], "searches": []})
        write_json(folder / "scope.json", {"schemaVersion": 1, "paradigm": "", "title": "", "mechanism": "", "branches": [], "exclusions": [], "completenessArgument": ""})
        write_json(folder / "study.json", {"schemaVersion": 1, "job": job_id, "chapter": chapter,
                   "createdAt": now(), "active": [], "history": [], "lastHandoff": None})
    return study_status(root, job_id)


def checkpoint(root: Path, job_id: str, phase: str, record_path: str) -> dict:
    if phase not in PHASES:
        raise ValueError("Unknown research phase")
    from .workflow import _lock
    with _lock(root, job_id):
        folder, state = _state(root, job_id)
        chain = _chain(root, state)
        index = PHASES.index(phase)
        if index > len(chain):
            raise ValueError("Research phase cannot be skipped")
        base = _base(root, state["chapter"])
        if chain and chain[0]["base"] != base and phase != "overview":
            raise ValueError("Research base changed; refresh overview first")
        ledger, dossier, scope = _validate_data(root, folder, collected=index >= 2, final=phase == "resynthesis")
        if phase in {"overview", "scope"} and any(row["relevance"] == "pending" for row in ledger["entries"]):
            raise ValueError("Whole-base relevance must be assessed before initial scope; pending sources remain")
        filename = _path(root, record_path)
        if filename in {folder / name for name in MUTABLE} or filename == folder / "study.json":
            raise ValueError("Checkpoint record must be separate from mutable study state")
        record = read_json(filename)
        _record(root, phase, record, dossier, scope)
        if phase == "scope-review":
            previous_ids = {row["id"] for stage in chain if stage["phase"] in {"scope", "synthesis", "scope-review", "resynthesis"}
                            for row in stage["data"]["scope"]["branches"]}
            current_ids = {row["id"] for row in scope["branches"]}
            decisions = record["decisions"]
            if {row["branch"] for row in decisions} != previous_ids | current_ids:
                raise ValueError("Scope review must disposition prior and revised branches")
            for row in decisions:
                if row["branch"] not in current_ids and row["action"] not in {"exclude", "merge"}:
                    raise ValueError("Removed branches require explicit exclusion or merge")
                if row["action"] == "merge" and row.get("mergedInto") not in current_ids:
                    raise ValueError("Merged scope branch needs current target")
                current = next((branch for branch in scope["branches"] if branch["id"] == row["branch"]), None)
                if current and ((row["action"] == "exclude") != (current["status"] == "excluded")) and row["action"] != "merge":
                    raise ValueError("Scope review decision contradicts current branch disposition")
        if phase == "resynthesis" and chain[4]["data"]["scope"] != scope:
            raise ValueError("Scope changed after scope-review; repeat scope-review first")
        active = state["active"][:index]
        retained = chain[:index]
        paths = {str((folder / name).relative_to(root).as_posix()) for name in MUTABLE} | _notes(record, dossier) | {record_path}
        # Pin original record/note bytes for the active derivation, not superseded tails.
        for item in retained:
            paths.update(row["path"] for row in item["files"] if row["path"] not in {str((folder / name).relative_to(root).as_posix()) for name in MUTABLE})
        identity = uuid.uuid4().hex
        archive_root = folder / "snapshots" / identity
        files = []
        for value in sorted(paths):
            source = _path(root, value)
            content = source.read_bytes()
            target = archive_root / "files" / value
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(content)
            files.append({"path": value, "sha256": digest(content), "archive": target.relative_to(root).as_posix()})
        snapshot = {"schemaVersion": 1, "id": identity, "job": job_id, "chapter": state["chapter"],
                    "phase": phase, "createdAt": now(), "base": base, "previous": active[-1] if active else None,
                    "recordPath": record_path, "record": record, "files": files,
                    "data": {"ledger": ledger, "dossier": dossier, "scope": scope}, "automaticSemanticCertification": False}
        target = archive_root / "checkpoint.json"
        write_json(target, snapshot, immutable=True)
        pointer = _pointer(root, target)
        state["history"].append(pointer)
        state["active"] = active + [pointer]
        state["lastHandoff"] = None
        write_json(folder / "study.json", state)
    return {"ok": True, "checkpoint": pointer, **study_status(root, job_id)}


def study_status(root: Path, job_id: str, *, compare_base=True) -> dict:
    errors, changes = [], []
    state, chain, folder = None, None, None
    try:
        folder, state = _state(root, job_id)
        chain = _chain(root, state)
        if compare_base and chain and chain[0]["base"] != _base(root, state["chapter"]):
            errors.append("Research base changed; refresh overview")
        if chain:
            for row in chain[-1]["files"]:
                filename = _path(root, row["path"])
                if digest(filename.read_bytes()) != row["sha256"]:
                    changes.append(row["path"])
        final = len(chain) == len(PHASES)
        if final and not errors:
            historical_registry = None if compare_base else {
                row["id"] for row in chain[-1]["data"]["ledger"]["entries"] if not row["id"].startswith("external:")}
            _validate_data(root, folder, final=True, collected=True, registry_ids=historical_registry)
        phase = chain[-1]["phase"] if chain else None
        next_phase = PHASES[len(chain)] if not final else "seal-handoff"
        if errors:
            next_phase = "overview"
        elif final and changes:
            next_phase = "scope-review" if str((folder / "scope.json").relative_to(root).as_posix()) in changes else "resynthesis"
        ledger, dossier, scope = _documents(folder)
        unresolved = [row for row in dossier.get("questions", []) if row.get("status") != "resolved"]
        pending = [row["id"] for row in ledger.get("entries", []) if row.get("relevance") == "pending"]
        actions = ["Perform actual " + next_phase + " research, update the dossier and durable record, then checkpoint it."]
        if errors:
            actions = ["Refresh whole-base overview against changed registry/protocol/prior publications; retain reusable research with explicit reasons."]
        elif final and changes:
            actions = ["Review changed evidence and redo " + next_phase + "; existing handoff cannot be used."]
        elif final:
            if state.get("lastHandoff"):
                _load_pointer(root, state["lastHandoff"])
                next_phase = "authoring"
                actions = ["Bind the current handoff to the chapter contract and author its researched problem-type plan; use check-handoff before adopting."]
            else:
                actions = ["Seal the current immutable research handoff; authoring must bind its exact chapter scope and problem-type plan."]
        if pending:
            actions.append("Resolve source relevance/availability before collection: " + ", ".join(pending))
        if unresolved:
            actions.append("Resolve core questions before handoff and justify noncore deferrals.")
        return {"ok": not errors, "job": job_id, "chapter": state["chapter"], "phase": phase,
                "nextPhase": next_phase, "changedFiles": changes, "errors": errors,
                "readyForHandoff": final and not errors and not changes, "lastHandoff": state.get("lastHandoff"),
                "historyCount": len(state["history"]), "studyPath": folder.relative_to(root).as_posix(),
                "scope": {"paradigm": scope.get("paradigm"), "branches": scope.get("branches", [])},
                "unresolvedQuestions": unresolved, "pendingSources": pending,
                "pendingMaterials": [row["id"] for row in dossier.get("materials", []) if row.get("disposition") == "pending"],
                "nextActions": actions,
                "automaticSemanticCertification": False}
    except (ValueError, OSError, KeyError, TypeError) as error:
        if state is not None and chain is not None:
            # An interrupted edit must not erase the last immutable research frontier.
            archived = chain[-1]["data"] if chain else {"scope": {}, "dossier": {}}
            return {"ok": False, "job": job_id, "chapter": state["chapter"],
                    "phase": chain[-1]["phase"] if chain else None, "historyCount": len(state["history"]),
                    "lastHandoff": state.get("lastHandoff"), "studyPath": folder.relative_to(root).as_posix(),
                    "scope": archived["scope"], "changedFiles": changes, "errors": [str(error)],
                    "currentEditError": str(error), "readyForHandoff": False,
                    "nextPhase": "repair-current-dossier",
                    "nextActions": ["Repair current mutable research files; keep the archived checkpoint frontier and handoff history: " + str(error)],
                    "automaticSemanticCertification": False}
        return {"ok": False, "job": job_id, "errors": [str(error)], "readyForHandoff": False,
                "nextPhase": "repair-research-evidence", "nextActions": ["Repair the reported evidence/receipt issue without deleting history: " + str(error)],
                "automaticSemanticCertification": False}


def seal_handoff(root: Path, job_id: str) -> dict:
    from .workflow import _lock
    with _lock(root, job_id):
        status = study_status(root, job_id)
        if not status.get("readyForHandoff"):
            raise ValueError("Research handoff not ready: " + "; ".join(status.get("errors", []) + status.get("changedFiles", [])))
        folder, state = _state(root, job_id)
        chain = _chain(root, state)
        final = chain[-1]
        identity = uuid.uuid4().hex
        handoff = {"schemaVersion": 1, "id": identity, "job": job_id, "chapter": state["chapter"],
                   "createdAt": now(), "state": "research-handoff", "base": final["base"],
                   "checkpoints": state["active"], "files": final["files"],
                   "scope": final["data"]["scope"], "dossier": final["data"]["dossier"],
                   "automaticSemanticCertification": False}
        filename = folder / "handoffs" / (identity + ".json")
        write_json(filename, handoff, immutable=True)
        state["lastHandoff"] = _pointer(root, filename)
        write_json(folder / "study.json", state)
    return check_handoff(root, filename.relative_to(root).as_posix())


def check_handoff(root: Path, path: str, chapter: str | None = None, *, adopted=False) -> dict:
    base_current = False
    try:
        filename = _path(root, path)
        handoff = read_json(filename)
        if not isinstance(handoff, dict) or handoff.get("schemaVersion") != 1 or handoff.get("state") != "research-handoff":
            raise ValueError("Not a research handoff")
        folder, state = _state(root, handoff["job"])
        if filename.parent != folder / "handoffs" or state.get("lastHandoff") != _pointer(root, filename):
            raise ValueError("Handoff changed, was superseded, or is not from this study")
        if chapter is not None and chapter != state["chapter"]:
            raise ValueError("Research handoff belongs to another chapter")
        try:
            base_current = handoff.get("base") == _base(root, state["chapter"])
        except (ValueError, OSError, KeyError, TypeError):
            base_current = False
        status = study_status(root, handoff["job"], compare_base=not adopted)
        if not status.get("readyForHandoff"):
            raise ValueError("Research handoff is stale: " + "; ".join(status.get("errors", []) + status.get("changedFiles", [])))
        chain = _chain(root, state)
        final = chain[-1]
        if handoff.get("checkpoints") != state["active"] or handoff.get("base") != final["base"] or handoff.get("files") != final["files"]:
            raise ValueError("Handoff derivation does not match current completed research")
        if handoff.get("scope") != final["data"]["scope"] or handoff.get("dossier") != final["data"]["dossier"]:
            raise ValueError("Handoff scope/dossier changed")
        paths = {path, (folder / "study.json").relative_to(root).as_posix()}
        if not adopted:
            paths.update(row["path"] for row in handoff["base"]["inputs"])
            paths.update(row["path"] for row in handoff["base"]["publicationFrontier"]["inputs"])
        for pointer, item in zip(state["active"], chain):
            paths.add(pointer["path"])
            paths.update(row["archive"] for row in item["files"])
        paths.update(row["path"] for row in final["files"])
        inputs = [_pointer(root, _path(root, value)) if value.startswith("work/") else _pointer(root, safe_relative(root, value)) for value in sorted(paths)]
        return {"ok": True, "errors": [], "chapter": state["chapter"], "scope": handoff["scope"],
                "dossier": handoff["dossier"], "inputs": inputs, "path": path, "sha256": digest(filename.read_bytes()),
                "adopted": adopted, "baseCurrent": base_current,
                "automaticSemanticCertification": False}
    except (ValueError, OSError, KeyError, TypeError, IndexError) as error:
        return {"ok": False, "errors": [str(error)], "path": path, "inputs": [], "adopted": adopted,
                "baseCurrent": base_current, "automaticSemanticCertification": False}


def handoff_inputs(root: Path, path: str, *, adopted=False) -> list[dict]:
    result = check_handoff(root, path, adopted=adopted)
    if not result["ok"]:
        raise ValueError("; ".join(result["errors"]))
    return result["inputs"]
