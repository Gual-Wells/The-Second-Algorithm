# C++ 实战来源与书籍：首轮研究

日期：2026-10-26。起点：`main@caacc0558c48cfbba97af390fc6f8f7d35f24267`，改动前工作树干净。用户要求C++本身按算法章方式系统研究；基础良好、未规范学习，不接受补零基础或先预设八章。此轮先建设来源与选书，不直接生产语言章节。

机器权威：`catalog/sources.json`、`catalog/books.json`、`catalog/scope.json`。用途说明见`docs/SOURCE_POOL.md`和`docs/BOOKS.md`；内容语义只以`protocol/CONTENT_PIPELINE.md`为准。

## 研究结论

1. C++不能只从使用C++的算法题推导范围，也不能以标准目录或输出谜题替代实战。实现题、代码诊断与改写、语义辨析、参考配方、规则和实验工具各有贡献。
2. 优先以GotW、CERT代码病例、TDDD38、CS106L、Exercism及实战书发现问题。cppreference与对应标准核对机制；Guidelines、专题作者及库实现补取舍和变种。CE与Insights解释和实验，不作为题目集合。
3. 首批书以Professional C++ 6e（广覆盖且有练习／官方答案）和The Modern C++ Challenge（具体实现问题）互补；Discovering Modern C++ 2e补机制实现练习。Cookbook贡献参考解法，不把配方改叫训练题。
4. 来源池本轮新增13项，共38来源、67入口。C++相关14项包含既有工作草案和2项实验工具。数字描述登记规模，不代表题库数量或语义覆盖。
5. 本轮未购买、下载商业原件、安装依赖、运行外部习题代码或建立后台活动；无新增持续成本。

## 实际探索路径与读件

并行分工核查书籍、语言来源与实作练习，主Agent复读关键入口。实际检索涉及：`site.cppquiz.org about quiz undefined unspecified C++`、Exercism官方练习与概念入口、Packt书名及recipes、出版社／作者的exercise与solutions、`The Modern C++ Challenge`的题数及官方前言。搜索摘要用于发现与明确标注的书目信息，具体题目及机制尽量回原始页面读取。

| 路径 | 实际取得／读取 | 未做或受限部分 |
|---|---|---|
| GotW | 修订目录与#91完整问题和答案：智能指针参数、六种接口、所有权及性能 | 未读全部历史条目；旧gotw.ca超时 |
| TDDD38 | 当前seminar目录，Static Queue 4页、Type Traits 3页、Allocation Tracker 1页；Deque任务入口；旧Mixed 6页 | Variant正文编码失败；未运行骨架和答案，旧材料不作现代主骨架 |
| CS106L | `archive/cs106l.1212/hashmap2.html`全文任务：const、RAII、迭代器、操作符、复制／移动、自赋值及测试说明 | 未读全学期，未运行源码；不采纳页面对成品质量的宣传性描述 |
| Exercism | README与config部分结构／条目；Power of Troy题干；Circular Buffer题干与测试 | 未统计全量或运行测试；`analyzer:false`不能改写为有自动静态分析 |
| CERT | 新官方静态目录、MEM50和CTR57错误／修复代码 | 旧Confluence502；不能以机构身份代替归因核验 |
| CppQuiz | about、当前C++23规则及#179的const问题 | 未枚举全题；网站源码不含题库 |
| 规则／库目录 | cppreference目录与vector失效；Guidelines介绍与目录；当前草案目录和WG21 2026索引；MSVC STL README | 不是全站精读；当前草案不等同于旧标准，库源码具体版本待取 |
| 补充解释 | LearnCpp目录与Point2d练习；Modernes C++目录；Insights说明及展开示例；CE功能入口 | Modernes具体方法未读；工具未提交实验 |
| 书籍 | 官方目录／样章信息、作者例程和解答库；Professional C++无模块Exercises取得Ch01–Ch34目录 | 商业全书未取得；部分Wiley／Packt销售及订阅页403。不能用源码目录替代全书已读 |

各URL与限制保存于来源登记。书籍原件未来按既有本地教材流程核对版次、实际读章和代码；此轮不设书齐备才开工的门槛。

### 两个需要保留的来源发现

**CERT CTR57：问题代码成立，但归因需纠正。** 页面把`a.i<b.i && a.j<b.j`比较器的“两方向都false”说成违反asymmetry；等价本可表现为两向均false。取`x=(1,1), y=(1,3), z=(2,2)`，可得`x~y`、`y~z`却`x<z`，真正展示的是不可比关系不传递。未来采用这个病例应讲正确机制，不复制错误理由。出处：[CTR57](https://cmu-sei.github.io/secure-coding-standards/sei-cert-cpp-coding-standard/rules/containers-ctr/ctr57-cpp/)。

**TDDD38 Allocation Tracker：题目提示疑似笔误。** 按变量含义，峰值未释放数量应更新为当前未释放数量，题面却写累计分配数量；分配失败提示也没有完整说明throwing `operator new`语义。当前只读题面，未运行官方答案，因此保留为需核验问题，不指控答案代码已证实错误。出处：[原题](https://www.ida.liu.se/~TDDD38/exercises/Allocation_Tracker/exercise.pdf)。

### 题数与代码目录不能互换

Modern C++ Challenge官方前言的检索文本明确100题；本轮直接打开同页返回403，题面预览由另一读取路径取得。官方代码树`6a79f529c038a15c752acb67b4aef7c0d366f1a3`递归结果`truncated:false`，有101个`Chapter*/problem_*`目录，但第96题拆client/server目录，最后目录命名为`problem_9a`。目录计数不是书中题目计数，更不是本项目已读数。代码树只作来源结构证据，未编译。

## 范围入口与组织

暂列类型与推导、初始化、生命周期与移动、资源／异常、函数与重载、类与多态、模板／约束、容器与迭代器、库实作、并发和编译链接等发现方向，见scope的`cpp_discovery_entries`。这是检索入口，不是十章承诺或完备性结论。

每个方向先实际收集代码问题及其重要差异，再归并为可读内容：问题／场景→决定行为或实现的机制→相邻参考代码→改变结论的变种。成熟章节可以兼有编写、修错、改写和辨析，不需要强迫每条采用同一种练习形式。算法与语言共享内容主位置，避免同一机制在多章重讲。

原题用稳定slug／题号、书章页或课程学期路径定位；标准结论记适用版本。编译失败、确定行为、未指定、实现定义、UB、作者取舍及特定库实现分开。C++17仍是算法模板基线；C++20／23实际有价值时可以纳入并明确标签。

暂不把BusTub之类大工程整体列成语言章必做任务：数据库知识和框架负担会偏移本轮目标，P0跨年份也并非同题。若局部实现确有增量，再独立采用相应接口或生命周期问题；尊重原任务公开解答限制。

## 当前边界与下一步

已完成：初步站点用途核查、选定习题读取、实战书元数据核查，协议／范围与来源登记扩充。

尚未完成：所有来源有限目录的完整枚举，C++问题案例归并、机制覆盖反查、任何语言章节的作者稿及代码验证。本轮不新增虚假的reviewed模式或把目录题量计入已有算法案例库。

下一步先选一个可闭合的机制范围，以至少一个实际实现任务联结代码病例与规则；完成题目发现、归并、变种和参考实现后再做与算法章同形态的试章。题目和机制实际调查后再决定篇幅与最终章节，避免提前写稿后拿书目补证。
