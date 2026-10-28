# 知识权威与正文使用的独立交叉审阅

2026-10-28。实际读当前12份 `content/knowledge/*.md`，四份binary source中全部首次内嵌与相关引用，配合当前C++调用核对；没有修改任何作者/知识文件。本报告不把先前已在修的连续根、LIS中间计数当成未修问题。

## decision三项定点回应复核

已读当前 `decision.source.md`：

- 固定队列加入K/K+1有序可用时间逐项支配归纳，正确覆盖“状态变化后为何仍单调”，没有偷假设任务始终分到相同台位。
- 匹配加入对称差必有增广路、逐行保持前缀最大、成功增1/失败保持的闭环；与实际Kuhn及列visited一致。
- P1419左前缀已改为 `[max(0,r−T),r−S]`，r≥S，符合代码。

三项均已到位。当前source SHA256为 `277cf37eaa3a48301ae3950a4eeaa0be63059d216711e57ce5f228c576510615`。代码未变，未重复运行同一批已绿测试。

## 合同结论

**未发现会使当前四读件实现失效的知识权威错误。**核心的分区/比较方向、输入累加类型、标准复杂度、借用寿命、算法状态与设施责任边界均匹配实际使用。另有两条值得短句校正的真实合同精度问题，不需要扩成新的C++课程：

1. `queue-deque.md`的“两端插入……通常不使既有元素引用失效”可去掉“通常”。C++17对此是明确保证，不是实现惯例；中间插入才使全部迭代器与引用失效。[N4659 deque modifiers](https://timsong-cpp.github.io/cppwp/n4659/deque.modifiers)本轮已实际读。
2. `borrowing-vector.md`目前讲了重分配与被删元素，宜补足本章实际涉及的两条因果：erase使擦除点及之后的迭代器/引用失效；push_back即使未重分配，旧end仍失效。这能准确解释LIS为什么先取下标、动态删除为什么不能保留原位置语义。不是建议穷举所有容器API。[N4659 vector modifiers](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)本轮已实际读。当前源码本身已经避免这类误用，未见由缺句引起的执行错误。

第一条是把弱化的保证写准，第二条是补当前场景直接需要的关键规则；不将其夸大成项目存在严重安全漏洞。

## 逐份匹配性

| 权威文件 | 本轮核查与实际使用 |
|---|---|
| binary-library.md | lower/upper比较参数相反、尾哨兵、前驱、分区而非必须全排序、比较次数和迭代器步进分开，符合C++17实际条文。适用于时间记录、矩阵逐行、LIS、任务前驱、频数前缀、值压缩和祖先路径 |
| integer-budget.md | 先提升再算、accumulate初值类型、partial_sum输入value_type、差值/中点/移位预算正确。实际权重实现先转64位再扫描；参数分配明确最终值fits不保证任意H(λ)fits；计数饱和没有被写成精确大计数 |
| predicate-capture.md | 重复候选同一事实、状态重建、同步借用与延迟悬空、回调可能被复制准确。当前heap/seen/差分每次check重建；仅访问器指定out_of_range映射域结束，没有catch-all |
| ordering.md | strict-weak-order与仅对固定key分区的合同区分，异构上下界方向正确。信封宽升高降是算法条件；浮点排序未用epsilon回调；没有将比较器相等偷换为operator== |
| borrowing-vector.md | 参数借用/值拥有、move并非保证移动、reserve与size分开、局部引用返回风险均匹配代码。LIS先转下标、时间记录返回string副本、动态事件扫描不扩events正确；建议补上述两条具体失效规则 |
| floating-search.md | 浮点停滞、绝对/相对/残差、连续性与单调性不同、long double平台差异均有。当前连续根正文已改用归一与导数分隔，不再依据旧单位扫描报告误判；平均/比值明确固定轮数不等于任意精度证明 |
| priority-queue.md | 默认最大/greater最小、top观察/pop无返回、先拷贝再pop、构堆与逐push成本分开正确。舞台std版是同算法换堆结构；参数分配堆是同题另一算法，未混淆 |
| selection-reorder.md | 普通nth_element平均线性、两侧不排序、原地重排、top-m分隔正确。比值检查正好只需和；m=n跳过；隐式数对全物化未冒称同资源解 |
| recursive-callback.md | C++17显式self与std::function、类型擦除/可能分配、引用寿命、log值域栈与线性链栈不同，符合实际实现。动态kth的回调借用局部容器在调用结束前存活；祖先遍历为显式进出事件 |
| random-integers.md | 闭区间均匀票号、引擎按引用复用、固定seed非跨库分布格式、非密码学源的边界合理。权重inverse由确定票号计数保证概率，未拿抽样频率作唯一正确性证据 |
| queue-deque.md | BFS入队标记、单调候选窗口过期与支配分别归算法，容器不“自动保持单调”；front先拷贝再pop，数组队列与vector头删成本有区分。建议把deque两端引用保证写精确 |
| stable-events.md | partition不稳定与stable_partition保组内次序区分、不能先统一做完全部修改、缓存分流决定再搬事件，正确对应动态kth。std稳定分区没有被承诺成一律无额外空间且线性 |

本轮针对易错合同实际打开N4659的 [binary search](https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search)、[partial_sum](https://timsong-cpp.github.io/cppwp/n4659/partial.sum)、[nth_element](https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element)、[partition](https://timsong-cpp.github.io/cppwp/n4659/alg.partitions)、[priority_queue](https://timsong-cpp.github.io/cppwp/n4659/priority.queue)、[uniform_int_distribution](https://timsong-cpp.github.io/cppwp/n4659/rand.dist.uni.int)以及上述两份modifier原文；不声称把所有相关标准章节逐条重读。

## 首次内嵌与阅读负担

实际标记扫描为12次唯一首讲，无重复全文内嵌：boundary放Q100001/4/5、Q100002/3、Q100006；decision放Q100007/9/11/8；selection放Q100010；advanced放Q100012。后续使用语义链接，不让读者管理ID。

它们不是放在章前的语言先修课：先给具体问题、机制、代码与当前成本，再出现相关合同；卡内也没有重讲数组、循环或基础程序语法。reserve/resize、宽累加器等虽简单，却是当前实现的真实C++细节，不能因为读者科班就删掉。

最密处是第一个题型末尾连续三卡，完整内容涉及未来信封、LIS、事件分流等场景。这个局部会拉长首次读题后的停顿，但当前仍有实际对应：异构时间查询、string副本与边界。**不判为阻断性的前置术语墙，也不建议为了形式统一机械拆卡或重建系统。**若实机通读觉得节奏停顿，可以把完整排序合同移至首次sort场景，首题保留比较方向的当前解释和浮窗入口；权威内容本身不必删除。是否值得移动应以实际读感验收，不以标记数量决定。

## 同方法换设施与同题不同算法

当前正文未见把以下不同算法误说成仅换API：

- 配对异常的xor明确O(n)且不能满足原题对数要求；旋转搜索的线性库查找也没有冒称保持对数。
- 整数根的sqrt估计后整数修正明确依赖不同证书，不承诺每个平台恒零修正。
- 矩阵楼梯计数与逐行upper_bound、数对窗口与逐点上界，写明判定组织及成本不同。
- 双序列std::merge明确线性，与对数切分不混；egg-drop覆盖DP与二分组合计数明确为不同求值路径。
- Fenwick提升与线性重建前缀、摘要下降与find_if、LCA提升与祖先链std::find均明确成本和层次。
- 循环分段两版确实共享提升核心，只在next构造用滑窗或前缀上界；时间PBS的std支撑没有伪造std DSU；动态kth的sort/unique只负责压缩。
- 参数分配的priority_queue明确另一贪心算法而非WQS的std版。正文与已拆分的method分组方向一致。

以上为读取当前文字与调用关系后的有限结论，不宣称其余全部数学/性能已由本次重新验证。没有再次运行未变化的测试，也没有做格式洁癖式清单扩张。
