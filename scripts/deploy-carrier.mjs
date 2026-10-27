import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, realpath, open, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const packetIndex = process.argv.indexOf('--release');
const packet = packetIndex >= 0 ? process.argv[packetIndex + 1] : process.env.ALGORITHM_RELEASE_PACKET;
if (!packet) throw Error('Deployment requires --release <prepared research release packet>.');
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
const python = process.env.ALGORITHM_PYTHON || 'python';
function checkPacket() {
  const checked = spawnSync(python, ['-m', 'second_algorithm', 'research', 'check-release', packet],
    { cwd: root, stdio: 'inherit', windowsHide: true });
  if (checked.status !== 0) throw Error('Deployment rejected: missing, stale or failed research release.');
}
const lockPath = path.join(root, '.local/deploy.lock');
let lock;
try { lock = await open(lockPath, 'wx'); }
catch { throw Error('Another deployment holds .local/deploy.lock; inspect its process before recovery.'); }
try {
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), packet }));
checkPacket();
const artifact = '.local/releases/' + randomUUID();
run(['scripts/build-carrier.mjs', '--output', artifact]);
const artifactRoot = path.join(root, artifact);
const build = JSON.parse(await readFile(path.join(artifactRoot, 'carrier-build.json'), 'utf8'));
if (build.mode !== 'full') throw Error('Deployment requires a full isolated artifact.');
checkPacket();
run([wrangler, 'd1', 'migrations', 'apply', 'second-algorithm', '--remote']);
checkPacket();
run([wrangler, 'pages', 'deploy', artifact, '--project-name', 'second-algorithm', '--branch', 'main', '--commit-dirty=true']);
const base = configuration.vars.APP_ORIGIN;
for (const [suffix, expected] of [['/auth/status', 200], ['/api/library', 401], ['/api/state', 401],
  ['/library/catalog.json', 401], ['/%6cibrary/catalog.json', 401]]) {
  const response = await fetch(base + suffix, { signal: AbortSignal.timeout(60_000) });
  if (response.status !== expected) throw Error(`Live authentication boundary failed: ${suffix} ${response.status}`);
}
const release = JSON.parse(await readFile(packet, 'utf8'));
const directory = path.join(root, 'work/jobs', release.job, 'deployments');
await mkdir(directory, { recursive: true });
const deployedWorker = await fetch(base + '/sw.js', { signal: AbortSignal.timeout(60_000) });
const localWorker = await readFile(path.join(artifactRoot, 'sw.js'), 'utf8');
const liveWorker = await deployedWorker.text();
const expectedBuild = localWorker.match(/(?:const|let) (?:BUILD|VERSION)\s*=\s*['"]([^'"]+)/)?.[1];
if (deployedWorker.status !== 200 || !expectedBuild || !liveWorker.includes(expectedBuild))
  throw Error('Published service worker build does not match local release.');
await writeFile(path.join(directory, Date.now() + '.json'), JSON.stringify({ schemaVersion: 1,
  packet, inputHash: release.inputHash, artifact, origin: base, deployedAt: new Date().toISOString(),
  build: expectedBuild, anonymousBoundaryVerified: true, passed: true }, null, 2) + '\n');
console.log('Published and verified private Second Algorithm reader: ' + base);
} finally {
  await lock.close();
  await unlink(lockPath);
}
