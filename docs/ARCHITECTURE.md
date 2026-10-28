# 当前工程架构

统一算法实战主线。`catalog/learning.json`区分任务、方法、实现、全局Q及实际验证目标；`carrier/publications.json` schema2登记单课程章节与文档，不存在algorithm/cpp track。详细字段见 `CONTENT_MODEL.md`。

数据流：出版复盘与全材料视野 → 大思想领域及相关材料归并 → 分支/正式题型/变型与交叉应用 → 前置理论和逐题型作者稿/权威cpp/唯一知识资产 → 确定性装配 → 独立范围反查、连续阅读及结果检查 → 当前版逐承诺采用 → 当前输入绑定的准备包 → 串行部署及线上核验。研究部和Agent承担判断，CLI不替代阅读或证明。

新增 `catalog/chapters.json` 连接每个正式章的合同与审阅；`second_algorithm/chapters.py` 核四维承诺、真实任务/材料/正文锚点、当前逐项审阅，并提供人可读合同/缺口。允许诚实施工open而不破坏结构验证，发布必须无open/gap并有当前真实采用。合同/材料及生产输入固定审阅身份，审阅字节再进最终包，避免自引用。CHAPTER_STANDARD与QUALITY_WORKFLOW规定实际质量，不把JSON视为教学评分。

原稿和cpp同名保存于content的单层主题目录；BEGIN/END定位显示代码，一份代码权威。C++知识另有独立唯一Markdown源，首次教学与后续语义浮窗由同一内容装配；编号只在内部，撤下首讲章不删除仍被依赖的知识。静态包只带实际引用及前置闭包，卡片同样受鉴权、版本与离线白名单保护。构建摘要同时绑定作者稿、源码、知识、构建器、learning和publication字节，关系改变需重建。

`second_algorithm/learning.py`校验关系、Q前置/主讲、实际区域/symbol/目标并形成输入快照；`workflow.py`管理任务锁、证据和真实编译/运行receipt及发布准备。来源采集/历史案例工具仍保留，但不作为新正式覆盖。

`tools/build_handbook.mjs`装配阅读版，`scripts/build-course.mjs`按当前出版登记构建；`scripts/build-carrier.mjs`核对权威/链接/代码并生成受保护静态资源。阅读器统一章节入口，透明语义知识引用读取独立唯一静态知识资产并原位浮窗，代码原生选择、复制、横滚和字号保持。详见READER和web/DESIGN。

Worker为已有独立凭据、会话及通用reader_state；D1只存私人状态，不存正文或研究语料。正文/源码/关系是Git资源，静态下载按发布白名单与owner隔离。无需新数据库、微服务或向量检索。

job状态和不可变release receipt在work/jobs，编译临时/日志在.local；失败不覆写last-good，但最新失败阻止发布。release绑定实际输入及工具/前端/依赖，deploy另有锁及线上记录。2026-10-28已将content及旧专属验证代码清零，仅Git历史可恢复；来源模式保留为候选，原题教学归属重置，未保留任何现行内容覆盖。
