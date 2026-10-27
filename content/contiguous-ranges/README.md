# 算法第一章：连续片段

正式章节，第1章，2026-10-27版。题名为**连续片段：前缀状态与滑动边界**，由一篇正文承载，不按文件或代码块数拆章。

[站内阅读](https://second-algorithm.pages.dev/#/read/algorithm-contiguous-ranges/algorithm-contiguous) · [HTML](连续片段.html) · [Markdown](连续片段.md) · [C++17源码](连续片段.cpp)

研究形成的范围是：静态区间摘要、固定窗口聚合与频数、历史前缀匹配、不同合法条件的单向窗口、最大非空段和，以及有明确支配依据的单调队列。共21个相邻参考代码块，代码块数不等于算法数或原题数。含负数最短阈值段、允许零的精确和计数、重复字符覆盖等条件差异在章内讲清，不依赖隐藏试稿。

范围比较、目标v1/v2、实际读件、动态扩查及案例去向见[研究任务](../../work/algorithm-first-chapter/README.md)，实际源码与独立枚举验证见[验证](../../work/algorithm-first-chapter/verification.md)。本轮参考对照通过1,333,520条断言；它不等于整章范围的数学完备证明或原平台全部提交。

一般数组处理、排序、任意位置k-sum、二维／动态区间、窗口中位数／排名／代价等不以同一个窗口外壳自动承载。后续由研究部结合已发布内容重新形成目标，不把这一排除清单直接升级为下一章目录。

权威作者稿为`连续片段.source.md`，代码为同名`.cpp`；现有构建器装配阅读版并在`build/连续片段.json`绑定摘要。展示登记为`algorithm-contiguous-ranges`／`algorithm-contiguous`。
