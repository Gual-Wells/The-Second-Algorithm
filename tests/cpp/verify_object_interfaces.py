"""Compile the chapter's positive and intentionally ill-formed C++17 cases.

The negative programs are never run. A compiler error is not a global language
proof; each isolated macro changes the operation being checked.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", default=os.environ.get("CXX", "g++"))
    parser.add_argument("--output", type=Path,
                        default=ROOT / ".local/cpp-first-chapter/probes")
    args = parser.parse_args()
    compiler = shutil.which(args.compiler)
    if compiler is None:
        parser.error("compiler unavailable: " + args.compiler)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / "tmp"
    temporary.mkdir(exist_ok=True)
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary), TMPDIR=str(temporary))
    version = subprocess.check_output([compiler, "--version"], env=env,
                                      text=True, encoding="utf8").splitlines()[0]
    outcomes = []
    cases = [("copy-fallback", None, True),
             ("deleted-move", "PROBE_DELETED_MOVE", False),
             ("const-unique", "PROBE_CONST_UNIQUE", False),
             ("named-unique", "PROBE_NAMED_UNIQUE", False)]
    for name, macro, should_compile in cases:
        executable = output / (name + (".exe" if os.name == "nt" else ""))
        command = [compiler, "-std=c++17", "-O2", "-Wall", "-Wextra", "-Wpedantic",
                   str(ROOT / "tests/cpp/cpp_object_interfaces_compile.cpp"),
                   "-o", str(executable)]
        if macro:
            command.append("-D" + macro)
        try:
            compiled = subprocess.run(command, cwd=ROOT, env=env, capture_output=True,
                                      text=True, encoding="utf8", errors="replace", timeout=45)
            # GCC/Clang semantic errors return 1; crashes/timeouts are not expected failures.
            passed = compiled.returncode == (0 if should_compile else 1)
            runtime = None
            if passed and should_compile:
                runtime = subprocess.run([str(executable)], cwd=ROOT, env=env,
                                         capture_output=True, text=True,
                                         encoding="utf8", errors="replace", timeout=10)
                passed = runtime.returncode == 0
            record = {"case": name, "expected_compile": should_compile,
                      "compiler_returncode": compiled.returncode,
                      "runtime_returncode": runtime.returncode if runtime else None,
                      "passed": passed, "diagnostic": compiled.stderr[:5000]}
        except subprocess.TimeoutExpired:
            record = {"case": name, "expected_compile": should_compile,
                      "passed": False, "error": "compile or runtime timeout"}
        outcomes.append(record)
        print(("PASS " if record["passed"] else "FAIL ") + name)
    report = {"compiler": version, "standard": "C++17", "outcomes": outcomes,
              "limits": "Invalid cases are compiler probes, never executed."}
    (output / "report.json").write_bytes(
        (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
    return 0 if all(item["passed"] for item in outcomes) else 1


if __name__ == "__main__":
    sys.exit(main())
