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

1. B525-B534（已完成）：科研绘图全屏、坐标、标注、筛选、配置、SVG 下载和 28 种图表均已交付并完成两轮五批次统一验证与打包。
2. B535（已完成）：为图表入口增加中文搜索和类别筛选，扩展图表数量后仍可快速定位。
3. B536（已完成）：增加相关矩阵和并行坐标，补齐多变量探索。
4. B537（进行中）：增加 Q-Q 图和 P-P 图，补齐分布诊断。
5. B538（待执行）：增加三元图和雷达图，补齐组成数据与多指标轮廓。
6. B539（待执行）：增加雨云图和山脊图，补齐高密度分布比较；随后统一测试、构建和打包。

### 当前科研绘图增强批次

- 目标：在已验证全屏工作台与 28 种图表基础上，补齐多变量、分布诊断、组成数据和高密度分布分析，同时保持大量图表入口可发现。
- 范围：科研绘图 HTML/JS/CSS、Vega Lite 规格和本地派生数据、静态合同、使用说明；每批最多处理 2 个同类图表或 1 个入口能力。
- 排除：不复制第三方实现代码；不引入 GPL 代码、在线运行时或服务端计算；不改变 Rough/ZLK 原生对象链路、SVG 安全边界和宿主消息协议。
- 保护区：现有全屏按钮、F11、Esc、同源 SVG 预览/校验/插入、外部网站显式点击和全部旧图表入口必须保留；单批不测试、构建或打包，B535-B539 后统一执行。
- 开源依据：RAWGraphs Apache-2.0 的浏览器内表格到可编辑 SVG 工作流；Vega Lite BSD-3-Clause 的声明式分层、折叠和密度变换；Plotly.js MIT 的三元图和多变量科学图；seaborn BSD-3-Clause 的分布比较语义；statsmodels BSD-3-Clause 的 `ProbPlot`、Q-Q 与 P-P 诊断语义。只借鉴能力边界和公开交互语义，本仓自行实现。
- B535 影响区：图表入口 HTML/JS/CSS、静态合同和说明；回归检查为中文搜索、类别按钮、键盘/点击选择和 28 个旧入口均不丢失。
- B536-B539 影响区：图表入口、字段校验、本地派生行、Vega Lite 规格、静态合同和说明；回归检查为筛选后重算、配色与样式复用、实时 SVG 预览和插入严格同源。
- B535 验证与提交：脚本语法、科研绘图静态合同和 `git diff --check` 通过；28 个旧入口保持可见性合同，搜索只过滤入口、不改变当前图表或触发外部跳转。提交 `f38cc27 feat: add research chart discovery controls`；按五批次协议未运行统一测试、UI 构建或打包。
- B536 验证与提交：脚本语法、30 图静态合同和 `git diff --check` 通过；相关矩阵按筛选与分面重算 Pearson 系数，并行坐标按当前行重算数值范围和归一化值。提交 `b723231 feat: add multivariate research charts`；按五批次协议未运行统一测试、UI 构建或打包。

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
