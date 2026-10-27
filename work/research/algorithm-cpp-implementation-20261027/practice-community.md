# 算法上机的 C++ 落实：平台、竞赛实作与社区反例

研究日期：2026-10-27。定位：为当前研究提供证据和问题群，不是正式教材、最终章目或平台操作教程。本笔记由并行研究代理独占；未修改正式教材、协议和来源池。

已读本仓库 `AGENTS.md`、`protocol/CONTENT_PIPELINE.md`、`protocol/RESEARCH_DEPARTMENT.md`。本次只选择性读取公开原文、题面、源文件和测试；不声称整个生态已覆盖。平台配置属于本日文档快照，不能永久写死在教材里。没有登录、参加测评、提交代码、发帖、购买或安装依赖。没有运行下述开源项目测试；下文明确标为“手推”的反例也没有冒称实测。

## 1. 最有价值的结论

**算法解释与 C++ 实现不能分成“先伪码、最后附一份代码”两段。** 真正决定上机答案的，通常是一个连续判断链：题面需要维护什么关系 → 哪些操作及复杂度足够 → 选择容器／库算法或手写结构 → 满足迭代器、重复值、数值、接口与生命周期合同 → 用能区分错误前提的测试核验。下面两个真实题解尤其适合支撑这一组织方式。

**“库还是手写”没有全局二选一答案。** 是否考查实现该结构本身、标准库是否提供所需操作、题目是否允许离线处理、约束是否使确定复杂度更重要、平台是否允许扩展，都会改变答案。本文找到明确允许标准库的 Codility 规则，也找到面试禁库的第一人称个案；它们都不能推出其他公司的通则。

**竞赛模板可作为实现与反查材料，不能直接作为面试编码规范。** KACTL 对篇幅、手工录入和队内共享作出明确取舍；其速查表甚至含有与 Codeforces 对抗输入经验相冲突的性能建议。应吸收它的合同、测试与实现思路，重新判断缩写、宏、非标准扩展和全局状态对当前答题的价值。

## 2. 平台的真实接口与环境

### Codility：给定函数接口，标准库有明确边界

实际读取：[Candidate FAQ](https://app.codility.com/candidate-faq/)。普通网页提取只得到壳；随后读取该页实际声明的公开脚本 `/static/js/outer/candidate-faq.auto.js?77b6d40ef490b2810c0233c6883c5ac76711a61e`，再读取其明确列出的 [FAQ 正文脚本](https://app.codility.com/static/js/9de0305a9e80061de3da.outer-candidate-faq.js)，正文约 22 KB。这是页面自己加载的公开发布内容，未登录，也未执行脚本。

FAQ 实际说明：保留给定函数签名，可以增加辅助函数和 include；题面可以限制修改范围。默认仅使用该题所支持语言的标准库，题面可另作规定。本机 IDE 是否允许依测评政策，且本机编译器可能不同；支持版本显示在测评界面。Run 的 OK 只证明样例表现。多数任务的自动评分不计风格，但可能人工审阅，也有专门评分风格的任务。题面已经保证的输入假设无需逐项再验证。

原题核对：[MissingInteger](https://app.codility.com/programmers/lessons/4-counting_elements/missing_integer/)，实读 C++ 段给出 `int solution(vector<int> &A)`，规模上限为十万。该接口是平台提供的调用约定，并不是函数式编程范式。准备内容应包括如何让同一核心求解逻辑适配函数调用，而不是始终背一份带 `main` 和 `cin` 的模板。非 const 引用只说明接口允许写，不自动证明题意允许破坏调用者后续要使用的数据。

未确定：未实际进入测评查看本日具体 C++ 编译器。支持站旧文章地址及旧 Zendesk 搜索 API 返回不可读／404；没有用旧版手册中的 G++ 6.2.0 冒充当前环境。

### HackerRank：读完整 stub，平台级 stdin 与题级返回值可以同时成立

实际读取：[Answer Coding Questions](https://candidatesupport.hackerrank.com/articles/9623161883-answer-coding-questions)。页面既说明程序读写 stdin/stdout，也说明多数题要求函数返回值，且 top/footer stub 可能只读；没有 stub 才需自己处理输入输出。隐测包含边界和性能。返回值型题可以在调试面板观察打印，要求打印结果的题则须去掉额外调试输出。

这不是文档矛盾：完整程序由平台包装读写，候选人可能只编辑中间函数。练习必须核对返回类型、参数顺序、是否由 footer 输出答案，而不能根据网站名称断言“全部 ACM”或“全部函数”。自定义输入的原始格式也属于包装层合同。

实际读取：[Supported Programming Languages](https://candidatesupport.hackerrank.com/articles/2200226909) 明确招聘方可以限制可用语言；[Execution Environment](https://support.hackerrank.com/articles/6693750503-execution-environment) 按语言和题型列环境。本日算法题表中 C++11/14 行列 G++ 8.3.0，C++23 行列 G++ 14.2.0；C++20 行也列 G++ 8.3.0，这是值得复核的版本标注疑点，不能据此保证完整 C++20 语言／库特性。项目题的 C++ 工具链另列较新配置，不能混到单文件算法题。

### LeetCode 与 CSES：默认便利和独立程序并不相同

实际读取：[LeetCode 环境](https://support.leetcode.com/hc/en-us/articles/360011833974-What-are-the-environments-for-the-programming-languages)。本日文档列 clang 19、C++23、GCC 14 提供的 libstdc++、`-O2`、AddressSanitizer，并自动包含多数标准头文件。因此“站内可编译”不能证明自己写出了完整可移植的独立源文件；编译器前端、标准模式和标准库实现也须分别看。

实际读取：[LeetCode 多例状态说明](https://support.leetcode.com/hc/en-us/articles/360011834174-I-encountered-Wrong-Answer-Runtime-Error-for-a-specific-test-case-When-I-test-my-code-using-this-test-case-it-produced-the-correct-output-Why)。平台指出同一程序实例执行多个测试，global/static 状态会跨例影响，单独重跑失败例可能不能复现。教学上应训练“先大后小”“连续调用两次”等生命周期反例。该旧文章对其他语言使用了松散的 undefined behavior 术语，不能把它当语言规范；这里只采用平台执行状态及 C++ 越界线索。

实际读取：[CSES How to use](https://cses.fi/howto/)，本日列 g++ 13.3.0，以及 C++11/17/20/23 的 `-O2 -Wall` 模式，并给出含 `main`、自行读写的 C++ 示例；具体比赛不一定开放全部语言。这个生态适合补函数平台不暴露的输入、输出、完整编译单元与多例清理，但其格式不能反向套给所有面试环境。

### 招聘方的独立证据

实际读取：[Microsoft Technical interviewing](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing)：要求真实可运行代码、用擅长语言、代码清楚简洁；解释复杂度、数据结构利弊，并自行测试边界、错误条件和压力条件。还要求了解至少一种 n log n 排序算法细节。它支持“会实现且会解释库背后的算法”这一准备方向，**没有**宣布所有面试一律允许或禁止 STL。公司指引本身也不能代表其他招聘方。

## 3. 两个真实实现说明：库的细节就是算法的条件

USACO Guide 本次用 GitHub 公开 tree API 取得并固定在 `40279728a239ff54e35df8626b22f8f63ccbf77a`，随后读取以下同一提交的源文件。网站提取器默认只暴露部分语言／折叠内容，因此不能把网页显示的 Python 片段当作已读 C++；这里实际读取了 MDX 中的 C++ 段。

### Concert Tickets：动态前驱与一次性消费

原题：[CSES 1091](https://cses.fi/problemset/task/1091)。按客户原顺序，为其取不超过预算的最高票价，票用过即消失；票价可以重复，n、m 可达二十万。

参考实现：[USACO Guide C++ 源](https://github.com/cpinitiative/usaco-guide/blob/40279728a239ff54e35df8626b22f8f63ccbf77a/solutions/silver/cses-1091.mdx)。实际是 `multiset<int>`，先做成员 `upper_bound(t)`，等于 begin 时无解，否则向前一步获得答案，再按迭代器删一个。

这里应相邻解释四个判断，而不是只列 API：为什么保留重复值；为什么找首个严格大于预算再取前驱；为什么必须先防止 begin 回退；为什么删除对象的身份而不是所有相同价。

手推反例：票 `[5,5]`，客户 `[5,5]`。若按键 `erase(5)`，首客后两张票都消失，次客被误判无票。正确结果为 `[5,5]`。另一个复杂度陷阱是“先排 vector 再二分后 erase”：查找快不消除中间删除搬移的总成本。库调用的复杂度必须合并分析。

规则核对：[关联容器要求](https://eel.is/c++draft/associative.reqmts) 实读了重复键、双向迭代器及删除条目；该页是滚动工作草案，不能把同页新增 API 当 C++17 已有。此处仅用它反查长期存在的两种 erase 语义。进一步教学还应核对“成员 upper_bound”与泛型二分在双向迭代器上的步进成本，不能只比较比较次数。

### Traffic Lights：同一题的算法变换会撤掉一个容器

原题：[CSES 1163](https://cses.fi/problemset/task/1163)。逐个加入位置互不相同、严格位于街道内部的灯，输出每步最大间隔。位置数可达二十万。

参考实现：[USACO Guide 三种 C++ 实作](https://github.com/cpinitiative/usaco-guide/blob/40279728a239ff54e35df8626b22f8f63ccbf77a/solutions/silver/cses-1163.mdx)。本次实际读取了三个 C++ 段：

1. 正向在线：`set` 存灯的位置，`multiset` 存间隔长度；找两邻居、删一个旧长度、加入两个新长度，再取最大。
2. 全量输入后逆向：反向删灯，相邻间隔只会合并，最大值可单调维护，保留位置 set 而省去长度 multiset。
3. 排序并建立原索引到排序位置的映射：用 vector 中的前驱／后继索引模拟双链，逆向删除时直接改邻居链接，省去平衡树查询。

这不是“数组总比 STL 好”，而是先利用离线、反向和单调性质，才让所需操作变简单。真正实时、未来未知的输入不能直接采用第二、三种方案。

手推重复长度反例：街长 10，依次加灯 5、2。第一步两段均长 5；第二步只拆左侧那一段。按值删长度 5 会误删两个长度，得到最大 3，而正确最大仍为 5。题面保证位置互异，却不保证间隔长度互异；按题面对象错误转移“唯一性”是典型翻译层错误。

面向面试的取舍：先提供最容易说明并满足约束的在线 set+multiset 解，再在确有性能／离线讨论价值时解释变换；无需让所有候选人先背数组链表版本。上述是本研究判断，不是原题或平台的评分规定。

## 4. 竞赛代码库：吸收测试合同，重新审查表达方式

KACTL 本次直接读取公开 GitHub HEAD 并固定 `b3548e973f8772010c1ef84e6d427c749733fd2c`。实际读取 [README](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/README.md)、[template.cpp](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/content/contest/template.cpp)、[troubleshoot](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/content/contest/troubleshoot.txt)，以及下面三个文件。

README 自定位为 ICPC 队伍的 25 页可复制参考文档，强调短、够快、测试充分，避免为泛化增加手工录入成本；篇幅原因排除了常见的 Dijkstra。**因此文档缺少某算法不构成该算法不重要的证据。** 模板里的宏、typedef、GNU 聚合头、输入异常开关也需要调用现场理解，不是“面试必须的工程习惯”。

[OrderStatisticTree.h](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/content/data-structures/OrderStatisticTree.h) 实际使用 `__gnu_pbds`，且头注明确是 set 而非 multiset。可用来研究排名／第 k 小接口缺口与扩展替代，但不能把 PBDS 当标准库，不能把重复值问题直接交给它。面试若只保证标准 C++，应另研究压缩值域+Fenwick、专用树或其他符合限制的方案。

[SegmentTree.h](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/content/data-structures/SegmentTree.h) 就地标明零下标、半开区间、单位元和可替换的结合操作；[对应压力测试](https://github.com/kth-competitive-programming/kactl/blob/b3548e973f8772010c1ef84e6d427c749733fd2c/stress-tests/data-structures/SegmentTree.cpp) 实际对照朴素 vector 查询，还另测非交换操作。这比“有随机测试”更重要：只测 max/sum 可能发现不了合并操作数顺序错误；非交换实例能区分“结合”与“交换”的错误假设。本轮仅审读，没有运行其测试或宣称它对所有改写仍然正确。

从中值得吸收的工程习惯是：把区间合同、单位元、操作顺序和比较基准放到代码附近；测试覆盖结构本身的性质，而不是只跑几个眼熟样例。参考库的现有测试也不能替代改动后的验证。

## 5. 社区意见的有效范围与矛盾

### 容器性能建议互相冲突，正好要求说明前提

KACTL troubleshoot 的 TLE 部分仍含短句 “Avoid vector, map. (use arrays/unordered_map)”。同页也要求先查复杂度、无谓复制和 I/O，不能截一句写成普遍法则。

实际读取 [Neal：Blowing up unordered_map](https://codeforces.com/blog/entry/62393)，文章从 libstdc++ 的具体实现出发构造碰撞，说明恶意输入可破坏通常依赖的平均常数操作。又读取 [2024 edition](https://codeforces.com/blog/entry/132929)，它进一步讨论键值范围、重复值与多例对构造碰撞和成本的限制，还报告特定 GCC 环境中重复 clear 的桶扫描问题。

可采用的结论：哈希、平衡树、稠密频次数组和压缩后数组是在不同条件下的替代；检查值域、顺序查询、最坏情况、内存和整题开销。不可采用的结论：“所有面试都别用 unordered_map”“加 reserve 就不可攻击”“把某个 GCC 模数或随机哈希模板背下来即有确定保证”。这些帖子是特定生态的第一手技术经验；具体实现、时延与攻击值不是标准保证，也不是面试出现率调查。本轮没有在现机复现帖子时间。

### 一条真实面试禁库个案，以及回答自身的错误推断

实际读取 [Stack Overflow 57147267](https://stackoverflow.com/questions/57147267/c-junior-interview-question-function-to-compress-a-character-sequence-with-on) 的题干、原代码和两个回答。2019 年提问者报告面试任务为连续字符去重，明确禁用 strlen/strcpy/string 等库接口；代码在发现新段时反复分配、复制、释放，回答指出成本与所有权问题，并给出原地双指针。

它只能证明存在这类任务，不能代表常态。还须反查回答：其中“参数是 char* 而非 const char*，所以必须原地改写”的推断不成立；可写性不等于题目约定了所有权和返回别名，必须回到合同。另有回答提出容器，适合作为工程对照，却不能忽略原题的禁库条件。

本研究的连接：允许 string/算法库时可研究连续去重的 unique+erase；专门考指针／禁库时实现读写指针。不应先 sort，因为它会改变连续段的次序和定义。库、手写和错误重构可以围绕同一问题相邻比较，而不用另开一门零基础指针课。

另实读 [2009 年 STL 面试能力讨论](https://stackoverflow.com/questions/1691759/what-questions-should-an-expert-in-stl-be-expected-to-answer-in-an-interview)。回答对显式循环、copy+ostream_iterator、泛化以及“9/10”能力定义持不同意见；其年代和岗位语境都不适合决定当下算法上机范围。可取之处是要求解释选择，不能凭“更 STL 风格”一项判代码更好。

## 6. I/O、错误类型与测试该怎样接入算法内容

实际读取 USACO Guide [Fast I/O 源](https://github.com/cpinitiative/usaco-guide/blob/40279728a239ff54e35df8626b22f8f63ccbf77a/content/1_General/Fast_IO.mdx) 的 C++ 段。它有相同任务不同输入输出实现的基准，区分取消同步、解除 cin/cout 绑定、换行与刷新，并说明交互题需要适时刷新。数字是该资料的特定实测，不能作为本机或面试的固定倍数。相邻解释应是：大量批处理 I/O 有成本；函数题的瓶颈可能完全不在候选人 I/O；解除绑定后交互输出要手动保证可见；取消同步后不要随意混合两套输入流。

实读 [SO 同步／绑定问答](https://stackoverflow.com/questions/31162367/significance-of-ios-basesync-with-stdiofalse-cin-tienull)。回答强调两个开关改变不同语义，性能收益是条件性的。这与“所有程序开头机械两行”不同；社区解释可作为理解线索，规则最终需按标准和具体实现核对。

实读 USACO Guide [Debugging C++](https://usaco.guide/general/debugging-cpp?lang=cpp)、[Basic Debugging](https://usaco.guide/general/basic-debugging?lang=cpp)、[How to Debug](https://usaco.guide/general/debugging-checklist?lang=cpp) 的相关节：越界未必立即崩溃；warnings、sanitizers、libstdc++ debug 模式和 debugger 各能提供不同诊断；小例对拍可以定位差异；多例状态残留、无谓复制和过量日志都可能造成失败。这些页有编译器与操作系统限制，不能把某个 flag 写成所有 Windows 工具链都可用。

又实读 [GCC Debug Mode 官方说明](https://gcc.gnu.org/onlinedocs/libstdc++/manual/debug_mode_using.html)：`-D_GLIBCXX_DEBUG` 会改变标准容器实例的大小和行为，跨编译单元传容器时不能随意混用 debug/release。它属于准备和本地核验工具，不是应硬塞入提交答案的模板。

建议按“失败证据 → 调查对象”组织，而不是把判题标签当唯一病因：

| 失败表现 | 必须区分的调查对象 | 适合的核验 |
| --- | --- | --- |
| 编译／链接失败 | 入口签名、header、版本、扩展、返回类型，而不只是分号 | 用目标模式编译完整包装，检查 stub |
| WA | 题意／不变量、重复值、边界、状态残留、输出合同 | 区分条件的最小反例；连续两次调用；朴素解对照 |
| RE／sanitizer 报错 | 越界、失效迭代器、悬垂引用、空容器访问、递归深度 | 能力允许时开诊断；缩小输入；定位出错调用 |
| TLE | 算法量级、库操作隐藏成本、复制、哈希退化、I/O、调试日志 | 先算总操作与数据规模，再做有针对性的最大／对抗输入 |
| MLE | 容量、节点／邻接存储、重复副本、递归、跨例残留 | 按真实表示估算峰值，避免只数逻辑元素 |

同一个越界错误可能表现为 WA、RE 或偶然通过，不能按判题标签判断它必定属于算法还是 C++。反过来，diagnostic 全清也不能证明贪心或状态转移正确。

## 7. 对后续研究的交接

应优先研究“目标操作如何落实成可作答代码”的问题群，并用真实任务对照：动态前驱的一次删除；有序集合维护相邻关系；在线转离线后撤销容器；求排名时标准接口不足；同一核心求解如何适配返回函数与 stdin 程序；同一代码如何暴露重复值、连续调用、非交换合并等不同错误。它们是跨算法和 C++ 的连接，尚不是预定章节。

库功能只在它改变实现、正确性或复杂度时就地解释；不要把所有 STL API 排成词典后期待读者自己拼接。手写部分重点是标准库没有现成能力、明确考查机制或算法变换带来的简化，不是为了体现“懂底层”而重写一切。保留可阅读命名与局部合同，不把 ICPC 短码风格当求职风格。

本次关键未决项：Codility 当前具体测评编译器未进入界面核验；HackerRank C++20 行的版本疑点未向平台询问；CF 时间／clear 实现现象未本机复现；没有进行任何平台提交、KACTL CI 或 C++17 全套编译。上述未决不妨碍本轮关于接口、容器合同和来源适用范围的判断，但禁止据此发布“跨平台现测全部通过”的结论。

实际搜索按目的分组使用过：官方平台 execution environment / supported programming languages / candidate FAQ / solution signature；USACO Guide 的 Concert Tickets、Room Allocation、fast I/O、debugging；KACTL README／stress-tests；Codeforces unordered_map hacking；Stack Overflow interview + standard library + STL。Room Allocation 的定向检索未得到可用命中，没有将其当已读实现。精选原文和固定提交见各节链接；未选用搜索页中的培训营销稿、镜像题库和过时环境手册作为结论依据。
