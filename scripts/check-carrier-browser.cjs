// Browser regression against the actual web sources with an entirely in-memory owner/API.
// Does not enroll a passkey, contact production, or change any D1 database.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const origin = 'http://localhost:9876';
const owner = 'a'.repeat(43);
const output = path.join(root, '.local/refinement-qa');
const temporary = path.join(root, '.local/refinement-browser-tmp');
const chrome = process.env.ALGORITHM_QA_CHROME;
const qaLibrary = path.join(root, '.local/carrier-qa-library');
let qaCatalog, deployedCatalog, makeIndex;

async function poll(condition, message, timeout = 6000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function environment(browser, { catalog = qaCatalog, policyCatalog = catalog, libraryRoot = qaLibrary } = {}) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(() => { delete Navigator.prototype.serviceWorker; });
  const mock = { catalog, state: {}, errors: [], requests: [], holdNotePage: null, heldNote: null,
    delayDocument: null, heldDocument: null, unavailable: new Set(), rejectApis: false, signedOut: false };
  context.on('page', page => page.on('pageerror', error => mock.errors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort('blockedbyclient');
    mock.requests.push({ path: url.pathname, method: request.method() });
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (mock.rejectApis && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')))
      return route.abort('internetdisconnected');
    if (url.pathname === '/auth/logout') { mock.signedOut = true; return json({ ok: true }); }
    if (url.pathname === '/auth/status') return json({ authenticated: !mock.signedOut, enrolled: true,
      enrollmentOpen: false, ownerScope: owner });
    if (url.pathname === '/api/library') return json(mock.catalog);
    if (url.pathname === '/api/state') {
      if (request.method() === 'GET') return json({ state: mock.state });
      const input = request.postDataJSON(), previous = mock.state[input.key];
      if (input.key.startsWith('notes:') && input.baseRevision !== (previous?.revision || 0))
        return json({ error: 'mock CAS conflict', current: previous || null }, 409);
      const record = { value: input.value, revision: (previous?.revision || 0) + 1, updatedAt: Date.now() };
      mock.state[input.key] = record;
      if (input.key.startsWith('notes:') && mock.holdNotePage === request.frame().page()) {
        mock.holdNotePage = null;
        await new Promise(resolve => { mock.heldNote = resolve; });
      }
      return json({ ...record, record });
    }
    if (mock.unavailable.has(url.pathname)) return route.abort('internetdisconnected');
    if (mock.delayDocument === url.pathname) {
      mock.delayDocument = null;
      await new Promise(resolve => { mock.heldDocument = resolve; });
    }
    const file = path.join(url.pathname.startsWith('/library/') ? libraryRoot : path.join(root, 'web'),
      url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    let bytes;
    try { bytes = await fs.readFile(file); } catch { return route.fulfill({ status: 404, body: 'Mock asset not found' }); }
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    if (url.pathname === '/app.js') bytes = Buffer.from(bytes.toString('utf8').replaceAll('__PUBLICATION_INDEX__', JSON.stringify(makeIndex(policyCatalog)))
      + '\nglobalThis.__refinement = { get state() { return S; }, get journal() { return journal(); } };\n');
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'text/plain', body: bytes });
  });
  return { context, mock, async page(hash = '#/read/binary-search/bs-foundations') {
    const page = await context.newPage();
    await page.goto(origin + '/' + hash);
    await page.locator('#readingArticle .code-block').first().waitFor();
    await page.waitForFunction(() => window.__refinement && !window.__refinement.state.restoring);
    return page;
  } };
}

(async () => {
  const physicalRoot = await fs.realpath(root);
  if (process.platform === 'win32' && !/^D:\\/i.test(physicalRoot))
    throw new Error('Browser QA workspace and its actual temporary data must be on D:');
  await fs.mkdir(output, { recursive: true }); await fs.mkdir(temporary, { recursive: true });
  const builder = await import('../scripts/build-carrier.mjs'); makeIndex = builder.publicationIndex;
  const corpus = JSON.parse(await fs.readFile(path.join(root, 'carrier/publications.json'), 'utf8'));
  corpus.collections = corpus.collections.filter(collection => collection.kind === 'trial');
  for (const collection of corpus.collections) delete collection.visibility;
  ({ catalog: qaCatalog } = await builder.buildLibrary(root, qaLibrary, corpus,
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()));
  deployedCatalog = JSON.parse(await fs.readFile(path.join(root, 'dist/library/catalog.json'), 'utf8'));
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
  const browser = await chromium.launch({ headless: true, executablePath: chrome,
    env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary },
    args: ['--disk-cache-dir=' + path.join(temporary, 'disk-cache')] });
  const results = [], failures = [];
  async function check(name, action, options) {
    if (process.env.ALGORITHM_QA_CASE && !name.includes(process.env.ALGORITHM_QA_CASE)) return;
    let env;
    try { env = await environment(browser, options); await action(env); assert.deepEqual(env.mock.errors, []);
      results.push({ name, passed: true }); console.log('PASS', name);
    } catch (error) {
      failures.push({ name, error: error.message, stack: error.stack, pageErrors: env?.mock.errors });
      console.error('FAIL', name, error.message);
      for (const [index, page] of (env?.context.pages() || []).entries()) {
        await page.screenshot({ path: path.join(output, name + '-' + index + '.png') }).catch(() => {});
        await fs.writeFile(path.join(output, name + '-' + index + '.txt'), await page.locator('body').innerText()).catch(() => {});
      }
    } finally { await env?.context.close(); }
  }
  try {
    await check('formal-release-rejects-stale-trial-catalog-routes-resume-and-search-without-removing-notes', async env => {
      const page = await env.context.newPage();
      await page.addInitScript(({ owner, catalog }) => {
        const key = 'second-algorithm:' + owner + ':';
        localStorage.setItem('second-algorithm:last-session', JSON.stringify({ owner, verifiedAt: Date.now() }));
        localStorage.setItem(key + 'catalog', JSON.stringify(catalog));
        localStorage.setItem(key + 'lastRoute', '#/read/binary-search/bs-foundations');
        localStorage.setItem(key + 'resume:algorithm', JSON.stringify({ collection: 'binary-search', document: 'bs-foundations', route: '#/read/binary-search/bs-foundations' }));
        localStorage.setItem(key + 'notes:binary-search', JSON.stringify({ text: 'keep private historical note', revision: 3, dirty: true }));
      }, { owner, catalog: qaCatalog });
      env.mock.rejectApis = true;
      await page.goto(origin + '/#/read/binary-search/bs-foundations');
      await page.locator('#libraryView').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#libraryResume').isVisible(), false);
      assert.doesNotMatch(await page.locator('#bookList').innerText(), /试读|二分专题|C\+\+实战选读/);
      assert.equal(env.mock.requests.some(request => request.path.startsWith('/library/binary-search/')), false);
      await page.locator('#librarySearch').fill('lower_bound');
      await page.waitForTimeout(400);
      assert.equal(await page.locator('#bookList .search-row').count(), 0);
      assert.match(await page.evaluate(owner => localStorage.getItem('second-algorithm:' + owner + ':notes:binary-search'), owner), /keep private historical note/);
      assert(await page.evaluate(() => Boolean(localStorage.getItem('second-algorithm:last-session'))));
      env.mock.rejectApis = false;
      env.mock.state['notes:binary-search'] = { value: 'historical cloud note', revision: 2, updatedAt: Date.now() };
      await page.locator('#settingsButton').click(); await page.locator('[data-check-updates]').click();
      await page.waitForFunction(() => !document.querySelector('[data-check-updates]')?.disabled);
      assert.equal((await page.evaluate(() => window.__refinement.state.library.collections)).some(collection => collection.id === 'binary-search'), false);
      await page.locator('[data-logout]').click();
      await page.locator('#loginView').waitFor({ state: 'visible' });
      assert.match(await page.evaluate(owner => localStorage.getItem('second-algorithm:' + owner + ':notes:binary-search'), owner), /keep private historical note/);
      assert.equal(await page.evaluate(() => localStorage.getItem('second-algorithm:last-session')), null);
    }, { catalog: qaCatalog, policyCatalog: deployedCatalog, libraryRoot: path.join(root, 'dist') });

    await check('same-browser-two-page-late-ACK-and-reload', async env => {
      const a = await env.page(), b = await env.page();
      await a.locator('#notesButton').click(); await b.locator('#notesButton').click();
      env.mock.holdNotePage = a;
      await a.locator('#noteEditor').fill('A: committed before delayed response');
      await poll(() => env.mock.heldNote, 'Expected A save request');
      await b.locator('#noteEditor').fill('B: unsent local draft must survive A ACK');
      env.mock.heldNote();
      await a.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      const beforeReload = await b.evaluate(() => window.__refinement.journal.list('binary-search'));
      assert(beforeReload.some(note => note.text === 'B: unsent local draft must survive A ACK'));
      await b.reload(); await b.locator('#readingArticle .code-block').first().waitFor();
      await b.locator('#notesButton').click();
      assert.equal(await b.locator('#noteEditor').inputValue(), 'B: unsent local draft must survive A ACK');
    });

    await check('note-edited-in-flight-is-rebased-and-saved-again-without-old-pending-slots', async env => {
      const page = await env.page(); await page.locator('#notesButton').click();
      env.mock.holdNotePage = page;
      await page.locator('#noteEditor').fill('first submitted snapshot');
      await poll(() => env.mock.heldNote, 'Expected first held note save');
      await page.locator('#noteEditor').fill('new text while first response is pending');
      env.mock.heldNote();
      await poll(() => env.mock.state['notes:binary-search']?.value === 'new text while first response is pending'
        && env.mock.state['notes:binary-search']?.revision === 2, 'Expected rebased second save');
      await page.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      assert.deepEqual(await page.evaluate(() => window.__refinement.journal.list('binary-search')), []);
      const value = await page.evaluate(() => window.__refinement.journal.load('binary-search'));
      assert.deepEqual(value, { text: 'new text while first response is pending', revision: 2, dirty: false });
    });

    await check('same-text-older-base-other-tab-draft-is-not-invisible-in-recovery', async env => {
      const a = await env.page(), b = await env.page();
      await a.locator('#notesButton').click(); await b.locator('#notesButton').click();
      await a.locator('#noteEditor').fill('same desired content');
      await a.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      await b.locator('#noteEditor').fill('same desired content');
      await a.waitForTimeout(100);
      const pending = await a.evaluate(() => window.__refinement.journal.list('binary-search'));
      assert(pending.some(note => note.text === 'same desired content' && note.revision === 0));
      assert(await a.locator('#draftRecovery [data-load-draft],#draftRecovery [data-confirm-draft]').count() > 0,
        'A clean note still has a same-text older-base pending draft, which blocks logout but is hidden from recovery');
      const confirm = a.locator('#draftRecovery [data-confirm-draft]');
      if (await confirm.count()) {
        await a.locator('#draftRecovery summary').click(); await confirm.click();
        assert(!(await a.evaluate(() => window.__refinement.journal.list('binary-search')))
          .some(note => note.text === 'same desired content' && note.revision === 0));
      }
    });

    await check('failed-local-backup-cannot-discard-current-note-when-adopting-cloud', async env => {
      env.mock.state['notes:binary-search'] = { value: 'older cloud note', revision: 1, updatedAt: Date.now() };
      const page = await env.page(); await page.locator('#notesButton').click();
      env.mock.state['notes:binary-search'] = { value: 'other device latest cloud note', revision: 2, updatedAt: Date.now() };
      await page.locator('#noteEditor').fill('valuable local conflicting draft');
      await page.locator('[data-notes-cloud]').waitFor();
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key.includes('notes-backup:')) throw new DOMException('Simulated full storage for backup', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      });
      await page.locator('[data-notes-cloud]').click(); await page.locator('[data-adopt-cloud]').click();
      assert.equal(await page.evaluate(() => window.__refinement.state.notes.get('binary-search').text), 'valuable local conflicting draft');
      assert((await page.evaluate(() => window.__refinement.journal.list('binary-search')))
        .some(note => note.text === 'valuable local conflicting draft'));
    });

    await check('native-anchor-offset-marks-the-reached-first-heading-current', async env => {
      const page = await env.page();
      const heading = page.locator('#readingArticle h2[id]').first();
      const id = await heading.getAttribute('id');
      await heading.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.locator('#tocButton').click();
      await page.locator('#tocResults [aria-current="location"]').waitFor();
      assert.equal(await page.locator('#tocResults [aria-current="location"]').getAttribute('data-anchor'), id);
    });

    await check('TOC-clear-keeps-input-and-keyboard-focus', async env => {
      const page = await env.page(); await page.locator('#tocButton').click();
      const input = page.locator('#tocSearch'); await input.fill('lower_bound');
      await page.locator('#tocResults .search-row').first().waitFor();
      await input.fill('');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'tocSearch');
      assert(await page.locator('#tocResults .toc-row').count() > 2);
    });

    await check('offline-search-reports-unavailable-scope-and-keeps-track-filter', async env => {
      const page = await env.page();
      const collection = env.mock.catalog.collections.find(item => item.id === 'binary-search');
      for (const doc of collection.documents.filter(item => item.id !== 'bs-foundations'))
        env.mock.unavailable.add(new URL(doc.url, origin).pathname);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.locator('#libraryButton').click(); await page.locator('#librarySearch').fill('lower_bound');
      await page.waitForFunction(() => !document.querySelector('#bookList').textContent.includes('正在检索'));
      await page.locator('#bookList .search-row').first().waitFor();
      const text = await page.locator('#bookList').innerText();
      assert.match(text, /离线|未下载|未能|不可用|部分|本机/);
      const groups = await page.locator('#bookList .search-row').evaluateAll(rows => rows.map(row => row.dataset.goCollection));
      assert(groups.length > 0 && groups.every(group => group === 'binary-search'));
    });

    await check('slow-cross-document-keeps-reader-and-can-cancel-without-late-replacement', async env => {
      const page = await env.page();
      await page.locator('#readingPane').evaluate(node => node.scrollTop = 900);
      await page.waitForTimeout(80);
      const before = await page.evaluate(() => ({ html: document.querySelector('#readingArticle').innerHTML,
        scroll: document.querySelector('#readingPane').scrollTop,
        top: document.querySelector('#readingPane').getBoundingClientRect().top,
        title: document.querySelector('#currentTitle').textContent, hash: location.hash }));
      const next = env.mock.catalog.collections.find(item => item.id === 'binary-search').documents.find(item => item.id === 'bs-compositions');
      env.mock.delayDocument = new URL(next.url, origin).pathname;
      await page.locator('[data-document="bs-compositions"]').click();
      await poll(() => env.mock.heldDocument, 'Expected delayed cross-document request');
      assert.equal(await page.locator('#readingArticle').innerHTML(), before.html);
      assert(Math.abs((await page.locator('#readingPane').evaluate(node => node.scrollTop)) - before.scroll) < 3);
      assert.equal(await page.locator('#currentTitle').textContent(), before.title);
      assert.equal(await page.locator('#readingPane').evaluate(node => node.getBoundingClientRect().top), before.top);
      await page.locator('[data-cancel-route]').click();
      assert.equal(await page.evaluate(() => location.hash), before.hash);
      env.mock.heldDocument(); await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => window.__refinement.state.active.meta.id), 'bs-foundations');
      assert.equal(await page.locator('#readingArticle').innerHTML(), before.html);
      assert.equal(await page.locator('#readingNotice').isVisible(), false);
    });

    await check('return-button-separate-from-progress-and-restores-reading-place', async env => {
      const page = await env.page(); await page.locator('#readingPane').evaluate(node => node.scrollTop = 900);
      await page.waitForTimeout(100);
      const before = await page.locator('#readingPane').evaluate(node => node.scrollTop);
      const percentage = await page.locator('#progressLabel').innerText();
      await page.locator('#tocButton').click();
      const targets = page.locator('[data-go-document="bs-foundations"]');
      await targets.nth(Math.min(7, await targets.count() - 1)).click();
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open && !window.__refinement.state.restoring);
      assert.match(await page.locator('#progressLabel').innerText(), /%/);
      assert.doesNotMatch(await page.locator('#progressLabel').innerText(), /返回|原处/);
      await page.locator('#returnButton').click();
      await page.waitForFunction(() => !window.__refinement.state.restoring);
      assert(Math.abs((await page.locator('#readingPane').evaluate(node => node.scrollTop)) - before) < 8);
      assert.equal(await page.locator('#progressLabel').innerText(), percentage);
    });

    await check('sheet-browser-back-closes-and-source-parent-returns-to-settings', async env => {
      const page = await env.page();
      const hash = await page.evaluate(() => location.hash);
      await page.locator('#settingsButton').click();
      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      assert.equal(await page.evaluate(() => location.hash), hash);
      await page.locator('#settingsButton').click(); await page.locator('[data-show-source]').click();
      await page.locator('.source-view code').waitFor();
      assert.equal(await page.locator('#sheetTitle').textContent(), 'C++源码');
      await page.locator('#sheetBack').click();
      assert.equal(await page.locator('#sheetTitle').textContent(), '设置');
      assert.equal(await page.locator('[data-show-source]').isVisible(), true);
      await page.evaluate(() => history.back()); await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      assert.equal(await page.evaluate(() => location.hash), hash);
    });

    await check('sheet-close-and-immediate-reopen-in-same-task-retains-new-dialog', async env => {
      const page = await env.page(); await page.locator('#notesButton').click();
      const hash = await page.evaluate(() => location.hash);
      await page.evaluate(() => {
        document.querySelector('[data-sheet-close]').click();
        document.querySelector('#settingsButton').click();
      });
      await page.waitForFunction(() => document.querySelector('#sheetDialog').open
        && document.querySelector('#sheetTitle').textContent === '设置');
      await page.waitForTimeout(180);
      assert.equal(await page.locator('#sheetDialog').evaluate(node => node.open), true);
      assert.equal(await page.locator('#sheetTitle').textContent(), '设置');
      assert.equal(await page.evaluate(() => location.hash), hash);
      assert.equal(await page.locator('[data-check-updates]').isVisible(), true);
      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      assert.equal(await page.evaluate(() => location.hash), hash);
    });

    await check('visual-viewport-keyboard-fits-sheet-and-pinch-zoom-removes-keyboard-overrides', async env => {
      // Install one stable viewport object before app listener registration; change it after opening notes,
      // as native visualViewport does when the keyboard appears (rather than replacing the event source).
      await env.context.addInitScript(() => {
        const viewport = new EventTarget();
        Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
        window.__fakeViewport = viewport;
      });
      const page = await env.page(); await page.locator('#notesButton').click();
      await page.evaluate(() => {
        Object.assign(window.__fakeViewport, { height: 420, offsetTop: 22, scale: 1 });
        window.__fakeViewport.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(30);
      const geometry = await page.evaluate(() => {
        const sheet = document.querySelector('#sheetDialog').getBoundingClientRect();
        const header = document.querySelector('.sheet-header').getBoundingClientRect();
        const body = document.querySelector('#sheetBody').getBoundingClientRect();
        return { sheet: { top: sheet.top, bottom: sheet.bottom, height: sheet.height },
          header: { top: header.top, bottom: header.bottom, height: header.height },
          body: { top: body.top, bottom: body.bottom, height: body.height },
          variable: document.documentElement.style.getPropertyValue('--sheet-viewport-height') };
      });
      assert(geometry.sheet.top >= 22 && geometry.sheet.bottom <= 442, JSON.stringify(geometry));
      assert(geometry.header.height >= 50 && geometry.body.height > 100, JSON.stringify(geometry));
      assert(geometry.header.top >= 22 && geometry.header.bottom <= 442, JSON.stringify(geometry));
      assert(geometry.body.top >= 22 && geometry.body.bottom <= 442, JSON.stringify(geometry));
      assert.equal(geometry.variable, '420px');
      assert.equal(await page.locator('[data-sheet-close]').isVisible(), true);
      await page.evaluate(() => {
        Object.assign(window.__fakeViewport, { height: 200, scale: 2 });
        window.__fakeViewport.dispatchEvent(new Event('resize'));
      });
      const overrides = await page.evaluate(() => ['--sheet-viewport-height', '--sheet-offset-top', '--sheet-offset-bottom']
        .map(name => document.documentElement.style.getPropertyValue(name)));
      assert.deepEqual(overrides, ['', '', '']);
    });

    await check('TOC-anchor-consumed-and-later-reading-position-survives-reload', async env => {
      const page = await env.page(); await page.locator('#tocButton').click();
      const targets = page.locator('[data-go-document="bs-foundations"]');
      await targets.nth(Math.min(7, await targets.count() - 1)).click();
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open && !window.__refinement.state.restoring);
      assert.doesNotMatch(await page.evaluate(() => location.hash), /[?&]anchor=/);
      const positions = await page.locator('#readingPane').evaluate(node => {
        const old = node.scrollTop, maximum = node.scrollHeight - node.clientHeight;
        const next = Math.min(maximum, old + 850);
        node.scrollTop = Math.abs(next - old) > 300 ? next : Math.max(0, old - 850);
        return { old, current: node.scrollTop };
      });
      assert(Math.abs(positions.current - positions.old) > 300);
      await page.waitForTimeout(350);
      await page.reload(); await page.locator('#readingArticle .code-block').first().waitFor();
      await page.waitForFunction(() => !window.__refinement.state.restoring);
      const restored = await page.locator('#readingPane').evaluate(node => node.scrollTop);
      assert(Math.abs(restored - positions.current) < 8, JSON.stringify({ positions, restored }));
      assert.doesNotMatch(await page.evaluate(() => location.hash), /[?&]anchor=/);
    });

    await check('pure-code-click-does-not-reveal-controls-and-pointer-hold-keeps-controls-visible', async env => {
      const page = await env.page(); await page.locator('#pureButton').click();
      assert.equal(await page.locator('body').evaluate(node => node.classList.contains('pure-controls-visible')), false);
      await page.locator('.code-block code').first().click({ position: { x: 5, y: 5 } });
      assert.equal(await page.locator('body').evaluate(node => node.classList.contains('pure-controls-visible')), false);
      await page.locator('#readingPane').click({ position: { x: 3, y: 100 } });
      assert.equal(await page.locator('body').evaluate(node => node.classList.contains('pure-controls-visible')), true);
      const brand = await page.locator('.app-header h1').boundingBox();
      await page.mouse.move(brand.x + brand.width / 2, brand.y + brand.height / 2);
      await page.mouse.down(); await page.waitForTimeout(3200);
      assert.equal(await page.locator('body').evaluate(node => node.classList.contains('pure-controls-visible')), true);
      assert.equal(await page.locator('.app-header').getAttribute('inert'), null);
      await page.mouse.up();
    });

    await check('library-search-in-flight-completes-after-settings-open-and-close', async env => {
      const page = await env.page(); await page.locator('#libraryButton').click();
      const document = env.mock.catalog.collections.find(item => item.id === 'binary-search').documents
        .find(item => item.id === 'bs-compositions');
      env.mock.delayDocument = new URL(document.url, origin).pathname;
      await page.locator('#librarySearch').fill('lower_bound');
      await poll(() => env.mock.heldDocument, 'Expected search to wait for a document');
      assert.match(await page.locator('#bookList').innerText(), /正在检索/);
      await page.locator('#settingsButton').click();
      await page.locator('[data-sheet-close]').click();
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      env.mock.heldDocument();
      await page.locator('#bookList .search-row').first().waitFor();
      assert.doesNotMatch(await page.locator('#bookList').innerText(), /正在检索/);
      assert.equal(await page.locator('#librarySearch').inputValue(), 'lower_bound');
      const groups = await page.locator('#bookList .search-row').evaluateAll(rows => rows.map(row => row.dataset.goCollection));
      assert(groups.length > 0 && groups.every(group => group === 'binary-search'));
    });
  } finally { await browser.close(); }
  const report = { passed: failures.length === 0, results, failures, productionContacted: false,
    realDatabaseModified: false, testedAt: new Date().toISOString() };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
