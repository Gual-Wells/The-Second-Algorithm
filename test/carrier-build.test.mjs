import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePublications, readAuthority, createLinkRewriter, renderAuthority, buildLibrary, buildCarrier }
  from '../scripts/build-carrier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = text => createHash('sha256').update(text).digest('hex');
const gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const publications = JSON.parse(await fs.readFile(path.join(ROOT, 'carrier/publications.json'), 'utf8'));
const decode = text => text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,
  (_, name) => name.startsWith('#') ? String.fromCodePoint(Number.parseInt(name.replace(/^#x?/i, ''), /^#x/i.test(name) ? 16 : 10))
    : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name.toLowerCase()]);
const codeText = html => decode(html.replace(/<[^>]+>/g, ''));

test('dependency lock is portable and never captures shared local runtime links', async () => {
  const lock = JSON.parse(await fs.readFile(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  for (const [name, dependency] of Object.entries(lock.packages)) {
    assert.ok(name === '' || name.startsWith('node_modules/'), name);
    assert.ok(!dependency.link, name);
    if (dependency.resolved) assert.match(dependency.resolved, /^https:\/\//);
  }
});

async function temporary() {
  const directory = path.join(ROOT, '.local/carrier-build-tests');
  await fs.mkdir(directory, { recursive: true });
  return fs.mkdtemp(path.join(directory, 'case-'));
}
async function dispose(directory) {
  const relative = path.relative(path.join(ROOT, '.local/carrier-build-tests'), path.resolve(directory));
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  await fs.rm(directory, { recursive: true, force: true });
}

async function fixture() {
  const root = await temporary();
  for (const name of ['tools', 'content/unit/build', 'carrier', 'research', '.local'])
    await fs.mkdir(path.join(root, name), { recursive: true });
  const descriptor = { id: 'fixture-doc', title: 'Fixture', path: 'content/unit/Fixture' };
  const source = '# Fixture\n\n求职C++实战总册 · 具体问题、机制与参考实现\n\n<a id="manual"></a>\n\n## Section\n\n{{one}}\n\n```cpp\nint direct = 2;\n```\n\n[记录](../../research/notes.md)\n';
  const cpp = '#include <string>\n// BEGIN one\nint sum(int a, int b) { return a + b; }\n// END one\n';
  const markdown = source.replace('{{one}}', '```cpp\nint sum(int a, int b) { return a + b; }\n```');
  const html = '<h1>Fixture</h1><h2 id="section">Section</h2>';
  const builder = '// synthetic fixture builder\n';
  const manifest = { codeBlocks: ['one'], headings: [{ depth: 1, id: 'fixture', text: 'Fixture' },
    { depth: 2, id: 'section', text: 'Section' }], sourceSha256: hash(source), codeSha256: hash(cpp),
    markdownSha256: hash(markdown), htmlSha256: hash(html), builderSha256: hash(builder) };
  await fs.writeFile(path.join(root, 'content/unit/Fixture.source.md'), source);
  await fs.writeFile(path.join(root, 'content/unit/Fixture.cpp'), cpp);
  await fs.writeFile(path.join(root, 'content/unit/Fixture.md'), markdown);
  await fs.writeFile(path.join(root, 'content/unit/Fixture.html'), html);
  await fs.writeFile(path.join(root, 'tools/build_handbook.mjs'), builder);
  await fs.writeFile(path.join(root, 'content/unit/build/Fixture.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(root, 'research/notes.md'), 'Public research note\n');
  await fs.writeFile(path.join(root, '.local/private.pdf'), 'must not be published');
  const collection = { id: 'fixture-trial', track: 'cpp', kind: 'trial', title: 'Fixture collection', documents: [descriptor] };
  await fs.writeFile(path.join(root, 'carrier/publications.json'), JSON.stringify({ schemaVersion: 1, collections: [collection] }));
  return { root, descriptor, collection, manifest, source, cpp, markdown, html, builder };
}

test('legacy trial authorities are retained hidden and never promoted to formal chapters', () => {
  validatePublications(publications);
  const trials = publications.collections.filter(x => x.kind === 'trial');
  assert.deepEqual(trials.map(x => [x.id, x.track, x.kind, x.documents.length]),
    [['binary-search', 'algorithm', 'trial', 3], ['cpp-reference', 'cpp', 'trial', 7]]);
  assert.ok(trials.every(x => x.visibility === 'hidden' && !Object.hasOwn(x, 'chapterNumber')));
  const ids = publications.collections.flatMap(x => x.documents.map(d => d.id));
  assert.equal(ids.length, new Set(ids).size);
  const bad = structuredClone(publications); bad.collections[0].chapterNumber = 1;
  assert.throws(() => validatePublications(bad), /Trial collections cannot/);
});

test('hidden collections produce neither public catalog entries nor deployed content files', async () => {
  const f = await fixture();
  try {
    f.collection.visibility = 'hidden';
    const output = path.join(f.root, '.local/hidden-output');
    const result = await buildLibrary(f.root, output, { schemaVersion: 1, collections: [f.collection] }, gitRevision);
    assert.deepEqual(result.catalog.collections, []);
    assert.equal(result.documents, 0); assert.equal(result.codeBlocks, 0);
    assert.deepEqual(await fs.readdir(path.join(output, 'library')), ['catalog.json']);
    assert.equal(await fs.readFile(path.join(f.root, 'content/unit/Fixture.cpp'), 'utf8'), f.cpp);
    f.collection.visibility = 'not-valid';
    assert.throws(() => validatePublications({ schemaVersion: 1, collections: [f.collection] }), /visibility/);
  } finally { await dispose(f.root); }
});

test('future chapters require valid numbers and uniqueness per independent track', () => {
  const sample = structuredClone(publications);
  sample.collections = sample.collections.filter(collection => collection.kind === 'trial');
  sample.collections[0].kind = sample.collections[1].kind = 'chapter';
  assert.throws(() => validatePublications(sample), /positive integer/);
  sample.collections[0].chapterNumber = sample.collections[1].chapterNumber = 1;
  assert.doesNotThrow(() => validatePublications(sample));
  sample.collections[1].track = 'algorithm';
  assert.throws(() => validatePublications(sample), /Duplicate chapter number/);
  sample.collections[1].track = 'cpp'; sample.collections[1].documents[0].id = sample.collections[0].documents[0].id;
  assert.throws(() => validatePublications(sample), /globally unique/);
  sample.collections[1].documents[0].id = 'cpp-distinct';
  sample.collections[0].documents[0].path = 'content/../outside';
  assert.throws(() => validatePublications(sample), /traversal/);
});

test('all source, C++, Markdown, HTML and builder authorities are hash-checked', async () => {
  const f = await fixture();
  try {
    const files = ['content/unit/Fixture.source.md', 'content/unit/Fixture.cpp', 'content/unit/Fixture.md',
      'content/unit/Fixture.html', 'tools/build_handbook.mjs'];
    const kinds = ['source', 'code', 'markdown', 'html', 'builder'];
    const original = await readAuthority(f.root, f.descriptor);
    assert.equal(original.blocks.size, 1);
    for (const [i, file] of files.entries()) {
      const location = path.join(f.root, file), before = await fs.readFile(location);
      await fs.writeFile(location, Buffer.concat([before, Buffer.from('\nchanged\n')]));
      await assert.rejects(readAuthority(f.root, f.descriptor), new RegExp(kinds[i] + ' authority hash mismatch'));
      await fs.writeFile(location, before);
    }
  } finally { await dispose(f.root); }
});

test('unsafe HTML is escaped; only safe id anchors survive and unsafe schemes are rejected', async () => {
  const f = await fixture();
  try {
    const authority = await readAuthority(f.root, f.descriptor);
    authority.markdown += '\n<script>alert(1)</script>\n\n<a id="bad" onclick="alert(2)"></a>\n';
    const rewrite = createLinkRewriter({ collection: f.collection, document: authority, byPath: new Map(), gitRevision });
    const rendered = renderAuthority(authority, rewrite);
    assert.match(rendered.html, /<a id="manual"><\/a>/);
    assert.doesNotMatch(rendered.html, /<script|<a[^>]+onclick=/);
    assert.match(rendered.html, /&lt;script&gt;/);
    assert.doesNotMatch(rendered.html, /<h1|<p>求职C\+\+实战总册/);
    assert.deepEqual(rendered.headings, [{ depth: 2, id: 'section', text: 'Section' }]);
    assert.match(rendered.html, new RegExp('/blob/' + gitRevision + '/research/notes\\.md'));
    assert.match(rendered.html, /rel="noopener noreferrer"/);
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)',
      'javascript&#58;alert(1)', '&#x6a;avascript:alert(1)', 'data:text/html,hello', 'file:///secret'])
      assert.throws(() => rewrite(href), /Unsafe link/);
  } finally { await dispose(f.root); }
});

test('content and download links are rewritten without private repository paths', () => {
  const document = { id: 'bs-foundations', path: 'content/binary-search/二分查找' };
  const entry = { collection: 'binary-search', document: 'bs-compositions',
    sourceUrl: '/library/binary-search/bs-compositions/123.cpp', markdownUrl: '/library/binary-search/bs-compositions/123.md' };
  const byPath = new Map(['.html', '.cpp', '.md'].map(s => ['content/binary-search/组合判定' + s, entry]));
  const rewrite = createLinkRewriter({ collection: publications.collections[0], document, byPath, gitRevision });
  assert.equal(rewrite('组合判定.html#some-anchor').href, '#/read/binary-search/bs-compositions?anchor=some-anchor');
  assert.equal(rewrite('#ordered').href, '#/read/binary-search/bs-foundations?anchor=ordered');
  assert.deepEqual(rewrite('组合判定.cpp'), { href: entry.sourceUrl, external: false, download: true });
  assert.equal(rewrite('组合判定.md').href, entry.markdownUrl);
  assert.match(rewrite('../../work/notes.md').href, new RegExp('/blob/' + gitRevision + '/work/notes\\.md'));
  assert.throws(() => rewrite('../../.local/private.pdf'), /Private/);
  assert.throws(() => rewrite('../../../outside.md'), /outside/);
  assert.throws(() => rewrite('unpublished.html'), /not registered/);
});

test('a broken internal anchor prevents publication instead of leaving a dead reader link', async () => {
  const f = await fixture();
  try {
    const source = f.source + '\n[missing](#not-an-anchor)\n';
    const markdown = f.markdown + '\n[missing](#not-an-anchor)\n';
    f.manifest.sourceSha256 = hash(source); f.manifest.markdownSha256 = hash(markdown);
    await fs.writeFile(path.join(f.root, 'content/unit/Fixture.source.md'), source);
    await fs.writeFile(path.join(f.root, 'content/unit/Fixture.md'), markdown);
    await fs.writeFile(path.join(f.root, 'content/unit/build/Fixture.json'), JSON.stringify(f.manifest));
    const output = path.join(f.root, '.local/failed-library');
    await assert.rejects(buildLibrary(f.root, output,
      { schemaVersion: 1, collections: [f.collection] }, gitRevision), /anchor does not exist/);
  } finally { await dispose(f.root); }
});

test('explicit C++ highlighting preserves raw strings, digit separators and actual comment tokens', async () => {
  const f = await fixture();
  try {
    const authority = await readAuthority(f.root, f.descriptor);
    const text = 'const auto raw = R"tag(// literal, not comment\n"still string" /* literal */ <&>)tag";\n'
      + "constexpr auto count = 1'000'000ULL; // actual comment <&>\n"
      + "auto quote = '\\'';";
    authority.markdown = authority.markdown.replace(authority.blocks.get('one'), text);
    authority.blocks.set('one', text);
    const rendered = renderAuthority(authority, createLinkRewriter({ collection: f.collection,
      document: authority, byPath: new Map(), gitRevision }));
    const match = rendered.html.match(/data-code-id="one">([\s\S]*?)<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
    assert.ok(match); assert.equal(codeText(match[2]), text);
    assert.match(match[1], /^<div class="code-toolbar"><span>C\+\+<\/span><button[^>]+data-copy-code="one"/);
    assert.match(match[2], /class="hljs-string">R&quot;tag\([\s\S]*?literal, not comment/);
    assert.match(match[2], /class="hljs-number">1(?:&#x27;|&#39;|')000(?:&#x27;|&#39;|')000ULL<\/span>/);
    assert.equal([...match[2].matchAll(/class="hljs-comment"/g)].length, 1);
    assert.match(match[2], /class="hljs-comment">\/\/ actual comment &lt;&amp;&gt;<\/span>/);
    assert.equal(renderAuthority(authority, createLinkRewriter({ collection: f.collection,
      document: authority, byPath: new Map(), gitRevision })).html, rendered.html);
  } finally { await dispose(f.root); }
});

test('immutable reader paths follow rendered bytes while authority downloads remain stable', async () => {
  const f = await fixture();
  try {
    const manifest = { schemaVersion: 1, collections: [f.collection] };
    const build = async (directory, revision) => {
      const output = path.join(f.root, '.local', directory);
      const { catalog } = await buildLibrary(f.root, output, manifest, revision);
      const entry = catalog.collections[0].documents[0];
      const document = JSON.parse(await fs.readFile(path.join(output, entry.url.slice(1)), 'utf8'));
      return { catalog, entry, document };
    };
    const first = await build('first', gitRevision), repeat = await build('repeat', gitRevision);
    assert.deepEqual(repeat, first, 'identical authority and rendering must be deterministic');
    const changed = await build('changed', gitRevision === 'a'.repeat(40) ? 'b'.repeat(40) : 'a'.repeat(40));
    assert.notEqual(changed.document.html, first.document.html, 'fixed public research link changes rendered bytes');
    assert.notEqual(changed.entry.revision, first.entry.revision);
    assert.notEqual(changed.entry.url, first.entry.url);
    assert.equal(changed.document.revision, changed.entry.revision);
    assert.match(changed.entry.url, new RegExp('/' + changed.entry.revision.slice(0, 16) + '\\.json$'));
    assert.equal(changed.entry.sourceUrl, first.entry.sourceUrl);
    assert.equal(changed.entry.markdownUrl, first.entry.markdownUrl);
  } finally { await dispose(f.root); }
});

test('isolated QA corpus preserves all 173 legacy canonical copies without publishing hidden trials', async () => {
  const output = await temporary();
  try {
    const corpus = structuredClone(publications);
    corpus.collections = corpus.collections.filter(collection => collection.kind === 'trial');
    for (const collection of corpus.collections) delete collection.visibility;
    const result = await buildLibrary(ROOT, output, corpus, gitRevision);
    assert.equal(result.documents, 10); assert.equal(result.codeBlocks, 173);
    assert.match(result.catalog.version, /^[a-f0-9]{64}$/);
    let canonicalCopies = 0, inlineExamples = 0;
    for (const collection of result.catalog.collections) {
      assert.equal(collection.kind, 'trial'); assert.ok(!Object.hasOwn(collection, 'chapterNumber'));
      for (const entry of collection.documents) {
        const descriptor = publications.collections.find(x => x.id === collection.id).documents.find(x => x.id === entry.id);
        const authority = await readAuthority(ROOT, descriptor);
        const doc = JSON.parse(await fs.readFile(path.join(output, entry.url.slice(1)), 'utf8'));
        assert.equal(doc.revision, entry.revision);
        assert.notEqual(doc.revision, authority.revision);
        assert.match(entry.url, new RegExp('/' + doc.revision.slice(0, 16) + '\\.json$'));
        assert.match(entry.sourceUrl, new RegExp('/' + authority.revision.slice(0, 16) + '\\.cpp$'));
        assert.equal(await fs.readFile(path.join(output, doc.sourceUrl.slice(1)), 'utf8'), authority.source);
        assert.equal(await fs.readFile(path.join(output, entry.markdownUrl.slice(1)), 'utf8'), authority.markdown);
        assert.doesNotMatch(doc.html, /<h1[ >]/);
        const seen = new Set();
        assert.equal([...doc.html.matchAll(/class="code-toolbar"/g)].length,
          [...doc.html.matchAll(/class="code-block"/g)].length);
        for (const match of doc.html.matchAll(/<div class="code-block" data-code-id="([^"]+)">[\s\S]*?<pre><code[^>]*>([\s\S]*?)<\/code><\/pre><\/div>/g)) {
          const key = match[1], text = codeText(match[2]);
          assert.ok(!seen.has(key)); seen.add(key);
          if (authority.blocks.has(key)) { assert.equal(text, authority.blocks.get(key)); ++canonicalCopies; }
          else { assert.ok(authority.inlineExamples.has(text)); ++inlineExamples; }
          assert.ok(!text.includes('aria-label="复制代码"'));
        }
        for (const key of authority.used) assert.ok(seen.has(key), `${entry.id} omits ${key}`);
        for (const heading of entry.headings) assert.ok(doc.html.includes('id="' + heading.id + '"'));
        for (const match of doc.html.matchAll(/href="(#\/read\/[^"?]+)(?:\?anchor=([^"&]*))?"/g)) {
          const [, , collectionId, documentId] = match[1].split('/');
          const destination = result.catalog.collections.find(x => x.id === collectionId)?.documents.find(x => x.id === documentId);
          assert.ok(destination, match[1]);
          if (match[2]) {
            const target = JSON.parse(await fs.readFile(path.join(output, destination.url.slice(1)), 'utf8'));
            assert.ok(target.html.includes('id="' + decodeURIComponent(match[2]) + '"'), match[0]);
          }
        }
      }
    }
    assert.equal(canonicalCopies, 173);
    assert.ok(inlineExamples > 0, 'original short examples should not be silently stripped');
    assert.match(await fs.readFile(path.join(ROOT, 'web/styles.css'), 'utf8'),
      /@media print\s*\{[\s\S]*?\.code-toolbar[^{}]*\{[^{}]*display:\s*none/);
    assert.deepEqual((await fs.readdir(output)).sort(), ['library']);
  } finally { await dispose(output); }
});

test('content-only packaging protects library routes and a failed full build preserves previous output', async () => {
  const f = await fixture();
  try {
    await buildCarrier({ root: f.root, contentOnly: true });
    const before = await fs.readFile(path.join(f.root, 'dist/library/catalog.json'), 'utf8');
    const routes = JSON.parse(await fs.readFile(path.join(f.root, 'dist/_routes.json'), 'utf8'));
    assert.deepEqual(routes, { version: 1, include: ['/*'], exclude: [] });
    assert.match(await fs.readFile(path.join(f.root, 'dist/_headers'), 'utf8'), /\/library\/\*[\s\S]*Cache-Control: private, no-store/);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.root, 'dist/carrier-build.json'), 'utf8')).mode, 'content-only');
    assert.match(await fs.readFile(path.join(f.root, 'dist/_worker.js'), 'utf8'), /status:503/);
    await assert.rejects(fs.access(path.join(f.root, 'dist/.local/private.pdf')));
    await fs.mkdir(path.join(f.root, 'web/assets'), { recursive: true });
    await fs.writeFile(path.join(f.root, 'web/index.html'), '<!doctype html><title>Fixture</title>');
    await fs.writeFile(path.join(f.root, 'web/assets/private.pdf'), 'not a web asset');
    await assert.rejects(buildCarrier({ root: f.root }), /private\/system asset/);
    assert.equal(await fs.readFile(path.join(f.root, 'dist/library/catalog.json'), 'utf8'), before);
  } finally { await dispose(f.root); }
});

test('full bundle embeds relative auth before fingerprinting and invalidates uncommitted module/shell/worker edits', async () => {
  const f = await fixture();
  try {
    await fs.mkdir(path.join(f.root, 'web'), { recursive: true });
    await fs.mkdir(path.join(f.root, 'server'), { recursive: true });
    await fs.writeFile(path.join(f.root, 'web/index.html'), '<!doctype html><meta name="build" content="__BUILD__"><script src="app.js"></script>');
    await fs.writeFile(path.join(f.root, 'web/sw.js'), "const CACHE='carrier-__BUILD__';\n");
    const app = "import {authMarker} from './auth.js'; globalThis.readerVersion=authMarker;\n";
    await fs.writeFile(path.join(f.root, 'web/app.js'), app);
    await fs.writeFile(path.join(f.root, 'web/auth.js'), "export const authMarker='auth-one';\n");
    await fs.writeFile(path.join(f.root, 'web/DESIGN.md'), 'Internal design record, not an application asset');
    await fs.writeFile(path.join(f.root, 'server/worker.mjs'), "export default {fetch(){return new Response('worker-one')}};\n");
    const first = await buildCarrier({ root: f.root });
    assert.equal(first.mode, 'full'); assert.match(first.buildID, /^[a-f0-9]{64}$/);
    const notFound = await fs.readFile(path.join(f.root, 'dist/404.html'), 'utf8');
    assert.match(notFound, /未找到内容/); assert.doesNotMatch(notFound, /app\.js|Fixture|__BUILD__/);
    await assert.rejects(fs.access(path.join(f.root, 'dist/DESIGN.md')));
    const index = await fs.readFile(path.join(f.root, 'dist/index.html'), 'utf8');
    const sw = await fs.readFile(path.join(f.root, 'dist/sw.js'), 'utf8');
    assert.ok(index.includes(first.buildID) && sw.includes(first.buildID));
    assert.ok(!index.includes('__BUILD__') && !sw.includes('__BUILD__'));
    const bundledApp = await fs.readFile(path.join(f.root, 'dist/app.js'), 'utf8');
    assert.doesNotMatch(bundledApp, /\bimport\s*(?:\{|\*|['"])/);
    assert.match(bundledApp, /auth-one/);
    assert.match(await fs.readFile(path.join(f.root, 'dist/auth.js'), 'utf8'), /auth-one/);
    assert.match(await fs.readFile(path.join(f.root, 'dist/_worker.js'), 'utf8'), /worker-one/);
    assert.equal((await buildCarrier({ root: f.root })).buildID, first.buildID);
    await fs.writeFile(path.join(f.root, 'web/auth.js'), "export const authMarker='auth-two';\n");
    const changedModule = await buildCarrier({ root: f.root });
    assert.notEqual(changedModule.buildID, first.buildID);
    const nextApp = await fs.readFile(path.join(f.root, 'dist/app.js'), 'utf8');
    assert.match(nextApp, /auth-two/);
    assert.doesNotMatch(nextApp, /\bimport\s*(?:\{|\*|['"])/);
    await fs.writeFile(path.join(f.root, 'web/app.js'), app + "globalThis.extra='changed';\n");
    const changedShell = await buildCarrier({ root: f.root });
    assert.notEqual(changedShell.buildID, changedModule.buildID);
    assert.equal(changedShell.version, first.version, 'same HEAD and library, actual shell bytes changed');
    await fs.writeFile(path.join(f.root, 'server/worker.mjs'), "export default {fetch(){return new Response('worker-two')}};\n");
    const changedWorker = await buildCarrier({ root: f.root });
    assert.notEqual(changedWorker.buildID, changedShell.buildID);
    assert.match(await fs.readFile(path.join(f.root, 'dist/_worker.js'), 'utf8'), /worker-two/);
  } finally { await dispose(f.root); }
});
