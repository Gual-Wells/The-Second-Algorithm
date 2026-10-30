# 本机退出与CI夹具的最终复核

沿graceful-exit-review的实际空队列对比，第二语言、第二算法、课表三项计划任务现均退出0；没有追加模型调用。

初次CI https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/41011305170 在真实HTTP/SW撤回阶段等待controller失败，前面的Python/Node/阅读器和同步检查通过。日志显示候选worker仍installed。检查夹具发现所有upgrade-new manifest请求都被无限期hold，显式释放之后如果后续update再次请求，仍会被重新扣住；这超出了“仅验证指定安装窗口”的夹具目的。现在在每段阻塞验证完成前显式关闭hold，第二场景才重新启用。没有删除或放宽实际controller版本/activated要求，没有改产品SW或新增无根据sleep。

重新执行真实HTTP/SW专项；之后以当前输入完成门禁和CI。运行器/夹具/审阅是本次后续范围，web/server/migrations及教学原件与a82fedd实际部署字节相同，不重复部署同样页面。
