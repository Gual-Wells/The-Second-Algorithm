# 第一章前置研究：全部来源站点概况与独立候选比较

快照：2026-10-28。研究对象是尚未选择的大算法思想领域；当前没有已有正式章节。只写本文件与同名JSON，不改全局来源池、教材、研究stage或生产内容。

本报告逐项核了当前 `catalog/sources.json` 的39站、78入口及登记的真实读取边界。这里的“全部概况”是每站有角色、用途、可得/未得判断，不是重爬39站或声称全部正文已读。本轮对16站做了实际页面/API读取或访问尝试；其余23站只核现有登记并明确保留历史日期。`sources-overview.json` 的 `sourceAssessments` 是可解析数组，含 `id/readState/role/reason/locator`，另保留原登记的历史验证，便于根研究账簿整合。

## 全景判断与取证分层

- 原题合同层：12个原题/评测站（LC、Codility、HackerRank、CSES、Luogu、AtCoder、CF、UVa、Kattis、USACO、oj.uz、CodeChef）。Luogu和oj.uz含转载/重托管，身份沿上游，不把镜像当独立题。
- 方法与教材索引层：11站（cp-algorithms、OI Wiki、USACO Guide、CPbook、EPI、Hello Algo、代码随想录、labuladong、doocs、NeetCode、MIT OCW）。其目录可用于边界挑战；题目条件仍向原题核验。
- C++合同层5站、实践/工具8站、实现层3站（ACL另计，MSVC与libc++）。这些支持各题型真实实现和必要知识，不构成独立C++课程或算法题型全量证明。
- 目录、标签、作者分类与原题是不同证据。全目录取得只支持已看见哪些候选分支，不能自动成为所有题意已读、方法已分析、实现已验证或正式章范围已完备。

## 本轮实读与失败事实

下列链接在本轮实际打开；只记录原创分析和定位，不复制网页全文。

1. [CSES目录](https://cses.fi/problemset/)取得分类与题目链接。分类横跨DP、图、查询、树、字符串等；“Sorting and Searching”混有贪心、二分、窗口和排序，不能照抄成单一算法思想章。[Ferris Wheel](https://cses.fi/problemset/task/1090/)及[Counting Rooms](https://cses.fi/problemset/task/1192/)题意、约束和输入输出已读。
2. [Codility导航](https://app.codility.com/programmers/lessons/)取得17课；另读[二分](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/)、[贪心](https://app.codility.com/programmers/lessons/16-greedy_algorithms/)、[DP](https://app.codility.com/programmers/lessons/17-dynamic_programming/)课列表。[MinMaxDivision](https://app.codility.com/programmers/lessons/14-binary_search_algorithm/min_max_division/)的非负元素、允许空块、K与N范围及C++函数合同已核；重复语言不计新题。
3. [AtCoder归档当前页](https://atcoder.jp/contests/archive)与[Educational DP A–Z](https://atcoder.jp/contests/dp/tasks)已读；[DP E](https://atcoder.jp/contests/dp/tasks/dp_e)题意与约束已读。W可达10^9、单项value不超过10^3，说明同一背包任务的状态维度选择会受资源预算改变，不能只按故事归一模板。未读DP全部26题正文。
4. [CF题库当前页](https://codeforces.com/problemset)和[API合同](https://codeforces.com/apiHelp/methods#problemset.problems)已读；实际请求[二分tag API](https://codeforces.com/api/problemset.problems?tags=binary%20search)返回OK、1308条元数据。仅是当时标签过滤记录；标签交叉提示组合，不提供题型独立性、正确解法或岗位频率。
5. USACO注册旧[contests入口](https://usaco.org/index.php?page=contests)返回首页与Error，不能当归档。正确[training归档](https://usaco.org/index.php?page=training)首次超时、重试取得2011–2026季导航。[Cow Dance Show](https://usaco.org/index.php?page=viewproblem2&cpid=690)原题已读；固定登场顺序、并行台位和最小K是明确合同，不能擅改为自由调度。未逐篇枚举全部原题。
6. [LC150](https://leetcode.com/studyplan/top-interview-150/)仍只得到摘要，[LC33](https://leetcode.com/problems/search-in-rotated-sorted-array/description/)原题已读，明确元素互异及O(log n)要求。未取得150完整题单。
7. [HackerRank Kit](https://www.hackerrank.com/interview/interview-preparation-kit)只读专题导航；有Cookie提示。其营销百分比不作本用户岗位概率。
8. [cp-algorithms导航](https://cp-algorithms.com/navigation.html)、[二分文章](https://cp-algorithms.com/num_methods/binary_search.html)中排序边界、任意谓词、答案、连续、倍增/并行目录及所示说明、[DP导论](https://cp-algorithms.com/dynamic_programming/intro-to-dp.html)的记忆化/自底向上/状态开销相关段已读。非整站或全部文章已读。
9. [OI Wiki全局导航](https://oi-wiki.org/)与[USACO Guide general](https://usaco.guide/general)只读目录，用于机制别名和全局分支定位，未把链接目标升级为正文。
10. [CPbook methods](https://cpbook.net/methodstosolve)作者版本说明和过滤结构已读：当前是CP5 draft动态分类，非本地CP4冻结目录；题号仍属于上游OJ。[EPI作者主页](https://elementsofprogramminginterviews.com/)的Judge介绍和版本说明已读，未取全Judge代码。
11. [草案Algorithms](https://eel.is/c++draft/algorithms)目录与[二分标准节](https://eel.is/c++draft/alg.binary.search)已读：检索分区前提、比较次数与迭代步数不能混同。滚动草案不能自动提供C++17许可，后续实现须按目标版本固化。
12. [Kattis](https://open.kattis.com/problems)本轮仍403；[CodeChef practice](https://www.codechef.com/practice)仍JS壳；[NeetCode roadmap](https://neetcode.io/roadmap)仍只有图片链接。访问失败不是题目不存在，不能用第三方目录替代已核原题。

## 全部39站逐站处置

以下每站的“历史已读”保持原登记日期；“本轮未重读”不等同材料无用，也不升级阅读状态。

### 1. LeetCode／力扣 (`leetcode`)

- 角色与当前用途：原题／面试选材。核心面试原题身份与函数式合同；二分、贪心、DP、图搜索均可取材。专题标签只是检索入口。
- 入口：[https://leetcode.com/](https://leetcode.com/)；已注册3个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-statements`。本轮Top Interview 150仅摘要；LC33原题题意、唯一性、复杂度与约束已读。不能声称枚举150题。
- 原登记读取边界（2026-10-26）：Interview 150入口摘要与287原题题干／约束；没有取得150题完整清单。

### 2. Codility Developer Training (`codility`)

- 角色与当前用途：原题／官方方法讲义。17课给独立候选横向对照；14二分、16贪心、17DP均有任务入口，不把每课两题当领域全量。
- 入口：[https://app.codility.com/programmers/](https://app.codility.com/programmers/)；已注册4个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-statements`。本轮17课导航、14/16/17课列表及MinMaxDivision单一题意全文合同已读；网页重复多语言不重复计题。
- 原登记读取边界（2026-10-27）：17个lesson导航、二分lesson任务列表及NailingPlanks题干／约束。 2026-10-27为算法第一章另读Prefix Sums和Caterpillar入口、讲义及指定题干，见work/algorithm-first-chapter/actual-reads.json；未升级为所有课程题已读。

### 3. HackerRank Interview Preparation (`hackerrank`)

- 角色与当前用途：原题／面试专题。面试专题涵盖数组、哈希、排序、搜索、贪心、DP、图、树和回溯；可核真实岗位式输入输出。
- 入口：[https://www.hackerrank.com/](https://www.hackerrank.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-only`。本轮仅准备Kit导航；未进入全部子题。页面公司百分比不能转为我们的目标岗位频率；提示Cookie限制。
- 原登记读取边界（2026-10-26）：准备专题导航与ctci-bubble-sort公开题干。

### 4. CSES Problem Set与作者手册 (`cses`)

- 角色与当前用途：原题／作者题库。全目录适合跨领域地图；Sorting and Searching是混合桶，不应抄作单一章。DP、图、查询、树、字符串与额外专项显示领域层次。
- 入口：[https://cses.fi/](https://cses.fi/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-statements`。本轮目录及Ferris Wheel、Counting Rooms原题题意/约束已读；其余目录条目未升级正文读取。
- 原登记读取边界（2026-10-26）：本轮重新核对完整目录入口及分类链接；此前同日设计演练已保存400题链接清单，不继承为全文已读。

### 5. 洛谷 (`luogu`)

- 角色与当前用途：原题／转载与方法社区。中文原题与可核题号入口，适合条件变型与国内笔试题风；CF/AT/UVa转载须沿上游身份归并。
- 入口：[https://www.luogu.com.cn/](https://www.luogu.com.cn/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮只复核登记；历史只读当前列表和P1182，未枚举全分页；社区题解另证。
- 原登记读取边界（2026-10-26）：题库当前列表页与P1182题干／约束。

### 6. AtCoder (`atcoder`)

- 角色与当前用途：原题／官方竞赛目录。DP Contest A–Z直接显示大领域支系；ABC/ARC/AGC归档可动态补复杂组合题。
- 入口：[https://atcoder.jp/](https://atcoder.jp/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-statements`。本轮归档当前页、DP A–Z清单和DP E题意/约束已读；非全比赛归档，题解User Editorial不统一称官方。
- 原登记读取边界（2026-10-26）：比赛归档当前页、Educational DP Contest任务清单与editorial目录。

### 7. Codeforces (`codeforces`)

- 角色与当前用途：原题／官方目录API。标签交叉有利于检出二分+贪心/DSU/图等组合，题号身份稳定；题干和方法判断仍需逐题。
- 入口：[https://codeforces.com/](https://codeforces.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-api-metadata`。本轮当前题库页、API合同及binary search过滤实际响应；1308条元数据不等于1308独立题型或题意已读。
- 原登记读取边界（2026-10-26）：公开problemset当前页与官方problemset.problems API文档；本轮未取得API结果全集。

### 8. cp-algorithms (`cp-algorithms`)

- 角色与当前用途：方法作者／社区专题。各主题作者解释与实现用于机制、条件和复杂变型；DP、二分、图等导航形成独立分类视角。
- 入口：[https://cp-algorithms.com/](https://cp-algorithms.com/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-method-sections`。本轮导航和二分、DP导论的所述段落已读；非整站。二分当前文章含并行二分入口，成章应主动考察而非默默遗漏。
- 原登记读取边界（2026-10-26）：完整站点导航页面入口与分类；未阅读全文集合。

### 9. OI Wiki (`oi-wiki`)

- 角色与当前用途：方法作者／中文体系。算法基础、搜索、DP、图与数据结构提供中文别名和细分支，用于反查候选边界。
- 入口：[https://oi-wiki.org/](https://oi-wiki.org/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-only`。本轮全局导航读取；条目正文未因导航取得而已读。其竞赛高级分支不自动全部成为求职必要。
- 原登记读取边界（2026-10-26）：主站算法与数据结构导航。

### 10. USACO Guide (`usaco-guide`)

- 角色与当前用途：社区方法／上游题索引。按机制提供原题链接和解题讨论；支持困难变型与第三视角反查，不是USACO官方教材。
- 入口：[https://usaco.guide/](https://usaco.guide/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-only`。本轮general导航；历史二分页实际读件仅作历史证据，未继承当前章节范围；上游题回原平台核。
- 原登记读取边界（2026-10-26）：二分页完整正文及当次20道表题链接和1道正文例题；原题实际读取分别归属对应平台。

### 11. Competitive Programming作者配套站 (`cpbook`)

- 角色与当前用途：教材作者／动态题目分类。作者methods分类用于题型变种与漏项挑战，不把大量题号当完整性证明。
- 入口：[https://cpbook.net/](https://cpbook.net/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`author-directory-version-and-structure`。本轮作者说明与过滤结构已读；现页明确是CP5 draft最新分类，非CP4冻结目录；关联题干未全读。
- 原登记读取边界（2026-10-26）：methodstosolve页的版本说明与分类结构；未逐题读取其数千关联原题。

### 12. Elements of Programming Interviews作者站与Judge (`epi`)

- 角色与当前用途：教材作者／面试Judge。面试题与作者Judge可提供函数合同、边界测试和C++实现对照；本地商业教材由教材研究负责。
- 入口：[https://elementsofprogramminginterviews.com/](https://elementsofprogramminginterviews.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`author-introduction-and-version-notes`。本轮作者主页Judge介绍/版本说明已读；未读取Judge全仓，旧线上Judge已关闭的历史文不能当现服务。
- 原登记读取边界（2026-10-26）：作者主页EPI Judge介绍与作者链接指向的GitHub仓库入口。

### 13. Hello 算法 (`hello-algo`)

- 角色与当前用途：方法／入门书站。适合简练概念图、术语和标准机制复核，不独担高阶题型完整性。
- 入口：[https://www.hello-algo.com/](https://www.hello-algo.com/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史有章级导航，未重读正文；多语言共用内容身份。
- 原登记读取边界（2026-10-26）：书籍站完整章级导航及其作者仓库链接。

### 14. 代码随想录 (`programmercarl`)

- 角色与当前用途：面试方法／LC索引。以题型路线查面试变型；自己的讲解是方法材料，LC题号仍属LC身份。
- 入口：[https://programmercarl.com/](https://programmercarl.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史仅导航与仓库元数据；推广、训练营和最全宣传不作证据。
- 原登记读取边界（2026-10-26）：原站导航及youngyangyang04/leetcode-master原仓库元数据。

### 15. labuladong的算法笔记 (`labuladong`)

- 角色与当前用途：面试方法／框架。框架视角用于比较统一写法与条件缺口，不能用框架统一替代方法前提论证。
- 入口：[https://labuladong.online/zh/algo/](https://labuladong.online/zh/algo/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史二分框架文章可查，不默认受限文章可读，首页提取空白不等全站无内容。
- 原登记读取边界（2026-10-26）：具体二分框架文章与其站内目录，首页文本提取为空。

### 16. LeetCode Wiki／doocs (`doocs-leetcode`)

- 角色与当前用途：社区题解／LC镜像索引。多解法和多语言用于实现对照；同题翻译或代码不增加原题数。
- 入口：[https://leetcode.doocs.org/](https://leetcode.doocs.org/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史导航与仓库元数据；原题条件回LC，需核具体许可证与版本。
- 原登记读取边界（2026-10-26）：站点专题导航与doocs/leetcode原仓库元数据，仓库声明CC-BY-SA-4.0。

### 17. UVa Online Judge (`onlinejudge`)

- 角色与当前用途：原题／CP教材伴题。UVa原题可补连续数值、图、搜索与竞赛变型；按题号/内容ID建立同一身份。
- 入口：[https://onlinejudge.org/](https://onlinejudge.org/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史23篇指定UVa题面已读、10742未得，不代表全站或当前章取材完成。
- 原登记读取边界（2026-10-26）：本轮案例登记的24个UVa题号中23篇官方题面已读，10742未取得；完整范围见二分census与actual-reads。

### 18. Kattis Open (`kattis`)

- 角色与当前用途：原题／CP教材伴题。作者分类中的重要上游，可能补数值/建模题，但不能借作者索引冒充已核原题。
- 入口：[https://open.kattis.com/](https://open.kattis.com/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`blocked-403`。本轮/problems再次403；目录与原题均未取得。保持具体缺口，不绕限制。
- 原登记读取边界（2026-10-26）：尝试公开/problems入口，读取工具返回403。

### 19. NeetCode (`neetcode`)

- 角色与当前用途：面试策展／LC索引。可作选题路线和题型组织的对照，不是原题合同权威。
- 入口：[https://neetcode.io/](https://neetcode.io/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`text-extraction-image-only`。本轮roadmap仍只图片链接，未取得完整路线/题单，不宣称读完NeetCode150。
- 原登记读取边界（2026-10-26）：尝试roadmap入口；文本视图仅返回图片链接。

### 20. AtCoder Library文档 (`ac-library`)

- 角色与当前用途：原作者库／实现合同。Fenwick、segtree、DSU、flow、math等有真实库设施；用于复杂交叉实现，不代替算法题型研究。
- 入口：[https://atcoder.github.io/ac-library/production/document_en/](https://atcoder.github.io/ac-library/production/document_en/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史production模块与约束已读；后续固定版本并核实际模块合同。
- 原登记读取边界（2026-10-26）：production文档入口、模块列表、C++标准说明与约束注意事项。

### 21. USACO official archive (`usaco`)

- 角色与当前用途：原题／官方解析。旧竞赛具高质量条件组合、数据与解析，可为候选大领域提供困难证据。
- 入口：[https://usaco.org/](https://usaco.org/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-statements`。本轮正确归档training及Cow Dance原题已读。注册的contests返回首页/Error；training首试超时、重试成功，未枚举逐篇全部题意。
- 原登记读取边界（2026-10-26）：Cow Dance、Convention、两级Angry Cows、Social Distancing、Loan、Bakery以及Gold Milking Order、Talent Show原题；部分官方解析逐篇记录。

### 22. oj.uz original contest archive (`oj-uz`)

- 角色与当前用途：原竞赛题／评测归档。可为离线、几何、图等高级交叉提供原题与题面PDF，关注任务原出处及OJ重托管身份。
- 入口：[https://oj.uz/](https://oj.uz/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史仅BOI12_mobile单题已读，不能推为全库读取或已有最优实现。
- 原登记读取边界（2026-10-26）：BOI2012 Mobile原题及单页英文题面PDF。

### 23. CodeChef (`codechef`)

- 角色与当前用途：原题／竞赛归档。可补有结构的算法变型；若正文无法取得则不作唯一必要题。
- 入口：[https://www.codechef.com/](https://www.codechef.com/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`javascript-shell-only`。本轮practice只JS壳，未获目录/原题正文；历史TRPTSTIC同样受限。
- 原登记读取边界（2026-10-26）：仅目录身份；原题页面为JS空壳，未取得正文。

### 24. MIT OpenCourseWare (`mit-ocw`)

- 角色与当前用途：大学作者讲义／方法证据。官方讲义用于问题建模、证明和复杂度；峰值搜索可挑战二分必须全局单调的过窄说法。
- 入口：[https://ocw.mit.edu/](https://ocw.mit.edu/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史仅6.006 2011 Lecture1六页及二维峰值图；不是全课资料已读。
- 原登记读取边界（2026-10-26）：6.006 Fall2011 Lecture1完整六页讲义，重点核对二维峰值示意图；不是全课程。

### 25. C++ working draft (`cpp-draft`)

- 角色与当前用途：标准文本／版本语义。标准算法、容器、迭代器和数值边界合同的高权威文本；支持手写与真实标准设施区分。
- 入口：[https://eel.is/c++draft/](https://eel.is/c++draft/)；已注册5个具体入口，完整URL见同名JSON。
- 本轮状态：`directory-and-selected-standard-sections`。本轮Algorithms目录和二分整节读件。eel.is是草案展示，滚动草案不等C++17；正式C++17结论须固定N4659或对应文本。
- 原登记读取边界（2026-10-27）：二分操作整节，用于标准库分区前提及比较/迭代器复杂度；不作为C++17新增特性的许可。 本轮另读草案目录、滚动版本声明及WG21 2026文档索引。 2026-10-27新增固定N4659条款读件，用于C++第一章；只声称实际列明的节，见work/cpp-first-chapter/actual-reads.json。

### 26. cppreference (`cppreference`)

- 角色与当前用途：社区标准参考／机制索引。便查版本、重载、失效、复杂度和示例，再向标准文本核关键结论。
- 入口：[https://cppreference.com/](https://cppreference.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史语言/库目录和vector失效表；不能称ISO官方标准。
- 原登记读取边界（2026-10-26）：语言与标准库总目录、标准版本入口，以及vector迭代器失效表；不是全站全文。

### 27. C++ Core Guidelines (`cpp-core-guidelines`)

- 角色与当前用途：作者设计指南／惯用法。所有权、接口、边界和RAII的必要工程判断，不把建议当语言强制保证。
- 入口：[https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史索引/介绍，未逐规则全读。
- 原登记读取边界（2026-10-26）：介绍、领域与机制索引；页面标注2026-06-14。

### 28. Herb Sutter GotW (`sutter-gotw`)

- 角色与当前用途：作者诊断题／C++设计。针对知识缺口选择示例和反例，不另建C++课程；建议与标准语义分开。
- 入口：[https://herbsutter.com/gotw/](https://herbsutter.com/gotw/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史指定#1/#89/#90/#91/#92不同范围，部分C++14年代，现代规则需重核。
- 原登记读取边界（2026-10-26）：修订版单页实际捕获16个匹配文章链接。正文实际读件包括#1初始化、#89智能指针、#92 auto问题与主要解答；#90只读完整题干及多态工厂答案；#91本轮核对参数拥有关系及条件保留条款，先前已有完整题干／答案读件。未读文章不因目录捕获升级。

### 29. CMU SEI CERT C++ (`sei-cert-cpp`)

- 角色与当前用途：机构规则／诊断反例。比较器、迭代器、内存与整数等工程陷阱可作C++支撑；规则例子也需独立验证。
- 入口：[https://cmu-sei.github.io/secure-coding-standards/sei-cert-cpp-coding-standard/rules/](https://cmu-sei.github.io/secure-coding-standards/sei-cert-cpp-coding-standard/rules/)；已注册3个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史83规则目录及指定正文，不等全读；CTR57已登记归因疑点，不能盲录。
- 原登记读取边界（2026-10-26）：规则单页实际捕获83个匹配规则链接；并发分类另读七个CON50–56链接及五个继承C规则链接的目录。正文为选定范围：ERR56异常提交、OOP52多态销毁、CON53多锁、CON54条件等待；CTR51只读开头及deque/list/vector有效性表，先前另读MEM50与CTR57。不是83篇全文已读。

### 30. CppQuiz (`cppquiz`)

- 角色与当前用途：语言反例题。用作必要语义边界的短诊断，不提供算法主章范围。
- 入口：[https://cppquiz.org/](https://cppquiz.org/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史C++23说明与179题；网站仓库非题库全集，UB分类须核版本。
- 原登记读取边界（2026-10-26）：说明页、当前C++23规则和#179修改真正const对象的题目。

### 31. Exercism C++ (`exercism-cpp`)

- 角色与当前用途：实现练习／测试。可借环形缓冲等测试与合同补工程机制，按算法章所需取用，不照搬其入门顺序。
- 入口：[https://github.com/exercism/cpp](https://github.com/exercism/cpp)；已注册4个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史配置及指定题干/测试，未跑习题测试，analyzer:false。
- 原登记读取边界（2026-10-26）：README、config.json结构及部分条目，Power of Troy题干，Circular Buffer题干和测试；未统计全量题数。

### 32. Linkoping TDDD38 Advanced C++ exercises (`liu-tddd38`)

- 角色与当前用途：大学高级C++练习。队列、分配、模板等机制练习和反例可支持知识条目；不强迫读者上课。
- 入口：[https://www.ida.liu.se/~TDDD38/](https://www.ida.liu.se/~TDDD38/)；已注册5个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史16目录与指定PDF题干；未跑骨架，已有个别提示疑点。
- 原登记读取边界（2026-10-26）：单页实际捕获16个练习目录链接（iso-8859-1）；本轮完整题干文本读取Static Queue四页、Specialization三页、SFINAE三页、Mixed Templates四页、Custom Deque两页；先前另有Allocation Tracker与旧Mixed读件。目录枚举不等于16套正文或参考解答均已读。

### 33. Stanford CS106L assignments (`stanford-cs106l`)

- 角色与当前用途：大学任务／代码阅读。真实HashMap/所有权任务支持迭代器、const、接口等必要语义；不能把手写unique_ptr当标准合同。
- 入口：[https://web.stanford.edu/class/cs106l/](https://web.stanford.edu/class/cs106l/)；已注册3个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史固定仓库版本与指定A5/A7、hashmap读件，非全学期/全仓。
- 原登记读取边界（2026-10-27）：archive cs106l.1212 HashMap任务正文：模板、const、迭代器、RAII、流操作、特殊成员、自赋值与任务测试说明。 2026-10-27另按固定官方仓库版本读取A5/A7任务相关段及所列骨架；范围和字节身份见work/cpp-first-chapter/actual-reads.json，未读全仓或运行作业测试。

### 34. LearnCpp (`learncpp`)

- 角色与当前用途：机制教程／选择性练习。查必要机制与短例子，避免基础课序侵入本项目的高阶实战正文。
- 入口：[https://www.learncpp.com/](https://www.learncpp.com/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史目录与14.x选择题，不代表全站已读。
- 原登记读取边界（2026-10-26）：全站目录及14.x类章节总结练习中的Point2d实现与解答。

### 35. C++ Insights (`cpp-insights`)

- 角色与当前用途：诊断工具／解释性转换。可观察语法展开以辅佐C++说明；输出不是标准规定必须生成的代码。
- 入口：[https://cppinsights.io/](https://cppinsights.io/)；已注册2个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史说明和指定转换例，未提交新实验，不作正确性证明。
- 原登记读取边界（2026-10-26）：项目说明及特殊成员、复制调用、基类转换的展开示例。

### 36. Compiler Explorer (`compiler-explorer`)

- 角色与当前用途：跨编译器实验工具。为有疑点的代码固定标准、选项、编译器/库进行对照；不属于题库。
- 入口：[https://godbolt.org/](https://godbolt.org/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；本轮未跑远程实验；单一汇编或一次通过不证明无UB。
- 原登记读取边界（2026-10-26）：工具页面与编译器、运行、汇编、AST/IR及优化备注入口。

### 37. Modernes C++ (`modernescpp`)

- 角色与当前用途：作者文章／机制实现。按需要补模板、并发或设计文章，算法章不因目录存在而扩成C++全课。
- 入口：[https://www.modernescpp.com/](https://www.modernescpp.com/)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史仅分类目录，具体文章未研究。
- 原登记读取边界（2026-10-26）：分类目录中的模板、并发与lock-free stack等入口。

### 38. Microsoft STL implementation (`msvc-stl`)

- 角色与当前用途：厂商标准库实现／测试。实现可用于观察边界和性能机制；不能把某库/ABI行为提升通用标准保证。
- 入口：[https://github.com/microsoft/STL](https://github.com/microsoft/STL)；已注册1个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史README，后续具体文件须固定commit；不声称实现文件全读。
- 原登记读取边界（2026-10-26）：README中库实现、测试与跨实现比较说明。

### 39. LLVM libc++ implementation regression tests (`llvm-libcxx`)

- 角色与当前用途：标准库实现／回归测试。定点回归能启发失效、异常和非法比较器测试，验证实现差异。
- 入口：[https://github.com/llvm/llvm-project](https://github.com/llvm/llvm-project)；已注册5个具体入口，完整URL见同名JSON。
- 本轮状态：`registry-overview-only`。本轮复核登记；历史llvmorg-20.1.8五份测试全文，未运行上游harness，非题库全量。
- 原登记读取边界（2026-10-26）：llvmorg-20.1.8下5份完整回归文件：optional复制赋值、vector构造异常、filter_view begin缓存、variant复制赋值／换型及无效比较器断言。逐项范围见independent-review/actual-reads.json。

## 独立候选大领域比较（研究提案，不是最终范围）

没有从旧稿范围出发，也不把源目录的一个标签当足够大思想。依据以上独立目录与样题，至少以下方向成立。求职价值是机制迁移与常见评测形式的判断，不用平台标签数或营销比例量化岗位需求。

| 大领域候选 | 内在统摄机制与不可轻省的分支 | 本轮原题与来源可行性 | 第一章取舍判断 |
|---|---|---|---|
| 二分与判定搜索 | 维护可证排除的不确定区间；有序边界、局部有序/重复值、隐式秩、答案判定与可行性检查、连续近似；应主动考察倍增、批量离线/并行二分、与DP/数据结构/图结合的条件和边界。峰值/旋转类不应被强塞成同一全局单调谓词。 | Codility14、LC33、USACO Cow Dance实读，CSES/CP作者分类与cp-algorithms提供扩张路径；标准设施合同明确。 | **站点视角首选候选**：统一机制清楚，复杂度、证明、整数边界和真实库替代容易贯穿；可做大而完整，不必缩成lower_bound模板。理由来自本轮横向比较，非因旧稿已有。仍须教材研究和范围再研究确认。 |
| 贪心 | 保持不劣局部决策；交换/领先性/支配、排序选择、区间与调度、堆维护替换、配对、覆盖、可行性构造；不能只靠“局部最优”口号。 | Codility16、CSES Ferris Wheel已读；CSES Sorting中多个任务可进一步分辨；CPbook与方法站支持各种证明视角。 | 同等有效候选，求职迁移强；需要认真提炼多类正确性机制，否则易变成“排序+随便选”的杂题集。无必要因为不是最短首章就排除。 |
| 动态规划 | 状态充分性、转移与依赖顺序、最优性/计数、记忆化与迭代；背包、序列、多维/区间、树/DAG、状态压缩、数位、概率与重要优化均需评估。 | AtCoder DP A–Z、CSES DP/Tree等目录、Codility17；DP E条件实读证实维度变型。 | 非不可作首章，但承诺“动态规划”就应接受真实广度与多份读件；不能仅用几道线性/背包题伪装整领域。规模来自研究，不按篇幅先删。 |
| 状态空间搜索与图遍历 | 可达状态、访问/回溯状态、顺序与重复控制；DFS/BFS、分层最短、隐式图、连通、拓扑、剪枝/双向/启发式边界，必要时区分回溯枚举与图遍历。 | CSES图全目录及Counting Rooms实读，OI Wiki搜索/图导航；复杂原题充足。 | 有效候选；“图论全家桶”不是一个统一思想，不把最短路/MST/流全塞进遍历。边界需先研究，不能只做岛屿题而称大领域。 |
| 分治 | 将原问题分解再合并；排序/计数、选择、平面点问题、递归状态和离线结构；主定理只是分析工具，非题型本体。 | OI Wiki递归分治与排序、CP分类和方法导航提供入口；本轮未深入读该方向原题。 | 具代表性但本轮证据尚浅，不能因可写归并排序就直接选；若考虑需补实际题意和教材比较。 |
| 前缀状态／双指针／连续片段 | 前缀可抵消状态、单调移动边界及其破坏条件是不同机制；连续对象本身不能保证统摄为一个大思想。 | Codility独立列Prefix/Caterpillar，CSES把对应题散在Sorting、Window、Range；可见丰富交叉。 | **不建议在未进一步论证时作首章大思想**。旧稿素材不能自动恢复；若将连续片段对象直接当思想标题，存在把多个独立机制塞成专题的风险。可分别服务后续大领域。 |

二分候选应把“先证可删半边/判定单调或存在性，再写循环”作为理论核心；真实C++设施有不同替代层次：有序容器/算法的边界检索、判定检查中的排序/堆/前缀结构、数值范围和迭代器合同。没有整题一键库函数时，应展示真实设施负责的层次，不能伪造库解。此处不固定章节数、节数或题数，也不决定最终出版目录。

## 下一阶段应继承的取材策略

1. 整合教材候选分析后由根研究确定初始大领域；本文件不把自己的首选视角写成已决定范围。
2. 若选二分：不从LC二分标签一次拉取后直接作稿。按显式/局部有序、隐式秩、答案+不同检查机制、连续/数值、倍增、离线批量及跨思想应用逐个提取，处理真实成立条件、不可得原题和必要排除理由；并行二分等先进分支至少经过实质范围反查，不能用求职理由无证据跳过。
3. 若选其他候选：沿本报告对应的原题/作者/目录入口重新提取实际题意与方法，不能把二分材料的深度挪作该领域的通过证据。
4. 优先从已可读的原题站形成1–5题/题型的合适练习组合，再用受限站作增量。Kattis/CodeChef不可得时保留缺口，选择能取得的独立原题替代同一机制证据，而非改写成已读。
5. 来源池的后续维护建议是定点修正USACO归档入口、保留CP5动态版本和访问失败记录。本任务权限不改全局池；整合者可决定是否正式更新。全39站不需要每章全爬，亦不应所有站一视同仁要求出题；唯一必要的是用途与真实读取范围清楚。

## 当前未决与停止边界

- 本轮未逐篇阅读CSES、DP Contest或任何全站所有题干，未读CF1308条记录对应题意；没有编译任何成品算法，也没有声称实现验证完成。
- 本轮仅用于overview/独立scope输入。选域后的充分提取、反复综合、范围复审、再研究与封存均未被本报告替代。
- 有些来源的历史专门读件来自已撤回旧章；其“曾实际读过”事实可追溯，但不能继承为现有章覆盖或教学采用。
- 本轮不继续无界浏览，下一步跟随根整合后的研究范围。没有因首章空协同目标降低研究和内容要求。
