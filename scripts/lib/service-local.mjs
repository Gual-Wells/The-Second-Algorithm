import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const privateRoot=path.join(root,'.local/services');
export async function config(){
 let value={};try{value=JSON.parse(await readFile(path.join(privateRoot,'config.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('本机服务配置无法读取');}
 for(const key of ['publisherCredentialFile','onedriveOwnerModule','openaiCreditFile','codexExecutable'])if(value[key]!==undefined&&(typeof value[key]!=='string'||!path.isAbsolute(value[key])))throw Error('本机路径配置无效：'+key);
 return value;
}
export async function publisherConfig(){
 const value=await config();let token=process.env.ALGORITHM_PUBLISH_TOKEN;
 if(!token&&value.publisherCredentialFile){try{token=JSON.parse(await readFile(value.publisherCredentialFile,'utf8')).PUBLISH_TOKEN;}catch{throw Error('无法读取本项目发布凭据');}}
 if(typeof token!=='string'||token.length<24)throw Error('第二算法发布凭据尚未配置');
 return {base:'https://second-algorithm.pages.dev',token};
}
export async function publisherRequest(resource,body){
 const {base,token}=await publisherConfig();
 const response=await fetch(new URL(resource,base),{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60_000)});
 if(!response.ok)throw Error(`服务更新未完成（HTTP ${response.status}）`);return response.json();
}
export async function writePrivate(name,value){
 await mkdir(privateRoot,{recursive:true});const filename=path.join(privateRoot,name),temporary=filename+'.'+randomUUID()+'.tmp';
 await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,filename);
}
export async function oneDriveOwner(){
 const value=await config();if(!value.onedriveOwnerModule)return null;
 // Import the credential owner's helper. Do not duplicate refresh tokens or copy credentials.
 if(value.onedriveOwnerSha256&&createHash('sha256').update(await readFile(value.onedriveOwnerModule)).digest('hex')!==value.onedriveOwnerSha256)throw Error('OneDrive凭据服务版本已变化，请复核后更新本机配置');
 const owner=await import(pathToFileURL(value.onedriveOwnerModule));
 if(typeof owner.graphRequest!=='function'||typeof owner.downloadItem!=='function')throw Error('OneDrive凭据服务接口无效');return owner;
}
