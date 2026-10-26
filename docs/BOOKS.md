# 第二算法实战书单

算法方面优先寻找 **EPI 的 C++ 版和 CP4 两卷**。C++ 本身的实战资料另见下节，首批优先 **Professional C++ 第6版＋The Modern C++ Challenge**。书是总册的研究材料，用户无需按书从头上课或全部刷完。

以下推荐以 2026-10-26 实际核查的作者／出版社资料为准。`core` 表示优先收集，不表示必须购买。本轮已接收用户提供的 CP4 与 EPI 文件，原件仅在本地鉴别与预处理；取得状态与采用版本见书目登记和[本地教材约定](LOCAL_MATERIALS.md)。

| 优先级 | 可直接寻找的书 | 在本项目中的角色 |
|---|---|---|
| 首批 | **Elements of Programming Interviews in C++: The Insiders’ Guide**，Adnan Aziz、Tsung-Hsien Lee、Amit Prakash | 求职题型、解题推导、C++ 实现与变种 |
| 首批 | **Competitive Programming 4**，Steven Halim、Felix Halim、Suhendry Effendy，**Book 1＋Book 2** | 算法与题型广度、分类、竞赛型上机题补充 |
| 可选，中文补充优先 | **《算法竞赛进阶指南》**，李煜东，作者推荐的大象出版社重新排版修订本 | 中文进阶题型、判定思路与具体实现 |
| 可选，专题深挖 | **《算法竞赛入门经典——训练指南》2021升级版**，刘汝佳、陈锋，清华大学出版社，**ISBN 9787302571742** | 复杂建模、专题例题与实现的深入比较 |
| 可选，免费补充 | **Competitive Programmer’s Handbook**，Antti Laaksonen | 免费的方法地图与 C++ 参考；不是高阶主书 |

## EPI C++

请按完整英文名查找，并确认语言为 C++。作者提供的 [官方样章](https://elementsofprogramminginterviews.com/sample/)直接展示了问题、解法和实现；[作者官网](https://elementsofprogramminginterviews.com/)还链接 EPI Judge 配套资源。它适合校准总册与算法面试的距离。

它不能独自覆盖全部国内上机笔试和竞赛型问题。书中非算法面试章节不属于本册主范围。未核实正式中文译本，不指定未经确认的中文译名；也不将它与 Stepanov／McJones 的 *Elements of Programming* 混淆。本轮采用原件已核实为 **2015、Version 2.0.0 的 C++／C++11 版，530物理页**；图像主件为权威，同版 OCR 伴随件仅用于定位，不能直接抽出可信代码。

## CP4 两卷

参考[作者官网](https://cpbook.net/)与[两卷目录](https://cpbook.net/details)确认书名和卷数。书中以具体 OJ 问题与实现连接算法主题，适合作为总册广度核查材料；高阶数学、几何及竞赛专用技巧需要按求职范围筛选。

必须区分书与站点版本：作者说明 CP4 纸书发布于2020年，2022年增加电子版；当前 [Methods to Solve](https://cpbook.net/methodstosolve) 已明确是 **CP5 草稿的动态分类**，不能把它当作冻结的 CP4 目录。纸书、勘误与动态分类分别登记。

本轮采用 **Book 1 的329物理页与 Book 2 的352物理页**，内页说明对应2020年原内容；2022年PDF创建日期不代表新版内容。两卷已有页级检索、字形坐标和目录范围；提取层错误字体映射已按原PDF字形名称作可审计修正。Book 2物理55、258页的特殊大括号组件待核，公式二维结构仍需结合原页。原件未改写，也未声称全书代码与语义校对完成。

## 算法竞赛进阶指南

以[作者配套仓库](https://github.com/lydrainbowcat/tedukuri)为核查入口。作者当前推荐重新排版修订的大象出版社版本，并解释过去多次所谓“第X版”实际对应印刷修订，不能随意替它标为正式“第二版”。原件导入时，以版权页、目录与勘误确认实际印次。

它的配套代码、数据和题目去向有助于把中文讲解落实到可核对的题目。[洛谷官方书单](https://www.luogu.com.cn/training/400)正文链接各章子题单，可作为额外定位入口。历史 OJ 链接仍须逐项核对，不默认一直可用。

## 训练指南2021升级版

以[清华出版社详情](https://www.tup.tsinghua.edu.cn/bookscenter/book_08256901.html)核实 **ISBN 9787302571742**。这本是通过专题例题展开方法与实现的进阶训练资料，不是普通《算法竞赛入门经典（第2版）》，也不是2012旧训练指南。

适合在某一专题需要更多建模与变种时使用；与前几本有较多重合，先不增加必购任务。数学、几何与部分高阶图算法不因书中存在就自动进入求职主干。

## 免费补充

[CSES 作者书目](https://cses.fi/book/index.php)提供 *Competitive Programmer’s Handbook* 的官方免费 PDF 和项目入口。可直接作为后续收集对象，但本项目尚未导入原件；公开可下载与实际已取得是两个状态。它更适合作为结构参考，不替代前几本的详细题目分析。

## C++ 本身：实战书来源

这一组与算法教材互补，服务于具体代码问题、语言／库机制、关键差异和参考实现的系统整理。它不是从零学习顺序。2026-10-26 核查了官方书目、目录／样章入口与配套仓库；尚未取得这些商业原件，也没有声称逐页读完全书。

| 取得优先级 | 准确书名与版本 | 真实材料形态及采用理由 |
|---|---|---|
| 首批主干 | **Professional C++, 6th Edition**，Marc Gregoire，Wiley，2024，ISBN **9781394193189** | 广覆盖的语言／库与工程案例，有章后练习及作者官方解答源码；对象、内存、模板、容器、迭代器、并发等可作为机制和实现任务母本。涉及 C++23；按题标版本、选择相关章节 |
| 首批题源 | **The Modern C++ Challenge**，Marius Bancila，Packt，2018，ISBN **9781788993869** | 100 个问题与解答，面向 C++17；除数学算法，还包括语言特性、字符串、容器、文件、并发等具体实现任务。作者明确不逐项教授解法所用语言特性，须与机制资料配合 |
| 第二批，机制练习 | **Discovering Modern C++, 2nd Edition**，Peter Gottschling，2021出版／版权2022，Addison-Wesley Professional，ISBN **9780136677642** | 目录含移动赋值、资源救援、泛型栈、自定义迭代器、`make_unique` 等实现练习；C++17／20，部分科学计算题按价值取用。官方代码仓库已确认是例程，未确认包含所有练习的答案 |
| 第二批，参考解法 | **Modern C++ Programming Cookbook, 3rd Edition**，Marius Bancila，Packt，2024 | 140＋实用配方，覆盖现代语言、库、惯用法和并发，配套源码公开。用于实现和变种对照；配方不是140＋道待解训练题 |
| 专题补充 | **C++ Concurrency in Action, 2nd Edition**，Anthony Williams，Manning，2019，ISBN **9781617294693** | 线程安全结构、并行算法、线程管理等案例与实作，覆盖至 C++17；并发章需要时再取，不代替通用 C++ 题目基座 |
| 语义短题补充 | **C++ Brain Teasers: Exercise Your Mind**，Anders Schau Knatten，PragProg，2024，ISBN **9798888650516** | 25 个短程序及行为解析，补初始化、转换、重载与生命周期的边界；含刻意古怪的问题，不能主导求职实战范围 |

推荐依据：Professional C++ 的[官方例程与习题解答](https://github.com/Professional-CPP/edition-6)；Modern C++ Challenge 的[官方配套仓库](https://github.com/PacktPublishing/The-Modern-Cpp-Challenge)；Discovering Modern C++ 的[出版社目录](https://www.informit.com/store/discovering-modern-c-plus-plus-9780136677642)与[作者例程](https://github.com/petergottschling/dmc3)；Cookbook 的[官方源码和章节说明](https://github.com/PacktPublishing/Modern-Cpp-Programming-Cookbook-Third-Edition)；并发书的[出版社页](https://www.manning.com/books/c-plus-plus-concurrency-in-action-second-edition)；Brain Teasers 的[出版社页](https://pragprog.com/titles/akbrain/c-brain-teasers/)。部分出版社页本轮返回403，能读到的作者／官方源码与打不开的销售页分别登记。

Modern C++ Challenge 的100题由[官方前言](https://subscription.packtpub.com/book/programming/9781788993869/pref/preflvl1sec01/preface)核实；源码中同一题的客户端／服务端可以有两个目录，不能以目录数替代题数。

**先取得前两本即可开始建立基座；第三本补充语言机制的实现练习。** 这不是让用户重新上三门课，也不要求全部书籍齐备才能研究。书中现成分类用于交叉核对，最终章节仍按问题和机制重新组织。

Herb Sutter 的 *Exceptional C++*（47题，1999出版／版权2000，ISBN9780201615623）和 *More Exceptional C++*（40题，2001出版／版权2002，ISBN9780201704341）是很好的“给代码→辨析问题→改进”补充，见[前册](https://www.informit.com/store/exceptional-c-plus-plus-47-engineering-puzzles-programming-9780201615623)与[后册](https://www.informit.com/store/more-exceptional-c-plus-plus-40-new-engineering-puzzles-9780201704341)官方目录。但包含旧标准内容，答案需按目标版本复核。[GotW 更新索引](https://herbsutter.com/gotw/)只说明部分条目更新到 C++14，不等于全库已经现代化；暂不列为必须寻找的首批原件。

## 导入与使用

实际取得书后，核对版本、目录、代码和勘误；按专题读取相关完整材料，再映射为统一的题型、算法、变种和 C++ 条目。几个目录不能机械拼接成总册，材料更多也不能直接证明范围齐全。

名称相似的两份 EPI EPUB 实为 Python 样章，未进入 C++ 教材基座。CP4 合卷与较差扫描件不重复进入基座。教材可检索不等于全部已读或逐行代码已校对。

完整书籍、扫描件及受限电子原件不进入 Git。仓库只保存书目身份、读取范围、必要的研究记录与引用；本地原件使用 D 盘的受忽略材料目录。具体取得状态以 [catalog/books.json](../catalog/books.json) 为准。
