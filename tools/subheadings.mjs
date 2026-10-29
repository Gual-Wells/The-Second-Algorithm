import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { marked } from 'marked';

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const identity = value => typeof value === 'string' && ID.test(value);
const SHA = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const nonempty = value => typeof value === 'string' && !!value.trim();
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const sortedObject = value => Array.isArray(value) ? value.map(sortedObject)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedObject(value[key])])) : value;
export const entryFingerprint = entry => hash(Buffer.from(JSON.stringify(sortedObject(entry)), 'utf8'));

// Reader ordinals belong to the real heading depth, never its managed role.
// Keep these helpers pure so previews can project an existing canonical outline
// with exactly the same labels as the authoring pipeline.
function alphabetOrdinal(value) {
  let result = '';
  while (value) {
    value--;
    result = String.fromCharCode(97 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function formatSubheadingTitle({ depth, ordinal, prefix, subject }) {
  if (![3, 4].includes(depth) || !Number.isSafeInteger(ordinal) || ordinal < 1
    || !nonempty(prefix) || /[、：:\r\n<>（）]/u.test(prefix) || !nonempty(subject))
    throw new Error('Invalid managed subheading title fields');
  return '（' + (depth === 3 ? ordinal : alphabetOrdinal(ordinal)) + '）' + prefix + '：' + subject;
}

export function semanticSubheadingTitle(title, depth) {
  const pattern = depth === 3 ? /^（[1-9][0-9]*）/u : depth === 4 ? /^（[a-z]+）/u : null;
  return pattern ? String(title).replace(pattern, '') : String(title);
}

export function formatSubheadingLabels(headings) {
  let section = false, parent = false, ordinal3 = 0, ordinal4 = 0;
  return headings.map(heading => {
    if (heading.depth <= 2) {
      section = heading.depth === 2; parent = false; ordinal3 = ordinal4 = 0;
      return { ...heading };
    }
    if (![3, 4].includes(heading.depth)) return { ...heading };
    if (!section) throw new Error('A managed subheading requires a preceding H2 section');
    if (heading.depth === 3) { ordinal3++; ordinal4 = 0; parent = true; }
    else if (!parent) throw new Error('An H4 subheading requires a preceding H3 parent in the same formal section');
    else ordinal4++;
    const semantic = semanticSubheadingTitle(heading.text, heading.depth);
    const parts = semantic.match(/^([^、：]+)[、：]([\s\S]+)$/u);
    if (!parts) throw new Error('A managed subheading requires its canonical type and subject');
    return { ...heading, text: formatSubheadingTitle({ depth: heading.depth,
      ordinal: heading.depth === 3 ? ordinal3 : ordinal4, prefix: parts[1], subject: parts[2] }) };
  });
}

function relativePath(relative, prefix, suffix = '.json') {
  if (typeof relative !== 'string' || !relative.startsWith(prefix) || !relative.endsWith(suffix)
    || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..'
      || /[<>:"|?*\u0000-\u001f]/.test(part) || /[. ]$/.test(part)))
    throw new Error('Invalid subheading authority path');
  return relative;
}

async function readFile(root, relative, prefix, suffix = '.json') {
  relativePath(relative, prefix, suffix);
  const filename = await fs.realpath(path.resolve(root, relative));
  if (!inside(await fs.realpath(root), filename) || !inside(await fs.realpath(path.join(root, prefix)), filename))
    throw new Error('Subheading authority escapes its directory');
  return fs.readFile(filename);
}

export function validateSubheadingRegistry(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.entries)) throw new Error('Invalid subheading registry');
  const result = new Map(), prefixes = new Set();
  for (const entry of value.entries) {
    if (!entry || !identity(entry.id) || result.has(entry.id) || !nonempty(entry.prefix)
      || /[、：:\r\n<>（）]/u.test(entry.prefix) || prefixes.has(entry.prefix)
      || !nonempty(entry.purpose) || !nonempty(entry.boundary)
      || !Array.isArray(entry.levels) || !entry.levels.length || new Set(entry.levels).size !== entry.levels.length
      || entry.levels.some(depth => ![3, 4].includes(depth))
      || !['aliases', 'examples'].every(field => Array.isArray(entry[field]) && entry[field].every(nonempty)
        && new Set(entry[field]).size === entry[field].length)) throw new Error('Invalid/duplicate subheading registry entry');
    if ((entry.id === 'hcode' || entry.prefix === 'Hcode') && (entry.id !== 'hcode' || entry.prefix !== 'Hcode')
      || (entry.id === 'scode' || entry.prefix === 'Scode') && (entry.id !== 'scode' || entry.prefix !== 'Scode'))
      throw new Error('Hcode and Scode have fixed registry identities and prefixes');
    result.set(entry.id, entry); prefixes.add(entry.prefix);
  }
  if (!result.has('hcode') || !result.has('scode')) throw new Error('Subheading registry requires Hcode and Scode');
  return result;
}

// The scanner collects independent author wording. It never imports or reads
// the registry, and a timestamp is not a claim that an Agent did research.
export function scanAuthorSubheadings(text, source) {
  // marked normalizes CR/CRLF before tokenization. Keep an explicit map back
  // to original UTF-16 offsets so candidate capture and projection never
  // rewrite an author's line endings or unrelated bytes.
  let normalized = '';
  const offsets = [];
  for (let i = 0; i < text.length; i++) {
    offsets.push(i);
    if (text[i] === '\r') { normalized += '\n'; if (text[i + 1] === '\n') i++; }
    else normalized += text[i];
  }
  offsets.push(text.length);
  const tokens = marked.lexer(normalized), top = new Set(tokens), headings = [], markers = [], sections = [];
  let cursor = 0, pending = '', owner = '';
  marked.walkTokens(tokens, token => {
    if (token.type === 'heading' && token.depth > 4)
      throw new Error(source + ': chapter subheadings support only H3 and H4');
    if (token.type === 'html' && /<\/?h[3-6]\b/i.test(String(token.text ?? token.raw).replace(/<!--[\s\S]*?(?:-->|$)/g, '')))
      throw new Error(source + ': author subheadings require managed Markdown, not raw HTML');
    if (token.type === 'heading' && [3, 4].includes(token.depth) && !top.has(token))
      throw new Error(source + ': subheadings must be explicit top-level Markdown headings');
  });
  for (const token of tokens) {
    const start = normalized.indexOf(token.raw, cursor);
    if (start < 0) throw new Error('Cannot locate original subheading token');
    cursor = start + token.raw.length;
    if (token.type === 'space') continue;
    const lines = token.raw.trim().split(/\r\n|\r|\n/);
    const anchors = lines.map(line => line.match(/^ {0,3}<a id="([a-z][a-z0-9-]*)"><\/a>[ \t]*$/));
    if (anchors.length && anchors.every(Boolean)) { pending = anchors.at(-1)[1]; continue; }
    if (token.type === 'heading') {
      if (token.depth === 2) { owner = pending; sections.push({ id: owner, start: offsets[start] }); }
      if ([3, 4].includes(token.depth)) {
        const line = token.raw.match(/^( {0,3})(#{3,4})[ \t]+([^\r\n]+)(\r?\n|\r|\n|$)/);
        if (!line || !pending || !owner) throw new Error(source + ': every H3/H4 needs a standalone stable anchor inside an H2');
        const originalStart = offsets[start], originalEnd = offsets[start + line[0].length];
        const ending = text.slice(originalStart, originalEnd).match(/(\r\n|\r|\n)$/)?.[1] ?? '';
        headings.push({ id: pending, source, owner, depth: token.depth, text: token.text,
          start: originalStart, end: originalEnd, indent: line[1], ending });
      }
    }
    if (token.type !== 'code' && token.type !== 'html') {
      for (const match of token.raw.matchAll(/^ {0,3}\{\{(?:(?:code|code-block):)?([a-z][\w-]*)\}\}[ \t]*$/gm))
        markers.push({ region: match[1], source, owner, start: offsets[start + match.index] });
    }
    pending = '';
  }
  return { headings, markers, sections };
}

const candidateHeading = ({ id, source, owner, depth, text }) => ({ id, source, owner, depth, text });

export async function captureSubheadingCandidates(root, compositionPath, outputPath) {
  root = path.resolve(root);
  const publications = JSON.parse(await fs.readFile(path.join(root, 'carrier/publications.json'), 'utf8'));
  const descriptor = publications.collections.flatMap(row => row.documents)
    .find(document => document.composition === compositionPath || document.id === compositionPath);
  if (!descriptor?.composition) throw new Error('Unknown composed chapter for independent subheading candidates');
  const compositionBytes = await readFile(root, descriptor.composition, 'content/', '.authoring.json');
  const composition = JSON.parse(compositionBytes);
  if (!Array.isArray(composition.sourceFiles) || !composition.sourceFiles.length) throw new Error('Composition needs sourceFiles');
  const sourceInputs = { [descriptor.composition]: hash(compositionBytes) }, headings = [], ids = new Set();
  for (const source of composition.sourceFiles) {
    const bytes = await readFile(root, source, 'content/', '.source.md');
    sourceInputs[source] = hash(bytes);
    for (const heading of scanAuthorSubheadings(bytes.toString('utf8'), source).headings) {
      if (ids.has(heading.id)) throw new Error('Duplicate chapter subheading identity: ' + heading.id);
      ids.add(heading.id); headings.push(candidateHeading(heading));
    }
  }
  const record = { schemaVersion: 1, id: randomUUID(), document: descriptor.id, composition: descriptor.composition,
    createdAt: new Date().toISOString(), sourceInputs, headings,
    registryRead: false, automaticSemanticCertification: false };
  relativePath(outputPath, 'work/');
  const filename = path.resolve(root, outputPath);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const workRoot = await fs.realpath(path.join(root, 'work')), outputParent = await fs.realpath(path.dirname(filename));
  if (outputParent !== workRoot && !inside(workRoot, outputParent))
    throw new Error('Candidate output escapes work/');
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + '\n');
  const file = await fs.open(filename, 'wx');
  try { await file.writeFile(bytes); } finally { await file.close(); }
  return { path: outputPath, sha256: hash(bytes), document: descriptor.id, headings: headings.length,
    registryRead: false, automaticSemanticCertification: false };
}

export async function applySubheadingPlan(root, descriptor, composition, sourceTexts, codeTexts) {
  if (composition.subheadings === undefined) {
    if ([...sourceTexts].some(([source, text]) => scanAuthorSubheadings(text, source).headings.length))
      throw new Error('Author H3/H4 requires a chapter subheading coordination plan');
    return null; // Tiny historical fixtures without subheadings remain readable.
  }
  const dependencies = {};
  const read = async (relative, prefix, suffix = '.json') => {
    const bytes = await readFile(root, relative, prefix, suffix); dependencies[relative] = hash(bytes); return bytes;
  };
  const plan = JSON.parse(await read(composition.subheadings, 'content/', '.subheadings.json'));
  if (plan?.schemaVersion !== 1 || plan.document !== descriptor.id || !Array.isArray(plan.decisions)
    || !plan.candidateSnapshot || !SHA.test(plan.candidateSnapshot.sha256)
    || !plan.registryEntries || typeof plan.registryEntries !== 'object' || Array.isArray(plan.registryEntries))
    throw new Error('Invalid chapter subheading coordination plan');
  const snapshotBytes = await read(plan.candidateSnapshot.path, 'work/');
  if (hash(snapshotBytes) !== plan.candidateSnapshot.sha256) throw new Error('Independent subheading candidate snapshot changed');
  const snapshot = JSON.parse(snapshotBytes);
  if (snapshot.schemaVersion !== 1 || snapshot.document !== descriptor.id || snapshot.composition !== descriptor.composition
    || snapshot.registryRead !== false || !Array.isArray(snapshot.headings)
    || !snapshot.sourceInputs || typeof snapshot.sourceInputs !== 'object' || Array.isArray(snapshot.sourceInputs)
    || JSON.stringify(Object.keys(snapshot.sourceInputs).sort()) !== JSON.stringify([descriptor.composition,...composition.sourceFiles].sort())
    || Object.values(snapshot.sourceInputs).some(value => !SHA.test(value))) throw new Error('Invalid independent subheading candidates');
  const candidates = new Map();
  for (const heading of snapshot.headings) {
    if (!identity(heading?.id) || candidates.has(heading.id)) throw new Error('Invalid/duplicate independent subheading candidate');
    candidates.set(heading.id, heading);
  }
  const scans = new Map(), current = [], ids = new Set();
  for (const [source, text] of sourceTexts) {
    const scan = scanAuthorSubheadings(text, source); scans.set(source, scan);
    for (const heading of scan.headings) {
      if (ids.has(heading.id)) throw new Error('Duplicate chapter subheading identity: ' + heading.id);
      ids.add(heading.id); current.push(heading);
      if (JSON.stringify(sortedObject(candidateHeading(heading))) !== JSON.stringify(sortedObject(candidates.get(heading.id))))
        throw new Error('Independent candidate headings differ from current author headings: ' + heading.id);
    }
  }
  if (current.length !== candidates.size) throw new Error('Independent candidates must cover current author subheadings exactly');
  const registry = validateSubheadingRegistry(JSON.parse(await readFile(root, 'catalog/subheadings.json', 'catalog/')));
  const selected = new Map(), used = new Set();
  for (const decision of plan.decisions) {
    const entry = registry.get(decision?.typeId);
    if (!decision || !ids.has(decision.id) || selected.has(decision.id) || !entry
      || !nonempty(decision.subject) || /[\r\n<>]/.test(decision.subject.replace(/(`+)[^\n]*?\1/g, ''))
      || ['、', '：', ':'].some(separator => decision.subject.startsWith(entry.prefix + separator))
      || /^（(?:[1-9][0-9]*|[a-z]+)）/u.test(decision.subject) || !entry.levels.includes(decision.depth)
      || !['reuse', 'new'].includes(decision.action) || !nonempty(decision.reason)
      || !Array.isArray(decision.implementationIds) || new Set(decision.implementationIds).size !== decision.implementationIds.length
      || decision.implementationIds.some(id => !identity(id))
      || decision.reuses !== undefined && (!Array.isArray(decision.reuses) || new Set(decision.reuses).size !== decision.reuses.length
        || decision.reuses.some(id => !identity(id)))) throw new Error('Invalid/duplicate subheading decision');
    if (plan.registryEntries[entry.id] !== entryFingerprint(entry)) throw new Error('Used subheading registry entry changed: ' + entry.id);
    selected.set(decision.id, { ...decision, title: entry.prefix + '、' + decision.subject }); used.add(entry.id);
  }
  if (selected.size !== ids.size) throw new Error('Every author H3/H4 requires exactly one subheading decision');
  if (Object.keys(plan.registryEntries).length !== used.size || Object.keys(plan.registryEntries).some(id => !used.has(id)))
    throw new Error('Subheading plan must pin only its used registry entries');
  // Scan each physical source independently, with real H2 boundaries and the
  // coordinated depth. Neither decision-list order nor Hcode/Scode determines
  // numbering, and a parent from another source/section cannot leak across.
  for (const scan of scans.values()) {
    const events = [...scan.sections.map(section => ({ ...section, depth: 2, text: '' })),
      ...scan.headings.map(heading => ({ id: heading.id, start: heading.start,
        depth: selected.get(heading.id).depth, text: selected.get(heading.id).title }))]
      .sort((a, b) => a.start - b.start);
    for (const heading of formatSubheadingLabels(events))
      if (heading.depth >= 3) selected.get(heading.id).title = heading.text;
  }
  // Reader-unit boundaries follow the final coordinated depth, not a guessed
  // label or the candidate's original nesting. An H2 always ends the unit.
  const headingBody = heading => {
    const scan = scans.get(heading.source), sourceText = sourceTexts.get(heading.source);
    const depth = selected.get(heading.id).depth;
    const boundaries = scan.headings.filter(other => other.start > heading.start
      && (other.owner !== heading.owner || selected.get(other.id).depth <= depth)).map(other => other.start);
    boundaries.push(...scan.sections.filter(section => section.start > heading.start).map(section => section.start));
    return sourceText.slice(heading.end, Math.min(sourceText.length, ...boundaries));
  };
  // Reference-style links may be defined outside the current learning unit.
  // Resolve definitions in the same fragment order as the final chapter, while
  // counting only actual link uses inside each unit (never definition lines).
  const orderedText = [composition.prelude, ...composition.sections].map(section => {
    const scan = scans.get(section.source), text = sourceTexts.get(section.source);
    const index = scan?.sections.findIndex(item => item.id === section.anchor) ?? -1;
    return index < 0 ? '' : text.slice(scan.sections[index].start, scan.sections[index + 1]?.start ?? text.length);
  }).join('\n');
  const definitions = marked.lexer(orderedText).links;
  const bodyTokens = heading => {
    const lexer = new marked.Lexer();
    lexer.tokens.links = definitions;
    return lexer.lex(headingBody(heading));
  };
  for (const heading of current) {
    const decision = selected.get(heading.id);
    if (decision.typeId === 'practice' && decision.depth !== 3)
      throw new Error('Practice learning units must be independent H3 subheadings');
  }
  for (const section of composition.sections) {
    const scan = scans.get(section.source);
    const practices = scan?.headings.filter(heading => heading.owner === section.anchor
      && selected.get(heading.id).typeId === 'practice') ?? [];
    if (!practices.length)
      throw new Error('Every formal section requires an independent H3 practice learning unit: ' + section.anchor);
    let links = 0;
    for (const heading of practices) {
      marked.walkTokens(bodyTokens(heading), token => {
        if (token.type !== 'link') return;
        try {
          const url = new URL(token.href);
          if (['http:', 'https:'].includes(url.protocol)) links++;
        } catch { /* Local anchors, malformed URLs and code examples are not external exercises. */ }
      });
    }
    if (links < 1 || links > 5)
      throw new Error('Formal section practice units require 1 to 5 actual external exercise links: ' + section.anchor);
  }
  const regionOwners = new Map(), units = new Map();
  for (const [source, scan] of scans) {
    let stack = [], owner = '';
    const events = [...scan.headings.map(heading => ({ ...heading, decision: selected.get(heading.id) })), ...scan.markers]
      .sort((a, b) => a.start - b.start);
    for (const event of events) {
      if (owner !== event.owner) { stack = []; owner = event.owner; }
      if (event.decision) {
        while (stack.length && stack.at(-1).depth >= event.decision.depth) stack.pop();
        if (event.decision.depth === 4 && !stack.some(item => item.depth === 3))
          throw new Error('An H4 subheading requires a preceding H3 parent in the same formal section');
        stack.push({ id: event.id, depth: event.decision.depth, typeId: event.decision.typeId });
        if (['hcode', 'scode'].includes(event.decision.typeId)) units.set(event.id, { ...event.decision, regions: [], heading: event });
      } else {
        const unit = [...stack].reverse().find(item => ['hcode', 'scode'].includes(item.typeId));
        if (!unit) throw new Error('Canonical code region has no Hcode/Scode implementation unit: ' + event.region);
        if (regionOwners.has(event.region)) throw new Error('Canonical code region is displayed more than once: ' + event.region);
        regionOwners.set(event.region, unit.id); units.get(unit.id).regions.push(event.region);
      }
    }
  }
  const regionBodies = new Map();
  for (const text of codeTexts.values()) for (const match of text.matchAll(/\/\/ BEGIN ([\w-]+)\r?\n([\s\S]*?)\/\/ END \1/g)) {
    if (regionBodies.has(match[1])) throw new Error('Duplicate canonical region in subheading sources');
    regionBodies.set(match[1], match[2]);
  }
  if (regionOwners.size !== regionBodies.size || [...regionOwners.keys()].some(region => !regionBodies.has(region)))
    throw new Error('Subheading implementation units must cover actual canonical code regions');
  const learning = JSON.parse(await fs.readFile(path.join(root, 'catalog/learning.json'), 'utf8'));
  const implementations = new Map(learning.tasks.filter(task => task.document === descriptor.id)
    .flatMap(task => task.methods.flatMap(method => method.implementations)).map(item => [item.id, item]));
  const attached = new Set();
  for (const decision of selected.values()) {
    const unit = units.get(decision.id);
    if (!unit && (decision.implementationIds.length || decision.reuses?.length)) throw new Error('Only Hcode/Scode units may carry implementation identities or shared-code references');
    if (unit && !unit.regions.length && !(decision.reuses?.length))
      throw new Error('Hcode/Scode unit requires actual canonical code or explicit shared implementation references');
    for (const iid of decision.implementationIds) {
      const implementation = implementations.get(iid);
      if (!implementation || attached.has(iid)) throw new Error('Unknown/duplicate subheading implementation identity: ' + iid);
      if (implementation.kind === 'manual' && decision.typeId !== 'hcode'
        || implementation.kind === 'standard' && decision.typeId !== 'scode') throw new Error('Implementation heading has the wrong Hcode/Scode direction: ' + iid);
      const symbol = implementation.symbol.split('::').at(-1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const symbolPattern = new RegExp('\\b' + symbol + '\\s*(?:\\(|[<:{])');
      if (!implementation.regions.some(region => regionOwners.get(region) === decision.id && symbolPattern.test(regionBodies.get(region) ?? '')))
        throw new Error('Implementation heading does not contain its actual symbol region: ' + iid);
      attached.add(iid);
    }
  }
  if (attached.size !== implementations.size) throw new Error('Every registered implementation requires one actual Hcode/Scode unit');
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Shared implementation references contain a cycle');
    if (visited.has(id)) return;
    const unit = units.get(id);
    if (!unit) throw new Error('Shared implementation target is not an Hcode/Scode unit');
    visiting.add(id);
    for (const target of unit.reuses ?? []) {
      let linked = false;
      marked.walkTokens(bodyTokens(unit.heading), token => {
        if (token.type === 'link' && token.href === '#' + target) linked = true;
      });
      if (!linked) throw new Error('Shared implementation must have an actual reader link to its target');
      visit(target);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of units.keys()) visit(id);
  const sources = new Map();
  for (const [source, text] of sourceTexts) {
    let result = text;
    for (const heading of [...scans.get(source).headings].reverse()) {
      const decision = selected.get(heading.id);
      result = result.slice(0, heading.start) + heading.indent + '#'.repeat(decision.depth) + ' ' + decision.title
        + heading.ending + result.slice(heading.end);
    }
    sources.set(source, result);
  }
  const helper = 'tools/subheadings.mjs';
  dependencies[helper] = hash(await readFile(root, helper, 'tools/', '.mjs'));
  return { sources, dependencies, registryEntries: plan.registryEntries,
    headings: current.map(heading => ({ ...candidateHeading(heading), ...selected.get(heading.id),
      regions: units.get(heading.id)?.regions ?? [] })) };
}
