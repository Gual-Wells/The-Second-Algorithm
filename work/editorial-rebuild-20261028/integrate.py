"""Assemble current editorial registrations; never accepts a chapter review."""
from pathlib import Path
import json
import re

R = Path(__file__).resolve().parents[2]
W = Path(__file__).resolve().parent
S = R / 'work/jobs/first-chapter-20261028/study'
load = lambda p: json.loads(p.read_text(encoding='utf-8'))


def save(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


parts = ['boundary', 'decision', 'selection', 'advanced']
authors = [load(W / (part + '-authoring.json')) for part in parts]
byid = {u['id']: (a, u) for a in authors for u in a['units']}
order = '''ordered-boundaries predicate-access transformed-index rotated-search paired-break
local-peak matrix-membership integer-root capacity-partition maximin-spacing cumulative-production
ordered-simulation graph-threshold prefix-activation weighted-inverse pigeonhole-domain matrix-rank
multiplication-rank pair-distance-rank two-sorted-partition ordered-dp-frontier weighted-predecessor
resource-queries matrix-peak string-prefix continuous-root average-transform ratio-selection
convex-location matching-threshold fenwick-rank summary-descent ancestor-boundary cyclic-jump
time-parallel-search dynamic-range-kth marginal-penalty'''.split()
assert len(order) == len(set(order)) == 37 and set(order) == set(byid)
scope = load(S / 'scope.json')
planned = {t['id']: t for t in scope['problemTypes']}
dossier = load(S / 'dossier.json')
materials = {m['id']: m for m in dossier['materials']}
doc = 'binary-search'
qfiles = ['binary-library', 'integer-budget', 'predicate-capture', 'ordering', 'borrowing-vector',
          'floating-search', 'priority-queue', 'selection-reorder', 'recursive-callback',
          'random-integers', 'queue-deque', 'stable-events', 'vector-validity']
questions = []
for number, name in enumerate(qfiles, 1):
    source = 'content/knowledge/' + name + '.md'
    text = (R / source).read_text(encoding='utf-8')
    qid = f'Q{100000 + number}'
    questions.append(dict(id=qid, title=text.splitlines()[0][2:], source=source,
                          prerequisites={'Q100009': ['Q100003'], 'Q100012': ['Q100005', 'Q100013']}.get(qid, []),
                          sources=list(dict.fromkeys(re.findall(r'https://[^\s)<>]+', text)))))
loc = lambda anchor: [dict(document=doc, anchor=anchor)]
tasks, units = [], []
for uid in order:
    a, u = byid[uid]
    t = planned[uid]
    methods, descriptions = {}, {m['id']: m for m in u.get('methods', [])}
    for item in u['implementations']:
        impl = dict(item)
        mid = impl.pop('method', 'main')
        impl.update(source=a['path'] + '.cpp', standard='c++17', target=a['target']['id'])
        methods.setdefault(mid, []).append(impl)
    mechanism = materials[t['materialIds'][0]]['mechanism']
    tasks.append(dict(id='task-' + uid, title=u['title'], document=doc,
                      contract=t['problem'] + '；' + t['variation'], sourceUrls=t['exerciseUrls'],
                      methods=[dict(id=mid, title=descriptions.get(mid, {}).get('title', mid.replace('-', ' ')),
                                    invariant=descriptions.get(mid, {}).get('invariant', mechanism), implementations=impls)
                               for mid, impls in methods.items()]))
    source = (R / (a['path'] + '.source.md')).read_text(encoding='utf-8')
    links = {url: title for title, url in re.findall(r'\[([^\]]+)\]\((https://[^)]+)\)', source)}
    manual = [m['id'] for m in u['implementations'] if m['kind'] == 'manual']
    standard = (u.get('standardImplementationIds') or [m['id'] for m in u['implementations'] if m['kind'] == 'standard']
                or [m['id'] for m in u['implementations'] if m['kind'] == 'alternative'] or manual)
    units.append(dict(id=uid, title=u['title'], researchTypeIds=[uid], taskIds=['task-' + uid],
                      locations=loc(u.get('anchor', uid)), dependsOn=[],
                      facets={key: loc(u.get(field, uid)) for key, field in [
                          ('problem', 'anchor'), ('fit', 'anchor'), ('variation', 'anchor'),
                          ('manual', 'manualAnchor'), ('manualExplanation', 'manualAnchor'),
                          ('standard', 'standardAnchor'), ('standardExplanation', 'standardAnchor'),
                          ('engineering', 'engineeringAnchor')]},
                      manualImplementationIds=manual, standardImplementationIds=standard, standardRole=u['standardRole'],
                      exercises=[dict(title=links.get(url, url.rstrip('/').split('/')[-1]), url=url) for url in t['exerciseUrls']]))
deps = {'predicate-access': ['ordered-boundaries'], 'transformed-index': ['ordered-boundaries'],
        'matrix-peak': ['local-peak'], 'string-prefix': ['ordered-boundaries'],
        'pair-distance-rank': ['matrix-rank'], 'multiplication-rank': ['matrix-rank'],
        'two-sorted-partition': ['ordered-boundaries'], 'ordered-dp-frontier': ['ordered-boundaries'],
        'weighted-predecessor': ['ordered-boundaries'], 'resource-queries': ['predicate-access'],
        'average-transform': ['continuous-root'], 'ratio-selection': ['continuous-root'],
        'fenwick-rank': ['weighted-inverse'], 'cyclic-jump': ['capacity-partition', 'ancestor-boundary'],
        'time-parallel-search': ['graph-threshold'], 'dynamic-range-kth': ['fenwick-rank'],
        'marginal-penalty': ['multiplication-rank', 'ratio-selection']}
for u in units:
    u['dependsOn'] = deps.get(u['id'], [])
    assert all(order.index(prior) < order.index(u['id']) for prior in u['dependsOn'])

composition = dict(schemaVersion=1, title='二分',
                   sourceFiles=[a['path'] + '.source.md' for a in authors],
                   prelude=dict(source='content/binary/boundary.source.md', anchor='prelude'),
                   sections=[dict(id=uid, source=byid[uid][0]['path'] + '.source.md', anchor=byid[uid][1].get('anchor', uid)) for uid in order],
                   codeSources=[a['path'] + '.cpp' for a in authors])
publications = dict(schemaVersion=2, state='active', collections=[dict(id='chapter-01', kind='chapter', chapterNumber=1,
    title='二分', visibility='published', documents=[dict(id=doc, title='二分', path='content/binary/chapter',
        composition='content/binary/chapter.authoring.json')])])
contract_path = R / 'content/binary/chapter-contract.json'
contract = load(contract_path)
contract['schemaVersion'] = 3
contract['prelude'] = dict(status='addressed', locations=loc('prelude'))
contract['reading'] = dict(status='addressed', gap='', units=units)
for promise in contract['commitments']:
    promise['locations'] = loc('prelude') if promise['id'] == 'reader-flow' else [loc(uid)[0] for uid in order if 'task-' + uid in promise['taskIds']]
    if promise['id'] == 'reader-flow':
        promise['claim'] = '读者只面对一章中的前置与正式题型；问题和变型先于对应代码，必要依赖就近可理解。'
        promise['acceptance'] = '从真实入口连续通读生成教材，核题型主目录、整章进度、首次解释、代码邻近和检索上下文；不以作者文件或已通过字段验收。'
for branch in contract['paradigm']['branches']:
    branch['sectionIds'] = [uid for uid in order if branch['id'] in planned[uid]['branchIds']]
for name, locator in [('content-changes', '本轮逐型编纂更正及作者实际回归'),
                      ('prelude-review', '非前置作者对根重写前置的实际审读'),
                      ('independent-review', '本轮从读者顺序检查统一生成教材')]:
    evidence = f'work/editorial-rebuild-20261028/{name}.md'
    if (R / evidence).is_file():
        mid = 'editorial-' + name
        contract['materials'] = [m for m in contract['materials'] if m['id'] != mid]
        contract['materials'].append(dict(id=mid, kind='countercheck', locator=locator, evidence=evidence, sourcePaths=[]))
save(R / 'carrier/publications.json', publications)
save(R / 'catalog/learning.json', dict(schemaVersion=2, questions=questions, tasks=tasks, targets=[a['target'] for a in authors]))
save(R / 'content/binary/chapter.authoring.json', composition)
save(contract_path, contract)
print('Registered one chapter:', len(units), 'types,', sum(len(m['implementations']) for t in tasks for m in t['methods']),
      'implementations,', len(questions), 'knowledge sources. No review accepted.')
