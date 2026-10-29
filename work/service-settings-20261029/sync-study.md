# 读位保存与同步：第二语言对照研究

## 核验来源与结论

目标固定基线`0d896f742ee3a677d09e8ab3f40d968f092adeff`；源为根实际核实的第二语言main `929d42df391f4538c906e743f146cc579e655c0f`。源全部由同一Git对象读取，目标诊断从Git导出独立web副本，不因父任务后续编辑漂移。只读生产代码，未改产品、服务或数据库。

**用户观察属实。** 源第二语言的读位是本机数据，滚动250ms后只写localStorage；其“同步”表示课程和学习反馈，不表示每次滚动。目标把高频本机坐标变化直接标为全局dirty，180ms本机保存后再以1400ms触发每条PUT。开关窗、布局settle和resize即使坐标不变也重新标脏，页脚因而在本机保存、正在同步、已同步间反复切换。不是必须用数据库更换解决的问题。

## 真实浏览器量化

使用实际基线app/runtime、Chrome、受控本机API与自写教材；SW阻断，无真实身份/DB/付费/生产请求。原始`.local/service-settings-20261029/sync-baseline/qa/results.json`，可移植摘要及原始SHA见`sync-measurements.json`。

| 操作 | 时长 | 读位PUT | 实际不同坐标 | 观察 |
|---|---:|---:|---:|---|
| 不滚动，仅5次正常resize→settle | 9.558秒 | 5 | 1 | 仅capturedAt变更，每次仍重新标脏 |
| 5次滚动50px，各停约1.9秒 | 9.632秒 | 5 | 5 | 每次停顿都发送云写 |
| 一个PUT延迟1500ms，同时继续同位resize | 8.584秒 | 4 | 1 | 后续请求间隔1518/1514/1505ms，响应后直接while续发 |

前两场景的页脚实际状态分别经历16次不同状态（含初始状态），不是只数赋值。第三场景状态保持正在同步，但同坐标仍连续发请求。没有据Windows观测冒称已测iPhone真实resize频率；iOS浏览器栏/键盘引发resize是应兼容的入口，不是本次已经实测的事件数。

## 源实现为什么安静

`web/app.js:saveReadingPosition()`把`Math.round(readingScroll.scrollTop)`存到`POSITION_KEY`，不调用api、不进入PENDING_KEY。scroll仅250ms延迟本机保存；切部/开章/pagehide也只保存本机坐标。

`flushPending()`仅提交学习反馈队列到`/api/progress/:id`；启动/online时处理，与读位保存分开。源`setSyncStatus()`在开章、反馈网络结果、online/offline等真正状态切换时显示。不能只复制源底栏外观却把目标每次capture都投成网络同步。

## 目标的四个实质问题

1. `reader-runtime.js:readCursor()`每次生成新`capturedAt`，`capture(true)`和`settle()`都会把坐标交给`onPosition`。`storePosition()`不比较实际坐标，直接dirty。虽然同一位置，JSON不同也造成ACK不能把最新记录判为已确认。
2. `queuePosition(180ms)`和`positionTimer(1400ms)`都只是短暂停顿合并，不是云写上限；真实阅读中每次稍停都会写云。
3. `syncRecord()`泛用while-dirty，读位在请求中再次采集后会在响应回来立即续发，绕过1400ms等待。单纯增加该等待不能修这个通道。
4. `updateConnection()`把position dirty/syncing和用户设置/连接失败混为一体；每次update还直接重置textContent，即使显示值相同。普通本机读位不是服务连接异常。

服务端`server/worker.mjs:stateRoute()`每PUT直接UPSERT并revision+1，没有相同内容no-op。它覆盖同一个(owner,epoch,state_key)而非追加历史，因此当前核心是请求/写入配额和状态抖动，不是每次PUT按全文追加导致逻辑数据库体积线性增加。owner/epoch/credential守卫不能为省请求取消。

## 建议的最小方案

最接近源的是读位完全本机保存，但这会取消目标现有跨设备读位，不能悄悄以复刻名义降级。建议保留现有云恢复能力，**本机读位快存＋云端粗检查点＋明确收尾刷新**；不引入第二数据库或新常驻服务来处理滚动。

- `positionSignature()`仅比较schema/revision/anchor/offset/block/legacy实际坐标，排除capturedAt。先不无证据引入量化误差；相同坐标不重新dirty、不发送PUT，不改旧schema3。
- `storePosition(value,historyEntry)`集中本机保存。历史绑定照旧处理；本机和record坐标一致时不再刷新时间戳/重复写。`savePosition(false)`仍须在route取恢复候选之前执行，不能重开已修的180ms竞态。
- 云端使用一个有最大等待的检查点调度，不是不断重置的debounce。建议内部60秒（30–60秒均属工程选择，不是源已有协议）；调度到期按owner/connection捕获当前待存position keys，跨章不丢旧key。持续滚动也能到期保存，不能拖到用户停止才发。
- `syncRecord(position:*)`每个检查点只发一个快照；若请求中真实坐标又变，保dirty等下一个检查点，不在while里持续追发。非position设置可保既有及时保存逻辑。
- `syncPending()`区分普通/due和forcePositions。focus/常态不强制打破检查点；章切换、后台/离开、明确退出/重新载入可尽力刷新最新待存坐标。卸载网络不保证成功，必须先把最新本机坐标与dirty持久化，下次登录/在线再恢复；不要用sendBeacon或keepalive假称必达。
- 页脚正常显示“章节已同步”或“读位已保存在本机”等准确对象；计划内检查点等待/正常后台位置PUT不反复显示异常/正在同步。用户偏好保存、实际失败、离线仍给真实反馈；不能靠删错误状态掩盖网络问题。只在文字/颜色真正改变时修改相应DOM。
- 可选服务端no-op防重复：非notes的完全相同JSON避免revision+1；优先UPSERT条件避免正常每次先查，只有no-op/冲突时按现有守卫读取结果。notes的CAS/409与原件保护不能改。client去重优先，不能拿服务端少写掩盖HTTP请求仍频繁。

60秒不是要暴露给用户的新设置。它可作为内部常量，与用户本次要求的自动生成开关无关。不要因为自动更新默认关闭而停止本机保存，也不要把API额度不足当作读位写入失败重试。

## 需要保住的边界

- owner或connection改变清计时任务，任何旧回调不写新owner；同一章不可变revision不一致不按百分比硬映射。
- 同一章不同待存坐标、跨章旧key、多端/离线dirty、在途ACK均保持最新本机原件。原位置服务器目前是最后写入获胜，不是完整多端冲突合并；不要声称本次节流自动升级成强一致。
- 旧notes/journal原件和CAS语义不动，取消笔记入口不授权删除。原D1 position记录也不因本机优先就清空。
- 当前基线198 Python/118 Node及原内容C++已通过，不需要为读位层反复重跑无关Python；执行实际受影响的浏览器/状态服务器测试、读位恢复及发布门禁即可。具体以根最终改动范围为准。

## 必要回归

1. 同坐标多次capture/resize/开关窗：本机坐标不丢，新增position PUT为0，常态同步标识不抖。
2. 持续滚动超过检查点：请求有明确上限且不会一直延期；后台/切章/退出可刷新最新，不借状态平静隐藏dirty丢失。
3. 延迟PUT期间继续移动与同位capture：ACK不覆盖新坐标，读位不while连发；后续检查点/收尾能最终确认。
4. 离线、重载、owner切换、并发标签页、旧notes、显式Back/Forward、无效路由往返、字体/纯净/索引跳转沿现有严格判据。
5. 偏好/未来学习安排等用户明确保存仍及时，等值保存不重复写；真正失败恢复能反映，旧值不能伪装新查询成功。

以上为修复前的研究结论和方案边界；实际修复由根实施。后续冻结源码的专项结果如下。

## 修复后的独立实证

新增`scripts/check-reading-sync.cjs`使用最终真实web源码、自写两章材料与隔离HTTP状态执行6条浏览器旅程。生产60秒检查点、180ms本机保存、超时等常量不被替换；Playwright时钟推进原始回调，真实host帧交付scroll事件和fetch响应。最终报告`.local/service-settings-20261029/sync-after/attempt-3/results.json`，6/6通过、退出0、前后10份源码SHA完全一致；其摘要和报告SHA已保存到`sync-measurements.json:after`。

| 场景 | 最终读位PUT | 额外核验 |
|---|---:|---|
| 同位6次resize | 0 | 本机坐标、dirty、页脚意义、状态灯不变 |
| 持续13轮阅读、覆盖60秒 | 1 | 首个检查点在60,188ms；50秒前无PUT，不因继续滚动无限推迟 |
| 慢ACK期间继续8次滚动 | 2 | 两次均由显式收尾触发；响应后不追发，新位保dirty，第二次保存最新；相同位置再次隐藏不重复 |
| 离线5次滚动、恢复联网 | 1 | 离线0写、本机及history最新；恢复一次合并latest并ACK，后续65秒不重复 |
| 切章后隐藏 | 2 | 旧章收尾一次，新章另用独立key；旧回调不污染新history |
| pagehide及修改阅读偏好 | 1 | 收尾保存最新坐标；偏好另及时PUT一次，无需等一分钟 |

首次失败报告和第二次报告均保留。首次测试一方面碰到服务module未完全冻结，另一方面将native scroll尚未交付时的旧local误作expected；第二次5/6通过，联网后立即虚拟推进65秒先触发了生产20秒fetch超时，使真实host认证响应来不及交付。最终只修正测试的host/virtual时间先后并补充失败证据，不改产品、不降低断言。不能把前两次失败删去或宣称原次通过。

`scripts/check-carrier-browser.cjs`同步更新新目录和设置的真实产品语义：H2分组/H3H4子项、展开与跳转分离、无搜索；学习/服务入口及unknown快照、恢复默认仅改阅读参数并保预下载和读点、服务详情返回原settings滚位。源码边界仍用真实受保护`sourceUrl`的HTTP字节比对和401，而不虚构已移除的文件入口。既有正文、全部标题、历史、纯净、选择、owner、旧notes及同步失败恢复判据保留；完整运行结果由根统一记录。

本专项没有运行真实数据库、付费服务、生产请求、通行密钥或物理iPhone；SW在此阻断，仍需独立HTTP SW检查。未改动dist、未部署、无新增持续服务。
