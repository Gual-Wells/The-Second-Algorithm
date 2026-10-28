# 第二算法

面向求职上机的算法思想与题型实战参考：[阅读入口](https://second-algorithm.pages.dev/)。以代表性大算法思想为章，建立理论/机制/成立条件与应用版图；正式节按题型从标准到困难变型展开，结合手写C++、实际标准设施和可运行作答。不再分算法与C++两册。

每题型解释问题本质、思想匹配和机制变化，提供注释实现、必要工程知识及1–5份对应练习。C++知识只有一份完整内容权威，内部稳定身份不向读者展示；后续技术名称点击浮窗复用，新场景推理仍在正文。读位、代码通过和用户掌握分别判断。

## 当前状态

第一章为 **二分**：九个机制分支、37类题型，同一章内分四个阅读部分：边界与结构、判定与优化、选择与状态、提升与批量。包含理论前置、注释手写与实际标准设施、复杂判定、秩选择、结构内搜索、两种离线二分和惩罚参数精确恢复。

本章从全14书目、39站来源概况独立比较大领域，完成提取、综合、独立挑战、范围复审与再研究；没有把撤回旧稿改名出版。99项实现、12份唯一C++知识源和4个可执行验证目标用于支撑真实内容；数量不代表完备性或用户掌握。研究与修订入口为 [本轮最终研究](work/first-chapter-20261028/final-research.md)、[独立反例返回研究](work/first-chapter-20261028/author-research-corrections.md)。

正式版由“前置研究设施＋大思想编纂＋透明C++知识＋采用/发布门禁＋受保护阅读器”组成。线上状态以 `work/jobs/first-chapter-20261028/deployments/` 的实际收据为准，准备包不等于部署。2026-10-28撤回前的旧章不继承范围/采用，历史269个模式仍是候选，148份原题的旧教学归属不计算当前覆盖；教材、来源、身份和私人状态保留。研究协议中的空库叙述是该次初始化现场，后续以有效实时登记恢复前沿。

## 研究与采用

先盘点出版状态、理解全部已知教材/来源概况，独立研究大领域提案；再与已有正式章节协同后确定初始范围，充分提取并动态补充资料，反复研究综合。研究后复审范围时，已有章节作为实际资料再次参与协同，跟进变化并充分综合最终档案。独立提案、协同判断与修订全程分别落盘，冻结交接后才进入编纂；不能从小题单、普通accepted笔记或绿色测试自证完整。

允许部分内容重合和正常领域近邻，保留各章完整理解所需内容。章界以大而独立明确的算法思想为准，既不围绕旧章相关性不断切小，也不为零重复、零近邻扭曲正常范围。没有已有章节时明确空状态；隐藏/撤回稿不充当现行正式章。C++知识仍复用唯一权威。

[共同协议](protocol/CONTENT_PIPELINE.md) · [研究设施](protocol/RESEARCH_FACILITIES.md) · [章节标准](protocol/CHAPTER_STANDARD.md) · [研究部](protocol/RESEARCH_DEPARTMENT.md) · [实现标准](protocol/IMPLEMENTATION_STANDARD.md) · [质量工艺](protocol/QUALITY_WORKFLOW.md)

```sh
python -m second_algorithm research init task-id --goal "实际研究目标"
python -m second_algorithm research open-study task-id --chapter chapter-id
python -m second_algorithm research study-status task-id
python -m second_algorithm research status task-id
python -m second_algorithm course validate
python -m second_algorithm course chapters
python -m second_algorithm course quality
python -m second_algorithm course search Q000001
npm run check
```

CLI与CI核研究次序/依赖、材料处置、交接到合同的关系、正文位置、输入身份、编译/运行与发布准备，不认证分类正确、语义全面或用户学会。章节open/gap、旧合同、研究交接缺失/过期/不匹配、审阅缺失/过期或最新验证失败会阻止内容发布，generic accepted不能绕过。内部CLI可按知识编号检索，产品不显示编号管理。

```sh
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

准备不等于部署；发布须check-release、串行artifact上传和线上核验。详见[运行手册](protocol/TASK_EXECUTION.md)、[模型](docs/CONTENT_MODEL.md)、[恢复](docs/RECOVERY.md)和[阅读器](docs/READER.md)。

## 资料与工程

来源池、书目和材料约定：`catalog/sources.json`、`catalog/books.json`、`docs/LOCAL_MATERIALS.md`。已登记、取得、实际读过、分析、编纂和验证分开，旧cases/patterns不计算现行覆盖。商业原件、私人手册和凭据不上传。

Node24、Python3.11+、已有支持目标版本的C++编译器；依赖按锁文件。所有本机新增数据、缓存、TEMP/TMP、日志、教材和构建实际存D，不安装/删除共享node_modules联接目标。正文、源码和知识是Git/静态资源，D1只存身份与私人状态；不新增订阅、周期生成或后台知识服务。
