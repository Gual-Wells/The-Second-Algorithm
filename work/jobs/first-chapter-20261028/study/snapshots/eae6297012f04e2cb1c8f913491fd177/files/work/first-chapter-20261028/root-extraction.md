# 二分逐机制补充提取：结构、边界、判定与C++合同

读取日2026-10-28。以下为原创分析，不复制题文或教材代码。每个链接本轮实际打开，失败重试明确记录。它们是研究材料，尚非作者稿。

## 显式有序边界与隐式位置

LC34（非降、可空、n≤1e5）要求首尾，LC35（严格升序、n≥1）要求插入位置。归为同一正式题型，不独立为每个API开节。先找首个>=x和首个>x，得到半开相等段；未找到不能解引用end。闭区间计数用upper_bound(R)-lower_bound(L)，不要将L改L-1或R改R+1引入极值溢出。前驱要先检查迭代器!=begin。

LC278给定有限n≤INT_MAX且必有坏版本，接口调用才是成本；泛化未知上界需要指数试探、可表示上限和无解政策，不能靠无界翻倍。LC1539严格升序正整数，缺失数 a[i]-(i+1)非降，找首个缺失数≥k的位置p，答案p+k；不能套到重复或无序数组。其减法先提升，返回值可超过数组最大值。

- https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/
- https://leetcode.com/problems/search-insert-position/
- https://leetcode.com/problems/first-bad-version/
- https://leetcode.com/problems/kth-missing-positive-number/

## 结构性排除不能强造全局单调

LC33原题互异；LC81原题允许重复。目标命中先返回；三点相等时不能判断哪侧有序，只能安全缩边，最坏线性（仅一个异值藏在大量相同值中）。LC154找最小值的版本将中点与右端比较，等号时右端可丢弃但不能承诺折半。标准binary_search对整个旋转序列不满足前提；真实设施方案只能先辨认两段或保留结构核心，不能直接调用库。

LC540每个值恰好两次，唯一值单次，长度为奇数。把探查点对齐到偶下标，a[m]==a[m+1]说明完整配对前缀延续，唯一点在右，否则在左；这不是对a[m]值本身二分。若其他频次条件改变，奇偶证书失效。

LC162只要求邻值不等，外围负无穷，任意局部峰即可。向上斜率一侧必有峰，不要求斜率序列单调；可维护左右向内的爬升证书。LC1901二维邻格不等、正值、外围-1，目标O(m log n)或对称。每次取中列最大行，若左/右邻更高则相应侧存在峰；列最大保证上下不更大，边界证书使递归侧仍有峰。仅在中行随便取一格不成立。二维标准设施可用max_element按列比较器取索引，库替换的是列最大扫描，不是峰搜索全部。

- https://leetcode.com/problems/search-in-rotated-sorted-array-ii/
- https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/
- https://leetcode.com/problems/single-element-in-a-sorted-array/ （首次超时，本轮重试取得完整题意约束）
- https://leetcode.com/problems/find-peak-element/
- https://leetcode.com/problems/find-a-peak-element-ii/

## 二维有序性是两种合同

LC74各行非降且前行末值<后行首值，可用idx/列数与idx%列数将全局有序序列虚拟化，不复制扁平数组。LC240仅行列分别有序，不能扁平binary_search；逐行lower_bound合法，O(m log n)，阶梯扫描可到O(m+n)，是不同算法对照而非同算法换库。宜把两种合同放同一节明确并列，秩选择节仍需从计数角度完整解释，不能以前见过矩阵为由省掉。

- https://leetcode.com/problems/search-a-2d-matrix/
- https://leetcode.com/problems/search-a-2d-matrix-ii/

## 整数根与实数根并非换个类型

LC69输入0..INT_MAX，但原创整数根可以明确扩到非负long long：对m>0检查m<=x/m，避免m*m溢出，采用上中点时还要保证hi-lo+1不溢出。long在Windows仍可32位，不是64位保证。math sqrt仅作交叉核对，不作为原题允许提交代码。

P1024给三互异实根都在[-100,100]、彼此相距>=1、输出两位。每个整数端点恰为根须去重；每段异号时夹逼某根，连续性保证存在，单调性非必需。不能从泛型异号夹逼函数声称自动找全根：本题的逐单位扫描和根间距假设才补足找全。比较符号不用f(l)*f(r)，可避免不必要的乘积溢出。浮点邻点中点停滞时结束，不用把epsilon写成一切问题通用真理。

- https://leetcode.com/problems/sqrtx/
- https://www.luogu.com.cn/problem/P1024

## 复杂判定的两种增量

P1083借教室，n,m≤1e6、非负需求与容量≤1e9。前t订单可行性随t单调；每次判定用差分累加用量再与容量比较，时间O(n+t)，总O((n+m)log m)。失败输出第一份订单的1基编号，全部成功返回0；删除或负需求会破坏前缀失败单调。差分最大累计可达1e15，必须64位。库partial_sum只负责扫描，不取代差分建模。

P4251矩阵n≤m≤250，选n个不同行列的数，最小化第k大。阈值x可行等价于在Aij<=x的二分图中能匹配至少n-k+1条边；剩余未配行列可从完整矩阵任意补成n匹配。一个局部最小选择不保证不同行列，应使用增广路而非贪心。候选只需已出现值离散化；可先给可理解的Kuhn实现和真实代价O(n²m log(nm))，不能宣称Hopcroft-Karp复杂度，也不冒称OJ实测通过。该例展示匹配判定，不要求把所有最大流算法收进二分章。

- https://www.luogu.com.cn/problem/P1083
- https://www.luogu.com.cn/problem/P4251

## C++17设施与数值的实际边界

固定N4659：lower_bound对comp(e,key)分区；upper_bound对!comp(key,e)分区，异构参数方向不同。partition_point返回true前缀结束，不会修复输入。sort要求严格弱序，不能把<=作比较器；二分算法本身对固定key的分区前提与sort的全域严格弱序应区分。非随机访问迭代器虽对数比较仍线性移动；关联容器应用成员lower_bound。

vector reserve改变容量不改变size，不能reserve后用下标写不存在的元素；增长重分配使迭代器/引用失效。LIS取得lower_bound迭代器后push_back，不应继续使用原迭代器。取差/乘积/累计前先提升表达式类型，accumulate初值决定累加器类型。计数判定只需达到目标时应饱和，而非先溢出再截断。

nth_element得到某个顺序统计量及两侧关系，默认重排输入，普通非执行策略重载平均线性；不是有序表的对数二分替身，也不能把n²隐式距离全生成后称同复杂度。C++20 midpoint不在C++17；对于本章0<=lo<=hi<=给定64位上限且差可表示的合同，lo+(hi-lo)/2合法，泛型带负哨兵时须另推上界。

- https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search
- https://timsong-cpp.github.io/cppwp/n4659/alg.partitions
- https://timsong-cpp.github.io/cppwp/n4659/alg.sorting
- https://timsong-cpp.github.io/cppwp/n4659/vector.capacity
- https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element

## 归并与待核

补充有序结构反查：本轮已读ABC296G原题与cp-algorithms凸多边形定位方法。严格凸、逆时针顶点、N/Q≤2e5、坐标绝对值≤1e9。从固定顶点的射线按极角排列；先用两条边界射线排除扇区外点/检查射线端点，再二分所在扇区，用第三边叉积判IN/ON/OUT。叉积前使用64位差，两个积的差绝对值粗上界8e18仍在int64内；不要使用面积绝对值和法把多个大项相加溢出。凸性与顶点方向是证书，凹多边形不适用。该例补了空间有序性，不能因没有数值有序数组而漏掉。

- https://atcoder.jp/contests/abc296/tasks/abc296_g
- https://cp-algorithms.com/geometry/point-in-convex-polygon.html

LC1268原题已读，按每个输入前缀返回字典序最小至多三条建议，products≤1000、总字符≤2e4。排序字符串后，前缀命中是连续区间，可先lower_bound(prefix)再检查最多三项，或二分整段前缀等价范围；字符串比较本身不是O(1)，复杂度须乘比较字符上界。此类展示比较器/索引的真实扩张，不能只把数字类型换string不说字符代价。后缀数组上的模式范围是同一查区间机制，但后缀建索引、哈希LCP等不冒充本章已经完整讲过。

- https://leetcode.com/problems/search-suggestions-system/

LC887原地址首次超时，/description/重试已取得完整题意。k≤100、楼层n≤1e4，鸡蛋破损会减少资源；不能因为楼层临界值单调就按普通二分探楼层。反过来令cover(d,k)为d次可区分的楼层数，cover(d,k)=cover(d-1,k-1)+1+cover(d-1,k)，展开为Σ(i=1..min(d,k)) C(d,i)，按d首次达到n搜索。若用逐项组合数判定，term尚<n时term*(d-i+1)≤n²≤1e8，按本题合同64位安全；不能把它无条件标成任意64位n都安全。每次饱和到n，仅需知道可覆盖否。它补上了查询会消耗资源的判定反演，不是DP里换个lower_bound。

- https://leetcode.com/problems/super-egg-drop/description/

CSES1688 Company Queries II原题已核：n/q≤2e5、parent[i]<i，问最近公共祖先。先等深，若不相等则按2^j从大到小同步跳到仍不相同的祖先，最后父节点为LCA；这里“尚未会合”才提供边界证书，纯按k位跳不是搜索。原题parent编号顺序允许线性求depth并建表，通用乱序父表则要遍历，不能把该优化无条件推广。书中My Ancestor的DFS有序当前路径是另一种维护方式，可在此对照并说明回溯恢复。

- https://cses.fi/problemset/task/1688/

补充两份实际原题：LC528为正整数权重，n≤1e4、w≤1e5；均匀抽整数票号1..sum，再lower_bound非降累计和，区间长度恰等权重。测试应验证每个票号落点和零/重复累计政策，而非用一次随机比例当确定性正确证明。LC981的set时间全局严格递增，按key保留有序记录、upper_bound(timestamp)取前驱；无需每次set重新排序，查询不能用map[key]制造空条目。前者适合作为累计量反查，后者是边界节的工程记录变型，不因换成字符串故事就再建同构节。

- https://leetcode.com/problems/random-pick-with-weight/
- https://leetcode.com/problems/time-based-key-value-store/

再核LC287原题：n+1个数均在1..n，只有一个数可重复两次或更多，不修改输入、额外空间常数。计数<=mid超过mid表示重复值已进入前缀；唯一重复的合同保证该判定的分界。也可用区间抽屉容量证书定位：当前值域内个数超过容量，则至少一半继续超载；缺失IP的版本反向保留计数不足容量的半区，即使输入重复仍能找某个缺失值（总条数<域容量）。这是真实的值域二分，不应因教材放在generalized search就删除；XOR/Floyd则是其他算法对照。

- https://leetcode.com/problems/find-the-duplicate-number/

与单调计数相关但不同的反例：若“恰好用k单位”的最优值为f(0)=0,f(1)=1,f(2)=10，最大化f(k)-λk的所选k可随λ单调，却会跳过k=1；λ=5时包络恢复值5并非f(1)=1。因此WQS需离散凸/凹及恢复证明，不能只把数量单调当作全部依据。本轮独立挑战将核对是否需要将该专门优化族纳入本章。

上述材料暂归边界/结构/复杂判定/数值，并与教材提取、来源提取会合。尚未认定所有类型最终独立成节；根和代理将反查依赖、重复与困难缺口。需要原题核心但无标准一键解时，采用shared-core/support真实层次，而不复制相同函数假装双实现。匹配与差分是本轮新补证，应在范围复审明确保留或归并理由。
