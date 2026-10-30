# 本机空队列退出复核

真实生产空队列已确认新运行器的发布凭据与队列通路。Node24.19 Windows上process.exit(0)导致libuv UV_HANDLE_CLOSING断言，直接运行同样返回-1073740791；移除强退、仅在job存在时执行模型分支后，同一服务实际运行自然退出0。第二语言同型入口同步修正，旧出题/质检及课表任务不改。

官方Node进程文档说明强退会中断未结束的异步I/O；采用成熟自然退出方式：https://nodejs.org/api/process.html#processexitcode 。没有把文档说明当特定libuv根因证明，具体修复由同机前后对比验证。后台任务实际退出码继续复查。

本次只改本机question-api-worker及审阅/收据，web、server、迁移和教材与已部署a82fedd完全一致。不重复部署页面或生成模型样本。当前三次真实API原响应和usage继续保留，未重复付费。前次198 Python、137 Node、4 C++、23浏览器、启动与真实HTTP/SW成功保留；本次重新核对脚本语法、生产空队列及当前输入C++门禁，不冒称重新审阅算法教学。
