"""Compile real selected entry points, then test processes against small independent models.

No main renaming, installation, production traffic or online-judge submission.
All artifacts and child-process temporary data stay in this repository's .local/.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
from itertools import combinations
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import time
import uuid


ROOT = Path(__file__).resolve().parents[3]
CORE_MACROS = (
    "INTERVAL_MOVIE", "INTERVAL_ROOMS", "INTERVAL_PROJECTS",
    "INTERVAL_CUSTOMERS", "INTERVAL_MOVIE_II", "INTERVAL_NESTED",
)
ADAPTER_MACROS = (
    "INTERVAL_LC56", "INTERVAL_LC57", "INTERVAL_LC435", "INTERVAL_LC452",
    "INTERVAL_LC1024", "INTERVAL_LC1235", "INTERVAL_LC1851", "INTERVAL_LC1094",
    "INTERVAL_LC1751",
)
FLAGS = ["-std=c++17", "-O2", "-Wall", "-Wextra", "-Wpedantic", "-D_GLIBCXX_ASSERTIONS"]
HIDDEN = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0


@dataclass
class Case:
    name: str
    text: str
    expected: list[int]
    rooms: list[tuple[int, int]] | None = None


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text_input(rows: list[tuple[int, ...]], k: int | None = None) -> str:
    header = str(len(rows)) + (" " + str(k) if k is not None else "")
    return header + "\n" + "".join(" ".join(map(str, row)) + "\n" for row in rows)


def conflict(a: tuple[int, ...], b: tuple[int, ...], closed: bool) -> bool:
    if closed:
        return not (a[1] < b[0] or b[1] < a[0])
    return not (a[1] <= b[0] or b[1] <= a[0])


def brute_single(rows: list[tuple[int, ...]], *, weighted: bool, closed: bool) -> int:
    """Enumerate subsets and check every selected pair; no sorted greedy or DP."""
    best = 0
    for mask in range(1 << len(rows)):
        chosen = [i for i in range(len(rows)) if mask >> i & 1]
        score = sum(rows[i][2] for i in chosen) if weighted else len(chosen)
        if score <= best:
            continue
        if all(not conflict(rows[i], rows[j], closed) for i, j in combinations(chosen, 2)):
            best = score
    return best


def brute_rooms(rows: list[tuple[int, int]]) -> int:
    """Enumerate room assignments with symmetry pruning, checking closed overlaps."""
    best = len(rows)
    assigned: list[list[int]] = []

    def search(index: int) -> None:
        nonlocal best
        if index == len(rows):
            best = min(best, len(assigned))
            return
        if len(assigned) >= best:
            return
        for room in assigned:
            if all(not conflict(rows[index], rows[other], True) for other in room):
                room.append(index)
                search(index + 1)
                room.pop()
        if len(assigned) + 1 < best:
            assigned.append([index])
            search(index + 1)
            assigned.pop()

    search(0)
    return best


def brute_k(rows: list[tuple[int, int]], k: int) -> int:
    """Enumerate subsets; their overlap depth is the interval coloring requirement."""
    best = 0
    for mask in range(1 << len(rows)):
        chosen = [rows[i] for i in range(len(rows)) if mask >> i & 1]
        if len(chosen) <= best:
            continue
        if all(sum(a <= t < b for a, b in chosen) <= k for t, _ in chosen):
            best = len(chosen)
    return best


def brute_nested(rows: list[tuple[int, int]]) -> list[int]:
    contains = [int(any(i != j and a <= c and d <= b
                        for j, (c, d) in enumerate(rows)))
                for i, (a, b) in enumerate(rows)]
    contained = [int(any(i != j and c <= a and b <= d
                         for j, (c, d) in enumerate(rows)))
                 for i, (a, b) in enumerate(rows)]
    return contains + contained


def cases_for(macro: str, rng: random.Random, count: int) -> list[Case]:
    cases: list[Case] = []

    def add(name: str, rows: list[tuple[int, ...]], k: int | None = None,
            expected: int | None = None) -> None:
        ranges = [(row[0], row[1]) for row in rows]
        if macro == "INTERVAL_ROOMS":
            cases.append(Case(name, text_input(rows), [brute_rooms(ranges)], ranges))
        elif macro == "INTERVAL_NESTED":
            cases.append(Case(name, text_input(rows), brute_nested(ranges)))
        else:
            if expected is None:
                if macro == "INTERVAL_MOVIE":
                    expected = brute_single(rows, weighted=False, closed=False)
                elif macro == "INTERVAL_PROJECTS":
                    expected = brute_single(rows, weighted=True, closed=True)
                elif macro == "INTERVAL_MOVIE_II":
                    assert k is not None
                    expected = brute_k(ranges, k)
                elif macro == "INTERVAL_CUSTOMERS":
                    expected = max(sum(a <= t < b for a, b in ranges) for t, _ in ranges)
                else:
                    raise AssertionError(macro)
            cases.append(Case(name, text_input(rows, k), [expected]))

    if macro == "INTERVAL_MOVIE":
        add("official-example", [(3,5),(4,9),(5,8)], expected=2)
        add("touching-chain", [(4,5),(1,2),(3,4),(2,3)], expected=4)
        add("earliest-start-trap", [(1,10),(2,3),(3,4),(4,5)], expected=3)
        add("duplicate-jobs", [(1,2),(1,2),(2,3)], expected=2)
        add("coordinate-bound", [(1,1000000000)], expected=1)
    elif macro == "INTERVAL_ROOMS":
        add("official-example", [(1,2),(2,4),(4,4)])
        add("closed-touching-not-free", [(1,2),(2,3)])
        add("same-day-duplicates", [(7,7),(7,7),(7,7)])
        add("input-order-not-time-order", [(9,10),(1,4),(4,5),(6,8)])
        add("coordinate-bound-single-day", [(1000000000,1000000000)])
    elif macro == "INTERVAL_PROJECTS":
        add("official-example", [(2,4,4),(3,6,6),(6,8,2),(5,7,3)], expected=7)
        add("closed-touching-conflict", [(1,2,5),(2,3,6)], expected=6)
        add("predecessor-not-monotonic", [(1,3,5),(5,6,6),(2,7,20)], expected=20)
        add("single-day-projects", [(5,5,4),(5,5,7),(6,6,3)], expected=10)
        add("coordinate-and-reward-bound", [(1000000000,1000000000,1000000000)], expected=1000000000)
        # Original n/reward maxima, legal disjoint single-day projects: 2e14.
        add("maximum-n-and-64-bit-sum", [(i,i,1000000000) for i in range(1,200001)],
            expected=200000000000000)
    elif macro == "INTERVAL_CUSTOMERS":
        add("official-example", [(5,8),(2,4),(3,9)], expected=2)
        add("all-overlap-distinct-endpoints", [(1,10),(2,9),(3,8)], expected=3)
        add("disjoint-distinct-endpoints", [(8,9),(1,2),(4,5)], expected=1)
        add("coordinate-bound", [(1,1000000000)], expected=1)
    elif macro == "INTERVAL_MOVIE_II":
        add("official-example", [(1,5),(8,10),(3,6),(2,5),(6,9)], 2, 4)
        add("latest-feasible-release-is-needed", [(1,4),(1,6),(6,7),(4,8)], 2, 4)
        add("duplicate-releases-are-distinct-resources", [(1,2),(1,2),(2,3),(2,3)], 2, 4)
        add("one-resource", [(1,9),(2,3),(3,4)], 1, 2)
        add("enough-resources-and-max-coordinate", [(1,1000000000)]*5, 5, 5)
    elif macro == "INTERVAL_NESTED":
        add("official-example", [(1,6),(2,4),(4,8),(3,6)])
        add("same-left-and-same-right", [(1,8),(1,5),(2,5),(3,5),(3,4)])
        add("crossing-not-containment", [(1,4),(2,5),(3,6)])
        add("coordinate-bound", [(1,1000000000),(2,999999999),(3,4)])
        add("one-range", [(1,2)])

    for index in range(count):
        n = rng.randint(1, 9)
        if macro == "INTERVAL_CUSTOMERS":
            endpoints = rng.sample(range(1, 70), 2*n)
            rows = [tuple(sorted(endpoints[2*i:2*i+2])) for i in range(n)]
        elif macro == "INTERVAL_NESTED":
            rows = rng.sample([(a,b) for a in range(1,13) for b in range(a+1,15)], n)
        elif macro in {"INTERVAL_ROOMS", "INTERVAL_PROJECTS"}:
            rows = []
            for _ in range(n):
                a = rng.randint(1, 12)
                b = rng.randint(a, 16)
                rows.append((a,b,rng.randint(1,100)) if macro == "INTERVAL_PROJECTS" else (a,b))
        else:
            rows = []
            for _ in range(n):
                a = rng.randint(1, 12)
                rows.append((a, rng.randint(a+1, 17)))
        rng.shuffle(rows)
        add(f"random-{index:03d}", rows, rng.randint(1,n) if macro == "INTERVAL_MOVIE_II" else None)
    return cases


def validate_output(case: Case, output: str) -> None:
    try:
        actual = [int(word) for word in output.split()]
    except ValueError as error:
        raise AssertionError("non-integer platform output") from error
    if case.rooms is None:
        if actual != case.expected:
            raise AssertionError(f"expected {case.expected}, got {actual[:30]}")
        return
    if len(actual) != len(case.rooms) + 1:
        raise AssertionError("room allocation must output k and exactly n room IDs")
    k, *ids = actual
    if k != case.expected[0]:
        raise AssertionError(f"room count {k} is not exhaustive optimum {case.expected[0]}")
    if any(not 1 <= room <= k for room in ids) or len(set(ids)) != k:
        raise AssertionError("invalid or unused room labels")
    for i, j in combinations(range(len(ids)), 2):
        if ids[i] == ids[j] and conflict(case.rooms[i], case.rooms[j], True):
            raise AssertionError(f"customers {i} and {j} overlap in room {ids[i]}")


def main() -> int:
    default_compiler = os.environ.get("CXX") or "g++"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", default=default_compiler,
                        help="Existing compiler path; takes priority over CXX.")
    parser.add_argument("--source", default="content/interval-decisions/区间上的取舍.cpp")
    parser.add_argument("--output", default=".local/interval-platform-validation")
    parser.add_argument("--seed", type=int, default=20261028)
    parser.add_argument("--random-cases", type=int, default=48)
    parser.add_argument("--timeout", type=float, default=15.0, help="Seconds for each executable run.")
    args = parser.parse_args()
    if args.random_cases < 0 or args.timeout <= 0:
        parser.error("random-cases must be nonnegative and timeout must be positive")
    if os.name == "nt" and ROOT.drive.upper() != "D:":
        parser.error("Windows repository and test data must physically reside on D")
    source = (ROOT / args.source).resolve()
    adapter = ROOT / "tests/cpp/interval_adapter_test.cpp"
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to((ROOT / ".local").resolve()):
        parser.error("output must remain in this repository's .local directory")
    compiler = shutil.which(args.compiler) or args.compiler
    run_dir = output / "runs" / uuid.uuid4().hex
    temp = run_dir / "tmp"
    temp.mkdir(parents=True)
    env = dict(os.environ, TEMP=str(temp), TMP=str(temp), TMPDIR=str(temp), PYTHONDONTWRITEBYTECODE="1")
    env["PATH"] = str(Path(compiler).resolve().parent) + os.pathsep + env.get("PATH", "")
    hashes = {"source": sha256(source), "adapter": sha256(adapter), "runner": sha256(Path(__file__))}
    report = {"passed": False, "source": str(source), "sha256": hashes,
              "seed": args.seed, "randomCasesPerCore": args.random_cases,
              "compiler": str(compiler), "flags": FLAGS, "runDirectory": str(run_dir),
              "onlineJudgeSubmitted": False, "mainRenamed": False,
              "temporaryDirectory": str(temp), "entries": []}
    start = time.monotonic()

    def process(command: list[str], *, text: str | None = None,
                timeout: float = args.timeout) -> subprocess.CompletedProcess[str]:
        return subprocess.run(command, cwd=ROOT, env=env, input=text, capture_output=True,
                              text=True, encoding="utf-8", errors="replace", timeout=timeout,
                              creationflags=HIDDEN, check=False)

    try:
        version = process([compiler, "--version"])
        if version.returncode:
            raise RuntimeError("compiler --version failed")
        report["compilerVersion"] = version.stdout.splitlines()[0]
        rng = random.Random(args.seed)
        for macro in (*CORE_MACROS, *ADAPTER_MACROS):
            if sha256(source) != hashes["source"] or sha256(adapter) != hashes["adapter"]:
                raise RuntimeError("source or adapter changed while verifying; rerun on stable inputs")
            binary = run_dir / (macro + (".exe" if os.name == "nt" else ""))
            unit = source if macro in CORE_MACROS else adapter
            command = [compiler, *FLAGS, "-D" + macro, str(unit), "-o", str(binary)]
            compiled = process(command, timeout=90.0)
            (run_dir / (macro + ".compile.log")).write_text(
                json.dumps(command, ensure_ascii=False) + "\n" + compiled.stdout + compiled.stderr,
                encoding="utf-8")
            if compiled.returncode:
                raise RuntimeError(f"{macro}: compilation failed; inspect .compile.log")
            entry = {"macro": macro, "command": command, "compiled": True, "cases": 0,
                     "passed": False, "checks": 0}
            report["entries"].append(entry)
            if macro in CORE_MACROS:
                cases = cases_for(macro, rng, args.random_cases)
                for case in cases:
                    result = process([str(binary)], text=case.text)
                    try:
                        if result.returncode:
                            raise AssertionError(f"process exit {result.returncode}: {result.stderr[:2000]}")
                        validate_output(case, result.stdout)
                    except AssertionError:
                        (run_dir / (macro + ".failure.in")).write_text(case.text, encoding="utf-8")
                        (run_dir / (macro + ".failure.out")).write_text(result.stdout + result.stderr, encoding="utf-8")
                        entry["failureCase"] = case.name
                        raise
                    entry["cases"] += 1
                entry["caseNames"] = [case.name for case in cases]
            else:
                result = process([str(binary)])
                (run_dir / (macro + ".run.log")).write_text(result.stdout + result.stderr, encoding="utf-8")
                prefix = "adapter checks passed: "
                if result.returncode or not result.stdout.startswith(prefix):
                    raise RuntimeError(f"{macro}: adapter run failed; inspect .run.log")
                entry["checks"] = int(result.stdout[len(prefix):].strip())
                entry["cases"] = 1
            entry["passed"] = True
            print(f"{macro}: passed {entry['cases']} process case(s), {entry['checks']} adapter assertions", file=sys.stderr, flush=True)
        if sha256(source) != hashes["source"] or sha256(adapter) != hashes["adapter"]:
            raise RuntimeError("source or adapter changed before verification completed")
        report["passed"] = True
    except (OSError, RuntimeError, AssertionError, subprocess.TimeoutExpired, ValueError) as error:
        report["error"] = str(error)
    report["elapsedSeconds"] = round(time.monotonic() - start, 3)
    report["coreProcessCases"] = sum(row["cases"] for row in report["entries"] if row["macro"] in CORE_MACROS)
    report["adapterAssertions"] = sum(row["checks"] for row in report["entries"] if row["macro"] in ADAPTER_MACROS)
    receipt = run_dir / "results.json"
    receipt.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "receipt": str(receipt),
                      "coreProcessCases": report["coreProcessCases"],
                      "adapterAssertions": report["adapterAssertions"],
                      "error": report.get("error")}, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
