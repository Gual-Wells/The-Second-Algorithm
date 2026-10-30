# 整节超纲元数据与发布产物

## 权威与投影

- 唯一分类权威是章合同 `reading.extensions`，每项为 `{sectionId,tags,reason}`。`sectionId` 指正式 `reading.units[].id`，`reason` 是内部实质分类依据。历史没有此字段按空分类读取；本次第一章显式登记三项。
- 稳定的题型单元身份映射到其唯一 `locations[{document,anchor}]`。本文的 `anchor` 是显式作者锚点，例如 `time-parallel-search`；它与渲染后的中文 H2 slug 是不同身份，不能互相假定相同。
- `scripts/lib/chapter-extensions.mjs` 读取 `catalog/chapters.json` 及其实际章合同，核对章节/集合/文档归属，核对正式整节声明，然后在最终 reader HTML 中核对显式锚点确实紧邻完整 H2。PRE、任意 H3/H4、隔着正文段落的锚点、重复指向一个 H2、跨文档或未知定位均拒绝。
- `scripts/build-carrier.mjs:buildLibrary` 将 `{sectionId:<显式稳定anchor>,tags}` 投影到受保护文档 payload 和 catalog 文档项的 `extensions` 字段。两者来自同一次投影；没有复制正文、分类理由、研究记录或代码。payload 的 immutable revision 包括 `extensions`。
- 标签变化改变读者 revision/URL；只修改内部理由不改变读者 payload，但章合同字节仍由正式生产输入快照和当前审阅绑定。
- UI 应以通过既有 revision/SHA 核验的文档 payload 为权威，经 runtime alias 将稳定锚点解析为真实 H2。用户撤回偏好不由本模块实现，不写入公开章合同。

## 确定性边界

Python `second_algorithm/chapters.py:_extension_contract` 与 Node 发布投影均核查：声明数组、schema3、已登记正式节、整节唯一定位、非 PRE、非子标题、非空思想标签与内部理由、空白归一后的重复标签、重复节或同一 H2 别名冲突。标签只允许普通文字，读者投影另执行既有 reader-boundary 过滤。

这是结构与身份检查，不是自动判断何种思想符合科班基础，也不表示读者已掌握。新章显式审阅分类及整节实质依据由正式协议约束，历史字段缺省兼容不变成旧章重研门槛。

`course_snapshot` 实际递归包含全部 `protocol/*.md`、scripts helper、second_algorithm 和 test/tests 代码，因此新 `CONTENT_LAYERS.md` 及本设施均进入正式输入版本。

## 本次第一章登记

| 稳定节身份 | 思想标签 |
|---|---|
| `time-parallel-search` | 离线批处理、并行二分 |
| `dynamic-range-kth` | 离线值域分治、整体二分 |
| `marginal-penalty` | 拉格朗日松弛、离散凸性 |

这是根代理与独立内容审阅确认的分类，不因本模块机器通过而成立。其他节仍在主线，正文顺序、编号及跨节知识引用保持原身份。

## 实际验证

- `python -m unittest discover -s tests -p test_extensions.py -v`：5 项通过。
- `node --test test/carrier-extensions.test.mjs`：5 项通过。
- `node --test --test-name-pattern 'whole-section classifications' test/carrier-build.test.mjs`：1 项实际 buildLibrary 合成集成测试通过。
- 合成集成测试验证 classifications 改变 immutable revision、payload/catalog 同源、原 HTML/源码/Markdown URL/标题树不因分层复制改写、内部 reason 不出现在读者产物、reason 独立更新不改变读者 payload、子标题定位被拒绝。
- 单元覆盖显式空与历史缺省、PRE/子标题/无效身份、跨文档、多位置、重复节/H2别名、空/重复/非文字标签、空理由、改名后锚点稳定及目录合同越界。
- `node --check` 两个相关构建模块通过。

当前工作时作者代理正在定点修订正文，直接执行 `course validate` 曾返回 `Composition author inputs changed; rebuild the chapter`，随后产生缺正文的连带错误。这是并行施工期间生成件尚未重建，未把这次命令冒称成功；根代理整合后需要按正式流程重建、统一验证和发布。此子任务没有构建 dist、没有提交、没有部署。
