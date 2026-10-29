# 服务、学习安排与存储：实际源研究

## 已核来源与当前状态

第二语言统一按固定Git对象`929d42df391f4538c906e743f146cc579e655c0f`读取，未修改该项目。实读STORAGE、BALANCES、BACKGROUND_AUTOMATION、worker/src/index/storage/storage-usage、web/balances/storage-usage/settings及本机日课、隐藏启动器、归档与容量收尾入口。文档规定与代码实际行为分别核对。

第二算法改造前D1仅auth_control、auth_credential、auth_challenges、auth_sessions与reader_state；正文、C++、Markdown和知识在受保护静态library。现场17份文件合计856311字节，约0.82MiB，没有必要把它们搬进D1，或为相似结构另建KV。最初只读管理查询返回鉴权错误10000；之后OAuth自动刷新成功，重新读取Wrangler管理响应确认当前物理database_size为69632字节，未打印账号标识。该值不包含尚未应用的新服务迁移，正式快照需部署收尾重新查询。

第二语言本机存在OneDrive DPAPI凭据、受忽略publisher配置与无窗口启动器；已安装各自独立的日课/练习/答疑/归档等任务。第二算法没有同名任务，也未发现现成服务配置与OneDrive凭据。只检查配置字段和文件是否存在，没有打印或复制凭据。

## 不照搬的部分与保留的分工

- Git与受保护静态资产继续承载正式算法原件。D1只留登录、小型跨端读位、设置、运行领取与少量当前服务快照，不存章全文或每次滚动历史。
- OneDrive适合任务末尾的分组压缩归档、不可变原件与数据库恢复清单，不用作高频SQL或每页必经的CDN。近期阅读仍使用既有浏览器缓存，不增加KV日写入。
- 原站每分钟Cron发送提醒不适合稀缺共享请求目标。新章实际任务收尾直接发送已订阅设备，失败保留少量待处理状态，不能每分钟空扫数据库。本轮用户澄清不做任务成本推算/三次阈值报警，仅登记OpenAI附赠资源。
- 源额度与容量页读取上次任务末尾快照，不浏览时轮询外部账户。失败保留旧值与核对时间，未知不当0；本项目额度只采用用户明确的OpenAI API附赠credits，不混进OpenRouter或Codex五小时/周订阅限额。
- 后台更新仿源的单次许可语义：默认休息，领取时原子恢复休息；纯Node检查发现休息即退出，不启动Codex。算法新章仍须完整研究/编纂/验证/准备/发布，不用一个自动脚本代替语义工作。

## OneDrive授权边界

现有权限是`Files.ReadWrite.AppFolder offline_access`。Microsoft官方说明AppFolder由注册应用名定位、权限限于它自己的目录；不能利用现有token宣称已经取得另一应用的独立Apps目录。

如复用现有Microsoft应用，可把第二算法归档放在原AppFolder下明确的`projects/second-algorithm`子目录；这是同一个应用权限内的项目隔离，不是新的Microsoft安全边界。应复用原受保护凭据入口，不复制刷新令牌到另一套生命周期，不在浏览器返回Graph下载凭据。独立Microsoft应用则需独立授权，不能悄悄替用户扩大权限。

依据：[AppFolder官方说明](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)、[OneDrive quota资源](https://learn.microsoft.com/en-us/graph/api/resources/quota?view=graph-rest-1.0)。个人盘quota是跨Microsoft服务统一统计，项目目录大小与账户总用量须分开呈现。

## 另一个真正的请求节流点

当前构建器生成`_routes.json`的include为`/*`、exclude为空。即公开壳HTML/CSS/JS也进入Pages Worker。官方说明静态请求免费与无限的前提是正确绕开Functions；Functions调用本身计入Workers额度。可以只精确排除已经明确公开的壳文件，保留library/API/未知路由的owner边界；不能粗暴公开受保护正文或用宽泛排除绕过归一化。若采用，需补静态安全头和匿名编码路径/遍历回归。

依据：[Pages路由](https://developers.cloudflare.com/pages/functions/routing/)、[Pages Functions计费](https://developers.cloudflare.com/pages/functions/pricing/)、[D1计费](https://developers.cloudflare.com/d1/platform/pricing/)。容量与请求额度分开；数据压缩不能降低同样扫描的D1 rows_read。

## 可实施的轻量接口建议

1. `GET/PUT /api/settings`：同源登录owner读取与修改goal、temporaryRequested/text、restRequested，默认休息；附revision避免多端旧设置覆盖。保留源一次申请/一次许可含义，不增加独立练习系统。
2. `GET /api/balances`、`GET /api/storage/usage`：读取当前服务快照，标注checkedAt、失败/旧记录状态；浏览器不直连管理API。APIcredits使用remaining、周期到期、核对来源与领取状态；不能从邮件宣传额度直接推断当前剩余。
3. 发布身份专用收尾report接口：严格字段/时间/单位验证、乱序拒绝，每池至多一份当前记录，不新增每次打开页面的写入。
4. `GET /api/push/public-key`、`POST /api/push/register/unregister`：沿源手动授权；独立VAPID身份与本项目owner绑定。仅新章实际完成时发送，不注册全账户Cron。
5. 本机后台claim/complete接口：只供独立发布凭据，原子消费一次更新许可、记录运行身份及状态；大稿与研究过程在Git/本机/OneDrive，不进入D1任务JSON。

原站成熟推送依赖`@mmmike/web-push@1.3.0`，应按确有需要复用，不手写Web Push加密。目标尚无VAPID/发布凭据与调度，因此在实际配置和验证前不能声称提醒/自动化已可用。当前文档是研究与接口建议；最终实施按根代理确认的合约继续。

## 2026-10-30实施与验证

根代理确认后，server/services.mjs、0002_services迁移、单次领取原子触发器、owner/epoch隔离、余额与存储当前快照、手动订阅及任务收尾投递已实现。服务收尾collector、同OneDrive credential-owner的出版压缩归档、WindowsApplication→Node隐藏启动器与默认休息runner均已建立；没有复制密钥，没有OpenAI请求，没有启用模型任务。CLI退出0不算出版，须核本次部署回执与时间。

44项server/service/build定向检查通过，包括跨epoch同日领取、设置CAS、失败快照保留、发行额不充当余额、订阅去重和精确静态路由。隔离完整构建成功；启动器真实编译预览Applied:false。正式配置、远端迁移、实机推送与调度注册由根代理在代码冻结后负责；当前实现完成不等于线上已部署。
