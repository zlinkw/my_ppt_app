# Architecture

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

PowerPoint 加载 VSTO 后启动本机自动绘图服务，只监听 `127.0.0.1`。发现文件写入 `%LOCALAPPDATA%\RoughPptAddin\automation.json`，令牌写入 `%LOCALAPPDATA%\RoughPptAddin\automation.token`，外部请求必须携带 `X-Rough-Ppt-Token`。

`POST /api/zlk-cluster/plot` 只接收轻量绘图请求。C# 读取请求指定的结果文件后投递给 WebView，WebView 复用 `zlk-cluster-result-importer.mjs` 完成格式探测、字段归一化和图表推荐，再通过 `insertZlkChart` host message 交回 C#。`PptZlkChartRenderer` 使用 PowerPoint 原生 `Shape`、`Line`、`Textbox` 和 `Group` 绘制结果，禁止把 ZLK 图表做成图片、SVG 或 Canvas 截图。

当外部 ZLK 请求只提供 Markdown 摘要且没有同名 JSON 时，`MarkdownSummary` 会被作为 `markdown_summary` 轻量输入处理，仅生成 PPT 原生文本表格摘要页，不作为数值图。数值图仍优先使用 `statistics.json`、论文表格 CSV、case-level JSON/CSV 等机器可读结果。

ZLK runtime 的 Agent cache、事件 journal 和 Worker command queue 属于 Agent runtime state；文件传输状态、归档 manifest、删除墓碑和 PPT 绘图审计请求属于项目态，必须在当前项目 `zlk_cluster/` 内落盘。PPT 插件只读取请求内显式传入的项目内轻量文件，不从 `ZLK_AGENT_STATE_DIR` 扫描结果或审计文件。

ZLK 结果区前端可缓存 trace view model 的统计摘要以降低重复渲染成本，但 PPT 绘图入口仍必须默认指向 `zlk_cluster/results/statistics.json` 或论文表格 CSV。单条 trace 的原始 `resultPath` 不应成为默认 PPT 数值图来源。

外部 ZLK WebView 可在 section pre-key 未变时跳过稳定签名计算，以减少高频状态刷新开销；该优化不得影响 PPT 绘图请求、配置草稿、强制刷新或结果证据来源策略。

自动绘图 target 只追加页面：无 `presentationPath` 时新建 PPT；目标 PPT 已打开时复用并追加页；目标存在但未打开时打开并追加页；目标不存在且 `createIfMissing=true` 时新建并保存。服务不得关闭已有 PPT，也不得退出 PowerPoint。

## Non-goals

- The visible rough line is not a PowerPoint `msoLine`.
- The visible rough arrow is not a native Connector.
- SVG, PNG, Canvas captures, and external images are never final inserted objects.

## User Assets

Saved user assets are stored as native `.pptx` templates plus metadata JSON. Optional PNG thumbnails are generated only for the task pane library preview; thumbnails are never inserted into slides as final content.
