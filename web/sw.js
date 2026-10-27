const BUILD = '__BUILD__';
const SHELL_PREFIX = 'second-algorithm-shell-';
const SHELL = SHELL_PREFIX + BUILD;
const PRIVATE_PREFIX = 'second-algorithm-private-';
// Rebuilt from the published catalog, never from an old downloaded catalog.
const LIBRARY_PATHS = new Set(typeof __LIBRARY_PATHS__ === 'undefined' ? [] : __LIBRARY_PATHS__);
const CONTEXT = 'second-algorithm-owner-v1';
const META = new URL('/__offline_owner__', self.location.origin).href;
const MAX_AGE = 90 * 86400_000;
const FILES = ['/', '/index.html', `/styles.css?v=${BUILD}`, `/app.js?v=${BUILD}`, '/auth.js',
  `/manifest.webmanifest?v=${BUILD}`, '/icons/icon.svg', `/icons/apple-touch-icon-series1.png?v=${BUILD}`,
  '/icons/icon-192.png', '/icons/icon-512.png'];
const PUBLIC = new Set(['/', '/index.html', '/styles.css', '/app.js', '/auth.js', '/manifest.webmanifest',
  '/robots.txt', '/favicon.ico']);
let owner = null, generation = 0;

function validOwner(value) {
  return value && /^[A-Za-z0-9_-]{43}$/.test(value.owner) && Number.isSafeInteger(value.verifiedAt)
    && Date.now() >= value.verifiedAt && Date.now() - value.verifiedAt < MAX_AGE;
}

const initialized = (async () => {
  const start = generation;
  try {
    const stored = await (await caches.open(CONTEXT)).match(META);
    const value = stored && await stored.json();
    if (start === generation && validOwner(value)) owner = value;
  } catch { /* An absent or damaged context never grants offline access. */ }
})();
let mutations = initialized;
function mutate(action) {
  const result = mutations.then(action);
  mutations = result.catch(() => {});
  return result;
}

async function erasePrivate() {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith(PRIVATE_PREFIX) || name === CONTEXT)
    .map(name => caches.delete(name)));
}

async function notifyAuthRequired() {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    client.postMessage({ type: 'AUTH_REQUIRED' });
}

function clearPrivate(notify = false) {
  // Invalidate before asynchronous deletion so an in-flight download cannot repopulate an old owner cache.
  owner = null; ++generation;
  return mutate(async () => { await erasePrivate(); if (notify) await notifyAuthRequired(); });
}

function privateUrl(input) {
  try {
    const url = new URL(input, self.location.origin);
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== self.location.origin || url.search || url.hash || /[%\\\u0000-\u001f\u007f]/.test(path)
      || path.split('/').some(part => part === '.' || part === '..') || !path.startsWith('/library/')
      || !/\.(?:json|cpp|md)$/.test(path) || !LIBRARY_PATHS.has(path)) return null;
    url.pathname = path;
    return url.href;
  } catch { return null; }
}

function publicUrl(url) {
  return PUBLIC.has(url.pathname) || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/');
}

function current(snapshot, start) {
  return Boolean(generation === start && validOwner(owner) && snapshot?.owner === owner.owner);
}

function unavailable(message = '此篇尚未下载，请联网打开。', status = 503) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function cacheResponse(url, response, snapshot, start) {
  if (!current(snapshot, start) || response.status !== 200 || response.redirected) return false;
  // Serialize the final cache write with logout/owner changes. A slow body cannot restore a cache after deletion.
  return mutate(async () => {
    if (!current(snapshot, start)) return false;
    await (await caches.open(PRIVATE_PREFIX + snapshot.owner)).put(url, response);
    return true;
  });
}

async function protectedFetch(request) {
  await initialized;
  const snapshot = owner, start = generation, url = privateUrl(request.url);
  if (!url) return unavailable('内容不存在。', 404);
  try {
    const response = await fetch(request);
    if (response.status === 401 || response.status === 403) {
      await clearPrivate(true);
      return response;
    }
    if (url && request.method === 'GET' && response.status === 200)
      await cacheResponse(url, response.clone(), snapshot, start).catch(() => false);
    return response;
  } catch {
    // HTTP errors, including authorization denials, never reach this fallback.
    if (url && request.method === 'GET' && current(snapshot, start)) {
      const cached = await (await caches.open(PRIVATE_PREFIX + snapshot.owner)).match(url);
      if (cached && current(snapshot, start)) return cached;
    }
    if (owner && !validOwner(owner)) await clearPrivate();
    return unavailable();
  }
}

async function setOwner(message) {
  await initialized;
  if (!/^[A-Za-z0-9_-]{43}$/.test(message.owner ?? '')) return { ok: false, error: 'Invalid owner' };
  const start = generation;
  let response;
  try { response = await fetch('/auth/status', { credentials: 'same-origin', cache: 'no-store' }); }
  catch {
    // A page cannot manufacture or extend an offline authorization timestamp.
    return { ok: current({ owner: message.owner }, start), offline: true };
  }
  if (response.status === 401 || response.status === 403) {
    await clearPrivate(true); return { ok: false, error: 'Authentication required' };
  }
  if (!response.ok) return { ok: false, error: 'Status unavailable' };
  let status;
  try { status = await response.json(); } catch { return { ok: false, error: 'Invalid status' }; }
  if (!status.authenticated || status.ownerScope !== message.owner) {
    await clearPrivate(true); return { ok: false, error: 'Authentication required' };
  }
  return mutate(async () => {
    if (generation !== start) return { ok: false, error: 'Owner changed' };
    if (owner?.owner !== message.owner) { ++generation; owner = null; await erasePrivate(); }
    const value = { owner: message.owner, verifiedAt: Date.now() };
    await (await caches.open(CONTEXT)).put(META, new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' }
    }));
    owner = value;
    return { ok: true, owner: value.owner };
  });
}

async function cacheContent(message) {
  await initialized;
  const snapshot = owner, start = generation;
  if (!current({ owner: message.owner }, start)) return { ok: false, error: 'Authentication required' };
  if (!Array.isArray(message.urls) || !message.urls.length || message.urls.length > 256)
    return { ok: false, error: 'Invalid collection' };
  const urls = [...new Set(message.urls.map(privateUrl))];
  if (urls.includes(null)) return { ok: false, error: 'Invalid content URL' };
  let downloaded = 0, skipped = 0;
  const cache = await caches.open(PRIVATE_PREFIX + snapshot.owner);
  for (const url of urls) {
    if (!current(snapshot, start)) return { ok: false, error: 'Owner changed' };
    // Revisioned documents/source never need another request; catalog is mutable and refreshed once per batch.
    if (new URL(url).pathname !== '/library/catalog.json' && await cache.match(url)) { ++skipped; continue; }
    let response;
    try { response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); }
    catch { return { ok: false, error: 'Network unavailable', downloaded, skipped }; }
    if (response.status === 401 || response.status === 403) {
      await clearPrivate(true); return { ok: false, error: 'Authentication required' };
    }
    if (response.status !== 200 || response.redirected) return { ok: false, error: 'Content unavailable', downloaded, skipped };
    if (!await cacheResponse(url, response, snapshot, start)) return { ok: false, error: 'Owner changed' };
    ++downloaded;
  }
  return { ok: true, downloaded, skipped, total: urls.length };
}

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  await cache.addAll(FILES);
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  await initialized;
  await Promise.all((await caches.keys()).filter(name => name.startsWith(SHELL_PREFIX) && name !== SHELL)
    .map(name => caches.delete(name)));
  if (!validOwner(owner)) await clearPrivate();
  else {
    const activeOwner = owner.owner;
    await Promise.all((await caches.keys()).filter(name => name.startsWith(PRIVATE_PREFIX)
      && name !== PRIVATE_PREFIX + owner.owner).map(name => caches.delete(name)));
    await mutate(async () => {
      if (owner?.owner !== activeOwner) return;
      const cache = await caches.open(PRIVATE_PREFIX + activeOwner);
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname;
        if (path === '/library/catalog.json' || !LIBRARY_PATHS.has(path)) await cache.delete(request);
      }
    });
  }
  await self.clients.claim();
})()));

self.addEventListener('message', event => {
  const port = event.ports?.[0];
  if (!port || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  let result;
  if (message.type === 'OWNER') result = setOwner(message);
  else if (message.type === 'VERSION') result = Promise.resolve({ ok: true, build: BUILD });
  else if (message.type === 'CACHE_CONTENT') result = cacheContent(message);
  else if (message.type === 'CLEAR_PRIVATE') result = clearPrivate().then(() => ({ ok: true }));
  else result = Promise.resolve({ ok: false, error: 'Unknown request' });
  event.waitUntil(result.then(value => port.postMessage(value))
    .catch(() => port.postMessage({ ok: false, error: 'Offline storage unavailable' })));
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (url.origin !== self.location.origin || !['GET', 'HEAD'].includes(request.method)
    || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return; }
  if (path.startsWith('/library/')) { event.respondWith(protectedFetch(request)); return; }
  if (!publicUrl(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    if (request.mode !== 'navigate') {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    try { return await fetch(request); }
    catch {
      return await cache.match(request) || (request.mode === 'navigate' ? await cache.match('/') : null)
        || unavailable('首次使用请先联网打开阅读室。');
    }
  })());
});
