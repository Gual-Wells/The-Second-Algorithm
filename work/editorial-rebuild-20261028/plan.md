# 编纂与工程改造任务

用户授权：彻底工程改造；必要设计分歧及时讨论。基线 main / d1fe0ba7c76b6976f6de88fcd395cc3329c4704f，起始工作树干净。所有新增数据在D，不触碰第二语言/VIX/后台任务/凭据与收费资产。

## 本轮产品权威

章内主结构只有前置节和按题型的正式节。题型内按问题本质与思想匹配、条件/变型、注释手写C++与解析、真实标准设施与解析、必要唯一C++知识、1–5练习展开。四篇、独立章末地图和作者分工不构成读者结构。不减研究范围、不预定缩成少数节，不从强基础推导省略关键算法机制。

## 设计与分工

- 研究设施、材料及不可变交接保留。章合同升级为schema3，reading.units用researchTypeIds承接已研究对象；全范围有落点，编辑节不再与研究ID集合一一相等。实质研究变化仍须返回研究。
- 章级产品只登记一个逻辑文档binary-search，path为content/binary/chapter；composition指向content/binary/chapter.authoring.json。composition含title、sourceFiles、prelude {source,anchor}、sections [{id,source,anchor}]、codeSources。物理四稿只作作者片段来源，全部H2须被明确采用且仅采用一次；作者文本池与代码池分别显式登记。代码与知识仍保唯一作者源。
- tools/compose-chapter.mjs确定性按节装配，不决定语义；build_handbook按composition生成.source.md/.cpp再生成读件；manifest保存authoringDependencies，载体与Python核实际来源字节，防止旧生成件继续通过。
- schema3仅允许前置/题型H2，删除selectionMap必备及特权；当前正式章只有一个逻辑读件。独立检查仍不能代替语义通读。
- 根：阅读器、整合元数据/章合同、前置与顺序、完整成品审阅、编译/浏览器/CI与发布。
- Python代理：chapters.py及相关测试，协议/模型/恢复文档与AGENTS按用户硬要求同步。
- 装配代理：compose-chapter/build_handbook/build-carrier与JS回归测试；报告依赖核验接口。
- 内容代理：四份作者稿与必要.cpp，修核心解释、先题意后代码、依赖显示、知识首讲及双版本冗余；元数据写本任务目录，旧work研究/审阅不覆盖。

## 当前待办与验收

先完成真实模型/装配/阅读变更，再逐型回查第一章38个主节与研究范围、实际代码和知识依赖。新审阅从用户结构和读者顺序出发，不能照抄旧accepted。运行适当Python/Node/C++、当前实际出版浏览器与SW检查；新任务的当前证据和准备包通过后GitHub CI、正式部署及匿名/构建核验，保存实际收据。没有新增服务/订阅/定时任务。

此文件记录当前执行设计和断点，不作为读者正文或语义完成证明。
