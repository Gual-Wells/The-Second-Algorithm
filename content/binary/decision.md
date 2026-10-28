# 判定与优化

这些问题没有现成的有序答案数组。先把“优化目标”改成一个能计算、能证明的判定，再搜索答案边界。外层循环可以共用，分段、放置、模拟、连通、匹配与分数变换的检查器却不能互换。

<a id="capacity-partition"></a>
## 连续容量分段：以最少段数判定最大段和

将非负数组按原顺序分为恰好 `k` 个非空连续段，使最大段和最小。不能通过排序改变相邻关系；难点也不是枚举哪个位置切开，而是检验：**若每段最多容纳 B，最少需要几段？**

从左到右尽量装入当前段，装不下才切。任何满足容量的第一段都不可能越过贪心切点；贪心用同样一段覆盖了至少同样长的前缀。依此比较后续切点，它不会比任何可行划分用更多段。因此 `最少段数≤k` 是正确判定。非负数组可以再拆段而不增大段和，只要 `k≤n`，就能把“不超过 k 段”补成“恰好 k 个非空段”。

当 B 增大，可行划分只会增加，寻找首次可行值。下界是最大元素，上界是总和。非负条件不是形式限制：`[-5,10,-5]` 的单段和是 0，这时最大元素 10 已不再是合法下界，扫描到中途超限也不代表该段最终超限。

<a id="capacity-partition-manual"></a>
### 手写：容量检查与边界收缩

以下几个搜索函数共用本读件的区间合同。整数版本只用于 `0≤lo≤hi`、差值可表示且区间内存在真值的情形；哨兵如何保证存在，会在相应问题交代。浮点版本以 80 轮为计算预算，并防止中点停滞，具体误差仍由题目范围决定。

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

<a id="average-transform"></a>
## 平均值优化中的合法区间判定

比值不能直接像和一样加减，但可以试一个平均值 λ，再把每项减去 λ。对任意非空集合，`sum(a)/count≥λ` 等价于 `sum(a−λ)≥0`，因为分母为正。**变换只消除了除法，合法集合的约束并没有消失。**

P1419 要在长度 `[S,T]` 的连续段中最大化平均，`1≤S≤T≤n≤10^5`、元素在 `[-10^4,10^4]`。令变换前缀为 P，固定右端 r≥S，合法左前缀下标是 `[max(0,r−T),r−S]`。检查是否 `P[r]−min P[left]≥0`；用单调队列保存这个滑动窗口的前缀最小值。只有最短长度时可以保留历史最小前缀，增加最长长度后必须让过期候选退出。

Sabotage 的约束不同：`3≤N≤10^5`、每项在 `1..10000`，必须删掉一个非空内部连续段，首尾保留，最小化剩余平均。令总变换和为 U，删段变换和为 V，则剩余平均≤λ 等价于 `U−V≤0`。因此检查**内部非空最大子段和≥U**。这里最大子段用 Kadane，不能误换成最小子段，也不能允许空删段。

<a id="average-transform-manual"></a>
### 手写：合法前缀窗口与非空内部子段

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

P1419 的队列保存下标，后端去掉被新前缀支配的更大值，前端去掉过期下标。被支配的旧值不但更大，而且更早过期，之后不会重新成为更好候选。每个下标入队/出队至多一次，单次判定 O(n)、空间 O(n)。

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

<aside class="knowledge-introduction" id="knowledge-Q100011" data-knowledge-introduction="Q100011"><p class="knowledge-title">队列和双端队列的状态</p><p><code>std::queue</code>提供先进先出，常用front/push/pop；<code>std::deque</code>允许两端插入删除，适合维护单调候选队列。它们只提供容器操作，不会自动维护“已经访问”“候选未过期”或“值单调”等算法不变量。</p>
<p>访问front/back前检查非空；删除元素后不能继续使用它的引用。deque两端插入使迭代器失效，但保留既有元素引用的有效性；中间插入的规则不同。按下标保存候选位置，可以把过期检查与实际输入前缀绑定，不需要持有deque迭代器跨修改。</p>
<p>数组队列若容量覆盖所有最多入队次数，头尾下标即可O(1)推进；vector.erase(begin())会移动后续元素，不能把它当O(1)出队。单调队列“每元素至多进出一次”的线性总成本来自算法证明，不是deque这个类型名的保证。</p>
<p>依据：<a href="https://timsong-cpp.github.io/cppwp/n4659/queue">queue</a>、<a href="https://timsong-cpp.github.io/cppwp/n4659/deque.modifiers">deque修改</a>。</p>
</aside>


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
