// Temporary, private transport context. The protected static revision remains the source.
export const CLOUD_QUESTION_ROUTE = 'cloud-v1';
export const MAX_CLOUD_CHAPTER_BYTES = 512 * 1024;
export const CLOUD_CONTEXT_TTL = 48 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const ownerGuard = 'EXISTS(SELECT 1 FROM auth_control WHERE id=1 AND epoch=?) AND EXISTS(SELECT 1 FROM auth_credential WHERE id=1 AND credential_id=?)';
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
const problem = message => Object.assign(Error(message), { contextMessage: message });
const safeAsset = value => typeof value === 'string' && /^\/library\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..');
export const cloudQuestionsEnabled = env => env.API_CLOUD_ENABLED === true || env.API_CLOUD_ENABLED === 'true';

async function boundedText(response) {
  if (!response.ok) throw problem('固定版本章节暂不可用');
  if (Number(response.headers.get('content-length') || 0) > MAX_CLOUD_CHAPTER_BYTES) {
    await response.body?.cancel();
    throw problem('本章超过云端答疑传输上限，问题尚未提交，请联系维护者处理');
  }
  const reader = response.body?.getReader();
  if (!reader) throw problem('固定版本章节暂不可用');
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > MAX_CLOUD_CHAPTER_BYTES) {
      await reader.cancel();
      throw problem('本章超过云端答疑传输上限，问题尚未提交，请联系维护者处理');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.trim()) throw problem('固定版本章节暂不可用');
  return text;
}

export async function prepareCloudQuestionContext(env, session, row, now = Date.now()) {
  const old = await env.DB.prepare(`SELECT * FROM question_cloud_contexts
    WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=?`)
    .bind(session.ownerScope, session.epoch, row.chapter_id, row.revision).first();
  if (old) {
    if (old.document_url !== row.document_url || old.markdown_url !== row.markdown_url
      || encoder.encode(old.markdown).length > MAX_CLOUD_CHAPTER_BYTES || await sha(old.markdown) !== old.digest)
      throw problem('固定版本章节上下文无法核对，问题尚未提交');
    return { ...old, expires_at: now + CLOUD_CONTEXT_TTL };
  }
  const count = await env.DB.prepare('SELECT COUNT(*) n FROM question_cloud_contexts WHERE owner_scope=? AND epoch=?')
    .bind(session.ownerScope, session.epoch).first();
  if (count.n >= 32) throw problem('待处理的章节答疑较多，请先核对已有任务');
  if (!safeAsset(row.document_url) || !safeAsset(row.markdown_url)) throw problem('固定版本章节地址无效');
  const metadata = await env.ASSETS.fetch(new Request('https://assets.internal' + row.document_url));
  if (!metadata.ok) throw problem('固定版本章节暂不可用');
  const payload = await metadata.json();
  if (payload.revision !== row.revision || typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 1000)
    throw problem('固定版本章节暂不可用');
  const markdown = await boundedText(await env.ASSETS.fetch(new Request('https://assets.internal' + row.markdown_url)));
  return { owner_scope: session.ownerScope, epoch: session.epoch, chapter_id: row.chapter_id,
    revision: row.revision, document_url: row.document_url, markdown_url: row.markdown_url,
    title: payload.title, digest: await sha(markdown), markdown, created_at: now, expires_at: now + CLOUD_CONTEXT_TTL };
}

export function cloudContextStatement(env, session, context) {
  return env.DB.prepare(`INSERT INTO question_cloud_contexts
    (owner_scope,epoch,chapter_id,revision,document_url,markdown_url,title,digest,markdown,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${ownerGuard}
    ON CONFLICT(owner_scope,epoch,chapter_id,revision) DO UPDATE SET expires_at=MAX(question_cloud_contexts.expires_at,excluded.expires_at)
    WHERE question_cloud_contexts.digest=excluded.digest AND question_cloud_contexts.document_url=excluded.document_url
      AND question_cloud_contexts.markdown_url=excluded.markdown_url`)
    .bind(context.owner_scope, context.epoch, context.chapter_id, context.revision, context.document_url,
      context.markdown_url, context.title, context.digest, context.markdown, context.created_at, context.expires_at,
      session.epoch, session.credentialId);
}

export async function readCloudQuestionContext(env, row) {
  const context = await env.DB.prepare(`SELECT * FROM question_cloud_contexts
    WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=? AND digest=?`)
    .bind(row.owner_scope, row.epoch, row.chapter_id, row.revision, row.context_digest).first();
  if (!context || context.document_url !== row.document_url || context.markdown_url !== row.markdown_url
    || encoder.encode(context.markdown).length > MAX_CLOUD_CHAPTER_BYTES || await sha(context.markdown) !== context.digest)
    throw Error('固定版本章节上下文暂不可用');
  return { id: row.chapter_id, title: context.title, revision: row.revision, digest: context.digest, markdown: context.markdown };
}

const unfinishedReference = `EXISTS(SELECT 1 FROM question_turns q WHERE q.owner_scope=question_cloud_contexts.owner_scope
  AND q.epoch=question_cloud_contexts.epoch AND q.chapter_id=question_cloud_contexts.chapter_id
  AND q.revision=question_cloud_contexts.revision AND q.execution_route='cloud-v1' AND q.status IN ('pending','running','failed'))`;
export function completedCloudContextStatement(env, row) {
  return env.DB.prepare(`DELETE FROM question_cloud_contexts WHERE owner_scope=? AND epoch=? AND chapter_id=? AND revision=?
    AND NOT ${unfinishedReference}`).bind(row.owner_scope, row.epoch, row.chapter_id, row.revision);
}
export async function collectCloudQuestionContexts(env, now = Date.now()) {
  // Never discard the only fixed input for an unresolved or unknown paid result.
  await env.DB.prepare(`DELETE FROM question_cloud_contexts WHERE expires_at<=? AND NOT ${unfinishedReference}`).bind(now).run();
}
