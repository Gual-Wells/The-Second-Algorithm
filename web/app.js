import { passkey } from './auth.js';

const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const S = { owner: null, library: null, records: {}, docs: new Map(), notes: new Map(), active: null,
  track: 'algorithm', offline: false, sequence: 0, searchSequence: 0, back: [], pure: false, restoring: false, returnTo: null,
  settings: { fontSize: 17, codeSize: 13.5, wrapCode: false, preload: true }, controlsTimer: 0 };
const SESSION_KEY = 'second-algorithm:last-session';
const prefix = () => `second-algorithm:${S.owner}:`;
const readLocal = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(prefix() + key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(prefix() + key, JSON.stringify(value)); } catch { toast('本机存储空间不足，请导出尚未同步的笔记。'); } };
const allDocuments = () => S.library?.collections.flatMap(c => c.documents.map(d => ({ collection: c, document: d }))) || [];
const trackName = track => track === 'cpp' ? 'C++册' : '算法册';
let positionTimer, toastTimer, sheetView, sheetParent, sheetSequence = 0, reconnectTimer, reconnecting = false;
const syncing = new Map(), downloads = new Map();

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store',
    ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url.startsWith('/api/')) lock('请重新使用通行密钥登录。');
    const error = new Error(data.error || '暂时无法连接。'); error.status = response.status; error.data = data; throw error;
  }
  return data;
}

async function swMessage(message) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(() => resolve(null), 4000))]);
  if (!registration) return null;
  const worker = registration.active || navigator.serviceWorker.controller;
  if (!worker) return;
  return new Promise(resolve => {
    const channel = new MessageChannel(); const timer = setTimeout(() => resolve(null), 45_000);
    channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); };
    worker.postMessage(message, [channel.port2]);
  });
}

function lock(message = '使用通行密钥进入阅读室。') {
  S.sequence++; S.owner = null; S.active = null; S.library = null; S.docs.clear(); S.records = {}; S.notes.clear(); S.returnTo = null; S.restoring = false; downloads.clear(); clearTimeout(reconnectTimer);
  localStorage.removeItem(SESSION_KEY); setPure(false);
  if ($('sheetDialog').open) $('sheetDialog').close();
  $('headerActions').hidden = $('trackTabs').hidden = $('libraryView').hidden = $('readerView').hidden = true;
  $('loginView').hidden = false; $('loginMessage').textContent = message; $('retryButton').hidden = false;
  $('loginButton').hidden = false; void swMessage({ type: 'CLEAR_PRIVATE' });
}

async function connect() {
  $('retryButton').hidden = true; $('loginMessage').textContent = '正在连接…';
  try {
    const status = await api('/auth/status');
    $('enrollForm').hidden = !status.enrollmentOpen;
    $('loginButton').hidden = !status.enrolled;
    if (!status.authenticated) {
      if (S.owner) lock();
      $('loginMessage').textContent = status.enrollmentOpen ? '为此阅读室创建通行密钥。'
        : status.enrolled ? '使用通行密钥进入阅读室。' : '尚未登记通行密钥。';
      return;
    }
    await enter(status.ownerScope, false);
  } catch (error) {
    let last; try { last = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch {}
    if (!error.status && last?.owner && Date.now() - last.verifiedAt < 90 * 86400_000) {
      try { await enter(last.owner, true); return; } catch {}
    }
    $('loginMessage').textContent = error.message || '暂时无法连接。'; $('retryButton').hidden = false;
  }
}

async function enter(owner, offline) {
  S.owner = owner; S.offline = offline;
  const cached = readLocal('catalog');
  S.library = offline ? cached : await api('/api/library');
  if (!S.library?.collections) throw Error('还没有可离线阅读的内容。');
  writeLocal('catalog', S.library);
  S.records = readLocal('records', {});
  if (!offline) {
    let state = {}, stateAvailable = false;
    try { ({ state } = await api('/api/state')); stateAvailable = true; }
    catch (error) { if (error.status === 401) throw error; toast('同步暂不可用，笔记先保存在本机。'); }
    for (const [key, record] of Object.entries(state)) {
      if (key.startsWith('notes:')) continue;
      const local = S.records[key];
      if (!local?.dirty) S.records[key] = record;
    }
    for (const collection of S.library.collections) {
      const key = `notes:${collection.id}`, remote = state[key];
      const local = readLocal(key);
      S.notes.set(collection.id, local && (local.dirty || !stateAvailable) ? { ...local, saving: false }
        : { text: remote?.value || '', revision: remote?.revision || 0, dirty: false });
      persistNote(collection.id);
    }
    writeLocal('records', S.records);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt: Date.now() }));
  } else for (const c of S.library.collections) S.notes.set(c.id, readLocal(`notes:${c.id}`, { text: '', revision: 0, dirty: false }));
  const remotePreferences = S.records.preferences?.value;
  S.settings = { ...S.settings, ...(remotePreferences || readLocal('preferences', {})) };
  S.settings.fontSize = Math.max(15, Math.min(24, Number(S.settings.fontSize) || 17));
  S.settings.codeSize = Math.max(12, Math.min(20, Number(S.settings.codeSize) || 13.5));
  S.track = readLocal('track', 'algorithm'); applySettings();
  $('loginView').hidden = true; $('headerActions').hidden = $('trackTabs').hidden = false;
  await swMessage({ type: 'OWNER', owner, verifiedAt: offline ? JSON.parse(localStorage.getItem(SESSION_KEY)).verifiedAt : Date.now() });
  $('connectionLabel').textContent = offline ? '离线' : '';
  if (!location.hash || location.hash === '#/') {
    const route = readLocal('lastRoute');
    history.replaceState(null, '', route || `#/library/${S.track}`);
  }
  await route();
  if (!offline) void syncPending();
}

function navigate(hash, { replace = false } = {}) {
  savePosition();
  if (location.hash === hash) { void route(); return; }
  if (replace) { history.replaceState(null, '', hash); void route(); }
  else location.hash = hash;
}

async function getDocument(meta) {
  if (S.docs.has(meta.id)) return S.docs.get(meta.id);
  const owner = S.owner;
  const response = await fetch(meta.url, { credentials: 'same-origin' });
  if (response.status === 401) { lock(); throw Error('请重新登录。'); }
  if (!response.ok) throw Error(S.offline ? '此篇尚未下载。' : response.status === 404 ? '内容已更新，请刷新阅读器。' : '此篇暂时无法打开。');
  const document = await response.json();
  if (!owner || S.owner !== owner) throw Error('登录状态已变化。');
  if (document.revision !== meta.revision) throw Error('内容版本已更新，请重新打开章节册。');
  S.docs.set(meta.id, document); return document;
}

async function route() {
  if (!S.owner || !S.library) return;
  clearTimeout(searchTimer); S.searchSequence++;
  const sequence = ++S.sequence;
  const raw = location.hash || `#/library/${S.track}`;
  const [pathname, query = ''] = raw.slice(1).split('?');
  const [, section, collectionId, docId] = pathname.split('/');
  if (section !== 'read') {
    S.track = collectionId === 'cpp' ? 'cpp' : 'algorithm'; S.active = null; S.restoring = false; S.back = []; S.returnTo = null; setPure(false);
    $('readerView').hidden = true; $('libraryView').hidden = false;
    $('libraryTitle').textContent = trackName(S.track); $('librarySearch').value = '';
    markTrack(); writeLocal('track', S.track); writeLocal('lastRoute', `#/library/${S.track}`); renderLibrary(); return;
  }
  const collection = S.library.collections.find(c => c.id === collectionId);
  const meta = collection?.documents.find(d => d.id === docId);
  if (!meta) { navigate(`#/library/${S.track}`, { replace: true }); return; }
  S.active = null; S.restoring = true; S.track = collection.track; markTrack();
  $('libraryView').hidden = true; $('readerView').hidden = false;
  $('currentTitle').textContent = meta.title; $('currentKind').textContent = collection.kind === 'trial' ? '试读' : `第${collection.chapterNumber}章`;
  $('documentTabs').innerHTML = collection.documents.map(d => `<button role="tab" type="button" data-document="${d.id}" aria-selected="${d.id === meta.id}">${esc(d.title)}</button>`).join('');
  $('documentTabs').hidden = collection.documents.length < 2;
  $('documentTabs').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $('readingArticle').innerHTML = '<p class="empty-state">正在打开…</p>';
  try {
    const content = await getDocument(meta); if (sequence !== S.sequence) return;
    S.active = { collection, meta, content }; $('readingArticle').innerHTML = content.html;
    let index = 0;
    for (const node of $('readingArticle').querySelectorAll('h2,h3,h4,p,pre,table,li')) {
      if (!node.id) node.dataset.readingAnchor = `part-${index}`; index++;
    }
    applySettings();
    await document.fonts.ready; await new Promise(requestAnimationFrame);
    if (sequence !== S.sequence) return;
    const anchor = new URLSearchParams(query).get('anchor');
    if (S.returnTo?.hash === raw) { restorePosition(S.returnTo.position); S.returnTo = null; }
    else if (anchor) jumpTo(anchor); else restorePosition(positionFor(meta.id));
    await new Promise(requestAnimationFrame);
    if (sequence !== S.sequence) return;
    S.restoring = false;
    writeLocal('lastRoute', raw); writeLocal('track', S.track); writeLocal(`last-document:${collection.id}`, meta.id); updateProgress();
    if (S.settings.preload && !S.offline) void downloadCollection(collection, false);
  } catch (error) { if (sequence === S.sequence) { S.restoring = false; S.active = null; $('readingArticle').innerHTML = `<p class="empty-state">${esc(error.message)}</p>`; } }
}

function markTrack() {
  for (const button of document.querySelectorAll('[data-track]')) button.setAttribute('aria-selected', String(button.dataset.track === S.track));
}

function renderLibrary() {
  const entries = S.library.collections.filter(c => c.track === S.track);
  const row = c => {
    const last = c.documents.find(d => d.id === readLocal(`last-document:${c.id}`))
      || [...c.documents].sort((a, b) => (S.records[`position:${b.id}`]?.updatedAt || 0) - (S.records[`position:${a.id}`]?.updatedAt || 0))[0];
    return `<button class="book-row" type="button" data-open-collection="${c.id}" data-open-document="${last.id}"><span><strong>${esc(c.kind === 'chapter' ? `第${c.chapterNumber}章　${c.title}` : c.title)}</strong><small>${c.documents.length}篇${c.documents.some(d => positionFor(d.id)) ? ' · 继续阅读' : ''}</small></span><span aria-hidden="true">›</span></button>`;
  };
  const chapters = entries.filter(c => c.kind === 'chapter'), trials = entries.filter(c => c.kind === 'trial');
  $('bookList').innerHTML = `<section class="shelf-section"><h3>章节</h3>${chapters.length ? chapters.map(row).join('') : '<p class="empty-state">尚无正式章节</p>'}</section>`
    + (trials.length ? `<section class="shelf-section"><h3>试读</h3>${trials.map(row).join('')}</section>` : '');
}

function positionFor(docId) {
  return S.records[`position:${docId}`]?.value || readLocal(`position:${docId}`);
}

function capturePosition() {
  const pane = $('readingPane'), article = $('readingArticle');
  const top = pane.getBoundingClientRect().top;
  let target = article.firstElementChild;
  for (const node of article.querySelectorAll('[id],[data-reading-anchor]')) {
    if (node.getBoundingClientRect().top <= top + 12) target = node; else break;
  }
  return { revision: S.active?.meta.revision, anchor: target?.id || target?.dataset.readingAnchor || '',
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

function savePosition() {
  if (!S.active || !S.owner || S.restoring || $('readerView').hidden) return;
  const key = `position:${S.active.meta.id}`, value = capturePosition();
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
  $('progressLabel').textContent = S.back.length ? '返回阅读处' : `${Math.max(0, Math.min(100, progress))}%`;
  $('progressLabel').setAttribute('aria-label', S.back.length ? '返回阅读处' : `阅读位置 ${progress}%`);
}

function showSheet(title, html, view, parent = null) {
  sheetSequence++;
  sheetView = view; sheetParent = parent; $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html; $('sheetBack').hidden = !parent;
  if (!$('sheetDialog').open) $('sheetDialog').showModal();
  $('sheetBody').scrollTop = 0;
}

function showToc() {
  if (!S.active) return;
  const { collection, meta } = S.active;
  showSheet('目录', `<label class="search-field"><input id="tocSearch" type="search" placeholder="检索本册内容" autocomplete="off"></label><div id="tocResults">${collection.documents.map(d => `<section><h3>${esc(d.title)}</h3>${d.headings.filter(h => h.depth === 2 || h.depth === 3).map(h => `<button type="button" class="toc-row depth-${h.depth}" data-go-document="${d.id}" data-go-collection="${collection.id}" data-anchor="${esc(h.id)}"${d.id === meta.id ? ' data-current="true"' : ''}>${esc(h.text)}</button>`).join('')}</section>`).join('')}</div>`, 'toc');
}

async function search(query, container, pairs) {
  const sequence = ++S.searchSequence;
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return;
  container.innerHTML = '<p class="empty-state">正在检索…</p>';
  const results = [];
  for (const { collection, document: meta } of pairs) {
    try {
      const doc = await getDocument(meta), template = document.createElement('template'); template.innerHTML = doc.html;
      let title = meta.title, anchor = '', text = '';
      const commit = () => {
        const lower = (title + ' ' + text).toLocaleLowerCase(); if (!terms.every(t => lower.includes(t))) return;
        const at = Math.max(0, text.toLocaleLowerCase().indexOf(terms[0]) - 35);
        results.push({ collection, meta, title, anchor, snippet: text.slice(at, at + 125) });
      };
      for (const node of template.content.children) {
        if (/^H[23]$/.test(node.tagName)) { commit(); title = node.textContent; anchor = node.id; text = ''; }
        else text += ' ' + node.textContent;
      }
      commit();
    } catch {}
    if (sequence !== S.searchSequence) return;
  }
  if (sequence !== S.searchSequence) return;
  container.innerHTML = results.length ? results.slice(0, 80).map(r => `<button type="button" class="search-row" data-go-collection="${r.collection.id}" data-go-document="${r.meta.id}" data-anchor="${esc(r.anchor)}"><strong>${esc(r.title)}</strong><small>${esc(r.meta.title)}</small><span class="search-snippet">${esc(r.snippet)}</span></button>`).join('') : '<p class="empty-state">没有找到匹配内容</p>';
}

function getNote(collectionId) {
  if (!S.notes.has(collectionId)) S.notes.set(collectionId, readLocal(`notes:${collectionId}`, { text: '', revision: 0, dirty: false }));
  return S.notes.get(collectionId);
}

function persistNote(id) {
  const note = getNote(id); writeLocal(`notes:${id}`, { text: note.text, revision: note.revision, dirty: note.dirty });
}

function noteStatus(text) { const node = $('noteStatus'); if (node) node.textContent = text; }

function showNotes() {
  if (!S.active) return;
  const id = S.active.collection.id, note = getNote(id);
  showSheet('笔记', `<p class="muted">${esc(S.active.collection.title)}</p><textarea id="noteEditor" class="note-editor" maxlength="20000" aria-label="本篇笔记" placeholder="记下思路与疑问"></textarea><p id="noteStatus" class="save-state" role="status"></p><div id="noteConflict"></div><button type="button" data-export-notes>导出笔记</button>`, 'notes');
  $('noteEditor').value = note.text; $('noteEditor').dataset.collection = id;
  noteStatus(note.dirty ? '已保存在本机，等待同步' : '已保存'); renderNoteConflict(id);
}

function renderNoteConflict(id) {
  const note = getNote(id); if (!$('noteConflict') || $('noteEditor')?.dataset.collection !== id) return;
  $('noteConflict').innerHTML = note.conflict ? '<div class="conflict-box"><p>另一设备已有更新，本机笔记已保留。</p><button type="button" data-notes-cloud>查看云端版本</button><button type="button" data-notes-local>保存本机版本</button></div>' : '';
}

async function saveNote(id) {
  const note = getNote(id); if (!S.owner || !note.dirty || note.saving || note.conflict) return;
  if (S.offline) { noteStatus('已保存在本机，联网后同步'); return; }
  note.saving = true; const text = note.text, base = note.revision, owner = S.owner;
  try {
    const result = await api('/api/state', { method: 'PUT', body: { key: `notes:${id}`, value: text, baseRevision: base } });
    if (S.owner !== owner) return;
    note.revision = result.revision; note.dirty = note.text !== text; persistNote(id);
    if ($('noteEditor')?.dataset.collection === id) noteStatus(note.dirty ? '正在同步…' : '已同步');
  } catch (error) {
    if (S.owner !== owner) return;
    if (error.status === 409) { note.conflict = error.data.current || { value: '', revision: 0 }; renderNoteConflict(id); }
    if ($('noteEditor')?.dataset.collection === id) noteStatus(error.status === 409 ? '两份笔记均已保留' : '已保存在本机，等待同步');
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
  showSheet('设置', `<h3>阅读</h3><div class="settings-row"><span>正文字号</span><div><button type="button" data-font="-1" aria-label="缩小正文字号">−</button> <output id="fontValue">${S.settings.fontSize}</output> <button type="button" data-font="1" aria-label="放大正文字号">＋</button></div></div><div class="settings-row"><span>代码字号</span><div><button type="button" data-code-font="-0.5" aria-label="缩小代码字号">−</button> <output id="codeFontValue">${S.settings.codeSize}</output> <button type="button" data-code-font="0.5" aria-label="放大代码字号">＋</button></div></div><label class="settings-row"><span>代码自动换行</span><input id="wrapCode" type="checkbox"${S.settings.wrapCode ? ' checked' : ''}></label><label class="settings-row"><span>自动下载已打开内容</span><input id="preloadContent" type="checkbox"${S.settings.preload ? ' checked' : ''}></label>${S.active ? '<div class="action-row"><button type="button" data-settings-pure>纯净阅读</button><button type="button" data-show-source>查看源码</button><button type="button" data-download-current>下载本篇</button></div>' : ''}<h3>应用</h3><div class="action-row"><button type="button" data-install-info>添加到主屏幕</button><button type="button" data-logout>退出登录</button></div>`, 'settings');
}

async function showSource() {
  const meta = S.active?.meta; if (!meta) return;
  showSheet('C++源码', '<p class="empty-state">正在打开…</p>', 'source', showSettings);
  const sequence = sheetSequence, owner = S.owner;
  try {
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
  const key = `${S.owner}:${collection.id}:${S.library.version}`;
  const urls = ['/library/catalog.json', ...collection.documents.flatMap(d => [d.url, d.sourceUrl])];
  if (!downloads.has(key)) downloads.set(key, swMessage({ type: 'CACHE_CONTENT', owner: S.owner, urls }));
  const result = await downloads.get(key);
  if (!result?.ok) downloads.delete(key);
  if (show) toast(result?.ok ? '本册已可离线阅读' : '未能完成下载，请联网重试。');
}

function setPure(on) {
  if (on && !S.active) return;
  const pane = $('readingPane'), before = pane.getBoundingClientRect().top;
  S.pure = on; document.body.classList.toggle('pure-mode', on); $('pureButton').setAttribute('aria-pressed', String(on));
  const delta = pane.getBoundingClientRect().top - before; pane.scrollTop += delta;
  revealControls();
}

function revealControls() {
  clearTimeout(S.controlsTimer); document.body.classList.add('pure-controls-visible');
  for (const selector of ['.app-header', '.track-tabs', '.context-bar', '.document-tabs', '.reader-footer']) document.querySelector(selector)?.removeAttribute('inert');
  if (S.pure) S.controlsTimer = setTimeout(() => {
    if ($('sheetDialog').open) { revealControls(); return; }
    document.body.classList.remove('pure-controls-visible');
    for (const selector of ['.app-header', '.track-tabs', '.context-bar', '.document-tabs', '.reader-footer']) document.querySelector(selector)?.setAttribute('inert', '');
  }, 3000);
}

async function logout() {
  await syncPending();
  const pending = [...S.notes].find(([, note]) => note.dirty);
  if (pending) { toast('仍有未同步笔记，请先联网同步后再退出。'); return; }
  const owner = S.owner;
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { toast('暂时无法退出，请联网重试。'); return; }
  for (const key of Object.keys(localStorage)) if (key.startsWith(`second-algorithm:${owner}:`)) localStorage.removeItem(key);
  lock('已退出登录。'); await connect();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.matches('[data-sheet-close]')) { $('sheetDialog').close(); revealControls(); return; }
  if (button?.dataset.track) { $('sheetDialog').close(); navigate(`#/library/${button.dataset.track}`); return; }
  if (button?.dataset.openCollection) { navigate(`#/read/${button.dataset.openCollection}/${button.dataset.openDocument}`); return; }
  if (button?.dataset.document && S.active) { navigate(`#/read/${S.active.collection.id}/${button.dataset.document}`); return; }
  if (button?.dataset.goDocument) {
    if (S.active) S.back.push({ hash: location.hash, position: capturePosition() });
    $('sheetDialog').close(); navigate(`#/read/${button.dataset.goCollection}/${button.dataset.goDocument}?anchor=${encodeURIComponent(button.dataset.anchor || '')}`); return;
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
  if (button?.matches('[data-settings-pure]')) { $('sheetDialog').close(); setPure(true); return; }
  if (button?.matches('[data-show-source]')) { void showSource(); return; }
  if (button?.matches('[data-download-current]')) { void downloadCollection(S.active.collection); return; }
  if (button?.matches('[data-export-notes]')) { exportNotes($('noteEditor').dataset.collection); return; }
  if (button?.matches('[data-notes-cloud]')) {
    const id = $('noteEditor').dataset.collection, note = getNote(id);
    showSheet('云端笔记', `<pre class="note-cloud"></pre><button type="button" data-adopt-cloud="${id}">使用云端版本</button>`, 'note-cloud', showNotes);
    $('sheetBody').querySelector('pre').textContent = note.conflict.value; return;
  }
  if (button?.dataset.adoptCloud) {
    const id = button.dataset.adoptCloud, note = getNote(id); writeLocal(`notes-backup:${id}:${Date.now()}`, note.text);
    note.text = note.conflict.value; note.revision = note.conflict.revision; note.dirty = false; delete note.conflict; persistNote(id); showNotes(); return;
  }
  if (button?.matches('[data-notes-local]')) {
    const id = $('noteEditor').dataset.collection, note = getNote(id); note.revision = note.conflict.revision; delete note.conflict; renderNoteConflict(id); void saveNote(id); return;
  }
  if (button?.matches('[data-install-info]')) { showSheet('添加到主屏幕', '<p>iPhone：在Safari中点“分享”，选择“添加到主屏幕”。</p><p>电脑：使用浏览器地址栏中的安装入口。</p>', 'install', showSettings); return; }
  if (button?.matches('[data-logout]')) { void logout(); return; }
  const link = event.target.closest('#readingArticle a');
  if (link?.getAttribute('href')?.startsWith('#')) {
    const href = link.getAttribute('href'); event.preventDefault();
    S.back.push({ hash: location.hash, position: capturePosition() });
    if (href.startsWith('#/read/')) navigate(href); else { jumpTo(decodeURIComponent(href.slice(1))); updateProgress(); }
  }
});

let searchTimer;
document.addEventListener('input', event => {
  if (event.target.id === 'librarySearch' || event.target.id === 'tocSearch') {
    clearTimeout(searchTimer); const query = event.target.value;
    if (!query.trim()) { S.searchSequence++; event.target.id === 'librarySearch' ? renderLibrary() : showToc(); return; }
    const library = event.target.id === 'librarySearch';
    const container = library ? $('bookList') : $('tocResults');
    const pairs = allDocuments().filter(x => library ? x.collection.track === S.track : x.collection.id === S.active.collection.id);
    searchTimer = setTimeout(() => { void search(query, container, pairs); }, 250);
  }
  if (event.target.id === 'noteEditor') {
    const id = event.target.dataset.collection, note = getNote(id); note.text = event.target.value; note.dirty = true; persistNote(id);
    noteStatus(S.offline ? '已保存在本机，联网后同步' : '正在保存…'); clearTimeout(note.timer); note.timer = setTimeout(() => { void saveNote(id); }, 900);
  }
});

document.addEventListener('change', event => {
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
$('libraryButton').addEventListener('click', () => { navigate(`#/library/${S.track}`); });
$('settingsButton').addEventListener('click', showSettings);
$('tocButton').addEventListener('click', showToc);
$('notesButton').addEventListener('click', showNotes);
$('pureButton').addEventListener('click', () => setPure(!S.pure));
$('sheetBack').addEventListener('click', () => { const parent = sheetParent; if (parent) parent(); });
$('sheetDialog').addEventListener('close', () => { sheetSequence++; for (const [id, note] of S.notes) if (note.dirty) void saveNote(id); revealControls(); });
$('sheetDialog').addEventListener('click', event => { if (event.target === $('sheetDialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('progressLabel').addEventListener('click', async () => {
  const previous = S.back.pop(); if (!previous) return;
  S.returnTo = previous; navigate(previous.hash);
});
$('readingPane').addEventListener('scroll', () => { updateProgress(); savePosition(); }, { passive: true });
$('readingPane').addEventListener('dblclick', event => {
  if (event.target.closest('pre,code,table,a,button,input,textarea,select') || !getSelection().isCollapsed) return;
  event.preventDefault(); setPure(!S.pure);
});
$('readingPane').addEventListener('click', () => { if (S.pure) revealControls(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && S.pure && !$('sheetDialog').open) setPure(false); });
window.addEventListener('hashchange', () => { void route(); });
async function reconnect(attempt = 0) {
  if (reconnecting) return;
  if (!S.owner) { void connect(); return; }
  reconnecting = true; const owner = S.owner;
  try { const status = await api('/auth/status'); if (S.owner !== owner) return;
    if (!status.authenticated || status.ownerScope !== owner) { lock(); return; }
    S.offline = false; $('connectionLabel').textContent = ''; localStorage.setItem(SESSION_KEY, JSON.stringify({ owner, verifiedAt: Date.now() }));
    void swMessage({ type: 'OWNER', owner }); await syncPending();
  } catch { if (S.owner === owner && navigator.onLine && attempt < 2) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { void reconnect(attempt + 1); }, 1200 * (attempt + 1)); } }
  finally { reconnecting = false; }
}
window.addEventListener('online', () => { void reconnect(); });
window.addEventListener('focus', () => { if (S.offline && navigator.onLine) void reconnect(); });
window.addEventListener('offline', () => { S.offline = true; $('connectionLabel').textContent = '离线'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { savePosition(); void syncPending(); } else if (S.offline && navigator.onLine) void reconnect(); });
window.addEventListener('pagehide', savePosition);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'AUTH_REQUIRED' && S.owner) lock(); });
}
void connect();
