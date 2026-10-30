# Hcode / Scode 按实际价值选择

用户补充明确：两种实现不必成对。没有真实Scode不写Scode；实际应统一使用Scode且手写无额外价值时，不为了成对增加Hcode。双版须有真正的算法机制、实现职责、设施或工程取舍差异。

## 实际工程变更

`second_algorithm/chapters.py:_paradigm_contract`：

- 完整正式节的 `manualImplementationIds` 与 `standardImplementationIds` 任一可为空数组或省略，但不能同时为空。
- `facets.problem/fit/variation/engineering` 仍必需。
- `facets.manual/manualExplanation` 只在手写路径非空时必需；`facets.standard/standardExplanation` 只在Scode路径非空时必需。未选择的对应定位可省略或为空数组；实际给出的定位仍检查归属及边界。
- 没有Scode时 `standardRole` 可省略或为 `{}`；有Scode或填写角色内容时，仍核现有合法 `kind` 与非空 `explanation`。没有增加伪装“不适用”的新角色。
- 至少一个路径不表示只需一个标签：实现必须登记在本节真实任务中，manual方向仍须指manual实现，标准算法/结构方向仍须指standard实现。源码region、符号、目标编译依赖和实际检查不变。

作者设施 `tools/subheadings.mjs` 原本已经按照实际实现逐一核对Hcode/Scode，没有“每节两种都要出现”的硬约束，因此未无谓改动它。管理文件保留两种规范身份，不等于要求成稿使用两种。共享代码已有 `reuses`、实际读者链接、唯一源码区域与无环检查，继续有效；不为不同讲解重复打印同一源码。

## 实际验证

新增Python案例实际删去另一种实现的权威代码区域、作者标记和learning登记，而不是只把合同字段改为空：

- 单Hcode章合同可以校验且实际编译运行对应C++程序；不需要虚构Scode或对应解释。
- 单Scode章合同可以校验且实际编译运行对应C++程序；不需要虚构Hcode或对应解释。
- 已选择路径仍必须有相应解释；无任何实现、虚构实现ID、用标准算法角色假装manual代码、源码没有所声明符号、验证目标不依赖源码均仍失败。
- 本次执行已核本机真实C++编译器可用，两个单版程序的编译/运行确实执行；不是走无编译器分支。

`tests/test_chapters.py` 新增4项相关测试通过，原有路径角色回归通过。第一次按 `-k only_` 运行还带入了一个既有外部挑战测试，亦通过，不把它算作新增覆盖。

`test/carrier-subheadings.test.mjs` 新增两个真实单版作者成稿案例，实际移除另一版源码与learning身份、更新独立标题候选和所用管理项。单H/单S都能装配出不含另一标签的完整成稿；把剩余代码只改标签来冒充另一方向仍被拒绝。整个测试文件19项全部通过，包含原共享实现链接、环、标记与题目单元检查。

本子任务没有改变第一章正文或真实章合同；真实内容取舍由根代理结合独立审阅落实。本子任务未构建dist、未提交、未部署。生产规则与测试输入已变化，根代理须在最终修改冻结后重新绑定当前审阅与发布证据。
