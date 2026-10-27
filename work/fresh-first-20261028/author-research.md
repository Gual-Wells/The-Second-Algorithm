# 全新第一章作者研究与范围交接

日期：2026-10-28。当前正式任务基线：`first-chapter-independent-20261028`。

## 从零开始的边界

本次不承接先前发布的选题、作者稿、研究任务状态、evidence、验证通过结论或发布准备包。没有打开旧`content/`章节、旧作者稿、旧章研究笔记或旧Memory。仅继承当前有效的项目协议、关系模型、构建/校验工具与资料入口。本次的独立测试由另一Agent新写，当前绿色结果不是从旧测试或旧assets中挪来的。

有效项目规则实际读取：`AGENTS.md`、`protocol/CONTENT_PIPELINE.md`、`protocol/RESEARCH_DEPARTMENT.md`、`protocol/IMPLEMENTATION_STANDARD.md`、`protocol/TASK_EXECUTION.md`、`docs/CONTENT_MODEL.md`。`catalog/sources.json`、`catalog/books.json`、`docs/LOCAL_MATERIALS.md`仅用于当前来源与版本入口；第一次目录读取包含的旧采集文字不作为本次正文阅读或方法分析证据。为了正确写候选关系，读过`second_algorithm/learning.py`的校验与依赖闭包、`tests/test_learning_workflow.py`的纯fixture数据格式，不从它们取得正式教材论证或继承测试通过状态。未读本地商业教材正文，不把书目/索引状态说成全书已读。

Q000019–Q000026是新内容的连续身份分配。编号从19开始只保留既有身份不挪用，不代表读者已经学过撤回的1–18；新章不依赖任何旧Q。没有变更`catalog/learning.json`或`carrier/publications.json`，交付的是完整候选登记。

## 选题与本轮形成的范围

本轮先独立比较排序配对/合并、有序边界与答案二分、top-k离线选择与在线维护，实际原题和失败读取记录见同目录`scope-research.md`。一度首推top-k；重新比较初章负担后修正：quickselect与有限堆虽有共同目标，却仍要两个新不变量、随机性与持久状态；不能为设施丰富牺牲主线。边界搜索能从一套排除思想出发，直接任务中手写与标准设施均有实质作用。

根Agent随后提出LC34→LC875→CSES1620→CSES1085。我重新实际读取CSES1085原题，并对四题是否只是重复二分作了判断，最终保留四题：

- LC34解决显式位置边界，给手写lower/upper和`equal_range`同合同的两种实现。
- LC875首次把“候选是否可行”独立为函数，向上整除来自每小时只能服务一堆的原题规则。
- CSES1620新增并行模型、向下整除、由最快机器证明的可行紧界，以及公开判定函数的累计合同；不是把LC875改个标题。
- CSES1085的主要新工作是证明贪心判定最小块数，以及为何“至多k”能满足原题“恰k个非空段”；单调性本身不能证明oracle正确。它使章末真正落到条件变化，而非只反复替换搜索范围。

LC875与CSES1620确有搜索骨架重复，所以正文只在LC875完整建立闭候选区间论证，后两题解释各自新模型和合同，不再完整重讲C++规则。没有把四题规定为未来章节统一模板。若进一步发现阅读负担问题，可以删减任务，但必须重算Q依赖、合同和验证范围。

旧候选Codility MinMaxDivision允许空块、K可以大于N；CSES1085是正整数、k<=n、非空子数组，不能互换。前者仅作作者研究合同对照，没有纳入正文主任务、learning覆盖或实现。最终正文也不复制它的例子或空块证明。

## 本轮实际原题阅读

| 原始来源 | 实际读取范围与合同结论 |
|---|---|
| [LC34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/) | 题意、例子、约束、O(log n)要求；非降序，可空，缺失`[-1,-1]`。带description后缀初次超时，去后缀成功。 |
| [LC875](https://leetcode.com/problems/koko-eating-bananas/description/) | 题意、例子、约束；每小时只吃一堆，n<=h、pile至10^9，速度最小正整数。 |
| [CSES1620](https://cses.fi/problemset/task/1620/) | 题意、I/O、例子、约束；机器同时工作，n至2e5、target/period至10^9。 |
| [CSES1085](https://cses.fi/problemset/task/1085/) | 本次作者阶段新开原题，题干、样例、I/O、约束；正整数、n至2e5、1<=k<=n、xi至10^9；最小化k个连续子数组的最大和。没有空段条款，正文按非空分割与拆分论证处理。 |
| [Codility MinMaxDivision](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/min_max_division/) | 题干、例子、C++签名、约束；允许0长度块，值非负。只作合同对照，不计入正文覆盖。 |

未取得LeetCode官方editorial正文：可打开的LC215 editorial仅空壳；这不是本章解法权威。此前候选原题并未作为“全题库已读”的证据。

## 方法与C++资料实际读取

- [Codility官方BinarySearch讲义](https://codility.com/media/train/12-BinarySearch.pdf)：3页文本，读数组末个不大于目标、结果二分和覆盖孔洞判定。它提供方法关系，不提供本章C++代码或四个任务的完整证明。
- [MIT6.006 2020 Sorting](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/6d1ae5278d02bbecb5c4428928b24194_MIT6_006S20_lec3.pdf)、[Binary Heaps](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/40d4851e550507ca14dc778b9b2266cc_MIT6_006S20_lec8.pdf)、[CMU15-451 Spring2025选择讲义](https://www.cs.cmu.edu/~15451-s25/notes/lecture01.pdf)：为候选比较读相关PDF文本；最终没有把排序/堆/随机选择推进正文。CMU课堂选择明确假定不同元素，不能直接用于重复值任务。PDF图和复杂公式不声称全部做过视觉校对。
- [WG21 N4659](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/n4659.pdf)：2017-03-21工作草案，定向读取28.7.3二分设施，并在候选研究中读选择/局部排序/priority_queue相关条款；没有通读1622页。正文只使用C++17已有接口，不把实时草案的新重载当C++17。
- 当前草案的[引用](https://eel.is/c++draft/dcl.ref)、[容器类型](https://eel.is/c++draft/container.requirements.general)、[array](https://eel.is/c++draft/array.overview)、[vector构造](https://eel.is/c++draft/vector.cons)与[vector概要](https://eel.is/c++draft/vector.overview)、[范围for](https://eel.is/c++draft/stmt.ranged)、[equal_range](https://eel.is/c++draft/equal.range)、[整数类型](https://eel.is/c++draft/basic.fundamental)、[通常算术转换](https://eel.is/c++draft/expr.arith.conv)、[极值](https://eel.is/c++draft/alg.min.max)、[accumulate](https://eel.is/c++draft/accumulate)、[输入](https://eel.is/c++draft/istream.formatted.arithmetic)、[输出](https://eel.is/c++draft/ostream.inserters.arithmetic)、[条件包含](https://eel.is/c++draft/cpp.cond)：均实际打开，按最终代码所需的稳定机制定向读；未把各整页及所有新标准机制承载为教材。`alg.equal.range`尝试不可达，改成实际条款`equal.range`成功。

## 作者自查与实际独立修订

算法代码和正文均从空文件新写，没有拷贝旧章节源码。作者形成了三项容易误判的边界：

1. LC34手写搜索的未知元素是`[left,right)`，答案位置仍可能等于right；正文没有将“答案必在半开元素范围”作为不变量。两个出现边界相等就代表缺失，无须危险解引用。
2. CSES1085正数贪心按“同样段数覆盖得不短于任何分法”归纳证明最少块数；再用k<=n和可细分的正数段证明至多k与恰k非空等价。负数反例`[4,-3]`、k=1、L=1使当前checker与max元素下界失效，但可行阈值定义的单调性仍成立。不是“有负数就不能二分”。
3. Factory最短时间上界来自最快机器`m*target`。最早作者草稿曾误写紧界搜索内总产量可达2e23；独立语义审阅指出各period>=m，搜索T<=m*target，故每台<=target、总量<=n*target<=2e14。已修正文及scope笔记，明确紧搜索内完整64位累计安全；compare-before-add兼具提前停止和公开helper任意非负64位时间的较宽输入保护。没有用与紧界不相容的输入夸大溢出。

独立验证者另外实际发现Koko中间表达式错误：最初`pile+speed-1LL`先算int加法；原题搜索speed<=10^9下安全，但公开helper已承诺接受任意正int速度，`koko_can_finish({1},1,INT_MAX)`在GCC受检运行实际失败。没有收窄合同掩盖问题，而改为`1LL*pile+speed-1`在加法前提升，正文同步说明原题与helper范围差异。当前测试由验证者针对新源码哈希重跑；本作者记录不以对方测试数量替代自己的语义判断。

独立正文审阅者已重新读修订并确认Factory缺陷关闭，四题递进、正数贪心与恰k证明、Q局部充分性及真实手写/库层次未见其他阻断项。其独立审阅记录由审阅者保存，本文件不冒充其记录。

## 交付身份与关系

新文档ID：`boundary-feasibility`；建议标题《边界与答案：把搜索条件写进代码》。权威稿：`content/boundary-feasibility/边界与答案.source.md`；权威源码：同名`.cpp`。新稿使用15个源码region，正文15个占位各展示一次；正文不复制一份第二代码权威。

| Q | 唯一主讲问题 |
|---|---|
| Q000019 | const vector引用借用输入及寿命 |
| Q000020 | 无符号容器长度、已核对的int转换与下标有效性 |
| Q000021 | 固定两项array结果、列表返回与vector长度/列表初始化的区别 |
| Q000022 | 半开迭代器范围、equal_range返回pair、auto、差值和末端 |
| Q000023 | 范围for的元素副本与元素引用 |
| Q000024 | 约束推导类型、算术提升先于结果、宽整数与中间表达式 |
| Q000025 | 极值迭代器、非空前提、accumulate初值决定累计类型 |
| Q000026 | 类成员/完整main作答、数据交换、整文件唯一入口选择 |

所有Q只有一个显式锚点/编号主讲，后续引用编号。编号不代表语义完整的机器认证，更不代表用户掌握。没有把算法不变量、贪心证明硬塞成C++ Q。

公开算法接口在namespace `boundary_feasibility`：

- `lower_bound_manual(const vector<int>&,int)`、`upper_bound_manual(...)`；有效结果范围0..n。
- `occurrence_range_manual(const vector<int>&,int)`、`occurrence_range_standard(...)`；返回`array<int,2>`。
- `koko_can_finish(const vector<int>&,int hours,int speed)`、`koko_min_speed(const vector<int>&,int hours)`；speed为任意正int，最小值函数输入遵循原题。
- `factory_can_produce(const vector<int>&,long long target,long long time)`、`factory_min_time(const vector<int>&,long long target)`；checker允许任意非负long long time。
- `division_can_split(const vector<int>&,int max_blocks,long long limit)`、`division_min_largest_sum(const vector<int>&,int exact_blocks)`；原题正数、1..n块数，checker允许非负limit。

regions为`headers`、`lower-bound-manual`、`upper-bound-manual`、`occurrence-manual`、`occurrence-standard`、`koko-check`、`koko-search`、`factory-check`、`factory-search`、`division-check`、`division-search`、`lc34-adapter`、`lc875-adapter`、`factory-main`、`division-main`。

`learning.candidate.json`登记8Q、4任务、5实现、5验证目标。默认算法run目标是新写的`tests/cpp/boundary_feasibility_test.cpp`；四个compile目标指向根Agent创建的`tests/cpp/boundary_feasibility_entry.cpp`，分别定义LC34/LC875/FACTORY_MAIN/DIVISION_MAIN入口宏。原题外非法输入未添加统一异常或哨兵政策。

## 当前实际核验与未完成项

作者使用当前learning校验器对内存中的候选learning与单文档publication进行检查，没有切换正在撤回的真实登记。初次唯一错误是根Agent尚未创建四个compile目标共用的entry wrapper；根Agent随后创建该文件后，作者重新运行完整候选检查，结果`ok:true`、`errors:[]`，读到1文档、8Q、4任务、5实现、5目标。另用当前源码与原稿逐一匹配15个regions/15个占位，无重复、无遗漏。这是结构检查，不冒称语义完备。

独立结果与平台入口运行由验证Agent负责；全部实际测试范围、编译配置、失败留证、源码哈希以其最终报告为准。本作者没有宣称已向题库提交AC，也没有把本机通过说成所有工具链保证。

待整合者完成：采用候选登记、生成相邻阅读版、完成冻结输入上的独立审阅/验证与正式发布链。本文不提交、不推送、不部署、不生成最终HTML；没有将候选文件当作已上线结果。所有新增文件在D盘，无安装、付费下载或新增持续成本。
