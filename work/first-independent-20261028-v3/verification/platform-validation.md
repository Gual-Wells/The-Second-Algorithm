# 新第一章平台入口本地核验

2026-10-28，独立核验新建 `content/interval-decisions/区间上的取舍.cpp` 的真实平台入口。读取本轮实施合同和新源码，未参考旧 cpp、旧测试或旧入口脚本。此前独立范围 probe 已先固定，本次代码任务不改变它的产生顺序。

结论：加入预算DP适配后，本轮本地 GCC 16.2.0、C++17 下，15种宏重新分别编译成功并真实运行；六个CSES独立main共318组stdin/stdout用例，九个LeetCode `Solution`适配共62个场景、153项断言全部通过。编译日志无warning/error。未发现需要修改权威源码的入口问题。本结论不是OJ线上提交通过，不是全输入穷尽，也不替代其他核心函数独立测试、正文审阅、浏览器或发布验收。

## 交付与冻结身份

仅新增：

- `tests/cpp/interval_adapter_test.cpp`：由九种 `INTERVAL_LC*` 宏之一选择真实Solution调用；拒绝缺宏/多种受支持LC宏；直接include `../../content/interval-decisions/区间上的取舍.cpp`。
- `work/first-independent-20261028-v3/verification/verify_platform_entries.py`：直接编译六个独立main与九个适配驱动，分别启动真实进程，保留完整编译命令、日志和机器收据。
- 本报告。

本核验分工未改权威cpp、课程登记、其他测试或依赖锁。未重命名或预处理替换main；六个CSES入口直接把权威cpp编译成六个独立程序，保留真正main的语言语义。

本次验证字节SHA256：

| 文件 | SHA256 |
|---|---|
| 新权威cpp | `eb7d6c3f4e20a9f862bf8daa2e8e8be508289d45457b0ef4f3395222c88aeb03` |
| 新adapter测试cpp | `caf50ed9931bb57309ae8e634c33b7cc43de898207dd105ee9ffadd9be98732c` |
| 新Python入口脚本 | `9b3d79ab0b243800bd01a6824ebd72cb70303eb097440b5597324830b8fa87df` |

脚本在开始、逐入口编译前和最终检查时核对源码/adapter摘要，运行期间输入未变；完成后又单独核对过当前文件摘要。若之后改了源码或驱动，本结果不能冒充新字节结果。

## 六个真实main：318组过程验证

固定随机种子 `20261028`，每个入口48个合法随机小输入（n为1–9），另有30个固定/边界用例。每组都是新的真实可执行进程、完整平台输入和解析后的完整输出，不是把main改名后直接调用。

| 宏与官方合同 | 过程用例数 | 独立模型和主要边界 |
|---|---:|---|
| `INTERVAL_MOVIE`，[CSES1629](https://cses.fi/problemset/task/1629/) | 53 | 枚举全部子集，逐对检查半开兼容，取最大数量；触碰可衔接、重复活动、最早开始陷阱、端点10^9 |
| `INTERVAL_ROOMS`，[CSES1164](https://cses.fi/problemset/task/1164/) | 53 | 穷举房间分配并按对冲突核合法，求真正最少房数；独立检查输出的每人房号、房号范围、闭日冲突、原输入顺序；允许不同合法房号，不与某一答案硬比；同日、同刻、多份相同订单、坐标10^9 |
| `INTERVAL_PROJECTS`，[CSES1140](https://cses.fi/problemset/task/1140/) | 54 | 小例枚举全部子集并逐对核闭日兼容，最大化收益；同日冲突、单日项目、前驱序列非单调；另有合法n=200000、每项收益10^9、不重叠单日项目，总收益 `200000000000000` |
| `INTERVAL_CUSTOMERS`，[CSES1619](https://cses.fi/problemset/task/1619/) | 52 | 对每个到达时刻独立枚举所有客户判断占用；随机生成的所有到离时刻全异，遵守原题条件，不拿该题覆盖原题未允许的同刻语义；全交叠、全分离、端点10^9 |
| `INTERVAL_MOVIE_II`，[CSES1632](https://cses.fi/problemset/task/1632/) | 53 | 枚举全部子集，在各开始时刻直接检查所选半开区间深度≤k，取最大数量；包含必须保留早释放资源的反例、多份相同释放时刻、k=1、k=n、端点10^9 |
| `INTERVAL_NESTED`，[CSES2168](https://cses.fi/problemset/task/2168/) | 53 | 对所有i≠j直接检查两端包含关系，输出完整contains/contained两数组；保持原序、同左端/同右端、交叉非包含、单个区间、坐标10^9；随机输入无完全重复区间，遵守官方合同 |

房间分配的最优参考是分配穷举，不以被测堆或三版实现互相同意作参考。固定k的子集可行性使用区间深度等于所需资源数这一数学关系，过程不执行被测有序前驱贪心。CSES原题不接收n=0，本平台层没有把helper的空集拓展冒充原题用例。

## 九个Solution适配：62个场景、153项断言

每个宏在独立可执行文件内选中一份真实Solution，并用同一个Solution对象连续调用多个场景，检查返回值与本轮合同声明的调用者输入不变。assertion计数包含输入保留检查，故不把153说成153种独立算法输入。

| 宏 | 场景数 | 断言数 | 区分力 |
|---|---:|---:|---|
| `INTERVAL_LC56` | 6 | 12 | 官方样例、闭端点相接、无序、嵌套不能缩短并集、重复单点、坐标边界；返回分量按集合规范化比较 |
| `INTERVAL_LC57` | 8 | 24 | 官方样例、桥接多个分量、合法空输入、首/尾插入、已包含、端点桥接、真正单点空隙；同时检查newInterval不变 |
| `INTERVAL_LC435` | 6 | 12 | 官方样例、重复对象、接触可衔接、最早开始错误反例、负坐标及原题端点边界 |
| `INTERVAL_LC452` | 7 | 14 | 官方样例、分离、闭端点命中、并集连通不等于单点刺穿、重复/嵌套、INT_MIN到INT_MAX两端 |
| `INTERVAL_LC1024` | 7 | 14 | 官方样例、缺前缀/中间/后缀、看尽可接候选再决定、零长度片段、目标100 |
| `INTERVAL_LC1235` | 8 | 32 | 官方样例、同起点、收益不能用数量贪心、前驱不单调、等端点衔接和输入乱序、端点10^9、50000项各10000的原题总收益上界500000000 |
| `INTERVAL_LC1751` | 8 | 16 | 三个官方样例（含k=2却只取一项收益10）、闭日接触冲突、同日替代/次日衔接、k=1乱序、端点10^9与单项价值10^6、n=k=1000且总价值10^9 |
| `INTERVAL_LC1851` | 5 | 15 | 官方样例、无答案、堆顶过期、重复/乱序查询、单点、闭整数长度及10^7边界 |
| `INTERVAL_LC1094` | 7 | 14 | 官方样例、容量恰好、同位置先下后上、反复复用、坐标0/1000、1000项各100人的总负载100000及差1不足 |

本次另外实际读取了新增适配的官方 [Insert Interval](https://leetcode.com/problems/insert-interval/) 与 [Car Pooling](https://leetcode.com/problems/car-pooling/)：前者要求输入已按左端排序且互不重叠，允许空数组且不要求原地修改；后者明确同位置先下客再上客。其余六类合同与此前独立原件读取一致，测试未要求超出原题的输入恢复或任意64位坐标安全。

预算DP扩充另依据此前独立实读的 [LC1751官方题面](https://leetcode.com/problems/maximum-number-of-events-that-can-be-attended-ii/)：选的是至多k项、完整活动、结束日包含。由 `k<=n` 与 `n*k<=10^6` 推得 `k<=1000`，单项价值最多10^6，因此合法返回值最多10^9，adapter收窄成int在原题界内安全。最大预算场景同时达到n*k=10^6与这项价值界。本平台层只覆盖该入口的闭日、合法k>=1合同；不以此声称通用bounded_weighted的半开、k=0等额外API分支都已在此覆盖。

## 可复现命令与产物

仓库根目录下执行：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python -B work/first-independent-20261028-v3/verification/verify_platform_entries.py --compiler $env:CXX
```

`--compiler` 优先于CXX；脚本还支持 `--source`、`--output`、`--seed`、`--random-cases` 和逐进程 `--timeout`。输出只能放本仓库 `.local`。源码默认与root定位取自脚本位置，不依赖调用者当前工作目录；本轮实际执行位置是仓库根，不额外宣称已经从所有工作目录实跑。

每种宏的编译形式为：

```text
<existing-g++> -std=c++17 -O2 -Wall -Wextra -Wpedantic -D_GLIBCXX_ASSERTIONS -D<INTERVAL_MACRO> <real-cpp-or-adapter-cpp> -o <D-.local-binary>
```

完整绝对路径命令、编译器版本、种子、输入摘要、每入口结果和用例名已保存在机器收据：

`.local/interval-platform-validation/runs/76ac4e50fbf140c78d4515f0ca62bbaa/results.json`

最新全量重跑耗时85.259秒。编译、运行日志和15个可执行文件均在同一D盘run目录，总文件长度39,817,668字节（约38.0MiB）。所有子进程用显式参数数组、`CREATE_NO_WINDOW`（Windows），TEMP/TMP/TMPDIR指向该run的D盘tmp；无shell拼接、无安装、无在线提交、无部署、无新持续成本。

脚本失败时会返回非0，保留失败输入/输出或编译日志，并在results.json保留未完成入口；不把编译成功算作运行通过。此前14入口成功收据 `9c54801fa4cd442db4808189e06931b5/results.json` 仍保留在同一runs根目录，源hash为 `0fb7913104a28450064dd494f52ecf301050ba33cd37ef5242c0fc796398955c`。它是预算DP加入前的历史结果，不授权当前源码；本报告结论使用上列15入口新收据，没有删除或覆盖旧收据。

## 结论边界

这次证据支持：在当前冻结字节及本机工具链下，所有声明的平台入口能编译，并对上述官方样例、区分性边界、小随机独立参考与数值上界作出正确输出。它不证明所有合法规模全部正确，不证明其他编译器/操作系统已运行，不声称全部核心API与方案回溯都在这份平台测试中覆盖。root仍须把九个macro（含INTERVAL_LC1751）登记为九个真实run目标，并完成当前课程的整体验证与发布准备。

## 发布前路径独立性修订与复跑

脚本默认编译器已从机器专用路径改为CXX或g++；`--compiler`优先级不变。当前公开脚本的完整15入口复跑仍通过318组main过程与153项adapter断言，权威源码和测试驱动未变。最新本机收据：`.local/interval-platform-validation/runs/1a86b9c9c4be4c8c8dc6cda0370d6cb3/results.json`。绝对工具路径和完整命令仍只留本机收据，不进入公共报告。此前76ac4e收据是同源码的前次成功，保留而不覆盖。
