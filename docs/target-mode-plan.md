# 目标模式计划

> 执行期目标源。详细过程保留在 Git 历史；本文件只保留当前约束、冻结协议、验证基线、活跃队列和少量追溯锚点。

## 目标与边界

- PPT 插件作为科研绘图中枢：Rough 原生图形、ZLK 自动绘图、Zotero 论文图像与配色库。
- Rough 原生图形和 ZLK 自动绘图最终必须是 PPT 原生可编辑对象；禁止 PNG、SVG、Canvas 截图作为这些链路的最终对象。
- Zotero 论文参考图像与白名单科研绘图网站导出的受校验 SVG 是相互隔离的外部图像例外；科研 SVG 例外不得扩展到 Rough 或 ZLK 自动绘图。
- 所有界面使用中文母语表达；必要英文只保留官方名称或缩写，并与中文语义组合。意义不明确的按钮、标题、徽标和命令必须有中文悬浮说明。
- Ribbon 放高频入口；右侧任务窗格保留完整参数、素材与配色管理和兜底操作。
- 优先优化 UI 外观、布局、发现性、首屏密度、图标一致性和状态可读性；阻塞、危险操作或兼容断裂可插队。
- 插件整体保留“插入 / 重绘 / 风格 / 数据”主路径；插入和重绘由 Ribbon 执行，右侧简洁模式只显示当前选区状态或单个参数/数据工作区，完整模式保留全部专业面板。
- 右侧任务窗格命令和导航使用纯文字；仅原生形状预览、素材/论文图缩略图、配色色块和状态标记保留视觉内容。
- 未明确要求时不安装、不部署、不关闭或重启 PowerPoint/VS Code、不打包。

## 执行规则

- 每批开始先读 `docs/PROJECT_CONSTRAINTS.md`、本文件、`git status --short --branch` 和最近提交。
- 脏文件先判定归属；禁止覆盖、回滚或提交用户改动。
- 涉及 ZLK 外部兼容时，只读核对 `D:\GitRepo\MCP\zlk-cluster-orchestrator`；每个实现批次开始前必须重新读取 `D:\GitRepo\my_img_manager` 的状态、最近提交和相关协议。禁止修改外部仓或追随未冻结协议。
- 新故障先写入本计划或验证清单，再修代码；修复后同步验证相邻旧合同。
- 每个小批次只做一个同风险面改动并独立提交；单个小批次不运行测试、构建或打包。
- 每完成连续 5 个小批次，统一运行完整 `npm test` 和 UI 构建；全部通过后再统一打包，供用户手动安装检查。
- 五批次统一验证失败时先修复并重新完整验证，禁止产出或交付已知失败的安装包；不自动安装，也不关闭或重启 PowerPoint。
- 人工清理候选仅限需要完整删除的文件或目录；保留文件内的行、段落、函数、类、配置项等局部内容由 Codex 直接删除或修改，不额外请求人工确认，但禁止清空整个文件或留下无意义空壳。
- UI 批次必须保持中文、tooltip、危险操作不直接执行，以及非顶栏内容不使用 sticky/fixed 遮挡滚动。
- 修改 `src/RoughPptAddin/ui/**` 后，在每 5 个小批次的统一验证节点运行 `npm run build:ui`，避免旧输出继续加载。
- 提交信息只描述已验证能力，不写未验证承诺。
- 禁止启用多角色或多智能体后台流程。

### 计划维护

- 每完成 5 个批次，或文件超过约 120 行 / 12KB，执行一次独立压缩提交。
- 保留目标边界、执行规则、冻结协议、验证基线、活跃队列、最近 8 个锚点和少量关键里程碑。
- 删除可由 Git 历史追溯的旧过程、重复验证文本和过期状态。

## 冻结协议

### ZLK Cluster

- discovery：`%LOCALAPPDATA%\RoughPptAddin\automation.json`、`automation.token`。
- endpoint：`GET /health`、`POST /api/zlk-cluster/plot`，仅允许 `127.0.0.1` / `localhost`。
- token header：`Authorization: Bearer`、`X-Rough-Ppt-Token`、`X-RoughPpt-Automation-Token`。
- `schemaVersion=1`；未知字段忽略，未来只接受 optional additive extensions。
- `target.presentationPath` 为空则新建；已打开则复用追加；存在未打开则打开追加；不存在且 `createIfMissing=true` 则新建保存；不得关闭已有 PPT 或退出 PowerPoint。
- 结果必须经 `zlk-cluster-result-importer.mjs` 归一化，再用 PPT 原生 shape、line、text、table 绘制。
- 默认优先聚合结果：`zlk_cluster/results/statistics.json`、`paper/tables/zlk_results_table.csv`；单 seed/raw result 仅用于发现、追踪和审计。
- Markdown 摘要只生成 PPT 原生文本表格摘要页；存在同名 JSON 时优先 JSON。
- Agent runtime cache、事件 journal、Worker queue 属于 Agent 全局态；PPT 不扫描 `ZLK_AGENT_STATE_DIR`。
- PPT 绘图审计、归档 manifest、删除墓碑和文件传输状态必须落在当前项目 `zlk_cluster/`。
- UI 的 pre-key 快路径、trace cache、summary 单飞和 operation 刷新作用域不得改变绘图证据策略或请求语义。

### Zotero Image Saver

- 完整协议源：`docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md`；PPT 只读外部 SQLite，禁止读取 `zotero.sqlite`。
- 唯一数据库固定为 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`；`library.json` 只能确认该路径，任何其它路径均 fallback 到固定路径。
- locator：`schemaVersion=1`、`databaseSchemaVersion=2`、`producer="zotero-pdf-image-saver"`、固定 `databasePath`、`updatedAt` ISO8601。
- 表优先级：`images` -> `paper_images` -> 兼容候选表；只读活动行，并读取 `palette_json` 与 `image_palette_swatches`。
- 可选元数据列和 Zotero 全局图库只扩展同一数据库；禁止另建图库数据库或图片 HTTP endpoint。
- bridge：`POST http://127.0.0.1:23119/pdf-image-saver/bridge`；token/status 从同一数据库的 `bridge_state` 读取。
- 允许命令：`status/getStatus/openPdfByImageId/selectParentItemByImageId/selectPdfAttachmentByImageId`。
- bridge 不可用、token 为空或状态为 disabled/shutdown/unregistered/invalid-shared-db-path 时直接 fallback。
- 返回 `Requested Zotero URI invalid` 时禁止 ShellExecute，只复制溯源 ID。
- 本机固定 SQLite 与 locator 已初始化；首次确认保存论文图像后，两端继续读取同一数据库。

## 验证基线

- 轻量：`node scripts/validate-ui-contract.mjs`、`node scripts/validate-taskpane-function-icons.mjs`、`node scripts/validate-encoding.mjs`、`node --check src/RoughPptAddin/ui/app.mjs`。
- 外部协议：`node scripts/validate-automation-contract.mjs`、`node scripts/validate-zotero-image-library.mjs`、`node scripts/validate-external-plugin-compat.mjs`。
- 全量：`npm test`。
- 构建：`npm run build:ui`；Ribbon 图标运行时验证为 `powershell -ExecutionPolicy Bypass -File scripts/verify-ribbon-icons.ps1`；签名 Release 构建按需运行 `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`。
- 打包：仅用户明确要求时运行 `npm run package`；只打包，不安装。
- 提交前：`git diff --check`、`git status --short`。

## 功能归属

| 区域 | 功能类型 | 当前功能 |
| --- | --- | --- |
| PowerPoint Ribbon | 高频、直接执行、无需大面积预览 | 形状图库、选区下一步、转换、重绘、检查、选择载体、风格/填充/线条/颜色快捷、保存素材、默认特征块插入、论文套件 |
| 右侧任务窗格 | 参数配置、预览、搜索、资源管理、大空间工作流 | 风格精确参数和模板管理、科研绘图、论文预设浏览、Zotero 图像与配色、特征块参数和方向编辑、素材与快速插入管理、完整形状浏览 |
| Ribbon 到右侧 | 仅作工作区定位，不重复提供第二套执行按钮 | 功能搜索、模板管理、素材管理、特征块参数、快速插入管理 |

右侧任务窗格不得再次显示已经由 Ribbon 直接执行的高频命令。保留隐藏接线仅用于兼容与回归测试，不构成可见入口。

## 活跃队列

1. B525（已完成）：科研绘图独立窗口支持按钮和 F11 真全屏，Esc 或再次触发恢复原窗口。
2. B526（已完成）：补齐线性、对数、平方根、对称对数坐标，范围、刻度格式和轴反转。
3. B527（已完成）：补齐参考线、参考区间、误差带、注释文字等论文标注能力。
4. B528（已完成）：补齐阶梯图、密度图、条带图、极坐标、分面与更多统计图形。
5. B529（待执行）：补齐数据筛选、配置持久化、SVG 下载与使用说明；完成五批次统一测试、构建和打包。

### 当前科研绘图增强批次

- 目标：使本地科研绘图工作台可全屏，并扩展为覆盖常见论文统计图、坐标控制、标注、分面、数据处理和可复用配置的完整工作流。
- 范围：独立 WinForms/WebView2 工作台、Vega-Lite 规格生成、CSV/TSV 数据处理、同源 SVG 预览/校验/插入、使用说明和合同。
- 排除：不复制第三方仓库代码；不引入 GPL 代码或在线运行时；不改变 Rough/ZLK 原生对象链路；外部网站仍仅由用户显式点击打开。
- 保护区：PowerPoint、VS Code 不自动关闭或重启；单批不测试、构建、打包；B525-B529 完成后统一验证与打包。
- 开源依据：RAWGraphs 的本地表格到矢量图工作流与可扩展图表选择；Datawrapper 的发布级响应式图表工作流；Vega Editor 的声明式规格和示例驱动编辑；Plotly.js 的统计、科学与多类型图表覆盖；Veusz 的误差线、参考标注、函数/分布、极坐标、多轴和数据处理能力。仅借鉴能力边界与交互结构，继续使用仓内 BSD-3-Clause Vega 运行时自行实现。
- B525 影响区：`ResearchChartStudioWindow`、工作台 HTML/JS、桥接合同和科研绘图验证合同；保留 SVG 安全校验及现有所有入口。
- B525 回归检查：全屏消息仅作用于科研绘图窗口；进入与退出状态回传 UI；F11、Esc、按钮一致；窗口隐藏再打开不丢失可恢复边界。
- B525 验证：JS/合同语法、差异和全屏消息静态断言通过；按五批次协议未运行测试、构建或打包。未决风险为后续统一构建后需在真实 PowerPoint 多显示器环境验证任务栏覆盖和窗口恢复。
- B525 提交记录：`91c47d3 feat: add research chart fullscreen mode`。
- B526 验证：坐标控件、尺度规格、单边范围、范围顺序错误提示、刻度格式和重置/实时重绘接线静态检查通过；按五批次协议未运行测试、构建或打包。
- B526 提交记录：`a1e4d58 feat: add scientific axis controls`。
- B527 验证：X/Y 参考线、X/Y 参考区间、线图误差带、定位注释及范围错误提示静态接线通过；按五批次协议未运行测试、构建或打包。
- B527 提交记录：`1e8edaf feat: add research chart annotations`。
- B528 验证：阶梯、密度、条带、回归、极坐标五类图形及通用分面规格静态接线通过，图表入口增至 17 种；按五批次协议未运行测试、构建或打包。
- B528 提交记录：`bb22683 feat: expand scientific chart catalog`。

## 近期锚点

- B484-B485：安装入口覆盖 PowerPoint、.NET Framework 4.8、WebView2、VSTO 检测与补齐；彻底卸载清除插件资源但保留 Zotero 共享库和系统运行时。
- B482-B483：使用说明改为独立非模态窗口，支持边看边操作；完整 UI、Release、Ribbon 与三种安装产物验证通过。
- B480-B481：箭头参数合同、三角形长宽入口、默认值、短线限制和实时重绘说明完成同步。
- B478-B479：Ribbon 快捷风格实时重绘、箭头异常放大和透明 Ribbon 图标运行时误报均已修正并验证。

## 关键里程碑

- B467-B474：Ribbon 收敛为 5 组唯一入口；安装合同覆盖当前用户、同版本覆盖和 ICE61/ICE91 定向抑制。
- B452-B466：离线图文说明、右上角学习入口、返回状态、无渐变、窄窗和 PowerPoint 2013 以上兼容合同建立。
- B411-B446：任务窗格配色、按钮尺寸、按选区显示、功能边界和 SimpleExperiment 主题完成统一。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
