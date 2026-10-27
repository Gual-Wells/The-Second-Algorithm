# 从算法操作到 C++17 提交代码：权威合同研究

研究日期：2026-10-27。用途：为“知道算法思路，怎样可靠写成 C++ 上机解答”的范围研究提供技术证据；本文件是研究材料，不是已发布教材，也不代替完整题目的正确性证明。

本分支实际读了仓库 `AGENTS.md`、`protocol/CONTENT_PIPELINE.md`、`protocol/RESEARCH_DEPARTMENT.md` 和 `protocol/CPP_TRACK.md`；没有审计全册、读取教材原件或修改教材。Memory registry 的相关关键词检索无命中，没有用历史回答重建规则。

## 证据边界与版本

- **标准合同**：实际打开 eel.is 当前公开工作草案的相关条款，并以 C++17 时代公开草案 N4659 的对应条款复核关键基线。N4659 官方原件已打开，封面日期为 2017-03-21；正文定位采用便于链接的 HTML 镜像。工作草案不是付费发行的 ISO 标准正文，本次没有逐项审计历年全部 DR。[WG21 官方 N4659 PDF](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)
- **版本辅助参考**：cppreference 用于 `since/until` 标记、接口对照与说明，不能冒称标准正文。
- **设计建议**：C++ Core Guidelines 是可讨论的建议，不能用“建议不要写”代替“不合式／未定义行为”的判断。
- **实现与工具**：LLVM/GCC 官方文档用于说明诊断能力、开关和限制；工具没有报错不证明程序满足所有标准合同。本次没有测量任何标准库实现的速度。

特别需要防止版本串线：当前 eel.is 已出现 `string::subview`、`string_view::subview`、`hardened preconditions` 等 C++26 内容；它们不自动属于 C++17/20/23。当前 `accumulate` 使用移动 accumulator 的措辞，而 N4659 使用 `acc = acc + *i`；当前有符号负数右移规则也不能倒灌到 C++17。[当前字符串接口](https://eel.is/c++draft/string.substr)、[N4659 accumulate](https://timsong-cpp.github.io/cppwp/n4659/accumulate)、[N4659 shift](https://timsong-cpp.github.io/cppwp/n4659/expr.shift)

## 1. 找位置、找边界：先匹配存储结构和比较方向

真实任务包括有序数组查找、离散化排名、区间计数、维护动态有序集合中的后继。共同的代码外观是 `lower_bound`，实际成本和合同并不相同。

**标准合同。** `std::lower_bound` 要求范围针对 `comp(element, value)` 先真后假；完全排序是常用的充分条件，不是唯一前提。比较次数至多对数级，但非随机访问迭代器需要线性级步进；`set/map` 迭代器是双向迭代器，其成员 `lower_bound` 则有对数复杂度合同。[当前 lower_bound](https://eel.is/c++draft/lower.bound)、[二分算法步进成本](https://eel.is/c++draft/alg.binary.search.general)、[关联容器成员与迭代器要求](https://eel.is/c++draft/associative.reqmts)、[N4659 二分条款](https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search)

| 算法意图 | C++17 对应 | 必须讲清的差异 |
|---|---|---|
| 有序 `vector` 中第一个不小于 x | `lower_bound(v.begin(), v.end(), x)` | 可能返回 `end()`；先检查再解引用 |
| 动态 `set/map` 中找后继 | `s.lower_bound(x)` | 换成通用算法会失去总成本对数的保证 |
| 统计 `vector` 中等于 x 的数目 | `upper_bound - lower_bound` | 两端都是半开区间；重复元素和空区间要成立 |
| 统计树容器中等于 x 的数目 | 成员 `count` 或成员 `equal_range` 后遍历 | `distance` 对树迭代器是线性，不是 O(1) 排名 |
| 自定义记录按 key 查找 | `comp(record, key)` | `upper_bound` 的比较参数方向相反；不可机械复用同一异质 lambda |

提交选择：静态批量数据常用排序后的 `vector`；是否允许排序、是否要原下标，来自题目而非 STL。自定义比较的“相等”是双向都不小于，不必等于 `operator==`。若只按 key 排序，后续用完整对象比较来搜索，必须重新核对分割前提。这里的容器建议是本研究推论，不是标准要求。

## 2. 要全部有序、要第 k 个，还是只分两组

**标准合同。** `sort` 需要随机访问、可交换和可移动赋值的元素，具有 O(N log N) 比较次数合同；比较器须构成严格弱序。`nth_element` 使 nth 位置等同于完整排序后的位置，并分隔两侧，但两侧内部没有排序保证；普通顺序重载仅保证平均线性。`partition` 按谓词分两组；`stable_partition` 才保证组内原顺序。[sort](https://eel.is/c++draft/sort)、[比较器](https://eel.is/c++draft/alg.sorting.general)、[nth_element](https://eel.is/c++draft/alg.nth.element)、[partition](https://eel.is/c++draft/alg.partitions)、[N4659 sort](https://timsong-cpp.github.io/cppwp/n4659/sort)、[N4659 nth_element](https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element)

这些合同分别对应不同任务，不能用“STL 排序”一个标签合并：

- 第 k 小，1 ≤ k ≤ n：位置是 `begin() + (k - 1)`；第 k 大须变换名次或比较方向。空输入和非法 k 要在构造迭代器之前处理。
- 无序的最小 k 个：对合法 k 使用 `nth_element(begin, begin+k, end)` 后取前 k 个；k==n 时 nth==end 允许，但不能解引用 end。要有序输出时再排序前 k 个；复杂度是平均 O(n) 加 O(k log k)，不能删掉“平均”。
- 只筛出符合条件的一组：`partition` 可以省掉全排序，但会改变顺序及元素位置。题目要求原顺序时需换用稳定方法或另收集结果。
- 区间合并、贪心中的先后次序：把所有有意义的平局规则写进比较器，或依据题目要求选稳定排序，不能依赖某次 `sort` 恰好保序。

比较器最小核对：`comp(x,x)` 必须是假，不能写 `<=`；不要用 `a.key-b.key<0` 来比较整型，差值可能先溢出；比较过程中不要修改决定排序关系的外部状态。`std::tie(a.key,a.id) < std::tie(b.key,b.id)` 是常见的明确字典序表达。浮点 NaN、带容差的“近似小于”也不能未经证明就当严格弱序。以上是按合同推导的失败触发，并非某个编译器的固定报错形式。

相关压缩任务：`unique` 只合并相邻等价项，返回逻辑尾端；`remove_if` 也不改变容器 size。全局去重通常先排序，再 `v.erase(unique(...), v.end())`，前提是允许改变顺序。尾部不能当成原数据继续使用；不要在循环里反复 `vector.erase` 造成整体平方级搬移。[unique](https://eel.is/c++draft/alg.unique)、[remove](https://eel.is/c++draft/alg.remove)、[vector erase](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)

## 3. 计数和滑动窗口：查询必须保持状态不变量

**标准合同。** `unordered_map::operator[]` 等价于 `try_emplace(...).first->second`，缺键会插入；`find` 不插入。哈希查询平均 O(1)、最坏 O(n)。`reserve(n)` 通过 `rehash(ceil(n/max_load_factor()))` 预留桶，rehash 平均线性、最坏平方；reserve 不会把坏哈希变成确定性常数时间。[元素访问](https://eel.is/c++draft/unord.map.elem)、[try_emplace](https://eel.is/c++draft/unord.map.modifiers)、[哈希要求与复杂度](https://eel.is/c++draft/unord.req)、[N4659 元素访问](https://timsong-cpp.github.io/cppwp/n4659/unord.map.elem)

最有实战价值的区分是“零”和“不存在”是不是同一个状态：

- 频次累加 `++freq[x]`：刻意利用缺键插入的 0 值，通常合适。
- 判断此前是否见过、取首次下标：`if (pos[x])` 会混淆下标 0，并插入不存在键；用一次 `find` 或 `try_emplace` 的 `inserted` 结果表达条件。
- 窗口不同值个数若用 `freq.size()`：频次减到 0 时必须删除键；否则 size 是“留在表内的键数”。也可不删除但单独维护正频次键数，不能混用两种不变量。
- `if (freq[x] == 0)` 若只是一次查询，也会扩大键集；这可能改变窗口状态和空间复杂度。固定小字母表可用数组，但需先核对字符域及下标转换。

rehash **失效的是迭代器，不是未被删除元素的指针／引用**。插入可能引起 rehash；erase 只失效被删元素的迭代器／引用。若先取得 iterator，再 `m[other]` 插入，最后继续用旧 iterator，必须证明未 rehash，或插入后重新 find。`reserve` 应在持有这些 iterator 之前完成；不能把一次 reserve 理解为永远不失效。[当前 rehash 与插入失效条款](https://eel.is/c++draft/unord.req.general)、[N4659 同类规则](https://timsong-cpp.github.io/cppwp/n4659/unord.req)

这一组更适合与“窗口扩张／收缩到底改了哪些状态”共同讲解，而非孤立列 `unordered_map` 成员表。字符串键的操作分析还须说明键长是否有界、哈希／比较按何种成本计数；本次没有核查具体 string hash 实现，不宣称它的精确字符访问次数。

## 4. 每次取最优候选：堆比较方向和快照

**标准合同。** `priority_queue` 默认比较器是 `less`，top 是底层容器 front 的 const reference；push 和 pop 分别经 `push_heap` 和 `pop_heap` 维护堆。堆要求父节点不小于子节点（相对于 comp）；比较器仍须严格弱序。因此默认是最大堆，`greater` 对应最小堆。[适配器定义](https://eel.is/c++draft/priority.queue)、[成员操作](https://eel.is/c++draft/priqueue.members)、[堆定义](https://eel.is/c++draft/alg.heap.operations.general)、[N4659 对照](https://timsong-cpp.github.io/cppwp/n4659/priority.queue)

```cpp
using State = std::pair<long long, int>;  // 代价快照、顶点
std::priority_queue<State, std::vector<State>, std::greater<State>> q;
// 外层循环须先确认 !q.empty()
auto [cost, vertex] = q.top();            // 拷贝出值
q.pop();
```

这是供作者复用的 C++17 片段，本分支未编译，不是已验证完整 Dijkstra 实现。其教学价值在三点：`pop()` 不返回元素；先保存值再 pop，避免保留 top 的引用；把入堆时的代价写进元素，算法可自行过滤过期快照。

若比较器读取外部可变 `dist`，而 dist 改变后旧元素仍留在堆内，堆不会自动重排。随后的 push/pop 又以前半段已是合法堆为前提；不能把此模式当 decrease-key。标准适配器没有对应更新接口，改用快照与过期判断，或者选用真正支持更新的数据结构，是算法设计选择。[push_heap 前提](https://eel.is/c++draft/push.heap)、[pop_heap 前提](https://eel.is/c++draft/pop.heap)

C++17 使用 lambda 比较器时，把对象传给构造函数：`priority_queue<T, vector<T>, decltype(cmp)> q(cmp);`。不能从 C++20 的无捕获 lambda 可默认构造规则倒推 C++17 也可省略 cmp。[cppreference lambda 构造规则](https://en.cppreference.com/cpp/language/lambda#ClosureType::ClosureType())

## 5. 前缀和、乘积、组合计数：类型在表达式内部就决定了

**标准合同。** 小整数先做整型提升，通常算术转换再决定运算类型；赋给更宽变量发生在表达式计算之后。`accumulate` 的 accumulator 类型 T 由 init 推导，而不是由返回值接收变量决定。有符号算术结果超出类型可表示范围会触发 UB。[整型提升](https://eel.is/c++draft/conv.prom)、[通常算术转换](https://eel.is/c++draft/expr.arith.conv)、[当前算术溢出条款](https://eel.is/c++draft/expr.pre)、[accumulate](https://eel.is/c++draft/accumulate)

```cpp
long long sum = std::accumulate(a.begin(), a.end(), 0LL); // a 为 vector<int>，和可表示
long long product = 1LL * x * y; // x、y 为 int；仍须核对最终 long long 上界
```

`long long sum = accumulate(..., 0)` 不会把内部求和变成 long long；`long long p = x*y` 不会阻止 int 乘法先溢出。即便每项可放 int，前缀和、答案个数、路径代价之和可能需要更宽类型。`INF + weight`、比较器差值、`abs(INT_MIN)`、`1 << k` 都应从原题上界重新分析；不是把所有变量改成 long long 就自动正确。

混合有符号与无符号需要独立核对。`size()-1` 在空容器时先做无符号回绕，后续赋给 int 不能补救；倒序遍历应采用受控边界，或在已经验证长度上界后转换成有符号长度。移位用与掩码宽度一致的无符号类型，并检查位数；C++17 对负的有符号数右移是 implementation-defined，不应照抄当前草案行为。[N4659 shift](https://timsong-cpp.github.io/cppwp/n4659/expr.shift)

Core Guidelines ES.100、ES.103 分别建议避免混合符号算术、避免溢出；这有助于风格选择，但具体合法性仍由表达式规则和数值范围决定，不能要求上机代码安装 GSL 才算正确。[ES.100](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Res-mix)、[ES.103](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Res-overflow)

## 6. 可变数组和 visited：值、代理、迭代器是三件事

**标准合同。** `vector::reserve` 不改变 size；reserve 引起重分配时所有元素引用／指针／迭代器失效。插入不重分配时，也会失效插入点及其后的 iterator，包括旧 end；erase 失效删除点及之后的 iterator/reference。[capacity](https://eel.is/c++draft/vector.capacity)、[modifiers](https://eel.is/c++draft/vector.modifiers)、[N4659 capacity](https://timsong-cpp.github.io/cppwp/n4659/vector.capacity)、[N4659 modifiers](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)

任务映射：

- 需要随机写 n 个位置：构造 `vector<int> a(n)` 或 resize，不能只 reserve 后就 `a[i]=...`。
- BFS 队列、动态生成状态若存在 vector 中：增长前不要保留 `auto& cur = states[i]` 然后 push_back 再读 cur；可先拷贝必要字段、保存下标并在增长后重新取元素，或选择符合操作要求的容器。
- 对 vector 做 range-for 时向同一个 vector push_back：即使容量足够，旧 end 也失效；需要明确固定初始长度的索引循环或分开输入／输出。
- 滑动窗口移走左边元素：通常移动 left 下标，不需要反复 `erase(begin())`；否则搬移成本可能吞掉双指针算法的线性分析。

`vector<bool>` 是压缩位特化，`reference` 是代理类，标准不要求它是连续 bool 数组。`auto bit = seen[i]` 得到的可能仍是会回写原位的代理；`bool bit = seen[i]` 才是值快照。需要普通元素引用、地址或简单泛型行为时，`vector<unsigned char>` 是值得比较的选择；不能把它说成所有场景必然更快。[当前 vector<bool>](https://eel.is/c++draft/vector.bool)、[N4659 reference 与存储规定](https://timsong-cpp.github.io/cppwp/n4659/vector.bool)

## 7. DFS／回溯：把递归接口与共享状态写清楚

C++17 可以用泛型 lambda 显式传 self，也可写普通函数／成员函数；不需要为本地递归一律使用 `std::function`。

```cpp
auto dfs = [&](auto&& self, int u) -> void {
    seen[u] = true;
    for (int v : graph[u]) {
        if (!seen[v]) self(self, v);
    }
};
dfs(dfs, start);
```

这是基于泛型 lambda 合同的 C++17 实现片段，本分支未编译；假定 graph 与 seen 在整个调用期存活、图遍历时不修改邻接 vector、start 有效。显式返回类型让递归处不依赖尚未完成的返回类型推导；`auto&& self` 避免每层按值复制 closure。若把大型状态按值捕获，closure 的复制可能把不期望的复制成本带入递归；若把 visited 按值捕获并设 mutable，又可能访问的是副本而非外层状态。[N4659 lambda 与泛型调用运算符](https://timsong-cpp.github.io/cppwp/n4659/expr.prim.lambda)、[当前 closure 规则](https://eel.is/c++draft/expr.prim.lambda.closure)

引用捕获不延长被借用对象的寿命；局部同步使用通常合适，返回或保存到更外层时需重新分析所有捕获对象的存活期。F.52/F.53 是这一设计取舍的建议依据，不能被简化为“一律 [&]”或“一律 [=]”。[捕获合同](https://eel.is/c++draft/expr.prim.lambda.capture)、[Core Guidelines F.52/F.53](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Rf-reference-capture)

回溯 path 的 push/pop、访问标记是否撤销，是算法状态不变量，不是 lambda 语法提供的自动保证；递归深度也不因换成 lambda 改善。链式深图应结合限制比较显式栈方案，本次未测本机栈上限，不能给统一安全深度。

## 8. 字符串分段：省掉复制之后，生命周期成为前提

**标准合同。** C++17 `string::substr` 返回拥有字符的 string；`string_view::substr` 返回指向原字符的 view，pos>size 时抛 out_of_range，长度超过剩余部分会截断。view 成员默认常数复杂度，而字符比较仍依长度执行；`remove_prefix/suffix` 要求 n<=size。[N4659 string substr](https://timsong-cpp.github.io/cppwp/n4659/string.substr)、[N4659 view substr](https://timsong-cpp.github.io/cppwp/n4659/string.view.ops)、[当前 view 一般规定](https://eel.is/c++draft/string.view.template)、[N4659 remove_prefix](https://timsong-cpp.github.io/cppwp/n4659/string.view.modifiers)

```cpp
std::string source = "example";
std::size_t pos = 1, len = 3;
std::string_view whole = source;
auto piece = whole.substr(pos, len); // 借用 source；pos 已验证
// std::string_view bad = source.substr(pos, len);
// 上行会借用临时 string；完整表达式结束后不能再使用 bad 的字符。
```

该片段展示所有权差异，不是已编译程序。返回指向局部 string 的 view、把 view 存为 unordered_map 的 key 后继续修改／销毁原字符串，都需要重新设计所有者。即便内存尚未释放，修改 view 引用的 key 内容也会破坏哈希容器要求同一 key 的 hash/equality 保持一致这一前提。

`string_view::data()` 不保证末尾有 '\0'；不能当成 C 字符串接口使用。`view[view.size()]` 在 C++17 越界，不能从 string 的尾零规则类推。算法里的 `[l,r)` 需先证明 `l<=r<=size`，再计算 r-l；npos 和 size_type 都是无符号语境的常见误区。[N4659 元素访问与 data 警示](https://timsong-cpp.github.io/cppwp/n4659/string.view.access)

对于拆词、子串 DP、回溯分段：view 可避免构造每段字符副本，但不会让比较、哈希或整个 DP 自动变成 O(1)。是否值得使用，取决于拥有者能否稳定存活、是否要持久保存、原题规模与提交复杂度。C++17 先用下标对表示区间，也可能更清楚。

## 可选的 C++20/23 分支

| 可选设施 | 版本与用途 | 对 C++17 正文的处理 |
|---|---|---|
| 容器 `contains` | C++20，直接表达存在查询 | 基线写 `find()!=end()`；不宣称 contains 更快。[版本标记](https://en.cppreference.com/cpp/container/unordered_map/contains) |
| `ranges::sort` 及 projection | C++20，可按字段排序，减少比较器样板 | 仍须满足排序关系，不能把 concepts 当作严格弱序证明。[版本／接口](https://en.cppreference.com/cpp/algorithm/ranges/sort) |
| 无捕获 lambda 的默认构造 | C++20 | C++17 堆比较器仍显式传实例。[版本标记](https://en.cppreference.com/cpp/language/lambda#ClosureType::ClosureType()) |
| lambda 显式对象参数 `this auto` | C++23，另一种递归 self 接口 | C++17 保留显式 self 参数；是否能编译另看评测器支持。[版本与例子](https://en.cppreference.com/cpp/language/lambda) |
| string rvalue `substr` 重载 | C++23；改变可调用重载集 | 不把最新声明抄为 C++17，也不把它等同于 view。[版本标记](https://en.cppreference.com/cpp/string/basic_string/substr) |

本轮没有将 span、协程、并行执行策略或所有 ranges 适配器扩成必修；未出现足以证明它们能降低本任务提交代价的证据。相关功能需要时再做任务驱动研究。

## 有区分力的核验：建议方案与本次实际结果

| 风险 | 下一步有价值的检查 | 能证明什么／不能证明什么 |
|---|---|---|
| 比较次数与步进次数混淆 | counting forward iterator 对比随机访问范围；计两种操作 | 检验具体实现的调用次数，不替代标准复杂度合同 |
| top-k 边界／重复 | 空、全相等、k=0/1/n；与完整排序对照 | 检验参考实现；不能证明严格弱序对所有输入成立 |
| 计数窗口 | 独立 O(n²) 枚举短数组；重复及零频键样例 | 可查状态更新是否与定义一致 |
| 数值溢出 | 由约束推导上界；UBSan 检查真实程序测试路径 | 没有触发报告不证明所有路径无溢出 |
| 悬垂／失效 | ASan、libstdc++ debug iterator 检查；同时做寿命分析 | 地址仍可访问时的逻辑失效不保证被 ASan 捕获 |
| 递归闭包 | 类型与编译检查、复制计数对象；深链测试单独记录环境 | 单次能跑的深度不是跨平台栈安全合同 |

官方工具文档实际读取了这些部分：Clang UBSan 的 Introduction、signed/unsigned-integer-overflow、implicit-conversion 及 undefined 组排除项；ASan 的 Introduction 与 use-after-scope/return；GCC libstdc++ Debug Mode 的使用与 ABI 注意事项；GCC Warning Options 的 Wconversion、Wsign-conversion、Wsign-compare 段落。[UBSan](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)、[ASan](https://clang.llvm.org/docs/AddressSanitizer.html)、[libstdc++ Debug Mode](https://gcc.gnu.org/onlinedocs/libstdc++/manual/debug_mode_using.html)、[GCC warning options](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html)

可供后续实现线选择的本地检查命令是 `-std=c++17 -Wall -Wextra -Wconversion -Wsign-conversion`，并按已安装工具链选择 `-fsanitize=address,undefined` 或单独的 `-D_GLIBCXX_DEBUG` 构建。它们属于实施建议，**本分支没有执行这些编译命令**。UBSan 的 undefined 组不包含 unsigned-integer-overflow 和全部隐式转换检查；debug mode 会改变标准容器类型的大小／行为，不可无条件与未开启模式的容器跨翻译单元混链接。

本次环境只读检查：C 可用约 12.5 GiB、D 可用约 109.4 GiB；是本次采样，不改变所有新增数据实际放 D 的规则。`Get-Command` 在当前 PATH 未发现 g++、clang++ 或 cl；并行主代理随后发现已有名称为 `c++.exe` 的 GCC 16.2.0 工具链，将另做操作计数和接口探针。本分支未进一步搜索全盘、安装编译器或下载大型材料。因此本文件中的代码是经过规则核对的候选片段，**不宣称本分支已编译或运行**；主代理探针结果应引用其实际记录。没有运行 UB 探针，没有新增后台、账号授权或收费服务。

## 实际读件清单及剩余不确定性

实际获取方式是逐 URL `open`，并对长页用 `find`／定位继续读相关正文；不是仅收集搜索标题。下表所称“读”限定为所列条款／段落，不代表逐字读完整网站、整个标准或全部 Core Guidelines。

| 来源组 | 本轮实际核查范围 | 角色 |
|---|---|---|
| eel.is | lower.bound；alg.binary.search.general；associative.reqmts 的比较、迭代器、lower_bound；sort、alg.sorting.general、alg.nth.element、alg.partitions | 当前工作草案合同 |
| eel.is | unord.req 的等价／hash、find、rehash/reserve、引用与迭代器失效；unord.map.elem；unord.map.modifiers 的 try_emplace/insert_or_assign | 当前工作草案合同 |
| eel.is | vector.capacity/modifiers/bool；priority.queue/priqueue.members；heap general/push_heap/pop_heap；alg.remove/alg.unique | 当前工作草案合同 |
| eel.is | accumulate、conv.prom、expr.arith.conv、expr.pre、expr.shift；lambda capture/closure；string.substr、string.view.template/ops/modifiers | 当前工作草案合同，发现并隔离版本差异 |
| N4659 官方 PDF | 封面身份、日期与目录 | 官方公开原件定位；没有通读 1622 页 |
| N4659 HTML 镜像 | alg.sorting/sort/nth_element/binary.search；unord.req/unord.map.elem；associative.reqmts；vector.capacity/modifiers/bool；priority.queue；accumulate/expr.shift；lambda；string.substr、view.template/ops/access/modifiers | C++17 时代条款复核，镜像不是官方发行标准 |
| cppreference | lower_bound 的成本说明；lambda 的泛型、默认构造、显式对象参数版本；string substr；unordered_map contains；ranges sort | 非标准辅助参考；std::function 页面仅打开，未用作核心结论 |
| Core Guidelines | F.52/F.53/F.54、ES.100/103 相关正文及上下文 | 建议，不是规范 |
| LLVM/GCC | 前述诊断／debug-mode 相关段落 | 官方实现工具说明，不是本机实测 |

剩余不确定性：评测平台实际编译器／标准库版本、可用诊断运行库、时间与内存限制未在本分支核查；未对当前草案逐条做 C++17→20→23→26 全版本 diff；未验证每个库的具体实现路径和分配行为；未作岗位频率或学习效果推断。后续如果纳入完整参考程序，需要在实际工具链上编译、边界／差分测试，并单独记录结果。

研究判断：值得共同组织的主线是“将算法的不变量、操作次数、数值范围、状态寿命落实到库合同”，而不是新增一章标准库 API 目录。上述八组是可继续归并的任务关系，不预先认定它们恰好组成八章或八个固定小节。
