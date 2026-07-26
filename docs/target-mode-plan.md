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
4. B537（已完成）：增加 Q-Q 图和 P-P 图，补齐分布诊断。
5. B538（已完成）：增加三元图和雷达图，补齐组成数据与多指标轮廓。
6. B539（已完成）：增加雨云图和山脊图，补齐高密度分布比较。
7. B540（已完成）：增加真实 Vega 编译与 SVG 渲染回归，覆盖本轮八种新图；统一测试、构建和打包已完成。
8. B541（已完成）：用户授权后按 `docs/manual-cleanup-candidates.md` 执行仓内无用文件清理，并回写处置结论。
9. B542（已完成）：任务窗格状态条增加“完成”状态色，空闲、进行中、完成和错误成为四个可区分状态。
10. B543（已完成）：UI 同步脚本过滤并清除运行时 UI 目录中的残留文件，避免旧样式备份被当作运行时资源分发。
11. B544（已完成）：搜索空结果补齐形状跨范围救援，并在救援按钮和说明中显示各范围匹配数量。
12. B545（已完成）：右侧功能导航高亮跟随滚动位置，并修正论文图像面板无法高亮导航项的映射缺口。
13. B541-B545 统一验证（已完成）：完整 `npm.cmd test` 39 项全部通过，`npm run build:ui` 通过且无产物漂移；按“未明确要求时不打包”边界未运行 `npm run package`。
14. B546（已完成）：为含中文的 PowerShell 脚本补齐 UTF-8 BOM，修复安装器与验证脚本的中文乱码和变量插值失效。

### B541 仓内清理批次

- 授权与边界：用户明确授权按人工清理候选列表删除，且删除范围不得超过该文档所述条目。删除前逐项审核绝对路径，必须位于 `D:\GitRepo\my_ppt_app\` 之下，并排除仓库根、`.git` 和 `src/`；拼接异常直接拒绝。
- 删除前审核：`package-run.pid` 内容为 `cleaned` 且记录 PID 未运行；`scripts/verify-deploy-package.ps1` 与 `scripts/verify-native-all.ps1` 通过解析器语法检查；已注册加载项清单指向 `%LOCALAPPDATA%\RoughPptAddin\publish`，不依赖仓内 `publish/`；`sync-ui-output.mjs` 递归重建 `publish/ui` 与 `dist/RoughPptAddin/publish/ui`，`validate-local-ui-assets.mjs` 仅在 `--publish` 下要求 `publish/ui`（`npm test` 未传该参数）；打包脚本输出到 `releases/<版本>/publish`。PowerPoint 与打包进程均未运行。
- 已删除：`恢复审计报告_20260721.md`、`package-run.pid`、两个 `scripts/*),` 残留、`dist/`、`publish/`、`diagnostics/`、`node_modules/nwsapi/dist/lint.log`，以及 11 个失败或已被取代的 `releases/` 目录，共 19 项、约 2.5 GB。
- 保留：`node_modules/` 虽在候选列表内但被 `npm test` 与 `npm run build:ui` 直接依赖，删除会打断验证基线，故保留并在候选列表中记录原因。
- 新增候选：`docs/target-mode-plan.md).Count` 属同类抽取残留但已被 Git 跟踪，不在本次授权范围内，已写入候选列表等待人工审核。
- B541 验证与提交：`git status --short` 仅显示该次授权删除的唯一跟踪文件；`releases/RoughPptAddin-0.1.786-735227c7/` 与 `releases/RoughPptAddin-0.1.762-e045e31e-r2/` 按记录保留。按五批次协议本批不运行统一测试、UI 构建或打包。

### B542 状态可读性批次

- 故障：`setStatus` 只区分空闲、进行中和错误三种状态。完成类文案（例如“已插入 3 个手绘对象”）与“准备就绪”共用同一套灰色描边和文字色，操作成功后状态条外观不变，用户无法在一眼之内确认操作是否已完成。
- 修复：新增 `isDoneStatusText` 判定完成类中文文案，`setStatus` 据此切换 `ok` 类；`statusToneLabel` 把悬浮说明前缀扩展为“当前状态 / 进行中状态 / 完成状态 / 错误状态”四种中文状态名。样式追加在文件末尾的 `.status.ok`，复用本仓既有绿色语汇（`#8fd19e` / `#ecf8f0` / `#1b7a34`），与进行中的蓝紫和错误的红色互不重叠。
- 判定边界：含“失败、错误、无法、不支持、超出、拒绝、未找到、不能为空”的文案即使以“已”开头也不视为完成；错误和进行中状态优先级高于完成。
- 回归保护：`validate-ui-contract.mjs` 新增状态色合同——提取 `isDoneStatusText` 源码并对 4 条完成文案和 6 条非完成文案做行为断言；再按逗号分组解析样式表，取 `.status.ok/.busy/.error` 的最后一条生效 `color` 并要求三者互不相同。
- B542 验证与提交：`node --check src/RoughPptAddin/ui/app.mjs`、`validate-ui-contract.mjs`、`validate-taskpane-function-icons.mjs`、`validate-encoding.mjs`、`validate-taskpane-ui-interactions.mjs` 全部通过；新合同经反向注入验证——把 `.status.ok` 文字色改成与进行中相同会报“tones not distinct”，删除该规则会报“missing color”。解析器实测生效色为 busy `#4754d8`、error `#dc2626`、ok `#1b7a34`。按五批次协议本批不运行统一测试、UI 构建或打包。

### B543 运行时 UI 资源纯净度批次

- 故障：`scripts/sync-ui-output.mjs` 用 `fs.cpSync(source, target, { recursive: true, force: true })` 整目录复制 `src/RoughPptAddin/ui`，没有任何过滤。中断命令和手工备份留下的残留文件（`styles.css.bak345` 185 KB、`app.mjs).Count`）因此会被复制进 `bin/Release/ui`、`bin/Debug/ui`、`publish/ui`、`dist/RoughPptAddin/publish/ui`，`--include-installed` 时还会进入 `%LOCALAPPDATA%\RoughPptAddin\publish\ui`。旧样式备份进入运行时目录会造成体积浪费和版本混淆。
- 影响边界：MSI/EXE/ZIP 三件套按 MSBuild 内容项打包，实测 `releases/RoughPptAddin-0.1.786-735227c7/publish/ui/` 不含残留，因此这是开发与本机安装目录的污染，不是已发布安装包缺陷。
- 修复：`sync-ui-output.mjs` 增加残留文件判定（`*.bak[0-9]*`、`*.orig`、`*.rej`、`*).Count`、`*),`、`tmp_*`、`.tmp-*`、`*.log`、`*.tmp`），复制时用 `cpSync` 的 `filter` 跳过，并在复制后用 `pruneResidue` 清除目标目录内已有的同类残留；清除只在目标目录内递归，并对每个路径重新校验仍在目标根之下。
- 回归保护：`validate-local-ui-assets.mjs` 校验同步脚本仍保留残留判定、`filter` 接线和 `pruneResidue`，并扫描四个存在的运行时 UI 目录，出现残留文件即失败。
- 保留：`src/RoughPptAddin/ui/styles.css.bak345`、`app.mjs).Count` 位于源目录且不在本次删除授权范围内，已连同另两个同类残留写入人工清理候选列表。
- B543 验证与提交：`node --check scripts/sync-ui-output.mjs` 与 `validate-local-ui-assets.mjs` 通过；用等价代码对真实 UI 目录做端到端复制实测——残留判定精确命中 2 个残留并保留全部 20 个正式资源，预置的根目录和 `vendor/` 嵌套残留各 1 个均被清除，`index.html`、`app.mjs`、`styles.css`、`help.html`、`vendor/rough.esm.js`、`vendor/vega.min.js`、`help-assets/taskpane-overview.png`、`build-info.json` 全部存活。因 `sync-ui-output.mjs` 会改写已跟踪的 `build-info.json`，本批未直接运行该脚本，按五批次协议也不运行统一测试、UI 构建或打包。

### B544 搜索跨范围发现性批次

- 故障：搜索空结果的跨范围救援只覆盖功能、预设、数据、素材四个范围，缺少形状救援。当搜索范围是功能、预设、数据或素材，而关键词只命中 PPT 原生形状时（例如在“功能”范围搜索“菱形”），空状态只提供“清空搜索”，用户无法得知形状范围里其实有结果，也没有一键切换的入口。
- 故障：救援按钮文案只写“在预设中查找”一类固定文字，不显示各范围匹配数量；切换后状态条才报出数量。用户在切换前无法判断哪个范围值得进入。
- 修复：新增 `crossScopeShapeMatches`，沿用与 `filteredItems` 相同的类别加文本判定，只忽略当前搜索范围；空状态增加“在形状中查找（N）”按钮，切换范围、持久化到 `roughPptSearchScope`、重渲染并聚焦首个形状卡片。五个救援按钮的文案和悬浮说明统一带匹配数量，说明行改为逐范围列出“形状 N 个、功能 N 个……”。
- 保护区：救援按钮只切换范围并定位，不插入形状、不执行删除或分享；已有的功能、预设、数据、素材救援路径和 `switchToCommandResults`、`switchToPaperPresetResults` 行为不变。
- 回归保护：`validate-ui-contract.mjs` 要求五个 `crossScope*Matches` 均已定义且被调用，五个救援按钮文案都带 `${...Rescue.length}` 数量插值，并要求空状态保留 `rescueSummary` 逐范围汇总。
- B544 验证与提交：`node --check src/RoughPptAddin/ui/app.mjs`、`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-taskpane-function-icons.mjs`、`validate-taskpane-ui-interactions.mjs` 全部通过。行为实测从 `app.mjs` 提取真实函数并对 203 项真实形状目录求值：功能范围搜“菱形”得 1 个救援结果，素材范围搜 `diamond` 得 1 个，预设范围搜“箭头”得 30 个；形状范围和全部范围均返回 0（已在范围内不重复救援），空白词和无匹配词均返回 0。按五批次协议本批不运行统一测试、UI 构建或打包。

### B545 导航定位准确性批次

- 故障：`markSectionNavActive` 只在点击导航、跳转和 `focusPanel` 时被调用，没有任何滚动跟随。完整模式下右侧功能导航是粘性侧栏，会一直停留在可视区，因此用户点击“风格”后继续滚动到“素材”，高亮仍指向“风格”，导航持续给出错误的当前位置。
- 故障：`focusPanel` 传入的是面板 `data-collapse-key`，但“论文图像与配色库”面板的 key 是 `zoteroImages`，导航里并没有该项（对应入口是 `paletteLibrary`）。定位到该面板时 `markSectionNavActive("zoteroImages")` 匹配不到任何按钮，导航会整体失去高亮。
- 修复：新增 `sectionNavPanelAliases` 把 `zoteroImages` 解析为 `paletteLibrary`，`markSectionNavActive` 统一经 `sectionNavKeyForPanel` 解析，全部既有调用点无需改动。新增 `currentScrolledPanelKey` 纯函数按粘性顶栏高度加 12 px 的锚点做滚动定位，取最后一个顶边已越过锚点的可见面板，没有则回落到第一个可见面板；`syncSectionNavToScroll` 与 rAF 合帧的 `scheduleSectionNavScrollSync` 绑定 passive 的 scroll 和 resize。
- 保护区：只更新 `active` 类和 `aria-current`，不改布局、不新增 sticky/fixed、不触发滚动或任何命令；隐藏面板（简洁模式下 `display: none`，矩形宽高为 0）一律跳过。
- 回归保护：`validate-ui-contract.mjs` 校验别名表、解析函数、滚动定位函数、passive scroll 接线和 rAF 合帧均在位；并遍历 `index.html` 全部 `data-collapse-key`，要求每个面板解析后都能命中一个真实存在的 `data-section-nav`，同时要求别名两端在 `index.html` 中都存在。
- B545 验证与提交：`node --check src/RoughPptAddin/ui/app.mjs`、`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-taskpane-function-icons.mjs`、`validate-taskpane-ui-interactions.mjs`、`validate-source-constraints.mjs`、`validate-style-panel-sync.mjs` 全部通过。行为实测从 `app.mjs` 提取真实函数跑 11 条断言全部通过：顶部、滚动进入风格、滚动进入科研绘图、锚点上方留空回落、隐藏面板跳过、全部在视口下方返回空，以及四条别名解析。新合同经反向验证——移除别名后 `zoteroImages` 立即被报为无法命中导航项。按五批次协议本批不运行统一测试、UI 构建或打包。

### B541-B545 统一验证记录

- 完整 `npm.cmd test` 全绿：203 形状目录、202 精确可插入形状、Rough 实时生成 200 次 p95 0.7 ms、87 个源文件约束、UI 合同、科研绘图 36 图静态合同与 8 图真实 SVG 运行时、任务窗格交互、133 个 Ribbon 控件、202 项形状图库、安装器版本单调性、彻底卸载、安装器运行时前置和安装载荷事务共 39 项检查全部通过。
- `npm run build:ui` 通过，四个 vendor 包重新复制后 `git status --short` 为空，无产物漂移。
- 未打包：`docs/target-mode-plan.md` 目标边界与 `PROJECT_CONSTRAINTS.md` 6.7 均要求“未明确要求时不打包”，本轮用户未要求安装包，因此不产出 ZIP/MSI/EXE，也未安装或启动 PowerPoint。
- 遗留发现：统一验证输出中 `validate-installer-payload-transaction.ps1` 的中文警告显示为乱码，已作为 B546 处理。

### B546 PowerShell 中文编码批次

- 故障来源：B541-B545 统一验证的输出里 `validate-installer-payload-transaction.ps1` 的中文警告显示为乱码，且 `$resolvedTestRoot` 未被插值，原文被截断成 `避免永久删除�?resolvedTestRoot`。
- 根因：本机 `powershell` 是 Windows PowerShell 5.1，系统 ANSI 代码页为 `gb2312`。PowerShell 5.1 读取没有 BOM 的脚本时按 ANSI 代码页解码，UTF-8 中文字节会被错读。最小复现确认：同一行中文在无 BOM 时报 `The string is missing the terminator: "`，加 BOM 后正常输出，即该缺陷不只是显示问题，还可能吞掉字符串结束引号导致脚本直接解析失败。
- 影响面：受影响的是 `install.ps1`、`install-payload-core.ps1`、`install-prereqs.ps1` 三个终端用户安装链路脚本，以及 `validate-installer-payload-transaction.ps1`、`verify-native-convert-selection.ps1`、`verify-zlk-cluster-plot.ps1`。`uninstall.ps1` 与 `uninstall-completely.ps1` 早已带 BOM，说明 BOM 是本仓既有约定。
- 修复：对 6 个文件按字节前置 `EF BB BF`，写回后逐个核对 UTF-8 解码内容与修改前完全一致，并用 PowerShell 解析器确认 0 个解析错误。
- 回归保护：`validate-encoding.mjs` 增加规则——扫描范围内任何含中日韩字符的 `.ps1` 必须带 UTF-8 BOM。该规则在编写后立刻多查出 3 个此前遗漏的文件（含终端用户脚本 `install-prereqs.ps1`），已一并修复。
- B546 验证与提交：`validate-encoding.mjs` 通过；34 个 `.ps1` 中 8 个含中文，8 个均已带 BOM，其余 26 个为纯 ASCII 不受影响。修复后重新解析 `validate-installer-payload-transaction.ps1`，该警告在语法树中是 `ExpandableStringExpressionAst` 且内容为 `测试目录已保留，避免永久删除：$resolvedTestRoot`；重新运行该脚本，实际输出为 `WARNING: 测试目录已保留，避免永久删除：C:\Users\...\RoughPptInstallContract-...`，中文正确且路径已插值。注：经 Bash 管道转发 PowerShell 5.1 输出仍会因控制台代码页显示乱码，那是抓取层现象，与脚本本身无关。

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
- B537 验证与提交：脚本语法、32 图静态合同、正态概率函数数值检查和 `git diff --check` 通过；Q-Q/P-P 按筛选、分组和分面重算，每组拒绝少于三个有效数值或零方差数据。提交 `bc8e398 feat: add probability diagnostic plots`；按五批次协议未运行统一测试、UI 构建或打包。
- B538 验证与提交：脚本语法、34 图静态合同和 `git diff --check` 通过；三元图逐行校验并归一化三个非负分量，雷达图排除标识/分组/分面字段后归一化至少三个数值指标，两类图固定等比例画布。提交 `9f0b21c feat: add composition research charts`；按五批次协议未运行统一测试、UI 构建或打包。
- B539 验证与提交：脚本语法、36 图静态合同和 `git diff --check` 通过；雨云图组合本地核密度、原始点和五数统计，山脊图按当前分组与分面重算核密度。提交 `df4fd63 feat: add dense distribution plots`；按五批次协议未运行统一测试、UI 构建或打包。
- B540 验证边界：因当前无可用的应用内浏览器实例，使用仓内真实 Vega Lite 编译器和 Vega SVG 运行时逐图解析工作台生成的规格；不得用字符串存在性代替运行时证据。
- B540 验证与提交：相关矩阵、并行坐标、Q-Q、P-P、三元、雷达、雨云和山脊图均通过真实 Vega Lite 编译、Vega 解析和 SVG 输出；该回归已加入 `npm test`。提交 `735227c test: render new research charts as SVG`。
- B535-B540 统一验证：完整 `npm.cmd test`、UI 构建、签名 Release 构建和 79 个 Ribbon 图标验证通过；36 种图表合同通过，保留 8 个既有 `CS4014` 警告、0 个错误。
- B535-B540 统一发布：ZIP、MSI、EXE 均非空且哈希/长度与 manifest 一致；版本 `0.1.786`，代码提交 `735227c79551`，`dirty=false`，产物目录 `releases/RoughPptAddin-0.1.786-735227c7/`；未自动安装或启动 PowerPoint。

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
