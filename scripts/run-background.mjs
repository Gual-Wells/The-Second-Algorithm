import {spawn} from 'node:child_process';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,privateRoot,config,publisherRequest,writePrivate} from './lib/service-local.mjs';
import {finishServiceSnapshot} from './collect-service-snapshot.mjs';
export const runDecision=claim=>claim.completedAt?'complete':claim.rest?'rest':'run';
export async function publicationSucceeded(runId,claimedAt){
 try{
  const result=JSON.parse(await readFile(path.join(privateRoot,'publication-result.json'),'utf8'));
  if(result.runId!==runId||result.published!==true||typeof result.receiptPath!=='string')return false;
  const receiptFile=path.resolve(root,result.receiptPath),relative=path.relative(path.join(root,'work/jobs'),receiptFile);
  if(relative.startsWith('..')||path.isAbsolute(relative))return false;
  const receipt=JSON.parse(await readFile(receiptFile,'utf8'));
  return receipt.passed===true&&receipt.anonymousBoundaryVerified===true&&receipt.origin==='https://second-algorithm.pages.dev'&&Date.parse(receipt.deployedAt)>=claimedAt;
 }catch{return false;}
}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export async function runBackground(){
 await mkdir(privateRoot,{recursive:true});const lockName=path.join(privateRoot,'background.lock');let lock;
 try{lock=await open(lockName,'wx');}catch{throw Error('已有后台任务或未处理的中断锁，请先核查本机日志');}
 let claim,outcome;
 try{
  await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:Date.now()}));
  const runId=today();claim=await publisherRequest('/api/automation/claim',{runId});await writePrivate('current-run.json',claim);
  await publisherRequest('/api/services/report',{runner:{configured:true,seenAt:Date.now()}});
  if(runDecision(claim)==='complete'){console.log('本日运行已经结束，不再启动模型。');return;}
  if(runDecision(claim)==='rest'){outcome='rest';console.log('本日保持休息，没有启动Codex。');return;}
  await unlink(path.join(privateRoot,'publication-result.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const local=await config(),template=await readFile(path.join(root,'protocol/background-prompt.txt'),'utf8');
  const prompt=template.replaceAll('{RUN_ID}',runId).replaceAll('{GOAL}',claim.goal||'按研究部流程研究并出版下一章').replaceAll('{NEXT_REQUEST}',claim.temporaryRequest?.text||'无补充要求');
  const executable=local.codexExecutable||'codex';
  // CLI subscription authentication stays with Codex. Never route this job through API credits.
  const code=await new Promise((resolve,reject)=>{
   const child=spawn(executable,['--search','-a','never','exec','-C',root,'--enable','multi_agent','-s','danger-full-access','-'],{cwd:root,windowsHide:true,stdio:['pipe','inherit','inherit'],env:{...process.env,TEMP:privateRoot,TMP:privateRoot,TMPDIR:privateRoot}});
   child.once('error',()=>reject(Error('Codex CLI未能启动')));child.once('exit',code=>resolve(code));child.stdin.on('error',()=>{});child.stdin.end(prompt);
  });
  outcome=code===0&&await publicationSucceeded(runId,claim.claimedAt)?'published':'failed';
  if(outcome==='failed')throw Error('后台任务未取得本次真实发布回执，请检查本机日志与研究任务状态');
 }catch(error){if(claim&&!outcome)outcome='failed';throw error;}
 finally{
  if(claim&&outcome){try{await publisherRequest('/api/automation/complete',{runId:claim.runId,outcome});}catch{console.error('本机完成状态尚未回写；不会自动再次启动模型。');}}
  if(claim&&outcome&&outcome!=='rest'){try{await finishServiceSnapshot();}catch{console.error('服务核对未更新，余额与容量保留上次记录。');}}
  await lock.close();await unlink(lockName);
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await runBackground();}catch(e){console.error(e.message);process.exitCode=1;}
