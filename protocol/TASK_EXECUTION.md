# 研究任务与发布任务运行手册

本手册描述实际CLI。无周期任务、付费模型调用或自动语义认证；Agent负责资料和内容判断，脚本/CI负责可重跑的确定性步骤。

## 启动与恢复

```sh
python -m second_algorithm research init task-id --goal "实际研究与交付目标"
python -m second_algorithm research status task-id
python -m second_algorithm research resume task-id
```

job在 `work/jobs/<id>/`，不可重复init覆盖；状态返回真实缺失/过期项与下一步。先核对当前Git及输入，保留并行任务的文件和锁。目标笔记记录实际范围、材料、未知项、权威位置与当前断点。不要因中断重做全局，也不拿历史通过当本次结果。

## 内容生产与检查

日期登记按`CHAPTER_DATES.md`：新增可见章在首次准备正式出版时冻结北京时间章节日期，写入`carrier/chapter-calendar.json`，之后重建/重试/修订保留；同日可多章。不要改原出版清单或教材身份来补日期。日期文件参与准备包输入和构建校验；历史日期只有真实依据才补登。

正文之前先执行与发布同等有效的RESEARCH_FACILITIES，研究状态不依赖课程已经有作者稿或通过结构校验。已有任务中开启研究设施，不重复init覆盖：

```sh
python -m second_algorithm research open-study task-id --chapter chapter-id
python -m second_algorithm research study-status task-id
```

出版和章节登记须明确存在且有效，当前项目已经保存真实空登记。研究早于作者稿不等于可以缺失登记文件；若登记丢失先核Git并恢复实际状态，不能临时补空冒充初始化。首章的coordinationContext会显示no-prior-chapters及comparisonApplicable:false，两次协同仍按RESEARCH_FACILITIES保存空说明，其他要求不变。

编辑 `work/jobs/<task-id>/study/ledger.json`、`dossier.json`、`scope.json`，真实研究笔记与每阶段JSON记录置于持久 `work/` 路径。当前研究状态、阶段收据及交接为schemaVersion2，三个动态档案仍为schemaVersion1。open-study生成书目/来源及已有正式章节的待判断项，不代表已经概况理解或读过；旧章此时仅作身份/状态盘点。精确字段见CONTENT_MODEL。每阶段完成相应实质研究后提交当前记录：

```sh
python -m second_algorithm research checkpoint task-id --phase overview --record work/task/overview.json
python -m second_algorithm research checkpoint task-id --phase scope --record work/task/scope-selection.json
python -m second_algorithm research checkpoint task-id --phase alignment --record work/task/chapter-alignment.json
python -m second_algorithm research checkpoint task-id --phase collection --record work/task/collection.json
python -m second_algorithm research checkpoint task-id --phase synthesis --record work/task/synthesis.json
python -m second_algorithm research checkpoint task-id --phase scope-review --record work/task/scope-review.json
python -m second_algorithm research checkpoint task-id --phase resynthesis --record work/task/resynthesis.json
```

这七种阶段表示依赖，不是连续执行七条命令就算研究完成。scope先独立研究领域提案，记录独立依据及非旧章材料；alignment再协同已有正式章节并确立初始范围，然后才充分提取本章内容。alignment和scope-review都保存chapterCoordination，后者须把旧章作为真实研究材料再次协同，不只沿用前次结论。动态补充、反复研究和范围复审按RESEARCH_FACILITIES实际进行；最后一阶段必须真正充分研究当前档案，跟进复审任务。

已有正式章用chapter来源、实际定位与分析笔记进入档案；逐章判断关系，相关内容按需实读，无关章不强迫全量重读。部分重合和近邻可以保留，各章完整性、领域独立性和全局广度仍须研究判断；无已有章时保存明确空记录。笔记记录读取范围/版本、机制与分类、变化、负结果、未决和下一动作。不可访问不标已读，不上传商业全文或凭据。

每次checkpoint固定当前档案、记录及引用笔记字节，并保存前驱。阶段不可跳过；重新提交较早阶段会保留历史、截去当前有效链的后续阶段，须按影响续作。scope-review之后若scope改变，先重做scope-review再进行resynthesis。在研/初次出版时，书目、来源池、有效研究基座或其他章节出版前沿变化须按status恢复overview；动态补充资料无需抹去历史初始范围。真正已出版交接的历史基座规则见RESEARCH_FACILITIES，不转借给新研究。

```sh
python -m second_algorithm research study-status task-id
python -m second_algorithm research seal-handoff task-id
python -m second_algorithm research check-handoff work/jobs/task-id/study/handoffs/<id>.json
```

seal-handoff保存不可变研究交接，不生成正文、不选定真实新章、不自动认证语义。必须已完成研究和当前链、材料处置/覆盖/原题计划等关系有效且文件未变。任何重新checkpoint使旧交接不再当前；不能手改收据或重写旧交接修复hash。

study-status、check-handoff与新seal默认检查当前基座，所以历史章可能提示全局基座已更新。是否能继续保留其已出版研究由course quality在核实部署证据后判断，没有可直接打开的历史豁免CLI开关；本章档案或笔记改变仍须续作。正常新增来源/新章不要求重跑全部旧研究，实际更正影响旧内容时仍须定点处理。

作者随后在章合同以 `researchHandoff` 保存输出的交接path，承接其中的领域、分支、材料和题型计划；章节内容仍按CHAPTER_STANDARD逐项编纂和采用。内部知识身份不外显给读者；引用/首次内嵌语法见CONTENT_MODEL。研究完成与最终内容审阅是两个阶段，后者仍需在当前全部生产输入上留证。

### 小标题候选与协调

作者先按实际内容写自然的H3/H4候选，每个小标题前使用稳定显式锚点。候选阶段先不查标题管理表，保存本次独立结果：

```sh
node scripts/manage-subheadings.mjs snapshot content/<unit>/chapter.authoring.json work/<task>/subheading-candidates-v1.json
```

snapshot只扫描当前作者源的真实小标题，不读取类型管理文件，也不自动决定标题职责；输出文件不覆盖。快照固定字节能够核查保存后的变化，不能仅凭命令运行声称Agent已独立判断。候选若实质变化，保存新快照并重新协调受影响内容，不倒写旧快照。

之后读取`catalog/subheadings.json`，逐项语义查找同义、可涵盖或更适配项。复用时在章节协调文件登记`action:reuse`及实际理由；确无适合才完善管理项并记录`action:new`，不要因题目、算法或API名称不同就新建类型。编辑`content/<unit>/chapter.subheadings.json`，绑定候选快照及所用类型指纹，保存各锚点的typeId、subject、depth、reason和实际implementationIds，并在composition的`subheadings`字段引用它。具体字段见CONTENT_MODEL。

```sh
node scripts/manage-subheadings.mjs check content/<unit>/chapter.authoring.json
```

check与正式构建核完整对应和规范生成；通过不代替语义匹配、实现归属及连续阅读审阅。管理表无关扩充不重做旧章研究，修改已用类型或作者候选后须更新受影响协调与审阅。管理表、候选和协调文件不随读件公开；Hcode/Scode及其他规范前缀由同一构建路径生成，不能在PWA里另建一份名称表。

先按CHAPTER_STANDARD/QUALITY_WORKFLOW在 `catalog/chapters.json` 登记每章合同与审阅路径。当前正式合同schema3保存思想机制与主要分支、真实材料归并证据、理论前置和正式题型节，并由`researchTypeIds`承接研究对象；每节有完整链条位置、真实双实现层次、依赖及1–5份在研究阶段取得且正文可见的练习。前置/题型须对应实际H2，机制/证明从属于题型。已有承诺用真实显式锚点定位，未完保留open/gap。结构可以有效而质量未通过；旧schema只供恢复，不得删除登记或追认旧通过来关闭门禁。

```sh
npm run build:content
python -m second_algorithm course validate
python -m second_algorithm course search Q000001
npm run check
```

CXX可指向已有编译器，ALGORITHM_PYTHON可指向已有Python；本机TEMP/TMP与所有输出D盘，脚本不自动安装编译器。check默认包含Python、登记C++目标、carrier、完整构建、浏览器和SW检查。只有调试确定性部分时可 `node scripts/check-project.mjs --without-browser`，不能把它冒称完整验收。

## 章级采用、留证与准备

完成正文、代码、构建、合同、材料和规则修订后，先查看人可读合同和当前输入：

```sh
python -m second_algorithm course chapters
python -m second_algorithm course chapter-inputs chapter-id
```

按QUALITY_WORKFLOW真实审阅，在登记的JSON审阅文件保存 `inputHash`、逐承诺reason/pass或gap及正文locations、真实基准比较、外部countercheck材料和结论，最终verdict为accepted或needs-work。字段见CONTENT_MODEL；不因能生成JSON而声称审阅完成。

```sh
python -m second_algorithm course quality
python -m second_algorithm course quality chapter-id --json
```

quality非0表示旧合同、领域/分支/前置/题型缺口、审阅缺失/过期等阻塞；符合新硬协议、各项addressed且真实逐项审阅当前有效才可准备。`course validate`/编译/技术CI仍可检查施工版本，不把绿灯等同可发布。审阅文件自身不进它的inputHash，但实际发布快照会固定审阅字节。更换路径、合同、材料或生产输入须重新判断相关影响，不仅替换hash。

在最终有效输入上登记实际研究与审阅记录：

```sh
python -m second_algorithm research evidence task-id --kind research --path work/task/research.md --summary "实际读取、范围和方法判断" --outcome accepted
python -m second_algorithm research evidence task-id --kind review --path work/task/review.md --summary "实际审阅、修订及边界" --outcome accepted
python -m second_algorithm research verify task-id --compiler c++
python -m second_algorithm research prepare-release task-id
```

prepare-release输出receipt.path。它是准备包，不是已部署。章级质量未通过、研究交接缺失/过期/不匹配、缺研究/审阅、needs-work、输入变化、证据文件变化、验证失败/过期均阻止准备；最新失败不能被last-good掩盖。普通accepted证据不能覆盖章级gap或替代前置研究链。accepted是Agent对真实工作的记录，不是通过填表自动证明内容质量。

## 发布

明确撤回已发布内容时，将 schema2 出版登记根 `state` 设为 `withdrawn`，所有已发布文档撤出 published，learning 的 questions/tasks/targets 三数组全部清空。hidden 登记和权威原稿可保留。不得用普通 active 空课程或假C++目标绕过内容门禁。先构建并审查真实空目录，登记当前撤回理由/边界和审阅笔记，再运行 `research verify <task-id>`（撤回可省略 compiler）、prepare-release 及同一部署流程。收据将声明 `operation: withdrawal`、`cppVerification: not-applicable`；这不代表C++编译或载体验收成功。必须运行载体/浏览器/SW升级检查，证明旧缓存正文、源码、Markdown及旧路由在新版本接管后不能再读，私人未同步笔记保留。恢复 active 后必须以真实新内容重新走研究、C++验证及发布准备。

```sh
python -m second_algorithm research check-release work/jobs/task-id/releases/<id>.json
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

部署检查包、串行锁、构建后再次校验、使用已有Cloudflare授权上传、检查线上匿名边界和SW build身份，成功另存deployment记录，不修改不可变准备包。记录包含packet及其字节packetSha256、inputHash、researchHandoffs、origin、build、deployedAt、anonymousBoundaryVerified与passed；上传期间packet改变不得记录成功。字段见CONTENT_MODEL。它为精确已出版研究提供操作证据，不能提前伪造收据或给旧缺字段收据补写成功。

任何步骤失败停止；若源码/协议/页面改变，回到受影响研究和审阅后重验，不能禁掉门禁。异常退出先查部署是否实际发生与锁所属进程，未知结果不能伪称成功。

CI在push/PR验证当前目标并保存检查产物；workflow_dispatch可指定已有研究job运行验证/发布准备。生产发布仅main、显式publish输入、已有CF secrets及相同门禁，concurrency防同一生产项目重叠。不自动创造研究证据，不提交教材原件/凭据。无云授权时仍保留可复现本地流程并如实报告。
