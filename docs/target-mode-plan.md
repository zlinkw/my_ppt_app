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
- endpoint：`GET /health`、`POST /api/simple-experiment/plot`，并保留旧兼容端点 `POST /api/zlk-cluster/plot`；仅允许 `127.0.0.1` / `localhost`。
- token header：`Authorization: Bearer`、`X-Rough-Ppt-Token`、`X-RoughPpt-Automation-Token`。
- `schemaVersion=1`；未知字段忽略，未来只接受 optional additive extensions。
- `target.presentationPath` 为空则新建；已打开则复用追加；存在未打开则打开追加；不存在且 `createIfMissing=true` 则新建保存；不得关闭已有 PPT 或退出 PowerPoint。
- 结果必须经 `zlk-cluster-result-importer.mjs` 归一化，再用 PPT 原生 shape、line、text、table 绘制。
- 默认优先当前 SimpleExperiment 聚合结果：`simple_cluster/results/statistics.json`、`paper/tables/simple_results_table.csv`；旧项目兼容 `zlk_cluster/results/statistics.json` 与旧论文表。单 seed/raw result 仅用于发现、追踪和审计。
- Markdown 摘要只生成 PPT 原生文本表格摘要页；存在同名 JSON 时优先 JSON。
- Agent runtime cache、事件 journal、Worker queue 属于 Agent 全局态；PPT 不扫描 `ZLK_AGENT_STATE_DIR`。
- PPT 绘图审计、归档 manifest、删除墓碑和文件传输状态必须落在当前项目 `simple_cluster/`；旧项目只读兼容 `zlk_cluster/`。
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

1. B525-B555（已完成）：科研绘图工作台扩展到 36 种图表并建立真实 Vega 回归；完成授权清理、状态色、搜索救援、导航高亮、BOM、顶栏度量、独立窗口布局、存储守卫和共享浏览器 harness。统一测试与 UI 构建通过。
2. B556-B560（已完成）：压缩计划历史；宿主同步失败给出中文反馈；排序假控件获得真实浏览器合同；简洁模式工作台改为紧凑两列；科研绘图默认三栏、窄窗控制先行、预览顶部对齐。B561-B563 纠偏后统一 `npm.cmd test` 与 UI 构建全绿。
3. B561-B565（已完成）：适配 SimpleExperiment 新端点、`simple_cluster` 路径和旧 ZLK 兼容路径；刷新使用说明真实截图；修复同源 SVG 预览超高容器留白并让布局合同检查可见预览。统一 `npm.cmd test` 与 UI 构建全绿。
4. B566-B570（已完成）：修复窄窗顶栏长状态与版本按钮挤压；使用说明目录滚动高亮；形状目录失败给出持续中文反馈并合并初始化状态。统一 `npm.cmd test` 与 UI 构建全绿。
5. B571（已完成）：补齐科研绘图筛选值的可访问名称，避免屏幕阅读器只依赖占位文本。
6. B572（已完成）：修复形状目录响应为空或 JSON 无效时静默显示空白列表的问题。

### 下一批次方向

- 继续按 `PROJECT_CONSTRAINTS.md` 5.1 优先做 UI：外观、布局、发现性、首屏密度、图标一致性、状态可读性。
- 每批只做一个同风险面改动，新增可见控件必须同时补中文文案、tooltip 和对应静态合同。
- 下一个统一验证节点为 B571-B575；节点前不运行 `npm test`、UI 构建或打包。
- 四个 UI 页面已全部纳入真实浏览器验证，harness 已去重到 `scripts/lib/ui-browser.mjs` 单一来源。
- 用户若要求安装包，需先完成一次统一验证再运行 `npm run package`，只打包、不安装。

## 近期锚点

- B561-B563：SimpleExperiment 绘图使用 `/api/simple-experiment/plot` 与 `simple_cluster` 路径；旧 ZLK 端点和旧项目路径仅作兼容。discovery 必须同时声明双路径。
- B565：同源 SVG 以 `<img>` 展示时不得用固定 100% 高度加 `object-fit: contain` 在超高容器中制造上下留白；布局验证必须选择当前可见预览节点。

- B559：简洁模式快捷工作台的四个入口必须保持两列紧凑密度；完整模式切换并入同一容器，不得恢复独立整行操作区。
- B560：科研绘图 1180px 默认窗口保持三栏；780px 以下控制面板先于预览；预览内容从顶部开始，不得留下大片纵向空白。
- B553-B554：本机存储写入必须经带 try/catch 的 `persistSetting`；裸 `setItem` 抛出会中断同一处理函数里后续的 `render()` 与 `postHost(...)`，让操作静默失效。`app.mjs` 与 `ribbon-shape-gallery.mjs` 各有一处合同锁定该约定。
- B546：Windows PowerShell 5.1 按系统 ANSI 代码页解码无 BOM 脚本，会让中文变乱码甚至吞掉字符串结束引号；含中文的 `.ps1` 必须带 UTF-8 BOM，该约定已写入 `validate-encoding.mjs` 与 `docs/VALIDATION.md`。
- B545 / B535-B540：导航映射必须经别名解析并用 rAF 合帧；科研图表证据必须来自真实 Vega Lite 编译与 Vega SVG 输出。
- B566-B570：窄窗顶栏按品牌、操作、状态、版本分行；说明目录滚动高亮唯一；目录失败反馈必须保留并与其它启动问题合并显示。
- B571：筛选输入必须同时具备可见提示、中文 tooltip 和显式 `aria-label`；不得把占位文本当作唯一可访问名称。
- B572：形状目录必须校验 `items` 为非空数组；网络、HTTP、JSON、空目录都进入四形状兜底并标记降级。

## 关键里程碑

- B525-B540：科研绘图工作台从 28 种扩展到 36 种图表，并建立真实 Vega 运行时回归。
- B467-B474：Ribbon 收敛为 5 组唯一入口；安装合同覆盖当前用户、同版本覆盖和 ICE61/ICE91 定向抑制。
- B452-B466：离线图文说明、独立非模态使用说明窗口、窄窗和 PowerPoint 2013 以上兼容合同建立。
- B411-B446：任务窗格配色、按钮尺寸、按选区显示、功能边界和 SimpleExperiment 主题完成统一。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
