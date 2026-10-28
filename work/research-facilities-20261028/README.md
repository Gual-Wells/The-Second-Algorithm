# 研究设施正式化：执行记录

## 开始基线

- 日期：2026-10-28（Asia/Shanghai）。
- 仓库：Gual-Wells/The-Second-Algorithm，main。
- 基准 HEAD：3ed65a46cd772828e48548496d1d5f6c7a2248cf。
- 开工前工作树干净；C约12 GB、D约118 GB可用。新增实际数据继续存D。
- 当前出版明确 withdrawn；collections、chapters、questions、tasks、targets为空。
- 本任务建立研究设施与发布衔接，不选择或创作新章，不恢复旧稿。

## 分工与依据

- 主 Agent：协议整合、CLI、反向审查、完整验证与交付。
- research_protocol_design：独立研究设计审查、原始方法资料核对、协议与恢复文档。
- research_facility：独立研究状态、动态资料、不可变阶段与交接实现及测试。
- research_publication_gate：章合同、发布快照、真实研究交接门禁与回归测试。

设计结论与外部资料定位见 [研究设计](../../research/2026-10-28/research-facilities-design.md)。
正式权威是 protocol/RESEARCH_FACILITIES.md、实际数据模型和校验器；此文件仅记录本次工程交付。

## 验收目标

允许尚无正文时启动研究；按依赖持久保存全景、初始范围、资料提取、研究、范围复审、再研究。
资料增补不抹掉历史；当前核心缺口、未处置材料、错位题型或过期证据必须阻止交接/出版。
普通 accepted 笔记不能代替真实阶段交接。显式空站撤回、身份、私人状态与读者界面保留。

## 完成记录

已完成并发布。正式设施入口是 [RESEARCH_FACILITIES](../../protocol/RESEARCH_FACILITIES.md)，
具体研究档案字段与CLI见 [CONTENT_MODEL](../../docs/CONTENT_MODEL.md) 和 [TASK_EXECUTION](../../protocol/TASK_EXECUTION.md)。

- 代码提交：`877e93fe3fd7cf23d7fa13a7cecb2b3af3f70fff`，已推送 main。
- 完整本机检查通过：139项Python、70项Node、21项浏览器场景、真实SW接管/离线/撤回检查；随后新增的真实双章生命周期测试也独立通过。
- [Linux CI](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40673713128) 在同一代码提交上完整通过，包含新增双章节测试。
- 准备包：`work/jobs/research-facilities-20261028/releases/4e1e38eba53d434bbcdcddb399bbeab2.json`。
- 发布输入：`7a8a708ced3906e3841243f943c5225b3a3f6f8bd6db157a74d737b0502a8542`。
- 线上：[正式入口](https://second-algorithm.pages.dev/)；[本次部署](https://712d0ecb.second-algorithm.pages.dev)。
- 部署收据：`work/jobs/research-facilities-20261028/deployments/1793184141933.json`。
- build：`815184d5373493575c82f62c34df39c363fedbaf364cc97065012b8e7e3feb2a`，线上SW与隔离产物字节完全一致。
- owner已登记、登记窗口关闭，匿名library返回401；实际静态library只有catalog.json，collections为0。身份和私人数据未重置。

最初部署的D1步骤返回7403。核对现有OAuth身份/权限和目标数据库只读元数据后，沿同一准备包重试成功；没有重新登录或改动授权，实际原因未确定。无待执行数据库迁移，未修改数据库结构。

设施采用“动态档案＋不可变阶段＋冻结研究交接”，出版核领域、分支、材料、题型及预先取得的练习。已发布研究凭精确部署证明保留历史基座，自己的材料/范围/笔记变化仍严格核验，避免后续章节迫使全部旧研究重跑。

完整机器摘要见 [verification-summary.json](verification-summary.json)。没有选择或研究真实新章，没有恢复旧稿，没有新增服务或持续费用。本次更新保持现有阅读界面；正式设施成立和算法内容已完成是不同事实。
