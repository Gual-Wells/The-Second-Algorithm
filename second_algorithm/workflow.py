"""Explicit research receipts and real C++ verification; never automatic semantics."""
from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from contextlib import contextmanager
from pathlib import Path

from .learning import STANDARDS, course_snapshot, file_path
from .storage import digest, now, read_json, safe_relative, write_json

JOB_ID = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z")
HIDDEN = 0x08000000 if os.name == "nt" else 0


def _job_path(root: Path, job_id: str) -> Path:
    if not isinstance(job_id, str) or not JOB_ID.fullmatch(job_id):
        raise ValueError("Invalid research job ID")
    return root / "work/jobs" / job_id / "job.json"


def _job(root: Path, job_id: str) -> dict:
    record = read_json(_job_path(root, job_id))
    if not isinstance(record, dict) or record.get("schemaVersion") != 1 or record.get("id") != job_id:
        raise ValueError("Unknown or invalid research job: " + job_id)
    if not isinstance(record.get("evidence"), list) or any(not isinstance(row, dict) for row in record["evidence"]):
        raise ValueError("Invalid research evidence records: " + job_id)
    for key in ("lastGoodVerification", "lastVerificationAttempt", "lastPreparedRelease"):
        if record.get(key) is not None and not isinstance(record[key], dict):
            raise ValueError("Invalid research receipt pointer: " + job_id)
    return record


@contextmanager
def _lock(root: Path, job_id: str):
    filename = root / ".local" / ("research-" + job_id + ".lock")
    filename.parent.mkdir(parents=True, exist_ok=True)
    try:
        stream = filename.open("x", encoding="utf-8")
    except FileExistsError:
        raise ValueError("Research job is already being changed; inspect its lock before recovery") from None
    try:
        with stream:
            json.dump({"pid": os.getpid(), "startedAt": now()}, stream)
        yield
    finally:
        filename.unlink(missing_ok=True)


def init_job(root: Path, job_id: str, goal: str) -> dict:
    if not goal.strip():
        raise ValueError("A concrete research goal is required")
    filename = _job_path(root, job_id)
    with _lock(root, job_id):
        if filename.exists():
            raise ValueError("Research job already exists; use status/resume")
        job = {"schemaVersion": 1, "id": job_id, "goal": goal, "createdAt": now(),
               "evidence": [], "lastGoodVerification": None, "lastPreparedRelease": None}
        write_json(filename, job)
        (filename.parent / "README.md").write_text(
            "# Research job: " + job_id + "\n\n" + goal + "\n\n"
            "Record actual research and semantic review in separate notes, then register them with "
            "research evidence. This job record does not perform or certify semantic research.\n",
            encoding="utf-8")
    return {"ok": True, "job": job, "path": filename.relative_to(root).as_posix()}


def _receipt_current(root: Path, pointer: dict | None, input_hash: str | None) -> tuple[bool, str]:
    if not pointer:
        return False, "missing"
    try:
        filename = file_path(root, pointer["path"])
        if digest(filename.read_bytes()) != pointer["sha256"]:
            return False, "receipt-changed"
        receipt = read_json(filename)
        if not receipt.get("passed"):
            return False, "failed"
        if receipt.get("inputHash") != input_hash:
            return False, "stale-inputs"
        return True, "current"
    except (KeyError, ValueError, OSError, TypeError):
        return False, "missing-or-invalid-receipt"


def _evidence_status(root: Path, job: dict, input_hash: str | None) -> dict:
    result = {}
    for kind in ("research", "review"):
        record = next((row for row in reversed(job["evidence"]) if row.get("kind") == kind), None)
        if not record:
            result[kind] = {"current": False, "reason": "missing"}
            continue
        reason = "current"
        if record.get("outcome") != "accepted":
            reason = "needs-work"
        elif record.get("inputHash") != input_hash:
            reason = "stale-inputs"
        else:
            try:
                if digest(file_path(root, record["path"]).read_bytes()) != record["sha256"]:
                    reason = "evidence-changed"
            except (OSError, ValueError, KeyError):
                reason = "evidence-missing"
        result[kind] = {"current": reason == "current", "reason": reason, "record": record}
    return result


def job_status(root: Path, job_id: str) -> dict:
    job = _job(root, job_id)
    study = None
    if (_job_path(root, job_id).parent / "study/study.json").is_file():
        from .inquiry import study_status
        try:
            study = study_status(root, job_id)
        except (ValueError, OSError, TypeError, KeyError) as error:
            study = {"ok": False, "errors": [str(error)],
                     "nextActions": ["Repair the durable research study record before continuing."]}
    try:
        snapshot = course_snapshot(root)
        current_hash, validation = snapshot["inputHash"], snapshot["validation"]
    except (ValueError, OSError, TypeError) as error:
        current_hash, validation = None, {"ok": False, "errors": [str(error)]}
    verified, verification_reason = _receipt_current(root, job.get("lastGoodVerification"), current_hash)
    latest = job.get("lastVerificationAttempt")
    if latest and latest.get("inputHash") == current_hash:
        latest_ok, latest_reason = _receipt_current(root, latest, current_hash)
        if not latest_ok:
            verified, verification_reason = False, "latest-attempt-" + latest_reason
    prepared, preparation_reason = _receipt_current(root, job.get("lastPreparedRelease"), current_hash)
    evidence = _evidence_status(root, job, current_hash)
    from .chapters import chapter_quality
    try:
        quality = chapter_quality(root)
    except (ValueError, OSError, TypeError, KeyError, AttributeError) as error:
        # A pre-author study is recoverable before there is any valid course.
        # This reports its current frontier without waiving publication checks.
        quality = {"ok": False, "errors": [str(error)], "chapters": [],
                   "semanticCompletenessCertified": False}
    ready = bool(validation["ok"] and quality["ok"] and verified and all(row["current"] for row in evidence.values()))
    return {"ok": True, "id": job_id, "goal": job["goal"], "inputHash": current_hash,
            "publicationState": validation.get("publicationState"), "operation": validation.get("operation"),
            "validation": validation, "chapterQuality": quality, "evidence": evidence,
            "researchStudy": study,
            "verification": {"current": verified, "reason": verification_reason,
                             "lastGood": job.get("lastGoodVerification")},
            "release": {"current": prepared and ready, "reason": preparation_reason if ready else "requirements-not-current",
                        "lastPrepared": job.get("lastPreparedRelease")},
            "readyForReleasePreparation": ready, "automaticSemanticCertification": False,
            "deployed": False}


def list_jobs(root: Path) -> list[dict]:
    return [job_status(root, filename.parent.name)
            for filename in sorted((root / "work/jobs").glob("*/job.json"))]


def resume_job(root: Path, job_id: str) -> dict:
    result = job_status(root, job_id)
    steps = list((result.get("researchStudy") or {}).get("nextActions", []))
    study = result.get("researchStudy")
    if study and not study.get("lastHandoff") and not steps:
        steps.append("Continue durable chapter research at phase: " + str(study.get("nextPhase", "repair-research-evidence")))
    if not result["validation"]["ok"]:
        steps.append("Fix current-course structural errors before registering new evidence.")
    if not result["chapterQuality"]["ok"]:
        steps.append("Resolve chapter contract gaps and perform current per-promise editorial review; inspect course quality.")
    for kind, evidence in result["evidence"].items():
        if not evidence["current"]:
            steps.append("Perform actual " + kind + " for current inputs, save the note, and register accepted evidence.")
    if not result["verification"]["current"]:
        steps.append("Run research verify to validate the explicit withdrawal; no C++ compilation applies."
                     if result["operation"] == "withdrawal" else "Run research verify with an explicitly selected compiler.")
    if result["readyForReleasePreparation"]:
        steps.append("Run research prepare-release; deployment remains a separate operation.")
    return {**result, "nextActions": steps, "resumedAutomatically": False}


def add_evidence(root: Path, job_id: str, *, kind: str, path: str, summary: str, outcome: str) -> dict:
    if kind not in {"research", "review"} or outcome not in {"accepted", "needs-work"} or not summary.strip():
        raise ValueError("Explicit kind, outcome and evidence summary required")
    note = file_path(root, path)
    if note.suffix.lower() not in {".md", ".json"} or note.relative_to(root).parts[0] in {".local", ".git"}:
        raise ValueError("Evidence must be a durable repository Markdown/JSON note")
    if note == _job_path(root, job_id) or not note.read_text(encoding="utf-8-sig").strip():
        raise ValueError("Evidence must be a substantive separate note")
    snapshot = course_snapshot(root)
    record = {"id": uuid.uuid4().hex, "kind": kind, "path": note.relative_to(root).as_posix(),
              "summary": summary, "outcome": outcome, "sha256": digest(note.read_bytes()),
              "inputHash": snapshot["inputHash"], "recordedAt": now(),
              "claim": "Caller-recorded actual semantic work; structural binding is not independent semantic certification."}
    with _lock(root, job_id):
        job = _job(root, job_id)
        job["evidence"].append(record)
        write_json(_job_path(root, job_id), job)
    return {"ok": True, "evidence": record, "automaticSemanticCertification": False}


def _process(command: list[str], root: Path, env: dict[str, str], timeout: int) -> dict:
    try:
        completed = subprocess.run(command, cwd=root, env=env, text=True, encoding="utf-8",
                                   errors="replace", capture_output=True, timeout=timeout,
                                   creationflags=HIDDEN)
        return {"exit": completed.returncode, "stdout": completed.stdout[-30000:],
                "stderr": completed.stderr[-30000:], "timeout": False}
    except subprocess.TimeoutExpired:
        return {"exit": None, "stdout": "", "stderr": "Process timeout", "timeout": True}
    except OSError as error:
        return {"exit": None, "stdout": "", "stderr": str(error), "timeout": False}


def verify_course(root: Path, compiler: str | None, output: str = ".local/course-verification") -> dict:
    snapshot = course_snapshot(root)
    withdrawal = snapshot["operation"] == "withdrawal"
    if not withdrawal and not compiler:
        raise ValueError("Content verification requires an explicitly selected C++ compiler")
    directory = safe_relative(root, output)
    if not directory.is_relative_to((root / ".local").resolve()):
        raise ValueError("Verification output must be inside the repository .local directory")
    attempt = directory / "runs" / uuid.uuid4().hex
    attempt.mkdir(parents=True, exist_ok=False)
    temporary = attempt / "tmp"
    temporary.mkdir()
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary), TMPDIR=str(temporary))
    version = None if withdrawal else _process([compiler, "--version"], root, env, 15)
    result = {"schemaVersion": 1, "createdAt": now(), "inputHash": snapshot["inputHash"],
              "inputs": snapshot["inputs"], "publicationState": snapshot["publicationState"],
              "operation": snapshot["operation"],
              "compiler": None if withdrawal else {"name": Path(compiler).name, **version},
              "cppVerification": "not-applicable" if withdrawal else "failed",
              "targets": [], "passed": withdrawal, "semanticCompletenessCertified": False,
              "limits": ("Explicit empty withdrawal validated; no C++ target was compiled or run. Carrier, browser and upgrade checks remain separate."
                         if withdrawal else "Real local targets only; no online submission, learning measurement, or automatic semantic review.")}
    if not withdrawal and version["exit"] == 0:
        for target in read_json(root / "catalog/learning.json")["targets"]:
            binary = attempt / (target["id"] + (".exe" if os.name == "nt" else ""))
            flags = ["-std=" + target["standard"], "-O2", "-Wall", "-Wextra", "-Wpedantic", "-D_GLIBCXX_ASSERTIONS"]
            flags.extend("-D" + item for item in target.get("defines", []))
            sources = [target["source"], *target.get("additionalSources", [])]
            command = [compiler, *flags]
            if target["kind"] in {"compile", "compile-fail"}:
                command += ["-fsyntax-only", *sources]
            else:
                command += [*sources, "-o", binary.relative_to(root).as_posix()]
            compiled = _process(command, root, env, target["timeoutSeconds"])
            executed = None
            if target["kind"] == "compile-fail":
                passed = compiled["exit"] == 1 and not compiled["timeout"]
            else:
                passed = compiled["exit"] == 0
                if passed and target["kind"] == "run":
                    executed = _process([str(binary)], root, env, target["timeoutSeconds"])
                    passed = executed["exit"] == 0
            result["targets"].append({"id": target["id"], "kind": target["kind"], "standard": target["standard"],
                                      "flags": flags, "compile": compiled, "run": executed, "passed": passed})
        result["passed"] = bool(result["targets"]) and all(target["passed"] for target in result["targets"])
        result["cppVerification"] = "passed" if result["passed"] else "failed"
    try:
        if course_snapshot(root)["inputHash"] != snapshot["inputHash"]:
            result["passed"] = False
            result["error"] = "Course inputs changed during verification"
    except (ValueError, OSError) as error:
        result["passed"] = False
        result["error"] = str(error)
    receipt = attempt / "verification.json"
    write_json(receipt, result, immutable=True)
    pointer = {"path": receipt.relative_to(root).as_posix(), "sha256": digest(receipt.read_bytes()),
               "inputHash": snapshot["inputHash"]}
    write_json(directory / "latest.json", pointer)
    if result["passed"]:
        write_json(directory / "last-good.json", pointer)
    return {**result, "receipt": pointer}


def verify_job(root: Path, job_id: str, compiler: str | None) -> dict:
    with _lock(root, job_id):
        job = _job(root, job_id)
        result = verify_course(root, compiler, ".local/research-jobs/" + job_id)
        directory = _job_path(root, job_id).parent / "verifications"
        filename = directory / (uuid.uuid4().hex + ".json")
        # Persist the actual report, not a hand-written success boolean.
        durable = {key: value for key, value in result.items() if key != "receipt"}
        write_json(filename, durable, immutable=True)
        pointer = {"path": filename.relative_to(root).as_posix(), "sha256": digest(filename.read_bytes()),
                   "inputHash": result["inputHash"]}
        job["lastVerificationAttempt"] = pointer
        if result["passed"]:
            job["lastGoodVerification"] = pointer
        write_json(_job_path(root, job_id), job)
        return {**result, "durableReceipt": pointer}


def prepare_release(root: Path, job_id: str) -> dict:
    with _lock(root, job_id):
        job = _job(root, job_id)
        status = job_status(root, job_id)
        if not status["readyForReleasePreparation"]:
            raise ValueError("Release not ready: current model, chapter-quality reviews, accepted research/review notes and successful current verification are required; inspect research status")
        snapshot = course_snapshot(root)
        if snapshot["inputHash"] != status["inputHash"]:
            raise ValueError("Course inputs changed during release preparation")
        evidence = [status["evidence"][kind]["record"] for kind in ("research", "review")]
        handoffs = [{"chapter": row["id"], **row["researchHandoff"]}
                    for row in status["chapterQuality"]["chapters"]]
        receipt = {"schemaVersion": 1, "id": uuid.uuid4().hex, "job": job_id, "createdAt": now(),
                   "state": "prepared", "passed": True, "inputHash": snapshot["inputHash"],
                   "inputs": snapshot["inputs"], "documents": snapshot["documents"],
                   "publicationState": snapshot["publicationState"], "operation": snapshot["operation"],
                   "evidence": evidence, "chapterQuality": status["chapterQuality"], "verification": job["lastGoodVerification"],
                   "researchHandoffs": handoffs,
                   "automaticSemanticCertification": False, "deployed": False}
        filename = _job_path(root, job_id).parent / "releases" / (receipt["id"] + ".json")
        write_json(filename, receipt, immutable=True)
        pointer = {"path": filename.relative_to(root).as_posix(), "sha256": digest(filename.read_bytes()),
                   "inputHash": snapshot["inputHash"]}
        job["lastPreparedRelease"] = pointer
        write_json(_job_path(root, job_id), job)
        return {"ok": True, "release": receipt, "receipt": pointer}


def check_release(root: Path, packet: str) -> dict:
    filename = file_path(root, packet)
    record = read_json(filename)
    if not isinstance(record, dict) or record.get("schemaVersion") != 1 or record.get("state") != "prepared" or record.get("passed") is not True:
        raise ValueError("Invalid release packet")
    snapshot = course_snapshot(root)
    if record.get("publicationState") != snapshot["publicationState"] or record.get("operation") != snapshot["operation"]:
        raise ValueError("Release packet publication lifecycle does not match current operation")
    if record.get("inputHash") != snapshot["inputHash"] or record.get("inputs") != snapshot["inputs"]:
        raise ValueError("Release packet is stale: current input hashes differ")
    job_id = record.get("job", "")
    status = job_status(root, job_id)
    job = _job(root, job_id)
    if not status["readyForReleasePreparation"]:
        raise ValueError("Release packet requirements are no longer current")
    pointer = job.get("lastPreparedRelease")
    if not pointer or pointer.get("path") != filename.relative_to(root).as_posix() or pointer.get("sha256") != digest(filename.read_bytes()):
        raise ValueError("Release packet changed or was superseded")
    if record.get("verification") != job.get("lastGoodVerification"):
        raise ValueError("Release packet does not reference the current successful verification")
    expected_evidence = [status["evidence"][kind]["record"] for kind in ("research", "review")]
    if record.get("evidence") != expected_evidence or record.get("documents") != snapshot["documents"]:
        raise ValueError("Release packet evidence or document scope is no longer current")
    if record.get("chapterQuality") != status["chapterQuality"]:
        raise ValueError("Release packet chapter reviews are no longer current")
    handoffs = [{"chapter": row["id"], **row["researchHandoff"]}
                for row in status["chapterQuality"]["chapters"]]
    if record.get("researchHandoffs") != handoffs:
        raise ValueError("Release packet research handoffs are no longer current")
    if course_snapshot(root)["inputHash"] != snapshot["inputHash"]:
        raise ValueError("Inputs changed during release packet check")
    return {"ok": True, "packet": packet, "inputHash": snapshot["inputHash"],
            "publicationState": snapshot["publicationState"], "operation": snapshot["operation"],
            "documents": snapshot["documents"], "state": "prepared", "deployed": False,
            "automaticSemanticCertification": False}
