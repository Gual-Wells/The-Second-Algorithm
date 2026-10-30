import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExtensionDefinitions, readExtensionContracts, projectExtensions } from '../scripts/lib/chapter-extensions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = () => ({ schemaVersion: 3, chapter: 'fixture', reading: {
  units: [{ id: 'offline', locations: [{ document: 'lesson', anchor: 'stable-offline' }] }],
  extensions: [{ sectionId: 'offline', tags: ['离线分治'], reason: '内部分类证据，不属于读者材料。' }] } });
const rendered = { html: '<a id="stable-offline"></a>\n<h2 id="离线问题">一、离线问题</h2>\n<p>Body</p>',
  headings: [{ id: '离线问题', text: '一、离线问题', depth: 2 }] };

test('extension projection uses stable fragment identity and carries no editorial reason or prose copy', () => {
  const definitions = validateExtensionDefinitions(contract());
  assert.deepEqual(projectExtensions(definitions, 'lesson', rendered), [{ sectionId: 'stable-offline', tags: ['离线分治'] }]);
  assert.deepEqual(projectExtensions(definitions, 'other', rendered), []);
  const renamed = { html: rendered.html.replaceAll('离线问题', '重新命名'),
    headings: [{ id: '重新命名', text: '三、重新命名', depth: 2 }] };
  assert.deepEqual(projectExtensions(definitions, 'lesson', renamed), projectExtensions(definitions, 'lesson', rendered));
});

test('PRE, partial subheadings, unknown sections and malformed evidence are rejected', () => {
  for (const sectionId of ['pre', 'subheading', 'unknown', null, []]) {
    const value = contract(); value.reading.extensions[0].sectionId = sectionId;
    assert.throws(() => validateExtensionDefinitions(value), /formal section/);
  }
  for (const tags of [null, [], [''], [' '], ['A', ' A '], ['A', 'A'], [3], ['<b>A</b>'], ['A\nB']]) {
    const value = contract(); value.reading.extensions[0].tags = tags;
    assert.throws(() => validateExtensionDefinitions(value), /tag/);
  }
  for (const reason of ['', ' ', null, 3]) {
    const value = contract(); value.reading.extensions[0].reason = reason;
    assert.throws(() => validateExtensionDefinitions(value), /reason/);
  }
  for (const invalid of [[], [...contract().reading.units[0].locations, ...contract().reading.units[0].locations]]) {
    const value = contract(); value.reading.units[0].locations = invalid;
    assert.throws(() => validateExtensionDefinitions(value), /complete H2/);
  }
  const value = contract(); value.reading.extensions.push(value.reading.extensions[0]);
  assert.throws(() => validateExtensionDefinitions(value), /duplicate extension section/);
});

test('real H2 boundaries cannot be inferred from unrelated anchors or trusted metadata alone', () => {
  const definitions = validateExtensionDefinitions(contract());
  for (const html of [rendered.html.replace('<h2', '<h3'), rendered.html.replace('一、', 'PRE、'),
      rendered.html.replace('</a>', '</a><p>Different content</p>'), rendered.html.replace('stable-offline', 'other')]) {
    assert.throws(() => projectExtensions(definitions, 'lesson', { ...rendered, html,
      headings: html.includes('PRE、') ? [{ id: '离线问题', text: 'PRE、离线问题', depth: 2 }] : rendered.headings }), /formal H2/);
  }
  const duplicate = [...definitions, { ...definitions[0], sectionId: 'alias', location: { document: 'lesson', anchor: 'alias' } }];
  assert.throws(() => projectExtensions(duplicate, 'lesson', { ...rendered,
    html: rendered.html.replace('<h2', '<a id="alias"></a><h2') }), /same H2/);
});

test('legacy absent and reviewed empty classifications remain empty', () => {
  assert.deepEqual(validateExtensionDefinitions({ schemaVersion: 2 }), []);
  const value = contract(); value.reading.extensions = [];
  assert.deepEqual(validateExtensionDefinitions(value), []);
  value.schemaVersion = 2;
  assert.throws(() => validateExtensionDefinitions(value), /schemaVersion 3/);
});

test('catalog contract loading fails closed on bad metadata and never broadens its chapter', async () => {
  const base = path.join(ROOT, '.local/extension-schema-tests'); await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'case-'));
  try {
    const publications = { collections: [{ id: 'fixture', documents: [{ id: 'lesson' }] }] };
    assert.equal((await readExtensionContracts(root, publications)).size, 0);
    await fs.mkdir(path.join(root, 'catalog'), { recursive: true });
    await fs.mkdir(path.join(root, 'content/unit'), { recursive: true });
    const row = { id: 'fixture', collection: 'fixture', contract: 'content/unit/contract.json' };
    const index = { schemaVersion: 1, chapters: [row] };
    const save = async value => fs.writeFile(path.join(root, 'content/unit/contract.json'), JSON.stringify(value));
    await fs.writeFile(path.join(root, 'catalog/chapters.json'), JSON.stringify(index));
    await save(contract());
    const loaded = await readExtensionContracts(root, publications);
    assert.deepEqual(projectExtensions(loaded.get('fixture'), 'lesson', rendered), [{ sectionId: 'stable-offline', tags: ['离线分治'] }]);
    const other = contract(); other.reading.units[0].locations[0].document = 'another-chapter'; await save(other);
    await assert.rejects(readExtensionContracts(root, publications), /belong to its published chapter/);
    await save(contract()); row.contract = 'content/../secret.json';
    await fs.writeFile(path.join(root, 'catalog/chapters.json'), JSON.stringify(index));
    await assert.rejects(readExtensionContracts(root, publications), /contract path/);
    row.contract = 'content/unit/contract.json'; index.chapters.push(row);
    await fs.writeFile(path.join(root, 'catalog/chapters.json'), JSON.stringify(index));
    await assert.rejects(readExtensionContracts(root, publications), /duplicate chapter/);
  } finally { assert(root.startsWith(base + path.sep)); await fs.rm(root, { recursive: true, force: true }); }
});
