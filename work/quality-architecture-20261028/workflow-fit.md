# 章节合同接入实际生产链：审计与实现

2026-10-28。审计基线 `4d9fe9024b80fd6abf1ad45e94a966f6d36e2600`，本文件记录本轮实际实现。章稿与出版内容由主Agent负责，本分工没有发布、提交或改动第二语言项目。

## 审计发现与最小落地

原 `catalog/learning.json` 能定位任务、算法方法、不同实现、Q主讲和验证目标，不能表达一章承诺覆盖的条件关系、方法深度和读者实际可取得的能力。`workflow.py:add_evidence` 真实绑定研究/审阅笔记，但仅检查其身份和调用者给出的outcome；泛称accepted不能代替对一章实际承诺的逐项裁决。

因此保留原题目—方法—实现模型、C++验证和载体构建，另添章级合同及其审阅；没有新造独立数据库、Agent调度或固定篇幅/题数目标。

## 权威位置与机械约束

`catalog/chapters.json` schemaVersion1，chapters行包含id、collection、contract、review。每一个published chapter collection必须恰有一份合同，不能删掉index或置空章节数组绕过；hidden旧稿不参与。显式withdrawn不读取废弃章合同，保持原撤回流程有效。

合同JSON字段以主Agent的实际 `content/boundary-feasibility/chapter.contract.json` 为例：

- reader：startingPoint、targetCapability、supportPolicy，均为明确文本。
- scope：core、extensions、completenessArgument；exclusions数组逐项topic、reason、destination（可null）。
- reading：status、entry正文位置数组、units（有id/title/taskIds/locations的问题簇阅读顺序）、selectionMap正文位置数组、gap。addressed必须有真实入口、问题簇与方法选择地图，且本章每个登记任务都在实际阅读单元中承载；open如实记录未建路径，不伪造现有教材已经有良好结构。这里统一语义槽位，不强制每章出现同名栏目或固定问题簇数量。
- materials：id、kind、locator、evidence（仓库相对文件）、sourcePaths（额外真实资料读件文件数组）。原件定位不等于已读，机器不声称读过。商业教材只绑定可公开读件摘要，不能从协议推导上传商业全文的授权。
- commitments：id、dimension（difficulty/breadth/completeness/readability）、claim、acceptance、status（open/addressed）、taskIds、locations、materialIds、gap。
- 四个维度都必须有真实承诺，不规定题数、难题比例、字数、覆盖百分数。机器仅能检查承诺确有文本和合法关系，不能自动判断文字的强度是否足够。
- open承诺要记录明确gap，可没有已完成正文。addressed要指向真实材料及正文显式锚点；不能同时隐藏未清缺口。
- locations为document/anchor，锚点必须在原始稿中独占整行，缩进少于四空格；从原稿保留上下文排除围栏、行内/多行backtick代码、缩进代码和HTML注释。它是保守的项目锚点规格，不是自制通用Markdown解析器。taskIds必须是本章真实任务。
- 章合同、材料证据与review使用规范相对POSIX文件路径；拒绝./、../或反斜线别名，防止同一review文件以两个字符串身份进入自身hash。

`second_algorithm/chapters.py:inspect_chapters`只做上述结构检查。诚实的open/gap和缺失审阅不使`course validate`或C++验证失败，否则会阻断正常研究/施工。

## 真正的发布阻断

`chapter_quality`单独评估能否发布：每个承诺必须addressed；真实review文件必须存在、身份一致且verdict=accepted；assessments必须恰好逐项覆盖所有承诺，每项outcome=pass、有reason并有真实正文位置；comparison记录baseline/findings；outsideChallenge记录实际独立反查材料及findings，引用合同中kind=countercheck的资料。

这些是审阅责任的可追踪性，不是自然语言语义或难度的自动认证。调用者必须实际完成所记录的阅读、比较和反查。工具始终返回semanticCompletenessCertified=false。

`workflow.py:job_status`增加chapterQuality，readyForReleasePreparation还要求它有效。`prepare_release`和`check_release`冻结并复查章级审阅报告。泛称research/review accepted，即使C++目标全通过，也不能越过未关闭的章级缺口。

## 两层身份，避免审阅自循环

`course_snapshot(include_reviews=False)`是审阅写入inputHash的依据，绑定全项目当前生产输入、章合同、index路径、全部有效协议和材料读件，排除所有review文件自身字节。这是保守的全量失效：别章/读者工程变化也可能要求复核，不宣称只有本章变化才失效。

最终准备包使用默认`include_reviews=True`，额外冻结每份review的实际字节。因此审阅文字改变不会造成它自身inputHash无限变化，但会让旧generic evidence/验证/准备包过期。换review路径则index字节改变，使review自身过期。不能把review列为materials证据或sourcePaths来引入自循环。

## 实际命令

```sh
python -m second_algorithm course chapters
python -m second_algorithm course chapters <chapter-id>
python -m second_algorithm course chapter-inputs <chapter-id>
python -m second_algorithm course quality
python -m second_algorithm course quality <chapter-id> --json
```

chapters以中文人读文本展示读者、范围、承诺、验收和缺口。quality默认显示每章阻断原因，失败退出1；`--json`便于实际工具消费。chapter-inputs在正文/规则/合同稳定后提供真实审阅要绑定的hash。撰写/修改review后，再做最终研究证据、验证与prepare；不能先生成accepted空壳再填内容。

## 有区分力的测试

新增 `tests/test_chapters.py` 19项；更新 `tests/test_learning_workflow.py` 的真实章合同/审阅fixture。测试涵盖：

- 删除index或空registry不能降级、每章一合同；
- open可结构验证、可编译，但阻断发布；generic accepted不能绕过；
- 四维缺失、悬空任务/材料/锚点、代码或注释中的假锚点失败；
- 正文/源码/合同/有效规则/材料/审阅路径变更使审阅过期；
- 审阅字节不造成自循环，却使最终准备身份变化；
- 逐承诺缺失、无理由/无正文位置、accepted掩盖gap、没有真实countercheck失败；
- 撤回忽略废弃合同，保持无C++编译的原操作语义。
- 独立审阅复现的三项缺陷已修：行内/缩进代码假锚点、None畸形数组导致AttributeError、review路径别名逃逸自身排除；各有负例。入口/问题簇/地图的缺失、假任务、未承载任务和open状态也有真实阻断测试。

实际运行初版全Python72项通过；独立审阅补修与reading结构之后，19项章节合同测试再次通过。最终全量测试由整合者以最终有效输入核查，包含现有真实C++17 fixture运行及预期编译错误验证。该结果证明新增门禁的确定性行为与既有Python功能未回归；它不证明当前章难度、范围或可读性合格。完整carrier/浏览器/生产输入验证由整合者在最后有效文件上进行。
