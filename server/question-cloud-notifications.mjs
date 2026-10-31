import { currentQuestionOwner } from './questions.mjs';
import { cloudQuestionsEnabled } from './question-cloud-context.mjs';
import { flushQuestionReplies } from './services.mjs';

const origin = 'https://second-algorithm.pages.dev';
const endpoint = '/api/questions/cloud-wake';
const guard = 'EXISTS(SELECT 1 FROM auth_control WHERE id=1 AND epoch=?) AND EXISTS(SELECT 1 FROM auth_credential WHERE id=1 AND credential_id=?)';
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });

export async function requestCloudQuestionDelivery(env, { fetchImpl = fetch } = {}) {
  if (!cloudQuestionsEnabled(env)) return false;
  const s = await currentQuestionOwner(env); if (!s) return false;
  const queued = await env.DB.prepare(`SELECT 1 AS present FROM service_push_delivery d JOIN service_push p ON p.id=d.subscription_id
    WHERE p.owner_scope=? AND p.epoch=? AND d.event_id LIKE 'question:%' AND d.sent_at IS NULL AND d.attempts<4 LIMIT 1`)
    .bind(s.ownerScope, s.epoch).first();
  const now = Date.now();
  await env.DB.prepare('DELETE FROM question_cloud_wakes WHERE expires_at<=?').bind(now).run();
  if (!queued) return false;
  const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
  const written = await env.DB.prepare(`INSERT INTO question_cloud_wakes(nonce_hash,owner_scope,epoch,expires_at)
    SELECT ?,?,?,? WHERE ${guard}`).bind(await hash(nonce), s.ownerScope, s.epoch, now + 120000, s.epoch, s.credentialId).run();
  if (!written.meta.changes) return false;
  const response = await fetchImpl(origin + endpoint, { method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce }), signal: AbortSignal.timeout(20000) });
  return response.ok;
}

export async function questionCloudWakeRoute(request, env, input, context, options = {}) {
  if (!cloudQuestionsEnabled(env)) return json({ error: '未找到' }, 404);
  if (request.method !== 'POST') return json({ error: '不支持此操作' }, 405);
  const body = await input(request);
  if (Object.keys(body).length !== 1 || typeof body.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(body.nonce))
    return json({ error: '未授权' }, 401);
  const s = await currentQuestionOwner(env); if (!s) return json({ error: '未授权' }, 401);
  const accepted = await env.DB.prepare(`DELETE FROM question_cloud_wakes
    WHERE nonce_hash=? AND owner_scope=? AND epoch=? AND expires_at>? AND ${guard} RETURNING nonce_hash`)
    .bind(await hash(body.nonce), s.ownerScope, s.epoch, Date.now(), s.epoch, s.credentialId).first();
  if (!accepted) return json({ error: '未授权' }, 401);
  // This capability can only wake the already committed question outbox. It cannot run a task.
  const delivery = flushQuestionReplies(env, options).catch(() => {});
  if (context?.waitUntil) context.waitUntil(delivery); else await delivery;
  return json({ ok: true });
}
