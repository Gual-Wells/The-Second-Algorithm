# 新第一章独立研究与发布交付

用户修正后的要求已按task-baseline.md执行：撤回此前出版，新内容从候选比较/原题研究/空白作者稿与源码/新独立参考模型重新形成，不迁移旧任务状态、旧稿或旧验收结论。沿用当前有效协议和通用工具不等于承接旧教学内容。

## 实际撤回

撤回代码提交`879d98f9fa80df80dfd6182e3aaaaecb1d098270`已先部署空目录，记录`work/jobs/withdraw-prior-first-20261028/deployments/1793142574106.json`。旧正文/CPP/MD从正式目录、构建产物、允许路径及SW缓存移除；私人笔记保留。其[Linux CI](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40600091557)成功。用户原件与Git恢复历史未销毁，也未拿来充当新章。

## 新首章

《边界与答案：把搜索条件写进代码》，chapterNumber=1，document/collection=`boundary-feasibility`。四任务为LC34、LC875、CSES1620、CSES1085；5个实际实现，8个必要C++问题Q19—26，15个独一源码展示区域。旧Q1—18保留撤回身份，新正文不将其视作已学前置。

完整研究、实际材料读取和范围修订见scope-research.md/practice-evidence.md/author-research.md；独立语义与结果检查分别见independent-content-review.md/independent-verification.md；90次ACM与8项LC适配可用verify_platform_entries.py复现。实际纠正了Koko中间窄加法，以及Factory紧界内总量的论证失真。

完整检查通过：57 Python、66 carrier、5个登记C++目标（1 run/4 compile）、run内649268断言、20真实Chrome浏览器检查、实际SW更新/离线/撤回旧缓存。独立GCC O2/O0/ftrapv及实际平台入口也通过。未在线OJ提交；未找到第二本机编译器；UBSan缺运行库；未冒称iPhone真机验收。

## 实际发布

内容代码提交`92044c58d09cbf5dae87ed1ae8c466ef49a272d6`已经推送；[本次Linux CI](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40602059368)completed/success。新任务first-chapter-independent-20261028使用全新研究/审阅/验证与准备包，输入指纹`6050edbcdc8071bbde3a549f719e8b500de81ca2a4c6e65ceb6e41086e8641a6`；66个冻结输入逐一与该Git提交原始blob核对，无字节差异。

准备包`work/jobs/first-chapter-independent-20261028/releases/d9b333d900ed41aba425728973018632.json`，实际部署回执`work/jobs/first-chapter-independent-20261028/deployments/1793143564663.json`；线上build=`3433d5c0df36ce79cc3a5ed2ac9dab208e064dce9cf1456785ff53041998ce89`。正式站https://second-algorithm.pages.dev/，新篇入口https://second-algorithm.pages.dev/#/read/boundary-feasibility/boundary-feasibility。

部署后的节点核验返回SW 200、与固定artifact build相符、包含新文档白名单且不含旧practice-foundations；匿名保护由正式部署脚本核验。Python默认UA的一次额外SW请求403，不能冒称其成功；Node实际请求以及部署脚本均200并命中本次build，无此阻断。固定产物仅新章库文件。

末次提交仅保存本交付说明和实际部署回执，不改变66个冻结输入，使用skip-ci避免将同一代码的CI重复运行；当前内容检查的成功对象明确为上述代码提交。无新增定时、订阅、AI调用或持续服务费用。
