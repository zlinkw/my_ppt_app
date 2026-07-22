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
5. B529（已完成）：补齐数据筛选、配置持久化、SVG 下载与使用说明；完成五批次统一测试、构建和打包。
6. B530（已完成）：直接移除完整模式中重复的 SimpleExperiment 与 Zotero 连接状态按钮，保留上方现有功能入口。
7. B531（已完成）：增加小提琴图、经验累积分布图和森林图，补齐分布与效应量表达。
8. B532（已完成）：增加 ROC、精确率召回和校准曲线，补齐模型评估可视化。
9. B533（已完成）：增加 Bland–Altman、火山图和漏斗图，补齐一致性与显著性关系表达。
10. B534（进行中）：增加 Kaplan–Meier 生存曲线和累计风险曲线，补齐生存分析表达。

### 当前科研绘图增强批次

- 目标：使本地科研绘图工作台可全屏，并扩展为覆盖常见论文统计图、坐标控制、标注、分面、数据处理和可复用配置的完整工作流。
- 范围：独立 WinForms/WebView2 工作台、Vega-Lite 规格生成、CSV/TSV 数据处理、同源 SVG 预览/校验/插入、使用说明和合同。
- 排除：不复制第三方仓库代码；不引入 GPL 代码或在线运行时；不改变 Rough/ZLK 原生对象链路；外部网站仍仅由用户显式点击打开。
- 保护区：PowerPoint、VS Code 不自动关闭或重启；单批不测试、构建、打包；B525-B529 完成后统一验证与打包。
- 开源依据：RAWGraphs 的本地表格到矢量图工作流与可扩展图表选择；Datawrapper 的发布级响应式图表工作流；Vega Editor 的声明式规格和示例驱动编辑；Plotly.js 的统计、科学与多类型图表覆盖；Veusz 的误差线、参考标注、函数/分布、极坐标、多轴和数据处理能力。仅借鉴能力边界与交互结构，继续使用仓内 BSD-3-Clause Vega 运行时自行实现。
- B525 影响区：`ResearchChartStudioWindow`、工作台 HTML/JS、桥接合同和科研绘图验证合同；保留 SVG 安全校验及现有所有入口。
- B525 回归检查：全屏消息仅作用于科研绘图窗口；进入与退出状态回传 UI；F11、Esc、按钮一致；窗口隐藏再打开不丢失可恢复边界。
- B525-B528 验证与提交：全屏、坐标、论文标注、17 种图表及分面均通过静态合同；提交记录依次为 `91c47d3`、`a1e4d58`、`1e8edaf`、`bb22683`。
- B529 验证：完整 `npm.cmd test`、UI 构建、79 个 Ribbon 图标验证、签名 Release 构建和三种安装产物生成通过；成功产物位于 `releases/RoughPptAddin-0.1.762-e045e31e-r2/`，版本 `0.1.762`、提交 `e045e31e70b7`、`dirty=false`。首次 WiX 下载不完整的失败目录已列入人工清理候选。
- B529 提交记录：`e045e31 feat: add research chart filtering and SVG export`。
- B530 验证：两个重复连接按钮、容器、运行时状态接线和专属样式已从源码直接删除；上方科研绘图与论文图像入口保留。相关 JS 和验证脚本语法、静态残留断言、`git diff --check` 通过；按新一轮五批次协议未运行统一测试、UI 构建或打包。
- B530 提交记录：`62a9af6 fix: remove duplicate connection buttons`。
- B531 范围：工作台图表入口与 Vega Lite 规格生成、科研绘图静态合同、使用说明和验证手册；不修改 SVG 安全边界、宿主桥接或现有入口。
- B531 开源依据：借鉴 Vega Lite 密度与窗口变换、Matplotlib 小提琴图和 Plotly.js violin trace 的统计表达与控制语义；仅实现仓内规格，不复制第三方代码或引入新运行时。
- B531 回归检查：三类新图使用现有筛选、配色、坐标、分面和同源 SVG 链路；森林图必须校验效应值与上下限字段；任务窗格入口仍不得自动打开浏览器。
- B531 验证：科研绘图脚本和验证脚本语法、20 图静态合同、遗留数量检索和 `git diff --check` 通过；按五批次协议未运行统一测试、UI 构建或打包。
- B531 提交记录：`1710bcb feat: add scientific distribution plots`。
- B532 范围：工作台图表入口、概率字段校验、评估曲线规格、静态合同和使用说明；不改变数据导入、外部网站或 SVG 宿主链路。
- B532 开源依据：借鉴 scikit-learn BSD-3-Clause 评估曲线显示语义、Plotly.js MIT 线点组合和 Vega Lite 分层参考线表达；不复制实现代码。
- B532 回归检查：概率字段限制在 0 至 1，ROC 与校准曲线保留随机或理想对角参考线，颜色字段继续作为多模型分组，预览与插入仍复用同一 SVG。
- B532 验证：科研绘图脚本和验证脚本语法、23 图静态合同、遗留数量检索和 `git diff --check` 通过；按五批次协议未运行统一测试、UI 构建或打包。
- B532 提交记录：`8873ff7 feat: add model evaluation curves`。
- B533 范围：工作台图表入口、派生数值字段与参考界限规格、静态合同和使用说明；不改变 SVG 安全边界或宿主协议。
- B533 开源依据：借鉴 Matplotlib Bland–Altman 示例、Plotly.js volcano/funnel 统计布局和 Vega Lite calculate/aggregate 变换；只实现本地声明式规格。
- B533 回归检查：Bland–Altman 要求两个数值测量字段并绘制均值差、偏差和一致性界限；火山图要求效应值与 P 值；漏斗图要求效应值与标准误。
- B533 验证：科研绘图脚本和验证脚本语法、26 图静态合同、派生字段残留检索和 `git diff --check` 通过；按五批次协议未运行统一测试、UI 构建或打包。
- B533 提交记录：`db797ea feat: add agreement and significance plots`。
- B534 范围：生存数据校验、本地 Kaplan–Meier 风险集计算、生存与累计风险 SVG 规格、静态合同和使用说明；不引入统计运行时或在线服务。
- B534 开源依据：借鉴 lifelines MIT 与 scikit-survival BSD-3-Clause 的时间、事件、分组及删失标记语义，以及 Matplotlib 阶梯线表达；本仓自行实现有界本地计算。
- B534 回归检查：同一时间点先按风险集计算事件概率再移除删失，分组与分面分别计算，删失点明确标记，过滤后的数据实时重算。

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
