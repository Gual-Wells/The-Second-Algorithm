# 撤回研究与执行范围

用户明确撤销以前的出版。当前出版ID practice-foundations 的目录与18个Q从正式登记移除，原件和Git恢复记录保留，不移入新章。实际构建新的空library，而不是只隐藏按钮或发布旧dist。新增显式withdrawn生命周期，仅在没有发布正文、questions/tasks/targets全空时成立，普通active仍要求完整内容与真实目标。

真实代码核对：learning._inspect、workflow.verify_course/prepare_release/check_release、build-carrier.validateLearning/buildLibrary、build-course；撤回验证报告明确operation=withdrawal、compiler=null、cppVerification=not-applicable，不把0目标假称C++通过。证据及当前输入门禁照常执行，不绕过部署准备。

本次实际完整检查已执行。初次server检查的questions>0断言不能表示撤回，修订为严格状态分支后完整检查通过。真实Chrome/SW测试从旧有内容缓存升级到撤回，JSON/CPP/Markdown缓存清除、旧地址在线离线404、无正文离线启动、未同步笔记保留。证据在.local/withdrawal-full-check.log及.local/carrier-upgrade-qa/results.json，后者是测试夹具而非生产数据库操作。

本轮active工程文本统一LF，确保Windows工作树/仓库/Linux输入身份一致；不修改历史work原始字节。新章作者的未发布文件不加入撤回library，内容生产另有独立任务与新证据。
