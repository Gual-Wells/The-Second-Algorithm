# 递归回调与调用栈

C++17可用命名函数、成员函数、`std::function`或显式self参数的泛型lambda表达递归。`std::function`提供类型擦除，可能引入间接调用和分配；泛型lambda不必先做这种擦除，但所有借用仍须满足 [[Q100003|lambda捕获寿命]]。

`auto dfs=[&](auto&& self,int u)->bool { … self(self,v); … };` 的self传入当前闭包，返回类型必要时显式给出。不要把持有局部引用的递归回调保存到局部作用域之外，也不要在修改容器导致重分配后继续用旧引用。

正确递归不代表栈空间足够：n=2×10⁵的链可能有同等深度。对数值域分治深度约log U，与图DFS的线性最坏深度不同，应按实际结构改显式栈/迭代。语言标准没有承诺固定的大递归栈或尾调用消除。

依据：[lambda](https://timsong-cpp.github.io/cppwp/n4659/expr.prim.lambda)、[function](https://timsong-cpp.github.io/cppwp/n4659/func.wrap.func)。
