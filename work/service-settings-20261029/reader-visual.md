# 目录索引与标题Logo适配

## 实际来源与取舍

第二语言固定源929d42df391f4538c906e743f146cc579e655c0f的web/index.html、styles.css、app.js已实际按Git对象读取；源Logo为#cfe8ff、76×38占位、52×52原512画布、1.8s ease-in-out原版breathe（50% opacity .55），后台header-motion-paused暂停、减弱动态停为1。算法保原三节点坐标/连接/透明孔洞，仅页头变体使用同款平填和动效，原PWA六份资产不改。

先前目录取ef103d3的reader-runtime.tocHTML/updateTOC及toc样式研究，恢复其大节分组、展开/直达分离、真实H3/H4从属与当前项。只移回窗口内容，不恢复旧桌面侧栏、中转页、下栏或父链。

## 当前实现接口

- 入口文字改为目录索引，Logo纯展示且aria-hidden，无点击/焦点。
- 根showIndex使用标题“目录索引”、英文CONTENTS，以及`<div class="directory-list" id="indexList">${runtime.indexHTML()}</div>`；取消词条搜索区和二列列表。
- `indexHTML`仍消费原成品全部H2/H3/H4，按H2分组；展开按钮`data-toggle-index-section`由runtime处理，直达按钮仍`data-index-go`，根继续同窗关闭后导航。
- 打开目录自动展开/定位当前所属大节；手动收起不触发跳转，也不被同大节每次状态刷新强制打开。换实际大节后自动展开新所属大节。内部章节改变清展开状态，不新建标题/锚点权威。
- `indexHTML`、`scrollCurrentIndex`、`updateIndex`接口不变；`toggleIndexSection`额外暴露。窗口关闭时不再逐滚动刷新隐藏目录DOM。
- 根app需源同款`updateHeaderMotion`监听visibilitychange并初始化，使documentElement的header-motion-paused等于document.hidden。CSS与系统prefers-reduced-motion保护已就位；不把CSS测试冒充这一步已整合。

## 实际验证

隔离harness`.local/service-settings-20261029/reader-qa/check.cjs`加载当前真实reader-runtime/CSS/HTML、完整已构建二分章（只读旧dist内容，不构建或覆盖dist）。16检查通过、0运行错误：全部278目标、38大节及真实H3/H4完整；展开和跳转分离；H4关闭后直达/重开定位；320/402/1280窗口无横溢和越界；52px画布、1.8s/.55中点、CSS暂停稳定及系统减弱动态均实测。截图reader-402与directory-320/402/1280已目视：大节/学习单元/实现层级可辨，长标题自然换行，52画布内实际实体约37×33，未撑高原38槽位或遮动作行。

第一次harness同时手动WAAPI.pause和CSS暂停造成pending帧读值误判；去掉WAAPI，按真实CSS应用后两帧采样，暂停时间稳定。不是扩大容差或改产品动效。

这是独立UI部件及CSS验证，root app关闭/history、真实document.hidden事件、身份/后端、生产和物理iPhone未在此harness中执行；待根整合验证。文件指纹见results.json，不能据静态截图称整产品已上线。

## 服务设置分模块

新增`web/service-settings.js`，根仅接`createServiceSettings({api,getOwner,showSheet,rememberSheet,showSettings,toast,getSheetView})`的`show(kind)/reset()`。六个view：学习目标、下次安排、休息安排、服务额度、存储空间、提醒；样式沿固定源929d的settings-body、balance-card、数字、细进度条材质增量适配，不复制其多供应商任务估价。

- 学习安排先GET快照；PUT只写本表字段与baseRevision。409保留当前输入，展示另一设备最新值，明确再次保存时才使用新revision。默认休息与单次放行由后端权威执行，UI不暗中开任务。
- 余额只读本项目快照；发放额度单列，未知余额不当零、不用发放量替代；remainingVerified与issued核验分开。无provider余额端点、估价、充值警报或轮询。
- 存储按后端pool展示账户/项目职责，null保持未核验，只为真实used/limit生成进度。内部policy不下沉页面。
- 提醒打开仅查状态、公钥和本机订阅；服务未配置不取key也不请求权限。只有真实点击才同步发起原生权限请求，然后显式登记。当前设备以本机endpoint的SHA256和仅owner可见deviceIds匹配，其他设备数量不会被当成本机启用。显式开启/关闭后各追加一次状态读取，不轮询。
- 所有异步渲染受owner、view、sequence和dialog.open约束，reset使旧响应失效并清内存缓存。GET余额/存储失败可留同owner旧记录并标明，401/403不回显缓存。

隔离源码harness`.local/service-settings-20261029/services-qa/check.cjs`通过44项、0脚本错误，包含六个view在320/402/1280（320高度550）无溢出/越界；部分写入/CAS保留输入与显式重试；余额核验边界；存储账户与项目独立；关闭/换owner的迟到响应；打开不申请权限/不订阅；真实用户点击时机；标准subscription JSON、服务端与本机关闭、重开hash核对；无后台轮询。真实CSS/HTML/module指纹前后相同。402的余额、存储与休息截图已目视复核，保留蓝银窗口及原生行比例；删除两句重复解释金额/未知量处理的元文案，必要功能性说明保留。

此harness为模拟本地API、模拟原生Notification/PushManager，不接生产、不弹真实权限、不使用真实额度，未验证物理iPhone/生产推送。根负责全套后端、构建与整合浏览器验证及发布，不能把此44项单独当作生产上线证明。
