const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const when = value => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '尚无记录';
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
};
const money = value => finite(value) ? '$' + value.toFixed(2) : '未核验';
const bytes = value => {
  if (!finite(value)) return '未核验';
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; let unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return value.toLocaleString('zh-CN', { maximumFractionDigits: unit < 2 ? 0 : 2 }) + ' ' + units[unit];
};
const titles = { 'study-goal': '学习目标', 'study-next': '下次出版', 'study-rest': '休息安排', balances: '服务额度', storage: '存储空间', reminders: '提醒' };
const paths = { 'study-goal': '/api/settings', 'study-next': '/api/settings', 'study-rest': '/api/settings', balances: '/api/balances', storage: '/api/storage/usage' };
const action = (name, label, extra = '') => `<button class="bevel-button" type="button" data-service-action="${name}"${extra}>${label}</button>`;
const detail = (label, value) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
const isiOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined';
const subscriptionId = async subscription => {
  if (!subscription?.endpoint) return null;
  try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint)))].map(value => value.toString(16).padStart(2, '0')).join(''); }
  catch { return null; }
};

// Reads only this project's authenticated snapshots. No provider key or model call.
export function createServiceSettings({ api, getOwner, showSheet, rememberSheet, showSettings, toast, getSheetView }) {
  let sequence = 0, current = null;
  const cache = new Map();
  const alive = context => current === context && context.sequence === sequence && getOwner() === context.owner && getSheetView() === context.kind && Boolean(document.getElementById('sheetDialog')?.open);
  const owned = context => getOwner() === context.owner && context.sequence === sequence;
  const shell = (context, content) => `<div class="service-settings-panel${context.kind.startsWith('study-') ? ' settings-detail' : ''}" data-service-view="${context.kind}">${content}</div>`;
  const present = (context, content) => { if (alive(context)) showSheet(titles[context.kind], shell(context, content), context.kind, context.parent); };
  const status = (context, message, error = false) => {
    if (!alive(context)) return;
    const node = document.querySelector('[data-service-status]'); if (!node) return;
    node.textContent = message; node.classList.toggle('service-error', error);
  };
  function errorView(context, error) {
    const denied = error.status === 401 || error.status === 403;
    if (denied) cache.delete(context.kind);
    const saved = cache.get(context.kind);
    if (!denied && saved?.owner === context.owner && ['balances', 'storage'].includes(context.kind)) {
      render(context, saved.data, '暂时无法读取新记录，以下保留上次显示。'); return;
    }
    present(context, `<div class="settings-body"><p class="service-error" role="status">${esc(denied ? '请重新登录后查看。' : error.message || '暂时无法读取，请稍后重试。')}</p>${denied ? '' : action('reload', '重新读取')}</div>`);
  }
  function settingsBody(context, data) {
    context.settings = data;
    const feedback = '<p data-service-status role="status" aria-live="polite"></p><div data-service-conflict hidden></div>';
    if (context.kind === 'study-goal') return `<form class="settings-body service-form" data-service-form="study-goal"><label class="field-label" for="serviceStudyGoal">我的学习目标</label><textarea class="text-input" id="serviceStudyGoal" name="goal" rows="6" maxlength="2000" placeholder="填写希望加强的算法能力与求职目标">${esc(data.goal || '')}</textarea><button class="bevel-button" type="submit">保存学习目标</button>${feedback}</form>`;
    if (context.kind === 'study-next') return `<form class="settings-body service-form" data-service-form="study-next"><p>补充要求随下一次出版使用，领取后自动关闭。</p><label class="switch-row" for="serviceNextRequested"><span>附加下次出版要求</span><input id="serviceNextRequested" name="temporaryRequested" type="checkbox" role="switch"${data.temporaryRequested ? ' checked' : ''}></label><div data-service-next-box${data.temporaryRequested ? '' : ' hidden'}><label class="field-label" for="serviceNextText">本次补充要求</label><textarea class="text-input" id="serviceNextText" name="temporaryRequestText" rows="5" maxlength="2000"${data.temporaryRequested ? ' required' : ' disabled'} placeholder="填写下一次出版需要额外关注的内容">${esc(data.temporaryRequestText || '')}</textarea></div><button class="bevel-button" type="submit">保存下次出版</button>${feedback}</form>`;
    const automation = data.automation || {}, schedule = /^\d{2}:\d{2}$/.test(automation.schedule || '') ? `北京时间 ${automation.schedule}` : '尚未登记';
    return `<form class="settings-body service-form" data-service-form="study-rest"><p>默认休息。关闭后仅允许下一次安排，领取后自动恢复休息。</p><label class="switch-row" for="serviceRestRequested"><span>保持休息</span><input id="serviceRestRequested" name="restRequested" type="checkbox" role="switch"${data.restRequested !== false ? ' checked' : ''}></label><button class="bevel-button" type="submit">保存休息安排</button>${feedback}<dl class="service-facts">${detail('安排时间', schedule)}${detail('后台连接', automation.configured ? automation.runnerLastSeenAt ? when(automation.runnerLastSeenAt) : '尚无连接记录' : '尚未连接')}</dl>${automation.activeRun ? `<p>当前任务已领取，按原安排执行。</p>` : ''}${automation.configured ? '' : '<p>已保存的安排会保留，后台连接后执行。</p>'}</form>`;
  }
  function balanceBody(data, notice) {
    const verified = data.remainingVerified === true && !data.updateFailed, expiry = /^\d{4}-\d{2}-\d{2}$/.test(data.expiresAt || '') ? data.expiresAt : '未核验';
    return `<div class="settings-body"><p role="status">${esc(notice || (data.updatedAt ? '上次核对的额度记录' : '尚无核对记录'))}</p></div><section class="balance-card"><div class="balance-heading"><strong>ChatGPT API 赠送额度</strong><span class="balance-amount">${money(data.remainingAmount)}</span></div><p class="service-record-state">${verified ? '已核验' : finite(data.remainingAmount) ? '上次记录 · 未核验' : '剩余额度未核验'}</p><dl class="balance-costs">${detail('发放额度', finite(data.issuedAmount) ? money(data.issuedAmount) : '未记录')}${detail('到期日期', expiry)}${detail('核对时间', when(data.updatedAt))}</dl>${data.updateFailed ? `<p>最近一次核对未完成，以上保留原记录。</p><small>尝试时间：${esc(when(data.attemptedAt))}</small>` : ''}</section><div class="settings-body">${action('reload', '重新读取记录')}</div>`;
  }
  function storageBody(data, notice) {
    const pools = Array.isArray(data.pools) ? data.pools : [];
    return `<div class="settings-body"><p role="status">${esc(notice || '上次核对的存储记录')}</p></div>${pools.length ? pools.map(pool => `<section class="balance-card"><div class="balance-heading"><strong>${esc(pool.name || '存储空间')}</strong><span class="balance-amount">${bytes(pool.usedBytes)}</span></div><dl class="balance-costs">${detail('总容量', bytes(pool.limitBytes))}${detail('可用容量', bytes(pool.remainingBytes))}${detail('本项目占用', bytes(pool.projectBytes))}</dl>${finite(pool.usedBytes) && finite(pool.limitBytes) && pool.limitBytes > 0 ? `<progress class="storage-meter" value="${Math.min(pool.usedBytes, pool.limitBytes)}" max="${pool.limitBytes}" aria-label="${esc(pool.name || '存储空间')}占用"></progress>` : ''}<small>${pool.verified === true && !pool.updateFailed ? '已核验' : '未核验'} · 核对：${esc(when(pool.checkedAt))}</small>${pool.updateFailed ? `<small>最近一次更新未成功，以上保留原记录。</small>` : ''}</section>`).join('') : '<div class="settings-body"><p>尚无存储记录。</p></div>'}<div class="settings-body">${action('reload', '重新读取记录')}</div>`;
  }
  function reminderBody(context) {
    const push = context.push, support = pushSupported(), installed = !isiOS() || standalone(), permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    let message = !support ? '当前浏览器不支持提醒。' : !installed ? '请在 Safari 中添加到主屏幕，再从主屏幕打开以开启提醒。' : !push.status.configured || !push.key.configured || !push.key.publicKey ? '提醒服务尚未配置。' : permission === 'denied' ? '提醒权限已关闭，可在系统设置中调整。' : push.serverConfirmed ? '本机提醒已开启。' : push.subscription ? '本机浏览器已订阅，可重新连接提醒服务。' : '本机尚未开启提醒。';
    const canEnable = support && installed && push.status.configured && push.key.configured && Boolean(push.key.publicKey) && permission !== 'denied';
    return `<div class="settings-body service-reminders"><p data-service-status role="status" aria-live="polite">${esc(message)}</p><div class="button-row">${push.serverConfirmed ? '' : action('push-enable', push.subscription ? '重新连接提醒' : '开启提醒', canEnable ? '' : ' disabled')}${push.subscription ? action('push-disable', '关闭本机提醒') : ''}</div><dl class="service-facts">${detail('已连接设备', Number.isSafeInteger(push.status.deviceCount) ? `${push.status.deviceCount} 台` : '未核验')}</dl><p>开启后可接收新章发布和答疑新回复提醒。</p></div>`;
  }
  function render(context, data, notice = '') {
    if (!alive(context)) return;
    const body = context.kind.startsWith('study-') ? settingsBody(context, data) : context.kind === 'balances' ? balanceBody(data, notice) : context.kind === 'storage' ? storageBody(data, notice) : reminderBody(context);
    present(context, body);
  }
  async function show(kind) {
    if (!titles[kind] || !getOwner()) return;
    const owner = getOwner(), parent = current?.kind === kind && getSheetView() === kind ? current.parent : rememberSheet(showSettings);
    const context = current = { kind, owner, parent, sequence: ++sequence, settings: null, push: null, busy: false };
    showSheet(titles[kind], shell(context, '<div class="settings-body"><p role="status">正在读取…</p></div>'), kind, parent);
    try {
      if (kind === 'reminders') {
        const statusResult = await api('/api/push/status'); if (!alive(context)) return;
        const key = statusResult.configured ? await api('/api/push/public-key') : { configured: false, publicKey: null };
        if (!alive(context)) return;
        const registration = pushSupported() ? await navigator.serviceWorker.getRegistration() : null;
        const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
        if (!alive(context)) return;
        const deviceId = await subscriptionId(subscription); if (!alive(context)) return;
        const serverConfirmed = Boolean(deviceId && Array.isArray(statusResult.deviceIds) && statusResult.deviceIds.includes(deviceId));
        context.push = { status: statusResult, key, registration, subscription, serverConfirmed }; render(context, null);
      } else {
        const data = await api(paths[kind]); if (!alive(context)) return;
        if (kind.startsWith('study-') && !Number.isSafeInteger(data.revision)) throw Error('安排记录暂不可用，请重新读取。');
        cache.set(kind, { owner, data }); render(context, data);
      }
    } catch (error) { if (alive(context)) errorView(context, error); }
  }
  function settingsSummary(kind, data) {
    return kind === 'study-goal' ? data.goal || '尚未填写学习目标' : kind === 'study-next' ? data.temporaryRequested ? data.temporaryRequestText || '已附加下次要求' : '未附加下次要求' : data.restRequested !== false ? '保持休息' : '允许下一次安排';
  }
  async function saveSettings(context, form) {
    if (!alive(context) || context.busy || !context.settings || !Number.isSafeInteger(context.settings.revision)) return;
    const fields = [...form.querySelectorAll('input,textarea,button')], disabled = fields.map(field => field.disabled), body = { baseRevision: context.settings.revision };
    if (context.kind === 'study-goal') body.goal = form.elements.goal.value.trim();
    if (context.kind === 'study-next') {
      body.temporaryRequested = form.elements.temporaryRequested.checked; body.temporaryRequestText = form.elements.temporaryRequestText.value.trim();
      if (body.temporaryRequested && !body.temporaryRequestText) { status(context, '请填写本次补充要求。', true); form.elements.temporaryRequestText.focus(); return; }
    }
    if (context.kind === 'study-rest') body.restRequested = form.elements.restRequested.checked;
    context.busy = true; fields.forEach(field => field.disabled = true); status(context, '正在保存…');
    try {
      const data = await api('/api/settings', { method: 'PUT', body }); if (!alive(context)) return;
      cache.set(context.kind, { owner: context.owner, data }); render(context, data); status(context, '已保存'); toast('已保存');
    } catch (error) {
      if (!alive(context)) return;
      if (error.status === 409 && error.data?.current && Number.isSafeInteger(error.data.current.revision)) {
        context.settings = error.data.current;
        const conflict = form.querySelector('[data-service-conflict]'); conflict.hidden = false;
        conflict.innerHTML = `<p>其他设备已有更新，当前填写已保留。</p><div class="service-current">${esc(settingsSummary(context.kind, error.data.current))}</div>${action('reload', '读取最新安排')}`;
        const save = form.querySelector('[type="submit"]'); save.textContent = '保存当前填写'; status(context, '请核对最新安排后再保存。', true);
      } else status(context, error.message || '未能保存，请重试。', true);
    } finally {
      context.busy = false; if (alive(context) && form.isConnected) fields.forEach((field, index) => field.disabled = disabled[index]);
    }
  }
  function applicationKey(value) {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }
  async function pushStatus(context) {
    try { const value = await api('/api/push/status'); if (owned(context)) context.push.status = value; }
    catch { if (owned(context)) context.push.status = { ...context.push.status, deviceCount: null }; }
  }
  async function readyWorker() {
    let timer;
    try { return await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('应用服务尚未准备好，请重新打开后重试。')), 8000); })]); }
    finally { clearTimeout(timer); }
  }
  async function enablePush(context, permissionRequest) {
    if (!alive(context) || context.busy) return;
    context.busy = true; status(context, '正在连接提醒…');
    try {
      const permission = await permissionRequest; if (!alive(context)) return;
      if (permission !== 'granted') { status(context, '未开启提醒。'); return; }
      const registration = context.push.registration || await readyWorker();
      if (!alive(context)) return;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(context.push.key.publicKey) });
      if (!owned(context)) return;
      context.push.registration = registration; context.push.subscription = subscription;
      if (!alive(context)) return;
      await api('/api/push/register', { method: 'POST', body: subscription.toJSON() }); if (!alive(context)) return;
      context.push.serverConfirmed = true; await pushStatus(context); if (!alive(context)) return;
      render(context, null); status(context, '本机提醒已开启。'); toast('提醒已开启');
    } catch (error) {
      if (alive(context)) { render(context, null); status(context, error.name === 'NotAllowedError' ? '提醒权限未获允许。' : error.message || '未能连接提醒，请重试。', true); }
    } finally { context.busy = false; }
  }
  async function disablePush(context) {
    if (!alive(context) || context.busy || !context.push?.subscription) return;
    const subscription = context.push.subscription; context.busy = true; status(context, '正在关闭本机提醒…');
    try {
      await api('/api/push/unregister', { method: 'POST', body: { endpoint: subscription.endpoint } }); if (!owned(context)) return;
      const removed = await subscription.unsubscribe(); if (!alive(context)) return;
      if (!removed) throw Error('浏览器订阅尚未关闭，请重试。');
      context.push.subscription = null; context.push.serverConfirmed = false; await pushStatus(context); if (!alive(context)) return;
      render(context, null); status(context, '本机提醒已关闭。'); toast('提醒已关闭');
    } catch (error) { if (alive(context)) status(context, error.message || '未能关闭提醒，请重试。', true); }
    finally { context.busy = false; }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-service-action]'), context = current;
    if (!button || !context || !alive(context) || button.disabled || context.busy) return;
    const name = button.dataset.serviceAction;
    if (name === 'reload') { void show(context.kind); return; }
    if (name === 'push-disable') { void disablePush(context); return; }
    if (name === 'push-enable' && context.push && pushSupported() && (!isiOS() || standalone()) && context.push.status.configured && context.push.key.configured && context.push.key.publicKey) {
      // Keep the native permission request in this real user click, before any fetch/await.
      let permission;
      try { permission = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission); }
      catch { status(context, '提醒权限暂不可用，请在系统设置中检查。', true); return; }
      void enablePush(context, permission);
    }
  });
  document.addEventListener('change', event => {
    if (!current || !alive(current) || event.target.name !== 'temporaryRequested' || !event.target.closest('[data-service-form="study-next"]')) return;
    const form = event.target.form, enabled = event.target.checked;
    form.querySelector('[data-service-next-box]').hidden = !enabled;
    form.elements.temporaryRequestText.disabled = !enabled; form.elements.temporaryRequestText.required = enabled;
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-service-form]'), context = current;
    if (!form || !context || !alive(context)) return;
    event.preventDefault(); void saveSettings(context, form);
  });
  return Object.freeze({ show, reset() { sequence++; current = null; cache.clear(); } });
}
