# 二分

<a id="prelude"></a>
## 前置节：二分的证据、边界与问题版图

二分是在候选域中反复取得**可以安全排除一部分候选的证据**。对半使探查次数成为对数；难点是搜索对象如何定义、证据为什么可靠，以及取得一次证据要付出什么代价。这里的候选可以是位置、数值、切分点、操作次数或惩罚参数，不必是一个已经存好的有序数组。

### 先分清保留答案的三种理由

| 证据 | 每次更新保留什么 | 必须另外核实什么 |
|---|---|---|
| 有序分区 | 假→真的首次边界，或真→假的末次边界 | 当前比较或检查器确实形成一次分区，且表达了原问题 |
| 结构存在性 | 剩余区域内至少存在一个所需答案 | 当前证据足以安全排除候选；能否排除半区须另证，保留的不一定是同一个目标 |
| 连续异号夹逼 | 两端之间至少存在某个零点 | 连续性和求值符号可靠；不保证找到全部根 |

例如，局部峰的相邻斜率可以反复变化，仍能通过“所选一侧存在峰”排除半区；不能把它硬写成全局单调谓词。旋转序列有重复时，一次相等可能只能安全去掉一个副本，最坏复杂度会退化为线性，不能仅因用了中点就宣称对数。连续函数两端异号保证有根，单调跳跃函数却可能越过零而没有零点。只有认清当前证据，才能决定相等时保留哪边、区间端点能否丢弃。

### 从问题条件构造搜索，而不是先选while模板

对一个最优化问题，要分别证明两件事：**给定候选值时，检查器是否正确；候选值改变时，可行性是否单调。** 后者不能补救前者。例如最小化最大连续段和时，容量B下的最少段数可以用非负条件支撑的贪心检查；B增大只放松限制，才能搜索首次可行容量。若允许负数，中途超限仍可能被后面抵消，原检查器和最大元素下界同时失效。

秩选择改变了搜索对象。给集合第k小，不必二分它的物理位置：可对候选值x统计不大于x的个数，找首次使计数至少k的值。计数是否包含重复、一次计数是线性、窗口还是结构查询，决定它究竟是哪种实现。若两个有序序列已能提供合法切分条件，则可直接二分切分位置，避免反复扫描整个值域。

每个正式题型都沿这条路径展开：确定目标和候选域；由条件推导证据与检查器；建立有解端点或无解政策；维护区间不变量；最后评估一次探查的真实成本。相同外层循环不代表相同算法，不同问题叙事也不必对应不同模板。

### 把证据写成区间合同

寻找首次满足时，一种稳妥表示是未分类半开区间`[lo,hi)`：`[0,lo)`均不满足、`[hi,n)`均满足。初始lo=0、hi=n，空的已分类部分使不变量自然成立；中点不满足便令lo=mid+1，满足便令hi=mid。结束时lo=hi，正好是边界，n还能表示全部不满足。它是位置，不保证可解引用。

相等值是否属于左侧，要由“首次≥、首次>、末次≤”等目标决定，而不是凭习惯。闭区间的最后真若使用lo=mid，必须让中点向上取整，保证相邻整数时仍缩小。未知上界则先用倍增建立可搜索的真端点，并明确最大可查询范围；到预算边界还未找到，不代表无穷远也没有答案。后面的结构下降与倍增同样维护接受/排除证据，只是把每次探查换成一个预先保存的整块。

### 把成本和数值范围算进方法本身

通常总成本是`预处理 + 单次判定成本 × 探查次数`。答案域宽W时探查为O(log W)，但检查器若是匹配、图搜索或滑动前缀，不能把总算法也简称O(log W)。数据结构能提供整块摘要时，可直接下降或跳跃，消掉外套二分反复查询的一层log；许多查询共享事件顺序时，可批量重放状态。

对库二分，对数首先是比较次数；字符串比较还要读字符，非随机访问迭代器的移动也可能线性。浮点数的固定迭代次数不是任意精度承诺；宽度、残差、舍入和中点停滞要按问题分别考虑。整数则按每个中间表达式证明预算，不能从最终答案fits推断乘积、差值和局部计数都安全。示例里的i64表示有符号64位整数，完整源码各自给出对应别名；它不免除范围分析。

### 本章将这些证据落实到哪些问题

下面是进入正式节前的问题版图。它用于辨认当前问题在搜索什么；各题型仍按统一章节顺序阅读，证明和代码归在对应题型内。

| 从题目条件识别的任务 | 要建立的搜索依据 | 对应正式节 |
|---|---|---|
| 已排序记录的成员、插入位、次数、前驱 | 首次≥和首次>组成边界；不等式改变返回政策 | [边界与前驱](#ordered-boundaries)、[昂贵访问与未知上界](#predicate-access) |
| 值与下标、旋转、配对或局部峰 | 由差分、相位、有序半侧或峰存在性排除候选 | [固定点与缺失](#transformed-index)、[旋转](#rotated-search)、[配对](#paired-break)、[一维峰](#local-peak)、[二维峰](#matrix-peak) |
| 矩阵和数值根 | 先核总序或局部序；整数可行性与连续异号使用不同证据 | [矩阵查找](#matrix-membership)、[整数根](#integer-root)、[连续根](#continuous-root) |
| 最小容量、时间、台数或最大间距 | 正确的贪心、累计量或事件模拟形成可行边界 | [连续分段](#capacity-partition)、[放置间距](#maximin-spacing)、[产能](#cumulative-production)、[台数](#ordered-simulation) |
| 阈值改变路径或互斥分配 | check必须保留整体可达性/匹配约束，不能用局部最小替代 | [瓶颈路径](#graph-threshold)、[阈值匹配](#matching-threshold) |
| 输入前缀只累加影响 | 单次搜索首次成功/失败；多查询可共享前缀状态 | [事件前缀](#prefix-activation)、[时间轴并行二分](#time-parallel-search) |
| 隐式巨大集合、重复或累计权重 | 明确重数、容量异常或累计秩，才可从值反求位置/答案 | [权重逆查](#weighted-inverse)、[容量异常](#pigeonhole-domain)、[矩阵秩](#matrix-rank)、[乘法表](#multiplication-rank)、[数对距离](#pair-distance-rank)、[双序列切分](#two-sorted-partition) |
| DP可用状态已经形成顺序 | 先证明状态充分，再由二分替代定位层 | [LIS前沿](#ordered-dp-frontier)、[兼容调度](#weighted-predecessor)、[会消耗资源的试探](#resource-queries) |
| 字典序、长度或几何扇区 | 比较对象与证书随领域改变，oracle可靠性仍须成立 | [字符串前缀](#string-prefix)、[凸多边形定位](#convex-location) |
| 平均或比值目标 | 代数变换后继续保留合法长度、数量和非空约束 | [平均值](#average-transform)、[固定数量比值](#ratio-selection) |
| 摘要和跳表能接受或排除整块 | 用当前累计量、区间摘要或可达范围直接选择下一块 | [动态频数](#fenwick-rank)、[摘要下降](#summary-descent)、[祖先会合](#ancestor-boundary)、[循环分段](#cyclic-jump) |
| 赋值与区间第k小交错 | 时间不单调；沿值域稳定分流，维护剩余秩 | [带修改整体二分](#dynamic-range-kth) |
| 数量约束可以换成惩罚 | 除参数单调，还要证明目标数量可支持、同值补足与精确恢复 | [递减边际参数搜索](#marginal-penalty) |

若找不到安全的候选排除理由，应重新选择方法。能够直接解析恢复、线性扫描或用另一结构解决时，也应诚实比较代价；本章的目标是会选择和实现搜索，而不是把所有问题强行改成二分。


<a id="ordered-boundaries"></a>
## 有序数据的边界、计数与前驱

给非降数组a与键key，定义L为首次`a[i]>=key`，R为首次`a[i]>key`。于是`[L,R)`恰好是全部相等项，数量为`R-L`；若L=R则键不存在。小于等于key的前驱在`R-1`，严格小于的前驱在`L-1`，前提是相应边界大于0。这个定义一次覆盖成员、插入位、首尾、计数和前驱，不必分别记五套循环。

<a id="ordered-boundaries-manual"></a>
### 相等后仍继续定位

```cpp
std::size_t lower_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    // [0,lo) < key；[hi,n) >= key，尚未分类的只有 [lo,hi)。
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid] < key) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
std::size_t upper_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid] <= key) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
std::pair<std::size_t, std::size_t>
equal_manual(const std::vector<int>& a, int key) {
    return {lower_manual(a, key), upper_manual(a, key)};
}
std::optional<int> predecessor_manual(const std::vector<int>& a, int key) {
    const auto end = upper_manual(a, key);
    if (end == 0) return std::nullopt;
    return a[end - 1];
}
```

`lower_manual`遇到相等不返回，而是保留它并排除右侧不可能成为首次的位置；`upper_manual`把相等归入已经确认的左侧。两个边界都允许落到n。若题目要求闭区间或`[-1,-1]`，只在最后转换：非空相等段对应`[L,R-1]`，内部仍维持同一半开合同。

### 变型：时间记录查最近的过去值

对每个键维护按时间严格递增的`TimedValue`序列，给查询时刻query，返回最后一个`time<=query`的值；早于第一条记录则无值。查找方向仍是首次`time>query`，再取前驱。例如时间为`[2,5,9]`，query=7的上界在9，答案来自5；query=1的上界在开头，没有前驱。目标不是绝对时间最近的一条。

```cpp
struct TimedValue { int time; std::string value; };
// 同一key的记录已按time严格递增；查最后一个time<=query。
std::optional<std::string> time_manual(const std::vector<TimedValue>& a, int query) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (a[mid].time <= query) lo = mid + 1;
        else hi = mid;
    }
    if (lo == 0) return std::nullopt;
    return a[lo - 1].value;
}
```

外层按键的散列表只负责取出该键的历史，内层函数只负责时间边界。若允许乱序写入，就要另维护排序，不能继续把简单追加当作有序维护。

<a id="ordered-boundaries-library"></a>
### 用库表达同一边界

```cpp
std::pair<std::size_t, std::size_t>
equal_standard(const std::vector<int>& a, int key) {
    const auto range = std::equal_range(a.begin(), a.end(), key);
    return {static_cast<std::size_t>(range.first - a.begin()),
            static_cast<std::size_t>(range.second - a.begin())};
}
```

`equal_range`返回两个迭代器，不返回两个元素值。它表达的仍是上述`[L,R)`。

```cpp
std::optional<std::string> time_standard(const std::vector<TimedValue>& a, int query) {
    // upper_bound比较方向是comp(value, element)，不同于lower_bound。
    auto it = std::upper_bound(a.begin(), a.end(), query,
        [](int time, const TimedValue& entry) { return time < entry.time; });
    if (it == a.begin()) return std::nullopt;
    return std::prev(it)->value;
}
```

记录前驱用`upper_bound`，其比较器接收顺序是`(查询值, 元素)`；不要把`lower_bound`常用的`(元素, 查询值)`直接照搬。先检查是否位于begin，再`prev`，空历史也自然返回无值。

<a id="ordered-boundaries-engineering"></a>
在`vector`上，边界定位本身时间O(log n)、额外空间O(1)；时间记录接口返回字符串副本，还要加O(|value|)的复制时间和结果空间。结果独立拥有字符，原历史离开作用域后仍可读取；若改为返回索引，索引本身不拥有记录，必须保证原容器仍存活，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与结果所有权</a>。库边界按比较器建立的分区与等价关系查找，不必等同`operator==`，见<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">二分库的分区与迭代器合同</a>。

<aside class="knowledge-introduction" id="knowledge-Q100001" data-knowledge-introduction="Q100001"><p class="knowledge-title">二分库的分区与迭代器合同</p><p><code>lower_bound(first,last,key,comp)</code> 找第一个不满足 <code>comp(element,key)</code> 的位置；<code>upper_bound</code> 找第一个满足 <code>comp(key,element)</code> 的位置，比较参数方向相反。升序整数中，它们分别是首次≥key、首次&gt;key；返回值可以是 <code>last</code>，不能未经检查就解引用。</p>
<p>这些算法要求当前范围对相应表达式已分区。全局排序是常用充分条件；旋转数组、仅行列有序的矩阵展平后并不自动满足。<code>partition_point</code> 寻找已有 true 前缀的结束，也不会替调用者重排或证明分区。</p>
<p><code>[first,last)</code> 是半开范围，允许空；前驱要先检查返回值不等于 <code>first</code>。使用迭代器差得到个数后，只有确认规模能放入目标整数，才缩窄为 <code>int</code>。</p>
<p>对数保证针对比较次数。<code>vector</code> 的随机访问使移动也为对数；普通前向迭代器的总递增可线性。<code>set</code>/<code>map</code> 查询优先用成员 <code>lower_bound</code>，不要用通用算法在树迭代器上线性走。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search">C++17 二分算法</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.partitions">分区算法</a>。</p>
</aside>


<aside class="knowledge-introduction" id="knowledge-Q100005" data-knowledge-introduction="Q100005"><p class="knowledge-title">借用参数与结果所有权</p><p><code>const vector&lt;T&gt;&amp;</code> 借用现有输入，不复制且不能经该引用修改元素；它不延长外部对象的寿命。按值参数拥有自己的容器，适合明确需要排序副本的接口；调用者传左值时可能复制，传可移动对象时可转移资源。<code>std::move</code> 只是允许按右值处理，是否实际移动取决于接收操作。</p>
<p>返回<code>string</code>、<code>vector</code>或装有值的<code>optional</code>会把结果交给调用者拥有，适合调用后仍需使用的数据；返回指针、引用、迭代器或索引则依赖原对象继续存活，并且后续修改不能使该位置失效。不能返回局部容器引用来“省复制”。按值返回可正常利用返回值优化或移动，不要机械添加<code>std::move</code>。</p>
<p>借用不等于永远有效：若容器发生结构修改，原位置是否还能使用取决于具体操作，见<a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">vector容量、元素与位置失效</a>。当前接口返回记录字符串副本，避免把对历史容器的引用带出；其复制成本仍应计入接口。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/expr.call">函数调用与参数</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/stmt.return">返回语句</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/class.copy.elision">复制省略</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/forward">值类别转换</a>。</p>
</aside>


练习：[首尾位置](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/)、[插入位置](https://leetcode.com/problems/search-insert-position/)、[时间键值存储](https://leetcode.com/problems/time-based-key-value-store/)。


<a id="predicate-access"></a>
## 昂贵访问与未知上界的首次满足

当数据由接口给出，搜索域可以只有下标，不必物化一个真假数组。已知版本数n时，首次坏版本就是`false…false,true…true`的边界；若原接口从1编号，把下标i映射到版本i+1。一次远端检查很贵，复杂度应写“至多多少次调用”，而不是仅数本地比较。

未知上界时先探测0，再试1、2、4……直到找到真端点；扩张成功后保留“lo假、hi真”的开区间。**未知不等于无限**：传入最大允许查询下标cap，达到cap仍为假便报告“预算域内没有真值”。这不证明cap之外也没有答案。

<a id="predicate-access-manual"></a>
### 先建立界，再收缩界

```cpp
template<class Predicate>
std::uint64_t first_true_manual(std::uint64_t n, Predicate yes) {
    // 搜索[0,n)，返回n表示全假；n本身不调用yes。
    std::uint64_t lo = 0, hi = n;
    while (lo < hi) {
        const auto mid = lo + (hi - lo) / 2;
        if (yes(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
template<class Predicate>
std::optional<std::uint64_t>
first_true_unknown(std::uint64_t cap, Predicate yes) {
    // cap是允许查询的最大下标，不保证其中一定有真值。
    if (yes(0)) return 0;
    if (cap == 0) return std::nullopt;
    std::uint64_t lo = 0, hi = 1;
    while (!yes(hi)) {
        if (hi == cap) return std::nullopt;
        lo = hi;
        hi = hi > cap - hi ? cap : hi + hi; // 饱和扩张，避免翻倍溢出。
    }
    // 此时lo假、hi真；不重复探测已知端点。
    while (hi - lo > 1) {
        const auto mid = lo + (hi - lo) / 2;
        if (yes(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}
```

已知域版本返回n作哨兵，且不会调用`yes(n)`。未知域版本可返回真正的`UINT64_MAX`，因此用`optional`区分有效最大下标与无解；扩张时先比较剩余空间，避免`2*hi`已经溢出才补救。找到位置p通常需O(log(p+1))次探测，找不到则O(log(cap+1))次，额外空间O(1)。端点已知就不反复付费查询；若接口昂贵到值得缓存，再按实际重访模式加缓存。

<a id="predicate-access-library"></a>
### 标准设施承担访问合同

```cpp
std::optional<std::uint64_t>
find_unknown_at(const std::vector<int>& hidden, int key, std::uint64_t cap) {
    // 演示题定访问器：长度不向算法公开，只有at越界才表示域结束。
    auto read = [&](std::uint64_t i) -> std::optional<int> {
        if (i > std::numeric_limits<std::size_t>::max()) return std::nullopt;
        try { return hidden.at(static_cast<std::size_t>(i)); }
        catch (const std::out_of_range&) { return std::nullopt; }
    };
    auto pos = first_true_unknown(cap, [&](std::uint64_t i) {
        const auto value = read(i);
        return !value || *value >= key; // 域结束在此合同中等价于+∞。
    });
    if (!pos) return std::nullopt;
    const auto value = read(*pos);
    if (!value || *value != key) return std::nullopt;
    return pos;
}
```

这里没有C++17标准函数能直接遍历无限整数域。示例要求hidden按值非降；在此前提下保留同一二分核心，`vector::at`与`optional`只实现题定访问器：有效下标返回值，**指定的越界**表示域结束，在“找首个>=key”时可视为正无穷；随后还须检查结果是否真的等于key。它是访问层的设施写法，不是第二套伪造的一键求解算法。

<a id="predicate-access-engineering"></a>
若真实接口用状态码、网络异常或空值表示不同失败，应分别映射，不能把内存不足、权限错误、I/O失败都吞成“没找到”。谓词要在搜索期间保持同一含义，捕获的key、版本快照和外部状态不能偷偷变化，见<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">判定器与lambda捕获</a>。交互题还必须按协议刷新输出、处理结束响应；换行本身不保证flush。

<aside class="knowledge-introduction" id="knowledge-Q100002" data-knowledge-introduction="Q100002"><p class="knowledge-title">整数表达式与溢出预算</p><p>先推导中间量，再选类型。两个 <code>int</code> 相乘会先在其运算类型里求值，赋给 <code>long long</code> 太晚；使用 <code>1LL*a*b</code> 或先显式提升。<code>accumulate</code> 的初值决定累加器类型，<code>partial_sum</code> 按输入元素类型累加，宽输出容器不能单独补救窄输入。</p>
<p>有符号运算越界不保证回绕，也不会自动抛异常。<code>long</code> 在 Windows 仍可能32位；明确至少64位的实现可用 <code>long long</code>，需要精确位宽时用存在的 <code>std::int64_t</code>。无符号类型按模回绕同样可能破坏二分顺序，不能当作修复。</p>
<p><code>lo+(hi-lo)/2</code> 只在差可表示时安全；含负哨兵或全64位跨度必须另推合同。C++20 的 <code>std::midpoint</code> 不能无标注用于C++17。上中点也要审查 <code>hi-lo+1</code>。</p>
<p>判定只需“达到k”时，可在达到目标后饱和，避免无意义的大计数；先溢出再 <code>min</code> 已经无效。乘积判定可在正数条件下改为除法，例如 <code>m&lt;=x/m</code>，另处理 m=0。移位前确认位数合法、结果可表示，不把 <code>1&lt;&lt;j</code> 当任意宽整数。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/expr">表达式求值</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/accumulate">累加</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/partial.sum">部分和</a>。</p>
</aside>


<aside class="knowledge-introduction" id="knowledge-Q100003" data-knowledge-introduction="Q100003"><p class="knowledge-title">判定器与lambda捕获</p><p>二分一次搜索中，对同一个候选值，判定应表达同一事实。可以使用临时工作区、缓存和提前结束，但不能让调用次数、残留的 visited、前次堆内容改变结果。网络/设备条件变化时，应固定本次搜索的快照，而非默认中途仍单调。</p>
<p><code>[&amp;]</code> 让回调借用当前对象，不复制大数组；被引用对象必须活到回调调用结束。立即传给同步搜索的局部回调通常满足；把它保存后返回则可能悬空。<code>[=]</code> 对实际捕获的对象作值捕获，捕获大容器可能产生真实复制，不等于免费只读。</p>
<p>算法可能复制函数对象，不要依赖某个闭包内部计数器恰好只保存一份。普通读取/越界错误也不应随意吞成“判定失败”；只有访问器明确规定的“超出长度”才能被当作搜索哨兵。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/expr.prim.lambda.capture">C++17 lambda 捕获</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/algorithms.requirements">算法要求</a>。</p>
</aside>


练习：[首次坏版本](https://leetcode.com/problems/first-bad-version/)。


<a id="transformed-index"></a>
## 值与下标关系中的固定点和缺失数

给严格递增整数数组，找任意`a[i]=i`的位置，无解返回空值。若只看a的顺序，目标不是一个固定键；变换后则有`a[i+1]>=a[i]+1`，故`a[i]-i`**非降**。可以找首次`a[i]>=i`，再核相等。差值不一定严格递增，例如`[0,1,2]`的差全为0。

<a id="transformed-index-manual"></a>
### 严格递增：变换后的边界

```cpp
std::optional<std::size_t> fixed_distinct(const std::vector<int>& a) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        // 数学差A[m]-m非降；直接比较避免先做可能溢出的int减法。
        if (static_cast<std::int64_t>(a[m]) < static_cast<std::int64_t>(m)) lo = m + 1;
        else hi = m;
    }
    if (lo < a.size() && static_cast<std::int64_t>(a[lo]) == static_cast<std::int64_t>(lo)) return lo;
    return std::nullopt;
}
```

直接比较提升后的值与下标，避免先在窄类型中相减。只返回一个固定点；若题意要求全部固定点，还要利用非降差值的零区间另取两个边界。

### 允许重复：从单边消除变成两块剪枝

重复会让`a[i]-i`下降，不能继续使用前一循环。但中点m、值v仍给出排序证书：左侧若`i>v`，有`a[i]<=v<i`；右侧若`i<v`，有`a[i]>=v>i`，两类位置都不可能固定。去掉中点后，只须递归`[lo,min(m-1,v)]`与`[max(m+1,v),hi]`。

```cpp
std::optional<std::size_t>
fixed_duplicate_range(const std::vector<int>& a, std::ptrdiff_t lo, std::ptrdiff_t hi) {
    if (lo > hi) return std::nullopt;
    const auto m = lo + (hi - lo) / 2;
    const auto value = static_cast<std::ptrdiff_t>(a[static_cast<std::size_t>(m)]);
    if (value == m) return static_cast<std::size_t>(m);
    // 重复破坏单调，但排序仍证明这两块之外不可能有固定点。
    if (auto left = fixed_duplicate_range(a, lo, std::min(m - 1, value))) return left;
    return fixed_duplicate_range(a, std::max(m + 1, value), hi);
}
std::optional<std::size_t> fixed_duplicates(const std::vector<int>& a) {
    return fixed_duplicate_range(a, 0, static_cast<std::ptrdiff_t>(a.size()) - 1);
}
```

例如`[0,0,0,2,2,4]`若先看m=2、v=0，左侧只剩下标0，右侧从3继续；真正固定点恰是0，不能一见`v<m`就删除整个左半。两边都可能保留，最坏O(n)、栈深O(log n)，不再保证对数时间。

### 另一个秩差：第k个缺失正整数

现改回严格递增的**正整数**数组。到`a[i]`为止共`a[i]`个正整数，已出现`i+1`个，故缺失数为`a[i]-i-1`。这个计数非降。令p为首次缺失数>=k的位置；第k个缺失值之前恰有p个数组元素，答案为`k+p`。例如`[2,3,4,7,11]`、k=5，p=4，答案9；p=n表示答案在尾部之后，空数组则直接返回k。

```cpp
std::int64_t kth_missing_manual(const std::vector<int>& a, std::int64_t k) {
    // a严格递增、正整数；k>0，且n+k可用int64表示。
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        const auto missing = static_cast<std::int64_t>(a[m]) - static_cast<std::int64_t>(m) - 1;
        if (missing < k) lo = m + 1;
        else hi = m;
    }
    return k + static_cast<std::int64_t>(lo);
}
```

严格输入的固定点、缺失查询均O(log n)、O(1)空间。这里缺失公式按不同已出现值计秩；若允许重复，先去重或另维护实际秩，不能只换边界循环。

<a id="transformed-index-library"></a>
### 已构造差分表时的库查询

```cpp
std::int64_t kth_missing_precomputed(const std::vector<int>& a, std::int64_t k) {
    // 明示O(n)预处理：多查询可把gap保留，而非每次重建。
    std::vector<std::int64_t> gap;
    gap.reserve(a.size());
    for (std::size_t i = 0; i < a.size(); ++i)
        gap.push_back(static_cast<std::int64_t>(a[i]) - static_cast<std::int64_t>(i) - 1);
    const auto p = std::lower_bound(gap.begin(), gap.end(), k) - gap.begin();
    return k + p;
}
```

标准设施版本把gap显式构造后用`lower_bound`。本函数单次总成本O(n)、空间O(n)；若同一a有大量查询，应把gap保留，之后每次O(log n)。这不优于直接计算差值的手写单查询，只演示已有索引表的真实边界用途。

<a id="transformed-index-engineering"></a>
固定点递归要求容器长度可由`ptrdiff_t`表示，缺失接口要求k>0、`n+k`可由`int64_t`表示。转换后再作差，不能在int中先溢出再转宽，见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。重复版接口承诺返回任意固定点，不能因优先递归左侧就误称它总返回最左：它会先检查中点。

练习：[第k个缺失正整数](https://leetcode.com/problems/kth-missing-positive-number/)。


<a id="rotated-search"></a>
## 旋转序列中的成员与最小值

旋转把一个非降序列切成首尾两段，整体不再有序。找最小值时，比中点与右端：中点更大说明切点在右；中点更小说明右侧不可能包含更小切点；相等却不能区分两侧，只能安全去掉一个右端副本。找成员时，则识别哪半边有序，用值域判断目标是否可能在那里。

<a id="rotated-search-manual"></a>
### 不能辨方向时承认信息不足

```cpp
std::optional<int> rotated_min_manual(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] > a[hi]) lo = m + 1;
        else if (a[m] < a[hi]) hi = m;
        else --hi; // 只能证明丢掉这个副本不会丢掉所有最小值。
    }
    return a[lo];
}
bool rotated_member_manual(const std::vector<int>& a, int key) {
    std::size_t lo = 0, hi = a.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] == key) return true;
        if (a[lo] == a[m] && a[m] == a[hi - 1]) { ++lo; --hi; continue; }
        if (a[lo] <= a[m]) { // 左半有序。
            if (a[lo] <= key && key < a[m]) hi = m;
            else lo = m + 1;
        } else { // 右半有序。
            if (a[m] < key && key <= a[hi - 1]) lo = m + 1;
            else hi = m;
        }
    }
    return false;
}
```

互异时每次都有方向，时间O(log n)；允许重复后，`[1,1,…,1,0,1,…,1]`中唯一0可以隐藏在尚未检查的任意位置，最坏必须O(n)。这是真实信息边界，不是模板写得不够巧。成员函数的相等缩边只发生在中点已确认不是key之后，所以不会删掉最后一个匹配；空输入返回无最小值/不存在。

<a id="rotated-search-library"></a>
### 先恢复可用的有序区间

```cpp
bool rotated_member_standard(const std::vector<int>& a, int key) {
    // 先线性找唯一下降点；两段各自有序，才能分别使用binary_search。
    const auto cut = std::is_sorted_until(a.begin(), a.end());
    return std::binary_search(a.begin(), cut, key) ||
           std::binary_search(cut, a.end(), key);
}
std::optional<int> rotated_min_standard(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    return *std::min_element(a.begin(), a.end());
}
```

`is_sorted_until`找下降位置，再对两条确实有序的区间调用`binary_search`。这版最坏O(n)，空间O(1)；它清楚表达库的前置条件，却没有保留互异版本的对数优势。`min_element`也是线性对照。直接对整个旋转数组调用`binary_search`不具备通用合同，不能当“工程版二分”。

<a id="rotated-search-engineering"></a>
本型输出最小**值**，不承诺返回哪一个重复最小值的位置；成员接口只返回bool。若题目要求首个原始下标，必须另定义旋转后的索引顺序。比较关系和数据顺序须一致，见<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">二分库的分区与迭代器合同</a>。

练习：[旋转数组成员，含重复](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/)、[旋转数组最小值，含重复](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/)。


<a id="paired-break"></a>
## 有序配对结构中的唯一异常

有序数组恰有一个值出现一次，其余值都出现两次。异常之前的配对起点是偶下标，之后变成奇下标。检查偶下标m：若`a[m]=a[m+1]`，整个这一对都在异常前，可丢弃到m+1；否则异常不在m之后。搜索的不是“哪些值较大”，而是配对相位的断点。

<a id="paired-break-manual"></a>
### 对齐中点，或直接找配偶下标

```cpp
int paired_unique_manual(const std::vector<int>& a) {
    // 非空奇数长有序数组：恰一项一次，其余每项恰两次。
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        auto m = lo + (hi - lo) / 2;
        m -= m % 2; // 一律从偶下标检查一整对。
        if (a[m] == a[m + 1]) lo = m + 2;
        else hi = m;
    }
    return a[lo];
}
int paired_unique_xor_index(const std::vector<int>& a) {
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] == a[m ^ std::size_t{1}]) lo = m + 1;
        else hi = m;
    }
    return a[lo];
}
```

第一版始终让lo、hi落在可能的异常下标上，中点向偶数对齐。第二版的`m^1`对偶数取后一项、对奇数取前一项，判断当前下标的配偶关系是否仍保持异常前的相位。二者O(log n)、O(1)空间，依据相同；不是按值搜索两个不同问题。

<a id="paired-break-library"></a>
### 同题的线性聚合对照

```cpp
int paired_unique_standard(const std::vector<int>& a) {
    // 不同算法：成对值的XOR抵消。线性基线，不满足原题O(logn)要求。
    return std::accumulate(a.begin(), a.end(), 0, std::bit_xor<int>{});
}
```

`accumulate`与`bit_xor`让成对值抵消，返回孤立值。这是**另一种O(n)算法**，不利用排序，也不满足原题的O(log n)目标。标准库没有“一次调用找配对相位断点”的整题函数；保留手写二分才是本题的高效实现，不能为了印两份循环而伪造库版。

<a id="paired-break-engineering"></a>
两种二分都要求非空奇数长、唯一单次值、其余恰两次；代码不先花O(n)校验这个合同。若改成三次/多种频次、多个异常或无序，奇偶证书就不成立；XOR也只在适当的奇偶频数合同下有意义。位运算用于配偶下标，不表示数组值必须非负。

练习：[有序数组中的单一元素](https://leetcode.com/problems/single-element-in-a-sorted-array/)。


<a id="local-peak"></a>
## 任意一维局部峰与单峰边界

邻项不相等，边界外视作负无穷，找任意严格局部峰。序列可以有很多峰，斜率也可以正负交替。若`a[mid]<a[mid+1]`，从mid+1向右沿上升方向走，迟早遇到下降或边界，因而右边一定有峰；反向同理。维护的是左右边界均“向区间内部爬升”的证书，不是把斜率强说成全局单调。

<a id="local-peak-manual"></a>
### 保留某个峰，不跟踪某个固定峰

```cpp
std::optional<std::size_t> peak_manual(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.size() - 1;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m] < a[m + 1]) lo = m + 1;
        else hi = m; // 有向内的上升/下降边界证书，不是全局斜率单调。
    }
    return lo;
}
```

向右更新后，新lo严格高于左邻；向左更新后，新hi严格高于右邻。初始外部负无穷建立证书，终止时同一个位置同时满足两侧。时间O(log n)、空间O(1)。若额外保证严格先升后降，唯一局部峰就是全局最大，函数也适用；这条更强条件不属于一般峰题的必要前提。

<a id="local-peak-library"></a>
### 线性取全局最大，也能给一个局部答案

```cpp
std::optional<std::size_t> peak_standard(const std::vector<int>& a) {
    if (a.empty()) return std::nullopt;
    // 邻值不等时任一全局最大值必是严格局部峰；此基线O(n)。
    return static_cast<std::size_t>(std::max_element(a.begin(), a.end()) - a.begin());
}
```

邻值不等时，全局最大必严格高于相邻项，因此`max_element`是正确O(n)基线，却不满足原题对数要求。若允许相等，必须重新说明找的是严格峰、弱峰还是全局最大：比如`[1,1,1,2,1]`，在相等处任意丢一边可能丢掉全局最大。找任意弱局部峰与找弱单峰的全局峰也不能混称。

<a id="local-peak-engineering"></a>
没有严格峰的输入不能靠随便返回一个下标“补齐”合同。空数组在这里扩展为`nullopt`；原题非空时可直接解包返回值。标准设施返回迭代器，转换成下标后仍只描述本次输入中的位置，不拥有元素，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与结果所有权</a>。

练习：[任意局部峰](https://leetcode.com/problems/find-peak-element/)。


<a id="matrix-membership"></a>
## 二维有序数据中的存在性查找

两种“二维有序”是不同合同。若每行非降，且每行第一项大于前行最后一项，按行展开就是全局有序序列，虚拟下标i对应`a[i/cols][i%cols]`。若只保证每行每列非降，展开可能是`[1,4,7,2,5,8,…]`，不能整段二分。

<a id="matrix-membership-manual"></a>
### 强合同用虚拟展平，弱合同用行列消除

```cpp
bool matrix_flat_manual(const std::vector<std::vector<int>>& a, int key) {
    if (a.empty() || a.front().empty()) return false;
    const auto rows = a.size(), cols = a.front().size();
    if (rows > std::numeric_limits<std::size_t>::max() / cols)
        throw std::length_error("matrix index domain overflow");
    // 强合同：矩形且按行展平后全局非降；不真正复制mn个元素。
    std::size_t lo = 0, hi = rows * cols;
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (a[m / cols][m % cols] < key) lo = m + 1;
        else hi = m;
    }
    return lo < rows * cols && a[lo / cols][lo % cols] == key;
}
bool matrix_staircase(const std::vector<std::vector<int>>& a, int key) {
    if (a.empty() || a.front().empty()) return false;
    // 弱合同：矩形，各行各列非降。col用“列数”避免无符号-1。
    std::size_t row = 0, col = a.front().size();
    while (row < a.size() && col > 0) {
        const auto x = a[row][col - 1];
        if (x == key) return true;
        if (x < key) ++row;
        else --col;
    }
    return false;
}
```

展平版只改变访问方式，沿用首次>=边界；时间O(log(mn))、额外空间O(1)，没有复制mn个元素。阶梯版从右上角开始：值太小则整行都太小，值太大则整列都太大，每步少一行或一列，O(m+n)。这是同题不同算法，证书来自两个方向的顺序，不能把它称二分模板的某一行变化。

<a id="matrix-membership-library"></a>
### 各行独立查找的设施写法

```cpp
bool matrix_row_standard(const std::vector<std::vector<int>>& a, int key) {
    // 只要求各行有序；甚至不要求各行等长或列有序。
    return std::any_of(a.begin(), a.end(), [&](const std::vector<int>& row) {
        const auto it = std::lower_bound(row.begin(), row.end(), key);
        return it != row.end() && *it == key;
    });
}
```

每行调用`lower_bound`后核对是否等于key，`any_of`表达存在一行命中。矩形时O(m log n)、空间O(1)；它只需要各行有序，甚至容许不等长，适用范围比展平和阶梯更宽，但未同时利用列序。行列相差悬殊时可比较逐行/逐列与阶梯的实际成本，而不是一概断言某个公式更优。

<a id="matrix-membership-engineering"></a>
展平前先核`rows*cols`不会在`size_t`里溢出，非空才能除以cols。形状与排序是调用者合同，不能为了验证排序先扫描全矩阵，却仍宣称整次调用是O(log(mn))。迭代器返回尾部与随机访问的要求见<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">二分库的分区与迭代器合同</a>。

练习：[全局行序矩阵](https://leetcode.com/problems/search-a-2d-matrix/)、[仅行列有序矩阵](https://leetcode.com/problems/search-a-2d-matrix-ii/)。


<a id="integer-root"></a>
## 不溢出的整数根与最后可行值

求`floor(sqrt(x))`就是找最大的非负m使`m²<=x`。候选整数域有序，目标是最后可行值而非某个恰好相等的平方。对64位最大输入直接计算`m*m`会溢出；m>0时改用`m<=x/m`，证书不变。

<a id="integer-root-manual"></a>
### 上中点与安全判定一起设计

```cpp
std::uint64_t isqrt_manual(std::uint64_t x) {
    std::uint64_t lo = 0, hi = x;
    while (lo < hi) {
        const auto width = hi - lo;
        const auto m = lo + width / 2 + width % 2; // 上中点保证lo前进。
        if (m <= x / m) lo = m; // m>0；乘法m*m可能溢出，改为除法。
        else hi = m - 1;
    }
    return lo;
}
```

lo始终可行，答案在`[lo,hi]`；当m可行保留m，否则排除m及其右侧。向上取整中点保证区间相邻时也会推进。x=0不进入循环，因此除数不会为0；其余循环中的m至少1。最多64轮，O(log(x+1))时间、O(1)空间，覆盖整个`uint64_t`范围。

<a id="integer-root-library"></a>
### 浮点设施给估计，整数合同给最终答案

```cpp
std::uint64_t isqrt_estimate_standard(std::uint64_t x) {
    // sqrt给近似，整数不等式最终确证；不能把浮点转整数当完整答案。
    auto r = static_cast<std::uint64_t>(std::sqrt(static_cast<long double>(x)));
    while (r > 0 && r > x / r) --r;
    while (r < std::numeric_limits<std::uint64_t>::max() && r + 1 <= x / (r + 1)) ++r;
    return r;
}
```

`sqrt`近似在`2^64-1`附近可能舍入成`2^32`，直接转整便大1。这里向下/向上修正到满足两个整数不等式，才得到确切整数根。修正成本与初始估计偏差有关；不能把库浮点精度概括为“任何平台恒定零修正”，也不能省去确证后宣称它与手写整数算法有同一证明。

<a id="integer-root-engineering"></a>
`long`在Windows常为32位，不表示“平方自然够宽”；乘法的操作数必须在计算前处于足够宽的类型。最后可行值的上中点也不能写`(lo+hi+1)/2`来制造新的溢出，见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。

练习：[整数平方根](https://leetcode.com/problems/sqrtx/)。


<a id="capacity-partition"></a>
## 连续容量分段：以最少段数判定最大段和

将非负数组按原顺序分为恰好 `k` 个非空连续段，使最大段和最小。不能通过排序改变相邻关系；难点也不是枚举哪个位置切开，而是检验：**若每段最多容纳 B，最少需要几段？**

从左到右尽量装入当前段，装不下才切。任何满足容量的第一段都不可能越过贪心切点；贪心用同样一段覆盖了至少同样长的前缀。依此比较后续切点，它不会比任何可行划分用更多段。因此 `最少段数≤k` 是正确判定。非负数组可以再拆段而不增大段和，只要 `k≤n`，就能把“不超过 k 段”补成“恰好 k 个非空段”。

当 B 增大，可行划分只会增加，寻找首次可行值。下界是最大元素，上界是总和。非负条件不是形式限制：`[-5,10,-5]` 的单段和是 0，这时最大元素 10 已不再是合法下界，扫描到中途超限也不代表该段最终超限。

<a id="capacity-partition-manual"></a>
### 手写：容量检查与边界收缩

下面的整数核心分别寻找首次真和末次真，只用于`0≤lo≤hi`、差值可表示且区间内存在真值的闭区间；有解端点或哨兵如何建立，会在相应题型交代。

```cpp
using i64 = long long;

// 闭区间中至少有一个真值；判定为 false...false,true...true。
template<class Predicate>
i64 first_true(i64 lo, i64 hi, Predicate feasible) {
    while (lo < hi) {
        const i64 mid = lo + (hi - lo) / 2;
        if (feasible(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

// 闭区间中至少有一个真值；判定为 true...true,false...false。
template<class Predicate>
i64 last_true(i64 lo, i64 hi, Predicate feasible) {
    while (lo < hi) {
        const i64 gap = hi - lo;
        const i64 mid = lo + gap / 2 + gap % 2; // 上中点，避免 lo 卡住。
        if (feasible(mid)) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
```

```cpp
// a 非空、各项非负、1 <= k <= a.size()；总和须可用 i64 表示。
i64 capacity_manual(const std::vector<i64>& a, int k) {
    i64 lower = 0, upper = 0;
    for (i64 x : a) {
        if (x > lower) lower = x;
        upper += x;
    }
    auto feasible = [&](i64 limit) {
        int blocks = 1;
        i64 used = 0;
        for (i64 x : a) {
            // lower 已保证 x <= limit；比较差值避免 used+x 溢出。
            if (used > limit - x) {
                if (++blocks > k) return false;
                used = x;
            } else used += x;
        }
        return true;
    };
    return first_true(lower, upper, feasible);
}
```

`used` 是当前未封口段的和，`blocks` 是已经开出的段数；超过 k 就可立即拒绝。搜索每次只扫描一次，时间 `O(n log(sum−max+1))`、额外空间 `O(1)`。原题有零时，上下界可能同为 0，此时不需要执行循环。

<a id="capacity-partition-standard"></a>
### 标准设施：只接管统计，不虚构划分算法

```cpp
// 库只接管边界统计；它没有接管“为何贪心段数可作判定”。
std::pair<i64, i64> capacity_bounds_standard(const std::vector<i64>& a) {
    return {*std::max_element(a.begin(), a.end()),
            std::accumulate(a.begin(), a.end(), 0LL)};
}
```

这段返回同样的上下界，可代替手写函数开头的统计循环；判定与二分仍是上面的核心。标准库没有“最小化最大连续段和”的整题算法，不必复制整份求解函数来制造两套近乎相同的代码。`max_element` 与 `accumulate` 都是线性扫描。

<a id="capacity-partition-engineering"></a>
### 约束与迁用

CSES 的 `n≤2×10^5`、单项≤`10^9`，总和可达 `2×10^14`，因此从累加开始就要做<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>；`0LL` 决定累加器类型。判定借用原数组，多轮调用不会复制它，也不会改变切分顺序，参见<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">判定器与捕获的生命周期</a>。若还要输出恰好 k 个切点，需要恢复方案并为剩余段保留元素，不能直接输出贪心的最少段数方案。

练习：[Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/description/) 允许 0；[Array Division](https://cses.fi/problemset/task/1085/) 的正数与更大规模要求同一证明、不同数值预算。


<a id="maximin-spacing"></a>
## 最大化最小间距：以最早放置保留空间

给定若干一维位置，从中选择 m 个，使所选位置的最小两两距离最大。原题位置互异，`2≤m≤n≤10^5`，坐标在 `1..10^9`。排序以后，最小两两距离必出现在相邻所选点之间。试距离 d 时，问题变为：能否依次放下至少 m 个点，且相邻距离都不小于 d？

选择最左点，再选离上一个点至少 d 的最早位置。把任意可行方案与贪心比较，贪心的第 j 个位置不晚于对方第 j 个位置，所以留给后面的空间不会更少。这是“尽早放置”的领先性证明，和上一节“尽量延长一段”不是同一个选择规则。

d 增大，要求更严格，故找最后可行值。总跨度至少容纳 `(m−1)d`，上界可收紧为 `span/(m−1)`。

<a id="maximin-spacing-manual"></a>
### 手写：给定有序位置后的检查

```cpp
// sorted_position 已升序，至少两个互异位置；2 <= balls <= n。
i64 spacing_sorted_manual(const std::vector<i64>& sorted_position, int balls) {
    const i64 span = sorted_position.back() - sorted_position.front();
    auto feasible = [&](i64 distance) {
        int placed = 1;
        i64 last = sorted_position.front();
        for (std::size_t i = 1; i < sorted_position.size(); ++i) {
            if (sorted_position[i] - last >= distance) {
                last = sorted_position[i];
                if (++placed >= balls) return true;
            }
        }
        return false;
    };
    return last_true(0, span / (balls - 1), feasible);
}
```

单次检查 `O(n)`，搜索 `O(n log span)`，额外空间 `O(1)`。这里的手写核心明确接收已经排序的序列，不能直接传入任意原始位置。

<a id="maximin-spacing-standard"></a>
### 标准设施：完成预处理后复用核心

```cpp
// 值传递接管一份位置副本；调用方原序不变，手写核心获得有序前提。
i64 spacing_standard(std::vector<i64> position, int balls) {
    std::sort(position.begin(), position.end());
    return spacing_sorted_manual(position, balls);
}
```

`sort` 建立有序前提；按值接收位置，允许函数重排自己的副本，调用方原序不变。总体 `O(n log n+n log span)`，这里为副本付出 `O(n)` 存储。也可以反复用 `lower_bound(last+d)` 找下个位置，但每次判定会引入二分查找成本，未必优于一次前向扫描。

<a id="maximin-spacing-engineering"></a>
### 约束与迁用

这里的<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">排序合同</a>只建立坐标顺序，正确性来自放置规则。<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与复制</a>决定是否保留输入原序。位置改为连续区间、点有容量或选择存在冲突时，不能直接沿用这个检查器；外层单调不代表原贪心仍正确。

练习：[Magnetic Force Between Two Balls](https://leetcode.com/problems/magnetic-force-between-two-balls/description/)。重点核对 `m=2`、`m=n` 和距离恰好等于 d。


<a id="cumulative-production"></a>
## 累计产能：反求达标最早时刻

各台机器独立、同时生产，第 i 台每件耗时 `t[i]`。原题机器数≤`2×10^5`，目标与单件耗时均在 `1..10^9`。时间 T 内最多生产 `floor(T/t[i])` 件。因此不需要逐件模拟，只需判断总产能是否达到目标。

该计数随 T 非降；只让最快机器工作，`min(t)×target` 已是有效上界，寻找首次达标时间。

<a id="cumulative-production-manual"></a>
### 手写：只累计还差的产量

```cpp
// times 非空且为正；target >= 1；min(times)*target 可用 i64 表示。
i64 production_manual(const std::vector<i64>& times, i64 target) {
    i64 fastest = times.front();
    for (i64 t : times) if (t < fastest) fastest = t;
    auto feasible = [&](i64 time) {
        i64 remaining = target;
        for (i64 t : times) {
            const i64 made = time / t;
            // 判定只需知道是否达标；保留剩余目标，不必累计完整产能。
            if (made >= remaining) return true;
            remaining -= made;
        }
        return false;
    };
    return first_true(0, fastest * target, feasible);
}
```

本实现使用紧上界 `min(t)×target`，每台在搜索域内至多生产 target 件，所以原题完整产能和也不超过 `n×target≤2×10^14`，可以放进 64 位。`remaining` 进一步只保留尚缺目标，足够达标就返回；若以后采用更宽的固定时间界或更大合同，这也避免了不必要的大总和。时间 `O(n log(min(t)×target+1))`，额外空间 `O(1)`。

<a id="cumulative-production-standard"></a>
### 标准设施：有效上界的构造

```cpp
i64 production_upper_standard(const std::vector<i64>& times, i64 target) {
    // 返回已证明有效的搜索界；乘法在 i64 中进行。
    return *std::min_element(times.begin(), times.end()) * target;
}
```

这只是 `min_element` 所负责的统计层，线性时间、常数额外空间；生产判定仍保留手写。把巨大时间域做成 vector 再调用库二分，会无端物化本来不需要存储的答案空间。

<a id="cumulative-production-engineering"></a>
### 约束与迁用

这里必须用整数除法，浮点估计可能在整件完成时刻附近误判。搜索上界与计数的<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数预算</a>应分别推导：换成固定 `10^18` 上界后，含快速机器的中间总产能就可能超界，不能沿用紧界下的预算结论。若机器共享资源或任务前后依赖，产量不能直接相加；下一节就是需要事件模拟的情形。

练习：[Factory Machines](https://cses.fi/problemset/task/1620/)。试比较“逐件最小堆模拟”和“按时间直接计数”在目标达到 `10^9` 时的差距。


<a id="ordered-simulation"></a>
## 并行台数：以事件模拟判定固定顺序队列

Cow Dance 给定固定登台顺序。K 个台位同时使用，最早结束者让下一位立即入场；要求所有演出在期限内结束，求最少 K。原题 `N≤10^4`、每段时长≤`10^5`、期限≤`10^6`。这里的下一位开始时刻取决于之前谁先结束，不能用总时长/K 代替真实过程。

给定 K，维护每个台位的结束时间；取最小值、加上下一位时长、放回。这样精确模拟题设，没有额外调度选择。更多台位不会让固定队列中的任务更晚开始，故期限内完成是关于 K 的首次真判定；原题保证 K=N 可行。

这个单调性可以直接比较两套状态。将 K 个可用时间排序为 v，K+1 个排序为 u，维护 `u[i]≤v[i]（i<K）`，初始全0成立。处理同一时长d时，`u[0]+d≤v[0]+d`；各自删去最早项、插入新结束时间后，u中的 K 项 `u[1]…u[K−1],u[0]+d` 可逐项匹配到 v 的新状态且不更大，额外的那一项只会让 u 的前 K 小更早。归纳可得每项开始和完成均不更晚，而不必假定两套排程始终使用同一台位。

<a id="ordered-simulation-manual"></a>
### 手写：最小堆维护最早释放事件

```cpp
class MinHeap {
    std::vector<i64> data;
public:
    explicit MinHeap(int slots) : data(slots, 0) {}
    i64 take_min() {
        const i64 result = data[0];
        data[0] = data.back();
        data.pop_back();
        std::size_t p = 0;
        while (2 * p + 1 < data.size()) {
            std::size_t child = 2 * p + 1;
            if (child + 1 < data.size() && data[child + 1] < data[child]) ++child;
            if (data[p] <= data[child]) break;
            std::swap(data[p], data[child]);
            p = child;
        }
        return result;
    }
    void push(i64 value) {
        data.push_back(value);
        std::size_t p = data.size() - 1;
        while (p > 0) {
            const std::size_t parent = (p - 1) / 2;
            if (data[parent] <= data[p]) break;
            std::swap(data[parent], data[p]);
            p = parent;
        }
    }
};

int stage_slots_manual(const std::vector<i64>& duration, i64 deadline) {
    auto feasible = [&](i64 slots) {
        MinHeap heap(static_cast<int>(slots));
        for (i64 d : duration) {
            const i64 finish = heap.take_min() + d;
            if (finish > deadline) return false;
            heap.push(finish);
        }
        return true;
    };
    // 原题保证 duration.size() 个台位可在 deadline 内完成。
    return static_cast<int>(first_true(1, duration.size(), feasible));
}
```

堆初始的 K 个 0 表示全部台位可立即使用。每位取出一个最早时间，再放回新的结束时间；因此堆中始终恰有 K 个台位。任何一次得到的结束时刻超过期限，就能直接拒绝，无需完成余下模拟。每次判定 `O(N log(K+1))`，整体最坏 `O(N log²N)`，堆空间 `O(K)`。

<a id="ordered-simulation-standard"></a>
### 标准设施：priority_queue 取代手写堆

```cpp
int stage_slots_standard(const std::vector<i64>& duration, i64 deadline) {
    auto feasible = [&](i64 slots) {
        std::priority_queue<i64, std::vector<i64>, std::greater<i64>> finish;
        for (i64 i = 0; i < slots; ++i) finish.push(0);
        for (i64 d : duration) {
            const i64 next = finish.top() + d; // 取值，不保留跨 pop 的引用。
            finish.pop();
            if (next > deadline) return false;
            finish.push(next);
        }
        return true;
    };
    return static_cast<int>(first_true(1, duration.size(), feasible));
}
```

外层判定和事件意义不变。`greater` 让堆顶成为最早结束时刻，正是这里需要的方向。`top()` 只观察，`pop()` 删除，`push()` 恢复台位；不能漏掉其中一步。参见<a class="knowledge-link" href="#knowledge-Q100007" data-knowledge="Q100007">优先队列与堆接口</a>。

<a id="ordered-simulation-engineering"></a>
### 约束与迁用

这里保存结束时间的值，不能保留 `top()` 引用后再 `pop()`。每次判定重新构造堆，防止上一次失败的排程污染下一次。若要输出每个任务所用台位，堆元素还要携带台位编号；只有结束时间不足以恢复这一身份。

<aside class="knowledge-introduction" id="knowledge-Q100007" data-knowledge-introduction="Q100007"><p class="knowledge-title">优先队列与堆接口</p><p><code>priority_queue&lt;T&gt;</code> 默认用 <code>less&lt;T&gt;</code>，top是最大者；最小堆常写 <code>priority_queue&lt;T,vector&lt;T&gt;,greater&lt;T&gt;&gt;</code>。比较器仍需严格弱序，优先级方向应从“谁留在堆顶”验证，而非凭函数名称猜。</p>
<p><code>top()</code> 只读观察，<code>pop()</code> 删除且不返回被删值。要先把需要的值复制出来，再pop；不能保留top引用后继续使用被删除或因重排改变的元素。空堆不能top/pop，接口不会承诺为这个前提错误抛出可捕获异常。</p>
<p>push/pop的堆调整通常为O(log n)，top为O(1)；已有范围构堆与逐个push不同，前者调用make_heap可线性建堆。容器分配成本仍存在，不能把对数调整次数当作每次操作严格没有其他成本。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/priority.queue">C++17 priority_queue</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.heap.operations">堆算法</a>。</p>
</aside>


练习：[Cow Dance Show](https://usaco.org/index.php?page=viewproblem2&cpid=690)。原题文件输入输出需在提交包装层适配，这份核心不负责打开文件。


<a id="graph-threshold"></a>
## 路径瓶颈：阈值下的可达性

网格路径的代价是路径上**最大相邻高度差**，目标最小化它。原题行列均≤100，高度在 `1..10^6`。给定阈值 B，删去所有高度差大于 B 的边，问题就变为左上能否到达右下。B 增大只增加边，可达性不会消失，因此寻找首次可达阈值。

这不是最小化路径高度差之和：一个绕远但每一步都平缓的路径可能更优。阈值检查只关心存在路径，BFS 不需要记录普通最短路距离。

<a id="graph-threshold-manual"></a>
### 手写：数组队列执行可达性搜索

```cpp
int path_effort_manual(const std::vector<std::vector<int>>& height) {
    const int rows = static_cast<int>(height.size());
    const int cols = static_cast<int>(height[0].size());
    const int count = rows * cols;
    const int dr[4] = {-1, 1, 0, 0}, dc[4] = {0, 0, -1, 1};
    auto feasible = [&](i64 limit) {
        std::vector<unsigned char> seen(count, 0);
        std::vector<int> queue(count);
        int head = 0, tail = 0;
        queue[tail++] = 0;
        seen[0] = 1; // 入队即标记，队列最多容纳 count 个格子。
        while (head < tail) {
            const int id = queue[head++];
            if (id == count - 1) return true;
            const int r = id / cols, c = id % cols;
            for (int direction = 0; direction < 4; ++direction) {
                const int nr = r + dr[direction], nc = c + dc[direction];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const int next = nr * cols + nc;
                const i64 gap = std::llabs(i64(height[r][c]) - height[nr][nc]);
                if (!seen[next] && gap <= limit) {
                    seen[next] = 1;
                    queue[tail++] = next;
                }
            }
        }
        return false;
    };
    // 原题高度在 [1, 10^6]；整个网格在此界下必连通。
    return static_cast<int>(first_true(0, 999999, feasible));
}
```

入队就标记，每个格子最多入队一次，长度 `rows×cols` 的数组足够；若等到出队才标记，可能重复入队并破坏容量预算。按原题高度范围搜索 `[0,999999]`，单格网格自然得到 0。时间 `O(RC log W)`、空间 `O(RC)`。

<a id="graph-threshold-standard"></a>
### 标准设施：queue 保存搜索前沿

```cpp
int path_effort_standard(const std::vector<std::vector<int>>& height) {
    const int rows = static_cast<int>(height.size());
    const int cols = static_cast<int>(height[0].size());
    const int dr[4] = {-1, 1, 0, 0}, dc[4] = {0, 0, -1, 1};
    auto feasible = [&](i64 limit) {
        std::vector<unsigned char> seen(rows * cols, 0);
        std::queue<std::pair<int, int>> frontier;
        frontier.emplace(0, 0);
        seen[0] = 1;
        while (!frontier.empty()) {
            const auto [r, c] = frontier.front();
            frontier.pop();
            if (r == rows - 1 && c == cols - 1) return true;
            for (int direction = 0; direction < 4; ++direction) {
                const int nr = r + dr[direction], nc = c + dc[direction];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const int id = nr * cols + nc;
                const i64 gap = std::llabs(i64(height[r][c]) - height[nr][nc]);
                if (!seen[id] && gap <= limit) {
                    seen[id] = 1;
                    frontier.emplace(nr, nc);
                }
            }
        }
        return false;
    };
    return static_cast<int>(first_true(0, 999999, feasible));
}
```

`queue` 接管先进先出状态，不接管图的邻接关系或判定正确性。代码仍明确列出四个方向、阈值和访问标记。队头先复制到局部值，再删除，符合<a class="knowledge-link" href="#knowledge-Q100011" data-knowledge="Q100011">队列状态与元素寿命</a>。

<a id="graph-threshold-engineering"></a>
### 约束与替代算法

相减前提升类型再取绝对值，参见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">表达式的整数预算</a>。每次 check 的 seen 是独立状态。也能按边权排序用 DSU 连通，或用 minimax Dijkstra；它们是不同算法，不能包装成这份二分算法的“标准库版本”。若路径目标改为边权之和，本节阈值删边检查也不再解决该问题。

<aside class="knowledge-introduction" id="knowledge-Q100011" data-knowledge-introduction="Q100011"><p class="knowledge-title">队列和双端队列的状态</p><p><code>std::queue</code>提供先进先出，常用front/push/pop；<code>std::deque</code>允许两端插入删除，适合维护单调候选队列。它们只提供容器操作，不会自动维护“已经访问”“候选未过期”或“值单调”等算法不变量。</p>
<p>访问front/back前检查非空；删除元素后不能继续使用它的引用。deque两端插入使迭代器失效，但保留既有元素引用的有效性；中间插入的规则不同。按下标保存候选位置，可以把过期检查与实际输入前缀绑定，不需要持有deque迭代器跨修改。</p>
<p>数组队列若容量覆盖所有最多入队次数，头尾下标即可O(1)推进；vector.erase(begin())会移动后续元素，不能把它当O(1)出队。单调队列“每元素至多进出一次”的线性总成本来自算法证明，不是deque这个类型名的保证。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/queue">queue</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/deque.modifiers">deque修改</a>。</p>
</aside>


练习：[Path With Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/description/)。验证绕远更优、等高网格和单行/列，不要只测明显直线路径。


<a id="prefix-activation"></a>
## 事件前缀的首次成功与首次失败

两个问题都搜索“前 t 个事件”，但判定方向相反。

NailingPlanks 必须按顺序使用前 t 颗钉子，要求每块闭区间木板至少命中一颗。木板数 N、钉子数 M 均≤30000，坐标在 `1..2M`。随着 t 增大，成功从假变真。给定 t，按坐标计数并构造前缀和，木板 `[L,R]` 命中当且仅当 `prefix[R]−prefix[L−1]>0`，因此无需复杂区间树。

借教室则按顺序接受前 t 份订单。天数、订单数≤`10^6`，每日容量与订单需求在 `0..10^9`。每份订单对一段日期增加非负需求；一旦某天超容量，后续订单不能修复它，所以**失败**从假变真。检查前 t 单，用差分数组同时叠加所有区间，再前缀恢复每日使用量。它搜索的不是任意选择的最大订单集合。

<a id="prefix-activation-manual"></a>
### 手写：前缀命中与差分首失败

```cpp
int first_nails_manual(const std::vector<int>& left, const std::vector<int>& right,
                       const std::vector<int>& nails) {
    const int m = static_cast<int>(nails.size());
    auto feasible = [&](i64 prefix) {
        if (prefix == m + 1) return true; // 仅用于表示所有真实前缀均失败。
        std::vector<int> count(2 * m + 1, 0);
        for (int i = 0; i < prefix; ++i) ++count[nails[i]];
        for (int x = 1; x <= 2 * m; ++x) count[x] += count[x - 1];
        for (std::size_t i = 0; i < left.size(); ++i)
            if (count[right[i]] == count[left[i] - 1]) return false;
        return true;
    };
    const int result = static_cast<int>(first_true(1, m + 1, feasible));
    return result == m + 1 ? -1 : result;
}

struct Order {
    i64 demand;
    int left, right; // 0-based 半开天区间；原题 [s,t] 转成 [s-1,t)。
};

std::vector<i64> order_difference(int days, const std::vector<Order>& orders, int prefix) {
    std::vector<i64> difference(days + 1, 0);
    for (int i = 0; i < prefix; ++i) {
        difference[orders[i].left] += orders[i].demand;
        difference[orders[i].right] -= orders[i].demand;
    }
    return difference;
}

int first_failed_order_manual(const std::vector<i64>& capacity,
                              const std::vector<Order>& orders) {
    const int m = static_cast<int>(orders.size());
    auto failed = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        const auto difference = order_difference(capacity.size(), orders, prefix);
        i64 used = 0;
        for (std::size_t day = 0; day < capacity.size(); ++day) {
            used += difference[day];
            if (used > capacity[day]) return true;
        }
        return false;
    };
    const int result = static_cast<int>(first_true(1, m + 1, failed));
    return result == m + 1 ? 0 : result; // 返回申请人 1 基编号；0 表示全部成功。
}
```

两个求解都给 `M+1` 留一个只存在于搜索域中的“真”哨兵，从而满足 `first_true` 必有真值的合同。Nailing 到哨兵表示无解，返回 -1；订单到哨兵表示全部成功，返回 0。真实订单编号仍从 1 开始，不能把 API 返回值直接当 0 基数组下标。

`Order` 使用 `[left,right)`，原题闭区间 `[s,t]` 要转换为 `[s−1,t)`。`difference[right]` 可以写在长度 n+1 的尾格，它用于恢复区间结束，不对应真实的一天。Nailing 的检查 `O(N+M)`、总 `O((N+M)log M)`；教室每轮 `O(n+t)`、总 `O((n+m)log m)`。空间分别为 `O(M)`、`O(n)`。

<a id="prefix-activation-standard"></a>
### 标准设施：partial_sum 接管恢复扫描

```cpp
int first_nails_standard(const std::vector<int>& left, const std::vector<int>& right,
                         const std::vector<int>& nails) {
    const int m = static_cast<int>(nails.size());
    auto feasible = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        std::vector<int> count(2 * m + 1, 0);
        for (int i = 0; i < prefix; ++i) ++count[nails[i]];
        std::partial_sum(count.begin(), count.end(), count.begin());
        for (std::size_t i = 0; i < left.size(); ++i)
            if (count[right[i]] == count[left[i] - 1]) return false;
        return true;
    };
    const int result = static_cast<int>(first_true(1, m + 1, feasible));
    return result == m + 1 ? -1 : result;
}

int first_failed_order_standard(const std::vector<i64>& capacity,
                                const std::vector<Order>& orders) {
    const int m = static_cast<int>(orders.size());
    auto failed = [&](i64 prefix) {
        if (prefix == m + 1) return true;
        auto used = order_difference(capacity.size(), orders, prefix);
        std::partial_sum(used.begin(), used.end(), used.begin());
        // used 尾端多一项用于差分归零，不属于任何真实一天。
        return !std::equal(capacity.begin(), capacity.end(), used.begin(),
                           [](i64 available, i64 required) { return required <= available; });
    };
    const int result = static_cast<int>(first_true(1, m + 1, failed));
    return result == m + 1 ? 0 : result;
}
```

`partial_sum` 可原地计算前缀，但累计类型仍由容器元素决定；教室用 long long，最大需求量约 `10^15`。`equal` 的四参数重载在这里用自定义关系逐日检查 `required≤available`，不是判断两组数相等；第一个范围是 n 个真实日期，差分尾格不会参与。若这种用法不如普通循环直观，保留手写扫描同样合理，库调用不是正确性的额外来源。

<a id="prefix-activation-engineering"></a>
### 约束与方向

非负订单保证前缀失败单调；若允许撤销订单、负需求或任意跳过订单，该性质可能消失。Nailing 允许一钉命中多板，并不是给每块板分配独占资源。检查器每轮清空计数或差分数组，按当前 t 重建状态，参见<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">重复调用判定器的状态</a>。普通扫描与标准前缀都遵守<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">累计量的类型预算</a>。

练习：[NailingPlanks](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/nailing_planks/)；[借教室](https://www.luogu.com.cn/problem/P1083)。后者提交时：全部成功输出 0，否则输出 -1 与返回的订单编号。


<a id="weighted-inverse"></a>
## 累计权重的逆查询与采样

令 `prefix[i]=w[0]+…+w[i]`，把第 i 项分配为整数票号 `(prefix[i−1],prefix[i]]`。均匀抽取 1..总权重中的一个票号，首次累计值不小于票号的位置就是结果；分配给 i 的票数恰为 w[i]，因此概率是 w[i]/总和。这里二分反演累计量，随机性只负责产生票号。

<a id="weighted-inverse-manual"></a>
### 构建累计量并查位置

```cpp
std::vector<i64> cumulative_manual(const std::vector<int>& weights) {
    std::vector<i64> prefix;
    i64 total = 0;
    for (int w : weights) { total += w; prefix.push_back(total); }
    return prefix;
}
// 票号从1开始；查第一个累计值>=ticket，不使用浮点概率区间。
int ticket_manual(const std::vector<i64>& prefix, i64 ticket) {
    int lo = 0, hi = static_cast<int>(prefix.size());
    while (lo < hi) {
        const int mid = lo + (hi-lo)/2;
        if (prefix[mid] >= ticket) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
```

前处理 O(n)，一次定位 O(log n)，前缀占 O(n)。原题权重为正；若允许零权重，累计量仅非降，但 1 基票号配 `lower_bound` 仍不会抽到空区间。负权重则失去累计单调性。

<a id="weighted-inverse-standard"></a>
### 前缀算法、边界算法与整数分布

```cpp
std::vector<i64> cumulative_standard(const std::vector<int>& weights) {
    // partial_sum按输入value_type累加，先把输入本身转换为64位。
    std::vector<i64> prefix(weights.begin(), weights.end());
    std::partial_sum(prefix.begin(), prefix.end(), prefix.begin());
    return prefix;
}
int ticket_standard(const std::vector<i64>& prefix, i64 ticket) {
    return static_cast<int>(std::lower_bound(prefix.begin(), prefix.end(), ticket)
                            - prefix.begin());
}
int sample_index(const std::vector<i64>& prefix, std::mt19937_64& engine) {
    std::uniform_int_distribution<i64> ticket(1, prefix.back());
    return ticket_standard(prefix, ticket(engine));
}
```

`partial_sum` 的累加类型由**输入元素类型**决定，输出容器是 64 位并不能修复 32 位输入累加溢出。因此先将整个输入转换为 64 位，再做扫描。生成器通过引用复用状态，不能每次抽样都重新播种。<a class="knowledge-link" href="#knowledge-Q100010" data-knowledge="Q100010">整数随机分布与可复现性</a>解释为何用 `uniform_int_distribution`，而非 `rand()%total`。

<a id="weighted-inverse-engineering"></a>
票号必须在 `[1,prefix.back()]` 内；空表、总权重为零不属于接口合同。构建累计量时就预算总和，不能抽样时才发现溢出。测试确定性映射时可穷举每个票号，验证每项获得的票数；一次随机频率接近比例不是正确性证明。动态增删频数时静态前缀会失效，后面的树状数组型直接在结构中反查。

<aside class="knowledge-introduction" id="knowledge-Q100010" data-knowledge-introduction="Q100010"><p class="knowledge-title">整数随机分布与可复现性</p><p><code>uniform_int_distribution&lt;long long&gt;(a,b)</code> 的合同是闭区间[a,b]内各整数等概率，要求a≤b。生成器通过引用传入，调用会推进其状态。它适合把均匀整数票号映射到累计权重，避免直接取模产生的余数偏差。</p>
<p>固定seed便于本机重复实验；<code>mt19937_64</code>不是密码学随机源，<code>random_device</code>也不能按名字就保证所有实现都有真实硬件熵。反复用当前秒数重置引擎可能重复得到相同输出，通常应在对象/任务开始时初始化一次再复用。</p>
<p>不同标准库对分布到引擎输出的映射不必相同，不能把同seed的采样序列当跨库文件格式。确定性正确性优先测试“每个合法票号落到哪个区间”，随机抽样频率只是额外观察。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/rand.dist.uni.int">C++17 uniform_int_distribution</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/rand">随机数生成</a>。</p>
</aside>


练习：[LC528 · 按权重随机选择](https://leetcode.com/problems/random-pick-with-weight/)。


<a id="pigeonhole-domain"></a>
## 值域容量异常：重复与缺失

输入有 n+1 个数，取值为 1..n，只有一个值重复。不能改数组且只能用常数额外空间时，**二分值域，不排序元素**。若重复值大于 x，前缀最多出现 x 个数；若重复值不大于 x，它的额外副本多于全域缺失值总数，前缀计数必大于 x。因此 `count(value≤x)>x` 恰在重复值处转真。这个证明使用“唯一重复”；不要把它当任意多重集都成立的单调性。

<a id="pigeonhole-domain-manual"></a>
### 计数驱动的值域收缩

```cpp
template<class Count>
int duplicate_core(int n, Count count_le) {
    int lo = 1, hi = n;
    while (lo < hi) {
        const int mid = lo + (hi-lo)/2;
        // 唯一重复值进入前缀后，数量必超过前缀容量。
        if (count_le(mid) > mid) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
int duplicate_manual(const std::vector<int>& a) {
    return duplicate_core(static_cast<int>(a.size())-1, [&](int x) {
        int count = 0;
        for (int value : a) if (value <= x) ++count;
        return count;
    });
}
```

每轮扫描 n+1 项，值域减半，时间 O(n log n)、额外空间 O(1)。输入顺序不参与排除，负担在判定器。`duplicate_core` 只负责边界，扫描计数是可替换的那一层。

回调在一次搜索中应表达同一计数事实，详见 <a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">判定器与lambda捕获</a>；复用工作区不等于可以残留上一轮状态。

<a id="pigeonhole-domain-standard"></a>
### 用标准算法表达计数

```cpp
int duplicate_standard(const std::vector<int>& a) {
    return duplicate_core(static_cast<int>(a.size())-1, [&](int x) {
        return std::count_if(a.begin(), a.end(), [x](int v) { return v <= x; });
    });
}
```

`std::count_if` 保留原数组，仍然线性扫描；它没有把整体算法变成 O(log n)，也没有替我们证明谓词单调。另一个线性常数空间方案是把值当作后继的 Floyd 环检测，那是不同算法。

缺失值是反向的容量证书：总记录数小于域容量时，当前欠满区间至少有一个缺失值；若左半记录数不足左半容量就保留左半，否则右半必欠满。下面允许重复记录，返回任意缺失值，而非第 k 个缺失值：

```cpp
// values均在[0,universe)，条数<universe；允许重复，返回任意缺失值。
std::uint64_t missing_domain(const std::vector<std::uint32_t>& values,
                             std::uint64_t universe) {
    std::uint64_t lo = 0, hi = universe; // 当前区间计数严格小于容量
    while (hi-lo > 1) {
        const auto mid = lo + (hi-lo)/2;
        std::uint64_t left_count = 0;
        for (auto v : values) if (lo <= v && v < mid) ++left_count;
        if (left_count < mid-lo) hi = mid;
        else lo = mid; // 左半满，欠满性必留在右半
    }
    return lo;
}
```

<a id="pigeonhole-domain-engineering"></a>
IPv4 全域容量是 2³²，不能存入 32 位整数；这里用 `uint64_t` 表示边界，记录仍可用 `uint32_t`。若数据只能顺序读，实际要重读约 log₂U 遍；流不可重放就不满足此实现的访问合同。数值规则见 <a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。

练习：[LC287 · 寻找重复数](https://leetcode.com/problems/find-the-duplicate-number/)。重点区分值域容量与下标有序性；其线性 follow-up 需要另换环检测机制。


<a id="matrix-rank"></a>
## 行列有序矩阵秩：楼梯计数

第 k 小（按重数）等于最小的 x，使 `C(x)=#(元素≤x)≥k`。矩阵行列分别有序，却不一定能逐行展平成全局有序序列。计数时从左下角出发：当前值≤x，则该列上方直到当前行都≤x，整段计入并右移；否则这一行当前列及其右侧都>x，上移。

<a id="matrix-rank-manual"></a>
### 值域边界与楼梯判定

```cpp
// count返回<=x的重数；lo/hi有界且差可表示，k保证存在。
template<class Count>
i64 kth_value(i64 lo, i64 hi, i64 k, Count count) {
    while (lo < hi) {
        const i64 mid = lo + (hi-lo)/2;
        if (count(mid) >= k) hi = mid;
        else lo = mid+1;
    }
    return lo;
}
i64 matrix_count_manual(const std::vector<std::vector<int>>& a, i64 x) {
    int row = static_cast<int>(a.size())-1, col = 0;
    i64 count = 0;
    while (row >= 0 && col < static_cast<int>(a[0].size())) {
        if (a[row][col] <= x) { count += row+1; ++col; }
        else --row;
    }
    return count;
}
i64 matrix_kth_manual(const std::vector<std::vector<int>>& a, i64 k) {
    return kth_value(a.front().front(), a.back().back(), k,
                     [&](i64 x) { return matrix_count_manual(a,x); });
}
```

一轮最多上移 R 次、右移 C 次，时间 O(R+C)；二分总计 O((R+C) log V)，额外 O(1)，V 为整数值域宽度。重复值的计数可能直接跨过 k，仍找首次 `≥k`，不能要求计数恰等于 k。后面两节复用 `kth_value`，各自重新证明计数器。

<a id="matrix-rank-standard"></a>
### 每行用上界计数

```cpp
i64 matrix_kth_standard(const std::vector<std::vector<int>>& a, i64 k) {
    return kth_value(a.front().front(), a.back().back(), k, [&](i64 x) {
        i64 count = 0;
        for (const auto& row : a)
            count += std::upper_bound(row.begin(),row.end(),x)-row.begin();
        return count;
    }); // 每行查边界，检查器比楼梯扫描多一个log因子。
}
```

每行 `upper_bound(x)-begin()` 是≤x的个数，允许每行内部重复。这版单轮 O(R log C)，未必优于楼梯扫描；若只有每行有序而列无序，逐行版仍合法，但楼梯版及以右下角为最大值的取界方式都要改变。

这里使用的是 <a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">二分库的分区与迭代器合同</a>，不是库在替矩阵建立全局次序。

<a id="matrix-rank-engineering"></a>
合同是非空矩形、行列非降、1≤k≤R×C。乘积和计数先按 <a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>处理；不对每轮判定复制矩阵。原题要求第 k 个元素，不能 `unique` 去掉重复值。

练习：[LC378 · 有序矩阵中第 k 小的元素](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/description/)。


<a id="multiplication-rank"></a>
## 乘法表秩：解析计数巨大隐式集合

m×n 乘法表第 i 行是 i,2i,…,ni，所以≤x的元素数是 `min(n,⌊x/i⌋)`。行与行之间会重复同一数，依然按重数求和。不生成 m×n 个元素；把较短边作为行数，减少判定次数。

<a id="multiplication-rank-manual"></a>
### 解析计数

```cpp
i64 multiplication_count_manual(int rows, int cols, i64 x) {
    i64 count = 0;
    for (i64 i = 1; i <= rows; ++i) {
        const i64 available = x/i;
        count += available < cols ? available : cols;
    }
    return count;
}
i64 multiplication_kth_manual(int rows, int cols, i64 k) {
    if (rows > cols) std::swap(rows,cols);
    return kth_value(1, 1LL*rows*cols, k,
                     [&](i64 x) { return multiplication_count_manual(rows,cols,x); });
}
```

总时间 O(min(m,n) log(mn))、额外 O(1)。与矩阵计数相比，矩阵并未存下来，一行的贡献由公式直接得到；与数对相比，也不需要先排序输入。

<a id="multiplication-rank-standard"></a>
### 标准设施只表达支撑操作

```cpp
// 替换解析计数循环中一行的贡献，值域搜索与求和主体保持共用。
i64 multiplication_row_standard(int cols, i64 x, i64 row) {
    return std::min<i64>(cols, x / row);
}
```

上面的求解函数用`std::swap`选短边。这个小函数可替换计数循环内的一行贡献：`count += multiplication_row_standard(cols,x,i)`，用`std::min`表达列数截断。单行贡献O(1)，完整求解仍复用同一计数循环与`kth_value`。标准库没有隐式乘法表的第k小接口，无须物化答案域去套迭代器算法。

<a id="multiplication-rank-engineering"></a>
原题 m,n≤30000，mn≤9×10⁸；代码仍在乘前用 `1LL` 提升。若推广到巨大 m,n，乘积、计数上限和每轮线性扫描成本都要重新审查。别仅把输入类型换成 `long long` 就宣称支持任意大表。

练习：[LC668 · 乘法表中第 k 小的数](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/description/)。


<a id="pair-distance-rank"></a>
## 数对距离秩：窗口计数反求第 k 小

把所有索引数对 i<j 的距离视为隐式多重集。排序后，对固定右端 r，满足 `a[r]−a[l]≤D` 的左端是一个后缀；r 增大时最小合法左端不会左移。累计每个 r 的合法左端数便得到距离≤D的数对数，随后仍找首次计数≥k。

<a id="pair-distance-rank-manual"></a>
### 双指针判定

```cpp
i64 pair_distance_manual(std::vector<int> a, i64 k) {
    std::sort(a.begin(), a.end());
    return kth_value(0, static_cast<i64>(a.back())-a.front(), k, [&](i64 d) {
        i64 count = 0;
        int left = 0;
        for (int right = 0; right < static_cast<int>(a.size()); ++right) {
            while (static_cast<i64>(a[right])-a[left] > d) ++left;
            count += right-left; // 每个索引数对恰计一次，重复值不去重。
        }
        return count;
    });
}
```

排序 O(n log n)，每轮计数 O(n)，总 O(n log n+n log V)。原数组本身不必有序，重复值形成多个零距离索引对，不能去重。这里的窗口只服务计数器；它不是对原问题直接求出第 k 小。

<a id="pair-distance-rank-standard"></a>
### 每个左端查一个上界

```cpp
i64 pair_distance_standard(std::vector<int> a, i64 k) {
    std::sort(a.begin(),a.end());
    return kth_value(0, static_cast<i64>(a.back())-a.front(), k, [&](i64 d) {
        i64 count = 0;
        for (int i = 0; i < static_cast<int>(a.size()); ++i)
            count += std::upper_bound(a.begin()+i+1,a.end(),static_cast<i64>(a[i])+d)
                     - (a.begin()+i+1);
        return count;
    });
}
```

`upper_bound(a[i]+D)` 找第一个距离超界的右端，排除自身后求差。这版检查 O(n log n)，与双指针有额外 log；二者共享值域搜索但判定组织不同。把所有 O(n²) 距离生成后 <a class="knowledge-link" href="#knowledge-Q100008" data-knowledge="Q100008">nth_element</a> 可作小规模真值，不能当同资源实现。

<a id="pair-distance-rank-engineering"></a>
函数按值接收并排序副本，明确用 O(n) 额外空间保留调用者输入；允许原地修改时可改引用。数对数上界 n(n−1)/2，先提升再乘。较大整数坐标下 `a[i]+D` 与差值也要提升，而非算完才赋给宽类型。

练习：[LC719 · 找出第 k 小的数对距离](https://leetcode.com/problems/find-k-th-smallest-pair-distance/description/)。


<a id="two-sorted-partition"></a>
## 两有序数组中位：在合法分割位置二分

从 A 取 i 个、从 B 取 k−i 个到左半，左半总数固定为 k。只要 A左末≤B右首且B左末≤A右首，两数组内部本就有序，左半所有元素便不大于右半，左半最大值就是第 k 小。搜索的是 i，合法区间必须限制为 `[max(0,k−n),min(k,m)]`。求中位数时，总长奇数取第`(m+n)/2+1`项；偶数取中间两项的平均，因此可复用同一个合法秩查询。

<a id="two-sorted-partition-manual"></a>
### 交叉边界驱动切分

```cpp
// k为1基；至少一数组非空，输入元素int，64位哨兵不与真实值混淆。
i64 two_array_kth(const std::vector<int>& a, const std::vector<int>& b, int k) {
    if (a.size() > b.size()) return two_array_kth(b,a,k);
    const int m = static_cast<int>(a.size()), n = static_cast<int>(b.size());
    int lo = std::max(0,k-n), hi = std::min(k,m);
    while (lo <= hi) {
        const int i = lo + (hi-lo)/2, j = k-i;
        const i64 al = i ? a[i-1] : std::numeric_limits<i64>::lowest();
        const i64 ar = i < m ? a[i] : std::numeric_limits<i64>::max();
        const i64 bl = j ? b[j-1] : std::numeric_limits<i64>::lowest();
        const i64 br = j < n ? b[j] : std::numeric_limits<i64>::max();
        if (al > br) hi = i-1;       // A左侧取多了
        else if (bl > ar) lo = i+1;  // A左侧取少了
        else return std::max(al,bl);
    }
    assert(false); // 有序且1<=k<=m+n时不会到达
    return 0;
}
double two_array_median(const std::vector<int>& a,const std::vector<int>& b) {
    const int n = static_cast<int>(a.size()+b.size());
    if (n%2) return static_cast<double>(two_array_kth(a,b,n/2+1));
    return (two_array_kth(a,b,n/2)+two_array_kth(a,b,n/2+1))/2.0;
}
```

`A左末>B右首` 表示 A 取多了，减少 i；另一交叉冲突则增加 i。两者同时发生与各数组有序性矛盾。时间 O(log(min(m,n)+1))、额外 O(1)，其中常数级空数组情形照常处理。偶数长度中位数先取两个 64 位值再相加，不能在 32 位内相加后除 2。

<a id="two-sorted-partition-standard"></a>
### 线性合并是另一条真实路径

```cpp
i64 two_array_merge(const std::vector<int>& a,const std::vector<int>& b,int k) {
    std::vector<int> merged(a.size()+b.size());
    std::merge(a.begin(),a.end(),b.begin(),b.end(),merged.begin());
    return merged[k-1]; // 线性时间/空间对照，不能满足LC4的对数要求。
}
```

`std::merge` 不会替我们自动得到对数复杂度；本实现时间、额外空间均为 O(m+n)，适合需要完整合并结果或作为验证基线，**不满足 LC4 的对数要求**。若只做一次顺序读取，也可手动合并到第 k 项就停；那仍不是切分二分。

<a id="two-sorted-partition-engineering"></a>
合同：两数组非降，总长度非零，k 为合法1基秩。代码元素为 `int`，因此64位最小/最大哨兵严格超出真实值域；若元素也可能为任意64位极值，应改成显式边界条件，不能无声复用这一哨兵证明。

练习：[LC4 · 寻找两个正序数组的中位数](https://leetcode.com/problems/median-of-two-sorted-arrays/description/)。


<a id="ordered-dp-frontier"></a>
## DP 有序前沿：最小尾值与二分替换

令 `tail[len−1]` 是当前前缀内长度 len 的递增子序列的最小末值。同长时更小末值支配更大末值，因为它能接受后者能接受的所有后继。这个摘要有序，当前值 x 只能替换首次 `tail≥x` 的位置；若所有 tail<x，就扩出新长度。原数组无需有序。

有序性也可从定义推出：任一长度l+1的最优尾链，去掉末项后得到一条长度l的链，所以 `tail[l−1]` 不大于其前驱，严格小于 `tail[l]`。找到首个≥x的位置p后，前一长度已有末值<x，可以接上x；更早位置用x只会变差，更后位置又没有更长的合法前驱。因此只更新p，不批量改写后面的摘要。

<a id="ordered-dp-frontier-manual"></a>
### 保存真实前驱，恢复可行序列

```cpp
template<class Locate>
std::vector<int> lis_core(const std::vector<int>& a, Locate locate) {
    std::vector<int> tails, tail_index, parent(a.size(),-1);
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        const int p = locate(tails,a[i]);
        if (p) parent[i] = tail_index[p-1]; // 修改tail前保存真实前驱
        if (p == static_cast<int>(tails.size())) {
            tails.push_back(a[i]); tail_index.push_back(i);
        } else { tails[p] = a[i]; tail_index[p] = i; }
    }
    std::vector<int> indices;
    for (int i = tail_index.empty() ? -1 : tail_index.back(); i != -1; i=parent[i])
        indices.push_back(i);
    std::reverse(indices.begin(),indices.end());
    return indices;
}
std::vector<int> lis_manual(const std::vector<int>& a,bool nondecreasing=false) {
    return lis_core(a,[=](const std::vector<int>& tail,int x) {
        int lo=0,hi=static_cast<int>(tail.size());
        while (lo<hi) {
            const int mid=lo+(hi-lo)/2;
            if (nondecreasing ? tail[mid]>x : tail[mid]>=x) hi=mid;
            else lo=mid+1;
        }
        return lo;
    });
}
```

时间 O(n log n)、空间 O(n)。例如输入 `[3,5,6,2]`，最后 tail 可能是 `[2,5,6]`，它并不是原输入中的递增子序列；恢复必须顺着保存的 parent。更新 tail 之前取前一长度的真实末位置，才能保证前驱下标更小、数值满足严格性。

<a id="ordered-dp-frontier-standard"></a>
### 边界设施与二维嵌套

```cpp
std::vector<int> lis_standard(const std::vector<int>& a,bool nondecreasing=false) {
    return lis_core(a,[=](const std::vector<int>& tail,int x) {
        const auto it = nondecreasing ? std::upper_bound(tail.begin(),tail.end(),x)
                                     : std::lower_bound(tail.begin(),tail.end(),x);
        return static_cast<int>(it-tail.begin()); // 变成下标再允许vector增长
    });
}
```

严格上升用`lower_bound`，非降用`upper_bound`：相等值能否延长，决定被替换的边界。非降前沿也只保证非降；恢复时前驱关系相应改为`<=`。

信封嵌套增加了两个维度：宽与高都须严格变大。按宽升序后只对高做严格LIS还不够，同宽信封可能被串起来；把同宽部分改为高降序，它们就不可能在高的严格LIS中连续被选。不同宽仍按宽递增，归约才同时满足两个维度。

```cpp
int envelopes_standard(std::vector<std::pair<int,int>> envelopes) {
    std::sort(envelopes.begin(),envelopes.end(),[](auto a,auto b) {
        return a.first != b.first ? a.first<b.first : a.second>b.second;
    });
    std::vector<int> heights;
    for (auto item : envelopes) heights.push_back(item.second);
    return static_cast<int>(lis_standard(heights).size());
}
```

排序O(n log n)、高度LIS O(n log n)、空间O(n)。<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>中的严格性直接服务于这条归约。

<aside class="knowledge-introduction" id="knowledge-Q100004" data-knowledge-introduction="Q100004"><p class="knowledge-title">比较器与排序合同</p><p><code>sort</code> 的比较器应定义严格弱序：自身不小于自身，比较关系和由“不互相小于”定义的等价关系都应满足传递性。<code>a&lt;=b</code> 会使相等元素也被判成更小，不是合法替代；不要通过相减的正负判断顺序，减法可能溢出。</p>
<p>复合排序必须先按第一关键字区分，再处理真正相等时的第二关键字。例如信封宽升序、同宽高降序；这是算法归约需要的次序，不是所有 pair 默认字典序都能替代。不要在浮点比较器中随意加 epsilon，近似等价可能破坏传递性；NaN 同样会破坏正常的排序推理。</p>
<p>对固定key，<code>lower_bound</code> 实际要求的是 <code>comp(element,key)</code> 分区；<code>upper_bound</code> 则比较相反参数方向。这与为了排序所需的全域严格弱序应区别。异构记录查询需要写对方向，不能把某个只接受 <code>(Record,Key)</code> 的回调原样塞给 <code>upper_bound</code>。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.sorting">C++17 排序关系</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search">二分合同</a>。</p>
</aside>


### 计数变型：先保留末位置，再合并方案

单个最小尾值丢失方案数量：`[1,3,2,4]`中尾值2支配3的延长能力，却不能把经过3的另一条最长链删出计数。改用以位置i结尾的状态：`len[i]`是其中最长链长度，`ways[i]`是达到该长度的下标序列数。初始化`len=1,ways=1`对应只选当前项。

枚举`j<i`且`a[j]<a[i]`，把每条以j结尾的链接上i，候选长度为`len[j]+1`。若它更长，旧方案不再属于本状态最优长度，须**覆盖**长度与方案数；若相等，须**相加**。不同j是不同的倒数第二个下标，候选集合互斥，故不会重计；按值相同但下标不同的链仍算不同方案。最后令best=max(len)，只合并所有`len[i]=best`的ways；末下标再次把全体最长链分成互斥集合。

例如`[1,3,5,4,7]`：5与4各有长度3、方案1；处理7时先接5得到长度4、方案1，再接4得到同长另1条，合计2。以下实现再加入计数饱和，防止与最终最优链无关的短状态溢出：

```cpp
i64 lis_count(const std::vector<int>& a) {
    if (a.empty()) return 0;
    const int n=static_cast<int>(a.size());
    std::vector<int> len(n,1);
    std::vector<i64> ways(n,1);
    const auto add_count=[](i64 x,i64 y) {
        const i64 cap=std::numeric_limits<i64>::max();
        return y>cap-x ? cap : x+y;
    };
    for (int i=0;i<n;++i) for (int j=0;j<i;++j) if (a[j]<a[i]) {
        // 更长则覆盖旧长度的方案；同长才合并互斥的倒数第二下标。
        if (len[j]+1>len[i]) { len[i]=len[j]+1; ways[i]=ways[j]; }
        else if (len[j]+1==len[i]) ways[i]=add_count(ways[i],ways[j]);
    }
    const int best=*std::max_element(len.begin(),len.end());
    i64 result=0;
    for (int i=0;i<n;++i) if (len[i]==best) result=add_count(result,ways[i]);
    return result; // 若最终答案可表示则精确；无关较短状态过大时饱和。
}
```

这版 O(n²) 满足 LC673 的 n≤2000。注意，最终答案可表示不保证每个较短状态的局部方案数可表示：前面可出现海量短链，随后又出现一条独立且更长的唯一链。因此每次相加先作饱和判断。若一个被截断的状态能够进入最终最优长度，它的所有前缀方案都可作同样延伸，最终方案数也必达到截断值；题目保证最终值较小时，这种状态就不会影响最终精确答案。

tail摘要适于长度与恢复，这里的计数DP则保留了末位置和方案数；更高效的计数实现还可结合值域数据结构，但需要能合并长度与计数的摘要。若任务不保证最终答案可表示，须另选大整数或取模合同，不能把饱和值称作精确大计数。

<a id="ordered-dp-frontier-engineering"></a>
先把边界迭代器转换成下标，再 `push_back`；重分配后旧迭代器可能失效，`reserve` 也不代表已有可下标写入的元素。详见<a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">vector容量、元素与失效</a>。严格与非降两种恢复都要验证下标递增及值关系，而不只比长度。

<aside class="knowledge-introduction" id="knowledge-Q100013" data-knowledge-introduction="Q100013"><p class="knowledge-title">vector容量、元素与位置失效</p><p><code>reserve(n)</code>只管理容量，<code>resize(n)</code>会改变元素数量。仅reserve后用<code>v[i]</code>写入尚不存在的元素不合法；预留容量也不能被当成元素已经构造。需要按下标填充时先确定size，需要逐个追加时用push_back或emplace_back。</p>
<p>重分配会使指向原元素的指针、引用和迭代器全部失效。<code>push_back</code>未重分配时，原元素引用与迭代器仍有效，但旧的end迭代器失效；插入或擦除还可能移动后缀。<code>erase</code>使擦除位置及其后的迭代器和引用失效，不能把“缓冲区没换”理解成所有旧位置仍可使用。</p>
<p>LIS先把lower_bound结果转成下标，再允许push_back；若保存原迭代器，增长后不能继续解引用它。递归事件分流也不应持有某个元素引用后再扩张同一vector；已知大小的共享缓冲区可以写入不同范围，但仍须说明递归时各范围的所有权。</p>
<p><code>unique</code>只把相邻等价元素压到前缀，返回新逻辑结尾，并不缩小容器；通常以<code>erase(newEnd,end)</code>完成删除。<code>sort/unique/erase</code>之后，原下标未必继续指向原元素。本章压缩表在完成这些操作后才按值重新查秩，因此不依赖旧位置。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/vector.capacity">vector容量</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers">vector修改</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.unique">unique</a>。</p>
</aside>


练习：[LC300 · 最长递增子序列](https://leetcode.com/problems/longest-increasing-subsequence/description/)、[LC354 · 俄罗斯套娃信封](https://leetcode.com/problems/russian-doll-envelopes/description/)、[LC673 · 最长递增子序列的个数](https://leetcode.com/problems/number-of-longest-increasing-subsequence/description/)。


<a id="weighted-predecessor"></a>
## 带权兼容调度：二分定位 DP 前驱

最早结束的贪心不再保证总收益最大。按结束时间排序，`dp[i]` 表示前 i 个任务的最大奖励：不选第 i 个取 dp[i−1]；选它则加上所有已结束兼容任务构成的前缀最优值。二分只负责找到这个前缀长度，最优性来自选/不选的完整划分。

<a id="weighted-predecessor-manual"></a>
### 前驱数量直接作为 DP 下标

```cpp
struct Job { i64 start,end,reward; };
template<class Predecessor>
i64 jobs_core(std::vector<Job> jobs,bool touching,Predecessor predecessor) {
    std::sort(jobs.begin(),jobs.end(),[](Job a,Job b) { return a.end<b.end; });
    std::vector<i64> ends,dp(jobs.size()+1,0);
    for (int i=0;i<static_cast<int>(jobs.size());++i) {
        // p为已处理任务中兼容的个数，可直接作为dp下标。
        const int p=predecessor(ends,jobs[i].start,touching);
        dp[i+1]=std::max(dp[i],dp[p]+jobs[i].reward);
        ends.push_back(jobs[i].end);
    }
    return dp.back();
}
i64 jobs_manual(std::vector<Job> jobs,bool touching=false) {
    return jobs_core(std::move(jobs),touching,[](const auto& ends,i64 start,bool touch) {
        int lo=0,hi=static_cast<int>(ends.size());
        while (lo<hi) {
            const int mid=lo+(hi-lo)/2;
            if (touch ? ends[mid]<=start : ends[mid]<start) lo=mid+1;
            else hi=mid;
        }
        return lo;
    });
}
```

排序及前驱查询合计 O(n log n)，空间 O(n)。仅在**已处理**的 ends 中搜索，避免相同结束时间时把当前任务或未来任务当成前驱。若要恢复任务集合，保存本状态选/不选及 p，从末状态反向回溯；相等最优值的选择政策可以固定为不选。

<a id="weighted-predecessor-standard"></a>
### 原题端点决定 lower 还是 upper

```cpp
i64 jobs_standard(std::vector<Job> jobs,bool touching=false) {
    return jobs_core(std::move(jobs),touching,[](const auto& ends,i64 start,bool touch) {
        const auto it=touch ? std::upper_bound(ends.begin(),ends.end(),start)
                            : std::lower_bound(ends.begin(),ends.end(),start);
        return static_cast<int>(it-ends.begin());
    });
}
```

CSES Projects 同一天不能参加两个任务，要求 `end<start`，用 `lower_bound(start)`；LC1235 允许结束瞬间接下一项，要求 `end≤start`，用 `upper_bound(start)`。代码的 `touching` 参数承载这个合同差异。CSES 可有单日任务；允许接触的 LC 合同仍要求各任务 start<end，不能据此推演任意零长度调度。

<a id="weighted-predecessor-engineering"></a>
总收益可超32位，dp 与 reward 都用64位。排序只要求按 end 的严格弱序，等 end 不必强排一个虚构优先级；兼容条件负责正确性。按值接收任务后以 `std::move` 交给共同核心，避免为了两种边界再复制一次；这不改变输入对象由调用者保有的事实。

练习：[CSES · Projects](https://cses.fi/problemset/task/1140/)、[LC1235 · 规划兼职工作](https://leetcode.com/problems/maximum-profit-in-job-scheduling/description/)。


<a id="resource-queries"></a>
## 查询会消耗资源：反求最少试探次数

有n层楼、k个鸡蛋，未知最高安全楼层f在`0..n`：从1..f层试投不碎，更高层会碎。要求无论f为何，都能确定它，最少需要几次试投？临界关系单调，却不能拿一个鸡蛋普通二分：第一次碎掉后，剩余楼层已经无法再试。

换问法，令`cover(d,k)`表示d次试投、k个鸡蛋能够保证处理的最大楼层数；覆盖c层意味着能区分f的c+1种位置。基例`cover(0,k)=cover(d,0)=0`，没有试投机会或没有鸡蛋都不能再区分未知楼层。

一次选择试投层，碎了只剩`d-1,k-1`，下方至多容纳`cover(d-1,k-1)`层；没碎则上方至多容纳`cover(d-1,k)`层，加上本层，故

`cover(d,k)=cover(d-1,k-1)+1+cover(d-1,k)`。

这既是上界也是可构造方案：把第一投设在“下方覆盖量+1”层，两个结果各交给对应子策略。若实际n小于总容量，只须截短一个分支，仍可覆盖n层。例如d=3、k=2时，下方容量2、上方容量3，第一投选第3层，最多覆盖6层；碎了查1、2层，没碎查4、5、6层。不是仅凭数出6种楼层就假定存在策略。

### 由覆盖递推得到组合判定

令超出d范围的组合数为0。由Pascal恒等式`C(d,i)=C(d-1,i-1)+C(d-1,i)`，上述递推与两个零基例给出

`cover(d,k)=Σ(i=1..min(d,k)) C(d,i)`。

也可把策略路径按至多k次破损的位置来计数，但递推已同时证明该计数能由合法试投策略实现。覆盖量随d非降；一个鸡蛋逐层试至多n次，因此`[0,n]`有可行上界，二分最小d使覆盖量>=n。

<a id="resource-queries-manual"></a>
### 组合计数作为判定器

```cpp
// LC887合同：1<=eggs<=100，0<=floors<=10000。
int egg_moves_manual(int eggs,int floors) {
    auto enough=[=](int moves) {
        i64 term=1,sum=0;
        for (int i=1;i<=eggs && i<=moves;++i) {
            term=term*(moves-i+1)/i; // C(moves,i)，尚未饱和时乘积<=floors²
            sum+=term;
            if (sum>=floors) return true;
        }
        return false;
    };
    int lo=0,hi=floors;
    while (lo<hi) {
        const int mid=lo+(hi-lo)/2;
        if (enough(mid)) hi=mid; else lo=mid+1;
    }
    return lo;
}
```

从`C(d,0)=1`开始，用`C(d,i)=C(d,i-1)*(d-i+1)/i`逐项求和；先乘后除才能保留整数精确值。一次判断最多O(k)项，总O(k log(n+1))、额外O(1)。本代码合同为`1<=k<=100,0<=n<=10000`，n=0直接由搜索区间返回0。

上一轮尚未达标时，已有项与和均小于n；下一乘法粗界n²，在64位内。累计达到n便停止，不生成后续巨型组合数。这个预算依赖原题n上界，不能推广成任意64位楼层；只需判断够不够，也无须保留大于n的精确覆盖量。

<a id="resource-queries-standard"></a>
### 直接推进覆盖DP的对照

```cpp
int egg_moves_coverage(int eggs,int floors) {
    std::vector<int> cover(eggs+1,0);
    int moves=0;
    while (cover[eggs]<floors) {
        ++moves;
        for (int e=eggs;e>=1;--e)
            cover[e]=std::min(floors,cover[e]+cover[e-1]+1);
    }
    return moves; // 另一算法：按次数增长覆盖DP，不是std提供了鸡蛋求解。
}
```

`vector`承载各鸡蛋数量的覆盖状态，`std::min`把覆盖饱和到n；递推仍由我们定义。这是另一种求值次序：从d=0逐次增加机会，耗时O(k·答案)、空间O(k)。鸡蛋数e倒序更新，才能让`cover[e]`和`cover[e-1]`都代表上一轮；正序会把同一次试投重复用于多个状态。两条路径分别是组合判定+二分、直接覆盖DP，不能称作只换库的同一算法。

<a id="resource-queries-engineering"></a>
目标条件单调，与查询是否可重复且无代价是不同问题。交互题、昂贵测量或破坏性试探都要先确定资源怎样影响后续信息能力。这里求的是最坏情况最少次数；若问期望次数并给出概率分布，需要不同的状态与目标。

练习：[LC887 · 鸡蛋掉落](https://leetcode.com/problems/super-egg-drop/description/)。

<a id="matrix-peak"></a>
## 二维局部峰的存在性搜索

正值矩形网格，四邻接值均不相等，外部视作-1。不能在中列随便挑一格就决定方向：它可能被上下邻居压住。先找中列的最大元素，才能保证上下都不更大；如果横向也没有更大邻居，它就是峰。若右邻更大，则右侧有一个超过整条中列的候选，沿更大值继续走终会得到右侧的峰；向左同理。

<a id="matrix-peak-manual"></a>
### 用列最大值建立真正的横向证书

```cpp
template<class ColumnMaximum>
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_core(const std::vector<std::vector<int>>& a, ColumnMaximum maximum_row) {
    if (a.empty() || a.front().empty()) return std::nullopt;
    std::size_t lo = 0, hi = a.front().size() - 1;
    while (lo <= hi) {
        const auto col = lo + (hi - lo) / 2;
        const auto row = maximum_row(col); // 必须是中列最大，而不是随便一行。
        if (col + 1 < a.front().size() && a[row][col + 1] > a[row][col]) lo = col + 1;
        else if (col > 0 && a[row][col - 1] > a[row][col]) hi = col - 1;
        else return std::pair<std::size_t, std::size_t>{row, col};
    }
    throw std::logic_error("invalid matrix-peak contract");
}
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_manual(const std::vector<std::vector<int>>& a) {
    return matrix_peak_core(a, [&](std::size_t col) {
        std::size_t row = 0;
        for (std::size_t r = 1; r < a.size(); ++r)
            if (a[r][col] > a[row][col]) row = r;
        return row;
    });
}
```

一次扫描一列O(m)，列域对半共O(log n)次，所以时间O(m log n)、额外空间O(1)；也可转置思路二分行。原始相邻不等保证列最大严格高于上下邻居，远处相等没有影响。不断选择某侧时保留的是能通向一个峰的区域，不是同一个最大点的坐标。

<a id="matrix-peak-library"></a>
### 把列最大扫描交给标准设施

```cpp
std::optional<std::pair<std::size_t, std::size_t>>
matrix_peak_standard(const std::vector<std::vector<int>>& a) {
    // std设施只替换“取中列最大行”；共享的是前面的二分证书和核心。
    std::vector<std::size_t> rows(a.size());
    std::iota(rows.begin(), rows.end(), std::size_t{0});
    return matrix_peak_core(a, [&](std::size_t col) {
        return *std::max_element(rows.begin(), rows.end(), [&](std::size_t x, std::size_t y) {
            return a[x][col] < a[y][col];
        });
    });
}
```

`iota`建立行号，`max_element`按当前列比较行号，返回最大元素所在行。二分证书与更新只有前面那份共享核心；库只替换“列最大”的操作，没有整题峰搜索函数。时间仍O(m log n)，这份索引写法额外空间O(m)，换取比较器表达的直接性；它不比手写扫描省内存。

<a id="matrix-peak-engineering"></a>
捕获的col在一次`max_element`期间不变，矩阵也不能被比较器修改，见<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">判定器与lambda捕获</a>、<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>。输入须为矩形；代码没有每次重新验证形状和四邻不等。空矩阵/零列返回空值，不会对空行号范围取最大值。

练习：[二维局部峰](https://leetcode.com/problems/find-a-peak-element-ii/)。


<a id="string-prefix"></a>
## 字典序前缀与比较成本

给按字典序排序的字符串表，找全部以p开头的词所在区间。把每个词截取至多|p|个字符后与p比较，结果依次是负、零、正；两个边界框出全部匹配。不必构造“p的字典序后继”，也不必假设任意字符域都有安全的加一操作。

<a id="string-prefix-manual"></a>
### 搜索匹配区间

```cpp
std::pair<std::size_t, std::size_t>
prefix_range_manual(const std::vector<std::string>& words, std::string_view prefix) {
    // compare只看word的前|prefix|个字符；匹配返回0，短于prefix返回负。
    auto compare = [&](std::size_t i) { return std::string_view(words[i]).substr(0, prefix.size()).compare(prefix); };
    std::size_t lo = 0, hi = words.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (compare(m) < 0) lo = m + 1;
        else hi = m;
    }
    const auto first = lo;
    hi = words.size();
    while (lo < hi) {
        const auto m = lo + (hi - lo) / 2;
        if (compare(m) <= 0) lo = m + 1;
        else hi = m;
    }
    return {first, lo};
}
```

词短于p且仅匹配前段时比较为负，不算完整前缀；p为空则所有词都匹配。两次二分共O(log n)次比较，一次比较最多读|p|个字符，因此字符成本O(|p|log(n+1))。输入须按相同字典序排序。

### 变型：搜索两串最长相等前缀的长度

给两串a、b，令L=min(|a|,|b|)，找最大长度m使前m个字符全相等。相等前缀缩短后仍相等，所以长度域为真前缀；上中点与`hi=m-1`寻找最后真，长度0始终可行。这里的候选是长度，不是词表下标。

```cpp
std::size_t lcp_binary(std::string_view a, std::string_view b) {
    std::size_t lo = 0, hi = std::min(a.size(), b.size());
    while (lo < hi) {
        const auto width = hi - lo;
        const auto m = lo + width / 2 + width % 2;
        if (a.substr(0, m) == b.substr(0, m)) lo = m;
        else hi = m - 1;
    }
    return lo;
}
```

例如`flower`与`flowing`的长度4可行、长度5失败，答案4。每次仍从头比较前m字符，全相等的最坏情形花O(L log(L+1))字符成本；“判定次数对数”不表示整题比线性快。

<a id="string-prefix-library"></a>
### 库边界、建议列表与直接LCP

```cpp
std::pair<std::size_t, std::size_t>
prefix_range_standard(const std::vector<std::string>& words, std::string_view prefix) {
    const auto first = std::lower_bound(words.begin(), words.end(), prefix,
        [](const std::string& word, std::string_view p) {
            return std::string_view(word).substr(0, p.size()).compare(p) < 0;
        });
    const auto last = std::upper_bound(first, words.end(), prefix,
        [](std::string_view p, const std::string& word) {
            return std::string_view(word).substr(0, p.size()).compare(p) > 0;
        });
    return {static_cast<std::size_t>(first - words.begin()),
            static_cast<std::size_t>(last - words.begin())};
}
```

`lower_bound`、`upper_bound`的比较方向分别适配前缀截取关系，返回同一匹配区间。

建议系统还要求随用户每输入一个字符，返回字典序最小的至多3个产品。先排序，再对每个输入前缀调用刚才的区间查询，取区间开头至多3项即可；排序后区间内部本就按所需次序，无须另选一次最小值。

```cpp
std::vector<std::vector<std::string>>
suggestions_standard(std::vector<std::string> products, std::string_view query) {
    std::sort(products.begin(), products.end());
    std::vector<std::vector<std::string>> result;
    for (std::size_t length = 1; length <= query.size(); ++length) {
        const auto range = prefix_range_standard(products, query.substr(0, length));
        std::vector<std::string> row;
        for (auto i = range.first; i < range.second && row.size() < 3; ++i) row.push_back(products[i]);
        result.push_back(std::move(row));
    }
    return result;
}
```

示例返回拥有字符串的结果，避免本地products销毁后留下视图。输入长度q时，最坏查询字符成本O(q²log(n+1))，另加产品排序及结果复制；不能只数q次函数调用。

对于刚才的两串LCP，`mismatch`直接找首个不同字符，确定性成本O(L)：

```cpp
std::size_t lcp_standard(std::string_view a, std::string_view b) {
    return static_cast<std::size_t>(std::mismatch(a.begin(), a.end(), b.begin(), b.end()).first - a.begin());
}
```

这比本节朴素长度二分更合适。若预处理前缀哈希，每次判定可更便宜，但哈希相等只是可能相等，碰撞甚至会破坏实际oracle的单调表现；双哈希降低风险，不变成确定性证明。后缀数组已建好时也能按模式前缀找区间；查已有有序索引与构建后缀索引是两件事，这里没有完成后者。

<a id="string-prefix-engineering"></a>
`string_view::substr`只借用字符，不复制，也不延长源字符串寿命。比较序若改为忽略大小写、区域排序或编码规范化，排序和前缀定义都要同步，见<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>、<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与视图寿命</a>。这些代码按字符单元比较，不宣称处理规范化后的人类语言前缀。

练习：[搜索建议系统](https://leetcode.com/problems/search-suggestions-system/)。


<a id="continuous-root"></a>
## 连续方程的异号夹逼与误差

连续函数在lo、hi处异号，介值定理保证其中有某个根。取中点后保留异号的一半，这个结论不要求函数单调；但它也不承诺找到全部根。`x²`在[-1,1]中有偶重根0，两端同号，不能由异号算法发现。单调阶跃即使异号也可能没有零点，因为缺少连续性。

<a id="continuous-root-manual"></a>
### 返回真实夹区，而不是未经兑现的精度承诺

```cpp
struct RootBracket { double lo, hi; };
template<class Function>
std::optional<RootBracket>
bisect_root(Function f, double lo, double hi, double tolerance = 1e-10, int steps = 200) {
    if (!std::isfinite(lo) || !std::isfinite(hi) || lo > hi ||
        !std::isfinite(tolerance) || tolerance <= 0 || steps < 0)
        throw std::invalid_argument("invalid root interval");
    auto value = [&](double x) {
        const double y = f(x);
        if (!std::isfinite(y)) throw std::domain_error("non-finite function value");
        return y;
    };
    double fl = value(lo), fr = value(hi);
    if (fl == 0) return RootBracket{lo, lo};
    if (fr == 0) return RootBracket{hi, hi};
    if ((fl < 0) == (fr < 0)) return std::nullopt;
    // 调用者保证f连续；异号保证区间中至少有某个根，不要求单调。
    for (int i = 0; i < steps && hi - lo > tolerance; ++i) {
        const double m = lo / 2 + hi / 2;
        if (m == lo || m == hi) break; // 浮点相邻数使细分停止。
        const double fm = value(m);
        if (fm == 0) return RootBracket{m, m};
        if ((fl < 0) == (fm < 0)) { lo = m; fl = fm; }
        else { hi = m; fr = fm; }
    }
    return RootBracket{lo, hi}; // 返回实际夹区，不伪称必已达到所求误差。
}
```

不用`f(lo)*f(hi)<0`判断异号，避免引入无必要乘积。停止有三种原因：宽度达到容差、达到步数上限、浮点中点已无法区别于端点。后两种不保证给定宽度已达标，所以返回实际`RootBracket`；调用者按题目误差检查，而不是把一次函数返回自动视为成功。理想求值下，所需轮数为O(log((hi-lo)/ε))，每轮成本还乘以f的求值代价。实际浮点计算须足够可靠地保留符号，极端消去误差不能由外层二分修复。

<a id="continuous-root-library"></a>
### P1024为什么可以进一步找全三个根

原题保证三个互异实根位于[-100,100]、彼此相距至少1。要稳妥找全，不依赖“某个整数端点的浮点残差恰为0”：例如十进制系数`0.1,-0.6,1.1,-0.6`的数学根为1、2、3，二进制求值却可能让整数端点只出现很小的正负误差，按单位区间识别就会重复或漏掉根。

把方程除以a得到`x³+B x²+C x+D`，导数的两个零点为`t₁,₂=(-B±sqrt(B²-3C))/3`。由Rolle定理，三根与临界点严格交错：`r₁<t₁<r₂<t₂<r₃`。于是`[-101,t₁]`、`[t₁,t₂]`、`[t₂,101]`各有且只有一根，三个区间依次夹逼即可；±101在原题根域之外，避开根恰为±100时的端点求值问题。这里使用的是“导数划分单调区间”的额外证书，不是让一个通用异号循环自动找全根。

整体归一消除了任意系数缩放带来的残差尺度，`long double`和`fma`减少Horner求值的舍入。根域使归一系数的绝对值分别不超过300、30000、10⁶；根距至少1还使两个临界值远离0：在任一相邻根的中点，单首项三次式的绝对值至少`(1/2)²×(3/2)=3/8`，该区间的极值只会更大。这给临界点分段提供实际数值裕量，而非用统一epsilon把近似相等都合并。三个区间已按序且不共享根，无需浮点去重；`sqrt/fma`只是标准数值设施，并非通用三次方程求解函数。

```cpp
std::vector<double> cubic_roots_by_critical_points(long double a, long double b,
                                                 long double c, long double d) {
    // P1024：三个互异实根在[-100,100]，根间距>=1。
    if (!std::isfinite(a) || !std::isfinite(b) || !std::isfinite(c) || !std::isfinite(d) || a == 0)
        throw std::invalid_argument("invalid cubic coefficients");
    // 归一后不受整体缩放影响；根有界使|B|<=300、|C|<=30000、|D|<=1e6。
    const long double B = b / a, C = c / a, D = d / a;
    const long double delta = std::fma(B, B, -3 * C);
    if (!(delta > 0) || !std::isfinite(delta))
        throw std::domain_error("cubic requires two distinct critical points");
    const long double square = std::sqrt(delta);
    const double first = static_cast<double>((-B - square) / 3);
    const double second = static_cast<double>((-B + square) / 3);
    // Rolle定理给r1<t1<r2<t2<r3；外端取±101，避开根恰在±100的脆弱判断。
    if (!(-101 < first && first < second && second < 101))
        throw std::domain_error("critical points outside problem contract");
    auto f = [=](double x) {
        const long double X = x;
        return static_cast<double>(std::fma(std::fma(X + B, X, C), X, D));
    };
    const double cut[] = {-101, first, second, 101};
    std::vector<double> roots;
    for (int i = 0; i < 3; ++i) {
        const auto bracket = bisect_root(f, cut[i], cut[i + 1], 1e-11);
        if (!bracket || bracket->hi - bracket->lo > 1e-9)
            throw std::domain_error("root bracketing failed");
        roots.push_back(bracket->lo / 2 + bracket->hi / 2);
    }
    return roots; // 三个夹区本身按序、各含一根，不需要epsilon去重。
}
```

工资封顶是有用的对照：`P(c)=Σmin(salary,c)`非降，可二分c；排序后它在相邻工资断点之间是线性的。令S为低于当前断点的工资前缀和，剩下r人都被封顶，则直接解`c=(T-S)/r`。多次目标查询可以先建立各断点对应的工资总额，再`lower_bound`定位区间。能解析恢复时不必为了本章主题强行迭代；目标大于原总工资应无解。

<a id="continuous-root-engineering"></a>
绝对位置误差、相对误差与函数残差不同。平方根在0<x<1时也不能用[0,x]作夹区；machine-epsilon不是所有业务所需容差。上面例子按P1024输出两位小数留足余量，示例函数不包含输出格式，见<a class="knowledge-link" href="#knowledge-Q100006" data-knowledge="Q100006">浮点夹逼与误差</a>。

<aside class="knowledge-introduction" id="knowledge-Q100006" data-knowledge-introduction="Q100006"><p class="knowledge-title">浮点夹逼与误差</p><p>浮点数离散，<code>while(lo&lt;hi)</code> 不保证中点能继续推进；当 mid 等于端点时应停止。固定轮数也须依据初始区间宽度和目标误差选择。绝对区间宽度、相对误差、函数残差是不同合同；输出三位小数只是格式，不会让错误答案自动精确到三位。</p>
<p>连续异号夹逼保留某个根，不能仅因单调就保证根存在：跳跃函数可能跨过0却不取0。只找某根也不代表找到了最小根或全部根；偶重根不一定出现符号变化。单调可行性阈值则要另外证明判定方向。</p>
<p><code>long double</code> 的精度依平台变化，不能按类型名字保证80位。按值域与累加项数评估误差，必要时保留可行侧或同时输出区间。避免 <code>f(lo)*f(mid)</code> 的无谓乘积溢出，可直接比较符号；输入含NaN、无穷或存在不连续点时先重新界定合同。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/basic.fundamental">浮点类型</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/numeric.limits">数值特征</a>。</p>
</aside>


练习：[一元三次方程求解](https://www.luogu.com.cn/problem/P1024)。


<a id="average-transform"></a>
## 平均值优化中的合法区间判定

比值不能直接像和一样加减，但可以试一个平均值 λ，再把每项减去 λ。对任意非空集合，`sum(a)/count≥λ` 等价于 `sum(a−λ)≥0`，因为分母为正。**变换只消除了除法，合法集合的约束并没有消失。**

P1419 要在长度 `[S,T]` 的连续段中最大化平均，`1≤S≤T≤n≤10^5`、元素在 `[-10^4,10^4]`。令变换前缀为 P，固定右端 r≥S，合法左前缀下标是 `[max(0,r−T),r−S]`。检查是否 `P[r]−min P[left]≥0`；用单调队列保存这个滑动窗口的前缀最小值。只有最短长度时可以保留历史最小前缀，增加最长长度后必须让过期候选退出。

Sabotage 的约束不同：`3≤N≤10^5`、每项在 `1..10000`，必须删掉一个非空内部连续段，首尾保留，最小化剩余平均。令总变换和为 U，删段变换和为 V，则剩余平均≤λ 等价于 `U−V≤0`。因此检查**内部非空最大子段和≥U**。这里最大子段用 Kadane，不能误换成最小子段，也不能允许空删段。

<a id="average-transform-manual"></a>
### 手写：合法前缀窗口与非空内部子段

最大平均值维护可行下界，最小剩余平均值维护可行上界。它们共用下面的浮点收缩核心：中点判定后不作整数的±1，而是保留对应半区；最多80轮，并在中点无法区别于端点时停止。范围与累计求值误差仍按本题预算，不能把轮数当作任意精度保证。

```cpp
// 固定迭代预算，并防止浮点中点已无法前进。
template<class Predicate>
long double real_last_true(long double lo, long double hi, Predicate feasible) {
    for (int step = 0; step < 80; ++step) {
        const long double mid = lo + (hi - lo) / 2;
        if (mid == lo || mid == hi) break;
        if (feasible(mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}

template<class Predicate>
long double real_first_true(long double lo, long double hi, Predicate feasible) {
    for (int step = 0; step < 80; ++step) {
        const long double mid = lo + (hi - lo) / 2;
        if (mid == lo || mid == hi) break;
        if (feasible(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}
```

```cpp
long double max_average_manual(const std::vector<i64>& a, int shortest, int longest) {
    long double lower = a[0], upper = a[0];
    for (i64 x : a) { if (x < lower) lower = x; if (x > upper) upper = x; }
    const int n = static_cast<int>(a.size());
    auto feasible = [&](long double guess) {
        std::vector<long double> prefix(n + 1, 0);
        for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i] - guess;
        std::vector<int> queue(n + 1);
        int head = 0, tail = 0;
        for (int r = shortest; r <= n; ++r) {
            const int enter = r - shortest;
            while (head < tail && prefix[queue[tail - 1]] >= prefix[enter]) --tail;
            queue[tail++] = enter;
            while (head < tail && queue[head] < r - longest) ++head;
            // 合法左前缀范围为 [r-longest, r-shortest]，队头是其最小值。
            if (prefix[r] >= prefix[queue[head]]) return true;
        }
        return false;
    };
    return real_last_true(lower, upper, feasible);
}

long double min_remaining_average_manual(const std::vector<i64>& a) {
    auto feasible = [&](long double guess) {
        long double total = 0;
        for (i64 x : a) total += x - guess;
        // 删除段必须非空，且不得包含 a.front()/a.back()。
        long double current = a[1] - guess, best = current;
        for (std::size_t i = 2; i + 1 < a.size(); ++i) {
            const long double x = a[i] - guess;
            current = current > 0 ? current + x : x;
            if (current > best) best = current;
        }
        return best >= total; // 剩余变换和 <=0，亦即剩余平均 <=guess。
    };
    return real_first_true(1, 10000, feasible);
}
```

P1419 的队列保存下标，后端去掉值大于或等于新前缀的旧下标，前端去掉过期下标。新前缀值不更大，下标又更晚，因此更晚过期：即使两值相等，新者仍支配旧者，这正是代码用`>=`而非只用`>`的理由。每个下标入队/出队至多一次，单次判定 O(n)、空间 O(n)。

Sabotage 的 `current` 是以当前内部位置结束的非空最大子段和；从第一项内部值初始化，因此内部全负时仍会删掉至少一项。它单次 O(n)、额外空间 O(1)。两种搜索都做至多 80 轮，但前者最大化所以保留可行下界，后者最小化所以保留可行上界。

<a id="average-transform-standard"></a>
### 标准设施：deque 与显式变换

```cpp
long double max_average_standard(const std::vector<i64>& a, int shortest, int longest) {
    const auto limits = std::minmax_element(a.begin(), a.end());
    const int n = static_cast<int>(a.size());
    auto feasible = [&](long double guess) {
        std::vector<long double> prefix(n + 1, 0);
        for (int i = 0; i < n; ++i) prefix[i + 1] = prefix[i] + a[i] - guess;
        std::deque<int> candidates;
        for (int r = shortest; r <= n; ++r) {
            const int enter = r - shortest;
            while (!candidates.empty() && prefix[candidates.back()] >= prefix[enter])
                candidates.pop_back();
            candidates.push_back(enter);
            while (candidates.front() < r - longest) candidates.pop_front();
            if (prefix[r] >= prefix[candidates.front()]) return true;
        }
        return false;
    };
    return real_last_true(*limits.first, *limits.second, feasible);
}

// Sabotage 的设施层只展示“减去阈值”；它不代替非空 Kadane 证明。
std::vector<long double> shifted_values_standard(const std::vector<i64>& a,
                                                 long double guess) {
    std::vector<long double> result(a.size());
    std::transform(a.begin(), a.end(), result.begin(),
                   [guess](i64 value) { return value - guess; });
    return result;
}
```

`deque` 接管队头、队尾删除，单调和过期规则仍由算法保证。`minmax_element` 设原数组最小/最大平均范围。Sabotage 的 `transform` 只演示“对每项减去同一阈值”的设施层，会物化 O(n) 个变换值；若只求答案，手写版本边扫描边变换更省内存，不必为使用库额外生成数组。参见<a class="knowledge-link" href="#knowledge-Q100011" data-knowledge="Q100011">双端队列状态</a>与<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">按值捕获当前阈值</a>。

<a id="average-transform-engineering"></a>
### 数值与符号

P1419 允许负数，不能用正数数组“和超限就收缩”的滑窗。Sabotage 原平均在 `[1,10000]` 内；保留首尾让分母始终为正。官方解析文字有方向混淆，附代码 `best>=total−guess*N` 实际对应剩余平均≤guess，上面的推导明确了这一方向。

原始范围宽度不超过 20000；80 次理想折半远小于三位输出所需分辨率，但累计运算还有舍入误差，使用 long double 降低影响，并以独立枚举核小规模。<a class="knowledge-link" href="#knowledge-Q100006" data-knowledge="Q100006">浮点夹逼与误差</a>不能被 `setprecision(3)` 替代；本代码返回数值，最后一层才格式化。若需严格精确的有理答案，或者要判断恰好位于舍入中点的输出，需另设精度合同，不能宣称固定轮数等于任意精度证明。

练习：[寻找段落](https://www.luogu.com.cn/problem/P1419)；[Sabotage](https://usaco.org/index.php?page=viewproblem2&cpid=419)。前者要同时处理 S/T，后者要保留端点和非空删除。


<a id="ratio-selection"></a>
## 固定数量最大比值：变换后取最大的 m 项

从 n 项中恰选 m 项，最大化 `sum(value)/sum(cost)`；每项 cost>0。试 λ 后，不等式等价于 `sum(value−λ×cost)≥0`。此时为了让变换和最大，选择最大的 m 项分数即可。这并不等于事先按单项 value/cost 排序，因为原目标是总和之比。

例如恰选两项 `(value,cost)=(100,1),(900,100),(8,1)`：单项比值依次是 100、9、8，取前两项的总比值约 9.90，改取第一、三项却得到 54。决定选择的应是**当前 λ 下的变换分数**，不是预先固定的单项比例。

<a id="ratio-selection-manual"></a>
### 手写：变换分数与降序选择

```cpp
struct Ingredient { i64 value, cost; };

long double ratio_manual(const std::vector<Ingredient>& items, int choose) {
    auto feasible = [&](long double guess) {
        std::vector<long double> score;
        for (const auto& item : items) {
            score.push_back(item.value - guess * item.cost);
            // 手写插入排序，保持已经生成的变换分数降序。
            std::size_t p = score.size() - 1;
            while (p > 0 && score[p] > score[p - 1]) {
                const auto temporary = score[p];
                score[p] = score[p - 1]; score[p - 1] = temporary;
                --p;
            }
        }
        long double sum = 0;
        for (int i = 0; i < choose; ++i) sum += score[i];
        return sum >= 0;
    };
    return real_last_true(0, 1000, feasible); // 原题保证最优比值不超过 1000。
}
```

手写插入排序让 top m 的来源一目了然；原题 n≤200，因此 `O(80n²)` 可接受。手写重点是如何从比值推导检查器，不必为了展示高级选择算法掩盖这个建模。检查随 λ 非增，保留最后可行值，原题给出最优比值≤1000。

<a id="ratio-selection-standard"></a>
### 标准设施：nth_element 只隔出 top m

```cpp
long double ratio_standard(const std::vector<Ingredient>& items, int choose) {
    auto feasible = [&](long double guess) {
        std::vector<long double> score;
        score.reserve(items.size());
        for (const auto& item : items) score.push_back(item.value - guess * item.cost);
        if (choose < static_cast<int>(score.size()))
            std::nth_element(score.begin(), score.begin() + choose, score.end(),
                             std::greater<long double>{});
        // 前 choose 项是最大的 choose 项，但它们内部没有排好序。
        return std::accumulate(score.begin(), score.begin() + choose, 0.0L) >= 0;
    };
    return real_last_true(0, 1000, feasible);
}
```

`nth_element` 按降序把前 m 个位置划给最大的 m 项，但不把它们内部排序；只求和已经足够。普通重载平均线性，因此每次检查平均 O(n)，空间 O(n)。`m=n` 时全部取用，跳过不必要分隔。也可以用 `sort(...,greater<>)`，单次 O(n log n)，换取完整顺序，代价与所得应明确。参见<a class="knowledge-link" href="#knowledge-Q100008" data-knowledge="Q100008">选择算法与重排语义</a>。

<a id="ratio-selection-engineering"></a>
### 合法集合不能丢

正 cost 允许同乘不等式而不改方向；必须恰选 m 项，所以即使某些分数为负也不能任意少选。若再加总成本上限、物品冲突或相邻限制，“取前 m 大”就不再是正确检查器，应改用满足新约束的 DP/匹配等算法，外层二分不能替它修正。浮点比较器用正常大小关系，不加入破坏<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">严格弱序</a>的 epsilon 规则。<a class="knowledge-link" href="#knowledge-Q100006" data-knowledge="Q100006">浮点误差</a>与上一节遵守同一原则，本节还要计入 `λ×cost` 的运算预算。

<aside class="knowledge-introduction" id="knowledge-Q100008" data-knowledge-introduction="Q100008"><p class="knowledge-title">选择算法与重排语义</p><p><code>nth_element(first,nth,last,comp)</code> 把nth处变成完整排序后应在该位置的元素，并保证左部不大于右部（按comp解释）；两侧内部并不排序。普通非执行策略版本平均线性，不是最坏线性承诺。</p>
<p>取最大的m项求和，可用 <code>greater&lt;&gt;</code> 且nth置于begin+m，再求前m项和；m等于总数时直接求和即可，不需要选择。它会重排输入；保留原顺序需副本或索引，不能一边借用元素引用一边默认其位置不变。</p>
<p><code>sort</code> 提供完整次序但代价为O(n log n)比较。哪一个更合适由下一步是否需要完整顺序决定。隐式数对集合若先物化再选择，内存已变成O(n²)，不能仅看nth_element本身就称同资源解。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element">C++17 nth_element</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/sort">sort</a>。</p>
</aside>


练习：[KC 喝咖啡](https://www.luogu.com.cn/problem/P1570)。对比 `m=1`、`m=n` 与成本极不均衡的输入，验证检查器确实优化总和之比。

<a id="convex-location"></a>
## 凸多边形中的扇区定位

严格凸多边形按逆时针给出顶点，反复判断查询点在内部、边上还是外部。固定p₀后，到其余顶点的射线按角度排列；查询点若位于首尾射线之间，`cross(p₀,pᵢ,q)>=0`便形成真前缀。二分找到相邻射线，再判断q位于该扇区三角形的第三边哪侧。

<a id="convex-location-manual"></a>
### 先排除扇形外部，再定位第三条边

```cpp
struct Point { std::int64_t x, y; };
enum class Location { outside, boundary, inside };
std::int64_t cross(Point a, Point b, Point q) {
    // 本题abs坐标<=1e9：差<=2e9，两个乘积之差绝对值粗界8e18。
    return (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
}
bool on_segment(Point a, Point b, Point q) {
    return cross(a, b, q) == 0 && q.x >= std::min(a.x, b.x) && q.x <= std::max(a.x, b.x)
        && q.y >= std::min(a.y, b.y) && q.y <= std::max(a.y, b.y);
}
std::optional<Location> fan_boundary(const std::vector<Point>& p, Point q) {
    if (p.size() < 3) throw std::invalid_argument("polygon needs three vertices");
    const auto left = cross(p[0], p[1], q), right = cross(p[0], p.back(), q);
    if (left < 0 || right > 0) return Location::outside;
    if (left == 0) return on_segment(p[0], p[1], q) ? Location::boundary : Location::outside;
    if (right == 0) return on_segment(p[0], p.back(), q) ? Location::boundary : Location::outside;
    return std::nullopt; // 位于开扇形内，继续定位扇区。
}
Location convex_manual(const std::vector<Point>& p, Point q) {
    // p严格凸、逆时针，去掉末尾重复首点；q同样满足坐标预算。
    if (auto result = fan_boundary(p, q)) return *result;
    std::size_t lo = 1, hi = p.size() - 1;
    while (hi - lo > 1) {
        const auto m = lo + (hi - lo) / 2;
        if (cross(p[0], p[m], q) >= 0) lo = m;
        else hi = m;
    }
    const auto side = cross(p[lo], p[hi], q);
    return side < 0 ? Location::outside : side == 0 ? Location::boundary : Location::inside;
}
```

两条边界射线需要先处理：叉积为0只说明共线，点可能在边的外延，必须再做坐标范围检查。进入开扇形之后，找到`p[lo]、p[hi]`，只须看第三边`p[lo]→p[hi]`的叉积：负为OUT，零为ON，正为IN。内部对角线上的点不因此算边界；它仍要通过第三边判断。

每查询O(log n)，额外空间O(1)，没有角度函数、开方或浮点容差。严格凸且逆时针是射线排序的证书；凹多边形、顺时针顶点、共线冗余顶点或重复首点不能无声套用这份合同。

<a id="convex-location-library"></a>
### 角度顺序中的partition_point

```cpp
Location convex_standard(const std::vector<Point>& p, Point q) {
    if (auto result = fan_boundary(p, q)) return *result;
    // 扇形内射线按角度排列，该谓词是true...true,false...false。
    const auto end = std::partition_point(p.begin() + 1, p.end(), [&](Point v) {
        return cross(p[0], v, q) >= 0;
    });
    const auto side = cross(*std::prev(end), *end, q);
    return side < 0 ? Location::outside : side == 0 ? Location::boundary : Location::inside;
}
```

`partition_point`直接寻找真前缀的结束。前置扇形检查保证返回迭代器既不是首条射线之前，也不是尾后，所以`prev(end)`和`*end`合法。标准设施替换了扇区定位循环，几何证书与边界判断仍由我们负责；时间和空间与手写版相同。

<a id="convex-location-engineering"></a>
ABC296G规定顶点及查询坐标绝对值<=10⁹。差最大2×10⁹，叉积两个乘积之差的粗界8×10¹⁸，在`int64_t`内；Point成员一开始就是64位，减法不在32位里发生。不要改用三个绝对面积求和来制造额外的大中间量。若坐标上限提升，须重新证明数值预算或使用明确标注的更宽运算，见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。

练习：[凸多边形多次点定位](https://atcoder.jp/contests/abc296/tasks/abc296_g)。

<a id="matching-threshold"></a>
## 阈值下的互斥选择与匹配

P4251 从 n×m 完整矩阵选 n 个元素，不同行且不同列，最小化选出数的第 k 大。`1≤k≤n≤m≤250`，元素在 `1..10^9`。若第 k 大≤x，那么大于 x 的最多 k−1 个，等价于**至少 n−k+1 个被选元素≤x**。

把行、列作为二分图两侧，只保留 `A[row][col]≤x` 的低权边。判定变成低权边是否能匹配至少 `need=n−k+1` 对。必要性直接来自任一完整选择中的低权边；充分性还差关键一步：得到 need 条匹配后，剩余行可任意配给未用列，因为原矩阵完整且 m≥n。补出的数可以很大，但低权数的数量不会减少，第 k 大仍≤x。若原图存在禁选格，这个补全论证就不成立。

不能逐行选最小值：不同的行可能争同一列。Kuhn 增广路允许把已匹配的行搬去别的列，为当前行腾位置。每次寻找增广路单独清空 visited；失败只表示当前匹配无法再沿该搜索增广，不是让后续行直接复用旧访问状态。

为何这样足够判定最大匹配？当前匹配与任何更大的匹配作对称差，必出现一条使匹配数增加1的交替路径。逐行加入时，原前缀已是最大匹配；新的一条增广路径只能从新加入的未匹配行开始。完整搜索它的可达改派路径，成功就增1，失败则新前缀仍最大。因此扫描后未达到 need 确实可以拒绝，不是仅仅“某个贪心暂时没找到”。

<a id="matching-threshold-manual"></a>
### 手写：增广路作为阈值判定器

```cpp
// 返回至多 need 条低权边组成的匹配：right_owner[c] = row 或 -1。
std::vector<int> threshold_matching(const std::vector<std::vector<int>>& a,
                                    int limit, int need) {
    const int n = static_cast<int>(a.size()), m = static_cast<int>(a[0].size());
    std::vector<int> right_owner(m, -1);
    int matched = 0;
    for (int row = 0; row < n && matched < need; ++row) {
        std::vector<unsigned char> seen(m, 0);
        auto augment = [&](auto&& self, int r) -> bool {
            for (int c = 0; c < m; ++c) {
                if (a[r][c] > limit || seen[c]) continue;
                seen[c] = 1;
                // 空列或能把原主人搬走，就为当前行腾出这个列。
                if (right_owner[c] == -1 || self(self, right_owner[c])) {
                    right_owner[c] = r;
                    return true;
                }
            }
            return false;
        };
        if (augment(augment, row)) ++matched;
    }
    return right_owner;
}

int matching_size(const std::vector<int>& right_owner) {
    int result = 0;
    for (int r : right_owner) if (r != -1) ++result;
    return result;
}

int matching_threshold_manual(const std::vector<std::vector<int>>& a, int k) {
    int lower = a[0][0], upper = a[0][0];
    for (const auto& row : a) for (int value : row) {
        if (value < lower) lower = value;
        if (value > upper) upper = value;
    }
    const int need = static_cast<int>(a.size()) - k + 1;
    auto feasible = [&](i64 limit) {
        return matching_size(threshold_matching(a, static_cast<int>(limit), need)) >= need;
    };
    return static_cast<int>(first_true(lower, upper, feasible));
}
```

`right_owner` 只保存每列当前主人，递归改派形成增广路。找到 need 条即可停止，不必每轮求出更大的匹配。一次检查的朴素 Kuhn 上界为 `O(n²m)`；直接在原整数值域二分是 `O(n²m log W)`，并非 Hopcroft–Karp 的复杂度。

<a id="matching-threshold-standard"></a>
### 标准设施：离散化候选并补成完整选择

```cpp
struct MatchAnswer {
    int threshold;
    std::vector<int> column; // 每行最终选择哪一列，构成完整 n 条边。
};

MatchAnswer matching_standard(const std::vector<std::vector<int>>& a, int k) {
    std::vector<int> values;
    for (const auto& row : a) values.insert(values.end(), row.begin(), row.end());
    std::sort(values.begin(), values.end());
    values.erase(std::unique(values.begin(), values.end()), values.end());
    const int n = static_cast<int>(a.size()), m = static_cast<int>(a[0].size());
    const int need = n - k + 1;
    auto feasible = [&](i64 index) {
        return matching_size(threshold_matching(a, values[index], need)) >= need;
    };
    const int index = static_cast<int>(first_true(0, values.size() - 1, feasible));
    const auto owners = threshold_matching(a, values[index], need);
    std::vector<int> column(n, -1), free_columns;
    for (int c = 0; c < m; ++c) {
        if (owners[c] == -1) free_columns.push_back(c);
        else column[owners[c]] = c;
    }
    // 原矩阵完整且 m>=n，未配行可任取未用列；低权边数仍至少 need。
    std::size_t next = 0;
    for (int r = 0; r < n; ++r)
        if (column[r] == -1) column[r] = free_columns[next++];
    return {values[index], std::move(column)};
}
```

最优阈值一定取自某个矩阵元素，`sort+unique+erase` 将候选压到至多 nm 个。搜索候选下标，Kuhn 核心仍复用手写版本；完整代价是 `O(nm log(nm)+n²m log(nm))`，存储 `O(nm+n+m)`，递归深度 `O(n)`。这份代码还返回每行所选列，明确兑现了充分性证明中的补全操作。

<a id="matching-threshold-engineering"></a>
### 性能与回调

这里只承诺可理解且有测量的朴素匹配，没有冒充已在 OJ 获得通过；250 阶压力测试的本机结果另有验证记录。更大的图可能需要更强匹配算法，但那是判定器性能升级，不改变阈值建模。<a class="knowledge-link" href="#knowledge-Q100009" data-knowledge="Q100009">递归回调与调用栈</a>解释 `self(self,...)`；这里 visited/owner 借用本次检查状态，不跨不同阈值保留。候选的<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">排序去重</a>和算法证明各负责不同层。

<aside class="knowledge-introduction" id="knowledge-Q100009" data-knowledge-introduction="Q100009"><p class="knowledge-title">递归回调与调用栈</p><p>C++17可用命名函数、成员函数、<code>std::function</code>或显式self参数的泛型lambda表达递归。<code>std::function</code>提供类型擦除，可能引入间接调用和分配；泛型lambda不必先做这种擦除，但所有借用仍须满足 <a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">lambda捕获寿命</a>。</p>
<p><code>auto dfs=[&amp;](auto&amp;&amp; self,int u)-&gt;bool { … self(self,v); … };</code> 的self传入当前闭包，返回类型必要时显式给出。不要把持有局部引用的递归回调保存到局部作用域之外，也不要在修改容器导致重分配后继续用旧引用。</p>
<p>正确递归不代表栈空间足够：n=2×10⁵的链可能有同等深度。对数值域分治深度约log U，与图DFS的线性最坏深度不同，应按实际结构改显式栈/迭代。语言标准没有承诺固定的大递归栈或尾调用消除。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/expr.prim.lambda">lambda</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/func.wrap.func">function</a>。</p>
</aside>


练习：[小凸玩矩阵](https://www.luogu.com.cn/problem/P4251)。重点理解为何是 `n−k+1`，以及为什么低权部分匹配足以补成完整答案。


<a id="fenwick-rank"></a>
## 动态频数中的第k个位置

本节代码中`i64`表示`std::int64_t`，位置从0开始；给定位置频数，支持点增减并找“累计第k个单位”所在的最早位置。它也能表示动态序列：原位置始终不动，存活记1、删除记0，第k个存活元素就是前缀频数首次达到k的位置。元素值本身是否有序完全无关；有序的是**非负频数的累计量**。

普通做法对位置二分，每次向Fenwick问前缀和，代价是log²。树状数组已经保存对齐的二进制块，无须重新从根算每个中点。维护已接受的前缀长度p，其累计量严格小于原始k；k随时表示尚未接受部分的剩余秩。自高位向低位试探下一整块：块内总量小于k才可整块跳过，并扣除其总量。等于k时不能跳，否则越过了首次到达位置。

树用1基位置存块：`tree[t]`保存`(t-lowbit(t),t]`中的频数，其中`lowbit(t)=t&-t`；点加向包含该点的更大块推进，前缀求和则反复减去lowbit，拆成互不重叠的块。

结构内选择的对齐也须明确：试步长step之前，已接受长度accepted是`2*step`的倍数，因此`next=accepted+step`的lowbit恰为step，`tree[next]`覆盖的正是`(accepted,next]`，并不是随意拿一个Fenwick结点当后缀和。拒绝后accepted不变；接受后accepted成为step的倍数。下一轮步长减半，两种情况都重新满足“2倍步长的倍数”。初始accepted=0建立归纳。

例如1基频数`[1,0,2,1,0,3,0,1]`，找第5个单位。step=8时总量8，不能跳；step=4时`tree[4]=4<5`，接受前4位，剩余秩1；step=2时试块(4,6]，量3，拒绝；step=1时试块(4,5]，量0<1，接受前5位，剩余秩仍1。下一位置6正是答案，接口以零基返回5。零频数可以跳过；等于剩余秩时不能跳，否则会越过首次达到的位置。

最终已接受前缀的累计量仍小于原始k，再加一个位置就达到k，故accepted作为零基下标就是答案。允许负增量执行删除，但各位置的实际频数须始终非负；否则前缀量不再非降。

<a id="fenwick-rank-manual"></a>
### 手写结构与删除序列

```cpp
class FrequencyTree {
    int n;
    std::vector<i64> tree;
public:
    explicit FrequencyTree(int count) : n(count), tree(count + 1, 0) {}
    // pos is zero based; actual frequencies must remain nonnegative.
    void add(int pos, i64 delta) {
        for (int p = pos + 1; p <= n; p += p & -p) tree[p] += delta;
    }
    i64 prefix(int end) const { // [0,end)
        i64 answer = 0;
        for (int p = end; p > 0; p -= p & -p) answer += tree[p];
        return answer;
    }
    int kth(i64 k) const {
        if (k <= 0 || k > prefix(n)) return n;
        int accepted = 0;
        int step = 1;
        while (step <= n / 2) step *= 2;
        for (; step != 0; step /= 2) {
            int next = accepted + step;
            // accepted是2*step的倍数，故lowbit(next)=step，
            // tree[next]恰覆盖1基区间(accepted,next]，没有重叠计数。
            if (next <= n && tree[next] < k) {
                accepted = next;
                k -= tree[next]; // rank among the unaccepted suffix
            }
        }
        return accepted; // length of prefix with count < original k = answer index
    }
};

std::vector<i64> remove_by_rank(const std::vector<i64>& values,
                                const std::vector<int>& ranks) {
    FrequencyTree alive(static_cast<int>(values.size()));
    for (int i = 0; i < static_cast<int>(values.size()); ++i) alive.add(i, 1);
    std::vector<i64> answer;
    answer.reserve(ranks.size());
    for (int rank : ranks) { // 1 <= rank <= remaining size
        int position = alive.kth(rank);
        answer.push_back(values[position]);
        alive.add(position, -1);
    }
    return answer;
}
```

`prefix(end)`返回半开前缀；`kth`的k从1开始，位置从0开始，无效k统一返回n，不能解引用这个哨兵。初始化用n次加入，整套删除O(n log n)；单次修改或选择O(log n)，空间O(n)。实际删除值只读原数组，修改的是频数，因此不会引入 `vector::erase` 后位置整体移动的问题。

<a id="fenwick-rank-standard"></a>
### 标准设施：重建累计量的对照

```cpp
int kth_with_prefix(const std::vector<i64>& frequency, i64 k) {
    std::vector<i64> prefix(frequency.size());
    std::partial_sum(frequency.begin(), frequency.end(), prefix.begin());
    if (k <= 0) return static_cast<int>(frequency.size());
    return static_cast<int>(std::lower_bound(prefix.begin(), prefix.end(), k)
                            - prefix.begin());
}
```

`std::partial_sum`生成累计量，`std::lower_bound`定位首次达到k。这里库算法确实能做选择，却每次重建O(n)、额外空间O(n)，不能把它写成动态查询O(log n)。若只有静态频数，累计量建一次后每问O(log n)；若频繁修改，才值得维护Fenwick。二分库的<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">分区与迭代器合同</a>仍然适用：允许任意负频数后累计量可能回落，`lower_bound`和结构内选择都会失去条件。

<a id="fenwick-rank-engineering"></a>
### 当前实现的边界

频数总和要落入64位，不能只看单个delta；这是<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>的当前适用对象。`add`要求合法原位置，示例不把越界当成可恢复业务事件。`remove_by_rank`要求每次rank均有效；n哨兵是查询结果政策，不能代替输入合同。原值数组在调用期间只读借用，结果向量拥有复制出的删除值，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与结果所有权</a>。

练习：[List Removals](https://cses.fi/problemset/task/1749)。输出的是删除值，而非原下标；把下标与存活秩分开才能迁用。


<a id="summary-descent"></a>
## 区间摘要驱动的首次失败位置

数组可修改且不排序，问从s开始第一个 `a[j]≥V` 的位置。不能直接对 `a[mid]≥V` 二分，因为它可能真、假交替。但区间最大值摘要提供另一种证书：一整块的最大值小于V，就能排除这整块；否则内部至少有一个答案，需要向下查。

更一般地，若前缀摘要为 `op(a[s],…,a[r−1])`，谓词f随区间扩展只会由真变假，则可找首次失效边界。最大值小于V就是这一形式；原数组无需有序，摘要沿前缀扩展却单调。本题直接下降到最早满足值的位置，避免外层位置二分反复查询区间最大值的log²。

<a id="summary-descent-manual"></a>
### 手写：排除整块，优先左子树

```cpp
class MaxTree {
    int n, base = 1;
    std::vector<i64> tree;
    int descend(int node, int left, int right, int start, i64 target) const {
        if (right <= start || left >= n || tree[node] < target) return n;
        if (right - left == 1) return left;
        int mid = left + (right - left) / 2;
        int found = descend(node * 2, left, mid, start, target);
        if (found != n) return found; // leftmost eligible leaf has priority
        return descend(node * 2 + 1, mid, right, start, target);
    }
public:
    explicit MaxTree(const std::vector<i64>& values) : n(static_cast<int>(values.size())) {
        while (base < n) base *= 2;
        tree.assign(base * 2, std::numeric_limits<i64>::lowest());
        std::copy(values.begin(), values.end(), tree.begin() + base);
        for (int p = base - 1; p > 0; --p) tree[p] = std::max(tree[2*p], tree[2*p+1]);
    }
    void set(int position, i64 value) {
        int p = base + position;
        tree[p] = value;
        while ((p /= 2) != 0) tree[p] = std::max(tree[2*p], tree[2*p+1]);
    }
    i64 range_max(int left, int right) const { // [left,right)
        i64 answer = std::numeric_limits<i64>::lowest();
        for (left += base, right += base; left < right; left /= 2, right /= 2) {
            if (left & 1) answer = std::max(answer, tree[left++]);
            if (right & 1) answer = std::max(answer, tree[--right]);
        }
        return answer;
    }
    int first_at_least(int start, i64 target) const { // absent => n
        return descend(1, 0, base, start, target);
    }
};
```

早于s的块不参与；摘要不足的块直接舍弃；其余先查左边，发现答案后不再查右边。s只切开一条边界路径，答案所在块只下降一条路径，之前被跳过的是其相邻整块，故查询O(log n)，而不是遍历所有叶子。建树O(n)，点修改O(log n)，空间O(n)。n也用作不存在的位置；补齐到2次幂后的叶子不允许成为答案。

<a id="summary-descent-standard"></a>
### 标准设施与真实结构库

```cpp
int first_at_least_linear(const std::vector<i64>& values, int start, i64 target) {
    auto found = std::find_if(values.begin() + start, values.end(),
                             [target](i64 value) { return value >= target; });
    return static_cast<int>(found - values.begin());
}
```

`std::find_if`给出同一题意的线性基线，最坏扫描n−s个值，没有偷偷建立二分条件。<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">谓词与lambda捕获</a>在这里对应固定target、单个值的判断；它不是线段树查询的替代算法。

[AtCoder Library `segtree::max_right/min_left`](https://atcoder.github.io/ac-library/production/document_en/segtree.html)确实提供结构内边界搜索，**它是外部库而非C++标准库**。本题可用最大值monoid，并令 `f(mx)=mx<V`：`max_right(s,f)`返回最大值仍小于V的最远半开右端，正好是首个答案下标。若无答案则返回n。原题Ai、V非负，取最低整数作幺元可满足 `f(e())=true`；任意改成V等于最低整数时，这个库调用合同就不再满足，不能照抄。库还要求谓词对相同参数稳定、没有副作用。非交换monoid需保持左右聚合顺序，不能随意交换摘要；`min_left`则从右端对称推进。

<a id="summary-descent-engineering"></a>
### 当前实现的边界

这里专门实现max，没有冒称一份通用monoid模板；空区间`range_max`返回最低整数。`set`与起点须合法，改变数组大小需要重建。建树复制输入值，之后修改原数组不会自动改变树，须通过set维护摘要；这对应<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与复制所有权</a>。返回n后再访问数组属于调用方越界，不是算法会自动抛异常。下降递归仅沿对数层高，见<a class="knowledge-link" href="#knowledge-Q100009" data-knowledge="Q100009">递归与调用栈</a>；结点和摘要的<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">类型范围</a>仍按本题上界选择。

练习：[AtCoder practice2 J — Segment Tree](https://atcoder.jp/contests/practice2/tasks/practice2_j)。它还包含点赋值、区间最大值；原题用1基且无解输出N+1，需在入口出口转换。


<a id="ancestor-boundary"></a>
## 祖先会合边界与同步提升

树上两点的最近公共祖先LCA，是它们向根上行后第一次会合的位置。倍增表 `up[b][v]`保存v的2^b级祖先，复合规则是先走2^(b−1)，再走同样距离。**这张表的建立只是函数复合；给定k精确跳跃本身并不搜索边界。**

先把两点提到等深。若相同，答案已经得到；否则同时向上：只在两个2^b祖先仍不同的时候接受这一跳。等深树路径一旦会合便永远相同，所以“尚未会合”沿上行距离构成一个前缀。被接受的跳不会到达或越过LCA；自高位向低位消去距离后，两点恰在LCA下方，父结点就是答案。它与逐层向上相比，利用的正是可跳过整段的证书。

<a id="ancestor-boundary-manual"></a>
### 手写：等深与尚未会合

```cpp
class Ancestors {
    std::vector<std::vector<int>> up;
    std::vector<int> depth;
public:
    // Nonempty rooted tree: parent[0]=0, and parent[v]<v for v>0.
    explicit Ancestors(const std::vector<int>& parent) : depth(parent.size(), 0) {
        int levels = 1, n = static_cast<int>(parent.size());
        while ((i64{1} << levels) <= n) ++levels;
        up.assign(levels, std::vector<int>(n));
        up[0] = parent;
        for (int v = 1; v < n; ++v) depth[v] = depth[parent[v]] + 1;
        for (int b = 1; b < levels; ++b)
            for (int v = 0; v < n; ++v) up[b][v] = up[b-1][up[b-1][v]];
    }
    int kth(int v, i64 steps) const {
        if (steps < 0 || steps > depth[v]) return -1;
        for (int b = 0; steps != 0; ++b, steps >>= 1)
            if (steps & 1) v = up[b][v];
        return v;
    }
    int lca(int a, int b) const {
        if (depth[a] < depth[b]) std::swap(a, b);
        a = kth(a, depth[a] - depth[b]);
        if (a == b) return a;
        for (int power = static_cast<int>(up.size()) - 1; power >= 0; --power)
            if (up[power][a] != up[power][b]) {
                a = up[power][a]; b = up[power][b];
            } // accept a jump only while the two ancestors remain distinct
        return up[0][a];
    }
};
```

此版适配CSES公司编号合同：根为0，`parent[0]=0`，其余 `parent[v]<v`，故可按编号先算深度；一般乱序编号须先遍历建立深度，不能只换输入照用。预处理O(n log n)、每次LCA或kth O(log n)、空间O(n log n)。根自指仅用作表中安全哨兵；`kth`先核实际深度，仍正确返回不存在的−1，不能让根自指伪造多级上司。

<a id="ancestor-boundary-standard"></a>
### 标准设施：祖先链交集与有序当前路径

```cpp
int lca_with_find(const std::vector<int>& parent, int a, int b) {
    std::vector<int> chain;
    for (int v = a;; v = parent[v]) {
        chain.push_back(v);
        if (v == parent[v]) break;
    }
    for (int v = b;; v = parent[v]) {
        if (std::find(chain.begin(), chain.end(), v) != chain.end()) return v;
        if (v == parent[v]) return -1;
    }
}
```

标准库没有LCA。这个对照先保存a的祖先链，再从b向上用 `std::find`查第一次交集；正确但最坏O(h_a h_b)、空间O(h_a)，不符合大量查询的效率要求。库替代的是链上查找，不能写成“std版LCA对数复杂度”。

另一种树上边界来自额外值序：若父权不大于子权，根到当前结点的路径权值非降，可找值≥阈值的**最浅祖先**。此时根侧下界位置才有意义，任意权值树不能这么做。

```cpp
// weights[parent[v]] <= weights[v]. Query = {node, threshold}.
// Answer is the shallowest qualifying ancestor, or -1.
std::vector<int> threshold_ancestor_queries(
        const std::vector<int>& parent, const std::vector<i64>& weights,
        const std::vector<std::pair<int, i64>>& queries) {
    int n = static_cast<int>(parent.size());
    std::vector<std::vector<int>> children(n);
    for (int v = 1; v < n; ++v) children[parent[v]].push_back(v);
    std::vector<std::vector<std::pair<i64,int>>> at(n);
    for (int id = 0; id < static_cast<int>(queries.size()); ++id)
        at[queries[id].first].push_back({queries[id].second, id});
    std::vector<int> answer(queries.size(), -1), path_nodes;
    std::vector<i64> path_weights;
    std::vector<std::pair<int,bool>> stack{{0,false}};
    while (!stack.empty()) {
        auto event = stack.back(); stack.pop_back();
        int v = event.first;
        if (event.second) { path_nodes.pop_back(); path_weights.pop_back(); continue; }
        path_nodes.push_back(v); path_weights.push_back(weights[v]);
        for (auto query : at[v]) {
            auto it = std::lower_bound(path_weights.begin(), path_weights.end(), query.first);
            if (it != path_weights.end()) answer[query.second] = path_nodes[it-path_weights.begin()];
        }
        stack.push_back({v,true}); // leave event restores the parent's current path
        for (auto it = children[v].rbegin(); it != children[v].rend(); ++it)
            stack.push_back({*it,false});
    }
    return answer;
}
```

进/出事件维护当前路径，离开子树后恢复，避免把上一个兄弟分支混入；查询按结点事先分组，用 `std::lower_bound`查当前有序路径。重复权值取首次，仍得到最浅祖先。构造与事件遍历O(n)，q次查询O(q log n)，总空间O(n+q)。这不是把LCA换成库函数，而是**不同有序证书下的祖先查询**。显式栈使长链不依赖递归调用栈容量。

<a id="ancestor-boundary-engineering"></a>
### 当前实现的边界

所有结点编号零基、树非空且同根；查询结点须合法。只有同深同步上行才可用“相同后不再分开”的证明。函数图的精确k跳即使有环也能倍增，但沿跳跃步数默认没有阈值单调性，不能直接冒充本节搜索。迁用于Planets时，表层数按最大k而非n确定，也不能沿用树祖先接口按depth拒绝超深跳跃的政策。提升表的<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">移位与整数范围</a>须另按最大步数预算；路径查询把边界迭代器立即转换成下标，不把它保留到下一次push/pop，见<a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">vector修改与失效</a>。原树和权值在调用期只读借用，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与生命周期</a>；显式事件栈与<a class="knowledge-link" href="#knowledge-Q100009" data-knowledge="Q100009">调用栈边界</a>则区分了两种遍历资源。

练习：[Company Queries II](https://cses.fi/problemset/task/1688/)、[Company Queries I](https://cses.fi/problemset/task/1687)、[Planets Queries I](https://cses.fi/problemset/task/1750)、[Cyclic Array](https://cses.fi/problemset/task/1191)。Company I核对不存在祖先，Planets核对有环精确复合；Cyclic的边界提升在下一节展开，不表示四题有同一种二分谓词。


<a id="cyclic-jump"></a>
## 循环正数序列的最少分段

环上每个值为正，单项不超过容量C，求每段和≤C的最少连续段数。固定切点后，优先把当前段向右延伸到最远合法位置。要比较多段，不能只说“第一段更长”：设F(i)为从i出发的最远合法半开终点。由于值全为正，起点右移只删掉前段元素，原来合法的终点仍合法，所以F(i)非降。若贪心的第j段终点g_j不早于另一方案p_j，则`g_(j+1)=F(g_j)>=F(p_j)>=p_(j+1)`；初始切点相同，归纳得同样段数贪心覆盖始终领先。因此它达到目标所需段数最少；最后比较全部切点。

将环虚拟复制成长度2n，令next[i]为从i出发最远合法段的半开终点。正数使滑窗右端不退，O(n)建立next；再预存其2^b次复合。对每个起点s，寻找仍未覆盖到s+n的最多完整跳数，再加最后一段。这里搜索证书是**跳后位置严格小于目标**，不是对元素大小二分。

<a id="cyclic-jump-manual"></a>
### 手写：最远段与尚未覆盖的跳跃

先给出共享的跳跃核心：它只接收已合法构造的next表，在所有切点上定位“尚未覆盖”的最多段数。

```cpp
int cyclic_min_from_successors(const std::vector<int>& next, int n) {
    int end = 2 * n, levels = 1;
    while ((i64{1} << levels) <= n) ++levels;
    std::vector<std::vector<int>> jump(levels, std::vector<int>(end + 1));
    jump[0] = next;
    for (int b = 1; b < levels; ++b)
        for (int i = 0; i <= end; ++i) jump[b][i] = jump[b-1][jump[b-1][i]];
    int answer = n;
    for (int start = 0; start < n; ++start) {
        int position = start, used = 0, target = start + n;
        for (int b = levels - 1; b >= 0; --b)
            if (jump[b][position] < target) { // remain strictly short of full coverage
                position = jump[b][position]; used += 1 << b;
            }
        answer = std::min(answer, used + 1); // one final segment reaches target
    }
    return answer;
}
```

再用滑窗建立next：窗口保存`[left,right)`，正数保证右端只前进；记录最远终点后删去左端，供下一个起点复用。

```cpp
int min_cyclic_parts(const std::vector<i64>& values, i64 capacity) {
    int n = static_cast<int>(values.size()), end = 2*n, right = 0;
    std::vector<int> next(end + 1, end);
    i64 sum = 0;
    for (int left = 0; left < end; ++left) {
        while (right < end && values[right % n] <= capacity - sum) {
            sum += values[right % n]; ++right;
        }
        next[left] = right; // [left,right) is the farthest legal greedy segment
        sum -= values[left % n]; // positive values <=capacity ensure right>left
    }
    return cyclic_min_from_successors(next, n);
}
```

最终一段可在目标处截短，正数保证截短后仍合法。判断必须是 `<target`：把恰好达到目标的一跳提前接受、末尾又加1会多算。next在2n处自指，所有查表下标有界；合法单项使每个真正起点都严格前进，避免原地停滞。预处理与枚举所有切点O(n log n)，空间O(n log n)。n=2×10^5时这份int跳表约29MB，而非O(n)空间。

<a id="cyclic-jump-standard"></a>
### 标准设施：前缀和上的最远合法右端

```cpp
int min_cyclic_parts_with_bounds(const std::vector<i64>& values, i64 capacity) {
    int n = static_cast<int>(values.size()), end = 2*n;
    std::vector<i64> prefix(end + 1, 0);
    for (int i = 0; i < end; ++i) prefix[i+1] = prefix[i] + values[i % n];
    std::vector<int> next(end + 1, end);
    for (int i = 0; i < end; ++i)
        next[i] = static_cast<int>(std::upper_bound(prefix.begin()+i+1, prefix.end(),
                                                   prefix[i] + capacity) - prefix.begin()) - 1;
    return cyclic_min_from_successors(next, n);
}
```

另一种建立next的方法利用正数前缀和非降，对 `prefix[i]+C`调用 `std::upper_bound`，减一得到最后可行的半开终点。它与滑窗复用**同一提升核心**，没有重复写一份完整跳表。next构造从O(n)变O(n log n)，总体仍由O(n log n)界定。使用upper而非lower是因为段和恰好等于容量仍合法。

<a id="cyclic-jump-engineering"></a>
### 当前实现的边界

合同是非空、所有值正且≤C；若加入负数，贪心最远段和前缀次序都可能失效；若有单项超过C，滑窗的严格前进不成立，应先判无解。本原题保证不发生后一情况。Ai≤10^9、2n≤4×10^5，前缀和≤4×10^14，C≤10^18，标准版本的 `prefix[i]+C`仍在64位范围；滑窗用 `value≤C−sum`避免不必要加法。范围预算详见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。两版都借用原数组，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数</a>。

练习：[Cyclic Array](https://cses.fi/problemset/task/1191)。切点不是给定，不能只对原数组从0贪心一次。


<a id="time-parallel-search"></a>
## 共享时间轴判定的并行二分

从空图开始，每天增加一条无向边，很多查询问两点最早何时连通。边只增不删，所以每问的连通性对时间非降；但为每个mid单独重建所有前缀边，会把昂贵状态重复建立q次。

状态用并查集维护：每个连通块由代表元标识，`find`沿父结点找代表并压缩路径，`unite`把较小块接到较大块；两点代表相同当且仅当已加入边使它们连通。它只增量合并，不能直接撤销删边。

并行二分不是创建线程。每个查询仍维护自己的真假边界，只把一轮的mid分组；DSU从空图重放一次全部事件，走到哪一天，就回答该天所有mid。所有查询共享事件前缀构造的成本。没有要求“连通性是每条边贡献之和”，能增量维护即可。

<a id="time-parallel-search-manual"></a>
### 手写：分组mid，一轮共享一条扫描线

先建立这一轮使用的DSU。`iota`初始化每点自成一块，`swap`统一按规模合并的方向；结构规则由我们实现。

```cpp
class DisjointSet {
    std::vector<int> parent, size;
public:
    explicit DisjointSet(int n) : parent(n), size(n,1) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        while (x != parent[x]) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) std::swap(a,b);
        parent[b] = a; size[a] += size[b];
    }
};
```

再把每问的中点放进对应日期桶，扫描到那天时统一回答：

```cpp
std::vector<int> first_connection_days(int n, const std::vector<std::pair<int,int>>& edges,
                                      const std::vector<std::pair<int,int>>& queries) {
    int m = static_cast<int>(edges.size()), q = static_cast<int>(queries.size());
    std::vector<int> low(q,-1), high(q,m+1);
    for (;;) {
        std::vector<std::vector<int>> bucket(m+1);
        bool pending = false;
        for (int id = 0; id < q; ++id) if (high[id] - low[id] > 1) {
            pending = true;
            bucket[low[id] + (high[id]-low[id])/2].push_back(id);
        }
        if (!pending) break;
        DisjointSet state(n); // no attempt to undo path compression
        for (int day = 0; day <= m; ++day) {
            if (day > 0) state.unite(edges[day-1].first, edges[day-1].second);
            for (int id : bucket[day]) {
                auto query = queries[id];
                if (state.find(query.first) == state.find(query.second)) high[id] = day;
                else low[id] = day;
            }
        }
    }
    for (int& day : high) if (day == m+1) day = -1;
    return high;
}
```

每问以−1为虚拟假日、m+1为虚拟真哨兵；真实可探查日是0..m。第0天没有道路，同点应直接判真；某问始终不连通时最后落到m+1，输出−1。每次判定时状态严格包含前day条边，回答之后只改变该查询边界，不改变图状态。区间逐轮缩半，得到首次真日。

<a id="time-parallel-search-standard"></a>
### 标准设施的职责与共享扫描的代价

标准库没有DSU或并行二分。这里 `std::vector`承担查询桶和父数组，`std::iota`建立0..n−1的父结点，`std::swap`支撑按规模合并；并查集的路径压缩和合并规则仍然手写。正文两个代码块组成同一实现，不是两份重复算法。

例如道路依次是`(0,1),(1,2),(2,3)`，查询A=(0,2)、B=(0,3)，初始各自`low=-1,high=4`。第一轮两问mid=1，共同检查只有第一条边的状态，均假，于是low=1；第二轮两问mid=2，加入第二条边后A真、B假，分别改为`high_A=2,low_B=2`。A边界相邻已结束，B再问day=3得到真。答案为2、3；每轮扫描一条时间线，并没有为A、B各重建一次前缀。若额外查询(2,2)，它最终继续缩到day=0，空图时自己与自己已连通。

每轮新建DSU而不尝试撤销路径压缩。若想改成递归回滚，必须另建可回滚并查集并分析复杂度，不能把当前 `find`加入撤销列表就宣称成立。一轮成本为O(n+(m+q)α(n))，O(log(m+2))轮；空间O(n+m+q)。重置n个父结点的成本也算在内；m=0仍会核第0天，故轮数界保留常数项。

<a id="time-parallel-search-engineering"></a>
### 当前实现的边界

路径压缩只在一轮内部有效；桶每轮新建，不能残留上一轮查询。重复边和自环不影响正确性，不连通无需报异常。若加入删边，谓词可能真假反复，当前时间轴二分失效，不能仅替换一种DSU蒙混。`low=-1`而mid非负依赖此处的哨兵范围，通用极大整数域应重新核<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">差值与中点预算</a>；<a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">vector扩容与引用失效</a>须避免扩容后复用失效引用。

练习：[New Roads Queries](https://cses.fi/problemset/task/2101)。这是一套多问共享状态算法；只有一个钉木板前缀查询时，不必为术语而引入它。


<a id="dynamic-range-kth"></a>
## 带修改区间第k小的整体二分

序列支持位置赋新值，并问当前闭区间第k小，按重复出现次数计数。对数值阈值v，“区间中≤v的元素至少k个”仍单调；但查询发生在不同时间，不能把未来赋值提前用上，也不能沿时间二分，因为一次赋值可使第k小向任意方向移动。

将每个初值作为插入；赋值拆成删除当时旧值与插入新值。所有事件按原时间排列。对一个答案值域 `[lo,hi]`，顺序扫描本结点事件，只把值≤mid的更新加入位置Fenwick。读到查询时，统计其区间左半值域数量c：k≤c则进左边，否则进右边并将k改成k−c。这个k是**当前剩余值域中的秩**，不再始终是最初k。

更新按自身值进入对应子问题；查询按判定进入子问题。各子序列必须稳定保留原时间顺序。递归前逆序撤销本结点所有实际更新，使两个孩子都从空统计状态开始；逆序重放还依次恢复真实的较早状态，避免撤销途中先减掉已被后续删除抵消的初始项。这样每次查询看到的恰是此前发生、且属于当前左半值域的有效出现数。删除的负贡献合法，因为当前多重集计数始终非负；它与允许任意负频数的秩选择不同。

<a id="dynamic-range-kth-manual"></a>
### 手写：事件、剩余秩与回滚

`RangeOperation`保存原始赋值/查询，`RankEvent`保存标准化后的时间事件：更新的delta表示±1，查询的rank表示当前剩余秩。两者独立存储，以免把增删数量与查询秩混淆；left/right是位置轴，value是压缩后的值轴。

```cpp
struct RangeOperation {
    enum class Kind { assign, query } kind;
    int left, right, k; // query uses inclusive [left,right]; assign uses left only
    i64 value;        // new value for assign
};
struct RankEvent {
    bool query;
    int left, right; // update uses left as position; query uses inclusive [left,right]
    int rank;        // query only: rank within the current candidate value interval
    int delta;       // update only: +1 insert, -1 delete
    int id, value;   // query output index; update compressed value
};
```

求解前先收集初值和所有未来赋值，排序去重形成值域；`value_rank`再用`lower_bound`把真实值映到该表下标。压缩只改变值的名称，重复元素的出现次数仍由点加保留。这两个辅助函数完成压缩表的建立与值到下标的映射：

```cpp
std::vector<i64> compressed_values(const std::vector<i64>& initial,
                                    const std::vector<RangeOperation>& operations) {
    std::vector<i64> values = initial;
    for (const auto& op : operations)
        if (op.kind == RangeOperation::Kind::assign) values.push_back(op.value);
    std::sort(values.begin(), values.end());
    values.erase(std::unique(values.begin(), values.end()), values.end());
    return values;
}
int value_rank(const std::vector<i64>& values, i64 value) {
    return static_cast<int>(std::lower_bound(values.begin(), values.end(), value)-values.begin());
}
```

```cpp
std::vector<i64> dynamic_range_kth(const std::vector<i64>& initial,
                                   const std::vector<RangeOperation>& operations) {
    const auto values = compressed_values(initial, operations);
    std::vector<i64> current = initial;
    std::vector<RankEvent> events;
    for (int i = 0; i < static_cast<int>(initial.size()); ++i)
        events.push_back({false,i,i,0,1,-1,value_rank(values,initial[i])});
    int queries = 0;
    for (const auto& op : operations) {
        if (op.kind == RangeOperation::Kind::assign) {
            if (current[op.left] == op.value) continue;
            events.push_back({false,op.left,op.left,0,-1,-1,value_rank(values,current[op.left])});
            events.push_back({false,op.left,op.left,0,1,-1,value_rank(values,op.value)});
            current[op.left] = op.value; // the next assignment must delete this value
        } else events.push_back({true,op.left,op.right,op.k,0,queries++,0});
    }
    std::vector<i64> answer(queries);
    if (queries == 0) return answer;
    std::vector<RankEvent> scratch(events.size());
    std::vector<unsigned char> goes_left(events.size());
    FrequencyTree count(static_cast<int>(initial.size()));
    std::function<void(int,int,int,int)> solve = [&](int lo, int hi, int begin, int end) {
        if (begin == end) return;
        if (lo == hi) {
            for (int i = begin; i < end; ++i)
                if (events[i].query) answer[events[i].id] = values[lo];
            return;
        }
        int mid = lo + (hi-lo)/2, left_count = 0;
        for (int i = begin; i < end; ++i) {
            auto& event = events[i];
            bool left;
            if (!event.query) {
                left = event.value <= mid;
                if (left) count.add(event.left,event.delta);
            } else {
                i64 smaller = count.prefix(event.right+1)-count.prefix(event.left);
                left = event.rank <= smaller;
                if (!left) event.rank -= static_cast<int>(smaller); // residual rank
            }
            goes_left[i] = static_cast<unsigned char>(left);
            left_count += left;
        }
        // Reverse replay restores actual earlier states, including nonnegative frequencies.
        // No query from either child is allowed before this node is fully undone.
        for (int i = end-1; i >= begin; --i)
            if (!events[i].query && goes_left[i]) count.add(events[i].left,-events[i].delta);
        int l = begin, r = begin+left_count;
        for (int i = begin; i < end; ++i)
            scratch[goes_left[i] ? l++ : r++] = events[i]; // stable in each child
        std::copy(scratch.begin()+begin,scratch.begin()+end,events.begin()+begin);
        solve(lo,mid,begin,begin+left_count);
        solve(mid+1,hi,begin+left_count,end);
    };
    solve(0,static_cast<int>(values.size())-1,0,static_cast<int>(events.size()));
    return answer;
}
```

位置从0开始，查询区间闭合，k从1开始。`current`必须在每次赋值后更新，否则下一次会删除更早的值；同值赋值可直接忽略。`id`让答案回到查询原顺序，不能按递归处理顺序输出。`goes_left`与scratch的写入顺序实现稳定分流；两个孩子开始前Fenwick均为0，没有每个结点全量O(n)清空。

叶子意味着答案值已经唯一，直接映回原值。重复值压到同一个坐标，仍通过出现次数参与秩；0、负数及极大数只是排序对象，不需要拿原值做算术。令赋值数为A、查询数为Q，事件上界E=n+2A+Q，不同值数为U。收集并排序初值和所有新值需O((n+A) log(n+A+1))，递归需O(E log(U+1) log(n+1))，总成本要相加，不能因大量同值赋值令U=1便忽略压缩扫描。空间O(E+n+U+log(U+1))，其中E取上述上界，已包含收集全部赋值的存储。递归深度是值域log U而不是原序列n；共享缓冲区避免为每个递归结点保留整份事件副本。

<a id="dynamic-range-kth-standard"></a>
### 标准设施与一次事件分流的追踪

以初值`[4,1,3]`为例：先问全区间第2小Q1，再把位置1赋为5，再问全区间第2小Q2。压缩表为`[1,3,4,5]`，顶层左半阈值是3。顺序扫描时，初始1与3各贡献+1，所以Q1看到c=2，进入左半、rank仍2；随后删除旧1贡献-1，新5不在左半，Q2看到c=1，进入右半并把rank改成1。回滚后，左子问题在`[1,3]`内求Q1的第2小得到3；右子问题在`[4,5]`内求Q2的第1小得到4。把赋值提前、分流后打乱事件，或右转后仍保留原秩2，都会得到错误结果。

`sort/unique/erase`得到不同值，`lower_bound`取得秩。压缩必须包括**所有未来新值**，仅压缩初值会让修改落到不存在坐标。`unique`并不缩容器长度，所以须erase尾段；其后的元素位置变化不影响这里按值重新取秩的设计。库承担压缩和范围复制，稳定时间流、右侧剩余秩与回滚仍由算法负责；不能把 `stable_partition`一换就说完成了动态第k小。

<a id="dynamic-range-kth-engineering"></a>
### 当前实现的边界

每次查询保证 `1≤k≤r−l+1`，赋值位置合法，原序列非空；这一实现不定义非法秩的业务返回。离线读取全部操作是成立条件；若后续输入依赖上一答案或必须立即响应，应选择真正在线的数据结构，不能继续声称离线可用。静态时没有赋值事件，可使用同一实现，但专门的静态结构还可能更快。

此处复用频数树的点加/前缀接口，没有调用其kth；Fenwick作用于**位置轴**，值域在外层递归。这两个轴要分开。关键C++支撑为<a class="knowledge-link" href="#knowledge-Q100012" data-knowledge="Q100012">稳定事件顺序与分流</a>、<a class="knowledge-link" href="#knowledge-Q100009" data-knowledge="Q100009">递归回调与调用栈</a>、<a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">共享缓冲区与vector失效</a>、<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">压缩表的边界定位</a>。捕获的events等容器存活到递归结束，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与生命周期</a>；扫描中不向events追加，避免保存的元素引用因向量重分配失效。

<aside class="knowledge-introduction" id="knowledge-Q100012" data-knowledge-introduction="Q100012"><p class="knowledge-title">稳定事件顺序与分流</p><p><code>partition</code>只保证满足谓词者排在前，不保证各组内部原相对顺序；<code>stable_partition</code>保留每组内部相对顺序。另建左右vector并按原扫描顺序push_back也会稳定分流，但需要额外存储。</p>
<p>带修改查询中，稳定性有业务含义：查询前的更新仍应在查询前，未来更新仍在其后。按值域分组并不授权打乱时间；不能把所有修改先处理完，再统一答查询。需要分流的类别也应先计算清楚，别用会随重排改变结果的有状态谓词。</p>
<p>标准stable_partition的内存与移动代价依条件变化，不一律保证“无额外空间且线性”；手动双缓冲则可明确保存空间和顺序。每轮新建vector会分配，已知事件规模可reserve，但仍不能违反 <a class="knowledge-link" href="#knowledge-Q100013" data-knowledge="Q100013">vector元素与失效规则</a>。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.partitions">C++17 分区算法</a>。</p>
</aside>


练习：[静态区间第k小](https://www.luogu.com.cn/problem/P3834)、[Dynamic Rankings](https://www.luogu.com.cn/problem/P2617)。前者题名虽指向可持久化树，并不禁止其他正确算法；后者才核验真实赋值时序。


<a id="marginal-penalty"></a>
## 递减边际资源分配的惩罚参数搜索

N个设施初始收益Ai，每使用一次先获得当前收益再减1，最多K次，最大总收益是多少？Ai和K可到2×10^9，N可到10^5。逐次取当前最大收益的堆贪心是正确的，但K次操作可能太多。

每个设施的正收益为Ai、Ai−1、…、1。只要选了其中一个较后的值，前面更高的值一定应先选；因此把所有边际合并取最大若干项，仍构成真实可行的各设施前缀。这一**递减边际**证明不能省：若某设施前两次收益是1、100，K=1并不能跳过1直接拿100。

令T=ΣAi、K′=min(K,T)，忽略0和负收益不损失“至多K”的最优值。设 `C_ge(v)=Σmax(Ai−v+1,0)`，找最大h满足 `C_ge(h)≥K′`。h是第K′大收益；令 `ci=max(Ai−h,0)`、S=Σci、E为Ai≥h的设施数，则

`S=C_ge(h+1)<K′≤C_ge(h)=S+E`。

严格大于h者全取，剩余K′−S个从等于h的边际中补。大量同值时不能全部取，也不能全部不取。例如Ai=[5,5]、K=3：先取两个5，再取一个4，答案14。

### 参数不是答案：惩罚与精确恢复

用ti表示设施i取多少次正收益，其效用为 `Ui(ti)=ti(2Ai−ti+1)/2`。取消总数量限制，对每次操作扣λ，解

`H(λ)=max Σ[Ui(ti)−λti]`，其中 `0≤ti≤Ai`。

λ≥0为整数，净边际仍递减。正净边际必取，零净边际可取可不取。在最终λ=h≥1时，最少取S次、最多S+E次，每个中间整数数量都可由零净边际补足；这些方案惩罚后同值，而且

`H(h)=Σci(ci+1)/2`，`原答案=H(h)+hK′`。

这说明为何可以把数量维度换成一维惩罚搜索，并精确还原原约束最优值；不只是“猜一个价格再乘回来”。λ=0时正收益域已截断到ti≤Ai，最优计数是T；不要把h≥1的同值数量公式生搬到λ=0，额外制造N次0收益操作。

<a id="marginal-penalty-manual"></a>
### 手写：只搜索计数，最终恢复惩罚价值

```cpp
struct MarginalResult {
    i64 value, cutoff, strict_count, equal_count, used_count, penalized_value;
};
MarginalResult maximize_fun(const std::vector<i64>& initial, i64 budget) {
    i64 total = 0, maximum = 0;
    for (i64 value : initial) { total += value; maximum = std::max(maximum,value); }
    i64 used = std::min(budget,total);
    if (used == 0) return {0,0,0,0,0,0};
    auto enough = [&](i64 threshold) {
        i64 count = 0;
        for (i64 value : initial) {
            count += std::max<i64>(0,value-threshold+1);
            if (count >= used) return true; // count only, never total all rewards here
        }
        return false;
    };
    i64 low = 1, high = maximum+1;
    while (high-low > 1) {
        i64 mid = low+(high-low)/2;
        if (enough(mid)) low = mid;
        else high = mid;
    }
    i64 strict = 0, equal = 0, penalized = 0;
    for (i64 value : initial) {
        i64 count = std::max<i64>(0,value-low);
        strict += count;
        equal += value >= low;
        penalized += count*(count+1)/2; // safe at final cutoff, not at arbitrary lambda
    }
    return {penalized+low*used,low,strict,equal,used,penalized};
}
```

函数返回原值、阈值、严格数量、同值数量、实际使用量和惩罚值，便于对照上面的等式。用1为已知真、maxAi+1为已知假，搜索最大真；二分中只数数量，最终才算H(h)。时间O(N log maxAi)，额外空间O(1)，不物化巨大的边际集合。

<a id="marginal-penalty-standard"></a>
### 标准设施：同题堆贪心对照

```cpp
i64 fun_with_priority_queue(const std::vector<i64>& initial, i64 budget) {
    std::priority_queue<i64> available(initial.begin(),initial.end());
    i64 answer = 0;
    while (budget-- > 0 && !available.empty() && available.top() > 0) {
        i64 value = available.top(); available.pop();
        answer += value;
        available.push(value-1);
    }
    return answer;
}
```

`std::priority_queue`维护各设施当前最高边际；每次取最大再放回减1后的值。它是**同题另一算法**，并不是“WQS的std版”。堆建好后最多min(K,T)次操作，O(N+min(K,T)log N)、空间O(N)。这里堆复制并拥有收益值，不是对原数组的动态视图，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用与容器所有权</a>。这适合小K或核对，原题最坏预算下不合算。两种解法共用递减边际的正确性，却用不同方式消除巨大重复工作。

### 数量单调仍不足以保证任意问题精确恢复

一般最小化问题写作 `G(λ)=min_k(F(k)+λk)`，最优数量随惩罚增加非增，但它可能跳过目标数量。反例F(0)=0、F(1)=1、F(2)=0：任何惩罚都不会让数量1独立最优，搜到分界也不能把其真实值1恢复成0。相反，F=(4,2,0)在λ=2共线，固定同值政策可能只返回0或2，目标1仍能由 `G(2)−2×1=2`恢复。

所以WQS/拉格朗日类应用必须另证离散凸/凹价值或其他无间隙条件，并处理同值最优的计数范围。这里的可分离递减边际给出了直接证明；一般DP还须建立自己的状态与高效惩罚oracle。[IOI2016 Aliens官方解答](https://ioinformatics.org/files/ioi2016solutions.pdf)满分方案另需区间预处理、交叠成本和CHT，其末页列出的凸性定理也不能当成通用模板证明。本章展示一维参数机制，不冒称已教完整Aliens或高维对偶优化。

<a id="marginal-penalty-engineering"></a>
### 当前实现的边界

原题中T≤2×10^14，最终答案≤K×maxAi≤4×10^18，64位有符号整数够用。但**任意参数下的完整H(λ)未必够**：N=10^5、Ai=2×10^9时，H(0)约2×10^23，即使K=1的最终答案仅2×10^9。因此代码在二分过程中只计数，最终h处才求惩罚值；此时S<K′≤2×10^9，ci乘积、H(h)及恢复总值都在64位预算内。不能把“答案fits”误当所有中间式都fits，见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。

参数合同为正Ai、非负预算且不超过原题预算上界；代码额外允许预算0返回0。`low+(high−low)/2`、乘法和求和均已在64位运算；K>T时通过K′封顶，不能继续强制领取负收益。谓词捕获当前used、initial只读，见<a class="knowledge-link" href="#knowledge-Q100003" data-knowledge="Q100003">判定器与lambda捕获</a>。

练习：[ABC216E — Amusement Park](https://atcoder.jp/contests/abc216/tasks/abc216_e)。重点核验同值补足与至多次数，而不只是while循环。
