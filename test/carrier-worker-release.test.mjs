import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readWorkerBuild, waitForWorkerRelease } from '../web/worker-release.js';

const origin = 'https://second-algorithm.pages.dev';
const path = '/library/first-chapter/first-document/new.json';

function actualWorker(build, paths) {
  const handlers = new Map(), calls = [];
  const checks = new Map();
  let versionRequests = 0;
  const check = number => {
    if (!checks.has(number)) checks.set(number, Promise.withResolvers());
    return checks.get(number);
  };
  const source = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8')
    .replaceAll('__BUILD__', build).replaceAll('__LIBRARY_PATHS__', JSON.stringify(paths));
  vm.runInNewContext(source, {
    Request, Response, URL, Date, console,
    caches: { async open() { return { async match() { return null; }, async put() {} }; }, async keys() { return []; } },
    fetch: async input => { calls.push(input.url || input); return Response.json({ id: 'first-document', revision: 'new' }); },
    self: { location: { origin }, addEventListener: (type, fn) => handlers.set(type, fn),
      async skipWaiting() {}, clients: { async claim() {}, async matchAll() { return []; } } }
  });
  return {
    calls,
    versionChecked(number) { return check(number).promise; },
    postMessage(data, ports) {
      if (data.type === 'VERSION') {
        const pending = check(++versionRequests);
        // readWorkerBuild closes its ports after consuming the reply. This is
        // an actual completion barrier, independent of MessageChannel timing.
        ports[0].addEventListener('close', () => pending.resolve(), { once: true });
      }
      handlers.get('message')({ data, ports, source: { url: origin + '/' }, waitUntil(promise) { void promise; } });
    },
    async read(url) {
      let response;
      handlers.get('fetch')({ request: new Request(origin + url), respondWith(value) { response = value; } });
      return response;
    }
  };
}

function serviceWorker(controller, active = controller) {
  const value = new EventTarget();
  const started = Promise.withResolvers();
  value.controller = controller; value.updates = 0;
  value.updateStarted = started.promise;
  value.registration = { active, update() {
    ++value.updates;
    const completed = Promise.resolve();
    started.resolve({ completed });
    return completed;
  } };
  value.getRegistration = async () => value.registration;
  value.takeOver = next => { value.controller = next; value.dispatchEvent(new Event('controllerchange')); };
  return value;
}

function cleanUpPending(t, sw, current, pending) {
  // Preserve the assertion's failure without leaving an unhandled timed-out
  // gate behind when the test exits before the intended controller takeover.
  pending.catch(() => {});
  t.after(async () => { sw.takeOver(current); await Promise.allSettled([pending]); });
}

test('an actual hidden-release worker rejects the new route, but the gate prevents a premature read', { timeout: 2000 }, async t => {
  const old = actualWorker('old-build', ['/library/catalog.json']);
  const current = actualWorker('new-build', ['/library/catalog.json', path]);
  assert.equal((await old.read(path)).status, 404);
  assert.equal(old.calls.length, 0, 'retired/unlisted routes still fail closed');
  // registration.active may differ from the controller that intercepts this page.
  const sw = serviceWorker(old, current);
  let requested = false;
  const reading = waitForWorkerRelease({ serviceWorker: sw, build: 'new-build', timeoutMs: 1000 })
    .then(() => { requested = true; return sw.controller.read(path); });
  cleanUpPending(t, sw, current, reading);
  await sw.updateStarted;
  await old.versionChecked(2);
  assert.equal(requested, false);
  assert.equal(sw.updates, 1);
  assert.equal(current.calls.length, 0);
  sw.takeOver(current);
  const response = await reading;
  assert.equal(response.status, 200);
  assert.equal(current.calls.length, 1);
  assert.equal(old.calls.length, 0);
});

test('an update is not ready merely because registration.update resolved', { timeout: 2000 }, async t => {
  const old = actualWorker('old-build', ['/library/catalog.json']);
  const current = actualWorker('new-build', ['/library/catalog.json', path]);
  const sw = serviceWorker(old, current);
  let ready = false;
  const release = waitForWorkerRelease({ serviceWorker: sw, build: 'old-build', different: true, timeoutMs: 1000 })
    .then(result => { ready = true; return result; });
  cleanUpPending(t, sw, current, release);
  const { completed } = await sw.updateStarted;
  await completed;
  await old.versionChecked(2);
  assert.equal(ready, false);
  sw.takeOver(current);
  assert.equal((await release).build, 'new-build');
});

test('same-version offline content does not require a network update', async () => {
  const controller = actualWorker('same-build', ['/library/catalog.json', path]);
  const sw = serviceWorker(controller);
  sw.getRegistration = async () => { throw new TypeError('offline'); };
  assert.equal((await waitForWorkerRelease({ serviceWorker: sw, build: 'same-build' })).controller, controller);
  assert.equal(sw.updates, 0);
});

test('a controller older than the page cannot masquerade as a completed newer update', { timeout: 2000 }, async t => {
  const old = actualWorker('older-than-page', ['/library/catalog.json']);
  const current = actualWorker('new-release', ['/library/catalog.json', path]);
  const sw = serviceWorker(old);
  const registration = sw.registration;
  registration.installing = {};
  let ready = false;
  const update = waitForWorkerRelease({ serviceWorker: sw, build: 'page-release', different: true, timeoutMs: 1000 })
    .then(result => { ready = true; return result; });
  cleanUpPending(t, sw, current, update);
  const { completed } = await sw.updateStarted;
  await completed;
  await old.versionChecked(2);
  assert.equal(ready, false);
  registration.installing = null; registration.active = current; sw.takeOver(current);
  assert.equal((await update).build, 'new-release');
});

test('first uncontrolled visits and browsers without SW use their normal network path', async () => {
  assert.equal((await waitForWorkerRelease({ build: 'new-build' })).uncontrolled, true);
  assert.equal((await waitForWorkerRelease({ serviceWorker: serviceWorker(null), build: 'new-build' })).uncontrolled, true);
});

test('an unavailable replacement has a bounded, retryable failure without changing the controller', async () => {
  const old = actualWorker('old-build', ['/library/catalog.json']);
  const sw = serviceWorker(old);
  sw.getRegistration = async () => { throw new TypeError('offline'); };
  await assert.rejects(waitForWorkerRelease({ serviceWorker: sw, build: 'new-build', timeoutMs: 70 }),
    error => error.code === 'WORKER_RELEASE_PENDING');
  assert.equal(sw.controller, old);
  sw.takeOver(actualWorker('new-build', ['/library/catalog.json', path]));
  assert.equal((await waitForWorkerRelease({ serviceWorker: sw, build: 'new-build' })).build, 'new-build');
});

test('a worker that does not answer VERSION also times out', async () => {
  assert.equal(await readWorkerBuild({ postMessage() {} }, 30), null);
});


test('a late first VERSION after takeover cannot consume the last recovery event', { timeout: 5000 }, async t => {
  const old = actualWorker('old-build', ['/library/catalog.json']);
  const worker = actualWorker('new-build', ['/library/catalog.json', path]);
  const late = Promise.withResolvers();
  let versionRequests = 0, delayedTimer, relay;
  const current = {
    postMessage(data, ports) {
      if (data.type === 'VERSION' && ++versionRequests === 1) {
        relay = new MessageChannel();
        relay.port1.onmessage = event => {
          delayedTimer = setTimeout(() => {
            ports[0].postMessage(event.data);
            relay.port1.close(); relay.port2.close(); late.resolve();
          }, 1700);
        };
        worker.postMessage(data, [relay.port2]);
      } else worker.postMessage(data, ports);
    },
    read: url => worker.read(url)
  };
  t.after(() => { clearTimeout(delayedTimer); relay?.port1.close(); relay?.port2.close(); });
  const sw = serviceWorker(old);
  const reading = waitForWorkerRelease({ serviceWorker: sw, build: 'new-build', timeoutMs: 4000 });
  cleanUpPending(t, sw, current, reading);
  await sw.updateStarted; await old.versionChecked(2);
  // update() and its last old-controller check have completed. This takeover is
  // the final lifecycle event; the correct worker's first reply arrives late.
  sw.registration.active = current; sw.takeOver(current);
  const result = await reading;
  assert.equal(result.controller, current); assert.equal(result.build, 'new-build');
  assert.equal(versionRequests, 2, 'only the unanswered new-worker check is retried');
  assert.equal(sw.updates, 1, 'a VERSION retry must not start another network update');
  assert.equal((await current.read(path)).status, 200);
  await late.promise;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(versionRequests, 2, 'settlement cancels pending checks and ignores the late reply');
});

test('an unanswered VERSION remains bounded and leaves no retries or listeners after expiry', { timeout: 1000 }, async () => {
  let requests = 0;
  const silent = { postMessage() { requests++; } }, sw = serviceWorker(silent);
  await assert.rejects(waitForWorkerRelease({ serviceWorker: sw, build: 'new-build', timeoutMs: 70 }),
    error => error.code === 'WORKER_RELEASE_PENDING');
  assert.equal(sw.controller, silent); assert.equal(requests, 1);
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.equal(requests, 1, 'the configured total deadline is not extended to make another attempt');
  let afterSettlement = 0;
  sw.takeOver({ postMessage() { afterSettlement++; } });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(afterSettlement, 0, 'controllerchange listeners are removed after expiry');
});
