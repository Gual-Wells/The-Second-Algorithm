import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const QUESTION = /^Q[0-9]{6,}$/;
const ANCHOR = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REFERENCE = /\[\[(Q[0-9]{6,})(?:#([a-z][a-z0-9]*(?:-[a-z0-9]+)*))?(?:\|([^\]\n]+))?\]\]/g;
const INTRODUCTION = /\{\{knowledge:(Q[0-9]{6,})\}\}/g;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Never turn literal examples, comments or C++ strings in fenced code into links.
export function transformProse(text, transform) {
  const literal = /(^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\2\s*$|<!--[\s\S]*?-->|(`+)[^\n]*?\3)/gm;
  let out = '', start = 0;
  for (const match of text.matchAll(literal)) {
    out += transform(text.slice(start, match.index)) + match[0];
    start = match.index + match[0].length;
  }
  return out + transform(text.slice(start));
}

export function knowledgeTokens(text) {
  const references = [], introductions = [];
  transformProse(text, prose => {
    for (const match of prose.matchAll(REFERENCE)) references.push({ id: match[1], anchor: match[2] || '', label: match[3] || '' });
    for (const match of prose.matchAll(INTRODUCTION)) introductions.push(match[1]);
    return prose;
  });
  return { references, introductions };
}

export async function readKnowledge(root, model) {
  const result = new Map();
  if (model.schemaVersion !== 2) return result;
  const rootPath = path.resolve(root), realRoot = await fs.realpath(rootPath);
  const paths = new Set(), bodies = new Set();
  for (const question of model.questions) {
    const { id, title, source, prerequisites, sources } = question;
    if (!QUESTION.test(id) || result.has(id) || Number(id.slice(1)) < 1) throw new Error('Invalid/duplicate knowledge ID');
    if (typeof title !== 'string' || !title.trim() || /^Q[0-9]{6,}\b/.test(title)) throw new Error('Knowledge needs a semantic title');
    if (!Array.isArray(prerequisites) || new Set(prerequisites).size !== prerequisites.length || prerequisites.some(id => !QUESTION.test(id)))
      throw new Error(id + ': invalid knowledge prerequisites');
    if (!Array.isArray(sources) || !sources.length || sources.some(value => {
      try { const url = new URL(value); return !['http:', 'https:'].includes(url.protocol) || !url.hostname || !!url.username || !!url.password; }
      catch { return true; }
    })) throw new Error(id + ': invalid knowledge source URL');
    if (typeof source !== 'string' || !/^content\/knowledge\/[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/.test(source) || source.includes('..'))
      throw new Error('Knowledge source must be content/knowledge/<name>.md');
    if (paths.has(source)) throw new Error('Knowledge source registered more than once');
    paths.add(source);
    const filename = await fs.realpath(path.resolve(rootPath, source));
    if (!filename.startsWith(realRoot + path.sep)) throw new Error('Knowledge source escapes repository');
    const sourceBytes = await fs.readFile(filename);
    const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
    const markdown = sourceBytes.toString('utf8').replace(/^\uFEFF/, '');
    const titleMatch = /^# ([^\n]+)\r?\n/.exec(markdown);
    if (!titleMatch || titleMatch[1].trim() !== title) throw new Error(id + ': source title differs from registered semantic title');
    const body = markdown.slice(titleMatch[0].length).trim();
    if (!body) throw new Error(id + ': empty knowledge explanation');
    const normalized = body.replace(/\s+/g, ' ').trim();
    if (bodies.has(normalized)) throw new Error(id + ': duplicate complete knowledge explanation');
    bodies.add(normalized);
    if (knowledgeTokens(body).introductions.length) throw new Error('Knowledge cannot recursively introduce another full explanation');
    const anchors = [...body.matchAll(/<a\s+id=["']([^"']+)["']\s*>\s*<\/a>/g)].map(match => match[1]);
    if (new Set(anchors).size !== anchors.length || anchors.some(anchor => !ANCHOR.test(anchor))) throw new Error(id + ': invalid/duplicate knowledge anchor');
    result.set(id, { id, title, source, sourceSha256, prerequisites, sources, markdown, body, anchors });
  }
  for (const record of result.values()) {
    for (const prior of record.prerequisites) if (!result.has(prior)) throw new Error(record.id + ': unknown knowledge prerequisite');
    for (const reference of knowledgeTokens(record.body).references) {
      const target = result.get(reference.id);
      if (!target || reference.anchor && !target.anchors.includes(reference.anchor)) throw new Error(record.id + ': unresolved knowledge reference');
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Knowledge prerequisite cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prior of result.get(id).prerequisites) visit(prior);
    visiting.delete(id); visited.add(id);
  }
  for (const id of result.keys()) visit(id);
  return result;
}

export function expandKnowledgeReferences(text, knowledge) {
  return transformProse(text, prose => prose.replace(REFERENCE, (_, id, anchor, label) => {
    const record = knowledge.get(id);
    if (!record || anchor && !record.anchors.includes(anchor)) throw new Error('Unresolved knowledge reference ' + id + (anchor ? '#' + anchor : ''));
    const visible = (label || record.title).trim();
    if (!visible || /\bQ[0-9]{6,}\b/.test(visible)) throw new Error('Knowledge link needs a semantic label');
    return `<a class="knowledge-link" href="#knowledge-${id}" data-knowledge="${id}"${anchor ? ` data-knowledge-anchor="${anchor}"` : ''}>${escape(visible)}</a>`;
  }));
}

export function expandKnowledgeIntroductions(text, knowledge, render) {
  return transformProse(text, prose => prose.replace(INTRODUCTION, (_, id) => {
    const record = knowledge.get(id);
    if (!record) throw new Error('Unresolved knowledge introduction ' + id);
    const html = render(expandKnowledgeReferences(record.body, knowledge))
      .replace(/<(\/?)h[1-6](\b[^>]*)>/g, '<$1h4$2>')
      .replace(/\bid=(["'])([^"']+)\1/g, (_, quote, anchor) => `id=${quote}knowledge-${id}-${anchor}${quote}`)
      .replace(/\bhref=(["'])#([^"']+)\1/g, (match, quote, anchor) => record.anchors.includes(anchor) ? `href=${quote}#knowledge-${id}-${anchor}${quote}` : match);
    return `<aside class="knowledge-introduction" id="knowledge-${id}" data-knowledge-introduction="${id}"><p class="knowledge-title">${escape(record.title)}</p>${html}</aside>\n`;
  }));
}
