# 二分库函数与迭代器

`lower_bound` 和 `upper_bound` 接收半开范围 `[first, last)`，返回一个迭代器。对于升序整数，前者定位第一个不小于 key 的元素，后者定位第一个大于 key 的元素；如果不存在，就返回 last。返回的只是位置，解引用前要先检查它是否等于 last。

自定义比较器时，要留意两个函数的参数方向。`lower_bound(first, last, key, comp)` 以 `comp(element, key)` 为判断，找它首次为假的位置；`upper_bound` 使用 `comp(key, element)`，找它首次为真的位置。查询记录中的一个字段时，回调参数类型和比较方向都要相应调整。

这组函数搜索的是已有的分区，并不替调用者排序。全局有序通常足以满足要求；旋转数组或仅按行、列分别有序的矩阵，展平以后却未必满足。`partition_point` 也是定位真前缀的结束，前提是这个真前缀已经存在。

空范围是合法输入。若要从返回值向前取前驱，还须先确认它不等于 first。两个迭代器之差可用于计算元素数量；需要转成 int 时，再检查规模是否能由 int 表示。

复杂度中的对数首先指比较次数。vector 支持随机访问，移动到中点也很便宜；对普通前向迭代器，累计移动次数仍可能达到线性。查询 set 或 map 时，优先用容器自己的 `lower_bound`，它能沿树结构查找，通用算法则不能利用这些内部链接。

依据：[C++17 二分算法](https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search)、[分区算法](https://timsong-cpp.github.io/cppwp/n4659/alg.partitions)。
