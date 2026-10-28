import { passkey } from './auth.js';
import { NotesJournal } from './notes-journal.js';
import { waitForWorkerRelease } from './worker-release.js';

const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const S = { owner: null, library: null, records: {}, docs: new Map(), knowledge: new Map(), notes: new Map(), active: null,
  offline: false, sequence: 0, connectionSequence: 0, searchSequence: 0, back: [], pure: false, restoring: false, returnTo: null, pendingRoute: null,
  settings: { fontSize: 17, codeSize: 13.5, wrapCode: false, preload: true }, controlsTimer: 0 };
const SESSION_KEY = 'second-algorithm:last-session';
const prefix = () => `second-algorithm:${S.owner}:`;
const readLocal = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(prefix() + key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(prefix() + key, JSON.stringify(value)); return true; } catch { toast('本机存储空间不足，请导出尚未同步的笔记。'); return false; } };
const allDocuments = () => S.library?.collections.flatMap(c => c.documents.map(d => ({ collection: c, document: d }))) || [];
let positionTimer, toastTimer, sheetView, sheetParent, sheetSequence = 0, reconnectTimer, reconnecting = false;
let sheetHistory = false, sheetClosing = false, afterSheetClose = null, sheetOpener = null, journalInstance, heldControls = false;
const CLIENT_ID = crypto.randomUUID();
const BUILD = new URL(import.meta.url).searchParams.get('v');
const PUBLICATION_INDEX = typeof __PUBLICATION_INDEX__ === 'undefined' ? { version: '', collections: {} } : __PUBLICATION_INDEX__;
function publishedLibrary(catalog) {
  if (catalog?.schemaVersion !== 2) throw Error('课程目录版本与当前应用不符，请联网更新。');
  const collections = (catalog?.collections || []).flatMap(collection => {
    const allowed = PUBLICATION_INDEX.collections[collection.id];
    if (!allowed) return [];
    const documents = collection.documents.filter(document => allowed[document.id] === document.revision);
    return documents.length ? [{ ...collection, documents }] : [];
  });
  const visible = new Set(collections.flatMap(collection => collection.documents.map(document => document.id)));
  return { schemaVersion: 2, version: PUBLICATION_INDEX.version, collections,
    questions: (PUBLICATION_INDEX.questions || []).filter(question => question.url && question.revision || visible.has(question.document)) };
}
const syncing = new Map(), downloads = new Map();
let contentController = null, contentReleaseJob = null;
async function ensureContentRelease() {
  const worker = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  if (!worker?.controller || !BUILD || contentController === worker.controller) return;
  if (!contentReleaseJob) contentReleaseJob = waitForWorkerRelease({ serviceWorker: worker, build: BUILD,
    onWait: () => toast('应用正在更新，请稍候…') }).then(result => { contentController = result.controller; })
    .finally(() => { contentReleaseJob = null; });
  await contentReleaseJob;
}
let shelf = { query: '', scroll: 0 };
const activeHash = () => S.active?.route || location.hash;
function journal() {
  if (!journalInstance || journalInstance.owner !== S.owner) journalInstance = {
    owner: S.owner, store: new NotesJournal(localStorage, prefix(), CLIENT_ID)
  };
  return journalInstance.store;
}

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
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
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) return;
  return new Promise(resolve => {
    const channel = new MessageChannel(); const timer = setTimeout(() => resolve(null), 45_000);
    channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); };
    worker.postMessage(message, [channel.port2]);
  });
}

function lock(message = '使用通行密钥进入阅读室。') {
  S.sequence++; S.searchSequence++; S.connectionSequence++; S.owner = null; S.active = null; S.library = null; S.docs.clear(); S.knowledge.clear(); S.records = {}; S.notes.clear(); S.returnTo = null; S.restoring = false; S.pendingRoute = null; afterSheetClose = null; sheetOpener = null; downloads.clear(); clearTimeout(reconnectTimer);
  localStorage.removeItem(SESSION_KEY); setPure(false);
  if ($('sheetDialog').open) $('sheetDialog').close();
  $('headerActions').hidden = $('libraryView').hidden = $('readerView').hidden = true;
  $('loginView').hidden = false; $('loginMessage').textContent = message; $('retryButton').hidden = false;
  $('loginButton').hidden = false; void swMessage({ type: 'CLEAR_PRIVATE' });
}

async function connect() {
  const connection = ++S.connectionSequence;
  $('retryButton').hidden = true; $('loginMessage').textContent = '正在连接…';
  try {
    const status = await api('/auth/status');
    if (connection !== S.connectionSequence) return;
    $('enrollForm').hidden = !status.enrollmentOpen;
    $('loginButton').hidden = !status.enrolled;
    if (!status.authenticated) {
      if (S.owner) lock();
      $('loginMessage').textContent = status.enrollmentOpen ? '为此阅读室创建通行密钥。'
        : status.enrolled ? '使用通行密钥进入阅读室。' : '尚未登记通行密钥。';
      return;
    }
    await enter(status.ownerScope, false, connection);
  } catch (error) {
    if (connection !== S.connectionSequence) return;
    let last; try { last = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch {}
    if (!error.status && last?.owner && Date.now() - last.verifiedAt < 90 * 86400_000) {
      try { await enter(last.owner, true, connection); return; } catch {}
    }
    $('loginMessage').textContent = error.message || '暂时无法连接。'; $('retryButton').hidden = false;
  }
}

async function enter(owner, offline, connection) {
  if (S.owner !== owner) { S.notes.clear(); S.docs.clear(); }
  S.owner = owner; S.offline = offline;
  const cached = readLocal('catalog');
  S.library = publishedLibrary(offline ? cached : await api('/api/library'));
  if (connection !== S.connectionSequence || S.owner !== owner) return;
  if (!S.library?.collections) throw Error('还没有可离线阅读的内容。');
  writeLocal('catalog', S.library);
  S.records = readLocal('records', {});
  if (!offline) {
    let state = {}, stateAvailable = false;
    try { ({ state } = await api('/api/state')); stateAvailable = true; }
    catch (error) { if (error.status === 401) throw error; toast('同步暂不可用，笔记先保存在本机。'); }
    if (connection !== S.connectionSequence || S.owner !== owner) return;
    for (const [key, record] of Object.entries(state)) {
      if (key.startsWith('notes:')) continue;
      const local = S.records[key];
      if (!local?.dirty && (!local?.revision || record.revision >= local.revision)) S.records[key] = record;
    }
    for (const collection of S.library.collections) {
      const key = `notes:${collection.id}`, remote = state[key];
      if (stateAvailable) try { journal().cache(collection.id, { text: remote?.value || '', revision: remote?.revision || 0 }); } catch { toast('本机缓存未能更新，已保留云端记录。'); }
      const active = S.notes.get(collection.id);
      if (!active?.dirty && !active?.saving) {
        let local; try { local = journal().load(collection.id); } catch {}
        S.notes.set(collection.id, local?.dirty || (!remote || local?.revision > remote.revision) ? local || { text: '', revision: 0, dirty: false } : { text: remote.value, revision: remote.revision, dirty: false });
      }
    }
    writeLocal('records', S.records);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt: Date.now() }));
  } else for (const c of S.library.collections) S.notes.set(c.id, journal().load(c.id));
  const remotePreferences = S.records.preferences?.value;
  S.settings = { ...S.settings, ...(remotePreferences || readLocal('preferences', {})) };
  S.settings.fontSize = Math.max(15, Math.min(24, Number(S.settings.fontSize) || 17));
  S.settings.codeSize = Math.max(12, Math.min(20, Number(S.settings.codeSize) || 13.5));
  applySettings();
  $('loginView').hidden = true; $('headerActions').hidden = false;
  await swMessage({ type: 'OWNER', owner, verifiedAt: offline ? JSON.parse(localStorage.getItem(SESSION_KEY)).verifiedAt : Date.now() });
  $('connectionLabel').textContent = offline ? '离线' : '';
  if (!location.hash || location.hash === '#/') {
    const route = readLocal('lastRoute');
    history.replaceState(null, '', route || '#/library');
  }
  await route();
  if (!offline) void syncPending();
}

function navigate(hash, { replace = false } = {}) {
  if ($('sheetDialog').open || sheetHistory) { dismissSheet(() => navigate(hash, { replace })); return; }
  savePosition();
  if (!$('libraryView').hidden) { shelf = { query: $('librarySearch').value, scroll: $('libraryView').scrollTop }; writeLocal('shelf', shelf); }
  if (location.hash === hash) { void route(); return; }
  if (replace) { history.replaceState(null, '', hash); void route(); }
  else { history.pushState(null, '', hash); void route(); }
}

async function getDocument(meta) {
  if (S.docs.get(meta.id)?.revision === meta.revision) return S.docs.get(meta.id);
  const owner = S.owner;
  const connection = S.connectionSequence;
  await ensureContentRelease();
  if (S.owner !== owner || S.connectionSequence !== connection) throw Error('登录状态已变化。');
  const response = await fetch(meta.url, { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) });
  if (response.status === 401) { if (S.owner === owner && S.connectionSequence === connection) lock(); throw Error('请重新登录。'); }
  if (!response.ok) throw Error(S.offline ? '此篇尚未下载。' : response.status === 404 ? '内容已更新，请刷新阅读器。' : '此篇暂时无法打开。');
  const document = await response.json();
  if (!owner || S.owner !== owner) throw Error('登录状态已变化。');
  if (document.id !== meta.id || document.revision !== meta.revision) throw Error('内容版本已更新，请重新打开章节册。');
  S.docs.set(meta.id, document); return document;
}

async function route() {
  if (!S.owner || !S.library) return;
  clearTimeout(searchTimer); clearTimeout(tocSearchTimer); S.searchSequence++;
  const sequence = ++S.sequence;
  const raw = location.hash || '#/library';
  const [pathname, query = ''] = raw.slice(1).split('?');
  const [, section, collectionId, docId] = pathname.split('/');
  const historyPosition = history.state?.readingPosition;
  if (section === 'q') {
    navigate('#/library', { replace: true }); return;
  }
  if (section !== 'read') {
    savePosition(false); S.active = null; S.pendingRoute = null; S.restoring = false; S.back = []; S.returnTo = null; setPure(false);
    $('readingNotice').hidden = true;
    $('readerView').hidden = true; $('libraryView').hidden = false;
    shelf = readLocal('shelf', shelf);
    $('libraryTitle').textContent = '算法实战'; $('librarySearch').value = shelf.query;
    writeLocal('lastRoute', '#/library'); renderLibrary();
    if (shelf.query.trim()) await search(shelf.query, $('bookList'), allDocuments());
    if (sequence === S.sequence) $('libraryView').scrollTop = shelf.scroll;
    return;
  }
  const collection = S.library.collections.find(c => c.id === collectionId);
  const meta = collection?.documents.find(d => d.id === docId);
  if (!meta) { navigate('#/library', { replace: true }); return; }
  const previous = S.active;
  S.pendingRoute = raw;
  if (previous) {
    $('readingNotice').innerHTML = `<span>正在打开${esc(meta.title)}…</span><button type="button" data-cancel-route>取消</button>`; $('readingNotice').hidden = false;
  } else {
    $('libraryView').hidden = true; $('readerView').hidden = false;
    $('currentTitle').textContent = collection.title;
    $('readingArticle').innerHTML = '<p class="empty-state">正在打开…</p>';
  }
  try {
    const content = await getDocument(meta); if (sequence !== S.sequence) return;
    await document.fonts.ready; if (sequence !== S.sequence) return;
    savePosition(false); S.restoring = true;
    const canonical = `#/read/${collection.id}/${meta.id}`;
    S.active = { collection, meta, content, route: canonical }; S.pendingRoute = null;
    $('currentTitle').textContent = collection.title;
    $('documentTabs').hidden = collection.documents.length < 2;
    if (collection.documents.length > 4) {
      $('documentTabs').removeAttribute('role');
      $('readingPane').removeAttribute('role'); $('readingPane').removeAttribute('aria-labelledby');
      $('documentTabs').innerHTML = `<label class="document-switcher"><span class="sr-only">本册篇目</span><select id="documentSelect">${collection.documents.map((d, index) => `<option value="${d.id}"${d.id === meta.id ? ' selected' : ''}>${index + 1} / ${collection.documents.length}　${esc(d.title)}</option>`).join('')}</select></label>`;
    } else {
      $('documentTabs').setAttribute('role', 'tablist');
      $('readingPane').setAttribute('role', 'tabpanel'); $('readingPane').setAttribute('aria-labelledby', `tab-${meta.id}`);
      $('documentTabs').innerHTML = collection.documents.map(d => `<button role="tab" id="tab-${d.id}" aria-controls="readingPane" tabindex="${d.id === meta.id ? 0 : -1}" type="button" data-document="${d.id}" aria-selected="${d.id === meta.id}">${esc(d.title)}</button>`).join('');
    }
    $('readingPane').setAttribute('aria-label', meta.title);
    $('readingArticle').innerHTML = content.html;
    let index = 0;
    for (const node of $('readingArticle').querySelectorAll('h2,h3,h4,p,pre,table,li')) {
      if (!node.id) node.dataset.readingAnchor = `part-${index}`; index++;
    }
    applySettings();
    updateConnection();
    const anchor = new URLSearchParams(query).get('anchor');
    if (S.returnTo?.hash === raw) { restorePosition(S.returnTo.position); S.returnTo = null; }
    else if (anchor) jumpTo(anchor); else restorePosition(historyPosition || positionFor(meta.id));
    history.replaceState({ ...history.state, readingPosition: capturePosition() }, '', canonical);
    $('readingNotice').hidden = true;
    updateProgress(); await new Promise(requestAnimationFrame);
    if (sequence !== S.sequence) return;
    S.restoring = false;
    writeLocal('lastRoute', canonical); writeLocal(`last-document:${collection.id}`, meta.id);
    writeLocal('resume', { collection: collection.id, document: meta.id, route: canonical }); updateProgress();
    if (S.settings.preload && !S.offline) void downloadCollection(collection, false);
  } catch (error) {
    if (sequence !== S.sequence || !S.owner) return;
    S.restoring = false; S.pendingRoute = null;
    if (previous) {
      history.replaceState(history.state, '', previous.route);
      $('readingNotice').innerHTML = `<span>${esc(error.message)}</span><button type="button" data-retry-route="${esc(raw)}">重试</button><button type="button" data-cancel-route>关闭</button>`; $('readingNotice').hidden = false;
    } else { S.active = null; $('readingArticle').innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p><button type="button" data-retry-route="${esc(raw)}">重试</button></div>`; }
  }
}

function cancelPendingRoute() {
  if (S.pendingRoute) { S.sequence++; S.pendingRoute = null; if (S.active) history.replaceState(history.state, '', S.active.route); }
  $('readingNotice').hidden = true;
}

function updateConnection() {
  $('connectionLabel').textContent = S.offline ? '离线' : '';
  if (S.active) $('currentKind').textContent = `第${S.active.collection.chapterNumber}章` + (S.offline ? ' · 离线' : '');
}

function renderLibrary() {
  const entries = S.library.collections;
  const row = c => {
    const last = c.documents.find(d => d.id === readLocal(`last-document:${c.id}`))
      || [...c.documents].sort((a, b) => (S.records[`position:${b.id}`]?.updatedAt || 0) - (S.records[`position:${a.id}`]?.updatedAt || 0))[0];
    const units = c.documents.length === 1 ? Math.max(0, last.headings.filter(h => h.depth === 2).length - 1) : null;
    return `<button class="book-row" type="button" data-open-collection="${c.id}" data-open-document="${last.id}"><span><strong>${esc(c.kind === 'chapter' ? `第${c.chapterNumber}章　${c.title}` : c.title)}</strong><small>${units === null ? `${c.documents.length}篇` : `${units}个题型`}${c.documents.some(d => positionFor(d.id)) ? ' · 继续阅读' : ''}</small></span><span aria-hidden="true">›</span></button>`;
  };
  const chapters = entries.filter(c => c.kind === 'chapter');
  $('bookList').innerHTML = `<section class="shelf-section"><h3>章节</h3>${chapters.length ? chapters.map(row).join('') : '<p class="empty-state">暂无章节</p>'}</section>`;
  const resume = readLocal('resume'), collection = entries.find(c => c.id === resume?.collection), meta = collection?.documents.find(d => d.id === resume.document);
  $('libraryResume').hidden = !meta;
  if (meta) { $('libraryResume').innerHTML = `<span><small>继续阅读</small><strong>${esc(collection.title)}${collection.documents.length > 1 ? ' · ' + esc(meta.title) : ''}</strong></span><span aria-hidden="true">›</span>`; $('libraryResume').dataset.route = resume.route; }
}

function positionFor(docId) {
  const record = S.records[`position:${docId}`], local = readLocal(`position:${docId}`);
  return local?.capturedAt > (record?.value?.capturedAt || record?.updatedAt || 0) ? local : record?.value || local;
}

function capturePosition() {
  const pane = $('readingPane'), article = $('readingArticle');
  const top = pane.getBoundingClientRect().top;
  let target = article.firstElementChild;
  for (const node of article.querySelectorAll('[id],[data-reading-anchor]')) {
    if (node.getBoundingClientRect().top <= top + 12) target = node; else break;
  }
  return { revision: S.active?.meta.revision, capturedAt: Date.now(), anchor: target?.id || target?.dataset.readingAnchor || '',
    offset: target ? top - target.getBoundingClientRect().top : 0,
    ratio: pane.scrollHeight <= pane.clientHeight ? 0 : pane.scrollTop / (pane.scrollHeight - pane.clientHeight) };
}

function anchorElement(anchor) {
  if (!anchor) return null;
  return $('readingArticle').querySelector(`#${CSS.escape(anchor)}`)
    || $('readingArticle').querySelector(`[data-reading-anchor="${CSS.escape(anchor)}"]`);
}

function restorePosition(position) {
  const pane = $('readingPane'); if (!position) { pane.scrollTop = 0; return; }
  const target = anchorElement(position.anchor);
  pane.scrollTop = target ? pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top + (Number(position.offset) || 0)
    : Math.max(0, Math.min(1, Number(position.ratio) || 0)) * (pane.scrollHeight - pane.clientHeight);
}

function jumpTo(anchor) {
  const node = anchorElement(anchor); if (!node) return;
  for (let p = node.parentElement; p && p !== $('readingArticle'); p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  $('readingPane').scrollTop += node.getBoundingClientRect().top - $('readingPane').getBoundingClientRect().top - 10;
  updateProgress();
}

function savePosition(historyEntry = true) {
  if (!S.active || !S.owner || S.restoring || $('readerView').hidden) return;
  const key = `position:${S.active.meta.id}`, value = capturePosition();
  if (historyEntry && !sheetHistory) history.replaceState({ ...history.state, readingPosition: value }, '', location.href);
  writeLocal(key, value); S.records[key] = { ...S.records[key], value, dirty: true };
  writeLocal('records', S.records); clearTimeout(positionTimer);
  positionTimer = setTimeout(() => { void syncRecord(key); }, 1400);
}

async function syncRecord(key) {
  if (syncing.has(key)) return syncing.get(key);
  const owner = S.owner;
  const job = (async () => {
    while (owner && S.owner === owner && !S.offline && S.records[key]?.dirty) {
      const value = S.records[key].value, snapshot = JSON.stringify(value);
      try {
        const result = await api('/api/state', { method: 'PUT', body: { key, value } });
        if (S.owner !== owner) return;
        if (JSON.stringify(S.records[key]?.value) === snapshot) S.records[key] = { ...result.record, dirty: false };
        writeLocal('records', S.records);
      } catch { return; }
    }
  })();
  syncing.set(key, job); try { await job; } finally { syncing.delete(key); }
}

function updateProgress() {
  if (!S.active) return;
  const p = $('readingPane'), progress = p.scrollHeight <= p.clientHeight ? 100 : Math.round(100 * p.scrollTop / (p.scrollHeight - p.clientHeight));
  const percent = Math.max(0, Math.min(100, progress)), heading = currentHeading();
  $('progressLabel').innerHTML = `<strong>${percent}%</strong><span>${esc(heading?.textContent || S.active.meta.title)}</span>`;
  $('progressLabel').setAttribute('aria-valuenow', String(percent)); $('progressLabel').setAttribute('aria-label', `阅读位置 ${percent}%`);
  document.querySelector('.reader-footer').style.setProperty('--read-progress', `${percent}%`);
  $('returnButton').hidden = !S.back.length;
}

function currentHeading() {
  const pane = $('readingPane');
  // Native anchor alignment combines the pane's padding with the heading's
  // scroll margin. A newly reached heading should already be the current one.
  const top = pane.getBoundingClientRect().top + (parseFloat(getComputedStyle(pane).scrollPaddingTop) || 0) + 24;
  const headings = [...$('readingArticle').querySelectorAll('h2[id]')];
  return headings.filter(h => h.getBoundingClientRect().top <= top).at(-1);
}

function showSheet(title, html, view, parent = null) {
  cancelPendingRoute();
  sheetSequence++;
  sheetView = view; sheetParent = parent; $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html; $('sheetBack').hidden = !parent;
  if (!$('sheetDialog').open) {
    sheetOpener = document.activeElement;
    history.pushState({ ...history.state, algorithmSheet: true }, '', location.href); sheetHistory = true; sheetClosing = false;
    $('sheetDialog').showModal();
  }
  $('sheetBody').scrollTop = 0;
  $('sheetTitle').focus({ preventScroll: true });
}

function dismissSheet(after = null) {
  sheetSequence++;
  if (after) afterSheetClose = after;
  if ($('sheetDialog').open) { $('sheetDialog').close(); if (sheetHistory && !sheetClosing) { sheetClosing = true; history.back(); } }
  else if (sheetHistory && !sheetClosing) { sheetClosing = true; history.back(); }
  else if (!sheetHistory) { const action = afterSheetClose; afterSheetClose = null; action?.(); }
}

function waitForSheetClose(action) {
  if ($('sheetDialog').open || !sheetHistory) return false;
  afterSheetClose = action;
  if (!sheetClosing) { sheetClosing = true; history.back(); }
  return true;
}

function rememberSheet(render) {
  const top = $('sheetBody').scrollTop;
  const active = document.activeElement;
  const attribute = [...(active?.attributes || [])].find(a => a.name.startsWith('data-'));
  const selector = active?.id ? `#${CSS.escape(active.id)}` : attribute ? `[${attribute.name}="${CSS.escape(attribute.value)}"]` : null;
  return () => { render(); $('sheetBody').scrollTop = top; if (selector) $('sheetBody').querySelector(selector)?.focus({ preventScroll: true }); };
}

function tocMarkup() {
  if (!S.active) return '';
  const { collection, meta } = S.active, current = currentHeading()?.id;
  const rows = d => d.headings.filter(h => h.depth === 2).map(h => `<button type="button" class="toc-row depth-2" data-go-document="${d.id}" data-go-collection="${collection.id}" data-anchor="${esc(h.id)}"${d.id === meta.id && h.id === current ? ' aria-current="location"' : ''}>${esc(h.text)}</button>`).join('');
  if (collection.documents.length === 1) return rows(meta);
  return collection.documents.map(d => `<details class="toc-group"${d.id === meta.id ? ' open' : ''}><summary>${esc(d.title)}</summary>${rows(d)}</details>`).join('');
}

function showToc() {
  if (waitForSheetClose(showToc)) return;
  if (!S.active) return;
  showSheet('目录', `<div class="sheet-tools"><label class="search-field"><input id="tocSearch" type="search" placeholder="检索本册内容" autocomplete="off" maxlength="200"></label></div><div id="tocResults">${tocMarkup()}</div>`, 'toc');
  requestAnimationFrame(() => { if (sheetView === 'toc') $('tocResults')?.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' }); });
}

async function showKnowledge(id, anchor = '', retry = false) {
  if (sheetClosing || (!$('sheetDialog').open && sheetHistory)) {
    afterSheetClose = () => { void showKnowledge(id, anchor, retry); }; return;
  }
  const meta = S.library?.questions.find(item => item.id === id);
  if (!meta?.url) { toast('此知识暂时无法打开。'); return; }
  const owner = S.owner;
  const parent = retry ? sheetParent : $('sheetDialog').open ? rememberSheet((() => {
    const title = $('sheetTitle').textContent, html = $('sheetBody').innerHTML, view = sheetView, previous = sheetParent;
    return () => showSheet(title, html, view, previous);
  })()) : null;
  showSheet(meta.title, '<p role="status">正在打开…</p>', 'knowledge', parent);
  const sequence = sheetSequence;
  try {
    await ensureContentRelease();
    if (owner !== S.owner || sequence !== sheetSequence) return;
    let card = S.knowledge.get(id);
    if (!card) {
      const response = await fetch(meta.url, { credentials: 'same-origin' });
      if (response.status === 401) { if (owner === S.owner) lock(); return; }
      if (!response.ok) throw Error('此知识尚未下载，请联网重试。');
      card = await response.json();
      if (card.id !== id || card.revision !== meta.revision) throw Error('知识版本已更新，请重新打开章节。');
      if (owner !== S.owner || sequence !== sheetSequence) return;
      S.knowledge.set(id, card);
    }
    if (owner !== S.owner || sequence !== sheetSequence) return;
    $('sheetBody').innerHTML = `<article class="paper knowledge-paper">${card.html}</article>`;
    if (anchor) {
      const target = $('sheetBody').querySelector('#' + CSS.escape(anchor));
      target?.scrollIntoView({ block: 'start' });
    }
  } catch (error) {
    if (owner === S.owner && sequence === sheetSequence && sheetView === 'knowledge') {
      const message = error instanceof TypeError ? '此知识尚未下载，请联网重试。' : error.message;
      $('sheetBody').innerHTML = `<p role="status">${esc(message)}</p><button type="button" data-knowledge="${esc(id)}" data-knowledge-anchor="${esc(anchor)}" data-knowledge-retry>重试</button>`;
    }
  }
}

function markText(text, terms) {
  const pattern = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let result = '', start = 0;
  for (const match of text.matchAll(pattern)) { result += esc(text.slice(start, match.index)) + '<mark>' + esc(match[0]) + '</mark>'; start = match.index + match[0].length; }
  return result + esc(text.slice(start));
}

async function search(query, container, pairs) {
  const sequence = ++S.searchSequence;
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return;
  container.innerHTML = '<p class="empty-state">正在检索…</p>';
  const results = [], failed = [];
  for (const { collection, document: meta } of pairs) {
    try {
      const doc = await getDocument(meta), template = document.createElement('template'); template.innerHTML = doc.html;
      template.content.querySelectorAll('.code-toolbar,.code-copy').forEach(node => node.remove());
      let parentTitle = meta.title, title = meta.title, anchor = '', text = '';
      const commit = () => {
        const lower = (title + ' ' + text).toLocaleLowerCase(); if (!terms.every(t => lower.includes(t))) return;
        const matches = terms.map(term => text.toLocaleLowerCase().indexOf(term)).filter(at => at >= 0);
        const at = Math.max(0, (matches.length ? Math.min(...matches) : 0) - 35);
        results.push({ collection, meta, title, anchor, snippet: text.slice(at, at + 125) });
      };
      for (const node of template.content.children) {
        if (node.tagName === 'H2') {
          commit(); parentTitle = title = node.textContent; anchor = node.id; text = '';
        } else if (node.tagName === 'H3') {
          commit(); title = parentTitle + ' · ' + node.textContent; anchor = node.id; text = '';
        } else if (node.matches('.knowledge-introduction')) {
          const knowledgeId = node.dataset.knowledgeIntroduction;
          const titleNode = node.querySelector('.knowledge-title');
          const knowledgeTitle = titleNode?.textContent;
          titleNode?.remove();
          const body = node.textContent;
          if (knowledgeTitle && S.library.questions.some(q => q.id === knowledgeId)
              && terms.every(term => (parentTitle + ' ' + knowledgeTitle + ' ' + body).toLocaleLowerCase().includes(term))) {
            const at = Math.max(0, body.toLocaleLowerCase().indexOf(terms[0]) - 35);
            results.push({ collection, meta, title: knowledgeTitle, parentTitle, knowledgeId, snippet: body.slice(at, at + 125) });
          }
        } else text += ' ' + node.textContent;
      }
      commit();
    } catch { failed.push(meta.id); }
    if (sequence !== S.searchSequence || !container.isConnected) return;
  }
  if (sequence !== S.searchSequence || !container.isConnected) return;
  const scope = failed.length ? `<p class="search-notice">${pairs.length - failed.length} / ${pairs.length}篇已检索；其余内容${S.offline ? '尚未下载' : '暂不可用'}。</p>` : '';
  container.innerHTML = `<p class="search-summary">${results.length}处匹配${results.length > 80 ? ' · 显示前80处' : ''}</p>` + scope
    + (results.length ? results.slice(0, 80).map(r => `<button type="button" class="search-row" ${r.knowledgeId ? `data-knowledge="${esc(r.knowledgeId)}"` : `data-go-collection="${r.collection.id}" data-go-document="${r.meta.id}" data-anchor="${esc(r.anchor)}"`}><strong>${markText(r.title, terms)}</strong><small>${esc(r.collection.title)}${r.knowledgeId ? ' · ' + esc(r.parentTitle) : r.collection.documents.length > 1 ? ' · ' + esc(r.meta.title) : ''}</small><span class="search-snippet">${markText(r.snippet, terms)}</span></button>`).join('') : `<p class="empty-state">${failed.length === pairs.length ? '暂无可检索内容' : failed.length ? '已检索内容中未找到匹配' : '没有找到匹配内容'}</p>`);
  if (container.id === 'tocResults' && sheetView === 'toc') $('sheetBody').scrollTop = 0;
}

function getNote(collectionId) {
  if (!S.notes.has(collectionId)) S.notes.set(collectionId, journal().load(collectionId));
  return S.notes.get(collectionId);
}

function persistNote(id) {
  const note = getNote(id);
  try { note.dirty ? journal().draft(id, note) : journal().cache(id, note); note.localFailed = false; return true; }
  catch { note.localFailed = true; toast('本机保存未完成，请导出笔记。'); return false; }
}

function noteStatus(text, id) {
  const node = $('noteStatus'); if (node && (!id || $('noteEditor')?.dataset.collection === id)) node.textContent = text;
  const button = document.querySelector('[data-sync-notes]'); if (button) button.hidden = !getNote($('noteEditor').dataset.collection).dirty;
}

function showNotes() {
  if (waitForSheetClose(showNotes)) return;
  if (!S.active) return;
  const id = S.active.collection.id, note = getNote(id);
  showSheet('笔记', `<p class="muted">${esc(S.active.collection.title)}</p><textarea id="noteEditor" class="note-editor" maxlength="20000" aria-label="本册笔记" placeholder="记下思路与疑问"></textarea><p id="noteStatus" class="save-state" role="status"></p><div id="noteConflict"></div><div id="draftRecovery" class="draft-recovery"></div><div class="action-row"><button type="button" data-sync-notes${note.dirty ? '' : ' hidden'}>重试同步</button><button type="button" data-export-notes>导出笔记</button></div>`, 'notes');
  $('noteEditor').value = note.text; $('noteEditor').dataset.collection = id;
  noteStatus(note.localFailed ? '本机保存未完成' : note.dirty ? '已保存在本机，等待同步' : '已保存'); renderNoteConflict(id); renderDraftRecovery(id);
}

function archiveNote(id, note) {
  if (!note.text) return true;
  return writeLocal(`notes-backup:${id}:${Date.now()}:${crypto.randomUUID()}`, { text: note.text, revision: note.revision, updatedAt: Date.now() });
}

function localDrafts(id) {
  const rows = journal().list(id), archivedPrefix = prefix() + `notes-backup:${id}:`;
  for (const key of Object.keys(localStorage)) if (key.startsWith(archivedPrefix)) {
    try { const value = JSON.parse(localStorage.getItem(key)); rows.push({ key, ...(typeof value === 'string' ? { text: value, revision: 0 } : value), archived: true }); } catch {}
  }
  const seen = new Set(); return rows.filter(row => { const key = `${row.revision}:${row.text}`; if (typeof row.text !== 'string' || seen.has(key)) return false; seen.add(key); return true; });
}

function renderDraftRecovery(id) {
  if (!$('draftRecovery') || $('noteEditor')?.dataset.collection !== id) return;
  const note = getNote(id), drafts = localDrafts(id).filter(x => x.text !== note.text || (!x.archived && x.revision !== note.revision));
  $('draftRecovery').innerHTML = drafts.length ? `<details><summary>本机另存稿 · ${drafts.length}</summary>${drafts.map(draft => { const identical = !draft.archived && !note.dirty && draft.text === note.text && draft.revision <= note.revision;
    return `<button type="button" class="draft-row" ${identical ? 'data-confirm-draft' : 'data-load-draft'}="${esc(draft.key)}"><span>${esc(draft.text.slice(0, 75) || '空白草稿')}</span><small>${identical ? '内容已同步 · 确认' : '载入编辑 ›'}</small></button>`;
  }).join('')}</details>` : '';
}

function renderNoteConflict(id) {
  const note = getNote(id); if (!$('noteConflict') || $('noteEditor')?.dataset.collection !== id) return;
  $('noteConflict').innerHTML = note.conflict ? '<div class="conflict-box"><p>另一设备已有更新，本机笔记已保留。</p><button type="button" data-notes-cloud>查看云端版本</button><button type="button" data-notes-local>保存本机版本</button></div>' : '';
}

async function saveNote(id) {
  const note = getNote(id); if (!S.owner || !note.dirty || note.saving || note.conflict) return;
  if (S.offline) { noteStatus(note.localFailed ? '本机保存未完成，请导出' : '已保存在本机，联网后同步', id); return; }
  note.saving = true; const text = note.text, base = note.revision, owner = S.owner;
  try {
    const result = await api('/api/state', { method: 'PUT', body: { key: `notes:${id}`, value: text, baseRevision: base } });
    if (S.owner !== owner) return;
    try { journal().acknowledge(id, { text, baseRevision: base, revision: result.revision }); note.localFailed = false; }
    catch { note.localFailed = true; }
    note.revision = result.revision; note.dirty = note.text !== text; note.retryCount = 0;
    if (note.dirty) persistNote(id);
    if ($('noteEditor')?.dataset.collection === id) { noteStatus(note.dirty ? '正在同步…' : note.localFailed ? '云端已同步，本机保存未完成' : '已同步', id); renderDraftRecovery(id); }
  } catch (error) {
    if (S.owner !== owner) return;
    if (error.status === 409) { note.conflict = error.data.current || { value: '', revision: 0 }; renderNoteConflict(id); }
    if ($('noteEditor')?.dataset.collection === id) noteStatus(error.status === 409 ? '两份笔记均已保留' : note.localFailed ? '保存未完成，请导出笔记' : '已保存在本机，等待同步', id);
    if ((!error.status || error.status >= 500) && navigator.onLine && (note.retryCount || 0) < 2) { note.retryCount = (note.retryCount || 0) + 1; clearTimeout(note.timer); note.timer = setTimeout(() => { if (S.owner === owner) void saveNote(id); }, 1500 * note.retryCount); }
  } finally { note.saving = false; if (S.owner === owner && note.dirty && !note.conflict && note.revision !== base) void saveNote(id); }
}

function exportNotes(id) {
  const collection = S.library.collections.find(c => c.id === id);
  const url = URL.createObjectURL(new Blob([`# ${collection.title}\n\n${getNote(id).text}\n`], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${collection.title}-笔记.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function syncPending() {
  for (const [key, record] of Object.entries(S.records)) if (record.dirty) await syncRecord(key);
  for (const [id, note] of S.notes) if (note.dirty) await saveNote(id);
}

function applySettings() {
  document.documentElement.style.setProperty('--reading-size', `${S.settings.fontSize}px`);
  document.documentElement.style.setProperty('--code-size', `${S.settings.codeSize}px`);
  $('readingArticle').classList.toggle('wrap-code', Boolean(S.settings.wrapCode));
}

function saveSettings() {
  writeLocal('preferences', S.settings); S.records.preferences = { value: { ...S.settings }, dirty: true };
  writeLocal('records', S.records); void syncRecord('preferences');
}

function showSettings() {
  if (waitForSheetClose(showSettings)) return;
  showSheet('设置', `<section class="settings-group"><h3>阅读</h3>
    <div class="settings-row"><span>正文字号</span><div><button type="button" data-font="-1" aria-label="缩小正文字号">−</button> <output id="fontValue">${S.settings.fontSize}</output> <button type="button" data-font="1" aria-label="放大正文字号">＋</button></div></div>
    <div class="settings-row"><span>代码字号</span><div><button type="button" data-code-font="-0.5" aria-label="缩小代码字号">−</button> <output id="codeFontValue">${S.settings.codeSize}</output> <button type="button" data-code-font="0.5" aria-label="放大代码字号">＋</button></div></div>
    <label class="settings-row"><span>代码自动换行</span><input id="wrapCode" type="checkbox"${S.settings.wrapCode ? ' checked' : ''}></label>
    <label class="settings-row"><span>打开时下载章节</span><input id="preloadContent" type="checkbox"${S.settings.preload ? ' checked' : ''}></label>
    ${S.active ? '<button type="button" class="settings-link" data-settings-pure><span>纯净阅读</span><span aria-hidden="true">›</span></button>' : ''}</section>
    ${S.active ? `<section class="settings-group"><h3>${esc(S.active.collection.title)}</h3><button type="button" class="settings-link" data-show-source><span>查看源码</span><span aria-hidden="true">›</span></button><button type="button" class="settings-link" data-download-current><span>下载本章<small>含C++源码</small></span><span aria-hidden="true">↓</span></button></section>` : ''}
    <section class="settings-group"><h3>应用</h3><button type="button" class="settings-link" data-check-updates><span>检查内容更新</span><span aria-hidden="true">↻</span></button><button type="button" class="settings-link" data-reload-app${S.updateReady ? '' : ' hidden'}><span>重新载入应用</span><span aria-hidden="true">↻</span></button><button type="button" class="settings-link" data-install-info><span>添加到主屏幕</span><span aria-hidden="true">›</span></button><button type="button" class="settings-link sign-out" data-logout><span>退出登录</span></button></section>`, 'settings');
}

async function showSource() {
  if (waitForSheetClose(showSource)) return;
  const meta = S.active?.meta; if (!meta) return;
  showSheet('C++源码', '<p class="empty-state">正在打开…</p>', 'source', rememberSheet(showSettings));
  const sequence = sheetSequence, owner = S.owner;
  try {
    await ensureContentRelease();
    if (sheetView !== 'source' || sequence !== sheetSequence || S.owner !== owner) return;
    const response = await fetch(meta.sourceUrl, { credentials: 'same-origin' });
    if (response.status === 401) { lock(); return; }
    if (!response.ok) throw Error('源码暂时不可用。');
    const text = await response.text();
    if (sheetView !== 'source' || sequence !== sheetSequence || S.owner !== owner || S.active?.meta.id !== meta.id) return;
    $('sheetBody').innerHTML = `<div class="action-row"><button type="button" data-copy-source>复制全部</button><a class="button-link" href="${esc(meta.sourceUrl)}" download="${esc(meta.title)}.cpp">下载.cpp</a></div><pre class="source-view"><code></code></pre>`;
    $('sheetBody').querySelector('code').textContent = text;
  } catch (error) { if (sheetView === 'source' && sequence === sheetSequence && S.owner === owner && S.active?.meta.id === meta.id) $('sheetBody').innerHTML = `<p>${esc(error.message)}</p>`; }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  else {
    const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.left = '-9999px'; document.body.append(field); field.select();
    const ok = document.execCommand('copy'); field.remove(); if (!ok) throw Error('无法复制，请长按选择代码。');
  }
  toast('已复制');
}

async function downloadCollection(collection, show = true) {
  if (!S.owner) return;
  try { await ensureContentRelease(); }
  catch (error) { if (show) toast(error.message); return; }
  if (!S.owner) return;
  const key = `${S.owner}:${collection.id}:${S.library.version}`;
  const ids = new Set(collection.documents.flatMap(d => d.knowledgeIds || []));
  const urls = ['/library/catalog.json', ...collection.documents.flatMap(d => [d.url, d.sourceUrl]),
    ...S.library.questions.filter(q => ids.has(q.id) && q.url).map(q => q.url)];
  if (!downloads.has(key)) downloads.set(key, swMessage({ type: 'CACHE_CONTENT', owner: S.owner, urls }));
  const job = downloads.get(key), result = await job;
  if (downloads.get(key) === job) downloads.delete(key);
  if (show) toast(result?.ok ? '本册已可离线阅读' : '未能完成下载，请联网重试。');
}

async function checkUpdates() {
  const owner = S.owner; if (!owner) return;
  const button = document.querySelector('[data-check-updates]'); if (button) button.disabled = true;
  try {
    await syncPending();
    const [library, { state }] = await Promise.all([api('/api/library'), api('/api/state')]);
    if (S.owner !== owner) return;
    const published = publishedLibrary(library), changed = library.version !== S.library.version;
    const newerRelease = library.version !== PUBLICATION_INDEX.version;
    if (newerRelease) {
      await waitForWorkerRelease({ serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
        build: BUILD, different: true, onWait: () => toast('应用正在更新，请稍候…') });
      if (S.owner !== owner) return;
      S.updateReady = true; const reload = document.querySelector('[data-reload-app]'); if (reload) reload.hidden = false;
    }
    S.library = published; S.offline = false; writeLocal('catalog', published);
    for (const [key, record] of Object.entries(state)) {
      if (key.startsWith('notes:')) { const id = key.slice(6); journal().cache(id, { text: record.value, revision: record.revision }); const note = S.notes.get(id); if (PUBLICATION_INDEX.collections[id] && !note?.dirty && !note?.saving) S.notes.set(id, journal().load(id)); }
      else if (!S.records[key]?.dirty && (!S.records[key]?.revision || record.revision >= S.records[key].revision)) S.records[key] = record;
    }
    writeLocal('records', S.records);
    for (const [id, document] of S.docs) if (!allDocuments().some(x => x.document.id === id && x.document.revision === document.revision)) S.docs.delete(id);
    updateConnection();
    const active = S.active, current = allDocuments().find(x => x.document.id === active?.meta.id)?.document;
    if (active && current?.revision !== active.meta.revision) dismissSheet(() => navigate(active.route, { replace: true }));
    else if (!$('libraryView').hidden) { const query = $('librarySearch').value; renderLibrary(); if (query.trim()) void search(query, $('bookList'), allDocuments()); }
    toast(newerRelease ? '有内容更新，请重新载入应用。' : changed ? '内容已更新' : '已是最新内容');
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
  } catch (error) { if (S.owner === owner) toast(error.code === 'WORKER_RELEASE_PENDING' ? error.message : '暂时无法检查更新，请联网重试。'); }
  finally { if (button) button.disabled = false; }
}

async function reloadApp(button) {
  savePosition();
  if ([...S.notes.values()].some(note => note.dirty && note.localFailed)) { toast('本机草稿尚未保存，请先导出。'); return; }
  button.disabled = true;
  try {
    await waitForWorkerRelease({ serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
      build: BUILD, different: true, onWait: () => toast('应用正在更新，请稍候…') });
    if ([...S.notes.values()].some(note => note.dirty && note.localFailed)) { toast('本机草稿尚未保存，请先导出。'); return; }
    location.reload();
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

function setPure(on) {
  if (on && !S.active) return;
  const pane = $('readingPane'), before = pane.getBoundingClientRect().top;
  S.pure = on; document.body.classList.toggle('pure-mode', on); $('pureButton').setAttribute('aria-pressed', String(on));
  const delta = pane.getBoundingClientRect().top - before; pane.scrollTop += delta;
  if (on) hideControls(); else revealControls();
}

function hideControls() {
  if (!S.pure) return;
  document.body.classList.remove('pure-controls-visible');
  for (const selector of ['.app-header', '.context-bar', '.document-tabs', '.reader-footer']) document.querySelector(selector)?.setAttribute('inert', '');
}

function revealControls() {
  clearTimeout(S.controlsTimer); document.body.classList.add('pure-controls-visible');
  for (const selector of ['.app-header', '.context-bar', '.document-tabs', '.reader-footer']) document.querySelector(selector)?.removeAttribute('inert');
  if (S.pure) S.controlsTimer = setTimeout(() => {
    if ($('sheetDialog').open || heldControls || (document.activeElement?.matches(':focus-visible') && document.activeElement.closest('.app-header,.context-bar,.document-tabs,.reader-footer'))) { revealControls(); return; }
    hideControls();
  }, 3000);
}

function exportLocalDrafts() {
  const sections = S.library.collections.flatMap(collection => localDrafts(collection.id).map((draft, index) => `## ${collection.title} · ${index + 1}\n\n${draft.text}\n`));
  const url = URL.createObjectURL(new Blob(['# 第二算法 · 本机另存稿\n\n' + sections.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = '第二算法-本机另存稿.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function logout(confirmed = false) {
  await syncPending();
  const pending = [...S.notes].find(([, note]) => note.dirty);
  if (pending) { toast('仍有未同步笔记，请先联网同步后再退出。'); return; }
  if (S.library.collections.some(collection => journal().list(collection.id).length)) { toast('本机还有其他草稿，请先在笔记中处理。'); return; }
  if (!confirmed && S.library.collections.some(collection => localDrafts(collection.id).some(draft => draft.archived))) {
    showSheet('退出登录', '<p>退出会清除此设备的离线内容和本机另存稿，已同步的云端笔记保留。</p><div class="action-row"><button type="button" data-export-local>导出本机另存稿</button><button type="button" data-confirm-logout>退出并清除本机副本</button></div>', 'logout', rememberSheet(showSettings)); return;
  }
  const owner = S.owner;
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { toast('暂时无法退出，请联网重试。'); return; }
  const namespace = `second-algorithm:${owner}:`, visible = new Set(S.library.collections.map(collection => collection.id));
  for (const key of Object.keys(localStorage)) if (key.startsWith(namespace)) {
    let noteKey = key.slice(namespace.length);
    if (noteKey.startsWith('notes-confirmed:')) {
      try { noteKey = decodeURIComponent(noteKey.slice('notes-confirmed:'.length)); } catch { continue; }
    }
    const match = noteKey.match(/^notes(?:-cache|-draft|-backup)?:([^:]+)(?::|$)/);
    // Retired material has no reader/recovery UI. Keep its historical notes and
    // unsent drafts recoverable rather than silently deleting them at logout.
    if (noteKey.startsWith('notes') && (!match || !visible.has(match[1]))) continue;
    localStorage.removeItem(key);
  }
  lock('已退出登录。'); await connect();
}

document.addEventListener('click', event => {
  const knowledge = event.target.closest('[data-knowledge]');
  if (knowledge) { event.preventDefault(); void showKnowledge(knowledge.dataset.knowledge, knowledge.dataset.knowledgeAnchor || '', knowledge.hasAttribute('data-knowledge-retry')); return; }
  const cardAnchor = sheetView === 'knowledge' && event.target.closest('a[href^="#"]');
  if (cardAnchor && !cardAnchor.getAttribute('href').startsWith('#/')) {
    event.preventDefault();
    $('sheetBody').querySelector('#' + CSS.escape(decodeURIComponent(cardAnchor.hash.slice(1))))?.scrollIntoView({ block: 'start' }); return;
  }
  const button = event.target.closest('button');
  if (button?.matches('[data-sheet-close]')) { dismissSheet(); return; }
  if (button?.matches('[data-cancel-route]')) { cancelPendingRoute(); return; }
  if (button?.dataset.retryRoute) { navigate(button.dataset.retryRoute); return; }
  if (button?.dataset.openCollection) { navigate(`#/read/${button.dataset.openCollection}/${button.dataset.openDocument}`); return; }
  if (button?.dataset.document && S.active) { navigate(`#/read/${S.active.collection.id}/${button.dataset.document}`); return; }
  if (button?.dataset.goDocument) {
    if (S.active) S.back.push({ hash: activeHash(), position: capturePosition() });
    navigate(`#/read/${button.dataset.goCollection}/${button.dataset.goDocument}?anchor=${encodeURIComponent(button.dataset.anchor || '')}`); return;
  }
  if (button?.matches('[data-copy-code]')) { void copyText(button.closest('.code-block').querySelector('code').textContent).catch(e => toast(e.message)); return; }
  if (button?.matches('[data-copy-source]')) { void copyText($('sheetBody').querySelector('code').textContent).catch(e => toast(e.message)); return; }
  if (button?.dataset.font || button?.dataset.codeFont) {
    const position = S.active ? capturePosition() : null;
    if (button.dataset.font) S.settings.fontSize = Math.max(15, Math.min(24, S.settings.fontSize + Number(button.dataset.font)));
    else S.settings.codeSize = Math.max(12, Math.min(20, S.settings.codeSize + Number(button.dataset.codeFont)));
    applySettings(); if (position) restorePosition(position); saveSettings();
    if ($('fontValue')) $('fontValue').value = S.settings.fontSize;
    if ($('codeFontValue')) $('codeFontValue').value = S.settings.codeSize; return;
  }
  if (button?.matches('[data-settings-pure]')) { dismissSheet(() => setPure(true)); return; }
  if (button?.matches('[data-show-source]')) { void showSource(); return; }
  if (button?.matches('[data-download-current]')) { const collection = S.active.collection; button.disabled = true; void downloadCollection(collection).finally(() => { button.disabled = false; }); return; }
  if (button?.matches('[data-check-updates]')) { void checkUpdates(); return; }
  if (button?.matches('[data-reload-app]')) { void reloadApp(button); return; }
  if (button?.matches('[data-sync-notes]')) { void reconnect(); return; }
  if (button?.matches('[data-export-notes]')) { exportNotes($('noteEditor').dataset.collection); return; }
  if (button?.matches('[data-notes-cloud]')) {
    const id = $('noteEditor').dataset.collection, note = getNote(id);
    showSheet('云端笔记', `<pre class="note-cloud"></pre><button type="button" data-adopt-cloud="${id}">使用云端版本</button>`, 'note-cloud', rememberSheet(showNotes));
    $('sheetBody').querySelector('pre').textContent = note.conflict.value; return;
  }
  if (button?.dataset.adoptCloud) {
    const id = button.dataset.adoptCloud, note = getNote(id); if (!archiveNote(id, note)) return;
    for (const draft of journal().list(id)) if (draft.text === note.text) journal().discard(id, draft.key, draft.text);
    note.text = note.conflict.value; note.revision = note.conflict.revision; note.dirty = false; delete note.conflict; persistNote(id); showNotes(); return;
  }
  if (button?.matches('[data-notes-local]')) {
    const id = $('noteEditor').dataset.collection, note = getNote(id);
    for (const draft of journal().list(id)) if (draft.text === note.text) journal().discard(id, draft.key, draft.text);
    note.revision = note.conflict.revision; delete note.conflict; persistNote(id); renderNoteConflict(id); void saveNote(id); return;
  }
  if (button?.dataset.loadDraft) {
    const id = $('noteEditor').dataset.collection, note = getNote(id), draft = localDrafts(id).find(x => x.key === button.dataset.loadDraft);
    if (!draft) { renderDraftRecovery(id); return; }
    if (!archiveNote(id, note)) return; clearTimeout(note.timer); note.text = draft.text; note.revision = draft.revision; note.dirty = true; delete note.conflict; persistNote(id); showNotes(); return;
  }
  if (button?.dataset.confirmDraft) {
    const id = $('noteEditor').dataset.collection, note = getNote(id), draft = journal().list(id).find(x => x.key === button.dataset.confirmDraft);
    if (draft && !note.dirty && draft.text === note.text && draft.revision <= note.revision) journal().discard(id, draft.key, draft.text);
    renderDraftRecovery(id); return;
  }
  if (button?.matches('[data-install-info]')) { showSheet('添加到主屏幕', '<p>iPhone：在Safari中点“分享”，选择“添加到主屏幕”。</p><p>电脑：使用浏览器地址栏中的安装入口。</p>', 'install', rememberSheet(showSettings)); return; }
  if (button?.matches('[data-logout]')) { void logout(); return; }
  if (button?.matches('[data-export-local]')) { exportLocalDrafts(); return; }
  if (button?.matches('[data-confirm-logout]')) { void logout(true); return; }
  const link = event.target.closest('#readingArticle a');
  if (link?.getAttribute('href')?.startsWith('#')) {
    const href = link.getAttribute('href'); event.preventDefault();
    S.back.push({ hash: activeHash(), position: capturePosition() });
    if (href.startsWith('#/read/')) navigate(href); else { jumpTo(decodeURIComponent(href.slice(1))); updateProgress(); }
  }
});

let searchTimer, tocSearchTimer;
document.addEventListener('input', event => {
  if (event.target.id === 'librarySearch' || event.target.id === 'tocSearch') {
    const library = event.target.id === 'librarySearch'; clearTimeout(library ? searchTimer : tocSearchTimer); const query = event.target.value;
    if (event.target.id === 'librarySearch') { shelf.query = query; shelf.scroll = 0; writeLocal('shelf', shelf); }
    if (!query.trim()) { S.searchSequence++; if (event.target.id === 'librarySearch') renderLibrary(); else $('tocResults').innerHTML = tocMarkup(); return; }
    const container = library ? $('bookList') : $('tocResults');
    const pairs = allDocuments().filter(x => library || x.collection.id === S.active.collection.id);
    const timer = setTimeout(() => { void search(query, container, pairs); }, 250); if (library) searchTimer = timer; else tocSearchTimer = timer;
  }
  if (event.target.id === 'noteEditor') {
    const id = event.target.dataset.collection, note = getNote(id); note.text = event.target.value; note.dirty = true; note.retryCount = 0; persistNote(id);
    noteStatus(note.localFailed ? '本机保存未完成，正在尝试同步' : S.offline ? '已保存在本机，联网后同步' : '正在保存…'); clearTimeout(note.timer); note.timer = setTimeout(() => { void saveNote(id); }, 900);
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'documentSelect' && S.active) { navigate(`#/read/${S.active.collection.id}/${event.target.value}`); return; }
  if (event.target.id === 'wrapCode') {
    const position = S.active ? capturePosition() : null; S.settings.wrapCode = event.target.checked; applySettings(); if (position) restorePosition(position); saveSettings();
  }
  if (event.target.id === 'preloadContent') { S.settings.preload = event.target.checked; saveSettings(); if (S.settings.preload && S.active) void downloadCollection(S.active.collection, false); }
});

$('loginButton').addEventListener('click', async () => {
  $('loginButton').disabled = true;
  try { await passkey('login', api); await connect(); } catch (e) { $('loginMessage').textContent = e.name === 'NotAllowedError' ? '已取消验证，请重试。' : e.message; }
  finally { $('loginButton').disabled = false; }
});
$('enrollForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { await passkey('enroll', api, $('setupKey').value); $('setupKey').value = ''; await connect(); $('loginMessage').textContent = '通行密钥已创建，请登录。'; }
  catch (e) { $('loginMessage').textContent = e.name === 'NotAllowedError' ? '已取消创建，请重试。' : e.message; }
  finally { button.disabled = false; }
});
$('retryButton').addEventListener('click', () => { void connect(); });
$('libraryButton').addEventListener('click', () => { navigate('#/library'); });
$('libraryResume').addEventListener('click', event => { navigate(event.currentTarget.dataset.route); });
$('settingsButton').addEventListener('click', showSettings);
$('tocButton').addEventListener('click', showToc);
$('notesButton').addEventListener('click', showNotes);
$('pureButton').addEventListener('click', () => setPure(!S.pure));
$('sheetBack').addEventListener('click', () => { const parent = sheetParent; if (parent) parent(); });
$('sheetDialog').addEventListener('close', () => { if ($('sheetDialog').open) return; sheetSequence++; clearTimeout(tocSearchTimer); for (const [id, note] of S.notes) if (note.dirty) void saveNote(id); revealControls(); if (sheetHistory && !sheetClosing) { sheetClosing = true; history.back(); } });
$('sheetDialog').addEventListener('click', event => { if (event.target === $('sheetDialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismissSheet(); } });
$('returnButton').addEventListener('click', async () => {
  const previous = S.back.pop(); if (!previous) return;
  S.returnTo = previous; navigate(previous.hash);
});
let scrollFrame, localPositionTimer;
$('readingPane').addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updateProgress(); }); clearTimeout(localPositionTimer); localPositionTimer = setTimeout(savePosition, 180); }, { passive: true });
$('readingPane').addEventListener('dblclick', event => {
  if (event.target.closest('pre,code,table,a,button,input,textarea,select') || !getSelection().isCollapsed) return;
  event.preventDefault(); setPure(!S.pure);
});
$('readingPane').addEventListener('click', event => { if (S.pure && !event.target.closest('.code-block,pre,code,.table-wrap,table,a,button,input,textarea,select') && getSelection().isCollapsed) revealControls(); });

const controlsSelector = '.app-header,.context-bar,.document-tabs,.reader-footer';
document.addEventListener('pointerdown', event => { if (S.pure && event.target.closest(controlsSelector)) { heldControls = true; revealControls(); } });
document.addEventListener('pointerup', () => { if (heldControls) { heldControls = false; revealControls(); } });
document.addEventListener('pointercancel', () => { if (heldControls) { heldControls = false; revealControls(); } });
document.addEventListener('focusin', event => { if (S.pure && event.target.closest(controlsSelector)) revealControls(); });

document.addEventListener('keydown', event => {
  const tab = event.target.closest('[role="tab"]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')], current = tabs.indexOf(tab);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
  event.preventDefault(); for (const button of tabs) button.tabIndex = button === tabs[index] ? 0 : -1; tabs[index].focus();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && S.pure && !$('sheetDialog').open) setPure(false); });
window.addEventListener('hashchange', () => { void route(); });
window.addEventListener('popstate', () => {
  if (!sheetHistory) {
    if (S.back.at(-1)?.hash === location.hash) S.back.pop();
    void route(); return;
  }
  sheetHistory = false; sheetClosing = false;
  sheetSequence++;
  if ($('sheetDialog').open) $('sheetDialog').close();
  const opener = sheetOpener; sheetOpener = null;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  const action = afterSheetClose; afterSheetClose = null; action?.();
});
async function reconnect(attempt = 0) {
  if (reconnecting) return;
  if (!S.owner) { void connect(); return; }
  reconnecting = true; const owner = S.owner;
  try { const status = await api('/auth/status'); if (S.owner !== owner) return;
    if (!status.authenticated || status.ownerScope !== owner) { lock(); return; }
    S.offline = false; updateConnection(); localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt: Date.now() }));
    void swMessage({ type: 'OWNER', owner }); await syncPending();
  } catch { if (S.owner === owner && navigator.onLine && attempt < 2) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { void reconnect(attempt + 1); }, 1200 * (attempt + 1)); } }
  finally { reconnecting = false; }
}
window.addEventListener('online', () => { void reconnect(); });
window.addEventListener('focus', () => { if (navigator.onLine && S.owner) S.offline ? void reconnect() : void syncPending(); });
window.addEventListener('offline', () => { S.offline = true; updateConnection(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { savePosition(); void syncPending(); } else if (navigator.onLine && S.owner) S.offline ? void reconnect() : void syncPending(); });
window.addEventListener('storage', event => { if (!S.owner || !event.key?.startsWith(prefix() + 'notes-')) return; if (S.active) renderDraftRecovery(S.active.collection.id); });
window.addEventListener('beforeunload', event => { if ([...S.notes.values()].some(note => note.dirty && note.localFailed)) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', savePosition);

function fitSheetViewport() {
  const viewport = window.visualViewport, style = document.documentElement.style;
  if (!viewport || viewport.scale > 1.02) { for (const name of ['--sheet-viewport-height','--sheet-offset-top','--sheet-offset-bottom']) style.removeProperty(name); return; }
  style.setProperty('--sheet-viewport-height', `${viewport.height}px`);
  style.setProperty('--sheet-offset-top', `${Math.max(0, viewport.offsetTop)}px`);
  style.setProperty('--sheet-offset-bottom', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`);
}
window.visualViewport?.addEventListener('resize', fitSheetViewport);
window.visualViewport?.addEventListener('scroll', fitSheetViewport);
window.addEventListener('resize', fitSheetViewport); fitSheetViewport();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'AUTH_REQUIRED' && S.owner) lock(); });
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    const version = await swMessage({ type: 'VERSION' });
    if (BUILD && version?.build && version.build !== BUILD) { S.updateReady = true; const button = document.querySelector('[data-reload-app]'); if (button) button.hidden = false; toast('应用有更新，可在设置重新载入。'); }
  });
}
void connect();
