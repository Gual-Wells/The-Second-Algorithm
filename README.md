# 第二算法

面向求职上机的算法思想与题型实战参考：[阅读入口](https://second-algorithm.pages.dev/)。以代表性大算法思想为章，建立理论/机制/成立条件与应用版图；正式节按题型从标准到困难变型展开，结合手写C++、实际标准设施和可运行作答。不再分算法与C++两册。

每题型解释问题本质、思想匹配和机制变化，提供注释实现、必要工程知识及1–5份对应练习。C++知识只有一份完整内容权威，内部稳定身份不向读者展示；后续技术名称点击浮窗复用，新场景推理仍在正文。读位、代码通过和用户掌握分别判断。

## 当前状态

2026-10-28按用户要求全部撤销清零：出版登记为withdrawn，当前章节、正文、知识、任务、实现及验证目标均为0。旧正式稿、试稿、知识卡和专用验证代码已退出当前工作树，只在Git历史中可恢复；不作为下一章范围、顺序或采用依据。

教材、书目、来源池、目录快照和原题阅读证据保留。269项历史研究模式重置为候选，148份原题的教学归属重置为pending，不再声称有已出版正文或已经覆盖。下一章尚未选定，须按有效硬协议重新研究大思想领域。

有效研究/编纂/透明知识/发布工程保留，身份与私人笔记不清空。撤回的实际线上状态以本轮部署收据为准，不能把空登记或准备包冒充已部署。[资料现状](work/withdraw-all-20261028/materials-and-sources.md) · [前置与正式节设计](work/withdraw-all-20261028/section-design.md)

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
