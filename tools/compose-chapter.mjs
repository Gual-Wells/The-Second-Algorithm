import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

// Keep this check usable without reading the filesystem when validating the
// publication registry. realpath is checked separately before every read.
export function compositionPath(value, suffix = '.authoring.json') {
  if (typeof value !== 'string' || !value.startsWith('content/') || !value.endsWith(suffix)
      || value.includes('\\') || value.split('/').some(segment => !segment || segment === '.' || segment === '..'
        || /[<>:"|?*\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment)))
    throw new Error('Invalid composition authority path: ' + value);
  return value;
}

async function contentBytes(root, relative, suffix) {
  compositionPath(relative, suffix);
  const allowed = await fs.realpath(path.join(root, 'content'));
  const filename = await fs.realpath(path.resolve(root, relative));
  if (!inside(allowed, filename)) throw new Error('Composition authority escapes content/: ' + relative);
  return fs.readFile(filename);
}

// This scanner only accepts standalone, explicit ATX H2 fragments. The author
// files remain byte authorities: offsets refer to the untouched input, including
// its original line endings. Fences, indented code and HTML comments cannot
// manufacture a fragment anchor or heading.
export function chapterFragments(text, label = 'author source') {
  const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter(match => match[0]);
  const fragments = [];
  let fence = null, comment = false, precedingAnchor = null;
  for (const match of lines) {
    const line = match[0].replace(/[\r\n]+$/, '');
    if (fence) {
      if (new RegExp('^ {0,3}' + fence.character + '{' + fence.length + ',}[ \\t]*$').test(line)) fence = null;
      precedingAnchor = null;
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!comment && opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
      fence = { character: opening[1][0], length: opening[1].length };
      precedingAnchor = null;
      continue;
    }
    let visible = '', cursor = 0, commented = comment;
    while (cursor < line.length) {
      if (comment) {
        const end = line.indexOf('-->', cursor);
        if (end === -1) { cursor = line.length; break; }
        cursor = end + 3; comment = false;
      } else {
        const start = line.indexOf('<!--', cursor);
        if (start === -1) { visible += line.slice(cursor); break; }
        visible += line.slice(cursor, start); cursor = start + 4; comment = true; commented = true;
      }
    }
    if (commented && !visible.trim()) { precedingAnchor = null; continue; }
    const anchor = line.match(/^ {0,3}<a id="([a-z][a-z0-9-]*)"><\/a>[ \t]*$/);
    if (anchor) { precedingAnchor = { anchor: anchor[1], start: match.index }; continue; }
    if (/^[ \t]*$/.test(line)) continue;
    if (/^ {0,3}##(?:[ \t]+|$)/.test(visible)) {
      if (!precedingAnchor) throw new Error(label + ': every H2 requires a preceding standalone fragment anchor');
      if (fragments.some(fragment => fragment.anchor === precedingAnchor.anchor))
        throw new Error(label + ': duplicate fragment anchor ' + precedingAnchor.anchor);
      fragments.push(precedingAnchor);
    } else if (/^ {0,3}#(?:[ \t]+|$)/.test(visible) && fragments.length) {
      throw new Error(label + ': H1 is only allowed in the author-file preamble');
    }
    precedingAnchor = null;
  }
  if (fence || comment) throw new Error(label + ': unclosed code fence or HTML comment');
  if (!fragments.length) throw new Error(label + ': no explicit H2 fragments');
  // The title belongs to the composition; no author prose may disappear before
  // the first fragment. Internal file titles and comments are the only preamble.
  const preamble = text.slice(0, fragments[0].start).replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^ {0,3}#[ \t]+[^\r\n]*(?:\r\n|\r|\n|$)/m, '');
  if (preamble.trim()) throw new Error(label + ': unassigned content before the first H2');
  return new Map(fragments.map((fragment, index) => [fragment.anchor,
    text.slice(fragment.start, fragments[index + 1]?.start ?? text.length)]));
}

export async function composeDocument(root, descriptor) {
  root = path.resolve(root);
  compositionPath(descriptor.path + '.source.md', '.source.md');
  const dependencies = {};
  const read = async (relative, suffix) => {
    const bytes = await contentBytes(root, relative, suffix);
    const text = bytes.toString('utf8');
    if (!Buffer.from(text).equals(bytes)) throw new Error('Composition authority must be valid UTF-8: ' + relative);
    dependencies[relative] = hash(bytes);
    return text;
  };
  const manifest = JSON.parse(await read(descriptor.composition, '.authoring.json'));
  if (manifest?.schemaVersion !== 1 || typeof manifest.title !== 'string' || !manifest.title.trim()
      || /[\r\n]/.test(manifest.title) || manifest.title !== descriptor.title
      || !manifest.prelude || !Array.isArray(manifest.sections) || !manifest.sections.length
      || !Array.isArray(manifest.sourceFiles) || !manifest.sourceFiles.length
      || !Array.isArray(manifest.codeSources) || !manifest.codeSources.length)
    throw new Error('Invalid chapter composition manifest');
  const selections = [manifest.prelude, ...manifest.sections], ids = new Set(), selected = new Set();
  const authorSources = new Set();
  for (const relative of manifest.sourceFiles) {
    compositionPath(relative, '.source.md');
    if (authorSources.has(relative)) throw new Error('Duplicate composition author source: ' + relative);
    authorSources.add(relative);
  }
  if (authorSources.has(descriptor.path + '.source.md') || manifest.codeSources.includes(descriptor.path + '.cpp'))
    throw new Error('Generated chapter files cannot also be author sources');
  for (const [index, entry] of selections.entries()) {
    if (!entry || !ID.test(entry.anchor) || (index && (!ID.test(entry.id) || ids.has(entry.id))))
      throw new Error('Invalid/duplicate composition section ID or anchor');
    if (index) ids.add(entry.id);
    compositionPath(entry.source, '.source.md');
    if (!authorSources.has(entry.source)) throw new Error('Composition fragment source is not in sourceFiles: ' + entry.source);
    const identity = entry.source + '#' + entry.anchor;
    if (selected.has(identity)) throw new Error('Duplicate composition fragment: ' + identity);
    selected.add(identity);
  }
  const codePaths = new Set();
  for (const relative of manifest.codeSources) {
    compositionPath(relative, '.cpp');
    if (codePaths.has(relative)) throw new Error('Duplicate composition code source: ' + relative);
    codePaths.add(relative);
  }
  const fragments = new Map();
  for (const relative of authorSources) {
    const blocks = chapterFragments(await read(relative, '.source.md'), relative);
    for (const [anchor, block] of blocks) fragments.set(relative + '#' + anchor, block);
  }
  const ordered = selections.map(entry => {
    const identity = entry.source + '#' + entry.anchor;
    if (!fragments.has(identity)) throw new Error('Unknown composition fragment: ' + identity);
    return fragments.get(identity);
  });
  const omitted = [...fragments.keys()].filter(identity => !selected.has(identity));
  if (omitted.length) throw new Error('Unselected H2 composition fragments: ' + omitted.join(', '));
  const code = [];
  for (const relative of codePaths) code.push(await read(relative, '.cpp'));
  const helper = 'tools/compose-chapter.mjs';
  const helperPath = await fs.realpath(path.join(root, helper));
  if (!inside(await fs.realpath(path.join(root, 'tools')), helperPath)) throw new Error('Composition helper escapes tools/');
  dependencies[helper] = hash(await fs.readFile(helperPath));
  return {
    draft: '# ' + manifest.title + '\n\n' + ordered.map(block => block + (block.endsWith('\n') ? '' : '\n')).join('\n'),
    // Add separators only between complete source files; namespace/region/body
    // bytes within each canonical C++ source are never rewritten.
    source: code.map(text => text + (text.endsWith('\n') ? '' : '\n')).join('\n'),
    dependencies: Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
  };
}
