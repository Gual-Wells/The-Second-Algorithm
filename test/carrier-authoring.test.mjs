import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('handbook preserves C++ aggregate braces while rejecting unresolved author markers',async()=>{
  const folder=path.join(root,'.local','authoring-tests',randomUUID());
  await fs.mkdir(folder,{recursive:true});
  const code='int sample() { int a[1][1] = {{7}}; return a[0][0]; }';
  await fs.writeFile(path.join(folder,'literal.cpp'),'// BEGIN literal\n'+code+'\n// END literal\n');
  const run=()=>spawnSync(process.execPath,['tools/build_handbook.mjs',folder,'literal'],
    {cwd:root,encoding:'utf8',windowsHide:true});
  await fs.writeFile(path.join(folder,'literal.source.md'),'# Aggregate\n\n{{literal}}\n');
  let result=run();
  assert.equal(result.status,0,result.stderr);
  assert.ok((await fs.readFile(path.join(folder,'literal.md'),'utf8')).includes(code));
  await fs.writeFile(path.join(folder,'literal.source.md'),'# Bad marker\n\n{{unfinished\n');
  result=run();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unresolved marker/);
});
