from __future__ import annotations

import hashlib
import json
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def read_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else default


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def write_json(path: Path, value: object, *, immutable: bool = False) -> None:
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if immutable and path.exists():
        if path.read_text(encoding="utf-8") != text:
            raise ValueError("Refusing to replace immutable data: " + str(path))
        return
    temporary = path.with_name(path.name + ".pending")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)


def store_bytes(path: Path, data: bytes) -> None:
    """Reuse verified bytes; repair a truncated cache atomically from fresh input."""
    if path.exists() and digest(path.read_bytes()) == digest(data):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".pending")
    temporary.write_bytes(data)
    os.replace(temporary, path)


def safe_relative(root: Path, value: str) -> Path:
    target = (root / value).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError("Path escapes repository: " + value)
    return target


def valid_id(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-z0-9][a-z0-9_.:-]*", value) is not None


def valid_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.hostname) and not parsed.username and not parsed.password


@contextmanager
def collection_lock(root: Path):
    path = root / ".local/collect.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        stream = path.open("x", encoding="utf-8")
    except FileExistsError:
        raise ValueError("A collection lock exists. Check its process before recovery: " + str(path)) from None
    try:
        with stream:
            stream.write(json.dumps({"pid": os.getpid(), "started_at": now()}))
        yield
    finally:
        path.unlink(missing_ok=True)


def sources(root: Path) -> list[dict]:
    return read_json(root / "catalog/sources.json", {"sources": []})["sources"]


def source_entry(root: Path, source_id: str, entry_id: str) -> tuple[dict, dict]:
    source = next((s for s in sources(root) if s["id"] == source_id), None)
    if source is None:
        raise ValueError("Unknown source: " + source_id)
    entry = next((e for e in source["entries"] if e["id"] == entry_id), None)
    if entry is None:
        raise ValueError("Unknown entry: " + source_id + "/" + entry_id)
    if source["admission"]["state"] == "paused":
        raise ValueError("This source is paused; review the registry before collecting")
    return source, entry
