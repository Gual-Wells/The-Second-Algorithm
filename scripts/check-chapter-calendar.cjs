// Real frontend, isolated identity/state/content. No production or paid requests.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const {createHash} = require('node:crypto'), {chromium} = require('playwright'), esbuild = require('esbuild');
const root = path.resolve(__dirname, '..'), output = path.resolve(process.env.ALGORITHM_CALENDAR_QA || path.join(root, '.local/startup-calendar-20261029/qa'));
const origin = 'http://localhost:9878', owner = 'c'.repeat(43), sha = value => createHash('sha256').update(value).digest('hex');
  const checks = [], errors = [], requests = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

(async () => {
  const temp = path.join(output, 'tmp'); await fs.mkdir(temp, {recursive:true}); process.env.TEMP = process.env.TMP = temp;
  const bodies = new Map(), catalog = {schemaVersion:2,version:'calendar-fixture',collections:[],questions:[]};
  for (const [i, id, date] of [[1,'first','2026-09-30'],[2,'second','2026-10-28'],[3,'third','2026-10-28']]) {
    const html = `<h2 id="prelude">PRE、界面核验</h2><p>${'这是一份独立自写的日历界面材料，不是正式教材。'.repeat(100)}</p><h3 id="method">（1）方法：版本与读位</h3><p>${'当前章节的阅读位置需要准确保留。'.repeat(100)}</p><div class="code-block"><pre><code>int fixture() { return ${i}; }</code></pre></div>`;
    const revision = sha(html), meta = {id:'doc-'+i,title:'章节'+i,revision,url:`/library/${id}/doc-${i}/${revision.slice(0,16)}.json`,sourceUrl:`/library/${id}/doc-${i}/source.cpp`,headings:[{depth:2,id:'prelude',text:'PRE、界面核验'},{depth:3,id:'method',text:'（1）方法：版本与读位'}],knowledgeIds:[]};
    catalog.collections.push({id,kind:'chapter',chapterNumber:i,title:'章节'+i,date,documents:[meta]});
    bodies.set(meta.url, {...meta,html});
  }
  const index = {version:catalog.version,questions:[],chapters:Object.fromEntries(catalog.collections.map(c=>[c.id,{date:c.date}])),collections:Object.fromEntries(catalog.collections.map(c=>[c.id,{[c.documents[0].id]:c.documents[0].revision}]))};
  const source = await fs.readFile(path.join(root,'web/app.js'),'utf8');
  const built = await esbuild.build({stdin:{contents:source+'\nglobalThis.__calendarQA={runtime,S};',resolveDir:path.join(root,'web'),sourcefile:'app.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,define:{__PUBLICATION_INDEX__:JSON.stringify(index)}});
  const browser = await chromium.launch({headless:true,...(process.env.ALGORITHM_QA_CHROME ? {executablePath:process.env.ALGORITHM_QA_CHROME} : {})});
  async function pageFor(scenario='normal', hash='') {
    const context = await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await context.addInitScript(()=>{ delete Navigator.prototype.serviceWorker; });
    await context.route('**/*',async route=>{
      const request = route.request(), u = new URL(request.url());
      if(u.origin!==origin) return route.abort();
      const p = u.pathname;
      if(p==='/auth/status') return route.fulfill({status:scenario==='error'?503:200,json:scenario==='error'?{error:'连接暂不可用'}:{authenticated:!['login','enroll'].includes(scenario),enrolled:scenario!=='enroll',enrollmentOpen:scenario==='enroll',ownerScope:owner}});
      if(p==='/api/library') return route.fulfill({json:scenario==='empty'?{...catalog,collections:[]}:catalog});
      if(p==='/api/state') { if(request.method()!=='GET')requests.push(request.postDataJSON());return route.fulfill({json:request.method()==='GET'?{state:{preferences:{revision:1,value:{preload:false}}}}:{revision:1,record:{revision:1,value:request.postDataJSON()?.value,updatedAt:Date.now()}}}); }
      if(p==='/app.js') return route.fulfill({body:built.outputFiles[0].text,contentType:'text/javascript'});
      if(bodies.has(p)) {requests.push({read:p});return route.fulfill({json:bodies.get(p)});}
      if(p.startsWith('/api/')||p.startsWith('/auth/'))return route.fulfill({status:404,json:{error:'Isolated fixture'}});
      try {const file=path.join(root,'web',p==='/'?'index.html':p.slice(1)),body=await fs.readFile(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/'+hash,{waitUntil:'domcontentloaded',timeout:15000});
    return {page,context};
  }
  const shot=async(page,name)=>page.screenshot({path:path.join(output,name+'.png'),scale:'css'});
  const settled=async page=>{await page.waitForFunction(()=>globalThis.__calendarQA&&!__calendarQA.runtime.state.restoring);await page.waitForTimeout(100);};
  let passed=false, failure=null;
  try {
    for(const scenario of ['login','enroll','error','empty']) {
      const {page,context}=await pageFor(scenario);
      if(scenario==='empty') {await page.locator('.empty-card').waitFor();check('empty library offers truthful chapter state',await page.locator('.empty-card').innerText().then(t=>t.includes('暂无已发布章节')));}
      else {await page.locator(`.login-card[data-state="${scenario}"]`).waitFor();check(scenario+' startup hides application tools',await page.locator('#appHeader').isHidden());}
      if(scenario==='login')check('known owner uses existing passkey',await page.locator('#loginButton').isVisible()&&await page.locator('#enrollForm').isHidden());
      if(scenario==='enroll')check('initialization is distinct from ordinary login',await page.locator('#enrollForm').isVisible()&&await page.locator('#loginButton').isHidden());
      if(scenario==='error')check('connection failure offers retry, never enrollment',await page.locator('#retryButton').isVisible()&&await page.locator('#loginButton').isHidden()&&await page.locator('#enrollForm').isHidden());
      await shot(page,'startup-'+scenario);await context.close();
    }
    const {page,context}=await pageFor('normal','#/read/third/doc-3');
    await page.locator('#article h2').waitFor();await settled(page);
    check('chapter day is visible',await page.locator('#currentDateLabel').innerText()==='2026 年 10 月 28 日');
    check('week is Monday-first and complete',await page.locator('#dayStrip .day-chip').count()===7);
    check('unpublished day cannot be opened',await page.locator('[data-calendar-day="2026-10-27"]').isDisabled());
    check('same-day chapters are both advertised',await page.locator('[data-calendar-day="2026-10-28"]').innerText().then(t=>t.includes('2章')));
    await shot(page,'reader-calendar');
    await page.locator('#previousChapter').click();await page.waitForURL('**/#/read/second/doc-2');await settled(page);
    check('chapter arrow visits another chapter on same day',await page.locator('#chapterNavSubtitle').innerText().then(t=>t.includes('第 2 章')));
    await page.locator('#nextChapter').click();await page.waitForURL('**/#/read/third/doc-3');await settled(page);
    const reads = requests.filter(r=>r.read).length;
    await page.locator('#chapterJump').click();await page.locator('#chapterBookSearch').waitFor();
    check('book is directly reachable through date',await page.locator('#sheetTitle').innerText()==='章节册');
    check('all published chapters appear once',await page.locator('#chapterBookList .library-row').count()===3);
    check('book is grouped across months',await page.locator('#chapterBookList .book-month').count()===2);
    await page.locator('#chapterBookSearch').fill('2026-09');check('chapter date search filters locally',await page.locator('#chapterBookList .library-row').count()===1);
    await page.locator('#chapterBookSearch').fill('');check('book browsing fetches no chapter bodies',requests.filter(r=>r.read).length===reads);await shot(page,'chapter-book');
    await page.evaluate(()=>{globalThis.__bookCloseCount=0;document.getElementById('sheetDialog').addEventListener('close',()=>__bookCloseCount++);});
    await page.locator('[data-book-tab="calendar"]').click();check('book tabs replace content without closing the modal',await page.evaluate(()=>__bookCloseCount===0));check('calendar day retains same-day count',await page.locator('[data-book-day="2026-10-28"]').innerText().then(t=>t.includes('2章')));
    await shot(page,'month-calendar');await page.locator('[data-book-day="2026-10-28"]').click();
    check('same-day calendar opens a chapter choice',await page.locator('#sheetBody [data-open-chapter]').count()===2);await shot(page,'same-day-choice');
    await page.locator('[data-open-chapter="second"]').click();await page.waitForURL('**/#/read/second/doc-2');await settled(page);
    check('calendar opens the real chapter directly from its beginning',await page.locator('#readerView').isVisible()&&await page.locator('#chapterView').isHidden()&&await page.locator('#readingPane').evaluate(e=>e.scrollTop===0));
    check('direct chapter opening retains heading and source-style index entry',await page.locator('#readerHead').isVisible()&&await page.locator('#sectionIndexButton').isVisible());
    await page.locator('#chapterJump').click();await page.locator('[data-book-tab="calendar"]').click();const beforeMonthCloses=await page.evaluate(()=>__bookCloseCount);await page.locator('#monthPicker').fill('2026-09');await page.locator('[data-book-day="2026-09-30"]').waitFor();
    check('changing month keeps the same modal open',await page.evaluate(()=>__bookCloseCount)===beforeMonthCloses);
    check('month picker can open older month',await page.locator('[data-book-day="2026-09-30"]').isEnabled());
    await page.locator('[data-book-day="2026-09-30"]').click();await page.waitForURL('**/#/read/first/doc-1');await settled(page);
    check('older month opens correct chapter',await page.locator('#chapterNavSubtitle').innerText().then(t=>t.includes('第 1 章')));
    await page.goto(origin+'/#/read/first/doc-1');await page.locator('#article h2').waitFor();await settled(page);
    await page.locator('#readingPane').evaluate(e=>e.scrollTop=450);await page.waitForTimeout(250);
    await page.locator('#nextChapter').click();await page.waitForURL('**/#/read/second/doc-2');await settled(page);
    await page.locator('#previousChapter').click();await page.waitForURL('**/#/read/first/doc-1');await settled(page);
    check('chapter arrows preserve the existing chapter reading position',Math.abs(await page.locator('#readingPane').evaluate(e=>e.scrollTop)-450)<2);
    await page.goto(origin+'/#/chapter/first');await page.waitForURL('**/#/read/first/doc-1');await page.locator('#article h2').waitFor();await settled(page);
    check('legacy chapter route resolves to real paper start',await page.locator('#readingPane').evaluate(e=>e.scrollTop===0)&&await page.locator('#readerHead').isVisible());
    await page.locator('#readingPane').evaluate(e=>e.scrollTop=450);await page.waitForTimeout(250);
    const before=await page.locator('#article').evaluate(e=>({width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top}));
    await page.evaluate(()=>__calendarQA.runtime.setPure(true));await settled(page);
    const after=await page.locator('#article').evaluate(e=>({width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top}));
    check('date navigation is absent and inert throughout source-style pure mode',await page.locator('#chapterNav').evaluate(e=>e.inert&&getComputedStyle(e).display==='none'));
    check('pure mode keeps paper width and absolute text coordinate',Math.abs(before.width-after.width)<1&&Math.abs(before.top-after.top)<2);
    await shot(page,'pure-calendar');await page.evaluate(()=>__calendarQA.runtime.setPure(false));await settled(page);
    await page.setViewportSize({width:320,height:740});await settled(page);check('narrow date shell does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('chapterNav').scrollWidth<=document.getElementById('chapterNav').clientWidth));await shot(page,'narrow-calendar');
    check('no browser runtime errors',errors.length===0);await context.close();passed=true;
  } catch(error) {failure=error.message;throw error;}
  finally {await browser.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify({passed,failure,checks,errors,requests:requests.length,productionContacted:false,paidServiceContacted:false,physicalIPhone:false},null,2)+'\n');}
  console.log(JSON.stringify({passed:true,checks:checks.length,errors,output}));
})().catch(error=>{console.error(error);process.exitCode=1;});
