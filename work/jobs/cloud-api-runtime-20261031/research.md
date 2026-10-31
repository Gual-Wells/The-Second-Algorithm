# 第二算法 API 云端执行：工程研究

本任务仅研究和交付既有章节答疑的云端执行，不生产新教材、不重做算法领域研究、不改出版许可，也不采用旧工程任务的 approval 或发布准备包。

## 实际读取与方案判断

已读取当前 AGENTS、SERVICES_STORAGE、TASK_EXECUTION、QUALITY_WORKFLOW、CONTENT_PIPELINE、RESEARCH_FACILITIES，以及 server/questions.mjs、services.mjs、worker.mjs、0001–0004 迁移、本机 question-api-worker、固定 OpenAI wire/SSE 实现及相关测试。Pages advanced-mode Worker 只有 fetch，不能仅增加 scheduled 函数就声称 Cron 已生效。原答疑按 owner/epoch、章节与不可变 revision 隔离，五分钟领取租约、六十秒续租；同会话追问不能越过前问的 pending/running/failed，回答与通知同事务。

本轮最终采用独立 second-algorithm-api#AlgorithmAPIExecutor，经原生 service binding 由无数据/模型密钥的 series-api-clock 每分钟唤醒。各项目执行 invocation、数据库、原始回执和权限各自隔离；本项目不新增 Cron。统一时钟不读取问题、答案或模型密钥。出版仍由独立本机 Codex 任务负责，默认休息及许可原子消费保持原合同。

没有采用复制 publisher/VAPID 凭据、公开取正文接口或给执行器重复部署全部私有静态库的方案。Pages 提交 cloud-v1 问题时从原受保护资产取得固定完整原文，以 owner/epoch/chapter/revision 去重传输上下文；每份 UTF-8 正文最多512KiB，超限拒绝，不截断。当前正式章235,713字节。完成且无未决引用时清理；48小时只回收无 pending/running/failed 引用的孤立上下文，未知费用的唯一输入保留。

旧行默认 legacy，不随开启自动改路由；本机只取 legacy。已知失败经用户明确 retry 且云已开启后，以新 attempt 转 cloud-v1 并取得原固定上下文。unknown 无论旧/新路线都禁止重发。发送前持久化 task/attempt/digest；原始 SSE、终态和用量先保存，再提交业务回答。已生成但投递中断时，下一轮复用同 attempt 的 readCloudResult，不取新模型结果、不依赖旧密钥。

独立审查指出重试预读与异步上下文准备间的 CAS 竞态。本轮已实修：最终更新同时守原 error、attempt、route、revision、context digest、owner/epoch，明确排除 unknown；零变更返回409。回归实际交错两设备请求，后一请求产生 unknown 后，旧请求不能将其改回 pending。

通知继续由原 Pages 的 VAPID 完成。云执行器只在既有问答 outbox 待发时登记120秒、owner/epoch限定的单次 nonce 哈希，并向固定 Pages 端点提交 nonce；Pages 原子消费后仅 flush 已提交问答通知。不能携带 owner、问题、答案或 claim，不能创建、完成或重跑任务。RPC 用量接收端也只接受八项累计数字 metadata，能力类固定来源，无读取另一项目 DB 或私文的方法。

## 内容与已出版身份

本地工作基线 fd79966ab6a2493477b23aef1b79dee927bd9808；只读 Wrangler 查得当时生产部署4c099cef-5cbc-4be6-8366-4c942def3b5a，Source39059cb，仓库可解析为39059cb78a61a6dc0c26f78e27e0b1f4982bbac2。二者不是同一运行版本，不能把本地当线上；git 比较 content/catalog/tools 未发现字节差异。本轮这些教学权威也没有工作树差异，除当前输入影响审阅的 chapter-review 元数据更新外不修改教材。

本轮隔离构建与初始 dist 的17个 library 文件比较，16个正文/知识/代码等资产逐字节相同，唯一差异为 catalog.json 的全册 version；无章正文或实现差异。正式 Markdown SHA256 为5f53d2ca5da6db2dccff90b1796aef5c79c2e3c356c261cac3549ff183f77faa。精确章研究交接仍有原首次成功部署及准备包证明；本轮保留其内容采用，不将它称为新的教材研究或本轮工程审阅。

## 发布输入完整性与边界

原 course_snapshot 会递归绑定 server/shared、迁移与协议，但遗漏根目录新增 wrangler.cloud.jsonc。本轮经确认将其纳入明确文件清单，并添加配置漂移使既有 review/release 失效的回归，防止执行器名称、DB、Secrets Store、usage binding 或开关变化逃出发布 pin。

共享 wire 的最终权威字节由系列整合者同步，本任务不另改公共副本。最终锁定、当前审阅和 prepare-release 在同步后进行。Secrets Store 仅登记绑定元数据，Agent 不读取或上传明文；尚无真实收费调用、迁移应用或生产发布。新 chapter release packet 只表示本轮输入已准备，不证明云密钥、线上执行或学习者效果。
