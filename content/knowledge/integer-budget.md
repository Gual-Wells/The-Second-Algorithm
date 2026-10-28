# 整数表达式与溢出预算

先推导中间量，再选类型。两个 `int` 相乘会先在其运算类型里求值，赋给 `long long` 太晚；使用 `1LL*a*b` 或先显式提升。`accumulate` 的初值决定累加器类型，`partial_sum` 按输入元素类型累加，宽输出容器不能单独补救窄输入。

有符号运算越界不保证回绕，也不会自动抛异常。`long` 在 Windows 仍可能32位；明确至少64位的实现可用 `long long`，需要精确位宽时用存在的 `std::int64_t`。无符号类型按模回绕同样可能破坏二分顺序，不能当作修复。

`lo+(hi-lo)/2` 只在差可表示时安全；含负哨兵或全64位跨度必须另推合同。C++20 的 `std::midpoint` 不能无标注用于C++17。上中点也要审查 `hi-lo+1`。

判定只需“达到k”时，可在达到目标后饱和，避免无意义的大计数；先溢出再 `min` 已经无效。乘积判定可在正数条件下改为除法，例如 `m<=x/m`，另处理 m=0。移位前确认位数合法、结果可表示，不把 `1<<j` 当任意宽整数。

依据：[表达式求值](https://timsong-cpp.github.io/cppwp/n4659/expr)、[累加](https://timsong-cpp.github.io/cppwp/n4659/accumulate)、[部分和](https://timsong-cpp.github.io/cppwp/n4659/partial.sum)。
