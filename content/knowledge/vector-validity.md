# vector容量、元素与位置失效

`reserve(n)`只管理容量，`resize(n)`会改变元素数量。仅reserve后用`v[i]`写入尚不存在的元素不合法；预留容量也不能被当成元素已经构造。需要按下标填充时先确定size，需要逐个追加时用push_back或emplace_back。

重分配会使指向原元素的指针、引用和迭代器全部失效。`push_back`未重分配时，原元素引用与迭代器仍有效，但旧的end迭代器失效；插入或擦除还可能移动后缀。`erase`使擦除位置及其后的迭代器和引用失效，不能把“缓冲区没换”理解成所有旧位置仍可使用。

LIS先把lower_bound结果转成下标，再允许push_back；若保存原迭代器，增长后不能继续解引用它。递归事件分流也不应持有某个元素引用后再扩张同一vector；已知大小的共享缓冲区可以写入不同范围，但仍须说明递归时各范围的所有权。

`unique`只把相邻等价元素压到前缀，返回新逻辑结尾，并不缩小容器；通常以`erase(newEnd,end)`完成删除。`sort/unique/erase`之后，原下标未必继续指向原元素。本章压缩表在完成这些操作后才按值重新查秩，因此不依赖旧位置。

依据：[vector容量](https://timsong-cpp.github.io/cppwp/n4659/vector.capacity)、[vector修改](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)、[unique](https://timsong-cpp.github.io/cppwp/n4659/alg.unique)。
