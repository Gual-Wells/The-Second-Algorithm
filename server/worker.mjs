import { authRoute, sessionFor } from './auth.mjs';
import { servicesRoute, publisherServiceRoute, publisherPaths } from './services.mjs';
import {questionsRoute,questionPublisherRoute} from './questions.mjs';

const MAX_BODY = 65_536;
const encoder = new TextEncoder();
const PUBLIC_FILES = new Set(['/', '/index.html', '/styles.css', '/app.js', '/auth.js', '/sw.js',
  '/manifest.webmanifest', '/robots.txt', '/favicon.ico']);
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function inputJson(request, limit = MAX_BODY) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new InputError('请求过大', 413);
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = []; let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new InputError('请求过大', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object expected');
    return value;
  } catch { throw new InputError('无效请求'); }
}

function safeObject(value, limit) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  let text;
  try { text = JSON.stringify(value); } catch { return false; }
  if (encoder.encode(text).byteLength > limit) return false;
  const pending = [value]; let visited = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++visited > 4096) return false;
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return false;
      if (typeof child === 'number' && !Number.isFinite(child)) return false;
      if (child && typeof child === 'object') pending.push(child);
    }
  }
  return true;
}

export function validStateInput(data) {
  if (!data || typeof data !== 'object' || typeof data.key !== 'string') return false;
  if (!/^(preferences|(?:position|notes):[A-Za-z0-9][A-Za-z0-9._:-]{0,119})$/.test(data.key)) return false;
  if (data.key.startsWith('notes:')) return typeof data.value === 'string' && data.value.length <= 20_000
    && Number.isSafeInteger(data.baseRevision) && data.baseRevision >= 0 && data.baseRevision < Number.MAX_SAFE_INTEGER;
  if (data.baseRevision !== undefined && (!Number.isSafeInteger(data.baseRevision) || data.baseRevision < 0)) return false;
  return safeObject(data.value, data.key === 'preferences' ? 16_384 : 8192);
}

function publicPath(path) {
  return PUBLIC_FILES.has(path) || path.startsWith('/assets/') || path.startsWith('/icons/');
}

function normalizedPath(request) {
  let path;
  try { path = decodeURIComponent(new URL(request.url).pathname); }
  catch { throw new InputError('无效地址'); }
  if (/[\u0000-\u001f\u007f\\%]/.test(path) || path.split('/').some(part => part === '.' || part === '..'))
    throw new InputError('无效地址');
  return path;
}

function assetRequest(request, path) {
  const target = new URL(request.url); target.pathname = path;
  return new Request(target, request);
}

function ownerGuard() {
  return `EXISTS (SELECT 1 FROM auth_control WHERE id = 1 AND epoch = ?)
    AND EXISTS (SELECT 1 FROM auth_credential WHERE id = 1 AND credential_id = ?)`;
}

async function readRecord(env, session, key) {
  const row = await env.DB.prepare(`SELECT value_json, revision, updated_at FROM reader_state
    WHERE owner_scope = ? AND epoch = ? AND state_key = ? AND ${ownerGuard()}`)
    .bind(session.ownerScope, session.epoch, key, session.epoch, session.credentialId).first();
  return row ? { value: JSON.parse(row.value_json), revision: row.revision, updatedAt: row.updated_at } : null;
}

async function stateRoute(request, env, session) {
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT state_key, value_json, revision, updated_at FROM reader_state
      WHERE owner_scope = ? AND epoch = ? AND ${ownerGuard()}`)
      .bind(session.ownerScope, session.epoch, session.epoch, session.credentialId).all();
    const state = Object.create(null);
    for (const row of rows.results || []) state[row.state_key] = {
      value: JSON.parse(row.value_json), revision: row.revision, updatedAt: row.updated_at
    };
    return json({ state });
  }
  if (request.method !== 'PUT') return json({ error: '不支持此操作' }, 405);
  if (request.headers.get('origin') !== env.APP_ORIGIN) return json({ error: '来源不允许' }, 403);
  const data = await inputJson(request);
  if (!validStateInput(data)) return json({ error: '无效阅读记录' }, 400);
  const now = Date.now(), notes = data.key.startsWith('notes:');
  const initialGuard = notes ? `AND (? = 0 OR EXISTS (SELECT 1 FROM reader_state
    WHERE owner_scope = ? AND epoch = ? AND state_key = ? AND revision = ?))` : '';
  const updateGuard = notes ? 'WHERE reader_state.revision = ?' : '';
  const statement = env.DB.prepare(`INSERT INTO reader_state
    (owner_scope, epoch, state_key, value_json, revision, updated_at)
    SELECT ?, ?, ?, ?, 1, ? WHERE ${ownerGuard()} ${initialGuard}
    ON CONFLICT(owner_scope, epoch, state_key) DO UPDATE SET
      value_json = excluded.value_json, revision = reader_state.revision + 1, updated_at = excluded.updated_at
      ${updateGuard} RETURNING revision, updated_at`);
  const values = [session.ownerScope, session.epoch, data.key, JSON.stringify(data.value), now,
    session.epoch, session.credentialId];
  if (notes) values.push(data.baseRevision, session.ownerScope, session.epoch, data.key,
    data.baseRevision, data.baseRevision);
  const written = await statement.bind(...values).first();
  if (!written) {
    const live = await sessionFor(request, env);
    if (!live || live.epoch !== session.epoch || live.ownerScope !== session.ownerScope)
      return json({ error: '登录状态已变化，请重新登录' }, 401);
    return json({ error: '另一设备已有更新，本机笔记已保留。', current: await readRecord(env, session, data.key) }, 409);
  }
  const record = { value: data.value, revision: written.revision, updatedAt: written.updated_at };
  return json({ ok: true, key: data.key, ...record, record });
}

async function route(request, env) {
  const path = normalizedPath(request);
  if (path.startsWith('/auth/')) return authRoute(request, env, request.method === 'POST' ? await inputJson(request) : {});
  if (path.startsWith('/api/questions/jobs/')) return questionPublisherRoute(request,env,r=>inputJson(r,400_000));
  if (publisherPaths.has(path)) return publisherServiceRoute(request, env, inputJson);
  if (publicPath(path)) {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: '不支持此操作' }, 405);
    return env.ASSETS.fetch(assetRequest(request, path));
  }
  // Everything outside the explicit public shell enters the owner boundary first.
  const session = await sessionFor(request, env);
  if (!session) return json({ error: '请先登录' }, 401);
  let response;
  const service=path.startsWith('/api/questions')?await questionsRoute(request,env,session,inputJson):path.startsWith('/api/')?await servicesRoute(request,env,session,inputJson,path):null;
  if(service) response=service;
  else if (path === '/api/library' && request.method === 'GET') {
    response = await env.ASSETS.fetch(new Request(new URL('/library/catalog.json', request.url)));
  } else if (path === '/api/state') {
    response = await stateRoute(request, env, session);
  } else if (path.startsWith('/library/') && ['GET', 'HEAD'].includes(request.method)) {
    response = await env.ASSETS.fetch(assetRequest(request, path));
  } else response = json({ error: '未找到' }, 404);
  response = new Response(response.body, response);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export default {
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) {
      if (error instanceof InputError) response = json({ error: error.message }, error.status);
      else { console.error('Second Algorithm request failed:', error?.name || 'Error');
        response = json({ error: '暂时无法连接，请稍后重试。' }, 503); }
    }
    const secured = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
    return secured;
  }
};
