import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';

hljs.registerLanguage('cpp', cpp);

const REPOSITORY = 'https://github.com/Gual-Wells/The-Second-Algorithm';
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REGION_ID = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const SHA = /^[a-f0-9]{64}$/;
const QUESTION = /^Q[0-9]{6}$/;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const hash = value => createHash('sha256').update(value).digest('hex');
const decodeEntities = value => value.replace(/&(?:#(x[0-9a-f]+|[0-9]+)|(amp|lt|gt|quot|apos|colon|#39));/gi,
  (all, number, name) => number ? String.fromCodePoint(number[0].toLowerCase() === 'x'
    ? Number.parseInt(number.slice(1), 16) : Number.parseInt(number, 10))
    : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', '#39': "'" })[name.toLowerCase()] ?? all);

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function contentPath(root, value) {
  if (typeof value !== 'string' || !/^content\/[^/]+\/[^/]+$/.test(value) || value.includes('\\'))
    throw new Error('Document authority must be directly inside content/<unit>/: ' + value);
  if (value.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Authority path traversal');
  const resolved = path.resolve(root, value);
  if (!inside(path.resolve(root, 'content'), resolved)) throw new Error('Authority escapes content/');
  return resolved;
}

export function validatePublications(publications) {
  if (publications?.schemaVersion !== 2 || !Array.isArray(publications.collections))
    throw new Error('Unsupported publication manifest');
  if (!['active', 'withdrawn'].includes(publications.state === undefined ? 'active' : publications.state))
    throw new Error('Publication state must be active or withdrawn');
  const collections = new Set(), documents = new Set(), authorities = new Set(), chapterNumbers = new Set();
  for (const collection of publications.collections) {
    if (!ID.test(collection.id) || collections.has(collection.id)) throw new Error('Invalid/duplicate collection ID');
    collections.add(collection.id);
    if (Object.hasOwn(collection, 'track') || !['draft', 'chapter'].includes(collection.kind))
      throw new Error('Unified publications require chapter/draft kind and no track');
    if (collection.visibility !== undefined && !['published', 'hidden'].includes(collection.visibility))
      throw new Error('Invalid publication visibility');
    if (!collection.title?.trim() || !Array.isArray(collection.documents) || !collection.documents.length)
      throw new Error('Collection requires a title and documents');
    if (collection.kind === 'draft' && collection.visibility !== 'hidden')
      throw new Error('Draft collections must be hidden');
    if (collection.kind === 'draft' && Object.hasOwn(collection, 'chapterNumber'))
      throw new Error('Draft collections cannot have chapter numbers');
    if (collection.kind === 'chapter') {
      if (!Number.isSafeInteger(collection.chapterNumber) || collection.chapterNumber < 1)
        throw new Error('Published chapters require a positive integer chapter number');
      if (chapterNumbers.has(collection.chapterNumber)) throw new Error('Duplicate chapter number');
      chapterNumbers.add(collection.chapterNumber);
    }
    for (const document of collection.documents) {
      if (!ID.test(document.id) || documents.has(document.id)) throw new Error('Document IDs must be globally unique');
      documents.add(document.id);
      if (!document.title?.trim()) throw new Error('Document requires a title');
      contentPath(process.cwd(), document.path);
      if (authorities.has(document.path)) throw new Error('A document authority is registered twice');
      authorities.add(document.path);
    }
  }
  if (publications.state === 'withdrawn' && publications.collections.some(collection =>
    collection.visibility !== 'hidden' && collection.documents.length))
    throw new Error('Withdrawn publication requires no published documents');
  return publications;
}

export function validateLearning(learning, publications) {
  if (learning?.schemaVersion !== 1 || !['questions', 'tasks', 'targets'].every(key => Array.isArray(learning[key])))
    throw new Error('Unsupported learning manifest');
  const documents = new Map(publications.collections.flatMap(collection => collection.documents.map(document =>
    [document.id, { ...document, published: collection.visibility !== 'hidden' }])));
  if (publications.state === 'withdrawn') {
    if ([...documents.values()].some(document => document.published)
      || ['questions', 'tasks', 'targets'].some(key => learning[key].length))
      throw new Error('Withdrawn publication requires no published documents and empty questions, tasks and targets');
  } else if (![...documents.values()].some(document => document.published)
    || ['questions', 'tasks', 'targets'].some(key => !learning[key].length))
    throw new Error('Active course requires published documents, questions, tasks and targets');
  const questions = new Map(), targets = new Set(), tasks = new Set(), implementations = new Set();
  for (const question of learning.questions) {
    if (!QUESTION.test(question.id) || questions.has(question.id)) throw new Error('Invalid/duplicate question ID');
    if (!question.title?.trim() || !documents.has(question.document) || question.anchor !== question.id.toLowerCase()
      || !Array.isArray(question.prerequisites) || !Array.isArray(question.sources) || !question.sources.length)
      throw new Error('Question requires title, registered document, canonical anchor, prerequisites and sources');
    if (new Set(question.prerequisites).size !== question.prerequisites.length) throw new Error('Duplicate question prerequisite');
    for (const source of question.sources) if (!/^https:\/\//.test(source)) throw new Error('Question source must be HTTPS');
    questions.set(question.id, question);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (!questions.has(id)) throw new Error('Unknown question prerequisite: ' + id);
    if (visiting.has(id)) throw new Error('Question prerequisites contain a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    const question = questions.get(id);
    for (const prerequisite of question.prerequisites) {
      if (documents.get(question.document).published && !documents.get(questions.get(prerequisite)?.document)?.published)
        throw new Error('Published question prerequisite is not published: ' + prerequisite);
      visit(prerequisite);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of questions.keys()) visit(id);
  for (const target of learning.targets) {
    if (!ID.test(target.id) || targets.has(target.id) || typeof target.source !== 'string'
      || !/^tests\/cpp\/[^/]+\.cpp$/.test(target.source) || !/^c\+\+(?:17|20|23|26)$/.test(target.standard))
      throw new Error('Invalid/duplicate learning target');
    targets.add(target.id);
  }
  for (const task of learning.tasks) {
    if (!ID.test(task.id) || tasks.has(task.id) || !task.title?.trim() || !task.contract?.trim()
      || !documents.has(task.document) || !Array.isArray(task.methods) || !task.methods.length)
      throw new Error('Invalid/duplicate learning task');
    tasks.add(task.id);
    const methods = new Set();
    for (const method of task.methods) {
      if (!ID.test(method.id) || methods.has(method.id) || !method.title?.trim() || !method.invariant?.trim()
        || !Array.isArray(method.implementations) || !method.implementations.length) throw new Error('Invalid learning method');
      methods.add(method.id);
      for (const implementation of method.implementations) {
        if (!ID.test(implementation.id) || implementations.has(implementation.id)
          || !['manual', 'standard', 'alternative'].includes(implementation.kind)
          || !implementation.symbol?.trim() || !/^c\+\+(?:17|20|23|26)$/.test(implementation.standard)
          || !Array.isArray(implementation.regions) || !implementation.regions.length
          || implementation.regions.some(region => !REGION_ID.test(region))
          || !Array.isArray(implementation.questions) || !implementation.questions.length
          || !targets.has(implementation.target) || !implementation.complexity?.time?.trim() || !implementation.complexity?.space?.trim())
          throw new Error('Invalid/duplicate learning implementation');
        contentPath(process.cwd(), implementation.source);
        if (!implementation.source.endsWith('.cpp')) throw new Error('Implementation authority must be C++');
        for (const id of implementation.questions) {
          if (!questions.has(id)) throw new Error('Implementation refers to unknown question: ' + id);
          if (documents.get(task.document).published && !documents.get(questions.get(id).document).published)
            throw new Error('Published implementation question is not published: ' + id);
        }
        implementations.add(implementation.id);
      }
    }
  }
  return learning;
}

export async function readAuthority(root, descriptor) {
  const base = contentPath(root, descriptor.path), name = path.basename(base);
  const manifestPath = path.join(path.dirname(base), 'build', name + '.json');
  if (!inside(path.resolve(root, 'content'), await fs.realpath(manifestPath))) throw new Error('Manifest escapes content/');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const files = { source: base + '.source.md', code: base + '.cpp', markdown: base + '.md', html: base + '.html',
    builder: path.join(root, 'tools/build_handbook.mjs') };
  const bytes = {};
  for (const [kind, filename] of Object.entries(files)) {
    const allowed = path.resolve(root, kind === 'builder' ? 'tools' : 'content');
    if (!inside(allowed, await fs.realpath(filename))) throw new Error(kind + ' authority escapes its allowed directory');
    bytes[kind] = await fs.readFile(filename);
    if (!SHA.test(manifest[kind + 'Sha256'] ?? '') || hash(bytes[kind]) !== manifest[kind + 'Sha256'])
      throw new Error(`${descriptor.id}: ${kind} authority hash mismatch; rebuild the reading assets first`);
  }
  const blocks = new Map();
  for (const match of bytes.code.toString('utf8').matchAll(/\/\/ BEGIN ([\w-]+)\r?\n([\s\S]*?)\/\/ END \1/g)) {
    if (blocks.has(match[1])) throw new Error('Duplicate canonical code block');
    blocks.set(match[1], match[2].replace(/\r\n?/g, '\n').trim());
  }
  const used = [...bytes.source.toString('utf8').matchAll(/\{\{(?:(?:code|code-block):)?([\w-]+)\}\}/g)].map(x => x[1]);
  if (new Set(used).size !== used.length || used.length !== blocks.size || used.some(x => !blocks.has(x))
      || JSON.stringify(used) !== JSON.stringify(manifest.codeBlocks))
    throw new Error('Canonical code placements do not match build manifest');
  if (!Array.isArray(manifest.headings) || !manifest.headings.length) throw new Error('Missing canonical headings');
  for (const [kind, relative] of [['learning', 'catalog/learning.json'], ['publications', 'carrier/publications.json']]) {
    const dependency = await fs.readFile(path.join(root, relative));
    if (!SHA.test(manifest[kind + 'Sha256'] ?? '') || hash(dependency) !== manifest[kind + 'Sha256'])
      throw new Error(`${descriptor.id}: ${kind} authority hash mismatch; rebuild the reading assets first`);
  }
  const revision = hash(JSON.stringify([manifest.sourceSha256, manifest.codeSha256, manifest.markdownSha256,
    manifest.htmlSha256, manifest.builderSha256, manifest.learningSha256, manifest.publicationsSha256]));
  const inlineExamples = new Set();
  marked.walkTokens(marked.lexer(bytes.source.toString('utf8')), token => {
    if (token.type === 'code') inlineExamples.add(token.text.replace(/\r\n?/g, '\n').trim());
  });
  return { ...descriptor, manifest, blocks, used, revision, draft: bytes.source.toString('utf8'), markdown: bytes.markdown.toString('utf8'),
    source: bytes.code.toString('utf8'), markdownBytes: bytes.markdown, inlineExamples };
}

export function createLinkRewriter({ collection, document, byPath, gitRevision }) {
  if (!/^[a-f0-9]{40}$/.test(gitRevision)) throw new Error('Fixed Git revision required for repository references');
  const internal = (entry, anchor) => '#/read/' + entry.collection + '/' + entry.document
    + (anchor ? '?anchor=' + encodeURIComponent(anchor) : '');
  return href => {
    href = decodeEntities(String(href ?? '')).trim();
    const compact = href.replace(/[\u0000-\u0020\u007f]/g, '');
    if (/^(?:javascript|vbscript|data|file|blob):/i.test(compact)) throw new Error('Unsafe link scheme');
    if (/^[a-z][a-z0-9+.-]*:/i.test(compact) || href.startsWith('//')) {
      const url = new URL(href.startsWith('//') ? 'https:' + href : href);
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported link scheme');
      return { href: url.href, external: true };
    }
    const match = href.match(/^([^?#]*)(?:\?[^#]*)?(?:#(.*))?$/);
    if (!match) throw new Error('Invalid content link');
    let filename, anchor;
    try { filename = decodeURIComponent(match[1]); anchor = match[2] ? decodeURIComponent(match[2]) : ''; }
    catch { throw new Error('Malformed content URL'); }
    if (!filename) return { href: internal({ collection: collection.id, document: document.id }, anchor), external: false };
    if (filename.includes('\\') || filename.startsWith('/')) throw new Error('Absolute local content link is not allowed');
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(document.path), filename));
    if (target.startsWith('../') || target.startsWith('.local/') || target === '.local')
      throw new Error('Private/outside repository link');
    const entry = byPath.get(target);
    if (entry) {
      if (target.endsWith('.html')) return { href: internal(entry, anchor), external: false };
      if (target.endsWith('.cpp')) return { href: entry.sourceUrl, external: false, download: true };
      if (target.endsWith('.md')) return { href: entry.markdownUrl, external: false, download: true };
    }
    if (target.startsWith('content/') && /\.(?:html|cpp|md)$/.test(target) && !target.endsWith('.source.md'))
      throw new Error('Content link is not registered for this carrier: ' + target);
    // Research, protocol and other repository records remain references, not app assets.
    return { href: `${REPOSITORY}/blob/${gitRevision}/${target.split('/').map(encodeURIComponent).join('/')}`
      + (anchor ? '#' + encodeURIComponent(anchor) : ''), external: true };
  };
}

export function renderAuthority(authority, rewriteLink) {
  const renderer = new marked.Renderer();
  let heading = 0, codeIndex = 0, inlineIndex = 0, firstParagraph = true, strippedH1 = false;
  renderer.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
    const expected = authority.manifest.headings[heading++];
    if (!expected || expected.depth !== depth || expected.text !== text)
      throw new Error(`${authority.id}: heading does not match canonical reading build`);
    if (depth === 1 && !strippedH1) { strippedH1 = true; return ''; }
    return `<h${depth} id="${esc(expected.id)}">${inner}</h${depth}>\n`;
  };
  renderer.paragraph = function ({ tokens }) {
    const inner = this.parser.parseInline(tokens);
    if (firstParagraph) {
      firstParagraph = false;
      if (/^(?:算法实战参考|第二算法实战)\s*[·・]/u.test(inner)) return '';
    }
    return '<p>' + inner + '</p>\n';
  };
  renderer.code = function ({ text, lang }) {
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    let id = authority.used[codeIndex];
    if (lang === 'cpp' && id && normalized === authority.blocks.get(id)) {
      ++codeIndex; text = authority.blocks.get(id);
    } else {
      if ([...authority.blocks.values()].includes(normalized) || !authority.inlineExamples?.has(normalized))
        throw new Error(`${authority.id}/${id}: visible code differs from canonical authority or original inline example`);
      id = 'inline-example-' + (++inlineIndex) + '-' + hash(normalized).slice(0, 8);
      text = normalized;
    }
    const label = lang === 'cpp' ? 'C++' : lang || '代码';
    return `<div class="code-block" data-code-id="${esc(id)}"><div class="code-toolbar"><span>${esc(label)}</span><button type="button" class="code-copy" data-copy-code="${esc(id)}" aria-label="复制代码">复制</button></div><pre><code class="language-${esc(lang || 'text')}">`
      + (lang === 'cpp' ? hljs.highlight(text, { language: 'cpp', ignoreIllegals: true }).value : esc(text)) + '</code></pre></div>\n';
  };
  renderer.link = function ({ href, title, tokens }) {
    const target = rewriteLink(href);
    return '<a href="' + esc(target.href) + '"' + (target.external ? ' target="_blank" rel="noopener noreferrer"' : '')
      + (target.download ? ' download' : '') + (title ? ' title="' + esc(title) + '"' : '')
      + '>' + this.parser.parseInline(tokens) + '</a>';
  };
  renderer.html = function ({ text }) {
    const anchor = text.match(/^\s*<a\s+id=(["'])([\p{L}\p{N}_.:\-]+)\1\s*>\s*(?:<\/a>\s*)?$/iu);
    if (anchor) return '<a id="' + esc(anchor[2]) + '"></a>';
    if (/^\s*<\/a>\s*$/i.test(text)) return '';
    return esc(text);
  };
  renderer.image = function () { throw new Error('Reader images require explicit carrier asset registration'); };
  let html = marked.parse(authority.markdown, { renderer, gfm: true });
  if (heading !== authority.manifest.headings.length || codeIndex !== authority.blocks.size)
    throw new Error('Reading content omitted a canonical heading or code block');
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate reading anchor');
  return { html, headings: authority.manifest.headings.filter((x, index) => !(index === 0 && x.depth === 1)) };
}

export async function buildLibrary(root, output, publications, gitRevision, learning) {
  validatePublications(publications);
  learning ??= JSON.parse(await fs.readFile(path.join(root, 'catalog/learning.json'), 'utf8'));
  validateLearning(learning, publications);
  const rows = [], byPath = new Map();
  for (const collection of publications.collections) {
    if (collection.visibility === 'hidden') continue;
    const documents = [];
    for (const descriptor of collection.documents) {
      const authority = await readAuthority(root, descriptor);
      const prefix = `/library/${collection.id}/${descriptor.id}/${authority.revision.slice(0, 16)}`;
      const entry = { collection: collection.id, document: descriptor.id, sourceUrl: prefix + '.cpp', markdownUrl: prefix + '.md' };
      for (const extension of ['.html', '.cpp', '.md']) byPath.set(descriptor.path + extension, entry);
      documents.push({ authority, entry });
    }
    rows.push({ collection, documents });
  }
  const catalog = { schemaVersion: 2, state: publications.state ?? 'active', version: '', collections: [], questions: [] };
  const renderedDocuments = new Map();
  let codeBlocks = 0;
  for (const { collection, documents } of rows) {
    const item = { id: collection.id, kind: collection.kind, title: collection.title, documents: [] };
    if (collection.kind === 'chapter') item.chapterNumber = collection.chapterNumber;
    for (const { authority, entry } of documents) {
      const rendered = renderAuthority(authority, createLinkRewriter({ collection, document: authority, byPath, gitRevision }));
      // A source-only revision would overwrite an immutable URL whenever the
      // renderer/highlighter changes. Fingerprint the actual reader payload too.
      const payload = { id: authority.id, title: authority.title, html: rendered.html,
        sourceUrl: entry.sourceUrl, headings: rendered.headings };
      const revision = hash(JSON.stringify({ authorityRevision: authority.revision, ...payload }));
      const url = `/library/${collection.id}/${authority.id}/${revision.slice(0, 16)}.json`;
      const document = { id: payload.id, title: payload.title, revision, html: payload.html,
        sourceUrl: payload.sourceUrl, headings: payload.headings };
      renderedDocuments.set(collection.id + '/' + authority.id, document);
      const filename = path.join(output, url.slice(1));
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, JSON.stringify(document) + '\n', 'utf8');
      await fs.writeFile(path.join(output, entry.sourceUrl.slice(1)), authority.source, 'utf8');
      await fs.writeFile(path.join(output, entry.markdownUrl.slice(1)), authority.markdownBytes);
      item.documents.push({ id: authority.id, title: authority.title, revision, url,
        sourceUrl: entry.sourceUrl, markdownUrl: entry.markdownUrl, headings: rendered.headings });
      codeBlocks += authority.blocks.size;
    }
    catalog.collections.push(item);
  }
  for (const document of renderedDocuments.values()) {
    for (const match of document.html.matchAll(/href="#\/read\/([^/"?]+)\/([^"?]+)(?:\?anchor=([^"&]*))?"/g)) {
      const target = renderedDocuments.get(match[1] + '/' + match[2]);
      if (!target) throw new Error('Internal reader document does not exist');
      if (match[3] && !target.html.includes('id="' + esc(decodeURIComponent(match[3])) + '"'))
        throw new Error('Internal reader anchor does not exist: ' + decodeURIComponent(match[3]));
    }
  }
  const byDocument = new Map(rows.flatMap(row => row.documents.map(({ authority }) => [authority.id, authority])));
  const declared = new Map();
  for (const authority of byDocument.values()) {
    marked.walkTokens(marked.lexer(authority.draft), token => {
      if (token.type !== 'heading') return;
      const visibleHeading = decodeEntities(marked.parseInline(token.text).replace(/<[^>]+>/g, ''));
      const match = visibleHeading.match(/^(Q[0-9]{6})\s*·\s*(.+)$/);
      if (!match) return;
      if (token.depth !== 3 || declared.has(match[1])) throw new Error('Question must have exactly one canonical H3 explanation: ' + match[1]);
      declared.set(match[1], { document: authority.id, title: match[2] });
    });
    if (/\[\[Q[0-9]{6}\]\]/.test(authority.markdown)) throw new Error('Unresolved question reference in reading asset');
  }
  for (const question of learning.questions) {
    if (!byDocument.has(question.document)) continue;
    const declaration = declared.get(question.id);
    if (!declaration || declaration.document !== question.document || declaration.title !== question.title)
      throw new Error('Question explanation does not match its unique registration: ' + question.id);
    const target = [...renderedDocuments.values()].find(document => document.id === question.document);
    if (!target?.html.includes('id="' + question.anchor + '"')) throw new Error('Question anchor does not exist: ' + question.id);
    catalog.questions.push(Object.fromEntries(['id', 'title', 'document', 'anchor', 'prerequisites'].map(key => [key, question[key]])));
    declared.delete(question.id);
  }
  if (declared.size) throw new Error('Question explanation is not registered: ' + declared.keys().next().value);
  const sources = new Map();
  for (const task of learning.tasks) for (const method of task.methods) for (const implementation of method.implementations) {
    if (!byDocument.has(task.document)) continue;
    let source = sources.get(implementation.source);
    if (!source) {
      const filename = contentPath(root, implementation.source);
      if (!inside(path.resolve(root, 'content'), await fs.realpath(filename))) throw new Error('Implementation escapes content/');
      source = await fs.readFile(filename, 'utf8'); sources.set(implementation.source, source);
    }
    if (!source.includes(implementation.symbol)) throw new Error('Implementation symbol is absent: ' + implementation.id);
    for (const region of implementation.regions) if (!new RegExp('// BEGIN ' + region + '\\r?\\n[\\s\\S]*?// END ' + region + '(?:\\r?\\n|$)').test(source))
      throw new Error('Implementation region is absent: ' + region);
    const target = learning.targets.find(target => target.id === implementation.target);
    const filename = path.resolve(root, target.source);
    if (!inside(path.join(root, 'tests/cpp'), await fs.realpath(filename))) throw new Error('Target escapes tests/cpp');
  }
  catalog.version = hash(JSON.stringify([gitRevision, catalog.state, catalog.collections, catalog.questions, hash(JSON.stringify(learning)),
    [...renderedDocuments].map(([id, document]) => [id, hash(JSON.stringify(document))])]));
  await fs.mkdir(path.join(output, 'library'), { recursive: true });
  await fs.writeFile(path.join(output, 'library/catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  return { catalog, documents: rows.reduce((n, row) => n + row.documents.length, 0), codeBlocks };
}

export function publicationIndex(catalog) {
  return { state: catalog.state ?? 'active', version: catalog.version, questions: catalog.questions, collections: Object.fromEntries(catalog.collections.map(collection =>
    [collection.id, Object.fromEntries(collection.documents.map(document => [document.id, document.revision]))])) };
}

export function libraryPaths(catalog) {
  return ['/library/catalog.json', ...catalog.collections.flatMap(collection => collection.documents
    .flatMap(document => [document.url, document.sourceUrl, document.markdownUrl]))];
}

async function loadEsbuild(modulePath) {
  const loaded = modulePath ? await import(pathToFileURL(path.resolve(modulePath)).href) : await import('esbuild');
  const esbuild = loaded.build ? loaded : loaded.default;
  if (!esbuild?.build) throw new Error('ESBUILD_MODULE must point to the esbuild JavaScript entry module');
  return esbuild;
}

async function copyShell(root, output) {
  const web = path.join(root, 'web');
  await fs.access(path.join(web, 'index.html'));
  const forbidden = new Set(['library', '_worker.js', '_routes.json', '_headers', 'DESIGN.md']);
  const files = [];
  for (const entry of await fs.readdir(web, { withFileTypes: true })) {
    if (forbidden.has(entry.name)) continue;
    if (/\.(?:pdf|epub|mobi|azw3?|exe|sqlite|db|cpp|hpp|c|h|md|zip|7z|gz)$/i.test(entry.name) || entry.name.startsWith('.'))
      throw new Error('Unexpected private/system asset in web/: ' + entry.name);
    await fs.cp(path.join(web, entry.name), path.join(output, entry.name), { recursive: true, dereference: false,
      filter: async source => {
        const stat = await fs.lstat(source);
        if (stat.isSymbolicLink()) throw new Error('Web asset symlinks are not allowed');
        const name = path.basename(source);
        if (name.startsWith('.') || name === 'node_modules' || /\.(?:pdf|epub|mobi|azw3?|exe|sqlite|db|cpp|hpp|c|h|md|zip|7z|gz)$/i.test(name))
          throw new Error('Unexpected private/system asset in web/: ' + name);
        if (stat.isFile()) files.push(path.relative(web, source).split(path.sep).join('/'));
        return true;
      } });
  }
  return files.sort();
}

async function workerSources(root) {
  const directory = path.join(root, 'server'), files = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const filename = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Worker source symlinks are not allowed');
      if (entry.isDirectory()) await visit(filename);
      else if (/\.(?:mjs|js|ts)$/.test(entry.name)) files.push(filename);
    }
  }
  await visit(directory);
  return Promise.all(files.sort().map(async file => [path.relative(directory, file).split(path.sep).join('/'),
    hash(await fs.readFile(file))]));
}

export async function buildCarrier({ root = process.cwd(), contentOnly = false, esbuildModule = process.env.ESBUILD_MODULE, outputDirectory = 'dist' } = {}) {
  root = path.resolve(root);
  if (typeof outputDirectory !== 'string' || (outputDirectory !== 'dist' && !outputDirectory.startsWith('.local/')))
    throw new Error('Build output must be dist or an isolated .local/ directory');
  const publications = JSON.parse(await fs.readFile(path.join(root, 'carrier/publications.json'), 'utf8'));
  const gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const local = path.join(root, '.local'); await fs.mkdir(local, { recursive: true });
  const staging = path.join(local, 'carrier-output-' + randomUUID());
  const destination = path.resolve(root, outputDirectory), backup = path.join(local, 'carrier-previous-' + randomUUID());
  if (![staging, destination, backup].every(x => inside(root, x))) throw new Error('Unsafe build output path');
  if (outputDirectory !== 'dist' && !inside(local, destination)) throw new Error('Isolated build escapes .local/');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(staging);
  let movedPrevious = false;
  try {
    const result = await buildLibrary(root, staging, publications, gitRevision);
    let buildID;
    if (!contentOnly) {
      const shellFiles = await copyShell(root, staging);
      // Disable Pages' implicit SPA fallback for retired library URLs.
      await fs.writeFile(path.join(staging, '404.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>未找到内容</title><body><p>未找到内容。</p></body></html>\n');
      if (!shellFiles.includes('404.html')) shellFiles.push('404.html');
      shellFiles.sort();
      const sources = await workerSources(root);
      const esbuild = await loadEsbuild(esbuildModule);
      await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], outfile: path.join(staging, 'app.js'),
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
        define: { __PUBLICATION_INDEX__: JSON.stringify(publicationIndex(result.catalog)) } });
      const swPath = path.join(staging, 'sw.js');
      await fs.writeFile(swPath, (await fs.readFile(swPath, 'utf8'))
        .replaceAll('__LIBRARY_PATHS__', JSON.stringify(libraryPaths(result.catalog))));
      await esbuild.build({ entryPoints: [path.join(root, 'server/worker.mjs')], outfile: path.join(staging, '_worker.js'),
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:workers'], logLevel: 'silent' });
      const shell = await Promise.all(shellFiles.map(async file => [file, hash(await fs.readFile(path.join(staging, file)))]));
      buildID = hash(JSON.stringify({ library: result.catalog.version, shell, sources,
        worker: hash(await fs.readFile(path.join(staging, '_worker.js'))) }));
      for (const filename of ['index.html', 'sw.js']) {
        const location = path.join(staging, filename);
        await fs.writeFile(location, (await fs.readFile(location, 'utf8')).replaceAll('__BUILD__', buildID), 'utf8');
      }
    } else {
      // An accidentally deployed content-only diagnostic must fail closed,
      // rather than let Pages serve the private library without the real worker.
      await fs.writeFile(path.join(staging, '_worker.js'),
        "export default {fetch(){return new Response('Content-only build; application bundle required',{status:503,headers:{'Cache-Control':'no-store'}})}};\n");
      buildID = hash(JSON.stringify({ library: result.catalog.version, mode: 'content-only' }));
    }
    await fs.writeFile(path.join(staging, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }) + '\n');
    await fs.writeFile(path.join(staging, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow\n/library/*\n  Cache-Control: private, no-store\n  Cross-Origin-Resource-Policy: same-origin\n/api/*\n  Cache-Control: no-store\n');
    await fs.writeFile(path.join(staging, 'carrier-build.json'), JSON.stringify({ version: result.catalog.version, buildID, gitRevision,
      publicationState: result.catalog.state, operation: result.catalog.state === 'withdrawn' ? 'withdrawal' : 'content-release',
      mode: contentOnly ? 'content-only' : 'full', documents: result.documents, codeBlocks: result.codeBlocks }) + '\n');
    try { await fs.rename(destination, backup); movedPrevious = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await fs.rename(staging, destination); }
    catch (error) { if (movedPrevious) await fs.rename(backup, destination); throw error; }
    if (movedPrevious) await fs.rm(backup, { recursive: true });
    return { mode: contentOnly ? 'content-only' : 'full', output: path.relative(root,destination).split(path.sep).join('/'), version: result.catalog.version, buildID,
      publicationState: result.catalog.state, operation: result.catalog.state === 'withdrawn' ? 'withdrawal' : 'content-release',
      collections: result.catalog.collections.length, documents: result.documents, codeBlocks: result.codeBlocks };
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), contentOnly: false };
  for (let i = 2; i < process.argv.length; ++i) {
    if (process.argv[i] === '--content-only') options.contentOnly = true;
    else if (process.argv[i] === '--esbuild-module') options.esbuildModule = process.argv[++i];
    else if (process.argv[i] === '--root') options.root = process.argv[++i];
    else if (process.argv[i] === '--output') options.outputDirectory = process.argv[++i];
    else throw new Error('Unknown build argument: ' + process.argv[i]);
  }
  console.log(JSON.stringify(await buildCarrier(options)));
}
