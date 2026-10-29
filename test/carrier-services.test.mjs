import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.mjs';
import {mergeBalance,emptyBalances,mergeStorage,emptyStorage,subscriptionValid} from '../server/services.mjs';
import {parseWranglerInfo} from '../scripts/collect-service-snapshot.mjs';
import {runDecision} from '../scripts/run-background.mjs';
const origin='https://second-algorithm.pages.dev';
function environment(){
 const sql=new DatabaseSync(':memory:');for(const file of ['0001_owner_state.sql','0002_services.sql','0003_preserve_rest_arrangements.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(text){let args=[];return{bind(...v){args=v;return this;},async first(){return sql.prepare(text).get(...args)||null;},async all(){return{results:sql.prepare(text).all(...args)};},async run(){return{meta:{changes:Number(sql.prepare(text).run(...args).changes)}};}};},async batch(v){sql.exec('BEGIN');try{const result=[];for(const s of v)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return{sql,DB,APP_ORIGIN:origin,PUBLISH_TOKEN:'test-publisher-token-never-production',ASSETS:{fetch(){return new Response('fixture');}}};
}
async function owner(e,key='fixture-key'){
 e.sql.prepare("INSERT OR REPLACE INTO auth_credential VALUES(1,?,'key',0,'[]',?)").run(key,Date.now());const token='a'.repeat(43);
 const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('base64url');
 const epoch=e.sql.prepare('SELECT epoch FROM auth_control').get().epoch;
 e.sql.prepare('INSERT OR REPLACE INTO auth_sessions VALUES(?,?,?,?,?)').run(digest,epoch,key,Date.now(),Date.now()+100000);
 return '__Host-second_algorithm='+token;
}
const call=(e,p,{cookie,method='GET',body,publisher=false,crossOrigin=false}={})=>worker.fetch(new Request(origin+p,{method,headers:{...(cookie?{cookie}:{}),...(publisher?{authorization:'Bearer '+e.PUBLISH_TOKEN}:{}),...(method!=='GET'?{'content-type':'application/json',origin:crossOrigin?'https://other.example':origin}:{})},body:body===undefined?undefined:JSON.stringify(body)}),e);
const read=async(e,p,cookie)=>(await call(e,p,{cookie})).json();
test('service resources remain inside the owner boundary, publisher endpoints require a separate secret',async()=>{
 const e=environment();for(const p of ['/api/settings','/api/balances','/api/storage/usage','/api/push/status'])assert.equal((await call(e,p)).status,401);
 assert.equal((await call(e,'/api/services/report',{method:'POST',body:{}})).status,401);
 const cookie=await owner(e);assert.equal((await call(e,'/api/automation/claim',{cookie,method:'POST',body:{runId:'2026-10-29'}})).status,401);e.sql.close();
});
test('settings default to rest, enforce CAS/origin and consume one permission atomically without consuming later arrangements on retry',async()=>{
 const e=environment(),cookie=await owner(e);const initial=await read(e,'/api/settings',cookie);
 assert.equal(initial.restRequested,true);assert.equal(initial.revision,0);assert.equal(initial.automation.configured,false);
 assert.equal((await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:0,restRequested:false},crossOrigin:true})).status,403);
 const saved=await (await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:0,restRequested:false,goal:'模型与算法',temporaryRequested:true,temporaryRequestText:'补充测试边界'}})).json();assert.equal(saved.revision,1);
 const claimed=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-29'}})).json();assert.equal(claimed.rest,false);assert.equal(claimed.temporaryRequest.text,'补充测试边界');
 let current=await read(e,'/api/settings',cookie);assert.equal(current.restRequested,true);assert.equal(current.temporaryRequested,false);assert.equal(current.revision,2);
 assert.equal((await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:1,goal:'stale'}})).status,409);
 await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:2,restRequested:false}});
 const retry=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-29'}})).json();assert.equal(retry.claimedAt,claimed.claimedAt);
 current=await read(e,'/api/settings',cookie);assert.equal(current.restRequested,false);assert.equal(current.revision,3);
 assert.equal((await call(e,'/api/automation/complete',{publisher:true,method:'POST',body:{runId:'2026-10-29',outcome:'failed'}})).status,200);
 const second=await (await call(e,'/api/automation/complete',{publisher:true,method:'POST',body:{runId:'2026-10-29',outcome:'published'}})).json();assert.equal(second.outcome,'failed');e.sql.close();
});
test('rest-day claims preserve future publication requirements and revision until an authorized next-day claim consumes once',async()=>{
 const e=environment(),cookie=await owner(e);
 const saved=await (await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:0,goal:'synthetic learning goal',temporaryRequested:true,temporaryRequestText:'synthetic next publication request'}})).json();
 assert.equal(saved.restRequested,true);assert.equal(saved.revision,1);const requestId=saved.temporaryRequestId;
 const rest=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-30'}})).json();assert.equal(rest.rest,true);
 let current=await read(e,'/api/settings',cookie);assert.equal(current.temporaryRequestId,requestId);assert.equal(current.temporaryRequestText,saved.temporaryRequestText);assert.equal(current.revision,1);assert.equal(current.updatedAt,saved.updatedAt);
 await call(e,'/api/automation/complete',{publisher:true,method:'POST',body:{runId:'2026-10-30',outcome:'rest'}});
 await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:1,restRequested:false}});
 const oldRetry=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-30'}})).json();assert.equal(oldRetry.rest,true);
 current=await read(e,'/api/settings',cookie);assert.equal(current.restRequested,false);assert.equal(current.revision,2);assert.equal(current.temporaryRequestId,requestId);
 const authorized=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-31'}})).json();assert.equal(authorized.rest,false);assert.equal(authorized.temporaryRequest.id,requestId);
 current=await read(e,'/api/settings',cookie);assert.equal(current.restRequested,true);assert.equal(current.temporaryRequested,false);assert.equal(current.revision,3);assert.equal(current.goal,saved.goal);
 const later=await (await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:3,temporaryRequested:true,temporaryRequestText:'synthetic later request'}})).json();
 const activeRetry=await (await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-31'}})).json();assert.equal(activeRetry.temporaryRequest.id,requestId);
 current=await read(e,'/api/settings',cookie);assert.equal(current.temporaryRequestId,later.temporaryRequestId);assert.equal(current.temporaryRequestText,later.temporaryRequestText);assert.equal(current.revision,4);e.sql.close();
});
test('quota issuance never becomes an invented remaining balance, failed/out-of-order reports preserve verified values',async()=>{
 const now=Date.now(),base={verified:true,issuedAmount:12.5,remainingAmount:null,expiresAt:'2027-01-01',updatedAt:now,source:'synthetic-test-fixture',claim:'unknown'};
 const a=mergeBalance(emptyBalances(),base);assert.equal(a.issuedAmount,12.5);assert.equal(a.remainingAmount,null);assert.equal(a.remainingVerified,false);
 const failed=mergeBalance(a,{verified:false,attemptedAt:now+1});assert.equal(failed.updatedAt,now);assert.equal(failed.updateFailed,true);
 assert.deepEqual(mergeBalance(failed,{...base,updatedAt:now-1}),failed);
 assert.throws(()=>mergeBalance(a,{...base,issuedAmount:-1,updatedAt:now+2}));
 const e=environment(),cookie=await owner(e);assert.equal((await read(e,'/api/balances',cookie)).remainingAmount,null);
 assert.equal((await call(e,'/api/services/report',{publisher:true,method:'POST',body:{balances:base}})).status,200);
 assert.equal((await read(e,'/api/balances',cookie)).issuedAmount,12.5);
 assert.equal(e.sql.prepare('SELECT count(*) AS n FROM service_snapshot').get().n,1);
 await call(e,'/api/services/report',{publisher:true,method:'POST',body:{balances:{verified:false,attemptedAt:now+2}}});assert.equal((await read(e,'/api/balances',cookie)).issuedAmount,12.5);e.sql.close();
});
test('storage distinguishes project/account measurement and leaves failed database size unknown',()=>{
 const now=Date.now();let value=mergeStorage(emptyStorage(),{pools:[{id:'static',verified:true,usedBytes:856311,checkedAt:now},{id:'d1',verified:false,attemptedAt:now},{id:'onedrive',verified:true,usedBytes:4000,limitBytes:100000,projectBytes:100,checkedAt:now}]});
 assert.equal(value.pools[1].usedBytes,856311);assert.equal(value.pools[0].usedBytes,null);assert.equal(value.pools[2].projectBytes,100);assert.equal(value.policy.kv,false);
 value=mergeStorage(value,{pools:[{id:'static',verified:false,attemptedAt:now+1}]});assert.equal(value.pools[1].usedBytes,856311);assert.equal(value.pools[1].updateFailed,true);
 assert.throws(()=>mergeStorage(value,{pools:[{id:'fake-db',verified:false,attemptedAt:now}]}));
});
test('repeated issuance evidence cannot roll back newer verified remaining credits or erase a same-time balance',()=>{
 const now=Date.now(),issued={verified:true,issuedAmount:12.5,remainingAmount:null,expiresAt:'2027-01-01',updatedAt:now-1000,source:'synthetic-issuance',claim:'claimed'};
 const measured=mergeBalance(emptyBalances(),{...issued,remainingAmount:9.25,remainingVerified:true,updatedAt:now,source:'synthetic-account-check'});
 const oldFile=mergeBalance(measured,{...issued,attemptedAt:now+1});assert.equal(oldFile.remainingAmount,9.25);assert.equal(oldFile.updatedAt,now);assert.equal(oldFile.source,'synthetic-account-check');
 const sameTime=mergeBalance(measured,{...issued,updatedAt:now,attemptedAt:now+2});assert.equal(sameTime.remainingAmount,9.25);assert.equal(sameTime.remainingVerified,true);assert.equal(sameTime.source,'synthetic-account-check');
 const newCycle=mergeBalance(sameTime,{...issued,updatedAt:now,attemptedAt:now+3,expiresAt:'2027-02-01'});assert.equal(newCycle.remainingAmount,null);assert.equal(newCycle.remainingVerified,false);
});
test('concurrent storage and credit reports merge without dropping the other service field',async()=>{
 const e=environment(),cookie=await owner(e),now=Date.now();
 const responses=await Promise.all([
  call(e,'/api/services/report',{publisher:true,method:'POST',body:{balances:{verified:true,issuedAmount:12.5,remainingAmount:null,expiresAt:'2027-01-01',updatedAt:now,source:'synthetic-concurrent-fixture',claim:'unknown'}}}),
  call(e,'/api/services/report',{publisher:true,method:'POST',body:{storage:{pools:[{id:'static',verified:true,usedBytes:4567,checkedAt:now}]}}})
 ]);assert(responses.every(r=>r.status===200));assert.equal((await read(e,'/api/balances',cookie)).issuedAmount,12.5);assert.equal((await read(e,'/api/storage/usage',cookie)).pools[1].usedBytes,4567);e.sql.close();
});
test('owner replacement cannot inherit old settings, snapshots or push subscriptions',async()=>{
 const e=environment(),cookie=await owner(e);await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:0,goal:'private',restRequested:false}});
 e.VAPID_PUBLIC_KEY='test';e.VAPID_PRIVATE_KEY='test';e.VAPID_SUBJECT='https://example.com/';
 await call(e,'/api/push/register',{cookie,method:'POST',body:{endpoint:'https://web.push.apple.com/owner-isolation',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}});
 assert.equal((await read(e,'/api/push/status',cookie)).deviceIds.length,1);
 const replacement=await owner(e,'replacement-key');const current=await read(e,'/api/settings',replacement);assert.equal(current.goal,'');assert.equal(current.restRequested,true);
 assert.deepEqual((await read(e,'/api/push/status',replacement)).deviceIds,[]);e.sql.close();
});
test('same-day claims are isolated across owner replacement and epoch rotation',async()=>{
 const e=environment();let cookie=await owner(e);
 await call(e,'/api/settings',{cookie,method:'PUT',body:{baseRevision:0,restRequested:false}});
 let first=await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-30'}});assert.equal(first.status,200);assert.equal((await first.json()).rest,false);
 e.sql.exec('UPDATE auth_control SET epoch=epoch+1');cookie=await owner(e);
 const rotated=await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-30'}});assert.equal(rotated.status,200);assert.equal((await rotated.json()).rest,true);
 await owner(e,'replacement-key');const replaced=await call(e,'/api/automation/claim',{publisher:true,method:'POST',body:{runId:'2026-10-30'}});assert.equal(replaced.status,200);assert.equal((await replaced.json()).rest,true);
 assert.equal(e.sql.prepare('SELECT count(*) AS n FROM service_runs').get().n,3);e.sql.close();
});
test('push registers only explicitly allowed endpoints; missing service configuration remains honest',async()=>{
 assert.equal(subscriptionValid({endpoint:'https://evil.example/push',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}),false);
 const e=environment(),cookie=await owner(e);let status=await read(e,'/api/push/status',cookie);assert.equal(status.configured,false);
 const subscription={endpoint:'https://web.push.apple.com/test',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
 assert.equal((await call(e,'/api/push/register',{cookie,method:'POST',body:subscription})).status,409);
 e.VAPID_PUBLIC_KEY='test';e.VAPID_PRIVATE_KEY='test';e.VAPID_SUBJECT='https://example.com/';
 assert.equal((await call(e,'/api/push/register',{cookie,method:'POST',body:subscription})).status,200);
 const connected=await read(e,'/api/push/status',cookie);assert.equal(connected.deviceCount,1);
 const endpointId=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint))).toString('hex');
 assert.deepEqual(connected.deviceIds,[endpointId]);assert(!JSON.stringify(connected).includes(subscription.endpoint));assert(!JSON.stringify(connected).includes(subscription.keys.p256dh));
 await call(e,'/api/push/register',{cookie,method:'POST',body:subscription});assert.equal((await read(e,'/api/push/status',cookie)).deviceCount,1);
 await call(e,'/api/push/unregister',{cookie,method:'POST',body:{endpoint:subscription.endpoint}});assert.equal((await read(e,'/api/push/status',cookie)).deviceCount,0);assert.deepEqual((await read(e,'/api/push/status',cookie)).deviceIds,[]);e.sql.close();
});
test('management output is reduced to measured bytes and rest never requires a model',()=>{
 assert.equal(parseWranglerInfo('banner\n{"database_size":69632,"uuid":"never-forward"}\n'),69632);
 assert.equal(parseWranglerInfo('{"file_size":8192}'),8192);
 assert.throws(()=>parseWranglerInfo('{"database_size":null}'));
 assert.equal(runDecision({rest:true,completedAt:null}),'rest');
 assert.equal(runDecision({rest:false,completedAt:Date.now()}),'complete');
 assert.equal(runDecision({rest:false,completedAt:null}),'run');
});
