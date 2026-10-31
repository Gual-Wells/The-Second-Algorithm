import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../server/worker.mjs';
import { runCloudQuestions } from '../server/question-cloud-adapter.mjs';
import { cloudQuestionAction } from '../server/questions.mjs';
import { collectCloudQuestionContexts, MAX_CLOUD_CHAPTER_BYTES } from '../server/question-cloud-context.mjs';
import { CLOUD_API_SCHEMA } from '../server/shared/cloud-responses.mjs';
import { requestCloudQuestionDelivery, questionCloudWakeRoute } from '../server/question-cloud-notifications.mjs';

const origin = 'https://second-algorithm.pages.dev', revision = 'c'.repeat(64);
function fixture() {
  const sql = new DatabaseSync(':memory:');
  for (const name of readdirSync('migrations').filter(n => n.endsWith('.sql')).sort()) sql.exec(readFileSync('migrations/' + name, 'utf8'));
  const e = { sql, markdown: '固定原文：二分每次排除不可能包含答案的区间。', fetches: 0, keyReads: 0,
    APP_ORIGIN: origin, API_CLOUD_ENABLED: 'true', PUBLISH_TOKEN: 'fixture-publisher-token-not-real', failCompletion: false };
  e.DB = {
    prepare(text) {
      let values = [];
      return { text, bind(...args) { values = args; return this; },
        async first() {
          const value = sql.prepare(text).get(...values) || null;
          if (text.includes('SELECT * FROM question_cloud_contexts') && e.onContextRead) {
            const hook = e.onContextRead; e.onContextRead = null; await hook();
          }
          return value;
        },
        async all() { return { results: sql.prepare(text).all(...values) }; },
        async run() { return { meta: { changes: Number(sql.prepare(text).run(...values).changes) } }; }
      };
    },
    async batch(items) {
      sql.exec('BEGIN');
      try {
        const values = [];
        for (const [index, item] of items.entries()) {
          if (e.failCompletion && index === 1 && items[0].text.includes("status='answered'")) throw Error('fixture notification failure');
          values.push(await item.run());
        }
        sql.exec('COMMIT'); return values;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  e.ASSETS = { async fetch(request) {
    e.fetches++;
    const path = new URL(request.url).pathname;
    if (path === '/library/catalog.json') return Response.json({ collections: [{ id: 'chapter-01', title: '二分',
      documents: [{ revision, url: '/library/doc.json', markdownUrl: '/library/source.md' }] }] });
    if (path === '/library/doc.json') return Response.json({ revision, title: '二分' });
    if (path === '/library/source.md') { e.beforeMarkdown?.(); return new Response(e.markdown); }
    return new Response('', { status: 404 });
  } };
  e.SECOND_SERIES_OPENAI_KEY = { async get() { e.keyReads++; return 'sk-fixture-not-a-real-cloud-key'; } };
  const credential = 'fixture-owner', token = 'a'.repeat(43), now = Date.now();
  sql.prepare("INSERT INTO auth_credential VALUES(1,?,'key',0,'[]',?)").run(credential, now);
  sql.prepare('INSERT INTO auth_sessions VALUES(?,1,?,?,?)').run(createHash('sha256').update(token).digest('base64url'), credential, now, now + 100000);
  e.cookie = '__Host-second_algorithm=' + token;
  return e;
}
function call(e, path, body, publisher = false) {
  return worker.fetch(new Request(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', origin,
    ...(publisher ? { authorization: 'Bearer ' + e.PUBLISH_TOKEN } : { cookie: e.cookie }) }, body: JSON.stringify(body) }), e);
}
const submit = (e, id = crypto.randomUUID(), question = '解释区间为什么可以丢弃') => call(e, '/api/questions', { id, chapterId: 'chapter-01', revision, question });
const count = (e, table) => e.sql.prepare('SELECT COUNT(*) n FROM ' + table).get().n;
const completed = (answer = '不变量保证被排除的区间不含答案。') => ({ id: 'response-fixture', status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ answer }) }] }],
  usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 } });
const stream = value => new Response('data: ' + JSON.stringify({ type: 'response.completed', response: value }) + '\n\n', {
  headers: { 'content-type': 'text/event-stream', 'x-request-id': 'request-fixture' } });

test('cloud is opt-in; cron does nothing while off and newly queued legacy tasks remain on the local runner', async () => {
  const e = fixture(); try {
    delete e.API_CLOUD_ENABLED;
    assert.deepEqual(await runCloudQuestions(e, { fetchImpl() { throw Error('must not call API'); } }), { disabled: true });
    assert.equal((await submit(e)).status, 200);
    assert.equal(e.sql.prepare('SELECT execution_route FROM question_turns').get().execution_route, 'legacy');
    assert.equal(count(e, 'question_cloud_contexts'), 0);
    e.API_CLOUD_ENABLED = 'true';
    assert.deepEqual(await runCloudQuestions(e), { empty: true });
    const claimed = await call(e, '/api/questions/jobs/claim', { claim: 'f'.repeat(64) }, true);
    assert((await claimed.json()).job);
    assert.equal(e.keyReads, 0);
  } finally { e.sql.close(); }
});

test('cloud submission uses one private fixed context; cron needs neither static assets nor publisher secret', async () => {
  const e = fixture(); try {
    const first = crypto.randomUUID(), second = crypto.randomUUID();
    assert.equal((await submit(e, first)).status, 200);
    assert.equal((await submit(e, second, '继续解释')).status, 200);
    assert.equal(count(e, 'question_cloud_contexts'), 1);
    const queued = e.sql.prepare('SELECT execution_route,context_digest FROM question_turns WHERE id=?').get(first);
    assert.equal(queued.execution_route, 'cloud-v1');
    assert.equal(queued.context_digest, createHash('sha256').update(e.markdown).digest('hex'));
    const local = await call(e, '/api/questions/jobs/claim', { claim: 'f'.repeat(64) }, true);
    assert.equal((await local.json()).job, null);
    delete e.ASSETS; delete e.PUBLISH_TOKEN;
    let calls = 0;
    const fetchImpl = async (url, request) => {
      calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(request.body), input = JSON.parse(body.input);
      assert.equal(body.store, false); assert.equal(body.stream, true); assert.equal(body.tools, undefined);
      assert.equal(body.reasoning.effort, 'xhigh'); assert.equal(input.chapter.markdown, e.markdown);
      if (calls === 2) assert(input.messages.some(m => m.role === 'assistant'));
      return stream(completed());
    };
    assert.equal((await runCloudQuestions(e, { fetchImpl })).completed, true);
    assert.equal(count(e, 'question_cloud_contexts'), 1, 'the following question still needs the context');
    assert.equal((await runCloudQuestions(e, { fetchImpl })).completed, true);
    assert.equal(count(e, 'question_cloud_contexts'), 0);
    assert.equal(count(e, 'api_cloud_runs'), 2); assert.equal(count(e, 'api_cloud_streams'), 2);
    assert.equal(e.keyReads, 2);
    assert.equal(e.sql.prepare("SELECT COUNT(*) n FROM question_turns WHERE status='answered'").get().n, 2);
    const receipt = e.sql.prepare('SELECT response_json,usage_json,request_id FROM api_cloud_runs LIMIT 1').get();
    assert.equal(JSON.parse(receipt.response_json).status, 'completed'); assert(receipt.usage_json); assert.equal(receipt.request_id, 'request-fixture');
  } finally { e.sql.close(); }
});

test('a completed durable response survives business completion rollback and replays without another paid request', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id); e.failCompletion = true;
    const reports = []; e.SERIES_USAGE = { async report(value) { reports.push(value); } };
    let paid = 0; const fetchImpl = async () => { paid++; return stream(completed()); };
    assert.equal((await runCloudQuestions(e, { fetchImpl })).deliveryPending, true);
    assert.equal(e.sql.prepare('SELECT status,answer FROM question_turns WHERE id=?').get(id).status, 'running');
    assert.equal(e.sql.prepare('SELECT outcome FROM api_cloud_runs').get().outcome, 'completed');
    assert.equal(count(e, 'question_cloud_contexts'), 1);
    e.sql.prepare('UPDATE question_turns SET lease_until=? WHERE id=?').run(Date.now() - 1, id);
    e.failCompletion = false; delete e.SECOND_SERIES_OPENAI_KEY; e.API_CLOUD_MODEL = 'gpt-fixture-new-model';
    const recovered = await runCloudQuestions(e, { fetchImpl });
    assert.equal(recovered.completed, true); assert.equal(recovered.reused, true); assert.equal(paid, 1);
    assert.equal(e.sql.prepare('SELECT status,api_attempt FROM question_turns WHERE id=?').get(id).api_attempt, 0);
    assert.equal(count(e, 'question_cloud_contexts'), 0);
    assert.equal(reports.length, 2); assert.equal(reports[0].responses, 1); assert.equal(reports[1].responses, 1);
    assert.equal(reports[0].inputTokens, 20); assert.equal(reports[1].inputTokens, 20);
    assert.equal(reports[0].revision, reports[1].revision);
  } finally { e.sql.close(); }
});

test('project usage reports contain only cumulative metadata, and a failed RPC never repeats a paid task', async () => {
  const e = fixture(); try {
    const reports = []; let attempts = 0, paid = 0;
    e.SERIES_USAGE = { async report(value) { reports.push(value); if (++attempts === 1) throw Error('fixture receiver temporarily unavailable'); } };
    await submit(e);
    const fetchImpl = async () => { paid++; return stream(completed()); };
    assert.equal((await runCloudQuestions(e, { fetchImpl })).completed, true);
    assert.equal(paid, 1); assert.equal(reports.length, 1);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).empty, true);
    assert.equal(reports.length, 1, 'empty minute checks must not send repeated usage RPCs');
    await submit(e);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).completed, true);
    const total = reports.at(-1);
    assert.equal(total.inputTokens, 40); assert.equal(total.outputTokens, 20); assert.equal(total.responses, 2);
    assert.equal(total.unknownCalls, 0); assert.equal(total.inProgressCalls, 0);
    assert.deepEqual(Object.keys(total).sort(), ['inputTokens', 'outputTokens', 'cachedInputTokens', 'responses', 'unknownCalls', 'inProgressCalls', 'revision', 'checkedAt'].sort());
    assert(!JSON.stringify(total).includes(e.markdown)); assert(!JSON.stringify(total).includes('answer'));
    await submit(e);
    assert.equal((await runCloudQuestions(e, { fetchImpl: async () => { paid++; throw Error('fixture unknown transport'); } })).outcomeUnknown, true);
    assert.equal(reports.at(-1).unknownCalls, 1); assert.equal(reports.at(-1).responses, 2);
    assert.equal(paid, 3); assert.equal(reports.length, 3);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).empty, true); assert.equal(reports.length, 3);
  } finally { e.sql.close(); }
});

test('unknown network or incomplete streaming outcomes keep their input and cannot be retried or passed by a follow-up', async () => {
  for (const mode of ['network', 'stream']) {
    const e = fixture(); try {
      const id = crypto.randomUUID(); await submit(e, id); await submit(e);
      let paid = 0;
      const fetchImpl = async () => { paid++; if (mode === 'network') throw Error('fixture transport failure');
        return new Response('data: {"type":"response.created"}\n\n', { headers: { 'content-type': 'text/event-stream' } }); };
      assert.equal((await runCloudQuestions(e, { fetchImpl })).outcomeUnknown, true);
      assert.equal(e.sql.prepare('SELECT error FROM question_turns WHERE id=?').get(id).error, 'outcome_unknown');
      assert.equal((await call(e, '/api/questions/retry', { id })).status, 409);
      e.sql.prepare('UPDATE question_cloud_contexts SET expires_at=1').run();
      await collectCloudQuestionContexts(e);
      assert.equal(count(e, 'question_cloud_contexts'), 1);
      assert.equal((await runCloudQuestions(e, { fetchImpl })).empty, true); assert.equal(paid, 1);
    } finally { e.sql.close(); }
  }
});

test('only an explicit retry after a confirmed rejection advances the cloud attempt', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id); let paid = 0;
    const fetchImpl = async () => { paid++; return paid === 1 ? Response.json({ error: { code: 'fixture_rejected' } }, { status: 400 }) : stream(completed()); };
    assert.equal((await runCloudQuestions(e, { fetchImpl })).outcomeUnknown, false);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).empty, true); assert.equal(paid, 1);
    assert.equal((await call(e, '/api/questions/retry', { id })).status, 200);
    assert.equal(e.sql.prepare('SELECT api_attempt FROM question_turns WHERE id=?').get(id).api_attempt, 1);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).completed, true); assert.equal(paid, 2);
    assert.deepEqual(e.sql.prepare('SELECT attempt,outcome FROM api_cloud_runs ORDER BY attempt').all().map(r => [r.attempt, r.outcome]), [['0', 'rejected'], ['1', 'completed']]);
  } finally { e.sql.close(); }
});

test('a stale retry cannot turn another device\'s newer unknown attempt back into pending', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id); let paid = 0;
    await runCloudQuestions(e, { fetchImpl: async () => { paid++; return Response.json({ error: { code: 'fixture_rejection' } }, { status: 400 }); } });
    e.onContextRead = async () => {
      assert.equal((await call(e, '/api/questions/retry', { id })).status, 200);
      assert.equal((await runCloudQuestions(e, { fetchImpl: async () => { paid++; throw Error('fixture interrupted newer attempt'); } })).outcomeUnknown, true);
    };
    const stale = await call(e, '/api/questions/retry', { id });
    assert.equal(stale.status, 409);
    const row = e.sql.prepare('SELECT status,error,api_attempt FROM question_turns WHERE id=?').get(id);
    assert.equal(row.status, 'failed'); assert.equal(row.error, 'outcome_unknown'); assert.equal(row.api_attempt, 1);
    assert.equal((await runCloudQuestions(e, { fetchImpl() { throw Error('must never pay again'); } })).empty, true);
    assert.equal(paid, 2); assert.equal(count(e, 'api_cloud_runs'), 2);
  } finally { e.sql.close(); }
});

test('an explicit retry moves only a known legacy failure to a new cloud attempt, with its original fixed chapter', async () => {
  for (const unknown of [false, true]) {
    const e = fixture(); try {
      e.API_CLOUD_ENABLED = 'false';
      const id = crypto.randomUUID(); await submit(e, id); const claim = 'f'.repeat(64);
      assert.equal((await (await call(e, '/api/questions/jobs/claim', { claim }, true)).json()).job.id, id);
      assert.equal((await call(e, '/api/questions/jobs/' + id + '/fail', { claim, outcomeUnknown: unknown }, true)).status, 200);
      e.API_CLOUD_ENABLED = 'true';
      const retry = await call(e, '/api/questions/retry', { id });
      if (unknown) {
        assert.equal(retry.status, 409);
        assert.equal(e.sql.prepare('SELECT execution_route FROM question_turns WHERE id=?').get(id).execution_route, 'legacy');
        assert.equal(count(e, 'question_cloud_contexts'), 0);
      } else {
        assert.equal(retry.status, 200);
        const row = e.sql.prepare('SELECT execution_route,api_attempt,context_digest FROM question_turns WHERE id=?').get(id);
        assert.equal(row.execution_route, 'cloud-v1'); assert.equal(row.api_attempt, 1); assert(row.context_digest);
        assert.equal(count(e, 'question_cloud_contexts'), 1);
        assert.equal((await (await call(e, '/api/questions/jobs/claim', { claim }, true)).json()).job, null);
        delete e.ASSETS; delete e.PUBLISH_TOKEN;
        assert.equal((await runCloudQuestions(e, { fetchImpl: async () => stream(completed()) })).completed, true);
        assert.equal(e.sql.prepare('SELECT attempt FROM api_cloud_runs WHERE task=?').get(id).attempt, '1');
      }
    } finally { e.sql.close(); }
  }
});

test('a missing protected binding leaves a job pending and never inserts a paid sending marker', async () => {
  for (const mode of ['absent', 'unavailable']) {
    const e = fixture(); try {
      await submit(e);
      if (mode === 'absent') delete e.SECOND_SERIES_OPENAI_KEY;
      else e.SECOND_SERIES_OPENAI_KEY = { async get() { throw Error('fixture protected binding unavailable'); } };
      assert.equal((await runCloudQuestions(e, { fetchImpl() { throw Error('must not call'); } })).configurationMissing, true);
      assert.equal(e.sql.prepare('SELECT status,api_attempt FROM question_turns').get().status, 'pending');
      assert.equal(count(e, 'api_cloud_runs'), 0);
      assert.equal(count(e, 'question_cloud_contexts'), 1);
    } finally { e.sql.close(); }
  }
});

test('singleflight rejects overlapping cron invocations, and owner rotation suppresses late answer delivery', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id);
    const started = Promise.withResolvers(), finish = Promise.withResolvers(); let paid = 0;
    const fetchImpl = async () => { paid++; started.resolve(); await finish.promise; return stream(completed()); };
    const first = runCloudQuestions(e, { fetchImpl }); await started.promise;
    assert.equal((await runCloudQuestions(e, { fetchImpl })).busy, true); assert.equal(paid, 1);
    e.sql.prepare('UPDATE auth_control SET epoch=epoch+1').run(); finish.resolve();
    assert.equal((await first).deliveryPending, true);
    assert.equal(e.sql.prepare('SELECT answer FROM question_turns WHERE id=?').get(id).answer, null);
    assert.equal((await runCloudQuestions(e, { fetchImpl })).empty, true);
    assert.equal(count(e, 'question_cloud_contexts'), 1);
  } finally { e.sql.close(); }
});

test('oversize and corrupted fixed chapters fail without truncation or any model request', async () => {
  const e = fixture(); try {
    e.markdown = 'x'.repeat(MAX_CLOUD_CHAPTER_BYTES + 1);
    const response = await submit(e); assert.equal(response.status, 503); assert.match((await response.json()).error, /超过云端/);
    assert.equal(count(e, 'question_turns'), 0); assert.equal(count(e, 'question_cloud_contexts'), 0);
    e.markdown = '完整的原文'; await submit(e);
    e.sql.prepare("UPDATE question_cloud_contexts SET markdown='内容被改动'").run();
    assert.equal((await runCloudQuestions(e, { fetchImpl() { throw Error('must not call'); } })).sourceUnavailable, true);
    assert.equal(e.keyReads, 0); assert.equal(count(e, 'api_cloud_runs'), 0);
    assert.equal(e.sql.prepare('SELECT error FROM question_turns').get().error, 'source_unavailable');
  } finally { e.sql.close(); }
});

test('submission and context persist together under the original owner guard; GC never alters question history', async () => {
  const e = fixture(); try {
    e.beforeMarkdown = () => e.sql.prepare('UPDATE auth_control SET epoch=epoch+1').run();
    assert.equal((await submit(e)).status, 401);
    assert.equal(count(e, 'question_turns'), 0); assert.equal(count(e, 'question_cloud_contexts'), 0);
    assert.equal(e.keyReads, 0);
  } finally { e.sql.close(); }
  const e2 = fixture(); try {
    await submit(e2); const context = e2.sql.prepare('SELECT * FROM question_cloud_contexts').get();
    e2.sql.prepare("UPDATE question_turns SET status='answered',answer='历史答复'").run();
    e2.sql.prepare('UPDATE question_cloud_contexts SET expires_at=1').run();
    await collectCloudQuestionContexts(e2);
    assert.equal(count(e2, 'question_cloud_contexts'), 0);
    assert.equal(e2.sql.prepare('SELECT answer FROM question_turns').get().answer, '历史答复');
    assert(context.digest);
  } finally { e2.sql.close(); }
});

test('a stale sending marker remains unknown even if runtime configuration changes', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id);
    e.sql.prepare("UPDATE question_turns SET status='running',lease_until=1").run();
    e.sql.prepare("INSERT INTO api_cloud_runs(project,task,attempt,request_digest,model,outcome,started_at) VALUES('second-algorithm',?,'0','different-input','gpt-fixture','sending',1)").run(id);
    const result = await runCloudQuestions(e, { fetchImpl() { throw Error('must not pay'); } });
    assert.equal(result.outcomeUnknown, true);
    assert.equal((await call(e, '/api/questions/retry', { id })).status, 409);
    assert.equal(e.sql.prepare('SELECT api_attempt FROM question_turns WHERE id=?').get(id).api_attempt, 0);
  } finally { e.sql.close(); }
});

test('the migration installs the shared runtime schema and cloud completion remains a private internal action', async () => {
  const sql = new DatabaseSync(':memory:'); try {
    sql.exec(CLOUD_API_SCHEMA);
    const expected = sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name LIKE 'api_cloud_%' ORDER BY name").all();
    const e = fixture(); try {
      const actual = e.sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name LIKE 'api_cloud_%' ORDER BY name").all();
      const clean = rows => rows.map(row => [row.name, row.sql.replace(/\s+/g, ' ').trim()]);
      assert.deepEqual(clean(actual), clean(expected));
      assert.equal((await call(e, '/api/questions/jobs/' + crypto.randomUUID() + '/complete', { claim: 'f'.repeat(64), answer: '伪造' })).status, 401);
      e.API_CLOUD_ENABLED = 'false';
      assert.equal((await (await cloudQuestionAction(e, 'claim', { claim: 'f'.repeat(64) })).json()).disabled, true);
    } finally { e.sql.close(); }
  } finally { sql.close(); }
});

function pushDevice(e, id) {
  const row = e.sql.prepare('SELECT owner_scope,epoch FROM question_turns WHERE id=?').get(id), now = Date.now();
  e.sql.prepare('INSERT INTO service_push VALUES(?,?,?,?,?,?,?,?)').run('fixture-device', row.owner_scope, row.epoch,
    'https://fcm.googleapis.com/fixture-device', 'public-fixture', 'auth-fixture', now, now);
  Object.assign(e, { VAPID_PUBLIC_KEY: 'public-fixture', VAPID_PRIVATE_KEY: 'private-fixture', VAPID_SUBJECT: 'mailto:fixture@example.test' });
}
const wake = (e, nonce, deliver, extra = {}) => questionCloudWakeRoute(new Request(origin + '/api/questions/cloud-wake', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce, ...extra })
}), e, r => r.json(), undefined, { deliver });

test('cloud answers wake the existing Pages outbox using a one-use nonce, without publisher or VAPID copying', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id); pushDevice(e, id);
    let sent = 0, wakes = 0, nonce;
    const deliver = async (_subscription, payload) => {
      sent++; assert(!JSON.stringify(payload).includes('不变量')); return true;
    };
    const notificationFetch = async (url, request) => {
      wakes++; assert.equal(url, origin + '/api/questions/cloud-wake');
      assert.equal(request.redirect, 'manual');
      assert.equal(request.headers.authorization, undefined);
      const body = JSON.parse(request.body); assert.deepEqual(Object.keys(body), ['nonce']); nonce = body.nonce;
      assert.equal(e.sql.prepare('SELECT nonce_hash FROM question_cloud_wakes').get().nonce_hash, createHash('sha256').update(nonce).digest('hex'));
      const response = await wake(e, nonce, deliver); assert.deepEqual(await response.clone().json(), { ok: true }); return response;
    };
    assert.equal((await runCloudQuestions(e, { fetchImpl: async () => stream(completed()), notificationFetch })).completed, true);
    assert.equal(wakes, 1); assert.equal(sent, 1); assert.equal(count(e, 'question_cloud_wakes'), 0);
    assert.equal((await wake(e, nonce, deliver)).status, 401);
    assert.equal((await wake(e, 'f'.repeat(64), deliver)).status, 401);
    assert.equal(await requestCloudQuestionDelivery(e, { fetchImpl: notificationFetch }), false);
    assert.equal(sent, 1); assert.equal(e.sql.prepare('SELECT attempts FROM service_push_delivery').get().attempts, 1);
  } finally { e.sql.close(); }
});

test('a redirected wake never follows the nonce or marks the committed outbox delivered', async () => {
  const e = fixture(); try {
    const id = crypto.randomUUID(); await submit(e, id); pushDevice(e, id);
    let requests = 0;
    const notificationFetch = async (url, request) => {
      requests++; assert.equal(url, origin + '/api/questions/cloud-wake');
      assert.equal(request.redirect, 'manual');
      return new Response('', { status: 307, headers: { location: 'https://other.invalid/wake' } });
    };
    const result = await runCloudQuestions(e, { fetchImpl: async () => stream(completed()), notificationFetch });
    assert.equal(result.completed, true);
    assert.equal(requests, 1);
    assert.equal(e.sql.prepare('SELECT sent_at FROM service_push_delivery').get().sent_at, null);
    assert.equal(count(e, 'question_cloud_wakes'), 1);
    assert.equal(count(e, 'api_cloud_runs'), 1);
  } finally { e.sql.close(); }
});

test('wake nonce expiration, additional capabilities, parallel replay, and owner changes cannot send stale notifications', async () => {
  for (const mode of ['expires', 'parallel', 'owner']) {
    const e = fixture(); try {
      const id = crypto.randomUUID(); await submit(e, id); pushDevice(e, id);
      // Commit an answer/outbox but simulate a temporarily unavailable wake endpoint.
      let nonce;
      const notificationFetch = async (_url, request) => { nonce = JSON.parse(request.body).nonce; return new Response('', { status: 503 }); };
      assert.equal((await runCloudQuestions(e, { fetchImpl: async () => stream(completed()), notificationFetch })).completed, true);
      assert(nonce); let sent = 0; const deliver = async () => { sent++; return true; };
      assert.equal((await wake(e, nonce, deliver, { owner: 'arbitrary' })).status, 401);
      if (mode === 'expires') {
        e.sql.prepare('UPDATE question_cloud_wakes SET expires_at=1').run();
        assert.equal((await wake(e, nonce, deliver)).status, 401); assert.equal(sent, 0);
        await requestCloudQuestionDelivery(e, { fetchImpl: notificationFetch });
        assert.equal(count(e, 'question_cloud_wakes'), 1, 'the expired capability is replaced, not accumulated');
      } else if (mode === 'parallel') {
        const outcomes = await Promise.all([wake(e, nonce, deliver), wake(e, nonce, deliver)]);
        assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 401]); assert.equal(sent, 1);
      } else {
        e.sql.prepare('UPDATE auth_control SET epoch=epoch+1').run();
        assert.equal((await wake(e, nonce, deliver)).status, 401); assert.equal(sent, 0);
      }
      assert.equal(e.sql.prepare('SELECT status FROM question_turns WHERE id=?').get(id).status, 'answered');
      assert.equal(count(e, 'api_cloud_runs'), 1);
    } finally { e.sql.close(); }
  }
});
