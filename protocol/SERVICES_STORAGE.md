# 服务、后台出版与存储

## 实际分工

正式章原件、代码、释读及研究证据保存在Git；受保护静态library供阅读，不将D1/KV作为正文权威。D1保存身份、当前读位、偏好、小型学习安排、当前服务快照、运行领取与设备订阅。2026-10-31已明确授权的云端答疑另使用同一D1中的有界临时正文传输上下文及API原始回执，职责与回收见下文。没有本项目KV或额外业务库；Cloudflare免费额度是账户共享约束，不能把多个项目的相同免费数字相加。

旧OneDrive出版档案保留在原AppFolder的`projects/second-algorithm/publications`，不删除、不搬名、不重新生成。仍通过原credential-owner helper读取历史文件，不复制refresh token，不让浏览器取得Graph凭据与预授权链接。该目录是项目分类，不是另一Microsoft应用或安全边界。[Microsoft AppFolder规则](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)。

2026-10-31起，本机配置`publicationArchiveProvider:"huggingface-s3"`启用新出版档案写入HF私有专属桶`Gual-Wells/second-algorithm-assets`。脚本从既有credential-owner导出的root定位系列文件helper和正式分配策略，使用`localSeriesFiles('algorithm')`；只有HF资源active、算法分配current、固定池身份匹配才允许新写。凭据仍由管理员本机保护文件读取，不复制到算法项目。停写不阻断旧档案恢复。

`archive-publication.mjs`默认仍要求已验证、工作区干净的提交；`--revision <完整40位commit>`仅供明确手工封存已有不可变提交，不发布教材、不采用工作区未提交内容。Git tar先流入D盘文件，再流式gzip并做完整压缩往返摘要检查。新HF包不超过16MiB时沿用v2单对象回执；更大时按固定16MiB顺序分卷，各卷分别以SHA存入同一项目CAS，v3回执保存index、offset、卷长、卷SHA、typed locator以及整体gzip SHA/大小、原tar SHA/大小与Git commit。单个存储对象始终小于HF接口24MiB上限，不以整包大小阻止正常长期增长，不自动转写OneDrive。

`restorePublicationArchive(receipt,absoluteDestination)`按回执逐卷下载到D盘新文件，先核每卷及顺序，再核重组整体SHA/长度、解压tar SHA/长度和`git get-tar-commit-id`；完整回读成功才在私有`archive-ledger.json`登记。恢复失败清理本次不完整文件，不覆盖已有文件。超过24MiB的整包禁止用返回Buffer的便捷reader，使用该文件恢复入口，内存只承载当前分卷。同提交已验证档案只回读复用。旧v2 HF单对象（含已存在16–24MiB包）、旧`archive-receipt.json`和原OneDrive定位继续读取，不重分卷、不删除、不改远端原件。`.local`凭据、书籍原件和未提交研究不进入Git档案。该包是出版资产归档，不冒称D1私人状态完整容灾或全项目恢复验证。

真实能力验证见`research/series-storage-archive-2026-10-31.json`：已有提交197f966的20,267,753字节v2项目包已上传HF并在独立进程完整回读、解压核tar摘要与原Git提交身份；旧OneDrive提交fd79966的20,138,754字节原包也独立回读且摘要未变。v3分卷另以本地真实Git提交的25MiB随机非敏感fixture验证，含跨24MiB整包恢复、顺序/逐卷/整体/原tar/提交错配拒绝和旧v2/OneDrive兼容；这是本地完整链路测试，不冒称云端多卷实传。没有重复上传上述历史包、新教材出版、研究重跑或页面部署。

2026-10-31系列存储增量：第二语言管理版本化分配与账户容量元数据，本项目仍只绑定自身D1。云端答疑实际处理后，`project-storage-client.mjs`先经`SERIES_STORAGE`→`the-second-language-api/AlgorithmStorage`核本项目分配，再以`SELECT 1`返回的`meta.size_after`报告数据库字节数；缺测记未知，失败不回滚答复、不调用模型或空闲轮询。`FILES`固定绑定`second-series-files/AlgorithmFiles`的本项目文件能力，不能选择其他项目作用域、数据库、任意URL或账户；内容身份与原阅读授权仍由本项目负责。本机新出版包按上述独立HF流程写入，旧OneDrive历史未迁移；云端绑定是否已部署与可运行，仍以正式部署及真实调用核验为准。

## 服务快照

`GET /api/balances`与`GET /api/storage/usage`均读取D1中仅一行当前私人服务快照；页面打开不查询厂商管理接口，不轮询，不在Git和公开壳存金额。publisher收尾`POST /api/services/report`按字段合并，核对时间防旧报告回退，失败保留上次已核值并标注本次未成功；null表示未知，不能替换成0。

OpenAI只登记ChatGPT附赠API credits：issuedAmount是发放额，remainingAmount是核实剩余；不能由发放额推出余额。到期日只有日期就只存日期；source记录核实来源类型，claim表示领取状态。它不是Codex五小时/周限额；2026-10-30起章节答疑采用独立Responses API运行器，出版继续Codex。用量记录与官方剩余分开，不由估算伪造余额或告警。

`collect-service-snapshot.mjs`在任务末尾读取D1管理大小、正式静态库实际字节、OneDrive账户quota及本项目旧目录大小。静态库无可独占的总容量，limit保持null；OneDrive账户总用量与projectBytes分开，绝不把HF新包算成OneDrive目录用量；HF归属在第二语言系列HF池盘点中表示，不为此硬改本项目旧容量界面。D1 used来自实际database_size。Free单库发布上限为500MB；Cloudflare在同一官方表将2MB标为2,000,000字节，当前按十进制500,000,000显示计划上限，不冒称管理API返回的额度。账户全部D1和Workers/读写额度未在本页独立量测，不能因此声称其他项目无消耗。[官方D1限制](https://developers.cloudflare.com/d1/platform/limits/)

## 默认关闭的后台出版

复用第二语言单次许可语义，独立任务`SecondAlgorithm-DailyCodex`于北京时间05:00检查。服务端默认`restRequested=true`；只有`rest_requested=0`的获许可新claim才在同一SQLite写入触发器中消费许可与一次说明、恢复休息，休息日检查保留补充要求及设置revision。同日重试返回原claim，不吃之后新安排；任务失败不自动重跑模型或跨日偷偷续费。下一次出版补充说明不是48小时临时资产业务。

启动器是WindowsApplication→Node并设置CreateNoWindow，不使用可见PowerShell窗口、不依靠每分钟Codex监测。Node领取到rest时直接完成，不启动Codex；实际有许可才运行既有Codex CLI的订阅认证与当前模型配置。电脑必须开机且用户登录；任务不能保证离线电脑实时执行。原始研究与出版流程必须完整，不因自动化省略研究链、语义审阅或确定性检查。

CLI退出0不证明发布。`background-prompt.txt`要求真实部署后登记本次runId与deployment回执；runner校验passed、anonymousBoundaryVerified、origin、时间后才记录published。中断锁需查真实进程/日志再恢复，不能自动删除锁并重复执行。

设置三个独立部分均接受`baseRevision`做CAS：goal、restRequested、temporaryRequested+temporaryRequestText。并行设备冲突409返回current，不默默覆盖。目标/说明各2000字符；临时开启但空白拒绝。GET没有行时只返回默认，不为浏览写一行。

## 提醒

浏览器仅在明确点按后请求系统权限与注册PushSubscription；各设备独立。服务端订阅绑定ownerScope+epoch，重置身份不能继承其他owner订阅。`GET /api/push/status`的deviceCount是账户设备总数，当前设备以浏览器pushManager为准。

新章实际任务完成后由本机publisher调用`POST /api/notifications/send`，采用独立VAPID与同系列成熟Web Push库。eventId+subscription去重，失败限重试，下一次任务收尾可再次发送同event；无分钟Cron与空轮询，过期运行/提醒传输元数据不属于学习永久资产。提醒只给实际完成事件，不把API额度邮件、研究中间状态或测试伪装成新章。未经设备授权不会有通知。

## 本机配置与操作

所有实际私有文件在D盘`.local/services/`（已忽略），config.json保存路径配置publisherCredentialFile、onedriveOwnerModule、可选onedriveOwnerSha256、openaiCreditFile、可选codexExecutable，以及归档提供方publicationArchiveProvider；路径必须绝对，提供方仅onedrive或huggingface-s3，现行本机已设为后者。publisher文件只属于本项目，含PUBLISH_TOKEN；VAPID私钥仅Workers secret及本机私有恢复文件。OpenAI输入只存已核记录，不混入邮件全文、邮箱、账号标识或任何key。不得把私人快照作为测试fixture提交。

```sh
node scripts/collect-service-snapshot.mjs --collect-only
node scripts/collect-service-snapshot.mjs --library .local/releases/<actual-artifact>/library
node scripts/archive-publication.mjs
```

第一次安装先以Windows PowerShell运行`./scripts/install-background-task.ps1`检查方案，明确本机配置和服务端默认休息后再用`-Apply`注册；安装只建05:00检查，不运行Codex。每次正式发布收尾运行快照更新与归档，失败保留已发布资产并报告；不为辅助快照失败倒退正式出版身份。没有配置就显示尚未配置，不能用静态按钮承诺并不存在的runner。

迁移`0002_services.sql`不修改原auth/reader_state，新增控制表仅此业务所需。部署必须应用迁移并配置独立PUBLISH_TOKEN与VAPID；源第二语言的publisher密钥不能混用。公共壳只用构建器精确实际文件路径排除Worker，private library、API、未知和编码路径继续过owner边界；content-only构建始终全部走fail-closed Worker。[Pages路由](https://developers.cloudflare.com/pages/functions/routing/)

## 章节答疑 API与项目云端执行（2026-10-31）

问答按当前账户epoch、章节和不可变revision隔离。服务器从受保护静态库取完整章节Markdown，客户端不能上传替代正文；运行器核对摘要，以gpt-6.1-sol／xhigh回答，并保留完整问题/回答上下文。原件不可用或超出传输上限时诚实失败，不能截断或换用新版。无附件上传、工具、跨项目网关或跨项目登录；云端化仅改变执行位置，不扩展教材或账户权限。

`question_turns.execution_route`只能为legacy或cloud-v1，旧行默认legacy。Pages及独立Worker的`API_CLOUD_ENABLED`均默认false；仅明确开启后的新问题登记为cloud-v1，本机publisher领取接口只取legacy。旧任务、已知结果和未知费用不因切换自动搬移或重发；旧legacy已知失败由用户明确retry且云已开启时，先取得固定原文上下文，再以新attempt转cloud-v1，不再永久等待停用的本机执行器。云未开启时仍由legacy重试；旧unknown始终拒绝，不能借迁移绕过。领取、续租、完成、已读仍按当前owner+epoch核对；同ID重发幂等，同章节revision的追问等待前问处理。任何未解决failed也阻止后续追问越过。api_attempt仅在用户这次显式重试递增，定时调度不增attempt。草稿、历史、已读快照及晚到回复规则不变。

Pages无法自身配置Cron。`wrangler.cloud.jsonc`声明独立`second-algorithm-api` Worker及本项目DB；`server/cloud-worker.mjs`导出`AlgorithmAPIExecutor.run()`，仅供原生service binding调用，HTTP一律404。统一`series-api-clock`每分钟通过该RPC唤醒，时钟不持有数据、DB或模型key；每个项目保持独立执行invocation与D1预算。项目Worker不另设Cron，避免重复触发；原各站提醒Cron不承载模型长任务。执行器不调用publisher接口、不持有publisher或VAPID凭据、不调用Codex或出版claim。`withCloudLock`为项目提供14分钟D1 CAS互斥，每轮至多领取一个答疑；空队列不调用模型。原`SecondAlgorithm-DailyCodex`及05:00出版、默认休息与许可消费完全独立。旧`SecondAlgorithm-APIQuestions`在legacy队列清空及云端验证后才停用，不能删除未知调用原件；仅云端答疑不再依赖本机开机。

cloud-v1提交时，Pages从当前受保护固定revision资产取得全文，在`question_cloud_contexts`按owner+epoch+chapter+revision去重，保存正文摘要并与问题同事务绑定。每份UTF-8正文上限512KiB，单owner/epoch最多32份传输上下文，超限拒绝提交并给出可理解错误，不默默降级或截断。当前本地正式章核查235,713字节，不据此放松未来章节检查。Cron领取从该临时上下文取得完整正文并复核摘要，不需要复制静态库或公开取原件。全部相关问题明确完成时可立即删除传输上下文；48小时TTL仅回收无pending/running/failed引用的孤立或已完成上下文，unknown的唯一输入不能过期盲删。私人问题/回答及API回执不随正文传输缓存回收而删除。

重试的预读与上下文准备之间存在异步间隔，因此最终更新须同时CAS原api_attempt、execution_route、revision、context_digest、error及owner/epoch，且明确排除outcome_unknown；只有实际变更一行才算成功，状态已变则409。api_attempt也作为legacy显式重试的版本护栏；不得让另一个旧重试把新unknown重新置pending。

云端共用wire模块为`server/shared/cloud-responses.mjs`，与第二语言`worker/src/shared/cloud-responses.mjs`保持同字节，字段以其`CLOUD_API_SCHEMA`及实际实现为准。固定OpenAI请求及Pages单次nonce唤醒均使用Worker支持的`redirect:manual`，不跟随重定向；非2xx不能报告成功，旧未知attempt不因传输修复自动重发。`0005_cloud_questions.sql`安装项目路由、传输上下文、短期通知nonce与`api_cloud_runs/api_cloud_streams/api_cloud_locks`；不改登录、读位、出版许可或旧问答身份。Secrets Store通过`SECOND_SERIES_OPENAI_KEY`保护绑定，仅部署后Worker调用`.get()`；兼容已配置的Worker secret `OPENAI_API_KEY`，不从本地读取/复制明文，不以empty store或绑定存在冒称密钥可用。无绑定时不发送API，将本次未发送问题留pending。平台绑定、部署和真实任务验证分别留证。

Responses保持store=false、stream=true、完整上下文、结构化answer及工具隔离，单次超时600秒。发送前先持久化唯一(project,task,attempt)及请求digest，响应头、原始SSE、完成返回及usage先落DB，再原子提交业务回答和通知。只有完整completed可成为答复；断流、无终态、5xx或保存不完整均保持unknown，不自动POST第二次。已完成API返回而业务投递失败时，保留running及同attempt；租约过期后的下一轮优先readCloudResult复用已保存答案，不需要旧密钥、旧模型配置或新付费。sending/unknown即便更换模型或输入也不能借新attempt绕过，需维护核对；原始回执不含API凭据，日志不输出私密问题、答案或网络异常原文。

完整usage首次保存时，shared schema的触发器在本项目DB按project累计input/output/cached tokens、response数及revision，结果复用不重复累计。实际任务收尾读取`readCloudUsage`，只通过`SERIES_USAGE`→`the-second-language-api`的专用`AlgorithmUsage` RPC入口发送八项累计metadata（含unknown/in-progress计数及核对时间）；不发送正文、回答、附件、key或本项目DB权限。空队列/互斥忙/缺配置不每分钟汇报；RPC失败不重跑模型、不回滚已完成回答，之后有任务可重新发送完整累计值。计数和API官方剩余余额是不同事实，不能互推。

legacy的`.local/services/openai.json`及原始request/headers/stream/response/usage继续原位保全，仅存共用credentialFile路径、模型/档位、用量目录和可选本机代理，不在本项目复制密钥。本机仍用Node24.14以上，在请求前调用官方setGlobalProxyFromEnv；旧固定MIT eventsource-parser 4.1.3及非流式兼容原件不改写。云端与legacy执行回执独立，不能将旧未知请求登记成新cloud任务。API用量不是官方剩余额度，不由usage推算余额。


## 问答对标与答复提醒（2026-10-30）

问答会话按章节和固定revision选择；普通打开以同一事务取得全会话未读边界并确认当时旧回复，当前章有未读优先、再其他未读、最后当前章。通知使用精确问题身份，打开对应历史问答并定位。封存历史只读，真实目录暂时故障不能伪装成退役。关闭或切换弹窗即卸载问答视图，后台/迟到refresh不能标读；新回复保留用户阅读锚点。草稿及持久请求身份继续保留，不复制英语教学专用手势或破坏代码操作。

完整答复与service_push_delivery通知在同一事务提交，沿用已有owner/epoch设备订阅及Pages内VAPID。cloud-v1在完成后及每轮开始仅对已存在的未发送问答outbox请求唤醒：随机nonce仅SHA-256入同DB，绑定当前owner/epoch、120秒TTL；POST固定Pages`/api/questions/cloud-wake`端点，nonce放body不放URL。Pages以DELETE RETURNING原子消费，严格拒绝错误、过期、旧owner、并发重放及额外字段，仅唤醒既有问答通知队列，不能传任意owner/正文/claim、创建或完成任务。响应只给通用ok，Cron不复制publisher或VAPID secret。通知发送失败保留原outbox，下轮可以新nonce恢复，原通知仍每问题每设备幂等、有界重投，已读/旧owner/旧epoch抑制。legacy仍通过原publisher路径唤醒。锁屏无问答正文，深链接只开精确受保护会话，通知失败不触发重新生成。

## 云端启用与验证边界

当前配置默认关闭，不因代码或模拟测试通过宣称已部署或真实可运行。启用前先应用0005迁移，核共享模块字节、独立Worker绑定的是本项目DB、Secrets Store真实可用以及原Pages保护边界；分别部署Pages业务路由、项目API Worker与统一时钟RPC绑定，再明确开启两端API_CLOUD_ENABLED。该步骤不放行休息、不触发出版、不改旧任务路由。统一时钟每分钟Cron为UTC表达式，新增/变更传播可能需15分钟；scheduled最长15分钟wall time，CPU/请求/读写和Secret Store额度以账户当前套餐核实，不自动购买或升级。[Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[运行上限](https://developers.cloudflare.com/workers/platform/limits/)。

本地验证先运行`node --test test/carrier-cloud-questions.test.mjs test/carrier-questions.test.mjs test/carrier-question-notifications.test.mjs test/carrier-services.test.mjs scripts/check-openai-responses.mjs`，全为mock及内存SQLite。另核独立Worker dry-run和Pages受保护构建；有当前发布门禁才进行真实发布。云端真实任务未验证、secret尚未填写或发布尚未执行时，必须逐项如实报告。


## ChatGPT API 失败后的 Codex 接手（2026-11-01 用户更新）

此节取代上文“API 失败只等待用户重试”对新接手流程的限制；不授权再次发送结果未知的 API。优先由现有 cloud-v1 执行 ChatGPT API。明确失败、响应不完整、未知结果或密钥不可用时，原问题在同 owner/epoch、同 ID、同固定章节摘要与会话下转为 legacy 的 Codex 接手队列；`codex_fallback_json` 冻结原 API attempt、是否未知、时刻与原因，原 API 收据与未知输入继续保留。转换作废云端 claim/lease，迟到 API 完成不能覆盖接手答复。完整 API 答案已经保存而仅业务提交或通知失败时，先补交原答案，不另起模型。

`0006_question_codex_fallback.sql` 仅增接手元数据，并将已有 cloud 失败移交；已有完整 API 收据先回到同 attempt 的恢复路径。运行中旧版本迟到的 failed 也只能恢复原件或转 Codex，不能由该失败标记开启新 API。Codex 失败后的显式 retry 保持 legacy，不改回 API。原失败、已读、owner、章节版本与通知事务保护继续生效。

原隐藏监督器的 `scripts/question-api-worker.mjs` 现为兼容入口，只调用 `scripts/question-codex-worker.mjs`；它不再读取 API key，也不调用 OpenAI API。文字接手用 `gpt-6.1-sol/high`，共用 `scripts/lib/codex-data-runner.mjs`，固定输出 schema 与输入/身份摘要、原件复用、独占发送标记、无工具/子 agent、无 publisher/API 凭据传入模型环境，所有任务文件在 D 盘。新答案仍从受保护 complete 动作提交原问题及原通知 outbox。

API 仅等待响应头的时限为45秒；收到响应头即清除此短计时器，正常流式正文仍保留原600秒处理窗口。超时转交仍保原API未知结果，不重复调用。

同系列统一隐藏 Node 监督器按约 15 秒查询 `POST /api/questions/jobs/status`；本项目 publisher token 必须通过，接口仅返回 pending/count，不提供问题或答案。单次本机 runner 一次只领一问；无任务不唤醒模型，不新建本项目独立轮询或 PowerShell 窗口。电脑关闭时诚实留队列，不能宣称已接手或实时返回。

日章出版继续使用 Codex 订阅与原休息授权，后台主/文字任务固定 `gpt-6.1-sol/high`，确需视觉子任务固定 `gpt-6.1-terra/high`；调用参数和任务提示限定该次后台，不修改用户交互 profile。此改动不触发出版。云端 API 的模型档位仍以实际云配置为准，不能把 Codex high 混称 API 设置。
