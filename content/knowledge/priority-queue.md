# 优先队列与堆接口

`priority_queue<T>` 默认用 `less<T>`，top是最大者；最小堆常写 `priority_queue<T,vector<T>,greater<T>>`。比较器仍需严格弱序，优先级方向应从“谁留在堆顶”验证，而非凭函数名称猜。

`top()` 只读观察，`pop()` 删除且不返回被删值。要先把需要的值复制出来，再pop；不能保留top引用后继续使用被删除或因重排改变的元素。空堆不能top/pop，接口不会承诺为这个前提错误抛出可捕获异常。

push/pop的堆调整通常为O(log n)，top为O(1)；已有范围构堆与逐个push不同，前者调用make_heap可线性建堆。容器分配成本仍存在，不能把对数调整次数当作每次操作严格没有其他成本。

依据：[C++17 priority_queue](https://timsong-cpp.github.io/cppwp/n4659/priority.queue)、[堆算法](https://timsong-cpp.github.io/cppwp/n4659/alg.heap.operations)。
