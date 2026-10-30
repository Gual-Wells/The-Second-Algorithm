// Actual reader sources and built publication, with an isolated in-memory auth/API.
// SW is deliberately blocked here. check-carrier-upgrade.cjs tests an actual HTTP SW.
// No production requests, passkey enrollment, paid service or real private data.
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..'), origin = 'http://localhost:9876';
const owner = 'a'.repeat(43), otherOwner = 'b'.repeat(43);
const output = path.resolve(process.env.ALGORITHM_QA_OUTPUT || path.join(root, '.local/refinement-qa'));
const temporary = path.join(output, 'browser-temp'), qaLibrary = path.join(output, 'fixture');
const digest = text => createHash('sha256').update(text).digest('hex');
const probe = '\nglobalThis.__refinement = { get state() { return S; }, get observedLocation() { return observedLocation; }, get reconnecting() { return reconnecting; }, get runtime() { return typeof runtime === "undefined" ? null : runtime; } };\n';
let qaCatalog, makeIndex;
const gestures = [],targetGeometry=[],viewportDiagnostics=[],settingsGeometry=[],headerLogoMotion=[];
const pendingPersistence=[];
const watchedFiles = ['web/app.js','web/reader-runtime.js','web/manual-questions.js','web/service-settings.js','web/chapter-dates.js','web/auth.js','web/worker-release.js','web/sw.js','web/index.html','web/styles.css','dist/index.html','dist/app.js','dist/library/catalog.json'];
async function fingerprint() { return Object.fromEntries(await Promise.all(watchedFiles.map(async file=>[file,digest(await fs.readFile(path.join(root,file)))]))); }
async function createCorpus() {
  const catalog = { schemaVersion: 2, state: 'active', version: 'qa-course-v3', collections: [], questions: [
    { id: 'Q000001', title: '有效范围', prerequisites: [] },
    { id: 'Q000002', title: '删除一个重复对象', prerequisites: ['Q000001'] }
  ] };
  async function write(url, body) { const file = path.join(qaLibrary, url.slice(1)); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, body); }
  for (const q of catalog.questions) {
    const html = q.id === 'Q000001' ? '<h2 id="lifetime">有效范围的寿命</h2><p>' + '范围的寿命和有效性。'.repeat(250) + '</p>'
      : '<p>删除一份需要保留其他重复对象。</p><p><a href="#knowledge-Q000001" data-knowledge="Q000001" data-knowledge-anchor="lifetime">范围寿命</a></p>';
    q.revision = digest(html); q.url = `/library/knowledge/${q.id}/${q.revision.slice(0, 16)}.json`;
    await write(q.url, JSON.stringify({ ...q, html, anchors: q.id === 'Q000001' ? ['lifetime'] : [] }));
  }
  for (const [collectionId, ids] of [['practice-course', ['practice-entry', 'practice-composition', 'practice-alternative']], ['additional-course', ['other-method']]]) {
    const collection = { id: collectionId, kind: 'chapter', chapterNumber: catalog.collections.length + 1,
      title: collectionId === 'practice-course' ? '实战方法与实现' : '不同算法的比较', documents: [] };
    for (const id of ids) {
      const headings = [], sections = [], canonical = 'int lower_manual(int value) { return value; }\n// ' + 'long_identifier '.repeat(20);
      function heading(depth, anchor, text) { headings.push({ depth, id: anchor, text }); sections.push(`<h${depth} id="${anchor}">${text}</h${depth}>`); }
      for (let i = 0; i < 16; ++i) {
        heading(2, `section-${i}`, `${i ? '第' + i + '节' : 'PRE'}、范围与边界判断`);
        sections.push(`<p>${'保持状态不变量，比较手写与标准设施的范围、返回值和复杂度。'.repeat(12)}</p>`);
        heading(3, `unit-${i}`, '（1）方法：有效范围与严格边界');
        sections.push('<p>' + '当前单元中段仍使用同一组严格邻居。'.repeat(22) + '</p>');
        heading(4, `code-${i}`, '（a）Hcode：手写比较与范围检查');
        sections.push(`<div class="code-block" data-code-id="example-${i}"><div class="code-toolbar"><span>C++</span><button type="button" class="code-copy" data-copy-code="example-${i}" aria-label="复制代码">复制</button></div><pre><code>${canonical}</code></pre></div>`);
        if (!i) sections.push('<p><a href="#knowledge-Q000002" data-knowledge="Q000002">删除一个重复对象</a></p><p><a href="#/read/practice-course/practice-entry?anchor=unit-6" data-qa-link="same">后面的边界判断</a></p><p><a href="#/read/practice-course/practice-composition?anchor=unit-2" data-qa-link="cross">另一份实现</a></p><p><a href="#/read/practice-course/practice-alternative" data-qa-link="cross-start">另一份从头阅读的实现</a></p>');
        sections.push('<p>' + '本单元的代码与解释都应完整保留。'.repeat(15) + '</p>');
      }
      sections.push('<div class="table-wrap"><table><tr><th>操作</th><th>条件</th></tr><tr><td><code>std::vector&lt;long_long_identifier&gt;::const_iterator</code></td><td>有效范围与结束位置</td></tr></table></div>');
      const html = sections.join('\n'), revision = digest(html), prefix = `/library/${collectionId}/${id}/${revision.slice(0, 16)}`;
      const meta = { id, title: id === 'practice-entry' ? '从范围到作答' : '实现与条件 ' + id,
        revision, url: prefix + '.json', sourceUrl: prefix + '.cpp', markdownUrl: prefix + '.md', headings, knowledgeIds: ['Q000001', 'Q000002'] };
      await write(meta.url, JSON.stringify({ ...meta, html })); await write(meta.sourceUrl, canonical); await write(meta.markdownUrl, '# UI fixture\n');
      collection.documents.push(meta);
    }
    catalog.collections.push(collection);
  }
  await write('/library/catalog.json', JSON.stringify(catalog)); return catalog;
}
async function poll(condition, message, timeout = 7000) { const start = Date.now(); while (!condition()) { if (Date.now() - start > timeout) throw Error(message); await new Promise(r => setTimeout(r, 25)); } }
async function environment(browser, { catalog = qaCatalog, policyCatalog = catalog, libraryRoot = qaLibrary, authenticated = true, initial = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3,
    serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(8000);
  await context.addInitScript(initial => { delete Navigator.prototype.serviceWorker; if (location.origin === 'http://localhost:9876' && !localStorage.getItem('__qaSeeded')) { for (const [k,v] of Object.entries(initial)) localStorage.setItem(k,v); localStorage.setItem('__qaSeeded','yes'); } }, initial);
  const mock = { catalog, state: {}, errors: [], requests: [], identity: authenticated ? owner : null, unavailable: new Set(), rejectApis: false,
    delayDocument: null, heldDocument: null, holdState: false, heldState: null, failStateRead: false };
  const compiled = await esbuild.build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false, format: 'esm', platform: 'browser',
    target: 'es2022', logLevel: 'silent', define: { __PUBLICATION_INDEX__: JSON.stringify(makeIndex(policyCatalog)) } });
  const app = compiled.outputFiles[0].text + probe;
  context.on('page', p => { p.on('pageerror', e => mock.errors.push(e.message)); p.on('dialog', d => d.type()==='beforeunload' ? d.accept() : d.dismiss()); });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()); if (url.origin !== origin) return route.abort('blockedbyclient');
    mock.requests.push({ path: url.pathname, method: req.method() });
    const json = (v,status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(v) });
    if (mock.rejectApis && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) return route.abort('internetdisconnected');
    if (url.pathname === '/auth/status') return json({ authenticated: Boolean(mock.identity), enrolled: true, enrollmentOpen: false, ownerScope: mock.identity });
    if (url.pathname === '/auth/logout') { mock.identity = null; return json({ok:true}); }
    if ((url.pathname.startsWith('/api/') || url.pathname.startsWith('/library/')) && !mock.identity) return json({error:'Unauthorized'},401);
    if (url.pathname === '/api/library') return json(mock.catalog);
    if(url.pathname==='/api/questions/status')return json({unread:0});
    if(url.pathname==='/api/questions/thread')return json({turns:mock.questionTurns||[]});
    if(url.pathname==='/api/questions'){if(mock.rejectQuestion)return json({error:'发送未确认，草稿已保留'},503);const input=req.postDataJSON();mock.questionTurns||=[];if(!mock.questionTurns.some(t=>t.id===input.id))mock.questionTurns.push({id:input.id,question:input.question,answer:'',status:'pending'});return json({ok:true,id:input.id,status:'pending'});}
    if (url.pathname === '/api/state') {
      if (req.method() === 'GET') { if(mock.failStateRead)return json({error:'Isolated state read temporarily unavailable'},503);if (mock.holdState) { mock.holdState = false; await new Promise(r => { mock.heldState = r; }); } return json({ state:mock.state }); }
      const input = req.postDataJSON(), previous = mock.state[input.key];
      const record = { value:input.value, revision:(previous?.revision||0)+1, updatedAt:Date.now() }; mock.state[input.key] = record; return json({...record,record});
    }
    // Explicit unknown snapshots. These isolated fixtures never contain a
    // provider key, personal balance, actual storage usage, or model call.
    if (url.pathname === '/api/settings') return json({ revision:1, goal:'', temporaryRequested:false, temporaryRequestText:'', restRequested:true, automation:{ configured:false, schedule:null, activeRun:null } });
    if (url.pathname === '/api/balances') return json({ verified:false, remainingAmount:null, issuedAmount:null, expiresAt:null, updatedAt:null });
    if (url.pathname === '/api/storage/usage') return json({ verified:false, pools:[] });
    if (url.pathname === '/api/push/status') return json({ configured:false, deviceCount:0 });
    if (mock.unavailable.has(url.pathname)) return route.abort('internetdisconnected');
    if (mock.delayDocument === url.pathname) { mock.delayDocument = null; await new Promise(r => {mock.heldDocument=r;}); }
    if (url.pathname === '/app.js') return route.fulfill({ contentType:'text/javascript',body:app });
    const file = path.join(url.pathname.startsWith('/library/') ? libraryRoot : path.join(root,'web'), url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    let bytes; try { bytes = await fs.readFile(file); } catch { return route.fulfill({status:404,body:'Mock asset not found'}); }
    return route.fulfill({contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain',body:bytes});
  });
  return { context,mock,async page(hash='#/read/practice-course/practice-entry') { const p=await context.newPage(); await p.goto(origin+'/'+hash); if (!authenticated) await p.locator('#loginView').waitFor({state:'visible'}); else if (catalog.state==='withdrawn') await p.locator('#chapterView').waitFor({state:'visible'}); else await p.locator('#article .code-block').first().waitFor(); await p.waitForFunction(()=>globalThis.__refinement); if(authenticated) await settled(p); return p; } };
}
async function settled(p,ms=140) { await p.waitForFunction(()=>!window.__refinement.runtime.state.restoring); await p.waitForTimeout(ms); }
async function closeSheet(p) { if(await p.locator('#sheetDialog').evaluate(e=>e.open)) { await p.locator('[data-sheet-close]').click(); await p.waitForFunction(()=>!document.querySelector('#sheetDialog').open); await settled(p); } }
async function navigateHeading(p,id) {
  await closeSheet(p); await p.locator('#sectionIndexButton').click();
  const target=p.locator(`#indexList [data-index-go="${id}"]`);
  if(!await target.isVisible()) {
    const parent=await target.evaluate(e=>e.closest('[data-directory-section]').dataset.directorySection);
    await p.locator(`#indexList [data-toggle-index-section="${parent}"]`).click();
  }
  await target.click(); await settled(p);
}
async function currentAnchor(p) { return p.evaluate(()=>__refinement.runtime.position?.anchor); }
async function assertTarget(p,id) {
  const v=await p.evaluate(id=>{
    const h=document.getElementById(id),pane=document.getElementById('readingPane'),tools=document.getElementById('articleTools');
    const b=h.getBoundingClientRect(),r=pane.getBoundingClientRect(),t=tools.getBoundingClientRect(),style=getComputedStyle(tools);
    const toolsVisible=!tools.inert&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;
    const firstHeading=__refinement.runtime.headings[0]?.id===id,articlePadding=parseFloat(getComputedStyle(document.getElementById('article')).paddingTop);
    // In the source's mobile paper the first H2 naturally follows the tools by
    // 7px. Revealing it at tools-height + 12px leaves the not-yet-stuck tools
    // 5px below the scrollport; demanding tools-bottom + 12px would invent a
    // different source spacing. Later headings see the genuinely stuck bar.
    const safeTop=firstHeading?r.top+(toolsVisible?t.height:0)+12:(toolsVisible?Math.max(r.top,t.bottom):r.top)+12;
    const clearance=b.top-t.bottom,expectedClearance=firstHeading?Math.min(12,articlePadding):12;
    const hit=document.elementFromPoint(Math.min(b.right-2,Math.max(b.left+2,r.left+r.width/2)),Math.min(b.bottom-2,b.top+5));
    return {id,firstNaturalCase:firstHeading,top:b.top-r.top,expected:safeTop-r.top,clearance,expectedClearance,current:__refinement.runtime.position?.anchor,uncovered:h===hit||h.contains(hit),toolsVisible,
      pane:r.toJSON(),tools:t.toJSON(),heading:b.toJSON(),computedTop:style.top,computedPosition:style.position,scrollTop:pane.scrollTop,toolsOffsetTop:tools.offsetTop,
      articlePaddingTop:getComputedStyle(document.getElementById('article')).paddingTop,pure:document.getElementById('app').classList.contains('pure')};
  },id);
  targetGeometry.push(v);
  assert.equal(v.current,id,JSON.stringify(v));assert(Math.abs(v.top-v.expected)<2,JSON.stringify(v));if(v.toolsVisible)assert(Math.abs(v.clearance-v.expectedClearance)<2,JSON.stringify(v));assert(v.uncovered,JSON.stringify(v));
}
async function readingPoint(p, coordinate = null) {
  return p.evaluate(coordinate => {
    const position = coordinate || __refinement.runtime.position, pane = document.getElementById('readingPane');
    const block = document.querySelector('#article [data-read-block="' + position.block.index + '"]');
    const bounds = block.getBoundingClientRect(), top = pane.getBoundingClientRect().top;
    const point = position.block.afterGap !== undefined ? bounds.bottom + position.block.afterGap
      : position.block.ratio ? bounds.top + position.block.ratio * bounds.height : bounds.top - position.block.offset;
    return { position, anchor: __refinement.runtime.position.anchor, block: __refinement.runtime.position.block.index,
      point: point - top, headingTop: document.getElementById(position.anchor).getBoundingClientRect().top - top,
      scrollTop: pane.scrollTop, paperWidth: document.getElementById('article').clientWidth };
  }, coordinate);
}
async function settingsPoint(p,label,reference) {
  const point=await readingPoint(p,reference);
  const geometry=await p.evaluate(({label,reference})=>{
    const position=__refinement.runtime.position,pane=document.getElementById('readingPane'),tools=document.getElementById('articleTools'),node=document.getElementById('unit-3');
    const block=document.querySelector('#article [data-read-block="'+reference.block.index+'"]');
    return {label,position,reference,pane:pane.getBoundingClientRect().toJSON(),tools:tools.getBoundingClientRect().toJSON(),heading:node.getBoundingClientRect().toJSON(),scrollTop:pane.scrollTop,
      block:{tag:block.tagName,id:block.id,rect:block.getBoundingClientRect().toJSON(),text:block.textContent.slice(0,80)},font:getComputedStyle(document.querySelector('#article p')).fontSize};
  },{label,reference});
  settingsGeometry.push({...geometry,readingPoint:point});
}
async function installPositionPersistenceGate(context) {
  // Deterministically exercise the legitimate pre-debounce window. Only the
  // existing 180ms position-persistence callback is held; rendering, route
  // promises, network, history, and every other browser timer run normally.
  await context.addInitScript(()=>{
    const schedule=window.setTimeout.bind(window),cancel=window.clearTimeout.bind(window),held=new Map();let next=-1,holding=true;
    window.setTimeout=(callback,delay,...args)=>{
      if(holding&&delay===180&&typeof callback==='function'&&callback.toString().includes('storePosition(')){
        const id=next--;held.set(id,()=>callback(...args));return id;
      }
      return schedule(callback,delay,...args);
    };
    window.clearTimeout=id=>held.has(id)?held.delete(id):cancel(id);
    window.__positionPersistenceGate={get count(){return held.size;},release(){holding=false;const callbacks=[...held.values()];held.clear();for(const callback of callbacks)callback();}};
  });
}
async function blankDoubleClick(p) { const point=await p.evaluate(()=>{const a=document.querySelector('#article').getBoundingClientRect(),r=document.querySelector('#readingPane').getBoundingClientRect();const x=Math.max(r.left+2,a.left+3),y=r.top+Math.min(180,r.height/2);return{x,y,hit:document.elementFromPoint(x,y)?.tagName};}); await p.mouse.dblclick(point.x,point.y,{delay:40}); await settled(p,180); gestures.push({...point,...await p.evaluate(()=>({selection:getSelection().toString(),pure:__refinement.runtime.state.pure}))}); }
async function geometry(p) { return p.evaluate(()=>{const pane=document.querySelector('#readingPane'),paper=document.querySelector('#article');return{outer:document.documentElement.scrollWidth,viewport:innerWidth,pane:pane.clientHeight,width:pane.clientWidth,paper:paper.getBoundingClientRect().width};}); }
function noteSeed(dirty=true) { const prefix=`second-algorithm:${owner}:`;return {
  [prefix+'notes:practice-course']:JSON.stringify({text:'legacy local note',revision:2,dirty}),
  [prefix+'notes-cache:practice-course']:JSON.stringify({text:'server copy',revision:3,dirty:false,updatedAt:1}),
  [prefix+'notes-draft:practice-course:older-tab']:JSON.stringify({text:'unsent other tab',revision:1,dirty,updatedAt:2}),
  [prefix+'notes-backup:practice-course:1:qa']:JSON.stringify({text:'conflict backup',revision:1,updatedAt:1}),
  [prefix+'notes-confirmed:obsolete-marker']:'{"text":"confirmed snapshot","revision":0,"updatedAt":0}',
  [prefix+'notes:retired-chapter']:dirty?'{legacy malformed original':JSON.stringify({text:'retired clean note',revision:1,dirty:false}),
  [`second-algorithm:${otherOwner}:notes:practice-course`]:JSON.stringify({text:'different owner private note',revision:9,dirty:true})
}; }
async function snapshotKeys(p,keys) { return p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys); }
(async()=>{
  const boundary=await import('../tools/reader-boundary.mjs');
  const physical=await fs.realpath(root); if(process.platform==='win32'&&!/^D:[\\/]/i.test(physical))throw Error('Browser QA workspace must physically reside on D.');
  await fs.mkdir(temporary,{recursive:true}); process.env.TEMP=process.env.TMP=process.env.TMPDIR=temporary;
  makeIndex=(await import('./build-carrier.mjs')).publicationIndex; qaCatalog=await createCorpus();
  const inputStart = await fingerprint();
  const browser=await chromium.launch({headless:true,executablePath:process.env.ALGORITHM_QA_CHROME,env:{...process.env,TEMP:temporary,TMP:temporary,TMPDIR:temporary},args:['--disk-cache-dir='+path.join(temporary,'disk-cache'),'--disable-background-networking','--no-first-run']});
  const results=[],failures=[];
  async function check(name,action,options) { if(process.env.ALGORITHM_QA_CASE&&!name.includes(process.env.ALGORITHM_QA_CASE))return;let env;try{env=await environment(browser,options);await action(env);assert.deepEqual(env.mock.errors,[]);results.push({name,passed:true});console.log('PASS',name);}catch(error){failures.push({name,error:error.stack});results.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message);for(const [i,p]of(env?.context.pages()||[]).entries()){await p.screenshot({path:path.join(output,name+'-'+i+'.png')}).catch(()=>{});await fs.writeFile(path.join(output,name+'-'+i+'.txt'),await p.locator('body').innerText()).catch(()=>{});}}finally{await env?.context.close();}}
  try {
    await check('anonymous-owner-gate-and-install-instructions-without-protected-requests',async env=>{
      const p=await env.page();await p.locator('.login-card[data-state="login"]').waitFor({state:'visible'});assert(await p.locator('#loginButton').isVisible());assert.equal(await p.locator('#readerView').isVisible(),false);
      assert.equal(env.mock.requests.filter(r=>r.path.startsWith('/library/')||r.path.startsWith('/api/')).length,0);assert.equal(await p.locator('#article .code-block').count(),0);
      await p.locator('.login-install[data-install-info]').click();await p.locator('#sheetDialog').waitFor({state:'visible'});
      assert.equal(await p.locator('#sheetTitle').innerText(),'加入主屏幕');assert.match(await p.locator('#sheetBody').innerText(),/Safari[\s\S]*分享/);
      assert.equal(await p.locator('#sheetBack').isVisible(),false);await closeSheet(p);assert(await p.locator('#loginView').isVisible());
      assert.equal(env.mock.requests.filter(r=>r.path.startsWith('/library/')||r.path.startsWith('/api/')).length,0);
    },{authenticated:false});
    await check('guided-reader-compact-toolbar-and-responsive-paper',async env=>{
      const p=await env.page();
      for(const viewport of[{width:402,height:874},{width:320,height:740},{width:1280,height:800},{width:874,height:402}]){
        await p.setViewportSize(viewport);await settled(p);
        assert.deepEqual(await p.locator('#headerActions > button').evaluateAll(xs=>xs.map(x=>x.id)),['previousMajor','nextMajor','questionsButton','settingsButton']);
        const labels=(await p.locator('#headerActions > button').allTextContents()).map(s=>s.trim());
        assert.deepEqual(labels,['上一节','下一节','章节答疑','设置']);
        assert.equal(await p.locator('#appHeader .title-row .app-title h1').count(),1);
        assert.equal(await p.locator('#headerLogo svg').count(),1);
        assert.equal(await p.locator('#notesButton,#noteEditor,#pureButton,#returnButton,#progressLabel,#progressFill,.context-bar,#tocSearch,#librarySearch,#documentTabs,#previousHeading,#nextHeading,#tocButton,#desktopToc,#headingPathButton,#readerFooter').count(),0);
        assert.equal(await p.locator('#readerStatusbar button,#readerStatusbar a').count(),0);
        assert.equal(await p.locator('#readerStatusbar #statusLamp,#readerStatusbar #syncStatus,#readerStatusbar #readingPosition').count(),3);
        const header=await p.evaluate(()=>({title:document.querySelector('#appHeader .title-row').getBoundingClientRect().bottom,actions:document.getElementById('headerActions').getBoundingClientRect().top}));
        assert(header.actions>=header.title-1,JSON.stringify({viewport,header}));
        const g=await geometry(p);assert(g.outer<=g.viewport+1&&g.pane>100&&g.paper<=g.width+1,JSON.stringify({viewport,g}));
        await p.screenshot({path:path.join(output,`viewport-${viewport.width}x${viewport.height}.png`)});
      }
    });
    await check('header-logo-shared-height-reflection-and-motion-protection',async env=>{
      const p=await env.page(),motion=p.locator('#headerLogo .header-logo-ink');
      const measure=()=>p.evaluate(()=>{
        const slot=document.querySelector('#headerLogo'),svg=slot.querySelector('svg'),shape=slot.querySelector('#algorithm-header-shape'),box=shape.getBBox(),m=shape.transform.baseVal.consolidate().matrix;
        const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};};
        return{slot:rect(slot),svg:rect(svg),header:rect(document.querySelector('#appHeader')),shape:{width:box.width*m.a,height:box.height*m.d,top:box.y*m.d+m.f,bottom:(box.y+box.height)*m.d+m.f},wholeOpacity:getComputedStyle(svg).opacity,wholeTransform:getComputedStyle(svg).transform,base:getComputedStyle(slot.querySelector('.header-logo-base')).fill,ink:getComputedStyle(slot.querySelector('.header-logo-ink')).opacity,reflection:getComputedStyle(slot.querySelector('.header-logo-reflection')).opacity,actions:slot.querySelectorAll('button,a,[tabindex]').length};
      });
      const initial=await measure();
      assert.equal(initial.slot.width,76);assert.equal(initial.slot.height,38);
      assert.equal(initial.svg.width,52);assert.equal(initial.svg.height,52);
      assert.equal(initial.slot.y+initial.slot.height/2,initial.svg.y+initial.svg.height/2);
      assert(Math.abs(initial.shape.height-291)<.001,JSON.stringify(initial));
      assert(Math.abs(initial.shape.top-106)<.001&&Math.abs(initial.shape.bottom-397)<.001);
      assert.equal(initial.base,'rgb(207, 232, 255)');assert.equal(initial.actions,0);
      assert.equal(await motion.evaluate(e=>e.getAnimations()[0].effect.getTiming().duration),4800);
      const phases=Array.from({length:33},(_,i)=>{const time=4800*i/32,wave=Math.sin(time/4800*2*Math.PI);return[time,Math.max(0,wave),1+Math.min(0,wave)];});
      for(const[time,opacity,ink]of phases){
        await motion.evaluate((e,time)=>{for(const a of [e.getAnimations()[0],e.querySelector('.header-logo-reflection').getAnimations()[0]]){a.pause();a.currentTime=time;}},time);
        await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
        const state=await measure();assert(Math.abs(Number(state.reflection)-opacity)<.002,JSON.stringify({time,state}));
        assert(Math.abs(Number(state.ink)-ink)<.0001,JSON.stringify({time,state}));assert.equal(state.wholeOpacity,'1');assert.equal(state.wholeTransform,'none');
        assert.deepEqual(state.slot,initial.slot);assert.deepEqual(state.svg,initial.svg);assert.deepEqual(state.header,initial.header);
        headerLogoMotion.push({phaseMs:time,...state,visibleHeightCssPx:state.shape.height*state.svg.height/512});
        if(time===0||time===1200||time===3600)await p.screenshot({path:path.join(output,`header-logo-${time===0?'ice':time===1200?'white':'background'}-402.png`)});
      }
      const pixels=await p.locator('#headerLogo svg').evaluate(async svg=>{
        const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','512');copy.setAttribute('height','512');copy.querySelector('.header-logo-reflection').setAttribute('opacity','.32');
        const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(copy));await image.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const at=(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(svg.querySelector('#algorithm-header-shape').transform.baseVal.consolidate().matrix);return[...ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data];};
        return{cuts:[[256,148],[144,356],[368,356]].map(([x,y])=>at(x,y)),nodes:[[256,120],[144,320],[368,320]].map(([x,y])=>at(x,y))};
      });
      assert(pixels.cuts.every(p=>p[3]===0),JSON.stringify(pixels));assert(pixels.nodes.every(p=>p[3]===255),JSON.stringify(pixels));
      // Start a fresh CSS animation after manually seeking the phase samples.
      // WAAPI play() overrides later CSS animation-play-state changes.
      await p.emulateMedia({reducedMotion:'reduce'});
      // Force the reduced-motion style to settle before switching back. A fast
      // runner can otherwise coalesce both media changes, retaining the WAAPI
      // pause used for the exact phase samples instead of creating fresh CSS
      // animations. This also verifies that both layers really stop in reduce.
      assert.equal(await motion.evaluate(e=>e.getAnimations().length),0);
      assert.equal(await p.locator('#headerLogo .header-logo-reflection').evaluate(e=>e.getAnimations().length),0);
      await p.emulateMedia({reducedMotion:'no-preference'});
      await p.evaluate(()=>{globalThis.__logoHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>globalThis.__logoHidden});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await motion.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
      await motion.evaluate(async e=>{await e.getAnimations()[0].ready;});
      const paused=await motion.evaluate(e=>e.getAnimations()[0].currentTime);await p.waitForTimeout(90);
      assert(Math.abs(await motion.evaluate(e=>e.getAnimations()[0].currentTime)-paused)<1);
      await p.evaluate(()=>{globalThis.__logoHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await motion.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
      await motion.evaluate(async e=>{await e.getAnimations()[0].ready;});
      await p.waitForFunction(time=>document.querySelector('#headerLogo .header-logo-ink').getAnimations()[0].currentTime>time,paused,{timeout:5000});
      await p.evaluate(()=>{globalThis.__logoHidden=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.__logoHidden=false;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
      assert.equal(await motion.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
      await p.evaluate(()=>{document.documentElement.classList.add('header-motion-paused');window.dispatchEvent(new Event('focus'));});
      assert.equal(await motion.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
      await p.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await motion.evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await motion.evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal((await measure()).reflection,'0');
      assert.deepEqual((await measure()).slot,initial.slot);await p.screenshot({path:path.join(output,'header-logo-reduced-motion-402.png')});
      await p.emulateMedia({reducedMotion:'no-preference'});
      const startup=await p.evaluate(()=>{const card=document.createElement('div');card.className='opening-card';card.dataset.state='loading';card.innerHTML='<span class="state-icon"></span>';document.body.append(card);const style=getComputedStyle(card.firstElementChild),result={animation:style.animationName,duration:style.animationDuration};card.remove();delete document.hidden;return result;});
      assert.deepEqual(startup,{animation:'breathe',duration:'1.8s'});
      headerLogoMotion.push({maskPixels:pixels,backgroundPaused:true,resumes:true,reducedMotion:{reflection:0,animated:false},startup});
    });
    await check('pointer-dialog-reader-focus-is-clean-and-keyboard-remains-visible',async env=>{
      const p=await env.page();
      const dateMarkers=await p.evaluate(()=>{const calendar=document.createElement('div');calendar.className='calendar';calendar.innerHTML='<button class="today has-chapter selected">30</button>';document.body.append(calendar);const n=calendar.firstElementChild,result={today:getComputedStyle(n,'::before').backgroundColor,published:getComputedStyle(n,'::after').content,outline:getComputedStyle(n).outlineStyle};calendar.remove();return result});assert.equal(dateMarkers.today,'rgb(76, 120, 158)');assert(dateMarkers.published.includes('•'));assert.equal(dateMarkers.outline,'none');
      assert.equal(await p.locator('#readingPane').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      await p.locator('#settingsButton').click();
      assert.equal(await p.locator('#sheetTitle').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      await closeSheet(p);await p.keyboard.press('Tab');
      assert(await p.evaluate(()=>document.documentElement.classList.contains('keyboard-navigation')&&getComputedStyle(document.activeElement).outlineStyle==='solid'));
      await p.locator('#settingsButton').click();
      assert(await p.evaluate(()=>!document.documentElement.classList.contains('keyboard-navigation')));
      await closeSheet(p);await navigateHeading(p,'unit-4');
      assert.equal(await p.locator('#readingPane').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    });
    await check('single-h2-neighbors-source-status-index-and-native-boundaries',async env=>{
      const p=await env.page();
      for(const viewport of[{width:402,height:874},{width:320,height:740},{width:1280,height:800}]){
        await p.setViewportSize(viewport);await settled(p,260);await navigateHeading(p,'code-1');
        const before=await p.locator('#readingPosition').innerText();await p.locator('#readingPane').evaluate(e=>e.scrollTop+=70);await settled(p);
        assert.equal(await currentAnchor(p),'code-1');assert.equal(await p.locator('#readingPosition').innerText(),before);
        assert.equal(before,'2 / 16 · '+await p.locator('#article #section-1').innerText());
        const beforeLocation=await readingPoint(p);await p.locator('#sectionIndexButton').click();await settled(p);
        assert.equal(await p.locator('#indexList [data-index-go][aria-current="location"]').getAttribute('data-index-go'),'code-1');
        assert(await p.locator('#indexList [data-index-go="code-1"]').isVisible());
        const afterLocation=await readingPoint(p,beforeLocation.position);
        assert.equal(afterLocation.anchor,beforeLocation.anchor);assert.equal(afterLocation.block,beforeLocation.block);
        // The source-style index is a modal at every width, so both the
        // actual reading coordinate and the existing paper geometry stay put.
        assert(Math.abs(afterLocation.point-beforeLocation.point)<2,JSON.stringify({viewport,beforeLocation,afterLocation}));
        assert(Math.abs(afterLocation.headingTop-beforeLocation.headingTop)<2,JSON.stringify({viewport,beforeLocation,afterLocation}));
        assert.equal(afterLocation.paperWidth,beforeLocation.paperWidth);
        assert(Math.abs(afterLocation.scrollTop-beforeLocation.scrollTop)<2,JSON.stringify({viewport,beforeLocation,afterLocation}));
        await closeSheet(p);
        for(const[selector,target]of[['#previousMajor','section-0'],['#nextMajor','section-2']]){
          await navigateHeading(p,'code-1');assert.equal(await p.locator(selector).getAttribute('data-target'),target);
          assert((await p.locator(selector).getAttribute('aria-label')).includes(await p.locator('#article #'+target).innerText()));
          await p.locator(selector).click();await settled(p);await assertTarget(p,target);
        }
        await navigateHeading(p,'section-0');assert(await p.locator('#previousMajor').isDisabled());
        await navigateHeading(p,'code-15');assert(await p.locator('#nextMajor').isDisabled());await assertTarget(p,'code-15');
      }
    });
    await check('hierarchical-directory-index-expand-is-not-jump-and-preserves-original-order',async env=>{
      const p=await env.page();await navigateHeading(p,'code-5');await p.locator('#sectionIndexButton').click();
      assert.equal(await p.locator('#sheetTitle').innerText(),'目录索引');assert.equal(await p.locator('#sheetBody #indexFilter,input[type="search"],#desktopToc').count(),0);
      const current=p.locator('#indexList [data-index-go][aria-current="location"]');assert.equal(await current.count(),1);assert.equal(await current.getAttribute('data-index-go'),'code-5');
      const expected=await p.evaluate(()=>__refinement.runtime.headings.map(h=>({id:h.id,title:h.title})));
      const rows=()=>p.locator('#indexList [data-index-go]').evaluateAll(xs=>xs.map(x=>({id:x.dataset.indexGo,title:x.textContent})));
      assert.deepEqual(await rows(),expected);assert.equal(expected.length,48);
      assert.equal(await p.locator('#indexList [data-directory-section]').count(),16);
      for(let i=0;i<16;i++) {
        const group=p.locator(`#indexList [data-directory-section="section-${i}"]`);
        assert.deepEqual(await group.locator('[data-index-go]').evaluateAll(xs=>xs.map(x=>x.dataset.indexGo)),[`section-${i}`,`unit-${i}`,`code-${i}`]);
        assert.equal(await group.locator('.depth-3').count(),1);assert.equal(await group.locator('.depth-4').count(),1);
      }
      const before=await p.evaluate(()=>({hash:location.hash,top:document.querySelector('#readingPane').scrollTop}));
      const toggle=p.locator('[data-toggle-index-section="section-8"]');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      assert(await p.locator('#indexList [data-index-go="unit-8"]').isVisible());
      await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await p.locator('#indexList [data-index-go="unit-8"]').isVisible(),false);
      assert.deepEqual(await rows(),expected);assert.deepEqual(await p.evaluate(()=>({hash:location.hash,top:document.querySelector('#readingPane').scrollTop})),before,'directory expansion only changes the directory');
      await toggle.click();
      await p.screenshot({path:path.join(output,'section-index.png')});await p.locator('#indexList [data-index-go="unit-8"]').click();await settled(p);
      assert.equal(await p.locator('#sheetDialog').evaluate(e=>e.open),false);await assertTarget(p,'unit-8');
      await p.locator('#sectionIndexButton').click();await closeSheet(p);assert(await p.locator('#sectionIndexButton').evaluate(e=>e===document.activeElement));
    });
    await check('semantic-knowledge-prerequisite-history-late-response-and-focus',async env=>{const p=await env.page(),link=p.locator('#article [data-knowledge]').first();await link.scrollIntoViewIfNeeded();await link.focus();const before=await p.locator('#readingPane').evaluate(e=>e.scrollTop),hash=await p.evaluate(()=>location.hash);await link.click();await p.locator('.knowledge-paper').waitFor();assert.equal(await p.locator('#sheetTitle').innerText(),'删除一个重复对象');assert.doesNotMatch(await p.locator('.knowledge-paper').innerText(),/Q\d{6}/);await p.locator('#sheetBody [data-knowledge]').click();await p.waitForFunction(()=>document.querySelector('#sheetTitle').textContent==='有效范围');await p.locator('#sheetBack').click();assert.equal(await p.locator('#sheetTitle').innerText(),'删除一个重复对象');await p.evaluate(()=>history.back());await p.waitForFunction(()=>!document.querySelector('#sheetDialog').open);assert.equal(await p.evaluate(()=>location.hash),hash);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-before)<2);assert(await link.evaluate(e=>e===document.activeElement));const card=qaCatalog.questions[1];await p.evaluate(()=>window.__refinement.state.knowledge.clear());env.mock.unavailable.add(card.url);await link.click();await p.waitForFunction(()=>/未下载|无法|失败/.test(document.querySelector('#sheetBody').textContent));assert.equal(await p.locator('#sheetBody [data-knowledge-retry].bevel-button').count(),1);await closeSheet(p);env.mock.unavailable.delete(card.url);env.mock.delayDocument=card.url;await link.click();await poll(()=>env.mock.heldDocument,'knowledge delayed');await closeSheet(p);env.mock.heldDocument();await settled(p);assert.equal(await p.locator('#sheetDialog').evaluate(e=>e.open),false);});
    await check('code-copy-horizontal-scroll-independent-size-and-wrap', async env => {
      const p = await env.page(), code = p.locator('#article pre').first();
      await code.scrollIntoViewIfNeeded();
      const original = await code.textContent(), font = await code.locator('code').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
      assert(await code.evaluate(e => { e.scrollLeft = 120; return e.scrollLeft > 0 && e.scrollWidth > e.clientWidth; }));
      await p.locator('#article [data-copy]').first().click();
      // The Windows system clipboard exposes its native CRLF line convention.
      // Normalize only that convention; every other copied character is exact.
      assert.equal((await p.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), original);
      await p.locator('#settingsButton').click();
      await p.locator('[data-show-reading-settings]').click();
      await p.locator('[data-code-font="0.5"]').click(); await p.locator('#wrapCode').check(); await closeSheet(p);
      assert.equal(await code.textContent(), original);
      assert(await code.locator('code').evaluate(e => parseFloat(getComputedStyle(e).fontSize)) > font);
      assert.equal(await code.locator('code').evaluate(e => getComputedStyle(e).whiteSpace), 'pre-wrap');
      const g = await geometry(p); assert(g.outer <= g.viewport + 1 && g.paper <= g.width + 1);
    });
    await check('visual-viewport-keyboard-and-pinch-zoom-sheet-bounds', async env => {
      await env.context.addInitScript(() => { const v = new EventTarget(); Object.assign(v, {height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1}); Object.defineProperty(window, 'visualViewport', {configurable: true, value: v}); window.__fakeViewport = v; });
      const p = await env.page(); await p.locator('#questionsButton').click();
      const viewportFacts=await p.evaluate(()=>{const chain=[];for(let e=document.getElementById('article');e;e=e.parentElement)chain.push({tag:e.tagName,id:e.id,classes:e.className,touchAction:getComputedStyle(e).touchAction,inline:e.style.touchAction});return{chain,viewport:document.querySelector('meta[name="viewport"]').content,standalone:matchMedia('(display-mode:standalone)').matches};});
      viewportDiagnostics.push(viewportFacts);
      // Chromium serializes pan-x pan-y pinch-zoom as its standards-equivalent
      // keyword "manipulation". Every ancestor must still allow pinch; an
      // explicit pan-only/none restriction anywhere fails this check.
      assert(viewportFacts.chain.every(e=>e.touchAction==='auto'||e.touchAction==='manipulation'||e.touchAction.split(/\s+/).includes('pinch-zoom')),JSON.stringify(viewportFacts));
      assert.doesNotMatch(await p.locator('meta[name="viewport"]').getAttribute('content'),/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/i);
      await p.evaluate(() => {Object.assign(__fakeViewport, {height: 420, offsetTop: 22, scale: 1}); __fakeViewport.dispatchEvent(new Event('resize'));}); await p.waitForTimeout(40);
      const bounds = await p.locator('#sheetDialog').boundingBox(); assert(bounds.y >= 22 && bounds.y + bounds.height <= 443, JSON.stringify(bounds));
      assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--sheet-viewport-height')), '420px');
      await p.evaluate(() => {Object.assign(__fakeViewport, {height: 200, scale: 2}); __fakeViewport.dispatchEvent(new Event('resize'));});
      assert.deepEqual(await p.evaluate(() => ['--sheet-viewport-height','--sheet-offset-top','--sheet-offset-bottom'].map(n => document.documentElement.style.getPropertyValue(n))), ['', '', '']);
    });
    await check('safe-doubleclick-only-pure-preserves-width-text-and-native-selection',async env=>{const p=await env.page();await navigateHeading(p,'unit-4');await p.locator('#readingPane').evaluate(e=>e.scrollTop+=80);await settled(p);await p.evaluate(()=>getSelection().removeAllRanges());const before=await p.locator('#article #unit-4').evaluate(e=>({top:e.getBoundingClientRect().top,width:document.querySelector('#article').getBoundingClientRect().width}));await blankDoubleClick(p);assert(await p.locator('#app').evaluate(e=>e.classList.contains('pure')));const during=await p.locator('#article #unit-4').evaluate(e=>({top:e.getBoundingClientRect().top,width:document.querySelector('#article').getBoundingClientRect().width}));assert(Math.abs(before.width-during.width)<1&&Math.abs(before.top-during.top)<2,JSON.stringify({before,during}));await p.keyboard.press('Escape');assert(await p.locator('#app').evaluate(e=>e.classList.contains('pure')));await blankDoubleClick(p);assert.equal(await p.locator('#app').evaluate(e=>e.classList.contains('pure')),false);const code=p.locator('.code-block pre').first();await code.scrollIntoViewIfNeeded();await code.dblclick({position:{x:40,y:30}});assert.equal(await p.locator('#app').evaluate(e=>e.classList.contains('pure')),false);await p.evaluate(()=>getSelection().removeAllRanges());const paragraph=p.locator('#article p').first();await paragraph.scrollIntoViewIfNeeded();await paragraph.dblclick({position:{x:45,y:10}});assert((await p.evaluate(()=>getSelection().toString())).trim());assert.equal(await p.locator('#app').evaluate(e=>e.classList.contains('pure')),false);});
    await check('pure-code-click-excluded-source-controls-only-and-pointer-hold',async env=>{
      const p=await env.page();await navigateHeading(p,'code-2');await blankDoubleClick(p);assert.equal(await p.locator('#app').evaluate(e=>e.classList.contains('controls-awake')),false);
      const hiddenChrome=()=>p.locator('#appHeader,#chapterNav,#readerHead,.part-heading').evaluateAll(xs=>xs.every(e=>{const s=getComputedStyle(e);return e.inert&&(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0);}));
      assert(await hiddenChrome());assert(await p.locator('#articleTools,#readerStatusbar').evaluateAll(xs=>xs.every(e=>e.inert&&getComputedStyle(e).opacity==='0')));
      await p.locator('#article #code-2 + .code-block code').click({position:{x:5,y:5}});assert.equal(await p.locator('#app').evaluate(e=>e.classList.contains('controls-awake')),false);
      await p.locator('#readingPane').click({position:{x:3,y:100}});assert(await p.locator('#app').evaluate(e=>e.classList.contains('controls-awake')));assert(await hiddenChrome());
      assert(await p.locator('#articleTools,#readerStatusbar').evaluateAll(xs=>xs.every(e=>!e.inert&&getComputedStyle(e).opacity!=='0')));
      assert.equal(await p.locator('#sectionIndexButton,#readerStatusbar').count(),2);
      const r=await p.locator('#sectionIndexButton').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(3100);assert(await p.locator('#app').evaluate(e=>e.classList.contains('controls-awake')));assert(await hiddenChrome());await p.mouse.up();
    });
    await check('same-document-link-browser-back-forward-and-quick-reload-keep-place',async env=>{const p=await env.page();const link=p.locator('[data-qa-link="same"]');await link.scrollIntoViewIfNeeded();await link.focus();await settled(p);const before=await p.locator('#readingPane').evaluate(e=>e.scrollTop);await link.click();await settled(p);await assertTarget(p,'unit-6');const after=await p.locator('#readingPane').evaluate(e=>e.scrollTop);await p.goBack();await settled(p);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-before)<2);await p.goForward();await settled(p);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-after)<2);await p.locator('#readingPane').evaluate(e=>e.scrollTop+=130);await p.waitForTimeout(40);const quick=await p.locator('#readingPane').evaluate(e=>e.scrollTop);await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-quick)<2);assert.doesNotMatch(await p.evaluate(()=>location.hash),/[?&]anchor=/);});
    await check('slow-cross-document-preserves-paper-and-cancel-rejects-late-result',async env=>{const p=await env.page(),link=p.locator('[data-qa-link="cross"]');await link.scrollIntoViewIfNeeded();await settled(p);const before=await p.evaluate(()=>({html:document.querySelector('#article').innerHTML,scroll:document.querySelector('#readingPane').scrollTop,hash:location.hash}));env.mock.delayDocument=qaCatalog.collections[0].documents[1].url;await link.click();await poll(()=>env.mock.heldDocument,'cross-document delayed');assert.equal(await p.locator('#article').innerHTML(),before.html);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-before.scroll)<2);await p.locator('[data-cancel-route]').click();assert.equal(await p.evaluate(()=>location.hash),before.hash);env.mock.heldDocument();await settled(p);assert.equal(await p.evaluate(()=>window.__refinement.state.active.meta.id),'practice-entry');assert.equal(await p.locator('#article').innerHTML(),before.html);});
    await check('invalid-explicit-route-preserves-paper-and-reports-unavailable-target',async env=>{
      const p=await env.page();await navigateHeading(p,'unit-3');await p.locator('#readingPane').evaluate(e=>e.scrollTop+=70);await settled(p);
      const before=await p.evaluate(()=>({html:document.querySelector('#article').innerHTML,top:document.querySelector('#readingPane').scrollTop,anchor:__refinement.runtime.position.anchor,document:__refinement.state.active.meta.id}));
      for(const hash of['#/read/absent-chapter/absent-document','#/read/practice-course/absent-document','#/chapter/absent-chapter','#/read/practice-course/practice-entry?anchor=absent-heading']){
        await p.evaluate(hash=>{location.hash=hash;},hash);
        await p.waitForFunction(hash=>location.hash===hash&&__refinement.observedLocation===hash&&/不存在|已撤回/.test(document.querySelector('#readingNotice').textContent)&&!document.querySelector('#readingNotice').hidden,hash);
        const now=await p.evaluate(()=>({html:document.querySelector('#article').innerHTML,top:document.querySelector('#readingPane').scrollTop,anchor:__refinement.runtime.position.anchor,document:__refinement.state.active.meta.id}));
        assert.equal(now.html,before.html);assert.equal(now.document,before.document);assert.equal(now.anchor,before.anchor);assert(Math.abs(now.top-before.top)<2);
        assert.equal(await p.locator('#readingNotice [data-show-library]').count(),1);
        await p.evaluate(()=>{location.hash='#/read/practice-course/practice-entry';});await p.waitForFunction(()=>location.hash==='#/read/practice-course/practice-entry'&&__refinement.observedLocation===location.hash&&document.querySelector('#readingNotice').hidden);await settled(p);
      }
    });
    await check('same-document-invalid-route-return-before-position-debounce-preserves-live-paper',async env=>{
      await installPositionPersistenceGate(env.context);const p=await env.page();
      const snapshot=label=>p.evaluate(label=>({label,hash:location.hash,observed:__refinement.observedLocation,sequence:__refinement.state.sequence,
        position:__refinement.runtime.position,top:document.getElementById('readingPane').scrollTop,history:history.state,
        local:JSON.parse(localStorage.getItem('second-algorithm:'+__refinement.state.owner+':position:practice-entry')||'null'),
        record:__refinement.state.records['position:practice-entry'],held:__positionPersistenceGate.count}),label);
      await navigateHeading(p,'unit-3');await p.locator('#readingPane').evaluate(e=>e.scrollTop+=70);await settled(p);
      const before=await snapshot('before-invalid-route');pendingPersistence.push(before);assert.equal(before.position.anchor,'unit-3');assert(before.held>0,'position debounce must actually be held');assert.notEqual(before.local?.anchor,'unit-3','the persisted coordinate must still be stale');
      await p.evaluate(()=>{history.replaceState(null,'',location.href);location.hash='#/read/absent-chapter/absent-document';});
      await p.waitForFunction(()=>__refinement.observedLocation===location.hash&&location.hash==='#/read/absent-chapter/absent-document'&&!document.getElementById('readingNotice').hidden);
      pendingPersistence.push(await snapshot('invalid-route-rendered'));
      await p.evaluate(()=>{location.hash='#/read/practice-course/practice-entry';});
      await p.waitForFunction(()=>__refinement.observedLocation===location.hash&&location.hash==='#/read/practice-course/practice-entry'&&document.getElementById('readingNotice').hidden);await settled(p);
      const returned=await snapshot('valid-route-before-debounce-release');pendingPersistence.push(returned);
      assert.equal(returned.position.anchor,before.position.anchor);assert(Math.abs(returned.top-before.top)<2,JSON.stringify({before,returned}));
      await p.evaluate(()=>__positionPersistenceGate.release());await settled(p);
      const released=await snapshot('after-debounce-release');pendingPersistence.push(released);assert.equal(released.held,0);assert.equal(released.local.anchor,before.position.anchor);assert.equal(released.position.anchor,before.position.anchor);assert(Math.abs(released.top-before.top)<2);
    });
    await check('pending-old-scroll-cannot-write-new-document-history-position', async env => {
      const p = await env.page(), link = p.locator('[data-qa-link="cross-start"]');
      await link.scrollIntoViewIfNeeded(); await link.focus(); await settled(p);
      const before = await p.locator('#readingPane').evaluate(e => e.scrollTop);
      env.mock.delayDocument = qaCatalog.collections[0].documents[2].url;
      await link.click(); await poll(() => env.mock.heldDocument, 'anchorless document delayed');
      await p.locator('#readingPane').evaluate(e => e.scrollTop += 100); await p.waitForTimeout(250);
      env.mock.heldDocument(); await p.waitForFunction(() => __refinement.state.active?.meta.id === 'practice-alternative'); await settled(p);
      assert.equal(await currentAnchor(p),'section-0');assert.equal(await p.locator('#readingPane').evaluate(e=>e.scrollTop),0);
      assert(await p.locator('#readerHead').isVisible());assert(await p.locator('#sectionIndexButton').isVisible());
      await p.goBack(); await p.waitForFunction(() => __refinement.state.active?.meta.id === 'practice-entry'); await settled(p);
      assert(Math.abs(await p.locator('#readingPane').evaluate(e => e.scrollTop) - before) < 2);
    });
    await check('grouped-service-settings-reading-defaults-sheet-history-and-immediate-reopen',async env=>{
      const p=await env.page();await navigateHeading(p,'unit-3');const anchor=await currentAnchor(p),reference=(await readingPoint(p)).position;await settingsPoint(p,'before-settings',reference);await p.locator('#settingsButton').click();
      assert.equal(await p.locator('#headerActions [data-action="library"],#headerActions #libraryButton').count(),0);
      assert.equal(await p.locator('#sheetBody [data-show-library],#sheetBody [data-current-chapter],#sheetBody [data-show-source]').count(),0);
      assert.equal(await p.locator('#sheetBody .settings-home').count(),1);
      assert.equal(await p.locator('#sheetBody [data-show-reading-settings]').count(),1);
      assert.equal(await p.locator('#sheetBody #bodySizeOutput,#sheetBody #codeSizeOutput').count(),0);
      assert.equal(await p.locator('#sheetBody [data-show-device-settings]').count(),1);
      assert.equal(await p.locator('#sheetBody [data-check-updates],#sheetBody [data-reload-app],#sheetBody [data-logout]').count(),0);
      assert.deepEqual((await p.locator('#sheetBody .section-band').allTextContents()).map(s=>s.replace(/\s+/g,' ').trim()),['阅读','离线下载OFFLINE','学习安排','服务与账户']);
      assert.equal(await p.locator('#sheetBody [data-show-files]').count(),0);
      assert.deepEqual(await p.locator('#sheetBody [data-service-view]').evaluateAll(xs=>xs.map(x=>x.dataset.serviceView)),['study-goal','study-next','study-rest','balances','storage','reminders']);
      await p.locator('#preloadContent').uncheck();assert.equal(await p.evaluate(()=>__refinement.state.settings.preload),false);
      await p.screenshot({path:path.join(output,'settings-home-402.png')});
      const font=await p.locator('#article p').first().evaluate(e=>getComputedStyle(e).fontSize);await p.locator('[data-show-reading-settings]').click();
      await settingsPoint(p,'reading-detail-before-font',reference);
      assert.equal(await p.locator('#sheetDialog').getAttribute('data-view'),'reading-settings');assert.equal(await p.locator('#sheetTitle').innerText(),'阅读偏好');
      await p.screenshot({path:path.join(output,'reading-preferences-402.png')});await p.locator('[data-font="1"]').click();await settled(p);await settingsPoint(p,'font-increased-sheet-open',reference);await closeSheet(p);await settingsPoint(p,'font-increased-sheet-closed',reference);
      assert.notEqual(await p.locator('#article p').first().evaluate(e=>getComputedStyle(e).fontSize),font);assert.equal(await currentAnchor(p),anchor);
      assert(await p.locator('#settingsButton').evaluate(e=>e===document.activeElement));
      await p.locator('#settingsButton').click();await p.locator('[data-show-reading-settings]').click();
      await p.locator('[data-code-font="0.5"]').click();await p.locator('#wrapCode').check();await p.locator('[data-reset-reading]').click();await settled(p);
      assert.deepEqual(await p.evaluate(()=>({fontSize:__refinement.state.settings.fontSize,codeSize:__refinement.state.settings.codeSize,wrapCode:__refinement.state.settings.wrapCode,preload:__refinement.state.settings.preload})),{fontSize:15,codeSize:12,wrapCode:false,preload:false},'restore defaults affects only reading preferences');
      assert.equal(await p.locator('#bodySizeOutput').textContent(),'15');assert.equal(await p.locator('#codeSizeOutput').textContent(),'12');assert.equal(await p.locator('#wrapCode').isChecked(),false);
      await closeSheet(p);const resetLocation=await readingPoint(p,reference);assert.equal(resetLocation.anchor,anchor);assert(Math.abs(resetLocation.point)<2,JSON.stringify({reference,resetLocation}));
      await p.setViewportSize({width:402,height:540});await settled(p);await p.locator('#settingsButton').click();await p.locator('[data-service-view="balances"]').scrollIntoViewIfNeeded();
      const settingsScroll=await p.locator('#sheetBody').evaluate(e=>e.scrollTop);await p.locator('[data-service-view="balances"]').click();await p.locator('.balance-card').waitFor();assert.equal(await p.locator('#sheetTitle').innerText(),'服务额度');
      assert.match(await p.locator('#sheetBody').innerText(),/ChatGPT API.*赠送额度[\s\S]*未核验/);assert.doesNotMatch(await p.locator('#sheetBody').innerText(),/\$\d/);
      await p.screenshot({path:path.join(output,'service-balances-unknown-402x540.png')});
      await p.locator('#sheetBack').click();assert.equal(await p.locator('#sheetTitle').innerText(),'阅读器设置');
      await p.waitForFunction(top=>Math.abs(document.getElementById('sheetBody').scrollTop-top)<2,settingsScroll);
      for(const[kind,title,ready]of[['study-goal','学习目标','[data-service-form="study-goal"]'],['study-next','下次出版','[data-service-form="study-next"]'],['study-rest','休息安排','[data-service-form="study-rest"]'],['storage','存储空间','[data-service-action="reload"]'],['reminders','提醒','[data-service-action="push-enable"]']]){
        await p.locator(`[data-service-view="${kind}"]`).click();await p.locator(ready).waitFor();assert.equal(await p.locator('#sheetTitle').innerText(),title);
        if(kind==='study-rest')assert(await p.locator('#serviceRestRequested').isChecked(),'default automation remains at rest');
        if(kind==='storage')assert.match(await p.locator('#sheetBody').innerText(),/尚无存储记录/);
        if(kind==='reminders')assert(await p.locator('[data-service-action="push-enable"]').isDisabled(),'an unconfigured push service is never presented as enabled');
        await p.locator('#sheetBack').click();assert.equal(await p.locator('#sheetTitle').innerText(),'阅读器设置');
      }
      await p.locator('[data-show-device-settings]').click();assert.equal(await p.locator('#sheetDialog').getAttribute('data-view'),'device-settings');
      assert.equal(await p.locator('#sheetBody [data-check-updates],#sheetBody [data-logout]').count(),2);await p.screenshot({path:path.join(output,'device-account-settings-402x540.png')});
      await p.locator('#sheetBack').click();assert.equal(await p.locator('#sheetTitle').innerText(),'阅读器设置');
      await p.evaluate(()=>{document.querySelector('[data-sheet-close]').click();document.querySelector('#questionsButton').click();});
      await p.waitForFunction(()=>document.querySelector('#sheetDialog').open&&document.querySelector('.reader-question-input'));await settled(p);assert(await p.locator('.reader-question-input').isVisible());
      await p.evaluate(()=>history.back());await p.waitForFunction(()=>!document.querySelector('#sheetDialog').open);
    });
    await check('api-question-acknowledgement-failure-draft-reload-owner-isolation-and-short-viewport',async env=>{
      const p=await env.page();await p.setViewportSize({width:402,height:420});await p.locator('#questionsButton').click();
      assert.equal(await p.locator('.reader-question-turn').count(),0);assert(await p.locator('.reader-question-service-status').isHidden());assert(await p.locator('.reader-question-send').isEnabled());
      const text='为什么这里保留范围边界？';await p.locator('.reader-question-input').fill(text);await closeSheet(p);await p.locator('#questionsButton').click();assert.equal(await p.locator('.reader-question-input').inputValue(),text);
      env.mock.rejectQuestion=true;await p.locator('.reader-question-send').click();await p.waitForFunction(()=>document.querySelector('.reader-question-status').textContent.includes('未确认'));
      assert.equal(await p.locator('.reader-question-input').inputValue(),text);assert.equal(await p.locator('.reader-question-turn').count(),0);
      const r=await p.locator('[data-sheet-close]').boundingBox();assert(r.y>=0&&r.y+r.height<=421);await p.screenshot({path:path.join(output,'api-question-short-viewport.png')});
      await closeSheet(p);await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);await p.locator('#questionsButton').click();assert.equal(await p.locator('.reader-question-input').inputValue(),text);
      env.mock.rejectQuestion=false;await p.locator('.reader-question-send').click();await p.waitForFunction(()=>document.querySelectorAll('.reader-question-turn').length===1);assert.equal(await p.locator('.reader-question-input').inputValue(),'');assert.match(await p.locator('.reader-question-turn').innerText(),/等待答疑/);
      env.mock.questionTurns[0].answer='保留不变量才能安全排除范围。';env.mock.questionTurns[0].status='answered';await closeSheet(p);await p.locator('#questionsButton').click();await p.waitForFunction(()=>document.querySelector('.reader-question-assistant')?.textContent.includes('不变量'));
      await p.locator('.reader-question-input').fill('未发送的新草稿');await closeSheet(p);env.mock.identity=otherOwner;env.mock.questionTurns=[];await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);await p.locator('#questionsButton').click();assert.equal(await p.locator('.reader-question-input').inputValue(),'');assert.equal(await p.locator('.reader-question-turn').count(),0);
    });
    await check('legacy-notes-byte-preservation-two-tabs-and-unsent-logout-guard',async env=>{const p=await env.page(),keys=Object.keys(noteSeed()),before=await snapshotKeys(p,keys);env.mock.state['notes:practice-course']={value:'newer remote copy',revision:99,updatedAt:Date.now()};await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);const b=await env.page();assert.deepEqual(await snapshotKeys(p,keys),before);assert.deepEqual(await snapshotKeys(b,keys),before);await p.locator('#settingsButton').click();await p.locator('[data-show-device-settings]').click();await p.locator('[data-logout]').click();await settled(p);assert.equal(env.mock.requests.filter(r=>r.path==='/auth/logout').length,0);assert.equal(await p.evaluate(()=>window.__refinement.state.owner),owner);assert.deepEqual(await snapshotKeys(p,keys),before);assert.match(await p.locator('#toast').innerText(),/未同步|草稿|保留|退出/);assert.equal(await p.locator('#notesButton,#noteEditor').count(),0);},{initial:noteSeed()});
    await check('clean-logout-preserves-all-legacy-notes-and-prevents-offline-reentry',async env=>{const p=await env.page(),keys=Object.keys(noteSeed(false)),before=await snapshotKeys(p,keys);await p.locator('#settingsButton').click();await p.locator('[data-show-device-settings]').click();await p.locator('[data-logout]').click();await p.locator('#loginView').waitFor({state:'visible'});assert.equal(env.mock.requests.filter(r=>r.path==='/auth/logout').length,1);assert.deepEqual(await snapshotKeys(p,keys),before);assert.equal(await p.evaluate(()=>localStorage.getItem('second-algorithm:last-session')),null);env.mock.rejectApis=true;await p.reload();await p.locator('#loginView').waitFor({state:'visible'});assert.equal(await p.locator('#article .code-block').count(),0);assert.deepEqual(await snapshotKeys(p,keys),before);},{initial:noteSeed(false)});
    await check('same-page-expired-owner-and-reconnect-rebuild-the-current-route', async env => {
      const p = await env.page(), hash = await p.evaluate(() => location.hash);
      env.mock.identity = null; await p.evaluate(() => window.dispatchEvent(new Event('online')));
      await p.locator('#loginView').waitFor({state:'visible'});
      assert.equal(await p.locator('#article .code-block').count(), 0);
      env.mock.identity = owner; await p.evaluate(() => window.dispatchEvent(new Event('online')));
      await p.locator('#article .code-block').first().waitFor(); await settled(p);
      assert.equal(await p.evaluate(() => location.hash), hash);
      assert.equal(await p.evaluate(() => __refinement.state.owner), owner);
      assert.equal(await p.evaluate(() => __refinement.state.active.meta.id), 'practice-entry');
      env.mock.failStateRead=true;await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);
      await p.waitForFunction(()=>__refinement.state.stateSyncFailed===true);
      assert(await p.locator('#statusLamp').evaluate(e=>e.classList.contains('offline')));
      assert.match(await p.locator('#syncStatus').innerText(),/同步暂不可用.*已保存在本机/);
      assert.equal(await p.evaluate(()=>__refinement.state.active.meta.id),'practice-entry');assert.equal(await p.evaluate(()=>__refinement.state.owner),owner);
      const stateReads=()=>env.mock.requests.filter(r=>r.path==='/api/state'&&r.method==='GET').length,beforeRetry=stateReads();
      await p.evaluate(()=>window.dispatchEvent(new Event('online')));await poll(()=>stateReads()>beforeRetry,'failed state read retries through the existing reconnect');
      await p.waitForFunction(()=>!__refinement.reconnecting);assert.equal(await p.evaluate(()=>__refinement.state.stateSyncFailed),true);
      assert(await p.locator('#statusLamp').evaluate(e=>e.classList.contains('offline')));
      env.mock.failStateRead=false;const beforeRecovery=stateReads();await p.evaluate(()=>window.dispatchEvent(new Event('online')));
      await poll(()=>stateReads()>beforeRecovery,'successful state recovery reads the remote state');
      await p.waitForFunction(()=>__refinement.state.stateSyncFailed===false&&!document.getElementById('statusLamp').classList.contains('offline')&&/已同步|阅读位置已保存在本机/.test(document.getElementById('syncStatus').textContent));
      assert.equal(await p.evaluate(()=>Object.entries(__refinement.state.records).some(([key,record])=>!key.startsWith('position:')&&!key.startsWith('notes:')&&record.dirty)),false,'foreground state recovery still completes; only the scheduled position checkpoint may remain local');
      assert.equal(await p.evaluate(()=>location.hash),hash);assert.equal(await p.evaluate(()=>__refinement.state.owner),owner);
    });
    await check('cross-owner-reconnect-never-shares-reader-private-state-or-legacy-notes',async env=>{const p=await env.page(),keys=Object.keys(noteSeed()),before=await snapshotKeys(p,keys);await navigateHeading(p,'unit-8');await p.locator('#questionsButton').click();await p.locator('.reader-question-input').fill('owner A only draft');await closeSheet(p);env.mock.identity=otherOwner;await p.reload();await p.locator('#article .code-block').first().waitFor();await settled(p);assert.equal(await p.evaluate(()=>window.__refinement.state.owner),otherOwner);assert.notEqual(await currentAnchor(p),'unit-8');await p.locator('#questionsButton').click();assert.equal(await p.locator('.reader-question-input').inputValue(),'');assert.doesNotMatch(await p.locator('body').innerText(),/legacy local note|unsent other tab|different owner private note|owner A only draft/);assert.deepEqual(await snapshotKeys(p,keys),before);},{initial:noteSeed()});
    await check('actual-built-publication-content-source-knowledge-index-integrity',async()=>{
      const catalog=JSON.parse(await fs.readFile(path.join(root,'dist/library/catalog.json'),'utf8'));assert.equal(catalog.schemaVersion,2);const env=await environment(browser,{catalog,libraryRoot:path.join(root,'dist')});
      const publicShell=(await Promise.all(['index.html','app.js'].map(f=>fs.readFile(path.join(root,'dist',f),'utf8')))).join('\n');
      const absentFromPublic=(value,label)=>{assert(!publicShell.includes(value)&&!publicShell.includes(JSON.stringify(value).slice(1,-1)),label+' must remain in protected library responses');};
      try{if(catalog.state==='withdrawn'){const p=await env.page('#/read/retired/retired');assert.match(await p.locator('#chapterView').innerText(),/暂无已(?:出版|发布)章节/);assert.equal(await p.locator('#article .code-block').count(),0);return;}
        for(const chapter of catalog.collections)for(const meta of chapter.documents){const p=await env.page(`#/read/${chapter.id}/${meta.id}`),payload=JSON.parse(await fs.readFile(path.join(root,'dist',meta.url.slice(1)),'utf8'));
          absentFromPublic(payload.html,meta.id+' full chapter');
          const actual=await p.locator('#article').evaluate(e=>({headings:[...e.querySelectorAll('h2[id],h3[id],h4[id]')].map(h=>({depth:Number(h.tagName.slice(1)),id:h.id,text:h.textContent})),code:[...e.querySelectorAll('pre code')].map(x=>x.textContent),text:e.innerText}));
          assert.deepEqual(actual.headings,payload.headings);assert(await p.locator('#article a[data-knowledge]').evaluateAll(xs=>xs.every(a=>a.textContent.trim()&&!a.querySelector('p,aside,h2,h3,h4,pre,.code-block'))),'knowledge links stay within their inline label');assert.equal((payload.html.match(/<a\b/g)||[]).length,(payload.html.match(/<\/a>/g)||[]).length,'all authored links are explicitly closed');boundary.assertReaderText(actual.text,meta.id+' displayed article');assert.doesNotMatch(actual.text,/Q\d{6}/);
          const allNavigation=await p.evaluate(async facts=>{
            const errors=[],majors=facts.filter(h=>h.depth===2),stack=[],outline=facts.map((h,index)=>{
              while(stack.length&&stack.at(-1).depth>=h.depth)stack.pop();
              const item={...h,index,parent:h.depth===2?h.id:stack[0]?.id};stack.push(item);return item;
            });
            let firstNaturalGeometry=null;
            for(const h of outline){
              __refinement.runtime.showReader(null,h.id);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
              const majorIndex=majors.findIndex(x=>x.id===h.parent),current=majors[majorIndex];
              for(const[id,target]of Object.entries({previousMajor:majors[majorIndex-1],nextMajor:majors[majorIndex+1]})){
                const e=document.getElementById(id);
                if(e.disabled!==!target||e.dataset.target!==(target?.id||'')||target&&!e.getAttribute('aria-label').includes(target.text))
                  errors.push({current:h.id,control:id,expected:target?{id:target.id,title:target.text}:null,actual:e.outerHTML});
              }
              const status=document.getElementById('readingPosition'),expectedLabel=`${majorIndex+1} / ${majors.length} · ${current.text}`;
              if(status.textContent!==expectedLabel||status.title!==expectedLabel||__refinement.runtime.position?.anchor!==h.id)
                errors.push({current:h.id,control:'current-section-status',expected:{section:current.id,title:current.text,label:expectedLabel,directHeading:h.id},actual:status.outerHTML,position:__refinement.runtime.position});
              const node=document.getElementById(h.id),b=node.getBoundingClientRect(),pane=document.getElementById('readingPane').getBoundingClientRect(),tools=document.getElementById('articleTools').getBoundingClientRect();
              const firstNaturalCase=h.id===facts[0].id,safeTop=firstNaturalCase?pane.top+tools.height+12:Math.max(pane.top,tools.bottom)+12;
              const expectedClearance=firstNaturalCase?Math.min(12,parseFloat(getComputedStyle(document.getElementById('article')).paddingTop)):12;
              const hit=document.elementFromPoint(Math.min(b.right-2,Math.max(b.left+2,pane.left+pane.width/2)),Math.min(b.bottom-2,b.top+5));
              if(firstNaturalCase)firstNaturalGeometry={id:h.id,firstNaturalCase,headingTop:b.top,paneTop:pane.top,toolsTop:tools.top,toolsHeight:tools.height,toolsBottom:tools.bottom,expectedTop:safeTop,expectedClearance,actualClearance:b.top-tools.bottom,uncovered:node===hit||node.contains(hit)};
              if(Math.abs(b.top-safeTop)>=2||Math.abs(b.top-tools.bottom-expectedClearance)>=2||!(node===hit||node.contains(hit)))
                errors.push({current:h.id,control:'heading-not-obscured',firstNaturalCase,expectedTop:safeTop,actualTop:b.top,expectedClearance,actualClearance:b.top-tools.bottom,toolsBottom:tools.bottom,hit:hit?.outerHTML?.slice(0,300)});
            }
            return{headings:outline.length,neighborControls:outline.length*2,currentSectionsChecked:outline.length,errors,firstNaturalGeometry,first:__refinement.runtime.headings[0]};
          },payload.headings);
          await fs.writeFile(path.join(output,meta.id+'-all-neighbor-targets.json'),JSON.stringify(allNavigation,null,2)+'\n');
          assert.deepEqual(allNavigation.errors,[],'every actual heading has two correct H2 neighbors and a truthful current-section status');
          await navigateHeading(p,payload.headings[0].id);
          const expected=await p.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');return{code:[...d.querySelectorAll('pre code')].map(x=>x.textContent),links:[...d.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent])};},payload.html);
          assert.deepEqual(actual.code,expected.code,'every delivered code block retains its exact text');assert.deepEqual(await p.locator('#article a').evaluateAll(xs=>xs.map(a=>[a.getAttribute('href'),a.textContent])),expected.links,'all source and knowledge links remain');
          for(const viewport of[{width:402,height:874},{width:320,height:740},{width:1280,height:800},{width:874,height:402}]){await p.setViewportSize(viewport);await settled(p);const g=await geometry(p);assert(g.outer<=g.viewport+1&&g.paper<=g.width+1&&g.pane>100,JSON.stringify({viewport,g}));await p.screenshot({path:path.join(output,`current-${meta.id}-${viewport.width}x${viewport.height}.png`)});}
          await p.setViewportSize({width:402,height:874});await settled(p);
          const visualSamples=await p.evaluate(facts=>{
            const derivations=facts.filter(h=>h.text.includes('推导：')).map(h=>{
              const node=document.getElementById(h.id);let size=0;
              for(let part=node?.nextElementSibling;part;part=part.nextElementSibling){
                if(/^H[234]$/.test(part.tagName)&&Number(part.tagName.slice(1))<=h.depth)break;
                if(!part.matches('pre,.code-block'))size+=part.textContent.length;
              }
              return{...h,size};
            }).sort((a,b)=>b.size-a.size);
            return [
              ['chapter-start',facts[0]],['long-derivation',derivations[0]],
              ['long-title',[...facts].sort((a,b)=>b.text.length-a.text.length)[0]],
              ['handwritten-code',facts.find(h=>h.text.includes('Hcode：'))],
              ['standard-code',facts.find(h=>h.text.includes('Scode：'))]
            ].filter(([,h])=>h).map(([category,h])=>({category,id:h.id,title:h.text}));
          },payload.headings);
          for(const sample of visualSamples){await navigateHeading(p,sample.id);await p.screenshot({path:path.join(output,`${meta.id}-${sample.category}-402.png`)});}
          await fs.writeFile(path.join(output,meta.id+'-visual-samples.json'),JSON.stringify({viewport:{width:402,height:874},samples:visualSamples,physicalIPhone:false,visualAcceptance:'requires human review'},null,2)+'\n');
          await p.setViewportSize({width:402,height:874});await p.locator('#sectionIndexButton').click();assert.equal(await p.locator('#sheetTitle').innerText(),'目录索引');assert.deepEqual(await p.locator('#indexList [data-index-go]').evaluateAll(xs=>xs.map(x=>({id:x.dataset.indexGo,text:x.textContent}))),payload.headings.map(h=>({id:h.id,text:h.text})));assert.equal(await p.locator('#sheetBody #indexFilter,input[type="search"]').count(),0);assert.equal(await p.locator('#indexList [data-directory-section]').count(),payload.headings.filter(h=>h.depth===2).length);await closeSheet(p);
          // The files UI was deliberately removed. Verify the real protected
          // asset directly, without inventing a reader button or bypassing HTTP.
          const sourceResult=await p.evaluate(async url=>{const response=await fetch(url,{credentials:'same-origin'});return{status:response.status,text:await response.text()};},meta.sourceUrl);assert.equal(sourceResult.status,200);const shown=sourceResult.text;assert.equal(shown,await fs.readFile(path.join(root,'dist',meta.sourceUrl.slice(1)),'utf8'));absentFromPublic(shown,meta.id+' full source');boundary.assertReaderSource(shown,meta.id+' protected source');
          env.mock.identity=null;const denied=await p.evaluate(async url=>(await fetch(url,{credentials:'same-origin'})).status,meta.sourceUrl);assert.equal(denied,401,'protected source requires the owner session');env.mock.identity=owner;
          const link=p.locator('#article [data-knowledge]').first();if(await link.count()){const id=await link.getAttribute('data-knowledge'),q=catalog.questions.find(q=>q.id===id);assert(q);await link.scrollIntoViewIfNeeded();const before=await p.locator('#readingPane').evaluate(e=>e.scrollTop);await link.click();await p.locator('.knowledge-paper').waitFor();assert.equal(await p.locator('#sheetTitle').innerText(),q.title);boundary.assertReaderText(await p.locator('.knowledge-paper').innerText(),'displayed knowledge');await closeSheet(p);assert(Math.abs(await p.locator('#readingPane').evaluate(e=>e.scrollTop)-before)<2);}
          await p.close();}
        for(const q of catalog.questions){const payload=JSON.parse(await fs.readFile(path.join(root,'dist',q.url.slice(1)),'utf8'));absentFromPublic(payload.html,q.id+' full knowledge');}
        assert.deepEqual(env.mock.errors,[]);
      }catch(error){for(const[i,p]of env.context.pages().entries()){await p.screenshot({path:path.join(output,'built-publication-failure-'+i+'.png')}).catch(()=>{});await fs.writeFile(path.join(output,'built-publication-failure-'+i+'.txt'),await p.locator('body').innerText()).catch(()=>{});}throw error;}finally{await env.context.close();}
    });
  } finally {await browser.close();}
  const inputEnd = await fingerprint();
  if(JSON.stringify(inputStart)!==JSON.stringify(inputEnd)) failures.push({name:'immutable-test-inputs',error:'Reader or built publication bytes changed during regression; repeat on frozen inputs.'});
  const report={passed:failures.length===0,results,failures,gestures,targetGeometry,viewportDiagnostics,settingsGeometry,headerLogoMotion,pendingPersistence,inputStart,inputEnd,caseFilter:process.env.ALGORITHM_QA_CASE||null,browserSourceIntegration:true,builtPayloadIntegration:results.some(r=>r.name==='actual-built-publication-content-source-knowledge-index-integrity'&&r.passed),serviceWorker:'blocked; actual local HTTP worker tested separately',authentication:'mocked; system passkey not exercised',productionContacted:false,realDatabaseModified:false,paidServiceContacted:false,physicalIPhone:false,testedAt:new Date().toISOString()};
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
