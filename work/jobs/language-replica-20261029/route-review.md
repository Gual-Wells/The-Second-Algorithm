# 同文档路由恢复：独立修复审阅

这是首轮设计移植发布后的独立补充记录，不改写已经绑定的 `independent-review.md`。基准源码为 `2f99b28e54405c913f0e22119083fda6839d5d2a`；本补丁只调整 `web/app.js` 的一次保存调用顺序，不改变任何UI、正文、身份、存储格式或读位坐标模型。

## 真实失败与诊断

旧CI：[run 40888357027](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40888357027)，job `123498054317`。已通过连接器实际读取该job日志并只抽取失败上下文：`2026-10-29T14:10:06Z`，`invalid-explicit-route-preserves-paper-and-reports-unavailable-target` 检查预期仍为 `unit-3`，实际变为 `section-0`；这是位置回退，不是文字或布局验收差异。此前的198项Python、4个C++目标、118项Node与其余19项浏览器旅程通过，不能抵销这一失败；该CI没有因此完成后续HTTP/SW、日期和启动检查。

读取 `route()`、`savePosition()`、`positionFor()`、`queuePosition()` 与实际测试顺序后，定位到确定的先后关系错误：

1. 手动滚动由运行时立即捕获可见位置，但本机持久化有180ms防抖。
2. 无效显式路线按约定保留现有paper；用户很快返回同一文档的有效无anchor路线，新的history项可以没有受信任读位快照。
3. 原实现先 `local=positionFor(meta.id)` 取得旧的持久化位置，随后才 `savePosition(false)` 保存当前可见位置。保存虽然成功，本次已经取出的局部 `local` 不会随之更新，之后仍交给 `showReader()` 恢复旧位置。

原浏览器测试 `settled()` 默认140ms，短于180ms防抖；速度较快的环境更容易暴露条件。先前Windows通过与本次Linux失败并不构成“平台本身有错”的依据，而是同一时序缺陷可能被较慢的执行掩盖。不得用延长等待到防抖之后、放宽位置断言或删去无效路线旅程解决。

## 最小修复与优先级复核

在文档及显式anchor验证成功、字体就绪、当前请求序列/owner仍有效之后，计算 `same`，立即执行既有 `if (same && wasRead) savePosition(false)`，**然后**读取history和本机位置；删除原后置调用。修后 `web/app.js` SHA-256 为 `bb8d0930bc62e0ae4239a785c78224e09bca998422f7dc05275bbe98c636c2f1`。语法和diff检查通过，git差异只有这一顺序调整。

| 场景 | 仍然成立的约束 |
| --- | --- |
| Back/Forward | `savePosition(false)`只更新当前文档本机记录，不replace当前history；合法owner/document绑定的history快照仍优先于local，因此返回旧history项不会被当前可见位置覆盖。 |
| 合法显式anchor | 校验发生在保存前；`showReader(position, anchor, ...)`仍按明确目标定位，不由local覆盖。 |
| 无效显式anchor/章/文档 | 原验证和不可用提示先返回，未移动本次保存时机到验证之前；现有paper不被重建或改投第一章。 |
| 普通选章/fromStart | 原 `fromStart` 与pane `scrollTop=0`分支未改；保存旧可见位置不使本次从头选择变成续读。 |
| Reload | 首次重建时没有same活动文档，不触发新增提前保存；原 `initialRoute`、reload判断和较新本机位置选择未改。 |
| owner/慢请求 | 序列与owner有效性检查、保存函数自身守卫、旧请求拒绝、history owner/document绑定均未改；没有将新owner写入旧owner命名空间。 |
| 旧读位 | schema3、revision校验、block/ratio/offset、legacy恢复都未改，没有百分比换算或重编号。 |

这些是源码分支的独立复核，不冒称所有分支已经在本轮新构建运行通过。

## 实证与发布状态

源代理已经以旧app虚拟编译版本与新app进行对照，受控阻止180ms自动持久化、保留旧PRE记录但把可见paper移到unit-3，随后执行无效→有效无anchor恢复。已独立读取两个原始结果，并确认旧 `baseline-app.js` 字节与Git `2f99b28e54405c913f0e22119083fda6839d5d2a:web/app.js` 完全相等；`run-diagnostic.cjs` 只将旧app内容交给esbuild stdin虚拟编译，没有替换产品文件。两个运行的输入起止指纹一致。

| 观察点 | 旧实现 | 修复后 |
| --- | --- | --- |
| 开始 | 可见unit-3，scrollTop5198；local/record仍PRE，持有1个180ms回调 | 相同 |
| 无效路线已渲染 | 可见unit-3、5198；hash=observed、sequence由2到3 | 相同 |
| 回有效无anchor路线 | sequence4；可见PRE、scrollTop0，local/record却已unit-3 | sequence4；可见unit-3、5198，local/record也unit-3 |
| 释放防抖 | 旧断言已准确失败 | 持有回调归0，仍unit-3、5198，真实读位不变 |

hash/observed与请求序号同时留证，排除了仅误读上一次notice的解释。旧原始结果SHA-256 `1bf25546785b02cfb185c7e5a83ea7f81f128dc25fca9e48090bf689b556ac54`；新原始结果 `c278233a235d660b59a6a9d0717037f003414a1478068a81565ef34b8757c610`。原件位于 `.local/language-replica/qa/ci-invalid-route/{old,new}/results.json`，便携摘要见下表。受控注入仅位于隔离测试材料，未写进产品运行时。

## 本地最终验证与冻结

修复后的本地全量浏览器21/21通过，包括新增的确定性防抖竞态，以及原有Back/Forward、合法显式目标、从头阅读、快速reload、owner、旧私人原件、字号/纯净、慢请求和原无效路线旅程。独立实际解析了报告并重算其输入哈希：`inputStart=inputEnd`，与检查时的产品/构建输入无差异。实际《二分》仍为278个标题、556个邻居控件、278次节状态检查，错误0；构建为 `0fb499daf0a0f9b3d342d4f7a407e74a22dea71d40d2704dd49c389a99768c30`。

| 本任务便携证据 | SHA-256 |
| --- | --- |
| `qa/browser-route-verified.json` | `63d4836f55fdb741b12c28f40229e68a0f88821a97add1231ad77d0f97da0430` |
| `qa/route-race-reproduction.json` | `21539538cbc5dbb786ea77cfc24aa505262a88e1a77a9dad532a2e60472a65b6` |
| `qa/route-heading-geometry.json` | `7b9a282815bc1beaaa2eb90a02bc6efb8663d044383445ef33a08966713911bf` |
| `qa/route-acceptance-receipt.json` | `593d4c146339148ca4d06d909207943f94c94f5ad5255d6e88fb0a84e692abe4` |

根代理随后对本次补丁重新执行了真实本地HTTP/SW检查，归档 `qa/upgrade-route.json`，已独立读取：实际浏览器/SW通过、提前私有请求0，接管、离线重启、撤回JSON/CPP/Markdown清理、owner切换/退出、原私人记录保全均通过。该结果SHA-256 `ff0bb0ed9ae7eeb25c986b4d3d8d24f25863136d58b1e1bff211f1efd7cc6e9e`；成功布尔结构与上次结果相同，不意味着沿用上次执行。身份仍是隔离本地HTTP模拟，没有生产、真实数据库、系统Passkey或iPhone实机测试。

本轮未重新运行日期31项/启动50项，不把原收据改成新执行。当前章节审阅SHA-256为 `c3c5623d512ba4a40d8999ee8e715b366b8343308783dbad2d3121766bba43bd`，修复源码已推到 `d376d48ee1a72591d914084b12a255d59310312d`；文档不可变revision与教学字节仍不因路由修复改变，全库version可按正式构建Git正常更新。新的远端CI及再次正式部署尚待根代理取得实际结果，本报告不提前宣称通过或上线。原失败CI与首次成功部署均保留历史身份，不互相覆盖。本独立路由审阅到此冻结。
