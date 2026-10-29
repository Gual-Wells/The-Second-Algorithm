// Service control never runs a model. Publication work stays in the local Codex runner.
const enc = new TextEncoder();
const json = (v, status=200) => new Response(JSON.stringify(v), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const ownerHash = async value => {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(`second-algorithm-owner:${value}`)));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
};
const sameOrigin=(r,e)=>r.headers.get('origin')===e.APP_ORIGIN;
const rowGuard=`EXISTS(SELECT 1 FROM auth_control WHERE id=1 AND epoch=?) AND EXISTS(SELECT 1 FROM auth_credential WHERE id=1 AND credential_id=?)`;
const finite=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const stamp=(v)=>Number.isSafeInteger(v)&&v>0&&v<=Date.now()+300_000;
const short=(v,n=2000)=>typeof v==='string'&&v.length<=n;
const date=(v)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export const publisherPaths=new Set(['/api/services/report','/api/automation/claim','/api/automation/complete','/api/notifications/send']);
export function isPublisher(request,env){
  const supplied=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!supplied||typeof env.PUBLISH_TOKEN!=='string'||env.PUBLISH_TOKEN.length<24)return false;
  let difference=supplied.length^env.PUBLISH_TOKEN.length;
  for(let i=0;i<Math.max(supplied.length,env.PUBLISH_TOKEN.length);i++)difference|=(supplied.charCodeAt(i)||0)^(env.PUBLISH_TOKEN.charCodeAt(i)||0);
  return difference===0;
}
async function currentOwner(env){
  const row=await env.DB.prepare('SELECT c.epoch,k.credential_id AS credentialId FROM auth_control c JOIN auth_credential k ON k.id=1 WHERE c.id=1').first();
  return row?{...row,ownerScope:await ownerHash(row.credentialId)}:null;
}
async function control(env,s){return env.DB.prepare('SELECT * FROM service_control WHERE owner_scope=? AND epoch=?').bind(s.ownerScope,s.epoch).first();}
async function ensureControl(env,s){
  await env.DB.prepare(`INSERT OR IGNORE INTO service_control(owner_scope,epoch) SELECT ?,? WHERE ${rowGuard}`)
    .bind(s.ownerScope,s.epoch,s.epoch,s.credentialId).run();
}
function controlView(row,activeRun=null){return {
  goal:row?.goal||'',restRequested:row?.rest_requested!==0,
  temporaryRequested:Boolean(row?.temporary_request_id),temporaryRequestText:row?.temporary_request_text||'',
  temporaryRequestId:row?.temporary_request_id||null,revision:row?.revision||0,updatedAt:row?.updated_at||null,
  automation:{configured:Boolean(row?.runner_configured),runnerLastSeenAt:row?.runner_seen_at||null,
    schedule:'05:00',timeZone:'Asia/Shanghai',activeRun}
};}
async function settings(env,s){
  const [row,run]=await Promise.all([control(env,s),env.DB.prepare(`SELECT run_id,claimed_at FROM service_runs WHERE owner_scope=? AND epoch=? AND rest_requested=0 AND completed_at IS NULL ORDER BY claimed_at DESC LIMIT 1`).bind(s.ownerScope,s.epoch).first()]);
  return controlView(row,run?{runId:run.run_id,startedAt:run.claimed_at}:null);
}
export function emptyBalances(){return {provider:'openai-api-credits',issuedAmount:null,remainingAmount:null,remainingVerified:false,currency:'USD',expiresAt:null,updatedAt:null,verified:false,source:null,claim:'unknown',updateFailed:false,attemptedAt:null};}
const pool=(id,name,status)=>({id,name,usedBytes:null,limitBytes:null,remainingBytes:null,projectBytes:null,verified:false,checkedAt:null,attemptedAt:null,updateFailed:false,status});
export function emptyStorage(){return {pools:[pool('d1','第二算法 · D1','unknown'),pool('static','第二算法 · 正式章节','unknown'),pool('onedrive','OneDrive · 账户共享','not-configured')],policy:{chapterBodies:'protected-static',readerState:'d1',archive:'onedrive-project-subfolder',kv:false}};}
async function snapshot(env,s){
  const row=await env.DB.prepare('SELECT value_json FROM service_snapshot WHERE owner_scope=? AND epoch=?').bind(s.ownerScope,s.epoch).first();
  return row?JSON.parse(row.value_json):{balances:emptyBalances(),storage:emptyStorage()};
}
async function reportSnapshot(env,s,value){
  for(let attempt=0;attempt<3;attempt++){
    const row=await env.DB.prepare('SELECT value_json,revision FROM service_snapshot WHERE owner_scope=? AND epoch=?').bind(s.ownerScope,s.epoch).first();
    const prior=row?JSON.parse(row.value_json):{balances:emptyBalances(),storage:emptyStorage()};
    const next={balances:value.balances?mergeBalance(prior.balances,value.balances):prior.balances,
      storage:value.storage?mergeStorage(prior.storage,value.storage):prior.storage};
    const changed=await env.DB.prepare(`INSERT INTO service_snapshot(owner_scope,epoch,value_json,updated_at,revision) SELECT ?,?,?,?,1 WHERE ${rowGuard} ON CONFLICT(owner_scope,epoch) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at,revision=service_snapshot.revision+1 WHERE service_snapshot.revision=? RETURNING revision`).bind(s.ownerScope,s.epoch,JSON.stringify(next),Date.now(),s.epoch,s.credentialId,row?.revision||0).first();
    if(changed)return next;
  }
  return null;
}
export function mergeBalance(prior,value){
  if(!value||typeof value!=='object'||!stamp(value.attemptedAt??value.updatedAt))throw Error('额度核对时间无效');
  const attemptedAt=value.attemptedAt??value.updatedAt;
  if(attemptedAt<(prior.attemptedAt||0))return prior;
  if(value.verified===false)return {...prior,attemptedAt,updateFailed:true};
  if(value.verified!==true||!stamp(value.updatedAt)||!short(value.source,160)||!['unknown','claimed','unclaimed'].includes(value.claim))throw Error('额度记录无效');
  for(const key of ['issuedAmount','remainingAmount'])if(value[key]!==null&&value[key]!==undefined&&(!finite(value[key])||value[key]>1_000_000))throw Error('额度单位无效');
  if(value.expiresAt!==null&&value.expiresAt!==undefined&&!date(value.expiresAt))throw Error('额度到期日无效');
  // Re-reading a local issuance file does not make its original evidence newer.
  if(prior.updatedAt&&value.updatedAt<prior.updatedAt)return {...prior,attemptedAt};
  const next={...emptyBalances(),issuedAmount:value.issuedAmount??null,remainingAmount:value.remainingAmount??null,
    remainingVerified:finite(value.remainingAmount)&&value.remainingVerified===true,expiresAt:value.expiresAt??null,
    updatedAt:value.updatedAt,verified:true,source:value.source,claim:value.claim,attemptedAt,updateFailed:false};
  const newCycle=prior.expiresAt&&next.expiresAt&&next.expiresAt>prior.expiresAt;
  if(value.updatedAt===prior.updatedAt&&prior.remainingVerified&&!next.remainingVerified&&!newCycle){
    next.remainingAmount=prior.remainingAmount;next.remainingVerified=true;next.source=prior.source;
  }
  return next;
}
export function mergeStorage(prior,value){
  if(!value||!Array.isArray(value.pools)||value.pools.length>3)throw Error('存储记录无效');
  const result=structuredClone(prior),seen=new Set();
  for(const report of value.pools){
    const index=result.pools.findIndex(p=>p.id===report.id);
    if(index<0||seen.has(report.id)||!stamp(report.attemptedAt??report.checkedAt))throw Error('存储核对时间无效');
    seen.add(report.id);const old=result.pools[index],attemptedAt=report.attemptedAt??report.checkedAt;
    if(attemptedAt<(old.attemptedAt||0))continue;
    if(report.verified===false){result.pools[index]={...old,attemptedAt,updateFailed:true,status:old.verified?old.status:(report.status==='not-configured'?'not-configured':'unknown')};continue;}
    if(report.verified!==true||!stamp(report.checkedAt)||!Number.isSafeInteger(report.usedBytes)||report.usedBytes<0)throw Error('存储大小无效');
    const next={...old,usedBytes:report.usedBytes,verified:true,checkedAt:report.checkedAt,attemptedAt,updateFailed:false,status:'ready'};
    for(const key of ['limitBytes','remainingBytes','projectBytes']){
      const v=report[key]??null;if(v!==null&&(!Number.isSafeInteger(v)||v<0))throw Error('存储单位无效');next[key]=v;
    }
    result.pools[index]=next;
  }
  return result;
}
export function subscriptionValid(v){
  let u;try{u=new URL(v?.endpoint);}catch{return false;}
  return short(v.endpoint,1200)&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
    (u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.push.services.mozilla.com'))&&
    /^[A-Za-z0-9_-]{80,200}$/.test(v.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{12,50}$/.test(v.keys?.auth||'');
}
const pushConfigured=env=>Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
async function sendQueued(env,s){
  if(!pushConfigured(env))return {sent:0,configured:false};
  const rows=await env.DB.prepare(`SELECT d.*,s.endpoint,s.p256dh,s.auth FROM service_push_delivery d JOIN service_push s ON s.id=d.subscription_id WHERE s.owner_scope=? AND s.epoch=? AND d.sent_at IS NULL AND d.attempts<4 AND (d.claim_at IS NULL OR d.claim_at<?) ORDER BY d.created_at LIMIT 12`).bind(s.ownerScope,s.epoch,Date.now()-120_000).all();
  let sent=0;
  // Source project's mature Web Push implementation; loaded only for actual deliveries.
  const {rawPayload,sendPushNotification}=rows.results.length?await import('@mmmike/web-push/send'):{};
  for(const row of rows.results){
    const claimed=await env.DB.prepare('UPDATE service_push_delivery SET attempts=attempts+1,claim_at=? WHERE event_id=? AND subscription_id=? AND sent_at IS NULL AND (claim_at IS NULL OR claim_at<?)').bind(Date.now(),row.event_id,row.subscription_id,Date.now()-120_000).run();
    if(!claimed.meta.changes)continue;
    try{
      const ok=await sendPushNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},rawPayload(row.payload_json),{publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY,subject:env.VAPID_SUBJECT},{ttl:3600,urgency:'normal',timeoutMs:10000});
      if(ok){await env.DB.prepare('UPDATE service_push_delivery SET sent_at=?,claim_at=NULL WHERE event_id=? AND subscription_id=?').bind(Date.now(),row.event_id,row.subscription_id).run();sent++;}
      else await env.DB.batch([env.DB.prepare('DELETE FROM service_push_delivery WHERE subscription_id=?').bind(row.subscription_id),env.DB.prepare('DELETE FROM service_push WHERE id=?').bind(row.subscription_id)]);
    }catch{await env.DB.prepare('UPDATE service_push_delivery SET claim_at=NULL WHERE event_id=? AND subscription_id=?').bind(row.event_id,row.subscription_id).run();}
  }
  await env.DB.prepare('DELETE FROM service_push_delivery WHERE created_at<?').bind(Date.now()-30*86400_000).run();
  return {sent,configured:true};
}
export async function publisherServiceRoute(request,env,input){
  if(!isPublisher(request,env))return json({error:'发布身份无效'},401);
  if(request.method!=='POST')return json({error:'不支持此操作'},405);
  const s=await currentOwner(env);if(!s)return json({error:'请先登记账户'},409);
  const path=new URL(request.url).pathname,value=await input(request);
  if(path==='/api/services/report'){
    if(!value.balances&&!value.storage&&!value.runner)return json({error:'没有更新内容'},400);
    if(value.runner&&(value.runner.configured!==true||!stamp(value.runner.seenAt)))return json({error:'后台状态无效'},400);
    let next;
    try{next=value.balances||value.storage?await reportSnapshot(env,s,value):await snapshot(env,s);}catch(e){return json({error:e.message},400);}
    if(!next)return json({error:'服务记录正在更新，请重试'},409);
    if(value.runner){await ensureControl(env,s);
      await env.DB.prepare('UPDATE service_control SET runner_configured=1,runner_seen_at=? WHERE owner_scope=? AND epoch=? AND (runner_seen_at IS NULL OR runner_seen_at<=?)').bind(value.runner.seenAt,s.ownerScope,s.epoch,value.runner.seenAt).run();}
    return json({ok:true,...next});
  }
  if(path==='/api/automation/claim'){
    if(!short(value.runId,80)||!/^\d{4}-\d{2}-\d{2}$/.test(value.runId)||!date(value.runId))return json({error:'运行日期无效'},400);
    await ensureControl(env,s);
    const now=Date.now();
    await env.DB.prepare(`INSERT OR IGNORE INTO service_runs(run_id,owner_scope,epoch,rest_requested,goal,temporary_request_text,temporary_request_id,claimed_at) SELECT ?,owner_scope,epoch,rest_requested,goal,temporary_request_text,temporary_request_id,? FROM service_control WHERE owner_scope=? AND epoch=? AND ${rowGuard}`).bind(value.runId,now,s.ownerScope,s.epoch,s.epoch,s.credentialId).run();
    const row=await env.DB.prepare('SELECT * FROM service_runs WHERE run_id=? AND owner_scope=? AND epoch=?').bind(value.runId,s.ownerScope,s.epoch).first();
    if(!row)return json({error:'该日期已存在其他运行'},409);
    return json({runId:row.run_id,rest:Boolean(row.rest_requested),goal:row.goal,temporaryRequest:row.temporary_request_id?{id:row.temporary_request_id,text:row.temporary_request_text}:null,claimedAt:row.claimed_at,completedAt:row.completed_at,outcome:row.outcome});
  }
  if(path==='/api/automation/complete'){
    if(!short(value.runId,80)||!['published','failed','rest'].includes(value.outcome))return json({error:'完成状态无效'},400);
    const row=await env.DB.prepare('UPDATE service_runs SET completed_at=COALESCE(completed_at,?),outcome=COALESCE(outcome,?) WHERE run_id=? AND owner_scope=? AND epoch=? RETURNING outcome,completed_at').bind(Date.now(),value.outcome,value.runId,s.ownerScope,s.epoch).first();
    if(!row)return json({error:'运行不存在'},404);
    // No study/research material is removed; only old operational claim metadata is bounded.
    await env.DB.prepare('DELETE FROM service_runs WHERE completed_at IS NOT NULL AND claimed_at<?').bind(Date.now()-90*86400_000).run();
    return json({ok:true,outcome:row.outcome,completedAt:row.completed_at});
  }
  if(path==='/api/notifications/send'){
    if(!short(value.eventId,100)||!/^[A-Za-z0-9._:-]+$/.test(value.eventId)||!short(value.title,80)||!value.title||!short(value.body,200)||!short(value.url,300)||!value.url.startsWith('/#/')||/[\r\n]/.test(value.url))return json({error:'提醒内容无效'},400);
    if(!pushConfigured(env))return json({error:'提醒尚未配置'},409);
    const payload=JSON.stringify({title:value.title,body:value.body,url:value.url});
    await env.DB.prepare(`INSERT OR IGNORE INTO service_push_delivery(event_id,subscription_id,payload_json,created_at) SELECT ?,id,?,? FROM service_push WHERE owner_scope=? AND epoch=?`).bind(value.eventId,payload,Date.now(),s.ownerScope,s.epoch).run();
    return json({ok:true,...await sendQueued(env,s)});
  }
  return json({error:'未找到'},404);
}
export async function servicesRoute(request,env,s,input,path){
  if(path==='/api/settings'){
    if(request.method==='GET')return json(await settings(env,s));
    if(request.method!=='PUT')return json({error:'不支持此操作'},405);
    if(!sameOrigin(request,env))return json({error:'来源不允许'},403);
    const v=await input(request);
    if(!Number.isSafeInteger(v.baseRevision)||v.baseRevision<0)return json({error:'设置版本无效'},400);
    if(v.goal!==undefined&&!short(v.goal))return json({error:'学习要求过长'},400);
    if(v.restRequested!==undefined&&typeof v.restRequested!=='boolean')return json({error:'安排无效'},400);
    const hasTemporary=v.temporaryRequested!==undefined||v.temporaryRequestText!==undefined;
    if(hasTemporary&&(typeof v.temporaryRequested!=='boolean'||!short(v.temporaryRequestText)||v.temporaryRequested&&!v.temporaryRequestText.trim()))return json({error:'请填写下次安排'},400);
    if(v.goal===undefined&&v.restRequested===undefined&&!hasTemporary)return json({error:'没有设置可保存'},400);
    await ensureControl(env,s);const old=await control(env,s);
    const next={goal:v.goal===undefined?old.goal:v.goal.trim(),rest:v.restRequested===undefined?old.rest_requested:Number(v.restRequested),text:hasTemporary?(v.temporaryRequested?v.temporaryRequestText.trim():''):old.temporary_request_text,id:hasTemporary?(v.temporaryRequested?crypto.randomUUID():null):old.temporary_request_id};
    const changed=await env.DB.prepare(`UPDATE service_control SET goal=?,rest_requested=?,temporary_request_text=?,temporary_request_id=?,revision=revision+1,updated_at=? WHERE owner_scope=? AND epoch=? AND revision=? AND ${rowGuard} RETURNING revision`).bind(next.goal,next.rest,next.text,next.id,Date.now(),s.ownerScope,s.epoch,v.baseRevision,s.epoch,s.credentialId).first();
    if(!changed)return json({error:'另一设备已有新安排',current:await settings(env,s)},409);
    return json({ok:true,...await settings(env,s)});
  }
  if(path==='/api/balances'&&request.method==='GET')return json((await snapshot(env,s)).balances);
  if(path==='/api/storage/usage'&&request.method==='GET')return json((await snapshot(env,s)).storage);
  if(path==='/api/push/public-key'&&request.method==='GET')return json({publicKey:pushConfigured(env)?env.VAPID_PUBLIC_KEY:'',configured:pushConfigured(env)});
  if(path==='/api/push/status'&&request.method==='GET'){
    const rows=await env.DB.prepare('SELECT id FROM service_push WHERE owner_scope=? AND epoch=? ORDER BY updated_at DESC').bind(s.ownerScope,s.epoch).all();
    const deviceIds=rows.results.map(row=>row.id);
    return json({configured:pushConfigured(env),subscribed:deviceIds.length>0,deviceCount:deviceIds.length,deviceIds});
  }
  if(['/api/push/register','/api/push/unregister'].includes(path)&&request.method==='POST'){
    if(!sameOrigin(request,env))return json({error:'来源不允许'},403);const v=await input(request);
    if(path.endsWith('/register')){
      if(!pushConfigured(env))return json({error:'提醒尚未配置'},409);
      if(!subscriptionValid(v))return json({error:'提醒订阅无效'},400);
      const id=await hash(v.endpoint),now=Date.now();
      await env.DB.prepare(`DELETE FROM service_push_delivery WHERE subscription_id=? AND EXISTS(SELECT 1 FROM service_push WHERE id=? AND (owner_scope<>? OR epoch<>?))`).bind(id,id,s.ownerScope,s.epoch).run();
      await env.DB.prepare(`INSERT INTO service_push(id,owner_scope,epoch,endpoint,p256dh,auth,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${rowGuard} ON CONFLICT(id) DO UPDATE SET owner_scope=excluded.owner_scope,epoch=excluded.epoch,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at`).bind(id,s.ownerScope,s.epoch,v.endpoint,v.keys.p256dh,v.keys.auth,now,now,s.epoch,s.credentialId).run();
    }else{
      if(!short(v.endpoint,1200))return json({error:'提醒订阅无效'},400);const id=await hash(v.endpoint);
      await env.DB.batch([env.DB.prepare('DELETE FROM service_push_delivery WHERE subscription_id=? AND EXISTS(SELECT 1 FROM service_push WHERE id=? AND owner_scope=? AND epoch=?)').bind(id,id,s.ownerScope,s.epoch),env.DB.prepare('DELETE FROM service_push WHERE id=? AND owner_scope=? AND epoch=?').bind(id,s.ownerScope,s.epoch)]);
    }
    return json({ok:true});
  }
  return null;
}
