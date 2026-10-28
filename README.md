# 第二算法

面向求职上机的算法思想与题型实战参考：[阅读入口](https://second-algorithm.pages.dev/)。以代表性大算法思想为章，建立理论/机制/成立条件与应用版图；正式节按题型从标准到困难变型展开，结合手写C++、实际标准设施和可运行作答。不再分算法与C++两册。

每题型解释问题本质、思想匹配和机制变化，提供注释实现、必要工程知识及1–5份对应练习。C++知识只有一份完整内容权威，内部稳定身份不向读者展示；后续技术名称点击浮窗复用，新场景推理仍在正文。读位、代码通过和用户掌握分别判断。

## 当前状态

此前已出版《区间上的取舍：覆盖、冲突与收益》，原稿/代码在`content/interval-decisions/`，原研究与发布证据在`work/first-independent-20261028-v3/`。它是覆盖、扫描、贪心、堆、DP等混合的问题专题，**不自动符合2026-10-28用户确定的大思想章节硬协议**。旧采用不能继承为新标准通过，也不能改名成《贪心》追认领域完整。

本轮建设把新硬要求落实到有效协议、章级领域/题型合同、透明知识资产与阅读交互。结构有效、工程通过、章已采用和实际部署分开报告；当前缺口/旧schema应阻止再次内容发布。是否上线以实际deployment收据和站点为准，不能把准备包当发布。

旧稿、原双线、trial及撤回快照仅作历史素材或恢复，不限制新研究范围。知识从独立唯一作者源复用，旧内部身份保留不要求读者记忆；原书/凭据/私人状态不删除、不公开。

## 研究与采用

先复盘出版和全部已知教材/来源，尽可能提取相关正文、例题、练习、索引与交叉应用，按实际机制语义归并；先领域全景，后题型提纲。独立材料反查、连续通读、逐承诺回查与权威代码验证共同支持采用，不能从小题单或绿色测试自证完整。

[共同协议](protocol/CONTENT_PIPELINE.md) · [章节标准](protocol/CHAPTER_STANDARD.md) · [研究部](protocol/RESEARCH_DEPARTMENT.md) · [实现标准](protocol/IMPLEMENTATION_STANDARD.md) · [质量工艺](protocol/QUALITY_WORKFLOW.md)

```sh
python -m second_algorithm research init task-id --goal "实际研究目标"
python -m second_algorithm research status task-id
python -m second_algorithm course validate
python -m second_algorithm course chapters
python -m second_algorithm course quality
python -m second_algorithm course search Q000001
npm run check
```

CLI与CI核实际关系、位置、输入身份、编译/运行、证据当前性与发布准备，不认证分类正确、语义全面或用户学会。章节open/gap、旧合同、审阅缺失/过期或最新验证失败会阻止内容发布，generic accepted不能绕过。内部CLI可按知识编号检索，产品不显示编号管理。

```sh
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

准备不等于部署；发布须check-release、串行artifact上传和线上核验。详见[运行手册](protocol/TASK_EXECUTION.md)、[模型](docs/CONTENT_MODEL.md)、[恢复](docs/RECOVERY.md)和[阅读器](docs/READER.md)。

## 资料与工程

来源池、书目和材料约定：`catalog/sources.json`、`catalog/books.json`、`docs/LOCAL_MATERIALS.md`。已登记、取得、实际读过、分析、编纂和验证分开，旧cases/patterns不计算现行覆盖。商业原件、私人手册和凭据不上传。

Node24、Python3.11+、已有支持目标版本的C++编译器；依赖按锁文件。所有本机新增数据、缓存、TEMP/TMP、日志、教材和构建实际存D，不安装/删除共享node_modules联接目标。正文、源码和知识是Git/静态资源，D1只存身份与私人状态；不新增订阅、周期生成或后台知识服务。
