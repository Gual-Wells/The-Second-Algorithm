"""Persist the human/agent research integrations in this task, not generate a course."""
import json, sys
from pathlib import Path
R=Path(__file__).resolve().parents[2]; W=R/'work/first-chapter-20261028'; S=R/'work/jobs/first-chapter-20261028/study'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def text(x): return '; '.join(map(str,x)) if isinstance(x,list) else str(x)
stage=sys.argv[1]
if stage=='collection':
    d=load(S/'dossier.json'); entries=load(S/'ledger.json')['entries']; mats=d['materials']
    for name in ['root-materials.json','sources-extraction.json','books-extraction.json']:
        for row in load(W/name)['materials']:
            row=dict(row)
            if name=='books-extraction.json':
                row['extractionAssessment']=row['note']; row['note']='work/first-chapter-20261028/books-extraction.md'
                disposition=row['disposition']
                row['disposition']='excluded' if disposition=='contrast' else 'included'
                if disposition=='scope-review':
                    row['disposition']='pending'
                    row['reason']='CHT下包络查询的归属与内部构造需要范围复审，不以列名当已教学。'
                for k in ['conditions','variants']: row[k]=text(row[k])
            mats.append(row)
    # The independent challenge was made without seeing an author/type plan.
    for row0 in load(W/'independent-scope-challenge-materials.json')['materials']:
        row=dict(row0); url=row['url']
        sid= ('source:oi-wiki' if 'oi-wiki.org' in url else 'source:usaco' if 'usaco.org/' in url else 'source:usaco-guide' if 'usaco.guide/' in url else 'source:ac-library' if 'ac-library/' in url else 'external:kactl' if 'kactl/' in url else 'external:ioi2016' if 'ioinformatics.org/' in url else 'external:pbs-nguyen')
        if not any(e['id']==sid for e in entries): entries.append(dict(id=sid,relevance='related',reason='实际取得的补充方法与原题，身份/读取局限见独立挑战。',locator=url,readState='analyzed',materialIds=[],core=False,url=url))
        row.update(source=sid,readingAssessment=row.pop('note'),note='work/first-chapter-20261028/independent-scope-challenge.md',readState='analyzed',disposition='pending' if 'aliens' in row['id'] or 'tallbarn' in row['id'] or 'wqs' in row['id'] else 'included',reason='独立新材料反查，尚待范围复审对照；未声称整个外部原题已实现。')
        row['conditions']=text(row['conditions']);row['variants']=text(row['variants'])
        mats.append(row)
    d['materials']=mats
    d['questions']=[dict(id='parametric-recovery',status='open',core=True,reason='独立挑战指出惩罚参数的计数单调不足以精确恢复；待选择可完整教会和验证的载体。'),dict(id='cht-scope',status='open',core=True,reason='已维护下包络的二分查询与完整CHT构造/凸性如何分界，待材料反查。')]
    for e in entries:
        own=[m for m in mats if m['source']==e['id']]
        if own:
            e.update(relevance='related',readState='analyzed',materialIds=[m['id'] for m in own],reason='逐项全景判断后，已提取具体材料；读取/采用/排除界线在相应原创笔记。'+e['reason'])
    d['searches'] += [dict(id='textbook-deep',query='binary / kth / select / lower_bound / continuous / egg dropping / maintained path / CHT',source='EPI full TOC and related body; CP4 both volumes; CPH; C++ support books',result='发现缺失IP、资源消耗查询、累计逆查、树路径和复杂判定；保留原书错误及未读原题界线。',note='work/first-chapter-20261028/books-extraction.md'),dict(id='primary-contracts',query='binary feasible capacity spacing simulation graph rank average ratio and library contracts',source='LeetCode, CSES, Codility, USACO, AtCoder, Luogu; N4659',result='题目合同和方法逐族分析；端点/符号/成本并非相同。LC1102付费不可得，未采用。',note='work/first-chapter-20261028/sources-extraction.md'),dict(id='independent-new-methods',query='parallel binary search dynamic kth Fenwick boundary max_right WQS Aliens',source='actual author/library/official sources in independent report',result='补出时间PBS、值域动态分流、结构内边界及精确恢复问题；尚待复审合议。',note='work/first-chapter-20261028/independent-scope-challenge.md')]
    save(S/'dossier.json',d);save(S/'ledger.json',dict(schemaVersion=1,entries=entries))
    save(W/'collection-record.json',dict(summary='教材正文与原题/方法/标准充分提取，形成动态材料档案，核心待决保留。',notes=['work/first-chapter-20261028/'+n for n in ['books-extraction.md','sources-extraction.md','root-extraction.md','independent-scope-challenge.md']],extractionSummary='EPI/CP4/CPH按全书索引反查，原题按合同和判定机制归并；每份材料保留版本、定位、条件、变型、跨思想、候选练习及真实读取边界。独立挑战带来新的结构与参数恢复证据。',limitations='未提供商业书、付费LC1102、Kattis403等不冒称已读；教材图/OCR/官方措辞均可能错误。CHT归属和参数精确恢复暂未关闭；目录线索不充当原题全解。'))
elif stage=='synthesis':
    d=load(S/'dossier.json'); scope=load(S/'scope.json')
    groups={
      'ordered':['root-boundary','root-api','root-deficit','root-strings','root-matrix-lookup','root-cpp-contracts'],
      'structured':['root-rotated','root-paired','root-peak','root-convex'],
      'decision':['root-isqrt','root-prefix-orders','root-matching','root-eggdrop']+[m['id'] for m in d['materials'] if m['id'].startswith('web-family-') and m.get('family') in {'capacity-partition','maximin-spacing','cumulative-production','ordered-simulation','graph-threshold','prefix-activation'}]+['method-cowdance'],
      'rank':['root-pigeonhole','root-weighted']+[m['id'] for m in d['materials'] if m.get('family') in {'pair-distance-rank','matrix-rank','multiplication-rank','two-sorted-partition'}],
      'transition':[m['id'] for m in d['materials'] if m.get('family') in {'ordered-dp-frontier','weighted-predecessor'}]+['method-lis'],
      'continuous':['root-continuous']+[m['id'] for m in d['materials'] if m.get('family') in {'bounded-average','remaining-average','ratio-selection'}]+['method-average','method-sabotage'],
      'lifting':['root-lca','challenge-fenwick-structural-search','challenge-binary-lifting-source','challenge-acl-structural-search','challenge-binary-jump-guide'],
      'batch':['challenge-time-pbs-method','challenge-value-divide-method']}
    for b in scope['branches']: b['materialIds']=groups[b['id']]
    save(S/'scope.json',scope)
    sessions=[
     ('有序边界与结构排除能否用同一真值模板？',['root-boundary','root-peak','root-rotated','root-convex'],'不能。全局分区、旋转有序片段、峰值/凸形存在性分别给证书。重复可能迫使线性退化。','前置分清三种证据；正式类型保留结构变型，库前提单独核。'),
     ('各答案二分判定器是否可互换？',groups['decision'],'不能。非负分段依靠贪心领先，间距选择靠最早放置，产能可加，台数靠事件依赖，图与匹配需实际完整算法，前缀事件还要差分或命中。鸡蛋查询反转覆盖预算。','按问题本质而非一个check模板组织；每个判定都讲正确性、单调性和成本。'),
     ('秩、选择与有序状态是什么关系？',groups['rank']+groups['transition'],'隐式集合在值域计数、双数组在分割位置搜索；LIS/加权调度的二分只加速真实DP状态查询。抽屉容量异常与有序累计逆查又有不同证书。','不能把矩阵/数对/乘法表计数或两数组切分归并掉；LIS恢复与计数边界须兑现。'),
     ('连续数值问题的条件是否相同？',groups['continuous'],'异号根需连续不需全局单调；平均/比值则先代数变换，再由合法子集约束决定单调判定。非空内部删除与长度窗口不同。','分别教求某根、合法前缀最小、内部最大子段和、top-m变换选择；固定误差预算。'),
     ('结构内提升与多问二分有何独立变化？',groups['lifting']+groups['batch'],'按位函数复合不是天然搜索；LCA/频数秩/区间摘要提供可跳块证书。时间PBS重放事件，动态kth则稳定分流修改与查询并扣秩/撤销。','保留实际结构，不拿多次数组lower_bound冒充批量二分；两种离线法分节。'),
     ('独立挑战是否已把初始八分支推翻？',['challenge-aliens-official-method','challenge-tallbarn-official-method','challenge-wqs-extended-exposition'],'未推翻大领域，但暴露一维惩罚参数恢复尚未承载；数量单调并不保证精确约束最优。CHT维护与边界查询的层次也要明确。','进入范围复审，选择可整数验证的完整载体；不以太难/以后DP为由关闭。')]
    save(W/'synthesis-record.json',dict(summary='完成第一轮机制/条件/实现可行性综合，初始八分支成立但参数恢复与包络层次仍是核心待决。',notes=['work/first-chapter-20261028/'+n for n in ['first-synthesis.md','root-extraction.md','books-extraction.md','sources-extraction.md','independent-scope-challenge.md']],sessions=[dict(question=q,materialIds=ms,findings=f,implications=i) for q,ms,f,i in sessions],unresolved='惩罚参数恢复载体与CHT范围边界未关闭，须实质复审；原题演算/代码验证还未编纂。'))
else: raise SystemExit('unknown stage')
print('Packaged actual research stage:',stage)
