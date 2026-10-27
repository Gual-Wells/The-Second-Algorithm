# 第二算法

面向求职的算法与 C++ 实战参考总册。算法按**题型条件、关键思路、重要变种和 C++ 模板**组织；C++本身按**具体代码问题、语言／库机制、关键差异和参考实现**组织，供已有计算机背景的读者查阅、理解和记忆实现。

研究部综合全部已知资料、当前研究和真实已发布内容，深度调查下一章值得研究什么，在过程中动态增量或调整范围，再向算法或C++工程线交接明确研究目标。工程继续深入内容、编写、核验和逐章发布，范围新证据和发布结果回流研究部。章的边界、体量和组织由研究产生，不按旧目录或gap列表顺次批量写全册。

二分专题已有基础、组合判定、进阶扩展三份离线阅读稿，属于同一专题，已知缺口继续保留。C++前期批量产出的七份稿、103个代码块保留为研究资产与候选作者稿，后续逐章重核范围并复用；它们不是已正式发布的七章，也不预定最终目录。

## 当前可用内容

| 内容 | 入口 | 状态 |
|---|---|---|
| 来源站点池 | [来源说明](docs/SOURCE_POOL.md) · [机器登记](catalog/sources.json) | 39个来源、72个入口；新增LLVM libc++固定版本回归材料，规则、练习、配方与工具分别登记 |
| 实战书单 | [书目与准确版本](docs/BOOKS.md) · [书目登记](catalog/books.json) | 算法EPI、CP4及四种C++教材已有本地基座；完整版与提取内容不上传Git |
| 实际目录快照 | [快照指针](catalog/inventory-heads.json) · [C++目录边界](work/cpp-research-2026-10-26/census-summary.json) | 11个入口有成功快照；目录取得与正文已读分开 |
| 二分专题 | [阅读入口](content/binary-search/README.md) · [全流程研究](research/2026-10-26/binary-full-cycle.md) | 3份阅读稿、70组相邻C++代码；原题、模式、代码块数量分别统计 |
| C++本身 | [前期研究稿](content/cpp/README.md) · [阶段研究记录](research/2026-10-26/cpp-full-cycle.md) | 七份候选稿保留供逐章研究复用，不视为七章正式发布 |
| 研究部 | [研究与目标交接协议](protocol/RESEARCH_DEPARTMENT.md) | 全局资料与内容判断、动态下一章范围、明确目标及工程反馈 |
| 协议与工程 | [共同入口](protocol/CONTENT_PIPELINE.md) · [算法工程线](protocol/ALGORITHM_TRACK.md) · [C++工程线](protocol/CPP_TRACK.md) · [工程](docs/ARCHITECTURE.md) | 上游研究与两条工程线，共用来源、记录、构建、验证与恢复工程 |

本次[日志复盘](research/2026-10-26/workflow-retrospective.md)记录了产品形态纠偏、章节形成要求、C++批量成稿偏航和现有资产的处理依据。恢复工作时读当前协议；历史答复中的章数估计不作为约束。

目录捕获包括 CSES 400 个任务链接、Codility 17 个课程入口与二分课 2 题、AtCoder DP 26 题、cp-algorithms 163 个候选方法链接、CP 作者站 5555 条题号与分类记录、USACO 二分页 23 个相关链接及 AtCoder Library 14 个文档链接。CP 作者表中3462条原题链接在该历史快照仍未解析；本轮逐题实际解析的入口另存案例和核对记录，不回写历史。各集合互有重叠，不累加成“已掌握题数”或覆盖率。

二分有限清单的68条作者分类候选已逐项核对：47条原题实际读到，21条未取得。结合其他来源，案例库共101道已读原题；已有正文的模式与14项明确缺口分开登记，详见[本轮研究](research/2026-10-26/binary-full-cycle.md)。

## 使用工具

以下研究CLI需要 Python 3.11 及以上，不需要安装第三方依赖。在仓库根目录执行：

```sh
python -m second_algorithm sources --priority core
python -m second_algorithm sources --id codility
python -m second_algorithm collect cses problemset
python -m second_algorithm search "Factory Machines" --kind inventory
python -m second_algorithm search "二分"
python -m second_algorithm query-plan binary-search
python -m second_algorithm report
python -m second_algorithm validate
```

`collect` 只取得指定入口的目录元数据。`search` 可以查询来源、目录记录、已研究案例、模式和书目；未读记录不会因命中搜索而变为已读。`query-plan` 生成待执行查询，不会声称已经完成外部搜索。

新增来源先登记候选，完成访问、用途和传播关系核对后再采用：

```sh
python -m second_algorithm propose-source new-source "来源名称" https://example.org/ --reason "需要补足的具体内容"
```

采集为空、遇到访问限制、有待处理分页或目录减项时，保留先前成功基线。减项需实际审阅后才可使用 `collect ... --accept-change`。原件缓存、运行记录和用户教材在 `.local/`，不进入 Git；目录快照和其引用按版本保留。

## 内容与教材

一个算法模式有一个主要讲解位置，可以从多个专题找到。题目、算法、条件变种、替代方法与实现分别建关系。只有讲解和代码真实承载了相应内容，才能处理对应缺口；脚本检查通过不替代语义审阅。

用户提供的教材在本地校对卷册、版本、重复、页序与提取质量，使用文件摘要和页／章节定位。图表、公式和代码保持回原件能力；OCR 与纯文本提取不自动成为可信代码。公开仓库只保存书目与质量摘要，不保存完整教材或私人读件。见 [本地教材约定](docs/LOCAL_MATERIALS.md)。

可复用的[本地PDF处理工具](tools/materials/README.md)另列可选依赖，保存已实际验证的页级导出和显式字形修正方法；完整教材与处理结果仍在被忽略的本地材料包中。

## 验证

```sh
python -m unittest discover -s tests -v
python -m second_algorithm validate
```

CI 还编译运行现有 C++ 模板的独立结果对照。网络源采集不放入提交必跑检查，避免把站点限流和临时故障当成代码回归。

当前仍处于范围研究与专题建设阶段。来源清单、已读范围、待判案例和实际正文去向共同说明进度；不宣称已穷尽互联网或全部求职算法题。
