# 优先队列的使用与代价

`priority_queue<T>` 默认采用 `less<T>`，堆顶是最大元素。需要最小元素优先时，常写 `priority_queue<T, vector<T>, greater<T>>`。判断比较器方向时，应检查最终是谁留在堆顶；自定义比较器仍须满足严格弱序。

`top()` 只观察堆顶，`pop()` 删除堆顶而不返回它。若后续还需要这个值，应先复制到局部变量再删除。不能保存top返回的引用，再继续使用已经删除或因堆重排而改变的元素。

调用top或pop之前要保证堆非空。违反这个前提时，接口不承诺抛出一个可捕获的异常，不能依赖try/catch来弥补检查缺失。

一次堆调整通常需要 `O(log n)`，观察堆顶为 `O(1)`。如果初始数据已经全部存在，基于整个范围调用make_heap可以线性建堆；逐个push的过程与此不同。底层容器仍可能分配内存，所以对数调整次数并不表示操作没有其他成本。

依据：[C++17 priority_queue](https://timsong-cpp.github.io/cppwp/n4659/priority.queue)、[堆算法](https://timsong-cpp.github.io/cppwp/n4659/alg.heap.operations)。
