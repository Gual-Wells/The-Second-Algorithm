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
   else{const drive=await(await owner.graphRequest('/me/drive?$select=quota')).json();const quota=drive.quota;
     if(!Number.isSafeInteger(quota?.used)||!Number.isSafeInteger(quota?.total))throw Error('账户容量未核实');
     let projectBytes=null;try{const folder=await(await owner.graphRequest('/me/drive/special/approot:/projects/second-algorithm?$select=size')).json();if(Number.isSafeInteger(folder.size))projectBytes=folder.size;}catch{}
     pools.push({id:'onedrive',verified:true,usedBytes:quota.used,limitBytes:quota.total,remainingBytes:Number.isSafeInteger(quota.remaining)?quota.remaining:null,projectBytes,checkedAt});}
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
