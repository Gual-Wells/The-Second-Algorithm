"""Fix managed-heading inputs for Python validation and release receipts.

The Node composer owns Markdown parsing and rendering.  This companion binds
the real decision/snapshot files and independently checks the exact registry
entries the author adopted, rather than hashing the entire growing registry.
"""
from __future__ import annotations

import re
from pathlib import Path

from .storage import canonical_bytes, digest, read_json, safe_relative

IDENTITY = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
SHA = re.compile(r"[0-9a-f]{64}\Z")


def _file(root: Path, name: str, directory: str, suffix: str) -> Path:
    if (not isinstance(name, str) or not name.startswith(directory + "/")
            or not name.endswith(suffix) or "\\" in name
            or any(not p or p in {".", ".."} or re.search(r'[<>:"|?*\x00-\x1f]', p)
                   or p.endswith((".", " ")) for p in name.split("/"))):
        raise ValueError("Invalid subheading input path: " + str(name))
    filename = safe_relative(root, name)
    if not filename.is_file() or not filename.is_relative_to((root / directory).resolve()):
        raise ValueError("Missing/outside subheading input: " + name)
    return filename


def subheading_inputs(root: Path, document: dict, composition: dict) -> dict[str, str]:
    relative = composition.get("subheadings")
    if relative is None:
        # Historical technical fixtures without subheadings remain readable,
        # but removing the plan must not bypass current author headings. Keep
        # this import local: chapters imports learning during validation.
        from .chapters import _prose_outline
        sources = composition.get("sourceFiles", [])
        if not isinstance(sources, list):
            raise ValueError("Invalid composition sourceFiles for subheading inspection")
        for source in sources:
            author = _file(root, source, "content", ".source.md")
            outline = _prose_outline(author.read_text(encoding="utf-8-sig"))
            if any(heading["level"] >= 3 for heading in outline["headings"]):
                raise ValueError("Author subheadings require a coordinated plan: " + source)
        return {}
    filename = _file(root, relative, "content", ".subheadings.json")
    plan = read_json(filename)
    if (not isinstance(plan, dict) or plan.get("schemaVersion") != 1
            or plan.get("document") != document.get("id")
            or not isinstance(plan.get("decisions"), list)
            or not isinstance(plan.get("registryEntries"), dict)
            or not isinstance(plan.get("candidateSnapshot"), dict)):
        raise ValueError("Invalid chapter subheading coordination")
    candidate = plan["candidateSnapshot"]
    candidate_path = candidate.get("path")
    candidate_file = _file(root, candidate_path, "work", ".json")
    if (not isinstance(candidate.get("sha256"), str) or not SHA.fullmatch(candidate["sha256"])
            or digest(candidate_file.read_bytes()) != candidate["sha256"]):
        raise ValueError("Subheading candidate snapshot changed")

    registry_file = _file(root, "catalog/subheadings.json", "catalog", ".json")
    registry = read_json(registry_file)
    if not isinstance(registry, dict) or registry.get("schemaVersion") != 1 or not isinstance(registry.get("entries"), list):
        raise ValueError("Invalid subheading management registry")
    entries, prefixes = {}, set()
    for entry in registry["entries"]:
        if (not isinstance(entry, dict) or not isinstance(entry.get("id"), str)
                or not IDENTITY.fullmatch(entry["id"]) or entry["id"] in entries
                or not isinstance(entry.get("prefix"), str) or not entry["prefix"].strip()
                or entry["prefix"] in prefixes):
            raise ValueError("Duplicate/invalid subheading registry identity or prefix")
        entries[entry["id"]] = entry
        prefixes.add(entry["prefix"])
    for identity, prefix in (("hcode", "Hcode"), ("scode", "Scode")):
        if entries.get(identity, {}).get("prefix") != prefix:
            raise ValueError("Hcode and Scode prefixes are fixed")

    used, seen = set(), set()
    for decision in plan["decisions"]:
        if (not isinstance(decision, dict) or not isinstance(decision.get("id"), str)
                or decision["id"] in seen or decision.get("typeId") not in entries
                or decision.get("depth") not in entries[decision["typeId"]].get("levels", [])
                or decision.get("action") not in {"reuse", "new"}
                or not isinstance(decision.get("reason"), str) or not decision["reason"].strip()
                or not isinstance(decision.get("subject"), str) or not decision["subject"].strip()):
            raise ValueError("Invalid subheading decision")
        seen.add(decision["id"])
        used.add(decision["typeId"])
    if set(plan["registryEntries"]) != used:
        raise ValueError("Subheading registry pin must contain exactly the used types")
    for identity in sorted(used):
        if digest(canonical_bytes(entries[identity])) != plan["registryEntries"][identity]:
            raise ValueError("Used subheading registry entry changed: " + identity)
    names = [relative, candidate_path, "tools/subheadings.mjs"]
    result = {}
    for name in names:
        current = _file(root, name, name.split("/", 1)[0], ".mjs" if name.endswith(".mjs") else ".json")
        result[name] = digest(current.read_bytes())
    return result
