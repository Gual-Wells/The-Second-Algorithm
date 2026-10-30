# 当前完整CI发现的旧合同测试夹具问题

首次完整CI：`028d4e7b9221b3966de1f293ccc959b81a16d6d1`，run `41092442413` / job `124189524856`，Python执行218项，其中两项error，其余无失败；未执行后续全部Node/浏览器检查，不能称完整通过。

两个错误来自`test_legacy_review_can_still_be_inspected_without_reader_boundary`和`test_schema2_is_technically_readable_but_cannot_be_formally_adopted`。新的公共夹具显式带`reading.extensions:[]`，这两个旧格式测试只把schemaVersion降为2，却保留了仅schema3支持的新字段；`chapter_inputs`因此在构造所谓旧输入时正确拒绝，尚未进入原有兼容断言。

修复仅在这两个旧格式测试中显式移除`reading.extensions`，还原历史合同真实格式；全部原断言保留。生产校验、历史读入边界、当前采用门禁、正文与前端没有放宽或改变。本机直接重现这两个精确案例后验证修复，日志留`.local/requirements-mapping-20261031/legacy-fixture-final.log`。

测试文件是正式输入，当前人工审阅按该实际test-only影响重新绑定；没有借用失败CI充当成功。最终完整CI及对应source commit另写交付记录。

## 第二轮：技术成功不等于正式采用成功

`8a8cb56b58bd084d5c97e86ab4846b6dead4b7f7`的run `41093283298`执行218项Python、164项Node、完整reader/分层/同步/HTTP-SW/日期/启动技术检查均通过，但末尾仍报告editorial review stale。原`check-project`有意分离技术与采用，只打印该提示并退出0；若把整个旧CI绿灯当正式完成，就掩盖了出版阻塞。

已下载该run的16MB检查产物到D盘私有临时目录，比较真实C++verification里的完整input哈希表。唯一差异是`test/carrier-question-ui.test.mjs`：本机原始SHA为`3f370c7e0cc837fe5b38b8b607e3c8605dbaae9e3b47f07ef0126748923c0e3f`，Git/Linux为`2326399f14f4aabf92c7ff0679ad83bfa77cab283adcfdccfe81688c7dc7cdfa`。其唯一CRLF按仓库LF规范转换后，与HEAD原文件精确相等，Git源码无差异；未放宽哈希、改语义或改旧work证据。

CI现把`course quality --json`作为技术检查后的独立必要步骤。技术工具继续保留其独立职责，正式采用失败则整个CI失败；TASK_EXECUTION记录精确输入换行排查。当前审阅按已核实的源字节及这个CI编排变化重绑定，后续完整结果仍以最终run记录为准。
