# 第二语言设计移植：独立验收复核

审阅时间：2026-10-29 21:54，最终行为收据复核于22:00补齐（北京时间）。基准分支 `main`，基准 HEAD `ef103d3ec3e5bbaeb75fcc4a4065f0f6e80b31f0`。源固定为 `Gual-Wells/The-Second-Language@6fc3a272155f78d8c7cc440bce883f4a126e4d30`。本报告复核最终代码与文件证据，不重新开展内容研究，不代替根代理的发布审阅、准备包或部署收据。

## 结论与验证边界

当前实现符合本轮“直接移植自然可迁移的第二语言设计”的产品目标：源式标题栏与独立四按钮、日期与章节册、原读面、词条索引式篇节索引、薄状态栏、同窗分层设置与知识/答疑窗口已经落实。旧中转目录页、桌面目录、四向下栏与独立笔记产品没有以别名恢复。英语三栏、音频、VIX、IELTS、余额等业务没有迁入。

本轮审计发现的真实问题已经定点处理，详见下文。最终已读取并复核浏览器20/20、日期31项、启动50项通过的行为收据，冻结输入相符。**这些自动化通过不等于用户审美认可、实际 iPhone 触摸或系统 Passkey 验收。** 实机触摸、系统通行密钥与主屏幕安装取图仍需要实际设备验收；本轮没有因此重新制作 PWA 图标。真实本地 HTTP/SW 与正式部署也不由这些模拟收据证明。

## 教学资产与图标原件保护

于 `2026-10-29T13:51:10Z`，在根代理更新发布审阅前，逐一重新计算 `baseline.json` 的 `teachingAuthorities`：**61/61 文件 SHA-256 完全相等，缺失 0、变化 0**。范围包括出版/日期登记、研究与知识登记、原作者源、整章 Markdown/HTML/CPP、读者 CPP、知识源与原 chapter-review。这里证明本轮没有改写这些字节，不证明教材本身的教学效果，也不授权将旧内容审阅直接冒充新载体验收。

旧 `web/icons` 六个文件另与基准 HEAD 的 Git blob 逐字节比对，**6/6 完全相等**。原件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| apple-touch-icon-series1.png | `dc478907d0c2866312e8f6cc2db15824c7badff3c6d4f4882438092a00e6e664` |
| apple-touch-icon.png | `dc478907d0c2866312e8f6cc2db15824c7badff3c6d4f4882438092a00e6e664` |
| icon-192.png | `7dc931fd40e3513017a6e3a8f6cce7cbd156f43bfe1ac273858a5e80a1b545aa` |
| icon-512.png | `6e2c002fc0cbe0cd97f560a808be06e24898260b550098848aaeee5fc1240353` |
| icon.svg | `497c4629840c349d1a23d27cb4a2bf9330c7f097974be9ab906a2253a6638ed3` |
| build.json | `36aae61c67a67af97f2377eb4125663cea2ca0d8950aa646b8644b0cb3e813c9` |

新文件仅为独立的 `web/icons/header-logo.svg`：透明银白三节点用于蓝色页头，无底板、交互或动画；它已加入壳预缓存，不替换 Apple 安装入口或原 PWA 图标。

## 源比对与自然语义

已经读取 `web/DESIGN.md`、`docs/READER.md`、`AGENTS.md` 及最终实现。源证据包括本任务 `source-live-baseline.json` 的线上/固定 SHA 文件比对、`work/language-replica-20261029/source-map.md`，以及隔离自写材料的 `.local/language-replica/source-ui/surfaces.json` 与截图。没有用源仓库未提交工作区作为权威。

- 共同尺度延续源实际角色：手机壳侧距 5px、正文读面侧距 7px、正文段落 15px/1.78、薄状态栏 28px/9px、设置导航 14px/至少49px、源式深蓝标题与蓝银控件。没有把全局工具字号等同于教材字号。源码和宽表按算法实际需要保持独立横滚。
- 普通章节册/日历选章直接进入真实正文首，`scrollTop=0`，章头与索引条可见；前后章、七日条、明确续读恢复实际读位。旧 `#/chapter/id` 只兼容映射正文首，不恢复“从头/继续/目录”中转页。无效显式路线仍报错，不静默改投第一章。
- 篇节索引由正文实际 H2/H3/H4 和发布元数据一致产生，包含全部真实标题；父语境帮助区分重复方法/代码名并可被筛选。列表是源式二列平面索引，点击关闭后定位，未再引入树、桌面侧栏、级别切换或查阅工作台。
- 底部只显示真实同步/离线及当前 H2 节序/总数与名称，包括 PRE；它不是百分掌握率或导航按钮。标题四按钮中的前后节与日期前后章职责独立。
- 设置主页导航进入阅读或本机账户详情；文件→源码→文件→设置维持单窗返回。知识保持一份权威，显示技术名称而非内部 Q 编号。关闭窗口回原文与焦点，慢请求和旧身份不覆盖新窗口。

## 首 H2 几何：没有用加空白伪修源布局

检查了 `.local/language-replica/qa/geometry-first/results.json` 的原始矩形，而不把该诊断中已被纠正的旧断言误当产品失败：402px 手机纸面 `article.paddingTop=7px`，工具条 `top=196.578125`、`bottom=236.078125`，首 H2 `top=243.078125`，**净空恰为7px，标题命中测试无遮挡**；pane `top=191.6875`，工具条尚在正常流中，未吸顶。

因此不能对首 H2 强求“当前工具条 bottom+12px”：首标题与工具条会共同移动，该要求会制造恒定5px误差。没有为让断言变绿而改源7px纸面间距。非首 `unit-8` 证据见 `geometry-nonfirst/results.json`：工具条已吸顶，bottom `231.1875`，标题 top `243.046875`，净空 `11.859375px`，符合12px揭示线且无遮挡。新明确跳转和当前标题探测共用实际栏高+12px；纯净采用源固定12px，索引选项跳转时先收起临时浮条，显隐不改变正文排版或当前位置判定。

## 本次独立审计促成的实际修复

1. **触屏缩放**：原 `.reading-pane` 与 standalone `html` 的 `touch-action:pan-x pan-y` 缺少捏合许可。两处精确改为 `pan-x pan-y pinch-zoom`；viewport 未加最大缩放限制。浏览器可把等效组合序列化为 `manipulation`，验收应检查实际能力/祖先链，不能因字符串别名误判。
2. **知识失败态**：知识加载失败后的重试按钮原来没有源式按钮类，已补 `bevel-button`，保留原重试、身份和延迟响应保护。
3. **同步真实性**：初次 `/api/state` 非401失败原来只弹提示，空 dirty 集合会使薄条误报绿色“已同步”。新增最小 `stateSyncFailed` 状态，保持阅读与本机保存，同时明确显示同步暂不可用。普通单条 PUT 成功不冒称已取得整份远端状态；成功状态读取才清除。恢复复用既有 online/focus/visibility 与有界重连，不新增轮询或定时服务。
4. **字号后的可见读位**：诊断 `qa/diagnose-font/results.json` 显示 unit-3 已在可见揭示线，块坐标却取到工具条背后的前段 P。字号15→16时隐藏 P 的比例点保持了，H3 却从相对51.1875移到52.8125而退父节。只把新捕获的 block 选择边界改为同一可见阅读线；原 schema3 ratio/offset 的物理 paneTop 表达、旧 block/offset 恢复和 owner/document/revision 绑定均未改变，没有增加复杂读位模型或百分比重映射。

## 私人状态、后台与发布边界

`manual-questions.js` 当前 transport 为 null：窗口在输入前说明未连接，发送禁用，强行提交也不发网络请求或制造消息；草稿按 owner/章/版本隔离。没有为了复刻聊天外观宣称答疑后台完成、生成回复或亮假红点。

原 notes/journal 入口继续取消，但原件、冲突副本、其他标签页与退出保护保留，未拿 UI 删除授权清理私人数据。纯净模式使用同一正文，隐藏页头/日期/章头并设置 inert；原生选文、代码、表格和系统缩放优先。

未更改身份、鉴权或 Gate 实现以绕过发布：受保护正文/知识/CPP/Markdown 不进入公开壳；SW 的 owner、白名单、401/403拒绝旧缓存及 CLEAR_PRIVATE 约束仍在，等待实际控制器 VERSION 的有界恢复仍由原模块负责。新增页头 Logo 仅是公开壳资产。本报告也不替根代理生成通过字段、改教学审阅或跳过当前输入的发布门禁。

## 冻结指纹与后续验收

本报告代码审阅对应：

| 文件 | SHA-256 |
| --- | --- |
| web/app.js | `32bedf4e5bf9c65eb09ec459b1ad632e53ca45596e3b4bd144478c1e160fcc05` |
| web/reader-runtime.js | `bb308ebf21c8e67bbc38b904b769aa21774543afcf3a9a98c930aaaa03bc9315` |
| web/manual-questions.js | `e32145d51a399ea5cc7510798b027ff8cfabd99ee816383bb4e4ad0fe9f6bc78` |
| web/index.html | `42074fdc7269258f111d72ceb6c6dd0ce0a76edfe642a139553737f1a01be956` |
| web/styles.css | `bcf958ec59960235c92a73f9c33bc9ccd2c215f6ca45017ddac36c4c90678e06` |

最后一行字号修复后语法及 diff 检查通过；最终行为收据已按下一节关联，inputStart=inputEnd 且为本指纹。较早失败诊断保留，不能与最终收据混淆。浏览器 fixture 模拟身份，不是实际系统 Passkey；真实本地 HTTP/SW 的更新检查、根代理最终 prepare/deploy/HTTP 收据各自另记。没有新增账户、付费服务、数据库、周期任务或持续费用。

## 最终行为验证关联（22:00补齐）

汇总 `.local/language-replica/qa/acceptance-summary.json` 创建于 `2026-10-29T13:59:03.290Z`，对应构建 `e2ce4684db3722fadd765f274fc8a55b9c5440503fc99e0bc7ce33b5353f5595`。于 `2026-10-29T14:00:22Z` 另行实际计算全部汇总输入文件 SHA-256，**当前输入与汇总完全相等，差异0**；不是只采信布尔字段。

| 收据 | 结果 | 实际文件 SHA-256 |
| --- | --- | --- |
| `.local/language-replica/qa/acceptance-summary.json` | 最终汇总 | `633697b289c16e51b4e6f0e5c6b01d33deed34c550fe2b45dcd61282c2453a4c` |
| `.local/language-replica/qa/browser-verified/results.json` | 20/20，输入起止一致 | `98879d80b9d3372273959515f96b33ff6389662d3d02a8c528f0b372350bc239` |
| `.local/language-replica/qa/calendar-verified/results.json` | 31项通过 | `5b01a9cb44718d81de519b66742cb3784999fd1e323318173c3978b237310dc3` |
| `.local/language-replica/qa/startup/results.json` | 50项通过 | `32ee93a5dc7826134bae7aa94ae616b06362bae1972070ac34868e636e18ddd8` |

实际《二分》出版物的 `.local/language-replica/qa/browser-verified/binary-search-all-neighbor-targets.json` 记录278个标题、556个H2邻居控件、278次当前节状态检查，错误0。真实首H2净空7px、无遮挡，最终标题 top `243.03125`、tools bottom `236.03125`，与上文诊断结论一致。最终字号场景保住原H3，纯净、选文、代码、历史与慢请求旅程同时通过；远端 state 503 后仍为未确认状态，受控 online 状态读取成功后才恢复同步状态，已在既有旅程中实际验证。pinch检查覆盖真实祖先链和 `manipulation` 等效序列化，没有以只匹配字面串制造误失败。

这一阶段没有修改教材。根代理为当前载体输入更新了必要的 `content/binary/chapter-review.json` 后，独立再次核对61份基线：**60份仍完全相等，唯一变化为该审阅文件**，其新 SHA-256 为 `1344707ab78092083d99bdac779b173acec833bb00036a2e0b5773fc26b77ff8`；旧值见基线与上文审阅前核验。正文、算法实现、知识、日期/出版登记均未随审阅换版改写。

旧 `browser` 的16/20、`browser-final` 的18/20与各诊断原件保留，不能改名冒充最终通过。最终收据明确没有接触生产、付费服务、真实数据库或实际iPhone，身份为隔离模拟，浏览器SW被阻断；因此本报告只确认这份冻结前端的独立验收已收束，正式发布与真实HTTP/SW结论继续留给根代理另行记录。

## 最后保全核验（22:04补齐，保留前述时间快照）

于 `2026-10-29T14:04:45Z` 再次核对：61份原权威仍只有 `content/binary/chapter-review.json` 一份变化，其当前 SHA-256 为 **`f8f955aa9f5acfe86a7a0ef387cbf7f8f3a80c5c0254de2b392be800353bd5da`**。上节 `1344707a…` 是22:00的真实快照。当前 comparison 已明确区分“文档不可变 revision 未改”与“全库 catalog.version 包含构建 Git 提交而正常更新”，避免把两种身份混为一谈；审阅正文的教学不变结论仍成立。

独立对上一成功部署 artifact `.local/releases/d15f8734-3d40-42d4-96ef-e9a9e527aef4/library` 与本轮 `dist/library` 重新逐文件比较：路径集合相同17份，**16份教学载荷字节完全相同**；唯一不同 `catalog.json` 解析后移除 `version` 即完全相等。上一全库 version 为 `b6607bb8444b3f8352601e3085673898e40d977a896bdb2fbe8f5ee30399a31a`，当前比较构建为 `bcddffa77b8e33d2ad3e87d12cf4c3d893319d5531bc8ac78c677f1f73c26ea5`。已实读 `build-carrier.mjs` 的 `catalog.version = hash([gitRevision, ...])`，后续正式提交可正常再次改变全库 version，不能据此判定教材被改或套用旧构建身份。

根代理现已归档并独立读取了真实本地 HTTP/SW 收据 `qa/upgrade.json`（SHA-256 `ff0bb0ed9ae7eeb25c986b4d3d8d24f25863136d58b1e1bff211f1efd7cc6e9e`）：实际浏览器/SW、等待接管、离线重启、撤回JSON/CPP/Markdown清理、owner切换/退出和私人原件保全均通过。它使用本地隔离HTTP身份，不是生产或系统Passkey测试。`technical-summary.json`（SHA-256 `1d05b9ef3129d19be482c09da4016024bcd98b08943d3df22c298b9a3dae1f71`）记录198项Python、118项Node和4个C++目标通过；这些是读取根执行收据的核验，不声称本代理重复运行。便携行为档案现位于本任务 `qa/`，映射见 `qa/receipt-map.json`。正式部署仍由根代理另存发布收据，本独立报告到此冻结。
