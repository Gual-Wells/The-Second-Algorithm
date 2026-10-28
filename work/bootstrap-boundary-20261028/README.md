# 首章初始化边界管理

2026-10-28，Asia/Shanghai。开工基线main / 2010de3，工作树干净；C约12 GB、D约118 GB可用。
本次为设施边界增补，当前正式collections/chapters为空，未选题、未生成或发布真实章节。

## 实际修改

保留已有空协同路径，新增派生coordinationContext，明确无目标时不要求旧章材料或比较，但全部其他研究与正式内容要求照常。
修复登记缺失/损坏默认为空、默认visibility不一致、withdrawn与published内容矛盾以及自身重复映射隐藏目标的边界。
协议明确首章不降级、不得依赖不存在前章、自身登记不变前章、其他正式章出现须重新协同；空站验证不转为正式章验证。

bootstrap_boundary_audit负责独立只读审查，bootstrap_lifecycle_tests负责新的初始化生命周期与边界测试，主Agent负责实现、协议、验证与发布。

## 验证与发布

已完成并发布，源码提交 `8cb17a7f43a86f8d8aadad9a651f157755cc609b`，已推送main。

- 新增首章生命周期与边界10例全部通过，包含真实空登记→七阶段→首章登记→审阅/验证/准备检查；C++执行在该生命周期夹具中按既有方法模拟，实际编译器功能另由CI原有工具链测试验证。
- 研究设施37例首轮36通过，唯一失败为旧夹具缺少本轮要求的schemaVersion；补为明确有效登记后该例复查通过，CLI及无作者课程恢复也通过。
- [完整Linux CI](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/40685863183) 在当前源码上全部通过，包含164项Python及现有Node、浏览器、真实SW检查。
- 当前真实上下文为no-prior-chapters，priorChapterIds为空、comparisonApplicable为false；这是派生事实，不是作者的豁免选择。
- 准备包：`work/jobs/bootstrap-boundary-20261028/releases/b88c14d0110047eabae4f56123e7aabf.json`。
- 输入：`9c166a78c8b9a1ec33886346fed6a31442d24b02e859ee068dc70ac880364a9e`。
- [正式入口](https://second-algorithm.pages.dev/)，[本次部署](https://3551a1d7.second-algorithm.pages.dev)。
- 部署收据：`work/jobs/bootstrap-boundary-20261028/deployments/1793189795414.json`。
- 线上SW与隔离产物字节一致；owner仍登记、登记窗口关闭、匿名library为401，实际library只有catalog.json、正式集合为0。

详情见 [verification-summary.json](verification-summary.json) 与 [live-verification.json](live-verification.json)。
没有选择或生成真实第一章，没有修改数据库结构或读者界面，也无新增常驻服务/持续费用。测试夹具不代表真实章内容。
