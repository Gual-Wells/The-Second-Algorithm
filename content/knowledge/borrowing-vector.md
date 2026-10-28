# 借用参数与容器失效

`const vector<T>&` 借用现有输入，不复制且不能经该引用修改元素；它不延长外部对象的寿命。按值参数拥有自己的容器，适合明确需要排序副本的接口；调用者传左值时可能复制，传可移动对象时可转移资源。`std::move` 只是允许按右值处理，是否实际移动取决于接收操作。

`reserve(n)` 管容量，`resize(n)` 管元素数量。仅 reserve 后用 `v[i]` 写尚不存在的元素不合法。扩容重分配使原元素指针、引用、迭代器失效；有 reserve 也不能在超容量增长后继续用旧迭代器。删除的元素本身也不能再借用。

`erase`会使擦除位置及其后的迭代器、引用失效；`push_back`即使未重分配，旧的end迭代器也失效。不能把“这次没有换缓冲区”理解成所有旧位置和边界都仍有效。

LIS中先把边界转成下标，再允许 push_back；递归事件分流中，不在持有元素引用时扩张同一vector。返回拥有数据的vector可以正常按值返回，不需要返回局部容器引用来“省复制”。

依据：[vector 容量](https://timsong-cpp.github.io/cppwp/n4659/vector.capacity)、[修改与失效](https://timsong-cpp.github.io/cppwp/n4659/vector.modifiers)、[值类别转换](https://timsong-cpp.github.io/cppwp/n4659/forward)。
