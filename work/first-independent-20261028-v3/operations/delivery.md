# 新第一章撤回重做与正式交付

2026-10-28。任务：撤销当前第一章发布，从零独立研究并发布新第一章。已完成，未新增付费服务或定时任务。

## 两次独立生产操作

1. 旧章先实际撤回：提交`bb4246a8e80ed2c067f835f63f754ddd7092ae2a`；准备包`work/jobs/withdraw-first-20261028-v3/releases/2e87cf5a257846f690c8c225dd5cdb43.json`；部署记录`work/jobs/withdraw-first-20261028-v3/deployments/1793159393447.json`。空目录与旧缓存撤回经真实SW检查；原件和私人阅读状态保留。
2. 新章独立研究、编纂、采用并发布：代码提交`625513a073924fb5aee3af59f63faa5811ed52e9`；正式第一章《区间上的取舍：覆盖、冲突与收益》。当前仅这一章、一份正文，13个全新主讲Q（27—39）、12类实际任务、15项实现和16个验证目标。旧Q身份不重用，不把旧章视为学习前置。

研究、独立范围挑战、实际修订和两类语义审阅见同工作目录；最终判断见`review/adoption.md`。不是旧稿改名，也没有依据测试绿灯推导语义完备。

## 验收

- 最终本地全量检查：76项Python、67项carrier测试、16个登记C++目标、20项真实Chrome交互及实际SW升级/离线/撤回检查通过。
- 核心独立模型：5278组小案例，另有声明边界和规模构造；预算模型实际覆盖全部小案例预算及n*k=10^6构造。
- 单独实际平台入口：15个宏分别编译并运行，六个独立main共318组输入输出；九个Solution适配共62场景153项断言。源码与最终登记相同。
- GitHub Linux CI实际成功：[40634887938](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40634887938)。已读真实job日志，确认76项Python、67项carrier、浏览器/SW通过及章级审阅当前有效，不只查询总状态。
- 本地完整日志保留在`.local/first-independent-v3/`，不公开机器专用环境路径或商业原件。未声称iPhone真机、OJ在线提交或所有输入穷尽通过；本机UBSan缺库未运行。

## 冻结与上线身份

- 章级采用输入：`14bf6c14d7260536d4408be3ea37a1db3e464cc68b9035e0cd87168a9d4d27ab`。
- 发布输入：`b10a9dd5056b830d052ca077965c0e0f73a2a063813c693e3a7cbd7aec5fc409`，86个文件，包括实际采用记录。提交前核对全部输入的暂存blob与本地冻结字节一致。
- 准备包：`work/jobs/first-independent-20261028-v3/releases/ad2bade82e024a96b222f17f7d36adf9.json`，SHA256为`e66249bf7cc7a739dba8f8a24036d1836eacb5568e03461de723fc2285aa41fc`。
- 正式域名：`https://second-algorithm.pages.dev`；本次预览部署：`https://bf786410.second-algorithm.pages.dev`。
- 实际部署时间：2026-10-28T04:56:41.640Z（北京时间12:56:41.640）。部署记录位于上述job的`deployments/`目录。
- 实际artifact来自代码提交`625513a…`，version=`60302e706f208d096732072bdf5a5da8f29d58f2d5e7990a5c7e38d21bc405cd`，build=`b6ad56f153479d863bf812b4e13cd23e0219ab2e1e3df2986ce838df44dd5dfb`。准备前本地dist来自撤回提交工作区，其构建身份不同；正式部署重新构建了隔离artifact，不能把旧dist身份当线上身份。

部署脚本逐步验证同一准备包并实际上传，随后核对匿名访问保护和线上SW身份；再独立读取正式域名`sw.js`得到同一build。白名单仅有目录及interval-decisions的JSON、CPP、MD三项payload，未含boundary-feasibility或历史双线章节；实际artifact目录也只有新章。快照、准备包和部署记录inputHash一致。

本记录及deployment收据随后作记录性提交；它不更改冻结内容、采用依据或线上代码。私人未同步笔记的保留由真实升级回归验证，不能据此声称已远程检查用户真机状态。
