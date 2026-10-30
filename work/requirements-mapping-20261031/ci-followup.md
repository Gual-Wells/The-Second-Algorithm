# 当前完整CI发现的旧合同测试夹具问题

首次完整CI：`028d4e7b9221b3966de1f293ccc959b81a16d6d1`，run `41092442413` / job `124189524856`，Python执行218项，其中两项error，其余无失败；未执行后续全部Node/浏览器检查，不能称完整通过。

两个错误来自`test_legacy_review_can_still_be_inspected_without_reader_boundary`和`test_schema2_is_technically_readable_but_cannot_be_formally_adopted`。新的公共夹具显式带`reading.extensions:[]`，这两个旧格式测试只把schemaVersion降为2，却保留了仅schema3支持的新字段；`chapter_inputs`因此在构造所谓旧输入时正确拒绝，尚未进入原有兼容断言。

修复仅在这两个旧格式测试中显式移除`reading.extensions`，还原历史合同真实格式；全部原断言保留。生产校验、历史读入边界、当前采用门禁、正文与前端没有放宽或改变。本机直接重现这两个精确案例后验证修复，日志留`.local/requirements-mapping-20261031/legacy-fixture-final.log`。

测试文件是正式输入，当前人工审阅按该实际test-only影响重新绑定；没有借用失败CI充当成功。最终完整CI及对应source commit另写交付记录。
