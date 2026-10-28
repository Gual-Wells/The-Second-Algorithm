# 撤回与重新发布执行审计

本审计针对 `仓库根目录`，在 2026-10-28 只读核对生产代码，并复用了已有工具验证环境。初始 Git 为 `main`、`d43e8ef2d4e958cb78b8f60367f3d3b009cdd5db`，初始工作树干净。审计期间 root 已开始执行撤回，后续状态与实际发布结果以 root 的收据为准。本子任务没有修改生产源码、课程登记、依赖锁，也没有执行迁移或部署。

## 判断

现有流程足以实施“先撤回旧第一章，再从零研究并发布新第一章”，无需为撤回放松门禁或为旧章制造质量通过记录。撤回是独立的 `operation: withdrawal`；新内容恢复后是 `content-release`，必须重新建立真实内容、章级采用和 C++ 验证。

已读取 `AGENTS.md`、`protocol/TASK_EXECUTION.md`、`protocol/QUALITY_WORKFLOW.md`、`protocol/IMPLEMENTATION_STANDARD.md`、`docs/CONTENT_MODEL.md`、恢复说明及实际 CLI、构建、部署、CI、reader/SW 实现。以下结论来自本轮代码核对，历史发布记录不能代替本轮验收。

## 撤回操作与验收顺序

1. 保留可恢复的作者原稿、C++、合同、审阅和 Git 历史；仅把它们退出当前出版和学习登记。无需删除原件。
2. `carrier/publications.json` 根设 `state: "withdrawn"`，不得存在实际 published 文档。可直接清空 `collections`；如保留集合则须显式 `visibility: "hidden"`，省略 visibility 仍视为 published。
3. `catalog/learning.json` 保留 schema1，`questions`、`tasks`、`targets` 三数组全部清空。`catalog/chapters.json` 可清空当前章登记，历史合同原件留存；withdrawn 时实现豁免正式章采用，不要求篡改旧审阅。
4. 构建后检查真实空目录：空 collections、空 Q、`libraryPaths` 只有 `/library/catalog.json`；不能只看首页没有书目。检查实际 full 构建，不能把 content-only 诊断产物上传。
5. 完整载体、浏览器及真实 SW 升级检查通过后，保存本次撤回理由/边界与审阅笔记，再绑定当前输入的 research/review 证据、验证、准备包并部署。

root 本轮已使用 job `withdraw-first-20261028-v3`；以下为现有 CLI 的实际运行形式（笔记路径须指向真实完成的记录）：

```powershell
. .\.local\first-independent-v3\release-environment.ps1
Set-Location $releaseRepo
& $releaseNode scripts/check-project.mjs
& $env:ALGORITHM_PYTHON -m second_algorithm course validate
& $env:ALGORITHM_PYTHON -m second_algorithm course quality
# 实际笔记稳定后：
& $env:ALGORITHM_PYTHON -m second_algorithm research evidence withdraw-first-20261028-v3 --kind research --path $withdrawalResearchNote --summary $researchSummary --outcome accepted
& $env:ALGORITHM_PYTHON -m second_algorithm research evidence withdraw-first-20261028-v3 --kind review --path $withdrawalReviewNote --summary $reviewSummary --outcome accepted
& $env:ALGORITHM_PYTHON -m second_algorithm research verify withdraw-first-20261028-v3
& $env:ALGORITHM_PYTHON -m second_algorithm research prepare-release withdraw-first-20261028-v3
# 从 prepare 输出的 receipt.path 取得 $packet，不猜旧包：
& $env:ALGORITHM_PYTHON -m second_algorithm research check-release $packet
& $releaseNode $releaseNpmCli run deploy -- --release $packet
```

`scripts/check-project.mjs` 默认确实执行 Python、登记目标验证、carrier 测试、full 构建、浏览器与 SW 升级检查；`--without-browser` 不是完整验收。它最后保存 editorial 状态，但允许诚实的章级未采用施工版本通过技术检查，因此 fullcheck 绿色不能代替 `course quality` 与准备门禁。撤回 `verify` 的 compiler 为 null、`cppVerification: not-applicable`，没有编译目标，不能报告“C++ 全通过”。

本次撤回尤其要核验：旧 JSON 正文、CPP 源码、MD 三类 payload 都清除；旧路径与旧 hash route 在新 worker 接管后不可读；空目录可离线重启；用户未同步笔记及 owner/阅读状态继续保留。`scripts/check-carrier-upgrade.cjs:159-218` 已有实际 Chromium + 实际 SW 的这组回归，不接触生产 D1。它是通用 fixture 回归，仍应核对真实构建空目录与部署身份。

## 输入冻结与门禁

- `second_algorithm/learning.py:320` 起的 `course_snapshot` 绑定当前登记、已发布权威稿/代码/生成产物、实现/target 依赖、章合同/材料/审阅，以及 reader、server、脚本、测试、规则、锁文件、CI、wrangler 配置和 SQL。
- `second_algorithm/workflow.py` 的最新 research/review 记录必须 accepted、文件摘要不变且 inputHash 当前；当前输入上的最新验证失败会压住 last-good，不能回退绿灯。`prepare_release` 同时要求模型、章级采用、两类证据和实际验证。
- `check_release` 重核输入、生命周期、最新准备包指针/包字节、验证指针、证据和章级采用；被后包替代也会拒绝。更改 production、规则、依赖锁或审阅后，应重新判断影响并重验，不能仅换 hash。
- 研究/部署各有 `.local` 独占锁。残留锁先查 PID 和真实进程，不得强删活锁或并行改冻结输入。
- 本审计的 work 文档和环境脚本未被当前课程登记为材料，不自动进入课程输入；若新章将其登记为材料，届时其字节也会进入身份。

## 部署实际行为与 Git/CI 边界

`scripts/deploy-carrier.mjs` 的实际顺序是：校验 release → 获得本机串行锁 → full isolated artifact 构建到 `.local/releases/<uuid>` → 再验 release → 对既有 D1 执行 remote migrations apply → 再验 release → Pages 上传 main production → 检查匿名边界与线上 SW build 身份 → 写独立 deployment 记录。它不把准备包的 `deployed:false` 改成 true。

必须认识以下边界：

- deploy 本身不运行浏览器或 SW 升级检查，必须先完成 fullcheck。
- migrations apply 在 Pages 上传之前是真实远端操作；包冻结了 SQL/配置，不能改后使用旧包。当前仅有 `0001_owner_state.sql`，审计未执行它。
- 默认线上检查包括 `/auth/status` 200、`/api/library`/`/api/state`/目录及编码目录路径 401，并比对 `/sw.js` build；它不替代已登录真机验收、完整旧 payload 路径测试、D1 状态审阅或 iPhone 真机测试。
- 上传之后若线上核验失败，可能已经部署；先核线上版本和 provider 状态，不能按“脚本非0”断言未发布，也不能立即盲目重复迁移/上传。
- worker 的匿名旧路径应先得到 401；已登录 owner 访问已撤正文应 404。将匿名 401误判成旧正文仍存在或误要求所有旧路径匿名404，会破坏鉴权合同。
- 新 worker 的白名单与 activate 清理阻止旧 payload，`web/worker-release.js` 通过当前 controller 的 VERSION 回执确认接管；`registration.update()` resolve 不是接管证据。完全离线且尚未接收新版的旧客户端不能被服务器隔空删除，发布报告应限定为“新版实际接管后”。

`.github/workflows/validate.yml` 目前 push/PR 只执行技术检查并上传工件；生产发布只在 `workflow_dispatch`、`publish=true`、main、已有 research job 和两个 CF secret 非空时执行。它在 CI 上重新 verify/prepare，不凭本机包直接发布，也不会创建语义证据。仓库存在 `origin` remote，当前为 main；本审计未推送、dispatch 或调用远端写操作。仅看 workflow 的 secret 名称不能证明 GitHub secret 当前已配置。

本机 `.local/deploy.lock` 只串行本机发布；CI concurrency 按 ref 分组，不能阻止本机与 CI 同时部署。请为本次撤回及新章发布选一条生产写入路径并串行完成。

## 已验证的执行环境

审计开始 C 盘约 11.99 GB free、D 盘约 118.63 GB free（十进制字节换算）；不是未来安装余量保证。本轮没有下载或安装包。

| 工具/依赖 | 本轮核实的路径或版本 |
|---|---|
| Node | 现有 `<existing-node>`，v24.19.0；realpath 仍在 C，保留活动运行时 |
| npm CLI | D 盘既有 `<existing-npm-cli>`，12.2.1；PATH 无 npm.cmd，用 Node 显式运行 |
| Python | 现有 `<existing-python>`，3.14.4；禁止字节码写入，临时/输出在 D |
| C++ | D 盘既有 `<existing-g++>`，GCC 16.2.0；PATH 默认无 g++，必须设 CXX |
| Git | `<existing-git>`；PATH 无 gh，发布无须安装 gh |
| scripts 依赖 | 真实 D 目录 `scripts/node_modules`：marked 17.0.5、highlight.js 11.11.1、esbuild 0.25.12、wrangler 4.140.0 |
| server 依赖 | 真实 D 目录 `server/node_modules`：`@simplewebauthn/server` 实际入口可解析 |
| 备用完整依赖 | 真实 D 目录 `.local/lock-clean/node_modules`：上述锁定版本加 playwright 1.62.1、simplewebauthn 13.3.0；并非要求安装或变更此处 |
| 浏览器 | 现有 Chrome 156.0.8078.48；环境脚本显式使用现有 Chrome，避免下载浏览器 |

根 `node_modules` 是指向 C 盘共享运行时的现有 junction。它缺少某些项目包，但脚本和 server 已有就地 D 盘依赖，不能据根层 require 失败就误判要安装。没有修改这个联接或共享实体。`tools/build_handbook.mjs` 的 marked 和 `check-carrier-browser.cjs` 的普通 require(playwright) 仍可能从 C 盘既有共享模块读取相同版本；这是已存在运行时读取，不是新增安装/缓存/产物写入。升级脚本可用 `ALGORITHM_QA_PLAYWRIGHT`、`ALGORITHM_QA_ESBUILD` 指向 D 备用库。依赖安装目录被快照排除，不应靠修改生产源码迁就机器。

已生成并成功点载入 `release-environment.ps1`：明确 CXX/Python/Wrangler/Chrome/QA 模块；TEMP/TMP/TMPDIR、npm cache、XDG cache、Wrangler cache/log、Playwright 浏览器路径、Python pycache 路径全部到本项目 D 盘 `.local/release-runtime`。该脚本只配置进程环境和创建 D 目录，不设置 XDG_CONFIG_HOME，不改变既有凭据来源，不安装依赖。

现有 D 依赖占用（审计读取现存文件总长度，非本轮新增）：scripts/node_modules 192,965,422 B，server/node_modules 3,073,526 B，.local/lock-clean/node_modules 214,560,765 B，合计约 391.6 MiB。本轮环境核验缓存/日志共约 274,897 B，文件数 69；报告和脚本另外占少量空间，后续检查/部署会继续生成本项目 D 盘产物。未新增周期任务、账号或持续付费。

## Cloudflare 授权核验

本进程 CF token/account/key/email 环境变量均未设置。既有默认 Wrangler 配置文件存在（凭据机制保留原位，未打开或打印其内容）。本轮使用 D 盘已有 Wrangler 4.140.0 执行只读 `whoami`，所有新 temp/cache/log 在 D、telemetry 关闭，原始账号和响应输出不向用户回显；返回 exit=0、authenticated=true。

这证明既有登录当前可被 CLI 使用，不证明每个上传/D1 写权限都成功；真实部署仍由 root 走受门禁约束的部署脚本完成。审计没有执行 token 导出、OAuth 新登录、远端迁移或上传。

## 新第一章恢复 active 时的重点

旧原件不是新章预设题单，也没有旧 URL/Q 的兼容义务。先按真实研究定章界、题目/方法条件关系和实际材料，再写新权威稿及 C++，建立 learning 与 chapter 合同，独立回读和外部 countercheck 后才记录采用。

若 retained hidden 集合仍为 `kind: chapter`、`chapterNumber: 1`，构建的全登记章号唯一性检查仍会与新第一章冲突。可以撤去旧出版登记并保留 content 原件；若确需留 hidden 登记，则把旧项改为无章号的 hidden draft，不能同存两个 chapterNumber=1。

active 必须有真实 published 文档、Q、tasks、targets，章合同每维具体承诺全部 addressed、逐承诺真实 review 当前且 accepted；恢复后用新 job/当前证据重新完整检查、`research verify --compiler $env:CXX`、prepare/check-release/deploy。撤回的验证和准备包不能授权新内容。最终报告分别给出研究结论、实际代码验证、完整载体验收、准备包和真实部署/线上核验状态，不能合并为一个“已通过”。

公开记录使用工具占位符；机器专用的可点载入配置位于被忽略的 `.local/first-independent-v3/release-environment.ps1`。本地执行配置不随仓库公开。
