# 双标签实现独立代码审阅

审阅范围：`web/reader-runtime.js`、`web/app.js` 和 `server/worker.mjs` 本轮双标签/整节撤回差异。审阅只读产品源，不重设计Logo、问答、认证或其他服务。以下区分静态路径发现与浏览器验收；实际浏览器结果由独立QA记录。

## 发现与处理

### 1. 已定位并由根代理修复：tab续读被当作显式标题跳转

原 `switchLayer` 将缓存坐标同时以 `onNavigate(target.anchor,target,next)` 的显式anchor和position传出。`app.route`再调用`showReader`时，anchor分支会重新构造 `{anchor,offset:revealLine()}`，丢弃原`block.index/offset/ratio`，使tab切回小标题而不是原段落或代码位置。

已报根代理，根代理改为 `onNavigate(null,target,next)`，保留显式目录和撤回动作的标题跳转语义。当前源码确认这个修复存在；其实际坐标回归由独立浏览器测试确认。

### 2. 已定位并由根代理修复：跨层目录/链接及浏览历史未缓存离开的tab

初始实现只有`switchLayer`写`layerPositions[layer]`。通过`go -> onNavigate(anchor) -> route -> showReader`从主层直接跳到超纲层，不会经过`switchLayer`。如果此前没有用tab按钮离开主层，随后点主tab时没有保存坐标，回退到PRE首。浏览器Back从某层离开也可能跳过同一缓存入口。

已将具体操作发给根代理和独立QA：主层定位`ordered-dp-frontier`并向下滚动，直接目录跳`dynamic-range-kth`，再点主tab，核对原全局块和块内偏移；并补超纲滚动后Back、再点超纲的路径。根代理已将“离开层前保存当前坐标”放入通用`showReader`层切换入口，在改变层可见性前保存旧`readCursor`；当前源码确认修复存在，并已通知独立QA覆盖。这里不把静态路径等同于浏览器动态验收。

## 其余已核实现关系

- `setChapter`在添加临时标注前保留原全局`blocks`序列；`visibleBlocks`仅决定当前可见块，不重新编号。`restoreSnapshot`仍用全局index取原节点，并排除隐藏块。主副切换不会通过重新解析正文改变原块身份。
- 章节正式编号与目录原序不受隐藏影响。meta中的稳定显式anchor经现有`aliases`映射为真实H2 slug，目录节点和正文定位消费同一标题树。直接把英文稳定anchor当中文H2 id是测试夹具错误，已提醒QA修正，不能据此改写产品锚点。
- `restoreSectionToMain`在异步摘要前取得owner与active，摘要后重核二者；本机`records`持久化成功才回报移动成功。section以文档+稳定节身份的独立摘要key登记，多个撤回不覆盖同一大preferences对象。
- server继续通过既有`stateRoute`的owner/epoch/credential门禁和Origin检查写小状态；本轮仅扩展合法state key及值结构，不另建公开内容接口。新section值只接受三个约定字段及`restored:true`。
- 正常操作是单向撤回。撤回后`applyLayer`将临时panel从DOM移除；后续切页不会重新创建。刷新或新章节版本`setChapter`虽然重新建立DOM，但先读稳定section偏好再分层，因此仍移除已撤回panel。未发现正常流程能把此标注重现的第二路径。
- 一节撤回只改变该稳定节的归属，其他节的默认分类不被先修关系联动改变。共享代码和基础知识仍可经已有链接跨层到达，不加入自动级联恢复。
- 空超纲层的`readCursor`产生`{schema:3,anchor:null,layer:'extension'}`；`normalizePosition`有显式入口，标题导航禁用、目录仍保留全部章节结构。静态没有空数组解引用的必然路径；空页实际刷新/返回及布局仍须浏览器验收。
- owner切换/lock会清runtime及S.records；旧异步请求响应另有owner和connection检查。不同owner不会继承本机同名前缀下的节选择。
- 选择按稳定document/section登记，未绑定单次内容revision。新版本标题/编号变化不抹除同一节的用户撤回；旧读位若revision改变则按锚点降级，不能把旧block百分比套到新正文。
- 没有新增定时器去逐节核算资源，没有修改既有60秒阅读同步检查点，也没有改动问答或Logo生产逻辑。

这些关系不代表iPhone实机验收、全部历史状态已穷举或教学内容已被自动认证。最终以冻结输入上的浏览器、真实HTTP/SW及正式发布记录为准。
