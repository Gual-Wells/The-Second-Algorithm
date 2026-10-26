# 并发、任务与翻译链接：研究结论

2026-10-26。此分工先完成研究，再基于已闭合材料写两份作者稿；未改共享catalog或教材原件。实际读件见`actual-reads.json`，作者映射见`author-map.json`；当前归并为42个候选机制／实作模式，不是42个算法或42道已验证习题。

## 应当如何形成可用内容

这部分不能按`thread → mutex → future`的API说明顺序直接抄成课程。比较有效的主线是四类代码问题：

1. **工作交给谁、活多久、如何取回结果**：值／移动／借用参数、作用域收尾、错误通道、取消、future状态与async策略。
2. **多方共享怎样保持条件与收尾正确**：RAII锁、双对象操作、阻塞队列、关闭排空、谓词／超时、一次性初始化、按记录输出。
3. **原子更新与并行分解**：RMW和load/store的差别、计数与发布协议的差别、CAS失败重算、块划分与合并，现代同步原语另标版本。
4. **同一份代码在分文件之后为什么变了**：TU与链接阶段、头保护与ODR、inline、内部链接、模板可见性、前置声明／完整类型、功能探测。

这些是根据已读实际问题的归并建议，不是锁定四章。模板/Pimpl与语言作者组交叉定位；通用并行算法的数学推导由算法册承载，这里讲C++的任务划分、对象寿命、资源收尾、错误与接口条件。

## 来源承担不同责任

Professional 6e有较完整的标准库构件及后台logger逐步改进例，适合作为机制和状态关联的母本；第27章的停止、暂停／恢复、并发Fibonacci、屏障启动、atomicMin六道练习是可用实际任务。Cookbook 2e的promise／future和显式async策略配方较便于落地；Challenge61/63/65给出并行变换、并行极值及日志实作题。

但书例不是可以不加条件搬进总册的参考实现。规则核验优先使用明确版本的N4659条款：`intro.races`、`atomics.order`、`futures.async`、`futures.unique_future`、`basic.def.odr`、`basic.link`、线程join与hardware_concurrency条款。此处读取的是C++17近最终工作草案的HTML呈现，不是拿滚动C++26草案判断C++17。C++20 jthread／atomic_ref／wait、同步原语以及C++23标准库模块另作版本分支。

CERT并发目录实际枚举到7项直接C++规则和5项继承C规则；只完整研究了CON53锁顺序和CON54谓词等待的代码病例，其他目录项没有伪装成正文已读。Guidelines、cppreference及编译器文档辅助核查，不把它们的目录数计为训练题数。

## 关键归并与需要保留的差异

- 线程参数的值拷贝、move-only转移、引用借用、成员函数this，以及闭包捕获不能缩成同一句“多线程传参”。`std::ref`不会延长源对象寿命；正确共享读取也不自动构成数据竞争。
- join解决句柄收尾并建立线程完成后的同步；detach不是延长被借用对象寿命的办法。裸线程入口抛异常与future重抛是不同问题。
- mutex保护的是数据不变量和操作整体。atomic变量的`load()+store()`仍不是原子读改写；对象字段的锁也不能由shared_ptr引用计数线程安全代替。
- CV必须以共享状态作谓词。通知不是有记忆的事件；先通知后等待、虚假唤醒、多种等待条件、关闭排空和超时分别有实质变种，不能只背一个`while`循环。
- 一个队列示例至少应明确：关闭后是否接收新项、现有项是否排空、等待者何时醒、join时是否仍持锁、线程成员和共享状态的构造／析构顺序。无需升级成大型任务平台才能讲清这些。
- future的`valid()`不是ready；`wait_for`返回ready/timeout/deferred，`get()`消费普通future状态，`shared_future`有另一个使用合同。`packaged_task`包装结果通道但不自动调度。
- 默认async允许deferred，因此不能靠默认调用保证并发；异步shared state的最后释放可能等待，而deferred任务可以根本不运行。资源、执行和结果通道需分开考虑。
- relaxed计数与release/acquire发布普通payload不能互换；CAS失败更新expected是下一轮desired的输入。原子类型未承诺一定lock-free，锁自由也不是任何调用必然立即完成。
- 按核数分块只是策略。hardware_concurrency可为0，空范围／少量数据／尾块／有状态callable／异常回收／packed表示都会改变实现。浮点归约改变组合顺序也可能改变结果。
- 头文件include guard仅去重单TU。外部普通定义放进多个TU、合法inline多定义、TU内static多份状态是不同情形；不能把“能编译”或“链接器没报错”当成满足ODR的证明。
- `import std`不应成为本册所有代码的前提。Book6e偏向模块的风格建议，不改变C++17模板基线；编译器版本／标准选项／标准库实现／模块构建仍需分别核验。

## 真实发现的源材料问题

1. **Professional 6e物理1078（印刷1026）**：`if (myFuture.wait_for(0))`既未传入duration，又将`future_status`作为bool。原PDF渲染已确认，不是文本抽取失真。分别最小化为整数参数和正确duration但错误bool用法，GCC16.2.0 C++17均编译失败；改为duration并比较`future_status::ready`通过。
2. **Professional物理1077（印刷1025）**：semaphore例的lambda只捕获semaphore却使用外层i，原PDF确认漏捕获。C++20最小复现拒绝编译，按值捕获i的变种通过。
3. **Professional物理1045–1046**：“参数总是复制”只适合简化说明；move-only参数能被移动进线程。另一个注释把同时读取同一只读对象也笼统称数据竞争，条件过宽。并发冲突、至少一个非原子、缺乏happens-before才是应讲的判定条件。
4. **Professional物理1081**：没有保存future的默认async被笼统说成同步调用。若选择deferred，任务未必执行；若选择async，最后释放shared state可能阻塞。这是实现条件需要保留，不是“总会同步执行”。
5. **Challenge61/63**：直接用hardware_concurrency作除数，遗漏返回0的标准许可；空范围极值、线程启动失败以及共享有状态callable也是成品实现应补的条件，书中简单例子不代表都已处理。
6. **Challenge65**：把同步标准流一概说成不能并发安全访问过宽。N4659`iostream.objects.overview`/5明确同步标准I/O的相关操作无数据竞争，但字符仍可交错。例中的mutex有价值，是为了完整记录不交错，而非证明默认cout本身必然race。
7. **Cookbook本地目录范围**：promise配方候选页459–461的末尾程序实际延续到462，与下一配方起页共享。本次已补读462闭合。书签产生的是页候选范围，不是精确语义截断位置；未来读件若末尾不闭合须取相邻页，不能将目录end视为代码已完整。

上述问题不使整本书失去价值，也不把本轮变成勘误搜集。它们用于校正问题、前提和参考实现，原教材从未被改写。

## 实际实验与证据界限

本机GCC16.2.0，使用`-pthread`及明确C++17/20选项，执行10项有区分力的编译／链接边界检查：future两类错误与修正、lambda遗漏捕获与按值修正、C++17拒绝jthread、move-only线程实参、普通头定义重复链接失败、inline头定义和extern单一定义链接运行成功。全部符合预期；非法片段从未运行。结果在本地`.local/cpp-systems-research/results.json`，源文件和诊断留D盘，不是公共教材源码。

这些实验确认具体工具链诊断和定义良好的小程序结果，不证明任意多线程程序正确。没有运行ThreadSanitizer、没有用sleep碰运气证明活性、没有用一次运行判定不存在UB或数据竞争。

## 仍需继续的分支

候选文件对每项保留open_questions：CON55不同等待谓词、绝对deadline完整契约、shared_mutex公平性、atomic_ref对齐、atomic.wait的ABA、latch/barrier完整实现、线程池任务的拒绝／清空语义、协程frame寿命、C ABI及模块跨编译器构建、lock-free内存回收均未在本轮闭合。

来源闭合的主干已进入作者稿，见下节。C++20原语可按真正读取与验证进度逐项加入，不能因为目录出现就把实现标为完成。并发输入组合很大，不能宣称靠这42条或有限实验获得全网完备性。

## 作者稿与本次实际验证

- `content/cpp/线程与同步.source.md`与同名`.cpp`：12个相邻实现块，涉及线程作用域收尾、move-only任务与异常、future状态、显式async、一次初始化、双锁、关闭排空队列、局部计数、release/acquire发布、CAS、非空分块极值与整条日志。C++17为实际代码基线；20／23分支没有混入17代码。
- `content/cpp/翻译与链接.source.md`与同名`.cpp`：11个按文件组织的片段，覆盖普通头定义、extern单一定义、inline共享实体、TU私有副本、不可满足外部引用的私有同名实体、Pimpl完整类型，以及feature-test macro探测。代码片段由验证器抽取为不同TU，不是把各头文件拼成一个源文件。
- `tests/cpp/cpp_systems_test.cpp`使用GCC16.2.0、`-std=c++17 -pthread -O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS`，本次实际通过2903次断言。包括多生产者／消费者逐项恰好一次、关闭前后等待、排空与拒收合同、join后结果、deferred、正常一次初始化、双锁反序操作、发布、CAS边界、空／不等分块和日志完整记录。断言数量大部分来自逐项检查，不等于2903种独立机制，也不构成并发正确性的穷举证明。
- `tools/verify_cpp_systems.py`逐TU编译，再独立链接：9个翻译／链接案例均符合预期；其中重复外部定义与缺失外部定义是预期链接失败，非法案例从未运行。Pimpl移动／销毁、三种共享计数语义和feature probe为定义良好程序。C++17实际走fallback，C++20实际走span，只证明本机这两个明确分支。
- 两稿共23个权威代码块与23次占位引用一一对应。未执行ThreadSanitizer；没有用sleep测试，未运行已知data-race／悬空访问程序。

### call_once异常重试：标准与本机实现不能混为一谈

[N4659 thread.once.callonce](https://timsong-cpp.github.io/cppwp/n4659/thread.once.callonce)明确规定初始化异常传播，成功前仍可有后续active execution。OnceValue按此规则编写；正常初始化的并发测试已通过。

但本机GCC16.2.0／winpthreads在一次初始化抛异常后，再次初始化挂起。独立`tests/cpp/cpp_systems_once_retry.cpp`由验证器`--once-retry`在进程内运行，8秒超时被记录为**失败**并返回非零，不包装成成功；主测试只包含正常初始化。首次复现用gdb查看，后续调用停在pthread_once内部mutex，主线程等待join。尚未通过另一个本机标准库验证异常重试路径。

[libstdc++官方实现状态](https://gcc.gnu.org/onlinedocs/libstdc++/manual/status.html)仍给call_once附注异常支持问题，并指向[PR66146](https://gcc.gnu.org/bugzilla/show_bug.cgi?id=66146)。本次状态页正文已读；Bugzilla详情实际访问429，未声称通读issue或确认其所有受影响版本。本机观测与该官方已知限制一致，但不据此断言每个libstdc++平台都失败。

本地详细报告在`.local/cpp-systems-verification/translation/report.json`：默认9项可全部通过；本次加入异常重试探针后为9/10。Linux CI应实际执行`python tools/verify_cpp_systems.py --once-retry`并保留超时，不能把Windows的缺陷变成所有平台永久跳过。作者映射保留这一运行时未通过边界。
