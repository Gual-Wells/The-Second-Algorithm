# 第二算法

面向求职上机的统一算法实战参考：[阅读入口](https://second-algorithm.pages.dev/)。围绕真实任务、成立条件、关键方法、手写与C++标准设施对照、可运行作答组织；不再分算法和C++两册。

每个涉及的C++知识问题全项目唯一编号，一份完整讲解只出现一次，后续只引用编号和主讲位置。题目、方法、实现、Q、实际验证分别建关系；后期C++查漏从同一问题索引恢复，不另复制一套解释。读位不代表掌握。

## 当前内容

此前出版已按用户要求撤回。新的第一章《边界与答案：把搜索条件写进代码》从原题独立研究：先处理有序数组的出现区间，再构造速度、并行产量和连续分段的可行性判定。手写边界与标准设施面对同一合同；其余任务分别论证模型、数值界限和贪心判定。原稿与源码见 `content/boundary-feasibility/`，本轮研究与实际审阅见 `work/fresh-first-20261028/`，执行任务为 `first-chapter-independent-20261028`，不承接旧任务或旧验收结果。

撤回前的登记及身份单独留在 `work/fresh-first-20261028/retirement/` 供恢复核查，不参与新章选题或当前覆盖。旧Q1—18保留历史身份，新稿不把旧正文视作已学前置。旧稿/版本仅作历史研究素材，无生产兼容义务。

2026-10-28质量回归复盘后已建立章级编纂合同与采用门禁，详见[章节标准](protocol/CHAPTER_STANDARD.md)和[质量工艺](protocol/QUALITY_WORKFLOW.md)。当前第一章按新标准如实登记为待整改：查询复用、方向/空解政策、章级选择关系和阅读组织仍有缺口；不是补登记即追认通过。本轮更新生产架构，未把未完成整改的正文部署为合格新版。线上仍为上一次正式读件。

## 可恢复研究与发布

```sh
python -m second_algorithm research init task-id --goal "实际研究目标"
python -m second_algorithm research status task-id
python -m second_algorithm course validate
python -m second_algorithm course chapters
python -m second_algorithm course quality
python -m second_algorithm course search Q000001
npm run check
```

研究/语义审阅由Agent实际完成；CLI核验章合同/逐承诺审阅、Q/关系/引用、输入字节、真实编译运行及证据新鲜度。章质量open/gap或审阅缺失/过期会阻止准备，普通accepted笔记不能绕过。当前章级采用与研究/审阅有效后，research verify/prepare-release生成准备包；deploy必须check-release通过，再串行上传并核验线上版本与匿名保护。详见 [任务运行手册](protocol/TASK_EXECUTION.md) 和 [模型](docs/CONTENT_MODEL.md)。

```sh
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

准备不等于部署，测试通过不认证语义完备；输入变化、缺失证据或最新失败会阻止旧包发布。CI按登记target动态检查，workflow_dispatch可执行已有任务的验证/发布准备，不新增定时生成、付费AI或新的内容服务。

## 资料与工程

来源池、书目及本地教材约定保留：`catalog/sources.json`、`catalog/books.json`、`docs/LOCAL_MATERIALS.md`。已注册、目录取得、正文读过、分析、已讲和验证分开；当前覆盖只由真实内容关系和证据判断，不按旧cases/pattern计数宣称完整。商业原件/私人手册/凭据不上传。

Node24、Python3.11+、已有支持目标版本的C++编译器；依赖按package-lock安装。所有本机新数据/缓存/TEMP/TMP/日志/构建/教材实际落D，不安装或删除共享node_modules联接目标。正文/源码在Git与静态资源，D1仅身份及私人阅读状态。没有新增订阅或后台定时活动。

[共同协议](protocol/CONTENT_PIPELINE.md) · [研究部](protocol/RESEARCH_DEPARTMENT.md) · [实现标准](protocol/IMPLEMENTATION_STANDARD.md) · [架构](docs/ARCHITECTURE.md) · [恢复](docs/RECOVERY.md)
