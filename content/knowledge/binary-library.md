# 二分库的分区与迭代器合同

`lower_bound(first,last,key,comp)` 找第一个不满足 `comp(element,key)` 的位置；`upper_bound` 找第一个满足 `comp(key,element)` 的位置，比较参数方向相反。升序整数中，它们分别是首次≥key、首次>key；返回值可以是 `last`，不能未经检查就解引用。

这些算法要求当前范围对相应表达式已分区。全局排序是常用充分条件；旋转数组、仅行列有序的矩阵展平后并不自动满足。`partition_point` 寻找已有 true 前缀的结束，也不会替调用者重排或证明分区。

`[first,last)` 是半开范围，允许空；前驱要先检查返回值不等于 `first`。使用迭代器差得到个数后，只有确认规模能放入目标整数，才缩窄为 `int`。

对数保证针对比较次数。`vector` 的随机访问使移动也为对数；普通前向迭代器的总递增可线性。`set`/`map` 查询优先用成员 `lower_bound`，不要用通用算法在树迭代器上线性走。

依据：[C++17 二分算法](https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search)、[分区算法](https://timsong-cpp.github.io/cppwp/n4659/alg.partitions)。
