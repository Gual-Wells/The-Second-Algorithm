import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {createPublicationArchive,readPublicationArchive,storePublicationArchive,restorePublicationArchive} from '../scripts/archive-publication.mjs';
import {privateRoot} from '../scripts/lib/service-local.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixtureFiles(){const objects=new Map(),uploads=[];return{objects,uploads,
 putContent:async bytes=>{const digest=sha(bytes);uploads.push(bytes.length);objects.set(digest,Buffer.from(bytes));return{digest,bytes:bytes.length,location:{provider:'huggingface-s3',namespace:'Gual-Wells',bucket:'second-algorithm-assets',key:`objects/${digest.slice(0,2)}/${digest}.bin`}};},
 getContent:async digest=>{const bytes=objects.get(digest);return bytes?{bytes:bytes.length,arrayBuffer:async()=>bytes}:null;}
};}
test('immutable Git archive streams through a D file, excludes untracked/private material and verifies gzip roundtrip',async()=>{
 await mkdir(privateRoot,{recursive:true});const directory=await mkdtemp(path.join(privateRoot,'archive-test-')),repository=path.join(directory,'repo');await mkdir(repository);
 const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',windowsHide:true});
 try{git(['init','--quiet']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);await writeFile(path.join(repository,'chapter.md'),'Synthetic already-committed chapter\n');git(['add','chapter.md']);git(['commit','--quiet','-m','fixture']);const revision=git(['rev-parse','HEAD']).trim();await writeFile(path.join(repository,'private.env'),'Must not be included\n');const built=await createPublicationArchive(repository,revision,path.join(directory,'output')),bytes=await readFile(built.filename),tar=gunzipSync(bytes);assert.equal(sha(tar),built.tarDigest);assert.equal(tar.length,built.tarBytes);assert(tar.includes(Buffer.from('chapter.md')));assert(!tar.includes(Buffer.from('private.env')));assert(!tar.includes(Buffer.from('Must not be included')));
  const files=fixtureFiles(),receipt=await storePublicationArchive(files,built,revision);assert.equal(receipt.schemaVersion,2);assert.equal(receipt.parts,undefined);assert.deepEqual(await readPublicationArchive(receipt,{files}),bytes);
  const restored=await restorePublicationArchive(receipt,path.join(directory,'restored-v2.tar.gz'),{files});assert.equal(restored.revision,revision);assert.equal(restored.tarDigest,built.tarDigest);
  const legacy={revision,sha256:sha(bytes),bytes:bytes.length,itemId:'legacy-original'},owner={downloadItem:async()=>new Response(bytes)};
  assert.equal((await restorePublicationArchive(legacy,path.join(directory,'restored-legacy.tar.gz'),{owner})).revision,revision);
  const destination=path.join(directory,'protected-existing.tar.gz');await writeFile(destination,'original');await assert.rejects(()=>restorePublicationArchive(receipt,destination,{files}),{code:'EEXIST'});assert.equal(await readFile(destination,'utf8'),'original');
 }
 finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(privateRoot));await rm(directory,{recursive:true,force:true});}
});

test('a real Git archive beyond 24MiB uses fixed 16MiB parts and restores whole SHA, tar and commit without a whole-file read',async()=>{
 await mkdir(privateRoot,{recursive:true});const directory=await mkdtemp(path.join(privateRoot,'archive-test-')),repository=path.join(directory,'repo');await mkdir(repository);
 const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',windowsHide:true});
 try{
  git(['init','--quiet']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);await writeFile(path.join(repository,'non-sensitive-random-fixture.bin'),randomBytes(25*1024*1024));git(['add','.']);git(['commit','--quiet','-m','Synthetic multipart archive fixture']);const revision=git(['rev-parse','HEAD']).trim();
  const built=await createPublicationArchive(repository,revision,path.join(directory,'output'));assert(built.bytes>24*1024*1024);
  const files=fixtureFiles(),receipt=await storePublicationArchive(files,built,revision);assert.equal(receipt.schemaVersion,3);assert.equal(receipt.parts.length,2);assert.equal(receipt.partBytes,16*1024*1024);assert.deepEqual(files.uploads,[16*1024*1024,built.bytes-16*1024*1024]);assert.equal(receipt.parts[1].offset,16*1024*1024);assert.equal(receipt.digest,built.digest);
  const restored=await restorePublicationArchive(receipt,path.join(directory,'restored-v3.tar.gz'),{files});assert.equal(restored.digest,built.digest);assert.equal(restored.bytes,built.bytes);assert.equal(restored.tarDigest,built.tarDigest);assert.equal(restored.tarBytes,built.tarBytes);assert.equal(restored.revision,revision);
  await assert.rejects(()=>readPublicationArchive(receipt,{files}),/文件恢复/);
  await assert.rejects(()=>restorePublicationArchive({...receipt,parts:[receipt.parts[1],receipt.parts[0]]},path.join(directory,'order.tar.gz'),{files}),/顺序或大小/);
  await assert.rejects(()=>restorePublicationArchive({...receipt,parts:[{...receipt.parts[0],locator:{...receipt.parts[0].locator,project:'language'}},receipt.parts[1]]},path.join(directory,'cross-project.tar.gz'),{files}),/定位无效/);
  const badDigest={...receipt,digest:'b'.repeat(64),sha256:'b'.repeat(64)},badDestination=path.join(directory,'bad-whole.tar.gz');await assert.rejects(()=>restorePublicationArchive(badDigest,badDestination,{files}),/完整摘要/);await assert.rejects(()=>access(badDestination),{code:'ENOENT'});
  await assert.rejects(()=>restorePublicationArchive({...receipt,revision:'a'.repeat(40)},path.join(directory,'bad-commit.tar.gz'),{files}),/提交身份/);
  await assert.rejects(()=>restorePublicationArchive({...receipt,tarDigest:'c'.repeat(64)},path.join(directory,'bad-tar.tar.gz'),{files}),/tar摘要/);
  const corrupt={getContent:async digest=>{const object=await files.getContent(digest),bytes=Buffer.from(await object.arrayBuffer());bytes[0]^=1;return{arrayBuffer:async()=>bytes};}};
  await assert.rejects(()=>restorePublicationArchive(receipt,path.join(directory,'bad-part.tar.gz'),{files:corrupt}),/分卷摘要/);
 }finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(privateRoot));await rm(directory,{recursive:true,force:true});}
});
test('HF typed receipts and legacy OneDrive receipts both read exact bytes without changing provider identity',async()=>{
 const bytes=gzipSync(Buffer.from('Synthetic tar bytes')),digest=sha(bytes),revision='a'.repeat(40);
 const current={schemaVersion:2,provider:'huggingface-s3',project:'algorithm',revision,digest,sha256:digest,bytes:bytes.length,locator:{version:2,provider:'huggingface-s3',project:'algorithm',digest}};
 const files={getContent:async requested=>{assert.equal(requested,digest);return{arrayBuffer:async()=>bytes};}};
 assert.deepEqual(await readPublicationArchive(current,{files}),bytes);
 const legacy={revision,sha256:digest,bytes:bytes.length,folder:'projects/second-algorithm/publications'};let lookups=0;
 const owner={graphRequest:async route=>{lookups++;assert.equal(route,`/me/drive/special/approot:/projects/second-algorithm/publications/${revision}.tar.gz`);return Response.json({id:'original-item'});},downloadItem:async id=>{assert.equal(id,'original-item');return new Response(bytes);}};
 assert.deepEqual(await readPublicationArchive(legacy,{owner}),bytes);assert.equal(lookups,1);
 await assert.rejects(()=>readPublicationArchive({...current,locator:{...current.locator,project:'language'}},{files}),/定位无效/);
 await assert.rejects(()=>readPublicationArchive(current,{files:{getContent:async()=>({arrayBuffer:async()=>Buffer.from('corrupted')})}}),/摘要不一致/);
 await assert.rejects(()=>readPublicationArchive({...legacy,provider:'onedrive',folder:'another-project'},{owner}),/目录无效/);
});
