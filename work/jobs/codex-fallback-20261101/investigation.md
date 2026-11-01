# 本次技术调查

本次只改现有服务执行，不增加或重编算法章节。已核AGENTS、SERVICES_STORAGE、server/questions.mjs、question-cloud-context.mjs、question-cloud-adapter.mjs、scripts/question-api-worker.mjs、run-background.mjs、shared云运行协议、实际D1迁移和本机config路径有效性。

发现：原legacy本机问答实际上仍调用API；云端failed/unknown会停在原队列。新实现保同问题ID、owner/epoch、章节正文摘要和API attempt，显式失败/未知以codex_fallback_json记录后进入legacy Codex队列。旧claim退役，晚到API不能覆盖。完整已保存API答案仅补交业务，不新起模型。unknown API原件和未解决输入保留。API仅等headers45秒，收到后保原600秒body。

本机旧入口现为Codex单次兼容入口；共用无工具数据runner固定Sol6.1/high，待调用后端仅有自己的publisher scope。出版后台Sol6.1/high、必要视觉Terra6.1/high，不改变交互profile，不触发出版。统一15秒隐藏监督器由第二语言管理员本机层负责；本项目提供仅pending/count接口，无新PowerShell或独立周期任务。

本次不改变教材、题目、C++权威、阅读层级、章节日期或私人历史。原已出版内容须继续过现有质量和出版门禁，本调查不是新教学研究，也不转借旧通过给新内容。
