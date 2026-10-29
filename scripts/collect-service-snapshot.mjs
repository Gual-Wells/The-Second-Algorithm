// Task-ending account snapshots. No OpenAI request, cost estimate or page-view polling.
import {readFile,readdir,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {root,privateRoot,config,oneDriveOwner,publisherRequest,writePrivate} from './lib/service-local.mjs';
export function parseWranglerInfo(text){
 const first=text.indexOf('{'),last=text.lastIndexOf('}');if(first<0||last<first)throw Error('数据库管理响应无效');
 const value=JSON.parse(text.slice(first,last+1));const bytes=value.database_size??value.file_size;
 if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('数据库大小未核实');return bytes;
}
async function treeBytes(directory){let bytes=0,count=0;for(const item of await readdir(directory,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('归档目录不接受符号链接');const filename=path.join(directory,item.name);if(item.isDirectory()){const child=await treeBytes(filename);bytes+=child.bytes;count+=child.count;}else if(item.isFile()){bytes+=(await stat(filename)).size;count++;}}return{bytes,count};}
export function graphNextRoute(value){
 if(typeof value!=='string')throw Error('归档分页地址无效');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='graph.microsoft.com'||url.port||url.username||url.password||url.hash||!url.pathname.startsWith('/v1.0/'))throw Error('归档分页地址无效');
 return url.pathname.slice('/v1.0'.length)+url.search;
}
export async function measureOneDriveProject(owner){
 const project=await(await owner.graphRequest('/me/drive/special/approot:/projects/second-algorithm?$select=id,folder')).json();
 if(typeof project.id!=='string'||!project.id||!project.folder||project.remoteItem)throw Error('项目归档目录未核实');
 const folders=[{id:project.id,depth:0}],seenFolders=new Set(),seenFiles=new Set(),seenPages=new Set();let total=0,requests=0;
 for(let index=0;index<folders.length;index++){
  const folder=folders[index];if(seenFolders.has(folder.id)||folder.depth>16||folders.length>128)throw Error('归档目录结构未核实');seenFolders.add(folder.id);
  let route=`/me/drive/items/${encodeURIComponent(folder.id)}/children?$select=id,size,file,folder,remoteItem&$top=200`;
  while(route){
   if(++requests>256||seenPages.has(route))throw Error('归档分页未完整核实');seenPages.add(route);
   const page=await(await owner.graphRequest(route)).json();if(!Array.isArray(page.value))throw Error('归档目录响应不完整');
   for(const item of page.value){
    if(typeof item.id!=='string'||!item.id||item.remoteItem)throw Error('归档项目边界未核实');
    if(item.folder){folders.push({id:item.id,depth:folder.depth+1});}
    else if(item.file){
     if(!Number.isSafeInteger(item.size)||item.size<0||seenFiles.has(item.id))throw Error('归档文件大小未核实');seenFiles.add(item.id);
     total+=item.size;if(!Number.isSafeInteger(total)||seenFiles.size>50_000)throw Error('归档统计超出单次核验范围');
    }else throw Error('归档条目类型未核实');
   }
   route=page['@odata.nextLink']===undefined?null:graphNextRoute(page['@odata.nextLink']);
  }
 }
 return total;
}
export async function collectOneDriveUsage(owner,checkedAt=Date.now()){
 try{
  const drive=await(await owner.graphRequest('/me/drive?$select=quota')).json(),quota=drive.quota;
  if(!Number.isSafeInteger(quota?.used)||quota.used<0||!Number.isSafeInteger(quota?.total)||quota.total<=0)throw Error('账户容量未核实');
  const projectBytes=await measureOneDriveProject(owner);
  // Account quota remains the cloud-reported snapshot; directory aggregates may lag uploads.
  return{id:'onedrive',verified:true,usedBytes:quota.used,limitBytes:quota.total,remainingBytes:Number.isSafeInteger(quota.remaining)&&quota.remaining>=0?quota.remaining:null,projectBytes,checkedAt};
 }catch{return{id:'onedrive',verified:false,attemptedAt:checkedAt};}
}
export async function collectServiceSnapshot({libraryDirectory=path.join(root,'dist/library')}={}){
 await mkdir(privateRoot,{recursive:true});const checkedAt=Date.now(),value=await config(),pools=[];let balances;
 try{const wrangler=path.join(path.dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),'bin/wrangler.js');
   const r=spawnSync(process.execPath,[wrangler,'d1','info','second-algorithm','--json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60_000,env:{...process.env,TEMP:privateRoot,TMP:privateRoot,WRANGLER_LOG_PATH:path.join(privateRoot,'wrangler.log')}});
   if(r.status!==0)throw Error('数据库管理查询失败');const bytes=parseWranglerInfo(r.stdout);
   pools.push({id:'d1',verified:true,usedBytes:bytes,projectBytes:bytes,limitBytes:500_000_000,remainingBytes:Math.max(0,500_000_000-bytes),checkedAt});
 }catch{pools.push({id:'d1',verified:false,attemptedAt:checkedAt});}
 try{const measured=await treeBytes(libraryDirectory);pools.push({id:'static',verified:true,usedBytes:measured.bytes,projectBytes:measured.bytes,limitBytes:null,remainingBytes:null,checkedAt});}
 catch{pools.push({id:'static',verified:false,attemptedAt:checkedAt});}
 try{const owner=await oneDriveOwner();if(!owner){pools.push({id:'onedrive',verified:false,status:'not-configured',attemptedAt:checkedAt});}
   else pools.push(await collectOneDriveUsage(owner,checkedAt));
 }catch{pools.push({id:'onedrive',verified:false,attemptedAt:checkedAt});}
 // Explicit verified input only: a grant email establishes issuance, not remaining balance.
 if(value.openaiCreditFile){try{const record=JSON.parse(await readFile(value.openaiCreditFile,'utf8'));balances={...record,attemptedAt:checkedAt};}
   catch{balances={verified:false,attemptedAt:checkedAt};}}
 return {storage:{pools},...(balances?{balances}:{})};
}
export async function finishServiceSnapshot(options){
 const snapshot=await collectServiceSnapshot(options);await writePrivate('last-snapshot.json',snapshot);
 const result=await publisherRequest('/api/services/report',snapshot);
 console.log('服务快照已更新；未核实项保留上次数据。');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const index=process.argv.indexOf('--library');const options=index>=0?{libraryDirectory:path.resolve(process.argv[index+1])}:undefined;
   if(process.argv.includes('--collect-only')){await writePrivate('last-snapshot.json',await collectServiceSnapshot(options));console.log('服务快照已保存在本机私有目录，尚未发布。');}
   else await finishServiceSnapshot(options);
 }catch{console.error('服务快照未能更新；已有数据未改动。');process.exitCode=1;}
}
