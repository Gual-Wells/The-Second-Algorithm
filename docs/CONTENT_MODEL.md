# 当前实战课程模型与研究任务工具

`catalog/learning.json` 是当前统一算法实战的关系登记，`carrier/publications.json` 是展示登记。旧 `cases.jsonl/patterns.jsonl` 属于来源与研究历史，不参与当前课程覆盖计算或发布准备。来源查看、目录采集和历史检索功能仍可使用。

本文件说明实际实现，不宣称程序能够自动做题意研究、语义归并、证明讲解完备或测量用户掌握。当前模型由 `python -m second_algorithm course validate` 核查；修改契约时同时改实现和有区分力的测试。

## 章级编纂合同与实际采用

`catalog/chapters.json` schema1 的 `chapters[]` 含 `id/collection/contract/review`。每个published chapter collection恰对应一项；contract指向唯一JSON权威，review为独立JSON路径或null。active课程不能删除该登记来回退旧门禁；withdrawn没有正式章时豁免。title/章号仍由出版登记负责，合同标题可以标明整改语境，不改读者章名。

合同字段如下，实际校验见 `second_algorithm/chapters.py`：

| 字段 | 真实职责 |
|---|---|
| schemaVersion/chapter/title | schema1与登记身份，实际合同名 |
| reader | startingPoint、targetCapability、supportPolicy非空；用户基础/目标/C++支撑的明确判断 |
| scope | core、extensions、completenessArgument；exclusions逐项topic/reason，可有destination。深化/线索不自动算本版必达 |
| reading | status、entry位置数组、units问题簇、selectionMap位置数组、gap；unit有id/title/taskIds/locations。addressed须入口/问题簇/地图真实且承载全部本章任务；open保存真实缺口，已有引用也必须有效 |
| materials | 局部唯一id、kind、locator、evidence相对文件、sourcePaths数组；固定实际读件笔记及可公开原件，非网页目录即已读 |
| commitments | 局部唯一id、dimension、claim、acceptance、status、taskIds、locations、materialIds；status为open/ addressed，open必须有gap，addressed不得残存gap且须实际材料与正文位置 |

四维为difficulty、breadth、completeness、readability，每维必须有具体承诺。任务引用须属于本章；正文位置是 `{document,anchor}`，只接受本章真实显式 `<a id="稳定id"></a>`，不接受注释/围栏中的假锚点、未知/重复锚点。材料为实际仓库持久文件，不允许.local/.git/node_modules，文件进入输入摘要。商业原件继续按LOCAL_MATERIALS留本地，只把原创读件证据公开。

这些是结构约束，不声称四项非空或路径存在就达到质量。产品强约束和排除否决来自CHAPTER_STANDARD，实际回查来自QUALITY_WORKFLOW。reading不是固定题数/标题/六栏目模板，核验的是读者入口→真实问题簇→选择地图的可定位结构，语义仍须通读。当前第一章有真实open，validate可以通过以便继续工程，但quality和发布准备会拒绝。

审阅JSON包含schemaVersion/chapter/inputHash、assessments、comparison、outsideChallenge、verdict。每个承诺恰一份assessment：commitment、outcome(pass/gap)、reason、locations；pass必须有真实本章位置。comparison给baseline/findings；outsideChallenge给materialIds/findings，材料须有countercheck角色；verdict仅实际采用时accepted。角色/理由字段不能证明已研究，后续改稿不把已用反查继续冒充未见材料。

`course chapter-inputs <id>` 计算全课程生产输入身份，排除所有审阅文件字节，避免自引用。`course quality` 检查各项真实记录的结构/当前性、全部承诺已addressed且无gap、最终accepted。审阅文件再进入最终course_snapshot及发布包，修改审阅也使通用证据/验证/准备过期。路径、正文、合同、材料、有效规则/工具变化同样失效；不是保存hash后任意改稿。

当前为全课程保守失效，并非细粒度影响分析。恢复时按实际变更复核相关判断、保留未受影响的真实依据，不能仅批量改hash冒称重新审过。多章后的精细影响范围是后续可优化点，不借本轮架构新增依赖服务。

```sh
python -m second_algorithm course chapters [chapter-id]
python -m second_algorithm course chapter-inputs chapter-id
python -m second_algorithm course quality [chapter-id] --json
```

chapters默认中文人读；quality默认显示阻塞，`--json`便于工具使用。无机器难度分数/完备百分比。research status/resume暴露chapterQuality及下一步，prepare-release和check-release均重查。技术CI仍检查施工版本，显式发布才要求当前章级采用；不为上线上一版自动豁免。

## 关系和字段

出版登记采用 `schemaVersion: 2`，不再有 track。collection 的 kind 为 `chapter` 或 `draft`；chapterNumber 为全课程唯一正整数。draft 必须 `visibility: hidden` 且没有章号；不打包为正式正文。document 的 id 全局唯一，path 指向 `content/<unit>/<稿名>`，当前仍配套同名 `.source.md/.cpp` 和构建产物。

根字段 `state` 为 `active`（省略时默认）或 `withdrawn`。active 课程必须有实际发布文档、Q、任务和验证目标。显式撤回只允许没有 published 文档且 learning 的 `questions/tasks/targets` 三数组全部为空；可保留 hidden 登记与原稿，构建不会复制它们。撤回产物有真实空目录、空Q索引和只允许 catalog 的内容路径表，新的构建身份使旧正文/源码/Markdown缓存和旧路由失效。用户笔记和阅读状态仍保留。

撤回是 `operation: withdrawal`，正常内容发布为 `content-release`；校验、验证收据、准备包和构建摘要均明确标记。撤回验证检查上述空集约束，`compiler: null`、`cppVerification: not-applicable`，不调用编译器，不能报告“0个目标编译通过”。它仍需当前撤回依据及真实审阅笔记，并通过载体、浏览器与真实Service Worker升级检查；这些结果不能由结构校验替代。恢复发布须把 state 改回 active，填入真实研究形成的新内容并重新验证/准备，撤回包不授权内容发布。

学习登记采用 `schemaVersion: 1`：

| 集合 | 必要字段与约束 |
|---|---|
| `questions[]` | `id` 为 Q 加至少六位数字且编号大于0；title；document 为已发布文档ID；anchor 为编号小写；prerequisites 为已有Q数组且无环；sources 为非空HTTP(S)来源数组 |
| `tasks[]` | id、title、document、非空contract、非空sourceUrls、methods；题目ID在任务类内唯一 |
| `methods[]` | id、title、非空invariant、implementations；方法ID在其任务内唯一，完整身份是 task/method |
| `implementations[]` | 全局唯一id；kind为manual/standard/alternative；source、非空regions、symbol、standard、非空questions、complexity.time/space、target |
| `targets[]` | 全局唯一id；kind为run/compile/compile-fail；source；standard为c++17/20/23；timeoutSeconds为1至120 |

target 可按需声明 `additionalSources`（一起编译的其他翻译单元）、`dependencies`（必须计入输入的显式依赖）、`defines`（标识符或简单 `NAME=value`）。普通目标只有一个source即可，不需要为简单算法建立复杂工程。

实现 source 必须真实存在，regions 对应它的 `// BEGIN id`／`// END id`，重复或不闭合标记失败。symbol 必须在声明的区域中有函数式出现；target 必须通过其本地引用闭包实际依赖这份 source，验证标准不得早于实现标准。参考实现不能仅关联一个预期编译失败目标。

这个 symbol 检查是文本定位，编译是实际工具链检查；二者不等于机器证明测试已经覆盖该函数的所有行为。测试驱动必须实际调用要核验的实现，Agent 在语义审阅中核对。复杂度文字也不因字段非空得到数学认证。

## Q：完整讲解一次，后续编号引用

主讲原稿采用：

```text
<a id="q000001"></a>

### Q000001 · 实际问题标题

完整讲解……
```

后续只写 `[[Q000001]]`，由阅读装配生成到唯一主讲的链接，不重复内联完整解释。校验拒绝重复Q编号、多个主讲标题、缺失显式锚点、未知引用、未解析 `draftq:` 临时键、缺失或循环前置。代码围栏及HTML注释中的示例文字不作为主讲标题计数。

一个实现可引用多个Q，一个Q可被多个实现使用；实现声明的Q应当在其任务文档中主讲或编号引用。主讲是否充分、不同措辞是否实际重复教学，仍由Agent真实审阅，不能用标题计数替代。

未来C++查漏视图由相同问题登记提供索引。编号、解释存在、实例运行通过、读位与用户掌握是不同事实；工具返回 `semanticCompletenessCertified: false` 和 `userMasteryMeasured: false`。

## 当前课程命令

```sh
python -m second_algorithm course validate
python -m second_algorithm course targets
python -m second_algorithm course search Q000001
python -m second_algorithm course verify --compiler <已有编译器>
```

顶层 `--root <仓库>` 放在 course/research 前。targets 输出JSON数组，供CI发现真实目标；verify 实际编译所有登记目标，run目标再运行；compile目标只检查编译，compile-fail只接受编译器退出1且不会运行。编译器崩溃、缺失或超时不是预期诊断成功。

使用 `-std=<登记版本> -O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS`，不安装编译器或自动下载依赖。Windows subprocess 隐藏窗口，TEMP/TMP/TMPDIR 全部指向本次 `.local/` 尝试目录。仓库和实际输出必须按项目约定放D盘；`--output` 只允许仓库内 `.local/`。

每次尝试有独立日志与receipt，latest指向最新尝试，只有成功才更新last-good。失败不会抹掉成功基线；研究任务若最新尝试在当前输入上失败，仍会阻止准备发布，不能静默回退到上一次成功。

顶层旧 `validate` 仍检查历史研究与来源，并在存在learning时另列currentCourse；`report` 分开返回historicalResearch/currentCourse。新正式课和发布准备使用course命令，不以旧案例、旧模式或旧文件数代表当前课程覆盖。

## 可恢复研究任务

```sh
python -m second_algorithm research init foundation-release --goal "实际研究目标"
python -m second_algorithm research status foundation-release
python -m second_algorithm research resume foundation-release
python -m second_algorithm research evidence foundation-release --kind research --path work/task/research.md --summary "实际读取的任务、合同和范围" --outcome accepted
python -m second_algorithm research evidence foundation-release --kind review --path work/task/review.md --summary "实际语义审阅及剩余边界" --outcome accepted
python -m second_algorithm research verify foundation-release --compiler <已有编译器>
python -m second_algorithm research prepare-release foundation-release
```

任务记录为 `work/jobs/<id>/job.json`，init不覆盖已存在任务；status不带ID时列出任务。status/resume只读，显示当前输入、缺失／过期证据和下一步，不会自动搜索、写正文或宣布语义研究完成。改变任务时使用本机独占锁；异常退出留下锁需先查实际进程，不自动删除另一任务的锁。

evidence需要真实的仓库Markdown/JSON笔记、非空summary及显式outcome。它是调用者对实际研究／审阅的记录，工具检查文件存在、字节身份和当前输入绑定，不会凭内容长度或一个accepted字段认证其真实性或质量。`needs-work` 必须完成真实修订和审阅后再登记accepted，不能用旧accepted记录遮住新发现。

研究及审阅笔记不得用 `.local/` 临时日志冒充。每一类最新证据须为accepted、指向未改变的笔记且绑定当前输入；Q正文、源码、题目合同或验证驱动改变后旧证据过期，不能直接准备发布。需要更新哪些实际研究与审阅，由变更内容决定，不能只为过门禁机械重登记。

输入指纹覆盖 learning/publications、已发布文档原稿和源码、存在的MD/HTML/构建摘要、所有实现及target的本地quoted-include依赖、显式dependencies，以及当前构建／验证工具、依赖锁、有效AGENTS、protocol下全部Markdown规则、scope和本模型说明。web/server/scripts的实际源码与静态资产、second_algorithm的Python代码、Python及carrier检查代码、验证CI、wrangler.jsonc及migrations下全部SQL也参与冻结；配置或迁移改变不能借旧准备包授权新的站点／数据库操作。node_modules、.local等运行目录不参与。系统头文件和宏生成include不会被自动推导；quoted-include扫描保守包含条件分支。这些条件须显式声明／核查，实际工具链版本也记录在验证报告中。

先完成当前作者稿／代码及阅读构建，再针对冻结输入登记真实证据、运行verify、prepare-release。后续重建若改变输入字节，需重新完成相应步骤；失败不覆盖last-good验证或已有准备包。

## 发布准备包与部署门禁

prepare-release只有在模型有效、chapterQuality和research/review证据当前有效、当前操作的真实验证通过时成功。active 需要实际C++目标成功；withdrawn 无正式章不需章级采用，只记录撤回结构验证，仍保留完整的研究/审阅及输入冻结门禁。输出 `receipt.path` 指向：

```text
work/jobs/<job>/releases/<uuid>.json
```

包内有 schemaVersion、state=prepared、passed、inputHash、inputs（相对路径到SHA256）、documents、evidence、verification，以及 `automaticSemanticCertification:false`、`deployed:false`。这表示当前输入的准备记录，不代表已构建站点、已部署、全范围语义完备或用户已学会。

部署脚本在最终构建后、实际上传前执行：

```sh
python -m second_algorithm research check-release work/jobs/<job>/releases/<uuid>.json
```

非0退出必须停止发布。check-release重新计算输入，核对准备包、当前任务最新状态、笔记和验证receipt摘要；缺失、过期、被改动或被新准备包替代都会失败。它不会替代载体构建、浏览器检查、鉴权核验或真正的平台部署。部署步骤应串行，避免检查后另一个写者再修改待发布输入。
