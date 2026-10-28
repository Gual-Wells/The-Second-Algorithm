"""Chapter promises and caller-written reviews, not automatic editorial scoring.

Structural checks permit honest open gaps. Publication preparation separately
requires a current, reasoned assessment of every promise in the chapter contract.
"""
from __future__ import annotations

import re
from pathlib import Path

from .storage import digest, read_json, safe_relative

DIMENSIONS = {
    "difficulty": "难度高度",
    "breadth": "范围广度",
    "completeness": "系统完备性",
    "readability": "人类可读性",
}
IDENTITY = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
ANCHOR = re.compile(r' {0,3}<a\s+id=["\']([^"\']+)["\']\s*>[ \t]*</a>[ \t]*')


def _prose_anchors(draft: str) -> list[str]:
    """Accept the project's standalone anchors, conservatively outside code.

    This is deliberately not a general Markdown renderer: an identity used for
    publication evidence must occupy its own line, indented fewer than 4 spaces.
    Fences and comments are excluded using the original draft's line context.
    """
    draft = re.sub(r"<!--[\s\S]*?(?:-->|\Z)", "", draft)
    found, fence, fence_length, inline_ticks = [], None, 0, None
    for line in draft.splitlines():
        marker = re.fullmatch(r" {0,3}(`{3,}|~{3,})(.*)", line)
        if fence is not None:
            if marker and marker[1][0] == fence and len(marker[1]) >= fence_length and not marker[2].strip():
                fence = None
            continue
        if marker and (marker[1][0] == "~" or "`" not in marker[2]):
            fence, fence_length = marker[1][0], len(marker[1])
            continue
        # Backtick spans can continue across lines. Never let a standalone
        # example anchor inside such a span become publication evidence.
        in_inline = inline_ticks is not None
        for run in re.finditer(r"`+", line):
            if inline_ticks is None:
                inline_ticks = len(run[0])
            elif len(run[0]) == inline_ticks:
                inline_ticks = None
        matched = ANCHOR.fullmatch(line)
        if matched and not in_inline and inline_ticks is None:
            found.append(matched[1])
    return found


def _relative(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError("Expected a repository-relative chapter file")
    if "\\" in value:
        raise ValueError("Chapter file paths must use their canonical relative POSIX identity: " + value)
    filename = safe_relative(root, value)
    if filename.relative_to(root).as_posix() != value:
        raise ValueError("Chapter file paths must use their canonical relative POSIX identity: " + value)
    return filename


def _file(root: Path, value: str) -> Path:
    filename = _relative(root, value)
    if filename.relative_to(root).parts[0] in {".local", ".git", "node_modules"}:
        raise ValueError("Chapter evidence must be durable repository files")
    if not filename.is_file():
        raise ValueError("Missing chapter file: " + value)
    return filename


def _rows(value, label: str, errors: list[str]) -> list[dict]:
    if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
        errors.append(label + ": expected an object array")
        return []
    return value


def _text(value, label: str, errors: list[str]):
    if not isinstance(value, str) or not value.strip():
        errors.append(label + ": nonempty text required")


def _strings(value, label: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(row, str) or not row.strip() for row in value):
        errors.append(label + ": expected a string array")
        return []
    if len(set(value)) != len(value):
        errors.append(label + ": duplicate entry")
    return value


def _identity(value, known: set[str], label: str, errors: list[str]) -> bool:
    if not isinstance(value, str) or not IDENTITY.fullmatch(value) or value in known:
        errors.append(label + ": invalid/duplicate identity")
        return False
    known.add(value)
    return True


def _locations(value, label, documents, permitted, errors, *, required=False):
    locations = _rows(value, label, errors)
    if required and not locations:
        errors.append(label + ": actual prose location required")
    seen = set()
    for location in locations:
        did, anchor = location.get("document"), location.get("anchor")
        if not isinstance(did, str) or did not in permitted or did not in documents:
            errors.append(label + ": location must belong to this published chapter")
            continue
        if not isinstance(anchor, str) or not anchor or anchor not in documents[did]["anchors"]:
            errors.append(label + ": missing explicit prose anchor " + str(anchor))
        key = (did, anchor)
        if key in seen:
            errors.append(label + ": duplicate location")
        seen.add(key)
    return locations


def inspect_chapters(root: Path, publications: dict, model: dict, documents: dict) -> tuple[dict, dict]:
    """Validate chapter contracts. Open gaps and absent reviews are legal here."""
    errors, dependencies, chapters = [], set(), []
    if publications.get("state", "active") == "withdrawn":
        return {"ok": True, "errors": [], "chapters": [], "operation": "withdrawal"}, {"chapters": [], "dependencies": set(), "reviewPaths": set()}
    index_path = "catalog/chapters.json"
    try:
        index = read_json(_file(root, index_path))
    except (ValueError, OSError) as error:
        return {"ok": False, "errors": [str(error)], "chapters": []}, {"chapters": [], "dependencies": set(), "reviewPaths": set()}
    dependencies.add(index_path)
    if not isinstance(index, dict) or index.get("schemaVersion") != 1:
        return {"ok": False, "errors": ["chapters: expected schemaVersion 1"], "chapters": []}, {"chapters": [], "dependencies": dependencies, "reviewPaths": set()}
    registry = _rows(index.get("chapters"), "chapters", errors)
    publication_rows = _rows(publications.get("collections"), "publications.collections", errors)
    published = {row["id"]: row for row in publication_rows if isinstance(row.get("id"), str)
                 and row.get("kind") == "chapter" and row.get("visibility", "published") == "published"}
    if not published:
        errors.append("Active publication requires a published chapter contract")
    for document in documents.values():
        anchors = _prose_anchors(document.get("draft", ""))
        document["anchors"] = set(anchors)
        if len(anchors) != len(set(anchors)):
            errors.append("chapter prose: duplicate explicit anchor")
    task_rows = _rows(model.get("tasks"), "learning.tasks", errors)
    task_documents = {row["id"]: row.get("document") for row in task_rows if isinstance(row.get("id"), str)}
    ids, collections, authority_paths, review_paths = set(), set(), set(), set()
    for row in registry:
        cid = row.get("id")
        if not _identity(cid, ids, "chapter", errors):
            continue
        collection = row.get("collection")
        if not isinstance(collection, str) or collection not in published or collection in collections:
            errors.append(cid + ": contract must identify one unique published chapter collection")
            continue
        collections.add(collection)
        collection_documents = _rows(published[collection].get("documents"), collection + ".documents", errors)
        permitted = {doc["id"] for doc in collection_documents if isinstance(doc.get("id"), str)}
        contract_path, review_path = row.get("contract"), row.get("review")
        try:
            filename = _file(root, contract_path)
            if filename.suffix != ".json" or contract_path in authority_paths:
                raise ValueError(cid + ": contract must be a unique JSON authority")
            authority_paths.add(contract_path)
            dependencies.add(contract_path)
            contract = read_json(filename)
            if not isinstance(contract, dict) or contract.get("schemaVersion") != 1 or contract.get("chapter") != cid:
                raise ValueError(cid + ": invalid chapter contract identity/version")
        except (ValueError, OSError, TypeError) as error:
            errors.append(str(error))
            continue
        if review_path is not None:
            try:
                # An absent review is a quality gap, not an invalid draft.
                if not isinstance(review_path, str) or not review_path or Path(review_path).is_absolute():
                    raise ValueError(cid + ": review must be a repository-relative JSON path or null")
                review_file = _relative(root, review_path)
                if review_file.suffix != ".json" or review_file.relative_to(root).parts[0] != "content":
                    raise ValueError(cid + ": review must be a durable content JSON file")
                if review_path in review_paths or review_path in authority_paths:
                    raise ValueError(cid + ": review path must be unique and distinct from contracts")
                review_paths.add(review_path)
            except (ValueError, TypeError) as error:
                errors.append(str(error))
        _text(contract.get("title"), cid + ".title", errors)
        reader = contract.get("reader")
        scope = contract.get("scope")
        if not isinstance(reader, dict):
            reader = {}
        if not isinstance(scope, dict):
            scope = {}
        for name in ("startingPoint", "targetCapability", "supportPolicy"):
            _text(reader.get(name), cid + ".reader." + name, errors)
        for name in ("core", "extensions", "completenessArgument"):
            _text(scope.get(name), cid + ".scope." + name, errors)
        for exclusion in _rows(scope.get("exclusions"), cid + ".scope.exclusions", errors):
            for name in ("topic", "reason"):
                _text(exclusion.get(name), cid + ".exclusion." + name, errors)
            if exclusion.get("destination") is not None:
                _text(exclusion["destination"], cid + ".exclusion.destination", errors)
        materials = _rows(contract.get("materials"), cid + ".materials", errors)
        material_ids = set()
        for material in materials:
            mid = material.get("id")
            _identity(mid, material_ids, cid + ".material", errors)
            for name in ("kind", "locator"):
                _text(material.get(name), cid + ".material." + name, errors)
            names = [material.get("evidence"), *_strings(material.get("sourcePaths"), cid + ".material.sourcePaths", errors)]
            for name in names:
                try:
                    dependencies.add(_file(root, name).relative_to(root).as_posix())
                except (ValueError, OSError, TypeError) as error:
                    errors.append(cid + ": " + str(error))
        commitments = _rows(contract.get("commitments"), cid + ".commitments", errors)
        promise_ids, dimensions = set(), set()
        for promise in commitments:
            pid = promise.get("id")
            _identity(pid, promise_ids, cid + ".commitment", errors)
            dimension = promise.get("dimension")
            if not isinstance(dimension, str) or dimension not in DIMENSIONS:
                errors.append(cid + ": unknown chapter quality dimension")
            else:
                dimensions.add(dimension)
            for name in ("claim", "acceptance"):
                _text(promise.get(name), cid + ".commitment." + name, errors)
            state = promise.get("status")
            if state not in {"open", "addressed"}:
                errors.append(cid + ": promise status must be open or addressed")
            if state == "open":
                _text(promise.get("gap"), cid + ".commitment.gap", errors)
            elif promise.get("gap") is not None and promise.get("gap") != "":
                errors.append(cid + ": addressed promise cannot conceal a recorded gap")
            for task in _strings(promise.get("taskIds"), cid + ".commitment.taskIds", errors):
                if task not in task_documents or task_documents[task] not in permitted:
                    errors.append(cid + ": commitment task must belong to this chapter")
            mids = _strings(promise.get("materialIds"), cid + ".commitment.materialIds", errors)
            if state == "addressed" and not mids:
                errors.append(cid + ": addressed promise needs actual material references")
            if any(mid not in material_ids for mid in mids):
                errors.append(cid + ": unknown commitment material")
            _locations(promise.get("locations"), cid + ".commitment.locations", documents, permitted, errors, required=state == "addressed")
        if dimensions != set(DIMENSIONS):
            errors.append(cid + ": explicit promises required for difficulty, breadth, completeness and readability")
        reading = contract.get("reading")
        if not isinstance(reading, dict):
            errors.append(cid + ".reading: expected a reading structure object")
            reading = {}
        reading_state = reading.get("status")
        if reading_state not in {"open", "addressed"}:
            errors.append(cid + ".reading: status must be open or addressed")
        if reading_state == "open":
            _text(reading.get("gap"), cid + ".reading.gap", errors)
        elif reading.get("gap") is not None and reading.get("gap") != "":
            errors.append(cid + ".reading: addressed reading path cannot conceal a gap")
        _locations(reading.get("entry", []), cid + ".reading.entry", documents, permitted, errors, required=reading_state == "addressed")
        _locations(reading.get("selectionMap", []), cid + ".reading.selectionMap", documents, permitted, errors, required=reading_state == "addressed")
        units = _rows(reading.get("units", []), cid + ".reading.units", errors)
        if reading_state == "addressed" and not units:
            errors.append(cid + ".reading: actual problem-cluster reading units required")
        unit_ids, unit_tasks = set(), set()
        for unit in units:
            _identity(unit.get("id"), unit_ids, cid + ".reading.unit", errors)
            _text(unit.get("title"), cid + ".reading.unit.title", errors)
            _locations(unit.get("locations", []), cid + ".reading.unit.locations", documents, permitted, errors, required=reading_state == "addressed")
            for tid in _strings(unit.get("taskIds", []), cid + ".reading.unit.taskIds", errors):
                if tid not in task_documents or task_documents[tid] not in permitted:
                    errors.append(cid + ".reading: unit task must belong to this chapter")
                unit_tasks.add(tid)
        expected_tasks = {tid for tid, did in task_documents.items() if did in permitted}
        if reading_state == "addressed" and not expected_tasks.issubset(unit_tasks):
            errors.append(cid + ".reading: every chapter task needs an actual reading unit")
        chapters.append({"id": cid, "collection": collection, "contractPath": contract_path,
                         "reviewPath": review_path, "contract": contract, "documents": permitted, "promises": commitments})
    if collections != set(published):
        errors.append("Every published chapter requires exactly one chapter contract")
    if authority_paths & review_paths or dependencies & review_paths:
        errors.append("Chapter review files cannot be contract/material inputs to their own review hash")
    result = {"ok": not errors, "errors": errors, "chapters": [
        {"id": chapter["id"], "title": chapter["contract"].get("title", ""),
         "openPromises": [p.get("id") for p in chapter["promises"] if p.get("status") == "open"]}
        for chapter in chapters], "semanticCompletenessCertified": False}
    return result, {"chapters": chapters, "dependencies": dependencies, "reviewPaths": review_paths}


def chapter_quality(root: Path, chapter_id: str | None = None) -> dict:
    """Require current explicit review evidence; never infer editorial truth."""
    from .learning import _inspect, course_snapshot
    root = root.resolve()
    try:
        checked, context = _inspect(root)
    except (ValueError, OSError, TypeError, KeyError, AttributeError) as error:
        return {"ok": False, "errors": [str(error)], "chapters": [], "semanticCompletenessCertified": False}
    if not checked["ok"]:
        return {"ok": False, "errors": checked["errors"], "chapters": [], "semanticCompletenessCertified": False}
    if checked["operation"] == "withdrawal":
        return {"ok": True, "operation": "withdrawal", "chapters": [], "semanticCompletenessCertified": False}
    snapshot = course_snapshot(root, include_reviews=False)
    reports = []
    selected = [chapter for chapter in context["chapters"]["chapters"] if chapter_id is None or chapter["id"] == chapter_id]
    if not selected:
        raise ValueError("Unknown chapter: " + str(chapter_id))
    for chapter in selected:
        cid, contract, errors = chapter["id"], chapter["contract"], []
        for promise in contract["commitments"]:
            if promise["status"] != "addressed":
                errors.append(promise["id"] + ": open promise — " + promise["gap"])
        if contract["reading"]["status"] != "addressed":
            errors.append("reading structure is open — " + contract["reading"]["gap"])
        review_path = chapter["reviewPath"]
        review = None
        try:
            review = read_json(_file(root, review_path))
            if not isinstance(review, dict) or review.get("schemaVersion") != 1 or review.get("chapter") != cid:
                raise ValueError("invalid review identity/version")
            if review.get("inputHash") != snapshot["inputHash"]:
                errors.append("review is stale: editorial input hashes differ")
            if review.get("verdict") != "accepted":
                errors.append("chapter review has not accepted this edition")
            for name in ("baseline", "findings"):
                _text(review.get("comparison", {}).get(name), cid + ".comparison." + name, errors)
            outside = review.get("outsideChallenge", {})
            _text(outside.get("findings"), cid + ".outsideChallenge.findings", errors)
            outside_ids = _strings(outside.get("materialIds"), cid + ".outsideChallenge.materialIds", errors)
            counterchecks = {m["id"] for m in contract["materials"] if m["kind"] == "countercheck"}
            if not outside_ids or any(mid not in counterchecks for mid in outside_ids):
                errors.append("outside challenge must reference actual countercheck materials")
            promises = {p["id"]: p for p in contract["commitments"]}
            assessed = set()
            for assessment in _rows(review.get("assessments"), cid + ".assessments", errors):
                pid = assessment.get("commitment")
                if not isinstance(pid, str) or pid not in promises or pid in assessed:
                    errors.append("unknown/duplicate assessed chapter promise")
                    continue
                assessed.add(pid)
                _text(assessment.get("reason"), cid + ".assessment.reason", errors)
                if assessment.get("outcome") != "pass":
                    errors.append(pid + ": review records an unresolved gap")
                _locations(assessment.get("locations"), cid + ".assessment.locations", context["documents"], chapter["documents"], errors,
                           required=assessment.get("outcome") == "pass")
            if assessed != set(promises):
                errors.append("review must assess every chapter promise exactly once")
        except (ValueError, OSError, TypeError, AttributeError) as error:
            errors.append("Missing/invalid chapter review: " + str(error))
        reports.append({"id": cid, "title": contract["title"], "ok": not errors, "errors": errors,
                        "contract": chapter["contractPath"], "review": review_path,
                        "reviewSha256": digest(_file(root, review_path).read_bytes()) if review is not None else None})
    return {"ok": all(row["ok"] for row in reports), "operation": checked["operation"],
            "inputHash": snapshot["inputHash"], "chapters": reports,
            "semanticCompletenessCertified": False,
            "claim": "Current caller-written assessments and locations checked; no automatic difficulty or completeness score."}


def chapter_inputs(root: Path, chapter_id: str) -> dict:
    from .learning import _inspect, course_snapshot
    checked, context = _inspect(root)
    if not checked["ok"]:
        raise ValueError("Current course invalid: " + "; ".join(checked["errors"]))
    if chapter_id not in {row["id"] for row in context["chapters"]["chapters"]}:
        raise ValueError("Unknown chapter: " + chapter_id)
    snapshot = course_snapshot(root, include_reviews=False)
    return {"chapter": chapter_id, "inputHash": snapshot["inputHash"], "inputs": snapshot["inputs"],
            "binding": "All current production, rules, contracts and material evidence; excludes review file bytes to avoid self-reference."}


def render_chapters(root: Path, chapter_id: str | None = None) -> str:
    from .learning import _inspect
    checked, context = _inspect(root)
    if not checked["ok"]:
        raise ValueError("Current course invalid: " + "; ".join(checked["errors"]))
    selected = [row for row in context["chapters"]["chapters"] if chapter_id is None or row["id"] == chapter_id]
    if chapter_id is not None and not selected:
        raise ValueError("Unknown chapter: " + chapter_id)
    lines = ["章节合同（结构可核验；难度、完整性与可读性仍须真实编纂审阅）"]
    for chapter in selected:
        contract = chapter["contract"]
        lines.extend(["", contract["title"] + " [" + chapter["id"] + "]",
                      "读者起点：" + contract["reader"]["startingPoint"], "能力目标：" + contract["reader"]["targetCapability"],
                      "实现支撑：" + contract["reader"]["supportPolicy"], "核心范围：" + contract["scope"]["core"],
                      "扩展关系：" + contract["scope"]["extensions"], "完备性论据：" + contract["scope"]["completenessArgument"]])
        for promise in contract["commitments"]:
            lines.append("- " + DIMENSIONS[promise["dimension"]] + " / " + promise["id"] + " [" + promise["status"] + "]：" + promise["claim"])
            lines.append("  验收：" + promise["acceptance"])
            if promise.get("gap"):
                lines.append("  缺口：" + promise["gap"])
            for location in promise["locations"]:
                lines.append("  正文：" + location["document"] + "#" + location["anchor"])
        reading = contract["reading"]
        lines.append("阅读路径 [" + reading["status"] + "]")
        if reading.get("gap"):
            lines.append("  缺口：" + reading["gap"])
        for location in reading.get("entry", []):
            lines.append("  入口：" + location["document"] + "#" + location["anchor"])
        for unit in reading.get("units", []):
            lines.append("  问题簇：" + unit["title"] + " [" + unit["id"] + "]；任务：" + ", ".join(unit.get("taskIds", [])))
            for location in unit.get("locations", []):
                lines.append("    正文：" + location["document"] + "#" + location["anchor"])
        for location in reading.get("selectionMap", []):
            lines.append("  方法选择地图：" + location["document"] + "#" + location["anchor"])
        for exclusion in contract["scope"]["exclusions"]:
            lines.append("排除：" + exclusion["topic"] + "；" + exclusion["reason"] + "；去向：" + str(exclusion.get("destination") or "未承诺后续章"))
    if not selected:
        lines.append("显式撤回：当前无正式章节。")
    return "\n".join(lines)
