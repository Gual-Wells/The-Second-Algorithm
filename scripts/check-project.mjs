import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, '.local/check-project/tmp');
mkdirSync(tmp, { recursive: true });
const env = { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, PYTHONDONTWRITEBYTECODE: '1' };
env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.local/playwright-browsers');
if (process.platform === 'win32' && !env.ALGORITHM_QA_CHROME) {
  env.ALGORITHM_QA_CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync) || '';
}
const python = process.env.ALGORITHM_PYTHON || 'python';
const compiler = process.env.CXX || 'c++';
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error('Check failed: ' + command + ' ' + args.join(' '));
}
run(process.execPath, ['scripts/build-course.mjs']);
run(python, ['-m', 'second_algorithm', 'course', 'validate']);
run(python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']);
run(python, ['-m', 'second_algorithm', 'course', 'verify', '--compiler', compiler]);
run(process.execPath, ['--test', ...readdirSync(path.join(root, 'test'))
  .filter(name => /^carrier-.*\.test\.mjs$/.test(name)).sort().map(name => 'test/' + name)]);
run(process.execPath, ['scripts/build-carrier.mjs']);
if (!process.argv.includes('--without-browser')) {
  run(process.execPath, ['scripts/check-carrier-browser.cjs']);
  run(process.execPath, ['scripts/check-carrier-upgrade.cjs']);
}
console.log('Current course and publishing checks passed.');
