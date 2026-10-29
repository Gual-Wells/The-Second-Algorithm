# vector的容量与引用失效

`reserve(n)` 预留容量，`resize(n)` 改变元素数量。仅reserve以后，原本不存在的元素并没有被构造，因此不能直接用下标写入它们。需要按下标填充时，先确定size；需要逐项追加时，使用push_back或emplace_back。

重分配会使指向原元素的指针、引用和迭代器全部失效。push_back没有发生重分配时，原元素引用和迭代器仍有效，但原来的end迭代器会失效。插入或擦除还可能移动后缀；例如erase会使擦除位置及其后的迭代器和引用失效。缓冲区没有更换，不等于所有旧位置都仍可使用。

在LIS实现中，先把lower_bound返回值转成下标，再允许push_back。这样后续使用的是逻辑位置，而不是一个可能被扩容破坏的旧迭代器。递归事件分流同理，不应持有某元素的引用后再扩张同一个vector。共享缓冲区若写入互不重叠的范围，也需要明确每层递归负责的范围。

`unique` 还有一个常见误解：它只合并连续出现的重复值，并返回新的逻辑结尾。例如 `[1, 1, 2, 1]` 的有效前缀变成 `[1, 2, 1]`，末尾的1不会被跨位置合并，容器的size此时仍为4。通常还需 `erase(newEnd, end)` 才真正删除尾部。排序、去重和擦除完成后，旧下标未必还指向原元素；坐标压缩应在这些操作结束后，按值重新查找位置。

依据：[vector容量](https://timsong-cpp.github.io/cppwp/n4659/vector.capacity)、[vector修改](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)、[unique](https://timsong-cpp.github.io/cppwp/n4659/alg.unique)。
