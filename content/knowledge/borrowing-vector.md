# 借用参数与结果所有权

`const vector<T>&` 借用现有输入，不复制且不能经该引用修改元素；它不延长外部对象的寿命。按值参数拥有自己的容器，适合明确需要排序副本的接口；调用者传左值时可能复制，传可移动对象时可转移资源。`std::move` 只是允许按右值处理，是否实际移动取决于接收操作。

返回`string`、`vector`或装有值的`optional`会把结果交给调用者拥有，适合调用后仍需使用的数据；返回指针、引用、迭代器或索引则依赖原对象继续存活，并且后续修改不能使该位置失效。不能返回局部容器引用来“省复制”。按值返回可正常利用返回值优化或移动，不要机械添加`std::move`。

借用不等于永远有效：若容器发生结构修改，原位置是否还能使用取决于具体操作，见[[Q100013|vector容量、元素与位置失效]]。当前接口返回记录字符串副本，避免把对历史容器的引用带出；其复制成本仍应计入接口。

依据：[函数调用与参数](https://timsong-cpp.github.io/cppwp/n4659/expr.call)、[返回语句](https://timsong-cpp.github.io/cppwp/n4659/stmt.return)、[复制省略](https://timsong-cpp.github.io/cppwp/n4659/class.copy.elision)、[值类别转换](https://timsong-cpp.github.io/cppwp/n4659/forward)。
