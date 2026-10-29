// Actual frontend with deterministic slow responses; no production/account requests.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), { chromium } = require('playwright'), esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.ALGORITHM_STARTUP_QA || path.join(root, '.local/startup-fidelity/qa'));
const origin = 'http://localhost:9877', owner = 'c'.repeat(43), hash = value => createHash('sha256').update(value).digest('hex');
const checks = [], errors = [], bounds = [], externalRequests = [], contexts = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const frame = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

(async () => {
  const temporary = path.join(output, 'tmp'); await fs.mkdir(temporary, { recursive: true }); process.env.TEMP = process.env.TMP = temporary;
  const catalog = { schemaVersion: 2, version: 'startup-fixture', collections: [], questions: [] }, bodies = new Map();
  for (const [i, id, date] of [[1, 'first', '2026-10-28'], [2, 'second', '2026-10-29']]) {
    const html = `<h2 id="prelude">PRE、启动核验${i}</h2><p>${'这是一份隔离界面核验材料，不是正式教材。'.repeat(70)}</p><h3 id="method">（1）方法：版本与读位</h3><p>${'旧纸面必须保留到新内容准备完成。'.repeat(70)}</p>`;
    const revision = hash(html), meta = { id: 'doc-' + i, title: '核验章节' + i, revision, url: `/library/${id}/doc-${i}/${revision.slice(0, 16)}.json`, headings: [{ depth: 2, id: 'prelude', text: 'PRE、启动核验' + i }, { depth: 3, id: 'method', text: '（1）方法：版本与读位' }], knowledgeIds: [] };
    catalog.collections.push({ id, kind: 'chapter', chapterNumber: i, title: '核验章节' + i, date, documents: [meta] });
    bodies.set(meta.url, { ...meta, html });
  }
  const index = { version: catalog.version, questions: [], chapters: Object.fromEntries(catalog.collections.map(c => [c.id, { date: c.date }])), collections: Object.fromEntries(catalog.collections.map(c => [c.id, { [c.documents[0].id]: c.documents[0].revision }])) };
  const source = await fs.readFile(path.join(root, 'web/app.js'), 'utf8');
  const built = await esbuild.build({ stdin: { contents: source + '\nglobalThis.__startupQA={S,runtime};', resolveDir: path.join(root, 'web'), sourcefile: 'app.js' }, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, define: { __PUBLICATION_INDEX__: JSON.stringify(index) } });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.ALGORITHM_QA_CHROME || 'C:/Users/huawei/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
  async function fixture({ scenario = 'normal', width = 402, hold = [], holdOwner = false, failFirstDocument = false, routeHash = '#/chapter/first' } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 874 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); contexts.push(context);
    const gates = Object.fromEntries(hold.map(name => [name, deferred()])), seen = Object.fromEntries(['app', 'auth', 'library', 'state', 'doc1', 'doc2'].map(name => [name, deferred()]));
    let docAttempts = 0;
    await context.addInitScript(({ holdOwner }) => {
      const active = { postMessage(message, ports) {
        if (message.type === 'OWNER' && holdOwner) { globalThis.__ownerPending = true; globalThis.__releaseOwner = () => { globalThis.__ownerPending = false; ports[0].postMessage({ ok: true }); }; }
        else ports[0].postMessage({ ok: true });
      } };
      const serviceWorker = { controller: null, ready: Promise.resolve({ active }), register: () => Promise.resolve({ active }), addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(Navigator.prototype, 'serviceWorker', { configurable: true, get: () => serviceWorker });
      globalThis.__loadingLeaks = [];
      const visible = node => node && node.getClientRects().length && getComputedStyle(node).display !== 'none';
      new MutationObserver(() => {
        const card = document.querySelector('.login-card');
        if (visible(card) && card.dataset.state === 'loading') {
          const leaked = ['loginButton', 'retryButton', 'enrollForm', 'startupInstall'].filter(id => visible(document.getElementById(id)));
          if (leaked.length) globalThis.__loadingLeaks.push(leaked);
        }
      }).observe(document, { childList: true, subtree: true, attributes: true });
    }, { holdOwner });
    const wait = async name => { seen[name].resolve(); await gates[name]?.promise; };
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
      if (url.origin !== origin) { externalRequests.push(request.url()); return route.abort(); }
      if (pathname === '/app.js') { await wait('app'); return route.fulfill({ contentType: 'text/javascript', body: built.outputFiles[0].text }); }
      if (pathname === '/auth/status') { await wait('auth'); return route.fulfill({ status: scenario === 'error' ? 503 : 200, json: scenario === 'error' ? { error: '隔离连接失败' } : { authenticated: !['login', 'enroll'].includes(scenario), enrolled: scenario !== 'enroll', enrollmentOpen: scenario === 'enroll', ownerScope: owner } }); }
      if (pathname === '/api/library') { await wait('library'); return route.fulfill({ json: catalog }); }
      if (pathname === '/api/state') { if (request.method() === 'GET') await wait('state'); return route.fulfill({ json: request.method() === 'GET' ? { state: { preferences: { revision: 1, value: { preload: false } } } } : { revision: 1, record: { revision: 1, value: request.postDataJSON()?.value, updatedAt: Date.now() } } }); }
      if (bodies.has(pathname)) {
        const number = pathname.includes('/first/') ? 1 : 2; await wait('doc' + number);
        if (number === 1 && failFirstDocument && ++docAttempts === 1) return route.fulfill({ status: 503, json: { error: '隔离首章失败' } });
        return route.fulfill({ json: bodies.get(pathname) });
      }
      if (pathname.startsWith('/auth/') || pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Isolated fixture' } });
      try {
        const file = path.join(root, 'web', pathname === '/' ? 'index.html' : pathname.slice(1));
        return route.fulfill({ body: await fs.readFile(file), contentType: ({ '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.js': 'text/javascript' })[path.extname(file)] || 'application/octet-stream' });
      } catch { return route.fulfill({ status: 404, body: '' }); }
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/' + routeHash, { waitUntil: 'commit', timeout: 15000 });
    return { page, context, seen, release: name => gates[name]?.resolve() };
  }
  const shot = (page, name) => page.screenshot({ path: path.join(output, name + '.png'), scale: 'css' });
  async function loadingIsClean(page, name) {
    await frame(page);
    check(name + ': loading card remains visible', await page.locator('.login-card[data-state="loading"]').isVisible());
    check(name + ': no account/install controls during loading', await page.locator('#loginView button:visible, #loginView form:visible').count() === 0);
    check(name + ': no header before shell ready', await page.locator('#appHeader').isHidden());
    check(name + ': no recorded loading button flash', await page.evaluate(() => __loadingLeaks.length === 0));
  }
  async function measure(page, name) {
    const data = await page.locator('.login-card').evaluate(card => {
      const body = card.querySelector('.state-body'), icon = card.querySelector('.state-icon'), heading = body.querySelector('h2'), copy = body.querySelector('p');
      return { card: card.getBoundingClientRect().toJSON(), body: { top: getComputedStyle(body).paddingTop, right: getComputedStyle(body).paddingRight, bottom: getComputedStyle(body).paddingBottom, left: getComputedStyle(body).paddingLeft }, icon: icon.getBoundingClientRect().toJSON(), heading: getComputedStyle(heading).fontSize, copy: getComputedStyle(copy).fontSize, brand: card.querySelector('.state-band>span').textContent };
    });
    bounds.push({ name, ...data });
    check(name + ': actual product brand', data.brand === '第二算法');
    check(name + ': reference icon dimensions', data.icon.width === 56 && data.icon.height === 56);
    check(name + ': reference body padding', data.body.top === '17px' && data.body.bottom === '17px' && data.body.left === '14px' && data.body.right === '14px');
    check(name + ': reference heading and copy scale', data.heading === '17px' && data.copy === '12px');
    check(name + ': card stays inside viewport', data.card.x >= 0 && data.card.x + data.card.width <= page.viewportSize().width + 1);
  }
  let passed = false, failure = null;
  try {
    const staged = await fixture({ hold: ['app', 'auth', 'library', 'state', 'doc1'], holdOwner: true });
    await staged.seen.app.promise;
    await staged.page.waitForFunction(() => getComputedStyle(document.querySelector('.state-body')).display === 'grid');
    await loadingIsClean(staged.page, 'before JavaScript'); await measure(staged.page, '402 startup'); await shot(staged.page, '01-static-loading');
    staged.release('app'); await staged.seen.auth.promise; await loadingIsClean(staged.page, 'waiting for authentication');
    staged.release('auth'); await staged.seen.library.promise; await loadingIsClean(staged.page, 'authenticated and waiting for catalog'); await shot(staged.page, '02-catalog-loading');
    staged.release('library'); await staged.seen.state.promise; await loadingIsClean(staged.page, 'waiting for saved state');
    staged.release('state'); await staged.page.waitForFunction(() => globalThis.__ownerPending === true); await loadingIsClean(staged.page, 'waiting for owner acknowledgement');
    await staged.page.evaluate(() => __releaseOwner()); await staged.seen.doc1.promise;
    await staged.page.locator('#chapterView.is-opening').waitFor();
    check('initial chapter fetch shows shell', await staged.page.locator('#appHeader').isVisible() && await staged.page.locator('#chapterNav').isVisible());
    check('initial chapter fetch retains a visible in-paper state card', await staged.page.locator('#chapterView .state-card').isVisible());
    check('initial chapter fetch has inline status and no corner notice', await staged.page.locator('.chapter-load-status').isVisible() && await staged.page.locator('#readingNotice').isHidden());
    const stage = await staged.page.locator('#chapterView').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, height: node.getBoundingClientRect().height }));
    check('initial chapter fetch has a substantial white paper surface', stage.background === 'rgb(255, 255, 255)' && stage.height > 300);
    await shot(staged.page, '03-paper-opening'); staged.release('doc1'); await staged.page.locator('.chapter-inner').waitFor();
    check('completed chapter removes opening status', await staged.page.locator('.chapter-load-status').count() === 0 && !(await staged.page.locator('#chapterView').getAttribute('class')).includes('is-opening'));
    await shot(staged.page, '04-chapter-ready'); check('all initial loading phases had no button flashes', await staged.page.evaluate(() => __loadingLeaks.length === 0)); await staged.context.close();

    const failed = await fixture({ failFirstDocument: true });
    await failed.page.locator('#chapterView [data-retry-route]').waitFor();
    check('first document failure stays in the paper, not a floating notice', await failed.page.locator('#chapterView .state-card').isVisible() && await failed.page.locator('#readingNotice').isHidden());
    check('first document failure has truthful text', (await failed.page.locator('#chapterView').innerText()).includes('暂时无法打开'));
    await shot(failed.page, '05-first-chapter-error'); await failed.page.locator('#chapterView [data-retry-route]').click(); await failed.page.locator('.chapter-inner').waitFor();
    check('first document failure retry reaches real chapter', (await failed.page.locator('.chapter-inner').innerText()).includes('核验章节1')); await failed.context.close();

    const switching = await fixture({ hold: ['doc2'], routeHash: '#/read/first/doc-1' }); await switching.page.locator('#article h2').waitFor();
    await switching.page.locator('#nextChapter').click(); await switching.seen.doc2.promise;
    check('slow chapter switch preserves old reader', await switching.page.locator('#readerView').isVisible() && (await switching.page.locator('#article h2').innerText()).includes('启动核验1'));
    await shot(switching.page, '06-switch-preserves-paper'); switching.release('doc2'); await switching.page.waitForFunction(() => document.querySelector('#article h2')?.textContent.includes('启动核验2')); await switching.context.close();

    for (const scenario of ['login', 'enroll', 'error']) {
      const one = await fixture({ scenario }); await one.page.locator(`.login-card[data-state="${scenario}"]`).waitFor();
      check(scenario + ': startup still hides reader tools', await one.page.locator('#appHeader').isHidden());
      check(scenario + ': correct account action', scenario === 'login' ? await one.page.locator('#loginButton').isVisible() && await one.page.locator('#enrollForm').isHidden() : scenario === 'enroll' ? await one.page.locator('#enrollForm').isVisible() && await one.page.locator('#loginButton').isHidden() : await one.page.locator('#retryButton').isVisible() && await one.page.locator('#loginButton').isHidden() && await one.page.locator('#enrollForm').isHidden());
      await shot(one.page, '07-' + scenario); await one.context.close();
    }
    const narrow = await fixture({ width: 320, hold: ['app'] }); await narrow.seen.app.promise; await narrow.page.waitForFunction(() => getComputedStyle(document.querySelector('.state-body')).display === 'grid');
    await measure(narrow.page, '320 startup'); check('320 startup has no horizontal overflow', await narrow.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot(narrow.page, '08-narrow-loading'); narrow.release('app'); await narrow.context.close();
    check('no unexpected outside requests', externalRequests.length === 0); check('no frontend runtime errors', errors.length === 0); passed = true;
  } catch (error) { failure = error.stack || error.message; throw error; }
  finally { for (const context of contexts) await context.close().catch(() => {}); await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed, failure, checks, bounds, errors, externalRequests, productionContacted: false, paidServiceContacted: false, physicalIPhone: false }, null, 2) + '\n'); }
  console.log(JSON.stringify({ passed, checks: checks.length, output }));
})().catch(error => { console.error(error); process.exitCode = 1; });
