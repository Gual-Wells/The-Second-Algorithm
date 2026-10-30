// Real reader sources and the built protected chapter, with isolated owner/API
// state. No production account, database, provider or system passkey is used.
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.ALGORITHM_EXTENSION_QA || path.join(root, '.local/carrier-extension'));
const temporary = path.join(output, 'browser-temp');
const origin = 'http://localhost:9887', owner = 'e'.repeat(43), otherOwner = 'f'.repeat(43);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sourceFiles = ['web/app.js', 'web/reader-runtime.js', 'web/styles.css', 'web/index.html', 'server/worker.mjs',
  'dist/index.html', 'dist/app.js', 'dist/styles.css', 'dist/library/catalog.json'];
const typeOf = file => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' })[path.extname(file)] || 'text/plain';
const extensionIds = ['time-parallel-search', 'dynamic-range-kth', 'marginal-penalty'];
let catalog, chapter, meta, payload, compiled, makeIndex;
const results = [], failures = [], geometry = [];
async function fingerprint() { return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, sha(await fs.readFile(path.join(root, file)))]))); }
async function wait(page) { await page.waitForFunction(() => window.__extensionQA?.runtime?.state.view === 'reader' && !window.__extensionQA.runtime.state.restoring); await page.waitForTimeout(230); }
async function point(page) { return page.evaluate(() => ({ ...__extensionQA.runtime.position, scrollTop: document.getElementById('readingPane').scrollTop })); }
async function anchor(page, id) { return page.evaluate(id => __extensionQA.runtime.resolveAnchor(id), id); }
async function anchors(page, ids) { return page.evaluate(ids => ids.map(id => __extensionQA.runtime.resolveAnchor(id)), ids); }
async function closeSheet(page) {
  if (await page.locator('#sheetDialog').evaluate(node => node.open)) {
    await page.locator('[data-sheet-close]').click();
    await page.waitForFunction(() => !document.getElementById('sheetDialog').open);
    await wait(page);
  }
}
async function jump(page, id) {
  await closeSheet(page); await page.locator('#sectionIndexButton').click();
  const canonical = await anchor(page, id); assert(canonical, 'known stable author anchor ' + id);
  const button = page.locator(`[data-index-go="${canonical}"]`);
  if (!await button.isVisible()) {
    const parent = await button.evaluate(node => node.closest('[data-directory-section]').dataset.directorySection);
    await page.locator(`[data-toggle-index-section="${parent}"]`).click();
  }
  await button.click(); await wait(page);
  assert.equal((await point(page)).anchor, canonical, 'directory jump reaches its original anchor');
}
async function switchTab(page, layer) {
  await page.locator(`[data-reading-layer="${layer}"]`).click();
  await wait(page);
  assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), layer);
}
async function visibleH2(page) { return page.locator('#article h2[id]').evaluateAll(nodes => nodes.filter(node => !node.closest('[hidden]')).map(node => node.id)); }
async function scrollBy(page, distance) {
  await page.locator('#readingPane').evaluate((node, distance) => { node.scrollTop += distance; }, distance);
  await page.waitForTimeout(260);
}
async function clearSelection(page) { await page.evaluate(() => getSelection()?.removeAllRanges()); }
async function pure(page) { return page.evaluate(() => __extensionQA.runtime.state.pure); }
async function blankPoint(page, edge = 'middle') {
  const result = await page.evaluate(edge => {
    const paper = document.getElementById('article').getBoundingClientRect(), pane = document.getElementById('readingPane').getBoundingClientRect();
    const x = paper.left + 3, y = edge === 'top' ? pane.top + 12 : edge === 'bottom' ? pane.bottom - 16 : pane.top + Math.min(180, pane.height / 2);
    return { x, y, hit: document.elementFromPoint(x, y)?.id };
  }, edge);
  assert(['article', 'readingPane'].includes(result.hit), 'gesture starts on real reading padding: ' + JSON.stringify(result));
  return result;
}
async function doubleTapAt(page, location, afterFirst = null) {
  await page.touchscreen.tap(location.x, location.y); await page.waitForTimeout(75);
  await afterFirst?.(location);
  await page.touchscreen.tap(location.x, location.y); await wait(page); await page.waitForTimeout(300);
}
async function doubleTap(page, edge = 'middle', afterFirst = null) {
  return doubleTapAt(page, await blankPoint(page, edge), afterFirst);
}
async function textPoint(page) {
  return page.evaluate(() => {
    const pane = document.getElementById('readingPane').getBoundingClientRect();
    for (const paragraph of document.querySelectorAll('#article p')) {
      if (paragraph.closest('[hidden]')) continue;
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || node.parentElement.closest('a,pre,code,table,button')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 40 || rect.top <= pane.top + 70 || rect.bottom >= pane.bottom - 30) continue;
          const x = rect.left + Math.min(25, rect.width / 2), y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          if (hit?.closest('p') === paragraph && !hit.closest('a,pre,code,table,button')) return { x, y, hit: hit.tagName };
        }
      }
    }
    throw Error('actual chapter needs visible ordinary paragraph text for the touch reading gesture');
  });
}
async function paperPosition(page, block = null) {
  return page.evaluate(block => {
    const current = block ?? __extensionQA.runtime.position.block.index;
    const node = document.querySelector(`[data-read-block="${current}"]`);
    return { block: current, top: node.getBoundingClientRect().top, width: document.getElementById('article').getBoundingClientRect().width };
  }, block);
}
function samePaper(before, after) {
  assert(Math.abs(before.top - after.top) < 2 && Math.abs(before.width - after.width) < 1,
    'gesture preserves physical text coordinate and paper width: ' + JSON.stringify({ before, after }));
}
async function frameCheckedTouchToggle(page, mode, label) {
  const location = mode === 'text' ? await textPoint(page) : await blankPoint(page);
  await page.touchscreen.tap(location.x, location.y); await page.waitForTimeout(75);
  await page.evaluate(({ location, label }) => {
    const pane = document.getElementById('readingPane'), article = document.getElementById('article'), tools = document.getElementById('articleTools');
    const state = __extensionQA.runtime.state, bounds = pane.getBoundingClientRect();
    const visibleTop = bounds.top + (!state.pure && tools.offsetParent ? tools.getBoundingClientRect().height : 0);
    const clicked = document.elementFromPoint(location.x, location.y)?.closest('[data-read-block]');
    const node = clicked && article.contains(clicked) && !clicked.closest('[hidden]') ? clicked
      : [...article.querySelectorAll('[data-read-block]')].find(node => {
        const rect = node.getBoundingClientRect(); return !node.closest('[hidden]') && rect.bottom > visibleTop && rect.top < bounds.bottom;
      }) || article;
    const snapshot = phase => {
      const rect = node.getBoundingClientRect();
      return { phase, top: rect.top, origin: rect.top + pane.scrollTop, scrollTop: pane.scrollTop,
        maxScroll: Math.max(0, pane.scrollHeight - pane.clientHeight), width: article.getBoundingClientRect().width,
        pure: __extensionQA.runtime.state.pure, restoring: __extensionQA.runtime.state.restoring };
    };
    const trace = { label, location, expectedPure: !state.pure, block: node.dataset.readBlock, before: snapshot('before'), rows: [] };
    window.__pureFrameTrace = trace;
    const sample = phase => {
      const row = snapshot(phase), requested = trace.before.scrollTop + row.origin - trace.before.origin;
      row.requestedScroll = requested; row.expectedScroll = Math.max(0, Math.min(row.maxScroll, requested));
      row.scrollError = row.scrollTop - row.expectedScroll; row.clamped = row.expectedScroll !== requested;
      trace.rows.push(row);
    };
    // Registered after runtime: this listener observes the very same physical
    // pointerup after its toggle, then every following paint opportunity.
    window.addEventListener('pointerup', () => {
      sample('same-pointerup'); queueMicrotask(() => sample('microtask'));
      let index = 0;
      const frame = () => { sample('raf-' + (++index)); if (index < 8) requestAnimationFrame(frame); else trace.done = true; };
      requestAnimationFrame(frame);
    }, { once: true });
  }, { location, label });
  await page.touchscreen.tap(location.x, location.y);
  await page.waitForFunction(() => window.__pureFrameTrace?.done);
  const trace = await page.evaluate(() => window.__pureFrameTrace);
  geometry.push({ scenario: 'pure-touch-paint-frames', ...trace });
  await fs.writeFile(path.join(output, label + '-frames.json'), JSON.stringify(trace, null, 2) + '\n');
  for (const row of trace.rows) {
    assert.equal(row.pure, trace.expectedPure, label + ' changes mode in the same physical event');
    assert(Math.abs(row.scrollError) <= 1, label + ' compensates before any paint: ' + JSON.stringify(row));
    assert(Math.abs(row.width - trace.before.width) < 1, label + ' preserves paper width in every frame');
    if (!row.clamped) assert(Math.abs(row.top - trace.before.top) <= 1, label + ' keeps absolute text Y before every paint');
  }
  return trace;
}
async function touchSequence(page, kind) {
  const session = await page.context().newCDPSession(page), location = await blankPoint(page);
  const finger = (x, y, id = 0) => ({ x, y, id, radiusX: 1, radiusY: 1, force: .5 });
  const start = (points) => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  const end = () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  try {
    await page.touchscreen.tap(location.x, location.y); await page.waitForTimeout(75);
    if (kind === 'multiple') {
      await start([finger(location.x, location.y), finger(location.x + 45, location.y + 25, 1)]);
      await page.waitForTimeout(60); await end();
    } else {
      await start([finger(location.x, location.y)]);
      if (kind === 'hold') await page.waitForTimeout(700);
      else {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [finger(location.x, location.y + 32)] });
        await page.waitForTimeout(80);
      }
      await end();
    }
    await page.waitForTimeout(450);
  } finally { await session.detach(); }
}

async function environment(browser, { initial = {}, states = new Map(), identity = owner, omitExtensions = false, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3,
    hasTouch: touch, isMobile: touch, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10_000);
  const servedCatalog = clone(catalog);
  let noExtensionPayload, noExtensionURL, application = compiled;
  if (omitExtensions) {
    // An explicit no-extension publication fixture, retaining the actual text
    // but with its own metadata revision and matching publication index.
    const fixtureMeta = servedCatalog.collections.find(item => item.id === chapter.id).documents.find(item => item.id === meta.id);
    fixtureMeta.revision = sha(JSON.stringify({ html: payload.html, extensions: [], fixture: 'no-extension' }));
    fixtureMeta.extensions = []; fixtureMeta.url = '/library/isolated-no-extension/' + fixtureMeta.revision + '.json';
    noExtensionURL = fixtureMeta.url; noExtensionPayload = { ...payload, ...fixtureMeta, extensions: [] };
    const noExtensionBuild = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false,
      format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent', define: { __PUBLICATION_INDEX__: JSON.stringify(makeIndex(servedCatalog)) } });
    application = noExtensionBuild.outputFiles[0].text + '\nglobalThis.__extensionQA={get runtime(){return runtime},get state(){return S},get reconnecting(){return reconnecting}};\n';
  }
  const mock = { identity, states, requests: [], writes: [], errors: [], offline: false, rejectWrites: false };
  await context.addInitScript(initial => {
    delete Navigator.prototype.serviceWorker;
    if (location.origin !== 'http://localhost:9887') return;
    if (!localStorage.getItem('__extensionSeed')) { for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, value); localStorage.setItem('__extensionSeed', 'yes'); }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (window.__rejectSectionStorage && /:records$/.test(key) && Object.keys(JSON.parse(value)).some(key => key.startsWith('section:')))
        throw new DOMException('Isolated quota failure', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, initial);
  context.on('page', page => { page.on('pageerror', error => mock.errors.push(error.message)); page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (url.origin !== origin) return route.abort('blockedbyclient');
    mock.requests.push({ path: pathname, method: request.method() });
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (mock.offline && (pathname.startsWith('/api/') || pathname.startsWith('/auth/'))) return route.abort('internetdisconnected');
    if (pathname === '/auth/status') return json({ authenticated: Boolean(mock.identity), enrolled: true, enrollmentOpen: false, ownerScope: mock.identity });
    if ((pathname.startsWith('/api/') || pathname.startsWith('/library/')) && !mock.identity) return json({ error: 'Unauthorized' }, 401);
    if (pathname === '/api/library') return json(servedCatalog);
    if (pathname === '/api/state') {
      const state = states.get(mock.identity) || {}; states.set(mock.identity, state);
      if (request.method() === 'GET') return json({ state });
      if (mock.rejectWrites) return json({ error: 'Isolated state write failure' }, 503);
      const input = request.postDataJSON(), previous = state[input.key];
      const record = { value: clone(input.value), revision: (previous?.revision || 0) + 1, updatedAt: Date.now() };
      state[input.key] = record; mock.writes.push({ owner: mock.identity, key: input.key, record: clone(record) });
      return json({ ok: true, key: input.key, ...record, record });
    }
    if (pathname === '/api/questions/status') return json({ unread: 0 });
    if (pathname === '/api/questions/summary') return json({ threads: [] });
    if (pathname === '/api/settings') return json({ revision: 1, goal: '', restRequested: true, temporaryRequested: false, temporaryRequestText: '', automation: { configured: false, activeRun: null } });
    if (pathname === '/api/balances') return json({ verified: false, remainingAmount: null });
    if (pathname === '/api/storage/usage') return json({ verified: false, pools: [] });
    if (pathname === '/api/push/status') return json({ configured: false, deviceCount: 0 });
    if (pathname.startsWith('/api/')) return json({ error: 'Unexpected isolated API route' }, 404);
    if (pathname === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: application });
    if (pathname === noExtensionURL) return json(noExtensionPayload);
    const filename = path.join(root, pathname.startsWith('/library/') ? 'dist' : 'web', pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1)));
    try { return route.fulfill({ contentType: typeOf(filename), body: await fs.readFile(filename) }); }
    catch { return route.fulfill({ status: 404, body: 'Missing isolated asset' }); }
  });
  const page = await context.newPage();
  await page.goto(`${origin}/#/read/${chapter.id}/${meta.id}`);
  try { await wait(page); }
  catch (error) {
    await fs.writeFile(path.join(output, 'bootstrap-failure.json'), JSON.stringify({ message: error.message, errors: mock.errors,
      requests: mock.requests, body: await page.locator('body').innerText(), state: await page.evaluate(() => ({ hasProbe: Boolean(window.__extensionQA), state: window.__extensionQA?.state, runtime: window.__extensionQA?.runtime?.state })) }, null, 2) + '\n');
    await page.screenshot({ path: path.join(output, 'bootstrap-failure.png') }).catch(() => {});
    await context.close(); throw error;
  }
  return { context, page, mock };
}

async function check(browser, name, body, options = {}) {
  if (process.env.ALGORITHM_EXTENSION_CASE && !new RegExp(process.env.ALGORITHM_EXTENSION_CASE).test(name)) return;
  console.log('Extension QA: ' + name);
  const env = await environment(browser, options);
  try { await body(env); assert.deepEqual(env.mock.errors, [], 'no browser exceptions'); results.push({ name, passed: true }); }
  catch (error) {
    failures.push({ name, message: error.message, stack: error.stack }); results.push({ name, passed: false });
    console.error(name + ': ' + error.message);
    await env.page.screenshot({ path: path.join(output, name + '-failure.png') }).catch(() => {});
    await fs.writeFile(path.join(output, name + '-failure.txt'), await env.page.locator('body').innerText()).catch(() => {});
  } finally { await env.context.close(); await fs.writeFile(path.join(output, 'checkpoint.json'), JSON.stringify({ results, failures }, null, 2) + '\n'); }
}

(async () => {
  await fs.mkdir(temporary, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
  makeIndex = (await import('./build-carrier.mjs')).publicationIndex;
  catalog = JSON.parse(await fs.readFile(path.join(root, 'dist/library/catalog.json'), 'utf8'));
  chapter = catalog.collections.find(item => item.id === 'chapter-01'); assert(chapter, 'built first chapter exists');
  meta = chapter.documents.find(item => item.id === 'binary-search'); assert(meta, 'built binary-search exists');
  payload = JSON.parse(await fs.readFile(path.join(root, 'dist', meta.url.slice(1)), 'utf8'));
  assert.deepEqual(payload.extensions.map(item => item.sectionId), extensionIds, 'built publication contains exactly the reviewed extension sections');
  const sourceStart = await fingerprint();
  const build = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    define: { __PUBLICATION_INDEX__: JSON.stringify(makeIndex(catalog)) } });
  compiled = build.outputFiles[0].text + '\nglobalThis.__extensionQA={get runtime(){return runtime},get state(){return S},get reconnecting(){return reconnecting}};\n';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.ALGORITHM_QA_CHROME,
    env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary },
    args: ['--disk-cache-dir=' + path.join(temporary, 'disk-cache'), '--disable-background-networking', '--no-first-run'] });
  try {
    await check(browser, 'built-body-partition-and-exact-conservation', async ({ page }) => {
      const expected = await page.evaluate(html => { const doc = new DOMParser().parseFromString(html, 'text/html'); return {
        headings: [...doc.querySelectorAll('h2[id],h3[id],h4[id]')].map(node => ({ id: node.id, depth: +node.tagName.slice(1), text: node.textContent })),
        code: [...doc.querySelectorAll('pre code')].map(node => node.textContent),
        links: [...doc.querySelectorAll('a[href]')].map(node => [node.getAttribute('href'), node.textContent]) }; }, payload.html);
      const actual = await page.locator('#article').evaluate(node => ({
        headings: [...node.querySelectorAll('h2[id],h3[id],h4[id]')].map(node => ({ id: node.id, depth: +node.tagName.slice(1), text: node.textContent })),
        code: [...node.querySelectorAll('pre code')].map(node => node.textContent),
        links: [...node.querySelectorAll('a[href]')].map(node => [node.getAttribute('href'), node.textContent]),
        blocks: [...node.querySelectorAll('[data-read-block]')].map(node => +node.dataset.readBlock) }));
      assert.equal(actual.headings.length, payload.headings.length); assert.deepEqual(actual.headings, expected.headings);
      assert.deepEqual(actual.code, expected.code); assert.deepEqual(actual.links, expected.links);
      assert.equal(new Set(actual.headings.map(node => node.id)).size, payload.headings.length);
      assert.deepEqual(actual.blocks, actual.blocks.map((_, index) => index), 'one original global block sequence');
      assert.equal((await visibleH2(page)).length, 35); assert.equal(await page.locator('.extension-meta:visible').count(), 0);
      await switchTab(page, 'extension'); assert.deepEqual(await visibleH2(page), await anchors(page, extensionIds));
      assert.equal(await page.locator('.extension-meta:visible').count(), 3);
      assert.equal(await page.locator('#article h2[id]').count(), 38, 'switching never reparses or duplicates the DOM');
      const source = await page.evaluate(async url => ({ status: (await fetch(url)).status, text: await (await fetch(url)).text() }), meta.sourceUrl);
      assert.equal(source.status, 200); assert.equal(source.text, await fs.readFile(path.join(root, 'dist', meta.sourceUrl.slice(1)), 'utf8'));
      assert.equal(await anchor(page, 'scode-用min截断每行计数'), await anchor(page, 'multiplication-rank-manual'), 'retired fine-grained Scode heading keeps a working alias');
      assert.equal(await anchor(page, 'multiplication-rank-standard'), await anchor(page, 'multiplication-rank-manual'));
      assert.equal(await anchor(page, 'scode-用标准设施组织查询状态'), await anchor(page, 'time-parallel-search-engineering'));
      assert.equal(await anchor(page, 'time-parallel-search-standard'), await anchor(page, 'time-parallel-search-engineering'));
    });
    await check(browser, 'shared-directory-and-cross-layer-links', async ({ page }) => {
      await page.locator('#sectionIndexButton').click();
      assert.equal(await page.locator('[data-directory-section]').count(), 38);
      assert.deepEqual(await page.locator('[data-directory-section].is-extension').evaluateAll(nodes => nodes.map(node => node.dataset.directorySection)), await anchors(page, extensionIds));
      assert.equal(await page.locator('[data-index-go]').count(), payload.headings.length);
      const shadow = await page.locator(`[data-directory-section="${await anchor(page, 'dynamic-range-kth')}"]`).evaluate(node => getComputedStyle(node).boxShadow);
      assert.notEqual(shadow, 'none', 'extension group has the requested coordinated shadow');
      await page.screenshot({ path: path.join(output, 'shared-directory-402.png') });
      await closeSheet(page); await jump(page, 'dynamic-range-kth-partition');
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension');
      await page.locator('#sectionIndexButton').click(); await page.screenshot({ path: path.join(output, 'shared-directory-extension-402.png') }); await closeSheet(page);
      await jump(page, 'prelude'); assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
      const crossLayer = page.locator('#article a[href]').filter({ hasText: '值域分治' }).first();
      assert.match(await crossLayer.getAttribute('href'), /(?:[?&]anchor=|#)dynamic-range-kth(?:&|$)/);
      await crossLayer.click(); await wait(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension');
      assert.equal((await point(page)).anchor, await anchor(page, 'dynamic-range-kth'));
      const dependency = page.locator('#article a[href]').filter({ hasText: '前面的 FrequencyTree' }).first();
      assert.match(await dependency.getAttribute('href'), /(?:[?&]anchor=|#)fenwick-rank-manual(?:&|$)/);
      await dependency.click(); await wait(page);
      assert.equal((await point(page)).anchor, await anchor(page, 'fenwick-rank-manual'));
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
    });
    await check(browser, 'independent-tab-reading-coordinates', async ({ page }) => {
      await jump(page, 'ordered-dp-frontier'); await scrollBy(page, 187); const main = await point(page);
      await switchTab(page, 'extension'); await jump(page, 'dynamic-range-kth'); await scrollBy(page, 193); const extension = await point(page);
      assert(main.block && extension.block);
      await switchTab(page, 'main'); const returnedMain = await point(page);
      assert.equal(returnedMain.block.index, main.block.index, 'main tab retains its exact block');
      assert(Math.abs(returnedMain.block.offset - main.block.offset) < 2, 'main tab retains its within-block offset');
      await switchTab(page, 'extension'); const returnedExtension = await point(page);
      assert.equal(returnedExtension.block.index, extension.block.index, 'extension tab retains its exact block');
      assert(Math.abs(returnedExtension.block.offset - extension.block.offset) < 2, 'extension tab retains its within-block offset');
    });
    await check(browser, 'cross-layer-directory-retains-both-origin-coordinates', async ({ page }) => {
      await jump(page, 'ordered-dp-frontier'); await scrollBy(page, 187); const main = await point(page);
      await jump(page, 'dynamic-range-kth'); await scrollBy(page, 193); const extension = await point(page);
      assert(main.block && extension.block);
      await switchTab(page, 'main'); let actual = await point(page);
      assert.equal(actual.block.index, main.block.index, 'cross-layer directory departure remembers main block');
      assert(Math.abs(actual.block.offset - main.block.offset) < 2, 'cross-layer directory departure remembers main offset');
      await page.goBack(); await wait(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension', 'browser history follows the saved extension position');
      actual = await point(page);
      assert.equal(actual.block.index, extension.block.index, 'history returns to extension block');
      assert(Math.abs(actual.block.offset - extension.block.offset) < 2, 'history returns to extension offset');
      await switchTab(page, 'main'); actual = await point(page);
      assert.equal(actual.block.index, main.block.index); assert(Math.abs(actual.block.offset - main.block.offset) < 2);
    });
    await check(browser, 'restore-one-section-persist-and-owner-isolation', async ({ page, mock }) => {
      await jump(page, 'dynamic-range-kth'); await page.locator('[data-restore-section="dynamic-range-kth"]').click(); await wait(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
      assert.equal((await point(page)).anchor, await anchor(page, 'dynamic-range-kth'));
      assert.equal((await visibleH2(page)).length, 36); assert.equal(await page.locator('[data-restore-section="dynamic-range-kth"]').count(), 0);
      await page.locator('#sectionIndexButton').click();
      assert.deepEqual(await page.locator('.directory-group.is-extension').evaluateAll(nodes => nodes.map(node => node.dataset.directorySection)), await anchors(page, ['time-parallel-search', 'marginal-penalty']));
      assert.equal(await page.locator(`[data-directory-section="${await anchor(page, 'fenwick-rank')}"].is-extension`).count(), 0); await closeSheet(page);
      const order = await page.locator('#article h2[id]').evaluateAll(nodes => nodes.map(node => node.id));
      const [pbs, overall, penalty] = await anchors(page, extensionIds);
      assert(order.indexOf(pbs) < order.indexOf(overall) && order.indexOf(overall) < order.indexOf(penalty));
      await page.waitForFunction(() => Object.keys(__extensionQA.state.records).filter(key => key.startsWith('section:')).every(key => !__extensionQA.state.records[key].dirty));
      assert.equal(mock.writes.filter(write => write.key.startsWith('section:')).length, 1, 'one section produces one independent state record');
      await page.reload(); await wait(page); await switchTab(page, 'extension'); assert.deepEqual(await visibleH2(page), await anchors(page, ['time-parallel-search', 'marginal-penalty']));
      mock.identity = otherOwner; await page.reload(); await wait(page); await switchTab(page, 'extension');
      assert.deepEqual(await visibleH2(page), await anchors(page, extensionIds), 'another owner never inherits restored sections');
      mock.identity = owner; await page.reload(); await wait(page); await switchTab(page, 'extension');
      assert.deepEqual(await visibleH2(page), await anchors(page, ['time-parallel-search', 'marginal-penalty']));
    });
    await check(browser, 'offline-restoration-reconnect-and-cloud-device', async ({ page, mock }) => {
      mock.offline = true; await page.evaluate(() => dispatchEvent(new Event('offline')));
      await jump(page, 'time-parallel-search'); await page.locator('[data-restore-section="time-parallel-search"]').click(); await wait(page);
      assert.equal((await visibleH2(page)).length, 36);
      assert.equal(mock.writes.filter(write => write.key.startsWith('section:')).length, 0);
      assert.equal(await page.evaluate(() => Object.values(__extensionQA.state.records).filter(record => record.value?.section === 'time-parallel-search')[0].dirty), true);
      mock.offline = false; await page.evaluate(() => dispatchEvent(new Event('online')));
      await page.waitForFunction(() => !__extensionQA.reconnecting && Object.entries(__extensionQA.state.records).some(([key, record]) => key.startsWith('section:') && !record.dirty));
      const second = await environment(browser, { states: mock.states });
      try { await switchTab(second.page, 'extension'); assert.deepEqual(await visibleH2(second.page), await anchors(second.page, ['dynamic-range-kth', 'marginal-penalty'])); }
      finally { await second.context.close(); }
    });
    await check(browser, 'local-save-failure-never-moves-section', async ({ page, mock }) => {
      await jump(page, 'dynamic-range-kth'); await page.evaluate(() => { window.__rejectSectionStorage = true; });
      await page.locator('[data-restore-section="dynamic-range-kth"]').click(); await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension');
      assert.deepEqual(await visibleH2(page), await anchors(page, extensionIds));
      assert.equal(await page.locator('[data-restore-section="dynamic-range-kth"]').isEnabled(), true);
      assert.match(await page.locator('#toast').innerText(), /本机保存失败/);
      assert.equal(mock.writes.filter(write => write.key.startsWith('section:')).length, 0);
    });
    await check(browser, 'cloud-failure-keeps-local-choice-until-retry', async ({ page, mock }) => {
      mock.rejectWrites = true; await jump(page, 'dynamic-range-kth');
      await page.locator('[data-restore-section="dynamic-range-kth"]').click(); await wait(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
      assert.equal(await page.evaluate(() => Object.entries(__extensionQA.state.records).filter(([key]) => key.startsWith('section:'))[0][1].dirty), true);
      assert.match(await page.locator('#syncStatus').innerText(), /本机|等待同步/);
      await page.reload(); await wait(page); await switchTab(page, 'extension');
      assert.deepEqual(await visibleH2(page), await anchors(page, ['time-parallel-search', 'marginal-penalty']), 'a failed remote write does not discard a saved local choice');
      mock.rejectWrites = false; await page.evaluate(() => dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => Object.entries(__extensionQA.state.records).some(([key, record]) => key.startsWith('section:') && !record.dirty));
      assert.equal(mock.writes.filter(write => write.key.startsWith('section:')).length, 1);
    });
    await check(browser, 'all-restored-returns-to-one-page-and-legacy-route', async ({ page }) => {
      for (const id of extensionIds) { await jump(page, id); await page.locator(`[data-restore-section="${id}"]`).click(); await wait(page); }
      assert.equal(await page.locator('#partHeading').isVisible(), false);
      assert.equal(await page.locator('#article').getAttribute('role'), 'article');
      assert.equal(await page.locator('#article').getAttribute('aria-labelledby'), null);
      assert.equal(await page.locator('#extensionEmpty,.extension-meta').count(), 0);
      assert.deepEqual(await visibleH2(page), payload.headings.filter(item => item.depth === 2).map(item => item.id));
      await page.locator('#sectionIndexButton').click(); assert.equal(await page.locator('.directory-group').count(), 38);
      assert.equal(await page.locator('.directory-group.is-extension').count(), 0); await closeSheet(page);
      await page.evaluate(({ owner, id, revision }) => {
        history.pushState({ readingOwner: owner, readingDocument: id, readingPosition: { schema: 3, anchor: null, layer: 'extension', revision } }, '', location.pathname + '#/read/chapter-01/' + id + '?layer=extension');
        dispatchEvent(new HashChangeEvent('hashchange'));
      }, { owner, id: meta.id, revision: meta.revision });
      const first = payload.headings.find(item => item.depth === 2).id;
      await page.waitForFunction(first => __extensionQA.runtime.position?.anchor === first && !__extensionQA.runtime.state.restoring, first);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
      assert.equal(await page.locator('#readingPane').evaluate(node => node.scrollTop), 0, 'a former empty-extension history entry falls back to the main page start');
      await page.reload(); await wait(page); assert.equal((await visibleH2(page)).length, 38);
      assert.equal(await page.locator('#partHeading').isVisible(), false);
    });
    await check(browser, 'publication-without-extensions-has-no-tab-system', async ({ page }) => {
      assert.equal(await page.locator('#partHeading').isVisible(), false);
      assert.equal(await page.locator('#extensionEmpty,.extension-meta').count(), 0);
      assert.equal(await page.locator('#article').getAttribute('role'), 'article');
      assert.equal((await visibleH2(page)).length, 38);
      await page.locator('#sectionIndexButton').click(); assert.equal(await page.locator('.directory-group').count(), 38);
      assert.equal(await page.locator('.directory-group.is-extension').count(), 0); await closeSheet(page);
      await page.goto(`${origin}/#/read/${chapter.id}/${meta.id}?layer=extension`); await wait(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'main');
      assert.equal(await page.locator('#partHeading').isVisible(), false);
      assert.equal((await visibleH2(page)).length, 38);
    }, { omitExtensions: true });
    await check(browser, 'touch-pure-switch-is-stable-before-every-paint', async ({ page }) => {
      for (const scenario of [
        { name: 'main-middle', destination: 'ordered-dp-frontier', mode: 'gutter', scroll: 190 },
        { name: 'extension-middle', destination: 'dynamic-range-kth-manual', mode: 'text', scroll: 240 },
        { name: 'chapter-start', start: true, mode: 'gutter' },
        { name: 'chapter-end', end: true, mode: 'gutter' }
      ]) {
        if (scenario.start || scenario.end) { await page.evaluate(() => __extensionQA.runtime.showReader(null, null, true)); await wait(page); }
        else await jump(page, scenario.destination);
        if (scenario.end) { await page.locator('#readingPane').evaluate(node => { node.scrollTop = node.scrollHeight - node.clientHeight; }); await wait(page); }
        if (scenario.scroll) await scrollBy(page, scenario.scroll);
        await clearSelection(page);
        const before = await paperPosition(page), layer = await page.evaluate(() => __extensionQA.runtime.state.layer);
        await page.screenshot({ path: path.join(output, scenario.name + '-normal.png') });
        const iterations = scenario.scroll ? 4 : 2;
        for (let i = 0; i < iterations; i++) {
          await frameCheckedTouchToggle(page, scenario.mode, scenario.name + '-toggle-' + (i + 1));
          assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), layer);
          if (!i) {
            await page.screenshot({ path: path.join(output, scenario.name + '-pure.png') });
            const atRest = await paperPosition(page, before.block), location = await blankPoint(page);
            await page.evaluate(block => {
              const pane = document.getElementById('readingPane'), article = document.getElementById('article');
              const node = document.querySelector(`[data-read-block="${block}"]`);
              const snap = () => ({ top: node.getBoundingClientRect().top, width: article.getBoundingClientRect().width, scrollTop: pane.scrollTop });
              const trace = window.__controlFrameTrace = { before: snap(), rows: [], done: false };
              let index = 0;
              const frame = () => { trace.rows.push({ frame: ++index, ...snap() }); if (index < 36) requestAnimationFrame(frame); else trace.done = true; };
              requestAnimationFrame(frame);
            }, before.block);
            await page.touchscreen.tap(location.x, location.y);
            await page.waitForFunction(() => document.getElementById('app').classList.contains('controls-awake'));
            await page.waitForFunction(() => window.__controlFrameTrace?.done);
            const wake = await page.evaluate(() => window.__controlFrameTrace);
            geometry.push({ scenario: 'pure-control-wake-paint-frames', name: scenario.name, ...wake });
            for (const row of wake.rows) {
              assert(Math.abs(row.top - wake.before.top) <= 1 && Math.abs(row.scrollTop - wake.before.scrollTop) <= 1,
                'waking overlay controls never moves text in any frame: ' + JSON.stringify({ scenario, row, before: wake.before }));
              assert(Math.abs(row.width - wake.before.width) < 1, 'waking controls preserves paper width in every frame');
            }
            samePaper(atRest, await paperPosition(page, before.block));
            await page.evaluate(() => document.getElementById('readingPane').focus({ preventScroll: true }));
          }
        }
        const after = await paperPosition(page, before.block);
        if (scenario.scroll) assert(Math.abs(after.top - before.top) <= 1, 'repeated middle transitions do not accumulate drift: ' + JSON.stringify({ scenario, before, after }));
        geometry.push({ scenario: 'pure-frame-round-trip', name: scenario.name, before, after, verticalDelta: after.top - before.top, widthDelta: after.width - before.width });
        await page.screenshot({ path: path.join(output, scenario.name + '-restored.png') });
      }
    }, { touch: true });
    await check(browser, 'touch-double-tap-keeps-layer-and-paper', async ({ page }) => {
      for (const [layer, destination] of [['main', 'ordered-dp-frontier'], ['extension', 'dynamic-range-kth-manual']]) {
        await jump(page, destination); await scrollBy(page, 190); await clearSelection(page);
        const before = await paperPosition(page);
        await doubleTap(page); assert.equal(await pure(page), true, 'two real touch taps enter pure mode exactly once');
        assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), layer);
        assert.equal(await page.locator('#partHeading').isVisible(), false);
        samePaper(before, await paperPosition(page, before.block));
        await doubleTap(page); assert.equal(await pure(page), false, 'two real touch taps exit pure mode exactly once');
        assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), layer);
        assert.equal(await page.locator('#partHeading').isVisible(), true);
        samePaper(before, await paperPosition(page, before.block));
        await clearSelection(page);
        const textBefore = await paperPosition(page);
        await doubleTapAt(page, await textPoint(page));
        assert.equal(await pure(page), true, 'double tap on actual paragraph text enters pure mode');
        samePaper(textBefore, await paperPosition(page, textBefore.block));
        const textDuring = await paperPosition(page);
        await doubleTapAt(page, await textPoint(page));
        assert.equal(await pure(page), false, 'double tap on actual paragraph text exits pure mode');
        samePaper(textDuring, await paperPosition(page, textDuring.block));
        assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), layer);
        const repeated = await paperPosition(page, before.block);
        geometry.push({ scenario: 'four-touch-mode-transitions', layer, before, after: repeated,
          verticalDelta: repeated.top - before.top, widthDelta: repeated.width - before.width });
        const hold = await textPoint(page), session = await page.context().newCDPSession(page);
        await page.evaluate(() => {
          window.__textHoldMenus = 0;
          window.__textHoldMenu = event => { window.__textHoldMenus++; event.preventDefault(); };
          document.addEventListener('contextmenu', window.__textHoldMenu, true);
        });
        let selectedDuringHold;
        try {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hold.x, y: hold.y, id: 0 }] });
          await page.waitForTimeout(750);
          selectedDuringHold = await page.evaluate(() => getSelection().toString());
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForTimeout(400);
          if (selectedDuringHold.trim()) assert.equal(await page.evaluate(() => getSelection().toString()), selectedDuringHold, 'native long-press text selection is retained');
          geometry.push({ scenario: 'native-text-long-press', layer, selectedText: Boolean(selectedDuringHold.trim()), contextmenus: await page.evaluate(() => window.__textHoldMenus) });
          assert.equal(await pure(page), false, 'long press on ordinary text never toggles pure mode');
        } finally {
          await page.evaluate(() => document.removeEventListener('contextmenu', window.__textHoldMenu, true));
          await session.detach(); await clearSelection(page);
        }
      }
    }, { touch: true });
    await check(browser, 'touch-pure-controls-never-intercept-double-tap', async ({ page }) => {
      await jump(page, 'dynamic-range-kth-manual'); await scrollBy(page, 240); await clearSelection(page);
      for (const edge of ['top', 'bottom']) {
        await doubleTap(page); assert.equal(await pure(page), true);
        await page.waitForFunction(() => !document.getElementById('app').classList.contains('controls-awake'));
        await doubleTap(page, edge, async location => {
          assert.equal(await page.locator('#sheetDialog').evaluate(node => node.open), false, 'first tap must not accidentally open the directory');
          const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, location);
          assert(['article', 'readingPane'].includes(hit), 'first tap must not reveal a control under the second tap: ' + hit);
        });
        assert.equal(await pure(page), false, edge + ' padding can exit pure mode');
        assert.equal(await page.locator('#sheetDialog').evaluate(node => node.open), false);
        assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension');
      }
      // On exit the header itself returns under the finger. Use an actual
      // paragraph gap at the future question-button centre, not the gutter.
      const headerTarget = await page.locator('#questionsButton').evaluate(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await doubleTap(page); assert.equal(await pure(page), true);
      await page.evaluate(target => {
        const pane = document.getElementById('readingPane'), top = pane.getBoundingClientRect().top;
        const paragraphs = [...document.querySelectorAll('#article > p')].filter(node => !node.hidden);
        const paragraph = paragraphs.find(node => {
          const rect = node.getBoundingClientRect(), next = node.nextElementSibling?.getBoundingClientRect();
          return rect.bottom > top + 100 && rect.bottom < top + pane.clientHeight && next && next.top - rect.bottom > 6;
        });
        if (!paragraph) throw Error('actual chapter needs a visible paragraph gap for the header retarget regression');
        const rect = paragraph.getBoundingClientRect(), next = paragraph.nextElementSibling.getBoundingClientRect();
        pane.scrollTop += rect.bottom + Math.min(5, (next.top - rect.bottom) / 2) - target.y;
      }, headerTarget);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, headerTarget), 'article');
      await page.touchscreen.tap(headerTarget.x, headerTarget.y); await page.waitForTimeout(75);
      await page.touchscreen.tap(headerTarget.x, headerTarget.y); await wait(page); await page.waitForTimeout(300);
      assert.equal(await pure(page), false);
      assert.equal(await page.locator('#sheetDialog').evaluate(node => node.open), false, 'exit compatibility click must not open the newly exposed question button');
      await page.locator('#settingsButton').tap(); await page.locator('#sheetDialog[open]').waitFor(); await closeSheet(page);
      await doubleTap(page); const location = await blankPoint(page);
      await page.touchscreen.tap(location.x, location.y);
      await page.waitForFunction(() => document.getElementById('app').classList.contains('controls-awake'));
      assert.equal(await pure(page), true, 'a single tap only wakes controls');
      await page.locator('#sectionIndexButton').tap(); await page.locator('#indexList').waitFor(); await closeSheet(page);
    }, { touch: true });
    await check(browser, 'touch-pure-without-native-dblclick-and-native-operations', async ({ page }) => {
      assert.equal(await page.locator('#partHeading').isVisible(), false);
      await jump(page, 'ordered-dp-frontier'); await scrollBy(page, 190); await clearSelection(page);
      // A real touch sequence must work even where the browser does not emit
      // dblclick. This listener does not manufacture pointer events or prevent
      // native selection; it only stops the compatibility event reaching runtime.
      await page.evaluate(() => document.addEventListener('dblclick', event => event.stopImmediatePropagation(), true));
      await doubleTap(page); assert.equal(await pure(page), true);
      await doubleTap(page); assert.equal(await pure(page), false);
      for (const kind of ['hold', 'drag', 'multiple']) {
        await clearSelection(page); await touchSequence(page, kind);
        assert.equal(await pure(page), false, kind + ' is not a double tap');
      }
      await page.evaluate(() => {
        const paragraph = [...document.querySelectorAll('#article p')].find(node => !node.closest('[hidden]'));
        const range = document.createRange(); range.selectNodeContents(paragraph);
        getSelection().removeAllRanges(); getSelection().addRange(range);
      });
      await doubleTap(page); assert.equal(await pure(page), false, 'an existing selection is not a pure-mode command');
      await clearSelection(page);
      const paragraph = page.locator('#article p').filter({ visible: true }).first(); await paragraph.scrollIntoViewIfNeeded();
      await paragraph.dblclick({ position: { x: 42, y: 12 } });
      assert((await page.evaluate(() => getSelection().toString())).trim(), 'native mouse text selection remains available');
      assert.equal(await pure(page), false); await clearSelection(page);
      const knowledge = page.locator('#article a[data-knowledge]').filter({ visible: true }).first();
      await knowledge.scrollIntoViewIfNeeded(); await knowledge.tap(); await page.locator('.knowledge-paper').waitFor(); await closeSheet(page);
      assert.equal(await pure(page), false, 'knowledge links open their own window');
      const code = page.locator('#article pre').filter({ visible: true }).first(); await code.scrollIntoViewIfNeeded();
      const rect = await code.boundingBox();
      await page.touchscreen.tap(rect.x + 35, rect.y + 20); await page.waitForTimeout(75);
      await page.touchscreen.tap(rect.x + 35, rect.y + 20); await page.waitForTimeout(450);
      assert.equal(await pure(page), false, 'code taps preserve code operations');
      await clearSelection(page);
      const horizontal = await page.locator('#article pre').evaluateAll(nodes => {
        const node = nodes.find(node => !node.closest('[hidden]') && node.scrollWidth > node.clientWidth + 20);
        if (!node) return null; node.scrollIntoView({ block: 'center' }); return node.dataset.readBlock;
      });
      assert.notEqual(horizontal, null, 'actual chapter has a horizontally scrollable C++ example');
      const pre = page.locator(`[data-read-block="${horizontal}"]`); const bounds = await pre.boundingBox();
      const session = await page.context().newCDPSession(page);
      try {
        const y = bounds.y + Math.min(35, bounds.height / 2), x = bounds.x + Math.min(230, bounds.width - 20);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 80, y, id: 0 }] });
        await page.waitForTimeout(60); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await session.detach(); }
      await page.waitForFunction(block => document.querySelector(`[data-read-block="${block}"]`).scrollLeft > 0, horizontal);
      assert.equal(await pure(page), false, 'horizontal code gestures do not toggle pure mode');
      assert.equal(await page.locator('#partHeading').isVisible(), false);
    }, { touch: true, omitExtensions: true });
    await check(browser, 'mobile-desktop-pure-font-and-copy', async ({ page }) => {
      for (const size of [{ width: 402, height: 874 }, { width: 320, height: 740 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(size); await wait(page); await jump(page, 'time-parallel-search');
        const measured = await page.evaluate(() => ({ viewport: innerWidth, outer: document.documentElement.scrollWidth,
          pane: document.getElementById('readingPane').getBoundingClientRect().toJSON(),
          tabs: [...document.querySelectorAll('[data-reading-layer]')].map(node => ({ text: node.textContent, rect: node.getBoundingClientRect().toJSON(), font: getComputedStyle(node).fontSize })),
          restore: document.querySelector('[data-restore-section="time-parallel-search"]').getBoundingClientRect().toJSON() }));
        geometry.push({ size, ...measured }); assert(measured.outer <= size.width + 1);
        assert(measured.pane.height > 150); assert(measured.restore.width > 35);
        await page.screenshot({ path: path.join(output, `extension-${size.width}.png`) });
      }
      await page.setViewportSize({ width: 402, height: 874 }); await wait(page); await jump(page, 'dynamic-range-kth-manual');
      const pureAnchor = await anchor(page, 'dynamic-range-kth-manual');
      const before = await page.locator(`#${pureAnchor}`).evaluate(node => ({ top: node.getBoundingClientRect().top, width: document.getElementById('article').getBoundingClientRect().width }));
      await page.evaluate(() => __extensionQA.runtime.setPure(true)); await wait(page);
      assert.equal(await page.locator('#app').evaluate(node => node.classList.contains('pure')), true);
      const during = await page.locator(`#${pureAnchor}`).evaluate(node => ({ top: node.getBoundingClientRect().top, width: document.getElementById('article').getBoundingClientRect().width }));
      assert(Math.abs(during.top - before.top) < 2 && Math.abs(during.width - before.width) < 1, 'pure mode preserves physical text coordinate and width: ' + JSON.stringify({ before, during }));
      await page.evaluate(() => __extensionQA.runtime.setPure(false)); await wait(page);
      await page.locator('#settingsButton').click(); await page.locator('[data-show-reading-settings]').click();
      await page.locator('[data-font="1"]').click(); await page.waitForTimeout(100); await closeSheet(page);
      assert.equal(await page.evaluate(() => __extensionQA.runtime.state.layer), 'extension');
      const copy = page.locator('#article .code-block').filter({ has: page.locator('pre') }).filter({ visible: true }).first().locator('[data-copy]');
      await copy.scrollIntoViewIfNeeded(); const expected = await copy.evaluate(node => node.closest('.code-block').querySelector('pre').textContent);
      await copy.click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(copied.replace(/\r\n/g, '\n'), expected.replace(/\r\n/g, '\n'), 'clipboard preserves the exact code with only the operating system line-ending conversion');
    });
  } finally { await browser.close(); }
  const sourceEnd = await fingerprint();
  if (JSON.stringify(sourceStart) !== JSON.stringify(sourceEnd)) failures.push({ name: 'immutable-reader-inputs', message: 'Reader or built publication changed during QA; rerun on frozen inputs.' });
  const report = { passed: failures.length === 0, results, failures, geometry, sourceStart, sourceEnd,
    builtDocument: { id: meta.id, revision: meta.revision, headings: payload.headings.length, extensions: payload.extensions },
    caseFilter: process.env.ALGORITHM_EXTENSION_CASE || null,
    evidenceBoundary: { realReaderSources: true, actualBuiltProtectedChapter: true, mockedOwnerAPI: true, serviceWorker: 'blocked; HTTP/SW check is separate', physicalIPhone: false, productionContacted: false, paidProviderContacted: false }, testedAt: new Date().toISOString() };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, results, failures, report: path.join(output, 'results.json') }, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
