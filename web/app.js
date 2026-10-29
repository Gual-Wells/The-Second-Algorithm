import { passkey } from './auth.js';
import { NotesJournal } from './notes-journal.js';
import { waitForWorkerRelease } from './worker-release.js';
import { createReaderRuntime } from './reader-runtime.js';
import { createReaderQuestions } from './manual-questions.js';
import { isChapterDate, shanghaiDate, formatChapterDate, shiftMonth, weekDates, orderedChapters, chaptersByDate } from './chapter-dates.js';

const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const S = { owner: null, library: null, records: {}, docs: new Map(), knowledge: new Map(), active: null,
  offline: false, stateSyncFailed: false, sequence: 0, connectionSequence: 0, pendingRoute: null, updateReady: false,
  settings: { fontSize: 15, codeSize: 12, wrapCode: false, preload: true } };
const SESSION_KEY = 'second-algorithm:last-session';
const prefix = () => `second-algorithm:${S.owner}:`;
const readLocal = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(prefix() + key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(prefix() + key, JSON.stringify(value)); return true; } catch { toast('本机保存失败，请保留此页面或复制尚未保存的内容。'); return false; } };
const allDocuments = () => S.library?.collections.flatMap(collection => collection.documents.map(document => ({ collection, document }))) || [];
const CLIENT_ID = crypto.randomUUID();
const BUILD = new URL(import.meta.url).searchParams.get('v');
const PUBLICATION_INDEX = typeof __PUBLICATION_INDEX__ === 'undefined' ? { version: '', collections: {} } : __PUBLICATION_INDEX__;
let journalInstance, questions, sheetView, sheetParent, sheetSequence = 0, sheetHistory = false, sheetClosing = false, sheetOpener = null;
let afterSheetClose = null, sheetPosition = null, toastTimer, positionTimer, positionSaveTimer, reconnectTimer, reconnecting = false, observedLocation = '', initialRoute = true;
const syncing = new Map(), downloads = new Map(), downloadStatus = new Map();
const book = { tab: 'list', month: shanghaiDate().slice(0, 7), query: '' };
let contentController = null, contentReleaseJob = null;
const runtime = createReaderRuntime({ onPosition: queuePosition, onNavigate: (anchor, position) => {
  if (!S.active) return;
  const route = `#/read/${S.active.collection.id}/${S.active.meta.id}`;
  navigate(anchor ? route + '?anchor=' + encodeURIComponent(anchor) : route, { position });
}, onCopy: copyText, isSheetOpen: () => $('sheetDialog').open || sheetHistory, toast });

function publishedLibrary(catalog) {
  if (catalog?.schemaVersion !== 2) throw Error('课程目录版本与当前应用不符，请联网更新。');
  const collections = (catalog.collections || []).flatMap(collection => {
    const allowed = PUBLICATION_INDEX.collections[collection.id]; if (!allowed) return [];
    const documents = collection.documents.filter(document => allowed[document.id] === document.revision);
    const date = PUBLICATION_INDEX.chapters ? PUBLICATION_INDEX.chapters[collection.id]?.date : collection.date;
    return documents.length ? [{ ...collection, date: isChapterDate(date) ? date : null, documents }] : [];
  });
  const visible = new Set(collections.flatMap(collection => collection.documents.map(document => document.id)));
  return { schemaVersion: 2, version: PUBLICATION_INDEX.version, collections,
    questions: (PUBLICATION_INDEX.questions || []).filter(question => question.url && question.revision || visible.has(question.document)) };
}
function journal() {
  if (!journalInstance || journalInstance.owner !== S.owner) journalInstance = { owner: S.owner, store: new NotesJournal(localStorage, prefix(), CLIENT_ID) };
  return journalInstance.store;
}
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
async function api(url, options = {}) {
  const owner = S.owner, connection = S.connectionSequence;
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20_000),
    ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url.startsWith('/api/') && S.owner === owner && S.connectionSequence === connection) lock('请重新使用通行密钥登录。');
    const error = new Error(data.error || '暂时无法连接。'); error.status = response.status; error.data = data; throw error;
  }
  return data;
}
async function swMessage(message) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(() => resolve(null), 4000))]);
  if (!registration) return null;
  const worker = navigator.serviceWorker.controller || registration.active; if (!worker) return;
  return new Promise(resolve => {
    const channel = new MessageChannel(), timer = setTimeout(() => resolve(null), 45_000);
    channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); }; worker.postMessage(message, [channel.port2]);
  });
}
async function ensureContentRelease() {
  const worker = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  if (!worker?.controller || !BUILD || contentController === worker.controller) return;
  if (!contentReleaseJob) contentReleaseJob = waitForWorkerRelease({ serviceWorker: worker, build: BUILD,
    onWait: () => toast('应用正在更新，请稍候…') }).then(result => { contentController = result.controller; }).finally(() => { contentReleaseJob = null; });
  await contentReleaseJob;
}
function lock(message = '使用通行密钥进入阅读室。') {
  book.query = ''; book.tab = 'list'; book.month = shanghaiDate().slice(0, 7);
  questions?.destroy(); questions = null;
  S.sequence++; S.connectionSequence++; S.owner = null; S.active = null; S.library = null; S.docs.clear(); S.knowledge.clear(); S.records = {};
  S.pendingRoute = null; S.stateSyncFailed = false; downloads.clear(); downloadStatus.clear(); afterSheetClose = null; sheetOpener = null; sheetPosition = null; observedLocation = ''; initialRoute = true;
  clearTimeout(reconnectTimer); clearTimeout(positionTimer); clearTimeout(positionSaveTimer); journalInstance = null;
  localStorage.removeItem(SESSION_KEY); runtime.clear();
  // Expired identity must not leave protected prose in the closed dialog.
  sheetSequence++; sheetHistory = false; sheetClosing = false; if ($('sheetDialog').open) $('sheetDialog').close(); $('sheetBody').replaceChildren();
  $('headerActions').hidden = $('chapterView').hidden = $('readerView').hidden = true; $('readingNotice').hidden = true;
  renderChapterNavigation(); showStartup('login', message); $('loginButton').hidden = false;
  void swMessage({ type: 'CLEAR_PRIVATE' });
}
async function connect() {
  const connection = ++S.connectionSequence;
  showStartup('loading');
  try {
    const status = await api('/auth/status'); if (connection !== S.connectionSequence) return;
    if (!status.authenticated) {
      if (S.owner) lock();
      showStartup(status.enrollmentOpen ? 'enroll' : 'login', status.enrollmentOpen ? '为此阅读器创建通行密钥。' : status.enrolled ? '使用已登记的通行密钥登录，继续按日期阅读。' : '尚未登记通行密钥。');
      $('enrollForm').hidden = !status.enrollmentOpen; $('loginButton').hidden = !status.enrolled; return;
    }
    await enter(status.ownerScope, false, connection);
  } catch (error) {
    if (connection !== S.connectionSequence) return;
    let last; try { last = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch {}
    if (!error.status && last?.owner && Date.now() - last.verifiedAt < 90 * 86400_000) {
      try { await enter(last.owner, true, connection); return; } catch {}
    }
    showStartup('error', error.message || '暂时无法连接。');
  }
}
function showStartup(kind, message = '') {
  const loading = kind === 'loading', failed = kind === 'error';
  $('app').classList.add('login-mode'); $('loginView').hidden = false; $('chapterNav').hidden = true; $('readerFrame').hidden = true;
  $('chapterView').hidden = $('readerView').hidden = true; $('headerActions').hidden = true;
  $('loginView').querySelector('.state-card').dataset.state = kind;
  $('startupTitle').textContent = loading ? '正在打开章节' : '打开你的算法读书器';
  $('startupDescription').textContent = loading ? '正在检查登录状态与已发布章节。' : failed ? '连接暂不可用，请检查网络后重试。' : message;
  $('loginMessage').textContent = failed ? message : '';
  $('enrollForm').hidden = $('loginButton').hidden = true; $('retryButton').hidden = !failed;
  $('startupInstall').hidden = loading || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('chapterView').classList.remove('is-opening'); $('chapterView').removeAttribute('aria-busy');
  $('readingNotice').hidden = true; $('readerStatusbar').classList.remove('chapter-load-status'); delete $('readerStatusbar').dataset.tone;
}
function showReaderShell() {
  $('loginView').hidden = true; $('readerFrame').hidden = false; $('headerActions').hidden = false; $('app').classList.remove('login-mode');
  renderChapterNavigation(); updateConnection();
}
function showChapterOpening(collection, error = null, route = '') {
  showReaderShell(); $('readerView').hidden = true; $('chapterView').hidden = false;
  $('chapterView').classList.add('is-opening'); $('chapterView').setAttribute('aria-busy', String(!error));
  $('readingNotice').hidden = true;
  $('chapterView').innerHTML = `<div class="chapter-opening-body"><section class="state-card opening-card" data-state="${error ? 'error' : 'loading'}"><div class="state-band"><span>第二算法</span><small>SECOND ALGORITHM</small></div><div class="state-body"><img class="state-icon" src="/icons/icon.svg" width="56" height="56" alt=""><h2>${error ? '本章暂时无法打开' : '正在打开章节'}</h2><p>${esc(error || `正在载入《${collection.title}》。`)}</p>${error ? `<div class="button-row"><button class="bevel-button" type="button" data-show-library>章节册</button><button type="button" class="primary-button" data-retry-route="${esc(route)}">重新打开</button></div>` : ''}</div></section></div>`;
  $('readerStatusbar').classList.add('chapter-load-status'); $('readerStatusbar').dataset.tone = error ? 'error' : 'loading';
  $('syncStatus').textContent = error ? '章节未能打开。' : '正在打开章节…'; $('readingPosition').textContent = '';

}
function mergeRemoteState(state) {
  for (const [key, record] of Object.entries(state || {})) {
    // Old notes are not migrated, acknowledged or auto-submitted by this UI.
    if (key.startsWith('notes:')) continue;
    const local = S.records[key];
    if (!local?.dirty && (!local?.revision || record.revision >= local.revision)) S.records[key] = record;
  }
}
async function enter(owner, offline, connection) {
  if (S.owner !== owner) {
    book.query = ''; book.tab = 'list'; book.month = shanghaiDate().slice(0, 7);
    questions?.destroy(); questions = null; S.docs.clear(); S.knowledge.clear(); S.records = {}; S.active = null; downloadStatus.clear(); observedLocation = ''; initialRoute = true; runtime.clear();
    sheetHistory = false; sheetClosing = false; sheetSequence++; if ($('sheetDialog').open) $('sheetDialog').close(); $('sheetBody').replaceChildren();
    $('headerActions').hidden = $('chapterView').hidden = $('readerView').hidden = true;
  }
  S.owner = owner; S.offline = offline;
  const catalog = offline ? readLocal('catalog') : await api('/api/library');
  if (connection !== S.connectionSequence || S.owner !== owner) return;
  S.library = publishedLibrary(catalog); writeLocal('catalog', S.library); S.records = readLocal('records', {}); S.stateSyncFailed = false;
  if (!offline) {
    try { const { state } = await api('/api/state'); if (connection !== S.connectionSequence || S.owner !== owner) return; mergeRemoteState(state); }
    catch (error) { if (error.status === 401) throw error; S.stateSyncFailed = true; toast('同步暂不可用，阅读位置先保存在本机。'); }
    writeLocal('records', S.records); localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt: Date.now() }));
  }
  S.settings = { fontSize: 15, codeSize: 12, wrapCode: false, preload: true, ...(S.records.preferences?.value || readLocal('preferences', {})) };
  S.settings.fontSize = Math.max(14, Math.min(24, Number(S.settings.fontSize) || 15));
  S.settings.codeSize = Math.max(10, Math.min(20, Number(S.settings.codeSize) || 12)); applySettings();
  questions ||= createReaderQuestions({ getContext: () => ({ owner: S.owner, chapterId: S.active?.collection.id, title: S.active?.collection.title, revision: S.active?.meta.revision }), toast, transport: null });
  let verifiedAt = Date.now(); if (offline) { try { verifiedAt = JSON.parse(localStorage.getItem(SESSION_KEY)).verifiedAt; } catch {} }
  await swMessage({ type: 'OWNER', owner, verifiedAt }); if (connection !== S.connectionSequence || S.owner !== owner) return;
  if (!location.hash || location.hash === '#/' || location.hash === '#/library') {
    const previous = readLocal('lastRoute'), chapters = orderedChapters(S.library.collections), today = shanghaiDate();
    const first = chapters.filter(item => item.date === today).at(-1) || chapters.at(-1) || S.library.collections[0];
    const saved = typeof previous === 'string' && previous.match(/^#\/(read|chapter)\/([^/?]+)(?:\/([^/?]+))?$/);
    const savedChapter = saved && S.library.collections.find(item => item.id === saved[2]);
    const savedValid = savedChapter && (saved[1] === 'chapter' ? !saved[3] : savedChapter.documents.some(item => item.id === saved[3]));
    history.replaceState(null, '', savedValid ? previous : first ? `#/chapter/${first.id}` : '#/library');
  }
  await route(); if (!offline) void syncPending();
}
function selectedDocument(collection) {
  return collection.documents.find(document => document.id === readLocal(`last-document:${collection.id}`))
    || [...collection.documents].sort((a, b) => (positionFor(b.id)?.capturedAt || 0) - (positionFor(a.id)?.capturedAt || 0))[0];
}
function navigate(hash, { replace = false, position = null } = {}) {
  if ($('sheetDialog').open || sheetHistory) { dismissSheet(() => navigate(hash, { replace, position })); return; }
  savePosition(); const snapshot = position ? { readingPosition: position, readingOwner: S.owner, readingDocument: S.active?.meta.id } : null;
  if (replace) history.replaceState(snapshot, '', hash); else history.pushState(snapshot, '', hash);
  observedLocation = ''; void route();
}
async function getDocument(meta) {
  if (S.docs.get(meta.id)?.revision === meta.revision) return S.docs.get(meta.id);
  const owner = S.owner, connection = S.connectionSequence;
  await ensureContentRelease(); if (S.owner !== owner || S.connectionSequence !== connection) throw Error('登录状态已变化。');
  const response = await fetch(meta.url, { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) });
  if (response.status === 401) { if (S.owner === owner && S.connectionSequence === connection) lock(); throw Error('请重新登录。'); }
  if (!response.ok) throw Error(S.offline ? '本章尚未下载。' : response.status === 404 ? '内容已更新，请刷新阅读器。' : '本章暂时无法打开。');
  const content = await response.json(); if (!owner || S.owner !== owner || connection !== S.connectionSequence) throw Error('登录状态已变化。');
  if (content.id !== meta.id || content.revision !== meta.revision) throw Error('内容版本已更新，请重新打开章节册。');
  S.docs.set(meta.id, content); return content;
}
function contentHasAnchor(meta, content, anchor) {
  const permitted = new Set((meta.headings || []).filter(item => [2, 3, 4].includes(item.depth)).map(item => item.id));
  if (permitted.has(anchor)) return true;
  const template = document.createElement('template'); template.innerHTML = content.html;
  const alias = template.content.querySelector('#' + CSS.escape(anchor));
  if (!alias?.matches('a[id]:not([href])')) return false;
  let next = alias.nextElementSibling;
  if (!next && alias.parentElement?.tagName === 'P') next = alias.parentElement.nextElementSibling;
  while (next?.tagName === 'A' && !next.getAttribute('href')) next = next.nextElementSibling;
  return Boolean(next && permitted.has(next.id));
}
function routeUnavailable(message) {
  S.pendingRoute = null; showReaderShell();
  $('chapterView').classList.remove('is-opening'); $('chapterView').removeAttribute('aria-busy');
  const action = '<button type="button" data-show-library>打开章节册</button>';
  if (S.active) {
    const wasReader = runtime.state.view === 'reader'; $('readerView').hidden = !wasReader; $('chapterView').hidden = wasReader;
    $('readingNotice').innerHTML = `<span>${esc(message)}</span>${action}<button type="button" data-cancel-route>关闭</button>`;
    $('readingNotice').hidden = false;
  } else {
    runtime.clear(); $('readerView').hidden = true; $('chapterView').hidden = false;
    $('chapterView').innerHTML = `<section class="state-card empty-card route-error"><div class="state-band"><span>阅读位置不可用</span></div><div class="state-body"><h2>无法打开这个位置</h2><p>${esc(message)}</p>${action}</div></section>`;
    $('readingNotice').hidden = true;
  }
  $('readerStatusbar').classList.remove('chapter-load-status'); delete $('readerStatusbar').dataset.tone;
  renderChapterNavigation(); updateConnection();
}
async function route() {
  if (!S.owner || !S.library || sheetHistory) return;
  const raw = location.hash || '#/library'; if (raw === observedLocation) return; observedLocation = raw;
  const sequence = ++S.sequence, [pathname, query = ''] = raw.slice(1).split('?'), [, section, collectionId, documentId] = pathname.split('/');
  const rows = S.library.collections;
  const libraryRoute = pathname === '/library' || pathname === '/';
  const collection = libraryRoute ? S.active?.collection || rows[0] : rows.find(item => item.id === collectionId);
  if (!rows.length) {
    showReaderShell(); $('chapterView').classList.remove('is-opening'); $('chapterView').removeAttribute('aria-busy');
    S.active = null; runtime.clear(); $('readerView').hidden = true; $('chapterView').hidden = false;
    $('chapterView').innerHTML = '<section class="state-card empty-card"><div class="state-band"><span>算法章节</span><small>CHAPTERS</small></div><div class="state-body"><img class="state-icon" src="/icons/icon.svg" alt=""><h2>暂无已发布章节</h2><p>正式发布的章节会出现在章节册与日历中。</p></div></section>';
    $('readerStatusbar').classList.remove('chapter-load-status'); delete $('readerStatusbar').dataset.tone; renderChapterNavigation(); updateConnection(); return;
  }
  const routeDepth = pathname.split('/').length;
  if (!collection || !libraryRoute && (!['read', 'chapter'].includes(section) || routeDepth !== (section === 'read' ? 4 : 3))) { routeUnavailable('这个章节不存在或已撤回。'); return; }
  if (libraryRoute && S.active) { $('readingNotice').hidden = true; showLibrary(); return; }
  const meta = section === 'read' ? collection.documents.find(item => item.id === documentId) : selectedDocument(collection);
  if (!meta) { routeUnavailable('这个阅读位置不存在或已撤回。'); return; }
  const fromStart = section === 'chapter' || libraryRoute;
  const canonical = `#/read/${collection.id}/${meta.id}`;
  const previous = S.active, wasRead = runtime.state.view === 'reader'; S.pendingRoute = raw;
  if (!previous) showChapterOpening(collection);
  else {
    showReaderShell(); $('readerView').hidden = !wasRead; $('chapterView').hidden = wasRead;
    $('readingNotice').innerHTML = `<span>正在打开${esc(collection.title)}…</span><button type="button" data-cancel-route>取消</button>`; $('readingNotice').hidden = false;
  }
  try {
    const content = await getDocument(meta); if (sequence !== S.sequence || !S.owner) return;
    const requestedAnchor = new URLSearchParams(query).get('anchor');
    if (requestedAnchor && !contentHasAnchor(meta, content, requestedAnchor)) { routeUnavailable('这个阅读位置不存在或已撤回。'); return; }
    await document.fonts.ready; if (sequence !== S.sequence || !S.owner) return;
    const same = previous?.meta.id === meta.id && previous?.meta.revision === meta.revision;
    if (same && wasRead) savePosition(false);
    let position = history.state?.readingOwner === S.owner && history.state?.readingDocument === meta.id ? history.state.readingPosition : null, local = positionFor(meta.id);
    const reloaded = initialRoute && performance.getEntriesByType('navigation')[0]?.type === 'reload';
    if (reloaded && readLocal('lastRoute') === raw && local?.capturedAt >= (position?.capturedAt || 0)) position = local;
    if (!position) position = local;
    S.active = { collection, meta, content, route: canonical }; S.pendingRoute = null;
    $('chapterView').classList.remove('is-opening'); $('chapterView').removeAttribute('aria-busy');
    $('readerStatusbar').classList.remove('chapter-load-status'); delete $('readerStatusbar').dataset.tone;
    showReaderShell();
    if (!same) position = runtime.setChapter(S.active, position);
    applySettings(); runtime.showReader(position, new URLSearchParams(query).get('anchor'), fromStart);
    initialRoute = false; $('readingNotice').hidden = true; writeLocal(`last-document:${collection.id}`, meta.id); writeLocal('lastRoute', canonical);
    writeLocal('resume', { collection: collection.id, document: meta.id, route: canonical });
    if (raw !== canonical) { history.replaceState({ ...history.state, readingPosition: runtime.position, readingOwner: S.owner, readingDocument: meta.id }, '', canonical); observedLocation = canonical; }
    updateConnection(); if (S.settings.preload && !S.offline) void downloadCollection(collection, false);
  } catch (error) {
    if (sequence !== S.sequence || !S.owner) return; S.pendingRoute = null;
    if (!previous) { showChapterOpening(collection, error.message, raw); return; }
    $('readingNotice').innerHTML = `<span>${esc(error.message)}</span><button type="button" data-retry-route="${esc(raw)}">重试</button>${previous ? '<button type="button" data-cancel-route>关闭</button>' : ''}`; $('readingNotice').hidden = false;
    if (previous) { history.replaceState(history.state, '', previous.route); observedLocation = previous.route; }
  }
}
function cancelPendingRoute() {
  if (S.pendingRoute) { S.sequence++; S.pendingRoute = null; if (S.active) { history.replaceState(history.state, '', S.active.route); observedLocation = S.active.route; } }
  $('readingNotice').hidden = true;
}
function positionFor(id) {
  const record = S.records[`position:${id}`], local = readLocal(`position:${id}`);
  return local?.capturedAt > (record?.value?.capturedAt || record?.updatedAt || 0) ? local : record?.value || local;
}
function queuePosition(value) {
  clearTimeout(positionSaveTimer); const owner = S.owner, id = S.active?.meta.id;
  positionSaveTimer = setTimeout(() => { if (S.owner === owner && S.active?.meta.id === id) storePosition(value); }, 180);
}
function storePosition(value) {
  if (!S.owner || !S.active || runtime.state.view !== 'reader' || !value) return;
  clearTimeout(positionSaveTimer);
  const key = `position:${S.active.meta.id}`;
  // A delayed old-document save may update its local coordinate while a new
  // chapter is loading, but must not overwrite that new history entry.
  if (!S.pendingRoute) history.replaceState({ ...history.state, readingPosition: value, readingOwner: S.owner, readingDocument: S.active.meta.id }, '', location.href);
  writeLocal(key, value); S.records[key] = { ...S.records[key], value, dirty: true }; writeLocal('records', S.records); updateConnection();
  clearTimeout(positionTimer); positionTimer = setTimeout(() => { void syncRecord(key); }, 1400);
}
function savePosition(historyEntry = true) {
  if (sheetHistory || $('sheetDialog').open || !S.owner || !S.active || runtime.state.view !== 'reader') return;
  const position = runtime.capture(); if (!position || runtime.state.restoring) return;
  if (historyEntry) storePosition(position);
  else { const key = `position:${S.active.meta.id}`; writeLocal(key, position); S.records[key] = { ...S.records[key], value: position, dirty: true }; writeLocal('records', S.records); }
}
async function syncRecord(key) {
  if (key.startsWith('notes:') || syncing.has(key)) return syncing.get(key);
  const owner = S.owner, connection = S.connectionSequence;
  const job = (async () => {
    while (owner && S.owner === owner && connection === S.connectionSequence && !S.offline && S.records[key]?.dirty) {
      const value = S.records[key].value, snapshot = JSON.stringify(value);
      try {
        const result = await api('/api/state', { method: 'PUT', body: { key, value } }); if (S.owner !== owner || connection !== S.connectionSequence) return;
        if (JSON.stringify(S.records[key]?.value) === snapshot) S.records[key] = { ...result.record, dirty: false }; writeLocal('records', S.records);
      } catch { return; }
    }
  })();
  syncing.set(key, job); updateConnection(); try { await job; } finally { if (syncing.get(key) === job) syncing.delete(key); if (S.owner === owner) updateConnection(); }
}
async function syncPending() { for (const [key, record] of Object.entries(S.records)) if (record.dirty && !key.startsWith('notes:')) await syncRecord(key); }
function updateConnection() {
  $('app').dataset.offline = String(S.offline);
  $('headerMeta').textContent = `算法实战 · ${S.owner ? S.offline ? '离线阅读' : `${S.library?.collections.length || 0}章已发布` : '正在连接'}`;
  const pending = Object.entries(S.records).some(([key, record]) => !key.startsWith('notes:') && record.dirty);
  $('statusLamp').classList.toggle('offline', S.offline || S.stateSyncFailed || pending);
  if (!$('chapterView').classList.contains('is-opening')) $('syncStatus').textContent = !S.owner ? '正在连接章节…' : S.offline ? '离线阅读 · 已保存在本机' : S.stateSyncFailed ? '同步暂不可用 · 已保存在本机' : syncing.size ? '正在同步…' : pending ? '已保存在本机，等待同步' : '已同步';
  const status = $('offlineStatus'); if (status) { status.hidden = !S.offline; status.textContent = S.offline ? '当前离线，已下载章节仍可阅读。' : ''; }
}
function applySettings() {
  document.documentElement.style.setProperty('--reading-size', S.settings.fontSize + 'px'); document.documentElement.style.setProperty('--code-size', S.settings.codeSize + 'px');
  $('app').classList.toggle('wrap-code', Boolean(S.settings.wrapCode)); $('sheetDialog').classList.toggle('wrap-code', Boolean(S.settings.wrapCode));
}
function saveSettings() { writeLocal('preferences', S.settings); S.records.preferences = { value: { ...S.settings }, dirty: true }; writeLocal('records', S.records); updateConnection(); void syncRecord('preferences'); }
function showSheet(title, html, view, parent = null) {
  cancelPendingRoute(); questions?.captureDraft(); sheetSequence++; sheetView = view; sheetParent = parent;
  $('sheetDialog').dataset.view = view; $('sheetFrame').dataset.view = view;
  const kind = view === 'index' ? 'index-sheet' : view === 'questions' ? 'questions-sheet' : ['library', 'calendar-day'].includes(view) ? 'chapter-book-sheet' : ['settings', 'reading-settings', 'device-settings', 'files', 'source'].includes(view) ? 'settings-sheet' : 'help-sheet';
  $('sheetFrame').className = 'sheet ' + kind;
  $('sheetKicker').textContent = ({ index: 'SECTION INDEX', library: 'CHAPTER LIBRARY', 'calendar-day': 'CHAPTER LIBRARY', questions: 'CHAPTER QUESTIONS', settings: 'READER SETTINGS', 'reading-settings': 'READING', 'device-settings': 'THIS DEVICE', files: 'CHAPTER FILES', source: 'C++ SOURCE', knowledge: 'REFERENCE', install: 'HOME SCREEN' })[view] || 'READER';
  $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBack').hidden = !parent;
  $('sheetBack').textContent = view === 'source' ? '‹ 本章文件' : ['reading-settings', 'device-settings', 'files'].includes(view) ? '‹ 设置' : view === 'install' ? '‹ 主屏幕与账户' : view === 'calendar-day' ? '‹ 章节册' : '‹ 返回';
  if (!$('sheetDialog').open) {
    sheetPosition = runtime.capture(); savePosition(); sheetOpener = document.activeElement;
    history.pushState({ ...history.state, algorithmSheet: true }, '', location.href); sheetHistory = true; sheetClosing = false; $('sheetDialog').showModal();
  }
  $('sheetBody').scrollTop = 0; $('sheetTitle').focus({ preventScroll: true }); runtime.wakeControls();
}
function dismissSheet(after = null) {
  questions?.captureDraft(); sheetSequence++; if (after) afterSheetClose = after; if ($('sheetDialog').open) $('sheetDialog').close();
  if (sheetHistory && !sheetClosing) { sheetClosing = true; history.back(); } else if (!sheetHistory) { const action = afterSheetClose; afterSheetClose = null; action?.(); }
}
function waitForSheetClose(action) {
  if ($('sheetDialog').open || !sheetHistory) return false; afterSheetClose = action; if (!sheetClosing) { sheetClosing = true; history.back(); } return true;
}
function rememberSheet(render) { const top = $('sheetBody').scrollTop; return () => { render(); $('sheetBody').scrollTop = top; }; }
function showIndex() {
  if (waitForSheetClose(showIndex) || !S.active) return;
  showSheet('篇节索引', `<div class="index-search"><label for="indexFilter">查找本章篇节</label><input class="text-input" id="indexFilter" type="search" placeholder="输入标题筛选"></div><div class="index-list" id="indexList">${runtime.indexHTML()}</div>`, 'index');
  requestAnimationFrame(() => runtime.scrollCurrentIndex($('indexList')));
}
function showQuestions() { if (waitForSheetClose(showQuestions) || !S.active) return; showSheet('章节答疑', '', 'questions'); questions.render($('sheetBody')); }
function chapterTitle(collection) { return `第 ${collection.chapterNumber} 章 · ${collection.title}`; }
function renderChapterNavigation() {
  const rows = orderedChapters(S.library?.collections), current = S.active?.collection;
  $('app').classList.toggle('empty-mode', Boolean(S.owner) && !rows.length);
  $('questionsButton').disabled = !current; if (!current) $('previousMajor').disabled = $('nextMajor').disabled = true;
  $('chapterNav').hidden = !S.owner || !rows.length;
  if (!S.owner) { $('dayStrip').replaceChildren(); $('currentDateLabel').textContent = '选择阅读日期'; $('chapterNavSubtitle').textContent = '章节册与日历'; return; }
  const index = rows.findIndex(row => row.id === current?.id);
  for (const [id, offset] of [['previousChapter', -1], ['nextChapter', 1]]) {
    const target = index < 0 ? null : rows[index + offset], button = $(id);
    button.disabled = !target; button.dataset.chapterId = target?.id || '';
    button.setAttribute('aria-label', target ? `${offset < 0 ? '上一章' : '下一章'}：${chapterTitle(target)}` : offset < 0 ? '上一章' : '下一章');
  }
  $('currentDateLabel').textContent = current ? formatChapterDate(current.date) : '选择阅读日期';
  $('chapterNavSubtitle').textContent = current ? chapterTitle(current) : `${rows.length} 章已发布`;
  const today = shanghaiDate(), byDate = chaptersByDate(rows), anchor = isChapterDate(current?.date) ? current.date : rows.filter(row => isChapterDate(row.date)).at(-1)?.date || today;
  $('dayStrip').innerHTML = weekDates(anchor).map((date, i) => {
    const entries = byDate.get(date) || [], label = `${formatChapterDate(date)}，${entries.length ? entries.map(chapterTitle).join('；') : '尚未发布'}`;
    return `<button type="button" class="day-chip${entries.length ? ' has-chapter' : ''}${date === current?.date ? ' selected' : ''}${date === today ? ' today' : ''}" data-calendar-day="${date}"${entries.length ? '' : ' disabled'} aria-label="${esc(label)}"><span class="dow">${'一二三四五六日'[i]}</span><span class="dom">${Number(date.slice(-2))}</span>${entries.length > 1 ? `<small>${entries.length}章</small>` : ''}</button>`;
  }).join('');
}
function bookRow(collection) {
  return `<section class="chapter-book-entry${S.active?.collection.id === collection.id ? ' active' : ''}"><button type="button" class="chapter-book-title library-row" data-open-chapter="${esc(collection.id)}" aria-label="打开第${collection.chapterNumber}章：${esc(collection.title)}"><span class="chapter-book-label"><small>${esc(`第 ${collection.chapterNumber} 章 · ${isChapterDate(collection.date) ? collection.date.slice(2) : '日期未登记'}`)}</small><strong>${esc(collection.title)}</strong></span><b aria-hidden="true">›</b></button></section>`;
}
function bookList(rows) {
  const query = book.query.trim().toLocaleLowerCase(), matches = orderedChapters(rows, true).filter(row => [row.title, row.chapterNumber, row.date, chapterTitle(row)].join(' ').toLocaleLowerCase().includes(query));
  let group = '';
  const html = matches.map(row => {
    const month = isChapterDate(row.date) ? row.date.slice(0, 7) : '', title = month ? `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月` : '日期未登记';
    const band = group !== title ? `<h3 class="chapter-book-month book-month">${title}</h3>` : ''; group = title;
    return band + bookRow(row);
  }).join('');
  return { count: matches.length, html: html || `<p class="chapter-list-empty book-empty">${query ? '没有匹配的章节，试试标题、编号或日期。' : '第一章发布后会出现在这里。'}</p>` };
}
function calendarPanel() {
  const rows = orderedChapters(S.library?.collections), byDate = chaptersByDate(rows), today = shanghaiDate(), current = S.active?.collection;
  const first = new Date(book.month + '-01T00:00:00Z'), end = new Date(first); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
  const count = end.getUTCDate(), blanks = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: count }, (_, i) => {
    const date = `${book.month}-${String(i + 1).padStart(2, '0')}`, entries = byDate.get(date) || [];
    return `<button type="button" class="calendar-day${entries.length ? ' has-chapter' : ''}${date === current?.date ? ' selected' : ''}${date === today ? ' today' : ''}" data-book-day="${date}"${entries.length ? '' : ' disabled'} aria-label="${esc(`${formatChapterDate(date)}，${entries.length ? entries.map(chapterTitle).join('；') : '尚未发布'}`)}"><strong>${i + 1}</strong>${entries.length > 1 ? `<small>${entries.length}章</small>` : ''}</button>`;
  }).join('');
  const monthly = rows.filter(row => row.date?.startsWith(book.month));
  return `<div class="chapter-calendar-panel"><div class="month-controls calendar-controls"><button class="bevel-button month-arrow" type="button" data-month-offset="-1" aria-label="上个月">‹</button><input id="monthPicker" type="month" value="${book.month}" aria-label="跳转月份"><button class="bevel-button" type="button" data-current-month>本月</button><button class="bevel-button month-arrow" type="button" data-month-offset="1" aria-label="下个月">›</button></div><div class="calendar-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar chapter-calendar">${'<span></span>'.repeat(blanks)}${days}</div><div class="section-band"><strong>本月章节</strong><span>${monthly.length} 章</span></div><div class="chapter-list">${monthly.map(bookRow).join('') || '<p class="chapter-list-empty book-empty">这个月还没有已发布的章节。</p>'}</div></div>`;
}
function showLibrary() {
  const withinBook = ['library', 'calendar-day'].includes(sheetView) && $('sheetDialog').open && !sheetClosing;
  if (!withinBook && waitForSheetClose(showLibrary)) return;
  const list = bookList(S.library?.collections);
  showSheet('章节册', `<div class="chapter-book-tabs book-tabs" role="tablist" aria-label="章节册视图"><button type="button" role="tab" data-book-tab="list" aria-selected="${book.tab === 'list'}" tabindex="${book.tab === 'list' ? 0 : -1}">章节目录</button><button type="button" role="tab" data-book-tab="calendar" aria-selected="${book.tab === 'calendar'}" tabindex="${book.tab === 'calendar' ? 0 : -1}">日历</button></div>${book.tab === 'list' ? `<label class="chapter-book-search book-search" for="chapterBookSearch"><span>全部章节 <small id="chapterBookCount">${list.count} 章</small></span><input class="text-input" id="chapterBookSearch" type="search" value="${esc(book.query)}" placeholder="查找标题、编号或日期"></label><div class="chapter-book-scroll" id="chapterBookList">${list.html}</div>` : calendarPanel()}`, 'library');
}
function openCalendarDay(date, fromBook = false) {
  const rows = chaptersByDate(S.library?.collections).get(date) || [];
  if (!rows.length) return;
  if (rows.length === 1) { openCalendarChapter(rows[0], !fromBook); return; }
  const entries = rows.map(row => fromBook ? bookRow(row) : bookRow(row).replace('data-open-chapter=', 'data-resume-chapter='));
  showSheet(formatChapterDate(date), `<p class="chapter-list-empty book-empty">选择这一天的章节</p>${entries.join('')}`, 'calendar-day', fromBook ? rememberSheet(showLibrary) : null);
}
function openCalendarChapter(collection, resume = true) {
  const meta = selectedDocument(collection);
  navigate(resume ? `#/read/${collection.id}/${meta.id}` : `#/chapter/${collection.id}`);
}
function showSettings() {
  if (waitForSheetClose(showSettings)) return;
  showSheet('阅读器设置', `<div class="settings-home"><div class="section-band">阅读</div><button type="button" class="settings-row" data-show-reading-settings><span>阅读偏好</span><b aria-hidden="true">›</b></button>
    <section class="settings-section settings-audio-row"><div class="section-band"><strong>离线下载</strong><span>OFFLINE</span></div><div class="settings-body"><label class="switch-row" for="preloadContent"><span>打开时下载本章已有文件</span><input id="preloadContent" role="switch" type="checkbox"${S.settings.preload ? ' checked' : ''}></label>${S.active ? `<div class="button-row"><button class="bevel-button" type="button" data-download-current>下载本章</button></div><p id="downloadStatus" role="status">${esc(downloadStatus.get(S.active.collection.id) || '已有正文、代码与知识按需读取。')}</p>` : ''}<p id="offlineStatus" role="status" hidden></p></div></section>
    <div class="section-band">章节文件</div><button type="button" class="settings-row" data-show-files${S.active ? '' : ' disabled'}><span>本章文件</span><b aria-hidden="true">›</b></button>
    <div class="section-band">应用与账户</div><button type="button" class="settings-row" data-show-device-settings><span>主屏幕与账户</span><b aria-hidden="true">›</b></button></div>`, 'settings'); updateConnection();
}
function showReadingSettings() {
  if (waitForSheetClose(showReadingSettings)) return;
  showSheet('阅读偏好', `<section class="settings-section"><div class="section-band"><strong>正文与代码</strong><span>READING</span></div><div class="settings-body"><div class="settings-value"><span>正文字号</span><div class="setting-stepper"><button class="bevel-button" type="button" data-font="-1" aria-label="缩小正文字号">−</button><output id="bodySizeOutput">${S.settings.fontSize}</output><button class="bevel-button" type="button" data-font="1" aria-label="放大正文字号">＋</button></div></div><div class="settings-value"><span>代码字号</span><div class="setting-stepper"><button class="bevel-button" type="button" data-code-font="-0.5" aria-label="缩小代码字号">−</button><output id="codeSizeOutput">${S.settings.codeSize}</output><button class="bevel-button" type="button" data-code-font="0.5" aria-label="放大代码字号">＋</button></div></div><label class="switch-row" for="wrapCode"><span>代码折行</span><input id="wrapCode" role="switch" type="checkbox"${S.settings.wrapCode ? ' checked' : ''}></label></div></section>`, 'reading-settings', rememberSheet(showSettings));
}
function showDeviceSettings() {
  if (waitForSheetClose(showDeviceSettings)) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  showSheet('主屏幕与账户', `<section class="settings-section"><div class="section-band"><strong>本机应用</strong><span>THIS DEVICE</span></div><div class="settings-body"><p id="installStatus">${standalone ? '已从主屏幕打开。' : '可将第二算法加入主屏幕。'}</p><div class="button-row"><button class="bevel-button" type="button" data-install-info>加入主屏幕</button><button class="bevel-button" type="button" data-logout>退出登录</button></div></div></section><section class="settings-section"><div class="section-band"><strong>应用更新</strong><span>UPDATES</span></div><div class="settings-body"><div class="button-row"><button class="bevel-button" type="button" data-check-updates>检查内容更新</button><button class="bevel-button" type="button" data-reload-app${S.updateReady ? '' : ' hidden'}>重新载入应用</button></div><p id="updateStatus" role="status">${S.updateReady ? '应用有新版本，可重新载入。' : '已发布内容可在联网后更新。'}</p></div></section>`, 'device-settings', rememberSheet(showSettings));
}
function showInstall() {
  if (waitForSheetClose(showInstall)) return;
  const parent = S.owner && sheetView === 'device-settings' ? rememberSheet(showDeviceSettings) : null;
  showSheet('加入主屏幕', '<div class="install-guide"><img src="/icons/icon-192.png" alt="第二算法图标"><div><strong>在 iPhone 的 Safari 中</strong><ol><li>打开本站并点按分享按钮（也可能位于浏览器菜单中）。</li><li>选择“添加到主屏幕”。</li><li>从主屏幕启动“第二算法”。</li></ol></div></div>', 'install', parent);
}
function showFiles(parent = null) {
  if (waitForSheetClose(() => showFiles(parent)) || !S.active) return;
  const { collection, meta } = S.active;
  showSheet('本章文件', `<p class="file-chapter">${esc(chapterTitle(collection))}</p><div class="settings-detail"><a class="settings-row button-link" href="${esc(meta.sourceUrl)}" download="${esc(collection.title)}.cpp"><span>下载完整 C++</span><b aria-hidden="true">↓</b></a>${meta.markdownUrl ? `<a class="settings-row button-link" href="${esc(meta.markdownUrl)}" download="${esc(collection.title)}.md"><span>下载 Markdown</span><b aria-hidden="true">↓</b></a>` : ''}<button type="button" class="settings-row" data-show-source><span>查看 C++ 源码</span><b aria-hidden="true">›</b></button></div>`, 'files', parent || rememberSheet(showSettings));
}
async function showKnowledge(id, anchor = '', retry = false) {
  if (sheetClosing || (!$('sheetDialog').open && sheetHistory)) { afterSheetClose = () => { void showKnowledge(id, anchor, retry); }; return; }
  const meta = S.library?.questions.find(item => item.id === id); if (!meta?.url) { toast('此知识暂时无法打开。'); return; }
  const owner = S.owner, parent = retry ? sheetParent : $('sheetDialog').open ? rememberSheet((() => {
    const title = $('sheetTitle').textContent, html = $('sheetBody').innerHTML, view = sheetView, previous = sheetParent; return () => showSheet(title, html, view, previous);
  })()) : null;
  showSheet(meta.title, '<p role="status">正在打开…</p>', 'knowledge', parent); const sequence = sheetSequence;
  try {
    await ensureContentRelease(); if (owner !== S.owner || sequence !== sheetSequence) return;
    let card = S.knowledge.get(id);
    if (!card) {
      const response = await fetch(meta.url, { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) });
      if (response.status === 401) { if (owner === S.owner) lock(); return; }
      if (!response.ok) {
        const error = new Error(response.status === 403 ? '无权读取此知识，请重新登录后重试。'
          : S.offline || navigator.onLine === false ? '此知识尚未下载，请联网重试。' : '知识暂时载入失败，请重试。');
        error.status = response.status; throw error;
      }
      card = await response.json(); if (card.id !== id || card.revision !== meta.revision) throw Error('知识版本已更新，请重新打开章节。');
      if (owner !== S.owner || sequence !== sheetSequence) return; S.knowledge.set(id, card);
    }
    if (owner !== S.owner || sequence !== sheetSequence) return;
    $('sheetBody').innerHTML = `<article class="knowledge-prose knowledge-paper">${card.html}</article>`; runtime.enhanceCodes($('sheetBody'));
    if (anchor) $('sheetBody').querySelector('#' + CSS.escape(anchor))?.scrollIntoView({ block: 'start' });
  } catch (error) {
    if (owner === S.owner && sequence === sheetSequence) {
      const message = error instanceof TypeError ? S.offline || navigator.onLine === false ? '此知识尚未下载，请联网重试。' : '知识暂时载入失败，请重试。' : error.message;
      $('sheetBody').innerHTML = `<p role="status">${esc(message)}</p><button class="bevel-button" type="button" data-knowledge="${esc(id)}" data-knowledge-anchor="${esc(anchor)}" data-knowledge-retry>重试</button>`;
    }
  }
}
async function showSource() {
  if (waitForSheetClose(showSource)) return; const meta = S.active?.meta; if (!meta) return;
  const filesParent = sheetView === 'files' ? sheetParent : null;
  showSheet('C++源码', '<p role="status">正在打开…</p>', 'source', rememberSheet(() => showFiles(filesParent))); const sequence = sheetSequence, owner = S.owner;
  try {
    await ensureContentRelease(); if (sequence !== sheetSequence || S.owner !== owner) return;
    const response = await fetch(meta.sourceUrl, { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) });
    if (response.status === 401) { if (S.owner === owner) lock(); return; } if (!response.ok) throw Error('源码暂时不可用。');
    const text = await response.text(); if (sequence !== sheetSequence || S.owner !== owner) return;
    $('sheetBody').innerHTML = '<div class="button-row action-row"><button class="bevel-button" type="button" data-copy-source>复制全部</button></div><div class="knowledge-prose"><pre class="source-view"><code></code></pre></div>'; $('sheetBody').querySelector('code').textContent = text; runtime.enhanceCodes($('sheetBody'));
  } catch (error) { if (sequence === sheetSequence && S.owner === owner) $('sheetBody').innerHTML = `<p>${esc(error.message)}</p>`; }
}
async function copyText(text, button = null) {
  try {
    let copied = false; if (navigator.clipboard?.writeText) try { await navigator.clipboard.writeText(text); copied = true; } catch {}
    if (!copied) {
      const field = document.createElement('textarea'); field.value = text; field.style.cssText = 'position:fixed;left:-10000px;top:0'; document.body.append(field); field.select();
      try { copied = document.execCommand('copy'); } finally { field.remove(); button?.focus({ preventScroll: true }); }
    }
    if (!copied) throw Error(); toast('代码已复制。');
  } catch { toast('复制未完成，请选择代码后使用系统复制。'); }
}
async function downloadCollection(collection, show = true) {
  if (!S.owner) return; const owner = S.owner, connection = S.connectionSequence;
  try { await ensureContentRelease(); } catch (error) { if (show) toast(error.message); return; }
  if (S.owner !== owner || connection !== S.connectionSequence) return;
  const key = `${owner}:${collection.id}:${S.library.version}`, ids = new Set(collection.documents.flatMap(document => document.knowledgeIds || []));
  const urls = ['/library/catalog.json', ...collection.documents.flatMap(document => [document.url, document.sourceUrl, document.markdownUrl].filter(Boolean)), ...S.library.questions.filter(question => ids.has(question.id) && question.url).map(question => question.url)];
  downloadStatus.set(collection.id, '正在下载…');
  if (!downloads.has(key)) downloads.set(key, swMessage({ type: 'CACHE_CONTENT', owner, urls }));
  const job = downloads.get(key), result = await job; if (downloads.get(key) === job) downloads.delete(key); if (S.owner !== owner || connection !== S.connectionSequence) return;
  const message = result?.ok ? '本章已可离线阅读。' : '未能完成下载，请联网重试。'; downloadStatus.set(collection.id, message); if ($('downloadStatus') && S.active?.collection.id === collection.id) $('downloadStatus').textContent = message; if (show) toast(message); return Boolean(result?.ok);
}
async function checkUpdates() {
  const owner = S.owner; if (!owner) return; const button = document.querySelector('[data-check-updates]'); if (button) button.disabled = true;
  try {
    await syncPending(); const [library, { state }] = await Promise.all([api('/api/library'), api('/api/state')]); if (S.owner !== owner) return;
    if (library.version !== PUBLICATION_INDEX.version) {
      await waitForWorkerRelease({ serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null, build: BUILD, different: true, onWait: () => toast('应用正在更新，请稍候…') });
      if (S.owner !== owner) return; S.updateReady = true; const reload = document.querySelector('[data-reload-app]'); if (reload) reload.hidden = false; toast('有内容更新，请重新载入应用。'); return;
    }
    S.library = publishedLibrary(library); S.offline = false; S.stateSyncFailed = false; writeLocal('catalog', S.library); mergeRemoteState(state); writeLocal('records', S.records);
    for (const [id, content] of S.docs) if (!allDocuments().some(pair => pair.document.id === id && pair.document.revision === content.revision)) S.docs.delete(id);
    updateConnection(); toast('已是最新内容。'); if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
  } catch (error) { if (S.owner === owner) toast(error.code === 'WORKER_RELEASE_PENDING' ? error.message : '暂时无法检查更新，请联网重试。'); } finally { if (button) button.disabled = false; }
}
function legacyDrafts() {
  if (!S.owner) return []; const ids = new Set(S.library?.collections.map(collection => collection.id) || []), namespace = prefix();
  for (const key of Object.keys(localStorage)) if (key.startsWith(namespace)) {
    const name = key.slice(namespace.length), match = name.match(/^notes(?:-cache|-backup)?:([^:]+)(?::|$)/); if (match) ids.add(match[1]);
    if (name.startsWith('notes-draft:')) try { ids.add(decodeURIComponent(name.slice(12).split(':')[0])); } catch {}
  }
  return [...ids].flatMap(id => { try { return journal().list(id); } catch { return [{ unreadable: true }]; } });
}
function hasPendingLegacy() { return legacyDrafts().length > 0 || Object.entries(S.records).some(([key, value]) => key.startsWith('notes:') && value.dirty); }
async function reloadApp(button) {
  savePosition(); questions?.captureDraft(); button.disabled = true;
  try { await waitForWorkerRelease({ serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null, build: BUILD, different: true, onWait: () => toast('应用正在更新，请稍候…') }); location.reload(); }
  catch (error) { toast(error.message); } finally { button.disabled = false; }
}
async function logout() {
  savePosition(); questions?.captureDraft(); await syncPending();
  if (hasPendingLegacy()) { toast('本机仍有旧的未同步记录，原件已保留，暂未退出。'); return; }
  const owner = S.owner; if (!owner) return;
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { toast('暂时无法退出，请联网重试。'); return; } if (S.owner !== owner) return;
  const namespace = `second-algorithm:${owner}:`;
  for (const key of Object.keys(localStorage)) if (key.startsWith(namespace)) {
    const name = key.slice(namespace.length);
    // Retiring a UI grants no permission to erase its personal source data.
    if (name.startsWith('notes') || name.startsWith('questions:')) continue;
    if (name === 'records' && Object.keys(readLocal('records', {})).some(recordKey => recordKey.startsWith('notes:'))) continue;
    localStorage.removeItem(key);
  }
  lock('已退出登录。'); await connect();
}

document.addEventListener('click', event => {
  const knowledge = event.target.closest('[data-knowledge]');
  if (knowledge && S.owner) { event.preventDefault(); void showKnowledge(knowledge.dataset.knowledge, knowledge.dataset.knowledgeAnchor || '', knowledge.hasAttribute('data-knowledge-retry')); return; }
  const cardAnchor = sheetView === 'knowledge' && event.target.closest('#sheetBody a[href^="#"]');
  if (cardAnchor && !cardAnchor.getAttribute('href').startsWith('#/')) { event.preventDefault(); try { $('sheetBody').querySelector('#' + CSS.escape(decodeURIComponent(cardAnchor.hash.slice(1))))?.scrollIntoView({ block: 'start' }); } catch {} return; }
  const button = event.target.closest('button');
  if (button?.dataset.chapterId || button?.dataset.resumeChapter) {
    const collection = S.library?.collections.find(row => row.id === (button.dataset.chapterId || button.dataset.resumeChapter));
    if (collection) openCalendarChapter(collection, true); return;
  }
  if (button?.dataset.calendarDay) { openCalendarDay(button.dataset.calendarDay); return; }
  if (button?.dataset.bookDay) { openCalendarDay(button.dataset.bookDay, true); return; }
  if (button?.dataset.bookTab) { book.tab = button.dataset.bookTab; showLibrary(); return; }
  if (button?.dataset.monthOffset) { try { const month = shiftMonth(book.month, Number(button.dataset.monthOffset)); if (/^\d{4}-\d{2}$/.test(month)) { book.month = month; showLibrary(); } } catch { toast('无法打开这个月份。'); } return; }
  if (button?.hasAttribute('data-current-month')) { book.month = shanghaiDate().slice(0, 7); showLibrary(); return; }
  if (button?.matches('[data-sheet-close]')) { dismissSheet(); return; } if (button?.matches('[data-cancel-route]')) { cancelPendingRoute(); return; }
  if (button?.hasAttribute('data-install-info')) { showInstall(); return; }
  if (!S.owner) return;
  if (button?.dataset.retryRoute) { navigate(button.dataset.retryRoute, { replace: true }); return; }
  if (button?.dataset.openChapter) { navigate(`#/chapter/${button.dataset.openChapter}`); return; }
  if (button?.hasAttribute('data-show-library')) { book.tab = 'list'; book.month = (isChapterDate(S.active?.collection.date) ? S.active.collection.date : shanghaiDate()).slice(0, 7); showLibrary(); return; }
  if (button?.hasAttribute('data-current-chapter') && S.active) { navigate(`#/chapter/${S.active.collection.id}`); return; }
  if (button?.hasAttribute('data-open-index')) { showIndex(); return; }
  if (button?.dataset.indexGo) { runtime.go(button.dataset.indexGo); return; }
  if (button?.dataset.font || button?.dataset.codeFont) {
    const position = sheetPosition || runtime.capture();
    if (button.dataset.font) S.settings.fontSize = Math.max(14, Math.min(24, S.settings.fontSize + Number(button.dataset.font))); else S.settings.codeSize = Math.max(10, Math.min(20, S.settings.codeSize + Number(button.dataset.codeFont)));
    runtime.settle(position, applySettings); saveSettings(); if ($('bodySizeOutput')) $('bodySizeOutput').value = S.settings.fontSize; if ($('codeSizeOutput')) $('codeSizeOutput').value = S.settings.codeSize; return;
  }
  if (button?.hasAttribute('data-show-reading-settings')) { showReadingSettings(); return; }
  if (button?.hasAttribute('data-show-device-settings')) { showDeviceSettings(); return; }
  if (button?.hasAttribute('data-show-files')) { showFiles(); return; }
  if (button?.hasAttribute('data-show-source')) { void showSource(); return; }
  if (button?.hasAttribute('data-copy-source')) { void copyText($('sheetBody').querySelector('code').textContent, button); return; }
  if (button?.hasAttribute('data-download-current') && S.active) { button.disabled = true; if ($('downloadStatus')) $('downloadStatus').textContent = '正在下载…'; void downloadCollection(S.active.collection).finally(() => { button.disabled = false; }); return; }
  if (button?.hasAttribute('data-check-updates')) { void checkUpdates(); return; } if (button?.hasAttribute('data-reload-app')) { void reloadApp(button); return; }
  if (button?.hasAttribute('data-logout')) { void logout(); return; }
  const link = event.target.closest('#article a');
  if (link?.getAttribute('href')?.startsWith('#')) { const href = link.getAttribute('href'); event.preventDefault(); if (href.startsWith('#/read/')) navigate(href); else try { runtime.go(decodeURIComponent(href.slice(1))); } catch { toast('这个阅读位置暂不可用。'); } }
});
document.addEventListener('change', event => {
  if (event.target.id === 'monthPicker') { const month = event.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { book.month = month; showLibrary(); } return; }
  if (event.target.id === 'wrapCode') { S.settings.wrapCode = event.target.checked; runtime.settle(sheetPosition || runtime.capture(), applySettings); saveSettings(); }
  if (event.target.id === 'preloadContent') { S.settings.preload = event.target.checked; saveSettings(); if (S.settings.preload && S.active) void downloadCollection(S.active.collection, false); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'indexFilter') { $('indexList').innerHTML = runtime.indexHTML(event.target.value); return; }
  if (event.target.id !== 'chapterBookSearch') return;
  book.query = event.target.value; const list = bookList(S.library?.collections);
  $('chapterBookList').innerHTML = list.html; $('chapterBookCount').textContent = `${list.count} 章`;
});
document.addEventListener('keydown', event => {
  const tab = event.target.closest('[data-book-tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); book.tab = event.key === 'Home' ? 'list' : event.key === 'End' ? 'calendar' : tab.dataset.bookTab === 'list' ? 'calendar' : 'list';
  showLibrary(); document.querySelector(`[data-book-tab="${book.tab}"]`)?.focus();
});
$('loginButton').addEventListener('click', async () => {
  $('loginButton').disabled = true; try { await passkey('login', api); await connect(); } catch (error) { $('loginMessage').textContent = error.name === 'NotAllowedError' ? '已取消验证，请重试。' : error.message; } finally { $('loginButton').disabled = false; }
});
$('enrollForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await passkey('enroll', api, $('setupKey').value); $('setupKey').value = ''; await connect(); $('loginMessage').textContent = '通行密钥已创建，请登录。'; } catch (error) { $('loginMessage').textContent = error.name === 'NotAllowedError' ? '已取消创建，请重试。' : error.message; } finally { button.disabled = false; }
});
$('retryButton').addEventListener('click', () => { void connect(); });
$('settingsButton').addEventListener('click', showSettings); $('sectionIndexButton').addEventListener('click', showIndex); $('questionsButton').addEventListener('click', showQuestions);
$('sheetBack').addEventListener('click', () => { sheetParent?.(); });
$('sheetDialog').addEventListener('close', () => { if ($('sheetDialog').open) return; questions?.captureDraft(); sheetSequence++; runtime.wakeControls(); if (sheetHistory && !sheetClosing) { sheetClosing = true; history.back(); } });
$('sheetDialog').addEventListener('click', event => { if (event.target !== $('sheetDialog')) return; const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismissSheet(); });
window.addEventListener('popstate', () => {
  if (sheetHistory) {
    sheetHistory = false; sheetClosing = false; sheetSequence++; if ($('sheetDialog').open) $('sheetDialog').close();
    const opener = sheetOpener, position = sheetPosition; sheetOpener = null; sheetPosition = null; const action = afterSheetClose; afterSheetClose = null; sheetView = null; $('sheetDialog').removeAttribute('data-view'); $('sheetFrame').removeAttribute('data-view');
    if (action) action(); else runtime.settle(position, null, () => { if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true }); }); return;
  }
  observedLocation = ''; void route();
});
window.addEventListener('hashchange', () => { void route(); });
async function reconnect(attempt = 0) {
  if (reconnecting) return; if (!S.owner) { void connect(); return; } reconnecting = true; const owner = S.owner;
  try { const status = await api('/auth/status'); if (S.owner !== owner) return; if (!status.authenticated || status.ownerScope !== owner) { lock(); return; }
    S.offline = false;
    if (S.stateSyncFailed) {
      const { state } = await api('/api/state'); if (S.owner !== owner) return;
      mergeRemoteState(state); writeLocal('records', S.records); S.stateSyncFailed = false;
    }
    updateConnection(); const verifiedAt = Date.now(); localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt })); await swMessage({ type: 'OWNER', owner, verifiedAt }); await syncPending();
  } catch { if (S.owner === owner && navigator.onLine && attempt < 2) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { void reconnect(attempt + 1); }, 1200 * (attempt + 1)); } } finally { reconnecting = false; if (S.owner === owner) updateConnection(); }
}
window.addEventListener('online', () => { void reconnect(); }); window.addEventListener('focus', () => { if (navigator.onLine && S.owner) S.offline || S.stateSyncFailed ? void reconnect() : void syncPending(); });
window.addEventListener('offline', () => { S.offline = true; updateConnection(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { savePosition(); questions?.captureDraft(); void syncPending(); } else if (navigator.onLine && S.owner) S.offline || S.stateSyncFailed ? void reconnect() : void syncPending(); });
window.addEventListener('beforeunload', event => { if (S.owner && hasPendingLegacy()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { savePosition(); questions?.captureDraft(); });
function fitSheetViewport() {
  const viewport = window.visualViewport, style = document.documentElement.style;
  if (!viewport || viewport.scale > 1.02) { for (const name of ['--sheet-viewport-height', '--sheet-offset-top', '--sheet-offset-bottom']) style.removeProperty(name); return; }
  style.setProperty('--sheet-viewport-height', viewport.height + 'px'); style.setProperty('--sheet-offset-top', Math.max(0, viewport.offsetTop) + 'px'); style.setProperty('--sheet-offset-bottom', Math.max(0, innerHeight - viewport.height - viewport.offsetTop) + 'px');
}
window.visualViewport?.addEventListener('resize', fitSheetViewport); window.visualViewport?.addEventListener('scroll', fitSheetViewport); window.addEventListener('resize', fitSheetViewport); fitSheetViewport();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {}); navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'AUTH_REQUIRED' && S.owner) lock(); });
  navigator.serviceWorker.addEventListener('controllerchange', async () => { const version = await swMessage({ type: 'VERSION' }); if (BUILD && version?.build && version.build !== BUILD) { S.updateReady = true; const button = document.querySelector('[data-reload-app]'); if (button) button.hidden = false; toast('应用有更新，可在设置重新载入。'); } });
}
void connect();
