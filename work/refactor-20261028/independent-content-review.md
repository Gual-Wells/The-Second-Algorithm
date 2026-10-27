# 实战起点：独立内容与实现审阅

审阅日期：2026-10-28（Asia/Shanghai）。审阅职责为 reader Agent；另委派独立子审阅者只读核查 C++ 与测试调用，并实际重新编译运行。没有将作者的 `author-review`、历史检查次数或构建成功当作本次语义审阅结论。本轮不修改正式内容。

## 结论与需修

逐段读取作者稿、逐行读取完整 C++、测试驱动和全部 learning 登记后，未发现需要重写算法、返回合同或复杂度的缺陷。发现并先通知 root 的两处解释遗漏，现已实际复核修正，均关闭（最终摘要见文末）：

1. **Q000002 的 `vector::pop_back()` 缺少非空前提。** 原段明确了空容器不可用 `a[0]/front/back` 读取，但只说 pop_back 删除末项，不足以提醒读者空容器也不能调用该修改操作。建议在同一句补“要求非空”。这是接口前提遗漏；当前实现调用前均满足前提，没有发现由此产生的代码错误。[C++17 工作草案 N4659 的序列容器要求](https://timsong-cpp.github.io/cppwp/n4659/sequence.reqmts)列出了该前提。
2. **Q000015 未说明三参数 `priority_queue` 声明的组成。** 代码实际出现 `priority_queue<int, std::vector<int>, LaterNumber>`，正文解释了函数对象和比较方向，却未明确三个类型参数依次为元素、底层容器、比较器。对缺少这些设施经验的读者，这是读取当前代码的真实前置。建议在该 Q 补一句及默认参数关系，不新开平行课程或重复讲堆。[N4659 priority_queue 声明](https://timsong-cpp.github.io/cppwp/n4659/priority.queue)可直接对应三个参数。

以上是本次发现的必要小修；关闭依据是重读实际修改段落，而非作者“将修改”的承诺。下表保留首次完整审阅快照，文末另列修正后的最终快照。

## 实际读取范围及快照

完整读取以下四份文件，不只读取标题、目录或作者结论：

| 文件 | SHA256 |
|---|---|
| `content/practice-foundations/实战起点.source.md` | `cbf198d96e44fdd5ba5042dc4b4c1bdc64f258ba29c13d47b19a8fbc78f56fd3` |
| `content/practice-foundations/实战起点.cpp` | `51304ef87360bac3eeb5410417a370eda7a09ca60c815f83dd0b10315778129f` |
| `tests/cpp/practice_foundations_test.cpp` | `b7a5b998bb7781c407fafa3d9360a4a86298ebb1bafbc57c809f2fa3fd3c70df` |
| `catalog/learning.json` | `279eb32eccd043c69fa0362bd025af4e75ffb01167ee3c302aee7826c03c5b86` |

范围是当前 6 个任务、8 个方法、11 个登记实现、18 个 Q 及辅助堆/比较器/两种入口。没有把旧稿视为本次覆盖证据。独立提取标题得到18个主讲、18个唯一编号，与18条登记的编号/标题均一致；`Q000004 -> Q000003` 与 `Q000009 -> Q000003` 两条新补前置已实际读取。

## 算法、合同和复杂度核对

| 任务 | 本次核对的关键点 | 判断 |
|---|---|---|
| 完整等值范围 | 手写二分候选区间严格缩短；空输入/全不匹配可返回 n；标准 equal_range 转偏移；目标最大值不经 target+1 | 两实现兑现相同非降输入合同，O(log n) / O(1)适用于本例vector |
| 静态区间和 | p[0]=0、n+1个实际元素、合法半开区间；先复制为i64再 partial_sum；输出位置存在 | 两实现结果一致，预处理O(n)、查询O(1)、空间O(n)；宽类型仍需可表示合同 |
| 非空目标和计数 | 枚举确实每段一次；频次哈希先查后记；空前缀参与、当前前缀不自配对；零和重数与宽计数 | 两种不同算法的比较成立；枚举O(n²)，哈希期望O(n)、最坏O(n²)的区别保留 |
| 最长/最短目标和 | 最早历史下标最大化长度、最近下标最小化长度；0只表示无非空解；同样先查询 | 没有将频次表机械复用为长度；返回合同与代码一致 |
| 升序最小k项 | 手写堆与priority_queue使用同一k候选策略；保留重复；倒序填答案；k=0或k>n提前返回 | 建堆、扫描、输出分项成本合理；k=0是常数早退，其余公式用于实际处理分支 |
| 选择分区再排序 | nth=begin()+k，k=n跳过选择；分区前缀仍须sort；复制输入后修改副本，resize不承诺释放容量 | 平均O(n+k log(k+1))与O(n)副本说明一致，没有声称最坏线性或k空间 |

本次另实际打开 [N4659 partial_sum](https://timsong-cpp.github.io/cppwp/n4659/partial.sum)、[排序规则](https://timsong-cpp.github.io/cppwp/n4659/alg.sorting)、[nth_element](https://timsong-cpp.github.io/cppwp/n4659/alg.nth.element)、[unordered 容器要求](https://timsong-cpp.github.io/cppwp/n4659/unord.req)，针对累计类型、原地累计、严格弱序、平均界与哈希失效说明进行反查。这些是对应 C++17 的工作草案文本，未把最新草案的新行为倒灌进本章。

也实际打开 [CSES 1661](https://cses.fi/problemset/task/1661/)：它要求计数，n可达200000、元素和目标可为负。正文引用它作为大规模计数任务是准确的。最长/最短两个任务是本章由同一关系派生的变体；learning沿用该URL只能说明材料关系，不能称这两个变体是CSES原题或已经在平台提交验证。

## C++前置、一次主讲与可理解性

正文实际承接了两种实现共享的函数参数/值返回、vector元素与容量、半开范围/迭代器、计算类型/转换；也承接了各自新增的 hash 查询与插入、类/构造/成员const、priority_queue、比较器、选择/排序及入口。没有只解释库接口而让手写循环中的类型、对象和返回结构全部悬空。Q000005本身讲二分依据，Q000012讲堆不变量和修复；代码没有退化成API名称表。

Q000001–Q000004虽然集中在首次算法实现之前，但都以随后实际声明/代码为落点；并非另一套独立C++课。普通赋值、条件、循环、比较等本科编程基础没有逐token另编号，这是合理粒度，不应为追求编号数量拆成碎片。上述两项需修则不同：它们是当前出现的具体标准设施的必要读取/调用条件。

18个Q各有一次完整主讲。后文对相同问题使用编号链接；Q000018是方法选用对照，没有重放各Q的完整解释。`const T&`与成员函数末尾const解决的是不同位置的问题；vector和priority_queue的pop语义属于不同设施，不应因关键词相同误判为重复主讲。前向链接到比较器用于扩展记录/降序等情形，没有迫使读默认int实现的读者先完成整套模板课。

## 11个实现的真实测试对应

专门的只读子审阅者重新以现有GCC 16.2.0、C++17、`-O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS`编译当前测试驱动；本记录作者随后直接运行该新产物，实际stdout均为 `practice_foundations arrays=3284 checks=587243`，退出码0。产物在D盘 `.local/independent-cpp-audit/`，没有改正式文件或安装依赖。

| 登记实现 | 驱动中的结果检查及独立参考 |
|---|---|
| equal-positions-manual / equal-positions-standard | `check_array`直接调用两者；有序数组由独立插入排序形成，答案由线性扫描得到 |
| prefix-manual / prefix-standard | 直接比较逐前缀从头求和的结果；两种前缀再分别检查所有合法、含空区间 |
| exact-count-enumeration / exact-count-hash | 分别与每个区间重新求和的三层循环参照比较，不把其中一个被测实现当唯一oracle |
| longest-exact-hash / shortest-exact-hash | 分别与同一独立区间枚举得到的最长/最短非空长度比较 |
| smallest-k-manual / smallest-k-priority / smallest-k-selection | k取0到n+1；分别比较独立插入排序的前k项，检查重复与非法k政策 |

穷举实际包含长度0–7、元素取`{-2,0,2}`的3280个数组，另有4组INT极值/宽和数组。目标包含负数、零、缺失值、超int范围；20万零元素单独核对64位计数与最长/最短非空语义。手写MaxHeap另外进行6000步模型对照与排空；标准范围堆同时检查内容和堆性质；自定义比较器方向和Solution适配器均有断言。因此“11实现被测试”是可从直接调用和结果断言确认的事实，并非只看target字段或一次编译成功。

子审阅者另以 `PRACTICE_FOUNDATIONS_STANDALONE` 独立编译ACM入口，本记录作者再用subprocess逐字节核对正常输入、空数组、k>n、负n、输入截断5例。仅归一化CRLF/LF，区分一个空行和零字节输出；5例均通过，实际结果保存于 `.local/independent-cpp-audit/standalone-results.json`。前3例退出0，后2例退出1。它补充了入口分支；没有宣称覆盖所有平台I/O模式。

可恢复的编译形式如下；`CXX`指向本机已有GCC16.2编译器，`TEMP/TMP/TMPDIR`均设为仓库的 `.local/independent-cpp-audit`，不依赖全局PATH或重新安装：

```powershell
& $env:CXX -std=c++17 -O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS tests/cpp/practice_foundations_test.cpp -o .local/independent-cpp-audit/practice_foundations_test.exe
& $env:CXX -std=c++17 -O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS -DPRACTICE_FOUNDATIONS_STANDALONE content/practice-foundations/实战起点.cpp -o .local/independent-cpp-audit/standalone.exe
```

## 未测与结论边界

本轮没有运行其他编译器/平台、sanitizer、分配失败注入、故意哈希碰撞攻击、巨大随机性能基准，也没有向在线判题提交。超出声明范围的溢出、越界或空堆操作不在可接受输入中，未执行这些未定义操作作为所谓反例。有限穷举与模型检查不能证明任意规模全正确；本次结论同时依赖上述不变量与接口合同核查。

本记录是对所列当前输入的实际独立审阅，不证明整个算法知识域或全部C++基础已经讲完，也不推断读者学习效果或面试通过率。

## 修正复核与最终快照

已实际重读Q000002与Q000015的修改段落：前者补上pop_back调用前也必须非空；后者逐项解释三个模板参数，并区分比较器类型与其对象。两处均在原Q完成，没有增加第二份完整主讲。上述两条发现关闭，没有遗留必要修正。

修正后的source曾为 `68f2ec5b44ce855d404cd902470d5181031d9a48398b578a0bbe61a3feeb82f1`。root随后将活跃文本统一为Git LF；本记录只刷新实际字节摘要、重读上述两段，并再次提取标题确认18个主讲/18个唯一编号/18条登记匹配，不将换行规范化计作新增语义审阅，也未重复编译或运行测试。

当前最终实际字节快照如下：

| 文件 | 当前SHA256 |
|---|---|
| `content/practice-foundations/实战起点.source.md` | `9fbb60f16aa178ca9efcad11d491184ff31f80640b0e91ba3d2a6179ba793f46` |
| `content/practice-foundations/实战起点.cpp` | `51304ef87360bac3eeb5410417a370eda7a09ca60c815f83dd0b10315778129f` |
| `tests/cpp/practice_foundations_test.cpp` | `b7a5b998bb7781c407fafa3d9360a4a86298ebb1bafbc57c809f2fa3fd3c70df` |
| `catalog/learning.json` | `ab64be7ef0121c6a650be9e589eb185f002af6faf88d4c85e2a97a9cbbda4546` |

C++和测试摘要未变，故先前本轮编译/执行仍对应相同实现字节。对当前learning仅在内存中恢复CRLF所得摘要，等于先前已复核的`279eb32e…`，确认该文件的字节差仅为换行。source按root本次告知完成换行规范化；本次没有持有先前完整原始字节进行全文差异比较，因此只记录当前摘要与实际重读的两段，不以摘要变化自行推断一次新的全文语义审阅。两项解释补齐仍保持关闭。
