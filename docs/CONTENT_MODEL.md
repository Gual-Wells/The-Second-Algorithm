# 当前算法领域、题型与知识模型

`catalog/learning.json`登记任务/方法/实现/知识/验证；`carrier/publications.json`登记统一出版顺序；`catalog/chapters.json`连接大思想合同与真实审阅。旧cases/patterns仅为来源和历史研究，不计算当前课程覆盖。下面描述确定性职责；程序不自动研究、分类、证明语义完整或测量用户掌握。

## 正文之前的研究设施

研究的语义工艺见 `protocol/RESEARCH_FACILITIES.md`，实际模型见 `second_algorithm/inquiry.py`。研究档案独立于有效的作者课程，不能先要求成稿再留研究证据。

`research open-study <job> --chapter <id>` 在已有job的 `work/jobs/<job>/study/` 创建研究状态和动态档案。当前study、checkpoint和handoff采用schemaVersion2；ledger/dossier/scope仍为schemaVersion1，普通job/准备包/部署收据继续采用各自现行版本。初始生成项是待研究状态，不能当作已读证据：

| 文件 | 内容 |
|---|---|
| `study.json` | job、chapter、createdAt、active当前阶段链、history全部阶段指针、lastHandoff；指针保存path/sha256 |
| `ledger.json` | 全部书目/来源、已有正式章及增量外部来源的entries；按阶段逐项判断相关性与读取情况 |
| `dossier.json` | materials、findings、questions、searches，分别保存材料处置、综合发现、未决和真实检索 |
| `scope.json` | paradigm、title、mechanism、branches、exclusions、completenessArgument；最终再有prelude和problemTypes |

资料不是正文的复制版，也不是只有链接的清单。结构字段固定可回查关系；完整结论、实际读取范围/版本、反例、负结果、工程边界与后续动作写入其引用的持久Markdown/JSON笔记。

### 动态档案字段

- `ledger.entries[]`：id为`book:<登记id>`、`source:<登记id>`、`chapter:<已有正式章id>`或`external:<局部id>`；relevance为related/excluded/unavailable/pending；reason、locator、readState、materialIds及core表达处置、读取定位、提取关系和重要性。外部来源另有url。readState为directory/read/analyzed/unavailable；目录不等于读正文。核心来源不可得时用replacementMaterialIds指向已分析采用的替代材料，并说明替代范围与限制；缺替代则阻止最终交接。chapter身份由当前published正式章登记及其collection核实，排除本章、隐藏/草稿/撤回历史。
- `materials[]`：id、source指向ledger、locator、readState、note、disposition及reason。disposition为included/merged/excluded/pending；merged用mergedInto指明规范材料。note是`work/`下原创/派生的非空.md或.json，不是商业原书。最终采用/合并材料补mechanism、conditions、variants、crossParadigms和exerciseUrls，说明可复用机制及实质差异。
- `findings[]`：id、materialIds、branchIds、claim、note。最终有problem、mechanism、conditions、variants、crossParadigms和exerciseLinks（title/url），形成分支/题型综合，不能把每个链接都当新发现。
- `questions[]`：id、status为open/resolved/deferred、reason、core。核心问题未resolved阻止交接；非核心延期仍需真实理由及影响说明。
- `searches[]`：id、query、source、result、note。保存实际检索与结果，包括无有效结果；检索计划不冒充已执行。
- `scope.branches[]`：id、title、status为included/excluded、reason、materialIds。纳入分支须有实际分析材料与综合，排除不靠“以后再说”。
- 最终`scope.prelude`说明理论前置计划；`problemTypes[]`包含id、title、branchIds、materialIds、exerciseUrls、problem、variation。每题型1–5个练习URL必须已存在于所指材料，纳入分支都应有题型承载。正式内容仍须额外落实手写/标准设施/C++等产品要求。

全部已知书目/来源和当前已有正式章必须有台账身份。overview与独立scope前完成书目/站点/已知外部来源判断；chapter此时可以pending，仅盘点身份，不提前以旧章内容限制独立候选。alignment时完成已有章协同处置并有实际分析材料；collection开始相关来源须有提取材料。最终没有pending材料，采用材料已分析、没有孤立采用材料/分支，合并关系须可解析到实际采用材料而无环；核心问题和核心不可得依据不得悬置。原题链接及读取状态的真实性仍由研究者负责，HTTP地址存在不证明读过。

chapter来源材料通过真实locator和work笔记支撑协同判断，在alignment和scope-review使用。比较用材料可以说明理由后excluded，不强迫把旧章全部作为本章教学内容采用；这与因内容曾出现而删去当前算法所需讲解不同。相关部分按需实读，无关部分允许目录/范围判断加分析记录。旧章提供本项目历史内容与关联证据，原题约束、算法/标准结论仍须回到相应原始权威。

### 阶段记录与不可变身份

阶段顺序为overview→scope→alignment→collection→synthesis→scope-review→resynthesis。每阶段记录JSON都含真实summary和非空notes路径列表，另有：

| phase | 专项记录 |
|---|---|
| overview | corpusUnderstanding、publicationReview、candidateBasis；publicationReview此时为正式章身份/状态盘点 |
| scope | candidates（name/decision/reason）、selectionReason、independentBasis、basisMaterialIds；基于教材/来源/外部材料的独立范围提案 |
| alignment | chapterCoordination；在独立scope之后与已有正式章节协同，配合scope.json确定真正初始范围 |
| collection | extractionSummary、limitations |
| synthesis | sessions（question/materialIds/findings/implications）、unresolved |
| scope-review | decisions（branch/action/reason/materialIds）、challenge、scopeConclusion、chapterCoordination；已有章作为资料再次协同 |
| resynthesis | sessions、resolvedChanges、finalArgument |

scope-review.action为retain/add/merge/exclude/correct，merge另用mergedInto指向当前分支；不能无说明地让前轮分支消失。challenge保存researcher、perspective、independent:true、inputMaterialIds、findings、note、responses。应在笔记中逐项回应挑战与范围变化，后续sessions/resolvedChanges真实跟进，不以非空字符串证明已完成。研究可以反复返回，不规定代理数、资料数量或机械重复轮数。

scope记录的independentBasis说明独立候选依据，basisMaterialIds指向已分析且非chapter来源材料。这项独立性约束研究次序与可核依据，不要求模型忘记既有知识。独立scope快照保留当时范围；alignment及后续范围修订不能回写旧快照。

alignment和scope-review的 `chapterCoordination` 包含：

- `chapters[]`：每个当前已有正式章恰一项，含chapter、relationship（overlapping/adjacent/separate）、reason、overlapTreatment、note及materialIds。note为实际持久分析笔记，materialIds对应该章来源的已分析材料和读取定位。
- `domainIndependence`：当前范围何以仍为大而独立明确的算法思想领域。
- `globalBreadth`：结合全章目版图判断广度，防止过拟合相关性陷入局部，同时不强求零近邻。
- `scopeDecision`：此次协同导致的保留、调整或改选及依据；不强迫为了字段制造范围变化。
- 无已有正式章时chapters为空，另填`emptyReason`说明真实空状态；阶段仍保留，不虚构旧章。

这里的重合/相邻/相对独立均是允许的关系，不设数值阈值或自动拒绝规则。C点的chapterCoordination须结合本轮研究重新分析，当前题型与算法必要内容不因已教而删减；稳定C++知识继续复用独立权威。程序核身份、读件关系及阶段，语义判断由研究者负责。

checkpoint保存 `snapshots/<uuid>/checkpoint.json` 及 `files/` 中的证据字节，含phase、previous、record、data和文件哈希。归档原始路径的派生笔记/档案，不归档商业原书。active必须是合法阶段前缀；重交早期阶段截去当前后缀但history保留。已有阶段文件、归档和前驱不能原位改写；不要为修hash规范化已封存文件的换行。

动态资料增加不抹去独立提案或初始范围的历史。当前档案/笔记变化会显示changedFiles，最终交接需最新resynthesis；scope在scope-review之后改变须先重新scope-review。在研与初次采用时，书目/来源与声明的研究协议基座变化需要恢复overview。已有正式章前沿排除本章自身collection，允许研究交接后注册本章；其他正式章的范围合同、实际正文/源码、相关任务与知识依赖改变会触发复盘。此前沿身份保护不等于系统自动读懂了其他章节内容，仍须alignment和C点的实质协同。本章排除是为避免自引用，不允许借改其他章身份绕过影响判断。

`study-status`显示phase、nextPhase、changedFiles、errors、readyForHandoff及scope、pendingSources、pendingMaterials、unresolvedQuestions、nextActions，便于恢复具体断点而非只看红绿。封存后nextPhase为authoring。`seal-handoff`生成 `handoffs/<uuid>.json`，固定当前阶段链、资料、范围与输入身份，`study.json.lastHandoff`指向当前交接。`check-handoff`核身份、归档、依赖、当前材料和范围并返回inputs；旧交接被后续checkpoint或新交接替代后不能继续采用。交接及每阶段都声明automaticSemanticCertification:false。状态/归档/收据是内部文件，不是PWA内容。

### 已出版交接的历史基座

初次研究、study-status、直接check-handoff和新seal始终按当前全局基座检查。出版侧对已证明成功部署的精确chapter/path/sha256，可核其历史采用，避免来源池扩张或下一章使所有旧研究被迫重做。此资格只属于那份交接，准备、accepted、手改published状态不构成发布证据。

内部 `check_handoff(..., adopted=True)` 仅由出版侧在核实成功部署证据后调用，无对外CLI开关。它保留原阶段链、归档、当前study指针、本章ledger/dossier/scope和笔记字节检查，仅不要求当年的全局书目/来源/研究协议与其他章前沿等于今天；当时登记的来源宇宙在不可变研究档案中保留。返回adopted与baseCurrent以区分历史采用和当前基座相同。

成功证明来自 `work/jobs/*/deployments/*.json` 与其指向的同job不可变准备包。部署收据schemaVersion1须有passed:true、anonymousBoundaryVerified:true、正确origin、build、带时区deployedAt、packet、packetSha256、inputHash及researchHandoffs。packet必须是该job的 `releases/<id>.json`，其字节摘要、prepared状态、passed、content-release操作、job/id、输入图摘要都匹配；receipt的inputHash与完整researchHandoffs数组须与packet一致，并含精确chapter/path/sha256且current:true。旧收据缺少新字段，不自动追认为历史采用。

核实器选最早有效证明，后续部署不会不断替换证明造成新的自引用失效。其部署收据、准备包和origin配置字节加入采用后的生产闭包。章级quality的researchHandoff除path/sha256/current外保存adopted及adoptionProof（null或deployment/packet路径）；发布包的researchHandoffs在此加chapter，部署收据复制同一数组。证明是本仓库操作记录的相互校验，不是加密签名或语义认证。

已采用研究闭包保留全部本章研究文件，不强迫新全局资料进入旧研究的历史身份；当前全局与内容仍受完整生产快照、当前章级审阅和发布验证约束。实际发现更正或遗漏影响旧内容时仍须定点研究与修订，不以历史采用自动通过。

## 大思想合同与题型节

chapters登记schema1的`chapters[]`仍为`id/collection/contract/review`。每个published chapter恰对应一项，合同与审阅路径须是持久仓库文件；不能删除登记退回旧门禁。章名/章号由publication负责，不在此复制正文。

合同schema2保留reader、scope、reading、materials、commitments，并加入paradigm和prelude：

| 字段 | 职责 |
|---|---|
| `reader` | startingPoint、targetCapability、supportPolicy，明确已有基础、目标与知识支撑 |
| `scope` | core、extensions、exclusions及completenessArgument；排除有真实理由，不以未来名词代替当前承载 |
| `materials` | 局部唯一id、kind、locator、evidence与sourcePaths；固定真实读件/归并证据，不上传商业原件 |
| `paradigm` | status、name、mechanism、coverageArgument、corpusEvidence与branches；表达共同思想和全景材料归并 |
| `paradigm.branches[]` | id、title、status、materialIds、sectionIds、crossParadigms；主要分支与题型/交叉思想的实际关系 |
| `prelude` | status、locations，思想理论前置的实际位置 |
| `reading` | status、entry、units、selectionMap；units是正式题型节，不是任意问题簇 |
| `commitments` | id、dimension、claim、acceptance、status、taskIds、locations、materialIds；四维真实承诺 |
| `researchHandoff` | 不可变研究交接的仓库相对path；章级采用/发布必须检查当前有效性及实际范围承接 |

status为open/addressed；open必须给具体gap，addressed不得暗藏gap。schema1旧合同只支持结构恢复，不能作为新硬协议的发布采用。2026-10-28全部出版与作者内容已清零，当前无章合同或知识资产；旧专题及采用仅在历史恢复，不能直接追认为新大思想章。

paradigm.corpusEvidence引用materials内实际教材/来源筛选归并读件；addressed领域须有证据和分支，addressed分支须有真实材料与题型落点。相关材料全部读过、分支是否充分仍须Agent判断；字段非空不认证全面。

reading.units保留id/title/taskIds/locations，新增：

- `dependsOn`：本章更早的正式节身份，按实际作者顺序形成依赖。
- `facets`：problem、fit、variation、manual、manualExplanation、standard、standardExplanation、engineering八项正文位置。它们是语义落点，不强迫八个固定小标题，可自然共享明确位置。
- `manualImplementationIds/standardImplementationIds`：属于本节任务的真实实现。manual引用手写；设施角色为algorithm/structure时引用standard实现，support/shared-core允许复用核心但必须解释设施实际承担的层次。
- `standardRole`：kind为algorithm/structure/support/shared-core，explanation说明真实替代职责，不虚构整题库解。
- `exercises`：1–5项title/url，来自本节task.sourceUrls并在所属正文中有实际可见链接；同节不能重复URL。

正文位置为`{document,anchor}`，只认真实显式锚点，排除注释/代码示例假锚点。题型主位置对应实际H2且归属唯一；前置先于正式节，entry指向前置，selectionMap位于题型之后，facets在自己题型范围内，不能借别节内容充数。除前置、题型和选择地图外，不允许无归属H2让证明/支撑抢占目录。多文档顺序服从当前出版顺序。

结构允许诚实施工open，包括研究尚未交接；`course quality`另查研究交接、领域/前置/分支/阅读/承诺是否已addressed、审阅是否当前有效。合同paradigm.name须与交接scope.paradigm一致，采用分支与交接纳入分支对应；各分支材料应承接研究材料，合同materials.evidence与资料note对应。reading.units身份须承接scope.problemTypes，分支—题型关系一致，正式练习从该研究题型已有exerciseUrls选择；编纂新发现须回到研究修订计划，而非另搜凑数。旧schema、关键open/gap、缺/过期/不匹配的交接、缺/过期/needs-work审阅阻止内容发布。数量、位置与关系正确，不证明题型有代表性、练习真正匹配或完整链讲解充分。

## 统一出版与学习关系

出版schema2的collection.kind为chapter/draft，无track；章号是全课程唯一正整数。draft必须hidden且无章号；文档ID全局唯一，path指向`content/<unit>/<稿名>`，配套source.md/cpp及生成读件。

根state为active或withdrawn。active有真实发布文档、知识、任务和验证目标；withdrawn无published文档且learning.questions/tasks/targets为空。原稿、hidden登记和私人状态可保留，不能用空active或假目标绕门禁。withdrawal验证明确不适用C++编译，但仍要载体/浏览器/真实SW检查；恢复active后重新走实际研究与验证。

learning.schemaVersion=2：

| 集合 | 约束 |
|---|---|
| `questions[]` | 内部Q加至少六位数字且大于0；title、source、prerequisites、非空sources；不再绑定published document/anchor |
| `tasks[]` | id、title、document、非空contract/sourceUrls、methods |
| `methods[]` | 任务内唯一id、title、非空invariant、implementations |
| `implementations[]` | 全局唯一id；manual/standard/alternative；source、regions、symbol、standard、非空questions、complexity.time/space、target |
| `targets[]` | 全局唯一id；run/compile/compile-fail；source；c++17/20/23；timeoutSeconds在1–120 |

source为实际`content/knowledge/<name>.md`独立知识源，一文件一权威，首行`# 语义标题`与登记一致。完整正文非空，内部ID不进入读者标题。prerequisites须存在且无环，sources为实际HTTP(S)来源；同一内容不能换ID重复登记。精确知识小节使用语义显式锚点，不把旧算法章节路径当知识身份。

实现regions对应权威cpp的BEGIN/END，symbol在区域中真实定位，target的依赖闭包包含实现源，验证标准不早于实现。文本定位不证明调用覆盖；Agent须核测试驱动实际调用。quoted include、additionalSources、显式dependencies及defines支持必要多文件目标，不为简单题造复杂工程。

## 知识作者语法与成品语义

```text
[[Q000027|聚合初始化]]
[[Q000029#lifetime|借用寿命]]
{{knowledge:Q000027}}
```

第一种显示语义名称，第二种指到知识精确段；未给label时用登记语义title，编号不外显。完整首次讲解通过knowledge标记从同一源装配为不统治题型目录的支撑块；全项目最多一处首次完整内嵌，后续引用在浮窗显示相同权威。卡内可引用其他知识，但不能递归内嵌完整知识。未知引用/锚点、重复首次主讲、前置环、空正文、编号标题及未解析临时键应失败。

场景新推理仍写在题型正文。知识卡不意味着算法解释只能一次，也不代表用户已掌握。首次教学不应变成大段语法前置；后续复用可补原知识的适用条件，保留内部身份和明确定位。

构建把所需知识作为受保护静态资产随引用依赖发布，复用现有鉴权/缓存和sheet；不新增D1知识表、后台生成API或新服务。原章节撤回不应使仍在使用的知识断链；私人笔记生命周期与知识出版分开。载体具体资源身份和离线规则由实际builder/sw决定，不能用作者标记存在推断已完成实机验收。

## 命令、验证和输入身份

```sh
python -m second_algorithm course validate
python -m second_algorithm course chapters [chapter-id]
python -m second_algorithm course chapter-inputs chapter-id
python -m second_algorithm course quality [chapter-id] --json
python -m second_algorithm course targets
python -m second_algorithm course search Q000001
python -m second_algorithm course verify --compiler <已有编译器>
```

内部CLI可按Q检索，不表示读者界面需要编号索引。verify实际编译所有目标，run再运行，compile只检查编译，compile-fail只接受正常编译诊断且不运行；崩溃/缺失/超时不是预期成功。采用O2、Wall/Wextra/Wpedantic及库断言，Windows隐藏subprocess窗口，TEMP/TMP/TMPDIR与输出在仓库D盘.local独立尝试目录，不自动安装编译器。

输入快照覆盖登记、当前作者/源码/生成件、知识源、材料/合同/审阅依赖、实际实现/target闭包、来源池/书目、有效AGENTS/protocol/model及reader/worker/builder/验证/依赖锁/迁移等生产输入，排除node_modules/.local。系统头与宏include不能自动推导，须按实际声明与工具链判断。

`chapter-inputs`排除审阅文件自身避免自引用；最终course_snapshot/发布包仍固定其字节。修改知识、正文、代码、规则或工具使旧证据过期，不能只换hash冒充重新审过。当前是全课程保守失效，不是细粒度影响分析。

## 可恢复研究与发布

`research init/status/resume/evidence/verify/prepare-release/check-release`沿用既有CLI，并增加open-study/study-status/checkpoint/seal-handoff/check-handoff。job为`work/jobs/<id>/job.json`，init不覆盖；status/resume与study-status用于恢复实际缺失/过期、当前阶段及下一步，不自动搜索或认证研究。变更使用本机独占锁，异常先核真实进程。精确用法见TASK_EXECUTION。

真实研究与审阅另存持久Markdown/JSON笔记，再登记显式kind/outcome/summary。accepted是调用者对实际工作的记录；需要真实修改后才能从needs-work变accepted，不能重填状态绕过。每种最新证据须绑定当前输入与未变笔记；验证失败保留last-good但最新当前失败仍阻止准备。

prepare-release只有模型、章级质量、当前研究交接、真实研究/审阅和当前验证都有效才输出不可变准备包`work/jobs/<job>/releases/<uuid>.json`。研究交接的传递输入进入生产快照，包保存researchHandoffs并在部署前再核；普通accepted笔记不能替代前置研究。包声明automaticSemanticCertification:false、deployed:false；准备不等于构建、上线或用户学会。withdrawn豁免章内容研究/采用，但不豁免实际撤回依据、输入冻结及载体验收。

部署在最终构建后、上传前重新check-release；过期/缺失/改动/被新包替换须停止，不回退旧包。串行部署与独立artifact避免并行替换dist，成功另存deployment收据。细节见 TASK_EXECUTION，不跳过门禁、虚填审阅或自动新增持续费用。
