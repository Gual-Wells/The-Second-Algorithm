# 第二语言稳定纯净方案迁移完成

2026-10-31北京时间。最终实现提交`39059cb78a61a6dc0c26f78e27e0b1f4982bbac2`；后续提交只保存证据，不改变生产输入。

## 查明与修复

第二语言现行`pure-reader.js::toggle`及v28修复`6b760a43b5fa476f3cd8b8afae0616bc2e2a4bfb`的方案是同一事件里记录真实正文锚点绝对Y、切换布局并立即按同锚点Y差补偿滚动，且不把锚点夹入新视口。来源精确HEAD/blob/SHA和历史核查见`source-audit.md`；没有修改第二语言仓库。

第二算法旧版把纯净交给通用双RAF settle，先重排、隔两帧才补位置。真实基线首帧偏移335.1875px，随后回位；旧终态小于1px的检查漏掉了过程。当前同步切换独立于导航/字号的异步恢复，保留纸宽和既有尾导航空间，在最后补偿前同步完成布局；旧resize延时与layout token作废。明确禁用平滑滚动，保留禁自动锚定与触摸防穿透，不迁移英语专用手势。

首尾按真实原生scroll bounds处理，允许必要的一次自然位移；没有通过新增占位、额外视口夹取或浮动退出按钮伪造稳定。正文、代码、知识、章节范围、标题、分类、日期、Logo、鉴权与服务不变，见`source-preservation.json`的64份文件逐字节核验。

## 实际验证与发布

- `frame-verification.json`：旧版同一新回归失败；当前12次真实触摸切换、120个同步/微任务/RAF样本通过，最大补偿误差0.1875px，纸宽不变；主/超连续四切累计位移0px，144个控件唤出帧位移0px。首尾单独按边界公式核验。
- `technical-verification.json`：当前25项浏览器、15项分层（含逐帧）、6项同步、4组C++目标与正式quality通过。日期31项、启动50项在升级复验后另行通过。第一次HTTP/SW检查的撤回接管10秒断言失败，已暂停首个部署进程、保留原始诊断；同源同断言复验通过，未改Worker或降低门槛，首败具体时序原因未作无证据归因。
- `ci-verification.json`：[精确实现CI 41111397007](https://github.com/Gual-Wells/The-Second-Algorithm/actions/runs/41111397007)完整218项Python、164项Node、读者/逐帧/HTTP-SW/日期/启动及独立正式采用全部通过。`committed-inputs.json`核325项生产输入等于Git字节。
- 新准备包、实际C++报告和成功部署回执均在本目录。`live-verification.json`核主域名6份公共资产SHA与上传物一致、10条私人路径匿名401、原登记保留且窗口关闭。

已部署`https://4c099cef.second-algorithm.pages.dev`，正式主域名`https://second-algorithm.pages.dev`，build为`1f0deebb96b85aaf4f9501642297fe795e82431045b6d06fd9adb5c23753fda8`。逐帧测试是实际Chromium触摸输入，不冒称iPhone真机。

无新章节、费用、账号、数据库或调度安排。按既有流程归档当前提交并重新下载核SHA、更新私人服务快照；实际回执留`.local/services/`，不把凭据、财务、签名链接或私有日志放Git。后续证据提交不重复部署读者。
