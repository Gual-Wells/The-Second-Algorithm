# 超纲双标签：协议设施审阅

日期：2026-10-30（Asia/Shanghai）。本记录只报告本代理实际研究与协议修改；构建、代码正确性、载体验证及部署另由根任务负责，本文不声称这些环节已经通过。

## 读过的当前设施与发现

实际读取AGENTS，以及CONTENT_PIPELINE、RESEARCH_FACILITIES、CHAPTER_STANDARD、QUALITY_WORKFLOW、IMPLEMENTATION_STANDARD、TASK_EXECUTION、CONTENT_MODEL和READER。现有设施已明确大思想完整覆盖、跨思想应用不得删、研究七阶段及不可变交接、Hcode/Scode职责、阅读与代码分开审阅。缺口是完整知识范围与默认阅读路径尚未有正式分层边界/持久投影，依赖研究没有明确要求为整节分类留下实质依据。若简单加UI，未来章容易按难度、跨章名或前置多就过度分层。

评审附件提供可核实线索，但其对“已有可逆超纲机制”的描述属于预设，不能作为当前运行事实。其部分细粒度拓展、联动先修与额外说明的建议与用户硬要求冲突，不进入本设计。评分不用于采用或工程验证。

## 实际补丁

1. 新增`protocol/CONTENT_LAYERS.md`：唯一完整定义、研究证据、整节呈现、独立撤回、技术回查与发布验收。
2. `RESEARCH_FACILITIES`在资料提取、范围复审及最终交接加入核心依赖/位置/依据；复用既有档案和笔记，不另造并行资料库或强制每节模板。真正高级组合继续完整研究和编纂。
3. CONTENT_PIPELINE、CHAPTER_STANDARD及AGENTS衔接整节定义、完整范围与两页呈现。基础CS、贪心/递归/DP、局部补充与难度不算超纲，分类争议影响学习路线时向用户具体讨论。
4. IMPLEMENTATION_STANDARD和QUALITY_WORKFLOW加入通用有解责任、数值搜索界与泛化一致、计数容量/存在性论证、设施等价/局部替换/替代算法的实查；不新增界面徽章或机械栏目。
5. TASK_EXECUTION加入分类证据、当前审阅和真实双页验收，沿原准备/部署门禁，不改写历史研究或自动追认旧通过。
6. CONTENT_MODEL依根与schema代理确认的实际接口描述`reading.extensions`及受保护投影，并写明稳定显式anchor与渲染H2 slug通过aliases衔接。旧省略兼容不代表分类已审阅，新章显式提供可空分类；机器不假造按时间判断的门禁。用户撤回独立owner/document/稳定节保存，默认分类仍绑定原内容revision。
7. READER说明共享目录、阴影、单节撤回原位清标记与跨页链接；不把上线、测试与用户实机验收混同。

另纠正三份协议开头和CONTENT_MODEL里过期“平面篇节索引/标题筛选”的现行指称，与已有真实层级目录要求一致；未改Logo、服务、用户原件或已有不可变研究档案。

## 约束对齐

- 整个H2移动，H3/H4、证明、代码、练习全部同行；不拆隐藏变型。
- 撤回只影响点按节，回原位、清标签/按钮/阴影，不重排、不重编号、无依赖联动。
- 跨节代码依赖用原真实链接自动切页，不强行搬前置节。
- 无重置分层、批量操作、先修卡、路径推荐或评分说明等额外产品功能。
- 分类依据留内部，读者只见标签与实际动作；正文仍保留真正算法约束与前提。
- 当前旧章的定点修订/载体更新不要求重跑全部历史七阶段，新章完整执行。

## 检查与边界

已逐项阅读本代理差异，运行`git diff --check`（本代理路径）无空白错误；所有修改保存UTF-8无BOM、LF。未运行产品测试、未构建、未提交或部署。具体候选节由内容审阅代理/根任务决定，本记录不以协议文本替代分类语义证据。根任务仍须核对实际实现字段、返回格式与本文件对应，并在最终冻结输入后更新当前审阅。

## 同轮用户补充后的最终协议（覆盖原强制双实现规则）

用户进一步明确Hcode/Scode无须成对、没有超纲或全部撤回时不显示标签体系。已逐文件替换原有相冲突的“每节手写＋标准”“完整双实现”等硬性表述，而非仅追加例外。同步CONTENT_PIPELINE、CHAPTER_STANDARD、QUALITY_WORKFLOW、IMPLEMENTATION_STANDARD、RESEARCH_FACILITIES、RESEARCH_DEPARTMENT、TASK_EXECUTION、AGENTS及两份docs。两种实现有区分价值时仍完整解析；不存在真实Scode时可只有Hcode，统一Scode且Hcode没有额外价值时可只有Scode，不造无关API替换、占位标题或缺失说明。

CONTENT_MODEL按schema代理确认接口同步：两条ImplementationIds可省/空但不可同时空；problem/fit/variation/engineering仍必需，仅对实际采用路径要求对应实现/解析facets；未采用路径可省/空。没有Scode时standardRole可省或{}，不造none。共享核心继续使用真实reuses与合法shared-core，不重复源码。

CONTENT_LAYERS、READER及各处入口明确标签的实际出现条件，最后超纲节撤回后隐藏整套双标签，原文和目录仍完整可用。代码门禁及运行效果由根任务后续验证。schema代理已实查course_snapshot遍历protocol/*.md，新增CONTENT_LAYERS会被真实生产input hash固定，不存在只写文档却未纳入版本基座的问题。
