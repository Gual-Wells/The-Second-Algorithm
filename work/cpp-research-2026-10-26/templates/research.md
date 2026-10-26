# 泛型与约束：从实际问题到参考实现

本轮读取范围见 [actual-reads.json](actual-reads.json)。四种教材的目录用于反查，不充当正文已读；Challenge的100个题干已实际读取，解答只读取单独登记的范围。本稿的核心输入是模板练习、通用容器与调用问题，不是先照语言目录写一遍教程。

## 归并结果

通用调用首先拆成三个不同合同：实参类型与值类别是否保留、返回值是借用还是拥有、是否要以统一类型容纳结果。`invoke_forward`保留调用接口；`append_many`按顺序消费元素；`minimum_value`主动选择共同值类型，不承诺无条件保留原数值的比较语义。

类型选择再分为萃取、类模板偏特化、表达式检测、按优先级分派以及依赖名查找。它们解决的问题不同，不能统一压成“会写模板”。C++20约束的条目承接C++17检测，并明确编译器能检查的表达式与不能自动证明的语义条件。

固定容量队列是综合实作：类型实参、非类型实参、对象存活、环形下标、构造失败提交点、复制扩容和接口能力共同出现。它采用满时拒绝，而[容器稿](../../../content/cpp/容器与范围.source.md)的运行时ring采用覆盖；两者是不同合同。

## 来源中的关键问题与修正

| 实际读件 | 判断与作者稿处理 |
|---|---|
| Challenge18递归minimum | 递归形式缺少单实参终点；混合类型的返回策略也须单独决定。改为至少一个实参、公共值类型、拥有结果的fold，并测单实参。 |
| Challenge19批量追加 | `Args&&...`接收后直接使用命名参数会丢失右值性质。作者代码逐个forward，实际测试unique_ptr。不是把`&&`写进参数就算完美转发。 |
| Challenge39计时 | 按值接收`Args...`后再forward不能恢复调用者原接口；high_resolution_clock也不保证单调。参考实现按转发引用接收，测量间隔使用steady_clock。 |
| TDDD38 Mixed Templates | alias template并非C++17才有：别名模板语法始于C++11，许多标准`_t`别名是C++14，`_v`变量模板通常是C++17。按具体设施区分版本。 |
| TDDD38 SFINAE | 不能以简化的四步口诀替代真实的候选形成、可行性、转换排序和偏序。本稿只实现已核对合同的priority tag分派。 |
| DMC提取文本 | 干净Unicode文本仍含数学`≪`替代C++`<<`；无替换字符不等于可编译代码。保留原件，参考实现独立编写。 |
| Concepts与约束排序 | 原子约束身份与规范化参与subsumption，不是对任意布尔表达式进行数学蕴含证明。概念满足也不证明比较器严格弱序或返回对象不悬垂。 |

规则核对使用历史版本的[N4659参数推导](https://timsong-cpp.github.io/cppwp/n4659/temp.deduct.call)、[依赖名](https://timsong-cpp.github.io/cppwp/n4659/temp.dep)、[pack展开](https://timsong-cpp.github.io/cppwp/n4659/temp.variadic)、[替换的immediate context](https://timsong-cpp.github.io/cppwp/n4659/temp.deduct)、[std::function目标要求](https://timsong-cpp.github.io/cppwp/n4659/func.wrap.func.con)以及[N4861约束排序](https://timsong-cpp.github.io/cppwp/n4861/temp.constr.order)。这些是对应年代工作草案，不能将滚动草案中新加入的语言直接称为C++17。

## 实作中进一步发现的问题

StaticQueue若直接默认逐成员赋值，元素赋值抛异常时可能已修改一部分optional槽，而head和size仍对应另一种布局，破坏耦合不变量。本参考接口不要求赋值，明确删除赋值操作；没有假装实现一个完整标准容器。构造失败通过提交size之前抛出，copy_and_expand在新对象上工作；测试注入构造和复制失败，核对源队列次序及存活对象数。

fold表达式的逗号保证函数体内动作顺序，却不规定调用此函数时实参表达式的求值顺序。空pack的all为true、any为false；minimum则要求至少一个值。数组边界推导包含字符数组末尾NUL。forwarding reference也不等于任意位置出现的`T&&`。

## 实际验证与边界

`tests/cpp/cpp_generic_test.cpp`按C++17、20、23分别编译运行；覆盖引用返回、ref-qualified调用、move-only实参、空pack及短路、单值minimum、ADL、tuple空输入、队列随机操作与std::deque模型对照、环回、扩容、异常注入和资源计数。C++20实际实例化约束与缩写模板；C++23在库功能宏存在时实际调用move_only_function。

测试不执行悬垂、越界或其他UB来猜语言规则；一次通过不替代标准合同。当前工具链及集成后的最终结果由总报告记录。

表达式模板的别名与求值、allocator／内存池、CRTP mixin、结构化非类型实参、协程及复杂类型计算仍是明确后续分支。当前几段通用代码不能代表这些分支已经完成。
