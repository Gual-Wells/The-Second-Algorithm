# 新第一章实现交接（本轮新建，不取旧源码）

主题：区间上的取舍，覆盖、冲突、资源与收益。命名空间 `interval_decisions`，C++17。所有输入按各原题合法合同；无恶意/损坏输入恢复义务。坐标用long long，通常限绝对值不超过10^9、n/查询数不超过200000；stabbing_points另覆盖LC452的完整32位端点范围，其实现只比较/保留端点、不做加减。长度/负载/总收益界分别按原题推导，不承诺任意64位整数端点的安全算术。

权威代码将新建于 `content/interval-decisions/区间上的取舍.cpp`，正文 `区间上的取舍.source.md`。临时语义不承接旧稿；旧Q1–26身份保留历史，新主讲统一从Q000027开始，不意味着旧内容已学。

## 数据与接口

```cpp
enum class EndpointPolicy { HalfOpen, Closed };
struct Interval { long long start, end; };
struct LoadInterval { long long start, end, load; };
struct Job { long long start, end, reward; };
struct Allocation { int rooms; std::vector<int> room_for; };
struct CoverResult { bool possible; std::vector<int> chosen; };
struct Plan { long long reward; std::vector<int> chosen; };
struct Containment { std::vector<int> contains, contained; };

std::vector<Interval> merge_closed(std::vector<Interval> ranges);
std::vector<Interval> insert_closed(const std::vector<Interval>& disjoint, Interval added);
Containment containment_flags(const std::vector<Interval>& ranges);
long long peak_load(const std::vector<LoadInterval>& ranges, EndpointPolicy policy);
Allocation allocate_manual(const std::vector<Interval>& ranges, EndpointPolicy policy);
Allocation allocate_standard(const std::vector<Interval>& ranges, EndpointPolicy policy);
Allocation allocate_heap_algorithms(const std::vector<Interval>& ranges, EndpointPolicy policy);
std::vector<int> choose_activities(const std::vector<Interval>& ranges, EndpointPolicy policy);
std::vector<long long> stabbing_points(std::vector<Interval> ranges);
CoverResult minimum_cover(const std::vector<Interval>& ranges, long long target);
std::vector<int> choose_k_resources(const std::vector<Interval>& ranges, int k, EndpointPolicy policy);
int compatible_prefix_manual(const std::vector<long long>& ends, int count, long long start, EndpointPolicy policy);
int compatible_prefix_standard(const std::vector<long long>& ends, int count, long long start, EndpointPolicy policy);
Plan weighted_manual(const std::vector<Job>& jobs, EndpointPolicy policy);
Plan weighted_standard(const std::vector<Job>& jobs, EndpointPolicy policy);
long long bounded_weighted(const std::vector<Job>& jobs, int max_jobs, EndpointPolicy policy);
std::vector<long long> minimum_query_lengths(const std::vector<Interval>& ranges, const std::vector<long long>& queries);
```

chosen均为原输入0基下标；分配room_for保持原序、房号1..rooms。方案有多解，不强求唯一选法或房号。所有函数不修改调用者输入；按值排序或局部索引副本用途分别解释。空输入自然返回空/0；minimum_cover要求target>0。Closed允许start=end的单点/单日；HalfOpen要求start<end，不把空半开区间当活动。Closed兼容end<next.start；HalfOpen兼容end<=next.start。

- merge_closed闭区间相接合并；insert_closed前置是按start有序、互不相交（前end<后start）的闭区间并集，线性扫描。
- containment_flags按CSES2168的无完全重复区间合同，只做存在性；排序start升/end降后前缀max和后缀min回写原序。计数不是该函数已完成能力。
- peak_load的load为正整数且<=10^9。事件扫描：Closed同刻先增加后减少，HalfOpen先减少后增加。CSES1619原题时间全异，单位load=1；LC1094为半开带权负载，容量判定复用峰值。
- allocate三版实现同一最早释放房间算法，分别是手写二叉小堆、priority_queue、vector+push_heap/pop_heap；不是三种不同贪心。可用默认pair字典序作(time,id)；手写需要真实上浮/下沉。
- choose_activities按结束排序的最大数量选择；最少删除=总数减选择数，不复制整份算法。stabbing_points按闭区间右端点选最少命中点，语义/端点与前者分开证明。
- minimum_cover覆盖实时间段[0,target]，片段可剪切，选最远可达右端点，不能进展则possible=false且chosen为空；零长度片段不能推进。返回最少片段的一个见证。
- choose_k_resources固定k同质资源、最大场数；k在[0,n]，原CSES为[1,n]。multiset只存已使用资源的最后释放时刻；找最大兼容前驱，无兼容但尚可新增资源时新增，不用虚构负无穷哨兵。不可只用最小堆。
- compatible_prefix_*返回已排序ends的前count项中兼容项数，范围[0,count]；Closed用lower_bound，HalfOpen用upper_bound，手写要区分严格性。
- weighted两版共享同一选择/跳过DP，只前驱搜索分别手写/标准；排序end后保存原ID并回溯一份最优计划。reward为[0,10^9]，原CSES/LC为正。没有标准库能替你推导整个DP；不可称一键库解。
- bounded_weighted为单资源至多max_jobs项的收益，复用前驱、增加预算层；按预算外层/prefix内层用两vector滚动，不按i只保相邻行。仅返回值，不承诺方案恢复。LC1751中n*k<=10^6、n可达10^6、value<=10^6，k<=n使k<=1000故平台int结果<=10^9；这是真实原题例外，不套前面通常n<=200000。helper允许空和k0，合法k非负；复杂度O(nlogn+n*min(k,n))、空间O(n)。
- minimum_query_lengths为闭整数区间最短覆盖查询，长度end-start+1，缺失-1；离线查询排序、按左端点纳入、最短长度小堆和堆顶过期删除，恢复查询原序。与资源堆共享设施但不共享贪心证明。

## 输出与验证

核心参考cpp默认无main。将另外提供实际CSES和LC入口，按各平台合同编译并用stdin/stdout或适配器驱动核验。入口包装置于正文末的参考部分，不截断算法主线。API仅用于分工协同，不把本文件内部审计表或大写合同粘进学习正文。

独立测试必须用子集/分配/线性枚举等模型，不只三种堆相等；核方案合法与最优值，不要求唯一答案。固定k选子集用并发深度判定k可着色，收益用子集排布枚举；每种endpoint policy与重复端点、原序、空输入、单点闭区间、无解、整数上界分别处理。规模/性能检查不代替正确性枚举。
