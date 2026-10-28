# 章级质量架构建设

2026-10-28。第二算法起点main@4d9fe9024b80fd6abf1ad45e94a966f6d36e2600；开工前仅上一轮质量研究目录未跟踪。第二语言只读参照为second-language-certification-reader@6fc3a272155f78d8c7cc440bce883f4a126e4d30。全部新文件、检查输出和临时目录实存D，无安装/付费调用/新增后台任务。

## 采用了什么

深读第二语言现行材料、内容结构、择选防降级、作者装配、语义回查和同版封存的协议与实际实现。迁移的是“原件问题空间→明确语义单位→正文位置→唯一作者稿→反向回查→实际采用”职责链，而非其词数/全义/语境数量/冻结VIX合同。读件与不能照搬项见[language-transfer.md](language-transfer.md)。

第二算法以前章只是一组文档，关系模型能核任务/方法/实现/Q，却没有充分表达章级目标。现在保留已有有效的代码、Q唯一、独立测试、冻结和部署链，新增真实章级编纂合同与采用。具体质量与结构原则见[CHAPTER_STANDARD](../../protocol/CHAPTER_STANDARD.md)和[QUALITY_WORKFLOW](../../protocol/QUALITY_WORKFLOW.md)。

## 改变作者决策的要求

- 难度：已有计算机基础，C++支架不等于算法目标下调；本章的建模/证明/选择认知台阶须在正文有据，不能用题站标签、Q数量、复杂helper保证替代。
- 广度：先研究条件/目标/方法关系，再决定章界；禁止把方便写完的题单定义成完备范围。关键低前置复用和改变正确性的对照，不能因初章轻量、易测或新结构而删掉。
- 系统完备：任务链局部闭合、整章关系与前置闭合分别判断。必要分叉有实际承载或诚实边界，不以未来空章顶替；合理排除保留，不要求穷尽整个领域。
- 可读性：章入口→按关系推进的问题簇→方法选择/复用地图，算法主线与必要Q支撑分层；审计数据不灌入正文。不要求每题同名固定六栏目，不强迫每个推论新造OJ题。

这些强约束仍由资料和实际编纂审阅承担，不是机器打分。独立协议审阅发现两处可能过度扩张的歧义，已明确：完整入口针对任务链整体；仅后续研究未知不一律变成本版必达，但本版核心缺口不能借改名逃避。见[协议反查](protocol-peer-review.md)。

## 实际架构与执行入口

`catalog/chapters.json`为每个正式章指向唯一contract与review，现有learning/publications仍各负其责。合同保留reader/scope/materials/commitments，以及可核验的reading入口/问题簇/选择地图。已有承载用真实稳定显式正文锚点定位，open记真实缺口；不复制教材和代码。

```sh
python -m second_algorithm course chapters
python -m second_algorithm course validate
python -m second_algorithm course chapter-inputs boundary-feasibility
python -m second_algorithm course quality
```

chapters中文人读；validate允许诚实施工open；quality独立检查实际采用记录与当前性。逐承诺审阅须有理由/位置、真实基准比较和countercheck依据。正文/合同/材料/规则改变使审阅失效；审阅自身字节排除自引用后，再由最终准备包固定。研究status/resume暴露缺口，prepare与check-release均重查；普通accepted笔记、编译通过和旧包不能绕过。

当前全课程保守失效，非精细影响分析。恢复须复核实际影响、保留有效依据，不机械批改hash；多章后按真实依赖细化是后续方向，不冒称已实现。工具仍明确不自动认证语义或用户掌握。实现与测试导航见[workflow-fit.md](workflow-fit.md)。

技术检查收尾会另外执行实际quality检查、明确输出是否阻止内容发布，并保存`.local/chapter-quality.json`供CI归档；不再用一句publishing checks passed掩盖当前章未采用。技术施工CI可通过，显式发布仍必须通过真实prepare/check-release。

## 当前第一章的真实状态

本轮只加稳定定位锚点并重建同源阅读产物，未偷换整章内容或改动算法源码。首次采用新合同如实登记8项承诺，其中已有分段证明、不同判定模型、实际C++/平台链有承载；以下5项仍open，reading结构也open：

1. 末真/最大可行与空可行集的真实建模和结果政策。
2. lower/upper已有信息的关键查询复用。
3. 独立反查后的有限章界和方法选择网络闭合。
4. 面向人的入口、问题路线和选择地图。
5. 算法主线与Q/包装细节的阅读分层。

逐项审阅保留needs-work，不追认新标准通过。正文缺口不会因字段完整或技术CI绿灯消失。在线旧读件本轮不撤、不部署为已合格新版；新的内容发布被门禁实际阻断。后续整改应按合同重新研究/编纂和实际阅读，不据本报告直接凑几道题。具体材料与判断见[material-audit.md](material-audit.md)及[章级设计研究](chapter-contract-design.md)。

## 独立工程审计

门禁初版实测通过后，另一次代码反查复现三项问题，已安排定点修复与回归用例：代码文字里的假锚点误算正文、畸形对象数组使校验崩溃、路径别名绕过审阅自引用保护。固定锚点采用明确的作者格式而非引入完整Markdown解析器；机器不因此取得审美或语义判断能力。

最终运行结果及提交身份另记delivery.md，避免将阶段测试当最后有效输入的验证。本报告不代替当前章quality结果，也不授权绕过已记录的needs-work。
