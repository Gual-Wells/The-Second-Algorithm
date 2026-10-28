// Browser regression against the actual web sources with an entirely in-memory owner/API.
// Does not enroll a passkey, contact production, or change any D1 database.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const origin = 'http://localhost:9876';
const owner = 'a'.repeat(43);
const output = path.join(root, '.local/refinement-qa');
const temporary = path.join(root, '.local/refinement-browser-tmp');
const chrome = process.env.ALGORITHM_QA_CHROME;
const qaLibrary = path.join(root, '.local/carrier-qa-library');
let qaCatalog, makeIndex;

// A current-schema UI fixture exercises multiple documents without depending on
// retired chapters or prescribing a production chapter/document count.
async function createCorpus() {
  const catalog = { schemaVersion: 2, version: 'qa-course-v3', collections: [], questions: [
    { id: 'Q000001', title: '有效范围', prerequisites: [] },
    { id: 'Q000002', title: '删除一个重复对象', prerequisites: ['Q000001'] }
  ] };
  for (const question of catalog.questions) {
    const html = question.id === 'Q000001' ? '<a id="lifetime"></a><p>范围的寿命和有效性。</p><p>' + '知识正文。'.repeat(250) + '</p>'
      : '<p>删除一份需要保留其他重复对象。</p><p><a href="#knowledge-Q000001" data-knowledge="Q000001" data-knowledge-anchor="lifetime">范围寿命</a></p>';
    question.revision = createHash('sha256').update(html).digest('hex');
    question.url = `/library/knowledge/${question.id}/${question.revision.slice(0, 16)}.json`;
    const file = path.join(qaLibrary, question.url.slice(1)); await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ ...question, html, anchors: question.id === 'Q000001' ? ['lifetime'] : [] }));
  }
  for (const [collectionId, ids] of [['practice-course', ['practice-entry', 'practice-composition', 'practice-alternative']], ['additional-course', ['other-method']]]) {
    const collection = { id: collectionId, kind: 'chapter', chapterNumber: catalog.collections.length + 1,
      title: collectionId === 'practice-course' ? '实战方法与实现' : '不同算法的比较', documents: [] };
    for (const id of ids) {
      const headings = [], sections = [];
      const canonical = 'int lower_manual(int value) { return value; }\n// ' + 'long_identifier '.repeat(20);
      sections.push(`<div class="code-block" data-code-id="example"><div class="code-toolbar"><span>C++</span><button type="button" class="code-copy" data-copy-code="example" aria-label="复制代码">复制</button></div><pre><code>${canonical}</code></pre></div>`);
      for (let index = 0; index < 16; index++) {
        const heading = { depth: 2, id: 'section-' + index, text: 'lower_bound 与边界判断 ' + (index + 1) };
        headings.push(heading);
        sections.push(`<h2 id="${heading.id}">${heading.text}</h2><p>${'保持状态不变量，比较手写与标准设施的范围、返回值和复杂度。'.repeat(12)}</p>`);
        if (index === 0) sections.push('<p><a href="#knowledge-Q000002" data-knowledge="Q000002">删除一个重复对象</a></p>');
      }
      sections.push('<div class="table-wrap"><table><tr><th>操作</th><th>条件</th></tr><tr><td><code>std::vector&lt;long_long_identifier&gt;::const_iterator</code></td><td>有效范围与结束位置</td></tr></table></div>');
      const html = sections.join('\n'), revision = createHash('sha256').update(html).digest('hex');
      const prefix = `/library/${collectionId}/${id}/${revision.slice(0, 16)}`;
      const meta = { id, title: id === 'practice-entry' ? '从范围到作答' : '实现与条件 ' + id,
        revision, url: prefix + '.json', sourceUrl: prefix + '.cpp', markdownUrl: prefix + '.md', headings, knowledgeIds: ['Q000001', 'Q000002'] };
      const file = path.join(qaLibrary, meta.url.slice(1)); await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify({ ...meta, html }));
      await fs.writeFile(path.join(qaLibrary, meta.sourceUrl.slice(1)), canonical);
      await fs.writeFile(path.join(qaLibrary, meta.markdownUrl.slice(1)), '# UI fixture\n');
      collection.documents.push(meta);
    }
    catalog.collections.push(collection);
  }
  await fs.mkdir(path.join(qaLibrary, 'library'), { recursive: true });
  await fs.writeFile(path.join(qaLibrary, 'library/catalog.json'), JSON.stringify(catalog));
  return catalog;
}

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
  return { context, mock, async page(hash = '#/read/practice-course/practice-entry') {
    const page = await context.newPage();
    await page.goto(origin + '/' + hash);
    if (catalog.state === 'withdrawn') await page.locator('#libraryView').waitFor({ state: 'visible' });
    else await page.locator('#readingArticle .code-block').first().waitFor();
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
  qaCatalog = await createCorpus();
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
    await check('viewport-matrix-preserves-paper-code-selection-and-Q-sheet', async env => {
      const page = await env.page();
      for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 740 }, { width: 1280, height: 800 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(viewport); await page.waitForTimeout(70);
        const geometry = await page.evaluate(() => {
          const pane = document.querySelector('#readingPane'), paper = document.querySelector('#readingArticle');
          const pre = paper.querySelector('pre'), copy = paper.querySelector('.code-copy');
          return { outer: document.documentElement.scrollWidth, viewport: innerWidth, pane: pane.clientHeight,
            paper: paper.getBoundingClientRect().width, width: pane.clientWidth, copy: copy.getBoundingClientRect().height,
            horizontalCode: pre.scrollWidth > pre.clientWidth };
        });
        assert(geometry.outer <= geometry.viewport + 1 && geometry.pane > 100, JSON.stringify({ viewport, geometry }));
        assert(geometry.paper <= geometry.width + 1 && geometry.copy >= 44 && geometry.horizontalCode, JSON.stringify(geometry));
        await page.locator('#readingPane').evaluate(node => node.scrollTop = 500); await page.waitForTimeout(70);
        const before = await page.locator('#readingArticle').evaluate(node => node.getBoundingClientRect().width);
        await page.locator('#pureButton').click();
        assert.equal(await page.locator('#readingArticle').evaluate(node => node.getBoundingClientRect().width), before);
        await page.keyboard.press('Escape');
        await page.locator('#readingArticle [data-knowledge]').first().click();
        await page.locator('.knowledge-paper').waitFor();
        const sheet = await page.locator('#sheetBody').boundingBox(); assert(sheet.height > 80);
        await page.screenshot({ path: path.join(output, `viewport-${viewport.width}x${viewport.height}.png`) });
        await page.locator('[data-sheet-close]').click(); await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      }
    });

    await check('built-current-publication-renders-content-or-explicit-empty-withdrawal', async () => {
      const catalog = JSON.parse(await fs.readFile(path.join(root, 'dist/library/catalog.json'), 'utf8'));
      assert.equal(catalog.schemaVersion, 2, 'build the current schema before browser QA');
      const real = await environment(browser, { catalog, libraryRoot: path.join(root, 'dist') });
      try {
        if (catalog.state === 'withdrawn') {
          assert.deepEqual(catalog.collections, []); assert.deepEqual(catalog.questions, []);
          const page = await real.page('#/read/retired/retired');
          await page.waitForURL('**/#/library');
          assert.match(await page.locator('#bookList').innerText(), /暂无章节/);
          assert.equal(await page.locator('#bookList .book-row').count(), 0);
          assert.equal(await page.locator('#readingArticle .code-block').count(), 0);
          assert.equal(await page.locator('#questionsButton').count(), 0);
          await page.locator('#librarySearch').fill('retired');
          await page.waitForFunction(() => document.querySelector('#bookList').textContent.includes('暂无可检索内容'));
          assert.equal(real.mock.requests.filter(request => request.path.startsWith('/library/')
            && request.path !== '/library/catalog.json').length, 0);
          await page.screenshot({ path: path.join(output, 'current-withdrawal.png') });
          assert.deepEqual(real.mock.errors, []);
          return;
        }
        assert(catalog.questions.length > 0);
        const collection = catalog.collections[0], meta = collection.documents[0];
        const page = await real.page(`#/read/${collection.id}/${meta.id}`);
        assert(await page.locator('#readingArticle .code-block').count() > 0);
        assert.doesNotMatch(await page.locator('#readingArticle').innerText(), /Q\d{6}/);
        for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 740 }, { width: 1280, height: 800 }, { width: 874, height: 402 }]) {
          await page.setViewportSize(viewport); await page.waitForTimeout(70);
          const geometry = await page.evaluate(() => {
            const pane = document.querySelector('#readingPane'), paper = document.querySelector('#readingArticle');
            return { outer: document.documentElement.scrollWidth, viewport: innerWidth, pane: pane.clientHeight,
              paper: paper.getBoundingClientRect().width, width: pane.clientWidth };
          });
          assert(geometry.outer <= geometry.viewport + 1 && geometry.pane > 100 && geometry.paper <= geometry.width + 1,
            JSON.stringify({ viewport, geometry }));
          await page.screenshot({ path: path.join(output, `current-publication-${viewport.width}x${viewport.height}.png`) });
        }
        await page.setViewportSize({ width: 402, height: 874 });
        // Check the actual current documents, not only the synthetic reader fixture
        // or the first manuscript in a multi-part chapter.
        for (const chapter of catalog.collections) for (const document of chapter.documents) {
          await page.goto(`${origin}/#/read/${chapter.id}/${document.id}`);
          await page.waitForFunction(id => window.__refinement.state.active?.meta.id === id
            && !window.__refinement.state.restoring, document.id);
          await page.locator('#readingArticle .code-block').first().waitFor();
          const current = await page.evaluate(() => ({
            outer: document.documentElement.scrollWidth, viewport: innerWidth,
            headings: document.querySelectorAll('#readingArticle h2').length,
            text: document.querySelector('#readingArticle').innerText
          }));
          assert(current.outer <= current.viewport + 1, document.id + ': outer overflow');
          assert.equal(current.headings, document.headings.filter(h => h.depth === 2).length);
          assert.doesNotMatch(current.text, /Q\d{6}/, document.id + ': exposed knowledge identity');
          await page.screenshot({ path: path.join(output, `current-${document.id}-402x874.png`) });
        }
        const binary = catalog.collections.find(chapter => chapter.id === 'chapter-01');
        assert.equal(binary.documents.length, 1, 'the current binary chapter has one logical reader document');
        assert.equal(binary.documents[0].id, 'binary-search');
        const composition = JSON.parse(await fs.readFile(path.join(root, 'content/binary/chapter.authoring.json'), 'utf8'));
        const selections = [composition.prelude, ...composition.sections];
        assert.equal(selections.length, 38, 'this is the current chapter scope, not a generic UI limit');
        await page.goto(`${origin}/#/read/${binary.id}/binary-search`);
        await page.waitForFunction(() => window.__refinement.state.active?.meta.id === 'binary-search'
          && !window.__refinement.state.restoring);
        assert.equal(await page.locator('#documentTabs').isVisible(), false);
        const mainSections = await page.locator('#readingArticle').evaluate((article, anchors) => {
          const headings = [...article.querySelectorAll('h2[id]')];
          return anchors.map(anchor => {
            const marker = [...article.querySelectorAll('[id]')].find(node => node.id === anchor);
            const heading = marker && headings.find(node => marker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
            return { anchor, id: heading?.id, title: heading?.textContent, index: headings.indexOf(heading) };
          });
        }, selections.map(selection => selection.anchor));
        assert.deepEqual(mainSections.map(section => section.index), selections.map((_, index) => index),
          'rendered H2 order must follow the explicit composition across all four author files');
        assert.equal(await page.locator('#readingArticle h2').count(), 38);
        await page.locator('#tocButton').click();
        assert.deepEqual(await page.locator('#tocResults .toc-row').evaluateAll(rows => rows.map(row => ({
          id: row.dataset.anchor, title: row.textContent
        }))), mainSections.map(section => ({ id: section.id, title: section.title })));
        assert.equal(await page.locator('#tocResults .depth-3,#tocResults .toc-group').count(), 0,
          'the reader directory exposes main sections without internal manuscripts or H3 subheadings');
        await page.screenshot({ path: path.join(output, 'current-main-section-directory.png') });
        await page.locator('[data-sheet-close]').click();
        await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
        const ordered = mainSections.find(section => section.anchor === 'ordered-boundaries');
        const dynamic = mainSections.find(section => section.anchor === 'fenwick-rank');
        assert(ordered && dynamic);
        // Reaching an implementation H3 keeps the question type as the footer
        // title; progress is calculated across the entire composed chapter.
        await page.locator('#readingArticle').evaluate((article, id) => {
          const children = [...article.children], index = children.findIndex(node => node.id === id);
          const detail = children.slice(index + 1).find(node => node.tagName === 'H3');
          if (!detail) throw new Error('Expected a real implementation subheading');
          detail.scrollIntoView({ block: 'start' });
        }, ordered.id);
        await page.waitForFunction(title => document.querySelector('#progressLabel span').textContent === title, ordered.title);
        const expectedProgress = await page.locator('#readingPane').evaluate(node =>
          Math.round(100 * node.scrollTop / (node.scrollHeight - node.clientHeight)));
        await page.waitForFunction(value => Number(document.querySelector('#progressLabel').getAttribute('aria-valuenow')) === value,
          expectedProgress);
        assert.equal(Number(await page.locator('#progressLabel').getAttribute('aria-valuenow')), expectedProgress);
        for (const [query, expected] of [['有序数据 equal_range', ordered], ['动态频数 kth', dynamic]]) {
          await page.locator('#tocButton').click();
          await page.locator('#tocSearch').fill(query);
          await page.locator('#tocResults .search-row').first().waitFor();
          const hits = await page.locator('#tocResults .search-row').evaluateAll(rows => rows.map(row => ({
            document: row.dataset.goDocument, title: row.querySelector('strong')?.textContent
          })));
          assert(hits.some(hit => hit.document === 'binary-search' && hit.title?.includes(expected.title)),
            query + ': title and implementation tokens must combine within the parent question type');
          await page.screenshot({ path: path.join(output, `current-search-${expected.anchor}.png`) });
          assert((await page.locator('#sheetBody').evaluate(node => node.scrollTop)) < 3,
            query + ': fresh search results must start at the top instead of keeping the old directory scroll');
          await page.locator('#tocResults .search-row[data-go-document="binary-search"]').first().click();
          await page.waitForFunction(() => !document.querySelector('#sheetDialog').open && !window.__refinement.state.restoring);
          assert.equal(await page.evaluate(() => window.__refinement.state.active.meta.id), 'binary-search');
          await page.waitForFunction(title => document.querySelector('#progressLabel span').textContent === title, expected.title);
          assert.equal(await page.locator('#progressLabel span').innerText(), expected.title);
        }
        const beforeKnowledge = await page.evaluate(() => ({ top: document.querySelector('#readingPane').scrollTop,
          hash: location.hash, progress: document.querySelector('#progressLabel').textContent }));
        await page.locator('#tocButton').click(); await page.locator('#tocSearch').fill('严格弱序');
        const knowledgeHit = page.locator('#tocResults .search-row[data-knowledge]').first();
        await knowledgeHit.waitFor();
        const knowledgeId = await knowledgeHit.getAttribute('data-knowledge');
        const knowledge = catalog.questions.find(question => question.id === knowledgeId);
        assert(knowledge, 'a knowledge result must resolve to an actually published knowledge card');
        assert.equal(await knowledgeHit.locator('strong').innerText(), knowledge.title);
        assert.doesNotMatch(await knowledgeHit.innerText(), /Q\d{6}/);
        await page.screenshot({ path: path.join(output, 'current-knowledge-search.png') });
        assert((await page.locator('#sheetBody').evaluate(node => node.scrollTop)) < 3,
          'knowledge results must be visible from their start before any automated click scrolls them into view');
        await knowledgeHit.click(); await page.locator('.knowledge-paper').waitFor();
        assert.equal(await page.locator('#sheetTitle').innerText(), knowledge.title);
        await page.locator('[data-sheet-close]').click();
        await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
        const afterKnowledge = await page.evaluate(() => ({ top: document.querySelector('#readingPane').scrollTop,
          hash: location.hash, progress: document.querySelector('#progressLabel').textContent }));
        assert.equal(afterKnowledge.hash, beforeKnowledge.hash);
        assert.equal(afterKnowledge.progress, beforeKnowledge.progress);
        assert(Math.abs(afterKnowledge.top - beforeKnowledge.top) < 3,
          JSON.stringify({ beforeKnowledge, afterKnowledge }));
        await page.locator('#readingArticle [data-knowledge]').first().click();
        await page.locator('.knowledge-paper').waitFor();
        assert.doesNotMatch(await page.locator('#sheetTitle').innerText(), /Q\d{6}/);
        await page.screenshot({ path: path.join(output, 'current-knowledge-402x874.png') });
        await page.locator('[data-sheet-close]').click();
        const crossLink = page.locator('#readingArticle a[href^="#/read/"]').first();
        if (await crossLink.count()) {
          const href = await crossLink.getAttribute('href');
          const anchor = new URLSearchParams(href.split('?')[1]).get('anchor');
          // The reader consumes the anchor query after positioning so reload
          // restores the saved reading place rather than replaying this jump.
          await crossLink.click(); await page.waitForURL(origin + '/' + href.split('?')[0]);
          if (anchor) await page.waitForFunction(id => [...document.querySelectorAll('#readingArticle [id]')]
            .some(node => node.id === id), anchor);
          await page.locator('#readingArticle .code-block').first().waitFor();
          assert.equal(await page.locator('#readingArticle .code-block').count() > 0, true);
        }
        assert.deepEqual(real.mock.errors, []);
      } catch (error) {
        for (const [index, page] of real.context.pages().entries()) {
          await page.screenshot({ path: path.join(output, `current-publication-failure-${index}.png`) }).catch(() => {});
          await fs.writeFile(path.join(output, `current-publication-failure-${index}.txt`), await page.locator('body').innerText()).catch(() => {});
        }
        throw error;
      } finally { await real.context.close(); }
    });

    await check('semantic-knowledge-opens-in-place-with-hidden-identity-and-restores-focus', async env => {
      const page = await env.page();
      assert.equal(await page.locator('#questionsButton,[data-track],#trackTabs').count(), 0);
      assert.doesNotMatch(await page.locator('#readingArticle').innerText(), /Q[0-9]{6}/);
      const link = page.locator('#readingArticle [data-knowledge]').first();
      await link.scrollIntoViewIfNeeded(); await link.focus();
      const before = await page.locator('#readingPane').evaluate(node => node.scrollTop), hash = await page.evaluate(() => location.hash);
      await link.click(); await page.locator('.knowledge-paper').waitFor();
      assert.equal(await page.locator('#sheetTitle').innerText(), '删除一个重复对象');
      assert.equal(await page.evaluate(() => location.hash), hash);
      assert.equal(await page.locator('#readingPane').evaluate(node => node.scrollTop), before);
      await page.locator('[data-sheet-close]').click();
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      assert.equal(await page.locator('#readingPane').evaluate(node => node.scrollTop), before);
      assert(await link.evaluate(node => node === document.activeElement));
    });

    await check('knowledge-prerequisite-navigation-and-browser-back-preserve-the-reader', async env => {
      const page = await env.page();
      const link = page.locator('#readingArticle [data-knowledge]').first();
      await link.click(); await page.locator('.knowledge-paper').waitFor();
      await page.locator('#sheetBody [data-knowledge]').click();
      await page.waitForFunction(() => document.querySelector('#sheetTitle').textContent === '有效范围' && !!document.querySelector('.knowledge-paper'));
      assert.equal(await page.locator('#sheetBody #lifetime').count(), 1);
      await page.locator('#sheetBack').click();
      assert.equal(await page.locator('#sheetTitle').innerText(), '删除一个重复对象');
      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      assert.equal(await page.evaluate(() => window.__refinement.state.active.meta.id), 'practice-entry');
    });

    await check('knowledge-close-and-immediate-reopen-keeps-the-new-sheet', async env => {
      const page = await env.page();
      await page.locator('#readingArticle [data-knowledge]').first().click(); await page.locator('.knowledge-paper').waitFor();
      await page.evaluate(() => {
        document.querySelector('[data-sheet-close]').click();
        document.querySelector('#readingArticle [data-knowledge]').click();
      });
      await page.waitForTimeout(200); await page.locator('.knowledge-paper').waitFor();
      assert(await page.locator('#sheetDialog').evaluate(node => node.open));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
    });

    await check('knowledge-loading-failure-and-late-response-do-not-reopen-a-closed-sheet', async env => {
      const page = await env.page(), card = qaCatalog.questions[1];
      env.mock.unavailable.add(card.url);
      await page.locator('#readingArticle [data-knowledge]').first().click();
      await page.waitForFunction(() => document.querySelector('#sheetBody').textContent.includes('未下载'));
      await page.locator('[data-sheet-close]').click(); await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      env.mock.unavailable.delete(card.url); env.mock.delayDocument = card.url;
      await page.locator('#readingArticle [data-knowledge]').first().click();
      await poll(() => env.mock.heldDocument, 'Expected delayed knowledge request');
      await page.locator('[data-sheet-close]').click(); await page.waitForFunction(() => !document.querySelector('#sheetDialog').open);
      env.mock.heldDocument(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#sheetDialog').evaluate(node => node.open), false);
      assert.equal(await page.evaluate(() => window.__refinement.state.knowledge.has('Q000002')), false);
    });

    await check('same-browser-two-page-late-ACK-and-reload', async env => {
      const a = await env.page(), b = await env.page();
      await a.locator('#notesButton').click(); await b.locator('#notesButton').click();
      env.mock.holdNotePage = a;
      await a.locator('#noteEditor').fill('A: committed before delayed response');
      await poll(() => env.mock.heldNote, 'Expected A save request');
      await b.locator('#noteEditor').fill('B: unsent local draft must survive A ACK');
      env.mock.heldNote();
      await a.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      const beforeReload = await b.evaluate(() => window.__refinement.journal.list('practice-course'));
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
      await poll(() => env.mock.state['notes:practice-course']?.value === 'new text while first response is pending'
        && env.mock.state['notes:practice-course']?.revision === 2, 'Expected rebased second save');
      await page.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      assert.deepEqual(await page.evaluate(() => window.__refinement.journal.list('practice-course')), []);
      const value = await page.evaluate(() => window.__refinement.journal.load('practice-course'));
      assert.deepEqual(value, { text: 'new text while first response is pending', revision: 2, dirty: false });
    });

    await check('same-text-older-base-other-tab-draft-is-not-invisible-in-recovery', async env => {
      const a = await env.page(), b = await env.page();
      await a.locator('#notesButton').click(); await b.locator('#notesButton').click();
      await a.locator('#noteEditor').fill('same desired content');
      await a.waitForFunction(() => document.querySelector('#noteStatus')?.textContent.includes('已同步'));
      await b.locator('#noteEditor').fill('same desired content');
      await a.waitForTimeout(100);
      const pending = await a.evaluate(() => window.__refinement.journal.list('practice-course'));
      assert(pending.some(note => note.text === 'same desired content' && note.revision === 0));
      assert(await a.locator('#draftRecovery [data-load-draft],#draftRecovery [data-confirm-draft]').count() > 0,
        'A clean note still has a same-text older-base pending draft, which blocks logout but is hidden from recovery');
      const confirm = a.locator('#draftRecovery [data-confirm-draft]');
      if (await confirm.count()) {
        await a.locator('#draftRecovery summary').click(); await confirm.click();
        assert(!(await a.evaluate(() => window.__refinement.journal.list('practice-course')))
          .some(note => note.text === 'same desired content' && note.revision === 0));
      }
    });

    await check('failed-local-backup-cannot-discard-current-note-when-adopting-cloud', async env => {
      env.mock.state['notes:practice-course'] = { value: 'older cloud note', revision: 1, updatedAt: Date.now() };
      const page = await env.page(); await page.locator('#notesButton').click();
      env.mock.state['notes:practice-course'] = { value: 'other device latest cloud note', revision: 2, updatedAt: Date.now() };
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
      assert.equal(await page.evaluate(() => window.__refinement.state.notes.get('practice-course').text), 'valuable local conflicting draft');
      assert((await page.evaluate(() => window.__refinement.journal.list('practice-course')))
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

    await check('offline-global-search-reports-unavailable-documents', async env => {
      const page = await env.page();
      const collection = env.mock.catalog.collections.find(item => item.id === 'practice-course');
      for (const doc of env.mock.catalog.collections.flatMap(item => item.documents).filter(item => item.id !== 'practice-entry'))
        env.mock.unavailable.add(new URL(doc.url, origin).pathname);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.locator('#libraryButton').click(); await page.locator('#librarySearch').fill('lower_bound');
      await page.waitForFunction(() => !document.querySelector('#bookList').textContent.includes('正在检索'));
      await page.locator('#bookList .search-row').first().waitFor();
      const text = await page.locator('#bookList').innerText();
      assert.match(text, /离线|未下载|未能|不可用|部分|本机/);
      const groups = await page.locator('#bookList .search-row').evaluateAll(rows => rows.map(row => row.dataset.goCollection));
      assert(groups.length > 0 && groups.every(group => group === 'practice-course'));
    });

    await check('slow-cross-document-keeps-reader-and-can-cancel-without-late-replacement', async env => {
      const page = await env.page();
      await page.locator('#readingPane').evaluate(node => node.scrollTop = 900);
      await page.waitForTimeout(80);
      const before = await page.evaluate(() => ({ html: document.querySelector('#readingArticle').innerHTML,
        scroll: document.querySelector('#readingPane').scrollTop,
        top: document.querySelector('#readingPane').getBoundingClientRect().top,
        title: document.querySelector('#currentTitle').textContent, hash: location.hash }));
      const next = env.mock.catalog.collections.find(item => item.id === 'practice-course').documents.find(item => item.id === 'practice-composition');
      env.mock.delayDocument = new URL(next.url, origin).pathname;
      await page.locator('[data-document="practice-composition"]').click();
      await poll(() => env.mock.heldDocument, 'Expected delayed cross-document request');
      assert.equal(await page.locator('#readingArticle').innerHTML(), before.html);
      assert(Math.abs((await page.locator('#readingPane').evaluate(node => node.scrollTop)) - before.scroll) < 3);
      assert.equal(await page.locator('#currentTitle').textContent(), before.title);
      assert.equal(await page.locator('#readingPane').evaluate(node => node.getBoundingClientRect().top), before.top);
      await page.locator('[data-cancel-route]').click();
      assert.equal(await page.evaluate(() => location.hash), before.hash);
      env.mock.heldDocument(); await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => window.__refinement.state.active.meta.id), 'practice-entry');
      assert.equal(await page.locator('#readingArticle').innerHTML(), before.html);
      assert.equal(await page.locator('#readingNotice').isVisible(), false);
    });

    await check('return-button-separate-from-progress-and-restores-reading-place', async env => {
      const page = await env.page(); await page.locator('#readingPane').evaluate(node => node.scrollTop = 900);
      await page.waitForTimeout(100);
      const before = await page.locator('#readingPane').evaluate(node => node.scrollTop);
      const percentage = await page.locator('#progressLabel').innerText();
      await page.locator('#tocButton').click();
      const targets = page.locator('[data-go-document="practice-entry"]');
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
      const targets = page.locator('[data-go-document="practice-entry"]');
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
      const document = env.mock.catalog.collections.find(item => item.id === 'practice-course').documents
        .find(item => item.id === 'practice-composition');
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
      assert(groups.includes('practice-course') && groups.includes('additional-course'));
    });
  } finally { await browser.close(); }
  const report = { passed: failures.length === 0, results, failures, productionContacted: false,
    realDatabaseModified: false, testedAt: new Date().toISOString() };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
