import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.mjs';
const origin='https://second-algorithm.pages.dev',revision='c'.repeat(64),text='本章：二分维护一个单调边界。';
function environment(){
 const sql=new DatabaseSync(':memory:');for(const file of ['0001_owner_state.sql','0002_services.sql','0003_preserve_rest_arrangements.sql','0004_questions.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(text){let args=[];return{bind(...v){args=v;return this;},async first(){return sql.prepare(text).get(...args)||null;},async all(){return{results:sql.prepare(text).all(...args)};},async run(){return{meta:{changes:Number(sql.prepare(text).run(...args).changes)}};}};},async batch(v){sql.exec('BEGIN');try{const result=[];for(const s of v)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const catalog={collections:[{id:'chapter-01',title:'二分',documents:[{revision,url:'/library/c/d.json',markdownUrl:'/library/c/source.md'}]}]};
 return{sql,DB,APP_ORIGIN:origin,PUBLISH_TOKEN:'test-publisher-token-never-production',ASSETS:{async fetch(request){const p=new URL(request.url).pathname;if(p==='/library/catalog.json')return Response.json(catalog);if(p==='/library/c/d.json')return Response.json({revision,title:'二分'});if(p==='/library/c/source.md')return new Response(text);return new Response('',{status:404});}}};
}
async function owner(e,key='fixture-key'){e.sql.prepare("INSERT OR REPLACE INTO auth_credential VALUES(1,?,'key',0,'[]',?)").run(key,Date.now());const token=(key==='fixture-key'?'a':'b').repeat(43),digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('base64url'),epoch=e.sql.prepare('SELECT epoch FROM auth_control').get().epoch;e.sql.prepare('INSERT OR REPLACE INTO auth_sessions VALUES(?,?,?,?,?)').run(digest,epoch,key,Date.now(),Date.now()+100000);return '__Host-second_algorithm='+token;}
const call=(e,p,{cookie,body,publisher=false,foreign=false}={})=>worker.fetch(new Request(origin+p,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(publisher?{authorization:'Bearer '+e.PUBLISH_TOKEN}:{}),...(body?{'content-type':'application/json',origin:foreign?'https://other.example':origin}:{})},body:body?JSON.stringify(body):undefined}),e);
test('private idempotent questions use fixed server chapter, ordered history, lease and unread snapshots',async()=>{
 const e=environment();try{
  assert.equal((await call(e,'/api/questions/status')).status,401);assert.equal((await call(e,'/api/questions/jobs/claim',{body:{claim:'f'.repeat(64)}})).status,401);
  const cookie=await owner(e),id=crypto.randomUUID(),id2=crypto.randomUUID(),body={id,chapterId:'chapter-01',revision,question:'为什么区间要保持不变量？'};
  assert.equal((await call(e,'/api/questions',{cookie,body,foreign:true})).status,403);
  assert.equal((await call(e,'/api/questions',{cookie,body:{...body,revision:'a'.repeat(64)}})).status,409);
  assert.equal((await call(e,'/api/questions',{cookie,body})).status,200);assert.equal((await call(e,'/api/questions',{cookie,body})).status,200);
  assert.equal((await call(e,'/api/questions',{cookie,body:{...body,question:'篡改'}})).status,409);
  await call(e,'/api/questions',{cookie,body:{...body,id:id2,question:'继续解释边界'}});
  const claim='f'.repeat(64),pub=body=>({publisher:true,body});
  const job=(await(await call(e,'/api/questions/jobs/claim',pub({claim}))).json()).job;assert.equal(job.id,id);assert.equal(job.chapter.markdown,text);assert.equal(job.messages.at(-1).content,body.question);
  assert.equal((await(await call(e,'/api/questions/jobs/claim',pub({claim}))).json()).job,null);
  assert.equal((await call(e,'/api/questions/jobs/'+id+'/complete',pub({claim:'e'.repeat(64),answer:'错误'}))).status,409);
  assert.equal((await call(e,'/api/questions/jobs/'+id+'/complete',pub({claim,answer:'区间排除时必须保留答案。'}))).status,200);
  assert.equal((await(await call(e,'/api/questions/jobs/'+id+'/complete',pub({claim,answer:'重复'}))).json()).reused,true);
  const second=(await(await call(e,'/api/questions/jobs/claim',pub({claim}))).json()).job;assert.equal(second.id,id2);assert(second.messages.some(m=>m.role==='assistant'&&m.content==='区间排除时必须保留答案。'));
  assert.equal((await(await call(e,'/api/questions/status',{cookie})).json()).unread,1);
  const thread=await(await call(e,'/api/questions/thread',{cookie,body:{chapterId:'chapter-01',revision,markRead:true}})).json();assert.equal(thread.turns.length,2);assert.equal((await(await call(e,'/api/questions/status',{cookie})).json()).unread,0);
  await call(e,'/api/questions/jobs/'+id2+'/complete',pub({claim,answer:'第二条解释'}));assert.equal((await(await call(e,'/api/questions/status',{cookie})).json()).unread,1);
  e.sql.prepare('UPDATE auth_control SET epoch=epoch+1').run();const other=await owner(e,'other-key');assert.equal((await(await call(e,'/api/questions/thread',{cookie:other,body:{chapterId:'chapter-01',revision}})).json()).turns.length,0);
  assert.equal((await call(e,'/api/questions/jobs/'+id2+'/complete',pub({claim,answer:'旧身份'}))).status,404);
 }finally{e.sql.close();}
});
test('failed inference retries only explicitly; unknown paid outcome remains protected',async()=>{
 const e=environment();try{const cookie=await owner(e),id=crypto.randomUUID(),claim='a'.repeat(64);await call(e,'/api/questions',{cookie,body:{id,chapterId:'chapter-01',revision,question:'解释'}});await call(e,'/api/questions/jobs/claim',{publisher:true,body:{claim}});await call(e,'/api/questions/jobs/'+id+'/fail',{publisher:true,body:{claim,outcomeUnknown:true}});assert.equal((await call(e,'/api/questions/retry',{cookie,body:{id}})).status,409);assert.equal((await(await call(e,'/api/questions/jobs/claim',{publisher:true,body:{claim}})).json()).job,null);assert.equal(e.sql.prepare('SELECT status FROM question_turns WHERE id=?').get(id).status,'failed');}finally{e.sql.close();}
});
