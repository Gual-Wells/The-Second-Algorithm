import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publications = JSON.parse(readFileSync(path.join(root, 'carrier/publications.json'), 'utf8'));
if (publications.schemaVersion !== 2) throw Error('Expected unified publication schema 2');
let count = 0;
for (const collection of publications.collections) {
  if (collection.visibility !== 'published') continue;
  for (const document of collection.documents) {
    const result = spawnSync(process.execPath,
      ['tools/build_handbook.mjs', path.dirname(document.path), path.basename(document.path)],
      { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw Error('Content build failed: ' + document.id);
    count++;
  }
}
if (!count) throw Error('No published course documents');
console.log('Built current course documents: ' + count);
