# 第二算法

面向求职上机的统一算法实战参考：[阅读入口](https://second-algorithm.pages.dev/)。围绕真实任务、成立条件、关键方法、手写与C++标准设施对照、可运行作答组织；不再分算法和C++两册。

每个涉及的C++知识问题全项目唯一编号，一份完整讲解只出现一次，后续只引用编号和主讲位置。题目、方法、实现、Q、实际验证分别建关系；后期C++查漏从同一问题索引恢复，不另复制一套解释。读位不代表掌握。

## 当前内容

此前出版已按用户要求撤回，当前不发布正文。新第一章正在从原题与资料独立研究；撤回前的登记及身份留在 `work/fresh-first-20261028/retirement/` 供恢复核查，不参与新章选题或当前课程覆盖。旧稿/版本仅作历史研究素材，无生产兼容义务。

## 可恢复研究与发布

```sh
python -m second_algorithm research init task-id --goal "实际研究目标"
python -m second_algorithm research status task-id
python -m second_algorithm course validate
python -m second_algorithm course search Q000001
npm run check
```

研究/语义审阅由Agent实际完成；CLI核验Q/关系/引用、输入字节、真实编译运行及证据新鲜度。记录当前研究和审阅后，research verify/prepare-release生成准备包；deploy必须check-release通过，再串行上传并核验线上版本与匿名保护。详见 [任务运行手册](protocol/TASK_EXECUTION.md) 和 [模型](docs/CONTENT_MODEL.md)。

```sh
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

准备不等于部署，测试通过不认证语义完备；输入变化、缺失证据或最新失败会阻止旧包发布。CI按登记target动态检查，workflow_dispatch可执行已有任务的验证/发布准备，不新增定时生成、付费AI或新的内容服务。

## 资料与工程

来源池、书目及本地教材约定保留：`catalog/sources.json`、`catalog/books.json`、`docs/LOCAL_MATERIALS.md`。已注册、目录取得、正文读过、分析、已讲和验证分开；当前覆盖只由真实内容关系和证据判断，不按旧cases/pattern计数宣称完整。商业原件/私人手册/凭据不上传。

Node24、Python3.11+、已有支持目标版本的C++编译器；依赖按package-lock安装。所有本机新数据/缓存/TEMP/TMP/日志/构建/教材实际落D，不安装或删除共享node_modules联接目标。正文/源码在Git与静态资源，D1仅身份及私人阅读状态。没有新增订阅或后台定时活动。

[共同协议](protocol/CONTENT_PIPELINE.md) · [研究部](protocol/RESEARCH_DEPARTMENT.md) · [实现标准](protocol/IMPLEMENTATION_STANDARD.md) · [架构](docs/ARCHITECTURE.md) · [恢复](docs/RECOVERY.md)
