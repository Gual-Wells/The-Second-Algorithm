import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import worker, { validStateInput } from '../server/worker.mjs';
import { buildLibrary } from '../scripts/build-carrier.mjs';

const origin = 'https://second-algorithm.pages.dev';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_owner_state.sql', import.meta.url), 'utf8'));
  const assets = [];
  const DB = {
    prepare(text) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sql.prepare(text).get(...values) || null; },
        async all() { return { results: sql.prepare(text).all(...values) }; },
        async run() { return { meta: { changes: Number(sql.prepare(text).run(...values).changes) } }; }
      };
    },
    async batch(items) { return Promise.all(items.map(item => item.run())); }
  };
  return { sql, DB, assets, APP_ORIGIN: origin, ENROLLMENT_KEY: 'test-only-initialization-key',
    ASSETS: { async fetch(request) { assets.push(new URL(request.url).pathname);
      return new Response(JSON.stringify({ fixture: true }), { headers: { 'Content-Type': 'application/json' } }); } } };
}
async function authenticate(env, tokenCharacter = 'a', credentialId = 'fixture-key') {
  env.sql.prepare(`INSERT OR IGNORE INTO auth_credential
    (id,credential_id,public_key,counter,transports,created_at) VALUES(1,?,?,0,'[]',?)`)
    .run(credentialId, 'not-a-real-public-key', Date.now());
  const token = tokenCharacter.repeat(43);
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('base64url');
  const epoch = env.sql.prepare('SELECT epoch FROM auth_control WHERE id=1').get().epoch;
  env.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?)').run(hash, epoch, credentialId, Date.now(), Date.now() + 100_000);
  return '__Host-second_algorithm=' + token;
}
const request = (path, cookie, method = 'GET', body, requestOrigin = origin) => new Request(origin + path, {
  method, headers: { ...(cookie ? { cookie } : {}), ...(method !== 'GET' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const call = (env, path, cookie, method, body, requestOrigin) => worker.fetch(request(path, cookie, method, body, requestOrigin), env);
const put = (env, cookie, key, value, baseRevision, requestOrigin) => call(env, '/api/state', cookie, 'PUT', { key, value, baseRevision }, requestOrigin);

test('anonymous access cannot retrieve library, source, state or unknown assets', async () => {
  const env = environment();
  for (const path of ['/api/library', '/api/state', '/library/catalog.json', '/library/source.cpp',
    '/%6cibrary/catalog.json', '/library%2Fsource.cpp', '/unknown.json', '/_worker.js']) {
    assert.equal((await call(env, path)).status, 401, path);
  }
  for (const path of ['/%256cibrary/catalog.json', '/assets%2F..%2Flibrary/catalog.json', '/%00library'])
    assert.equal((await call(env, path)).status, 400, path);
  assert.deepEqual(env.assets, []);
  env.sql.close();
});

test('only public shell paths bypass owner access, while protected content is fetched after login', async () => {
  const env = environment();
  for (const path of ['/', '/app.js', '/assets/font.woff2', '/icons/icon-192.png', '/sw.js'])
    assert.equal((await call(env, path)).status, 200, path);
  assert.equal((await call(env, '/app.js', undefined, 'POST', {})).status, 405);
  const cookie = await authenticate(env);
  let response = await call(env, '/api/library', cookie);
  assert.equal(response.status, 200);
  assert.equal(env.assets.at(-1), '/library/catalog.json');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  response = await call(env, '/library/source.cpp', cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await call(env, '/unknown.json', cookie)).status, 404);
  env.sql.close();
});

test('release assets and authenticated API hide retired trial content while retaining historical notes', async () => {
  const directory = path.join(ROOT, '.local/carrier-server-tests');
  await fs.mkdir(directory, { recursive: true });
  const output = await fs.mkdtemp(path.join(directory, 'release-')), env = environment();
  try {
    const publications = JSON.parse(await fs.readFile(path.join(ROOT, 'carrier/publications.json'), 'utf8'));
    await buildLibrary(ROOT, output, publications,
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim());
    env.ASSETS.fetch = async request => {
      const filename = path.join(output, new URL(request.url).pathname.slice(1));
      try { return new Response(await fs.readFile(filename), { headers: { 'Content-Type': 'application/json' } }); }
      catch (error) { if (error.code === 'ENOENT') return new Response('Not found', { status: 404 }); throw error; }
    };
    const cookie = await authenticate(env);
    assert.equal((await put(env, cookie, 'notes:binary-search', 'historical private note', 0)).status, 200);
    const catalog = await (await call(env, '/api/library', cookie)).json();
    assert(!catalog.collections.some(collection => ['binary-search', 'cpp-reference'].includes(collection.id)));
    for (const extension of ['json', 'cpp', 'md']) {
      for (const location of ['/library/binary-search/bs-foundations/retired.' + extension,
        '/library/cpp-reference/cpp-types/retired.' + extension])
      {
        const response = await call(env, location, cookie);
        assert.equal(response.status, 404, location);
        assert.doesNotMatch(await response.text(), /<!doctype|app\.js|<html|"html"|historical private note/i);
      }
    }
    const state = await (await call(env, '/api/state', cookie)).json();
    assert.equal(state.state['notes:binary-search'].value, 'historical private note');
    assert.equal((await (await call(env, '/auth/status', cookie)).json()).authenticated, true);
  } finally {
    env.sql.close();
    const relative = path.relative(directory, output);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await fs.rm(output, { recursive: true, force: true });
  }
});

test('enrollment defaults closed, checks origin/key, and generates the independent RP challenge', async () => {
  const env = environment();
  const status = await (await call(env, '/auth/status')).json();
  assert.deepEqual(status, { enrolled: false, authenticated: false, enrollmentOpen: false, ownerScope: null });
  assert.equal((await call(env, '/auth/enroll/options', undefined, 'POST', { setupKey: env.ENROLLMENT_KEY })).status, 403);
  env.sql.prepare('UPDATE auth_control SET enrollment_until=? WHERE id=1').run(Date.now() + 300_000);
  assert.equal((await call(env, '/auth/enroll/options', undefined, 'POST', { setupKey: env.ENROLLMENT_KEY }, 'https://other.example')).status, 403);
  assert.equal((await call(env, '/auth/enroll/options', undefined, 'POST', { setupKey: 'wrong' })).status, 401);
  const response = await call(env, '/auth/enroll/options', undefined, 'POST', { setupKey: env.ENROLLMENT_KEY });
  assert.equal(response.status, 200);
  const { options, ticket } = await response.json();
  assert.equal(options.rp.id, 'second-algorithm.pages.dev');
  assert.equal(options.rp.name, '第二算法');
  assert.equal(options.authenticatorSelection.userVerification, 'required');
  assert.equal(typeof ticket, 'string');
  const row = env.sql.prepare('SELECT * FROM auth_challenges').get();
  assert.notEqual(row.ticket_hash, ticket);
  assert.equal(row.kind, 'enroll');
  assert.ok(row.expires_at <= Date.now() + 120_000);
  env.sql.close();
});

test('login challenges are single-use, and malformed authentication cannot issue a session', async () => {
  const env = environment();
  await authenticate(env);
  const before = env.sql.prepare('SELECT count(*) AS n FROM auth_sessions').get().n;
  let response = await call(env, '/auth/login/options', undefined, 'POST', {});
  const { ticket } = await response.json();
  response = await call(env, '/auth/login/verify', undefined, 'POST', { ticket, response: {} });
  assert.equal(response.status, 401);
  response = await call(env, '/auth/login/verify', undefined, 'POST', { ticket, response: {} });
  assert.equal(response.status, 403);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM auth_sessions').get().n, before);
  env.sql.close();
});

test('authenticated owner scope is stable across sessions, and logout revokes this session only', async () => {
  const env = environment(), first = await authenticate(env), second = await authenticate(env, 'b');
  const a = await (await call(env, '/auth/status', first)).json();
  const b = await (await call(env, '/auth/status', second)).json();
  assert.equal(a.authenticated, true);
  assert.match(a.ownerScope, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.ownerScope, b.ownerScope);
  const loggedOut = await call(env, '/auth/logout', first, 'POST', {});
  assert.match(loggedOut.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
  assert.equal((await (await call(env, '/auth/status', first)).json()).authenticated, false);
  assert.equal((await (await call(env, '/auth/status', second)).json()).authenticated, true);
  env.sql.close();
});

test('notes require compare-and-swap and return the current record on conflict', async () => {
  const env = environment(), cookie = await authenticate(env);
  let response = await put(env, cookie, 'notes:binary-search', 'first note', 0);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 1);
  response = await put(env, cookie, 'notes:binary-search', 'stale note', 0);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).current.value, 'first note');
  response = await put(env, cookie, 'notes:binary-search', 'updated note', 1);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 2);
  response = await put(env, cookie, 'notes:missing', 'unknown baseline', 8);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).current, null);
  const data = await (await call(env, '/api/state', cookie)).json();
  assert.equal(data.state['notes:binary-search'].value, 'updated note');
  assert.equal(data.state['notes:binary-search'].revision, 2);
  env.sql.close();
});

test('positions and preferences accept last write while remaining in current owner state', async () => {
  const env = environment(), cookie = await authenticate(env);
  assert.equal((await put(env, cookie, 'position:binary-foundations', { anchor: 'topic-a', offset: 2 }, 0)).status, 200);
  let response = await put(env, cookie, 'position:binary-foundations', { anchor: 'topic-b', offset: 3 }, 0);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 2);
  assert.equal((await put(env, cookie, 'preferences', { fontSize: 17, wrapCode: false })).status, 200);
  const state = (await (await call(env, '/api/state', cookie)).json()).state;
  assert.equal(state['position:binary-foundations'].value.anchor, 'topic-b');
  assert.deepEqual(state.preferences.value, { fontSize: 17, wrapCode: false });
  env.sql.close();
});

test('state rejects cross-origin writes, malformed bodies, invalid keys and oversized values', async () => {
  const env = environment(), cookie = await authenticate(env);
  assert.equal((await put(env, cookie, 'notes:binary-search', 'note', 0, 'https://other.example')).status, 403);
  for (const data of [
    { key: 'notes:../invalid', value: 'text', baseRevision: 0 },
    { key: 'notes:binary', value: 'x'.repeat(20_001), baseRevision: 0 },
    { key: 'notes:binary', value: 'text' },
    { key: 'notes:binary', value: 'text', baseRevision: -1 },
    { key: 'position:binary', value: { text: 'x'.repeat(9000) } },
    { key: 'preferences', value: [] },
    { key: 'preferences', value: JSON.parse('{"__proto__":{"polluted":true}}') }
  ]) assert.equal((await call(env, '/api/state', cookie, 'PUT', data)).status, 400);
  assert.equal((await call(env, '/api/state', cookie, 'PUT', { key: 'notes:binary', value: 'x'.repeat(70_000), baseRevision: 0 })).status, 413);
  const malformed = new Request(origin + '/api/state', { method: 'PUT', headers: { cookie, Origin: origin }, body: 'invalid JSON' });
  assert.equal((await worker.fetch(malformed, env)).status, 400);
  env.sql.close();
});

test('a new epoch cannot read or update the old epoch notes', async () => {
  const env = environment(), oldCookie = await authenticate(env);
  assert.equal((await put(env, oldCookie, 'notes:binary', 'old epoch private note', 0)).status, 200);
  env.sql.exec('UPDATE auth_control SET epoch=epoch+1');
  assert.equal((await call(env, '/api/state', oldCookie)).status, 401);
  const newCookie = await authenticate(env, 'b');
  assert.deepEqual(await (await call(env, '/api/state', newCookie)).json(), { state: {} });
  assert.equal((await put(env, newCookie, 'notes:binary', 'new epoch note', 0)).status, 200);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM reader_state').get().n, 2);
  env.sql.close();
});

test('credential replacement also isolates owner notes without relying on a reused epoch', async () => {
  const env = environment(), oldCookie = await authenticate(env);
  const oldScope = (await (await call(env, '/auth/status', oldCookie)).json()).ownerScope;
  await put(env, oldCookie, 'notes:binary', 'previous owner note', 0);
  env.sql.prepare('UPDATE auth_credential SET credential_id=? WHERE id=1').run('replacement-key');
  assert.equal((await call(env, '/api/state', oldCookie)).status, 401);
  const newCookie = await authenticate(env, 'b', 'replacement-key');
  const newScope = (await (await call(env, '/auth/status', newCookie)).json()).ownerScope;
  assert.notEqual(oldScope, newScope);
  assert.deepEqual(await (await call(env, '/api/state', newCookie)).json(), { state: {} });
  env.sql.close();
});

test('state type guards distinguish notes and structured preferences', () => {
  assert.ok(validStateInput({ key: 'notes:collection-1', value: '', baseRevision: 0 }));
  assert.ok(validStateInput({ key: 'position:doc-1', value: { anchor: '', offset: 0 } }));
  assert.ok(!validStateInput({ key: 'position:doc-1', value: { offset: Infinity } }));
  assert.ok(!validStateInput({ key: 'notes:collection-1', value: {}, baseRevision: 0 }));
});
