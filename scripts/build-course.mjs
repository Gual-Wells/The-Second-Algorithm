import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePublications, validateLearning } from './build-carrier.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publications = JSON.parse(readFileSync(path.join(root, 'carrier/publications.json'), 'utf8'));
validatePublications(publications);
validateLearning(JSON.parse(readFileSync(path.join(root, 'catalog/learning.json'), 'utf8')), publications);
let count = 0;
for (const collection of publications.collections) {
  if (collection.visibility === 'hidden') continue;
  for (const document of collection.documents) {
    const result = spawnSync(process.execPath,
      ['tools/build_handbook.mjs', path.dirname(document.path), path.basename(document.path)],
      { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw Error('Content build failed: ' + document.id);
    count++;
  }
}
if (!count && publications.state !== 'withdrawn') throw Error('No published course documents');
console.log(publications.state === 'withdrawn'
  ? 'Validated explicit withdrawal: no published documents; no content built.' : 'Built current course documents: ' + count);
