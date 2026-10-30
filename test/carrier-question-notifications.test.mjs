import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {questionReplyStatement,flushQuestionReplies} from '../server/services.mjs';
import {questionPublisherRoute,questionsRoute} from '../server/questions.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+name,'utf8'));
 const DB={prepare(text){let args=[];return{bind(...v){args=v;return this;},async first(){return sql.prepare(text).get(...args)||null;},async all(){return{results:sql.prepare(text).all(...args)};},async run(){return{meta:{changes:Number(sql.prepare(text).run(...args).changes)}};}};},async batch(items){sql.exec('BEGIN');try{const r=[];for(const item of items)r.push(await item.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const now=Date.now(),id=crypto.randomUUID(),revision='c'.repeat(64),credentialId='fixture-owner',ownerScope=createHash('sha256').update('second-algorithm-owner:'+credentialId).digest('base64url'),s={ownerScope,credentialId,epoch:1};
 sql.prepare("INSERT INTO auth_credential VALUES(1,?,'key',0,'[]',?)").run(credentialId,now);
 sql.prepare("INSERT INTO question_turns(id,owner_scope,epoch,chapter_id,revision,document_url,markdown_url,question,status,created_at) VALUES(?,?,1,'chapter-01',?,'/library/doc.json','/library/doc.md','私人问题','running',?)").run(id,ownerScope,revision,now);
 for(const device of ['one','two'])sql.prepare('INSERT INTO service_push VALUES(?,?,?,?,?,?,?,?)').run(device,ownerScope,1,'https://fcm.googleapis.com/'+device,'public','auth',now,now);
 const env={DB,APP_ORIGIN:'https://second-algorithm.pages.dev',VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test',VAPID_SUBJECT:'mailto:test@example.test'},row={id,chapter_id:'chapter-01',revision};
 async function complete(){await DB.batch([DB.prepare("UPDATE question_turns SET status='answered',answer='私人答复',answered_at=? WHERE id=?").bind(now,id),questionReplyStatement(env,row,s,now)]);}
 return {sql,DB,env,id,row,s,now,revision,complete};
}
test('question notices only follow completed answers and reuse the project subscription/deduplication',async()=>{
 const f=fixture();try{await questionReplyStatement(f.env,f.row,f.s,f.now).run();assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM service_push_delivery').get().n,0);await f.complete();await questionReplyStatement(f.env,f.row,f.s,f.now).run();assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM service_push_delivery').get().n,2);
 const notices=[];assert.equal((await flushQuestionReplies(f.env,{deliver:async(row,payload)=>{notices.push(payload);return true;}})).sent,2);assert.equal((await flushQuestionReplies(f.env,{deliver:async()=>{throw Error('no repeat');}})).sent,0);
 assert(notices.every(p=>p.url==='/#/questions/chapter-01/'+f.revision+'/'+f.id));assert(!JSON.stringify(notices).includes('私人'));assert.equal(new Set(notices.map(p=>p.tag)).size,1);
 }finally{f.sql.close();}
});
test('read replies, changed epochs and replaced owners cannot generate stale notices',async()=>{
 for(const mode of ['read','epoch','owner']){const f=fixture();try{await f.complete();f.sql.exec(mode==='read'?'UPDATE question_turns SET read_at=1':mode==='epoch'?'UPDATE auth_control SET epoch=epoch+1':"UPDATE auth_credential SET credential_id='replacement-owner'");let calls=0;await flushQuestionReplies(f.env,{deliver:async()=>{calls++;return true;}});assert.equal(calls,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM service_push_delivery').get().n,0);assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM question_turns WHERE answer='私人答复'").get().n,1);}finally{f.sql.close();}}
});
test('question notification recovery is bounded and does not send publication events during empty queue checks',async()=>{
 const f=fixture();try{await f.complete();f.sql.exec("DELETE FROM service_push WHERE id='two'");f.sql.prepare('INSERT INTO service_push_delivery(event_id,subscription_id,payload_json,created_at) VALUES(?,?,?,?)').run('publication:test','one','{"title":"新章","body":"新章","url":"/#/"}',f.now);let calls=0;for(let n=0;n<6;n++)await flushQuestionReplies(f.env,{deliver:async()=>{calls++;throw Error('temporary transport failure');}});assert.equal(calls,4);assert.equal(f.sql.prepare("SELECT attempts FROM service_push_delivery WHERE event_id='publication:test'").get().attempts,0);
 }finally{f.sql.close();}
});
test('the real completion route queues once atomically and rolls back its answer if durable enqueue fails',async()=>{
 for(const broken of [false,true]){const f=fixture();try{
  const claim='f'.repeat(64);f.env.PUBLISH_TOKEN='fixture-publisher-token-not-real';f.sql.prepare('UPDATE question_turns SET claim_hash=?,lease_until=? WHERE id=?').run(createHash('sha256').update(claim).digest('hex'),Date.now()+300000,f.id);
  if(broken)f.sql.exec("CREATE TRIGGER fail_notice BEFORE INSERT ON service_push_delivery BEGIN SELECT RAISE(ABORT,'fixture queue failure'); END;");
  const invoke=()=>questionPublisherRoute(new Request('https://second-algorithm.pages.dev/api/questions/jobs/'+f.id+'/complete',{method:'POST',headers:{authorization:'Bearer '+f.env.PUBLISH_TOKEN},body:JSON.stringify({claim,answer:'完成答案'})}),f.env,r=>r.json());
  if(broken){await assert.rejects(invoke(),/fixture queue failure/);const row=f.sql.prepare('SELECT status,answer FROM question_turns WHERE id=?').get(f.id);assert.equal(row.status,'running');assert.equal(row.answer,null);}
  else{assert.equal((await invoke()).status,200);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM service_push_delivery').get().n,2);assert.equal((await(await invoke()).json()).reused,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM service_push_delivery').get().n,2);}
 }finally{f.sql.close();}}
});
test('API lease expiry preserves the unknown outcome instead of offering a blind paid retry',async()=>{
 const f=fixture();try{f.env.PUBLISH_TOKEN='fixture-publisher-token-not-real';f.sql.prepare('UPDATE question_turns SET claim_hash=?,lease_until=? WHERE id=?').run('a'.repeat(64),Date.now()-1,f.id);
 const claim=await questionPublisherRoute(new Request('https://second-algorithm.pages.dev/api/questions/jobs/claim',{method:'POST',headers:{authorization:'Bearer '+f.env.PUBLISH_TOKEN},body:JSON.stringify({claim:'f'.repeat(64)})}),f.env,r=>r.json());assert.equal((await claim.json()).job,null);
 assert.equal(f.sql.prepare('SELECT error FROM question_turns WHERE id=?').get(f.id).error,'outcome_unknown');
 const retry=await questionsRoute(new Request('https://second-algorithm.pages.dev/api/questions/retry',{method:'POST',headers:{origin:'https://second-algorithm.pages.dev'},body:JSON.stringify({id:f.id})}),f.env,f.s,r=>r.json());assert.equal(retry.status,409);
 }finally{f.sql.close();}
});
