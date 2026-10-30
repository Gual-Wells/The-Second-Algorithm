# 第二语言纯净稳定切换：源码与历史核查

2026-10-31北京时间；只读调查第二语言，未改其代码、服务或部署。本文件只记录实际读到的机制、历史和适配边界，不把代码检查当iPhone实机结论。

## 版本证据

- 来源仓库：`Gual-Wells/The-Second-Language`，本机`D:/CodexStorage/workspaces/second-language-certification-reader`。
- 实际核查HEAD：`79d74c69173d9660a6911ffd6645970ab5404b3f`。
- `web/pure-reader.js`对应Git blob：`19e99fc1f5f1aabe55a2839eba498945bbf1d50a`；当前物理文件SHA256：`7ec5f65a3421ea65e56bd7da2aca5f4d67bab0072a65cd1f5ebfb459f869c3a5`。
- 核查时`web/pure-reader.js`、`web/styles.css`、`protocol/READER_INTERACTION.md`、`web/DESIGN.md`和`scripts/check-reader-position.mjs`均无tracked改动。当前实际内容与上述本地HEAD一起作为来源，不引用供应商库或minified文件。
- 明确的原修复：`6b760a43b5fa476f3cd8b8afae0616bc2e2a4bfb`，2026-10-10，提交题为`Keep reading coordinates, reveal stable jumps and open unread question boundaries`，对应协议与设计中的v28稳定位置维护。历史中另有同名`d6160be`；本次直接阅读的是完整`6b760a43…`提交差异，不把短SHA混用成两个不同机制。

## 已有机制：同一同步任务内完成几何补偿

`web/pure-reader.js::installPureReader.toggle(target)`：

1. 取得滚动容器`readingScroll`和当前正文`article`，按常态真实工具条算可见正文上界。
2. 优先选择被点中的正文元素；没有正文目标时，选择第一个与可见正文区域相交的真实内容元素，最后回退到article。当前候选包含语境句、词头、例句、释义、h1/h2和p。
3. 在任何模式布局修改前记录同一个锚点的`getBoundingClientRect().top`，它是屏幕绝对坐标，记为`oldY`。
4. 同步切换`pure-reading`类、隐藏临时控件，并读取同一锚点的新rect，强制把最终样式与布局计算到当前任务。
5. 立即执行`scope.scrollTop += anchor.getBoundingClientRect().top - oldY`，然后才通知`onToggle`保存状态。

以上步骤没有requestAnimationFrame、Promise或timer，也没有先提交一个中间布局帧再恢复读位。纯净切换不调用章节导航的异步位置恢复。第二算法应移植这一几何事务，而非移植第二语言的英文句子问答/点读手势。

`web/styles.css`还保持常态/纯净同一正文排版；`.reading-scroll`显式`overflow-anchor:none`和`scroll-behavior:auto`。纯净只让外壳导航退场，工具条/索引条/状态条是fixed浮层，显隐不重新占据正文流。第二算法已具备对应的禁滚动锚定和fixed控件，但仍须保留其C++纸宽和横滚要求。

## v28修正到底改了什么

原`toggle`先算新视口的`nextTop`，把旧锚点位置夹到`[nextTop+10,next.bottom-24]`，再做滚动补偿。即使旧位置本可由原生滚动保持，额外夹取也会主动移动正文。

`6b760a43…`删除该`Math.min/Math.max`目标，直接维持`oldY`。同时把锚点查找限制在article中，并增加article回退。协议明确：

- 保持正文的绝对屏幕坐标，不把锚点强行夹入新的顶部或阅读内边距。
- 只有原生滚动上下界不允许满足请求时，才接受自然位移。
- 这两段例外是连续的首尾区域，不是只有精确scrollTop=0或scrollTop=max时才成立。
- 不通过增加悬浮退出按钮、复制工具条或额外占位区规避问题。

当前来源：`protocol/READER_INTERACTION.md`正文纯净段、`web/DESIGN.md`稳定位置维护段。

## 第二算法为什么会抖

核查基线：第二算法`e8b2d55ba09ed48f796a3d1d48023b9d4cc53434`。

`web/reader-runtime.js::setPure`调用通用`settle`。它先同步执行class mutation，让外壳/滚动口/正文发生布局变化，之后等待两次RAF，才`updateTailSpace()`、`restoreSnapshot(position)`、另加`previousPaneTop`差，再恢复捕获状态。`restoreSnapshot`首先依据block比例/offset恢复相对新pane的位置，随后又补pane的位置差。

这适合某些需等待新DOM的导航，不适合只是同一DOM的纯净切换。浏览器有机会把第一次RAF后的中间布局画出来；第二RAF才校正，最终位置接近并不能证明过程没有明显跳动。前轮测试主要等待`restoring=false`再比较终值，因此没有约束中间可绘制帧。循环四次累计约2px是另一个小尺度舍入现象，不能用它代替本次用户报告的可见布局跳动。

## 原样可迁移的最小适配与边界

采用root提出的独立同步`setPure`事务；保留通用异步`settle`处理真正的章节导航/布局恢复，不把其他流程一并同步化。

- 在切class前固定一个当前可见、未被主/超纲隐藏的真实正文锚点和它的绝对Y；被点元素可用时优先使用，否则从可见blocks找。不要重新用旧cursor的ratio/offset选择期望屏幕位置。
- 保留第二算法现有纸宽冻结，在同任务内完成其设置/清除、class、控件inert/显示变化和tailspace更新，最后按同一锚点的新旧绝对Y差一次补偿scrollTop。读取rect用于强制最终布局；中途不让出任务给RAF。
- `updateTailSpace`可同步放在最终几何补偿之前。它为最后一级标题定位保留的功能不是第二语言的需求，不能为了复刻删除；其暂时去掉再恢复底padding即使触发原生clamp，最终同锚点差量仍会把实际已经发生的clamp一起计入。最后一次补偿之后不要再改变内容高度，否则又会形成第二次移动。
- 同步切换须使旧pending layout回调失效（现有`layoutToken`职责），事务期间屏蔽读位捕获，结束后按最终几何刷新cursor/状态并通知保存。既有滚动事件后的capture可以读取最终状态，不应重新执行一次restore。
- 保留最近修好的触摸双击、延迟单击唤出和兼容click消费。不要因几何移植恢复首tap即时放控件，也不要照搬英文句内问答、全局禁缩放或长按提交。
- 使用`focus({preventScroll:true})`，并在验证中确认它不引入后续滚动；控件的显示/隐藏仍应完全不改文流。

## 来源测试公式与第二算法应补的验收

`scripts/check-reader-position.mjs`对不同正文状态和多个滚动位置（0、80、200、400、1000、max-300、max-80、max）分别进入和退出，使用：

`origin = article.rect.top + scrollTop`

`requested = before.scroll + after.origin - before.origin`

`expected = clamp(requested, 0, after.max)`

实际scroll与expected误差不超过1px；requested在合法范围内时，`origin-scroll`的绝对屏幕坐标误差不超过1px。临时工具条唤出、隐藏及窗口往返要求完整geometry相同。该脚本仍是浏览器隔离验证，不是实体iPhone。

第二算法应在此基础上补过程验证：直接调用/实际手势触发同步切换后立即采样，并持续采样第一个及后续数个RAF，检查每个可绘制帧是否已在最终合法位置；不能只等两RAF或`restoring=false`看终值。覆盖主/超纲、无超纲、普通文字和代码附近、长段落中部、连续多次切换、首尾原生bounds、工具条醒/睡与纸宽。边界预期按真实max和origin算，不为强求完全不移动而加人为顶部留白；断言或报告不得把自然clamp当“无抖动”的证据，内部与边界要分开。

本调查未运行第二语言全量测试、未重发其内容、未修改任何源仓库文件，也没有产生付费调用。
