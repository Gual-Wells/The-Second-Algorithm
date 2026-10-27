"""Isolated research checks; compiler and all generated data are explicit inputs."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", required=True)
    parser.add_argument("--output", type=Path, default=ROOT / ".local/algorithm-cpp-implementation")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / "tmp"
    temporary.mkdir(exist_ok=True)
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary), TMPDIR=str(temporary))

    def run(command: list[str], data: str | None = None):
        p = subprocess.run(command, input=data, text=True, capture_output=True,
                           encoding="utf-8", errors="replace", env=env, cwd=ROOT,
                           timeout=60, creationflags=0x08000000 if os.name == "nt" else 0)
        return {"exit": p.returncode, "stdout": p.stdout, "stderr": p.stderr}

    result = {"compiler": run([args.compiler, "--version"]), "standard": "c++17",
              "production_source_sha256": hashlib.sha256(
                  (ROOT / "content/contiguous-ranges/连续片段.cpp").read_bytes()).hexdigest(),
              "compiles": {}, "runs": {}, "limits": [
                  "Local compiler only; no online judge or employer assessment was submitted.",
                  "Operation counts describe this implementation and input, not a timing benchmark.",
                  "No undefined-behavior branch was executed; no sanitizer run is claimed."]}
    for stem in ("implementation-probes", "submission-adapter", "function-adapter"):
        source = HERE / (stem + ".cpp")
        if stem in ("submission-adapter", "function-adapter"):
            # Extract the authoritative kernel instead of hand-maintaining a second copy.
            kernel = "prefix-count" if stem == "submission-adapter" else "fixed-extreme"
            production = (ROOT / "content/contiguous-ranges/连续片段.cpp").read_text(encoding="utf-8")
            match = re.search(r"// BEGIN " + kernel + r"\n([\s\S]*?)// END " + kernel, production)
            if match is None:
                raise ValueError("authoritative kernel not found: " + kernel)
            includes = "#include <deque>\n#include <unordered_map>\n#include <vector>\n"
            extracted = includes + "namespace second_algorithm::contiguous {\nusing i64 = long long;\n" + match[1] + "}\n"
            expanded = source.read_text(encoding="utf-8").replace(
                '#include "../../../content/contiguous-ranges/连续片段.cpp"', extracted)
            source = output / (stem + "-standalone.cpp")
            source.write_text(expanded, encoding="utf-8")
        binary = output / (stem + (".exe" if os.name == "nt" else ""))
        flags = ["-std=c++17", "-O2", "-Wall", "-Wextra", "-Wpedantic", "-D_GLIBCXX_ASSERTIONS"]
        compiled = run([args.compiler, *flags, str(source), "-o", str(binary)])
        result["compiles"][stem] = compiled
        if compiled["exit"]:
            (output / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
            return 1
        if stem in ("implementation-probes", "function-adapter"):
            result["runs"][stem] = run([str(binary)])
        else:
            cases = [("official_sample", "5 7\n2 -1 3 5 -2\n", "2\n"),
                     ("negative_repetition", "4 0\n1 -1 1 -1\n", "4\n"),
                     ("64_bit_result", "200000 0\n" + "0 " * 200000 + "\n", "20000100000\n")]
            for name, data, expected in cases:
                checked = run([str(binary)], data)
                checked["expected"] = expected
                checked["passed"] = checked["exit"] == 0 and checked["stdout"] == expected
                result["runs"][name] = checked
    passed = all(r["exit"] == 0 and r.get("passed", True) for r in result["runs"].values())
    result["passed"] = passed
    (output / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
