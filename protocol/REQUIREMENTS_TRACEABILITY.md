# 最新要求的研究—出版—检查映射

本文件是最新用户要求到实际设施的**唯一汇总入口**，不是另一套语义协议、字段定义或通过收据。完整性/编纂依CHAPTER_STANDARD，超纲依CONTENT_LAYERS，研究顺序依RESEARCH_FACILITIES，字段以CONTENT_MODEL及实现为准。新增要求先更新相应唯一规则，再更新本表；不在多个文档复制同一份状态表。当前检查、部署和用户实机认可仍分别留证。

## 同一要求必须走完整链路

| 用户要求 | 研究阶段实际产出 | 出版怎样采用 | 机器与人工分别检查什么 | 已有回归入口（不是本次通过声明） |
|---|---|---|---|---|
| 大思想范围完整，分层不删内容 | overview/scope独立确立领域；alignment协同；collection/synthesis取得主要分支、条件、组合应用与证据；scope-review/resynthesis反查并跟进 | 最终编辑以`researchTypeIds`把完整研究对象映射到PRE/正式题型，主/超纲只改呈现 | 机器核范围/材料/对象映射、正式H2归属和当前输入；人工核机制充分、跨思想内容未被“超纲/未来”吞掉 | `tests/test_inquiry.py`、`tests/test_chapters.py`、`tests/test_composition_inputs.py` |
| Hcode/Scode按价值选择，不成对凑写 | 新研究最终题型的`learningSupport.implementationPlan`说明手造解决什么、真实设施承担什么、为何单用或并列；范围复审排除形式性API替换 | 只刊实际需要的实现/解析；可仅Hcode或仅Scode，两个有区分价值才均保留；不改变问题、推导与练习完整性 | 机器按实际implementation路径要求对应facets、合法类型、源码/符号和验证依赖，拒绝两路全空；人工核选择依据及真实价值，不以`std::`存在证明Scode必要 | `tests/test_chapters.py::test_only_hcode_requires_its_real_explanation_but_no_fake_scode`及`test_only_scode_requires_its_real_explanation_but_no_fake_hcode`；`test/carrier-subheadings.test.mjs`中的真实单H/单S装配 |
| 空设/重复实现栏目可以调整，标题仍规范 | 作者先按真实学习单元提出候选；因内容实质变化重新保存候选，保留旧快照 | 经`catalog/subheadings.json`协调实际采用的H3/H4及Hcode/Scode；不为凑类型保留空栏目，不借此删减/重组正式H2；保全稳定定位与引用 | 机器核候选、管理项指纹、完整决定、实际代码归属与reuses；人工核合并/去空是否保全必要内容、名称是否清楚 | `tests/test_subheadings.py`、`tests/test_practice_structure.py`、`test/carrier-subheadings.test.mjs`；`tests/test_composition_inputs.py` |
| 只有核心依赖独立高阶体系的整节才超纲 | collection记录思想/代码依赖及具体作用；synthesis形成候选；scope-review挑战基础误判；resynthesis的`learningSupport.coreDependencies`保留实质依据及争议处置 | 按成稿整节再判断，合同`reading.extensions`登记正式unit、思想标签和内部理由；只把稳定H2定位和标签投影给受保护读件 | 机器核正式节/H2、标签、内部理由及投影无泄漏，正式quality要求显式extensions和当前contentDecisions；人工按用户定义核基础CS/局部补充/困难不算，不能复制第一章名单 | `tests/test_extensions.py`、`test/carrier-extensions.test.mjs`；分类语义仍须当前人工回读 |
| 共享目录、整节原位独立撤回，不联动 | 研究查真实共享代码和前提，保证依赖可定位，不用依赖关系触发批量搬迁 | 完整H2及其H3/H4/代码/练习同行；目录保持全序，超纲从属有阴影；撤回只清该节临时标签/按钮/阴影，原位回主线 | 机器核源码/投影、正文守恒、跨页链接、owner持久状态及失败保全；人工核目录、阴影与动作语义，不增先修面板或说明性功能 | `scripts/check-extension-layers.cjs`：`built-body-partition-and-exact-conservation`、`shared-directory-and-cross-layer-links`、`restore-one-section-persist-and-owner-isolation`及离线/失败场景 |
| 无超纲或全部撤回，不显示标签体系 | 分类可空，完整范围不因没有副页而改变 | 仅存在未撤回超纲节时出现双标签；最后一节撤回后回单一读面，目录与正文保留 | 机器核空分类、全部撤回及旧路由可用；人工核没有空副页、占位页签或额外说明 | `scripts/check-extension-layers.cjs`：`all-restored-returns-to-one-page-and-legacy-route`、`publication-without-extensions-has-no-tab-system` |
| 通用表述、数学前提和实现边界相符 | 对材料取得的原题约束、计数/存在性论证、无解责任、数值区间及反例反复核实；新问题定点补研究 | 在真正作用处解释条件与代价；库等价实现、局部替换、替代算法分别讲，不用徽章替代推理 | 机器编译/独立模型核具体实现，不能证明正文推导；人工逐项核数学域/代码域一致、前提承担者、容量并非满占、单调并非可精确恢复 | `tests/cpp/chapter01_*.cpp`仅是当前章验证目标；新章须自己的实际目标与当前语义审阅，不复制第一章测试数充当通过 |
| 不把内部流程穿透成读者内容 | 研究依据、选择、争议、测试/OJ及发布状态留工作记录 | 读者只见问题、推理、必要实现/知识、练习及所需动作，思想标签/撤回属于真实功能；内部reason不投影 | 构建核确定性读者边界，review核真实全部表面；两者不能互相替代 | `test/carrier-reader-boundary.test.mjs`、`tests/test_chapters.py`的readerBoundary采用检查、`test/carrier-extensions.test.mjs`的投影无内部理由 |

测试名带`::`只表示便于检索的`文件::symbol`，不是要求直接以该串运行命令。标准运行入口仍为TASK_EXECUTION及`npm run check`。

## 证据放在哪里

研究证据沿已有dossier/findings、综合sessions、范围复审及其持久notes记录真实判断和来源；新study按`contentDecisionsVersion:1`在最终题型`learningSupport`保存核心依赖与实现取舍，不生成读者先修卡或第二份正文。研究交接固定实际证据字节；编纂不能机械复制研究分类到最终H2，应再次核成稿核心。完整字段以CONTENT_MODEL为准，表格不创造未实现字段或新的自动语义认证。

当前出版合同的`reading.extensions`必须显式数组（可以为空）；章审阅的`contentDecisions`须在当前inputHash下有pass、真实综合findings及有效正文locations。它不重复建立逐节表，也不替代readerBoundary及其他采用要求。当前出版合同/章审阅、实际作者源与代码、标题候选/协调决定及受保护投影分别有自己的职责。内容/协议/工具变化后按受影响输入重审和验证；不能仅换hash追认。已实际出版旧研究可保留精确历史基座，当前定点修订不自动重跑全部旧七阶段；新的研究交接仍按当时现行基座完整执行。

## 术语与历史边界

来源池中的`priority:extension`表示资料使用优先级，章合同`scope.extensions`描述领域扩展关系；二者均不等于`reading.extensions`的默认超纲节路由，不能按同名自动映射。历史研究/评审/候选设计保留当时结论及原字节，只作来源与取舍依据，不覆盖现行用户定义、实现选择或产品规则；不为更新入口而回写旧handoff、快照或已绑定笔记。

## 当前确定性边界

上述新研究learningSupport、实现选择条件facets、当前出版contentDecisions、整节超纲结构/投影、条件标签与独立撤回分别对应实际字段/校验或回归入口；“选择是否有价值”“分类是否符合用户定义”“推理是否教清楚”由实际研究及当前人工审阅判断，不能伪装成程序已理解。结构门禁能阻止缺证据、空数组之外的缺省旁路或过期审阅，不认证字符串的语义真实。

本文件及所有`protocol/*.md`由`course_snapshot`纳入当前生产输入。后台真实任务模板`protocol/background-prompt.txt`由`run-background.mjs`加载，并已作为精确文件进入生产输入；模板变化会使审阅/准备包过期。对应回归在`tests/test_learning_workflow.py`的模板输入与`test_changed_background_template_invalidates_the_prepared_packet`，不能只改文字却复用旧包。发布仍需真实研究、当前采用、权威代码及载体验收、有效准备包和独立成功部署收据。

CI把技术检查与正式采用作为两个独立步骤：技术通过后仍须`course quality --json`成功，不能用技术命令只打印的出版阻塞提示冒充总体完成。当前源按仓库规范字节绑定，跨平台换行差异按TASK_EXECUTION定位，不放宽精确哈希或改写旧研究档案。
