import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const temporary = path.join(root, '.local', 'carrier-tmp');
const logs = path.join(root, '.local', 'carrier-logs');
await mkdir(temporary, { recursive: true }); await mkdir(logs, { recursive: true });
if (process.platform === 'win32' && !/^D:[\\/]/i.test(await realpath(root))) throw Error('Carrier deployment data must reside on D.');
process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
process.env.WRANGLER_LOG_PATH = path.join(logs, 'wrangler.log');
const exists = async file => access(file).then(() => true, () => false);
let wrangler = process.env.ALGORITHM_WRANGLER;
if (!wrangler) {
  try { wrangler = path.join(path.dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js'); }
  catch { throw Error('Configure ALGORITHM_WRANGLER or install the declared Wrangler dependency on D.'); }
}
if (!await exists(wrangler)) throw Error('Configure ALGORITHM_WRANGLER or install the declared Wrangler dependency on D.');
const configuration = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
if (!/^[0-9a-f-]{36}$/i.test(configuration.d1_databases?.[0]?.database_id || ''))
  throw Error('Configure the independent second-algorithm D1 database before deployment.');
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error('Carrier deployment step failed.');
}
run(['scripts/build-carrier.mjs']);
run([wrangler, 'd1', 'migrations', 'apply', 'second-algorithm', '--remote']);
run([wrangler, 'pages', 'deploy', 'dist', '--project-name', 'second-algorithm', '--branch', 'main', '--commit-dirty=true']);
const base = configuration.vars.APP_ORIGIN;
for (const [suffix, expected] of [['/auth/status', 200], ['/api/library', 401], ['/api/state', 401],
  ['/library/catalog.json', 401], ['/%6cibrary/catalog.json', 401]]) {
  const response = await fetch(base + suffix, { signal: AbortSignal.timeout(60_000) });
  if (response.status !== expected) throw Error(`Live authentication boundary failed: ${suffix} ${response.status}`);
}
console.log('Published private Second Algorithm reader: ' + base);
