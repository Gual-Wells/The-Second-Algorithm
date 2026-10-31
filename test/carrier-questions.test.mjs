import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.mjs';
const origin='https://second-algorithm.pages.dev',revision='c'.repeat(64),text='本章：二分维护一个单调边界。';
function environment(){
 const sql=new DatabaseSync(':memory:');for(const file of ['0001_owner_state.sql','0002_services.sql','0003_preserve_rest_arrangements.sql','0004_questions.sql','0005_cloud_questions.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(text){let args=[];return{bind(...v){args=v;return this;},async first(){return sql.prepare(text).get(...args)||null;},async all(){return{results:sql.prepare(text).all(...args)};},async run(){const statement=sql.prepare(text);return statement.columns().length?{results:statement.all(...args),meta:{changes:0}}:{meta:{changes:Number(statement.run(...args).changes)}};}};},async batch(v){sql.exec('BEGIN');try{const result=[];for(const s of v)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const catalog={collections:[{id:'chapter-01',title:'二分',documents:[{revision,url:'/library/c/d.json',markdownUrl:'/library/c/source.md'}]}]};
 return{sql,DB,catalog,APP_ORIGIN:origin,PUBLISH_TOKEN:'test-publisher-token-never-production',ASSETS:{async fetch(request){const p=new URL(request.url).pathname;if(p==='/library/catalog.json')return this.failCatalog?new Response('',{status:503}):Response.json(catalog);if(p==='/library/c/d.json')return Response.json({revision,title:'二分'});if(p==='/library/c/source.md')return new Response(text);return new Response('',{status:404});}}};
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

function fixtureTurn(e,seed,{chapterId='chapter-01',rev=revision,status='answered',answer='已解答',createdAt=Date.now()}={}){
 const scope=e.sql.prepare('SELECT owner_scope,epoch FROM question_turns WHERE id=?').get(seed),id=crypto.randomUUID();
 e.sql.prepare('INSERT INTO question_turns(id,owner_scope,epoch,chapter_id,revision,document_url,markdown_url,question,answer,status,created_at,answered_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,scope.owner_scope,scope.epoch,chapterId,rev,'/library/c/d.json','/library/c/source.md','问题 '+id,status==='answered'?answer:null,status,createdAt,status==='answered'?createdAt:null);return id;
}

test('opening selects current unread then other unread, keeps boundaries and atomically acknowledges only the old snapshot',async()=>{
 const e=environment();try{
  const cookie=await owner(e),seed=crypto.randomUUID();await call(e,'/api/questions',{cookie,body:{id:seed,chapterId:'chapter-01',revision,question:'等待'}});
  const current=fixtureTurn(e,seed),other=fixtureTurn(e,seed,{chapterId:'old-chapter',rev:'d'.repeat(64)});
  const summary=await(await call(e,'/api/questions/summary',{cookie})).json();assert.equal(summary.threads.length,2);assert.equal(summary.threads.find(t=>t.chapterId==='chapter-01').firstUnreadQuestionId,current);
  const opened=await(await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision}})).json();
  assert.equal(opened.chapterId,'chapter-01');assert.equal(opened.firstUnreadQuestionId,current);assert.equal(opened.canAsk,true);assert.equal(opened.threads.reduce((n,t)=>n+t.unread,0),2);
  assert.equal(e.sql.prepare("SELECT COUNT(*) n FROM question_turns WHERE status='answered' AND read_at IS NULL").get().n,0);
  const late=fixtureTurn(e,seed,{chapterId:'old-chapter',rev:'d'.repeat(64)});
  const next=await(await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision}})).json();assert.equal(next.chapterId,'old-chapter');assert.equal(next.firstUnreadQuestionId,late);assert.equal(next.canAsk,false);assert(next.turns.some(t=>t.id===other));
  const newest=fixtureTurn(e,seed);assert.equal((await(await call(e,'/api/questions/status',{cookie})).json()).unread,1);
  const read=await(await call(e,'/api/questions/thread',{cookie,body:{chapterId:'chapter-01',revision,markRead:false}})).json();assert.equal(read.firstUnreadQuestionId,newest);assert.equal((await(await call(e,'/api/questions/status',{cookie})).json()).unread,1);
 }finally{e.sql.close();}
});

test('exact answer links and seen IDs stay within the fixed private owner, epoch, chapter and revision',async()=>{
 const e=environment();try{
  const cookie=await owner(e),seed=crypto.randomUUID();await call(e,'/api/questions',{cookie,body:{id:seed,chapterId:'chapter-01',revision,question:'等待'}});
  const first=fixtureTurn(e,seed),other=fixtureTurn(e,seed,{chapterId:'other-chapter',rev:'e'.repeat(64)});
  assert.equal((await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision,questionId:other}})).status,404);
  assert.equal((await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision,questionId:'invalid'}})).status,400);
  const deep=await(await call(e,'/api/questions/open',{cookie,body:{chapterId:'other-chapter',revision:'e'.repeat(64),questionId:other}})).json();assert.equal(deep.chapterId,'other-chapter');assert(deep.turns.some(t=>t.id===other));assert.equal(deep.canAsk,false);
  const before=fixtureTurn(e,seed),after=fixtureTurn(e,seed);
  assert.equal((await call(e,'/api/questions/seen',{cookie,body:{chapterId:'chapter-01',revision,ids:[before]}})).status,200);
  assert.notEqual(e.sql.prepare('SELECT read_at FROM question_turns WHERE id=?').get(before).read_at,null);assert.equal(e.sql.prepare('SELECT read_at FROM question_turns WHERE id=?').get(after).read_at,null);
  assert.equal((await call(e,'/api/questions/seen',{cookie,foreign:true,body:{chapterId:'chapter-01',revision,ids:[after]}})).status,403);
  assert.equal((await call(e,'/api/questions/seen',{cookie,body:{chapterId:'chapter-01',revision,ids:[after,after]}})).status,400);
  e.sql.prepare('UPDATE auth_control SET epoch=epoch+1').run();const second=await owner(e,'other-key');assert.equal((await(await call(e,'/api/questions/summary',{cookie:second})).json()).threads.length,0);assert.equal((await call(e,'/api/questions/open',{cookie:second,body:{chapterId:'chapter-01',revision,questionId:first}})).status,404);
 }finally{e.sql.close();}
});

test('retired history remains readable while temporary catalog failures are 503 rather than fake retirement',async()=>{
 const e=environment();try{
  const cookie=await owner(e),seed=crypto.randomUUID();await call(e,'/api/questions',{cookie,body:{id:seed,chapterId:'chapter-01',revision,question:'过去的问题'}});const answered=fixtureTurn(e,seed);
  e.ASSETS.failCatalog=true;assert.equal((await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision,questionId:answered}})).status,503);assert.equal(e.sql.prepare('SELECT read_at FROM question_turns WHERE id=?').get(answered).read_at,null);
  e.ASSETS.failCatalog=false;e.catalog.collections=[];
  const result=await(await call(e,'/api/questions/open',{cookie,body:{chapterId:'chapter-01',revision,questionId:answered}})).json();assert.equal(result.canAsk,false);assert.equal(result.title,'二分');assert.equal(result.turns.find(t=>t.id===answered).answer,'已解答');
  assert.equal((await call(e,'/api/questions',{cookie,body:{id:crypto.randomUUID(),chapterId:'chapter-01',revision,question:'不能冒充新章'}})).status,409);
 }finally{e.sql.close();}
});
