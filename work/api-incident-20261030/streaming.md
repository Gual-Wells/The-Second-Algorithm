# 长请求传输核查与修复

在第一轮代理初始化修复后，第二语言Sol/xhigh使用133519输入token，44.489秒HTTP200完成并云端answered；课表Terra/xhigh新解读40.105秒HTTP200，items为空，云端6项日程不变。第二算法两次经单独授权的请求分别在0.875秒、60.521秒被UND_ERR_SOCKET关闭，没有HTTP头；本机超时600秒。两个相同原始请求大小、故意使用无效模型的非生成POST均正常得到官方404/model_not_found，未生成内容。

60.521秒提示长时间等待单体响应可能碰到链路约60秒限制，不能据日志确定具体关闭方；0.875秒是另一次早期关闭，不能伪装成同一固定时限。没有成功max样本，不得归因max。

采用官方Responses SSE传输，不改变模型/档位、整章上下文、schema或store=false。只在完整终态后回推；保存响应头、逐块原始SSE、完整响应、headers/firstEvent/total耗时及usage，HTTP200断流仍停止并保留未知计费状态。旧非流式完整结果只因stream开关改变仍复用，其他输入变更保护不放松。SSE分帧复用MIT eventsource-parser 4.1.3原始模块（固定包完整性和源摘要），不引入EventSource重连或SDK自动重试。

本机9项API专项检查覆盖进程内真实代理、UTF-8拆块/CRLF、早到头部/晚到完整结果、HTTP200断流、未完成终态、旧结果复用及收费保护。前端、章内容和原件未改。后续真实长请求效果以私有完整响应及云端状态为准，单元测试不冒称外网链路验证。

依据：
- https://developers.openai.com/api/docs/guides/streaming-responses
- https://developers.openai.com/api/reference/resources/responses/streaming-events
- https://github.com/rexxars/eventsource-parser
