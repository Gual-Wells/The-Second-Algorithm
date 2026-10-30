import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {parseQuestionRoute} from '../web/manual-questions.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'web/manual-questions.js'),'utf8'),styles=await readFile(path.join(root,'web/styles.css'),'utf8');
let browser;
before(async()=>{const temporary=path.join(root,'.local/question-ui/tmp');await mkdir(temporary,{recursive:true});process.env.TEMP=temporary;process.env.TMP=temporary;browser=await chromium.launch({headless:true,...(process.env.ALGORITHM_QA_CHROME?{executablePath:process.env.ALGORITHM_QA_CHROME}:{})});});
after(async()=>{await browser?.close();});
async function fixture(fn){const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});try{
 await context.route('**/*',route=>route.request().url()==='https://question.test/'?route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style><main id="host" style="height:740px"></main>'}):route.abort());
 const page=await context.newPage();await page.goto('https://question.test/');await page.evaluate(()=>{window.__ticks=[];window.setInterval=fn=>{__ticks.push(fn);return __ticks.length;};window.clearInterval=()=>{};window.ctx={owner:'owner-A',chapterId:'chapter-a',title:'当前章节',revision:'a'.repeat(64)};window.uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');window.turn=(n,answer='解答 '+n)=>({id:uuid(n),question:'问题 '+n,answer,status:answer?'answered':'pending',readAt:null,seq:n});});
 await page.addScriptTag({type:'module',content:source+'\nwindow.__create=createReaderQuestions;'});await page.waitForFunction(()=>window.__create);await fn(page);
 }finally{await context.close();}}

test('question notification routes accept only exact same-format private identities',()=>{
 const route='#/questions/chapter-a/'+'a'.repeat(64)+'/00000000-0000-4000-8000-000000000001';assert.equal(parseQuestionRoute(route).chapterId,'chapter-a');
 for(const value of [route+'?extra=1',route+'/tail',route.replace('chapter-a','..'),route.replace('chapter-a','%2fother'),route.replace('chapter-a','%zz'),route.replace('/questions/','/read/'),route.replace('a'.repeat(64),'b'.repeat(63))])assert.equal(parseQuestionRoute(value),null,value);
});

test('closing or hiding the question sheet stops refresh and read receipts',()=>fixture(async p=>{
 await p.evaluate(()=>{window.calls=[];window.shown=true;window.q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:async payload=>{calls.push(payload);return{turns:[turn(1)],canAsk:true};},seen:async value=>{calls.push({seen:value});return{ok:true};},isVisible:()=>shown});q.render(document.getElementById('host'));});
 await p.waitForSelector('.reader-question-turn');
 const before=await p.evaluate(()=>calls.length);await p.evaluate(async()=>{shown=false;q.close();for(const tick of __ticks)tick();await q.refresh();});assert.equal(await p.evaluate(()=>calls.length),before);
}));

test('opening unread history selects its fixed chapter, keeps the current draft and positions its unread boundary',()=>fixture(async p=>{
 await p.evaluate(()=>{
  localStorage.setItem('second-algorithm:owner-A:questions:v1:chapter-a:'+'a'.repeat(64),JSON.stringify({text:'当前章未发送草稿',pending:[]}));
  const turns=Array.from({length:20},(_,n)=>turn(n+1,'长答复段落。'.repeat(35)));window.q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:async({chapterId})=>({canAsk:true,turns:chapterId==='chapter-a'?[]:turns}),openThread:async()=>({chapterId:'chapter-b',revision:'b'.repeat(64),title:'其他章节',canAsk:true,firstUnreadQuestionId:uuid(12),threads:[{chapterId:'chapter-b',revision:'b'.repeat(64),title:'其他章节',canAsk:true,unread:1,firstUnreadQuestionId:uuid(12)}],turns})});q.render(document.getElementById('host'));
 });
 await p.waitForFunction(()=>document.querySelector('.reader-question-select').value.startsWith('chapter-b@'));
 assert.equal(await p.locator('.reader-question-input').inputValue(),'');const delta=await p.evaluate(()=>document.querySelector('.question-unread-divider').getBoundingClientRect().top-document.querySelector('.reader-question-messages').getBoundingClientRect().top);assert(Math.abs(delta)<3,delta);
 await p.locator('.reader-question-select').selectOption('chapter-a@'+'a'.repeat(64));assert.equal(await p.locator('.reader-question-input').inputValue(),'当前章未发送草稿');
}));

test('a slower old refresh cannot overwrite a newer history snapshot',()=>fixture(async p=>{
 await p.evaluate(()=>{window.reads=0;window.held=[];window.q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:()=>++reads===1?Promise.resolve({turns:[turn(1)],canAsk:true}):new Promise(resolve=>held.push(resolve))});q.render(document.getElementById('host'));});
 await p.waitForSelector('.reader-question-turn');await p.evaluate(()=>{window.first=q.refresh();window.second=q.refresh();held[1]({turns:[turn(1),turn(2)],canAsk:true});});await p.evaluate(()=>second);
 assert.equal(await p.locator('.reader-question-turn').count(),2);await p.evaluate(()=>held[0]({turns:[turn(1)],canAsk:true}));await p.evaluate(()=>first);assert.equal(await p.locator('.reader-question-turn').count(),2);
}));

test('a late reply above the viewport preserves the visible message anchor and an edited next draft',()=>fixture(async p=>{
 await p.evaluate(()=>{window.turns=Array.from({length:20},(_,n)=>turn(n+1,n?'完整解释。'.repeat(45):''));window.q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:async()=>({turns:structuredClone(turns),canAsk:true})});q.render(document.getElementById('host'));});await p.waitForSelector('.reader-question-turn:nth-of-type(20)');
 await p.locator('.reader-question-input').fill('正在编写的下一问');
 const before=await p.evaluate(()=>{const list=document.querySelector('.reader-question-messages'),node=document.querySelector('[data-question-id="'+uuid(12)+'"]');list.scrollTop+=node.getBoundingClientRect().top-list.getBoundingClientRect().top+80;const first=[...list.querySelectorAll('[data-message-id]')].find(item=>item.getBoundingClientRect().bottom>list.getBoundingClientRect().top);return{id:first.dataset.messageId,offset:first.getBoundingClientRect().top-list.getBoundingClientRect().top,top:list.scrollTop};});
 await p.evaluate(async()=>{turns[0].answer='新增的很长解释。'.repeat(150);turns[0].status='answered';await q.refresh();});
 const after=await p.evaluate(id=>{const list=document.querySelector('.reader-question-messages'),first=[...list.querySelectorAll('[data-message-id]')].find(item=>item.dataset.messageId===id);return{offset:first.getBoundingClientRect().top-list.getBoundingClientRect().top,top:list.scrollTop};},before.id);
 assert(Math.abs(after.offset-before.offset)<3);assert(after.top>before.top);assert.equal(await p.locator('.reader-question-input').inputValue(),'正在编写的下一问');
}));

test('a precise notification focuses its question; archived history cannot send and temporary failures do not label retirement',()=>fixture(async p=>{
 await p.evaluate(()=>{window.requested=null;window.q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:async()=>({turns:[],canAsk:true}),openThread:async payload=>{requested=payload;return{chapterId:payload.chapterId,revision:payload.revision,title:'旧章',canAsk:false,firstUnreadQuestionId:uuid(3),threads:[],turns:Array.from({length:20},(_,n)=>turn(n+1,'历史解释。'.repeat(30)))};}});q.render(document.getElementById('host'),{context:{chapterId:'chapter-old',revision:'d'.repeat(64),title:'历史问答'},questionId:uuid(14)});});
 await p.waitForSelector('.reader-question-archive:not([hidden])');assert.equal(await p.locator('.reader-question-send').isDisabled(),true);assert.equal(await p.evaluate(()=>requested.questionId),'00000000-0000-4000-8000-000000000014');
 const delta=await p.evaluate(()=>document.querySelector('[data-question-id="'+uuid(14)+'"]').getBoundingClientRect().top-document.querySelector('.reader-question-messages').getBoundingClientRect().top);assert(Math.abs(delta)<3,delta);
 await p.evaluate(()=>{q.destroy();q=__create({getContext:()=>ctx,transport:async()=>({ok:true}),history:async()=>({turns:[],canAsk:true}),openThread:async()=>{throw Error('章节目录暂不可核对，请稍后重试');}});q.render(document.getElementById('host'));});await p.waitForFunction(()=>document.querySelector('.reader-question-status').textContent.includes('暂不可核对'));assert.equal(await p.locator('.reader-question-archive').isHidden(),true);assert.equal(await p.locator('.reader-question-send').isDisabled(),true);await p.evaluate(()=>q.refresh());assert.equal(await p.locator('.reader-question-send').isDisabled(),false);
}));

test('unknown submission IDs survive reopening, and a late receipt keeps text typed for the next question',()=>fixture(async p=>{
 await p.evaluate(()=>{window.ids=[];window.q=__create({getContext:()=>ctx,transport:async payload=>{ids.push(payload.id);throw Error('接收未确认');}});q.render(document.getElementById('host'));});await p.locator('.reader-question-input').fill('需要保留幂等编号的问题');await p.locator('.reader-question-send').click();await p.waitForFunction(()=>document.querySelector('.reader-question-status').textContent.includes('未确认'));
 await p.evaluate(()=>{q.destroy();q=__create({getContext:()=>ctx,transport:payload=>{ids.push(payload.id);return new Promise(resolve=>{window.accept=resolve;});}});q.render(document.getElementById('host'));});assert.equal(await p.locator('.reader-question-input').inputValue(),'需要保留幂等编号的问题');await p.locator('.reader-question-send').click();await p.waitForFunction(()=>window.accept);await p.locator('.reader-question-input').fill('新写的下一问');await p.evaluate(()=>accept({ok:true}));await p.waitForFunction(()=>!document.querySelector('.reader-question-send').disabled);assert.equal(await p.locator('.reader-question-input').inputValue(),'新写的下一问');assert.equal(await p.evaluate(()=>ids.length),2);assert.equal(await p.evaluate(()=>ids[0]===ids[1]),true);
}));
