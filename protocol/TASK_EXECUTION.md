# 研究任务与发布任务运行手册

本手册描述实际CLI。无周期任务、付费模型调用或自动语义认证；Agent负责资料和内容判断，脚本/CI负责可重跑的确定性步骤。

## 启动与恢复

```sh
python -m second_algorithm research init task-id --goal "实际研究与交付目标"
python -m second_algorithm research status task-id
python -m second_algorithm research resume task-id
```

job在 `work/jobs/<id>/`，不可重复init覆盖；状态返回真实缺失/过期项与下一步。先核对当前Git及输入，保留并行任务的文件和锁。目标笔记记录实际范围、材料、未知项、权威位置与当前断点。不要因中断重做全局，也不拿历史通过当本次结果。

## 内容生产与检查

遵循研究部和实现标准，更新当前learning关系、Q唯一主讲、原稿和源码。研究与审阅笔记需要实际完成，可由不同Agent检查。全部代码/主题/Q/目标稳定后：

```sh
npm run build:content
python -m second_algorithm course validate
python -m second_algorithm course search Q000001
npm run check
```

CXX可指向已有编译器，ALGORITHM_PYTHON可指向已有Python；本机TEMP/TMP与所有输出D盘，脚本不自动安装编译器。check默认包含Python、登记C++目标、carrier、完整构建、浏览器和SW检查。只有调试确定性部分时可 `node scripts/check-project.mjs --without-browser`，不能把它冒称完整验收。

## 留证与准备

在最终有效输入上登记实际研究与审阅记录：

```sh
python -m second_algorithm research evidence task-id --kind research --path work/task/research.md --summary "实际读取、范围和方法判断" --outcome accepted
python -m second_algorithm research evidence task-id --kind review --path work/task/review.md --summary "实际审阅、修订及边界" --outcome accepted
python -m second_algorithm research verify task-id --compiler c++
python -m second_algorithm research prepare-release task-id
```

prepare-release输出receipt.path。它是准备包，不是已部署。缺研究/审阅、needs-work、输入变化、证据文件变化、验证失败/过期均阻止准备；最新失败不能被last-good掩盖。accepted是Agent对真实工作的记录，不是通过填表自动证明内容质量。

## 发布

```sh
python -m second_algorithm research check-release work/jobs/task-id/releases/<id>.json
npm run deploy -- --release work/jobs/task-id/releases/<id>.json
```

部署检查包、串行锁、构建后再次校验、使用已有Cloudflare授权上传、检查线上匿名边界和SW build身份，成功另存deployment记录，不修改不可变准备包。任何步骤失败停止；若源码/协议/页面改变，回到受影响研究和审阅后重验，不能禁掉门禁。异常退出先查部署是否实际发生与锁所属进程，未知结果不能伪称成功。

CI在push/PR验证当前目标并保存检查产物；workflow_dispatch可指定已有研究job运行验证/发布准备。生产发布仅main、显式publish输入、已有CF secrets及相同门禁，concurrency防同一生产项目重叠。不自动创造研究证据，不提交教材原件/凭据。无云授权时仍保留可复现本地流程并如实报告。
