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

1. B525-B540（已完成）：科研绘图工作台交付全屏、坐标、标注、筛选、配置持久化、SVG 下载、入口中文搜索与类别筛选，图表扩展到 36 种，并加入真实 Vega Lite 编译与 Vega SVG 渲染回归；两轮五批次统一验证与打包完成，最终交付 `releases/RoughPptAddin-0.1.786-735227c7/`。
2. B541（已完成）：用户授权后按 `docs/manual-cleanup-candidates.md` 清理仓内构建产物、恢复残留和失败发布目录共 19 项约 2.5 GB，并回写处置结论与保留原因。
3. B542（已完成）：任务窗格状态条增加“完成”状态色，空闲、进行中、完成和错误成为四个可区分状态。
4. B543（已完成）：UI 同步脚本过滤并清除运行时 UI 目录中的残留文件，避免旧样式备份被当作运行时资源。
5. B544（已完成）：搜索空结果补齐形状跨范围救援，五个救援入口统一显示各范围匹配数量。
6. B545（已完成）：右侧功能导航高亮跟随滚动位置，并修正论文图像面板无法高亮导航项的映射缺口。
7. B541-B545 统一验证（已完成）：完整 `npm.cmd test` 39 项与 `npm run build:ui` 全绿且无产物漂移；按“未明确要求时不打包”边界未产出安装包。
8. B546（已完成）：为 6 个含中文的 PowerShell 脚本补齐 UTF-8 BOM，修复安装链路中文乱码与变量插值失效。
9. B547（已完成）：按计划维护规则压缩本文件的历史流水。
10. B548（已完成）：粘性顶栏度量改为跟随顶栏实际高度，修复状态条展开后定位面板被顶栏遮挡。
11. B549（已完成）：新增科研绘图工作台真实浏览器布局验证，并补齐它遗漏的 14 个控件中文悬浮说明。
12. B550（已完成）：使用说明目录的 10 个章节链接补齐中文悬浮说明，并加入静态合同。

### B548 粘性顶栏度量批次

- 故障：`updateStickyChromeMetrics` 只在初始化、`resize` 和 `focusPanel` 时运行，但顶栏高度会随状态条展开而变化。真实浏览器实测：空闲时顶栏 76 px、`--sticky-topbar-height` 77 px、`--panel-scroll-margin` 89 px；出现错误状态并展开后顶栏升到 96 px，两个变量仍停在 77 px 和 89 px。此时定位到科研绘图面板，面板顶边落在 89 px 而顶栏底边在 96 px，面板标题被粘性顶栏遮挡 8 px，违反“非顶栏内容不使用 sticky/fixed 遮挡滚动”的约束。
- 修复：新增 `observeStickyChromeHeight`，用 `ResizeObserver` 监听 `.topbar` 实际高度变化并刷新两个变量；`updateStickyChromeMetrics` 改为只在数值变化时写入，避免多余样式写入与回环；`toggleStatusExpanded` 在没有 `ResizeObserver` 的宿主上作为兜底刷新路径。
- B548 验证与提交：真实浏览器实测修复后顶栏 96 px 时变量同步为 97 px、scroll-margin 为 109 px，面板顶边落在 109 px、顶栏底边 96 px，留出 13 px 余量且不再遮挡。回归保护加入 `validate-taskpane-ui-interactions.mjs` 的 `stickyChromeMetricProbe`（放在其他交互检查之后，因为它会展开全部面板）；反向验证——移除 `observeStickyChromeHeight()` 调用后该检查立即报“度量未跟随实际高度”和“被粘性顶栏遮挡 1px”。`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-taskpane-function-icons.mjs`、`validate-taskpane-action-wiring.mjs`、`validate-source-constraints.mjs` 均通过。

### B549 科研绘图工作台布局验证批次

- 覆盖缺口：科研绘图工作台是最新也最大的 UI 面（`research-chart-studio.html` 244 行、JS 1788 行、36 种图表），但此前只有字符串级静态合同和 Vega 运行时检查，没有任何真实浏览器布局验证；`validate-taskpane-ui-interactions.mjs` 的浏览器 harness 只加载 `index.html`。
- 新增：`scripts/lib/ui-browser.mjs` 抽出可复用的无头浏览器与本地静态服务（只服务 `src/RoughPptAddin/ui`，不访问外部网络）；`scripts/validate-research-chart-studio-layout.mjs` 按 `ResearchChartStudioWindow.cs` 的真实窗口尺寸 720x560（MinimumSize）和 1180x820（默认）加载工作台，检查横向溢出、可见元素越界、按钮过小、控件文字裁切、可见控件中文悬浮说明、36 个图表入口的可见性与横向不越界，以及单选状态只有一个 `aria-checked=true`。为不影响已通过的 `validate-taskpane-ui-interactions.mjs`，本批不改动该脚本的自带 harness。
- 首次运行即查出真实缺陷：14 个可见控件没有任何悬浮说明——`xReverse`、`yReverse`、`chartWidth`、`chartHeight`、`fontSize`、`lineWidth`、`markSize`、`markOpacity`、`showErrorBand`、`showLegend`、`showGrid`、`includeZero`、`showLabels`、`smoothLine`，违反“所有非 PPT 原生、意义不明确的控件都必须有中文悬浮说明”。相邻的坐标范围与标注输入框早已带 `title`，属明显遗漏。
- 修复：为 14 个控件补中文 `title`，措辞与相邻已有说明保持一致，只加属性不改结构、不改布局。
- B549 验证与提交：`validate-research-chart-studio-layout.mjs` 修复后在两个窗口尺寸下全部通过（无横向溢出、无越界元素、无过小按钮、无裁切文字、36 个图表入口全部可见且单选正确）；`validate-research-chart-studio.mjs`、`validate-research-chart-runtime.mjs`、`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-local-ui-assets.mjs` 均通过。新验证已接入 `npm test`（紧随 `validate-research-chart-runtime.mjs`）。

### B550 使用说明目录悬浮说明批次

- 审计方法：复用 B549 新增的 `scripts/lib/ui-browser.mjs`，在真实浏览器里对 `index.html` 和 `help.html` 做可见控件悬浮说明普查。
- 审计结果：`index.html` 在 420 px 和 900 px 下共 447 个可见控件，缺失悬浮说明 0 个、缺中文 0 个，既有静态合同覆盖到位。`help.html` 的 12 个控件中有 10 个缺失——目录里的全部章节链接（快速开始、入口总览、手绘图形、风格与重绘、特征块、科研绘图、论文套件、素材与配色、外部联动、兼容与排障）都没有 `title`，只有外层 `nav` 有一个笼统说明。
- 修复：为 10 个章节链接补写中文 `title`，内容说明该章节涵盖什么，而不是重复链接文字，用户点击前就能判断该去哪一节。
- 回归保护：`validate-usage-guide-modeless.mjs` 增加目录合同——至少 10 个章节链接，每个都必须有含中文的 `title`，且 `title` 不得与链接文字相同（避免用重复文案敷衍通过）。
- B550 验证与提交：真实浏览器复审 `help.html` 在两个宽度下缺失均归零；`validate-usage-guide-modeless.mjs`、`validate-ui-contract.mjs`、`validate-encoding.mjs` 通过；新合同经反向验证——删除某个 `title` 报“no tooltip”，把 `title` 改成与链接文字相同报“tooltip equals label”。

### 下一批次方向

- 继续按 `PROJECT_CONSTRAINTS.md` 5.1 优先做 UI：外观、布局、发现性、首屏密度、图标一致性、状态可读性。
- 每批只做一个同风险面改动，新增可见控件必须同时补中文文案、tooltip 和对应静态合同。
- 下一个统一验证节点为 B546-B550；节点前不运行 `npm test`、UI 构建或打包。

## 近期锚点

- B546：Windows PowerShell 5.1 按系统 ANSI 代码页解码无 BOM 脚本，会让中文变乱码甚至吞掉字符串结束引号；含中文的 `.ps1` 必须带 UTF-8 BOM，该约定已写入 `validate-encoding.mjs` 与 `docs/VALIDATION.md`。
- B545：面板 `data-collapse-key` 与导航项不是一一对应，`zoteroImages` 必须经 `sectionNavPanelAliases` 解析为 `paletteLibrary`；导航高亮由 rAF 合帧的滚动定位维护，合同要求每个面板都能命中真实导航项。
- B543：`src/RoughPptAddin/ui` 是整目录复制到运行时目录的，任何残留文件都会被带走；同步脚本负责过滤与清除，合同扫描四个运行时 UI 目录。
- B542：状态色语义固定为空闲灰、进行中蓝紫 `#4754d8`、完成绿 `#1b7a34`、错误红 `#dc2626`，四者必须互不相同。
- B541：清理授权只以 `docs/manual-cleanup-candidates.md` 为准；删除前必须逐项审核绝对路径位于 `D:\GitRepo\my_ppt_app\` 之下并排除仓库根、`.git` 与 `src/`。`node_modules/` 被验证基线依赖，不删除。
- B535-B540：科研绘图新图表的验证证据必须来自真实 Vega Lite 编译与 Vega SVG 输出，不得用字符串存在性代替运行时证据。
- B484-B485：安装入口覆盖 PowerPoint、.NET Framework 4.8、WebView2、VSTO 检测与补齐；彻底卸载清除插件资源但保留 Zotero 共享库和系统运行时。
- B482-B483：使用说明改为独立非模态窗口，支持边看边操作。

## 关键里程碑

- B525-B540：科研绘图工作台从 28 种扩展到 36 种图表，并建立真实 Vega 运行时回归。
- B467-B474：Ribbon 收敛为 5 组唯一入口；安装合同覆盖当前用户、同版本覆盖和 ICE61/ICE91 定向抑制。
- B452-B466：离线图文说明、右上角学习入口、返回状态、无渐变、窄窗和 PowerPoint 2013 以上兼容合同建立。
- B411-B446：任务窗格配色、按钮尺寸、按选区显示、功能边界和 SimpleExperiment 主题完成统一。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
