import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildLibrary, libraryPaths } from '../scripts/build-carrier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture() {
  const parent = path.join(ROOT, '.local/knowledge-tests'); await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'case-'));
  for (const dir of ['tools', 'catalog', 'carrier', 'content/unit', 'content/knowledge', 'tests/cpp'])
    await fs.mkdir(path.join(root, dir), { recursive: true });
  for (const filename of ['build_handbook.mjs', 'knowledge.mjs', 'compose-chapter.mjs', 'reader-boundary.mjs'])
    await fs.copyFile(path.join(ROOT, 'tools', filename), path.join(root, 'tools', filename));
  const descriptor = { id: 'fixture', title: '题型', path: 'content/unit/Fixture' };
  const publications = { schemaVersion: 2, collections: [{ id: 'chapter', title: '领域', kind: 'chapter', chapterNumber: 1, documents: [descriptor] }] };
  const model = { schemaVersion: 2, questions: [1, 2, 3].map(n => ({ id: `Q00000${n}`, title: `知识${n}`, source: `content/knowledge/Q00000${n}.md`,
    prerequisites: n === 1 ? ['Q000002'] : [], sources: ['https://example.com/rule'] })),
    tasks: [{ id: 'task', title: '任务', document: 'fixture', contract: '返回原值', sourceUrls: ['https://example.com/problem'],
      methods: [{ id: 'method', title: '机制', invariant: '值不变', implementations: [{ id: 'manual', kind: 'manual', source: 'content/unit/Fixture.cpp',
        regions: ['one'], symbol: 'value', standard: 'c++17', questions: ['Q000001'], complexity: { time: 'O(1)', space: 'O(1)' }, target: 'run' }] }] }],
    targets: [{ id: 'run', source: 'tests/cpp/run.cpp', standard: 'c++17', kind: 'run', timeoutSeconds: 30 }] };
  await fs.writeFile(path.join(root, 'carrier/publications.json'), JSON.stringify(publications));
  await fs.writeFile(path.join(root, 'catalog/learning.json'), JSON.stringify(model));
  for (let n = 1; n <= 3; n++) await fs.writeFile(path.join(root, `content/knowledge/Q00000${n}.md`),
    `# 知识${n}\n\n<a id="lifetime"></a>\n\n唯一知识正文${n}。\n\n` + (n === 1 ? '[[Q000002#lifetime|相关条件]]\n\n```cpp\nint example = 1;\n```\n' : ''));
  await fs.writeFile(path.join(root, 'content/unit/Fixture.cpp'), '// BEGIN one\nint value(int x) { return x; }\n// END one\n');
  await fs.writeFile(path.join(root, 'content/unit/Fixture.source.md'),
    '# 题型\n\n<a id="type"></a>\n\n## 题型本身\n\n{{one}}\n\n{{knowledge:Q000001}}\n\n{{knowledge:Q000002}}\n\n[[Q000001#lifetime|借用寿命]]\n');
  await fs.writeFile(path.join(root, 'tests/cpp/run.cpp'), 'int main() {}\n');
  const rebuild = () => execFileSync(process.execPath, [path.join(root, 'tools/build_handbook.mjs'), path.join(root, 'content/unit'), 'Fixture'], { encoding: 'utf8', windowsHide: true });
  rebuild();
  return { root, model, publications, descriptor, rebuild, output: path.join(root, 'output') };
}
async function dispose(root) {
  const rel = path.relative(path.join(ROOT, '.local/knowledge-tests'), root);
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel)); await fs.rm(root, { recursive: true, force: true });
}

test('knowledge is published by actual dependency closure independently of any first-teaching chapter', async () => {
  const f = await fixture(); try {
    const result = await buildLibrary(f.root, f.output, f.publications, 'a'.repeat(40));
    assert.deepEqual(result.catalog.questions.map(q => q.id), ['Q000001', 'Q000002']);
    assert(result.catalog.questions.every(q => !Object.hasOwn(q, 'document')));
    const entry = result.catalog.collections[0].documents[0];
    const document = JSON.parse(await fs.readFile(path.join(f.output, entry.url.slice(1)), 'utf8'));
    assert.deepEqual(entry.knowledgeIds, ['Q000001', 'Q000002']);
    assert(document.html.includes('id="knowledge-Q000001-lifetime"'));
    assert(document.html.includes('id="knowledge-Q000002-lifetime"'));
    assert.deepEqual(document.headings.map(h => h.text), ['题型本身']);
    assert.equal(result.codeBlocks, 1, 'knowledge examples are separate from algorithm code authority');
    const card = JSON.parse(await fs.readFile(path.join(f.output, result.catalog.questions[0].url.slice(1)), 'utf8'));
    assert(card.html.includes('id="lifetime"'));
    assert(card.html.includes('data-knowledge="Q000002"'));
    assert(libraryPaths(result.catalog).includes(result.catalog.questions[1].url));
    assert(!libraryPaths(result.catalog).some(url => url.includes('Q000003')));
    assert(!document.html.replace(/<[^>]*>/g, '').includes('Q000001'));
  } finally { await dispose(f.root); }
});

test('knowledge source edits invalidate both the reading build and immutable card identity', async () => {
  const f = await fixture(); try {
    const before = await buildLibrary(f.root, f.output, f.publications, 'a'.repeat(40));
    const filename = path.join(f.root, 'content/knowledge/Q000001.md');
    await fs.appendFile(filename, '\n新场景的必要条件。\n');
    await assert.rejects(buildLibrary(f.root, f.output, f.publications, 'a'.repeat(40)), /Knowledge dependency hash mismatch/);
    f.rebuild();
    const after = await buildLibrary(f.root, f.output, f.publications, 'a'.repeat(40));
    assert.notEqual(before.catalog.questions[0].url, after.catalog.questions[0].url);
    assert.notEqual(before.catalog.collections[0].documents[0].url, after.catalog.collections[0].documents[0].url);
  } finally { await dispose(f.root); }
});

test('unknown precise knowledge sections fail the author build', async () => {
  const f = await fixture(); try {
    await fs.appendFile(path.join(f.root, 'content/unit/Fixture.source.md'), '\n[[Q000001#missing|寿命]]\n');
    assert.throws(f.rebuild, /Unresolved knowledge reference/);
  } finally { await dispose(f.root); }
});

test('production text injected through knowledge is rejected by authoring and final popup construction', async () => {
  const f=await fixture();try {
    const filename=path.join(f.root,'content/knowledge/Q000001.md');
    await fs.appendFile(filename,'\n本机结果另有验证记录。\n');
    assert.throws(f.rebuild,/reader boundary/);
    // Refreshing a dependency digest cannot turn the new body into reader text.
    const buildPath=path.join(f.root,'content/unit/build/Fixture.json');
    const manifest=JSON.parse(await fs.readFile(buildPath,'utf8'));
    manifest.knowledgeDependencies['content/knowledge/Q000001.md']=createHash('sha256').update(await fs.readFile(filename)).digest('hex');
    await fs.writeFile(buildPath,JSON.stringify(manifest));
    await assert.rejects(buildLibrary(f.root,f.output,f.publications,'a'.repeat(40)),/reader boundary/);
  }finally{await dispose(f.root);}
});
