import { marked } from 'marked';
import path from 'node:path';

// This is a narrow publication boundary, not a classifier for teaching quality.
// Normal algorithm contracts, C++ engineering notes and testing methods remain
// reader content. Production records and the project's editorial vocabulary do not.
const INTERNAL = [
  ['production record', /(?:本机|本次)[^\n。]{0,50}(?:验证记录|审阅记录)|(?:另有|另见)[^\n。]{0,16}(?:验证|审阅)记录/u],
  ['editorial self-report', /(?:没有冒充|不冒称|不虚构(?:划分算法|库版|一键)|不是第二套伪造|不能为了印两份|正文(?:两个|[一二三\d]+个)代码块)/u],
  ['production field', /\b(?:researchTypeIds|authoringDependencies|semanticCompletenessCertified|lastGoodVerification|chapter-contract\.json|chapter-review\.json)\b/u],
  ['private production path', /(?:\bwork\/jobs\/|(?:^|[\s"'(<])(?:\.local\/|protocol\/[\w/-]+\.md)|\b(?:AGENTS|SKILL)\.md\b|\bcontent\/[\w/-]+\.source\.md\b)/u],
  ['repository production reference', /(?:github\.com\/Gual-Wells\/The-Second-Algorithm\/(?:blob|tree)\/[^/]+|raw\.githubusercontent\.com\/Gual-Wells\/The-Second-Algorithm\/[^/]+)\/(?:work|research|protocol|catalog|carrier|tests|\.local)\//iu],
];
const ENTITY = /&(?:#(x[0-9a-f]+|[0-9]+)|(amp|lt|gt|quot|apos|colon|sol|bsol|period|lowbar));/giu;

function decoded(value) {
  let text = String(value);
  for (let i = 0; i < 3; i++) {
    const next = text.replace(ENTITY, (all, number, name) => {
      if (number) {
        const n = Number.parseInt(number.replace(/^x/i, ''), /^x/i.test(number) ? 16 : 10);
        return n <= 0x10ffff ? String.fromCodePoint(n) : all;
      }
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', sol: '/', bsol: '\\', period: '.', lowbar: '_' })[name.toLowerCase()];
    });
    let unescaped = next;
    try { unescaped = decodeURIComponent(next); } catch { /* Invalid percent text is not an escape hatch. */ }
    if (unescaped === text) break;
    text = unescaped;
  }
  return text;
}

function inspect(text, label) {
  for (const [kind, pattern] of INTERNAL) if (pattern.test(decoded(text)))
    throw new Error(`${label}: reader boundary rejected ${kind}`);
}

export function assertReaderReference(href, label = 'reader link') {
  const value = decoded(href).trim();
  inspect(value, label);
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
    if (/^(?:file:|[a-z]:[\\/])/i.test(value)) throw new Error(`${label}: reader boundary rejected machine path`);
    return; // External papers may legitimately contain /research/ or /work/.
  }
  const filename = value.split(/[?#]/, 1)[0];
  if (!filename) return;
  const target = path.posix.normalize(filename.replaceAll('\\', '/')).replace(/^(?:\.\.\/)+/, '').replace(/^\//, '');
  if (/^(?:work|research|protocol|catalog|carrier|tests|tools|scripts|second_algorithm|\.github|\.local)(?:\/|$)/.test(target)
      || /(?:^|\/)(?:AGENTS|SKILL)\.md$|\.source\.md$|\.authoring\.json$|chapter-(?:contract|review)\.json$/.test(target))
    throw new Error(`${label}: reader boundary rejected internal production reference`);
}

export function visibleHtmlText(html) {
  return decoded(String(html).replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ''));
}

export function assertReaderText(text, label = 'reader text', { allowKnowledgeIds = false } = {}) {
  inspect(text, label);
  if (!allowKnowledgeIds && /\bQ[0-9]{6,}\b/u.test(decoded(text)))
    throw new Error(`${label}: reader boundary rejected visible knowledge identity`);
}

export function assertReaderHtml(html, label = 'reader HTML', options) {
  // Inspect raw delivery too: a private link/comment must not travel with the
  // asset merely because it is absent from its visible text.
  inspect(html, label);
  if (/<!--[\s\S]*?(?:-->|$)/.test(html))
    throw new Error(`${label}: reader boundary rejected hidden author comment`);
  assertReaderText(visibleHtmlText(html), label, options);
  for (const match of String(html).matchAll(/\b(?:href|src)\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/gis))
    assertReaderReference(match[2] ?? match[3], label + ' reference');
  for (const match of String(html).matchAll(/\b(?:title|aria-label|alt)\s*=\s*(["'])(.*?)\1/gis))
    assertReaderText(match[2], label + ' accessible label', options);
}

export function assertReaderMarkdown(markdown, label = 'reader Markdown', options) {
  inspect(markdown, label);
  // C++ aggregate initializers can contain '{{'. Only unresolved prose markers
  // are an error; examples remain byte-for-byte code.
  marked.walkTokens(marked.lexer(markdown), token => {
    if (token.type === 'link' || token.type === 'image') assertReaderReference(token.href, label + ' reference');
    if (token.type === 'code' || token.type === 'codespan') return;
    if (token.type === 'text' && !token.tokens
        && /\{\{(?:(?:knowledge|code|code-block):)?[a-z][\w-]*\}\}/i.test(token.text ?? ''))
      throw new Error(`${label}: reader boundary rejected unresolved author marker`);
    if (token.type === 'html' && /^\s*<!--/.test(token.raw ?? token.text))
      throw new Error(`${label}: reader boundary rejected hidden author comment`);
  });
  assertReaderHtml(marked.parse(markdown), label, options);
}

// All displayed source operations remain real C++; only exact whole-line
// editorial region delimiters disappear. Whitespace and every other byte stay.
export function readerSourceView(source, regions) {
  const allowed = regions ? new Set(regions) : null, seen = new Set();
  let open = null;
  const result = String(source).replace(/^\/\/ (BEGIN|END) ([a-z][\w-]*)[ \t]*(?:\r\n|\r|\n|$)/gm,
    (_, action, id) => {
      if (allowed && !allowed.has(id)) throw new Error('Reader source contains an unregistered editorial region');
      if (action === 'BEGIN') {
        if (open || seen.has(id)) throw new Error('Reader source has nested or duplicate editorial regions');
        open = id; seen.add(id);
      } else {
        if (open !== id) throw new Error('Reader source has unpaired editorial regions');
        open = null;
      }
      return '';
    });
  if (open || allowed && (seen.size !== allowed.size || [...allowed].some(id => !seen.has(id))))
    throw new Error('Reader source has missing or unpaired editorial regions');
  return result;
}

export function assertReaderSource(source, label = 'reader C++') {
  assertReaderText(source, label);
  if (/^\s*\/\/ (?:BEGIN|END) [\w-]+\s*$/m.test(source))
    throw new Error(`${label}: reader boundary rejected editorial region marker`);
}

// The chapter contract/fragment scanner accepts explicit ATX headings. Check
// using the actual Markdown parser so Setext (including nested forms) cannot
// introduce a second main structure that the contract never saw.
export function assertMainHeadings(markdown, label = 'reader Markdown') {
  let h1 = 0;
  const tokens = marked.lexer(markdown), top = new Set(tokens);
  marked.walkTokens(tokens, token => {
    if (token.type !== 'heading' || token.depth > 2) return;
    if (!top.has(token)) throw new Error(`${label}: main headings must be top-level`);
    const raw = token.raw.replace(/\r\n?/g, '\n');
    if (!/^ {0,3}#{1,2}(?:[ \t]+|$)/.test(raw))
      throw new Error(`${label}: main headings require explicit ATX syntax`);
    if (token.depth === 1 && ++h1 > 1)
      throw new Error(`${label}: exactly one chapter H1 is allowed`);
  });
  if (h1 !== 1) throw new Error(`${label}: exactly one chapter H1 is required`);
}

export function assertRenderedMainHeadings(html, headings, label = 'reader HTML') {
  const actual = [...String(html).matchAll(/<h([12])(?:\s[^>]*)?>/gi)].map(match => Number(match[1]));
  const expected = headings.filter(heading => heading.depth <= 2).map(heading => heading.depth);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${label}: rendered main headings differ from the declared Markdown structure`);
}
