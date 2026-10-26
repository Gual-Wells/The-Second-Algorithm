#!/usr/bin/env python3
"""Compile separately extracted translation examples; optionally probe once retry.

No invalid diagnostic fixture is executed. The once-retry probe is a valid
standard program, kept in a separate process because a broken library can hang.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/cpp/翻译与链接.cpp"
BLOCK = re.compile(r"// BEGIN ([\w-]+)\r?\n([\s\S]*?)// END \1")
NS = "second_algorithm::translation_examples"


def run(command: list[str], directory: Path, env: dict[str, str], timeout: int):
    try:
        result = subprocess.run(command, cwd=directory, env=env, capture_output=True,
                                text=True, encoding="utf-8", errors="replace",
                                timeout=timeout)
        return {"returncode": result.returncode, "stdout": result.stdout,
                "stderr": result.stderr, "timeout": False}
    except subprocess.TimeoutExpired as error:
        def decoded(value):
            return value.decode("utf-8", "replace") if isinstance(value, bytes) else value or ""
        return {"returncode": None, "stdout": decoded(error.stdout),
                "stderr": decoded(error.stderr), "timeout": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", default=os.environ.get("CXX", "g++"))
    parser.add_argument("--output", type=Path, default=ROOT / ".local/cpp-systems-verification/translation")
    parser.add_argument("--once-retry", action="store_true",
                        help="also run standard call_once exception-retry probe; failure is not suppressed")
    parser.add_argument("--run-timeout", type=int, default=8)
    args = parser.parse_args()
    compiler = shutil.which(args.compiler)
    if compiler is None:
        parser.error("compiler not found: " + args.compiler)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / "tmp"
    temporary.mkdir(exist_ok=True)
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary), TMPDIR=str(temporary))
    source_text = SOURCE.read_text(encoding="utf-8")
    blocks = {match.group(1): match.group(2) for match in BLOCK.finditer(source_text)}
    if len(blocks) != len(list(BLOCK.finditer(source_text))):
        raise ValueError("duplicate authoritative code block")

    shared_driver = f"""namespace {NS} {{ int first(); int second(); }}
int main() {{
    const int first = {NS}::first();
    const int second = {NS}::second();
    return first == 1 && second == 2 ? 0 : 1;
}}
"""
    private_driver = shared_driver.replace("second == 2", "second == 1")
    clients = {"a.cpp": "tu-client-a", "b.cpp": "tu-client-b"}
    cases = [
        {"id": "header_guard_single_tu", "blocks": {"state.hpp": "odr-bad-header"},
         "driver": f'#include "state.hpp"\n#include "state.hpp"\nint main() {{ return {NS}::increment() == 1 ? 0 : 1; }}\n'},
        {"id": "duplicate_external_definitions", "blocks": {**clients, "state.hpp": "odr-bad-header"},
         "driver": shared_driver, "link_failure": True},
        {"id": "extern_one_definition", "blocks": {**clients, "state.hpp": "odr-declaration-header", "state.cpp": "odr-one-definition"},
         "driver": shared_driver},
        {"id": "inline_shared", "blocks": {**clients, "state.hpp": "odr-inline-header"}, "driver": shared_driver},
        {"id": "internal_private", "blocks": {**clients, "state.hpp": "odr-local-header"}, "driver": private_driver},
        {"id": "missing_external_definition", "blocks": {**clients, "state.hpp": "odr-declaration-header", "hidden.cpp": "hidden-definition"},
         "driver": shared_driver, "link_failure": True},
        {"id": "pimpl_complete_type", "blocks": {"handle.hpp": "pimpl-header", "handle.cpp": "pimpl-definition"},
         "driver": f'''#include "handle.hpp"
#include <utility>
int main() {{
    {NS}::Handle a(7);
    {NS}::Handle b(std::move(a));
    if (a.value() != 0 || b.value() != 7) return 1;
    {NS}::Handle c(9);
    b = std::move(c);
    return b.value() == 9 && c.value() == 0 ? 0 : 1;
}}
'''},
    ]
    for standard in ("c++17", "c++20"):
        cases.append({"id": "feature_probe_" + standard.replace("+", "p"),
                      "standard": standard, "blocks": {"portability.hpp": "feature-probe"},
                      "driver": f'''#include "portability.hpp"
#include <iostream>
int main() {{
    const int a[] = {{4, 7}};
    std::cout << "span branch: " << {NS}::has_std_span << '\\n';
    return {NS}::first_or_zero(a, 2) == 4 &&
           {NS}::first_or_zero(a, 0) == 0 ? 0 : 1;
}}
'''})

    outcomes = []
    for case in cases:
        directory = output / case["id"]
        directory.mkdir(exist_ok=True)
        for filename, block in case["blocks"].items():
            (directory / filename).write_text(blocks[block], encoding="utf-8", newline="\n")
        (directory / "driver.cpp").write_text(case["driver"], encoding="utf-8", newline="\n")
        sources = [name for name in case["blocks"] if name.endswith(".cpp")] + ["driver.cpp"]
        flags = ["-std=" + case.get("standard", "c++17"), "-O2", "-Wall", "-Wextra", "-Wpedantic"]
        stages = []
        objects = []
        for index, filename in enumerate(sources):
            obj = f"unit_{index}.o"
            command = [compiler, *flags, "-c", filename, "-o", obj]
            result = run(command, directory, env, 60)
            stages.append({"stage": "compile", "source": filename, "command": command, **result})
            objects.append(obj)
            if result["returncode"] != 0:
                break
        compiled = len(stages) == len(sources) and all(stage["returncode"] == 0 for stage in stages)
        expected_link_failure = case.get("link_failure", False)
        passed = False
        if compiled:
            executable = directory / ("program.exe" if os.name == "nt" else "program")
            command = [compiler, *objects, "-o", str(executable)]
            linked = run(command, directory, env, 60)
            stages.append({"stage": "link", "command": command, **linked})
            if expected_link_failure:
                passed = linked["returncode"] is not None and linked["returncode"] != 0
            elif linked["returncode"] == 0:
                executed = run([str(executable)], directory, env, args.run_timeout)
                stages.append({"stage": "run", **executed})
                passed = executed["returncode"] == 0
        outcomes.append({"id": case["id"], "expected": "link_failure" if expected_link_failure else "run_success",
                         "blocks": list(case["blocks"].values()), "passed": passed, "stages": stages})

    if args.once_retry:
        directory = output / "once_retry"
        directory.mkdir(exist_ok=True)
        executable = directory / ("probe.exe" if os.name == "nt" else "probe")
        command = [compiler, "-std=c++17", "-pthread", "-O2", "-Wall", "-Wextra", "-Wpedantic",
                   str(ROOT / "tests/cpp/cpp_systems_once_retry.cpp"), "-o", str(executable)]
        compiled = run(command, directory, env, 60)
        stages = [{"stage": "compile_link", "command": command, **compiled}]
        passed = False
        if compiled["returncode"] == 0:
            executed = run([str(executable)], directory, env, args.run_timeout)
            stages.append({"stage": "run", **executed})
            passed = executed["returncode"] == 0
        outcomes.append({"id": "once_exception_retry", "expected": "run_success", "passed": passed,
                         "stages": stages})

    version = run([compiler, "--version"], output, env, 10)["stdout"].splitlines()[0]
    report = {"schema_version": 1, "compiler": version, "translation_source_sha256": hashlib.sha256(source_text.encode()).hexdigest(),
              "cases": outcomes, "passed": sum(case["passed"] for case in outcomes), "total": len(outcomes),
              "limits": ["Runtime success is not a proof of all ODR or concurrent behaviors.",
                         "Invalid definition fixtures are linked for diagnostics, never executed.",
                         "The optional valid once-retry probe reports a timeout as failure, not as pass."]}
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for case in outcomes:
        print(("PASS " if case["passed"] else "FAIL ") + case["id"])
    print(f"cpp systems fixture checks: {report['passed']}/{report['total']}")
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    sys.exit(main())
