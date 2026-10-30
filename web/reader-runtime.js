const $ = id => document.getElementById(id);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clone = value => value && JSON.parse(JSON.stringify(value));
// Stored offsets retain their original physical coordinate. New explicit
// destinations use the visible source-style index bar plus its reveal gap.
const NAV_LINE = 24;
const REVEAL_GAP = 12;
const DOUBLE_TAP_MS = 350;
const TAP_MOVE = 12;
const TAP_DISTANCE = 28;

// The book surface has no authority over identity, transport or publication.
// Its caller supplies the one authenticated, revision-checked chapter.
export function createReaderRuntime({ onPosition, onNavigate, onCopy, onRestoreSection, isSheetOpen = () => false, toast = () => {} }) {
  const app = $('app'), pane = $('readingPane'), article = $('article');
  const hiddenChrome = [$('appHeader'), $('chapterNav'), $('readerHead'), $('partHeading')].filter(Boolean);
  const chrome = [$('articleTools'), $('readerStatusbar')].filter(Boolean);
  let chapter = null, headings = [], sections = [], byId = new Map(), aliases = new Map();
  let rendered = [], blocks = [], cursor = null, view = 'chapter', restoring = false, pure = false;
  let layoutToken = 0, frame = 0, resizeTimer = 0, awakeTimer = 0, pointerHeld = false;
  let gestureSelection = false, gestureStarted = -Infinity;
  let touchPress = null, previousTap = null, wakeTapTimer = 0, lastTouchUp = null, consumedTouchClick = null;
  const revision = () => chapter?.meta.revision;
  const sectionFor = id => byId.get(byId.get(id)?.sectionId);
  const indexExpanded = new Map();
  let layer = 'main', extensions = new Map(), restoredSections = new Set(), sectionNodes = new Map(), layerPositions = {};
  const layerOf = id => {
    const section = sectionFor(resolveAnchor(id));
    const definition = extensions.get(section?.id);
    return definition && !restoredSections.has(definition.sectionId) ? 'extension' : 'main';
  };
  const visibleSections = () => sections.filter(item => layerOf(item.id) === layer);
  const visibleHeadings = () => headings.filter(item => layerOf(item.id) === layer);
  const visibleBlocks = () => blocks.filter(node => !node.closest('[hidden]'));

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
    if (position.schema === 3 && !position.anchor && position.layer === 'extension') return { schema: 3, anchor: null, layer: 'extension', revision: revision() };
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
  function setChapter(value, position = null, restored = []) {
    resetTapGesture();
    layoutToken++; restoring = false; view = 'chapter'; pure = false; clearTimeout(awakeTimer);
    app.classList.remove('pure', 'controls-awake'); app.style.removeProperty('--pure-paper-width'); chromeInert(false);
    chapter = value; headings = []; sections = []; byId = new Map(); aliases = new Map(); indexExpanded.clear();
    layer = 'main'; extensions = new Map(); sectionNodes = new Map(); layerPositions = {}; restoredSections = new Set(restored);
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
    // One DOM, one global block numbering. Layer membership never clones,
    // reparses or renumbers the publication or its persisted coordinates.
    let currentSection = null;
    for (const node of [...article.children]) {
      if (node.matches('h2[id]') && byId.has(node.id)) currentSection = node.id;
      if (currentSection) { if (!sectionNodes.has(currentSection)) sectionNodes.set(currentSection, []); sectionNodes.get(currentSection).push(node); }
    }
    for (const definition of value.content.extensions || value.meta.extensions || []) {
      const id = resolveAnchor(definition.sectionId);
      if (!id || byId.get(id)?.depth !== 2) throw Error('章节分层与正文不一致。');
      extensions.set(id, definition);
      const panel = document.createElement('div'); panel.className = 'extension-meta';
      panel.innerHTML = `<div class="extension-tags">${definition.tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div><button class="bevel-button" type="button" data-restore-section="${esc(definition.sectionId)}">撤回超纲</button>`;
      anchorElement(id).after(panel); sectionNodes.get(id).splice(1, 0, panel);
    }
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
  }
  function setRestoredSections(values) { restoredSections = new Set(values); }
  function applyLayer(next) {
    const hasExtensions = [...extensions.values()].some(item => !restoredSections.has(item.sectionId));
    $('partHeading').hidden = !hasExtensions;
    layer = hasExtensions && next === 'extension' ? 'extension' : 'main';
    for (const section of sections) {
      const belongs = layerOf(section.id), nodes = sectionNodes.get(section.id) || [];
      for (const node of nodes) node.hidden = belongs !== layer || node.classList.contains('extension-meta') && belongs !== 'extension';
      if (belongs !== 'extension') for (const node of nodes) if (node.classList.contains('extension-meta')) node.remove();
      anchorElement(section.id).classList.remove('layer-first');
    }
    const first = visibleSections()[0]; if (first) anchorElement(first.id).classList.add('layer-first');
    rendered = visibleHeadings().map(item => anchorElement(item.id));
    article.setAttribute('role', hasExtensions ? 'tabpanel' : 'article');
    if (hasExtensions) article.setAttribute('aria-labelledby', layer === 'extension' ? 'extensionReadingTab' : 'mainReadingTab');
    else article.removeAttribute('aria-labelledby');
    for (const tab of all('[data-reading-layer]')) {
      const selected = tab.dataset.readingLayer === layer;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
    article.dataset.layer = layer;
  }
  function switchLayer(next) {
    if (!chapter || next === layer || restoring) return;
    if (![...extensions.values()].some(item => !restoredSections.has(item.sectionId))) return;
    const position = capture(true); if (position) layerPositions[layer] = position;
    const saved = layerPositions[next], first = sections.find(item => layerOf(item.id) === next);
    const target = saved?.anchor && layerOf(saved.anchor) === next ? saved : first ? { schema: 3, anchor: first.id, offset: revealLine(), revision: revision() } : { schema: 3, anchor: null, layer: next, revision: revision() };
    // A tab is a resume action, not an explicit heading jump. Passing an
    // anchor would intentionally discard the saved paragraph/code offset.
    onNavigate?.(null, target, next);
  }
  async function restoreSection(stableId, button) {
    if (!onRestoreSection || restoring || button.disabled) return;
    const identity = chapter;
    const pair = [...extensions].find(([,definition]) => definition.sectionId === stableId);
    if (!pair || restoredSections.has(stableId)) return;
    button.disabled = true;
    try {
      const stored = await onRestoreSection(stableId);
      if (chapter !== identity) return;
      if (!stored) return;
      restoredSections.add(stableId);
      // Follow the chosen section to its original place, without cascading.
      onNavigate?.(pair[0], null, 'main');
    } catch { toast('本机保存失败，该节仍保留在超纲。'); }
    finally { if (button.isConnected) button.disabled = false; }
  }
  function indexHTML(filter = '') {
    const query = String(filter).trim().toLocaleLowerCase(), current = cursor?.anchor, parent = sectionFor(current)?.id;
    const matches = item => !query || [item.title, ...item.ancestors.map(id => byId.get(id)?.title || '')].join(' ').toLocaleLowerCase().includes(query);
    const groups = sections.filter(section => matches(section) || section.units.some(matches));
    return groups.length ? groups.map(section => {
      const active = parent === section.id, open = query ? true : indexExpanded.has(section.id) ? indexExpanded.get(section.id) : active;
      const childrenId = `directory-section-${section.index}`;
      return `<section class="directory-group${active ? ' is-current-parent' : ''}${layerOf(section.id) === 'extension' ? ' is-extension' : ''}" data-directory-section="${esc(section.id)}"><div class="directory-parent"><button type="button" class="directory-toggle" data-toggle-index-section="${esc(section.id)}" aria-expanded="${open}" aria-controls="${childrenId}" aria-label="${open ? '收起' : '展开'}${esc(section.title)}">${open ? '−' : '＋'}</button><button type="button" class="directory-section-link${current === section.id ? ' is-current' : ''}" data-index-go="${esc(section.id)}"${current === section.id ? ' aria-current="location"' : ''}>${esc(section.title)}</button></div><div class="directory-children" id="${childrenId}"${open ? '' : ' hidden'}>${section.units.filter(matches).map(item => {
        const context = item.ancestors.map(id => byId.get(id)?.title).filter(Boolean).join(' · ');
        return `<button type="button" class="directory-item depth-${item.depth}${current === item.id ? ' is-current' : ''}" data-index-go="${esc(item.id)}"${current === item.id ? ' aria-current="location"' : ''} aria-label="${esc(context ? context + ' · ' + item.title : item.title)}">${esc(item.title)}</button>`;
      }).join('')}</div></section>`;
    }).join('') : '<p class="chapter-list-empty">没有匹配的目录项。</p>';
  }
  function setIndexSectionOpen(group, open) {
    const button = group.querySelector('[data-toggle-index-section]'), children = group.querySelector('.directory-children');
    if (!button || !children) return;
    children.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.textContent = open ? '−' : '＋';
    button.setAttribute('aria-label', (open ? '收起' : '展开') + (byId.get(group.dataset.directorySection)?.title || '目录'));
  }
  function updateIndex() {
    const root = $('indexList'); if (!root || !$('sheetDialog').open) return;
    const parent = sectionFor(cursor?.anchor)?.id;
    for (const button of all('[data-index-go]', root)) {
      const active = button.dataset.indexGo === cursor?.anchor;
      button.classList.toggle('is-current', active);
      if (active) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
    }
    const changed = root.dataset.currentParent !== parent;
    for (const group of all('[data-directory-section]', root)) {
      const active = group.dataset.directorySection === parent; group.classList.toggle('is-current-parent', active);
      group.classList.toggle('is-extension', layerOf(group.dataset.directorySection) === 'extension');
      if (active && changed) { indexExpanded.set(parent, true); setIndexSectionOpen(group, true); }
    }
    root.dataset.currentParent = parent || '';
  }
  function toggleIndexSection(id, root = $('indexList')) {
    const group = root && all('[data-directory-section]', root).find(item => item.dataset.directorySection === id);
    if (!group) return;
    const open = group.querySelector('[data-toggle-index-section]').getAttribute('aria-expanded') !== 'true';
    indexExpanded.set(id, open); setIndexSectionOpen(group, open);
  }
  function updateTailSpace() {
    article.style.removeProperty('padding-bottom');
    if (view !== 'reader' || !rendered.length || !pane.clientHeight) return;
    const base = parseFloat(getComputedStyle(article).paddingBottom) || 0;
    const contentAfter = article.getBoundingClientRect().bottom - base - rendered.at(-1).getBoundingClientRect().top;
    article.style.paddingBottom = Math.max(base, pane.clientHeight - revealLine() - contentAfter) + 'px';
  }
  function readCursor() {
    if (view !== 'reader' || !pane.clientHeight) return cursor;
    if (!rendered.length) return { schema: 3, anchor: null, layer, revision: revision(), capturedAt: Date.now() };
    const activeBlocks = visibleBlocks();
    const top = pane.getBoundingClientRect().top, line = revealLine(); let heading = rendered[0], block = activeBlocks[0];
    for (const node of rendered) { if (node.getBoundingClientRect().top <= top + line + 1) heading = node; else break; }
    for (const node of activeBlocks) { if (node.getBoundingClientRect().top <= top + line + 1) block = node; else break; }
    const bounds = block.getBoundingClientRect();
    return { schema: 3, anchor: heading.id, layer, offset: heading.getBoundingClientRect().top - top, revision: revision(), capturedAt: Date.now(),
      block: { index: Number(block.dataset.readBlock), ratio: bounds.top <= top && bounds.bottom > top ? (top - bounds.top) / Math.max(1, bounds.height) : 0,
        offset: bounds.top - top, ...(top > bounds.bottom ? { afterGap: top - bounds.bottom } : {}) } };
  }
  function capture(save = false) {
    if (restoring || isSheetOpen() || view !== 'reader') return clone(cursor);
    cursor = readCursor(); updateStatus(); updateIndex(); if (save && cursor) onPosition?.(clone(cursor)); return clone(cursor);
  }
  function restoreSnapshot(position) {
    if (!position || view !== 'reader') return;
    const heading = anchorElement(position.anchor); if (!heading || heading.hidden) return;
    const top = pane.getBoundingClientRect().top;
    const candidate = position.revision === revision() && position.block && blocks[position.block.index];
    const block = candidate && !candidate.closest('[hidden]') ? candidate : null;
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
    const section = sectionFor(item.id), active = visibleSections(), index = active.indexOf(section);
    return { previousSection: index >= 0 ? active[index - 1] || null : null,
      nextSection: index >= 0 ? active[index + 1] || null : null, current: item, currentSection: section };
  }
  function updateStatus() {
    const targets = navigationTargets();
    for (const [key, target, label] of [['previous-major', targets.previousSection, '上一节'], ['next-major', targets.nextSection, '下一节']]) {
      const button = document.querySelector(`[data-nav="${key}"]`); if (!button) continue;
      button.disabled = view !== 'reader' || !target; button.dataset.target = target?.id || '';
      const description = target ? `${label}：${target.title}` : `${label}：已是本章${key.startsWith('previous') ? '首' : '末'}节`;
      button.setAttribute('aria-label', description); button.title = description;
    }
    const section = rendered.length ? targets.currentSection : null;
    const label = chapter && section && (view === 'reader' || cursor) ? `${section.sectionIndex + 1} / ${sections.length} · ${section.title}` : chapter ? layer === 'extension' ? '超纲' : `${sections.length} 节` : '';
    $('readingPosition').textContent = label; $('readingPosition').title = label;
    $('sectionIndexButton').disabled = !chapter;
  }
  function showReader(position, anchor = null, fromStart = false, requestedLayer = null) {
    resetTapGesture();
    if (view === 'reader' && !restoring) {
      const previous = capture(); if (previous) layerPositions[layer] = previous;
    }
    view = 'reader'; $('chapterView').hidden = true; $('readerView').hidden = false;
    let saved = normalizePosition(position);
    const destination = anchor ? resolveAnchor(anchor) : saved?.anchor;
    const nextLayer = fromStart ? 'main' : anchor && destination ? layerOf(destination) : requestedLayer || (destination ? layerOf(destination) : saved?.layer) || 'main';
    if (!anchor && requestedLayer && saved?.anchor && layerOf(saved.anchor) !== requestedLayer) saved = null;
    applyLayer(nextLayer);
    if (layer === 'main' && saved && !saved.anchor) saved = null;
    const first = visibleHeadings()[0]?.id, atStart = fromStart || !anchor && !saved;
    cursor = atStart ? { schema: 3, anchor: first || null, layer, offset: NAV_LINE, revision: revision() }
      : anchor ? { schema: 3, anchor: resolveAnchor(anchor) || headings[0]?.id, offset: revealLine(), revision: revision() }
      : saved || { schema: 3, anchor: first || null, layer, offset: NAV_LINE, revision: revision() };
    updateStatus(); settle(atStart ? null : cursor, () => {
      if (atStart || !rendered.length) pane.scrollTop = 0;
      if ($('partHeading').hidden || !document.activeElement?.matches('[data-reading-layer]')) pane.focus({ preventScroll: true });
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
    const group = active.closest('[data-directory-section]');
    if (group) { indexExpanded.set(group.dataset.directorySection, true); setIndexSectionOpen(group, true); }
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
  function resetTapGesture() {
    clearTimeout(wakeTapTimer); wakeTapTimer = 0; touchPress = null; previousTap = null;
  }
  function deferControls() {
    clearTimeout(wakeTapTimer);
    // Do not put a toolbar under the finger before its compatibility click or
    // second tap. That could open the directory instead of leaving pure mode.
    wakeTapTimer = setTimeout(() => { wakeTapTimer = 0; if (view === 'reader' && pure && !isSheetOpen()) wakeControls(); }, DOUBLE_TAP_MS + 30);
  }
  function setPure(on) {
    if (on && view !== 'reader') return;
    resetTapGesture();
    const position = capture() || cursor, previous = pane.getBoundingClientRect().top;
    if (on) app.style.setProperty('--pure-paper-width', $('reader').getBoundingClientRect().width + 'px'); pure = on;
    settle(position, () => { app.classList.toggle('pure', on); clearTimeout(awakeTimer); app.classList.remove('controls-awake'); chromeInert(on); if (!on) app.style.removeProperty('--pure-paper-width'); }, () => { if (view === 'reader') pane.focus({ preventScroll: true }); }, previous);
  }
  function clear() {
    resetTapGesture(); lastTouchUp = null; consumedTouchClick = null;
    layoutToken++; restoring = false; clearTimeout(awakeTimer); pure = false; view = 'chapter'; chapter = null; cursor = null;
    app.classList.remove('pure', 'controls-awake'); app.style.removeProperty('--pure-paper-width'); chromeInert(false);
    article.replaceChildren(); $('chapterView').replaceChildren(); $('readingPosition').textContent = '';
    for (const id of ['readerChapterDate', 'readerChapterNumber', 'readerChapterTitle', 'readerChapterSubtitle']) $(id).textContent = '';
    headings = []; sections = []; rendered = []; blocks = []; byId.clear(); aliases.clear(); indexExpanded.clear();
    extensions.clear(); restoredSections.clear(); sectionNodes.clear(); layerPositions = {}; layer = 'main';
  }
  document.addEventListener('click', event => {
    if (!chapter) return;
    const button = event.target.closest('button');
    if (button?.dataset.readingLayer) { switchLayer(button.dataset.readingLayer); return; }
    if (button?.dataset.restoreSection) { void restoreSection(button.dataset.restoreSection, button); return; }
    if (button?.dataset.toggleIndexSection) { toggleIndexSection(button.dataset.toggleIndexSection); return; }
    if (button?.hasAttribute('data-copy')) { void onCopy?.(button.closest('.code-block').querySelector('pre').textContent, button); return; }
    if (button?.dataset.nav) { if (button.dataset.target) go(button.dataset.target); return; }
    if (button?.dataset.go) { go(button.dataset.go); return; }
    if (button?.hasAttribute('data-reader-resume')) { onNavigate?.(null, clone(cursor)); return; }
  });
  pane.addEventListener('scroll', () => { if (!restoring) resetTapGesture(); cancelAnimationFrame(frame); frame = requestAnimationFrame(() => capture(true)); }, { passive: true });
  $('partHeading').addEventListener('keydown', event => {
    if (!event.target.matches('[data-reading-layer]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'main' : event.key === 'End' ? 'extension' : layer === 'main' ? 'extension' : 'main';
    switchLayer(next); $(next === 'main' ? 'mainReadingTab' : 'extensionReadingTab').focus({ preventScroll: true });
  });
  const excluded = 'button,a,input,textarea,select,label,summary,pre,code,table';
  const hasSelection = () => Boolean(getSelection()?.toString().trim());
  const blankTarget = target => target === article || target === pane;
  const readingTarget = target => pane.contains(target) && !target.closest(excluded) && !target.isContentEditable;
  const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  pane.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') lastTouchUp = null;
    if (event.timeStamp - gestureStarted > 500 || event.detail === 1) gestureSelection = Boolean(getSelection()?.toString().trim());
    gestureStarted = event.timeStamp;
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    clearTimeout(wakeTapTimer);
    touchPress = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, started: event.timeStamp,
      scrollTop: pane.scrollTop, scale: window.visualViewport?.scale, layoutToken, layer, pure,
      blank: blankTarget(event.target),
      eligible: view === 'reader' && !restoring && !isSheetOpen() && readingTarget(event.target) && !hasSelection() };
  });
  pane.addEventListener('pointermove', event => {
    if (touchPress?.pointerId === event.pointerId && distance(touchPress, event) > TAP_MOVE) resetTapGesture();
  }, { passive: true });
  pane.addEventListener('contextmenu', resetTapGesture);
  pane.addEventListener('dblclick', event => {
    // Some touch engines also synthesize dblclick. The physical touch sequence
    // has already been handled (or reserved for native selection), exactly once.
    if (lastTouchUp && event.timeStamp - lastTouchUp.timeStamp < 800 && distance(lastTouchUp, event) <= TAP_DISTANCE) return;
    if (event.target.closest(excluded)) return;
    const blank = event.target === article || event.target === pane;
    // Chromium can select a neighboring word even when both real pointer hits
    // landed on article padding. That generated selection is not text intent.
    // Existing selections and doubleclicks whose actual target is prose keep
    // the system's native selection behavior.
    if (blank ? gestureSelection : Boolean(getSelection()?.toString().trim())) return;
    event.preventDefault(); if (blank) getSelection()?.removeAllRanges(); setPure(!pure);
  });
  window.addEventListener('pointerdown', event => {
    consumedTouchClick = null;
    if (event.pointerType === 'mouse') { resetTapGesture(); lastTouchUp = null; }
    else if (event.pointerType === 'touch' && !event.isPrimary) resetTapGesture();
  }, { passive: true });
  window.addEventListener('click', event => {
    if (!event.detail || !consumedTouchClick || event.timeStamp - consumedTouchClick.timeStamp >= 800 || distance(consumedTouchClick, event) > TAP_DISTANCE) return;
    // Exiting pure mode can expose normal header buttons before the second
    // tap's compatibility click. Consume only that already-handled tap.
    consumedTouchClick = null; event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  app.addEventListener('pointerdown', event => { pointerHeld = true; if (pure && chrome.some(node => node.contains(event.target))) wakeControls(); });
  window.addEventListener('pointerup', event => {
    pointerHeld = false;
    if (event.pointerType === 'touch') {
      lastTouchUp = { timeStamp: event.timeStamp, clientX: event.clientX, clientY: event.clientY };
      const press = touchPress; touchPress = null;
      const valid = press?.pointerId === event.pointerId && press.eligible && event.timeStamp - press.started <= DOUBLE_TAP_MS
        && distance(press, event) <= TAP_MOVE && Math.abs(press.scrollTop - pane.scrollTop) < 3
        && press.layoutToken === layoutToken && press.layer === layer && press.pure === pure
        && press.scale === window.visualViewport?.scale && !isSheetOpen() && !hasSelection()
        && readingTarget(document.elementFromPoint(event.clientX, event.clientY));
      if (!valid) { resetTapGesture(); sleepControls(); return; }
      if (!press.blank || !blankTarget(document.elementFromPoint(event.clientX, event.clientY))) {
        previousTap = null; if (pure) deferControls(); return;
      }
      if (previousTap && event.timeStamp - previousTap.timeStamp <= DOUBLE_TAP_MS && distance(previousTap, event) <= TAP_DISTANCE) {
        consumedTouchClick = lastTouchUp;
        setPure(!pure); return;
      }
      previousTap = { timeStamp: event.timeStamp, clientX: event.clientX, clientY: event.clientY };
      if (pure) deferControls();
      return;
    }
    if (pure && pane.contains(event.target) && !event.target.closest(excluded) && !hasSelection()) deferControls();
    else sleepControls();
  });
  window.addEventListener('pointercancel', () => { pointerHeld = false; resetTapGesture(); sleepControls(); });
  window.addEventListener('blur', resetTapGesture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetTapGesture(); });
  app.addEventListener('focusin', event => { if (chrome.some(node => node.contains(event.target))) wakeControls(); });
  document.addEventListener('keydown', () => { if (pure) wakeControls(); });
  window.addEventListener('resize', () => { resetTapGesture(); clearTimeout(resizeTimer); const position = capture() || cursor; resizeTimer = setTimeout(() => { if (chapter) settle(position); }, 100); });
  return Object.freeze({ setChapter, clear, capture, settle, showReader, showChapter, go, indexHTML, scrollCurrentIndex,
    enhanceCodes, resolveAnchor, normalizePosition, updateIndex, toggleIndexSection, wakeControls, setPure, setRestoredSections, switchLayer,
    get position() { return clone(cursor); }, get state() { return { view, pure, restoring, layer, cursor: clone(cursor) }; },
    get headings() { return clone(headings); }, get sections() { return clone(sections); }, get navigation() { return clone(navigationTargets()); } });
}
