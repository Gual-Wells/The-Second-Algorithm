# 初始二分案例读取记录

日期：2026-10-26。以下原题题意和约束已经实际读取；不是目录抓取自动生成的阅读认证。采用自写简记，未将题库全文搬入仓库。对应关系仍为研究判断，未认证完整二分范围。

## Factory Machines

[CSES 1620](https://cses.fi/problemset/task/1620/)：各台机器可同时独立生产，耗时为正，目标为最早达到给定总产量。给定时间可累计每台的整数产出，归入现有并行生产条目。原题规模要求使用 long long 累计和边界；本次没有另写重复模板。

## Array Division

[CSES 1085](https://cses.fi/problemset/task/1085/)：正数数组按原序分为 k 个连续非空段，最小化最大段和，且 k 不超过数组长度。现有非负容量贪心判定可承载。总和按原题范围需要 long long。

## MinMaxDivision

[Codility 原题](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/min_max_division/)：非负数组的连续分块，允许空块，K 可能大于元素个数。核心容量算法可复用，但与现有试章的非空分段前提有差异，因此保留为 variant-needed。

## NailingPlanks

[Codility 原题](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/nailing_planks/)：操作顺序固定，寻找足够覆盖所有闭区间的最短操作前缀。可研究前缀计数等区间命中判定，与已有生产/装载判定不同。现有试章缺少真实讲解和实现，因此保留 gap-confirmed；尚未选定最终主解。
