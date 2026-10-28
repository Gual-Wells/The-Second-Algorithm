import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from second_algorithm.inquiry import checkpoint
R=Path.cwd();W=R/'work/first-chapter-20261028';S=R/'work/jobs/first-chapter-20261028/study'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
d=load(S/'dossier.json');scope=load(S/'scope.json');ledger=load(S/'ledger.json');mats={m['id']:m for m in d['materials']}
note='work/first-chapter-20261028/author-research-corrections.md'
updates=[('correction-production-tight-bound','source:cses','cumulative-production','decision','紧界T<=min(t)*target使每台产量<=target，合计<=n*target<=2e14。','宽界可变大；饱和仍有用但不是当前紧界的必要防溢出。',['https://cses.fi/problemset/task/1620/']),('correction-cubic-critical-points','source:luogu','continuous-root','continuous','归一后用两个导数临界点分隔三根，再分别异号夹逼。','根域/根距保证系数及临界值裕量；不能用任意epsilon合并端点。',['https://www.luogu.com.cn/problem/P1024']),('correction-lis-intermediate-count','source:leetcode','ordered-dp-frontier','transition','非负计数在局部合并及最终聚合加前饱和，最终可表示时精确。','最终答案32位不保证无关较短状态fits64；len独立于ways。',['https://leetcode.com/problems/number-of-longest-increasing-subsequence/description/'])]
for mid,source,tid,bid,mechanism,conditions,urls in updates:
    m=dict(id=mid,source=source,locator='作者源码、独立反例与原题：'+'; '.join(urls),readState='analyzed',note=note,disposition='included',reason='真实编纂反查返回研究，更正原结论并已定点验证。',mechanism=mechanism,conditions=conditions,variants=conditions,crossParadigms=['数值合同','独立反例'],exerciseUrls=urls)
    d['materials'].append(m)
    t=next(t for t in scope['problemTypes'] if t['id']==tid);t['materialIds'].append(mid)
    b=next(b for b in scope['branches'] if b['id']==bid);b['materialIds'].append(mid)
    f=next(f for f in d['findings'] if f['id']=='finding-'+tid);f['materialIds'].append(mid);f['claim']+='；作者期纠正：'+mechanism;f['conditions']+='；'+conditions
    e=next(e for e in ledger['entries'] if e['id']==source);e['materialIds'].append(mid)
mats['root-continuous'].update(note=note,mechanism=updates[1][4],conditions='连续异号求某根；P1024三个互异根在[-100,100]且根距>=1，导数临界点形成有裕量的三个夹区。',variants=updates[1][5])
t=next(t for t in scope['problemTypes'] if t['id']=='continuous-root');t['problem']=updates[1][4];t['variation']='通用异号求某根与导数分段找全三根分开，归一化/临界值裕量取代脆弱整数端点零判断。'
f=next(f for f in d['findings'] if f['id']=='finding-continuous-root');f.update(problem=t['problem'],mechanism=updates[1][4],variants=t['variation'])
d['questions'].append(dict(id='author-counterexamples',core=True,status='resolved',reason='产能紧界、十进制漏根及LIS大局部计数已实质更正/回归，见author-research-corrections；保留原失败历史。'))
save(S/'dossier.json',d);save(S/'scope.json',scope);save(S/'ledger.json',ledger)
p=load(W/'type-plan.json');p['types']=scope['problemTypes'];save(W/'type-plan.json',p)
# Correct current notes without altering any archived earlier bytes.
p=W/'final-research.md';text=p.read_text();text=text.replace('生产上界≤1e18而n项产能和可超界，达到目标后饱和。','生产紧界min(t)*target下，每台贡献≤target，总和≤2e14；改宽界时才另评溢出，达到目标后饱和仍有用。');text+='\n作者期更正已返回研究，见author-research-corrections.md：P1024改导数分段，LIS局部计数饱和；此前版本保留在阶段快照。\n';p.write_text(text,encoding='utf-8',newline='\n')
q=load(W/'scope-review-record.json');q['notes'].append(note);q['summary']+=' 编纂期独立反例返回研究，修正产能预算、三次根分隔与LIS计数。'
for row in q['decisions']:
    if row['branch'] in {'decision','continuous','transition'}:
        row['action']='correct';row['reason']+=' 编纂实测已更正数值/分隔依据，类型范围保留。'
        row['materialIds']=next(b['materialIds'] for b in scope['branches'] if b['id']==row['branch'])
q['challenge']['responses']+=' 编纂交叉审阅又给出十进制漏根和大局部计数反例，已定点更正并实测；原失败证据保留。'
save(W/'scope-review-record.json',q)
r=checkpoint(R,'first-chapter-20261028','scope-review','work/first-chapter-20261028/scope-review-record.json')
print(r['phase'],r['errors'])
