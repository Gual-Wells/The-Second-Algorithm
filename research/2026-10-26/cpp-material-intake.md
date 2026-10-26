# C++ 教材入库与质量选择

2026-10-26；基于`main@6beb22271ea468f545a70e24c6daf9f599da92ba`，入库前工作树干净。用户先后提供7份文件，要求鉴别、选择并形成可按需研究的本地教材层。完整原件、提取、图像和本机路径全部留在受忽略的D盘本地材料区；本文件只保存采用结论与恢复入口。

## 实际采用

| 书目 | 选择与已完成索引 | 本地材料键 |
|---|---|---|
| Professional C++ 6e | 采用1379页原版式PDF；34章、1426书签、34章后习题区和印刷页映射。另一1970页文件同为6版重排本，不重复采用 | `professional-cpp` |
| The Modern C++ Challenge | 完整EPUB作语义主件，321页PDF作视觉伴随；12章、100题／100份解答、264spine、316PRE及原图资源 | `modern-cpp-challenge` |
| Discovering Modern C++ 2e | 1898页重排PDF；7章、102书签；正文／索引1–816，之后是代码图像备份，1081图像页有反向原页关联 | `discovering-modern-cpp` |
| Cookbook 2e | 2020年9月原版式PDF，751页；12章、712书签、132食谱级条目。第3版未取得，当前采用第2版 | `modern-cpp-cookbook` |

Professional版权页区分纸书9781394193172、ePDF9781394193196、ePub9781394193189，已更新书目，避免将同一格式ISBN当所有版本的通用号。Challenge的EPUB ISBN9781788994026与纸书ISBN9781788993869分别登记。

**排除不是看文件名判断。** Challenge另一EPUB虽然也有题目标题，但第79–100题的22份解答后部截断，原PRE仅205块且有乱码；采用件对应316块并保留完整正文。不以外观相近、目录相同或文件略小直接认定为完整重复件。

## 清洗方式与实际风险

- PDF采用pypdf原始plain及layout两层，默认读取plain。抽样发现PDFium会把行末连字符读成FFFE并粘行；layout又会在某些字体中产生巨大假空格，所以没有把任何一种输出默认为可信源码。原页、必要坐标及预览保留。
- Challenge保留EPUB原spine与XHTML，PRE中BR转真实换行、实体解码、保留缩进。主Agent另用独立XML遍历对照全部316个PRE，未发现文本／换行不一致；这证明转录对应关系，不是代码正确性认证。
- Cookbook仅在读取层按精确前缀移除重复页脚，raw层与原PDF不改。第2版部分C++20示例使用range-v3、cppcoro，内容采用时核查具体接口，不能直接改称标准库。
- Discovering的代码图片备份不是新增教学内容；原电子书转PDF留下失效临时URI，通过附录反向注释得到本地页对应，不执行原链接，也不猜未知目标。
- 不自动拼接英文断词、改运算符或修原书勘误。跨页代码、内联标识符被排版拆行、公式与表格在具体使用时回到视觉主件／作者源码核对。

## 实际验证

7份用户原件在处理前后均核对大小、mtime及SHA256，一致；采用副本摘要对应原件。新材料全部在D盘，包均受Git忽略，没有上传完整教材或建立新后台服务。

全页记录连续：Professional1379、Discovering1898、Cookbook751；Challenge题号恰为1–100，题干和解答文件及PDF起页均存在。空文字页另行解释：Professional31页为封面／排版空白；Discovering主要为空文字的代码图像附录；Cookbook8页为空白或只有页脚，未将它们误标为丢页。

实际运行9项读取入口：Professional印刷页与限量搜索；Challenge题15解答与题100题干；Discovering章节、搜索、页130读取；Cookbook配方目录与一个真实配方范围。查询结果包含返回范围／截断信息或准确题目身份。

主Agent视检Professional物理364、Challenge43、Discovering130及对应图像982、Cookbook130。另一路独立视检Professional550（习题）、1013（变参模板）、1072（条件变量），未发现阻断性提取错误；已发现layout假空格和内联标识符拆行等边界继续保留。各包另有自己的版权、目录及代表页抽检记录。

本地证据在`.local/material-intake-20261026-cpp/`：`originals-baseline.json`、`root-verification.json`、`reader-checks.json`、`challenge-independent-check.json`、`professional-independent-qa.json`；不进入Git。原件与派生物约150MB，现有依赖完成，无新增持续费用。

## 恢复工作

先读`docs/LOCAL_MATERIALS.md`，按`catalog/books.json`的`local_material_key`找到`.local/library/<键>/README.md`、`manifest.json`与读取脚本。保持各书实际版次、原物理页或EPUB成员定位；重排页不换算成纸书页，练习区、配方、PRE和独立题目不混计。

材料现在可支持后续按范围阅读、题目归并和参考代码研究，尚未逐页语义精读、将所有练习归类或编译全书代码。C++语言章尚未创作；先依来源池与教材研究闭合范围，再生成内容，不以入库完成替代章节完成。
