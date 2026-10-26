# 第二算法

面向求职上机题的算法参考总册。按**题型条件、关键思路、重要变种和 C++ 模板**组织内容，供已有计算机背景的读者查阅、理解和记忆实现。

内容建设先建立来源与范围，再研究归并，最后编写正文。二分专题现已完成一次全流程研究与修订，提供基础、组合判定、进阶扩展三份离线阅读稿；已知进阶缺口及未取得原题继续保留，尚未宣称范围完备。

## 当前可用内容

| 内容 | 入口 | 状态 |
|---|---|---|
| 来源站点池 | [来源说明](docs/SOURCE_POOL.md) · [机器登记](catalog/sources.json) | 25 站、38 入口；12 个核心、13 个扩展来源，采用等级与实际读取状态分开 |
| 实战书单 | [书目与准确版本](docs/BOOKS.md) · [书目登记](catalog/books.json) | EPI C++、CP4 两卷为首批，中文进阶材料按需补充 |
| 实际目录快照 | [快照指针](catalog/inventory-heads.json) · [本次来源状态](research/2026-10-26/source-status.json) | 8 个入口完成目录／候选链接捕获，不能据此推断正文已读 |
| 二分专题 | [阅读入口](content/binary-search/README.md) · [全流程研究](research/2026-10-26/binary-full-cycle.md) | 3份阅读稿、70组相邻C++代码；原题、模式、代码块数量分别统计 |
| 协议与工程 | [执行协议](protocol/CONTENT_PIPELINE.md) · [架构](docs/ARCHITECTURE.md) · [恢复](docs/RECOVERY.md) | 一份语义入口，确定性工具与实际内容判断分工 |

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
