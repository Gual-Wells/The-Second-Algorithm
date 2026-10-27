# 《边界与答案》独立验证

日期：2026-10-28。验证文件：`tests/cpp/boundary_feasibility_test.cpp`。被测权威源码：`content/boundary-feasibility/边界与答案.cpp`。本次从零设计参考模型，仅验证本次新写源码，不承接旧任务状态、旧报告、旧测试或旧通过结论。本检查不修改正文、learning登记或其他测试。最终通过必须绑定本轮定稿文件SHA256，不能借首版通过推定修订版通过。

## 状态

通过。本轮语义检查发现并实际复现Koko中间整数类型问题，作者已修订为在第一次加法前提升类型；全部C++配置、完整ACM输入输出及LC适配检查已在修订后的同一份源码上重新完成。以下通过只覆盖这份新源码与所列接口，不承接旧任务结论，也不认证正文或发布体验。

最终被测源码SHA256：`d6e524cc40b6c61a053d83284be8717c4aaecde29d04c48a9ade18194281dfa1`。

最终测试文件SHA256：`0e0483c1461ffb276aed603766a10a871bd2dc672d70dafafe69042b477fd57a`。

最终三种配置各自编译、运行exit0且编译诊断为空：C++17/GCC16.2的`-O2`、`-O0 -g -D_GLIBCXX_ASSERTIONS`、`-O0 -g -D_GLIBCXX_ASSERTIONS -ftrapv`。每次均执行649268项断言：边界8555组；Koko1872个数组、12902次最优值调用、83258次predicate调用；Factory845个数组、4596次最优值调用、119846次predicate调用；Division3892个数组、25024次最优值调用、343755次predicate调用。这个总数含参考模型自检、不同接口及相同输入上的多项断言，不代表649268个互相独立的题例。

完整提交检查也在上述新源码哈希上重做：90次ACM输入输出与2个LC适配器共8项期待值全部通过。随后将本轮独立runner整理为持久工具`work/fresh-first-20261028/verify_platform_entries.py`，又以该工具实际重跑并通过同样范围。工具SHA256：`ee30c7cf71699502bea83ee2fa5fa2690f5b20b7888baa6ff15d1dd321bf4c86`。检查后重新读取源码/测试SHA256，与工具记录相同。

C++全量日志为`.local/boundary-independent/{gcc,debug,trapv}-{build,run}.log`，实际日志名按花括号展开，共6份。持久工具的完整提交结果及构建日志为`.local/boundary-platform-entries/results.json`和同目录四份`*-build.log`。

## 独立性与原题合同

先从原题和作者约定的公开签名设计参考模型，写入测试文件并完成首轮运行后，才阅读作者实现以做语义反查。参考模型不调用被测predicate、不用二分，也不以两个被测实现互相一致作为正确证据。随后根据语义反查添加的INT_MAX速度探针明确属于补充检查。

独立读取：[LC34](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/description/)、[LC875](https://leetcode.com/problems/koko-eating-bananas/description/)、[CSES1620](https://cses.fi/problemset/task/1620)、[CSES1085](https://cses.fi/problemset/task/1085/)。其中1085在本次验证任务重新打开原站：正整数数组，`1 <= k <= n <= 200000`、`1 <= x_i <= 10^9`；划为恰k个非空连续子数组。没有将Codility允许空块的合同带入测试。

所有最小值接口仅使用原题合法输入。额外predicate范围按作者明确合同检查：Factory允许任意非负long long时间；Koko允许任意正int速度；Division允许非负limit，包括小于最大元素的阈值。非法n、k、空正数数组、负值不送入生产函数，不为其虚构异常或哨兵政策。

## 参考模型与覆盖理由

| 任务 | 独立参考 | 穷举和挑战 | 被调用公开接口 |
|---|---|---|---|
| LC34 | 一次线性扫描分别找首个>=、首个>、首次/末次相等位置 | 长度0至7、值域-2至2的全部非降数组，目标-3至3；固定seed长重复数组；原题正负10^9端点；100000个重复值；检查调用后输入未变 | lower_bound_manual、upper_bound_manual、occurrence_range_manual、occurrence_range_standard |
| LC875 | 每小时从当前堆实际扣除至多speed个，直到该堆清空；逐一枚举速度选最小可行值 | 长度1至5、堆大小1至4全部数组；h从堆数至香蕉总数+1；速度1至最大堆+1；固定seed更大堆；10000堆×10^9及各临界速度 | koko_can_finish、koko_min_speed |
| CSES1620 | 每台机器独立倒计时，逐秒推进，归零时产一件并重置；不用T/period作为oracle | 长度1至4、周期1至4全部数组，target1至12；逐秒检查阈值；固定seed周期/数量；10^18答案、200000台机器、LLONG_MAX时间predicate | factory_can_produce、factory_min_time |
| CSES1085 | 枚举n-1个相邻空隙的所有切点子集，直接算每个恰k分割的最大段和及其最优值 | 长度1至7、值域1至3全部数组；所有k、limit0至sum+1整个阈值域；固定seed长度至11；原题最大规模；k1、kn和最优转变点 | division_can_split、division_min_largest_sum |

固定随机发生器使用标准`std::mt19937`及种子`0x6B6F6B6F`，不用系统随机种子。随机样本补充长度、排列和数值组合，不能代替上述有限域穷举。

Division中特别检查`[1,1,1,1], k=3, limit=2`：贪心最少只需2块，而恰3非空块仍可行，能识别把“最少块数<=k”错写成“==k”的实现。对每组输入把predicate与切点oracle的全部阈值作比较，检查可行性转变，不只检查搜索最终答案。另用切点oracle确认`[5,-4]`单块上限1可行，只把它当作正数条件不可任意取消的数学反例；没有调用正数生产接口，也不计作生产实现对负数的验证。

## 大数的独立手算

- Koko：10000个10^9、h=10^9时，每堆最多用100000小时，故最小速度10000；h=10000时每堆只能用1小时，故速度10^9。speed1需要10^13小时，不能让32位累计回绕。两个10^9堆、h3的最优仍为10^9，h4为5×10^8。
- Factory：单机周期10^9、目标10^9，最早为10^18；200000台周期1机器、目标10^9，最早为5000；200000台周期10^9机器则为5×10^12。每个手算最优值都检查T可行且T-1不可行。
- Factory数值关系：紧搜索上界`min(periods)*target`下，每个商不超过target，总产量不超过2×10^14，64位完整累加足够。额外predicate合同允许time=10^18乃至LLONG_MAX；200000个周期1时数学总量可达2×10^23，因此另检查提前达到目标而不求完整总和。`periods={1,1}, time=LLONG_MAX`能区别直接两项求和的溢出。
- Division：200000个10^9，k1为2×10^14，k2为10^14，k3为66667×10^9，kn为10^9，k=n-1为2×10^9。`[10^9,1,1,10^9]`的k2最优10^9+1，k3最优10^9；每个结果也检查前一阈值不可行。

这些大数期待值由问题合同和代数推导，不由作者函数生成。测试没有声称穷举原题整个数值域。

## 首轮实际执行与保留的历史追踪

本机使用已经存在的GCC16.2.0。编译器具体安装位置属于本机输入，不写入公开材料。C++全量检查的TEMP、TMP、二进制和日志在仓库`.local/boundary-independent/`；完整提交持久工具使用`.local/boundary-platform-entries/`。本机仓库实际位于D盘，因此这些输出实际由D盘承担。没有下载、安装或新增费用。

初版源码SHA256：`c84f301b3e84dfddfbf29d153b63e84ea0fa663b062de905bebb6f7871f799a7`。

两种配置分别编译并运行通过，无警告输出：

```text
-std=c++17 -Wall -Wextra -Wpedantic -O2 -finput-charset=UTF-8
-std=c++17 -Wall -Wextra -Wpedantic -O0 -g -D_GLIBCXX_ASSERTIONS -finput-charset=UTF-8
```

初轮统计为649266项断言：边界8555组；Koko1872个数组、12902次最优值调用、83256次predicate调用；Factory845个数组、4596次最优值调用、119846次predicate调用；Division3892个数组、25024次最优值调用、343755次predicate调用。数目是执行范围记录，不是教学质量、互相独立用例数或全题库覆盖率。

这些同名日志已由最终哈希上的重验覆盖：`.local/boundary-independent/gcc-build.log`、`gcc-run.log`、`debug-build.log`、`debug-run.log`。初轮统计保留在本节作为发现过程记录；不能将当前日志错标为初版源码的运行日志。旧版失败的源码快照和最小探针另行保留，见下文。

## 完整提交适配与标准输入输出

初版和修订后的最终源码均分别编译`SECOND_ALGORITHM_FACTORY_MAIN`和`SECOND_ALGORITHM_DIVISION_MAIN`，由外部进程投喂输入、解析stdout，不能通过内部直接调用掩盖main适配错误。

独立Python runner种子`0xA10851620`，Factory随机参考仍为机器倒计时，Division随机参考使用`itertools.combinations`枚举恰k-1个切点。90次完整ACM输入输出检查通过：两原题示例、CRLF与跨行空白、最小规模、各40次固定seed随机、200000规模及10^18结果。输出检查只容许一个等于期待值的整数token、返回码0及空stderr。另编译LC34、LC875两种Solution宏，并实际调用各4例，8项适配期待值通过。

### 持久复现工具

`work/fresh-first-20261028/verify_platform_entries.py`是本轮从零独立验证中产生的工具，不读取`.local`旧runner或旧结果来生成通过结论。需要Python3.10+和已经安装、接受GCC/Clang式选项的C++17编译器。在仓库任意工作目录均通过脚本自身位置定位仓库；`--compiler`优先于环境变量`CXX`，两者未设置时使用PATH中的`c++`。编译器参数是一个可执行文件，不作为shell命令执行。

在仓库根目录可运行：

```sh
python work/fresh-first-20261028/verify_platform_entries.py --compiler c++
```

若本机已设置`CXX`，可省略`--compiler`。本次实际重跑即通过`CXX`选择既有GCC16.2.0，执行：

```sh
python work/fresh-first-20261028/verify_platform_entries.py
```

可选`--source content/boundary-feasibility/边界与答案.cpp`指定相同接口源码，省略时默认即为该文件；相对路径始终从仓库根解析。脚本将编译子进程的TEMP、TMP、TMPDIR和工作目录全部设为仓库`.local/boundary-platform-entries/`，二进制、临时LC runner及日志也全部位于该目录。

本次持久工具的实际结果：`results.json`为passed，90项ACM、2个LC适配器/8项期待值；四次C++17构建返回0、诊断字节均0。随后从仓库`.local/`工作目录使用`--compiler`和仓库根相对`--source`又完成同样检查，并设置一个无效CXX值以确认`--compiler`优先级；仍全部通过。该结果保存源码、测试、工具SHA256及固定seed，运行结束检查源码未被并行修改。进入验证后若构建、执行或源码一致性检查失败，返回非零并将当次结果标failed，不用先前成功替代。它是发布证据的独立复现工具，没有修改CI或登记编译目标，也不冒称其他compile目标会自动运行这些I/O检查。没有提交到在线评测站。

## 发现、复现与修订追踪

阅读初版实现后发现`(pile + speed - 1LL) / speed`并未在第一步加法前加宽：同优先级运算左结合，`pile + speed`先按int计算。原题搜索只用speed<=10^9，原有小域/最大原题测试因此均可通过；但作者公布的predicate合同为任意正int speed，`speed=INT_MAX`时中间加法溢出。

已保留初版源码快照于`.local/boundary-independent/pre-review-source.cpp`。最小复现调用`koko_can_finish({1},1,INT_MAX)`；数学结果应为true。以GCC`-std=c++17 -O0 -ftrapv`编译，实际运行exit=3，受检加法捕获越界；这不是把普通优化构建碰巧返回true当成整数运算安全。日志在`koko-intermediate-probe-build.log`、`koko-intermediate-probe-run.log`、`koko-intermediate-probe-exit.log`，探针源码`koko-intermediate-probe.cpp`。

作者已将表达式修订为`(1LL * pile + speed - 1) / speed`，在第一次加法前提升类型，保持任意正int speed的helper合同。独立测试新增两项INT_MAX速度predicate检查。修订后全量重编译运行的三个配置全部通过，其中`-ftrapv`也为exit0。这个闭环保留“初始通过→边界反查失败→修正→新哈希全量重验”，没有把普通配置碰巧返回正确bool当成中间运算安全。

## 平台与检查边界

实际尝试GCC`-O1 -g -fsanitize=undefined -fno-sanitize-recover=all`，链接失败：`cannot find -lubsan`；没有UBSan通过结果。探查PATH、D盘已安装工具和已存在的VS安装：找到VS2026 BuildTools登记，但其VC/Tools目录不存在，未找到可用第二C++编译器；没有安装任何工作负载。`-ftrapv`只覆盖特定有符号算术检查，`_GLIBCXX_ASSERTIONS`也不是完整内存/未定义行为检测，均不冒称UBSan替代品。

本笔记未覆盖：在线OJ；第二编译器/跨操作系统；完整发布链与浏览器体验。它们不能由这份局部C++验证自动推定通过。作者修订后的当前输入重验已按顶部哈希完成；后续若权威cpp再变，应检查变更影响并重新绑定对应验证，不能借用这份旧哈希放行。
