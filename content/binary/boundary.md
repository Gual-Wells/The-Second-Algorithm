# 二分：边界与结构

<a id="prelude"></a>
## 先确定能排除什么，再决定怎样对半

二分的核心不是“有序数组取中点”，而是：**在一个有界候选域内，每次取得足以排除一部分候选的证据，使剩余域仍包含所需答案。** 对半让次数成为对数；真正困难的是排除为何安全、答案究竟是什么，以及一次取得证据有多贵。

先分清三类证书，它们不能靠一个“单调性”统称。

| 证书 | 每次保留什么 | 典型问题 |
|---|---|---|
| 有序分区 | 真值序列的一次转换，或比较序中的边界 | 首次>=、前驱、最小可行容量、计数反求第k |
| 结构与存在性 | 剩余区域中至少有一个目标；不必是同一个目标 | 任意局部峰、旋转序列、欠满值域、凸扇区 |
| 连续异号夹逼 | 两端之间至少有某个零点 | 连续方程求根；函数本身不必单调 |

例如，`check(x)`随x增大从假变真，只能说明它有一个可搜索的边界；还要证明`check(x)`正确表达了原问题。用错误的贪心去判定，外层再标准也没有意义。反过来，峰值问题的斜率可以反复正负变化，却仍能用存在性证书二分。连续函数异号保证有根，单调跳跃函数则可能根本没有零点。

最稳的离散骨架是明确一条区间合同。寻找首次满足时，可用未分类半开区间`[lo,hi)`：`[0,lo)`均不满足、`[hi,n)`均满足；`n`同时充当“全不满足”的边界，不必解引用。判断中点不满足后令`lo=mid+1`，满足则令`hi=mid`。循环结束只剩边界，不需要额外猜测最后访问过的元素。求最后满足值也可以反转谓词，或使用向上取整的中点；若仍令`lo=mid`，下中点可能在相邻整数间永远不动。

每一种具体题型都应回答四件事：**候选域含什么；证书排除了哪边；更新后证书为何仍成立；域如何严格缩小。** 空域、全真、全假、重复值、未找到和返回位置的政策属于问题定义，不是写完模板后再补的边角。

成本也要展开。答案域宽度W、一次判定代价C时，通常是`预处理 + O(C log W)`；对有n个对象的库查找，`O(log n)`首先指比较次数。若比较长字符串，一次比较还要读字符；若迭代器不支持随机访问，走到中点本身可能需要线性总步进。浮点数也不是无限细的实数，误差目标、迭代上限和“中点已等于端点”的停止条件必须分开。相关实现合同见<a class="knowledge-link" href="#knowledge-Q100001" data-knowledge="Q100001">二分库的分区与迭代器合同</a>、<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>与<a class="knowledge-link" href="#knowledge-Q100006" data-knowledge="Q100006">浮点夹逼与误差</a>。

这一章沿同一思想展开到有序/结构搜索、优化转判定、隐式集合的秩、DP有序状态、数据结构下降、倍增、批量搜索和惩罚参数。它们共享消除候选的思考方式，不共享一个无条件正确的`check`。本篇先建立显式边界与结构证书，后续复杂题型在此基础上改变搜索对象和判定器。

<a id="ordered-boundaries"></a>
## 有序数据的边界、计数与前驱

给非降数组a与键key，定义L为首次`a[i]>=key`，R为首次`a[i]>key`。于是`[L,R)`恰好是全部相等项，数量为`R-L`；若L=R则键不存在。小于等于key的前驱在`R-1`，严格小于的前驱则在`L-1`，前提是相应边界大于0。这个定义一次覆盖成员、插入位、首尾、计数和前驱，不必分别记五套循环。

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

`lower_manual`遇到相等不返回，而是排除它右边不可能成为首次的位置；`upper_manual`把相等归入已经确认的左侧。两个边界都允许落到n。若题目要求闭区间或`[-1,-1]`，只在最后转换：非空相等段对应`[L,R-1]`，不要把内部不变量也改乱。

时间记录是同一机制的真实应用：对每个键维护按时间递增的`TimedValue`序列，查询最后一个`time<=query`。这不是查“最近的绝对时间”，更不能先找到任意相等项再随便取邻居。外层按键的散列表与内层时间边界各司其职；若允许乱序写入，就不能继续把简单追加当作有序维护。

<a id="ordered-boundaries-library"></a>
### 用库表达同一边界

```cpp
std::pair<std::size_t, std::size_t>
equal_standard(const std::vector<int>& a, int key) {
    const auto range = std::equal_range(a.begin(), a.end(), key);
    return {static_cast<std::size_t>(range.first - a.begin()),
            static_cast<std::size_t>(range.second - a.begin())};
}
std::optional<std::string> time_standard(const std::vector<TimedValue>& a, int query) {
    // upper_bound比较方向是comp(value, element)，不同于lower_bound。
    auto it = std::upper_bound(a.begin(), a.end(), query,
        [](int time, const TimedValue& entry) { return time < entry.time; });
    if (it == a.begin()) return std::nullopt;
    return std::prev(it)->value;
}
```

`equal_range`返回两个迭代器，不返回两个元素值。记录前驱用`upper_bound`，其比较器接收顺序是`(查询值, 元素)`；不要把`lower_bound`常用的`(元素, 查询值)`直接照搬。它寻找首个时间更大的记录，再退一步。

<a id="ordered-boundaries-engineering"></a>
在`vector`上，边界定位本身时间O(log n)、额外空间O(1)；时间记录接口返回字符串副本，还要加O(|value|)的复制时间和结果空间。副本避免把历史容器中的引用带出调用后遭失效；大对象可选返回索引，但必须另约定容器寿命和修改政策，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与容器失效</a>。有序记录以比较器的等价关系为准，不必等同`operator==`，见<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>。

<aside class="knowledge-introduction" id="knowledge-Q100001" data-knowledge-introduction="Q100001"><p class="knowledge-title">二分库的分区与迭代器合同</p><p><code>lower_bound(first,last,key,comp)</code> 找第一个不满足 <code>comp(element,key)</code> 的位置；<code>upper_bound</code> 找第一个满足 <code>comp(key,element)</code> 的位置，比较参数方向相反。升序整数中，它们分别是首次≥key、首次&gt;key；返回值可以是 <code>last</code>，不能未经检查就解引用。</p>
<p>这些算法要求当前范围对相应表达式已分区。全局排序是常用充分条件；旋转数组、仅行列有序的矩阵展平后并不自动满足。<code>partition_point</code> 寻找已有 true 前缀的结束，也不会替调用者重排或证明分区。</p>
<p><code>[first,last)</code> 是半开范围，允许空；前驱要先检查返回值不等于 <code>first</code>。使用迭代器差得到个数后，只有确认规模能放入目标整数，才缩窄为 <code>int</code>。</p>
<p>对数保证针对比较次数。<code>vector</code> 的随机访问使移动也为对数；普通前向迭代器的总递增可线性。<code>set</code>/<code>map</code> 查询优先用成员 <code>lower_bound</code>，不要用通用算法在树迭代器上线性走。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search">C++17 二分算法</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.partitions">分区算法</a>。</p>
</aside>


<aside class="knowledge-introduction" id="knowledge-Q100004" data-knowledge-introduction="Q100004"><p class="knowledge-title">比较器与排序合同</p><p><code>sort</code> 的比较器应定义严格弱序：自身不小于自身，比较关系和由“不互相小于”定义的等价关系都应满足传递性。<code>a&lt;=b</code> 会使相等元素也被判成更小，不是合法替代；不要通过相减的正负判断顺序，减法可能溢出。</p>
<p>复合排序必须先按第一关键字区分，再处理真正相等时的第二关键字。例如信封宽升序、同宽高降序；这是算法归约需要的次序，不是所有 pair 默认字典序都能替代。不要在浮点比较器中随意加 epsilon，近似等价可能破坏传递性；NaN 同样会破坏正常的排序推理。</p>
<p>对固定key，<code>lower_bound</code> 实际要求的是 <code>comp(element,key)</code> 分区；<code>upper_bound</code> 则比较相反参数方向。这与为了排序所需的全域严格弱序应区别。异构记录查询需要写对方向，不能把某个只接受 <code>(Record,Key)</code> 的回调原样塞给 <code>upper_bound</code>。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.sorting">C++17 排序关系</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search">二分合同</a>。</p>
</aside>


<aside class="knowledge-introduction" id="knowledge-Q100005" data-knowledge-introduction="Q100005"><p class="knowledge-title">借用参数与容器失效</p><p><code>const vector&lt;T&gt;&amp;</code> 借用现有输入，不复制且不能经该引用修改元素；它不延长外部对象的寿命。按值参数拥有自己的容器，适合明确需要排序副本的接口；调用者传左值时可能复制，传可移动对象时可转移资源。<code>std::move</code> 只是允许按右值处理，是否实际移动取决于接收操作。</p>
<p><code>reserve(n)</code> 管容量，<code>resize(n)</code> 管元素数量。仅 reserve 后用 <code>v[i]</code> 写尚不存在的元素不合法。扩容重分配使原元素指针、引用、迭代器失效；有 reserve 也不能在超容量增长后继续用旧迭代器。删除的元素本身也不能再借用。</p>
<p><code>erase</code>会使擦除位置及其后的迭代器、引用失效；<code>push_back</code>即使未重分配，旧的end迭代器也失效。不能把“这次没有换缓冲区”理解成所有旧位置和边界都仍有效。</p>
<p>LIS中先把边界转成下标，再允许 push_back；递归事件分流中，不在持有元素引用时扩张同一vector。返回拥有数据的vector可以正常按值返回，不需要返回局部容器引用来“省复制”。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/vector.capacity">vector 容量</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers">修改与失效</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/forward">值类别转换</a>。</p>
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

要找`a[i]=i`，看起来不是标准键查找；但若a是严格递增整数数组，`a[i+1]>=a[i]+1`，所以`a[i]-i`**非降**，不是严格递增。可以找首次`a[i]>=i`，然后检查是否相等。数组本身有序只是线索，真正支撑消除的是变换后的顺序。

正整数缺失数也用同样的秩差：下标i之前至多有i个已出现值，故到a[i]为止缺失数量为`a[i]-i-1`。令p为首次缺失数>=k的位置；答案前有p个实际元素，因此第k个缺失值为`k+p`。若p=n，答案就在尾部之后；若数组为空，答案就是k。

<a id="transformed-index-manual"></a>
### 变换有序，以及它失效之后

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

允许重复时，`a[i]-i`可能下降，不能继续使用第一段循环。仍然有更弱的排序证书：中点值v确定后，左侧下标大于v的位置不可能固定，右侧下标小于v的位置也不可能固定。因此只递归`[lo,min(mid-1,v)]`和`[max(mid+1,v),hi]`。可能两边都保留，最坏O(n)，栈深O(log n)；这不是“稍改两行仍然对数”。严格输入的固定点与缺失数查询是O(log n)、O(1)空间。

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

标准设施版本把gap显式构造后用`lower_bound`。**本函数单次总成本O(n)、空间O(n)**，不冒称优于手写的隐式O(log n)查询；若同一个a有大量查询，应把gap作为索引保留，之后每次仅O(log n)。没有必要为了套库而每次复制一遍原本能直接计算的变换。

<a id="transformed-index-engineering"></a>
固定点递归假定容器长度可由`ptrdiff_t`表示，缺失数接口要求k>0、`n+k`可由`int64_t`表示。值转换后才作差，不能在int中先溢出再转宽。重复值也破坏这里“第i个不同已出现值”的缺失计数公式；若题目允许重复，先去重或另维护实际秩，不能只换一个边界函数，见<a class="knowledge-link" href="#knowledge-Q100002" data-knowledge="Q100002">整数表达式与溢出预算</a>。

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
没有严格峰的输入不能靠随便返回一个下标“补齐”合同。空数组在这里扩展为`nullopt`；原题非空时可直接解包返回值。标准设施返回迭代器，转换成下标后仍指向本次输入，见<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与容器失效</a>。

练习：[任意局部峰](https://leetcode.com/problems/find-peak-element/)。

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

原题保证三个互异实根位于[-100,100]、彼此相距至少1。要稳妥找全，不依赖“某个整数端点的浮点残差恰为0”：例如十进制系数`0.1,-0.6,1.1,-0.6`的数学根为1、2、3，二进制求值却可能让整数端点只出现很小的正负误差，按单位区间识别就会重复或漏掉根。

把方程除以a得到`x³+B x²+C x+D`，导数的两个零点为`t₁,₂=(-B±sqrt(B²-3C))/3`。由Rolle定理，三根与临界点严格交错：`r₁<t₁<r₂<t₂<r₃`。于是`[-101,t₁]`、`[t₁,t₂]`、`[t₂,101]`各有且只有一根，三个区间依次夹逼即可；±101在原题根域之外，避开根恰为±100时的端点求值问题。这里使用的是“导数划分单调区间”的额外证书，不是让一个通用异号循环自动找全根。

整体归一消除了任意系数缩放带来的残差尺度，`long double`和`fma`减少Horner求值的舍入。根域使归一系数的绝对值分别不超过300、30000、10⁶；根距至少1还使两个临界值远离0：在任一相邻根的中点，单首项三次式的绝对值至少`(1/2)²×(3/2)=3/8`，该区间的极值只会更大。这给临界点分段提供实际数值裕量，而非用统一epsilon把近似相等都合并。三个区间已按序且不共享根，无需浮点去重；`sqrt/fma`只是标准数值设施，并非通用三次方程求解函数。

工资封顶是有用的对照：`P(c)=Σmin(salary,c)`非降，可二分c；排序后它在相邻工资断点之间是线性的。令S为低于当前断点的工资前缀和，剩下r人都被封顶，则直接解`c=(T-S)/r`。多次目标查询可以先建立各断点对应的工资总额，再`lower_bound`定位区间。能解析恢复时不必为了本章主题强行迭代；目标大于原总工资应无解。

<a id="continuous-root-engineering"></a>
绝对位置误差、相对误差与函数残差不同。平方根在0<x<1时也不能用[0,x]作夹区；machine-epsilon不是所有业务所需容差。上面例子按P1024输出两位小数留足余量，示例函数不包含输出格式，见<a class="knowledge-link" href="#knowledge-Q100006" data-knowledge="Q100006">浮点夹逼与误差</a>。

<aside class="knowledge-introduction" id="knowledge-Q100006" data-knowledge-introduction="Q100006"><p class="knowledge-title">浮点夹逼与误差</p><p>浮点数离散，<code>while(lo&lt;hi)</code> 不保证中点能继续推进；当 mid 等于端点时应停止。固定轮数也须依据初始区间宽度和目标误差选择。绝对区间宽度、相对误差、函数残差是不同合同；输出三位小数只是格式，不会让错误答案自动精确到三位。</p>
<p>连续异号夹逼保留某个根，不能仅因单调就保证根存在：跳跃函数可能跨过0却不取0。只找某根也不代表找到了最小根或全部根；偶重根不一定出现符号变化。单调可行性阈值则要另外证明判定方向。</p>
<p><code>long double</code> 的精度依平台变化，不能按类型名字保证80位。按值域与累加项数评估误差，必要时保留可行侧或同时输出区间。避免 <code>f(lo)*f(mid)</code> 的无谓乘积溢出，可直接比较符号；输入含NaN、无穷或存在不连续点时先重新界定合同。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/basic.fundamental">浮点类型</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/numeric.limits">数值特征</a>。</p>
</aside>


练习：[一元三次方程求解](https://www.luogu.com.cn/problem/P1024)。

<a id="string-prefix"></a>
## 字典序前缀与比较成本

排序后的字符串中，以p开头的词构成一个连续区间。把每个词截取至多|p|个字符后与p比较，结果依次是负、零、正；两个边界便框出全部匹配。这样不必构造“p的字典序后继”，也不会假设任意字符域都有安全的加一操作。

<a id="string-prefix-manual"></a>
### 前缀区间，以及另一种长度边界

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

词短于p且仅匹配前段时比较为负，不算完整前缀；p为空则所有词都匹配。两次二分共O(log n)次比较，但一次比较最多读|p|个字符，因此字符成本是O(|p|log n)，不是无条件O(log n)。输入须按与这里相同的字典序排序。

`lcp_binary`搜索两串最大相等前缀长度。目标确实单调，但每次从头比较前m字符，最坏字符成本O(L log L)。这说明“判定次数对数”不等于“整题比线性快”。

<a id="string-prefix-library"></a>
### 区间查询、建议列表与确定性LCP

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
std::size_t lcp_standard(std::string_view a, std::string_view b) {
    return static_cast<std::size_t>(std::mismatch(a.begin(), a.end(), b.begin(), b.end()).first - a.begin());
}
```

`lower_bound`、`upper_bound`的比较方向分别适配前缀截取关系。建议系统先排序产品，再对用户输入的每个前缀找区间，只复制前3项；示例刻意返回拥有字符串的结果，避免本地products销毁后留下视图。长度q的输入按此直写，最坏查询字符成本O(q²log n)，另计产品排序及结果复制。

`mismatch`直接找首个不同字符，确定性LCP成本O(L)，反而优于这里的朴素二分。若预处理前缀哈希，每次比较可以更便宜，但哈希相等只是可能相等；碰撞甚至会破坏实际oracle的单调表现。双哈希降低风险，不变成确定性证明。后缀数组已建好时也可以在其字典序中按模式前缀找区间，但**查已有有序索引与构建后缀索引是两件事**，这里没有声称完成后者。

<a id="string-prefix-engineering"></a>
`string_view::substr`只借用字符，不复制，不延长源字符串寿命。比较序若改为忽略大小写、区域排序或编码规范化，排序和前缀定义都要同步，不能只替换某个比较器，见<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>、<a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与容器失效</a>。

练习：[搜索建议系统](https://leetcode.com/problems/search-suggestions-system/)。

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
