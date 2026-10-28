"""Save the explicit integrated scope-review decisions and post-review research plan."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[2]; W=R/'work/first-chapter-20261028'; S=R/'work/jobs/first-chapter-20261028/study'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def txt(v): return '; '.join(v) if isinstance(v,list) else v
d=load(S/'dossier.json'); scope=load(S/'scope.json'); ledger=load(S/'ledger.json')
# Keep archived preliminary evidence intact, update only the dynamic current dossier.
root={m['id']:m for m in load(W/'root-materials.json')['materials']}
d['materials']=[root.get(m['id'],m) for m in d['materials']]
for r in load(W/'challenge-response-materials.json')['materials']:
    r=dict(r);r.update(source='source:atcoder',readState='analyzed',disposition='included',readingAssessment=r.pop('note'),note='work/first-chapter-20261028/challenge-response.md',reason='已独立核原题和恢复条件，并用精确整数分配模型验证。')
    r['conditions']=txt(r['conditions']);r['variants']=txt(r['variants']);d['materials'].append(r)
mats={m['id']:m for m in d['materials']}
for mid in ['challenge-aliens-official-method','challenge-tallbarn-official-method','challenge-wqs-extended-exposition']:
    mats[mid]['disposition']='included';mats[mid]['reason']='参数分支的条件/反例/范围对照；完整原题额外几何与数值系统不冒称已教。'
mats['cp4-cht-query-boundary'].update(disposition='excluded',reason='已读其下包络断点二分及维护条件，作为范围对照。当前确定性摘要机制由LIS/树结构/凸扇区等完整承载；不将完整CHT维护、所有oracle与高维对偶体系吞为本章，不声称该题或Aliens已教。')
excluded_book={'cp4-geometry-residual':'几何残差属实数单调判定同机制比较，未核原题；不将其单列新型或称已完整教学。','cp4-permutation-spacing':'已读排列加间距组合，排列枚举是另一个范式的oracle规模变化；当前间距/事件/匹配等完整代表判定保持，不将所有NP判定内部算法无界纳入。','cp4-simulation-feasibility':'教材比较实例含直接线性更优解，只作模拟单调与不强套二分的证据；完整模拟由已核CowDance承载。','cp4-precomputed-inverse':'累计表逆查已由已核累计权重/缺失计数完整承载；该题未核原题，不重复故事。','cookbook-span-borrowing':'该食谱用C++20 span；本章C++17不采用其代码，借用边界另以当前必要合同说明。'}
for mid,reason in excluded_book.items(): mats[mid].update(disposition='excluded',reason=reason)

families={f['id']:f for f in load(W/'sources-extraction.json')['families']}
types=[]
def add(id,title,part,branch,ids,urls=None,problem=None,variation=None):
    selected=[mats[x] for x in ids]
    available=list(dict.fromkeys(u for m in selected for u in m['exerciseUrls']))
    if urls is None: urls=available[:5]
    assert urls and len(urls)<=5 and all(u in available for u in urls),(id,urls,available)
    types.append(dict(id=id,title=title,part=part,branchIds=branch if isinstance(branch,list) else [branch],materialIds=ids,exerciseUrls=urls,problem=problem or selected[0]['mechanism'],variation=variation or selected[0]['variants']))
def root_type(id,title,part,branch,mid,urls=None,more=[]): add(id,title,part,branch,[mid]+more,urls)
def family_type(id,part,branch,fid,more=[],title=None):
    f=families[fid];add(id,title or f['title'],part,branch,f['materialIds']+more,[x['url'] for x in f['exerciseLinks']],f['problem'],f['variants'])
root_type('ordered-boundaries','有序数据的边界、计数与前驱','boundary','ordered','root-boundary',more=['epi-boundary-family','root-cpp-contracts'])
root_type('predicate-access','昂贵访问与未知上界的首次满足','boundary',['ordered','lifting'],'root-api',more=['epi-exponential-bracket','cp4-interactive-boundary'])
root_type('transformed-index','值与下标关系中的固定点和缺失数','boundary','ordered','root-deficit',more=['epi-fixed-point'])
root_type('rotated-search','旋转序列中的成员与最小值','boundary','structured','root-rotated',more=['epi-rotated-array'])
root_type('paired-break','有序配对结构中的唯一异常','boundary','structured','root-paired')
root_type('local-peak','任意一维局部峰与单峰边界','boundary','structured','root-peak',urls=['https://leetcode.com/problems/find-peak-element/'],more=['epi-local-extrema'])
root_type('matrix-peak','二维局部峰的存在性搜索','boundary','structured','root-peak',urls=['https://leetcode.com/problems/find-a-peak-element-ii/'])
root_type('matrix-membership','二维有序数据中的存在性查找','boundary','ordered','root-matrix-lookup',more=['epi-matrix-search'])
root_type('integer-root','不溢出的整数根与最后可行值','boundary','decision','root-isqrt',more=['epi-integer-root'])
root_type('continuous-root','连续方程的异号夹逼与误差','boundary','continuous','root-continuous',more=['epi-real-root','cp4-numerical-bisection','epi-salary-piecewise'])
root_type('string-prefix','字典序前缀与比较成本','boundary','ordered','root-strings',more=['epi-string-prefix-interval','cp4-suffix-prefix-range','cph-hash-lcp-boundary'])
root_type('convex-location','凸多边形中的扇区定位','boundary','structured','root-convex')

family_type('capacity-partition','decision','decision','capacity-partition',more=['cp4-partition-capacity'])
family_type('maximin-spacing','decision','decision','maximin-spacing')
family_type('cumulative-production','decision','decision','cumulative-production')
family_type('ordered-simulation','decision','decision','ordered-simulation',more=['method-cowdance'])
family_type('graph-threshold','decision','decision','graph-threshold',more=['cp4-graph-threshold-family'])
family_type('prefix-activation','decision','decision','prefix-activation',more=['root-prefix-orders'],title='事件前缀的首次成功与首次失败')
root_type('matching-threshold','阈值下的互斥选择与匹配','decision','decision','root-matching',more=['cp4-matching-flow-feasibility'])
f1=families['bounded-average'];f2=families['remaining-average']
add('average-transform','平均值优化中的合法区间判定','decision','continuous',f1['materialIds']+f2['materialIds']+['method-average','method-sabotage'],[x['url'] for f in [f1,f2] for x in f['exerciseLinks']],f1['problem']+'；'+f2['problem'],'合法前缀窗口与非空内部最大子段和是不同约束，必须同时讲清。')
family_type('ratio-selection','decision','continuous','ratio-selection')

root_type('pigeonhole-domain','值域容量异常：重复与缺失','selection','rank','root-pigeonhole',more=['epi-missing-ip'])
root_type('weighted-inverse','累计权重的逆查询与采样','selection','rank','root-weighted',more=['epi-weighted-inverse'])
family_type('matrix-rank','selection','rank','matrix-rank')
family_type('pair-distance-rank','selection','rank','pair-distance-rank')
family_type('multiplication-rank','selection','rank','multiplication-rank')
family_type('two-sorted-partition','selection','rank','two-sorted-partition',more=['epi-two-array-selection'])
family_type('ordered-dp-frontier','selection','transition','ordered-dp-frontier',more=['method-lis','cp4-lis-maintained-summary','cph-lis-scope-limit'])
family_type('weighted-predecessor','selection','transition','weighted-predecessor',more=['cp4-dp-transition-boundary'])
root_type('resource-queries','查询会消耗资源：反求最少试探次数','selection',['decision','transition'],'root-eggdrop',more=['cp4-egg-drop'])

add('fenwick-rank','动态频数中的第k个位置','advanced','lifting',['challenge-fenwick-structural-search','cp4-fenwick-select'])
add('summary-descent','区间摘要驱动的首次失败位置','advanced','lifting',['challenge-acl-structural-search','cph-segment-tree-descent'])
root_type('ancestor-boundary','祖先会合边界与同步提升','advanced','lifting','root-lca',more=['challenge-binary-lifting-source','cp4-dfs-path-boundary','cph-binary-lifting-contract','cph-lca-alternatives'])
add('cyclic-jump','循环正数序列的最少分段','advanced','lifting',['challenge-binary-jump-guide'],urls=['https://cses.fi/problemset/task/1191'])
add('time-parallel-search','共享时间轴判定的并行二分','advanced','batch',['challenge-time-pbs-method'])
add('dynamic-range-kth','带修改区间第k小的整体二分','advanced','batch',['challenge-value-divide-method'])
response_ids=[m['id'] for m in load(W/'challenge-response-materials.json')['materials']]
add('marginal-penalty','递减边际资源分配的惩罚参数搜索','advanced','parametric',response_ids+['challenge-aliens-official-method','challenge-tallbarn-official-method','challenge-wqs-extended-exposition'],urls=['https://atcoder.jp/contests/abc216/tasks/abc216_e'])

scope['branches'].append(dict(id='parametric',title='一维惩罚参数与精确数量恢复',status='included',reason='独立挑战暴露初始范围没有承担的机制；用整数离散凹实例完整证明oracle、计数区间与恢复。',materialIds=response_ids+['challenge-aliens-official-method','challenge-tallbarn-official-method','challenge-wqs-extended-exposition']))
scope['problemTypes']=types
scope['prelude']='建立候选集合/分区与存在性证书、首次真/最后真与闭合合同、单调性和判定正确性分开、区间不变量/终止/无解、值域/下标域/参数域、复杂度含检查成本和比较字符数、整数数值与实数误差、标准库真实职责、题型应用地图。'
scope['completenessArgument']='以全书/全池概况后独立确立的排除机制为根，材料反查覆盖有序分区、结构存在性、优化判定、隐式秩/切分、状态转移、连续夹逼、结构提升、时间/值域批量与参数精确恢复。各条件变化均有题型或本型变体；不按题号或API复制，不称全网所有可能oracle已穷尽。具体题型与分支材料关系可回查；完整CHT/高维对偶/后缀建索引等独立体系不冒称已教，当前交叉实例须实作到可理解可运行。'
scope['exclusions'] += ['完整CHT维护、任意DP oracle、所有匹配/流算法、高维对偶不是因含一个二分调用就成为本章全部主干；本章完整承载代表性匹配、状态转移、几何扇区及离散凹参数恢复。','原题只读目录/付费不可得者不作为正式练习；历史稿不继承教学覆盖。']
for b in scope['branches']:
    b['materialIds']=list(dict.fromkeys(mid for t in types if b['id'] in t['branchIds'] for mid in t['materialIds']))

# All adopted materials are synthesized; theory/support used globally is separate from type implementation.
used={x for t in types for x in t['materialIds']}
support=[m['id'] for m in d['materials'] if m['disposition']=='included' and m['id'] not in used]
d['findings']=[]
for t in types:
    selected=[mats[x] for x in t['materialIds']]
    d['findings'].append(dict(id='finding-'+t['id'],materialIds=t['materialIds'],branchIds=t['branchIds'],claim=t['title']+'：'+t['problem'],note='work/first-chapter-20261028/revised-synthesis.md',problem=t['problem'],mechanism='；'.join(dict.fromkeys(m['mechanism'] for m in selected)),conditions='；'.join(dict.fromkeys(m['conditions'] for m in selected)),variants=t['variation'],crossParadigms=list(dict.fromkeys(x for m in selected for x in m['crossParadigms'])),exerciseLinks=[dict(title=u.rstrip('/').split('/')[-1],url=u) for u in t['exerciseUrls']]))
if support:
    d['findings'].append(dict(id='finding-theory-support',materialIds=support,branchIds=['ordered','transition','lifting'],claim='理论与C++支撑作为全章证据，不把每份辅助材料误建独立题型。',note='work/first-chapter-20261028/revised-synthesis.md',problem='从目录/源码/支持材料辨析适用条件和教学边界。',mechanism='区分可靠排除、维护摘要、接口前提及实际迭代成本。',conditions='固定真实版本，不把代码观察或目录当已编译/已核题。',variants='参数、比较、边界、寿命和复杂度按情境讲解。',crossParadigms=['C++支撑','状态建模'],exerciseLinks=[]))
for q in d['questions']: q.update(status='resolved',reason='参数采用ABC216E并完整解释oracle/同值区间/凸性反例；CHT以已读范围比较明确处置，非漏核心。详见revised-synthesis与独立回应。')
for e in ledger['entries']:
    own=[m for m in d['materials'] if m['source']==e['id']]
    if own: e.update(relevance='related',readState='analyzed',materialIds=[m['id'] for m in own])
coord=dict(chapters=[],domainIndependence='复审后仍以有证书的有序单参数/半域排除统摄；参数恢复作为真实新增分支，未变成算法对象杂烩。',globalBreadth='结合全部教材与候选版图，无旧章时不做虚构距离/重合比较；按机制补缺而非围绕历史小专题切邻章。',scopeDecision='保留初始八分支并补参数恢复，结构下降和两种离线法实际细化；不省跨思想核心，也不吞并所有独立结构体系。',emptyReason='再次核有效空出版/空章登记，设施派生no-prior-chapters；不存在可比较的当前正式旧章。')
save(S/'dossier.json',d);save(S/'scope.json',scope);save(S/'ledger.json',ledger)
save(W/'type-plan.json',dict(chapter='chapter-01',paradigm='二分',types=types))
save(W/'scope-review-record.json',dict(summary='独立新材料挑战已逐项回应；复审保留二分、增加参数精确恢复并明确结构/批量/范围边界。',notes=['work/first-chapter-20261028/'+n for n in ['first-synthesis.md','revised-synthesis.md','independent-scope-challenge.md','challenge-response.md','scope-challenge-alignment.md']],decisions=[dict(branch=b['id'],action='add' if b['id']=='parametric' else 'retain',reason=b['reason']+'；具体复审与条件见revised-synthesis。',materialIds=b['materialIds']) for b in scope['branches']],challenge=dict(researcher='chapter01_independent_candidates',perspective='在未见作者题型范围前读取新的方法、原题、官方解答与库合同，挑战复杂查询/结构/惩罚恢复遗漏。',independent=True,inputMaterialIds=[m['id'] for m in d['materials'] if m['id'].startswith('challenge-')],findings='时间PBS与值域分流不同；结构摘要可消掉额外log；计数单调不能保证WQS精确恢复。',responses='全部实质接受；增加参数分支采用已独立核证ABC216E；保留两离线法、Fenwick/摘要/LCA/循环提升，界定完整Aliens/CHT/高维优化。',note='work/first-chapter-20261028/scope-challenge-alignment.md'),scopeConclusion=scope['completenessArgument'],chapterCoordination=coord))
print('Recorded revised scope:',len(scope['branches']),'branches,',len(types),'problem types;',len(d['materials']),'material units.')
