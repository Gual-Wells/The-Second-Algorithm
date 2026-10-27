import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const origin = 'https://second-algorithm.pages.dev';
const alice = 'a'.repeat(43), bob = 'b'.repeat(43);
const doc = '/library/chapter/document/0123456789abcdef.json';
const paths = ['/library/catalog.json', doc, doc.replace('.json', '.cpp'), doc.replace('.json', '.md')];
const source = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8').replaceAll('__BUILD__', 'fixture-build')
  .replaceAll('__LIBRARY_PATHS__', JSON.stringify(paths));
const absolute = input => new URL(typeof input === 'string' ? input : input.url, origin).href;

function storage() {
  const data = new Map();
  return {
    data,
    async keys() { return [...data.keys()]; },
    async delete(name) { return data.delete(name); },
    async open(name) {
      if (!data.has(name)) data.set(name, new Map());
      const entries = data.get(name);
      return {
        async match(key) { return entries.get(absolute(key))?.clone(); },
        async put(key, response) { entries.set(absolute(key), response.clone()); },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
        async delete(key) { return entries.delete(absolute(key)); },
        async addAll(keys) { for (const key of keys) entries.set(absolute(key), new Response('shell:' + key)); }
      };
    }
  };
}

function worker({ caches = storage(), now = 1_800_000_000_000 } = {}) {
  const handlers = new Map(), calls = [], notifications = [];
  const controls = { now, identity: alice, online: true, contentStatus: 200, fetch: null };
  const globals = {
    Request, Response, URL, console, caches,
    Date: class extends Date { static now() { return controls.now; } },
    fetch: async (input, options) => {
      const url = absolute(input); calls.push({ url, options });
      if (controls.fetch) return controls.fetch(url, options);
      if (!controls.online) throw new TypeError('network unavailable');
      if (new URL(url).pathname === '/auth/status') return Response.json({ authenticated: Boolean(controls.identity), ownerScope: controls.identity });
      return new Response('network:' + new URL(url).pathname, { status: controls.contentStatus });
    },
    self: {
      location: { origin },
      addEventListener(type, handler) { handlers.set(type, handler); },
      async skipWaiting() {},
      clients: { async claim() {}, async matchAll() { return [{ postMessage(data) { notifications.push(data); } }]; } }
    }
  };
  vm.runInNewContext(source, globals, { filename: 'sw.js' });
  return {
    controls, caches, calls, notifications,
    async message(data, sourceUrl = origin + '/') {
      let result, pending;
      handlers.get('message')({ data, source: { url: sourceUrl }, ports: [{ postMessage(value) { result = value; } }],
        waitUntil(promise) { pending = promise; } });
      await pending; return result;
    },
    async fetch(path, options = {}) {
      const request = new Request(new URL(path, origin), options);
      if (options.mode === 'navigate') Object.defineProperty(request, 'mode', { value: 'navigate' });
      let response;
      handlers.get('fetch')({ request, respondWith(promise) { response = promise; } });
      return response ? await response : null;
    },
    async lifecycle(type) { let pending; handlers.get(type)({ waitUntil(value) { pending = value; } }); await pending; }
  };
}

test('versioned public shell installs and replaces only old shell caches', async () => {
  const sw = worker();
  await sw.caches.open('second-algorithm-shell-previous');
  await sw.caches.open('another-app-data');
  await sw.lifecycle('install'); await sw.lifecycle('activate');
  const names = await sw.caches.keys();
  assert(names.includes('second-algorithm-shell-fixture-build'));
  assert(!names.includes('second-algorithm-shell-previous'));
  assert(names.includes('another-app-data'));
  const version = await sw.message({ type: 'VERSION' });
  assert.equal(version.build, 'fixture-build');
  sw.controls.online = false;
  assert.match(await (await sw.fetch('/app.js?v=fixture-build')).text(), /^shell:/);
  assert.equal(await sw.fetch('/auth/status'), null);
  assert.equal(await sw.fetch('/api/state'), null);
  assert.equal(await sw.fetch('/sw.js'), null);
  assert.equal(await sw.fetch('/unknown-private-file'), null);
});

test('upgrade removes old trial documents and catalog without deleting owner or unrelated records', async () => {
  const sw = worker();
  await sw.message({ type: 'OWNER', owner: alice });
  const cache = await sw.caches.open('second-algorithm-private-' + alice);
  const retired = '/library/binary-search/bs-foundations/retired.json';
  for (const path of [retired, retired.replace('.json', '.cpp'), '/library/catalog.json', doc])
    await cache.put(path, new Response(path === '/library/catalog.json' ? JSON.stringify({ collections: [{ id: 'binary-search' }] }) : 'cached'));
  await sw.caches.open('unrelated-notes-backup');
  sw.controls.online = false;
  await sw.lifecycle('activate');
  assert.equal(await cache.match(retired), undefined);
  assert.equal(await cache.match(retired.replace('.json', '.cpp')), undefined);
  assert.equal(await cache.match('/library/catalog.json'), undefined);
  assert.equal((await cache.match(doc)).status, 200);
  assert.equal((await sw.fetch(retired)).status, 404);
  assert.equal((await sw.fetch(retired.replace('.json', '.cpp'))).status, 404);
  assert.equal((await sw.message({ type: 'CACHE_CONTENT', owner: alice, urls: [retired] })).ok, false);
  assert.equal((await sw.message({ type: 'OWNER', owner: alice })).ok, true);
  assert((await sw.caches.keys()).includes('second-algorithm-owner-v1'));
  assert((await sw.caches.keys()).includes('unrelated-notes-backup'));
});

test('OWNER must be confirmed by server, ignores forged verifiedAt and foreign-origin messages', async () => {
  const sw = worker();
  assert.equal((await sw.message({ type: 'OWNER', owner: bob, verifiedAt: sw.controls.now })).ok, false);
  assert.equal((await sw.message({ type: 'OWNER', owner: alice, verifiedAt: 999_999_999_999_999 })).ok, true);
  assert.equal(await sw.message({ type: 'CLEAR_PRIVATE' }, 'https://foreign.example/'), undefined);
  await sw.fetch(doc);
  sw.controls.online = false;
  assert.equal((await sw.fetch(doc)).status, 200);
  const metadata = await (await sw.caches.open('second-algorithm-owner-v1')).match(origin + '/__offline_owner__');
  assert.equal((await metadata.json()).verifiedAt, sw.controls.now);
});

test('coarse download only accepts private library paths and skips cached immutable docs/source', async () => {
  const sw = worker();
  await sw.message({ type: 'OWNER', owner: alice });
  const urls = ['/library/catalog.json', doc, doc.replace('.json', '.cpp')];
  assert.equal((await sw.message({ type: 'CACHE_CONTENT', owner: alice, urls })).ok, true);
  const count = sw.calls.length;
  const result = await sw.message({ type: 'CACHE_CONTENT', owner: alice, urls });
  assert.equal(result.ok, true); assert.equal(result.skipped, 2); assert.equal(result.downloaded, 1);
  assert.equal(sw.calls.length, count + 1);
  for (const invalid of ['/api/state', '/auth/status', 'https://evil.example/library/a.json',
    '/library/%2561.json', '/library/a.json?x=1', '/library/a.exe']) {
    assert.equal((await sw.message({ type: 'CACHE_CONTENT', owner: alice, urls: [invalid] })).ok, false);
  }
  assert.equal((await sw.message({ type: 'CACHE_CONTENT', owner: bob, urls })).ok, false);
});

test('protected reads are network-first and HTTP failures never use stale cache', async () => {
  const sw = worker();
  await sw.message({ type: 'OWNER', owner: alice });
  assert.equal((await sw.fetch(doc)).status, 200);
  sw.controls.contentStatus = 503;
  assert.equal((await sw.fetch(doc)).status, 503);
  sw.controls.contentStatus = 401;
  assert.equal((await sw.fetch(doc)).status, 401);
  assert(sw.notifications.some(message => message.type === 'AUTH_REQUIRED'));
  assert(!(await sw.caches.keys()).some(name => name.startsWith('second-algorithm-private-')));
  sw.controls.online = false;
  assert.equal((await sw.fetch(doc)).status, 503);
});

test('403 also clears authorization and private data rather than returning cached success', async () => {
  const sw = worker();
  await sw.message({ type: 'OWNER', owner: alice }); await sw.fetch(doc);
  sw.controls.contentStatus = 403;
  assert.equal((await sw.fetch(doc)).status, 403);
  assert.equal((await sw.message({ type: 'CACHE_CONTENT', owner: alice, urls: [doc] })).ok, false);
});

test('persisted owner survives worker restart but cannot be extended offline or exceed 90 days', async () => {
  const first = worker();
  await first.message({ type: 'OWNER', owner: alice }); await first.fetch(doc);
  const next = worker({ caches: first.caches, now: first.controls.now + 10_000 });
  next.controls.online = false;
  assert.equal((await next.message({ type: 'OWNER', owner: alice, verifiedAt: next.controls.now })).ok, true);
  assert.equal((await next.fetch(doc)).status, 200);
  assert.equal((await next.message({ type: 'OWNER', owner: bob })).ok, false);
  const expired = worker({ caches: first.caches, now: first.controls.now + 90 * 86400_000 });
  expired.controls.online = false;
  assert.equal((await expired.message({ type: 'OWNER', owner: alice, verifiedAt: expired.controls.now })).ok, false);
  assert.equal((await expired.fetch(doc)).status, 503);
  await expired.lifecycle('activate');
  assert(!(await expired.caches.keys()).some(name => name.startsWith('second-algorithm-private-')));
});

test('explicit logout clears persisted authorization, keeps public shell, and prevents offline restoration', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  await sw.message({ type: 'OWNER', owner: alice }); await sw.fetch(doc);
  assert.equal((await sw.message({ type: 'CLEAR_PRIVATE' })).ok, true);
  assert((await sw.caches.keys()).includes('second-algorithm-shell-fixture-build'));
  const restarted = worker({ caches: sw.caches }); restarted.controls.online = false;
  assert.equal((await restarted.message({ type: 'OWNER', owner: alice })).ok, false);
  assert.equal((await restarted.fetch(doc)).status, 503);
});

test('changing owner deletes previous owner caches and does not expose them offline', async () => {
  const sw = worker();
  await sw.message({ type: 'OWNER', owner: alice }); await sw.fetch(doc);
  sw.controls.identity = bob;
  assert.equal((await sw.message({ type: 'OWNER', owner: bob })).ok, true);
  sw.controls.online = false;
  assert.equal((await sw.fetch(doc)).status, 503);
  assert(!(await sw.caches.keys()).includes('second-algorithm-private-' + alice));
});

test('logout cancels a download in flight so it cannot recreate a private cache', async () => {
  const sw = worker(); await sw.message({ type: 'OWNER', owner: alice });
  let release, requested;
  const started = new Promise(resolve => { requested = resolve; });
  sw.controls.fetch = async () => { requested(); return new Promise(resolve => { release = resolve; }); };
  const pending = sw.message({ type: 'CACHE_CONTENT', owner: alice, urls: [doc] });
  await started; await sw.message({ type: 'CLEAR_PRIVATE' });
  release(new Response('stale private body'));
  assert.equal((await pending).ok, false);
  assert(!(await sw.caches.keys()).some(name => name.startsWith('second-algorithm-private-')));
});

test('network content fetched without a verified owner never creates private offline copies', async () => {
  const sw = worker();
  assert.equal((await sw.fetch(doc)).status, 200);
  sw.controls.online = false;
  assert.equal((await sw.fetch(doc)).status, 503);
  assert(!(await sw.caches.keys()).some(name => name.startsWith('second-algorithm-private-')));
});
