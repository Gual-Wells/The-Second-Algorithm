"""Package actual overview/candidate findings; this script does not conduct research."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
W = ROOT / 'work/first-chapter-20261028'
S = ROOT / 'work/jobs/first-chapter-20261028/study'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p, d): p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
book_rows=load(W/'books-overview.json')['bookAssessments']
source_rows=load(W/'sources-overview.json')['sourceAssessments']
entries=[]
for prefix, rows in [('book',book_rows),('source',source_rows)]:
    for r in rows:
        unavailable = prefix=='book' and r['id'] not in {'epi-cpp','competitive-programming-4','competitive-programmers-handbook','professional-cpp-6','modern-cpp-challenge','discovering-modern-cpp-2','modern-cpp-cookbook-2'}
        actual=r['readState']
        state='unavailable' if unavailable else ('analyzed' if prefix=='book' and r['id'] in {'epi-cpp','competitive-programming-4','competitive-programmers-handbook'} else 'directory')
        entries.append(dict(id=prefix+':'+r['id'],relevance='unavailable' if unavailable else 'excluded',reason='全景阶段已逐项判断用途与读取边界，尚未作为本章采用材料。'+r['reason'],locator='; '.join(r['locator']) if isinstance(r['locator'],list) else r['locator'],readState=state,materialIds=[],core=False))
materials=[]
for mid,sid,note,loc in [
 ('candidate-books','book:competitive-programming-4','books-overview.md','CP4 B1 physical159–219 / B2 full TOC; EPI chapters12/16/17/18/19'),
 ('candidate-interview','book:epi-cpp','candidate-comparison.md','EPI physical198,290,311,341,358 and chapter directories'),
 ('candidate-problems','source:cses','candidate-comparison.md','CSES original Factory Machines, Array Division, Flight Discount, Queens and DP task statements'),
 ('candidate-methods','source:cp-algorithms','root-overview.md','Binary Search sections arbitrary predicate / continuous / powers / parallel'),
 ('candidate-assessment','source:codility','sources-overview.md','Developer Training lessons14,16,17 and MinMaxDivision original contract')]:
    materials.append(dict(id=mid,source=sid,locator=loc,readState='analyzed',note='work/first-chapter-20261028/'+note,disposition='excluded',reason='独立候选比较与范围依据；后续以具体分支材料承接，不将其他候选变为二分正文。'))
    e=next(e for e in entries if e['id']==sid);e.update(relevance='related',readState='analyzed',materialIds=e['materialIds']+[mid])
save(S/'ledger.json',dict(schemaVersion=1,entries=entries))
save(S/'dossier.json',dict(schemaVersion=1,materials=materials,findings=[],questions=[],searches=[dict(id='overview-primary',query='whole textbook and source role overview; compare binary/greedy/search/DP/graph',source='actual primary directories and textbook locators in notes',result='三独立视角均认为二分是合格且优先的大领域，其他候选并非因难而排除；目录分类不能直接复制。',note='work/first-chapter-20261028/candidate-comparison.md')]))
save(W/'overview-record.json',dict(summary='全14书目与39站来源概况、真实空出版身份及独立候选基础已完成；未声称全书全站读完。',notes=['work/first-chapter-20261028/'+n for n in ['baseline.md','root-overview.md','books-overview.md','sources-overview.md','candidate-comparison.md']],corpusUnderstanding='六本地材料包保留真实版本与提取限制；CPH可从作者官方在线读取。39站角色含原题、方法、标准、实现及工具，非39个独立题库。各项判断见两份overview JSON/MD。',publicationReview='有效schema2 withdrawn空出版与schema1空章登记；study-status为no-prior-chapters。历史撤回内容不充当旧章。',candidateBasis='独立比较二分、贪心、完整搜索、DP及图机制，依据CP4/EPI/CPH与CSES/Codility/AtCoder等真实材料；未继承历史章范围。'))
print('Packaged actual overview: 14 books, 39 sources, 5 independent comparison materials.')
