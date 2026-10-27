import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('deployment refuses missing research release before any upload', () => {
  const p = spawnSync(process.execPath, ['scripts/deploy-carrier.mjs'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, ALGORITHM_RELEASE_PACKET: '' }, windowsHide: true });
  assert.notEqual(p.status, 0);
  assert.match(p.stderr, /requires --release/);
});
test('invalid release cannot invoke the deployment provider', () => {
  const parent = path.join(root, '.local/deploy-guard-tests');
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, 'case-'));
  const marker = path.join(directory, 'provider-was-called');
  const provider = path.join(directory, 'provider.cjs');
  writeFileSync(provider, `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad');`);
  try {
    const p = spawnSync(process.execPath,
      ['scripts/deploy-carrier.mjs', '--release', 'work/jobs/definitely-missing/releases/no.json'],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000,
        env: { ...process.env, ALGORITHM_WRANGLER: provider, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.notEqual(p.status, 0);
    assert.match(p.stderr, /Deployment rejected/);
    assert.equal(existsSync(marker), false);
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(parent) + path.sep));
    rmSync(directory, { recursive: true, force: true });
  }
});
