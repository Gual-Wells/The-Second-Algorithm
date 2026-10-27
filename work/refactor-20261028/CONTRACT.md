# 2026-10-28 实施接口（root维护）

用户已授权全面重构及任务内发布。无需旧版兼容。统一算法实战主线，手写与标准设施并列；C++知识全项目唯一Q编号、完整讲解只一次，之后仅引用。原书/凭据不删除不发布。所有实际新增数据D盘。

## 实施分工

- root：有效协议/文档、tools/build_handbook.mjs的Q引用装配、package/CI/部署集成、总体验证与发布。
- pipeline Agent：second_algorithm/新模型校验与workflow命令、对应Python测试和schema文档。
- reader Agent：scripts/build-carrier.mjs、web/*、test/carrier-*.test.mjs与浏览器/升级QA脚本；统一入口和Q索引。
- content Agent：carrier/publications.json、catalog/learning.json、content/practice-foundations/*、tests/cpp/practice_foundations_test.cpp、实际研究/作者记录。

## 出版登记

carrier/publications.json schemaVersion=2；collections保留id/title/kind/visibility/chapterNumber/documents（document的id/title/path不变），删除track。统一chapterNumber序列。只登记新内容；旧内容是研究/测试材料，不生成兼容适配。build允许隐藏草稿但不发布其正文。

## 实战内容关系

catalog/learning.json，schemaVersion=1：

```json
{
  "schemaVersion":1,
  "questions":[{"id":"Q000001","title":"问题标题","document":"practice-foundations","anchor":"q000001","prerequisites":[],"sources":["https://..."]}],
  "tasks":[{"id":"first-ge","title":"实际任务","document":"practice-foundations","contract":"输入、输出、边界及可修改政策","sourceUrls":["https://..."],"methods":[{"id":"binary","title":"方法","invariant":"核心依据","implementations":[{"id":"first-ge-manual","kind":"manual","symbol":"lower_manual","source":"content/practice-foundations/实战起点.cpp","standard":"c++17","regions":["first-ge-manual"],"questions":["Q000001"],"complexity":{"time":"O(log n)","space":"O(1)"},"target":"practice-foundations"}]}]}],
  "targets":[{"id":"practice-foundations","kind":"run","source":"tests/cpp/practice_foundations_test.cpp","standard":"c++17","timeoutSeconds":30}]
}
```

实现kind支持manual/standard/alternative；同方法不同实现与不同算法分开。ID全局或各类别唯一；每个实现需真实source/regions/symbol、可引用的Q、存在的target及版本；所有Q须唯一主讲，必要前置无环且已解释。新模型只指向实际新内容；旧cases/patterns保留历史研究事实，不能成为当前正式内容覆盖证据。

## Q讲解和链接

正文主讲使用`### Q000001 · 问题标题`并在其前放`<a id="q000001"></a>`；每个Q完整主讲只一次。后续作者稿写`[[Q000001]]`。root构建器把引用转为到登记document对应.html#anchor的内部链接。正式代码块仍从权威cpp的BEGIN/END抽取，不手工复制代码。Q登记不复制正文。新内容第一份document ID=practice-foundations，稿名=实战起点。

reader构建library/catalog输出questions轻索引（id/title/document/anchor/prerequisites），客户端从统一入口可看Q目录，跳到唯一主讲，浏览器返回恢复原阅读。标准语言、API、设施可通过标题/正文检索；不把读位当掌握率。

## 验证与任务流程

新模型校验同时检查引用、唯一主讲、实际regions、target关联；完整源字节参与验证指纹。pipeline提供research job初始化/状态/证据核验/内容验证及发布准备命令；保留现有来源/目录采集能力。命令不伪称自动完成语义研究。Agent实际阅读和审阅形成证据；发布前核验这些记录与当前输入绑定，过期或缺失失败关闭。不新增周期自动化或付费模型调用。

根CI用新登记target动态编译C++，替换固定旧文件/版本名单；研究与发布操作可workflow_dispatch。发布串行、验证失败停止，不需要用户逐项审批。不得只有文书更新而没有真实模型、真实内容、真实编译/阅读与部署核验。
