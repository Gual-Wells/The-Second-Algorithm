// Actual reader + isolated HTTP/state, with virtual browser time for checkpoints.
// No production credentials, account, real database, paid service or SW is used.
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.ALGORITHM_SYNC_QA || path.join(root, '.local/service-settings-20261029/sync-after'));
const temporary = path.join(output, 'browser-temp');
const origin = 'http://localhost:9884';
const owner = 's'.repeat(43);
const keyPrefix = `second-algorithm:${owner}:`;
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => value && JSON.parse(JSON.stringify(value));
const sourceFiles = ['web/app.js', 'web/reader-runtime.js', 'web/styles.css', 'web/index.html', 'web/manual-questions.js', 'web/auth.js', 'web/chapter-dates.js', 'web/worker-release.js', 'web/service-settings.js', 'server/worker.mjs'];
const typeOf = file => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' })[path.extname(file)] || 'application/octet-stream';

async function fingerprint() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, sha(await fs.readFile(path.join(root, file)))])));
}
function coordinate(value) {
  if (!value) return null;
  const { capturedAt, ...location } = value;
  return location;
}
function sameCoordinate(actual, expected, label) {
  assert.deepEqual(coordinate(actual), coordinate(expected), label);
}
const hostDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForHostState(page, predicate, label) {
  const deadline = Date.now() + 3500;
  while (!await page.evaluate(predicate)) {
    if (Date.now() >= deadline) throw Error(label);
    // Intercepted browser fetch/body parsing is host I/O, not a virtual timer.
    await hostDelay(25);
  }
}

function corpus() {
  const bodies = new Map();
  const catalog = { schemaVersion: 2, state: 'active', version: 'isolated-reading-sync', collections: [], questions: [] };
  for (const [number, collectionId, id, date] of [[1, 'sync-first', 'sync-a', '2026-10-28'], [2, 'sync-second', 'sync-b', '2026-10-29']]) {
    const headings = [], sections = [];
    for (let i = 0; i < 12; ++i) {
      const title = i ? `第${i}节、独立同步材料` : 'PRE、独立同步材料';
      headings.push({ depth: 2, id: `section-${i}`, text: title });
      sections.push(`<h2 id="section-${i}">${title}</h2><p>${'这是一份测试用的独立自写材料，不是正式教材。'.repeat(45)}</p>`);
      headings.push({ depth: 3, id: `unit-${i}`, text: '（1）方法：位置与状态' });
      sections.push(`<h3 id="unit-${i}">（1）方法：位置与状态</h3><p>${'当前读到的文字需要先保存在本机，然后按检查点保存远端。'.repeat(35)}</p>`);
      headings.push({ depth: 4, id: `code-${i}`, text: '（a）Hcode：独立核验代码' });
      sections.push(`<h4 id="code-${i}">（a）Hcode：独立核验代码</h4><pre><code>int fixture_${i}() { return ${i}; }</code></pre>`);
    }
    const html = sections.join('\n'), revision = sha(html), prefix = `/library/${collectionId}/${id}/${revision.slice(0, 16)}`;
    const meta = { id, title: '读位核验' + number, revision, headings, knowledgeIds: [], url: prefix + '.json', sourceUrl: prefix + '.cpp', markdownUrl: prefix + '.md' };
    bodies.set(meta.url, JSON.stringify({ ...meta, html }));
    bodies.set(meta.sourceUrl, 'int sync_fixture() { return 1; }\n');
    bodies.set(meta.markdownUrl, '# 独立同步材料\n');
    catalog.collections.push({ id: collectionId, kind: 'chapter', chapterNumber: number, title: '同步核验' + number, date, documents: [meta] });
  }
  bodies.set('/library/catalog.json', JSON.stringify(catalog));
  return { catalog, bodies };
}

async function advance(page, milliseconds) {
  // The production 60-second timer is not replaced or shortened. Playwright's
  // clock executes its actual callback in virtual time; host yields allow real
  // intercepted fetch promises to resolve between clock advances.
  await page.clock.runFor(milliseconds);
  await hostDelay(15);
  await page.clock.runFor(48);
  await hostDelay(15);
}

async function environment(browser, compiled, fixture) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(10_000);
  const mock = { state: {}, requests: [], writes: [], errors: [], unexpectedApis: [], offline: false, holdNextPosition: false, held: [] };
  await context.addInitScript(() => {
    delete Navigator.prototype.serviceWorker;
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    window.__setSyncVisibility = value => { hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
    window.__syncRequestTrace = [];
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.pathname === '/api/state' && options.method === 'PUT') {
        window.__syncRequestTrace.push({ at: Date.now(), data: JSON.parse(options.body) });
      }
      return nativeFetch(input, options);
    };
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (url.origin !== origin) return route.abort('blockedbyclient');
    mock.requests.push({ path: pathname, method: request.method() });
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (mock.offline && (pathname.startsWith('/api/') || pathname.startsWith('/auth/'))) return route.abort('internetdisconnected');
    if (pathname === '/auth/status') return json({ authenticated: true, enrolled: true, enrollmentOpen: false, ownerScope: owner });
    if (pathname === '/api/library') return json(fixture.catalog);
    if (pathname === '/api/state') {
      if (request.method() === 'GET') return json({ state: mock.state });
      const input = request.postDataJSON();
      const write = { key: input.key, value: clone(input.value), acknowledged: false };
      mock.writes.push(write);
      if (mock.holdNextPosition && input.key.startsWith('position:')) {
        mock.holdNextPosition = false;
        await new Promise(resolve => mock.held.push(resolve));
      }
      const prior = mock.state[input.key];
      const record = { value: clone(input.value), revision: (prior?.revision || 0) + 1, updatedAt: input.value?.capturedAt || Date.now() };
      mock.state[input.key] = record; write.acknowledged = true;
      return json({ ok: true, key: input.key, ...record, record });
    }
    if (pathname.startsWith('/api/')) {
      mock.unexpectedApis.push(pathname);
      // These are unrelated service snapshots, never successful sync evidence.
      return json({ settings: {}, balances: null, storage: null, notifications: [], automatic: false });
    }
    if (fixture.bodies.has(pathname)) return route.fulfill({ contentType: typeOf(pathname), body: fixture.bodies.get(pathname) });
    if (pathname === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: compiled });
    const file = path.join(root, 'web', pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1)));
    try { return route.fulfill({ contentType: typeOf(file), body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: 'Missing isolated fixture asset' }); }
  });
  const page = await context.newPage(); page.on('pageerror', error => mock.errors.push(error.message));
  const started = Date.now();
  await page.clock.install({ time: new Date(started - 60_000) });
  await page.goto(origin + '/#/read/sync-first/sync-a');
  await page.locator('#article #section-0').waitFor();
  await page.waitForFunction(() => window.__syncQA?.runtime?.state.view === 'reader' && !window.__syncQA.runtime.state.restoring);
  await page.clock.pauseAt(new Date(started + 120_000));
  await advance(page, 65_000);
  mock.writes.length = 0;
  await page.evaluate(() => { __syncRequestTrace.length = 0; });
  return { context, page, mock, release() { for (const release of mock.held.splice(0)) release(); }, async close() { this.release(); await context.close(); } };
}

async function point(page) {
  return page.evaluate(() => {
    const state = __syncQA.state, id = state.active.meta.id, prefix = `second-algorithm:${state.owner}:`;
    return { id, owner: state.owner, hash: location.hash, scrollTop: document.querySelector('#readingPane').scrollTop,
      position: __syncQA.runtime.position, local: JSON.parse(localStorage.getItem(prefix + 'position:' + id)),
      record: state.records['position:' + id], history: history.state?.readingPosition,
      footer: document.querySelector('#syncStatus').textContent, lampOffline: document.querySelector('#statusLamp').classList.contains('offline'),
      virtualAt: Date.now() };
  });
}
const positions = env => env.mock.writes.filter(write => write.key.startsWith('position:'));
async function scroll(env, amount) {
  await env.page.locator('#readingPane').evaluate((element, amount) => { element.scrollTop += amount; }, amount);
  // Native compositor scroll delivery uses host browser frames. Let that real
  // event enqueue its production RAF before advancing the virtual timer clock.
  await hostDelay(30);
  await advance(env.page, 500);
}
async function resize(env) {
  await env.page.evaluate(() => dispatchEvent(new Event('resize')));
  await advance(env.page, 500);
}
async function hidden(env, value) {
  await env.page.evaluate(value => __setSyncVisibility(value), value);
  await advance(env.page, 500);
}

(async () => {
  if (process.platform === 'win32' && !/^D:[\\/]/i.test(await fs.realpath(root))) throw Error('Sync QA must physically reside on D.');
  await fs.mkdir(temporary, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
  const { publicationIndex } = await import(pathToFileURL(path.join(root, 'scripts/build-carrier.mjs')).href);
  const fixture = corpus(), inputStart = await fingerprint();
  const probe = '\nglobalThis.__syncQA={get state(){return S;},get runtime(){return runtime;},get observedLocation(){return observedLocation;}};\n';
  const bundle = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, define: { __PUBLICATION_INDEX__: JSON.stringify(publicationIndex(fixture.catalog)) } });
  const compiled = bundle.outputFiles[0].text + probe;
  const browser = await chromium.launch({ headless: true, ...(process.env.ALGORITHM_QA_CHROME ? { executablePath: process.env.ALGORITHM_QA_CHROME } : {}), env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary } });
  const results = [], failures = [];
  async function check(name, action) {
    let env;
    try {
      env = await environment(browser, compiled, fixture);
      const evidence = await action(env); assert.deepEqual(env.mock.errors, []);
      results.push({ name, passed: true, evidence, positionPuts: positions(env).length,
        requestTrace: await env.page.evaluate(() => __syncRequestTrace), unexpectedApis: [...new Set(env.mock.unexpectedApis)] });
      console.log('PASS', name);
    } catch (error) {
      failures.push({ name, error: error.stack });
      results.push({ name, passed: false, error: error.message,
        evidence: env ? { point: await point(env.page).catch(() => null), writes: clone(env.mock.writes), requests: clone(env.mock.requests), trace: await env.page.evaluate(() => __syncRequestTrace).catch(() => []) } : null }); console.error('FAIL', name, error.message);
      if (env) { await env.page.screenshot({ path: path.join(output, name + '.png'), scale: 'css' }).catch(() => {}); }
    } finally { await env?.close(); }
  }
  try {
    await check('unchanged-resize-never-dirties-or-uploads-position', async env => {
      const before = await point(env.page);
      for (let i = 0; i < 6; ++i) { await resize(env); await advance(env.page, 1500); }
      const after = await point(env.page);
      sameCoordinate(after.local, before.local, 'same location must stay locally durable');
      assert.equal(positions(env).length, 0, 'timestamp-only captures must not create PUTs');
      assert.equal(after.record?.dirty, false, 'unchanged captures must not leave a false cloud backlog');
      assert.equal(after.footer, before.footer, 'normal same-position resize must not change sync meaning');
      assert.equal(after.lampOffline, before.lampOffline);
      return { before, after, resizeEvents: 6 };
    });
    await check('continuous-scrolling-uses-bounded-sixty-second-checkpoint', async env => {
      const before = await point(env.page), started = before.virtualAt;
      for (let i = 0; i < 10; ++i) { await scroll(env, 30); await advance(env.page, 4500); }
      assert.equal(positions(env).length, 0, '50 seconds of normal reading must not stream cloud PUTs');
      for (let i = 0; i < 3; ++i) { await scroll(env, 30); await advance(env.page, 4500); }
      const after = await point(env.page);
      assert.equal(positions(env).length, 1, 'continuous changes must not postpone the checkpoint indefinitely or send bursts');
      assert(after.local && after.local.block, 'current position must be durable locally');
      assert(Math.abs(after.local.offset - after.position.offset) < 2, 'local/current heading coordinate preserved');
      const trace = await env.page.evaluate(() => __syncRequestTrace.filter(item => item.data.key.startsWith('position:')));
      assert(trace[0].at - started >= 50_000 && trace[0].at - started <= 65_500, 'checkpoint must be near the real configured one-minute boundary');
      return { started, before, after, automaticPuts: positions(env).length, firstCheckpointMs: trace[0].at - started };
    });
    await check('slow-request-coalesces-new-position-without-immediate-followup-loop', async env => {
      await scroll(env, 70); env.mock.holdNextPosition = true;
      await hidden(env, true);
      assert.equal(positions(env).length, 1, 'backgrounding sends one current snapshot');
      assert.equal(env.mock.held.length, 1);
      await hidden(env, false);
      for (let i = 0; i < 8; ++i) { await scroll(env, 10); await advance(env.page, 400); }
      const newest = await point(env.page);
      env.release(); await advance(env.page, 1000);
      assert.equal(positions(env).length, 1, 'an ACK must not turn pending position changes into an immediate while loop');
      const retained = await point(env.page); sameCoordinate(retained.local, newest.local, 'old ACK must not overwrite current local coordinate');
      assert.equal(retained.record?.dirty, true, 'newer movement must remain pending for its next checkpoint');
      await hidden(env, true);
      assert.equal(positions(env).length, 2, 'a later explicit lifecycle flush stores the latest coalesced location');
      sameCoordinate(env.mock.state['position:sync-a'].value, retained.local, 'final remote coordinate is the newest local coordinate');
      await hidden(env, true);
      assert.equal(positions(env).length, 2, 'an identical lifecycle capture must not send a timestamp-only duplicate');
      return { newest, retained, remote: env.mock.state['position:sync-a'] };
    });
    await check('offline-reading-keeps-local-history-and-recovers-one-latest-snapshot', async env => {
      env.mock.offline = true; await env.page.evaluate(() => dispatchEvent(new Event('offline')));
      for (let i = 0; i < 5; ++i) { await scroll(env, 45); await advance(env.page, 2000); }
      await advance(env.page, 65_000);
      const offline = await point(env.page); assert.equal(positions(env).length, 0, 'offline must not attempt remote position writes');
      assert.equal(offline.record?.dirty, true); sameCoordinate(offline.history, offline.local, 'offline browser history remains current');
      env.mock.offline = false; await env.page.evaluate(() => dispatchEvent(new Event('online')));
      // Auth is real host fetch I/O. Do not jump the fake clock across its
      // production 20-second timeout before that host response can arrive.
      await waitForHostState(env.page, () => !__syncQA.state.offline && !__syncQA.state.records['position:sync-a']?.dirty, 'online snapshot did not finish acknowledging');
      await advance(env.page, 65_000);
      assert.equal(positions(env).length, 1, 'recovery must coalesce the backlog into one latest snapshot instead of replaying scrolls or duplicate flushes');
      const resumed = await point(env.page); sameCoordinate(resumed.local, offline.local, 'reconnect preserves exact local reading coordinate');
      sameCoordinate(env.mock.state['position:sync-a'].value, offline.local, 'remote recovery stores the latest coordinate');
      assert.equal(resumed.record?.dirty, false);
      return { offline, resumed, remote: env.mock.state['position:sync-a'] };
    });
    await check('chapter-change-flushes-old-document-and-new-local-position-stays-separate', async env => {
      await scroll(env, 120); const old = await point(env.page);
      await env.page.locator('#nextChapter').click(); await advance(env.page, 800);
      const next = await point(env.page); assert.equal(next.id, 'sync-b');
      sameCoordinate(env.mock.state['position:sync-a']?.value, old.local, 'old chapter must be checkpointed at a chapter boundary');
      assert.equal(next.local.revision, fixture.catalog.collections[1].documents[0].revision);
      assert.equal(env.mock.writes.filter(item => item.key === 'position:sync-a').length, 1, 'old document flush is coalesced');
      await hidden(env, true);
      sameCoordinate(env.mock.state['position:sync-b'].value, (await point(env.page)).local, 'new chapter checkpoint stays under its own key');
      return { old, next, writtenKeys: env.mock.writes.map(item => item.key) };
    });
    await check('pagehide-and-user-preferences-flush-without-waiting-a-minute', async env => {
      await scroll(env, 90); const current = await point(env.page);
      await env.page.evaluate(() => dispatchEvent(new Event('pagehide'))); await advance(env.page, 500);
      sameCoordinate(env.mock.state['position:sync-a']?.value, current.local, 'leaving should attempt the latest snapshot after local persistence');
      await env.page.locator('#settingsButton').click(); await advance(env.page, 100);
      await env.page.locator('[data-show-reading-settings]').click(); await advance(env.page, 100);
      const oldSize = Number(await env.page.locator('#bodySizeOutput').textContent());
      await env.page.locator('[data-font="1"]').click();
      await advance(env.page, 1000);
      assert.equal(env.mock.state.preferences?.value.fontSize, oldSize + 1, 'explicit preference save remains timely');
      return { current, preferences: env.mock.state.preferences, positionPuts: positions(env).length, preferencePuts: env.mock.writes.filter(item => item.key === 'preferences').length };
    });
  } finally { await browser.close(); }
  const inputEnd = await fingerprint();
  if (JSON.stringify(inputStart) !== JSON.stringify(inputEnd)) failures.push({ name: 'immutable-inputs', error: 'Reader inputs changed while sync regression was running.' });
  const report = { passed: failures.length === 0, results, failures, inputStart, inputEnd, testedAt: new Date().toISOString(),
    runtime: 'actual current web app bundled with a synthetic immutable two-chapter catalog',
    time: 'Playwright virtual clock runs original production timers, including the full 60-second checkpoint; no timer duration substitution',
    network: 'actual fetch calls with isolated in-memory responses; delayed ACKs explicitly held and released',
    productionContacted: false, realDatabaseModified: false, paidServiceContacted: false, serviceWorker: 'blocked; tested separately', physicalIPhone: false };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, cases: results.length, failures: failures.map(item => item.name), output: path.relative(root, output) }));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
