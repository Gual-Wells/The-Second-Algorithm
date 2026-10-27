// Actual browser + actual service worker transition. Local in-memory auth only;
// no passkey enrollment, production requests or database writes.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALGORITHM_QA_PLAYWRIGHT || 'playwright');
const esbuild = require(process.env.ALGORITHM_QA_ESBUILD || 'esbuild');
const root = path.resolve(__dirname, '..');
const owner = 'a'.repeat(43), oldBuild = 'upgrade-old', newBuild = 'upgrade-new', withdrawnBuild = 'upgrade-withdrawn';
const documentURL = '/library/formal-first/first-document/new.json';
const meta = { id: 'first-document', title: '正文', revision: 'new', url: documentURL,
  sourceUrl: documentURL.replace('.json', '.cpp'), markdownUrl: documentURL.replace('.json', '.md'),
  headings: [{ depth: 2, id: 'example', text: '新章例子' }] };
const catalog = { schemaVersion: 2, questions: [], version: 'formal-new', collections: [{ id: 'formal-first', kind: 'chapter',
  chapterNumber: 1, title: '正式章', documents: [meta] }] };
const payload = { ...meta, html: '<h2 id="example">新章例子</h2><div class="code-block" data-code-id="demo"><pre><code>int answer = 42;</code></pre></div>' };
const index = { version: catalog.version, questions: [], collections: { 'formal-first': { 'first-document': meta.revision } } };
const oldCatalog = { schemaVersion: 2, version: 'previous-release', questions: [], collections: [] };
const withdrawnCatalog = { schemaVersion: 2, state: 'withdrawn', version: 'withdrawn-release', questions: [], collections: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const physical = await fs.realpath(root);
  if (process.platform === 'win32' && !/^D:[\\/]/i.test(physical)) throw Error('Upgrade QA must reside on D.');
  const temporary = path.join(root, '.local/carrier-upgrade-tmp');
  const output = path.join(root, '.local/carrier-upgrade-qa');
  await fs.mkdir(temporary, { recursive: true }); await fs.mkdir(output, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
  const bundle = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    define: { __PUBLICATION_INDEX__: JSON.stringify(index) } });
  const app = bundle.outputFiles[0].text + '\nglobalThis.__carrierUpgrade = { get state() { return S; }, get downloading() { return downloads.size; } };\n';
  const oldBundle = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    define: { __PUBLICATION_INDEX__: JSON.stringify({ version: oldCatalog.version, questions: [], collections: {} }) } });
  const oldApp = oldBundle.outputFiles[0].text;
  const withdrawnBundle = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    define: { __PUBLICATION_INDEX__: JSON.stringify({ state: 'withdrawn', version: withdrawnCatalog.version, questions: [], collections: {} }) } });
  const withdrawnApp = withdrawnBundle.outputFiles[0].text + '\nglobalThis.__carrierUpgrade = { get state() { return S; } };\n';
  const sw = await fs.readFile(path.join(root, 'web/sw.js'), 'utf8');
  const manifest = await fs.readFile(path.join(root, 'web/manifest.webmanifest'));
  let published = false, withdrawn = false, networkOffline = false, documentRequests = 0;
  const currentBuild = () => withdrawn ? withdrawnBuild : published ? newBuild : oldBuild;
  const held = new Set(), errors = [], requests = [];
  const server = http.createServer(async (request, response) => {
    try {
      // Also close worker-originated connections: context.setOffline alone can
      // leave those requests online in Chromium automation.
      if (networkOffline) { request.socket.destroy(); return; }
      const url = new URL(request.url, 'http://localhost');
      requests.push(url.pathname + url.search);
      const json = value => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
      if (url.pathname === '/setup') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(`<body>setup<script>navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(async()=>{
          if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));
          document.body.dataset.ready='true';});</script>`); return;
      }
      if (url.pathname === '/sw.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
        response.end(sw.replaceAll('__BUILD__', currentBuild())
          .replaceAll('__LIBRARY_PATHS__', JSON.stringify(published && !withdrawn
            ? ['/library/catalog.json', documentURL, meta.sourceUrl, meta.markdownUrl] : ['/library/catalog.json']))); return;
      }
      if (url.pathname === '/manifest.webmanifest' && url.searchParams.get('v') === newBuild) {
        // Keep the replacement installing while the new app is already running.
        held.add(response); response.on('close', () => held.delete(response)); return;
      }
      if (url.pathname === '/auth/status') return json({ authenticated: true, enrolled: true, enrollmentOpen: false, ownerScope: owner });
      if (url.pathname === '/api/library' || url.pathname === '/library/catalog.json') return json(withdrawn ? withdrawnCatalog : published ? catalog : oldCatalog);
      if (url.pathname === '/api/state') return json({ state: {} });
      if ([documentURL, meta.sourceUrl, meta.markdownUrl].includes(url.pathname) && withdrawn) {
        response.writeHead(404); response.end('Withdrawn'); return;
      }
      if (url.pathname === documentURL) { ++documentRequests; return json(payload); }
      if (url.pathname === meta.sourceUrl || url.pathname === meta.markdownUrl) { response.end('int answer = 42;'); return; }
      if (url.pathname === '/app.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        response.end(url.searchParams.get('v') === oldBuild ? oldApp : url.searchParams.get('v') === withdrawnBuild ? withdrawnApp : app); return;
      }
      const filename = path.join(root, 'web', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
      if (!filename.startsWith(path.join(root, 'web') + path.sep)) { response.writeHead(404); response.end(); return; }
      let bytes = await fs.readFile(filename);
      if (filename.endsWith('index.html')) bytes = Buffer.from(bytes.toString().replaceAll('__BUILD__', currentBuild()));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'text/plain' }); response.end(bytes);
    } catch (error) { if (error.code !== 'ENOENT') errors.push(error.message); response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.ALGORITHM_QA_CHROME, headless: true,
    env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary }, args: ['--disk-cache-dir=' + path.join(temporary, 'disk-cache')] });
  let report;
  try {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
    await context.addInitScript(owner => {
      const key = 'second-algorithm:' + owner + ':notes:formal-first';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ text: 'unsent lesson note', revision: 2, dirty: true }));
    }, owner);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/setup'); await page.waitForFunction(() => document.body.dataset.ready === 'true');
    published = true;
    await page.goto(origin + '/#/read/formal-first/first-document');
    // Auth/owner confirmation precedes the reader's release gate. Start the
    // installation deadline only after the app has reached that gate.
    await page.waitForFunction(() => globalThis.__carrierUpgrade?.state.pendingRoute);
    const deadline = Date.now() + 8000;
    while (!held.size && Date.now() < deadline) await sleep(25);
    assert(held.size, 'replacement worker should still be installing');
    await page.waitForTimeout(250);
    assert.equal(documentRequests, 0, 'new app must not send a formal content request through the old hidden policy');
    const build = await page.evaluate(() => new Promise(resolve => {
      const c = new MessageChannel(); c.port1.onmessage = e => { c.port1.close(); resolve(e.data.build); };
      navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [c.port2]);
    }));
    assert.equal(build, oldBuild);
    for (const response of held) { response.writeHead(200, { 'Content-Type': 'application/manifest+json' }); response.end(manifest); }
    held.clear();
    await page.locator('#readingArticle .code-block').first().waitFor();
    await page.waitForFunction(() => !window.__carrierUpgrade.state.restoring && !window.__carrierUpgrade.downloading);
    assert.match(await page.locator('#readingArticle').innerText(), /answer = 42/);
    assert.equal(documentRequests, 1);
    assert.match(await page.evaluate(owner => localStorage.getItem('second-algorithm:' + owner + ':notes:formal-first'), owner), /unsent lesson note/);
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate', 'upgrade must not automatically reload the page');
    networkOffline = true; await context.setOffline(true);
    await page.reload();
    await page.locator('#readingArticle .code-block').first().waitFor();
    assert.match(await page.locator('#readingArticle').innerText(), /answer = 42/);
    assert.equal(documentRequests, 1, 'same-version offline restart reuses downloaded content');
    assert.deepEqual(errors, []);
    await context.close();
    networkOffline = false; published = false; documentRequests = 0;
    const updateContext = await browser.newContext();
    const updatePage = await updateContext.newPage(); updatePage.on('pageerror', error => errors.push(error.message));
    await updatePage.goto(origin + '/setup'); await updatePage.waitForFunction(() => document.body.dataset.ready === 'true');
    await updatePage.goto(origin + '/#/library');
    await updatePage.locator('#libraryView').waitFor({ state: 'visible' });
    published = true;
    await updatePage.locator('#settingsButton').click();
    await updatePage.locator('[data-check-updates]').click();
    const updateDeadline = Date.now() + 8000;
    while (!held.size && Date.now() < updateDeadline) await sleep(25);
    assert(held.size, 'check updates must actually start replacement installation');
    await updatePage.waitForTimeout(100);
    assert.equal(await updatePage.locator('[data-reload-app]').isVisible(), false,
      'a resolved update request must not enable reload while the old policy still controls the page');
    for (const response of held) { response.writeHead(200, { 'Content-Type': 'application/manifest+json' }); response.end(manifest); }
    held.clear();
    await updatePage.locator('[data-reload-app]').waitFor({ state: 'visible' });
    assert.equal(await updatePage.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate');
    await updatePage.locator('[data-reload-app]').click();
    await updatePage.locator('#bookList .book-row').first().waitFor();
    await updatePage.locator('#bookList .book-row').first().click();
    await updatePage.locator('#readingArticle .code-block').first().waitFor();
    assert.match(await updatePage.locator('#readingArticle').innerText(), /answer = 42/);
    assert.deepEqual(errors, []);
    // Upgrade a genuinely cached publication to the empty withdrawal. The new
    // policy must purge all three payload forms without clearing private notes.
    await updatePage.waitForFunction(() => !globalThis.__carrierUpgrade.downloading);
    const retiredPaths = [documentURL, meta.sourceUrl, meta.markdownUrl];
    const beforeWithdrawal = await updatePage.evaluate(async ({ owner, retiredPaths }) => {
      localStorage.setItem('second-algorithm:' + owner + ':notes:formal-first', JSON.stringify({ text: 'withdrawal unsent note', revision: 3, dirty: true }));
      for (const url of retiredPaths) { const response = await fetch(url); if (!response.ok) throw Error('Old fixture not readable'); await response.text(); }
      const cache = await caches.open('second-algorithm-private-' + owner);
      return Promise.all(retiredPaths.map(async url => Boolean(await cache.match(url))));
    }, { owner, retiredPaths });
    assert.deepEqual(beforeWithdrawal, [true, true, true], 'all retired payloads were cached by the real old worker');
    withdrawn = true;
    await updatePage.reload();
    await updatePage.locator('#libraryView').waitFor({ state: 'visible' });
    await updatePage.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    const withdrawalDeadline = Date.now() + 10000;
    let withdrawalActivated = false;
    while (!withdrawalActivated && Date.now() < withdrawalDeadline) {
      withdrawalActivated = await updatePage.evaluate(async build => {
        const worker = navigator.serviceWorker.controller; if (!worker || worker.state !== 'activated') return false;
        return new Promise(resolve => { const c = new MessageChannel();
          const deadline = setTimeout(() => { c.port1.close(); resolve(false); }, 500);
          c.port1.onmessage = e => { clearTimeout(deadline); c.port1.close(); resolve(e.data.build === build
            && worker === navigator.serviceWorker.controller && worker.state === 'activated'); };
          worker.postMessage({ type: 'VERSION' }, [c.port2]); });
      }, withdrawnBuild);
      if (!withdrawalActivated) await sleep(25);
    }
    assert(withdrawalActivated, 'withdrawn worker must actually activate and control the page before cache inspection');
    await updatePage.waitForURL('**/#/library');
    assert.match(await updatePage.locator('#bookList').innerText(), /暂无章节/);
    assert.equal(await updatePage.locator('#bookList .book-row').count(), 0);
    const afterWithdrawal = await updatePage.evaluate(async ({ owner, retiredPaths }) => {
      const cache = await caches.open('second-algorithm-private-' + owner);
      return { cached: await Promise.all(retiredPaths.map(async url => Boolean(await cache.match(url)))),
        workers: { controller: navigator.serviceWorker.controller.state, active: (await navigator.serviceWorker.getRegistration()).active.state },
        cacheKeys: await caches.keys(),
        notes: localStorage.getItem('second-algorithm:' + owner + ':notes:formal-first'),
        statuses: await Promise.all(retiredPaths.map(async url => (await fetch(url)).status)) };
    }, { owner, retiredPaths });
    assert.deepEqual(afterWithdrawal.cached, [false, false, false], JSON.stringify(afterWithdrawal));
    assert.deepEqual(afterWithdrawal.statuses, [404, 404, 404]);
    assert.match(afterWithdrawal.notes, /withdrawal unsent note/);
    // Cache the new empty catalog, then restart with no network at all.
    assert.equal(await updatePage.evaluate(async () => (await fetch('/library/catalog.json')).status), 200);
    networkOffline = true; await updateContext.setOffline(true);
    await updatePage.reload();
    await updatePage.locator('#libraryView').waitFor({ state: 'visible' });
    assert.match(await updatePage.locator('#bookList').innerText(), /暂无章节/);
    await updatePage.evaluate(() => { location.hash = '#/read/formal-first/first-document'; });
    await updatePage.waitForURL('**/#/library');
    assert.equal(await updatePage.locator('#readingArticle .code-block').count(), 0);
    assert.deepEqual(await updatePage.evaluate(async urls => Promise.all(urls.map(async url => (await fetch(url)).status)), retiredPaths), [404, 404, 404]);
    assert.match(await updatePage.evaluate(owner => localStorage.getItem('second-algorithm:' + owner + ':notes:formal-first'), owner), /withdrawal unsent note/);
    assert.deepEqual(errors, []);
    report = { passed: true, realBrowserAndServiceWorker: true, heldNewWorkerWhileNewAppRan: true,
      prematureRequests: 0, offlineRestart: true, unsentNotesPreserved: true,
      checkUpdatesWaitsForTakeover: true, manualReloadOpensFormalChapter: true,
      withdrawalPurgedCachedJsonCppMarkdown: true, withdrawnOldRoutesOffline404: true,
      withdrawnEmptyCatalogOfflineRestart: true, withdrawalUnsentNotesPreserved: true,
      automaticReload: false, productionContacted: false, databaseModified: false };
    await updateContext.close();
  } catch (error) {
    const pages = [];
    for (const context of browser.contexts()) for (const page of context.pages()) {
      pages.push({ url: page.url(), text: await page.locator('body').innerText().catch(() => ''),
        worker: await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return { controller: navigator.serviceWorker.controller?.scriptURL, installing: registration?.installing?.state,
            waiting: registration?.waiting?.state, active: registration?.active?.state,
            state: globalThis.__carrierUpgrade ? { owner: globalThis.__carrierUpgrade.state.owner,
              pendingRoute: globalThis.__carrierUpgrade.state.pendingRoute } : null };
        }).catch(() => null) });
    }
    report = { passed: false, error: error.message, errors, requests, pages }; throw error;
  }
  finally {
    for (const response of held) response.destroy();
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
