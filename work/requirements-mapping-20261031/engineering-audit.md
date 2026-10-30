# 最新要求到研究与发布工程的核对

基线：`6a59203`，本任务开始时 tracked working tree clean。只核本项目当前设施，不修改公开读者界面、用户正文、历史研究档案或已封存交接。规则语义以当前正式协议及用户要求为准，工程只能核证据、关系、版本与实际测试。

## 核实的现状与缺口

### 已经落实：Hcode / Scode 不强制成对

`chapters.py:_paradigm_contract` 已允许任意一种实现路径，完整正式节只要求至少一个真实适用实现；相应解释facet只随已选择路径要求。无Scode时无需伪造standardRole。`tools/subheadings.mjs:applySubheadingPlan` 本来就是按实际代码逐一核归属、方向、唯一打印与共享引用，没有逐节强制两类标题。

一些测试夹具同时展示两种实现，是可比较的有价值案例，不构成生产模板或强制约束。已有实际单H、单S合同/代码验证及作者成稿回归保留，不能因为测试样例有两段而把设施误判为仍强制成对。

### 缺口1：原研究交接没有承载新的内容取舍要求

基线 `inquiry.py:_validate_data(final=True)` 的problemTypes只核题型、变型、材料和练习；阶段sessions虽能承载真实笔记，却没有要求核心学习依赖及实际实现取舍。新章可能完成七阶段和交接，仍未明确处理这些要求。

原研究BASE只固定书目/来源及两份研究协议，直接约束超纲与实现选择的规则没有全部作为真实研究输入。仅在文档里引用它们，不等于它们的字节已进入研究身份。

### 缺口2：新章能够省略默认分层，而正式quality没有独立检查“已经判断”

基线 `_extension_contract` 和Node投影将缺省reading.extensions解释为历史空分层，这个兼容本身合理；但正式chapter_quality也没有额外要求，所以新schema3章同样能省略。已登记超纲项虽然有合法节/思想标签/理由检查，主线为空名单或不分类的决定却无法辨认。

基线review仅有readerBoundary及四维承诺审阅，没有明确、当前版本的内容取舍审阅入口。普通accepted、编译成功或正文边界审阅不能替代超纲定义与实现必要性的真实回读。

### 缺口3：实际后台提示模板没有进入生产快照

`scripts/run-background.mjs` 实际读取 `protocol/background-prompt.txt`，而 `course_snapshot` 原来只枚举protocol目录的`.md`且未显式纳入该文件。仅改实际任务指引不会让旧review/packet因该文件变化而失效。此项由根代理负责最小修补和测试，本子任务不重复编辑learning.py或其父夹具。

## 本子任务已实施的最小补丁

### 研究侧

- `BASE` 增加直接规则 `CONTENT_LAYERS.md`、`CHAPTER_STANDARD.md`、`IMPLEMENTATION_STANDARD.md`、`REQUIREMENTS_TRACEABILITY.md`。与已有BASE方式一致，只固定实际存在的文件，保留研究可在最小测试仓库开始的能力；正式仓库当前文件均实际存在。
- 新 `_base` 固化 `contentDecisionsVersion:1`，新 `open_study` 同时记录该版本，并初始化 `scope.problemTypes:[]`。后者是恢复说明，真正执行规则版本取自不可变阶段BASE；删除mutable marker不能使已经开始的新研究降级。
- 版本1最终 `scope.problemTypes[].learningSupport` 含两个实质说明：`coreDependencies`、`implementationPlan`。可以明确只有科班基础、没有额外独立体系；可以只计划真实Hcode或只计划真实Scode。没有布尔难度开关、强制双版、固定节数或最终超纲标签。
- 字段在最终交接前校验。scope-review后的scope原有一致性约束继续生效，最终计划改变仍需重新scope-review；不能在C点之后悄悄添加一个不曾复审的计划。
- 阶段快照与交接BASE保存版本1。旧archive没有该字段按0读取，已有adopted研究保留原数据、笔记及归档；不回填新字段或重跑旧七阶段。旧基座不冒称新研究，正式采用仍须实际历史部署证明。

### 出版侧

- schema3当前正式 `chapter_quality` 要求 `reading.extensions` 显式为数组：无超纲也写 `[]`。结构validate、历史读件和Node装配仍可以读取缺省字段；兼容不被误报成已经完成分类。
- 当前review新增一个紧凑的 `contentDecisions:{outcome,findings,locations}`。outcome仅pass/gap，实际findings非空，pass至少有一处本章真实定位；gap、缺字段、空白文本或虚构位置不能发布。程序不判断文字是否敷衍或结论是否正确。
- 它复用整个review已有的当前inputHash与最终review字节绑定，不另造逐节平行元数据表、另一套note依赖或自动语义评分。研究对象与最终H2多对多，最终整节分类仍由本次实际综合审阅重新判断，不机械继承研究提案。
- 四维承诺、readerBoundary、实际实现/target关系、C++检查、准备包与上传前重核全部保留。通用accepted笔记及C++成功都不能旁路新增quality门禁。

## 实际验证

- `test_inquiry.py`：42/42通过，含新增5项：新依赖/单版计划进入不可变交接、缺learningSupport和删除mutable marker仍被挡、两个实质说明不得为空、直接规则变动使新研究过期、旧adopted研究不改原计划与归档字节。
- `test_inquiry_cli.py`：1/1通过，新open-study/status实际返回版本1，仍可在没有作者稿和课程之前开始研究。
- `test_chapters.py` 定向新增4项全部通过：显式空分类/缺省阻止当前发布，内容审阅的pass/gap/实际定位校验，generic accepted及技术成功不能代替内容审阅，教学字节变化使该审阅过期。
- `test_extensions.py`：5/5原结构回归通过。历史缺省兼容保留，PRE/子标题/未知或重复节/空标签等仍拒绝。
- 本子任务上述代码与测试 `git diff --check` 通过。

对应新测试名已发送给协议维护者用于唯一映射入口。根代理另外负责background-prompt绑定测试、当前真实章承诺/审阅更新、整体检查和实际发布；本报告不把其结果提前计入本子任务成功。

## 边界

这些设施使新要求有真实研究产出、当前出版审阅和机器门禁。非空文字、位置存在与绿色测试不能证明超纲判定正确、某一实现值得讲、读者已读懂或学习效果成立；这些仍由真实材料研究和当前语义审阅负责。没有因本次设施更新改写第一章旧研究、要求已出版第一章重新研究或新增读者说明性界面。
