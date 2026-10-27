# 初步来源站点池

本池服务于求职算法与 C++ 实战总册的内容发现、条件核对、归并和查漏。机器可读权威记录在 [`catalog/sources.json`](../catalog/sources.json)，本页解释用途与采集边界。2026-10-27登记为 **39来源、78入口**；首章研究补入CS106L固定任务、N4659版本条款和Codility方法入口，既有LLVM libc++固定回归来源保留。来源数不表示读件数，不把规则参考、练习与实验工具混算为题库。

**接受一个来源，不表示已读完整站点；访问一个入口，也不表示已取得完整题单。** `admission` 表示是否采用，`verification` 表示本轮实际读到哪里，`entries.enumeration` 表示清单取得方式及适配器状态。这三个判断独立保存。

## C++ 本身的来源池

初步采用以下分工。大学页面取具体练习和资料，不要求用户上课；只读目录的来源仍只记目录读取，未运行的代码不记测试通过。具体读件和已发现的来源瑕疵见[本轮研究](../research/2026-10-26/cpp-source-foundation.md)。

| 来源 | 主要用途 | 已核查范围与边界 |
|---|---|---|
| [GotW](https://herbsutter.com/gotw/) | 分析代码、选择接口、修错与改进 | 已读修订目录及#91智能指针参数的完整问题／解答；部分更新到C++14，不能照搬所有历史建议 |
| [TDDD38练习](https://www.ida.liu.se/~TDDD38/lecture/index.en.shtml) | 模板、类型萃取、容器与分配等具体实现题 | 已读Static Queue、Specialization和Allocation Tracker题面；Deque只读入口，Variant正文未取得。未运行骨架或答案 |
| [CS106L任务](https://github.com/cs106l/cs106l-assignments)与[历史HashMap](https://web.stanford.edu/class/archive/cs/cs106l/cs106l.1212/hashmap2.html) | 在给定结构上研究const、迭代器、操作符与复制／移动实现 | 历史HashMap读件保留；首章另固定官方仓库A5/A7任务与骨架，记录课程const合同差异；未运行上游autograder，不混用学期或把整项作业视为必学单位 |
| [Exercism C++](https://github.com/exercism/cpp) | 具备题干、概念映射、示例解与测试的实现题 | 已读配置、智能指针题、Circular Buffer题干与测试。大量题偏基础，按机制增量筛选；配置不代表全题已处理 |
| [CERT C++](https://cmu-sei.github.io/secure-coding-standards/sei-cert-cpp-coding-standard/rules/) | 违规代码到修复的病例与变种 | 已读规则目录、MEM50与CTR57；官方归因仍需核验，CTR57有明确可纠正的解释问题 |
| [CppQuiz](https://cppquiz.org/quiz/about/) | 短代码行为与语义边界反查 | 当前规则为C++23，已读#179；不作为实战主干。网站源码仓库不包含题目数据 |
| [cppreference](https://www.cppreference.com/) | 语言／库机制目录、条件、复杂度、失效与版本区别 | 已读总目录及vector失效表；是社区参考而非ISO标准 |
| [C++草案](https://eel.is/c++draft/)／[WG21文档](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2026/) | 对应版本规则、条款与设计依据 | 既有二分操作读件继续保留；另读目录和文档索引。滚动草案、提案、已采纳标准必须区别 |
| [Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) | 接口、所有权、资源、类与并发等设计取舍 | 初轮读介绍和目录；首章另读R.30及指定相关规则，根反查读R.37具体病例；建议不是标准条款，不称整站已读 |
| [LearnCpp](https://www.learncpp.com/) | 按缺口补机制例子与实现练习 | 读目录与类章节Point2d练习／答案；不要求初学课程顺序 |
| [Modernes C++](https://www.modernescpp.com/index.php/table-of-content/) | 模板、并发等专题实例扩张 | 本轮只核查目录；具体文章与版本尚待研究 |
| [Microsoft STL](https://github.com/microsoft/STL) | 标准库实际实现与测试病例 | 本轮读README，后续固定具体commit／release；ABI和实现习惯不是通用保证 |
| [C++ Insights](https://cppinsights.io/) | 展开隐式机制辅助解释 | 已读说明与展开示例；它不是标准规定的编译过程，本轮未提交新实验 |
| [Compiler Explorer](https://godbolt.org/) | 跨编译器、标准、选项及汇编实验 | 已核查工具入口，本轮未提交实验；一次输出不能认证可移植语义 |

算法题库中使用了C++，不等于覆盖C++语言机制；语言谜题能揭示规则，也不等于能写出相应实现。优先围绕实现、诊断和改写发现问题，再由规则资料核验，用实验和必要源码解释实际差异。书籍及其官方源码另见[实战书单](BOOKS.md)，不重复算作独立题目集合。

HackerRank既有来源新增的C++方向只作扩展线索：当前首页大量入门题且存在分页／动态枚举边界，暂未声称取得其完整语言题单。LLVM libc++已按固定版本的具体回归入口登记，不代表全库正文已读；libstdc++与The Old New Thing仍是后续扩张线索，采用具体案例时再登记。BusTub默认不纳入C++主池：领域与框架负担偏大，同名P0跨年内容也不同。

## 核心原题与测评平台

| 来源与入口 | 用途 | 本轮实际核查与边界 |
|---|---|---|
| [LeetCode Interview 150](https://leetcode.com/studyplan/top-interview-150/)／[原题示例](https://leetcode.com/problems/find-the-duplicate-number/description/) | 求职题目、原题条件、学习计划基线 | 已读学习计划摘要与选定原题。当前文本视图没有返回完整 150 题清单；保留待枚举。中英站别名和题号要关联 |
| [Codility Lessons](https://app.codility.com/programmers/lessons/) | 独立于 LC 的招聘测评题型 | 已核对 17 课导航、二分课任务及一个选定题目的题干／约束。按 lesson 和任务 slug 枚举，不把多语言重复正文当新题 |
| [HackerRank Interview Kit](https://www.hackerrank.com/interview/interview-preparation-kit) | 测评平台题型、函数接口与输入输出要求 | 已读专题入口和一个公开题目。部分公式在文本视图缺失；不能称条件已经完整取得。首页比例不作为目标岗位频率 |
| [CSES Problem Set](https://cses.fi/problemset/) | 可枚举的独立题目体系与结构性反查 | 已核对目录。先前同日研究保存了 400 个任务链接，但这不是 400 题全文已读或已归类；运行时以本次真实快照为准 |
| [洛谷题库](https://www.luogu.com.cn/problem/list) | 中文别名、原题和历史竞赛变种 | 已读当前列表页与 P1182。全部分页未验证；CF、AT、UVa 转载保留原平台身份，不能重复计题 |
| [AtCoder 归档](https://atcoder.jp/contests/archive)／[DP 任务](https://atcoder.jp/contests/dp/tasks) | 公开专题与比赛题目 | 已读归档当前页和 DP 任务清单。归档有分页；editorial 需区分官方、用户和缺失项 |
| [Codeforces 题库](https://codeforces.com/problemset)／[官方 API 说明](https://codeforces.com/apiHelp/methods#problemset.problems) | 题目元数据、标签、变种和原题 | 已读题库当前页及 API 文档。本轮未取得 API 全集；题目标签只作线索。Gym、交互和超范围内容另行筛查 |

这些站点对自己的题目身份和题干有直接价值，但不自动证明任何一份社区题解正确。平台、学习计划与题目难度，也不能独自决定本项目的学习范围。

## 核心方法与书籍配套来源

| 来源与入口 | 用途 | 本轮实际核查与边界 |
|---|---|---|
| [cp-algorithms 导航](https://cp-algorithms.com/navigation.html) | 方法目录、成立条件、技术细节与关联题 | 已读导航，不是已读所有文章；后续固定仓库 commit 和文章路径 |
| [OI Wiki](https://oi-wiki.org/) | 中文方法、别名、组合专题与范围查漏 | 已读主导航。范围宽于求职，相关主题实际读取后再纳入，不按整个目录自动写书 |
| [USACO Guide](https://usaco.guide/general) | 模块、方法、资源与原题之间的扩展 | 已读 General 入口。它是社区 Guide；外部原题按上游身份归并，竞赛分级不当求职频率 |
| [CP 作者题目分类](https://cpbook.net/methodstosolve) | 方法到 UVa／Kattis／LC 等原题的交叉索引 | 已核对页面的版本声明与结构。**该页现为 CP5 draft 的动态分类，不是冻结的 CP4 书中目录**。只取得分类不等于已读所有关联原题 |
| [EPI 作者站](https://elementsofprogramminginterviews.com/)／[EPI Judge](https://github.com/adnanaziz/EPIJudge) | 面试实战书、C++ 练习与作者配套测试 | 已读作者介绍和原仓库入口。没有把公开 Judge 当作已取得全书；书籍版次、样章、用户提供原件分别记录 |

书籍名称与动态网站版本要分开。后续用户提供教材时，登记书名、作者、版次、文件摘要和实际读取章节，再与来源池关联；不根据一本书的目录宣称所有相关算法已研究。

## 已采用的扩展来源

| 来源 | 用途与边界 |
|---|---|
| [Hello 算法](https://www.hello-algo.com/) | 核对基础方法、解释组织与代码清晰度。已读导航；它的入门定位不能独自支撑高阶范围完备性 |
| [代码随想录](https://programmercarl.com/)／[原仓库](https://github.com/youngyangyang04/leetcode-master) | 中文求职题型与 C++ 编排对照。限公开算法材料；训练营、代练、推广及其他商业链接不纳入 |
| [labuladong 二分文章](https://labuladong.online/zh/algo/essential-technique/binary-search-framework/) | 框架归并、局部变种和习题组织对照。具体文章可读，首页文本视图为空；受限章节仍记未取得 |
| [LeetCode Wiki](https://leetcode.doocs.org/)／[doocs 原仓库](https://github.com/doocs/leetcode) | 题型候选发现、多语言实现与别名核对。是聚合分析来源，不替代 LC 原题条件；不同语言不是不同原题 |
| [AtCoder Library 文档](https://atcoder.github.io/ac-library/production/document_en/) | C++ 实现接口、约束与边界核对。已读模块导航；它是实现参考，不是题型覆盖目录 |

社区来源的价值在于分类与分析增量。它们引用同一道原题时，题目只保留一个上游身份，分析材料可以有多份；算法正确性仍需回到条件和实现核查。原仓库、翻译、镜像和网站不重复计算为多个独立题库。

## 候选与访问受限来源

| 来源 | 当前状态 | 后续动作 |
|---|---|---|
| [UVa Online Judge](https://onlinejudge.org/) | 本轮多篇官方PDF已实际取得和读取；官方PDF与外部题号已关联，站内总目录未枚举 | 按专题逐篇研究；UVa10742本轮仍未取得，区分题号与站内content ID |
| [Kattis Open](https://open.kattis.com/problems) | 本轮读取公开目录返回 403，未取得题单或全文 | 保留候选；正常可访问时核验，不以书中引用代替原题已读 |
| [NeetCode Roadmap](https://neetcode.io/roadmap) | 本轮文本视图只返回页面空壳／图片链接，完整题单未取得 | 后续正常渲染公开页面，确认实际题目集合与 LC 身份后再采用 |

访问受限不等于内容无价值，入口成功也不等于清单完整。不能绕过访问控制、购买未授权内容，或用镜像偷偷把“未取得”改成“原件已取得”。

## 清单枚举如何推进

先做 CSES 与 Codility 的明确范围清单，再接入方法导航和固定仓库目录。对于动态、分页或受限入口，先保留真实人工读件与候选记录，不为统一工具外观虚构自动化成功。

- `cses_html`：提取任务唯一链接与目录分类，保存输入快照和摘要；取得目录与读完题干分别计状态。
- `codility_html`：先枚举 lesson，再按任务 slug 去重；多语言页面正文只代表一个任务。
- `cpbook_table`：直接读取发布表格中的UVa／Kattis／LC身份与方法分类；原题链接或题名尚待脚本解析时保留明确未知状态，不丢掉占位记录，也不虚构原题已读。
- `link_index`：仅提供特定页面内的候选链接。除非范围规则和边界已经核对，它不能自动认证“本站完整目录”。
- `github_tree`：未来按仓库不可变 commit 枚举相关路径；需检查目录／API截断，不依赖默认分支在处理期间保持不变。
- `manual`：有意保留正常人工／浏览读取路径，记录实际范围、限制与未取得项。人工并不等于低可信，虚报完整才是问题。

`implemented` 只表示适配器已实现并针对该入口验证，不能表示全部材料已读。初始登记时尚未集成的入口保留 `planned` 或 `manual`，实际采集后由执行结果更新。

2026-10-26 算法研究先接通8个入口：CSES problemset、Codility lessons／binary-search、AtCoder educational-dp、cp-algorithms navigation、CPbook problem-classification、USACO binary-search、AtCoder Library documentation。其阶段结果见[来源状态](../research/2026-10-26/source-status.json)。后续C++研究增加GotW修订文章、TDDD38练习目录及CERT规则列表三个成功快照，当前合计11个指针，由[inventory-heads](../catalog/inventory-heads.json)定位。

C++新快照分别取得16个文章链接、16个练习目录、83个规则链接；读取正文仍限实际登记范围。TDDD38按页面声明显式使用iso-8859-1，不以有损替换解码。Exercism配置另有101项有限目录分析；LLVM libc++固定llvmorg-20.1.8的五份实际回归材料用于独立反查，未执行其完整上游harness。详见[C++首轮研究](../research/2026-10-26/cpp-full-cycle.md)。

自动采集 OI Wiki 本次遇到 TLS EOF、Hello 算法返回 HTTP 429，均保留失败记录，没有冒称采集成功或继续绕过限制。USACO 的下一模块导航与清单分页已按明确单页入口区分；此页原题链接捕获不表示整个 Guide 已枚举。

## 动态扩张与维护

本轮实际新增的原始入口包括[USACO](https://usaco.org/)原题和官方解析、[oj.uz](https://oj.uz/problem/view/BOI12_mobile)的BOI题面、[MIT OCW峰值讲义](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-1-algorithmic-thinking-peak-finding/)、[C++草案二分操作](https://eel.is/c++draft/alg.binary.search)；[CodeChef TRPTSTIC](https://www.codechef.com/problems/TRPTSTIC)仅取得身份，JS壳保留候选。没有为站点数量增加付费或后台服务。

二分实查还修复了http/www原题链接漏采，以及遗漏CodeChef、oj.uz的过滤范围。当前USACO快照为23链接（21原题、2方法）；此前14链接快照只代表旧过滤结果，不再用它作完整题目表。详细的失败与实际读取边界见[本轮研究](../research/2026-10-26/binary-full-cycle.md)。

后续出现以下任一情况，可以新增候选来源：发现当前目录外的新模式；提供会改变算法的关键约束或反例；提供独立原题生态；补足已有材料无法证明的方法细节；改善原件的可读性或可枚举性。

新来源先登记入口、用途、上游关系和本轮已读范围，再决定采用。不能因为链接多、排名高、转载量大或宣称“最全”就提升为范围权威。

每次专题研究按缺口选择来源，不为流程重复扫描全部站点。更新时比较明确版本／快照的新增、删除与条件变化，只重开受影响的模式；发生访问故障时保留已有成功原件与待处理状态。被已有发布引用的来源即使暂停，也保留其身份、历史读件和关系。

池的规模不是验收目标。验收看来源之间能否形成互补发现、候选是否有去向、重要差异是否进入正文，以及读者能否按题目条件找到正确方法与 C++ 参考实现。
