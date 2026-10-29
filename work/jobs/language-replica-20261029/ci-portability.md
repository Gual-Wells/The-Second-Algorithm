# 最后一处测试环境假设修正

第二次实际Linux CI `40890597054`（job`123506016078`）已通过198项Python、118项Node、4个C++目标、21项浏览器和真实HTTP/SW，然后因`check-chapter-calendar.cjs`在无ALGORITHM_QA_CHROME时使用个人Windows路径而无法启动。startup同有该旧默认；它们在本机显式Chrome下通过，不能据此声称默认Linux分支也验证过。失败详情保留`ci-second-failure.json`，不归为产品路由仍失败。

只移除两处个人路径：显式配置时传executablePath，否则不传该参数，由已安装的Playwright受管浏览器解析。没有安装浏览器、改产品、放宽判据或增加等待。显式现有Chrome重新实跑日期31与启动50，收据`qa/calendar-portable.json`和`qa/startup-portable.json`；新Linux CI负责实际默认分支验证。

本改动属于测试可移植性，DOM/CSS、Logo、问答边界、已修读位、教材及私人状态均不变。新的审阅、验证、准备与发布仍绑定当前输入；前两次成功上线、两次CI失败和真实旧/新诊断不覆盖，不以替换结果文件伪造连续通过。
