# 比较器与排序合同

`sort` 的比较器应定义严格弱序：自身不小于自身，比较关系和由“不互相小于”定义的等价关系都应满足传递性。`a<=b` 会使相等元素也被判成更小，不是合法替代；不要通过相减的正负判断顺序，减法可能溢出。

复合排序必须先按第一关键字区分，再处理真正相等时的第二关键字。例如信封宽升序、同宽高降序；这是算法归约需要的次序，不是所有 pair 默认字典序都能替代。不要在浮点比较器中随意加 epsilon，近似等价可能破坏传递性；NaN 同样会破坏正常的排序推理。

对固定key，`lower_bound` 实际要求的是 `comp(element,key)` 分区；`upper_bound` 则比较相反参数方向。这与为了排序所需的全域严格弱序应区别。异构记录查询需要写对方向，不能把某个只接受 `(Record,Key)` 的回调原样塞给 `upper_bound`。

依据：[C++17 排序关系](https://timsong-cpp.github.io/cppwp/n4659/alg.sorting)、[二分合同](https://timsong-cpp.github.io/cppwp/n4659/alg.binary.search)。
