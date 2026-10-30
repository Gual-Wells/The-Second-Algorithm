import {isPublisher,questionReplyStatement} from './services.mjs';
const json=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
const id=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const guard='EXISTS(SELECT 1 FROM auth_control WHERE id=1 AND epoch=?) AND EXISTS(SELECT 1 FROM auth_credential WHERE id=1 AND credential_id=?)';
const safeAsset=value=>typeof value==='string'&&/^\/library\/[A-Za-z0-9._/-]+$/.test(value)&&!value.includes('..');
async function asset(env,url){if(!safeAsset(url))throw Error('章节地址无效');const r=await env.ASSETS.fetch(new Request('https://assets.internal'+url));if(!r.ok)throw Error('固定版本章节暂不可用');return r;}
async function currentOwner(env){const row=await env.DB.prepare('SELECT c.epoch,k.credential_id AS credentialId FROM auth_control c JOIN auth_credential k ON k.id=1 WHERE c.id=1').first();if(!row)return null;const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('second-algorithm-owner:'+row.credentialId)));return {...row,ownerScope:btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};}
const view=row=>({id:row.id,question:row.question,answer:row.answer||'',status:row.status,error:row.error||'',createdAt:row.created_at,answeredAt:row.answered_at,readAt:row.read_at,seq:row.seq});
async function catalogDocument(env,chapterId,rev){const catalog=await(await asset(env,'/library/catalog.json')).json();const chapter=catalog.collections?.find(c=>c.id===chapterId&&c.visibility!=='hidden');const document=chapter?.documents?.find(d=>d.revision===rev);if(!document||!safeAsset(document.url)||!safeAsset(document.markdownUrl))return null;return {chapter,document};}
const threadSummarySQL=`SELECT q.chapter_id AS chapterId,q.revision,MIN(q.created_at) AS createdAt,MAX(q.seq) AS latestSeq,
 SUM(CASE WHEN q.status='answered' AND q.read_at IS NULL THEN 1 ELSE 0 END) AS unread,
 (SELECT a.id FROM question_turns a WHERE a.owner_scope=q.owner_scope AND a.epoch=q.epoch AND a.chapter_id=q.chapter_id AND a.revision=q.revision AND a.status='answered' AND a.read_at IS NULL ORDER BY a.seq LIMIT 1) AS firstUnreadQuestionId
 FROM question_turns q WHERE q.owner_scope=? AND q.epoch=? GROUP BY q.chapter_id,q.revision ORDER BY MIN(q.seq)`;
async function readableCatalog(env){
 try{const value=await(await asset(env,'/library/catalog.json')).json();return Array.isArray(value.collections)?value:null;}catch{return null;}
}
function threadIdentity(catalog,chapterId,rev){
 const chapter=catalog.collections.find(c=>c.id===chapterId&&c.visibility!=='hidden');
 const current=chapter?.documents?.find(d=>d.revision===rev);
 const title=current?(chapter.chapterNumber?`第 ${chapter.chapterNumber} 章 · `:'')+chapter.title:chapter?.chapterNumber?`第 ${chapter.chapterNumber} 章 · 历史问答`:'历史问答';
 return {chapterId,revision:rev,title,canAsk:Boolean(current)};
}
const threadViews=(catalog,rows)=>rows.map(row=>({...row,...threadIdentity(catalog,row.chapterId,row.revision)}));
async function selectedThreadIdentity(env,catalog,chapterId,rev,rows){
 const result=threadIdentity(catalog,chapterId,rev);
 if(!result.canAsk&&rows[0]?.document_url)try{const saved=await(await asset(env,rows[0].document_url)).json();if(saved.revision===rev&&typeof saved.title==='string'&&saved.title.trim())result.title=saved.title;}catch{}
 return result;
}
async function acknowledgeTurns(db,session,rows,now){
 const unread=rows.filter(row=>row.status==='answered'&&row.read_at===null);
 if(unread.length)await db.batch(unread.map(row=>db.prepare(`UPDATE question_turns SET read_at=COALESCE(read_at,?) WHERE id=? AND owner_scope=? AND epoch=? AND status='answered' AND ${guard}`).bind(now,row.id,session.ownerScope,session.epoch,session.epoch,session.credentialId)));
}
export async function questionsRoute(request,env,session,input){
 const url=new URL(request.url),db=env.DB,now=Date.now();
 if(request.method==='GET'&&url.pathname==='/api/questions/status'){
  const row=await db.prepare('SELECT COUNT(*) n FROM question_turns WHERE owner_scope=? AND epoch=? AND status=\'answered\' AND read_at IS NULL').bind(session.ownerScope,session.epoch).first();return json({unread:row.n});
 }
 if(request.method==='GET'&&url.pathname==='/api/questions/summary'){
  const catalog=await readableCatalog(env);if(!catalog)return json({error:'章节目录暂不可核对，请稍后重试'},503);
  const {results}=await db.prepare(threadSummarySQL).bind(session.ownerScope,session.epoch).all();return json({threads:threadViews(catalog,results)});
 }
 if(request.method!=='POST')return json({error:'不支持此操作'},405);
 if(request.headers.get('origin')!==env.APP_ORIGIN)return json({error:'来源不允许'},403);
 const b=await input(request);
 if(url.pathname==='/api/questions/open'){
  if(typeof b.chapterId!=='string'||b.chapterId.length>100||!revision(b.revision)||(b.questionId!==undefined&&!id(b.questionId)))return json({error:'章节版本无效'},400);
  if(b.questionId){const target=await db.prepare('SELECT id FROM question_turns WHERE id=? AND owner_scope=? AND epoch=? AND chapter_id=? AND revision=?').bind(b.questionId,session.ownerScope,session.epoch,b.chapterId,b.revision).first();if(!target)return json({error:'这份答疑不存在或当前账户无法访问'},404);}
  const catalog=await readableCatalog(env);if(!catalog)return json({error:'章节目录暂不可核对，请稍后重试'},503);
  const selection=b.questionId?'chapterId=? AND revision=?':"(chapterId=? AND revision=?) OR unread>0";
  const order=b.questionId?'createdAt':"CASE WHEN chapterId=? AND revision=? AND unread>0 THEN 0 WHEN unread>0 THEN 1 ELSE 2 END,createdAt";
  const selectedSQL=`WITH threads AS (${threadSummarySQL}),chosen AS (SELECT * FROM threads WHERE ${selection} ORDER BY ${order} LIMIT 1)
   SELECT t.*,c.firstUnreadQuestionId FROM question_turns t JOIN chosen c ON c.chapterId=t.chapter_id AND c.revision=t.revision WHERE t.owner_scope=? AND t.epoch=? ORDER BY t.seq`;
  const args=[session.ownerScope,session.epoch,b.chapterId,b.revision,...(b.questionId?[]:[b.chapterId,b.revision]),session.ownerScope,session.epoch];
  // One immutable opening snapshot: old replies are acknowledged together;
  // replies committed after this batch retain their unread state.
  const [summary,selected]=await db.batch([
   db.prepare(threadSummarySQL).bind(session.ownerScope,session.epoch),
   db.prepare(selectedSQL).bind(...args),
   db.prepare(`UPDATE question_turns SET read_at=? WHERE owner_scope=? AND epoch=? AND status='answered' AND read_at IS NULL AND ${guard}`).bind(now,session.ownerScope,session.epoch,session.epoch,session.credentialId)
  ]);
  const rows=selected.results||[],chosen=rows[0],chapterId=chosen?.chapter_id||b.chapterId,rev=chosen?.revision||b.revision;
  return json({threads:threadViews(catalog,summary.results||[]),...await selectedThreadIdentity(env,catalog,chapterId,rev,rows),firstUnreadQuestionId:chosen?.firstUnreadQuestionId||null,turns:rows.map(view)});
 }
 if(url.pathname==='/api/questions/thread'){
  if(typeof b.chapterId!=='string'||b.chapterId.length>100||!revision(b.revision))return json({error:'章节版本无效'},400);
  const catalog=await readableCatalog(env);if(!catalog)return json({error:'章节目录暂不可核对，请稍后重试'},503);
  const {results}=await db.prepare('SELECT * FROM question_turns WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=? ORDER BY seq').bind(session.ownerScope,session.epoch,b.chapterId,b.revision).all();
  const firstUnreadQuestionId=results.find(row=>row.status==='answered'&&row.read_at===null)?.id||null;
  // Legacy callers explicitly requested markRead; new readers acknowledge only
  // the answered IDs actually displayed by their still-visible view.
  if(b.markRead===true)await acknowledgeTurns(db,session,results,now);
  return json({...await selectedThreadIdentity(env,catalog,b.chapterId,b.revision,results),firstUnreadQuestionId,turns:results.map(view)});
 }
 if(url.pathname==='/api/questions/seen'){
  if(typeof b.chapterId!=='string'||!revision(b.revision)||!Array.isArray(b.ids)||!b.ids.length||b.ids.length>500||b.ids.some(value=>!id(value))||new Set(b.ids).size!==b.ids.length)return json({error:'阅读确认无效'},400);
  await db.prepare(`UPDATE question_turns SET read_at=COALESCE(read_at,?) WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=? AND status='answered' AND id IN (SELECT value FROM json_each(?)) AND ${guard}`).bind(now,session.ownerScope,session.epoch,b.chapterId,b.revision,JSON.stringify(b.ids),session.epoch,session.credentialId).run();return json({ok:true});
 }
 if(url.pathname==='/api/questions/retry'){
  if(!id(b.id))return json({error:'问题编号无效'},400);
  const row=await db.prepare('SELECT * FROM question_turns WHERE id=? AND owner_scope=? AND epoch=?').bind(b.id,session.ownerScope,session.epoch).first();
  if(!row)return json({error:'问题不存在'},404);
  if(row.error==='outcome_unknown')return json({error:'上次调用结果待核对，暂不重复生成'},409);
  if(row.status==='failed')await db.prepare(`UPDATE question_turns SET status='pending',error=NULL WHERE id=? AND status='failed' AND owner_scope=? AND epoch=? AND ${guard}`).bind(row.id,session.ownerScope,session.epoch,session.epoch,session.credentialId).run();
  return json({ok:true});
 }
 if(url.pathname!=='/api/questions')return json({error:'未找到'},404);
 if(!id(b.id)||typeof b.chapterId!=='string'||b.chapterId.length>100||!revision(b.revision)||typeof b.question!=='string'||!b.question.trim()||b.question.length>6000)return json({error:'问题或章节版本无效'},400);
 const old=await db.prepare('SELECT * FROM question_turns WHERE id=?').bind(b.id).first();
 if(old){if(old.owner_scope!==session.ownerScope||old.epoch!==session.epoch||old.chapter_id!==b.chapterId||old.revision!==b.revision||old.question!==b.question)return json({error:'问题编号已被使用'},409);return json({ok:true,...view(old)});}
 const selected=await catalogDocument(env,b.chapterId,b.revision);if(!selected)return json({error:'章节版本已变化，请重新打开章节'},409);
 const count=await db.prepare("SELECT COUNT(*) n FROM question_turns WHERE owner_scope=? AND epoch=? AND status IN ('pending','running')").bind(session.ownerScope,session.epoch).first();if(count.n>=30)return json({error:'等待处理的问题较多，请稍后再提交'},429);
 await db.prepare(`INSERT INTO question_turns(id,owner_scope,epoch,chapter_id,revision,document_url,markdown_url,question,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(b.id,session.ownerScope,session.epoch,b.chapterId,b.revision,selected.document.url,selected.document.markdownUrl,b.question,now,session.epoch,session.credentialId).run();
 const saved=await db.prepare('SELECT * FROM question_turns WHERE id=? AND owner_scope=? AND epoch=?').bind(b.id,session.ownerScope,session.epoch).first();return saved?json({ok:true,...view(saved)}):json({error:'登录状态已变化'},401);
}
export async function questionPublisherRoute(request,env,input){
 if(!isPublisher(request,env))return json({error:'未授权'},401);
 if(request.method!=='POST')return json({error:'不支持此操作'},405);
 const s=await currentOwner(env);if(!s)return json({job:null});
 const b=await input(request),path=new URL(request.url).pathname,db=env.DB,now=Date.now();
 if(typeof b.claim!=='string'||!/^[a-f0-9]{64}$/.test(b.claim))return json({error:'领取凭据无效'},400);
 const claimHash=await hash(b.claim);
 if(path==='/api/questions/jobs/claim'){
  await db.prepare("UPDATE question_turns SET status='failed',error='outcome_unknown',claim_hash=NULL WHERE owner_scope=? AND epoch=? AND status='running' AND lease_until<?").bind(s.ownerScope,s.epoch,now).run();
  const row=await db.prepare(`SELECT q.* FROM question_turns q WHERE q.owner_scope=? AND q.epoch=? AND q.status='pending' AND NOT EXISTS(SELECT 1 FROM question_turns p WHERE p.owner_scope=q.owner_scope AND p.epoch=q.epoch AND p.chapter_id=q.chapter_id AND p.revision=q.revision AND p.seq<q.seq AND p.status IN ('pending','running','failed')) ORDER BY q.seq LIMIT 1`).bind(s.ownerScope,s.epoch).first();if(!row)return json({job:null});
  const written=await db.prepare(`UPDATE question_turns SET status='running',claim_hash=?,lease_until=? WHERE id=? AND status='pending' AND ${guard} RETURNING id`).bind(claimHash,now+300000,row.id,s.epoch,s.credentialId).first();if(!written)return json({job:null});
  try{
   const payload=await(await asset(env,row.document_url)).json();if(payload.revision!==row.revision)throw Error('固定版本章节不可用');
   const markdown=await(await asset(env,row.markdown_url)).text();
   const {results:messages}=await db.prepare("SELECT id,question,answer FROM question_turns WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=? AND seq<=? ORDER BY seq").bind(s.ownerScope,s.epoch,row.chapter_id,row.revision,row.seq).all();
   return json({job:{id:row.id,chapter:{id:row.chapter_id,title:payload.title,revision:row.revision,digest:await hash(markdown),markdown},messages:messages.flatMap(m=>[{role:'user',content:m.question},...(m.answer?[{role:'assistant',content:m.answer}]:[])])}});
  }catch{await db.prepare("UPDATE question_turns SET status='failed',error='source_unavailable',claim_hash=NULL WHERE id=? AND claim_hash=?").bind(row.id,claimHash).run();return json({error:'固定版本章节暂不可用，问题已保留'},503);}
 }
 const match=path.match(/^\/api\/questions\/jobs\/([a-f0-9-]{36})\/(heartbeat|complete|fail)$/);if(!match)return json({error:'未找到'},404);
 const [,id,action]=match,row=await db.prepare('SELECT * FROM question_turns WHERE id=? AND owner_scope=? AND epoch=?').bind(id,s.ownerScope,s.epoch).first();if(!row)return json({error:'问题不存在'},404);
 if(row.status==='answered'&&action==='complete')return json({ok:true,reused:true});
 if(row.status!=='running'||row.claim_hash!==claimHash||row.lease_until<=now)return json({error:'处理权已失效'},409);
 if(action==='complete'&&(typeof b.answer!=='string'||!b.answer.trim()||b.answer.length>100000))return json({error:'回答无效'},400);
 const set=action==='heartbeat'?'lease_until=?':action==='complete'?"status='answered',answer=?,answered_at=?,claim_hash=NULL,lease_until=NULL,error=NULL":"status='failed',error=?,claim_hash=NULL,lease_until=NULL";
 const args=action==='heartbeat'?[now+300000]:action==='complete'?[b.answer,now]:[b.outcomeUnknown===true?'outcome_unknown':'failed'];
 if(action==='complete'){
  const [changed]=await db.batch([
   db.prepare(`UPDATE question_turns SET ${set} WHERE id=? AND status='running' AND claim_hash=? AND lease_until>? AND owner_scope=? AND epoch=? AND ${guard}`).bind(...args,id,claimHash,now,s.ownerScope,s.epoch,s.epoch,s.credentialId),
   questionReplyStatement(env,row,s,now)
  ]);
  return changed.meta.changes?json({ok:true}):json({error:'处理权已失效'},409);
 }
 const changed=await db.prepare(`UPDATE question_turns SET ${set} WHERE id=? AND status='running' AND claim_hash=? AND lease_until>? AND owner_scope=? AND epoch=? AND ${guard} RETURNING id`).bind(...args,id,claimHash,now,s.ownerScope,s.epoch,s.epoch,s.credentialId).first();return changed?json({ok:true}):json({error:'处理权已失效'},409);
}
