// A newly loaded page may still be controlled by the previous release's worker.
// Only the actual controller can say which content policy intercepts this page.
export function readWorkerBuild(worker, timeoutMs = 1500) {
  if (!worker) return Promise.resolve(null);
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let timer;
    const finish = build => {
      clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(build);
    };
    channel.port1.onmessage = event => finish(event.data?.ok && typeof event.data.build === 'string'
      ? event.data.build : null);
    timer = setTimeout(() => finish(null), timeoutMs);
    try { worker.postMessage({ type: 'VERSION' }, [channel.port2]); } catch { finish(null); }
  });
}

export async function waitForWorkerRelease({ serviceWorker, build, different = false,
  timeoutMs = 10_000, onWait = () => {} } = {}) {
  // No controlling worker means requests use the network directly. In particular,
  // first visits and browsers without SW support need no upgrade handshake.
  if (!serviceWorker?.controller || !build) return { uncontrolled: true, controller: null };
  const deadline = Date.now() + timeoutMs;
  const matches = version => Boolean(version && (different ? version !== build : version === build));
  return new Promise((resolve, reject) => {
    let settled = false, checking = false, again = false, requested = false;
    let registration = null, updateComplete = false, retryTimer = null;
    const timer = setTimeout(() => finish(null), timeoutMs);
    const finish = result => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(retryTimer); retryTimer = null;
      serviceWorker.removeEventListener('controllerchange', check);
      if (result) resolve(result);
      else {
        const error = new Error('应用更新尚未完成，请稍后重试。');
        error.code = 'WORKER_RELEASE_PENDING'; reject(error);
      }
    };
    async function check() {
      if (settled) return;
      clearTimeout(retryTimer); retryTimer = null;
      if (checking) { again = true; return; }
      checking = true;
      const controller = serviceWorker.controller;
      if (!controller) { checking = false; finish({ uncontrolled: true, controller: null }); return; }
      const remaining = deadline - Date.now();
      if (remaining <= 0) { checking = false; finish(null); return; }
      const version = await readWorkerBuild(controller, Math.min(1500, remaining));
      checking = false;
      if (settled) return;
      if (controller !== serviceWorker.controller) again = true;
      else if (matches(version) && (!different || (updateComplete && !registration?.installing
        && !registration?.waiting && (!registration?.active || registration.active === controller)))) {
        finish({ controller, build: version }); return;
      }
      if (!requested) {
        requested = true; onWait();
        // update() only starts installation; its resolution is not evidence that
        // the new policy controls this page. Recheck after it and controllerchange.
        Promise.resolve().then(() => serviceWorker.getRegistration())
          .then(value => { registration = value; return registration?.update(); }).catch(() => {})
          .then(() => { updateComplete = true; void check(); });
      }
      if (again) { again = false; void check(); }
      else if (version === null && controller === serviceWorker.controller && Date.now() < deadline) {
        // A controller can miss one VERSION reply after its takeover event.
        // Retry only that unanswered identity check, within the original bound;
        // a healthy but wrong version still waits for a real lifecycle event.
        retryTimer = setTimeout(() => { retryTimer = null; void check(); }, Math.min(100, deadline - Date.now()));
      }
    }
    serviceWorker.addEventListener('controllerchange', check);
    void check();
  });
}
