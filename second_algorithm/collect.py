from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from uuid import uuid4

from .storage import canonical_bytes, collection_lock, digest, now, read_json, safe_relative, source_entry, store_bytes, valid_id, valid_url, write_json

PARSER_VERSION = 4
ADAPTERS = ("cses_html", "codility_html", "cpbook_table", "link_index")


def capture_configuration(entry: dict) -> dict:
    value = {"url": entry["url"], "adapter": entry["enumeration"]["adapter"], "include_url_regex": entry["enumeration"].get("include_url_regex")}
    if "pagination_mode" in entry["enumeration"]:
        value["pagination_mode"] = entry["enumeration"]["pagination_mode"]
    return value


class PageLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[dict] = []
        self.headings: dict[int, str] = {}
        self.active_heading: int | None = None
        self.heading_text: list[str] = []
        self.current: dict | None = None
        self.label: list[str] = []
        self.in_title = False
        self.title: list[str] = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if re.fullmatch(r"h[1-6]", tag):
            self.active_heading = int(tag[1])
            self.heading_text = []
        if tag == "title":
            self.in_title = True
        if tag == "a":
            self.current = {"href": attributes.get("href", ""), "rel": attributes.get("rel", ""), "section": " / ".join(self.headings.values())}
            self.label = []

    def handle_data(self, value):
        if self.active_heading is not None:
            self.heading_text.append(value)
        if self.in_title:
            self.title.append(value)
        if self.current is not None:
            self.label.append(value)

    def handle_endtag(self, tag):
        if re.fullmatch(r"h[1-6]", tag) and self.active_heading is not None:
            level = self.active_heading
            self.headings = {k: v for k, v in self.headings.items() if k < level}
            self.headings[level] = " ".join("".join(self.heading_text).split())
            self.active_heading = None
        if tag == "title":
            self.in_title = False
        if tag == "a" and self.current is not None:
            self.current["title"] = " ".join("".join(self.label).split())
            self.links.append(self.current)
            self.current = None


class CPBookRows(HTMLParser):
    """Keep published row IDs and method categories even before JS resolves titles."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "tr":
            self.row = {"class": attributes.get("class", ""), "cells": []}
        elif tag == "td" and self.row is not None:
            self.cell = {"id": attributes.get("id", ""), "text": [], "links": []}
        elif tag == "a" and self.cell is not None and attributes.get("href"):
            self.cell["links"].append(attributes["href"].strip())

    def handle_data(self, text):
        if self.cell is not None:
            self.cell["text"].append(text)

    def handle_endtag(self, tag):
        if tag == "td" and self.cell is not None:
            self.cell["text"] = " ".join("".join(self.cell["text"]).split())
            self.row["cells"].append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
            self.cell = None


def extract_cpbook(raw: bytes, url: str) -> dict:
    parser = CPBookRows()
    parser.feed(raw.decode("utf-8-sig", errors="strict"))
    records = {}
    for row in parser.rows:
        labels = row["class"].split()
        cells = row["cells"]
        if len(cells) < 3 or not labels:
            continue
        raw_id = cells[0]["text"].strip()
        provider = labels[0]
        if provider == "UVa" and raw_id.isdigit():
            item_id, fallback = "uva:" + str(int(raw_id)), "UVa " + str(int(raw_id))
        elif provider == "LeetCode" and re.fullmatch(r"lc\d+", raw_id):
            item_id, fallback = "leetcode-number:" + raw_id[2:], "LeetCode " + raw_id[2:]
        elif provider == "Kattis" and re.fullmatch(r"[a-z0-9_.-]+", raw_id):
            item_id, fallback = "kattis:" + raw_id, "Kattis " + raw_id
        else:
            continue
        candidates = [urljoin(url, value) for value in cells[1]["links"] if valid_url(urljoin(url, value))]
        original = next((value for value in candidates if (urlparse(value).hostname or "") in ("onlinejudge.org", "www.onlinejudge.org", "open.kattis.com", "leetcode.com", "www.leetcode.com")), None)
        if provider == "LeetCode" and original:
            item_id = identity(original)
        label = cells[1]["text"]
        unresolved = not label or "Fetching from" in label or "replace with" in label
        locator = url.split("#", 1)[0] + "#" + (cells[1]["id"] or raw_id)
        category = cells[2]["text"]
        item = records.setdefault(item_id, {"id": item_id, "title": fallback if unresolved else label, "url": canonical_url(original) if original else locator, "kind": "problem", "section": "", "categories": [], "source_classes": [], "source_locator": locator, "original_url": canonical_url(original) if original else None, "original_link_state": "published_link" if original else "not_resolved", "title_state": "identifier_only" if unresolved else "source_label", "aliases": ["leetcode-number:" + raw_id[2:]] if provider == "LeetCode" and original else []})
        if category not in item["categories"]:
            item["categories"].append(category)
        if row["class"] not in item["source_classes"]:
            item["source_classes"].append(row["class"])
        item["section"] = " / ".join(item["categories"])
    if not records:
        raise ValueError("CP author classification table not found; no rows claimed")
    return {"records": sorted(records.values(), key=lambda item: item["id"]), "next_links": [], "page_title": "CP author Methods to Solve: published table metadata"}


def canonical_url(url: str) -> str:
    parsed = urlparse(url.strip())
    query = parse_qs(parsed.query, keep_blank_values=True)
    query = {k: v for k, v in query.items() if not k.lower().startswith("utm_")}
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path, "", urlencode(query, doseq=True), ""))


def identity(url: str) -> str:
    parsed = urlparse(url.strip())
    host, path = parsed.hostname or "", parsed.path
    rules = [
        (r"(?:www\.)?cses\.fi", r"/problemset/task/(\d+)/?", "cses:{}"),
        (r"(?:www\.)?leetcode\.(?:com|cn)", r"/problems/([^/]+)(?:/.*)?", "leetcode:{}"),
        (r"app\.codility\.com", r"/programmers/lessons/[^/]+/([^/]+)/?", "codility:{}"),
        (r"atcoder\.jp", r"/contests/([^/]+)/tasks/([^/]+)/?", "atcoder:{}:{}"),
        (r"(?:www\.)?luogu\.com\.cn", r"/problem/([^/]+)/?", "luogu:{}"),
        (r"open\.kattis\.com", r"/problems/([^/]+)/?", "kattis:{}"),
        (r"codeforces\.com", r"/(?:problemset/problem|contest)/(\d+)/(?:problem/)?([^/]+)/?", "codeforces:{}:{}"),
        (r"(?:www\.)?codechef\.com", r"/(?:[^/]+/)?problems/([^/]+)/?", "codechef:{}"),
        (r"oj\.uz", r"/problem/view/([^/]+)/?", "oj-uz:{}"),
    ]
    for host_pattern, path_pattern, template in rules:
        match = re.fullmatch(path_pattern, path)
        if re.fullmatch(host_pattern, host) and match:
            value = template.format(*match.groups()).lower()
            return value.replace("_", "-") if value.startswith("codility:") else value
    if host in ("usaco.org", "www.usaco.org") and path in ("/index.php", "/"):
        query = parse_qs(parsed.query)
        if query.get("page") == ["viewproblem2"] and re.fullmatch(r"\d+", query.get("cpid", [""])[0]):
            return "usaco:" + query["cpid"][0]
    if host.endswith("onlinejudge.org"):
        match = re.fullmatch(r"/external/\d+/(?:p)?(\d+)\.pdf", path)
        if match:
            return "uva:" + match[1]
        query = parse_qs(parsed.query)
        if "problem" in query:
            return "onlinejudge:internal:" + query["problem"][0]
    return "url:" + digest(canonical_url(url).encode())[:20]


def extract(raw: bytes, url: str, adapter: str, configuration: dict | None = None, *, registered_url: str | None = None) -> dict:
    if adapter not in ADAPTERS:
        raise ValueError("Adapter is not implemented: " + adapter)
    if adapter == "cpbook_table":
        return extract_cpbook(raw, url)
    configuration = configuration or {}
    page = PageLinks()
    text = raw.decode("utf-8-sig", errors="strict")
    page.feed(text)
    if any(marker in " ".join(page.title).lower() for marker in ("just a moment", "access denied", "sign in to continue")):
        raise ValueError("Access interstitial; not a catalogue")
    pattern = configuration.get("include_url_regex")
    if adapter == "link_index" and not pattern:
        raise ValueError("link_index needs an explicit include_url_regex for this entry")
    records: dict[str, dict] = {}
    next_links = []
    for link in page.links:
        target = urljoin(url, link["href"].strip())
        if not valid_url(target):
            continue
        if configuration.get("pagination_mode") != "single_page" and ("next" in link["rel"].split() or link["title"].lower() in ("next", "next page", "下一页", "下页")):
            next_links.append(target)
        parsed = urlparse(target)
        item_id, kind = None, "reference_link"
        if adapter == "cses_html":
            match = re.fullmatch(r"/problemset/task/(\d+)/?", parsed.path)
            if parsed.hostname == "cses.fi" and match:
                item_id, kind = "cses:" + match[1], "problem"
                target = "https://cses.fi/problemset/task/" + match[1] + "/"
        elif adapter == "codility_html":
            base = urlparse(registered_url or url).path.rstrip("/")
            if base != "/programmers/lessons" and not base.startswith("/programmers/lessons/"):
                raise ValueError("Codility adapter requires a registered lesson entry")
            if re.fullmatch(r"/programmers/lessons/[^/]+", base):
                match = re.fullmatch(re.escape(base) + r"/([^/]+)/?", parsed.path)
                if parsed.hostname == "app.codility.com" and match:
                    item_id, kind = "codility:" + match[1].replace("_", "-"), "problem"
            elif base == "/programmers/lessons":
                match = re.fullmatch(r"/programmers/lessons/(\d+)-([^/]+)/?", parsed.path)
                if parsed.hostname == "app.codility.com" and match:
                    item_id, kind = "codility-lesson:" + match[1], "topic"
        elif re.search(pattern, target):
            item_id = identity(target)
            kind = "problem" if not item_id.startswith("url:") else "reference_link"
        label = link["title"]
        if not item_id or not label or label.upper() in ("START", "VIEW"):
            continue
        if not valid_id(item_id):
            raise ValueError("Extracted identity needs review: " + item_id)
        if item_id not in records:
            records[item_id] = {"id": item_id, "title": label, "url": canonical_url(target), "kind": kind, "section": link["section"]}
    if not records:
        raise ValueError("No matching records; source remains uncollected")
    return {"records": sorted(records.values(), key=lambda x: x["id"]), "next_links": sorted(set(next_links)), "page_title": " ".join(page.title).strip()}


def fetch(url: str, timeout: int = 30, max_bytes: int = 8_000_000) -> tuple[bytes, str]:
    if not valid_url(url):
        raise ValueError("Only public HTTPS source URLs without credentials are accepted")
    request = urllib.request.Request(url, headers={"User-Agent": "The-Second-Algorithm/0.1 (+https://github.com/Gual-Wells/The-Second-Algorithm)", "Accept": "text/html,application/xhtml+xml"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if not valid_url(response.url):
            raise ValueError("Unexpected source redirect")
        data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError("Source exceeds the capture limit; use a bounded entry")
        return data, response.url


def store_capture(root: Path, source_id: str, entry: dict, raw: bytes, final_url: str, *, accept_change: bool = False) -> dict:
    adapter = entry["enumeration"]["adapter"]
    parsed = extract(raw, final_url, adapter, entry["enumeration"], registered_url=entry["url"])
    entry_id = entry["id"]
    if not valid_id(source_id) or not valid_id(entry_id):
        raise ValueError("Unsafe source or entry ID")
    raw_digest = digest(raw)
    cache = root / ".local/materials" / raw_digest / "source.html"
    store_bytes(cache, raw)
    records_digest = digest(canonical_bytes(parsed["records"]))
    configuration = capture_configuration(entry)
    configuration_digest = digest(canonical_bytes(configuration))
    heads_path = root / "catalog/inventory-heads.json"
    heads = read_json(heads_path, {"schema_version": 1, "heads": {}})
    key = source_id + "/" + entry_id
    previous = read_json(safe_relative(root, heads["heads"][key])) if key in heads["heads"] else None
    old_ids = {r["id"] for r in previous["records"]} if previous else set()
    new_ids = {r["id"] for r in parsed["records"]}
    removed = sorted(old_ids - new_ids)
    added = sorted(new_ids - old_ids)
    state = "pagination_pending" if parsed["next_links"] else "review_required" if removed and not accept_change else "captured"
    receipt = {"source_id": source_id, "entry_id": entry_id, "observed_at": now(), "state": state, "count": len(parsed["records"]), "added": added, "removed": removed, "statement_read": False, "semantic_coverage": "not_assessed"}
    if previous and previous["records_sha256"] == records_digest and previous.get("entry_configuration_sha256") == configuration_digest and state == "captured":
        receipt.update({"state": "unchanged", "snapshot": heads["heads"][key]})
    else:
        timestamp = now().replace(":", "").replace("-", "")
        relative = f"catalog/inventories/{source_id}/{entry_id}/{timestamp}-{raw_digest[:12]}-{uuid4().hex}.json"
        snapshot = {"schema_version": 1, "source_id": source_id, "entry_id": entry_id, "captured_at": now(), "request_url": entry["url"], "final_url": final_url, "adapter": adapter, "parser_version": PARSER_VERSION, "page_title": parsed["page_title"], "entry_configuration": configuration, "entry_configuration_sha256": configuration_digest, "input_sha256": raw_digest, "input_bytes": len(raw), "records_sha256": records_digest, "boundary": "matching metadata links on this registered page; not site-wide content", "filter": entry["enumeration"].get("include_url_regex"), "pagination_next": parsed["next_links"], "state": state, "records": parsed["records"]}
        write_json(root / relative, snapshot, immutable=True)
        receipt["snapshot"] = relative
        if state == "captured":
            heads["heads"][key] = relative
            write_json(heads_path, heads)
    report_path = root / ".local/runs" / (now().replace(":", "") + "-" + source_id + "-" + entry_id + "-" + uuid4().hex + ".json")
    write_json(report_path, receipt)
    return receipt


def collect(root: Path, source_id: str, entry_id: str, *, timeout: int = 30, accept_change: bool = False) -> dict:
    source, entry = source_entry(root, source_id, entry_id)
    if entry["enumeration"]["adapter"] not in ADAPTERS:
        raise ValueError("This entry needs manual reading or an unimplemented adapter; no collection was claimed")
    with collection_lock(root):
        key = source_id + "/" + entry_id
        previous_head = read_json(root / "catalog/inventory-heads.json", {"heads": {}})["heads"].get(key)
        try:
            raw, final_url = fetch(entry["url"], timeout)
            return store_capture(root, source_id, entry, raw, final_url, accept_change=accept_change)
        except Exception as error:
            current_head = read_json(root / "catalog/inventory-heads.json", {"heads": {}})["heads"].get(key)
            write_json(root / ".local/failures" / (now().replace(":", "") + "-" + source_id + "-" + entry_id + "-" + uuid4().hex + ".json"), {"source_id": source_id, "entry_id": entry_id, "observed_at": now(), "state": "failed", "error_type": type(error).__name__, "message": str(error), "previous_head": previous_head, "current_head": current_head, "last_good_unchanged": previous_head == current_head})
            raise
