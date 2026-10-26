# C++研究候选接入既有检索库

本记录描述分工整合阶段，不替代最终[全流程报告](../../research/2026-10-26/cpp-full-cycle.md)。根Agent的泛型候选与后续反查修订在本记录统计之后接入，因此此处不是最终仓库总量。

## 实际写入

- 从language、library、systems的实际候选与author-map读取55、46、42项，共143个研究候选；另登记外部反查发现的`variant`转换／异常状态缺口1项。
- `catalog/patterns.jsonl`原77条算法记录保留，新追加144条C++检索记录。每条保留情境、机制、重要变种、读件定位、作者映射和当前状态。这里的研究候选不是144个互不相同的算法或语言机制。
- 本阶段新增记录状态为`authored`114条、`partial`8条、`gap`22条。`authored`表示选定合同已有正文，并未自动晋升为`reviewed`；开放变种和范围边界继续保留。部分候选只有正文说明，明确注明参考实现仍待补。
- 122条有实际阅读位置；逐项用`content/cpp/build/*.json`的真实heading文本查得anchor，并核对各自代码块确实存在于同名权威源码。没有按标题猜锚点，也没有把一个尚不存在的专题名当成已承载。
- 4条真正已读的问题／实现练习进入`catalog/cases.jsonl`：GotW1、89、92，以及TDDD38 Custom Deque。前三条映射已写内容；Deque保留`gap-confirmed`。没有把每条标准规则、每个书目配方或每次读件伪装成一道已解题。

## 归并与跨域判断

两个检索身份作为同义入口，不再制造第二份主讲解：

| 入口 | 真实承载 | 仍未完成的部分 |
|---|---|---|
| `cpp-core-pimpl-resource` | `cpp-sys-forward-completeness`；翻译与链接的Handle头／源文件、out-of-line析构与移动，多TU验证 | 语言分工没有完成Person深复制等扩展；独占Handle不能代表全部Pimpl设计 |
| `cpp-lib-clock-duration` | `cpp-generic-measure-call`；泛型稿的一次调用计时 | 完整微基准、时区、日历及性能实验仍是其他合同 |

这两项都带`alias_of`和同一canonical位置，114条`authored`中包含这两条入口，不能据其相加宣称独立机制数。泛型目标ID由根Agent负责加入，本阶段不会为它另写第二条正文。

其余相近内容按决定行为的差异保留，而用`related_pattern_ids`相连。例如临时量寿命与字符串view属于通用规则／具体接口关系；RAII异常收尾与互斥锁作用域属于机制／专用资源关系；共享控制块与shared_ptr原子访问不能混为同一个线程安全保证。多个候选共用一个Buffer、erase、zip或ring代码块，也不表示这些代码块被重复计算成多份独立实现。

原始author-map是分工当时的状态。跨域补足不回写成“这个分工已经读过”：Pimpl的language局部缺口仍可追溯，但全项目的实际位置由上述整合条目指出。相反，模板定义跨TU可见性、临时文件提交、完整HashMap／deque、线程池和variant转换，不能仅因某一稿提到这些名字就关闭缺口。

## 来源边界更新

只更新`catalog/sources.json`中GotW、TDDD38和CERT的verification，不改变采集入口配置或历史快照：

- GotW当前修订版单页匹配16个文章链接，正文为已登记的选定文章／片段。
- TDDD38单页匹配16个练习目录；正文实际读取Static Queue、Specialization、SFINAE、Mixed Templates、Custom Deque等登记范围，不声称全部16套都已读。
- CERT规则单页匹配83个规则链接；ERR56、OOP52、CON53、CON54及CTR51的明确片段等实际读件与目录捕获分开。

新增`catalogue_census`交代分母、单位与`selected_only`，保留旧条目的传播关系、版本边界和访问限制。目录数字不是已经掌握的问题数量。

## 本阶段检查

实际执行`python -m second_algorithm validate`通过：当时为221条模式、126条案例、11个目录快照指针；仍给出正常的draft／gap警示。实际执行`search '线程句柄' --kind pattern`命中已接入条目及真实阅读锚点。这是结构与检索检查，不能证明语言语义正确或范围完备；语义、编译、异常注入、并发及外部反查结果由最终报告分别说明。
