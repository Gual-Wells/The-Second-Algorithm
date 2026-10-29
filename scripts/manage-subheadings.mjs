import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSubheadingCandidates } from '../tools/subheadings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, composition, output] = process.argv.slice(2);
if (command === 'snapshot' && composition && output) {
  console.log(JSON.stringify(await captureSubheadingCandidates(root, composition, output), null, 2));
} else if (command === 'check' && composition && !output) {
  const publications = JSON.parse(await fs.readFile(path.join(root, 'carrier/publications.json'), 'utf8'));
  const descriptor = publications.collections.flatMap(row => row.documents)
    .find(document => document.composition === composition || document.id === composition);
  if (!descriptor?.composition) throw new Error('Unknown composed chapter');
  const { composeDocument } = await import('../tools/compose-chapter.mjs');
  const result = await composeDocument(root, descriptor);
  if (!result.subheadings) throw new Error('Chapter has no coordinated subheading plan');
  console.log(JSON.stringify({ document: descriptor.id, valid: true, headings: result.subheadings.headings.length,
    registryEntries: result.subheadings.registryEntries, automaticSemanticCertification: false }, null, 2));
} else throw new Error('Usage: snapshot <composition> <new-work-output.json> | check <composition>');
