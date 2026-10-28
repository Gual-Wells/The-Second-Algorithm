# 当前算法领域、题型与知识模型

`catalog/learning.json`登记任务/方法/实现/知识/验证；`carrier/publications.json`登记统一出版顺序；`catalog/chapters.json`连接大思想合同与真实审阅。旧cases/patterns仅为来源和历史研究，不计算当前课程覆盖。下面描述确定性职责；程序不自动研究、分类、证明语义完整或测量用户掌握。

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

status为open/addressed；open必须给具体gap，addressed不得暗藏gap。schema1旧合同只支持结构恢复，不能作为新硬协议的发布采用。2026-10-28全部出版与作者内容已清零，当前无章合同或知识资产；旧专题及采用仅在历史恢复，不能直接追认为新大思想章。

paradigm.corpusEvidence引用materials内实际教材/来源筛选归并读件；addressed领域须有证据和分支，addressed分支须有真实材料与题型落点。相关材料全部读过、分支是否充分仍须Agent判断；字段非空不认证全面。

reading.units保留id/title/taskIds/locations，新增：

- `dependsOn`：本章更早的正式节身份，按实际作者顺序形成依赖。
- `facets`：problem、fit、variation、manual、manualExplanation、standard、standardExplanation、engineering八项正文位置。它们是语义落点，不强迫八个固定小标题，可自然共享明确位置。
- `manualImplementationIds/standardImplementationIds`：属于本节任务的真实实现。manual引用手写；设施角色为algorithm/structure时引用standard实现，support/shared-core允许复用核心但必须解释设施实际承担的层次。
- `standardRole`：kind为algorithm/structure/support/shared-core，explanation说明真实替代职责，不虚构整题库解。
- `exercises`：1–5项title/url，来自本节task.sourceUrls并在所属正文中有实际可见链接；同节不能重复URL。

正文位置为`{document,anchor}`，只认真实显式锚点，排除注释/代码示例假锚点。题型主位置对应实际H2且归属唯一；前置先于正式节，entry指向前置，selectionMap位于题型之后，facets在自己题型范围内，不能借别节内容充数。除前置、题型和选择地图外，不允许无归属H2让证明/支撑抢占目录。多文档顺序服从当前出版顺序。

结构允许诚实施工open；`course quality`另查领域/前置/分支/阅读/承诺是否已addressed、审阅是否当前有效。旧schema、关键open/gap、缺/过期/needs-work审阅阻止内容发布。数量、位置与关系正确，不证明题型有代表性、练习真正匹配或完整链讲解充分。

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

`research init/status/resume/evidence/verify/prepare-release/check-release`沿用既有CLI。job为`work/jobs/<id>/job.json`，init不覆盖，status/resume只读显示缺失/过期与下一步，不自动搜索或认证研究。变更使用本机独占锁，异常先核真实进程。

真实研究与审阅另存持久Markdown/JSON笔记，再登记显式kind/outcome/summary。accepted是调用者对实际工作的记录；需要真实修改后才能从needs-work变accepted，不能重填状态绕过。每种最新证据须绑定当前输入与未变笔记；验证失败保留last-good但最新当前失败仍阻止准备。

prepare-release只有模型、章级质量、真实研究/审阅和当前验证都有效才输出不可变准备包`work/jobs/<job>/releases/<uuid>.json`。包声明automaticSemanticCertification:false、deployed:false；准备不等于构建、上线或用户学会。withdrawn豁免章内容采用但不豁免实际撤回依据、输入冻结及载体验收。

部署在最终构建后、上传前重新check-release；过期/缺失/改动/被新包替换须停止，不回退旧包。串行部署与独立artifact避免并行替换dist，成功另存deployment收据。细节见 TASK_EXECUTION，不跳过门禁、虚填审阅或自动新增持续费用。
