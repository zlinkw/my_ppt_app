# Architecture

All user-visible pages and dialogs are Chinese-first. Official product names, protocol IDs and file paths may remain in their required form, but surrounding labels, tooltips, states and errors use native Chinese wording.

## Object Model

Each inserted rough object is a PowerPoint `Group`.

- Visible rough strokes: one or more PowerPoint `Freeform` shapes.
- Interaction shell: one invisible PowerPoint `Freeform` used as the stable PowerPoint selection, alignment, and resize boundary.
- Metadata: PowerPoint Shape Tags on the group and shell.

This preserves common PowerPoint operations such as drag, align, resize, rotate, copy, z-order, and grouping while prioritizing complete Rough.js visual fidelity.

## Data Flow

1. User selects a shape in the WebView2 insert window.
2. WebView2 calls Rough.js and returns drawable operations.
3. C# normalizes operations into point paths.
4. PowerPoint COM creates Freeform shapes.
5. The add-in groups Freeforms with the transparent interaction shell.
6. Metadata is written to Shape Tags.
7. `AfterShapeSizeChange` regenerates visible Freeforms from metadata and current bounds.

## ZLK Cluster Automation

PowerPoint 加载 VSTO 后启动本机自动绘图服务，只监听 `127.0.0.1`。发现文件写入 `%LOCALAPPDATA%\RoughPptAddin\automation.json`，令牌写入 `%LOCALAPPDATA%\RoughPptAddin\automation.token`，外部请求可同时携带冻结的三种 token header。discovery 公开 `schemaVersion`、服务和进程身份、固定路径及 token header 清单；`/health` 公开 `ready`、`busy`、服务和进程身份及 additive capabilities，便于 SimpleExperiment 区分未启动、忙碌和协议不兼容。

`POST /api/zlk-cluster/plot` 只接收轻量绘图请求。C# 读取请求指定的结果文件后投递给 WebView，WebView 复用 `zlk-cluster-result-importer.mjs` 完成格式探测、字段归一化和图表推荐，再通过 `insertZlkChart` host message 交回 C#。`PptZlkChartRenderer` 使用 PowerPoint 原生 `Shape`、`Line`、`Textbox` 和 `Group` 绘制结果，禁止把 ZLK 图表做成图片、SVG 或 Canvas 截图。

服务按 `requestId` 缓存最近 32 个成功响应。SimpleExperiment 在响应丢失后用相同请求内容和 `requestId` 重试时直接得到 `replayed=true` 的原结果，不会重复创建幻灯片；同一 `requestId` 对应不同内容时返回中文 `409`。正在执行的相同请求提示稍后重试，其它并发请求仍快速返回忙碌状态，不进入 PowerPoint UI 队列。

当外部 ZLK 请求只提供 Markdown 摘要且没有同名 JSON 时，`MarkdownSummary` 会被作为 `markdown_summary` 轻量输入处理，仅生成 PPT 原生文本表格摘要页，不作为数值图。数值图仍优先使用 `statistics.json`、论文表格 CSV、case-level JSON/CSV 等机器可读结果。

ZLK runtime 的 Agent cache、事件 journal 和 Worker command queue 属于 Agent runtime state；文件传输状态、归档 manifest、删除墓碑和 PPT 绘图审计请求属于项目态，必须在当前项目 `zlk_cluster/` 内落盘。PPT 插件只读取请求内显式传入的项目内轻量文件，不从 `ZLK_AGENT_STATE_DIR` 扫描结果或审计文件。

ZLK 结果区前端可缓存 trace view model 的统计摘要以降低重复渲染成本，但 PPT 绘图入口仍必须默认指向 `zlk_cluster/results/statistics.json` 或论文表格 CSV。单条 trace 的原始 `resultPath` 不应成为默认 PPT 数值图来源。

外部 ZLK WebView 可在 section pre-key 未变时跳过稳定签名计算，以减少高频状态刷新开销；该优化不得影响 PPT 绘图请求、配置草稿、强制刷新或结果证据来源策略。

自动绘图 target 只追加页面：无 `presentationPath` 时新建 PPT；目标 PPT 已打开时复用并追加页；目标存在但未打开时打开并追加页；目标不存在且 `createIfMissing=true` 时新建并保存。服务不得关闭已有 PPT，也不得退出 PowerPoint。

## Non-goals

- The visible rough line is not a PowerPoint `msoLine`.
- The visible rough arrow is not a native Connector.
- Rough 图形和 ZLK 自动绘图不使用 SVG、PNG、Canvas 截图或外部图片作为最终对象。

## 科研绘图网站与 SVG

任务窗格的科研绘图主入口向宿主发送固定网站 ID。`ResearchChartStudioService` 只把 `rawgraphs`、`datawrapper`、`plotly` 和 `vega` 映射到四个固定 HTTPS 地址，并通过系统默认浏览器打开；WebView 不接收也不导航任意外部 URL。

用户从网站导出 SVG 后，由宿主文件选择器显式选择本地文件。服务限制文件为 4 MB UTF-8 SVG，使用禁止 DTD 和外部解析器的 XML 设置，拒绝脚本、事件处理器、动画、嵌入图像、处理指令、外部 URL 和外部样式资源。通过校验的字节固定到 `%LOCALAPPDATA%\RoughPptAddin\ResearchSvg\current.svg`，WebView 以该内容创建只读 Blob 预览；插入前宿主再次校验 SHA256 和 SVG 结构，确保预览与 PPT 使用同一份内容。

PowerPoint 2016 及更高版本通过 `ResearchChartStudioService` 的独立 `Shapes.AddPicture` 例外将 SVG 等比居中插入当前幻灯片。PowerPoint 2013 继续受插件其它功能支持，但科研 SVG 入口明确提示改用旧任务窗格的 ZLK 原生绘图链路。该例外不得进入 Rough、ZLK 自动绘图、用户素材或配色链路。

## User Assets

Saved user assets are stored as native `.pptx` templates plus metadata JSON. Optional PNG thumbnails are generated only for the task pane library preview; thumbnails are never inserted into slides as final content.

## Zotero 论文图像与配色

Zotero 论文图像是显式参考图像例外，允许以 `msoPicture` 插入；该例外仅限 `ZoteroImageLibraryService`，不得扩展到 Rough 图形或 ZLK 图表。PPT 只读 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`，插图读取 `image_blob`，不读取 Zotero 内部 `zotero.sqlite` 及其旁车文件。Zotero 关闭时仍可预览、搜索、取色和插入已保存图像。

完整图库界面唯一归 Zotero 所有。PPT 的“打开论文图片库”只复用 `%TEMP%\pdf-image-saver\paper-image-library-view\paper-image-library.html`。bridge 只用于打开来源 PDF 或定位条目，以及在完整图库入口发送受 token 保护的 `refreshLibrary`；PPT 不发送删除、分享或导入命令，也不复制或重实现完整图库界面。
