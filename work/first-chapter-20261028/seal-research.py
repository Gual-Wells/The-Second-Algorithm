import json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from second_algorithm.inquiry import checkpoint, seal_handoff
R=Path.cwd();W=R/'work/first-chapter-20261028';S=R/'work/jobs/first-chapter-20261028/study'
d=json.loads((S/'dossier.json').read_text(encoding='utf-8-sig'));scope=json.loads((S/'scope.json').read_text(encoding='utf-8-sig'))
sessions=[]
for key,q,f,i in [
 ('ordered','修订后边界、记录与字符串如何保持合同？','等价区间/前驱归并，字符比较计费；位置差与API域条件独立。','不得用返回end或不同严格性制造隐错，原型按当前强CS读者紧凑解释。'),
 ('structured','非单调结构如何重新论证？','峰/旋转/几何各给存在性或局部有序证书，重复退化与凸形数值界重核。','保留完整结构型实现和失效条件，不全部套首次真解释。'),
 ('decision','新旧复杂判定是否仍有未实现黑箱？','原题合同已足以独立实现分段、间距、模拟、图、匹配、事件前缀、资源反演。','作者必须兑现内部算法与检查成本，代码阶段再以独立模型核验。'),
 ('rank','秩与状态转移是否因归并漏掉条件？','矩阵/距离/乘法表的计数不同；两序列切分不用数值域；累计逆查和容量异常不同。','每型保实质变型和真实标准设施代价，LIS恢复/计数、调度端点不能省。'),
 ('continuous','数值与代数变换如何回收复审结论？','连续夹逼、长度窗口、内部删除、top-m比值的条件与方向分别重核。','固定误差预算和非空条件，不能以format精度冒充算法精度。'),
 ('lifting','结构内证书和生命周期是否充分？','Fenwick非负频数、摘要首次失败、祖先会合、循环正数最远后继分别成立。','具体结构定义、预处理和原题适配要可运行，纯k跳不冒称搜索。'),
 ('batch','两种离线法能否用同一个更新政策？','不能：按轮重建时间单调结构，与值域递归稳定事件/残秩/撤销是独立不变量。','带修改实现必须有删除和跨询问测试，禁止借静态kth通过。'),
 ('parametric','参数阈值为何能精确恢复而不只计数单调？','可分离递减边际保证同值计数区间真实可达；一般F(k)无此保证。二分只计数规避全oracle溢出。','完整讲H、S/E、恢复与反例；独立验证公式不冒称生产C++已过。')]:
    ms=next(b['materialIds'] for b in scope['branches'] if b['id']==key)
    sessions.append(dict(question=q,materialIds=ms,findings=f,implications=i))
record=dict(summary='范围复审后重新研究修订全档案和37型计划，逐项关闭核心待决，准备不可变交接进入作者阶段。',notes=['work/first-chapter-20261028/final-research.md','work/first-chapter-20261028/challenge-response.md','work/first-chapter-20261028/revised-synthesis.md'],sessions=sessions,resolvedChanges='新增参数分支以ABC216E承担精确oracle/同值恢复；结构内搜索与两种离线法保留独立不变量；CHT等对照有明确范围理由。当前研究核心问题均resolved，实际代码/可读性/发布仍是下一阶段。',finalArgument='现有教材/全池概况、原题与独立挑战共同形成有代表性的二分大领域；九个机制分支、37题型及其主要条件/变型相互覆盖，采用材料无孤立或未决。该结论不靠条目数认证，也不声称全网所有oracle穷尽。')
p=W/'resynthesis-record.json';p.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
r=checkpoint(R,'first-chapter-20261028','resynthesis',p.relative_to(R).as_posix());print({k:r.get(k) for k in ['ok','phase','nextPhase','errors','readyForHandoff']})
r=seal_handoff(R,'first-chapter-20261028');print(json.dumps(r,ensure_ascii=False)[:1800])
