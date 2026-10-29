# 上线后CI发现的读位竞态补修

第一次实际部署源为`2f99b28e54405c913f0e22119083fda6839d5d2a`、构建`0e7d675c95afc53d0a07dda873a52539070a8dc0ce1df6aabf77f93b48d34741`，成功收据1793282994510及实际线上资源/匿名边界检查保留。它与当时本地通过的198 Python、118 Node、4 C++、20浏览器、31日期、50启动和HTTP/SW收据不混同为后续CI也已通过。

实际[GitHub run 40888357027](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40888357027)，job123498054317，在Linux完成前置198/118/4后，浏览器唯一失败是`invalid-explicit-route-preserves-paper-and-reports-unavailable-target`：预期unit-3，实际section-0，其余19旅程通过。没有以本地通过忽略该失败，也没有增加等待来掩盖。

## 根因与最小修正

`web/app.js:route()`同文档恢复先把`positionFor(meta.id)`存入局部值，再`savePosition(false)`保存当前可见坐标。180ms存储去抖尚未执行时，恢复仍拿先取到的旧PRE；新坐标虽已经写入本机，却不能影响本次showReader。快速执行更容易暴露，不宣称它只可能在Linux发生。

只将已有same/wasRead保存调用前移到读取history/local之前。合法锚点检查仍在先，显式历史快照仍优先，reload/fromStart/显式anchor/owner/revision与旧schema3格式不变；不改视觉、按钮或教材，不加入sleep、服务、轮询或费用。

## 受控实证

源代理在独立隔离页面只拦住180ms的storePosition回调，模拟真实尚未持久化窗口；渲染、路由与其他计时继续正常。旧Git2f99 app只在虚拟编译中使用，不覆盖产品文件。旧、新输入起止哈希均不变，每段hash=observed且sequence推进，排除复用旧notice的测试竞态。

- 旧：live unit-3，local/record为PRE，滚位5198、待落盘1；无效路线仍保留正文；返回有效路线却退PRE/0，而本地记录已变unit-3，稳定失败。
- 新：相同初态返回仍为unit-3/5198；释放去抖回调后仍为unit-3/5198，待落盘0，通过。

正式增加第21受控旅程，并为原无效路线旅程绑定hash/observed身份等待。原20旅程及其严格读位、历史、保全判据继续保留。旧/新原始结果在D的`.local/language-replica/qa/ci-invalid-route`，最终验证与再发布实际结果将在后续收据记录；本说明不提前宣称新CI或部署成功。

## 本地补修验收

最终21/21旅程通过，原Back/Forward、无效路线、同文档与慢跨章、字号/纯净/知识/代码/owner边界同时通过；实际278标题、556邻居、278读位检查无误，输入起止及当前哈希相同。新21收据、旧/新受控对照和实际章几何分别归档`qa/browser-route-verified.json`、`qa/route-race-reproduction.json`、`qa/route-heading-geometry.json`与`qa/route-acceptance-receipt.json`。补修后真实HTTP/SW也已重新执行并通过，接管前请求0，记录`qa/upgrade-route.json`，不借用旧升级结果。

本次执行变化仅app路由调用顺序与对应浏览器回归，未变Python、C++、构建、worker、DOM、CSS、图标、教材或协议。前轮198/118/4、日期31和启动50作为明确范围的已通过基线，新正式编译验证和新Linux全流程仍分别记录；不假称把16分钟Python套件再跑了一次。新版形式门禁及部署将再次绑定当前输入，旧成功部署、旧CI失败和原证据不覆盖。
