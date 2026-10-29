const $ = id => document.getElementById(id);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clone = value => value && JSON.parse(JSON.stringify(value));
// Stored offsets retain their original physical coordinate. New explicit
// destinations use the visible source-style index bar plus its reveal gap.
const NAV_LINE = 24;
const REVEAL_GAP = 12;

// The book surface has no authority over identity, transport or publication.
// Its caller supplies the one authenticated, revision-checked chapter.
export function createReaderRuntime({ onPosition, onNavigate, onCopy, isSheetOpen = () => false, toast = () => {} }) {
  const app = $('app'), pane = $('readingPane'), article = $('article');
  const hiddenChrome = [$('appHeader'), $('chapterNav'), $('readerHead'), $('partHeading')].filter(Boolean);
  const chrome = [$('articleTools'), $('readerStatusbar')].filter(Boolean);
  let chapter = null, headings = [], sections = [], byId = new Map(), aliases = new Map();
  let rendered = [], blocks = [], cursor = null, view = 'chapter', restoring = false, pure = false;
  let layoutToken = 0, frame = 0, resizeTimer = 0, awakeTimer = 0, pointerHeld = false;
  let gestureSelection = false, gestureStarted = -Infinity;
  const revision = () => chapter?.meta.revision;
  const sectionFor = id => byId.get(byId.get(id)?.sectionId);

  function revealLine() {
    // Pure controls are a temporary overlay: waking them must not change the
    // reading boundary, paper layout, or the section currently being read.
    if (pure) return REVEAL_GAP;
    const tools = $('articleTools');
    return tools && !tools.hidden && getComputedStyle(tools).display !== 'none'
      ? tools.getBoundingClientRect().height + REVEAL_GAP : REVEAL_GAP;
  }

  function resolveAnchor(anchor) {
    return aliases.get(anchor) || (byId.has(anchor) ? anchor : null);
  }
  function anchorElement(anchor) {
    if (!anchor) return null;
    return article.querySelector('#' + CSS.escape(anchor || ''))
      || article.querySelector('[data-reading-anchor="' + CSS.escape(anchor || '') + '"]');
  }
  function headingAt(element) {
    if (!element) return null;
    let previous = headings[0];
    for (const item of headings) {
      const node = anchorElement(item.id);
      if (node === element || (node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) previous = item;
      else break;
    }
    return previous?.id;
  }
  function normalizePosition(position) {
    if (!position) return null;
    if (position.schema === 3 && resolveAnchor(position.anchor)) {
      return position.revision === revision() ? { ...clone(position), anchor: resolveAnchor(position.anchor) }
        : { schema: 3, anchor: resolveAnchor(position.anchor), offset: NAV_LINE, revision: revision() };
    }
    // Legacy numeric block anchors and offsets are meaningful only for the
    // exact document bytes. Never map a percentage into a revised chapter.
    if (position.revision !== revision()) return resolveAnchor(position.anchor)
      ? { schema: 3, anchor: resolveAnchor(position.anchor), offset: NAV_LINE, revision: revision() } : null;
    const target = anchorElement(position.anchor);
    if (!target) return null;
    const id = headingAt(target);
    if (!id) return null;
    const index = blocks.indexOf(target);
    return { schema: 3, anchor: id, revision: revision(), offset: NAV_LINE,
      ...(index >= 0 ? { block: { index, offset: -(Number(position.offset) || 0), ratio: 0 } }
        : { legacy: { anchor: position.anchor, offset: Number(position.offset) || 0 } }) };
  }
  function enhanceCodes(root) {
    for (const toolbar of all('.code-toolbar', root)) toolbar.remove();
    for (const pre of all('pre', root)) {
      if (!pre.closest('.code-block')) { const wrapper = document.createElement('div'); wrapper.className = 'code-block'; pre.before(wrapper); wrapper.append(pre); }
      const bar = document.createElement('div'); bar.className = 'code-toolbar';
      bar.innerHTML = '<span>C++</span><button type="button" data-copy>复制</button>'; pre.before(bar);
    }
  }
  function setChapter(value, position = null) {
    layoutToken++; restoring = false; view = 'chapter'; pure = false; clearTimeout(awakeTimer);
    app.classList.remove('pure', 'controls-awake'); app.style.removeProperty('--pure-paper-width'); chromeInert(false);
    chapter = value; headings = []; sections = []; byId = new Map(); aliases = new Map();
    article.style.removeProperty('padding-bottom'); article.innerHTML = value.content.html;
    // Preserve the previous reader's exact block numbering for safe migration.
    let legacyIndex = 0;
    for (const node of all('h2,h3,h4,p,pre,table,li', article)) {
      if (!node.id) node.dataset.readingAnchor = `part-${legacyIndex}`;
      legacyIndex++;
    }
    const permitted = new Set(value.meta.headings.filter(item => [2, 3, 4].includes(item.depth)).map(item => item.id));
    const stack = [];
    for (const node of all('h2[id],h3[id],h4[id]', article).filter(node => permitted.has(node.id))) {
      const depth = Number(node.tagName.slice(1));
      while (stack.length && stack.at(-1).depth >= depth) stack.pop();
      const title = node.textContent, localNumber = depth === 2 ? title.split('、')[0] : title.match(/^（[^）]+）/)?.[0] || '';
      const item = { id: node.id, title, text: title, depth, localNumber, index: headings.length, ancestors: stack.map(parent => parent.id) };
      item.sectionId = depth === 2 ? item.id : stack[0]?.id;
      item.number = depth === 2 ? localNumber : stack.map(parent => parent.localNumber).join('') + localNumber;
      if (depth === 2) { item.units = []; item.sectionIndex = sections.length; sections.push(item); }
      else if (sections.length) sections.at(-1).units.push(item);
      headings.push(item); byId.set(item.id, item); aliases.set(item.id, item.id); stack.push(item);
    }
    for (const alias of all('a[id]:not([href])', article)) {
      let next = alias.nextElementSibling;
      if (!next && alias.parentElement?.tagName === 'P') next = alias.parentElement.nextElementSibling;
      while (next?.tagName === 'A' && !next.getAttribute('href')) next = next.nextElementSibling;
      if (next && byId.has(next.id)) aliases.set(alias.id, next.id);
    }
    enhanceCodes(article);
    rendered = headings.map(item => anchorElement(item.id));
    blocks = all('h2,h3,h4,p,pre,table,blockquote,li', article).filter(node => !node.closest('.code-toolbar'));
    blocks.forEach((node, index) => { node.dataset.readBlock = String(index); });
    cursor = normalizePosition(position);
    setChapterIdentity(); updateStatus();
    return clone(cursor);
  }
  function setChapterIdentity() {
    if (!chapter) return;
    const { collection, meta } = chapter;
    $('readerChapterDate').textContent = collection.date || '日期未登记';
    $('readerChapterNumber').textContent = collection.kind === 'chapter' ? `第 ${collection.chapterNumber} 章` : '阅读材料';
    $('readerChapterTitle').textContent = collection.title;
    $('readerChapterSubtitle').textContent = meta.title && meta.title !== collection.title ? meta.title : '';
    $('readerPartNumber').textContent = collection.kind === 'chapter' ? 'CHAPTER ' + String(collection.chapterNumber).padStart(2, '0') : 'READING';
    $('readerPartTitle').textContent = '算法思想与题型';
    $('readerPartSummary').textContent = '按篇节阅读';
  }
  function indexHTML(filter = '') {
    const query = String(filter).trim().toLocaleLowerCase();
    const items = headings.filter(item => [item.title, ...item.ancestors.map(id => byId.get(id)?.title || '')].join(' ').toLocaleLowerCase().includes(query));
    return items.length ? items.map(item => {
      const context = item.ancestors.map(id => byId.get(id)?.title).filter(Boolean).join(' · ');
      return `<button type="button" class="index-item${cursor?.anchor === item.id ? ' is-current' : ''}" data-index-go="${esc(item.id)}"${cursor?.anchor === item.id ? ' aria-current="location"' : ''} aria-label="${esc(context ? context + ' · ' + item.title : item.title)}"><span>${String(item.index + 1).padStart(2, '0')}</span><strong>${esc(item.title)}</strong>${context ? `<small>${esc(context)}</small>` : ''}</button>`;
    }).join('') : '<p class="chapter-list-empty">没有匹配的篇节。</p>';
  }
  function updateIndex() {
    const root = $('indexList'); if (!root) return;
    for (const button of all('[data-index-go]', root)) {
      const active = button.dataset.indexGo === cursor?.anchor;
      button.classList.toggle('is-current', active);
      if (active) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
    }
  }
  function updateTailSpace() {
    if (view !== 'reader' || !rendered.length || !pane.clientHeight) return;
    article.style.removeProperty('padding-bottom');
    const base = parseFloat(getComputedStyle(article).paddingBottom) || 0;
    const contentAfter = article.getBoundingClientRect().bottom - base - rendered.at(-1).getBoundingClientRect().top;
    article.style.paddingBottom = Math.max(base, pane.clientHeight - revealLine() - contentAfter) + 'px';
  }
  function readCursor() {
    if (view !== 'reader' || !rendered.length || !pane.clientHeight) return cursor;
    const top = pane.getBoundingClientRect().top, line = revealLine(); let heading = rendered[0], block = blocks[0];
    for (const node of rendered) { if (node.getBoundingClientRect().top <= top + line + 1) heading = node; else break; }
    for (const node of blocks) { if (node.getBoundingClientRect().top <= top + line + 1) block = node; else break; }
    const bounds = block.getBoundingClientRect();
    return { schema: 3, anchor: heading.id, offset: heading.getBoundingClientRect().top - top, revision: revision(), capturedAt: Date.now(),
      block: { index: Number(block.dataset.readBlock), ratio: bounds.top <= top && bounds.bottom > top ? (top - bounds.top) / Math.max(1, bounds.height) : 0,
        offset: bounds.top - top, ...(top > bounds.bottom ? { afterGap: top - bounds.bottom } : {}) } };
  }
  function capture(save = false) {
    if (restoring || isSheetOpen() || view !== 'reader') return clone(cursor);
    cursor = readCursor(); updateStatus(); updateIndex(); if (save && cursor) onPosition?.(clone(cursor)); return clone(cursor);
  }
  function restoreSnapshot(position) {
    if (!position || view !== 'reader') return;
    const heading = anchorElement(position.anchor); if (!heading) return;
    const top = pane.getBoundingClientRect().top;
    const block = position.revision === revision() && position.block && blocks[position.block.index];
    if (block) {
      const bounds = block.getBoundingClientRect(), coord = position.block.afterGap !== undefined ? bounds.bottom + position.block.afterGap
        : position.block.ratio ? bounds.top + position.block.ratio * bounds.height : bounds.top - position.block.offset;
      pane.scrollTop += coord - top;
    } else if (position.legacy && anchorElement(position.legacy.anchor)) {
      pane.scrollTop += anchorElement(position.legacy.anchor).getBoundingClientRect().top - top + position.legacy.offset;
    } else pane.scrollTop += heading.getBoundingClientRect().top - top - (position.offset ?? NAV_LINE);
  }
  function settle(position, mutation, after, previousPaneTop = null) {
    const token = ++layoutToken; restoring = true; mutation?.();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== layoutToken) return;
      updateTailSpace(); restoreSnapshot(position);
      if (previousPaneTop !== null && view === 'reader') pane.scrollTop += pane.getBoundingClientRect().top - previousPaneTop;
      restoring = false;
      if (view === 'reader' && !isSheetOpen()) { cursor = readCursor(); updateStatus(); updateIndex(); if (cursor) onPosition?.(clone(cursor)); }
      after?.();
    }));
  }
  function navigationTargets() {
    const item = byId.get(cursor?.anchor) || headings[0]; if (!item) return {};
    const section = sectionFor(item.id);
    return { previousSection: sections[section?.sectionIndex - 1] || null,
      nextSection: sections[section?.sectionIndex + 1] || null, current: item, currentSection: section };
  }
  function updateStatus() {
    const targets = navigationTargets();
    for (const [key, target, label] of [['previous-major', targets.previousSection, '上一节'], ['next-major', targets.nextSection, '下一节']]) {
      const button = document.querySelector(`[data-nav="${key}"]`); if (!button) continue;
      button.disabled = view !== 'reader' || !target; button.dataset.target = target?.id || '';
      const description = target ? `${label}：${target.title}` : `${label}：已是本章${key.startsWith('previous') ? '首' : '末'}节`;
      button.setAttribute('aria-label', description); button.title = description;
    }
    const section = targets.currentSection;
    const label = chapter && section && (view === 'reader' || cursor) ? `${section.sectionIndex + 1} / ${sections.length} · ${section.title}` : chapter ? `${sections.length} 节` : '';
    $('readingPosition').textContent = label; $('readingPosition').title = label;
    $('sectionIndexButton').disabled = !chapter;
  }
  function showReader(position, anchor = null, fromStart = false) {
    view = 'reader'; $('chapterView').hidden = true; $('readerView').hidden = false;
    const saved = normalizePosition(position), atStart = fromStart || !anchor && !saved;
    cursor = atStart ? { schema: 3, anchor: headings[0]?.id, offset: NAV_LINE, revision: revision() }
      : anchor ? { schema: 3, anchor: resolveAnchor(anchor) || headings[0]?.id, offset: revealLine(), revision: revision() }
      : saved || { schema: 3, anchor: headings[0]?.id, offset: NAV_LINE, revision: revision() };
    updateStatus(); settle(atStart ? null : cursor, () => {
      if (atStart) pane.scrollTop = 0;
      pane.focus({ preventScroll: true });
      // A pure-mode index jump reveals its destination on clean paper. The
      // temporary tools can still be awakened by the next deliberate tap.
      if (anchor && pure) { clearTimeout(awakeTimer); app.classList.remove('controls-awake'); chromeInert(true); }
    });
  }
  function showChapter() { showReader(null, null, true); }
  function go(anchor) {
    const id = resolveAnchor(anchor); if (!id) { toast('这个阅读位置暂不可用，当前内容已保留。'); return; }
    capture(true); onNavigate?.(id);
  }
  function scrollCurrentIndex(root) {
    updateIndex(); const active = root.querySelector('[aria-current="location"]'); if (!active) return;
    const bounds = root.getBoundingClientRect(), location = active.getBoundingClientRect();
    if (location.top < bounds.top || location.bottom > bounds.bottom) root.scrollTop += location.top - bounds.top - root.clientHeight / 3;
  }
  function chromeInert(hidden) {
    for (const node of hiddenChrome) { node.inert = pure; if (pure) node.setAttribute('aria-hidden', 'true'); else node.removeAttribute('aria-hidden'); }
    for (const node of chrome) { node.inert = hidden; if (hidden) node.setAttribute('aria-hidden', 'true'); else node.removeAttribute('aria-hidden'); }
  }
  function sleepControls() {
    clearTimeout(awakeTimer); if (!pure) return;
    awakeTimer = setTimeout(() => {
      if (isSheetOpen() || pointerHeld || chrome.some(node => node.contains(document.activeElement))) { sleepControls(); return; }
      app.classList.remove('controls-awake'); chromeInert(true);
    }, 3000);
  }
  function wakeControls() { if (!pure) return; chromeInert(false); app.classList.add('controls-awake'); sleepControls(); }
  function setPure(on) {
    if (on && view !== 'reader') return;
    const position = capture() || cursor, previous = pane.getBoundingClientRect().top;
    if (on) app.style.setProperty('--pure-paper-width', $('reader').getBoundingClientRect().width + 'px'); pure = on;
    settle(position, () => { app.classList.toggle('pure', on); clearTimeout(awakeTimer); app.classList.remove('controls-awake'); chromeInert(on); if (!on) app.style.removeProperty('--pure-paper-width'); }, () => { if (view === 'reader') pane.focus({ preventScroll: true }); }, previous);
  }
  function clear() {
    layoutToken++; restoring = false; clearTimeout(awakeTimer); pure = false; view = 'chapter'; chapter = null; cursor = null;
    app.classList.remove('pure', 'controls-awake'); app.style.removeProperty('--pure-paper-width'); chromeInert(false);
    article.replaceChildren(); $('chapterView').replaceChildren(); $('readingPosition').textContent = '';
    for (const id of ['readerChapterDate', 'readerChapterNumber', 'readerChapterTitle', 'readerChapterSubtitle']) $(id).textContent = '';
    headings = []; sections = []; rendered = []; blocks = []; byId.clear(); aliases.clear();
  }
  document.addEventListener('click', event => {
    if (!chapter) return;
    const button = event.target.closest('button');
    if (button?.hasAttribute('data-copy')) { void onCopy?.(button.closest('.code-block').querySelector('pre').textContent, button); return; }
    if (button?.dataset.nav) { if (button.dataset.target) go(button.dataset.target); return; }
    if (button?.dataset.go) { go(button.dataset.go); return; }
    if (button?.hasAttribute('data-reader-resume')) { onNavigate?.(null, clone(cursor)); return; }
  });
  pane.addEventListener('scroll', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => capture(true)); }, { passive: true });
  const excluded = 'button,a,input,textarea,select,label,summary,pre,code,table';
  pane.addEventListener('pointerdown', event => {
    if (event.timeStamp - gestureStarted > 500 || event.detail === 1) gestureSelection = Boolean(getSelection()?.toString().trim());
    gestureStarted = event.timeStamp;
  });
  pane.addEventListener('dblclick', event => {
    if (event.target.closest(excluded)) return;
    const blank = event.target === article || event.target === pane;
    // Chromium can select a neighboring word even when both real pointer hits
    // landed on article padding. That generated selection is not text intent.
    // Existing selections and doubleclicks whose actual target is prose keep
    // the system's native selection behavior.
    if (blank ? gestureSelection : Boolean(getSelection()?.toString().trim())) return;
    event.preventDefault(); if (blank) getSelection()?.removeAllRanges(); setPure(!pure);
  });
  app.addEventListener('pointerdown', event => { pointerHeld = true; if (pure && chrome.some(node => node.contains(event.target))) wakeControls(); });
  window.addEventListener('pointerup', event => { pointerHeld = false; if (pure && !event.target.closest(excluded) && !getSelection()?.toString().trim()) wakeControls(); else sleepControls(); });
  window.addEventListener('pointercancel', () => { pointerHeld = false; sleepControls(); });
  app.addEventListener('focusin', wakeControls);
  document.addEventListener('keydown', () => { if (pure) wakeControls(); });
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); const position = capture() || cursor; resizeTimer = setTimeout(() => { if (chapter) settle(position); }, 100); });
  return Object.freeze({ setChapter, clear, capture, settle, showReader, showChapter, go, indexHTML, scrollCurrentIndex,
    enhanceCodes, resolveAnchor, normalizePosition, updateIndex, wakeControls, setPure,
    get position() { return clone(cursor); }, get state() { return { view, pure, restoring, cursor: clone(cursor) }; },
    get headings() { return clone(headings); }, get sections() { return clone(sections); }, get navigation() { return clone(navigationTargets()); } });
}
