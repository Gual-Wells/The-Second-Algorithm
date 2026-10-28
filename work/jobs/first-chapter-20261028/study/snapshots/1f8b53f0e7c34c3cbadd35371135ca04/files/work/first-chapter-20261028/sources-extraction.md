# 第一章二分领域：判定器、隐式秩与组合应用提取

2026-10-28。独立 scope 与初始化空协同已由根记录，本文件进入选域后提取，不是正式作者稿，不改 study/catalog。材料 JSON 以 `materials` 标准字段持久化。合计 19 份原题的题意、约束、样例和作答形式已核，4 份方法读件，另 1 份付费原题未得。读取和分析不等于成品代码已经写成或验证；LC 示例图未另行下载，不据图片独有信息作结论。

## 新发现与分类底线

- 连续分段、贪心放置、累计产能、堆模拟、图阈值、输入前缀、隐式秩与分数规划有同一二分外层，却需要不同检查器的正确性和复杂度证明。
- 数对、双有序矩阵、乘法表采用不同的累计秩；两个数组中位是在分割位置上二分。重复计数、值域和下标域不能混同。
- CSES Projects 要求 `end < start`；LC1235 允许 `end == start`。真实合同改变了 lower_bound/upper_bound。
- LIS 的 tail 不是真实最优序列，不保方案数量。信封同宽时高度降序是保证严格二维嵌套的关键。
- Sabotage 官方文字的 at least/minimum 方向冲突，附代码实际判断剩余平均 `<= guess`；必须独立推导，不能照录。
- 新增 NailingPlanks 补“最短输入前缀”的判定族。LC1102 原站为 Premium 未取题意，不借镜像冒充已读。

## 题型族

### 1. 连续容量分段：以最少段数判定最大段和

**原题合同**：LC410 将非负序列分成恰好 k 个非空连续段，使最大段和最小；n≤1000、k≤min(50,n)、元素 0..10^6。CSES1085 为正数、n≤2×10^5、元素≤10^9。Codility MinMaxDivision 允许空块，与恰好非空不得无声混称。

**机制**：给上界 B，从左到右尽量延长当前段，只有加入下一项会超过 B 才开新段。贪心得到最少段数：任何可行首段不能超过贪心首段，再对余下部分归纳。段数≤k 为可行；在非负且 k≤n 时继续切段可达恰好 k。B 越大约束越宽，找 first true。

**条件**：非负性同时支撑检查器和 max 元素下界；含负数不能沿用。例如 [-5,10,-5] 的单段和为 0，但 max 元素为 10。CSES 总和可达 2×10^14。空数组、非法 k 不属原合同。

**变型**：与产能、间距、调度共用外层但检查器不通用。若加入负数或额外代价，可能要换成 DP。输出实际划分需保恰好 k 非空，可反向恢复或强制留足剩余单项。

**手写层次**：first-true 整数二分和扫描 check。段数从 1 开始，先拒绝单项>B，再用 `sum > B-x` 控一般化加法溢出，段数超 k 早退。O(n log(sum-max+1))。

**标准设施**：max_element 定下界，accumulate(...,0LL) 定上界；不存在整题 split_minimax 标准函数。实际库方案须保留判定主体，不复制整段只换一行累加凑“双版本”。

**C++支撑**：初值类型决定 accumulate 累加类型；整数范围预算；const vector&；不要每轮判定复制输入。

**验证方向**：小 n 枚举切点；k=1/n、全 0、单个巨值、B 刚好 max/sum；负数反例是适用性验证而不是扩大合同。

**交叉思想**：greedy, prefix-sums, dynamic-programming-boundary

**练习**：
- [410. Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/description/)
- [CSES Array Division](https://cses.fi/problemset/task/1085/)

### 2. 最大化最小间距：以最早放置保留空间

**原题合同**：LC1552 从 n 个互异整数位置选 m 个，最大化两球最小间距；n≤10^5、坐标 1..10^9、2≤m≤n。输入不保证排序。

**机制**：排序后给 d，先选最左点，此后选距上点至少 d 的最早位置。第 j 个贪心位置不晚于任何可行方案的第 j 个位置，保留最多剩余空间。能放≥m 即 true；d 变大收紧，找 last true。

**条件**：一维离散位置，每处至多一个；排序是算法前提。上界可取 span/(m-1)，0 是统一合法下界。

**变型**：与容量分段的交换/领先论证不同。位置若改成可放置区间，check 要计算每区间可容纳数且防溢出，属于实质变型，不能只换输入类型。

**手写层次**：last-true+扫描或转 first false。差值/中点按 64 位预算；总 O(n log n+n log span)。

**标准设施**：sort；以重复 lower_bound 定位下一个位置是实际替代，但每轮可能 O(m log n)，不必优于 O(n) 扫描。无整题布局设施。

**C++支撑**：排序是否允许修改输入；strict weak order；end 不可解引用。

**验证方向**：枚举 m 子集；m=2/n、距离刚好、逆序、极大跨度。

**交叉思想**：greedy, sorting

**练习**：
- [1552. Magnetic Force Between Two Balls](https://leetcode.com/problems/magnetic-force-between-two-balls/description/)

### 3. 累计产能：反求达标最早时刻

**原题合同**：CSES1620 多台独立机器同时生产，ki 秒/件，求 t 件所需最短时间；n≤2×10^5、t≤10^9、ki≤10^9。

**机制**：T 时每台贡献 floor(T/ki)，求和≥t 为可行；first true，不逐件模拟。

**条件**：独立且没有共享资源、启动或切换限制。上界 min(ki)×t≤10^18，在 signed64 内；把 n 项产能无截断累加可能超 64 位。

**变型**：和 Cow Dance 不同，产能直接可加，无固定队列产生的开始时间依赖。加入机器启动时间需改贡献公式并核合同。

**手写层次**：搜索 [0,minK*t]；贡献计数达到 t 即截断，或维护 remaining 避免溢出。O(n log(minK*t+1))。

**标准设施**：min_element 定有效上界；无标准函数反求产能时间。为使用算法而用复杂有状态 lambda 不增加清晰度。

**C++支撑**：乘前提升 `1LL*minK*t`；精确整除；计数早退兼顾性能与溢出。

**验证方向**：小目标用堆逐事件模拟；n=1、全同、ki=1/t=10^9、n 很大时饱和、阈值前后。

**交叉思想**：counting, priority-queue-alternative

**练习**：
- [CSES Factory Machines](https://cses.fi/problemset/task/1620/)

### 4. 并行台数：以事件模拟判定固定顺序队列

**原题合同**：USACO Cow Dance Show 固定登台顺序，K 个台位；谁先结束谁让下一头立即开始。N≤10000、di≤100000、Tmax≤10^6，保证 K=N 可行，求最小 K。原题 cowdance.in/out。

**机制**：给 K，用结束时间最小堆模拟最早释放台位，后续结束时刻=最小结束时刻+新时长；任何结束>Tmax 即不可行。题目与官方解析明确加台位不使固定队列更晚开始，因此 first true。

**条件**：固定顺序、立即填空位，不能改成任意重排或总时长/K。每次 check O(N log K)，整体 O(N log²N) 上界。

**变型**：产能题直接计数，此题有事件依赖；区间房间分配的开始时刻是给定，此题则动态形成。恢复具体台位要另存台位 ID。

**手写层次**：手搓最小堆接口+二分 [1,N]。K 个 0 初始化和前 K 头直接入堆都是可行写法，不能混用。

**标准设施**：priority_queue<long long,vector<long long>,greater<long long>>；官方解析附 Java，不能等同本项目 C++ 已验证。

**C++支撑**：priority_queue 默认大根堆；top 引用不能跨 pop 使用；构堆与逐 push 的区别。

**验证方向**：小 n 每次线性找最小结束时刻作独立 oracle，并枚举 K；同长、前长后短、同时结束、K=1/N、T 恰等。

**交叉思想**：simulation, priority-queue, greedy

**练习**：
- [USACO Cow Dance Show](https://usaco.org/index.php?page=viewproblem2&cpid=690)

### 5. 路径瓶颈：阈值下的可达性

**原题合同**：LC1631 四邻接网格，从左上到右下，路径代价为最大相邻高度绝对差，求最小代价；行列 1..100、高度 1..10^6。

**机制**：给 B，只允许高度差≤B 的边，B 增大只增边；用 BFS/DFS 查可达性。最优值为原边权之一或 0，可二分数值或排序去重边权。

**条件**：瓶颈目标，非路径边权之和。1×1 代价 0；直接隐式访问网格，不必每轮显式重造图。

**变型**：minimax Dijkstra 与边排序+DSU 是同题不同算法，不能伪装成二分的库实现；说明为何适用即可，不展开整部图论。

**手写层次**：二分+数组队列 BFS/迭代 DFS，seen 保防重复。O(RC log W)，O(RC) 空间。

**标准设施**：queue<pair<int,int>> 或 vector 栈代替手写队列。标准库没有完整图可达算法；priority_queue 的 Dijkstra 属另一算法。

**C++支撑**：先预算相减再 abs 的类型；seen 每轮重置/时间戳；行列边界。

**验证方向**：小图 minimax Floyd 或枚举边阈值+独立连通；1×1、全高相等、绕远更优、单行/列。

**交叉思想**：graph-search, disjoint-set-alternative, dijkstra-alternative

**练习**：
- [1631. Path With Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/description/)

### 6. 最短输入前缀：激活后所有区间命中

**原题合同**：Codility NailingPlanks 必须按顺序使用前 J 钉子，让每个闭区间木板至少被一钉命中，求最小 J 或 -1。N,M≤30000，坐标 1..2M，A≤B。

**机制**：固定 J，给前 J 钉位置计数+前缀和；每板 prefix[B]-prefix[A-1]>0。J 增大只加钉，first true。先检查 J=M 区分无解。

**条件**：前缀而非任意最少钉集合；一钉可命中多板。坐标界 2M 让每轮 O(N+M) 前缀方案够用。

**变型**：坐标大时可 sort 前 J 钉+lower_bound(A) 查≤B，或预处理最早钉序+RMQ；这是条件/复杂度变化。本题单查询不同于多查询并行二分。

**手写层次**：first true+手写计数前缀，O((N+M)log M)，闭区间端点必须计入。

**标准设施**：partial_sum 可原地构前缀；sort+lower_bound 是另一稀疏坐标检查实现，说明其代价。

**C++支撑**：vector 重置/复用，A-1 合法依赖坐标从 1 起；用 set 不能丢掉输入序号语义。

**验证方向**：枚举 J，逐板逐钉；重复钉、端点、同时命中、无解、坐标极值。

**交叉思想**：prefix-sums, range-query, sorting

**练习**：
- [Codility NailingPlanks](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/nailing_planks/)

### 7. 数对距离秩：窗口计数反求第 k 小

**原题合同**：LC719 所有 i<j 数对距离按重数排序，求第 k 小；n≤10^4、值 0..10^6、k≤n(n-1)/2。

**机制**：排序后试 D，单调左指针保持 nums[r]-nums[l]≤D，累计 r-l 得到距离≤D 的数对数 C(D)。求最小 C(D)≥k。

**条件**：同右端合法左端形成后缀，左指针不回退；重复值产生 0 距离且按索引数对计数。

**变型**：与矩阵秩共有值域二分，但 count 是双指针；不是第 k 个不同距离，也不是恰等 D 的数对数。

**手写层次**：first true+O(n) 窗口 count；整体 O(n log n+n log span)。每个左端二分右端可作为较慢替代。

**标准设施**：sort+upper_bound 的 count O(n log n)，额外一个 log；不能物化所有数对再 nth_element 作为同资源方案，但可作小 oracle。

**C++支撑**：计数与差值的类型预算、乘前提升、排序的修改语义。

**验证方向**：小 n 物化距离排序；全同、n=2、k 端点、重复密集、C(D) 跳过 k。

**交叉思想**：two-pointers, order-statistics, sorting

**练习**：
- [719. Find K-th Smallest Pair Distance](https://leetcode.com/problems/find-k-th-smallest-pair-distance/description/)

### 8. 行列有序矩阵秩：楼梯计数

**原题合同**：LC378 n×n 每行每列非降，求第 k 小并按重数；额外空间须优于 O(n²)。n≤300、值 [-10^9,10^9]、1≤k≤n²。

**机制**：试 x，从左下/右上沿边界，每步整行/列排除，O(n) 统计≤x；找 first count≥k。边界为左上值、右下值。

**条件**：双有序才能楼梯线性；仅行有序改逐行 upper_bound 或堆归并。行主序未必全有序，不能 flatten 后直接按下标二分。

**变型**：题目提及更高阶 O(n) 选择论文；这是非二分的更强方法，不必把本章改成线性矩阵选择专论，但应知存在，不能声称二分最优到不可改进。

**手写层次**：值域 first true+楼梯 count，O(n log valueRange)，O(1) 额外空间。

**标准设施**：每行 upper_bound，单次 O(n log n)，真实库替代；堆归并是不同选择算法。物化 sort/nth_element 不满足空间目标。

**C++支撑**：负值域和中点类型；j 可为 -1，不可无符号下溢；计数重复值。

**验证方向**：小矩阵物化排序；全同、负数、1×1、k 端点、大跨度；仅行有序反例检验前提。

**交叉思想**：matrix-monotonicity, order-statistics, heap-alternative

**练习**：
- [378. Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/description/)

### 9. 乘法表秩：解析计数巨大隐式集合

**原题合同**：LC668 m×n 表 aij=i*j，1-based，求第 k 小；m,n≤30000、k≤m*n，不显式存表。

**机制**：试 x，第 i 行有 min(n,floor(x/i)) 个值≤x，累加成秩；first≥k。迭代较小维度降低代价。

**条件**：正整数乘法结构支撑解析计数，不能用于任意矩阵。重复积按单元格重数；原乘积≤9×10^8，但泛化乘前提升。

**变型**：比矩阵秩多解析模型、无须访问单元格；整除分块可能进一步加速，但原约束 O(min(m,n)log mn) 足够，不能只为堆高阶技巧增加负担。

**手写层次**：first true+[1,1LL*m*n]，count 达 k 截断，不引浮点。

**标准设施**：swap 规范化较短维度；无隐式乘法表选择函数。nth_element 需物化，不是相同资源方案。

**C++支撑**：整数除法、乘前转换、饱和计数。

**验证方向**：小表物化排序；1×n、转置、重复积、k 端点与秩跳跃。

**交叉思想**：arithmetic-counting, order-statistics

**练习**：
- [668. Kth Smallest Number in Multiplication Table](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/description/)

### 10. 两有序数组中位：在合法分割位置二分

**原题合同**：LC4 两个升序数组，各长 0..1000，总长 1..2000，值 [-10^6,10^6]，O(log(m+n)) 返回中位数。

**机制**：较短数组取左半长度 i，另数组 j=(m+n+1)/2-i。需 A左末≤B右首、B左末≤A右首；第一条失败则 i 太大，第二条失败则 i 太小。合法后左最大/右最小组成奇偶答案。

**条件**：搜索短数组保证 j 合法，或显式限制 i∈[max(0,left-n),min(m,left)]。一边可空，整体不可空。不是 value-domain rank 反查。

**变型**：第 k 小改左侧总数与合法范围；逐次去掉两数组各约 k/2 元素是另一选择法。merge 线性不满足题目对数复杂度。

**手写层次**：分割二分+显式缺边判断或 64 位哨兵，O(log min(m,n)) 时间 O(1) 空间。

**标准设施**：min/max、swap 组织视角；无标准双有序对数选择。merge 可作 oracle 或明确标注的线性备选。

**C++支撑**：有符号索引防 i-1/j-1 下溢；边界访问条件；偶数和先提升或转 double 防泛化溢出。

**验证方向**：穷举小非降数组+merge；空一边、全同、奇偶、单元素、全部 A<B、端点分割、泛化 int 极值。

**交叉思想**：partition, selection, divide-and-conquer-alternative

**练习**：
- [4. Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/description/)

### 11. DP 有序前沿：最小尾值与二分替换

**原题合同**：LC300 严格 LIS 长度（n≤2500，允许负数/重复）；LC354 严格双维信封、不可旋转（n≤10^5）；LC673 严格 LIS 方案数（n≤2000，答案 32 位）。

**机制**：tail[len-1] 是当前前缀中长度 len 的可行序列最小尾值，属于支配压缩，不是同一真实序列。严格 LIS 首个≥x，非降首个>x。信封宽升序、同宽高降序，再高严格 LIS，阻止同宽入链。

**条件**：tail 有序且替换保持支配不变量；原数组不要求有序。恢复链需 tailIndex+parent，不能直接输出 tail；压缩丢失数量，不能直接求 LC673。

**变型**：恢复最优链、严格/非降、二维偏序与最少非增覆盖对偶是有用邻支。LC673 用长度+计数 DP 或值域树状态，不是改一行 lower_bound；作者文章的“不能用二分”须限定为其简单 tail 方法，不声称所有含二分工具的计数算法都不可能。

**手写层次**：手写 tail 位置二分；O(n²) DP 可作证明起点/oracle。恢复保存前驱索引。LC673 O(n²) 计数 DP 满足其约束，不硬造 tail 解。

**标准设施**：lower_bound/upper_bound 替代位置查找；sort 信封比较器+lower_bound；无标准 LIS 整题函数。

**C++支撑**：比较器 w 升/h 降且不用≤；vector 增长前先将迭代器转 index；reserve 不改变 size。

**验证方向**：枚举子集与 O(n²) DP；全同严格1/非降n、tail 非真实链、同宽信封、恢复索引递增、计数重复路径。

**交叉思想**：dynamic-programming, dominance, sorting, counting-boundary

**练习**：
- [300. Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/description/)
- [354. Russian Doll Envelopes](https://leetcode.com/problems/russian-doll-envelopes/description/)
- [673. Number of Longest Increasing Subsequence](https://leetcode.com/problems/number-of-longest-increasing-subsequence/description/)

### 12. 带权兼容调度：二分定位 DP 前驱

**原题合同**：CSES Projects n≤2×10^5、日期/奖励≤10^9，同日只能参加一个，所以 end<start；LC1235 n≤5×10^4、profit≤10^4，明确 end==start 可衔接。CSES 允许 a=b。

**机制**：按结束排序，dp[i] 为前 i 项最大奖励。找最后兼容前驱 p，dp[i]=max(dp[i-1],dp[p]+profit)。CSES lower_bound(start) 得 end<start 数量，LC upper_bound(start) 得 end≤start 数量。

**条件**：权重使最早结束贪心失效。二分只加速前驱，不替代 DP 最优性；查已处理前缀，勿把当前/未来相同结束值纳入。

**变型**：冷却期、恢复集合改变兼容键或祖先信息；按起点反向找后继是对称实现。不是普通数组查找的换皮。

**手写层次**：手写 bound+DP，O(n log n)，O(n)；CSES 总奖励可达 2×10^14，需 64 位。

**标准设施**：sort+lower_bound/upper_bound，DP 保留；分离 struct jobs 和 end vector 有助明确比较方向。

**C++支撑**：结构体排序、lambda、bound 参数方向；dp 长 n+1，使兼容数量直接是 dp 下标，免 p=-1。

**验证方向**：枚举小子集；两题分别严格/非严格时间 oracle；同日接续反例、零时长、相同 end、重奖长/短、64 位累计。

**交叉思想**：dynamic-programming, weighted-interval-scheduling, sorting

**练习**：
- [CSES Projects](https://cses.fi/problemset/task/1140/)
- [1235. Maximum Profit in Job Scheduling](https://leetcode.com/problems/maximum-profit-in-job-scheduling/description/)

### 13. 长度受限最大平均：变换后维护合法前缀最小值

**原题合同**：Luogu P1419：n≤10^5，合法段长 S..T，元素 [-10^4,10^4]，求最大平均，输出三位。比方法示例仅最短长度多了最长长度。

**机制**：试 λ，b_i=a_i-λ。存在平均≥λ 的段，等价 P[r]-min(P[l])≥0，l∈[r-T,r-S]。单调队列维护合法前缀窗口；λ 增大收紧，last true。

**条件**：上界 T 要求候选过期；只有最短长度可用运行最小前缀，但加入上界不能继续保留所有历史最小。可负输入不能用正数 sum 滑窗。

**变型**：最低平均可取反；floor 最优平均可整数搜索，但三位近似需独立精度预算。每次前缀都按同一个 λ 变换。

**手写层次**：固定次数浮点二分 [min(a),max(a)]，check 前缀+数组单调队列；O(n×iterations)。保留可行侧下界并评估输出舍入。

**标准设施**：deque 存候选下标，minmax_element 定界；无标准“受限段平均”或通用滑动窗口最小整题函数。

**C++支撑**：double/long double 精度与固定迭代，不用浮点 while(l<r)；deque 删除后的引用；fixed/setprecision 只是格式化。

**验证方向**：小 n 枚举所有合法段的有理平均；S=T、S=1/T=n、全负、全同、最优边缘、过期前缀反例和舍入边界。

**交叉思想**：prefix-sums, monotonic-deque, fractional-programming

**练习**：
- [P1419 寻找段落](https://www.luogu.com.cn/problem/P1419)

### 14. 删中段后最小平均：全局变换和减最大内部子段

**原题合同**：USACO Sabotage：3≤N≤10^5，Mi=1..10000，必须删非空内部连续区间，首尾保留，求剩余平均最小，输出三位。原文一处 remove cow 是叙述笔误，不改机器合同。

**机制**：试 λ，b_i=Mi-λ，总和 S。剩余平均≤λ ⇔ S-removedSum≤0 ⇔ 内部非空最大子段和≥S。Kadane 检查，λ 增大放宽，first true。

**条件**：首尾不得删且至少删一项；Kadane 从第一个内部 b 初始化，不能让空段 0 抢掉全负真实最大。分母始终正。

**变型**：官方文字 at least/minimum 方向混乱，附代码 best>=total-guess*N 对应≤guess，按代数核正。它不是 P1419 选择一段最大平均。官方另给凸包+切线二分的精确 O(N log N) 替代，属于另一方法，范围复审应决定承载层次。

**手写层次**：浮点 first true [1,10000]，非空内部 Kadane+总变换和；固定轮数和精度预算。

**标准设施**：accumulate(...,0.0L) 与 max 辅助，总判定仍手写；不把累加函数当最大子段整体替代。

**C++支撑**：long double、非空初始化、内部索引、舍入；官方旧代码 N*10000 上界不是必要最紧界。

**验证方向**：枚举小 N 所有内部删除区间；N=3、全同、内部全低/高、只删一项、强制非空、三位舍入附近。

**交叉思想**：maximum-subarray, fractional-programming, convex-hull-alternative

**练习**：
- [USACO Sabotage](https://usaco.org/index.php?page=viewproblem2&cpid=419)

### 15. 固定数量最大比值：变换后取最大的 m 项

**原题合同**：Luogu P1570，从 n≤200 项恰选 m 项，最大化 sum(v)/sum(c)，ci,vi=1..10^4，答案≤1000，输出三位。不是取单项 vi/ci 最大的 m 个。

**机制**：正分母下，sum(v)/sum(c)≥λ ⇔ sum(v-λc)≥0。取最大的 m 项变换分数可得该阈值下最优和；λ 增大收紧，last true。

**条件**：正分母与恰选 m 不能丢。若增加容量/冲突约束，top m 不再是正确检查，应换背包/匹配等子算法。

**变型**：与最大平均、删中段同属分数变换，但各自可行子问题不同；Dinkelbach 是另一方法，不能称库重写。

**手写层次**：浮点二分 [0,1000]，手写排序/选择取 top m 后求和；m=n 不必分隔。

**标准设施**：sort(...,greater<>) 简单 O(n log n)；m<n 时 nth_element(begin,begin+m,end,greater<>) 令前 m 为 top m，但前 m 未排序，平均线性。只求和无需另排序。

**C++支撑**：nth_element 非全排序；m=n 分支；浮点比较器不能用破坏 strict weak order 的 epsilon；不要制造 NaN。

**验证方向**：枚举小 n 的 m 子集，交叉乘/高精度比值；m=1/n、重复、极不均 c、单项比例排序失效、阈值近最优。

**交叉思想**：fractional-programming, selection, sorting

**练习**：
- [P1570 KC 喝咖啡](https://www.luogu.com.cn/problem/P1570)

## 方法读件

### Cow Dance 官方分析

[原始解析](https://usaco.org/current/data/sol_cowdance_silver_jan17.html)。实际读完 52 行分析和 Java 实现。给定 K 用最早结束时间优先队列，单次 O(N log K)，外层二分。局限是固定顺序立即填位；不能扩成任意调度。Java 原码与本项目 C++ 验证是不同事实。

### Sabotage 官方分析

[原始解析](https://usaco.org/current/data/sol_sabotage.html)。实际读 119 行分析和两份代码。保留上述方向纠正。第二份代码以首尾前缀/后缀点形成下凸包，再二分最小斜率，精确 O(N log N)；已读不等已实现。它同时提供本章范围反查线索。

### LIS 方法与变型

[当前真实正文](https://cp-algorithms.com/dynamic_programming/longest_increasing_subsequence.html)。实际读 DP、最小尾值、恢复、非降、计数与覆盖对偶的相关段。旧 `/sequences/` 路径仅迁移通知。作者计数“不可能用二分”的说法须限定为其简单 tail 压缩法，不是对所有含二分工具算法的绝对定理。

### 平均值变换

[Binary search on the answer](https://cp-algorithms.com/num_methods/binary_search.html#binary-search-on-the-answer)。实际读最大 floor 平均的变换说明；其 r-l≥x 意味长度至少 x+1，不能把长度写错。该示例无最长长度，P1419 的过期窗口需独立补全。

## 第一轮综合与后续边界

15 个族不是 15 个同构模板。rank 三族可共享 `第k小=min{x:C(x)≥k}`，再保持不同 count；双数组中位不强迫改成值域搜索。LIS/带权调度承载二分加速有序 DP 状态查询，不能说二分独立解决 DP 最优性。分数变换三族则说明约束如何决定合法子问题，而不是换故事重复一份模板。

练习均在研究阶段取得，每族 1–3 条；19 原题与 15 族数量本身不证明完备。lifting、并行二分、WQS 由其他独立视角研究后合议。Sabotage 精确凸包替代、LC673 计数边界的正文层次仍待范围复审；不能丢一个计数题链接却不给可达的思路。

为检查 Cow Dance 的单调直觉，研究期在内存穷举了 n=3..9、duration=1..4 的固定序列，以堆模拟检查各 K 完工时间，未发现逆转；这只是有限辅助探针，不替代一般证明，也不是正式 C++ 验证。无持续进程、无大量生成数据。

LC1102 [原站](https://leetcode.com/problems/path-with-maximum-minimum-value/description/)明确 Subscribe to unlock，未取题意；已有 LC1631 足够承载图阈值，不将其放入正式练习。没有新增付费或持续服务。
