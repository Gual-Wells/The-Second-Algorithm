import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,oneDriveOwner,writePrivate} from './lib/service-local.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function folder(owner,parent,name){
 try{return await(await owner.graphRequest(`/me/drive/items/${encodeURIComponent(parent)}:/${encodeURIComponent(name)}`)).json();}
 catch{return(await owner.graphRequest(`/me/drive/items/${encodeURIComponent(parent)}/children`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})})).json();}
}
export async function archivePublication(){
 const owner=await oneDriveOwner();if(!owner)return {configured:false};
 if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8',windowsHide:true}).trim())throw Error('出版归档须在已验证的提交之后运行');
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 // Git archive contains tracked publication/protocol/code, never local credentials or books.
 const gitTar=execFileSync('git',['archive','--format=tar',revision],{cwd:root,windowsHide:true,maxBuffer:64*1024*1024});
 const zipped=gzipSync(gitTar,{level:9});if(!gunzipSync(zipped).equals(gitTar))throw Error('本机压缩往返核验失败');
 const app=await(await owner.graphRequest('/me/drive/special/approot')).json();
 const projects=await folder(owner,app.id,'projects'),project=await folder(owner,projects.id,'second-algorithm'),archives=await folder(owner,project.id,'publications');
 const filename=revision+'.tar.gz';let item;
 try{item=await(await owner.graphRequest(`/me/drive/items/${archives.id}:/${filename}`)).json();}
 catch{item=await(await owner.graphRequest(`/me/drive/items/${archives.id}:/${filename}:/content`,{method:'PUT',headers:{'content-type':'application/gzip'},body:zipped})).json();}
 const downloaded=Buffer.from(await(await owner.downloadItem(item.id)).arrayBuffer());
 if(sha(downloaded)!==sha(zipped))throw Error('永久归档下载摘要不一致');
 const receipt={configured:true,revision,bytes:zipped.length,sha256:sha(zipped),verifiedAt:Date.now(),folder:'projects/second-algorithm/publications'};
 await writePrivate('archive-receipt.json',receipt);console.log('出版归档已完成并核实下载摘要。');return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await archivePublication();}catch{console.error('永久归档未完成；Git与已发布正文仍保留。');process.exitCode=1;}
