# 二分专题：主研究记录

基线：`a508e421bdc542947783cba06de29f31d5fe057c`。这份记录保存本轮实际判断；目录数量不是全网覆盖率。

## 实际发现路径

1. 从已捕获的 CP 作者动态分类表枚举 `3.3a, Binary Search` 36 条和 `3.3b, Bisection and BSTA, E` 32 条。两组是本轮有限候选集，不能用仅搜索 binary 得到的36条冒充完整专题。当前网页属于动态 CP5 草稿分类，不能冒充本地 CP4 2020 版目录。
2. 实读 USACO Guide 二分页的资源、正文、错误分析及问题表：20道表中题目、Maximum Median正文例题，另有方法入口。发现旧采集遗漏7条 http/www USACO原题及CodeChef、oj.uz入口，已修正协议识别、域名过滤和稳定身份。重新捕获为23条（21道原题＋2个方法链接）。旧14条快照保留为历史，不改写它。
3. 实读 cp-algorithms 二分正文，从有序边界、任意单调判定、答案变换、连续求根、按二次幂跳跃，扩展至批量并行二分。实读其LIS方法中状态、恢复序列、严格/非降条件与计数局限；以及Fenwick前缀和实现与范围。
4. 实读 OI Wiki 二分相关部分、整体二分的条件和递归分流，以及WQS引入、对偶几何和共线处理。WQS的单调数量本身不保证原数量约束最优值可恢复，必须核对离散凸性、并列最优规则和范围。这不是可随意套到任何“恰好k次”问题的模板。
5. 实读 AtCoder Library segtree 文档 `max_right/min_left` 的契约与例子。树上下降不同于普通数组外层二分；前缀和存在负数时不保证单调。
6. 另一组代理独立核对教材及原始题干；挑战代理在未看本轮分类与现有正文的条件下冻结材料。挑战的独立性只相对于本轮分类构造，不能声称模型从未见过相关题。

## 本轮根代理实际查询

- `site.usaco.guide binary search parallel binary search fractional programming`
- `site.cp-algorithms.com binary search powers of 2 continuous search`
- `site.oi-wiki.org 二分 整体二分 二分答案 实数`
- `site.codeforces.com edu course 2 lesson 6 binary search minimum average path`
- `site.leetcode.com/problems binary search "sum of the first k"`
- `site.atcoder.jp "binary search" "editorial" "quantile"`
- `site.cp-algorithms.com "lower_bound" "longest increasing subsequence"`

搜索结果用于导航，技术判断回到原始方法页/原题；未读结果没有进入已读清单。代理的实际查询另见各自 actual-reads/research。

## 直接读取的原始页面与结论

| 入口 | 实际范围 | 本轮用途 |
|---|---|---|
| [cp-algorithms Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) | 完整算法正文和习题链接，未逐题读取所有习题 | 校对边界、连续求根、二次幂搜索、批量二分的条件 |
| [USACO Guide](https://usaco.guide/silver/binary-search) | 完整正文与当次题目表 | 有限清单、不同判定方法、采集漏项 |
| [OI Wiki 二分](https://oi-wiki.org/basic/binary/) | 二分查找/答案的条件、实现和目录边界 | 不把三分、分数规划仅凭名称混为一种模板 |
| [OI Wiki 整体二分](https://oi-wiki.org/misc/parallel-binsearch/) | 引入、条件、全局/区间k小及分流说明 | 与按时间桶处理的批量二分分开 |
| [OI Wiki WQS](https://oi-wiki.org/dp/opt/wqs-binary-search/) | 引入、传统方法、凸性和共线处理；未读完全部例题 | 建立明确的进阶边界，拒绝万能“惩罚项二分” |
| [Fenwick](https://cp-algorithms.com/data_structures/fenwick.html) | 前缀和、点修改、区间解释 | 独立实现排名查询所需的数据结构 |
| [LIS](https://cp-algorithms.com/dynamic_programming/longest_increasing_subsequence.html) | 二次DP、tails法、恢复及相关任务 | 二分作为状态定位；计数不能只存tails |
| [ACL segtree](https://atcoder.github.io/ac-library/production/document_en/segtree.html) | 完整接口及max_right/min_left与代码例 | 数据结构内下降的真实契约 |
| [AGC002 D](https://atcoder.jp/contests/agc002/tasks/agc002_d) | 完整原题/约束/例子 | 批量查询；两个点可达集合并集大小，不是强求两点先连通 |
| [CSES2101](https://cses.fi/problemset/task/2101/) | 完整原题/约束/例子 | 加边时间前缀下最早连通；同点0天、永不连通-1 |
| [CSES1145](https://cses.fi/problemset/task/1145/) | 完整原题/约束/例子 | 严格递增、保持原顺序、n达2e5 |
| [ABC149 E](https://atcoder.jp/contests/abc149/tasks/abc149_e) | 完整原题/约束/例子 | 有序对含自身；阈值计数之后还要累计前M大和并修正阈值重复 |
| [LC2389](https://leetcode.com/problems/longest-subsequence-with-limited-sum/) | 完整原题/约束/例子 | 正数、仅求数量时可选最小元素；排序前缀和＋upper_bound |

## 访问限制

- Codeforces EDU课及第1、2步直接请求重定向课程总页，不能称已枚举该课全题。可用其他公开入口发现候选，须回原题核对。
- LC243/244原页仅返回Premium订阅入口，没有取得题干，不登记为已读，也不借镜像冒充原页。
- Kattis FreeWeights返回403；没有绕过限制。它仍在候选清单中，不能因读不到判为不相关。
- USACO旧www入口在web工具中失败；代理可读的新官方域名及访问结果另记，目录原链接仍保留原貌。

## 内容形态判断

主阅读稿仍采用可读分组、局部变种对照及紧邻的C++代码。新增模式按“为什么能丢掉半边/判定怎样算”区分，而不是每个题名造一个模板。扩展内容需要真实承载，未实现的WQS、动态整体二分、复杂几何等明确保留缺口，不用不存在的其他章节指针假装完成。

## 本轮代码复核发现

原试章 `integer_sqrt` 在 x=LLONG_MAX 时使用 `r-l+1` 会溢出；`expand_first` 的 `r*2` 在大上界可能溢出。现有随机小范围测试不能证明这些端点正确。本轮须修复并增加可区分的整数端点检查。教材同样不能原样照搬，代理记录的字形、Windows long和负移位等问题见 foundations 记录。
