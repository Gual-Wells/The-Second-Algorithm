# 递归lambda与调用栈

C++17中，递归可以用命名函数、成员函数、`std::function`，也可以用带显式self参数的泛型lambda。`std::function` 通过类型擦除，以统一接口保存不同类型的可调用对象，可能引入间接调用和分配；显式self的写法则不必先经过这种包装。

在 `auto dfs = [&](auto&& self, int u) -> bool { … self(self, v); … };` 中，self参数接收当前闭包本身，递归时再把它传下去。返回类型需要时可显式写出。这里的引用捕获仍遵守[[Q100003|lambda捕获的生命周期要求]]，不能因为回调递归就忽略被引用对象的寿命。

若回调借用了局部对象，就不能把它保存到局部作用域之外。递归过程中修改容器时，也要检查原有元素引用是否因扩容而失效。

最后还要估计递归深度。长度为二十万的链式DFS，可能需要同样多的栈帧；沿值域分治则通常只有对数深度。这两类递归不能沿用同一个空间估计。深度过大时应考虑显式栈或迭代，语言标准不保证固定的大递归栈或尾调用消除。

依据：[lambda](https://timsong-cpp.github.io/cppwp/n4659/expr.prim.lambda)、[function](https://timsong-cpp.github.io/cppwp/n4659/func.wrap.func)。
