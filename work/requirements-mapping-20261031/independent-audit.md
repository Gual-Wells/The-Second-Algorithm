# 从下一章生产入口逆向检查最新要求

日期：2026-10-31。起始Git基线：`6a59203846762cc6c272a5144663bcde2afd12a1`，分支`codex/continuous-ice-logo`。本次只读检查实际协议、CLI研究模型、第一章合同与测试；未重新评价37节、未改正文、未运行大测试。其他代理随后按根任务分工修复，下文先保留发现时的事实，再补冻结后的复核。

## 一个新Agent实际会走的入口

1. `AGENTS.md`要求先读CONTENT_PIPELINE、RESEARCH_FACILITIES、CHAPTER_STANDARD和QUALITY_WORKFLOW；后台真实模板`protocol/background-prompt.txt`另列研究/出版职责。
2. `research init/open-study`经`second_algorithm/inquiry.py::open_study`创建ledger、dossier、scope及study。`PHASES`固定overview、scope、alignment、collection、synthesis、scope-review、resynthesis；`study_status/resume`给出当前阶段及断点。
3. 新Agent研究来源/教材与已有章节，再封存交接。`inquiry._validate_data`核采用材料、分支、题型和原题关系；`_coordination`核每个真实已有章，不让旧章替代独立scope。
4. 编纂者按`reading.units[].researchTypeIds`把研究对象承接到最终PRE/正式H2。`chapters._paradigm_contract`、`tools/subheadings.mjs::applySubheadingPlan`和构建器限制章结构、实现身份与实际代码。
5. `chapter_quality`核当前研究、合同、逐承诺审阅及readerBoundary；`workflow.prepare_release/check_release`再绑定当前输入。阅读器和真实浏览器验证负责显示与行为，不替代分类和教学语义。

因此，不能把最新要求仅写成一次聊天认识；需要上述入口、研究证据、编纂合同、当前审阅及实际回归能相互指到。也不能把本章成品或历史研究档案当作下一章必须复制的模板。

## 已经有实质设施的部分

| 要求 | 当前可核的设施 | 可信边界 |
|---|---|---|
| 不因超纲或未来复用删范围 | CONTENT_PIPELINE/RESEARCH_FACILITIES明确全范围保留；研究分支/材料/题型及`researchTypeIds`关系受`inquiry`、`chapters._research_binding`检查 | 关系覆盖不证明推理已经讲清；不能自动推断算法只许讲一次 |
| 一章只有PRE与正式题型主结构 | schema3单逻辑document、实际H2归属/次序、selectionMap为空；compose-chapter唯一生成序号 | 多个物理作者源不应变成四篇。历史scope中的`part`只是旧研究信息，当前不应投成读者骨架 |
| Hcode/Scode按需而非配对 | `_paradigm_contract`按真实manual/standard路径要求对应facets，任一路径可空但不能双空；`applySubheadingPlan`核真实symbol/region及方向 | 单路径不是漏实现的豁免；不能仅因有`std::`就宣布一条独立Scode |
| 整节分类与不泄露内部reason | `reading.extensions`引用正式unit、稳定H2与tags；`_extension_contract`、`validateExtensionDefinitions/projectExtensions`拒绝PRE、局部块、跨章或重复归属，受保护投影只含sectionId/tags | 分类依据是否真的超出科班基础仍由实际内容研究判断，不能以名称或通过字段自动认证 |
| 普通链接解决共享依赖，不联动搬迁 | CONTENT_LAYERS/IMPLEMENTATION_STANDARD明确共享类型/函数可达；当前36到31为真实正文定义链接；已有code reuses也要实际链接、无环、到真实代码 | 不需要另建先修服务、自动恢复依赖或“请先学习”面板；存在链接不代表解释充分 |
| 条件单页与独立撤回 | `reader-runtime::applyLayer/restoreSection/showReader`；逐节owner状态；`check-extension-layers.cjs`覆盖有/无/全撤回、跨页、读位、持久化与失败 | 真实模拟浏览器不等于iPhone真机或用户审美验收 |
| 数学模型与实现域一致 | IMPLEMENTATION_STANDARD和CONTENT_LAYERS明确有解责任、数值范围、计数/容量、单调/恢复等回查；实际C++目标、原题与独立模型提供具体证据 | 某个固定例子通过不认证未来章；不把这张检查表变成每节必填的警告段落 |
| 内部话术不外漏、不把评分当验收 | readerBoundary的当前语义审阅与`reader-boundary.mjs`确定性检查分离；inquiry/quality多处声明automaticSemanticCertification:false | 不应把扫描、外部8.8/9.0评分或一个accepted值当成内容与学习通过 |

## 起始基线中的实质缺口

### 1. 主入口仍有一条会让空栏目复活的旧命令

`AGENTS.md`当时仍写“原PRE/中文节序、H3/H4及Hcode/Scode不更名不删减”。读者保护本意合理，但它没有限定为有价值内容和稳定定位，容易令新Agent拒绝合并没有独立职责的Scode标题，和最新按需实现相冲突。

最小修正是保护PRE/正式节骨架、真实内容和稳定引用，同时允许经过候选/协调及当前审阅合并空设或重复实现栏目；不应将“不得破坏内容”误写成任何H3都不可调整。

### 2. 历史“硬要求”与现行入口的状态边界不够醒目

`research/2026-10-28/paradigm-led-chapter-design.md`开头把当时“双实现”等称为“从现在起约束后续”，而它又是常见工程研究参考。旧第一章研究档案也实际有`manualPlan`等历史选择。

不能改写旧研究结论、快照或不可变交接。应在**现行**导航/恢复入口说明这些是当时证据，最新CHAPTER_STANDARD/CONTENT_LAYERS等才是现行要求；读旧报告为了理解取舍，不能把其中旧规则重新提升为当前命令。`docs/ARCHITECTURE.md`末尾对2026-10-28清零的无条件现状表述、`docs/RECOVERY.md`的首章空库表述也应明确历史时点，免得下一章错误当作空项目恢复。

### 3. 研究基座没有绑定直接影响研究判断的新协议

基线`inquiry.py::BASE`只含books、sources、RESEARCH_DEPARTMENT、RESEARCH_FACILITIES。`_base`只哈希这些实际文件，不递归哈希它们文中引用的CONTENT_LAYERS。因此，若只改变“何为超纲”的直接规则，在研study的`study_status`不会因该规则改变而提示复盘；最终course快照会感知，不代表研究阶段已经绑定。

最小修正是将直接研究语义规则加入研究基座或等价的明确版本关系，并用小型变更回归核实。现有已采用研究的`adopted`历史边界要保留；不能让一次新设施声明迫使第一章重跑七阶段。

### 4. 新章“忘记分类”和“审过后为空”没有门禁区别

基线`chapters.py::_extension_contract`在reading无extensions字段时直接返回；`tests/test_extensions.py::test_valid_whole_section_and_explicit_empty_or_legacy_absence`也明确验证该兼容行为。`chapter_quality`没有再区分新采用与技术/历史读取，所以新Agent复制一个不含该字段的schema3例子时，可能未研究分类就获得默认单页。

兼容旧技术读入可以保留；新当前采用应明确记录`reading.extensions`，允许`[]`。这是确保“做过选择”的最低结构证据，不是自动断言分类正确。不能改成算法名黑名单或强迫每章都有超纲，更不能因为tags合法就认定语义通过。

### 5. 文本承诺和后台执行入口仍可能把新选择说回旧配额

基线当前章`commitments.complete-type-chain.claim`还写“每型兑现…手写、真实设施…”，review的hard-variants理由残留“双实现”。真实第一章18/35已按需处理；这些文本若被复制，仍会把选择性实现理解成固定配对。

后台模板也只要求保持“Hcode/Scode”等旧概括名，未直接提示按需路径、核心依赖判定与当前分类证据。最小修正是更新真实执行模板和当前承诺的准确含义，并确认模板字节确实进入执行/生产输入绑定；不能只改一篇无人加载的说明。

### 6. 研究资料支持与当前语义审阅之间仍有容易漏掉的交接面

基线研究结构验证了材料mechanism/conditions/variants/crossParadigms、题型及练习，而“实际实现为何只选一种”“核心依赖具体用于何处”“候选分层依据与普通共享定义位置”主要靠自由笔记。出版review虽有一般承诺与readerBoundary门禁，尚没有本次最新决策的明确对应记录。

这不是程序应该自动理解论文或教材的理由。必要的最小补丁是把已要求的判断落入既有研究对象/最终当前审阅的真实证据关系，并核合法定位和版本，保留语义人工判断；不要建立第二本教材、额外依赖服务或多套重复状态表。是否需要专门字段，由整合者按实际漏检风险选择；字段存在不认证判断为真。

## 不能误报成缺陷的事情

- 手写和标准设施在字段名中仍分别存在，不等于仍强制两者成对；当前单H、单S测试与实际角色检查已解除旧限制。
- `reading.extensions`有reason且结构通过，不等于程序把“整体二分”等名称自动判为超纲。语义不由名字白名单实现是正确边界。
- 不能通过给scope或dossier统一加“高级”枚举，机械把研究对象直接映射成最终H2。编辑可能归并/拆分，最终整节仍要重新判核心依赖。
- `sources.priority=extension`、`contract.scope.extensions`（领域扩展关系）与`reading.extensions`（默认超纲呈现）并非同义；适合在术语入口明确区分，不需重命名全部历史记录。
- C++知识权威唯一，算法理论/题型可以在各章从自己的视角再次完整讲清。当前协议已明确这一点，不能因此要求复制所有稳定知识全文，也不能为“未来章”推迟当前必要推理。
- 不能在本次映射工程中重写旧交接、重评37节、再发一次相同网页，或把外部评分加入release阈值。

## 映射表的实际名称核对

新建`protocol/REQUIREMENTS_TRACEABILITY.md`的当前显式case名称已逐项对照源码，以下均实际存在：

- `built-body-partition-and-exact-conservation`
- `shared-directory-and-cross-layer-links`
- `restore-one-section-persist-and-owner-isolation`
- `all-restored-returns-to-one-page-and-legacy-route`
- `publication-without-extensions-has-no-tab-system`
- Python单路径方法`test_only_hcode_requires_its_real_explanation_but_no_fake_scode`与`test_only_scode_requires_its_real_explanation_but_no_fake_hcode`

`carrier-subheadings.test.mjs`的真实生成case是`a real hcode-only section composes without an artificial paired unit`及`a real scode-only section composes without an artificial paired unit`。表中“真实单H/单S装配”是概括说明，不是冒造完整测试名。当前不需为了改表而改这几处正确引用。新增learningSupport/contentDecisions映射待实现冻结后复核，不能提前当作已完工。

以上仅核真实路径、symbol和测试职责，未在本轮重新运行这些大套件，不以文件存在声明本轮通过。

## 冻结后复核

2026-10-31在研究、出版及协议代理宣布源码冻结后，按新Agent入口重新逆向核对。上述段落保留为发现时基线，以下为实际修补后的闭合结论：

1. **现行入口与历史边界已对齐。** AGENTS、README和RECOVERY进入唯一映射`protocol/REQUIREMENTS_TRACEABILITY.md`；AGENTS已将原先不可删的Hcode/Scode栏目改为保护真实题型与必要内容、允许经标题管理合并空设或重复实现。ARCHITECTURE明确清零为空是初始化历史，当前状态须依实际出版登记；旧研究、评审和不可变交接只作当时依据，不被回写成现行新规则。来源`priority:extension`、领域`scope.extensions`、读者`reading.extensions`已明确消歧。未发现这些现行入口仍要求按名称分层、强制双版或为未来章漏讲的冲突。
2. **研究判断有真实持久载体，且不能删mutable版本降级。** `inquiry.py::BASE`直接加入CONTENT_LAYERS、CHAPTER_STANDARD、IMPLEMENTATION_STANDARD和REQUIREMENTS_TRACEABILITY；`_base`将`contentDecisionsVersion:1`写入实际阶段基座。`open_study`给出版本和空题型列表；`_validate_data(final)`要求每个最终题型的`learningSupport.coreDependencies`与`implementationPlan`为非空说明。`checkpoint`以当前真实base执行，`study_status`和`check_handoff`读取不可变最终base的版本，因此移除study.json中的标记不能免除新要求。研究对象仍不自动给最终H2选主/副页，也不要求H/S配对。`test_legacy_adopted_research_keeps_its_original_plan_and_archives`定义的旧已采用研究兼容保留原字节，不冒称当前新研究。
3. **当前采用明确区分“审过没有超纲”与“忘了分类”。** `chapters.py::chapter_quality`要求schema3的`reading.extensions`显式数组（允许`[]`）；技术结构验证和旧读件缺省兼容继续保留。相同quality入口在既有readerBoundary之外核`contentDecisions`的pass/gap、非空findings和真实正文locations，沿当前inputHash及最终review字节绑定。没有新增评分阈值、逐节重复状态表、按算法名称的自动分类器或从研究材料优先级直接推导呈现的规则。
4. **按需实现与必要共享定义没有倒退。** 既有单H/单S实际角色、对应facets、权威代码symbol和验证依赖仍由实际实现选择驱动，两路全空依然不合格；新研究只记录取舍依据。当前合同`complete-type-chain`已改为“实际适用的实现及解析”，当前审阅hard-variants不再残留强制“双实现”。共享代码仍用普通定义链接，不联动迁移其他节；完整H2与其下属内容共同分层；无超纲或全撤回回单页，这些读者规则与原有实际回归对应。本轮没有新增先修卡、说明性界面或改写读者正文。
5. **真实后台任务模板已绑定。** `scripts/run-background.mjs`读取的确为`protocol/background-prompt.txt`；`learning.py::course_snapshot`显式纳入这个精确文件，模板改动因此参与审阅/准备输入身份。真实定义`test_actual_background_template_is_bound_but_private_run_data_is_not`和`test_changed_background_template_invalidates_the_prepared_packet`分别覆盖实际模板输入、私有run数据排除及旧准备包失效。不是仅将另一个说明文档纳入哈希。
6. **映射表没有以测试存在代替本轮通过，也未扩大机器语义能力。** 表中明确case/symbol均能在对应源文件找到，且承担所述职责；本代理无需修任何cell。研究与出版新增回归名亦已实际核对：依赖/实现计划、mutable降级、空字段、直接规则失效、历史采用，及显式空分类、当前内容审阅、generic accepted不能替代和教学字节变更失效。非空文字和有效定位只能证明结构证据存在，不能证明判断真实、实现值得讲、全部资料已读或读者掌握；映射已保留人工研究/当前语义审阅职责。

**独立结论：** 在本轮要求范围内，现行入口、实际研究输出、出版采用门禁、执行模板与回归定义已形成一致链路；未发现需要继续扩展功能或重发同一网页的实质缺口。上述是对实际源码、字段、调用路径与测试定义的独立逆向审阅。本代理本轮没有重新运行大套件；工程代理报告的42项研究、4项新增出版、1项CLI、5项结构，以及根代理报告的2项模板回归，均属于各执行者的验证记录，不冒称本代理重跑。正文/前端字节保全、总体测试、提交及是否发布由根代理分别留证，不能从本审阅推断成功。
