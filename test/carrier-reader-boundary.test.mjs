import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReaderText, assertReaderHtml, assertReaderMarkdown, assertReaderSource, readerSourceView,
  assertMainHeadings, assertRenderedMainHeadings } from '../tools/reader-boundary.mjs';
import { renderKnowledge, createLinkRewriter } from '../scripts/build-carrier.mjs';

test('reader boundary detects production self-report without banning real implementation conditions', () => {
  for (const text of ['没有冒充已在 OJ 获得通过；250阶压力测试的本机结果另有验证记录。',
    '不能为了印两份循环而伪造库版。', '不是第二套伪造的一键求解算法。',
    '不冒称已教完整Aliens。', '更新researchTypeIds后通过审阅。', '参考chapter-review.json。'])
    assert.throws(() => assertReaderText(text), /reader boundary/);
  for (const text of ['固定seed便于本机重复实验。', '用压力测试测量不同输入规模的运行时间。',
    '不能让根自指伪造多级上司。', '函数图的精确k跳不能直接冒充本节搜索。',
    '验证恢复序列的下标递增和值关系；测试空数组和重复值。',
    '工程中复制vector的代价应计入总复杂度；标准库没有整题匹配函数。'])
    assert.doesNotThrow(() => assertReaderText(text));
});

test('visible and accessible labels reject internal identities while routing attributes remain functional', () => {
  assert.doesNotThrow(() => assertReaderHtml('<a href="#knowledge-Q100001" data-knowledge="Q100001">二分库</a>'));
  assert.throws(() => assertReaderHtml('<p>请阅读Q100001。</p>'), /visible knowledge identity/);
  assert.throws(() => assertReaderHtml('<button aria-label="Q100001">条件</button>'), /visible knowledge identity/);
  assert.throws(() => assertReaderHtml('<p>&#81;100001</p>'), /visible knowledge identity/);
});

test('encoded private production references and hidden author notes cannot travel in reader assets', () => {
  for (const href of ['work/jobs/private/review.md', 'work%2Fjobs%2Fprivate%2Freview.md',
    'https://github.com/Gual-Wells/The-Second-Algorithm/blob/main/protocol/QUALITY_WORKFLOW.md',
    'https://github.com/Gual-Wells/The-Second-Algorithm/blob/main/%77ork%2Fjobs%2Fprivate.json'])
    assert.throws(() => assertReaderHtml(`<a href="${href}">说明</a>`), /reader boundary/);
  assert.throws(() => assertReaderMarkdown('# 章\n\n<!-- 作者审核留在内部 -->\n\n## 类型\n'), /hidden author comment/);
  assert.throws(() => assertReaderHtml('<p>机制</p><!-- author note -->'), /hidden author comment/);
  for (const href of ['../../work/report.md','protocol/README.md','../../%70rotocol%2FREADME.md']) {
    assert.throws(() => assertReaderMarkdown(`# 章\n\n## 类型\n\n[说明](${href})`), /reader boundary/);
    assert.throws(() => assertReaderHtml(`<a href="${href}">说明</a>`), /reader boundary/);
  }
  assert.doesNotThrow(() => assertReaderMarkdown('# 章\n\n## 类型\n\n```cpp\nstd::string file="work/input.txt";\n```'));
  assert.doesNotThrow(() => assertReaderMarkdown('# 章\n\n## 类型\n\n```cpp\nconst auto note = "<!-- literal -->";\n```'));
});

test('unresolved author markers are rejected in prose, not C++ aggregates or inline examples', () => {
  assert.throws(() => assertReaderMarkdown('# 章\n\n## 类型\n\n{{unresolved}}\n'), /unresolved author marker/);
  assert.doesNotThrow(() => assertReaderMarkdown('# 章\n\n## 类型\n\n```cpp\nint a[1][1]={{7}};\n```\n\n`{{value}}` is literal.\n'));
});

test('reader source projection removes only registered paired delimiters and preserves every other byte', () => {
  const source = '#include <vector>\r\n// BEGIN foo\r\nnamespace n {\r\n// BEGIN is a normal explanation\r\nconst char* s="BEGIN";\r\n}\r\n// END foo\r\n';
  const expected = source.replace('// BEGIN foo\r\n','').replace('// END foo\r\n','');
  assert.equal(readerSourceView(source, ['foo']), expected);
  assert.doesNotThrow(() => assertReaderSource(expected));
  assert.throws(() => assertReaderSource(source), /editorial region marker/);
  assert.throws(() => readerSourceView(source, ['other']), /unregistered/);
  assert.throws(() => readerSourceView('// BEGIN foo\nint x;\n', ['foo']), /unpaired/);
  assert.throws(() => readerSourceView('// END foo\n', ['foo']), /unpaired/);
  assert.throws(() => readerSourceView('// BEGIN foo\n// BEGIN bar\n', ['foo','bar']), /nested/);
});

test('the real Markdown parser rejects Setext and nested main headings; rendered HTML cannot add hidden main structure', () => {
  for (const extra of ['意外大标题\n===\n', '意外题型\n---\n', '# 第二标题\n', '> ## 内嵌题型\n'])
    assert.throws(() => assertMainHeadings('# 章\n\n## 类型\n\n'+extra), /main headings|chapter H1/);
  assert.doesNotThrow(() => assertMainHeadings('# 章\n\n## 类型\n\n### 实现\n\n```md\nNested\n===\n```\n'));
  assert.throws(() => assertRenderedMainHeadings('<h1>章</h1><h2>类型</h2><h2>额外HTML标题</h2>',
    [{depth:1},{depth:2}]), /rendered main headings/);
});

test('knowledge popup output is independently checked and keeps semantic navigation labels', () => {
  const record={id:'Q100001',title:'借用',body:'仅在原容器有效期间使用。',anchors:[],prerequisites:[]};
  assert.doesNotThrow(() => renderKnowledge(record,new Map([[record.id,record]])));
  for (const body of ['本机结果另有验证记录。','请看 [内部记录](https://github.com/Gual-Wells/The-Second-Algorithm/blob/main/work/jobs/review.json)。'])
    assert.throws(()=>renderKnowledge({...record,body},new Map([[record.id,record]])),/reader boundary/);
});

test('reader link rewrite does not promote internal repository records into fixed GitHub references', () => {
  const rewrite=createLinkRewriter({collection:{id:'chapter'},document:{id:'doc',path:'content/unit/chapter'},
    byPath:new Map(),gitRevision:'a'.repeat(40)});
  for(const href of ['../../work/notes.md','../../protocol/CHAPTER_STANDARD.md','../../catalog/learning.json',
    '../../%77ork%2Fjobs%2Freview.json','chapter.source.md'])
    assert.throws(()=>rewrite(href),/Internal production reference/);
  assert.equal(rewrite('https://en.cppreference.com/w/cpp/algorithm/lower_bound').external,true);
});
