"""Chapter promises and caller-written reviews, not automatic editorial scoring.

Structural checks permit honest open gaps. Publication preparation separately
requires a current, reasoned assessment of every promise in the chapter contract.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from .storage import canonical_bytes, digest, read_json, safe_relative

DIMENSIONS = {
    "difficulty": "难度高度",
    "breadth": "范围广度",
    "completeness": "系统完备性",
    "readability": "人类可读性",
}
IDENTITY = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
ANCHOR = re.compile(r' {0,3}<a\s+id=["\']([^"\']+)["\']\s*>[ \t]*</a>[ \t]*')
FACETS = ("problem", "fit", "variation", "manual", "manualExplanation", "standard", "standardExplanation", "engineering")


def _prose_lines(draft: str):
    """Accept the project's standalone anchors, conservatively outside code.

    This is deliberately not a general Markdown renderer: an identity used for
    publication evidence must occupy its own line, indented fewer than 4 spaces.
    Fences and comments are excluded using the original draft's line context.
    """
    draft = re.sub(r"<!--[\s\S]*?(?:-->|\Z)", "", draft)
    fence, fence_length, inline_ticks = None, 0, None
    for number, line in enumerate(draft.splitlines()):
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
        if not in_inline and inline_ticks is None and not line.startswith(("    ", "\t")):
            yield number, line


def _prose_anchors(draft: str) -> list[str]:
    return [matched[1] for _, line in _prose_lines(draft) if (matched := ANCHOR.fullmatch(line))]


def _prose_outline(draft: str) -> dict:
    """Locate real headings adjacent to explicit anchors, not arbitrary ids.

    A source anchor in a code example/comment, or one separated from its heading
    by another paragraph, cannot satisfy a formal-section location.
    """
    pending, headings, locations, anchor_lines = [], [], {}, {}
    for number, line in _prose_lines(draft):
        anchor = ANCHOR.fullmatch(line)
        if anchor:
            pending.append(anchor[1])
            anchor_lines[anchor[1]] = number
            continue
        heading = re.match(r" {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$", line)
        if heading:
            item = {"line": number, "level": len(heading[1]), "title": heading[2], "anchors": list(pending)}
            headings.append(item)
            for identity in pending:
                locations[identity] = item
        if line.strip():
            pending = []
    return {"headings": headings, "locations": locations, "anchorLines": anchor_lines}


def _state(value, label: str, errors: list[str]) -> str | None:
    if not isinstance(value, dict):
        errors.append(label + ": expected a status object")
        return None
    state = value.get("status")
    if state not in {"open", "addressed"}:
        errors.append(label + ": status must be open or addressed")
    elif state == "open":
        _text(value.get("gap"), label + ".gap", errors)
    elif value.get("gap"):
        errors.append(label + ": addressed item cannot conceal a gap")
    return state


def _paradigm_contract(contract, cid, model, documents, permitted, material_ids, errors):
    """Deterministic editorial relationships; no automatic taxonomy judgement."""
    version = contract.get("schemaVersion")
    if version not in {2, 3}:
        return
    if version == 3 and len(permitted) != 1:
        errors.append(cid + ": schemaVersion 3 requires one logical chapter document; compose author fragments internally")
    paradigm = contract.get("paradigm", {})
    state = _state(paradigm, cid + ".paradigm", errors)
    if not isinstance(paradigm, dict):
        paradigm = {}
    for key in ("name", "mechanism", "coverageArgument"):
        _text(paradigm.get(key), cid + ".paradigm." + key, errors)
    evidence = _strings(paradigm.get("corpusEvidence", []), cid + ".paradigm.corpusEvidence", errors)
    if state == "addressed" and not evidence:
        errors.append(cid + ": addressed paradigm needs actual corpus extraction/merging evidence")
    if any(mid not in material_ids for mid in evidence):
        errors.append(cid + ": unknown paradigm corpus material")
    prelude = contract.get("prelude", {})
    prelude_state = _state(prelude, cid + ".prelude", errors)
    if not isinstance(prelude, dict):
        prelude = {}
    prelude_locations = _locations(prelude.get("locations", []), cid + ".prelude.locations", documents, permitted, errors,
                                   required=prelude_state == "addressed")
    reading = contract.get("reading", {})
    if not isinstance(reading, dict):
        reading = {}
    complete = reading.get("status") == "addressed"
    units = _rows(reading.get("units", []), cid + ".reading.units", errors)
    unit_ids = {unit.get("id") for unit in units if isinstance(unit.get("id"), str)}
    outlines = {did: _prose_outline(documents[did].get("draft", "")) for did in permitted if did in documents}
    document_order = {did: i for i, did in enumerate(documents) if did in permitted}
    h2_owners, unit_positions, unit_headings = {}, [], set()

    def major(locations, label):
        result = []
        for location in _rows(locations, label + ".locations", errors):
            did, anchor = location.get("document"), location.get("anchor")
            heading = outlines.get(did, {}).get("locations", {}).get(anchor)
            if not heading or heading["level"] != 2:
                errors.append(label + ": location must identify an actual H2 heading")
            else:
                result.append((document_order[did], heading["line"]))
                h2_owners[(did, heading["line"])] = label
        return result

    prelude_positions = major(prelude_locations, cid + ".prelude")
    if version == 2:
        # Historical schema 2 retains its technical reading semantics. It
        # cannot qualify for current publication through chapter_quality.
        for name in ("entry", "selectionMap"):
            major(reading.get(name, []), cid + ".reading." + name)
    elif prelude_state == "addressed" and len(prelude_positions) != 1:
        errors.append(cid + ": schemaVersion 3 requires one theory prelude H2")
    if complete:
        prelude_keys = {(point.get("document"), point.get("anchor")) for point in prelude_locations}
        if any((point.get("document"), point.get("anchor")) not in prelude_keys
               for point in _rows(reading.get("entry", prelude_locations if version == 3 else []), cid + ".reading.entry", errors)):
            errors.append(cid + ": chapter entry must identify its theory prelude, not unrelated H2s")
    implementations, task_urls = {}, {}
    for task in model.get("tasks", []):
        if not isinstance(task, dict) or task.get("document") not in permitted:
            continue
        if not isinstance(task.get("id"), str):
            continue
        task_urls[task["id"]] = set(_strings(task.get("sourceUrls", []), cid + ".task.sourceUrls", errors))
        for method in _rows(task.get("methods", []), cid + ".task.methods", errors):
            for implementation in _rows(method.get("implementations", []), cid + ".task.implementations", errors):
                if isinstance(implementation.get("id"), str):
                    implementations[implementation["id"]] = (task["id"], implementation)
    preceding = set()
    for unit in units:
        uid, label = unit.get("id"), cid + ".section." + str(unit.get("id"))
        locations = _rows(unit.get("locations", []), label + ".locations", errors)
        positions = major(locations, label)
        if version == 3:
            researched = _strings(unit.get("researchTypeIds", []), label + ".researchTypeIds", errors)
            if not researched:
                errors.append(label + ": nonempty researchTypeIds required for faithful research coverage")
            if complete and len(positions) != 1:
                errors.append(label + ": a formal problem-type section must identify one H2")
        if positions:
            unit_positions.append(min(positions))
            if unit_headings & set(positions):
                errors.append(label + ": formal H2 cannot belong to multiple problem-type sections")
            unit_headings.update(positions)
        depends = _strings(unit.get("dependsOn", []), label + ".dependsOn", errors)
        if any(dependency not in preceding for dependency in depends):
            errors.append(label + ": dependencies must be earlier problem-type sections")
        if isinstance(uid, str):
            preceding.add(uid)
        facets = unit.get("facets", {})
        if not isinstance(facets, dict):
            errors.append(label + ".facets: expected an object")
            facets = {}
        for facet in FACETS:
            actual = _locations(facets.get(facet, []), label + ".facets." + facet, documents, permitted, errors, required=complete)
            for location in actual:
                did, anchor = location.get("document"), location.get("anchor")
                line = outlines.get(did, {}).get("anchorLines", {}).get(anchor)
                starts = [outlines.get(did, {}).get("locations", {}).get(point.get("anchor"))
                          for point in locations if point.get("document") == did]
                valid_span = False
                for start in starts:
                    if not start or line is None:
                        continue
                    following = [heading["line"] for heading in outlines[did]["headings"]
                                 if heading["level"] <= 2 and heading["line"] > start["line"]]
                    end = min(following, default=float("inf"))
                    # Explicit anchors immediately precede their H2, so allow
                    # the section's own primary anchor as its complete location.
                    valid_span |= anchor in start["anchors"] or start["line"] < line < end
                if not valid_span:
                    errors.append(label + ": facet must lie within its own problem-type section: " + facet)
        manual = _strings(unit.get("manualImplementationIds", []), label + ".manualImplementationIds", errors)
        standard = _strings(unit.get("standardImplementationIds", []), label + ".standardImplementationIds", errors)
        role = unit.get("standardRole", {})
        if not isinstance(role, dict):
            role = {}
        if complete and (not manual or not standard):
            errors.append(label + ": both manual and standard-facility implementation paths are required")
        if complete or role:
            if role.get("kind") not in {"algorithm", "structure", "support", "shared-core"}:
                errors.append(label + ": unknown standard-facility role")
            _text(role.get("explanation"), label + ".standardRole.explanation", errors)
        unit_tasks = set(_strings(unit.get("taskIds", []), label + ".taskIds", errors))
        for kind, references in (("manual", manual), ("standard", standard)):
            for iid in references:
                entry = implementations.get(iid)
                if entry is None or entry[0] not in unit_tasks:
                    errors.append(label + ": implementation must belong to this section's actual tasks: " + str(iid))
                elif kind == "manual" and entry[1].get("kind") != "manual":
                    errors.append(label + ": manual path must reference a manual implementation")
                elif kind == "standard" and role.get("kind") in {"algorithm", "structure"} and entry[1].get("kind") != "standard":
                    errors.append(label + ": standard algorithm/structure path must reference a standard implementation")
        exercises = _rows(unit.get("exercises", []), label + ".exercises", errors)
        if complete and not 1 <= len(exercises) <= 5:
            errors.append(label + ": each formal problem-type section needs 1 to 5 exercises")
        available = set().union(*(task_urls.get(tid, set()) for tid in unit_tasks))
        seen_urls = set()
        section_prose = []
        for point in locations:
            did = point.get("document")
            outline = outlines.get(did, {})
            start = outline.get("locations", {}).get(point.get("anchor"))
            if start:
                end = min((heading["line"] for heading in outline["headings"]
                           if heading["level"] <= 2 and heading["line"] > start["line"]), default=float("inf"))
                section_prose.extend(line for number, line in _prose_lines(documents[did].get("draft", ""))
                                     if start["line"] <= number < end)
        visible_prose = "\n".join(section_prose)
        for exercise in exercises:
            _text(exercise.get("title"), label + ".exercise.title", errors)
            url = exercise.get("url")
            try:
                parsed = urlsplit(url)
                valid_url = parsed.scheme in {"http", "https"} and bool(parsed.netloc) and not parsed.username and not parsed.password
            except (ValueError, TypeError, AttributeError):
                valid_url = False
            if not valid_url or url not in available:
                errors.append(label + ": exercise URL must come from this section's actual task sourceUrls")
            if isinstance(url, str):
                if not re.search(r"\]\(\s*<?" + re.escape(url) + r">?(?:\s+[\"'][^\n]*?[\"'])?\s*\)", visible_prose):
                    errors.append(label + ": exercise needs an actual visible link in this problem-type section")
                if url in seen_urls:
                    errors.append(label + ": duplicate exercise URL")
                seen_urls.add(url)
    if unit_positions != sorted(unit_positions) or len(set(unit_positions)) != len(unit_positions):
        errors.append(cid + ": problem-type sections must follow distinct author prose order")
    if prelude_positions and unit_positions and max(prelude_positions) >= min(unit_positions):
        errors.append(cid + ": the theory prelude must precede all formal problem-type sections")
    if version == 2 and complete and unit_positions:
        for point in _rows(reading.get("selectionMap", []), cid + ".reading.selectionMap", errors):
            did, anchor = point.get("document"), point.get("anchor")
            heading = outlines.get(did, {}).get("locations", {}).get(anchor)
            if heading:
                position = (document_order[did], heading["line"])
                if position not in unit_headings and position < max(unit_positions):
                    errors.append(cid + ": final selection map cannot disguise earlier non-type H2s")
    if complete:
        for did, outline in outlines.items():
            for heading in outline["headings"]:
                if heading["level"] == 2 and (did, heading["line"]) not in h2_owners:
                    errors.append(cid + ": unassigned H2 competes with problem-type navigation: " + heading["title"])
    branch_ids = set()
    branches = _rows(paradigm.get("branches", []), cid + ".paradigm.branches", errors)
    if state == "addressed" and not branches:
        errors.append(cid + ": addressed paradigm must have actual coverage branches")
    covered_units = set()
    for branch in branches:
        label = cid + ".branch." + str(branch.get("id"))
        _identity(branch.get("id"), branch_ids, label, errors)
        _text(branch.get("title"), label + ".title", errors)
        branch_state = _state(branch, label, errors)
        mids = _strings(branch.get("materialIds", []), label + ".materialIds", errors)
        if any(mid not in material_ids for mid in mids):
            errors.append(label + ": unknown material reference")
        sections = _strings(branch.get("sectionIds", []), label + ".sectionIds", errors)
        if any(section not in unit_ids for section in sections):
            errors.append(label + ": unknown problem-type section")
        if branch_state == "addressed" and (not mids or not sections):
            errors.append(label + ": addressed branch needs material and actual section coverage")
        covered_units.update(sections)
        _strings(branch.get("crossParadigms", []), label + ".crossParadigms", errors)
    if state == "addressed" and unit_ids - covered_units:
        errors.append(cid + ": every formal section must belong to the paradigm coverage map")


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


def _adoption_proof(root: Path, chapter_id: str, handoff_path: str, handoff_sha: str) -> dict | None:
    """Find the first verified publication of this exact handoff.

    A local deployment receipt is an operational fact, not a signature or a
    semantic quality certificate. Its prepared packet and exact bytes must
    agree. Merely adding `adopted: true` to an author contract has no effect.
    No current course snapshot is read here: that would make provenance depend
    circularly on the adoption decision it is meant to substantiate.
    """
    try:
        origin = read_json(_file(root, "wrangler.jsonc"))["vars"]["APP_ORIGIN"]
    except (ValueError, OSError, KeyError, TypeError):
        return None
    matches = []
    for filename in sorted((root / "work/jobs").glob("*/deployments/*.json")):
        try:
            receipt_path = filename.relative_to(root).as_posix()
            receipt = read_json(_file(root, receipt_path))
            if (receipt.get("schemaVersion") != 1 or receipt.get("passed") is not True
                    or receipt.get("anonymousBoundaryVerified") is not True or receipt.get("origin") != origin
                    or not isinstance(receipt.get("build"), str) or not receipt["build"].strip()):
                continue
            deployed_at = datetime.fromisoformat(receipt["deployedAt"])
            if deployed_at.tzinfo is None:
                continue
            packet_path = receipt.get("packet")
            packet_file = _file(root, packet_path)
            relative = packet_file.relative_to(root)
            if (len(relative.parts) != 5 or relative.parts[:2] != ("work", "jobs")
                    or relative.parts[2] != filename.parents[1].name or relative.parts[3] != "releases"
                    or relative.suffix != ".json"):
                continue
            packet_bytes = packet_file.read_bytes()
            if receipt.get("packetSha256") != digest(packet_bytes):
                continue
            packet = read_json(packet_file)
            if (packet.get("schemaVersion") != 1 or packet.get("state") != "prepared" or packet.get("passed") is not True
                    or packet.get("operation") != "content-release" or packet.get("job") != relative.parts[2]
                    or packet.get("id") != packet_file.stem or not isinstance(packet.get("inputs"), dict)
                    or packet.get("inputHash") != digest(canonical_bytes(packet["inputs"]))
                    or receipt.get("inputHash") != packet.get("inputHash")):
                continue
            handoffs = packet.get("researchHandoffs")
            if not isinstance(handoffs, list) or receipt.get("researchHandoffs") != handoffs:
                continue
            if any(not isinstance(row, dict) for row in handoffs) or len({row.get("chapter") for row in handoffs}) != len(handoffs):
                continue
            if not any(row.get("chapter") == chapter_id and row.get("path") == handoff_path
                       and row.get("sha256") == handoff_sha and row.get("current") is True for row in handoffs):
                continue
            paths = [receipt_path, packet_path, "wrangler.jsonc"]
            matches.append((deployed_at, receipt_path, {"deployment": receipt_path, "packet": packet_path,
                "inputs": [{"path": name, "sha256": digest(_file(root, name).read_bytes())} for name in paths]}))
        except (ValueError, OSError, TypeError, KeyError, AttributeError):
            continue
    # A subsequent publication must not replace the original adoption proof;
    # otherwise each deployment would invalidate its own prepared input hash.
    return min(matches, key=lambda row: (row[0], row[1]))[2] if matches else None


def _research_binding(root: Path, chapter_id: str, contract: dict) -> dict:
    """Check the actual pre-author handoff, not a caller's accepted note.

    Kept outside structural validity: a working chapter can be inspected before
    research is ready, while quality/release preparation must reject the gap.
    """
    from .inquiry import check_handoff
    path = contract.get("researchHandoff")
    if not isinstance(path, str) or not path:
        return {"ok": False, "errors": ["research handoff is required before chapter adoption"], "inputs": []}
    try:
        _file(root, path)  # canonical repository identity, never a host-specific path
        result = check_handoff(root, path, chapter=chapter_id)
        if not result.get("ok"):
            proof = _adoption_proof(root, chapter_id, path, digest(_file(root, path).read_bytes()))
            if proof:
                adopted_result = check_handoff(root, path, chapter=chapter_id, adopted=True)
                if adopted_result.get("ok"):
                    result = {**adopted_result, "adoptionProof": {key: value for key, value in proof.items() if key != "inputs"},
                              "inputs": adopted_result["inputs"] + proof["inputs"]}
    except (ValueError, OSError, TypeError, KeyError) as error:
        return {"ok": False, "errors": ["invalid research handoff: " + str(error)], "inputs": []}
    errors = list(result.get("errors", []))
    if result.get("ok"):
        scope, dossier = result.get("scope", {}), result.get("dossier", {})
        paradigm = contract.get("paradigm", {})
        if not isinstance(paradigm, dict):
            paradigm = {}
        if scope.get("paradigm") != paradigm.get("name"):
            errors.append("chapter paradigm differs from the adopted research scope")
        included = {row["id"]: row for row in scope.get("branches", []) if row.get("status") == "included"}
        actual = {row["id"]: row for row in _rows(paradigm.get("branches", []), "paradigm.branches", errors)
                  if isinstance(row.get("id"), str)}
        if set(included) != set(actual):
            errors.append("chapter branches must exactly carry the final included research branches")
        research_materials = {row["id"]: row for row in dossier.get("materials", [])}
        author_materials = {row["id"]: row for row in _rows(contract.get("materials", []), "materials", errors)
                            if isinstance(row.get("id"), str)}
        for bid in included.keys() & actual.keys():
            needed = set(included[bid].get("materialIds", []))
            if not needed.issubset(set(_strings(actual[bid].get("materialIds", []), "branch." + bid + ".materialIds", errors))):
                errors.append("chapter branch drops research material evidence: " + bid)
            for mid in needed:
                source, adopted = research_materials.get(mid, {}), author_materials.get(mid, {})
                if not source or adopted.get("evidence") != source.get("note"):
                    errors.append("chapter material must preserve its researched evidence note: " + mid)
        planned_types = {row["id"]: row for row in scope.get("problemTypes", [])}
        reading = contract.get("reading", {})
        if not isinstance(reading, dict):
            reading = {}
        author_types = {row["id"]: row for row in _rows(reading.get("units", []), "reading.units", errors)
                        if isinstance(row.get("id"), str)}
        # Research objects describe the preserved scope. Editorial sections
        # describe how a reader learns it; these identities need not coincide.
        # All material notes remain the immutable research authority.
        for mid, adopted in author_materials.items():
            if mid in research_materials and adopted.get("evidence") != research_materials[mid].get("note"):
                errors.append("chapter material must preserve its researched evidence note: " + mid)
        mapped_types = set()
        if contract.get("schemaVersion") != 3 and set(planned_types) != set(author_types):
            errors.append("formal problem-type sections must carry the research handoff type plan")
        for uid, authored in author_types.items():
            if contract.get("schemaVersion") == 3:
                references = _strings(authored.get("researchTypeIds", []), "section." + uid + ".researchTypeIds", errors)
                if not references:
                    errors.append("formal section requires nonempty researchTypeIds: " + uid)
                for identity in references:
                    if identity not in planned_types:
                        errors.append("formal section references an unresearched problem type: " + uid + "/" + identity)
            else:
                references = [uid] if uid in planned_types else []
            mapped_types.update(references)
            planned = [planned_types[identity] for identity in references if identity in planned_types]
            needed_materials = {mid for item in planned for mid in item.get("materialIds", [])}
            for mid in needed_materials:
                source, adopted = research_materials.get(mid, {}), author_materials.get(mid, {})
                if not source or adopted.get("evidence") != source.get("note"):
                    errors.append("formal type drops its researched material evidence: " + uid + "/" + mid)
            expected_branches = {bid for item in planned for bid in item.get("branchIds", [])}
            actual_branches = {bid for bid, row in actual.items()
                               if uid in _strings(row.get("sectionIds", []), "branch." + bid + ".sectionIds", errors)}
            if expected_branches != actual_branches:
                errors.append("formal section branch mapping differs from research: " + uid)
            urls = {row.get("url") for row in _rows(authored.get("exercises", []), "section." + uid + ".exercises", errors)
                    if isinstance(row.get("url"), str)}
            available_urls = {url for item in planned for url in item.get("exerciseUrls", [])}
            if not urls.issubset(available_urls):
                errors.append("formal exercises were not obtained by the research type plan: " + uid)
        if contract.get("schemaVersion") == 3 and set(planned_types) - mapped_types:
            errors.append("formal problem-type sections must cover the complete research handoff type plan: "
                          + ", ".join(sorted(set(planned_types) - mapped_types)))
    return {**result, "ok": bool(result.get("ok") and not errors), "errors": errors}


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
    # The surveyed corpus is part of the editorial input. Adding a textbook or
    # source can reopen the domain investigation instead of silently retaining
    # an old claim about the known material base.
    for name in ("catalog/books.json", "catalog/sources.json"):
        if (root / name).is_file():
            dependencies.add(name)
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
            if not isinstance(contract, dict) or contract.get("schemaVersion") not in {1, 2, 3} or contract.get("chapter") != cid:
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
        prelude = contract.get("prelude", {})
        derived_entry = prelude.get("locations", []) if contract.get("schemaVersion") == 3 and isinstance(prelude, dict) else []
        _locations(reading.get("entry", derived_entry), cid + ".reading.entry", documents, permitted, errors, required=reading_state == "addressed")
        if contract.get("schemaVersion") == 3:
            if reading.get("selectionMap"):
                errors.append(cid + ": selectionMap conflicts with the user structure; only prelude and formal sections may own H2s")
            elif reading.get("selectionMap") is not None and not isinstance(reading["selectionMap"], list):
                errors.append(cid + ".reading.selectionMap: expected an empty array or absence")
        else:
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
        _paradigm_contract(contract, cid, model, documents, permitted, material_ids, errors)
        # Include the full durable provenance closure in editorial/release
        # snapshots, even when an existing handoff is stale. Missing research is
        # an adoption gap; it does not stop examining unfinished author files.
        research = _research_binding(root, cid, contract)
        for item in research.get("inputs", []):
            name = item.get("path") if isinstance(item, dict) else None
            try:
                if name and (root / name).is_file():
                    dependencies.add(_file(root, name).relative_to(root).as_posix())
            except (ValueError, OSError, TypeError):
                pass
        handoff_path = contract.get("researchHandoff")
        if isinstance(handoff_path, str):
            try:
                if (root / handoff_path).is_file():
                    dependencies.add(_file(root, handoff_path).relative_to(root).as_posix())
            except (ValueError, OSError, TypeError):
                pass
        chapters.append({"id": cid, "collection": collection, "contractPath": contract_path,
                         "reviewPath": review_path, "contract": contract, "documents": permitted,
                         "promises": commitments, "research": research})
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
        research = chapter["research"]
        if not research["ok"]:
            errors.extend("research handoff: " + message for message in research["errors"])
        if contract.get("schemaVersion") != 3:
            errors.append("legacy chapter contract: not adopted under the editorial hard protocol (schemaVersion 3 required)")
        else:
            if context["model"].get("schemaVersion") != 2:
                errors.append("transparent knowledge registry requires learning schemaVersion 2; legacy visible-Q main explanations cannot qualify")
            for name in ("paradigm", "prelude"):
                item = contract[name]
                if item["status"] != "addressed":
                    errors.append(name + " is open — " + item["gap"])
            for branch in contract["paradigm"]["branches"]:
                if branch["status"] != "addressed":
                    errors.append("paradigm branch is open — " + branch["id"] + ": " + branch["gap"])
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
            if contract.get("schemaVersion") == 3:
                boundary = review.get("readerBoundary")
                if not isinstance(boundary, dict):
                    errors.append("reader boundary review is required for schemaVersion 3")
                else:
                    outcome = boundary.get("outcome")
                    if not isinstance(outcome, str) or outcome not in {"pass", "gap"}:
                        errors.append("reader boundary outcome must be pass or gap")
                    elif outcome == "gap":
                        errors.append("reader boundary review records an unresolved gap")
                    _text(boundary.get("findings"), cid + ".readerBoundary.findings", errors)
                    _locations(boundary.get("locations"), cid + ".readerBoundary.locations", context["documents"],
                               chapter["documents"], errors, required=outcome == "pass")
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
                        "researchHandoff": {"path": contract.get("researchHandoff"),
                                            "sha256": research.get("sha256"), "current": research["ok"],
                                            "adopted": bool(research.get("adopted")),
                                            "adoptionProof": research.get("adoptionProof")},
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
        if contract.get("schemaVersion") not in {2, 3}:
            lines.append("新硬协议：旧问题专题合同，尚未完成大思想领域/正式题型结构采用；阻止重新发布。")
        else:
            if contract.get("schemaVersion") == 2:
                lines.append("新硬协议：旧schema2合同仅供历史技术读入，尚未完成研究对象到编纂节的schema3采用；阻止重新发布。")
            paradigm = contract["paradigm"]
            lines.append("算法思想领域：" + paradigm["name"] + " [" + paradigm["status"] + "]")
            lines.append("共同机制：" + paradigm["mechanism"])
            lines.append("领域覆盖依据：" + paradigm["coverageArgument"])
            if paradigm.get("gap"):
                lines.append("  领域缺口：" + paradigm["gap"])
            for branch in paradigm["branches"]:
                lines.append("  分支：" + branch["title"] + " [" + branch["status"] + "]；题型节：" + ", ".join(branch.get("sectionIds", [])))
                if branch.get("gap"):
                    lines.append("    缺口：" + branch["gap"])
            lines.append("思想前置节 [" + contract["prelude"]["status"] + "]")
            if contract["prelude"].get("gap"):
                lines.append("  缺口：" + contract["prelude"]["gap"])
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
        for location in reading.get("entry", contract.get("prelude", {}).get("locations", []) if contract.get("schemaVersion") == 3 else []):
            lines.append("  入口：" + location["document"] + "#" + location["anchor"])
        for unit in reading.get("units", []):
            lines.append(("  正式题型节：" if contract.get("schemaVersion") in {2, 3} else "  问题簇：")
                         + unit["title"] + " [" + unit["id"] + "]；任务：" + ", ".join(unit.get("taskIds", [])))
            if contract.get("schemaVersion") == 3:
                lines.append("    承接研究对象：" + ", ".join(unit.get("researchTypeIds", [])))
            for location in unit.get("locations", []):
                lines.append("    正文：" + location["document"] + "#" + location["anchor"])
        for location in reading.get("selectionMap", []):
            lines.append("  方法选择地图：" + location["document"] + "#" + location["anchor"])
        for exclusion in contract["scope"]["exclusions"]:
            lines.append("排除：" + exclusion["topic"] + "；" + exclusion["reason"] + "；去向：" + str(exclusion.get("destination") or "未承诺后续章"))
    if not selected:
        lines.append("显式撤回：当前无正式章节。")
    return "\n".join(lines)
