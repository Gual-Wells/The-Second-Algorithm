# 发布阅读器

入口为 <https://second-algorithm.pages.dev/>，面向 iPhone PWA 与电脑浏览器。采用第二语言同系列蓝银主题、独立通行密钥和固定阅读底栏。设计证据见[载体研究](../research/2026-10-27/carrier-design.md)及[视觉与交互](../web/DESIGN.md)。

## 内容与权威

`carrier/publications.json`只登记阅读入口，不代替研究部和两条工程线。正式版1.0.0登记算法第一章《连续片段：前缀状态与滑动边界》及C++第一章《对象如何传递》，各一篇、各自从第1章编号。原二分三稿和C++七稿两个`trial`集合显式`visibility:hidden`，不读取到部署正文、目录、API、检索或续读入口；研究原件及私人记录保留。上线、文件数、模板数不表示范围完备。

客户端按当前构建的ID/revision索引过滤旧本机目录；SW按当前发布路径白名单拒绝撤下资源，并在激活时清旧目录／正文缓存，离线也不能恢复试读。隐藏集合的笔记、待同步槽与备份在退出后仍保留。已运行的旧页面需载入新版才能切换，不强制重载打断编辑。

未来章按既有协议完成研究、实现和核验后，登记 `kind: chapter`、所属 `track`、独立章号、稳定集合ID及组成稿。章可多稿，两线分别编号；修订保留集合与稿ID，避免笔记和读位分叉。研究过程、缺口与制作管理不进入客户页面。

每稿仍以 `content/` 作者稿、C++源、生成器及摘要清单为权威。构建校验这些字节后生成安全HTML，不重写代码，不打包PDF、教材全文与私有研究目录。公共仓库中的原创稿可公开访问；站点登录保护站内接口与私人阅读状态，不让公开源码变成秘密。

## 阅读与保存

- 算法/C++独立成册，章节册保留检索与滚位，并有明确续读入口。少量篇用页签，多于四篇用带篇数的原生选择器。目录展开当前篇、定位当前节；清空查询保留输入焦点。搜索明确未下载/未取得范围，不把失败说成零结果。
- 正文/代码独立字号；构建时显式C++高亮，代码文字保持不变。复制工具条在本块内吸顶，支持局部横滚、换行、完整 `.cpp` 下载，保留原生选择和缩放。
- 纯净模式纸宽不变。双击非代码、非表格、非控件且无文本选区的阅读区切换，另有显式按钮；隐藏控件不可误触或聚焦。
- 每篇保存锚点、偏移、比例及版本；进度和当前节持续显示，跳转返回独立。一次性定位参数使用后移除，避免刷新重跳旧锚点。慢加载保留旧画面，可取消，迟到请求不能替换新选择。进度不代表掌握率。
- 每集合一份纯文本笔记，本机先存、联网同步。每个活动页面有独立待保存槽，兼容旧版本本机笔记，ACK不能覆盖另一页草稿。冲突保留两稿，另存稿可载入及导出；备份失败不能继续采用其他版本。未同步/未处理草稿阻止退出清空，存在另存稿时提供导出和清除确认。
- 默认粗粒度下载当前集合，可关闭或手动下载；复用已有JSON/C++，不按词或滚动位置请求，不重新生成内容。
- 浏览器本机存储可能被系统回收，不是永久备份。已同步状态在D1，内容与源码在Git；离线不能取得未下载内容。

单一sheet承担设置、目录、源码与笔记；二级返回恢复父页滚位，浏览器返回关闭弹窗。弹窗按VisualViewport适应键盘，不把双指缩放当键盘压缩；依据[MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)与[Chrome对iOS视口行为的说明](https://developer.chrome.com/blog/viewport-resize-behavior)实现，仍需真机验收。设置支持检查内容更新；新版应用通过明确重新载入入口更新，不自动打断编辑。

新页面可能仍由旧SW控制。正文、源码及整组下载先核对实际controller的VERSION；版本不符时启动更新、有界等接管，失败可重试，不把`registration.update()`返回当作接管完成。同版离线和未受控制首访直接继续。检查更新及手动重载不自动刷新笔记。原生锚点的当前节判断同时计入滚动容器padding与标题margin，避免已经跳到第一节而目录仍无定位。

## 服务与隔离

Pages Advanced Mode托管壳及版本化正文，所有路径先过Worker，仅明确的壳/图标公共。独立D1只存单读者凭据、会话、读位、偏好和笔记，正文不入D1。独立HttpOnly/Secure会话90天，不复制其他项目凭据、Cookie或数据库。

SW不缓存 `/auth/`、`/api/`；私有缓存按经服务端验证的owner隔离。仅网络异常可离线回退，401/403不回退。退出清除身份与阅读缓存、处理可见集合的私人状态，隐藏集合的历史笔记保留恢复能力。首次登记默认关闭，管理员临时开窗并配置初始化密钥，用户亲自完成系统验证；现有owner继续使用，不为正式版重新登记。

未新增付费订阅、AI调用、定时轮询、KV写入或音频服务。本次新增一个D1，目前账户共8库，不自动升级计费。按2026-10-27查阅的[官方D1价格](https://developers.cloudflare.com/d1/platform/pricing/)和[上限](https://developers.cloudflare.com/d1/platform/limits/)，免费单库500MB、账户10库/5GB、每日读500万行/写10万行；[Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/)与Workers共享请求额度。账户额度不是本项目独享。正文静态存放、按需同步与粗粒度离线复用控制请求与数据库占用。

## 构建与发布

干净checkout使用Node24、Python3.11+及原有C++工具：

```sh
npm ci
python -m second_algorithm validate
npm run test:carrier
npm run build
npx playwright install chromium
npm run test:browser
npm run test:upgrade
npm run dev
```

Windows新依赖、npm缓存、TEMP/TMP、Wrangler日志及持久化实际放D。不可对共享 `node_modules` 联接安装或删除。本机为保护已有共享运行时，后端依赖装在 `server/node_modules`，构建依赖装在 `scripts/node_modules`，均忽略；新环境通常直接在D盘项目执行 `npm ci`。

`dist/`可重建。正文/下载路径带内容摘要；`buildID`覆盖壳、Worker和正文版本，统一替换安装页与SW标识，未提交代码修改也会刷新。诊断用 `--content-only` 带503 Worker，防止误部署泄露私有路径。

正文JSON摘要包括实际渲染HTML、标题和索引；修改高亮、链接或工具栏会更新JSON路径，不能只用源稿摘要覆盖同一个“不可变”URL。C++和Markdown下载仍按各自权威字节版本复用。Windows整包构建前停止本项目的本地预览，以免文件监视器锁住 `dist/` 阻止原子替换；失败保留前一输出，不清空旧版。浏览器测试使用纯内存身份/API及真实web文件，不联系生产或修改数据库；可用 `ALGORITHM_QA_CHROME` 指定现有浏览器，下载缓存需设置到D盘。

```sh
node scripts/deploy-carrier.mjs
```

脚本使用当前Cloudflare授权，应用独立库增量迁移、上传Pages并核实匿名正文/状态返回401。库ID不是秘密；`ENROLLMENT_KEY`只作为Cloudflare secret配置。支持 `ALGORITHM_WRANGLER` 指定入口。不得将本地QA虚拟通行密钥登记到生产。

首次登记先设置secret并重新部署，使新绑定进入实际部署；再临时将 `auth_control.enrollment_until` 更新为未来毫秒时间戳。用真实 `/auth/enroll/options` 核实初始化密钥有效后才告知用户，不能仅凭status中的开窗状态认定密钥已生效。登记成功自动关闭。不开永久窗口，不复制其他项目owner。备份使用D1只读导出/平台恢复，不用本地测试库覆盖生产。

CI保留原研究/Python/C++检查，执行载体检查、完整构建和浏览器交互回归。测试不证明内容语义完整；浏览器模拟不能代替iPhone安装、触摸和键盘实测。
