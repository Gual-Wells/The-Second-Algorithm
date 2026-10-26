# 本地 PDF 预处理小工具

这两个脚本保留已实际使用的字体修正与页级几何导出方法，供教材重新入库时恢复。它们不会修改输入 PDF、执行 OCR 或生成教材讲解，也不能保证任意 PDF 的文本无损还原。

需要现有 Python、`pdfplumber`（及其 `pdfminer.six` 依赖）和 `pypdf`。重型 PDF 依赖不进入项目默认 CI；这些脚本只在本地教材任务中运行。输入、输出均由参数指定，输出应放在 D 盘项目的 `.local/` 中，正文、预览与审计文件都不上传 Git。

## 使用

在仓库根目录，将占位路径替换为本地采用文件。省略 `--start/--end` 会处理全书；已存在的输出默认拒绝覆盖。

```text
python tools/materials/export_pdf_pages.py <输入PDF> <D盘本地输出目录> --document-id volume-1 --start 178 --end 178
```

输出为：

- `pages.jsonl.gz`：每页的标准解析文本、字形及字体、原字形坐标与文字矩阵、按基线重组的候选行、图片／矢量区域边界。旋转文字会提示风险；候选行不等于可靠阅读顺序。
- `sections.json`：原 PDF 书签与候选物理页范围；无法解析的目录目标另列。不会凭内容猜目录或印刷页码。
- `export.json`：输入摘要、实际页范围、解码模式与字形计数。不保存输入绝对路径。
- 启用修正时的 `glyph-audit.json`：字形名、原解析值、采用值、修正依据与未识别页。

## CP4 的恢复方法

当前采用的两个独立数字卷有错误的 ToUnicode 映射：直接提取会损坏运算符和连字。只有核实这种问题后，才启用下面的修正模式；不要把它作为所有 PDF 的默认规则。

```text
python tools/materials/export_pdf_pages.py <Book1采用PDF> <本地cp4-rebuilt/book1-raw> --document-id cp4-book-1
python tools/materials/export_pdf_pages.py <Book1采用PDF> <本地cp4-rebuilt/book1-repaired> --document-id cp4-book-1 --prefer-glyph-names
python tools/materials/export_pdf_pages.py <Book2采用PDF> <本地cp4-rebuilt/book2-repaired> --document-id cp4-book-2 --prefer-glyph-names
```

先保留标准提取，再另存修正层；Book 2若需完整复现同样先生成标准层。修正使用 PDF 自身明确的 Encoding Differences 字形名称，优先 Adobe 映射，并为少量已核实 TeX 名称保留显式映射和审计。它只处理简单字体；未知名称保留 `�` 和原字形名，不猜语义，不覆盖原 PDF。补丁仅在显式上下文内生效，依赖 pdfminer 内部接口，不能并发或嵌套使用。

Book 1应为329物理页、Book 2为352物理页；Book 2物理55、258页特殊横向大括号组件仍需回原图。定位使用卷号＋物理页；跨卷印刷页号不唯一。工具不实现该书专用印刷页映射、代码分组或图文关系判定，因而是可恢复的核心方法，而非旧私有中间文件的逐字节重建器。

公式分数／上下标／矩阵、表格和跨栏关系必须结合二维坐标或原页；导出代码可能是片段、伪码或含排版引号，未经编译和人工核对。图形只保留区域元数据，完整视觉内容仍由原 PDF 承担。对 EPI 图像主件运行本工具不会产生 OCR，已有 OCR 伴随件也仍只供定位，不能因此变成可信代码。

2026-10-26已在现有运行时做真实小范围复核：CP4 Book 1物理178页的 `≤` 字形修正与几何读取、Book 2物理55页未识别括号的显式记录。没有据此声明全书或任意 PDF 都已校对。
