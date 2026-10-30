# 答疑提醒正式发布与活跃页核查

2026-10-30产品源提交`83ffef03e30e7499d628e725f8652e854da59400`已发布至`https://second-algorithm.pages.dev`及不可变部署`https://844f1554.second-algorithm.pages.dev`。实际产物`.local/releases/f9447dc1-4422-4a7b-9d70-d56b861cac02`，build为`b3875a5cc11aca5214ebad9a6df6325db84f25f3a38937a0792adc70d1241c52`。job内部署收据与`live-release.json`分别证明上传和独立回读：两域四静态文件摘要匹配，会话接口200，匿名书库/问答私有接口401。

用户收到测试提醒并确认第二算法点击已打开答疑；第二语言更新旧控制器后补测一次，用户也确认“跳转成功”。两端实际设备反馈与隔离浏览器结果分开，不将通道接受等同于设备送达。

用户追加核查站内是否需重进：独立Chromium使用真实app及出版物，证据`.local/active-qa-click-audit/results/results.json`。覆盖页面保持打开时新回复→红点→首次点入口；窗口保持打开等待真实15秒刷新后显示回答且草稿保留；其他章节未读优先；主正文切换章节后打开。各阶段实际验证同一window marker、navigation计数1且无新增auth/status查询，不存在重载、重新登录或重新进入要求。已有设置弹窗→通知精确hash路由也通过，证据`.local/active-qa-click-audit/notification-route/results.json`。红点约60秒检查，窗口内约15秒检查，focus/visibility立即检查；后台不保证前台计时继续。

GitHub首次CI的真实失败为测试夹具在`/api/questions/open`完成之前断言按钮可用。产品正确等待固定会话及资格返回，未删除这项保护。后续仅让既有严格断言在真实打开完成后执行；专项三旅程通过，具体新输入绑定与四C++验证见`ci-followup.md`及同job新收据。产品web/server/migrations与上述已部署提交无差异，因此不重复上传相同页面。云端最终CI结果另外按新HEAD查询，不用本机专项冒称通过。

本轮无新订阅、无新增模型调用；系统提醒不增加模型分析。额度与存储按既有service snapshot更新，出版归档在提交后执行并独立核实下载摘要。正文、C++、知识、日期、收费历史和默认休息安排保留。
