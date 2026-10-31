import {readFile,mkdir,mkdtemp,stat,statfs,rm,realpath,open,unlink} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createGzip,createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {root,privateRoot,config,oneDriveOwner,writePrivate} from './lib/service-local.mjs';
const MAX_BYTES=24*1024*1024,PART_BYTES=16*1024*1024,FOLDER='projects/second-algorithm/publications';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function folder(owner,parent,name){
 try{return await(await owner.graphRequest(`/me/drive/items/${encodeURIComponent(parent)}:/${encodeURIComponent(name)}`)).json();}
 catch(error){if(!/HTTP 404/.test(error.message))throw error;return(await owner.graphRequest(`/me/drive/items/${encodeURIComponent(parent)}/children`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})})).json();}
}
async function hashStream(stream){const hash=createHash('sha256');let bytes=0;await pipeline(stream,new Writable({write(chunk,_encoding,done){hash.update(chunk);bytes+=chunk.length;done();}}));return{digest:hash.digest('hex'),bytes};}
export async function createPublicationArchive(repository,revision,directory){
 await mkdir(directory,{recursive:true});const tar=path.join(directory,revision+'.tar'),gzip=tar+'.gz';
 const sizes=execFileSync('git',['ls-tree','-r','--format=%(objectsize)',revision],{cwd:repository,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}).trim().split('\n').filter(Boolean).map(Number);
 if(sizes.some(size=>!Number.isSafeInteger(size)||size<0))throw Error('提交文件规模未核实');const rawBytes=sizes.reduce((total,size)=>total+size,0);if(!Number.isSafeInteger(rawBytes))throw Error('提交文件总量超出核验范围');const disk=await statfs(directory,{bigint:true});
 if(disk.bavail*disk.bsize<BigInt(rawBytes)*2n+536870912n)throw Error('D盘余量不足以安全制作本次档案');
 // Git writes its existing immutable tree directly to D. No 64MiB stdout buffer.
 execFileSync('git',['archive','--format=tar','-o',tar,revision],{cwd:repository,windowsHide:true,maxBuffer:1024*1024,env:{...process.env,TEMP:directory,TMP:directory}});
 await pipeline(createReadStream(tar),createGzip({level:9}),createWriteStream(gzip));
 const original=await hashStream(createReadStream(tar)),roundTrip=await hashStream(createReadStream(gzip).pipe(createGunzip()));
 if(original.digest!==roundTrip.digest||original.bytes!==roundTrip.bytes)throw Error('本机压缩往返核验失败');
 const compressed=await hashStream(createReadStream(gzip));
 return{filename:gzip,bytes:compressed.bytes,digest:compressed.digest,tarDigest:original.digest,tarBytes:original.bytes};
}
async function seriesFiles(owner,{forWrite=false}={}){
 if(typeof owner?.root!=='string'||!path.isAbsolute(owner.root))throw Error('系列存储管理员位置未配置');
 if(forWrite){const policy=JSON.parse(await readFile(path.join(owner.root,'protocol/series-storage.json'),'utf8')),resource=policy.resources?.find(item=>item.id==='hf-private-account'),allocation=policy.allocations?.algorithm?.find(item=>item.resourceId==='hf-private-account');
  if(resource?.state!=='active'||allocation?.mode!=='current'||policy.filePools?.huggingface?.namespace!=='Gual-Wells'||policy.filePools?.huggingface?.buckets?.algorithm!=='second-algorithm-assets')throw Error('系列策略尚未启用第二算法HF归档');}
 const manager=await import(pathToFileURL(path.join(owner.root,'scripts/lib/series-storage-local.mjs')));
 if(typeof manager.localSeriesFiles!=='function')throw Error('系列文件服务接口无效');return manager.localSeriesFiles('algorithm');
}
function checkedReceipt(receipt){
 if(!receipt||! /^[a-f0-9]{40}$/.test(receipt.revision||'')||! /^[a-f0-9]{64}$/.test(receipt.sha256||receipt.digest||''))throw Error('出版归档定位无效');
 if(receipt.sha256&&receipt.digest&&receipt.sha256!==receipt.digest)throw Error('出版归档摘要字段冲突');
 if(!Number.isSafeInteger(receipt.bytes)||receipt.bytes<=0)throw Error('出版归档大小无效');
 const digest=receipt.digest||receipt.sha256;
 if(receipt.schemaVersion===3){
  if(receipt.provider!=='huggingface-s3'||receipt.project!=='algorithm'||receipt.archiveFormat!=='git-tar-gzip'||receipt.partBytes!==PART_BYTES||!Array.isArray(receipt.parts)||receipt.parts.length!==Math.ceil(receipt.bytes/PART_BYTES)||! /^[a-f0-9]{64}$/.test(receipt.tarDigest||'')||!Number.isSafeInteger(receipt.tarBytes)||receipt.tarBytes<=0)throw Error('出版分卷回执无效');
  for(let index=0;index<receipt.parts.length;index++){const part=receipt.parts[index],offset=index*PART_BYTES;
   if(part?.index!==index||part.offset!==offset||part.bytes!==Math.min(PART_BYTES,receipt.bytes-offset)||! /^[a-f0-9]{64}$/.test(part.digest||''))throw Error('出版分卷顺序或大小无效');checkedLocator(part,part.digest);
  }
 }else if(receipt.parts!==undefined)throw Error('出版分卷版本无效');
 return digest;
}
function checkedLocator(receipt,digest){
 const locator=receipt.locator;
 if(locator?.version!==2||locator.provider!=='huggingface-s3'||locator.project!=='algorithm'||locator.digest!==digest||Object.keys(locator).sort().join(',')!=='digest,project,provider,version')throw Error('出版归档项目定位无效');
 const location=receipt.location;
 if(location&&(location.namespace!=='Gual-Wells'||location.bucket!=='second-algorithm-assets'||location.key!==`objects/${digest.slice(0,2)}/${digest}.bin`))throw Error('出版归档存储池无效');
}
async function* archiveChunks(receipt,{owner,files}={}){
 const digest=checkedReceipt(receipt);
 if(receipt.schemaVersion===3){
  files||=await seriesFiles(owner||await oneDriveOwner());
  for(const part of receipt.parts){const content=await files.getContent(part.digest);if(!content)throw Error('已有HF分卷暂不可读取');const bytes=Buffer.from(await content.arrayBuffer());if(bytes.length!==part.bytes||sha(bytes)!==part.digest)throw Error('永久归档分卷摘要不一致');yield bytes;}
  return;
 }
 let bytes;
 if(receipt.provider==='huggingface-s3'){
  if(receipt.project!=='algorithm'||receipt.bytes>MAX_BYTES)throw Error('出版归档项目定位或大小无效');checkedLocator(receipt,digest);
  files||=await seriesFiles(owner||await oneDriveOwner());const content=await files.getContent(digest);if(!content)throw Error('已有HF归档暂不可读取');bytes=Buffer.from(await content.arrayBuffer());
 }else{
  if(receipt.provider&&receipt.provider!=='onedrive'||receipt.folder&&receipt.folder!==FOLDER)throw Error('旧归档项目目录无效');owner||=await oneDriveOwner();if(!owner)throw Error('旧OneDrive凭据服务尚未配置');
  let itemId=receipt.itemId;if(!itemId){const item=await(await owner.graphRequest(`/me/drive/special/approot:/${FOLDER}/${receipt.revision}.tar.gz`)).json();itemId=item.id;}
  bytes=Buffer.from(await(await owner.downloadItem(itemId)).arrayBuffer());
 }
 if(receipt.provider==='huggingface-s3'&&bytes.length>MAX_BYTES||bytes.length!==receipt.bytes||sha(bytes)!==digest)throw Error('永久归档下载摘要不一致');yield bytes;
}
export async function readPublicationArchive(receipt,options={}){
 const digest=checkedReceipt(receipt);if(receipt.schemaVersion===3&&receipt.bytes>MAX_BYTES)throw Error('大档案请使用文件恢复，避免整包驻留内存');
 const chunks=[];for await(const bytes of archiveChunks(receipt,options))chunks.push(bytes);const bytes=Buffer.concat(chunks);
 if(bytes.length!==receipt.bytes||sha(bytes)!==digest)throw Error('永久归档下载摘要不一致');return bytes;
}
async function verifyGitArchive(filename,receipt){
 const hash=createHash('sha256');let bytes=0,header=Buffer.alloc(0);
 await pipeline(createReadStream(filename),createGunzip(),new Writable({write(chunk,_encoding,done){
  bytes+=chunk.length;if(receipt.tarBytes!==undefined&&bytes>receipt.tarBytes)return done(Error('恢复Git tar大小不一致'));
  hash.update(chunk);if(header.length<4096)header=Buffer.concat([header,chunk.subarray(0,4096-header.length)]);done();
 }}));
 const digest=hash.digest('hex');if(receipt.tarDigest&&digest!==receipt.tarDigest||receipt.tarBytes!==undefined&&bytes!==receipt.tarBytes)throw Error('恢复Git tar摘要不一致');
 let revision;try{revision=execFileSync('git',['get-tar-commit-id'],{input:header,encoding:'utf8',windowsHide:true,maxBuffer:4096}).trim();}catch{throw Error('恢复档案不含Git提交身份');}
 if(revision!==receipt.revision)throw Error('恢复档案Git提交身份不一致');return{tarDigest:digest,tarBytes:bytes,revision};
}
export async function restorePublicationArchive(receipt,destination,options={}){
 const digest=checkedReceipt(receipt);if(!path.isAbsolute(destination))throw Error('恢复档案须指定完整文件路径');await mkdir(path.dirname(destination),{recursive:true});
 const disk=await statfs(path.dirname(destination),{bigint:true});if(disk.bavail*disk.bsize<BigInt(receipt.bytes)+536870912n)throw Error('恢复档案磁盘余量不足');
 let handle,created=false;try{
  handle=await open(destination,'wx');created=true;const hash=createHash('sha256');let total=0;
  for await(const bytes of archiveChunks(receipt,options)){hash.update(bytes);let offset=0;while(offset<bytes.length){const written=await handle.write(bytes,offset,bytes.length-offset,total+offset);if(!written.bytesWritten)throw Error('恢复档案写入未完成');offset+=written.bytesWritten;}total+=bytes.length;}
  await handle.close();handle=null;if(total!==receipt.bytes||hash.digest('hex')!==digest)throw Error('永久归档完整摘要不一致');
  const git=await verifyGitArchive(destination,receipt);return{filename:destination,bytes:total,digest,...git};
 }catch(error){if(handle)await handle.close();if(created)await unlink(destination).catch(()=>{});throw error;}
}
function checkedSaved(saved,digest,bytes){
 if(saved?.digest!==digest||saved.bytes!==bytes||saved.location?.namespace!=='Gual-Wells'||saved.location?.bucket!=='second-algorithm-assets'||saved.location?.key!==`objects/${digest.slice(0,2)}/${digest}.bin`)throw Error('项目HF归档回执无效');
 return{version:2,provider:'huggingface-s3',project:'algorithm',digest};
}
export async function storePublicationArchive(files,built,revision){
 if(! /^[a-f0-9]{40}$/.test(revision||'')||!Number.isSafeInteger(built.bytes)||built.bytes<=0||! /^[a-f0-9]{64}$/.test(built.tarDigest||'')||!Number.isSafeInteger(built.tarBytes)||built.tarBytes<=0)throw Error('待存Git档案身份无效');
 const compressed=await hashStream(createReadStream(built.filename));if(compressed.bytes!==built.bytes||built.digest&&compressed.digest!==built.digest)throw Error('待存Git档案发生变动');
 const digest=compressed.digest,base={configured:true,provider:'huggingface-s3',project:'algorithm',revision,bytes:compressed.bytes,digest,sha256:digest,archiveFormat:'git-tar-gzip',tarDigest:built.tarDigest,tarBytes:built.tarBytes};
 if(built.bytes<=PART_BYTES){const bytes=await readFile(built.filename),saved=await files.putContent(bytes,'application/gzip'),locator=checkedSaved(saved,digest,bytes.length);return{schemaVersion:2,...base,locator,location:saved.location,verifiedAt:Date.now()};}
 const handle=await open(built.filename,'r'),parts=[];try{
  let offset=0;while(offset<built.bytes){const bytes=Buffer.allocUnsafe(Math.min(PART_BYTES,built.bytes-offset));let filled=0;
   while(filled<bytes.length){const got=await handle.read(bytes,filled,bytes.length-filled,offset+filled);if(!got.bytesRead)throw Error('待存Git档案意外截断');filled+=got.bytesRead;}
   const partDigest=sha(bytes),saved=await files.putContent(bytes,'application/octet-stream'),locator=checkedSaved(saved,partDigest,bytes.length);
   parts.push({index:parts.length,offset,bytes:bytes.length,digest:partDigest,locator,location:saved.location});offset+=bytes.length;
  }
 }finally{await handle.close();}
 return{schemaVersion:3,...base,partBytes:PART_BYTES,parts,verifiedAt:Date.now()};
}
async function ledger(){let value={version:1,archives:[]};try{value=JSON.parse(await readFile(path.join(privateRoot,'archive-ledger.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(value.version!==1||!Array.isArray(value.archives))throw Error('出版归档账本损坏');
 try{const prior=JSON.parse(await readFile(path.join(privateRoot,'archive-receipt.json'),'utf8'));if(prior.revision&&prior.sha256&&!value.archives.some(item=>item.revision===prior.revision&&item.sha256===prior.sha256&&(item.provider||'onedrive')===(prior.provider||'onedrive')))value.archives.push({...prior,provider:prior.provider||'onedrive'});}catch(error){if(error.code!=='ENOENT')throw error;}
 return value;
}
export async function archivePublication({revision:pinned}={}){
 const owner=await oneDriveOwner();if(!owner)return{configured:false};const settings=await config(),provider=settings.publicationArchiveProvider||'onedrive';
 if(!['onedrive','huggingface-s3'].includes(provider))throw Error('出版归档提供方配置无效');
 if(pinned&&! /^[a-f0-9]{40}$/.test(pinned))throw Error('手工归档须提供完整不可变提交');
 if(!pinned&&execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8',windowsHide:true}).trim())throw Error('出版归档须在已验证的提交之后运行');
 const revision=execFileSync('git',['rev-parse','--verify',pinned||'HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();if(!/^[a-f0-9]{40}$/.test(revision))throw Error('提交身份无效');
 const record=await ledger(),existing=record.archives.findLast(item=>item.revision===revision&&(item.provider||'onedrive')===provider);
 const files=provider==='huggingface-s3'?await seriesFiles(owner,{forWrite:true}):null;
 const builds=path.join(privateRoot,'archive-builds');await mkdir(builds,{recursive:true});const temporary=await mkdtemp(path.join(builds,'build-'));
 try{
  if(existing){await restorePublicationArchive(existing,path.join(temporary,'verified.tar.gz'),{owner,files});const receipt={...existing,reused:true,verifiedAt:Date.now()};await writePrivate('archive-ledger.json',record);await writePrivate('archive-receipt.json',receipt);return receipt;}
  const built=await createPublicationArchive(root,revision,temporary);let receipt;
  if(provider==='huggingface-s3'){
   receipt=await storePublicationArchive(files,built,revision);
  }else{
   if(built.bytes>MAX_BYTES)throw Error('旧OneDrive写入仅支持24MiB以内档案，请配置已授权的HF分卷');const zipped=await readFile(built.filename),digest=sha(zipped);
   const app=await(await owner.graphRequest('/me/drive/special/approot')).json(),projects=await folder(owner,app.id,'projects'),project=await folder(owner,projects.id,'second-algorithm'),archives=await folder(owner,project.id,'publications'),filename=revision+'.tar.gz';let item;
   try{item=await(await owner.graphRequest(`/me/drive/items/${archives.id}:/${filename}`)).json();}catch(error){if(!/HTTP 404/.test(error.message))throw error;item=await(await owner.graphRequest(`/me/drive/items/${archives.id}:/${filename}:/content`,{method:'PUT',headers:{'content-type':'application/gzip'},body:zipped})).json();}
   receipt={schemaVersion:2,configured:true,provider,revision,bytes:zipped.length,digest,sha256:digest,itemId:item.id,verifiedAt:Date.now(),folder:FOLDER,archiveFormat:'git-tar-gzip',tarDigest:built.tarDigest,tarBytes:built.tarBytes};
  }
  await restorePublicationArchive(receipt,path.join(temporary,'verified.tar.gz'),{owner,files});record.archives.push(receipt);await writePrivate('archive-ledger.json',record);await writePrivate('archive-receipt.json',receipt);console.log('出版归档已完成并核实完整摘要与Git提交身份。');return receipt;
 }finally{const actual=await realpath(temporary),allowed=await realpath(builds);if(path.dirname(actual)!==allowed)throw Error('归档临时目录越界，未清理');await rm(actual,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const index=process.argv.indexOf('--revision');await archivePublication(index>=0?{revision:process.argv[index+1]}:{});}catch{console.error('永久归档未完成；Git与已发布正文仍保留。');process.exitCode=1;}
