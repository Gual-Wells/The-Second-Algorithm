# 选择算法与重排语义

`nth_element(first,nth,last,comp)` 把nth处变成完整排序后应在该位置的元素，并保证左部不大于右部（按comp解释）；两侧内部并不排序。普通非执行策略版本平均线性，不是最坏线性承诺。

取最大的m项求和，可用 `greater<>` 且nth置于begin+m，再求前m项和；m等于总数时直接求和即可，不需要选择。它会重排输入；保留原顺序需副本或索引，不能一边借用元素引用一边默认其位置不变。

`sort` 提供完整次序但代价为O(n log n)比较。哪一个更合适由下一步是否需要完整顺序决定。隐式数对集合若先物化再选择，内存已变成O(n²)，不能仅看nth_element本身就称同资源解。

依据：[C++17 nth_element](https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element)、[sort](https://timsong-cpp.github.io/cppwp/n4659/sort)。
