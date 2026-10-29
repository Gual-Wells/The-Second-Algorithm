# 服务、后台出版与存储

## 实际分工

正式章原件、代码、释读及研究证据保存在Git；受保护静态library供阅读，不把正文复制进D1/KV。D1仅身份、当前读位、偏好、小型学习安排、当前服务快照、运行领取与设备订阅。没有本项目KV或额外业务库；Cloudflare免费额度是账户共享约束，不能把多个项目的相同免费数字相加。

OneDrive沿用已有个人Microsoft应用的`Files.ReadWrite.AppFolder offline_access`授权，归档目录为同一AppFolder下`projects/second-algorithm/publications`。它是项目目录隔离，不是另一Microsoft应用或安全边界。目标通过本机配置引入原credential-owner helper；不复制refresh token，不让浏览器取得Graph凭据与预授权链接。各项目不得同时建立互相覆盖的独立刷新凭据副本。官方权限与AppFolder规则见[Microsoft文档](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)。

`archive-publication.mjs`仅在已验证提交后生成一次Git tar/gzip，以commit作文件名上传；下载核SHA-256后才记成功。不包含`.local`凭据、书籍原件或未提交研究。它是出版资产归档，不冒称D1私人状态的完整容灾；私人状态仍由Cloudflare D1与其Time Travel保护，尚无跨平台完整恢复演练。

## 服务快照

`GET /api/balances`与`GET /api/storage/usage`均读取D1中仅一行当前私人服务快照；页面打开不查询厂商管理接口，不轮询，不在Git和公开壳存金额。publisher收尾`POST /api/services/report`按字段合并，核对时间防旧报告回退，失败保留上次已核值并标注本次未成功；null表示未知，不能替换成0。

OpenAI只登记ChatGPT附赠API credits：issuedAmount是发放额，remainingAmount是核实剩余；不能由发放额推出余额。到期日只有日期就只存日期；source记录核实来源类型，claim表示领取状态。它不是Codex五小时/周限额，不承担Codex自动化执行，不新增API请求或每任务估算、充值阈值提醒。

`collect-service-snapshot.mjs`在任务末尾读取D1管理大小、正式静态库实际字节、OneDrive账户quota及本项目目录大小。静态库无可独占的总容量，limit保持null；OneDrive账户总用量与projectBytes分开。D1 used来自实际database_size。Free单库发布上限为500MB；Cloudflare在同一官方表将2MB标为2,000,000字节，当前按十进制500,000,000显示计划上限，不冒称管理API返回的额度。账户全部D1和Workers/读写额度未在本页独立量测，不能因此声称其他项目无消耗。[官方D1限制](https://developers.cloudflare.com/d1/platform/limits/)

## 默认关闭的后台出版

复用第二语言单次许可语义，独立任务`SecondAlgorithm-DailyCodex`于北京时间05:00检查。服务端默认`restRequested=true`；新日期claim在同一SQLite写入触发器中消费许可与一次说明，恢复休息。同日重试返回原claim，不吃之后新安排；任务失败不自动重跑模型或跨日偷偷续费。下一次出版补充说明不是48小时临时资产业务。

启动器是WindowsApplication→Node并设置CreateNoWindow，不使用可见PowerShell窗口、不依靠每分钟Codex监测。Node领取到rest时直接完成，不启动Codex；实际有许可才运行既有Codex CLI的订阅认证与当前模型配置。电脑必须开机且用户登录；任务不能保证离线电脑实时执行。原始研究与出版流程必须完整，不因自动化省略研究链、语义审阅或确定性检查。

CLI退出0不证明发布。`background-prompt.txt`要求真实部署后登记本次runId与deployment回执；runner校验passed、anonymousBoundaryVerified、origin、时间后才记录published。中断锁需查真实进程/日志再恢复，不能自动删除锁并重复执行。

设置三个独立部分均接受`baseRevision`做CAS：goal、restRequested、temporaryRequested+temporaryRequestText。并行设备冲突409返回current，不默默覆盖。目标/说明各2000字符；临时开启但空白拒绝。GET没有行时只返回默认，不为浏览写一行。

## 提醒

浏览器仅在明确点按后请求系统权限与注册PushSubscription；各设备独立。服务端订阅绑定ownerScope+epoch，重置身份不能继承其他owner订阅。`GET /api/push/status`的deviceCount是账户设备总数，当前设备以浏览器pushManager为准。

新章实际任务完成后由本机publisher调用`POST /api/notifications/send`，采用独立VAPID与同系列成熟Web Push库。eventId+subscription去重，失败限重试，下一次任务收尾可再次发送同event；无分钟Cron与空轮询，过期运行/提醒传输元数据不属于学习永久资产。提醒只给实际完成事件，不把API额度邮件、研究中间状态或测试伪装成新章。未经设备授权不会有通知。

## 本机配置与操作

所有实际私有文件在D盘`.local/services/`（已忽略），config.json仅保存绝对路径：publisherCredentialFile、onedriveOwnerModule、可选onedriveOwnerSha256、openaiCreditFile、可选codexExecutable。publisher文件只属于本项目，含PUBLISH_TOKEN；VAPID私钥仅Workers secret及本机私有恢复文件。OpenAI输入只存已核记录，不混入邮件全文、邮箱、账号标识或任何key。不得把私人快照作为测试fixture提交。

```sh
node scripts/collect-service-snapshot.mjs --collect-only
node scripts/collect-service-snapshot.mjs --library .local/releases/<actual-artifact>/library
node scripts/archive-publication.mjs
```

第一次安装先以Windows PowerShell运行`./scripts/install-background-task.ps1`检查方案，明确本机配置和服务端默认休息后再用`-Apply`注册；安装只建05:00检查，不运行Codex。每次正式发布收尾运行快照更新与归档，失败保留已发布资产并报告；不为辅助快照失败倒退正式出版身份。没有配置就显示尚未配置，不能用静态按钮承诺并不存在的runner。

迁移`0002_services.sql`不修改原auth/reader_state，新增控制表仅此业务所需。部署必须应用迁移并配置独立PUBLISH_TOKEN与VAPID；源第二语言的publisher密钥不能混用。公共壳只用构建器精确实际文件路径排除Worker，private library、API、未知和编码路径继续过owner边界；content-only构建始终全部走fail-closed Worker。[Pages路由](https://developers.cloudflare.com/pages/functions/routing/)
