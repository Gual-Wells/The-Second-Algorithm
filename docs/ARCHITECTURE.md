# 当前工程架构

统一算法实战主线。`catalog/learning.json`区分任务、方法、实现、全局Q及实际验证目标；`carrier/publications.json` schema2登记单课程章节与文档，不存在algorithm/cpp track。详细字段见 `CONTENT_MODEL.md`。

数据流：来源/实际读件 → 研究目标 → 题目合同/方法/实现/Q → 作者稿和权威cpp → 确定性装配 → 模型与独立结果检查 → 真实语义审阅 → 当前输入绑定的准备包 → 串行部署及线上核验。研究部和Agent承担判断，CLI不替代阅读或证明。

原稿和cpp同名保存于content的单层主题目录；BEGIN/END定位显示代码，一份代码权威。Q主讲在正文唯一位置，其他地方只编号链接。构建摘要同时绑定作者稿、源码、构建器、learning和publication字节，关系改变需重建。

`second_algorithm/learning.py`校验关系、Q前置/主讲、实际区域/symbol/目标并形成输入快照；`workflow.py`管理任务锁、证据和真实编译/运行receipt及发布准备。来源采集/历史案例工具仍保留，但不作为新正式覆盖。

`tools/build_handbook.mjs`装配阅读版，`scripts/build-course.mjs`按当前出版登记构建；`scripts/build-carrier.mjs`核对权威/链接/代码并生成受保护静态资源。阅读器统一章节入口，Q索引只链接主讲，代码原生选择、复制、横滚和字号保持。详见READER和web/DESIGN。

Worker为已有独立凭据、会话及通用reader_state；D1只存私人状态，不存正文或研究语料。正文/源码/关系是Git资源，静态下载按发布白名单与owner隔离。无需新数据库、微服务或向量检索。

job状态和不可变release receipt在work/jobs，编译临时/日志在.local；失败不覆写last-good，但最新失败阻止发布。release绑定实际输入及工具/前端/依赖，deploy另有锁及线上记录。旧版本无兼容义务；旧content/案例仅留作历史测试素材，不被发布登记或新测试数量支配。
