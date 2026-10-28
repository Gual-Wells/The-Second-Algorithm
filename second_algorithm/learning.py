"""Current-course identities and deterministic checks, separate from research history."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .storage import canonical_bytes, digest, read_json, safe_relative, valid_url

ID = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
QUESTION = re.compile(r"Q[0-9]{6,}\Z")
STANDARDS = {"c++17": 17, "c++20": 20, "c++23": 23}
KINDS = {"run", "compile", "compile-fail"}
REGION = re.compile(r"^// BEGIN ([\w-]+)\r?\n([\s\S]*?)^// END \1\s*$", re.M)
INCLUDE = re.compile(r'^\s*#\s*include\s*"([^"\n]+)"', re.M)


def file_path(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError("Expected a repository-relative file path")
    result = safe_relative(root, value)
    if not result.is_file():
        raise ValueError("Missing file: " + value)
    return result


def source_closure(root: Path, filenames: list[str]) -> set[str]:
    """Resolve explicit quoted includes; macro/system dependencies are not inferred."""
    root = root.resolve()
    found: set[str] = set()
    pending = [file_path(root, name) for name in filenames]
    while pending:
        filename = pending.pop()
        relative = filename.relative_to(root).as_posix()
        if relative in found:
            continue
        found.add(relative)
        text = filename.read_text(encoding="utf-8-sig")
        for include in INCLUDE.findall(text):
            child = (filename.parent / include).resolve()
            if not child.is_relative_to(root) or not child.is_file():
                raise ValueError("Missing/outside quoted include: " + relative + " -> " + include)
            pending.append(child)
    return found


def _inspect(root: Path) -> tuple[dict, dict]:
    errors: list[str] = []
    model = read_json(root / "catalog/learning.json")
    publications = read_json(root / "carrier/publications.json")
    if not isinstance(model, dict) or model.get("schemaVersion") != 1:
        return {"ok": False, "scope": "current-course", "errors": ["learning: expected schemaVersion 1"]}, {}
    if not isinstance(publications, dict) or publications.get("schemaVersion") != 2:
        return {"ok": False, "scope": "current-course", "errors": ["publications: expected schemaVersion 2"]}, {}
    publication_state = publications.get("state", "active")
    if publication_state not in {"active", "withdrawn"}:
        errors.append("publications.state: expected active or withdrawn")

    def rows(parent, key, label):
        value = parent.get(key)
        if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
            errors.append(label + ": expected an object array")
            return []
        return value

    def strings(value, label, *, required=False):
        if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
            errors.append(label + ": expected a string array")
            return []
        if required and not value:
            errors.append(label + ": must not be empty")
        if len(set(value)) != len(value):
            errors.append(label + ": duplicate entry")
        return value

    def text(value, label):
        if not isinstance(value, str) or not value.strip():
            errors.append(label + ": nonempty text required")

    def identity(row, known, label, pattern=ID):
        key = row.get("id")
        if not isinstance(key, str) or not pattern.fullmatch(key) or key in known:
            errors.append(label + ": invalid/duplicate ID " + str(key))
            return None
        known.add(key)
        return key

    documents, publication_ids, chapter_numbers, authority_paths = {}, set(), set(), set()
    all_document_ids, published_document_ids = set(), set()
    for collection in rows(publications, "collections", "publications.collections"):
        identity(collection, publication_ids, "collection")
        if "track" in collection:
            errors.append("collection: track is not part of the unified publication model")
        if collection.get("kind") not in {"chapter", "draft"}:
            errors.append("collection: invalid kind")
        if collection.get("visibility", "published") not in {"published", "hidden"}:
            errors.append("collection: invalid visibility")
        if collection.get("kind") == "draft" and (collection.get("visibility") != "hidden" or "chapterNumber" in collection):
            errors.append("collection: drafts must be hidden and have no chapter number")
        if collection.get("kind") == "chapter":
            number = collection.get("chapterNumber")
            if type(number) is not int or number < 1 or number in chapter_numbers:
                errors.append("collection: invalid/duplicate unified chapter number")
            chapter_numbers.add(number if isinstance(number, (str, int)) else str(number))
        text(collection.get("title"), "collection.title")
        for document in rows(collection, "documents", "collection.documents"):
            did = identity(document, all_document_ids, "document")
            base = document.get("path")
            if not isinstance(base, str) or not re.fullmatch(r"content/[^/\\]+/[^/\\]+", base) or any(part in {".", ".."} for part in base.split("/")):
                errors.append("document: expected content/<unit>/<name> authority")
                continue
            if base in authority_paths:
                errors.append("document: authority is registered more than once")
            authority_paths.add(base)
            text(document.get("title"), "document.title")
            if did and collection.get("visibility", "published") == "published":
                published_document_ids.add(did)
                try:
                    draft = file_path(root, base + ".source.md").read_text(encoding="utf-8-sig")
                    file_path(root, base + ".cpp")
                    documents[did] = {**document, "draft": draft}
                except (ValueError, OSError) as error:
                    errors.append(str(error))

    questions = rows(model, "questions", "learning.questions")
    tasks = rows(model, "tasks", "learning.tasks")
    targets = rows(model, "targets", "learning.targets")
    qids, question_map, target_map, target_ids = set(), {}, {}, set()
    lectures, references = {}, {}
    for did, document in documents.items():
        prose = re.sub(r"(?ms)^(`{3,}|~{3,})[^\n]*\n.*?^\1\s*$", "", document["draft"])
        prose = re.sub(r"(?s)<!--.*?-->", "", prose)
        document["prose"] = prose
        if "draftq:" in prose:
            errors.append(did + ": unresolved temporary question ID")
        for qid in re.findall(r"(?m)^#{1,6}\s+(Q[0-9]{6,})\b", prose):
            lectures.setdefault(qid, []).append(did)
        references[did] = re.findall(r"\[\[(Q[0-9]{6,})\]\]", prose)
    for question in questions:
        qid = identity(question, qids, "question", QUESTION)
        if not qid:
            continue
        question_map[qid] = question
        if int(qid[1:]) < 1:
            errors.append(qid + ": question numbering starts at 1")
        text(question.get("title"), qid + ".title")
        did, anchor = question.get("document"), question.get("anchor")
        if did not in documents:
            errors.append(qid + ": main explanation must belong to a published document")
        if anchor != qid.lower():
            errors.append(qid + ": anchor must match the lowercase question ID")
        if lectures.get(qid) != [did]:
            errors.append(qid + ": requires exactly one full main heading in its registered document")
        if did in documents:
            marker = r'<a\s+id=["\']' + re.escape(str(anchor)) + r'["\']\s*>\s*</a>\s*\n+###\s+' + qid + r"\s*·\s*\S"
            if not re.search(marker, documents[did]["prose"]):
                errors.append(qid + ": missing adjacent explicit anchor and canonical main heading")
        prerequisites = strings(question.get("prerequisites"), qid + ".prerequisites")
        urls = strings(question.get("sources"), qid + ".sources", required=True)
        if any(not valid_url(url) for url in urls):
            errors.append(qid + ": invalid source URL")
        question["prerequisites"] = prerequisites
    for qid in lectures:
        if qid not in qids:
            errors.append("Unregistered main question: " + qid)
    for did, refs in references.items():
        for qid in refs:
            if qid not in qids:
                errors.append(did + ": unknown question reference " + qid)
    unresolved = {qid: set(question.get("prerequisites", [])) for qid, question in question_map.items()}
    followers = {qid: set() for qid in question_map}
    for qid, prerequisites in unresolved.items():
        for prior in prerequisites:
            if prior not in question_map:
                errors.append(qid + ": unknown prerequisite " + prior)
            else:
                followers[prior].add(qid)
    ready = [qid for qid, prerequisites in unresolved.items() if not prerequisites]
    visited = set()
    while ready:
        qid = ready.pop()
        visited.add(qid)
        for follower in followers[qid]:
            unresolved[follower].discard(qid)
            if not unresolved[follower]:
                ready.append(follower)
    if len(visited) != len(question_map) and not any("unknown prerequisite" in error for error in errors):
        errors.append("Question prerequisite cycle: " + ", ".join(sorted(set(question_map) - visited)[:8]))

    target_dependencies = {}
    for target in targets:
        tid = identity(target, target_ids, "target")
        if not tid:
            continue
        target_map[tid] = target
        if target.get("kind") not in KINDS:
            errors.append(tid + ": invalid verification kind")
        if target.get("standard") not in STANDARDS:
            errors.append(tid + ": unsupported C++ standard")
        timeout = target.get("timeoutSeconds")
        if type(timeout) is not int or not 1 <= timeout <= 120:
            errors.append(tid + ": timeoutSeconds must be 1..120")
        dependencies = strings(target.get("dependencies", []), tid + ".dependencies")
        additional = strings(target.get("additionalSources", []), tid + ".additionalSources")
        defines = strings(target.get("defines", []), tid + ".defines")
        if any(not re.fullmatch(r"[A-Za-z_]\w*(?:=[A-Za-z0-9_+.-]+)?", item) for item in defines):
            errors.append(tid + ": invalid preprocessor definition")
        try:
            names = [target.get("source"), *additional, *dependencies]
            target_dependencies[tid] = source_closure(root, names)
        except (ValueError, OSError, TypeError) as error:
            errors.append(tid + ": " + str(error))
    task_ids, implementation_ids, region_cache = set(), set(), {}
    implementation_count = 0
    for task in tasks:
        task_id = identity(task, task_ids, "task") or "invalid-task"
        text(task.get("title"), task_id + ".title")
        text(task.get("contract"), task_id + ".contract")
        did = task.get("document")
        if did not in documents:
            errors.append(task_id + ": task must belong to a published document")
        urls = strings(task.get("sourceUrls"), task_id + ".sourceUrls", required=True)
        if any(not valid_url(url) for url in urls):
            errors.append(task_id + ": invalid task source URL")
        methods = rows(task, "methods", task_id + ".methods")
        if not methods:
            errors.append(task_id + ": at least one method required")
        method_ids = set()
        for method in methods:
            mid = identity(method, method_ids, task_id + ".method") or "invalid-method"
            text(method.get("title"), mid + ".title")
            text(method.get("invariant"), mid + ".invariant")
            implementations = rows(method, "implementations", mid + ".implementations")
            if not implementations:
                errors.append(mid + ": at least one implementation required")
            for implementation in implementations:
                iid = identity(implementation, implementation_ids, "implementation")
                implementation_count += 1
                if not iid:
                    continue
                if implementation.get("kind") not in {"manual", "standard", "alternative"}:
                    errors.append(iid + ": invalid implementation kind")
                standard = implementation.get("standard")
                if standard not in STANDARDS:
                    errors.append(iid + ": unsupported implementation standard")
                complexity = implementation.get("complexity", {})
                if not isinstance(complexity, dict):
                    complexity = {}
                text(complexity.get("time"), iid + ".complexity.time")
                text(complexity.get("space"), iid + ".complexity.space")
                used_questions = strings(implementation.get("questions"), iid + ".questions", required=True)
                for qid in used_questions:
                    if qid not in qids:
                        errors.append(iid + ": unknown question " + qid)
                    elif did in documents and qid not in references.get(did, []) and did not in lectures.get(qid, []):
                        errors.append(iid + ": required question is not explained/referenced in task document: " + qid)
                source, symbol = implementation.get("source"), implementation.get("symbol")
                region_ids = strings(implementation.get("regions"), iid + ".regions", required=True)
                try:
                    filename = file_path(root, source)
                    if source not in region_cache:
                        code = filename.read_text(encoding="utf-8-sig")
                        matches = list(REGION.finditer(code))
                        blocks = {m[1]: m[2] for m in matches}
                        if len(blocks) != len(matches):
                            errors.append(source + ": duplicate source region")
                        starts = re.findall(r"(?m)^// BEGIN ([\w-]+)\s*$", code)
                        ends = re.findall(r"(?m)^// END ([\w-]+)\s*$", code)
                        if sorted(starts) != sorted(ends) or len(matches) != len(starts):
                            errors.append(source + ": unmatched source region markers")
                        region_cache[source] = blocks
                    blocks = region_cache[source]
                    for rid in region_ids:
                        if rid not in blocks:
                            errors.append(iid + ": missing source region " + rid)
                    combined = "\n".join(blocks.get(rid, "") for rid in region_ids)
                    if not isinstance(symbol, str) or not re.fullmatch(r"[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*", symbol):
                        errors.append(iid + ": invalid symbol")
                    elif not re.search(r"\b" + re.escape(symbol.split("::")[-1]) + r"\s*\(", combined):
                        errors.append(iid + ": symbol absent from declared source regions")
                except (ValueError, OSError, TypeError) as error:
                    errors.append(iid + ": " + str(error))
                target = target_map.get(implementation.get("target"))
                if target is None:
                    errors.append(iid + ": unknown verification target")
                else:
                    if source not in target_dependencies.get(target["id"], set()):
                        errors.append(iid + ": verification target does not depend on implementation source")
                    if STANDARDS.get(target.get("standard"), 0) < STANDARDS.get(standard, 999):
                        errors.append(iid + ": verification standard is older than implementation")
                    if target.get("kind") == "compile-fail":
                        errors.append(iid + ": a reference implementation requires a successful verification target")
    if publication_state == "withdrawn":
        if published_document_ids or questions or tasks or targets:
            errors.append("Withdrawn publication requires no published documents and empty questions, tasks and targets")
    elif not documents or not questions or not tasks or not targets:
        errors.append("Current course requires published documents, questions, tasks and targets")
    from .chapters import inspect_chapters
    chapter_validation, chapter_context = inspect_chapters(root, publications, model, documents)
    errors.extend(chapter_validation["errors"])
    result = {"ok": not errors, "scope": "current-course", "errors": errors,
              "publicationState": publication_state,
              "operation": "withdrawal" if publication_state == "withdrawn" else "content-release",
              "counts": {"documents": len(documents), "questions": len(questions), "tasks": len(tasks),
                         "implementations": implementation_count, "targets": len(targets)},
              "chapters": chapter_validation,
              "semanticCompletenessCertified": False, "userMasteryMeasured": False}
    return result, {"model": model, "documents": documents, "dependencies": target_dependencies,
                    "chapters": chapter_context}


def validate_learning(root: Path) -> dict:
    try:
        return _inspect(root.resolve())[0]
    except (OSError, ValueError, TypeError, RecursionError) as error:
        return {"ok": False, "scope": "current-course", "errors": [str(error)]}


def course_snapshot(root: Path, *, include_reviews: bool = True) -> dict:
    root = root.resolve()
    checked, context = _inspect(root)
    if not checked["ok"]:
        raise ValueError("Current course invalid: " + "; ".join(checked["errors"]))
    inputs = {"catalog/learning.json", "carrier/publications.json"}
    inputs.update(context["chapters"]["dependencies"])
    review_paths = context["chapters"]["reviewPaths"]
    if include_reviews:
        inputs.update(name for name in review_paths if (root / name).is_file())
    for document in context["documents"].values():
        base = document["path"]
        inputs.update([base + ".source.md", base + ".cpp"])
        for suffix in (".md", ".html"):
            if (root / (base + suffix)).is_file():
                inputs.add(base + suffix)
        manifest = str(Path(base).parent / "build" / (Path(base).name + ".json")).replace("\\", "/")
        if (root / manifest).is_file():
            inputs.add(manifest)
    for task in context["model"]["tasks"]:
        for method in task["methods"]:
            for implementation in method["implementations"]:
                inputs.update(source_closure(root, [implementation["source"]]))
    for dependencies in context["dependencies"].values():
        inputs.update(dependencies)
    # Publication preparation also binds the actual reader/worker and its builders.
    # Runtime/cache directories are never part of the source identity.
    source_directories = {
        # The carrier copies every allowed static file, including future fonts/images.
        "web": None,
        "server": {".js", ".mjs", ".cjs", ".ts", ".json"},
        "scripts": {".js", ".mjs", ".cjs", ".ts", ".json", ".py"},
        "second_algorithm": {".py"},
        "test": {".mjs", ".js", ".cjs"},
        "tests": {".py"},
        "migrations": {".sql"},
        "protocol": {".md"},
        ".github/workflows": {".yml", ".yaml"},
    }
    for directory, extensions in source_directories.items():
        for current, directories, filenames in os.walk(root / directory, followlinks=False):
            directories[:] = sorted(name for name in directories
                                    if name not in {"node_modules", ".local", ".git", ".wrangler"})
            for name in sorted(filenames):
                if name.startswith(".") or (extensions is not None and Path(name).suffix.lower() not in extensions):
                    continue
                inputs.add((Path(current) / name).relative_to(root).as_posix())
    for filename in ("tools/build_handbook.mjs", "scripts/build-carrier.mjs", "package.json", "package-lock.json", "wrangler.jsonc",
                     "second_algorithm/learning.py", "second_algorithm/workflow.py", "AGENTS.md",
                     "protocol/CONTENT_PIPELINE.md", "protocol/RESEARCH_DEPARTMENT.md", "catalog/scope.json", "docs/CONTENT_MODEL.md"):
        if (root / filename).is_file():
            inputs.add(filename)
    # Review content binds the final publication packet, while the hash recorded
    # inside that review excludes all review bytes, avoiding a self-reference.
    if not include_reviews:
        inputs.difference_update(review_paths)
    hashes = {filename: digest(file_path(root, filename).read_bytes()) for filename in sorted(inputs)}
    return {"inputHash": digest(canonical_bytes(hashes)), "inputs": hashes, "validation": checked,
            "publicationState": checked["publicationState"], "operation": checked["operation"],
            "documents": sorted(context["documents"])}


def course_targets(root: Path) -> list[dict]:
    snapshot = course_snapshot(root)
    return [{**target, "inputHash": snapshot["inputHash"]}
            for target in read_json(root / "catalog/learning.json")["targets"]]


def search_learning(root: Path, query: str) -> list[dict]:
    model = read_json(root / "catalog/learning.json", {})
    terms = query.casefold().split()
    if not terms:
        return []
    items = [("question", row) for row in model.get("questions", [])]
    for task in model.get("tasks", []):
        items.append(("task", task))
        for method in task.get("methods", []):
            items.extend(("implementation", row) for row in method.get("implementations", []))
    return [{"kind": kind, "id": row["id"], "record": row} for kind, row in items
            if all(term in json.dumps(row, ensure_ascii=False).casefold() for term in terms)]
