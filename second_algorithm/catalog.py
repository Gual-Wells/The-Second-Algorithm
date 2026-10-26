from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from .collect import ADAPTERS, capture_configuration
from .storage import canonical_bytes, digest, read_json, read_jsonl, safe_relative, sources, valid_id, valid_url


def validate(root: Path) -> dict:
    errors, warnings = [], []
    registry = read_json(root / "catalog/sources.json", {})
    if registry.get("schema_version") != 1:
        errors.append("sources: expected schema_version 1")
    source_ids, entry_keys, entry_records = set(), set(), {}
    source_rows = registry.get("sources", [])
    for source in source_rows:
        label = source.get("id", "<missing>")
        if not valid_id(label) or label in source_ids:
            errors.append("source identity invalid or duplicated: " + label)
        source_ids.add(label)
        for field in ("name", "priority", "roles", "languages", "aliases", "lineage", "admission", "verification", "entries"):
            if field not in source:
                errors.append(label + ": missing " + field)
        if not valid_url(source.get("homepage")):
            errors.append(label + ": invalid homepage")
        if source.get("priority") not in ("core", "extension"):
            errors.append(label + ": unknown priority")
        if source.get("admission", {}).get("state") not in ("adopted", "candidate", "paused"):
            errors.append(label + ": unknown admission state")
        verification = source.get("verification", {})
        for field in ("checked_at", "method", "read_scope", "catalogue_state", "statement_scope", "limitations", "evidence_urls"):
            if field not in verification:
                errors.append(label + ": missing verification." + field)
        for url in verification.get("evidence_urls", []):
            if not valid_url(url):
                errors.append(label + ": invalid evidence URL")
        for entry in source.get("entries", []):
            key = label + "/" + entry.get("id", "")
            if not valid_id(entry.get("id")) or key in entry_keys:
                errors.append("entry identity invalid or duplicated: " + key)
            entry_keys.add(key)
            entry_records[key] = entry
            if not valid_url(entry.get("url")):
                errors.append(key + ": invalid URL")
            enumeration = entry.get("enumeration", {})
            if enumeration.get("state") == "implemented":
                if enumeration.get("adapter") not in ADAPTERS:
                    errors.append(key + ": unimplemented adapter claimed")
                if enumeration.get("adapter") == "link_index" and not enumeration.get("include_url_regex"):
                    errors.append(key + ": link_index needs an explicit URL filter")
    for source in source_rows:
        for upstream in source.get("lineage", {}).get("upstream", []):
            if upstream not in source_ids and not valid_url(upstream):
                errors.append(source["id"] + ": unknown upstream " + str(upstream))

    books = read_json(root / "catalog/books.json", {"books": []})
    seen_books = set()
    for book in books.get("books", []):
        if book.get("id") in seen_books or not valid_id(book.get("id")):
            errors.append("book identity invalid or duplicated")
        seen_books.add(book.get("id"))
        if book.get("acquisition_state") not in ("not_provided", "provided_local", "public_author_copy"):
            errors.append(book["id"] + ": unknown acquisition state")
        if not book.get("official_urls") or not all(valid_url(x) for x in book["official_urls"]):
            errors.append(book["id"] + ": official source required")

    patterns = read_jsonl(root / "catalog/patterns.jsonl")
    pattern_ids = set()
    for pattern in patterns:
        pid = pattern.get("id", "")
        if not valid_id(pid) or pid in pattern_ids:
            errors.append("pattern identity invalid or duplicated: " + pid)
        pattern_ids.add(pid)
        location = pattern.get("canonical")
        if location:
            try:
                html = safe_relative(root, location["document"])
                code = safe_relative(root, location["code"])
                if not html.exists() or not code.exists():
                    errors.append(pid + ": canonical document/code missing")
                else:
                    if 'id="' + location["anchor"] + '"' not in html.read_text(encoding="utf-8"):
                        errors.append(pid + ": canonical anchor missing")
                    for symbol in location.get("symbols", []):
                        if not re.search(r"\b" + re.escape(symbol) + r"\s*\(", code.read_text(encoding="utf-8")):
                            errors.append(pid + ": code symbol missing: " + symbol)
            except (KeyError, ValueError) as error:
                errors.append(pid + ": " + str(error))
        if pattern.get("state") == "reviewed" and (not location or pattern.get("open_variants")):
            errors.append(pid + ": reviewed pattern has missing content or open variants")
        if pattern.get("state") == "reviewed" and not pattern.get("review_note"):
            errors.append(pid + ": reviewed pattern requires an actual semantic review note")

    cases = read_jsonl(root / "catalog/cases.jsonl")
    case_ids = set()
    for case in cases:
        cid = case.get("id", "")
        if not valid_id(cid) or cid in case_ids:
            errors.append("case identity invalid or duplicated: " + cid)
        case_ids.add(cid)
        if case.get("source_id") not in source_ids:
            errors.append(cid + ": unknown source")
        if not valid_url(case.get("url")):
            errors.append(cid + ": invalid URL")
        if any(pid not in pattern_ids for pid in case.get("pattern_ids", [])):
            errors.append(cid + ": dangling pattern reference")
        if case.get("disposition") not in ("mapped-existing", "variant-needed", "gap-confirmed", "excluded", "pending"):
            errors.append(cid + ": unknown disposition")
        if not isinstance(case.get("statement_read"), bool):
            errors.append(cid + ": statement_read must be boolean")
        if case.get("statement_read") and not case.get("reading_note"):
            errors.append(cid + ": statement_read requires a reading note")
        if case.get("disposition") in ("mapped-existing", "variant-needed", "gap-confirmed"):
            if case.get("statement_read") is not True or not case.get("reading_note"):
                errors.append(cid + ": content disposition requires actual statement reading")
            if not case.get("pattern_ids"):
                errors.append(cid + ": content disposition requires a pattern mapping")
        if case.get("disposition") == "excluded" and not case.get("reason"):
            errors.append(cid + ": exclusion requires a reason or group-rule reference")
        if case.get("reading_note"):
            note_path = case["reading_note"].split("#", 1)[0]
            if not valid_url(note_path) and not safe_relative(root, note_path).exists():
                errors.append(cid + ": reading note does not exist")

    heads = read_json(root / "catalog/inventory-heads.json", {"heads": {}})["heads"]
    for key, relative in heads.items():
        if key not in entry_keys:
            errors.append("inventory head has unknown source/entry: " + key)
        try:
            snapshot = read_json(safe_relative(root, relative))
            if snapshot is None:
                errors.append(key + ": missing inventory")
                continue
            if snapshot.get("schema_version") != 1:
                errors.append(key + ": unsupported snapshot schema")
            if key != snapshot.get("source_id", "") + "/" + snapshot.get("entry_id", ""):
                errors.append(key + ": snapshot belongs to another source/entry")
            if digest(canonical_bytes(snapshot.get("entry_configuration"))) != snapshot.get("entry_configuration_sha256"):
                errors.append(key + ": snapshot configuration digest mismatch")
            if key in entry_records and snapshot.get("entry_configuration_sha256") != digest(canonical_bytes(capture_configuration(entry_records[key]))):
                errors.append(key + ": entry URL/filter changed; this inventory needs explicit refresh")
            if snapshot.get("state") != "captured":
                errors.append(key + ": head points to an unaccepted capture")
            record_ids = [x["id"] for x in snapshot["records"]]
            if len(record_ids) != len(set(record_ids)):
                errors.append(key + ": duplicate inventory identities")
            for record in snapshot["records"]:
                if not valid_id(record.get("id")) or not valid_url(record.get("url")) or not record.get("title") or record.get("kind") not in ("problem", "topic", "reference_link"):
                    errors.append(key + ": invalid inventory record: " + str(record.get("id")))
            if digest(canonical_bytes(snapshot["records"])) != snapshot["records_sha256"]:
                errors.append(key + ": inventory content digest mismatch")
            if not re.fullmatch(r"[0-9a-f]{64}", snapshot.get("input_sha256", "")):
                errors.append(key + ": invalid input digest")
            else:
                raw_cache = root / ".local/materials" / snapshot["input_sha256"] / "source.html"
                if raw_cache.exists() and digest(raw_cache.read_bytes()) != snapshot["input_sha256"]:
                    errors.append(key + ": local raw cache digest mismatch")
            if not snapshot.get("boundary") or snapshot.get("pagination_next"):
                errors.append(key + ": capture boundary is missing or pagination is pending")
        except (KeyError, ValueError, TypeError) as error:
            errors.append(key + ": " + str(error))
    if not heads:
        warnings.append("No adopted catalogue inventories yet")
    if any(p.get("state") != "reviewed" for p in patterns):
        warnings.append("Patterns contain draft/gap work; structural validation is not completeness certification")
    return {"ok": not errors, "errors": errors, "warnings": warnings, "counts": {"sources": len(source_rows), "entries": len(entry_keys), "books": len(seen_books), "patterns": len(patterns), "cases": len(cases), "inventory_heads": len(heads)}}


def report(root: Path) -> dict:
    checked = validate(root)
    if not checked["ok"]:
        raise ValueError("Invalid catalogue; report withheld: " + "; ".join(checked["errors"][:5]))
    source_rows = sources(root)
    cases = read_jsonl(root / "catalog/cases.jsonl")
    by_case = {c["id"]: c for c in cases}
    patterns = read_jsonl(root / "catalog/patterns.jsonl")
    inventories = []
    for key, relative in read_json(root / "catalog/inventory-heads.json", {"heads": {}})["heads"].items():
        snapshot = read_json(safe_relative(root, relative))
        records = snapshot["records"]
        problem_ids = {r["id"] for r in records if r["kind"] == "problem"}
        inventories.append({"entry": key, "snapshot": relative, "boundary": snapshot["boundary"], "record_count": len(records), "problem_records": len(problem_ids), "original_statements_recorded_read": sum(bool(by_case.get(cid, {}).get("statement_read")) for cid in problem_ids), "problem_records_without_disposition": sum(cid not in by_case or by_case[cid]["disposition"] == "pending" for cid in problem_ids), "semantics": "metadata capture does not imply statement reading or topical completeness"})
    gaps = [{"id": p["id"], "name": p["name"], "state": p["state"], "open_variants": p.get("open_variants", [])} for p in patterns if not p.get("canonical") or p.get("open_variants") or p.get("state") != "reviewed"]
    return {"source_priority": dict(Counter(s["priority"] for s in source_rows)), "source_admission": dict(Counter(s["admission"]["state"] for s in source_rows)), "inventories": inventories, "case_dispositions": dict(Counter(c["disposition"] for c in cases)), "open_pattern_work": gaps, "scope_state": read_json(root / "catalog/scope.json", {}).get("state", "unresolved"), "completeness_certified": False, "completion_note": "No script certifies global or semantic completeness. See the protocol and unresolved work."}


def search(root: Path, query: str, kind: str = "all") -> list[dict]:
    words = [word.casefold() for word in query.split() if word]
    if not words:
        return []
    topic_rows = read_json(root / "catalog/query-plans.json", {"topics": []})["topics"]
    recognized_topics = [topic for topic in topic_rows if query.casefold().strip() in {str(alias).casefold() for alias in [topic["id"], topic["name"], *topic.get("aliases", [])]}]
    recognized_ids = {topic["id"] for topic in recognized_topics}
    expanded_terms = [str(alias).casefold() for topic in recognized_topics for alias in topic.get("aliases", [])]
    pattern_rows = read_jsonl(root / "catalog/patterns.jsonl")
    pattern_topics = {pattern["id"]: pattern.get("topic_ids", []) for pattern in pattern_rows}
    case_rows = read_jsonl(root / "catalog/cases.jsonl")
    for case in case_rows:
        case["topic_ids"] = sorted(set(case.get("topic_ids", [])) | {topic for pid in case.get("pattern_ids", []) for topic in pattern_topics.get(pid, [])})
    by_case = {c["id"]: c for c in case_rows}
    inventory_rows = {}
    for key, relative in read_json(root / "catalog/inventory-heads.json", {"heads": {}})["heads"].items():
        snapshot = read_json(safe_relative(root, relative))
        for item in snapshot["records"]:
            row = inventory_rows.setdefault(item["id"], {"id": item["id"], "title": by_case.get(item["id"], {}).get("title", item["title"]), "url": item["url"], "record_kind": item["kind"], "titles": [], "observed_in": [], "statement_read": bool(by_case.get(item["id"], {}).get("statement_read")), "disposition": by_case.get(item["id"], {}).get("disposition", "unclassified")})
            if item["title"] not in row["titles"]:
                row["titles"].append(item["title"])
            row["observed_in"].append({"entry": key, "section": item["section"]})
    groups = {"source": sources(root), "case": case_rows, "pattern": pattern_rows, "book": read_json(root / "catalog/books.json", {"books": []})["books"], "inventory": list(inventory_rows.values())}
    groups = groups if kind == "all" else {kind: groups[kind]}
    found = []
    for item_kind, rows in groups.items():
        for row in rows:
            text = canonical_bytes(row).decode().casefold()
            topic_match = bool(recognized_ids & set(row.get("topic_ids", [])))
            if all(word in text for word in words) or topic_match or any(term in text for term in expanded_terms):
                found.append({"kind": item_kind, "id": row["id"], "name": row.get("name", row.get("title")), "record": row})
    return found
