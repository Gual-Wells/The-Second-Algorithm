# 浏览器验收脚本可移植性：独立短审阅

基于 `d376d48ee1a72591d914084b12a255d59310312d` 后的两处最小变动。只读比较确认：`check-chapter-calendar.cjs` 与 `check-startup-fidelity.cjs` 各只改一行 Chromium 启动配置，UI、路由、fixture、断言和验收数量均未改变。

旧逻辑在未设置 `ALGORITHM_QA_CHROME` 时硬用本机Windows绝对路径，无法适用于Linux runner。新逻辑保持 `headless:true`，仅在该环境变量有值时传 `executablePath`，否则省略此项，让Playwright查找其管理的Chromium。显式路径仍被尊重，不会在路径配置错误时悄悄改用另一浏览器。工作流已有 `PLAYWRIGHT_BROWSERS_PATH` 和 `playwright install --with-deps chromium`，与这一默认查找方式匹配；没有新增依赖、下载流程或产品运行行为。

实读本轮本地收据并重新解析检查：

| 证据 | 结果 | SHA-256 |
| --- | --- | --- |
| `qa/calendar-portable.json` | 31项通过，错误0 | `5b01a9cb44718d81de519b66742cb3784999fd1e323318173c3978b237310dc3` |
| `qa/startup-portable.json` | 50项通过，错误0 | `32ee93a5dc7826134bae7aa94ae616b06362bae1972070ac34868e636e18ddd8` |

两个脚本的Node语法与diff检查通过。当前源码SHA-256分别为：

- `scripts/check-chapter-calendar.cjs`：`91cdb9ba7b4d547365988d127c3cdb36f377d91365606b7b435014d336a7ce98`
- `scripts/check-startup-fidelity.cjs`：`6fdb2da9ee4d72b8cb54e4d0b25bc0532408f93c21c6ad71bffedcb8ec7bca20`

本地通过证明这次启动配置调整没有破坏所查日期/启动行为，**不证明Linux runner的默认managed-browser分支已经实际通过**。新的远端CI和正式发布仍待根代理取得结果；没有把前次CI、旧本地收据、实际iPhone或系统Passkey测试冒充本轮远端验证。本短审阅到此冻结，不修改已经绑定的两份独立报告。
