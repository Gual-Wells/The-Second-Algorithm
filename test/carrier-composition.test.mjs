import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { composeDocument, chapterFragments } from '../tools/compose-chapter.mjs';
import { readAuthority, validatePublications } from '../scripts/build-carrier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const PARENT = path.join(ROOT, '.local/composition-tests');

async function fixture() {
  await fs.mkdir(PARENT, { recursive: true });
  const root = await fs.mkdtemp(path.join(PARENT, 'case-'));
  for (const directory of ['tools', 'content/unit', 'carrier', 'catalog'])
    await fs.mkdir(path.join(root, directory), { recursive: true });
  for (const filename of ['compose-chapter.mjs', 'build_handbook.mjs', 'knowledge.mjs', 'reader-boundary.mjs'])
    await fs.copyFile(path.join(ROOT, 'tools', filename), path.join(root, 'tools', filename));
  const descriptor = { id: 'composed', title: '二分', path: 'content/unit/chapter', composition: 'content/unit/chapter.authoring.json' };
  const first = '# Internal one\r\n\r\n<a id="prelude"></a>\r\n## 前置\r\n\r\n前置原文。\r\n\r\n'
    + '<a id="first"></a>\r\n## 第一题型\r\n\r\n{{one}}\r\n';
  const second = '# Internal two\n\n<a id="second"></a>\n\n## 第二题型\n\n{{two}}\n';
  const cppOne = '#include <array>\r\nnamespace original_one {\r\n// BEGIN one\r\nint first() { int a[1][1] = {{7}}; return a[0][0]; }\r\n// END one\r\n}\r\n';
  const cppTwo = 'namespace original_two {\n// BEGIN two\nint second() { return 2; }\n// END two\n}\n';
  const composition = { schemaVersion: 1, title: '二分',
    sourceFiles: ['content/unit/one.source.md', 'content/unit/two.source.md'],
    prelude: { source: 'content/unit/one.source.md', anchor: 'prelude' },
    sections: [{ id: 'second-type', source: 'content/unit/two.source.md', anchor: 'second' },
      { id: 'first-type', source: 'content/unit/one.source.md', anchor: 'first' }],
    codeSources: ['content/unit/one.cpp', 'content/unit/two.cpp'] };
  const publications = { schemaVersion: 2, collections: [{ id: 'chapter', title: '二分', kind: 'chapter', chapterNumber: 1, documents: [descriptor] }] };
  for (const [relative, bytes] of Object.entries({ 'content/unit/one.source.md': first,
    'content/unit/two.source.md': second, 'content/unit/one.cpp': cppOne, 'content/unit/two.cpp': cppTwo,
    'carrier/publications.json': JSON.stringify(publications),
    'catalog/learning.json': JSON.stringify({ schemaVersion: 2, questions: [], tasks: [], targets: [] }) }))
    await fs.writeFile(path.join(root, relative), bytes);
  const save = () => fs.writeFile(path.join(root, descriptor.composition), JSON.stringify(composition));
  await save();
  const rebuild = () => execFileSync(process.execPath, [path.join(root, 'tools/build_handbook.mjs'),
    path.join(root, 'content/unit'), 'chapter'], { encoding: 'utf8', windowsHide: true });
  return { root, descriptor, composition, publications, first, second, cppOne, cppTwo, save, rebuild };
}
async function dispose(root) {
  const relative = path.relative(PARENT, root);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  await fs.rm(root, { recursive: true, force: true });
}

test('the current binary chapter composes its 38 real main sections into one reader document', async () => {
  const publications = JSON.parse(await fs.readFile(path.join(ROOT, 'carrier/publications.json'), 'utf8'));
  const chapter = publications.collections.find(collection => collection.id === 'chapter-01');
  assert.equal(chapter.documents.length, 1);
  const [descriptor] = chapter.documents;
  assert.deepEqual(descriptor, { id: 'binary-search', title: '二分', path: 'content/binary/chapter',
    composition: 'content/binary/chapter.authoring.json' });
  const composition = JSON.parse(await fs.readFile(path.join(ROOT, descriptor.composition), 'utf8'));
  assert.equal(composition.sections.length, 37, '38 is this chapter revision, not the generic composition protocol');
  assert.deepEqual([...composition.sourceFiles].sort(), ['advanced', 'boundary', 'decision', 'selection']
    .map(name => 'content/binary/' + name + '.source.md'));
  assert.deepEqual([...composition.codeSources].sort(), ['advanced', 'boundary', 'decision', 'selection']
    .map(name => 'content/binary/' + name + '.cpp'));
  const result = await composeDocument(ROOT, descriptor), selections = [composition.prelude, ...composition.sections];
  assert.deepEqual([...chapterFragments(result.draft).keys()], selections.map(selection => selection.anchor));
  const authorBlocks = new Map();
  for (const relative of composition.sourceFiles) authorBlocks.set(relative,
    chapterFragments(await fs.readFile(path.join(ROOT, relative), 'utf8'), relative));
  let cursor = result.draft.indexOf('\n\n') + 2;
  for (const selection of selections) {
    const block = authorBlocks.get(selection.source).get(selection.anchor);
    assert.equal(result.draft.slice(cursor, cursor + block.length), block, selection.anchor);
    cursor += block.length + (block.endsWith('\n') ? 0 : 1) + 1;
  }
  for (const relative of composition.codeSources) {
    const original = await fs.readFile(path.join(ROOT, relative));
    assert(Buffer.from(result.source).includes(original), relative);
    assert.equal(result.dependencies[relative], hash(original));
  }
  assert.equal(Object.keys(result.dependencies).length, 10);
});

test('composition reorders original H2 blocks across files and preserves original C++ bytes', async () => {
  const f = await fixture();
  try {
    const result = await composeDocument(f.root, f.descriptor);
    const firstBlocks = chapterFragments(f.first), secondBlocks = chapterFragments(f.second);
    assert.equal(result.draft, '# 二分\n\n' + firstBlocks.get('prelude') + '\n'
      + secondBlocks.get('second') + '\n' + firstBlocks.get('first'));
    assert.equal(result.source, f.cppOne + '\n' + f.cppTwo);
    assert.equal(result.dependencies['content/unit/one.cpp'], hash(f.cppOne));
    assert.deepEqual(Object.keys(result.dependencies), ['content/unit/chapter.authoring.json', 'content/unit/one.cpp',
      'content/unit/one.source.md', 'content/unit/two.cpp', 'content/unit/two.source.md', 'tools/compose-chapter.mjs']);
    await assert.rejects(fs.access(path.join(f.root, 'content/unit/chapter.source.md')), /ENOENT/,
      'pure composition does not write generated authorities');
    f.rebuild();
    const authority = await readAuthority(f.root, f.descriptor);
    assert.deepEqual(authority.used, ['two', 'one']);
    assert.equal(authority.source, result.source);
    assert(authority.markdown.includes('int a[1][1] = {{7}};'));
    assert.deepEqual(authority.manifest.authoringDependencies, result.dependencies);
    assert.equal(await fs.readFile(path.join(f.root, 'content/unit/one.cpp'), 'utf8'), f.cppOne);
  } finally { await dispose(f.root); }
});

test('composition requires explicit complete unique selection from its declared author pool', async () => {
  const f = await fixture();
  try {
    const original = structuredClone(f.composition);
    const invalid = [
      [value => value.sections.pop(), /Unselected H2/],
      [value => value.sections[0].anchor = 'absent', /Unknown composition fragment/],
      [value => value.sections.push({ ...value.sections[0], id: 'another-id' }), /Duplicate composition fragment/],
      [value => value.sections[1].id = value.sections[0].id, /duplicate composition section/],
      [value => value.sections[0].source = 'content/unit/third.source.md', /not in sourceFiles/],
      [value => value.sourceFiles.push(value.sourceFiles[0]), /Duplicate composition author source/],
      [value => value.codeSources.push(value.codeSources[0]), /Duplicate composition code source/],
      [value => value.codeSources.push('content/unit/chapter.cpp'), /cannot also be author sources/],
      [value => value.title = 'Different', /Invalid chapter composition/],
    ];
    for (const [change, expected] of invalid) {
      Object.assign(f.composition, structuredClone(original)); change(f.composition); await f.save();
      await assert.rejects(composeDocument(f.root, f.descriptor), expected);
    }
    Object.assign(f.composition, structuredClone(original));
    f.composition.sections = f.composition.sections.filter(section => section.source !== 'content/unit/two.source.md');
    await f.save();
    await assert.rejects(composeDocument(f.root, f.descriptor), /Unselected H2.*two.source.md#second/,
      'an entirely omitted author file still belongs to the declared pool');
    Object.assign(f.composition, structuredClone(original));
    f.composition.codeSources.push('content/unit/common.cpp');
    await fs.writeFile(path.join(f.root, 'content/unit/common.cpp'), '// independent shared C++ helper\n');
    await f.save();
    assert((await composeDocument(f.root, f.descriptor)).source.endsWith('// independent shared C++ helper\n'));
  } finally { await dispose(f.root); }
});

test('fragment evidence excludes code fences, indented code and HTML comments', () => {
  const source = '# Author\n\n<a id="real"></a>\n## Real\n\n'
    + '```md\n<a id="fenced"></a>\n## Fenced\n```\n\n'
    + '<!--\n<a id="commented"></a>\n## Commented\n-->\n\n'
    + '    <a id="indented"></a>\n    ## Indented\n\n';
  assert.deepEqual([...chapterFragments(source).keys()], ['real']);
  for (const pseudo of ['```md\n<a id="fake"></a>\n```', '<!--\n<a id="fake"></a>\n-->', '    <a id="fake"></a>'])
    assert.throws(() => chapterFragments(source + pseudo + '\n## Unanchored\n'), /every H2 requires/);
  assert.throws(() => chapterFragments(source + '<a id="real"></a>\n## Duplicate\n'), /duplicate fragment anchor/);
  assert.deepEqual([...chapterFragments(source + '<a id="inline-comment"></a>\n## Real heading <!-- metadata -->\n'
    + '<a id="another"></a>\n## Another\n').keys()], ['real', 'inline-comment', 'another']);
});

test('changes to any original author input or composer invalidate existing reading assets', async () => {
  const f = await fixture();
  try {
    f.rebuild();
    const originals = ['content/unit/one.source.md', 'content/unit/two.cpp', f.descriptor.composition, 'tools/compose-chapter.mjs'];
    for (const relative of originals) {
      const filename = path.join(f.root, relative), before = await fs.readFile(filename);
      await fs.appendFile(filename, '\n');
      await assert.rejects(readAuthority(f.root, f.descriptor), /Authoring dependency hash mismatch/);
      await fs.writeFile(filename, before);
    }
    const generated = path.join(f.root, 'content/unit/chapter.source.md');
    await fs.appendFile(generated, '\nUnauthorized generated prose.\n');
    const buildPath = path.join(f.root, 'content/unit/build/chapter.json');
    const manifest = JSON.parse(await fs.readFile(buildPath));
    manifest.sourceSha256 = hash(await fs.readFile(generated));
    await fs.writeFile(buildPath, JSON.stringify(manifest));
    await assert.rejects(readAuthority(f.root, f.descriptor), /Composed author sources differ/,
      'updating only generated hashes cannot create a second author authority');
  } finally { await dispose(f.root); }
});

test('real author build rejects Setext main headings and publishes semantic preview titles', async () => {
  const f=await fixture();try {
    f.rebuild();
    const html=await fs.readFile(path.join(f.root,'content/unit/chapter.html'),'utf8');
    assert.match(html,/<title>二分 · /);
    assert.match(html,/<span>二分<\/span>/);
    assert.match(html,/href="chapter\.reader\.cpp"/);
    assert.doesNotMatch(await fs.readFile(path.join(f.root,'content/unit/chapter.reader.cpp'),'utf8'),/^\/\/ (?:BEGIN|END) /m);
    await fs.appendFile(path.join(f.root,'content/unit/two.source.md'),'\n意外的H1\n===\n');
    assert.throws(f.rebuild,/main headings require explicit ATX/);
  }finally{await dispose(f.root);}
});

test('composition paths reject traversal and symlinks outside content', async () => {
  const f = await fixture();
  try {
    const original = structuredClone(f.composition);
    for (const relative of ['content/unit/../one.source.md', 'content\\unit\\one.source.md',
      'D:/outside.source.md', 'content/unit/one.source.md:stream']) {
      Object.assign(f.composition, structuredClone(original)); f.composition.sourceFiles[0] = relative; await f.save();
      await assert.rejects(composeDocument(f.root, f.descriptor), /Invalid composition authority path/);
    }
    const bad = structuredClone(f.publications); bad.collections[0].documents[0].composition = 'content/unit/../bad.authoring.json';
    assert.throws(() => validatePublications(bad), /Invalid composition authority path/);
    const outside = path.join(f.root, 'outside'); await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'one.source.md'), f.first);
    await fs.symlink(outside, path.join(f.root, 'content/linked'), 'junction');
    Object.assign(f.composition, structuredClone(original));
    f.composition.sourceFiles[0] = 'content/linked/one.source.md';
    f.composition.prelude.source = f.composition.sections[1].source = 'content/linked/one.source.md'; await f.save();
    await assert.rejects(composeDocument(f.root, f.descriptor), /escapes content/);
    await fs.unlink(path.join(f.root, 'content/linked'));
    Object.assign(f.composition, structuredClone(original)); await f.save();
    await fs.symlink(path.join(f.root, 'content/unit'), path.join(f.root, 'content/unit/chapter.cpp'), 'junction');
    assert.throws(f.rebuild, /Generated chapter authority cannot be a symlink/);
    assert.equal(await fs.readFile(path.join(f.root, 'content/unit/one.cpp'), 'utf8'), f.cppOne);
    await fs.unlink(path.join(f.root, 'content/unit/chapter.cpp'));
  } finally { await dispose(f.root); }
});
