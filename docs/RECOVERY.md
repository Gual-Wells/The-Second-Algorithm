# 工作恢复

先看Git分支/HEAD/dirty状态、AGENTS和有效共同协议，然后执行 `python -m second_algorithm research status`，选当前job执行resume。核对目标、证据/验证是否过期、实际权威源码及下一步，不从聊天或旧目录重建流程。

当前学习与发布依据为catalog/chapters.json的章合同/当前逐承诺审阅、catalog/learning.json及schema2的carrier/publications.json。先运行 `course chapters` 恢复读者/目标/范围/阅读路线和实际缺口，再用 `course quality` 查看本版采用阻塞；旧通用accepted或线上已存在不代表新合同已通过。章级标准和实际工艺见CHAPTER_STANDARD/QUALITY_WORKFLOW。

原双线/旧trial/旧稿不构成当前范围或兼容要求。资料目录、原题已读、方法分析、作者完成、验证、部署与读者掌握分别判断。

输入变化时status会指出stale；只重做受影响的实际研究/审阅和验证，不能机械重填accepted。保留失败尝试、last-good与具体日志，失败不能回退成空清单或偷偷使用旧成功。

任务锁 `.local/research-<id>.lock` 与部署锁 `.local/deploy.lock`出现时先核对其中pid和真实进程，不能强杀其他任务或删活锁。确认进程已结束后才清本任务残留。部署失败先查Cloudflare当前版本和线上匿名边界，分清未上传、已上传未核验与完整成功。

环境恢复按TASK_EXECUTION和CONTENT_MODEL的实际命令。新依赖/模型/日志/临时文件全部实际落D；原书不公开、不移动活动数据库、不为整理目录破坏共享运行时。脚本输出才是本次检查，旧报告不冒充实跑。
