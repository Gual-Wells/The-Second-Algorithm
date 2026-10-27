# 独立工程复核：整合构建、输入冻结与发布链

审阅日期：2026-10-28。基线 `90a59c8507f6c17f7aad737317deef011ad6604c` 加当前未提交整合代码。本记录是本轮实际读代码与隔离探针的结果；不是完整发布验收，也不代替内容Agent的算法／教学语义审阅。

## 收口结论

本轮发现两处会削弱准备包边界的工程问题：发布输入漏掉部署配置／迁移，以及部署上传共享dist的并发替换窗口。前者已获root授权在本人模块修复并跑回归；后者由root改成UUID隔离产物，本人只读复核并用独立探针验证。两项修复不能据此推导真实Cloudflare上传已经成功。

收口复查已实际读取root的三项修复：CI不再自动取消运行任务；artifact步骤已在Publish之后并纳入部署receipt／隔离build摘要；READER已改为统一实战、Q唯一主讲和带release参数发布。下文原发现保留原因与修复核对，均已关闭。本轮没有擅改这些由root维护的文件。

当前实际learning模型校验通过：1篇已发布文档、18个Q、6个任务、11个实现、1个验证目标。先前正式作者稿未重建导致的source authority hash mismatch，在收口时独立重跑“当前正式正文逐块／Q索引”测试已通过；新增隔离发布fixture测试也通过。本轮工程审阅范围内没有仍未解决的实质缺陷，可作为当前输入的accepted工程审阅记录；最终全量check及真实线上发布仍由root实际执行并单独报告。

收口时实际计算的输入指纹为 `76ce9046e3f939a0954edc3f3c611d56c97c797865cca01081f8950045fa7e81`（65项输入）。该值是本次复查时点，后续有效源码／规则变化仍会使它过期。

## 发现与核验

### 1. 已修：发布输入闭包漏掉远程配置、迁移及有效规则

初读 `second_algorithm/learning.py:306` 的course_snapshot只有41个输入，实际查询确认以下文件未进入inputs：wrangler.jsonc、migrations/0001_owner_state.sql、protocol/IMPLEMENTATION_STANDARD.md、protocol/TASK_EXECUTION.md、.github/workflows/validate.yml。

而 `scripts/deploy-carrier.mjs` 读取wrangler配置选择origin／数据库，再执行远程迁移。这意味着旧packet可能在配置或SQL已改的情况下仍通过check-release。仅在上传后复核站点不能撤销已经执行的远程SQL。

root授权本人修改所辖模块后，现已纳入：

- wrangler.jsonc、migrations下递归SQL、protocol下全部Markdown、当前workflow YAML；
- second_algorithm Python代码、Python及carrier检查代码；
- web的所有非缓存文件，包含原白名单漏掉而carrier实际会复制的robots.txt、字体及其他合法静态资产；
- 原有正式源稿／源码／生成物、登记、quoted-include闭包、构建器、依赖锁、reader／Worker等。

回归不是只比较函数结果：准备真实fixture packet后分别改远程配置、迁移、协议、CI、辅助校验代码，check-release必须失败；恢复原字节后原packet恢复有效；新增一个嵌套迁移也必须使packet过期。另核查node_modules缓存不参与身份。27项pipeline测试均通过，其中含真实GCC C++17编译／运行及预期诊断；25项原来源工具测试也通过。相关diff-check通过。

复核修复后实际根输入列表时，观察到65项，以上漏项均已进入。此数量只是当时输入数量，不作为课程覆盖率或永久常量。

### 2. 已修并隔离验证：共享dist可在部署锁内被其他构建替换

原deploy只给自身加.local/deploy.lock；buildCarrier不检查这把锁。原上传参数却是共享dist，check-release只重算源输入。这允许另一个npm build／check在最后门禁之后换掉上传目录。

隔离探针复制当前真实模型、作者稿、C++及reader／Worker到D盘.local目录，重建作者稿后先build full，再建立deploy.lock，随后build content-only。后者仍成功把fixture/dist换成content-only。探针未修改根dist、未联系Cloudflare。

root现改为：buildCarrier支持 `outputDirectory`／`--output`，限dist或.local内部；deploy创建 `.local/releases/<UUID>`，构建full、检查mode、再次checkPacket，再上传这个固定目录；线上SW比对也读取该目录。成功信息已移到全部线上检查之后，SW标识正则已支持实际BUILD。

对最新修复重跑隔离探针：

```json
{
  "fullMode": "full",
  "replacementBuildSucceeded": true,
  "afterMode": "content-only",
  "isolatedMode": "full",
  "isolatedArtifactUnchanged": true,
  "traversalRejected": true
}
```

这里replacementBuildSucceeded描述普通dist仍可重建；真正用于上传的隔离full产物保持原字节。路径穿越输出被拒绝。结果存于 `.local/independent-engineering-review/probe-results.json`；探针代码为同目录probe.mjs，是临时本地核验材料。

root已新增长期Node fixture回归：隔离输出不会覆盖共享dist标记，且拒绝content/bad输出；本人已实际运行这项测试并通过。它使用content-only以集中验证输出隔离；本节独立探针另验证了真实full隔离产物在普通dist替换后保持字节不变。本轮没有替root改它的test文件。

### 3. 已关闭：CI新push可能取消生产发布

审阅时 `.github/workflows/validate.yml:20` 使用同一 `practice-check-${{ github.ref }}` group，cancel-in-progress为 `github.event_name != 'workflow_dispatch'`。它只使新dispatch不取消先前任务；新push的表达式为true，仍可取消同main上正在远程迁移／上传的dispatch。

这是对配置的推导，并未故意中断真实生产。已实际打开[GitHub官方并发说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)，其当前说明确认true会取消同组正在运行的任务，条件表达式控制这一行为。最小修复是cancel-in-progress:false；或分离普通验证与固定生产并发组，生产组不自动取消。

收口实际文件已为 `cancel-in-progress: false`，同main生产dispatch不会再被该自动取消条件中断。此结论来自配置复核，未触发真实GitHub工作流。

### 4. 已关闭：CI先留artifact，后部署，漏掉最终部署receipt

审阅时upload-artifact在Publish步骤之前。deploy成功后才写入 `work/jobs/<job>/deployments/*.json`，这些新文件不会进入已完成的上传，临时runner结束后难以从该artifact恢复线上验证记录。

建议把现有if:always()上传步骤放到Publish之后；这样准备失败／发布失败也留现有记录，成功时能包含部署记录。可额外留隔离产物的carrier-build.json摘要，无需上传缓存或凭据。本轮没有触发GitHub工作流来验证实际artifact。

收口已确认Publish位于upload-artifact之前，后者保留if:always()，路径包含work/jobs/与.local/releases/*/carrier-build.json。部署receipt和隔离build摘要的保存接线已修正；未冒称实际云artifact已经取得。

### 5. 已关闭：有效读者文档仍回退到旧架构

审阅时docs/ARCHITECTURE.md仍链接docs/READER.md，而后者7、11行继续写两条工程线、各自章号、track／trial；后文仍给不带release参数的部署命令。这与当前schema2、统一章序和强制packet门禁冲突，应更新该说明。当前正式JSON和实际校验没有因此恢复旧track。

收口已完整读取新版READER：统一章序、当前practice-foundations、唯一完整Q主讲与后续链接、读位不代表掌握、research verify前置、强制release参数及隔离artifact均与当前实现一致；旧双线／track及兼容要求已删除。

## 正向交叉检查

实际读取了tools/build_handbook.mjs、scripts/build-course.mjs、check-project.mjs、deploy-carrier.mjs与完整build-carrier.mjs；交叉读取package.json、wrangler.jsonc、当前learning/publications、唯一迁移、相关Python快照／准备／核验入口、carrier-build／deploy测试、CI、当前有效协议与架构／恢复／读者说明。对browser和upgrade脚本读取了数据来源与执行入口，未在本轮运行浏览器。

- 当前build-course只遍历当前published登记，没有用旧固定课程列表重建10篇历史稿。
- 内容摘要绑定原稿、C++、MD、HTML、builder、learning、publications；关系登记变化后旧摘要会失败。
- carrier实际逐块比对权威代码，拒绝丢块／重复块，校验Q唯一登记／标题／主讲／锚点／引用，并核对内部跳转目标；当前Q索引只含轻字段。结构检查不认证“所有必要知识都已讲清”。
- buildCarrier在隔离staging完成再换目录，已存在测试覆盖失败保留前一输出；content-only有503 Worker保护，不能当普通静态正文误上传。
- check-project入口实际串行执行当前作者构建、模型校验、Python、登记C++目标、carrier测试、完整构建、浏览器和升级脚本；--without-browser明确只是调试子集。
- deploy在调用远程provider之前、构建后和迁移后重复核验packet；缺失packet／无效packet的本地provider哨兵测试均阻止了provider调用。
- 当前migration是IF NOT EXISTS的建表／索引及INSERT OR IGNORE，没有发现本轮新增的破坏性SQL。一般迁移不会由站点验证自动回滚；协议恢复说明已区分未上传、已上传未核验与成功。

## 实际运行、失败与未测

本轮较早独立运行 `node --test test/carrier-build.test.mjs test/carrier-deploy.test.mjs` 两次，均为当时16项中的15项通过，唯一失败是当时正式作者稿source authority hash mismatch。没有把根分支正在作者修改造成的这个失败隐藏成通过；fixture内重建同一实际内容后，完整与隔离构建均成功。

收口又独立运行 `node --test --test-name-pattern="isolated publishing|current published" test/carrier-build.test.mjs`，选中的2项均通过，直接确认新增隔离回归以及当前正式正文／全部声明代码块／唯一Q索引。当前有效输入与这些文件的diff-check通过。

另实际运行course validate通过，以及上述52项本人模块相关Python回归。Python回归属于修复验证，不冒充对他人所有代码的独立验收。

另只读核对最新check-project：Windows未配置浏览器时优先查已有系统Chrome／Edge，PLAYWRIGHT_BROWSERS_PATH默认仓库.local，子进程TEMP/TMP/TMPDIR也在仓库.local；本机所列系统Chrome路径实际存在。该改动是选择已有工具和D盘缓存，不在此入口安装浏览器。本人没有重跑root正在执行的最终53项Python／63项carrier／登记C++／browser／SW全链；这些数量与其结果应由root实际终态记录。

本轮未做：真实Cloudflare迁移／上传、生产owner登录或正文读取、GitHub workflow_dispatch、Linux干净checkout、iPhone真机、浏览器／SW完整回归、最终冻结后的研究／审阅登记和prepare-release。因此不能据本记录声称已发布、完整发布系统已线上验证或所有平台均通过。

后续顺序：root完成最终全量check → 在最终输入上登记真实研究／独立审阅并verify／prepare → 使用packet部署 → 按实际线上结果报告。后续改动使已有证据过期是当前工具的预期行为，不能仅为放行机械重填accepted。
