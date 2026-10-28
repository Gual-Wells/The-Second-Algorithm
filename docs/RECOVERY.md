# 工作恢复

先核对Git分支/HEAD/dirty、AGENTS、CONTENT_PIPELINE与RESEARCH_FACILITIES，再执行 `python -m second_algorithm research status`，选当前job执行resume。对具有study的任务另执行 `research study-status <job>`。恢复真实目标、当前输入、材料/范围/合同/作者/知识/源码和缺口，不从旧聊天、旧题单或accepted日志推断完成。

首章恢复先确认出版/章节登记是明确的有效空集合；文件缺失或状态矛盾不是空库。coordinationContext=no-prior-chapters表示已核前沿没有其他正式章，alignment与scope-review仍保留真实空说明，所有其他研究与内容要求照常。前沿变动或状态错误先处理，不沿用旧空上下文；本章登记排除自身，真实其他章到来须重新协同。

当前硬协议是大思想领域为章、前置思想理论、正式节为题型；手写与真实标准设施、必要C++和每节1–5题共同承载。2026-10-28曾撤回清零（withdraw-all-20261028），随后第一章“二分”按新流程独立研究并建立内容；当前任务为first-chapter-20261028。先核其study-status、当前章合同与质量，再查实际部署收据，不把准备包当上线。教材和原题证据保留，旧稿只在Git历史中恢复，不默认重用；历史job/旧采用与候选模式不构成现行内容或章界。用`course chapters`和`course quality`恢复真实状态；本章之外无其他正式章时协同仍为空，下一章则须实际协同第一章。

权威关系为catalog/chapters.json、catalog/learning.json和schema2出版登记。正文/代码/独立知识源各自唯一；知识内部身份不外显，后续术语浮窗复用，不把C++去重扩成算法跨章内容只能讲一次。旧双线、trial、原稿和cases/patterns是素材，不是当前范围或兼容义务。

输入改变使status指出stale；按实际影响重做研究/审阅和验证，不机械重填accepted或只换hash。保留失败、last-good和具体日志；未取得材料、未分析分支与尚未编纂分别记录。

## 恢复前置研究

读取 `work/jobs/<job>/study/study.json` 的chapter、active、history和lastHandoff，再读ledger/dossier/scope及有效阶段记录。当前研究顺序为材料全景/出版状态盘点→独立范围提案(scope)→已有正式章协同确定初始范围(alignment)→动态提取→首轮综合→已有章作为资料再协同的范围复审→修订范围再研究。阶段表示依赖，反复研究的结论、增量材料、负结果、矛盾和复审跟进在其引用笔记中恢复；不要只看阶段名称就声称研究完成。

恢复范围时先看独立scope快照，再看alignment的chapterCoordination及范围变化，最后看本轮scope-review的再次协同与资料。不能用后来修改的scope.json替代最初提案，也不能因已有章讲过便删必要算法内容。重合和近邻允许；核大领域独立性与全局广度，防止过拟合关系或过严避邻。无已有正式章的空记录也是有效研究事实，不能把隐藏/撤回内容补作正式比较。

当前study、阶段收据与handoff为schemaVersion2，包含独立提案及alignment。旧六阶段记录保留历史，不能补一个字段或空比较就追认为已完成协同；按真实工作建立当前研究并明确复用依据。普通job和动态材料文件仍按各自现行模型，不整体改版本号。

study-status返回phase、nextPhase、changedFiles、errors、readyForHandoff等。对在研或尚未实际出版的交接逐项读变化：资料变化后重新综合，范围变化后先复审再综合，研究基座或其他章节前沿变化后恢复overview；可复用未受影响的研究，但说明真实影响。新材料不擦除历史初始范围。

动态JSON编辑中断或当前材料关系不合法时，状态仍保留已核实的chapter、阶段、历史数量、旧交接指针与归档范围，显示currentEditError并禁止交接。先修复当前编辑，再按实际变化继续；不能把归档范围误认为尚未修好的当前范围，也不要为了恢复显示删除历史。

需要重开较早阶段时用checkpoint提交新记录；active后缀失效而history/快照保留。不得原位修改snapshots或handoffs以恢复绿色状态，也不能用旧收据充当新研究。收据固定源笔记字节，换行规范化也会改变身份；新修正写入动态文件并生成新收据。

最终充分研究完成后seal-handoff；作者合同的researchHandoff指向这份不可变交接。check-handoff可核当前性与依赖，course quality还核章节采用一致性；两者不代替语义研究和内容审阅。新checkpoint或新交接会替代旧交接，已准备的发布包也应重新检查。空站维护不编造章节研究来过门禁。

对于真正已出版的旧章，严格study-status/check-handoff可能只因新来源或后续章节而提示基座变化。先看course quality是否能核实该章精确交接的成功部署证据并保留历史基座，不要因此重新跑全部旧研究或擅自改旧收据。本章档案/笔记/范围改变仍不豁免；没有发布证据的新交接严格走当前基座。若新证据实际纠正旧算法、标准知识或题型范围，定点回到研究和当前审阅，不以历史采用自动忽略。

任务锁 `.local/research-<id>.lock` 和部署锁 `.local/deploy.lock`出现时先核pid与真实进程，不强杀其他任务或删活锁。确认进程结束才清本任务残留。部署失败先查平台当前版本与匿名边界，分清未上传、已上传待核与完整成功。

环境与命令见 TASK_EXECUTION/CONTENT_MODEL。新增数据、依赖、缓存、临时文件、日志、QA和构建实际存D；不公开原书/凭据，不移动活动数据库，不为整理目录破坏共享运行时。脚本当前输出才是本次检查，模拟浏览器不能冒称iPhone真机。
