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

1. B525-B540（已完成）：科研绘图工作台交付全屏、坐标、标注、筛选、配置持久化、SVG 下载和入口中文搜索，图表扩展到 36 种并建立真实 Vega 运行时回归；最终交付 `releases/RoughPptAddin-0.1.786-735227c7/`。
2. B541-B545（已完成）：授权清理仓内无用文件约 2.5 GB；状态条增加完成状态色；UI 同步过滤运行时残留；搜索补齐形状跨范围救援并显示各范围数量；导航高亮跟随滚动并修正面板映射。统一验证 `npm.cmd test` 39 项与 UI 构建全绿。
3. B546-B550（已完成）：PowerShell 中文 BOM 修复；计划压缩；粘性顶栏度量跟随实际高度；新增科研绘图工作台真实浏览器布局验证并补 14 个控件说明；使用说明目录补 10 个章节说明。统一验证 `npm.cmd test` 40 项与 UI 构建全绿、无产物漂移。
4. B551（已完成）：按维护规则再次压缩本文件历史流水。
5. B552（已完成）：独立窗口布局验证合并为 `validate-ui-window-layout.mjs`，新增形状图库窗口覆盖；该窗口审计未发现缺陷。
6. B553（已完成）：任务窗格 50 处本机存储写入集中到带 try/catch 的 `persistSetting`，避免存储不可用时异常中断点击处理。
7. B554（已完成）：形状图库窗口 4 处存储写入补齐同类守卫，修复存储不可用时插入形状彻底失效。

### B546-B550 批次结论

- B546：含中文的 `.ps1` 必须带 UTF-8 BOM。6 个文件已补齐，其中 `install.ps1`、`install-payload-core.ps1`、`install-prereqs.ps1` 属终端用户安装链路。
- B547 / B551：按维护规则压缩本文件历史流水。
- B548：`--sticky-topbar-height` 与 `--panel-scroll-margin` 现由 `ResizeObserver` 跟随 `.topbar` 实际高度。修复前实测状态条展开使顶栏 76→96 px 而变量停在 77 px，定位面板被遮挡 8 px；修复后变量同步 97 px、scroll-margin 109 px，留 13 px 余量。
- B549：新增 `scripts/lib/ui-browser.mjs` 共享无头浏览器 harness 和工作台布局验证（720x560 与 1180x820 两个真实窗口尺寸），首次运行即查出并修复工作台 14 个控件缺失中文悬浮说明。该脚本已在 B552 并入 `validate-ui-window-layout.mjs`。
- B550：`index.html` 447 个可见控件悬浮说明零缺失；`help.html` 目录 10 个章节链接原本全部缺失，已补写并加入静态合同（`title` 不得等于链接文字）。

### B552 独立窗口布局验证合并批次

- 目的：`ribbon-shape-gallery.html` 是最后一个没有真实浏览器验证的 UI 面。与其再加第三份近似脚本，把工作台布局验证泛化为按窗口表驱动的 `validate-ui-window-layout.mjs`，同时覆盖科研绘图工作台和形状图库窗口。
- 窗口尺寸取自宿主 WinForms 定义，验证用户真的能拉到的最窄状态：工作台 `ResearchChartStudioWindow.cs` 的 720x560 与 1180x820，形状图库 `ShapeGalleryWindow.cs` 的 420x320 与 700x620。
- 检查项：横向溢出、可见元素越界、按钮过小、控件文字裁切、可见控件中文悬浮说明，加上每个窗口的专属检查（工作台 36 图表入口与单选状态；图库卡片数、分组数与卡片横向不越界）。
- 形状图库审计结论：**未发现缺陷**。两个尺寸下均无横向溢出、无越界元素、无过小按钮、悬浮说明零缺失；210 个形状卡片分 12 组，搜索“菱形”把卡片从 210 过滤到 2。本批只增加覆盖，不改产品代码。
- B552 验证与提交：`validate-ui-window-layout.mjs` 两个窗口四个尺寸全部通过；旧脚本已删除并从 `npm test` 换成新脚本，仓内无残留引用。

### B553 本机存储写入健壮性批次

- 故障：`app.mjs` 有 50 处 `localStorage.setItem` 全部裸调用，而所有读取路径（`loadJson`、`loadStyleTemplates` 等）都带 try/catch——这种读写不对称就是缺陷所在。WebView2 中本机存储可能被禁用或写满，`setItem` 抛出 `QuotaExceededError` 会中断点击处理的后续逻辑：`rememberRecent` 与 `pinQuickShape` 的 `setItem` 都在 `render()` 和 `postHost(...)` 之前，异常会让界面不重绘、宿主收不到固定常用形状的通知。
- 真实浏览器复现：在任何脚本执行前改写 `Storage.prototype.setItem` 让它始终抛出，然后点击搜索范围、界面模式、排序和面板折叠。修复前产生 6 次未捕获 `QuotaExceededError`；修复后为 0 次，且范围按钮、排序值、面板折叠态、搜索和形状网格全部照常工作。
- 修复：新增 `persistSetting(key, value)` 集中写入并捕获异常，首次失败时给一条中文状态提示（该提示本身也隔离在内层 try 里，因为它可能在 `els` 初始化之前被调用）。50 处调用点全部改为经该函数写入，成功路径语义不变。
- 边界：只改 `app.mjs`。`ribbon-shape-gallery.mjs` 与 `research-chart-studio.mjs` 的写入被 `validate-ribbon-shape-menu.mjs` 和 `validate-research-chart-studio.mjs` 以字面量断言，留待后续批次连同合同一起调整。
- 回归保护：`validate-ui-contract.mjs` 要求 `persistSetting` 存在、其内部确实用 try/catch 包住 `localStorage.setItem`、保留中文失败反馈，并且整个 `app.mjs` 中 `localStorage.setItem` 只允许出现 1 次（即只在该函数内）。
- B553 验证与提交：`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-taskpane-action-wiring.mjs`、`validate-style-panel-sync.mjs`、`validate-taskpane-shape-gallery.mjs`、`validate-ribbon-shape-menu.mjs`、`validate-taskpane-function-icons.mjs`、`validate-source-constraints.mjs`、`validate-simple-connection-layout.mjs`、`validate-taskpane-ui-interactions.mjs`、`validate-ui-window-layout.mjs`、`validate-usage-guide-modeless.mjs`、`validate-taskpane-resource-guards.mjs` 全部通过。

### B554 形状图库存储写入批次

- 复查结论：`research-chart-studio.mjs` 的 `saveConfig` 本来就有 try/catch 和中文失败反馈，无需改动。真正缺守卫的是 `ribbon-shape-gallery.mjs` 的 4 处写入，而且后果比 B553 更重——`insertShape`、`pinQuickShape`、`unpinQuickShape` 都是先写存储，再 `setStatus`，再 `postHost`，写入抛出会让插入和固定动作彻底不发生。
- 真实浏览器复现：让 `Storage.prototype.setItem` 始终抛出后点击第一个形状卡片。修复前出现 1 次未捕获 `QuotaExceededError`，且 `#galleryStatus` 为空——说明 `setStatus` 与 `postHost` 都没执行，插入静默失效。修复后无未捕获异常，状态显示“已插入：直线”，210 个卡片照常渲染。
- 修复：与该文件已有的 `loadJson` 对称，新增带 try/catch 的 `persistSetting`，首次失败给一条中文提示，4 处写入全部改为经它写入。
- 回归保护：`validate-ribbon-shape-menu.mjs` 的两条字面量断言改为 `persistSetting(...)` 形式，并新增要求——`persistSetting` 存在、内部确实用 try/catch 包住 `localStorage.setItem`、保留中文失败反馈，且该文件中 `localStorage.setItem` 只允许出现 1 次。
- 排查记录：首次探针因为给 `window.chrome.webview` 打了桩导致图库初始化超时，与存储无关；移除桩后复现正常。
- B554 验证与提交：`validate-ribbon-shape-menu.mjs`、`validate-ui-contract.mjs`、`validate-encoding.mjs`、`validate-research-chart-studio.mjs`、`validate-ui-window-layout.mjs` 全部通过。

### 下一批次方向

- 继续按 `PROJECT_CONSTRAINTS.md` 5.1 优先做 UI：外观、布局、发现性、首屏密度、图标一致性、状态可读性。
- 每批只做一个同风险面改动，新增可见控件必须同时补中文文案、tooltip 和对应静态合同。
- 下一个统一验证节点为 B551-B555；节点前不运行 `npm test`、UI 构建或打包。
- 四个 UI 页面已全部纳入真实浏览器验证。`validate-taskpane-ui-interactions.mjs` 仍带自己的 harness 副本，后续批次可迁移到 `scripts/lib/ui-browser.mjs`。
- 用户若要求安装包，需先完成一次统一验证再运行 `npm run package`，只打包、不安装。

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
- B452-B466：离线图文说明、独立非模态使用说明窗口、窄窗和 PowerPoint 2013 以上兼容合同建立。
- B411-B446：任务窗格配色、按钮尺寸、按选区显示、功能边界和 SimpleExperiment 主题完成统一。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
