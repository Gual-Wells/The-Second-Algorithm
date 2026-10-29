# 第二语言 → 第二算法：直接移植核对图

本轮是用户明确要求的全面复刻。之前“紧凑页头＋H2底栏＋目录”的候选版面已被否决，不能以旧文档或测试将其恢复。这里记录真实来源及适配职责，不将本笔记或像素值冒充用户审美验收。

## 可核来源

- 第二语言固定提交：`6fc3a272155f78d8c7cc440bce883f4a126e4d30`，根已用直接Git远端核实为当时main；本笔记全部由同一Git对象读取，未使用其维护工作区未提交文件。
- 已实读：`web/index.html`、`web/styles.css`、`web/app.js`的`renderIndex/updateReadingPosition/setSyncStatus/showDialog/closeDialog/jumpWithin`，`web/chapters.js:createChapterBook`、`web/settings.js:installSettingsNavigation`、`web/pure-reader.js:installPureReader`及`protocol/READER_INTERACTION.md`。
- 已单独目视仓库现有`design/second-language-reference-20261029/language-main.png`和`language-settings.png`：它们是源实际前端的隔离材料截图，不是正式课程或实体iPhone证据。
- 目标起点：`ef103d3`。目标既有版本/owner/读位/草稿保护及完整教材保留；取消的是旧目录和底部导航产品，不删除权威标题树或正文身份。

## 主壳、页头、底部与索引

| 目标部位 | 源文件/职责 | 直接可迁移的真实实现 | 本项目必要适配 |
|---|---|---|---|
| 外壳 | styles `.app-shell` | 最大960px；`100dvh`、安全区；外壳`#e8eef5`，条纹外底；手机≤560左右5px | 一份完整算法正文，去掉三部分标签，不恢复三套正文 |
| 标题区 | index `.title-row/.app-title/.speech-controls` | `header-meta`、白色H1及英文小标、右侧专属位置；页头46/47%蓝折面 | 名称第二算法，元信息改真实章节状态；点读位置变静态算法Logo，不保留朗读按钮语义 |
| 独立按钮行 | index `.header-actions`；styles≤760/560 | 独立一行、各按钮flex均分，源`header-button`手机10px字、31px级高度、5px间隔 | 上一节／下一节／章节答疑／设置；“上一节/下一节”始终走PRE及H2正式节，不混用上一章日期箭头 |
| 日期栏 | `.chapter-nav/.chapter-nav-row/.chapter-jump/.day-strip` | 行49px，手机44px；33×31箭头；日期16px、窄屏14px；7日格39px、手机37px | 继续真实归属日期、同日多章和章节册，不增加每日生产；章与节的导航职责分开 |
| 读面 | `.reader-frame/.reading-scroll/.reader` | 白纸、细蓝边，内部单滚动；reader最大860px；手机侧内距7px | 算法代码/宽表各自横滚，不引入桌面停靠目录或第三栏 |
| 正文章题 | `.reader-head/.chapter-label/.chapter-title-row` | 浅色完整章头，日期与章号10px，章题22–30px，副标题11px | 真章名/真实续读，不写功能宣传或设施数量；原章入口可按同一章头语法承接 |
| 索引入口 | index `.article-tools/#wordIndexButton` | 章题之后、正文之前的吸顶浅蓝工具条；源6px/9px内距、按钮10px字 | 名称“篇节索引”，不放在顶栏或底部；不保留旧“目录”入口或桌面树形栏 |
| 索引窗口 | index `indexDialog`；app `renderIndex` | 双语小标+17px标题+×；查找标签和16px输入；二列紧凑条目；点后关闭并稳定帧跳转 | 按真实篇节/标题权威生成，保留稳定目标。算法题名长可换行并保完整名称，不能只保字母/内部ID；搜索匹配真实标题，不搜索研究设施 |
| 索引条目 | styles `.index-search/.index-list/.index-item` | 搜索区10px内距；列表7px内距、1px间隔、`max-height:min(55dvh,500px)`；序号9px、标题11px | 不复活目录accordion控制台；保留完整H2/H3/H4的可达性，前置/节序真实可辨，不将正文拆成独立读件 |
| 底部 | index `.reader-statusbar`；app `setSyncStatus/updateReadingPosition` | 28px级状态条，9px字，7px状态灯；左同步/离线，右读位，右侧最大56% | 撤掉旧上/下节按钮与当前节大按钮。右侧自然对应“当前节序 / 总节数 · 当前节名”；它是读位而非掌握度 |

源`updateReadingPosition()`在词条存在时显示`当前序号 / 总数 · 当前词`；只有无词条的长文分支才显示百分比。因此篇节对象可直接迁移前一种读位语义，不必创造学习完成率。

源`renderIndex()`是文本小写化过滤，按原顺序生成数字序号与标题，点按先关闭窗口再调用`jumpWithin()`；它没有树形展开、侧栏或多种索引模式。篇节层级的真实身份仍可由算法运行器保留，但读者界面要沿此简单索引语言，而不是仅改“目录”两个字。

## 正文与全部临时页面

| 对象 | 源职责/样式 | 本轮落点 |
|---|---|---|
| 连续论述 | `.article p/li`：15px/1.78、`#293f53`，段落7px；`.article.prose p`为16px/2、段落1.15em | 按实际算法论述使用源连续正文语言，避免上一版17px全篇强黑；章/大节用源`reader-head/section-band`层次。源词条卡解决重复词条对象，不能把每个算法段落无意义卡片化 |
| 实现与工程说明 | 源`mono`浅蓝面、3px侧线、有限语法色；`article code`等宽 | 保留真实C++块原字节、缩进、局部横滚/复制/独立字号。源无完整C++读器，需按同一材质适配，不假造一键库解 |
| 普通窗口 | `.sheet-dialog`透明外层＋`.sheet`内窗；`.sheet-head` | 最大540px、手机宽`100%-12px`；2px蓝边、3px圆角、深蓝带、英文9px小标、标题17px、27px×；遮罩`#10294499`。这套窗体应覆盖索引、知识、设置、文件及答疑，不继续旧的大“关闭”实体按钮 |
| 知识 | `.sheet/.usage-sheet`和`.chapter-sources-body`等内容层 | 技术名称作标题，源窗体比例；内容约13–15px按正文角色，代码仍可选/横滚；前置知识单窗栈、返回/关闭分清，关闭回原术语，不复制知识库 |
| 章节册 | `createChapterBook()`；`.chapter-book-sheet/tabs/search/month/entry/title` | 原样迁移分组、双标签、月份/日期浏览、搜索、当前章入口和每章单入口。源条目15px真标题、10px章号日期、11px副标题；选章从章首，七日条/前后章仍能续读。不下载整册正文 |
| 设置主页 | `installSettingsNavigation()`；`.settings-home/.settings-row` | 分组带＋整行导航到同窗详情；49px行、14px字、22px单箭头。不要给上一版内联值编辑墙仅换配色。只保留算法已有的阅读、下载/文件、应用账户对象 |
| 设置详情 | `.settings-detail/.settings-back/.settings-body` | 同窗前进/返回、源`‹ 设置`短按钮与原位滚动；分组在详情内不重复。字号/折行等保留真实作用对象，不引入学习目标、休息、余额等英语专有业务 |
| 开关 | `.switch-row`及其input | 44×24轨道、20px旋钮、蓝银渐变、开启蓝色，不继续普通checkbox方框。自动下载可按源音频下载的主页内联模式，文案改已有章节资产，不能触发生成 |
| 文件/源码 | 源settings详情、chapter-sources正文/条目语言 | 本章文件是详情对象；CPP/Markdown/源码的动作和下载范围真实，不伪装已保存。保留源码→文件→设置返回关系，不引入代码仓库平台 |
| 章节答疑 | `.questions-sheet/.question-context/.question-messages/.question-compose/.question-send-row` | 源满高窗口、固定语境/输入与中间消息滚动、16px消息文本/1.65、输入16px；按钮“章节答疑”，窗口同名。目标仍无transport：打开即说明未连服务，草稿保留、发送能力一致，不复制真实消息/红点或自动提交手势 |
| 连接/登录/错误/空章 | `.state-card/.state-band/.state-body/.state-icon` | 前轮已按实机反馈合并启动修复，保留同源比例及加载期动作隐藏；空章不照搬“下一章正在建设/填写学习目标”等不真实承诺。断网不引导重新登记 |
| 跳转/反馈 | `reader-jump-status`；`jumpWithin/showDialog/closeDialog` | 稳定帧揭示、旧文留在、临时右下提示；source打开新窗口关闭父窗并记返回对象，不叠多层遮罩。重用现有安全路由/读位，不为复制外观替换成熟权限状态机 |

### 文本尺度事实

源body的12px是工具基础字号，不是整篇教材字。源正文p/li显式15px，prose16px；源设置行14px，答疑内容16px，输入16px，章节册标题15px。复制时应按角色取来源值，不用“全面复刻”把所有内容压成12px，也不把工具、状态条、标题再统一扩成17px。

## 纯净与兼容

- 源纯净永久隐藏页头、日期栏、reader-head、part-heading；暂时唤出的原控件是`.article-tools`及`.reader-statusbar`（历史格式另有toolbar），不是把整个页头/日期再浮出来。篇节索引条与状态条可沿用这一语义；不复制第二份正文。
- 原文绝对坐标、纸宽和排版保持，原生首尾clamp例外；隐藏控件不可聚焦/挡字，轻触空白唤出约3秒。源英语的长按、句内双击答疑和发音仲裁不自然迁移，算法继续让代码、表格、选文与系统缩放优先。
- 源viewport含历史`maximum-scale=1,user-scalable=no`，源标题教学目标禁选；这两项不适合算法代码阅读，不复制。外观比例可相同，保留现有缩放、原生选择、视觉视口键盘适配、owner/不可变版本和真实SW接管。
- `minmax(0,1fr)`、`overflow-anchor:none`、延迟旧章读位不污染新history、重新认证路由重建、401/403不落旧私人缓存等已解决真实问题的保护仍保留；取消“目录产品”不删除这些结果。
- 短视口沿源压缩顶底内距；输入始终16px避免iOS聚焦放大，长窗口内部滚动、关闭可达。源固定像素是本轮复刻起点，实际iPhone仍需验收，不用自动化数量证明它已好看。

## 蓝背景Logo专项

目标现PWA图形为三节点几何，`#3469e6`配`#f4f6fa`纸底。直接把原蓝glyph贴在页头蓝渐变上，相对亮度对比只有1.10–1.91，不合适；白色大方块也会破坏标题栏材料。

可保留几何，新增仅页头使用的SVG变体（不改PWA安装资产）：沿源点读银色bevel区域承载蓝glyph，或保证浅色轮廓落在足够深的蓝段。计算供选择：原蓝对源银色`#e1edf7`约4.10；浅色`#f4f6fa`对深蓝段约8.17–8.60，对最浅顶段仅2.58。Logo应是静态品牌而非假模式按钮，原点读名称/图标/事件不保留。最终以实际顶栏构图和清晰度比较，不据一个颜色比值代替美学判断。

### 最终Logo落点

前面的银底承载是研究候选，未用于生产。实际对照后选择透明银白三节点：保原几何与透明孔洞，以细暗轮廓支撑浅蓝高光段辨识，38×34图形占原76×38槽位；不带底板、不产生点击/焦点/悬浮/按下反馈、不动画。仅新增`web/icons/header-logo.svg`并加入壳离线缓存，原PWA安装图标完全不动。

## 应覆盖的实际验收

同一版检查402×874、320窄屏、宽屏、横屏和键盘短视口：常态页头两行/四按钮、日期/章入口、PRE/长论述/长标题/相邻Hcode与Scode/练习、篇节索引筛选与稳定定位、状态灯与真实读位、设置主页/各详情/开关、文件/源码、知识及前置返回、答疑草稿/未连接边界、启动各阶段及错误、纯净进出和原控件唤醒、离线/更新/身份切换。

源特有三部分、语音、译文遮蔽、高亮USE、临时页、学习目标/休息、IELTS、额度、认证卷轴与大型媒体都不引入。本轮不新增服务、队列、周期任务或收费能力；教材原件/标题/代码/知识/日期身份及私人数据不变。

### 验收中确认的几何与浏览器语义

- 源移动端正文上内距为7px。首H2定位在“工具条高度＋12px”时，工具条尚在正常文流，可比滚动口顶端低约5px；标题与条底的实际自然间距仍为7px。非首标题定位时工具条已经吸顶，标题与条底才是12px。两种情况分别精确验收，并检查实际命中节点未被遮挡，不能为统一断言而改掉源内距。原始矩形诊断保存在`.local/language-replica/qa/geometry-first/results.json`与`geometry-nonfirst/results.json`。
- Chromium可将`pan-x pan-y pinch-zoom`的计算值序列化为等价的`manipulation`。缩放保护检查正文至HTML整条祖先链是否允许缩放，同时检查viewport没有禁用缩放，不能只搜索计算字符串中的`pinch-zoom`。
- 工具条出现后，标题检测与当前阅读块选择需采用同一可见阅读线；否则字号改变时可能恢复工具条背后上一段的比例，真实可见标题会后移，状态错误退到上一节。现有schema3的物理`block/ratio/offset`表示不改，修正的是新采样的块选择边界；旧读位仍按原物理坐标恢复。
