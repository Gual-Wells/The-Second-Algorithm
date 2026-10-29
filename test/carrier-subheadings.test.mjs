import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureSubheadingCandidates, scanAuthorSubheadings, applySubheadingPlan, entryFingerprint,
  formatSubheadingTitle, formatSubheadingLabels, semanticSubheadingTitle } from '../tools/subheadings.mjs';
import { composeDocument, semanticSectionTitle } from '../tools/compose-chapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = path.join(ROOT, '.local/subheading-tests');
const hash = text => createHash('sha256').update(text).digest('hex');
const entry = (id,prefix) => ({id,prefix,levels:id==='practice'?[3]:[3,4],purpose:'Specific reader purpose',boundary:'Actual scope',aliases:[],examples:[]});
async function fixture(crlf = false) {
  await fs.mkdir(PARENT,{recursive:true});
  const root=await fs.mkdtemp(path.join(PARENT,'case-'));
  for(const dir of ['content/unit','catalog','carrier','tools','work/candidates'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['compose-chapter.mjs','subheadings.mjs'])await fs.copyFile(path.join(ROOT,'tools',name),path.join(root,'tools',name));
  const descriptor={id:'lesson',title:'Methods',path:'content/unit/chapter',composition:'content/unit/chapter.authoring.json'};
  const composition={schemaVersion:1,title:'Methods',sourceFiles:['content/unit/author.source.md'],codeSources:['content/unit/author.cpp'],
    prelude:{source:'content/unit/author.source.md',anchor:'prelude'},sections:[{id:'one',source:'content/unit/author.source.md',anchor:'one'}]};
  let source='# Internal source\n\n<a id="prelude"></a>\n## Basic mechanism\n\n<a id="meaning"></a>\n### Independent idea\n\nExplain the idea.\n\n'
    +'<a id="one"></a>\n## First type\n\n<a id="hand"></a>\n### First independent implementation\n\n{{core}}\n\n{{manual}}\n\n'
    +'<a id="library"></a>\n### Second independent implementation\n\n{{standard}}\n\n'
    +'<a id="exercises"></a>\n### Boundary exercises\n\n[Exercise](https://example.com/problem)\n';
  if(crlf)source=source.replaceAll('\n','\r\n');
  const code='// BEGIN core\nint helper(int x){return x;}\n// END core\n'
    +'// BEGIN manual\nint manual_value(int x){return helper(x);}\n// END manual\n'
    +'// BEGIN standard\nint library_value(int x){return helper(x);}\n// END standard\n';
  const registry={schemaVersion:1,entries:[entry('idea','概念'),entry('hcode','Hcode'),entry('scode','Scode'),entry('practice','练习')]};
  const learning={schemaVersion:2,tasks:[{document:'lesson',methods:[{implementations:[
    {id:'manual-one',kind:'manual',symbol:'manual_value',regions:['manual','core']},
    {id:'library-one',kind:'standard',symbol:'library_value',regions:['standard','core']}]}]}]};
  const saveJson=(relative,value)=>fs.writeFile(path.join(root,relative),JSON.stringify(value,null,2)+'\n');
  await fs.writeFile(path.join(root,composition.sourceFiles[0]),source);
  await fs.writeFile(path.join(root,composition.codeSources[0]),code);
  await saveJson(descriptor.composition,composition);
  await saveJson('carrier/publications.json',{schemaVersion:2,collections:[{documents:[descriptor]}]});
  await saveJson('catalog/learning.json',learning);
  await saveJson('catalog/subheadings.json',registry);
  const receipt=await captureSubheadingCandidates(root,descriptor.composition,'work/candidates/first.json');
  const plan={schemaVersion:1,document:'lesson',candidateSnapshot:{path:receipt.path,sha256:receipt.sha256},
    registryEntries:Object.fromEntries(registry.entries.map(item=>[item.id,entryFingerprint(item)])),
    decisions:[{id:'meaning',typeId:'idea',subject:'A shared concept',depth:3,action:'reuse',reason:'The existing purpose matches this explanation',implementationIds:[]},
      {id:'hand',typeId:'hcode',subject:'Construct the operation',depth:3,action:'reuse',reason:'Manual core',implementationIds:['manual-one']},
      {id:'library',typeId:'scode',subject:'Use the prepared core',depth:3,action:'reuse',reason:'Engineering use with a shared helper',implementationIds:['library-one']},
      {id:'exercises',typeId:'practice',subject:'Check boundary decisions',depth:3,action:'reuse',reason:'An independent group for this problem type exercises',implementationIds:[]}]};
  composition.subheadings='content/unit/chapter.subheadings.json';
  const save=async()=>{await saveJson(descriptor.composition,composition);await saveJson(composition.subheadings,plan);await saveJson('catalog/subheadings.json',registry);await saveJson('catalog/learning.json',learning);};
  await save();
  const apply=()=>applySubheadingPlan(root,descriptor,composition,new Map([[composition.sourceFiles[0],source]]),new Map([[composition.codeSources[0],code]]));
  return {root,source,code,registry,plan,composition,descriptor,learning,receipt,save,saveJson,apply,
    setSource:async text=>{source=text;await fs.writeFile(path.join(root,composition.sourceFiles[0]),text);}};
}
async function dispose(root){const p=path.relative(PARENT,root);assert(p&&!p.startsWith('..')&&!path.isAbsolute(p));await fs.rm(root,{recursive:true,force:true});}
async function refreshCandidates(f,name){
  const receipt=await captureSubheadingCandidates(f.root,f.descriptor.composition,'work/candidates/'+name+'.json');
  f.plan.candidateSnapshot={path:receipt.path,sha256:receipt.sha256};await f.save();
}

test('independent candidate capture never reads the registry and cannot overwrite a snapshot',async()=>{
  const f=await fixture();try{
    await fs.unlink(path.join(f.root,'catalog/subheadings.json'));
    const result=await captureSubheadingCandidates(f.root,f.descriptor.composition,'work/candidates/no-registry.json');
    assert.equal(result.registryRead,false);assert.equal(result.headings,4);
    const saved=JSON.parse(await fs.readFile(path.join(f.root,result.path),'utf8'));
    assert.deepEqual(saved.headings.map(h=>h.text),['Independent idea','First independent implementation','Second independent implementation','Boundary exercises']);
    await assert.rejects(captureSubheadingCandidates(f.root,f.descriptor.composition,result.path),/EEXIST/);
  }finally{await dispose(f.root);}
});

test('coordination projects canonical prefixes and subjects without changing candidate source, CRLF or C++ bytes',async()=>{
  const f=await fixture(true);try{
    f.plan.decisions.reverse();await f.save();
    const result=await f.apply();
    const projected=result.sources.get(f.composition.sourceFiles[0]);
    assert.equal(projected,f.source.replace('### Independent idea','### （1）概念：A shared concept')
      .replace('### First independent implementation','### （1）Hcode：Construct the operation')
      .replace('### Second independent implementation','### （2）Scode：Use the prepared core')
      .replace('### Boundary exercises','### （3）练习：Check boundary decisions'));
    assert.equal(await fs.readFile(path.join(f.root,f.composition.sourceFiles[0]),'utf8'),f.source);
    const composed=await composeDocument(f.root,f.descriptor);
    assert.equal(composed.source,f.code);assert.match(composed.draft,/### （1）Hcode：Construct the operation\r\n/);
    assert(!Object.hasOwn(composed.dependencies,'catalog/subheadings.json'));
    for(const file of [f.composition.subheadings,f.receipt.path,'tools/subheadings.mjs'])assert.equal(composed.dependencies[file],hash(await fs.readFile(path.join(f.root,file))));
  }finally{await dispose(f.root);}
});

test('shared labels follow real depth and reset H3 at H2 and H4 at H3',()=>{
  const input=[{depth:1,text:'Book'},{depth:2,text:'PRE、First'},
    {depth:3,text:'推导、Mechanism'},{depth:3,text:'Hcode、Main operation'},
    {depth:4,text:'Hcode、Nested operation'},{depth:4,text:'工程、Nested condition'},
    {depth:3,text:'变型、Changed condition'},{depth:4,text:'Scode、Nested facility'},
    {depth:2,text:'一、Second'},{depth:3,text:'Hcode、Another main operation'},
    {depth:4,text:'Scode、Another facility'}].map((heading,index)=>({...heading,id:'stable-'+index}));
  const before=structuredClone(input),output=formatSubheadingLabels(input);
  assert.deepEqual(output.map(h=>h.text),['Book','PRE、First','（1）推导：Mechanism',
    '（2）Hcode：Main operation','（a）Hcode：Nested operation','（b）工程：Nested condition',
    '（3）变型：Changed condition','（a）Scode：Nested facility','一、Second',
    '（1）Hcode：Another main operation','（a）Scode：Another facility']);
  assert.deepEqual(input,before);assert.deepEqual(output.map(h=>h.id),input.map(h=>h.id));
  assert.deepEqual(formatSubheadingLabels(output),output,'canonical labels are idempotent');
  assert.throws(()=>formatSubheadingLabels([{depth:2,text:'One'},{depth:3,text:'推导、Parent'},
    {depth:2,text:'Two'},{depth:4,text:'Hcode、Orphan'}]),/preceding H3 parent/);
  assert.throws(()=>formatSubheadingLabels([{depth:3,text:'推导、Orphan'}]),/preceding H2/);
});

test('H4 ordinals cross z without a count cap and invalid ordinals are rejected',()=>{
  for(const [ordinal,label] of [[1,'a'],[26,'z'],[27,'aa'],[52,'az'],[53,'ba']])
    assert.equal(formatSubheadingTitle({depth:4,ordinal,prefix:'Hcode',subject:'Operation'}),
      '（'+label+'）Hcode：Operation');
  for(const ordinal of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])
    assert.throws(()=>formatSubheadingTitle({depth:4,ordinal,prefix:'Hcode',subject:'Operation'}),/Invalid managed/);
});

test('new labels preserve every current chapter generated id and all nonheading content and code',async()=>{
  const publications=JSON.parse(await fs.readFile(path.join(ROOT,'carrier/publications.json'),'utf8'));
  const descriptor=publications.collections.flatMap(c=>c.documents).find(d=>d.id==='binary-search');
  const base=path.join(ROOT,descriptor.path),manifest=JSON.parse(await fs.readFile(path.join(path.dirname(base),'build/chapter.json'),'utf8'));
  const labels=formatSubheadingLabels(manifest.headings),ids=new Set();
  const projected=labels.map(heading=>{
    const semantic=heading.depth===2?semanticSectionTitle(heading.text):semanticSubheadingTitle(heading.text,heading.depth);
    const base=semantic.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
    let id=base,n=2;while(ids.has(id))id=base+'-'+n++;ids.add(id);
    return {depth:heading.depth,id};
  });
  assert.deepEqual(projected,manifest.headings.map(({depth,id})=>({depth,id})));
  const composed=await composeDocument(ROOT,descriptor);
  const before=await fs.readFile(base+'.source.md','utf8');
  const withoutHeadingLines=text=>text.replace(/^ {0,3}#{2,4}[ \t]+[^\r\n]*(?=\r?\n|\r|$)/gm,'');
  assert.equal(withoutHeadingLines(composed.draft),withoutHeadingLines(before));
  assert.equal(composed.source,await fs.readFile(base+'.cpp','utf8'));
  assert.deepEqual(scanAuthorSubheadings(composed.draft,'generated').headings.map(h=>h.text),
    labels.filter(h=>[3,4].includes(h.depth)).map(h=>h.text));
});

test('the real reader builder publishes numbered H3 and H4 labels with their original semantic ids',async()=>{
  const f=await fixture();try{
    for(const name of ['build_handbook.mjs','knowledge.mjs','reader-boundary.mjs'])
      await fs.copyFile(path.join(ROOT,'tools',name),path.join(f.root,'tools',name));
    f.learning.questions=[];f.learning.targets=[];
    f.plan.decisions.find(d=>d.id==='library').depth=4;await f.save();
    execFileSync(process.execPath,[path.join(f.root,'tools/build_handbook.mjs'),
      path.join(f.root,'content/unit'),'chapter'],{encoding:'utf8',windowsHide:true});
    const manifest=JSON.parse(await fs.readFile(path.join(f.root,'content/unit/build/chapter.json'),'utf8'));
    assert.deepEqual(manifest.headings.filter(h=>[3,4].includes(h.depth)),[
      {depth:3,id:'概念-a-shared-concept',text:'（1）概念：A shared concept'},
      {depth:3,id:'hcode-construct-the-operation',text:'（1）Hcode：Construct the operation'},
      {depth:4,id:'scode-use-the-prepared-core',text:'（a）Scode：Use the prepared core'},
      {depth:3,id:'练习-check-boundary-decisions',text:'（2）练习：Check boundary decisions'}]);
    const html=await fs.readFile(path.join(f.root,'content/unit/chapter.html'),'utf8');
    for(const h of manifest.headings.filter(h=>[3,4].includes(h.depth))){
      assert(html.includes(`<h${h.depth} id="${h.id}">${h.text}</h${h.depth}>`));
      assert(html.includes(`href="#${h.id}">${h.text}</a>`));
    }
    assert.equal(await fs.readFile(path.join(f.root,f.composition.sourceFiles[0]),'utf8'),f.source);
    assert.equal(await fs.readFile(path.join(f.root,'content/unit/chapter.cpp'),'utf8'),f.code);
  }finally{await dispose(f.root);}
});

test('unused registry additions do not change used pins, output or author dependency identity',async()=>{
  const f=await fixture();try{
    const before=await composeDocument(f.root,f.descriptor);
    for (const invalid of [undefined, null, 7]) {
      const bad = entry(invalid, 'Malformed identity');
      f.registry.entries.push(bad); await f.save();
      await assert.rejects(f.apply(), /Invalid\/duplicate subheading registry entry/);
      f.registry.entries.pop();
    }
    await f.save();
    f.registry.entries.push(entry('unused','新增职责'));await f.save();
    const after=await composeDocument(f.root,f.descriptor);assert.deepEqual(after,before);
    f.registry.entries[0].purpose='Changed actual guidance';await f.save();
    await assert.rejects(f.apply(),/Used subheading registry entry changed/);
  }finally{await dispose(f.root);}
});

test('missing decisions, changed candidates and metadata-only role tags cannot pass',async()=>{
  const f=await fixture();try{
    const original=structuredClone(f.plan);
    f.plan.decisions.pop();await f.save();await assert.rejects(f.apply(),/Every author H3\/H4/);
    Object.assign(f.plan,structuredClone(original));f.plan.decisions[1].typeId='scode';delete f.plan.registryEntries.hcode;await f.save();await assert.rejects(f.apply(),/wrong Hcode\/Scode direction/);
    Object.assign(f.plan,structuredClone(original));f.plan.decisions[1].implementationIds=['library-one'];f.plan.decisions[2].implementationIds=['manual-one'];await f.save();await assert.rejects(f.apply(),/wrong Hcode\/Scode direction/);
    Object.assign(f.plan,structuredClone(original));await f.save();await f.setSource(f.source.replace('Independent idea','A changed independent candidate'));
    await assert.rejects(f.apply(),/Independent candidate headings differ/);
  }finally{await dispose(f.root);}
});

test('shared code permits multiple registered implementations without duplicate printed regions',async()=>{
  const f=await fixture();try{
    const result=await f.apply();
    assert.deepEqual(result.headings.find(h=>h.id==='hand').regions,['core','manual']);
    assert.deepEqual(result.headings.find(h=>h.id==='library').regions,['standard']);
    f.plan.decisions[2].implementationIds=[];await f.save();await assert.rejects(f.apply(),/Every registered implementation/);
  }finally{await dispose(f.root);}
});

test('alternate algorithms choose implementation direction explicitly and H4 requires a real H3 parent',async()=>{
  const f=await fixture();try{
    f.learning.tasks[0].methods[0].implementations[1].kind='alternative';f.plan.decisions[2].typeId='hcode';delete f.plan.registryEntries.scode;await f.save();
    await assert.doesNotReject(f.apply());
    f.plan.decisions[1].depth=4;await f.save();await assert.rejects(f.apply(),/preceding H3 parent/);
  }finally{await dispose(f.root);}
});

test('a code-free implementation discussion must explicitly link to a real shared implementation without cycles',async()=>{
  const f=await fixture();try{
    // The same standard implementation is attached to its real code owner;
    // an additional discussion reuses it rather than reprinting it.
    const text=f.source+'\n<a id="reuse"></a>\n### Discuss the existing implementation\n\n[Read the shared implementation](#library)\n';
    await f.setSource(text);
    const receipt=await captureSubheadingCandidates(f.root,f.descriptor.composition,'work/candidates/reuse.json');
    f.plan.candidateSnapshot={path:receipt.path,sha256:receipt.sha256};
    f.plan.decisions.push({id:'reuse',typeId:'scode',subject:'Reuse the same implementation',depth:3,action:'reuse',reason:'The core is shared',implementationIds:[],reuses:['library']});await f.save();
    await assert.doesNotReject(f.apply());
    f.plan.decisions.at(-1).reuses=[];await f.save();await assert.rejects(f.apply(),/canonical code or explicit/);
    f.plan.decisions.at(-1).reuses=['missing'];await f.save();await assert.rejects(f.apply(),/actual reader link|not an Hcode/);
    f.plan.decisions.at(-1).reuses=['reuse'];await f.save();await f.setSource(text.replace('](#library)','](#reuse)'));
    await assert.rejects(f.apply(),/cycle/);
  }finally{await dispose(f.root);}
});

test('real unmanaged H3/H4, H5/H6 and raw HTML headings cannot bypass the registry; examples stay literal',async()=>{
  const source='# file\n<a id="one"></a>\n## Type\n<a id="local"></a>\n### Natural candidate\n';
  for(const suffix of ['\n##### Deep heading\n','\n###### Deep heading\n','\n<h3>HTML heading</h3>\n','\n<h4>HTML heading</h4>\n'])
    assert.throws(()=>scanAuthorSubheadings(source+suffix,'content/unit/one.source.md'),/only H3|not raw HTML/);
  assert.doesNotThrow(()=>scanAuthorSubheadings(source+'\n```md\n##### Literal\n<h3>Literal</h3>\n```\n\n<!-- <h3>comment example</h3> -->\n','content/unit/one.source.md'));
  const f=await fixture();try{
    delete f.composition.subheadings;await f.saveJson(f.descriptor.composition,f.composition);
    await assert.rejects(composeDocument(f.root,f.descriptor),/requires a chapter subheading coordination plan/);
  }finally{await dispose(f.root);}
});

test('every formal owner needs a registered practice group rather than practice-looking text',async()=>{
  const f=await fixture();try{
    f.plan.decisions.at(-1).typeId='idea';delete f.plan.registryEntries.practice;await f.save();
    await assert.rejects(f.apply(),/requires an independent H3 practice learning unit: one/);
    f.plan.decisions.pop();await f.setSource(f.source.replace(/\n<a id="exercises"><\/a>[\s\S]*$/,''));
    await refreshCandidates(f,'without-practice');
    await assert.rejects(f.apply(),/requires an independent H3 practice learning unit: one/);
  }finally{await dispose(f.root);}
});

test('practice groups remain H3 even if the registry is mistakenly loosened to permit H4',async()=>{
  const f=await fixture();try{
    const practice=f.registry.entries.find(item=>item.id==='practice');practice.levels=[3,4];
    f.plan.registryEntries.practice=entryFingerprint(practice);f.plan.decisions.at(-1).depth=4;await f.save();
    await assert.rejects(f.apply(),/Practice learning units must be independent H3/);
  }finally{await dispose(f.root);}
});

test('links in an implementation or the following formal section cannot supply an empty practice group',async()=>{
  const f=await fixture();try{
    const link='[Exercise](https://example.com/problem)';
    const empty=f.source.replace(link,'');
    await f.setSource(empty.replace('{{standard}}','{{standard}}\n\n'+link));
    await assert.rejects(f.apply(),/1 to 5 actual external exercise links: one/);
    await f.setSource(empty+'\n<a id="next"></a>\n## Another type\n\n'+link+'\n');
    await assert.rejects(f.apply(),/1 to 5 actual external exercise links: one/);
  }finally{await dispose(f.root);}
});

test('code examples, comments, link definitions and local links do not fabricate external exercises',async()=>{
  const f=await fixture();try{
    const link='[Exercise](https://example.com/problem)';
    for(const fake of ['练习：这里共有一道题。',
      '```md\n'+link+'\n```', '`'+link+'`', '<!-- '+link+' -->',
      '[unused]: https://example.com/problem', '[Back to the method](#hand)', '[Mail](mailto:example@example.com)']){
      await f.setSource(f.source.replace(link,fake));
      await assert.rejects(f.apply(),/1 to 5 actual external exercise links: one/);
    }
  }finally{await dispose(f.root);}
});

test('each formal practice range accepts one to five rendered links and rejects a sixth',async()=>{
  const f=await fixture();try{
    const link='[Exercise](https://example.com/problem)';
    const links=Array.from({length:5},(_,i)=>'- [Problem '+i+'](https://example.com/problem/'+i+')').join('\n');
    await f.setSource(f.source.replace('Explain the idea.','Explain the idea.\n\n[problem-ref]: https://example.com/problem')
      .replace(link,'[Exercise][problem-ref]'));
    await assert.doesNotReject(f.apply());
    await f.setSource(f.source.replace(link,links+'\n\n[Return to the implementation](#hand)'));
    await assert.doesNotReject(f.apply());
    await f.setSource(f.source.replace(link,links+'\n- [One more](https://example.com/problem/5)'));
    await assert.rejects(f.apply(),/1 to 5 actual external exercise links: one/);
  }finally{await dispose(f.root);}
});
