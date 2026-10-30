import fs from 'node:fs/promises';
import path from 'node:path';
import { assertReaderText } from '../../tools/reader-boundary.mjs';

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Classification is editorial evidence. This module only checks its structural
// boundaries and projects the stable whole-section identities to the reader.
export function validateExtensionDefinitions(contract, label = 'chapter') {
  const reading = contract?.reading;
  if (reading?.extensions === undefined) return [];
  if (contract.schemaVersion !== 3 || !Array.isArray(reading.extensions))
    throw Error(label + ': extensions require a schemaVersion 3 object array');
  if (!Array.isArray(reading.units)) throw Error(label + ': extensions require formal reading units');
  const units = new Map();
  for (const unit of reading.units) {
    if (!unit || typeof unit.id !== 'string' || !ID.test(unit.id) || units.has(unit.id)) throw Error(label + ': invalid/duplicate formal section identity');
    units.set(unit.id, unit);
  }
  const seen = new Set();
  return reading.extensions.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || typeof row.sectionId !== 'string' || !units.has(row.sectionId))
      throw Error(label + ': extension must identify a formal section, never PRE or a subheading');
    if (seen.has(row.sectionId)) throw Error(label + ': duplicate extension section');
    seen.add(row.sectionId);
    if (!Array.isArray(row.tags) || !row.tags.length
      || row.tags.some(tag => typeof tag !== 'string' || !tag.trim() || /[\u0000-\u001f\u007f<>]/u.test(tag)))
      throw Error(label + ': extension requires nonempty plain-text algorithm tags');
    const tags = row.tags.map(tag => tag.trim());
    if (new Set(tags).size !== tags.length) throw Error(label + ': duplicate extension tag');
    for (const tag of tags) assertReaderText(tag, label + ' extension tag');
    if (typeof row.reason !== 'string' || !row.reason.trim()) throw Error(label + ': extension requires an internal classification reason');
    const unit = units.get(row.sectionId);
    if (!Array.isArray(unit.locations) || unit.locations.length !== 1)
      throw Error(label + ': extension must own exactly one complete H2 section');
    const location = unit.locations[0];
    if (!location || typeof location.document !== 'string' || !ID.test(location.document)
      || typeof location.anchor !== 'string' || !ID.test(location.anchor))
      throw Error(label + ': extension requires a stable section location');
    return { sectionId: row.sectionId, tags, location };
  });
}

export async function readExtensionContracts(root, publications) {
  let index;
  try { index = JSON.parse(await fs.readFile(path.join(root, 'catalog/chapters.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  if (index?.schemaVersion !== 1 || !Array.isArray(index.chapters)) throw Error('Invalid chapter index for extension metadata');
  const collections = new Map(publications.collections.map(row => [row.id, row]));
  const result = new Map(), ids = new Set();
  for (const row of index.chapters) {
    if (!row || typeof row.id !== 'string' || !ID.test(row.id) || ids.has(row.id) || result.has(row.collection) || !collections.has(row.collection))
      throw Error('Invalid/duplicate chapter mapping for extension metadata');
    ids.add(row.id);
    if (typeof row.contract !== 'string' || !/^content\/[^/]+\/[^/]+\.json$/.test(row.contract)
      || row.contract.includes('\\') || row.contract.split('/').some(part => part === '.' || part === '..'))
      throw Error('Invalid chapter contract path for extension metadata');
    const filename = path.resolve(root, row.contract), content = await fs.realpath(path.resolve(root, 'content'));
    const relative = path.relative(content, await fs.realpath(filename));
    if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative))
      throw Error('Extension contract escapes content authority');
    const contract = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (contract.chapter !== row.id) throw Error('Extension contract chapter identity mismatch');
    const definitions = validateExtensionDefinitions(contract, row.id);
    const permitted = new Set(collections.get(row.collection).documents.map(document => document.id));
    if (definitions.some(definition => !permitted.has(definition.location.document)))
      throw Error(row.id + ': extension location must belong to its published chapter');
    result.set(row.collection, definitions);
  }
  return result;
}

export function projectExtensions(definitions, document, rendered) {
  const projected = [], used = new Set();
  for (const definition of definitions || []) {
    if (definition.location.document !== document) continue;
    const anchor = definition.location.anchor;
    // The author fragment id is deliberately stable across title/ordinal
    // changes. The rendered H2 has its own semantic slug; keep both distinct.
    const match = rendered.html.match(new RegExp('<a id="' + escaped(anchor)
      + '"></a>\\s*(?:<a id="[^"<>]+"></a>\\s*)*<h2 id="([^"<>]+)">'));
    const heading = match && rendered.headings.find(row => row.id === match[1] && row.depth === 2);
    if (!heading || heading.text.startsWith('PRE、'))
      throw Error(document + ': extension location must immediately identify a formal H2: ' + anchor);
    if (used.has(heading.id)) throw Error(document + ': several extensions cannot alias the same H2');
    used.add(heading.id);
    projected.push({ sectionId: anchor, tags: [...definition.tags] });
  }
  return projected;
}
