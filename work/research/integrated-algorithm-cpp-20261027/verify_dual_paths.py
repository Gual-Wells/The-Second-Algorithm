"""Build only the research prototype, with all generated files in the project."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', required=True)
    args = parser.parse_args()
    output = ROOT / '.local/integrated-algorithm-cpp'
    temporary = output / 'tmp'
    temporary.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, TEMP=str(temporary), TMP=str(temporary), TMPDIR=str(temporary))
    def run(command):
        p = subprocess.run(command, cwd=ROOT, env=env, text=True, encoding='utf-8',
                           errors='replace', capture_output=True, timeout=60,
                           creationflags=0x08000000 if os.name == 'nt' else 0)
        return {'exit': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}
    source = HERE / 'dual-path-probe.cpp'
    binary = output / ('dual-path-probe.exe' if os.name == 'nt' else 'dual-path-probe')
    flags = ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Wpedantic', '-D_GLIBCXX_ASSERTIONS']
    result = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'compiler': run([args.compiler, '--version']), 'flags': flags}
    result['compile'] = run([args.compiler, *flags, str(source), '-o', str(binary)])
    if result['compile']['exit'] == 0:
        result['run'] = run([str(binary)])
    result['passed'] = result['compile']['exit'] == 0 and result.get('run', {}).get('exit') == 0
    (output / 'results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0 if result['passed'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
