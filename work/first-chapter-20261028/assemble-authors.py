"""Assemble actual author metadata and research relationships. Does not accept reviews."""
import json, re, sys
from pathlib import Path
R=Path(__file__).resolve().parents[2];W=R/'work/first-chapter-20261028';S=R/'work/jobs/first-chapter-20261028/study'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
plan={t['id']:t for t in load(W/'type-plan.json')['types']}
if sys.argv[1]=='selection':
    units=[]
    def imp(id,kind,symbol,regions,qs,time,space,method): return dict(id='selection-'+id,kind=kind,symbol=symbol,regions=regions,questions=['Q1000'+str(q).zfill(2) for q in qs],complexity=dict(time=time,space=space),method=method)
    def unit(id,role,explanation,implementations):
        t=plan[id];units.append(dict(id=id,title=t['title'],anchor=id,manualAnchor=id+'-manual',standardAnchor=id+'-standard',engineeringAnchor=id+'-engineering',standardRole=dict(kind=role,explanation=explanation),implementations=implementations))
    unit('pigeonhole-domain','support','count_if替代扫描计数，共用值域边界；欠满区间为存在性变型，不冒称Floyd同算法。',[
      imp('duplicate-manual','manual','duplicate_manual',['duplicate-manual'],[2,3],'O(n log n)','O(1)','duplicate-count'),imp('duplicate-standard','standard','duplicate_standard',['duplicate-standard'],[2,3],'O(n log n)','O(1)','duplicate-count'),imp('missing-domain','alternative','missing_domain',['missing-domain'],[2],'O(n log U)','O(1)','underfilled-domain')])
    unit('weighted-inverse','algorithm','partial_sum建立64位累计，lower_bound查票号，uniform_int_distribution负责无偏整数票号。',[
      imp('ticket-manual','manual','ticket_manual',['weighted-manual'],[2],'O(n) preprocessing; O(log n) query','O(n)','cumulative-inverse'),imp('ticket-standard','standard','ticket_standard',['weighted-standard'],[1,2,10],'O(n) preprocessing; O(log n) query','O(n)','cumulative-inverse'),imp('sample','standard','sample_index',['weighted-standard'],[10],'O(log n) plus distribution cost','O(1) beyond prefix','sampling')])
    unit('matrix-rank','algorithm','upper_bound逐行计数，检查O(R log C)，与楼梯O(R+C)区别。',[
      imp('matrix-manual','manual','matrix_kth_manual',['matrix-rank-manual'],[2,3],'O((R+C) log V)','O(1)','staircase-rank'),imp('matrix-standard','standard','matrix_kth_standard',['matrix-rank-standard'],[1,2,3],'O(R log C log V)','O(1)','row-bound-rank')])
    unit('pair-distance-rank','algorithm','每左端upper_bound与双指针是两种计数组织，明确额外log。',[
      imp('pairs-manual','manual','pair_distance_manual',['pair-rank-manual'],[2,4],'O(n log n+n log V)','O(n) copied input','window-rank'),imp('pairs-standard','standard','pair_distance_standard',['pair-rank-standard'],[1,2,4],'O(n log n+n log n log V)','O(n) copied input','bound-rank')])
    unit('multiplication-rank','support','min截断解析行计数，swap选短边，共用值域搜索，无整题std函数。',[
      imp('multiply-manual','manual','multiplication_kth_manual',['multiplication-manual'],[2],'O(min(m,n) log(mn))','O(1)','analytic-rank'),imp('multiply-standard','standard','multiplication_kth_standard',['multiplication-standard'],[2],'O(min(m,n) log(mn))','O(1)','analytic-rank')])
    unit('two-sorted-partition','algorithm','merge给真实线性合并基线，不满足LC4对数合同；正文明确是不同算法。',[
      imp('two-kth','manual','two_array_kth',['two-array-manual'],[2],'O(log(min(m,n)+1))','O(1)','cross-partition'),imp('two-median','manual','two_array_median',['two-array-manual'],[2],'O(log(min(m,n)+1))','O(1)','cross-partition'),imp('two-merge','standard','two_array_merge',['two-array-standard'],[5],'O(m+n)','O(m+n)','merge-baseline')])
    unit('ordered-dp-frontier','algorithm','lower/upper替换真实tail定位，共享恢复核心；信封排序与计数DP分成实际方法。',[
      imp('lis-manual','manual','lis_manual',['lis-manual'],[2,5],'O(n log n)','O(n)','minimal-tail'),imp('lis-standard','standard','lis_standard',['lis-standard'],[1,5],'O(n log n)','O(n)','minimal-tail'),imp('envelopes','standard','envelopes_standard',['lis-standard'],[4,5],'O(n log n)','O(n)','envelope-reduction'),imp('lis-count','alternative','lis_count',['lis-count'],[2],'O(n^2)','O(n)','length-count-dp')])
    unit('weighted-predecessor','algorithm','lower/upper按不同题目端点替代前驱扫描，DP共享。',[
      imp('jobs-manual','manual','jobs_manual',['jobs-manual'],[2,4,5],'O(n log n)','O(n)','weighted-interval-dp'),imp('jobs-standard','standard','jobs_standard',['jobs-standard'],[1,2,4,5],'O(n log n)','O(n)','weighted-interval-dp')])
    unit('resource-queries','support','vector和min承载另一覆盖DP，明确非标准整题解，与组合判定二分不同求值算法。',[
      imp('eggs-search','manual','egg_moves_manual',['egg-manual'],[2,3],'O(k log n)','O(1)','inverse-coverage'),imp('eggs-dp','alternative','egg_moves_coverage',['egg-standard'],[2,5],'O(k * answer)','O(k)','coverage-dp')])
    save(W/'selection-authoring.json',dict(document='binary-selection',path='content/binary/selection',target=dict(id='chapter01-selection',kind='run',source='tests/cpp/chapter01_selection.cpp',standard='c++17',timeoutSeconds=120),units=units))
    print('Saved actual selection author metadata',len(units),'types')
elif sys.argv[1]=='assemble':
    parts=['boundary','decision','selection','advanced']; authors=[load(W/(p+'-authoring.json')) for p in parts]
    byid={u['id']:u for a in authors for u in a['units']}
    assert set(byid)==set(plan),(set(plan)-set(byid),set(byid)-set(plan))
    qfiles=['binary-library','integer-budget','predicate-capture','ordering','borrowing-vector','floating-search','priority-queue','selection-reorder','recursive-callback','random-integers','queue-deque','stable-events']
    questions=[]
    for i,name in enumerate(qfiles,1):
        qid='Q1000'+str(i).zfill(2);p=R/'content/knowledge'/f'{name}.md';body=p.read_text()
        questions.append(dict(id=qid,title=body.splitlines()[0][2:],source=p.relative_to(R).as_posix(),prerequisites={'Q100009':['Q100003'],'Q100012':['Q100005']}.get(qid,[]),sources=list(dict.fromkeys(re.findall(r'https://[^\s)<>]+',body)))))
    # Place introductions at the first substantive implementation context, not as a prelude glossary wall.
    placements={1:('boundary','ordered-boundaries'),2:('boundary','predicate-access'),3:('boundary','predicate-access'),4:('boundary','ordered-boundaries'),5:('boundary','ordered-boundaries'),6:('boundary','continuous-root'),7:('decision','ordered-simulation'),8:('decision','ratio-selection'),9:('decision','matching-threshold'),10:('selection','weighted-inverse'),11:('decision','average-transform'),12:('advanced','dynamic-range-kth')}
    for q in questions:
        marker='{{knowledge:'+q['id']+'}}'
        existing=[]
        for a in authors:
            p=R/(a['path']+'.source.md');text=p.read_text()
            if marker in text:existing.append(p)
        if existing: assert len(existing)==1; continue
        part,anchor=placements[int(q['id'][-2:])]
        p=R/'content/binary'/f'{part}.source.md';text=p.read_text();start=text.index('<a id="'+anchor+'"></a>')
        next_h2=re.search(r'\n<a id="[^"\n]+"></a>\n## ',text[start+1:]);end=start+1+next_h2.start() if next_h2 else len(text)
        position=text.find('\n练习',start,end)
        if position<0:position=end
        text=text[:position]+'\n'+marker+'\n'+text[position:];p.write_text(text,encoding='utf-8',newline='\n')
    tasks=[];units=[];allimpl=[]
    dossier=load(S/'dossier.json')
    material_map={m['id']:m for m in dossier['materials']}
    for a in authors:
        source=a['path']+'.cpp'
        for u in a['units']:
            t=plan[u['id']];methods={}
            method_info={m['id']:m for m in u.get('methods',[])}
            for original in u['implementations']:
                m=dict(original);method=m.pop('method', 'main')
                m.update(source=source,standard='c++17',target=a['target']['id'])
                methods.setdefault(method,[]).append(m);allimpl.append(m['id'])
            mechanism=material_map[t['materialIds'][0]]['mechanism']
            tasks.append(dict(id='task-'+u['id'],title=u['title'],document=a['document'],contract=t['problem']+'；'+t['variation'],sourceUrls=t['exerciseUrls'],methods=[dict(id=mid,title=method_info.get(mid,{}).get('title',mid.replace('-',' ')),invariant=method_info.get(mid,{}).get('invariant',mechanism),implementations=impls) for mid,impls in methods.items()]))
            loc=lambda anchor:[dict(document=a['document'],anchor=anchor)]
            manual=[m['id'] for m in u['implementations'] if m['kind']=='manual']
            standard=u.get('standardImplementationIds') or [m['id'] for m in u['implementations'] if m['kind']=='standard'] or [m['id'] for m in u['implementations'] if m['kind']=='alternative'] or manual
            source_text=(R/(a['path']+'.source.md')).read_text()
            # Exercise titles are taken from the actual visible authored links.
            links={url:title for title,url in re.findall(r'\[([^\]]+)\]\((https://[^)]+)\)',source_text)}
            exercises=[dict(title=links.get(url,url.rstrip('/').split('/')[-1]),url=url) for url in t['exerciseUrls']]
            units.append(dict(id=u['id'],title=u['title'],taskIds=['task-'+u['id']],locations=loc(u.get('anchor',u['id'])),dependsOn=[],facets={key:loc(u.get(field,u['id'])) for key,field in [('problem','anchor'),('fit','anchor'),('variation','anchor'),('manual','manualAnchor'),('manualExplanation','manualAnchor'),('standard','standardAnchor'),('standardExplanation','standardAnchor'),('engineering','engineeringAnchor')]},manualImplementationIds=manual,standardImplementationIds=standard,standardRole=u['standardRole'],exercises=exercises))
    assert len(allimpl)==len(set(allimpl))
    deps={'predicate-access':['ordered-boundaries'],'transformed-index':['ordered-boundaries'],'matrix-peak':['local-peak'],'string-prefix':['ordered-boundaries'],'pair-distance-rank':['matrix-rank'],'multiplication-rank':['matrix-rank'],'two-sorted-partition':['ordered-boundaries'],'ordered-dp-frontier':['ordered-boundaries'],'weighted-predecessor':['ordered-boundaries'],'resource-queries':['predicate-access'],'fenwick-rank':['weighted-inverse'],'cyclic-jump':['capacity-partition','ancestor-boundary'],'time-parallel-search':['graph-threshold'],'dynamic-range-kth':['fenwick-rank'],'marginal-penalty':['multiplication-rank','ratio-selection']}
    for u in units:u['dependsOn']=deps.get(u['id'],[])
    learning=dict(schemaVersion=2,questions=questions,tasks=tasks,targets=[a['target'] for a in authors])
    publications=dict(schemaVersion=2,state='active',collections=[dict(id='chapter-01',kind='chapter',chapterNumber=1,title='二分',visibility='published',documents=[dict(id=a['document'],title={'boundary':'边界与结构','decision':'判定与优化','selection':'选择与状态','advanced':'提升与批量'}[part],path=a['path']) for part,a in zip(parts,authors)])])
    d=load(S/'dossier.json');scope=load(S/'scope.json');handoff=load(S/'study.json')['lastHandoff']['path']
    materials=[dict(id=m['id'],kind='countercheck' if m['id'].startswith('challenge-') else 'book' if m['source'].startswith('book:') else 'primary-analysis',locator=m['locator'],evidence=m['note'],sourcePaths=[]) for m in d['materials']]
    # Actual publication-stage independent reviews supplement, not replace,
    # the frozen pre-author research evidence and its material identities.
    for name in ['boundary','decision','selection','advanced','knowledge']:
        materials.append(dict(id='edition-cross-'+name,kind='countercheck',
            locator='Independent review of current author output: '+name,
            evidence=f'work/first-chapter-20261028/cross-review-{name}.md',sourcePaths=[]))
    materials.append(dict(id='edition-independent',kind='countercheck',
        locator='Final continuous reading of the four manuscripts and research-to-publication promises',
        evidence='work/first-chapter-20261028/edition-independent-review.md',sourcePaths=[]))
    locs=[u['locations'][0] for u in units]
    promises=[]
    for id,dim,claim,acceptance,ids in [
       ('domain-coverage','breadth','代表性二分大领域的九分支与复杂交叉实际承载。','材料反查分支/题型/条件，不以同while循环归并实质差异。',list(plan)),
       ('hard-variants','difficulty','结构、资源反演、匹配、带修离线与参数恢复不留黑箱。','回读困难型实际推理、代码与独立oracle，不用题号/复杂名词冒充深度。',['matching-threshold','resource-queries','dynamic-range-kth','marginal-penalty','summary-descent']),
       ('complete-type-chain','completeness','每型兑现问题、变型、手写、真实设施、知识与研究期原题。','连续逐型阅读并核引用/代码/复杂度/失效合同；无核心未决或假一键库解。',list(plan)),
       ('reader-flow','readability','四读件仍同一章，理论在前、正式题型主目录、知识唯一浮窗。','检查目录/字体/代码与原生阅读，内部编号不外显，首次知识就近且后续不重复长讲。',list(plan))]:
        mids=list(dict.fromkeys(mid for uid in ids for mid in plan[uid]['materialIds']))
        promises.append(dict(id=id,dimension=dim,claim=claim,acceptance=acceptance,status='addressed',gap='',taskIds=['task-'+uid for uid in ids],locations=[next(u['locations'][0] for u in units if u['id']==uid) for uid in ids],materialIds=mids))
    contract=dict(schemaVersion=2,chapter='chapter-01',title='二分',researchHandoff=handoff,reader=dict(startingPoint='计算机科班基础，阅读C++常见代码，无需零基础语法课。',targetCapability='从问题条件构建可靠排除证书与检查器，选择实现并处理变型、数值和复杂度。',supportPolicy='必要C++首次就近解释，后续同一语义源浮窗复用；当前算法推理仍完整。'),scope=dict(core=scope['mechanism'],extensions='实际覆盖复杂判定、隐式秩、结构内搜索、两种离线法与离散凹参数恢复。',exclusions=[dict(topic=str(i+1),reason=x) for i,x in enumerate(scope['exclusions'])],completenessArgument=scope['completenessArgument']),materials=materials,paradigm=dict(status='addressed',name=scope['paradigm'],mechanism=scope['mechanism'],coverageArgument=scope['completenessArgument'],corpusEvidence=[m['id'] for m in materials if m['kind']=='book'],branches=[dict(id=b['id'],title=b['title'],status='addressed',materialIds=b['materialIds'],sectionIds=[t['id'] for t in scope['problemTypes'] if b['id'] in t['branchIds']],crossParadigms=list(dict.fromkeys(x for m in d['materials'] if m['id'] in b['materialIds'] for x in m.get('crossParadigms',[])))) for b in scope['branches']]),prelude=dict(status='addressed',locations=[dict(document='binary-boundary',anchor='prelude')]),reading=dict(status='addressed',gap='',entry=[dict(document='binary-boundary',anchor='prelude')],units=units,selectionMap=[dict(document='binary-advanced',anchor='selection-map')]),commitments=promises)
    save(R/'catalog/learning.json',learning);save(R/'carrier/publications.json',publications)
    save(R/'content/binary/chapter-contract.json',contract)
    save(R/'catalog/chapters.json',dict(schemaVersion=1,chapters=[dict(id='chapter-01',collection='chapter-01',contract='content/binary/chapter-contract.json',review='content/binary/chapter-review.json')]))
    print('Assembled current authors:',len(units),'types,',len(allimpl),'implementations,',len(questions),'knowledge sources. Review not accepted by this script.')
else:raise SystemExit('Use selection or assemble')
