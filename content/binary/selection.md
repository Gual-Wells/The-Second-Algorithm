# 选择与状态

二分对象未必是数组位置：可以是数值阈值、跨数组切分位置，或被其他算法维护的有序状态。先确定一次判定究竟统计什么，再决定向哪边移动。本篇代码位于命名空间 `binary_selection`，函数按各节注明的合同调用。

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
i64 multiplication_count_standard(int rows, int cols, i64 x) {
    i64 count = 0;
    for (i64 i = 1; i <= rows; ++i) count += std::min<i64>(cols,x/i);
    return count;
}
i64 multiplication_kth_standard(int rows, int cols, i64 k) {
    if (rows > cols) std::swap(rows,cols);
    return kth_value(1,1LL*rows*cols,k,
                     [&](i64 x) { return multiplication_count_standard(rows,cols,x); });
}
```

这里 `std::swap` 选短边、`std::min` 截断一行数量，核心仍是解析计数和值域搜索。标准库没有隐式乘法表的第 k 小接口。这是共享核心的支撑写法，复杂度没有因使用库而下降，也不值得物化答案域去套迭代器算法。

<a id="multiplication-rank-engineering"></a>
原题 m,n≤30000，mn≤9×10⁸；代码仍在乘前用 `1LL` 提升。若推广到巨大 m,n，乘积、计数上限和每轮线性扫描成本都要重新审查。别仅把输入类型换成 `long long` 就宣称支持任意大表。

练习：[LC668 · 乘法表中第 k 小的数](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/description/)。

<a id="two-sorted-partition"></a>
## 两有序数组中位：在合法分割位置二分

从 A 取 i 个、从 B 取 k−i 个到左半，左半总数固定为 k。只要 A左末≤B右首且B左末≤A右首，两数组内部本就有序，左半所有元素便不大于右半，左半最大值就是第 k 小。搜索的是 i，合法区间必须限制为 `[max(0,k−n),min(k,m)]`。

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
int envelopes_standard(std::vector<std::pair<int,int>> envelopes) {
    std::sort(envelopes.begin(),envelopes.end(),[](auto a,auto b) {
        return a.first != b.first ? a.first<b.first : a.second>b.second;
    });
    std::vector<int> heights;
    for (auto item : envelopes) heights.push_back(item.second);
    return static_cast<int>(lis_standard(heights).size());
}
```

严格上升用 `lower_bound`，非降用 `upper_bound`：两者对应是否允许相等值延长序列，不是随意换API。信封按宽升序、同宽高降序后，高度做严格 LIS；同宽先看到较高项，不能再借较高项延长，从而防止把同宽信封错误嵌套。<a class="knowledge-link" href="#knowledge-Q100004" data-knowledge="Q100004">比较器与排序合同</a>中的严格性对这条归约同样重要。

单个最小尾值还丢失了方案数量。要求计数时，可用长度加方案数的 DP：

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

这明确修复 tail 摘要不保数量的局限，而不是声称所有含二分工具的计数算法都不可能。按“每条链的末元素”计数，每条非空最优子序列恰落在一个末位置；如果任务不保证最终答案可表示，则要另选大整数或取模合同，不能把饱和值称作精确大计数。

<a id="ordered-dp-frontier-engineering"></a>
先把边界迭代器转换成下标，再 `push_back`；重分配后旧迭代器可能失效，`reserve` 也不代表已有可下标写入的元素。详见 <a class="knowledge-link" href="#knowledge-Q100005" data-knowledge="Q100005">借用参数与容器失效</a>。严格与非降两种恢复都要验证下标递增及值关系，而不只比长度。

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

楼层存在临界点，并不意味着拿着一个鸡蛋也能普通二分：一次破损就减少后续查询能力。换问法：d 次试探、k 个鸡蛋能确定多少层？本次选择一个试探层，破损后覆盖下方 `cover(d−1,k−1)` 层，不破损覆盖上方 `cover(d−1,k)` 层，加本层，得到递推。

将它展开可得 `cover(d,k)=Σ(i=1..min(d,k)) C(d,i)`。每多一次试探覆盖量不减，因此可以二分最小 d，使覆盖量至少 n。

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

一次判断最多 O(k) 项，总 O(k log n)、额外 O(1)。在 LC887 的 n≤10000 合同内，只要上一项尚未使总和达标，它小于 n；下一乘法的粗界 n² 可表示。达到 n 后直接停止，既避免无用大数，也保留“只判断够不够”的语义。不能把此乘法安全结论推广成任意64位楼层。

<a id="resource-queries-standard"></a>
### 直接推进覆盖 DP 的对照

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

这不是标准库鸡蛋算法：`vector` 承载覆盖状态、`std::min` 饱和，递推仍由我们定义。这是另一种求值次序，耗时 O(k·答案)、空间 O(k)。e 必须倒序更新，以免把本轮新状态误当上一轮。两条路径应区分算法而非叫“同算法换库”。

<a id="resource-queries-engineering"></a>
这一型说明：目标条件单调，与真实oracle是否无代价、可重复访问是不同问题。实际交互题、昂贵测量或破坏性试探都要重新审查预算；不能看到“临界值”就默认二分可以原样执行。

练习：[LC887 · 鸡蛋掉落](https://leetcode.com/problems/super-egg-drop/description/)。
