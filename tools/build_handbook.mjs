import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT=path.resolve(process.argv[2] || 'content/binary-search');
const NAME=process.argv[3] || '二分查找';
const SERIES=process.argv[4] || '求职算法总册';
const TOC=SERIES === '求职C++实战总册' ? '问题与机制目录' : '题型目录';
const source=await fs.readFile(path.join(ROOT,NAME+'.cpp'),'utf8');
const draft=await fs.readFile(path.join(ROOT,NAME+'.source.md'),'utf8');
const blocks=new Map();
for(const m of source.matchAll(/\/\/ BEGIN ([\w-]+)\r?\n([\s\S]*?)\/\/ END \1/g))blocks.set(m[1],m[2].trim());
let used=[];
const md=draft.replace(/\{\{(?:(?:code|code-block):)?([\w-]+)\}\}/g,(_,name)=>{
  if(!blocks.has(name))throw new Error('Missing code '+name);
  used.push(name);return '```cpp\n'+blocks.get(name)+'\n```';
});
if(md.includes('{{'))throw new Error('Unresolved marker');
if(used.length!==blocks.size)throw new Error('Some code is not in the document');
await fs.writeFile(path.join(ROOT,NAME+'.md'),md,'utf8');

const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function highlight(s){
  const pattern=/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|else|while|for|return|const|auto|using|namespace|template|class|int|long|double|bool|void|true|false)\b|\b\d+(?:\.\d+)?(?:LL)?\b/g;
  let out='',start=0;
  for(const m of s.matchAll(pattern)){
    out+=esc(s.slice(start,m.index));
    const t=m[0];
    const cls=t.startsWith('//')||t.startsWith('/*')?'comment':/^['"]/.test(t)?'string':/^\d/.test(t)?'number':/^(int|long|double|bool|void)$/.test(t)?'type':'keyword';
    out+='<span class="'+cls+'">'+esc(t)+'</span>';start=m.index+t.length;
  }
  return out+esc(s.slice(start));
}
const headings=[];
const renderer=new marked.Renderer();
const ids=new Set();
const decodeText=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[key]);
renderer.heading=function({tokens,depth}){
  const content=this.parser.parseInline(tokens);
  const text=decodeText(content.replace(/<[^>]+>/g,''));
  const base=text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
  let id=base,i=2;while(ids.has(id))id=base+'-'+i++;
  ids.add(id);headings.push({depth,id,text});
  return `<h${depth} id="${id}">${content}</h${depth}>\n`;
};
renderer.code=function({text,lang}){
  return '<pre'+(lang==='cpp'?' class="cpp"':'')+'><code>'+(lang==='cpp'?highlight(text):esc(text))+'</code></pre>\n';
};
renderer.link=function({href,title,tokens}){
  return '<a href="'+esc(href)+'"'+(/^https?:/.test(href)?' target="_blank" rel="noopener noreferrer"':'')+(title?' title="'+esc(title)+'"':'')+'>'+this.parser.parseInline(tokens)+'</a>';
};
let body=marked.parse(md,{renderer,gfm:true});
body=body.replace(/<table>/g,'<div class="table-wrap"><table>').replace(/<\/table>/g,'</table></div>');
body=body.replace(/<p>(求职(?:算法总册 · 题型与 C\+\+ 模板|C\+\+实战总册[^<]*))<\/p>/,'<p class="subtitle">$1</p>');
let nav='';
for(const h of headings.filter(h=>h.depth===2||h.depth===3)){
  nav+='<a class="'+(h.depth===2?'group':'topic')+'" href="#'+h.id+'">'+esc(h.text)+'</a>';
}
const css=`
:root{color-scheme:light;--ink:#202b34;--heading:#193b51;--blue:#1e5b80;--line:#d9e1e7;--paper:#fff;--back:#f2f5f7}
*{box-sizing:border-box}html{scroll-padding-top:85px}body{margin:0;background:var(--back);font-family:'Noto Sans SC','Microsoft YaHei','Segoe UI',sans-serif;font-size:17px;line-height:1.78;color:var(--ink);font-weight:400}
a{color:var(--blue);text-underline-offset:3px;text-decoration-thickness:1px}a:hover{color:#0a3b5c;text-decoration-thickness:2px}
.topbar{height:61px;background:#fafcfd;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:0 max(24px,calc((100vw - 1230px)/2));gap:24px}
.brand{font-size:16px;font-weight:600;color:var(--heading);white-space:nowrap}.brand span{font-weight:400;color:#5b6975;margin-left:17px;font-size:14px}.files{display:flex;gap:22px;font-size:14px;white-space:nowrap}.files a{text-decoration:none}
.layout{max-width:1230px;margin:0 auto;display:grid;grid-template-columns:240px minmax(0,1fr);gap:28px;padding:28px 24px 65px}
.sidebar{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 110px);overflow:auto;padding:2px 11px 24px 0;scrollbar-width:thin}
.toc-title{font-size:13px;color:#526474;letter-spacing:.08em;margin:0 0 13px 10px;font-weight:600}
.toc a{display:block;line-height:1.6;text-decoration:none;border-left:2px solid transparent;border-radius:0 3px 3px 0;padding:5px 8px 5px 11px;color:#445766;font-size:13px}
.toc a.group{font-weight:600;color:#203f55;font-size:14px;margin-top:15px}.toc a.group:first-child{margin-top:0}.toc a.topic{padding-left:20px}.toc a:hover{background:#e5edf3}.toc a.active{color:#104d77;background:#e2ecf3;border-left-color:#2b688e;font-weight:600}
main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:36px 42px 42px;box-shadow:0 2px 7px #1f405006}
h1,h2,h3,h4{color:var(--heading);line-height:1.45;font-weight:600;scroll-margin-top:85px}h1{font-size:32px;margin:0 0 8px}h2{font-size:25px;margin:48px 0 21px;padding-top:30px;border-top:1px solid var(--line)}h2:first-of-type{margin-top:30px;padding-top:0;border-top:0}h3{font-size:20px;margin:34px 0 13px}h4{font-size:17px;margin:25px 0 12px;color:#253f52}
p{margin:13px 0 17px}.subtitle{font-size:14px;color:#526878;margin:0 0 24px}strong{font-weight:600}li{margin:5px 0}main p,main li,main h2,main h3,main h4{overflow-wrap:anywhere}
code{font-family:Consolas,'Cascadia Code','Noto Sans SC',monospace;font-size:.89em;color:#213f55;background:#eef3f6;padding:1px 4px;border-radius:3px}
pre{background:#f6f8fa;border:1px solid #d9e2e8;border-radius:3px;padding:16px 18px;margin:17px 0 21px;overflow-x:auto;tab-size:4;font-family:Consolas,'Cascadia Code','Noto Sans SC',monospace;font-size:15px;line-height:1.6;color:#172d3c}
pre code{font:inherit;color:inherit;background:transparent;padding:0;border-radius:0;white-space:pre}.keyword{color:#135aa0;font-weight:500}.type{color:#255d61}.comment{color:#526776}.number{color:#884920}.string{color:#8b3d21}
.table-wrap{overflow-x:auto;margin:18px 0 24px}table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.65}th,td{border:1px solid #cfdae2;padding:10px 12px;vertical-align:top;text-align:left}th{background:#eef3f7;color:#28485e;font-weight:600}tr:nth-child(even) td{background:#fbfcfd}td:first-child{min-width:122px}td code{font-size:.91em;background:transparent;padding:0}td p{margin:0}
.mobile-toc{display:none}.page-foot{font-size:13px;color:#526878;border-top:1px solid var(--line);padding-top:18px;margin-top:35px}
:focus-visible{outline:2px solid #397caa;outline-offset:3px}::selection{background:#cde3f3;color:#142d40}
@media(min-width:1600px){.layout{max-width:1310px;grid-template-columns:250px minmax(0,1fr);gap:36px}main{padding-left:50px;padding-right:50px}.topbar{padding-left:max(24px,calc((100vw - 1260px)/2));padding-right:max(24px,calc((100vw - 1260px)/2))}}
@media(max-width:1090px){.layout{grid-template-columns:204px minmax(0,1fr);gap:20px;padding:22px 18px}main{padding:30px 28px}.toc a{font-size:12px}.toc a.group{font-size:13px}pre{font-size:14px;padding:14px 15px}}
@media(max-width:860px){.topbar{height:55px;padding:0 17px}.brand span{display:none}.files{gap:16px;font-size:13px}.layout{display:block;padding:17px 12px 35px}.sidebar{display:none}main{padding:26px 24px;font-size:16px}.mobile-toc{display:block;margin-bottom:17px;border:1px solid var(--line);background:white;padding:10px 15px}.mobile-toc summary{color:#244a65;font-size:15px;cursor:pointer;font-weight:600}.mobile-toc nav{max-height:55vh;overflow:auto;margin-top:12px}h1{font-size:29px}h2{font-size:23px}h3{font-size:19px}table{font-size:14px}pre{font-size:13px}}
@media print{.topbar,.sidebar,.mobile-toc{display:none}.layout{display:block;max-width:none;margin:0;padding:0}main{border:0;box-shadow:none;padding:0}body{background:white;color:black;font-size:10.5pt;line-height:1.65}h1{font-size:22pt}h2{font-size:16pt}h3{font-size:13pt}h1,h2,h3,h4{break-after:avoid}pre{white-space:pre-wrap;overflow:visible;break-inside:avoid;font-size:8.5pt}pre code{white-space:pre-wrap}table{font-size:9pt}a{color:inherit}.table-wrap{overflow:visible}}
`;
const script=`
const links=[...document.querySelectorAll('.sidebar a')];
const targets=links.map(a=>document.getElementById(decodeURIComponent(a.hash.slice(1)))) .filter(Boolean);
let scheduled=false,last='';
function mark(){scheduled=false;let current=targets[0];for(const t of targets){if(t.getBoundingClientRect().top<=115)current=t;else break;}if(!current||last===current.id)return;last=current.id;for(const a of links){const active=decodeURIComponent(a.hash.slice(1))===last;a.classList.toggle('active',active);if(active){a.setAttribute('aria-current','location');const s=a.closest('.sidebar'),p=s.getBoundingClientRect(),r=a.getBoundingClientRect();if(r.top<p.top+8)s.scrollTop+=r.top-p.top-8;else if(r.bottom>p.bottom-8)s.scrollTop+=r.bottom-p.bottom+8;}else a.removeAttribute('aria-current');}}
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(mark)}},{passive:true});mark();
document.querySelectorAll('.mobile-toc a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.mobile-toc').open=false}));
`;
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(NAME)+' · '+esc(SERIES)+'</title><style>'+css+'</style></head><body><header class="topbar"><div class="brand">'+esc(SERIES)+'<span>'+esc(NAME)+'</span></div><nav class="files" aria-label="文件"><a href="'+esc(NAME)+'.md">Markdown</a><a href="'+esc(NAME)+'.cpp">C++ 源码</a></nav></header><div class="layout"><aside class="sidebar"><div class="toc-title">'+TOC+'</div><nav class="toc" aria-label="'+TOC+'">'+nav+'</nav></aside><div><details class="mobile-toc"><summary>'+TOC+'</summary><nav class="toc">'+nav+'</nav></details><main>'+body+'<footer class="page-foot">'+esc(NAME)+' · '+esc(SERIES)+'</footer></main></div></div><script>'+script+'</script></body></html>';
await fs.writeFile(path.join(ROOT,NAME+'.html'),html,'utf8');
await fs.mkdir(path.join(ROOT,'build'),{recursive:true});
const sha=s=>createHash('sha256').update(s).digest('hex');
await fs.writeFile(path.join(ROOT,'build/'+NAME+'.json'),JSON.stringify({codeBlocks:used,headings,sourceSha256:sha(draft),codeSha256:sha(source),markdownSha256:sha(md),htmlSha256:sha(html),builderSha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),markdownBytes:Buffer.byteLength(md),htmlBytes:Buffer.byteLength(html)},null,2)+'\n','utf8');
console.log(JSON.stringify({codeBlocks:used.length,sections:headings.filter(h=>h.depth===2).length,topics:headings.filter(h=>h.depth===3).length,markdownBytes:Buffer.byteLength(md)}));

