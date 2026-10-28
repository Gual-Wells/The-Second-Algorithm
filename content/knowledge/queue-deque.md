# 队列和双端队列的状态

`std::queue`提供先进先出，常用front/push/pop；`std::deque`允许两端插入删除，适合维护单调候选队列。它们只提供容器操作，不会自动维护“已经访问”“候选未过期”或“值单调”等算法不变量。

访问front/back前检查非空；删除元素后不能继续使用它的引用。deque两端插入使迭代器失效，但保留既有元素引用的有效性；中间插入的规则不同。按下标保存候选位置，可以把过期检查与实际输入前缀绑定，不需要持有deque迭代器跨修改。

数组队列若容量覆盖所有最多入队次数，头尾下标即可O(1)推进；vector.erase(begin())会移动后续元素，不能把它当O(1)出队。单调队列“每元素至多进出一次”的线性总成本来自算法证明，不是deque这个类型名的保证。

依据：[queue](https://timsong-cpp.github.io/cppwp/n4659/queue)、[deque修改](https://timsong-cpp.github.io/cppwp/n4659/deque.modifiers)。
