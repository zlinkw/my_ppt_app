# 目标模式计划

> 执行期目标源。详细过程保留在 Git 历史；本文件只保留当前约束、冻结协议、验证基线、活跃队列和少量追溯锚点。

## 目标与边界

- PPT 插件作为科研绘图中枢：Rough 原生图形、ZLK 自动绘图、Zotero 论文图像与配色库。
- Rough 原生图形和 ZLK 图表最终必须是 PPT 原生可编辑对象；禁止 PNG、SVG、Canvas 截图作为最终对象。
- Zotero 论文参考图像是唯一 `msoPicture` 例外；该例外不得扩展到 Rough 图形或 ZLK 图表。
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

1. SE001（统一验证通过）：PPT 缺省结果发现优先使用 `statistics.json` 和论文表格，再考虑摘要、索引和 case-level 辅助文件；`npm test` 已覆盖结果选择合同。
2. SE002（统一验证通过）：discovery 与 `/health` 已补充服务和进程身份、固定路径、token header 清单、`ready`、`busy` 和 additive capabilities；`npm test` 已覆盖连接诊断合同。
3. SE003（统一验证通过）：automation server 已缓存最近 32 个成功 `requestId`，相同内容重试返回 `replayed=true` 且不重复建页，不同内容复用 ID 与并发请求均快速返回中文 `409`；`npm test` 已覆盖幂等合同。
4. SE004（统一验证通过）：任务窗格连接片、导入提示、自动绘图状态、错误反馈和默认图表标题已统一使用 SimpleExperiment 品牌；保留 ZLK 仅作为协议 ID、内部标记和兼容搜索词。
5. SE005（统一验证通过）：连接合同验证、恢复源码等价实现兼容、部署与完整卸载入口、Office 版本兼容和批量重绘合同均已通过；完整 `npm.cmd test` 与 `npm.cmd run build:ui` 已通过。本批不打包、不安装。
6. PKG001（已完成，实现提交 `ab02a49`）：用户明确要求生成最新版 ZIP、MSI、EXE。非破坏性发布脚本已补齐独立输出 NuGet restore、C# 新语法版本、ClickOnce 签名、Material Symbols TTF 嵌入和 per-user WiX 组件合同；`npm.cmd test`、`npm.cmd run build:ui`、Release 编译、Ribbon 图标验证及三种产物 SHA256 校验均通过。最终产物位于 `releases/RoughPptAddin-0.1.22-ab02a492/`，未自动安装。
7. PKG002（已完成，实现提交 `1c1ac8b`）：用户安装 MSI 时出现 “A newer Rough PPT Add-in is already installed.”。根因是本机已安装 `0.1.695` 高于恢复仓按当前提交数生成的 `0.1.22`。本批使用持久化 `installerVersionBaseline=0.1.695` 加当前提交数恢复版本单调性，并由共享解析器覆盖两条打包链路；UpgradeCode、覆盖安装、per-user 范围、三种入口及现有插件数据保持不变。旧版到恢复后首个构建的回归合同、完整 `npm.cmd test`、`npm.cmd run build:ui`、Release、Ribbon、MSI ProductVersion `0.1.719` 和三种产物 SHA256 均通过；最终产物位于 `releases/RoughPptAddin-0.1.719-1c1ac8b2/`，未自动安装或关闭 PowerPoint。
8. B504（统一验证通过）：简洁模式连接状态片恢复三列紧凑布局，窄窗改为两列加完整模式整行，文字固定横排并省略过长内容；敏感性曲线预览改为单条有边界留白的 SVG polyline，节点与折线共享坐标，避免断裂和越界。首次浏览器验证暴露连接文字容器仍受全局按钮规则压缩、简洁模式测试状态使隐藏菜单无法获取焦点；现显式固定状态点/文字网格列，并让菜单合同先恢复完整模式。完整 `npm.cmd test` 与 `npm.cmd run build:ui` 已通过。
9. PKG003（已完成，发布提交 `d939c60`）：两处 UI 修复通过完整 `npm.cmd test`、`npm.cmd run build:ui`、独立 Restore、签名 Release 编译和 79 个 Ribbon 功能图标运行时验证。发布链路已修正内置构建信息，ZIP 中记录版本 `0.1.724`、提交 `d939c602d403`、`master`、`dirty=false`；MSI ProductVersion 与清单均为 `0.1.724`。ZIP、MSI、EXE 的长度和 SHA256 已逐项复核，最终产物位于 `releases/RoughPptAddin-0.1.724-d939c602/`。未自动安装，也未关闭或重启 PowerPoint/VS Code。
10. PKG004（已完成，实现提交 `8e0c211`）：用户手动重复安装 `0.1.724` 时，PowerPoint 运行状态被 MSI 隐藏为 `RunInstall` 的 `1722/1603`。安装器现将完整日志持久化到 `%LOCALAPPDATA%\RoughPptAddin\logs`，同步记录注册表诊断并显示具体中文失败原因；前置组件子进程失败会立即停止，安装器不再自动关闭 PowerPoint。安装事务与 Ribbon 验证的临时删除改走回收站。完整 `npm.cmd test`、`npm.cmd run build:ui`、签名 Release 编译和 79 个 Ribbon 功能图标验证通过；MSI 保持 per-user、固定 UpgradeCode、同版本覆盖和 `RunInstall` 执行合同。`0.1.726` 的 ZIP、MSI、EXE 长度及 SHA256 与清单一致，内置构建信息为 `8e0c211561d3`、`master`、`dirty=false`，最终产物位于 `releases/RoughPptAddin-0.1.726-8e0c2115/`。未自动安装，也未关闭或重启 PowerPoint/VS Code。

### 当前 SimpleExperiment 连接批次

- 目标：提高 SimpleExperiment 到 PPT 原生科研绘图链路的结果选择正确性、连接可诊断性和重试安全性。
- 范围：PPT automation server、结果发现、任务窗格状态、兼容验证和相关文档。
- 排除：外部 `D:\GitRepo\MCP\zlk-cluster-orchestrator` 与 `D:\GitRepo\my_img_manager` 只读；不改其源码，不扫描 raw dataset/checkpoint/Agent 全局态，不自动安装、不关闭或重启 PowerPoint/VS Code。
- 保护区：loopback 与 token 验证、`schemaVersion=1`、已有 PowerPoint 不关闭、结果统一经 importer 归一化、最终对象保持 PPT 原生可编辑。
- 回归检查：SE001-SE005 已通过完整 `npm.cmd test` 与 `npm.cmd run build:ui`；本批未运行打包或安装，后续只有用户明确要求时才生成安装包。

### 当前安装修复批次

- 批次标识：PKG004。
- 目标：让安装失败保留可定位日志，并让 PowerPoint 占用和同版本重复安装得到明确、可恢复的结果。
- 范围：`scripts/install.ps1`、本体事务测试接线、安装合同测试和部署说明。
- 排除：不修改插件业务功能，不自动安装，不关闭或重启 PowerPoint/VS Code，不清理用户数据或旧发布目录。
- 保护区：当前用户安装范围、UpgradeCode、覆盖安装、ZIP/MSI/EXE 三入口、VSTO/证书/前置环境合同。
- 当前状态：已完成。首次统一验证在部署文档旧措辞合同处失败，修正后完整测试、UI 构建、签名 Release、Ribbon 运行时图标、安装包内部合同和三种产物清单校验均通过；发布目录为 `releases/RoughPptAddin-0.1.726-8e0c2115/`，等待用户关闭 PowerPoint 后手动安装验证。

### 当前 UI 与科研绘图工作区批次

- 批次队列：B505、B506、B507、B508、B509。
- 目标：修复简洁模式连接状态按钮在窄窗和全局流式规则下的纵向挤压；将“科研绘图”入口打开独立本地网页工作区，支持同一 CSV 切换多种预览类型，并把选中类型交回现有 PPT 原生图表渲染链路。
- 范围：`src/RoughPptAddin/ui/**`、科研绘图独立 WebView2 窗口、任务窗格入口消息、相关静态合同与项目文档。
- 排除：不移除旧任务窗格导入入口；不改变 ZLK `schemaVersion=1`、loopback/token 协议和结果 importer；不把 Canvas/SVG/图片作为 PPT 最终对象。
- 保护区：PowerPoint 不自动关闭或重启；现有图表 renderer 继续只生成原生 `Shape`、`Line`、`Textbox`、`Table`；Chart.js 仅用于网页预览，CSV 通过 Papa Parse 解析。
- 批次边界：每个小批次不单独测试、构建或打包；B505-B509 完成后统一运行完整 `npm test`、`npm run build:ui`，通过后按用户要求打包，供手动安装验证。
- B505（统一验证通过）：按钮最终尺寸和可用宽度合同。
- B506（统一验证通过）：独立科研绘图网页的本地静态界面、CSV 解析和 Chart.js 预览。
- B507（统一验证通过）：独立 WebView2 窗口及本地资源映射。
- B508（统一验证通过）：网页插入消息回传、PPT 原生图表插入和任务窗格入口跳转。
- B509（统一验证通过）：资源清单、使用说明和端到端静态回归合同。
- B510（已纠正）：第三方 Chart.js 包含可选 Canvas 导出 API；扫描器现只对该只读 vendor 文件豁免，工作区集成脚本禁止调用 Canvas 捕获或导出。
- B511（已纠正）：独立科研绘图工作区消息已登记到 `bridge-contract.mjs`，全量 UI 合同通过。
- B512（待统一验证）：独立工作区回传消息的 `requestId` 仅用于页面应答，不能传给 `InsertZlkChart` 作为自动化请求标识；否则会错误创建新演示文稿。宿主现强制使用当前 PPT 幻灯片目标，待重跑完整验证并重新打包。
- 统一验证：`npm.cmd test`、`npm.cmd run build:ui`、`node --check` 和签名 Release 编译均通过；直接运行旧 `scripts/build.ps1` 仍因未传入 Restore/LangVersion 参数失败，不作为发布链路，`npm.cmd run package` 使用独立 Restore 与最新 C# 语言版本成功。
- 发布产物：`releases/RoughPptAddin-0.1.734-33073eb3/`，ZIP、MSI、EXE 清单与 SHA256 已复核；未自动安装、未关闭或重启 PowerPoint/VS Code。

## 近期锚点

- B485：安装入口补齐 PowerPoint、.NET Framework 4.8、WebView2 和 VSTO 的前置检测；缺少 WebView2/VSTO 时优先经 winget 自动安装，缺少 .NET、PowerPoint、winget 或自动安装失败时打开对应 Microsoft 官方页面并给出中文补齐提示，端用户路径仍不安装 Build Tools。
- B484：新增一键彻底卸载入口，先拒绝在 PowerPoint 运行时操作，再清除 MSI 产品注册、VSTO 注册、插件本体、WebView2 状态、日志、自动化令牌、素材、缩略图、配色、预设、导出、安装器缓存和插件专用证书；明确保留 Zotero 共享论文图像库与系统级运行时。
- B483：使用说明占用任务窗格 WebView，导致 Ribbon 调用已卸载的绘图页面；现改为宿主独立非模态说明窗口，主绘图桥保持常驻，支持边看边操作 PowerPoint；全量合同、26 张 UI 截图、Release 编译及 Ribbon 图标验证通过。
- B482：用户明确要求提前统一验证和打包；全量合同、UI 构建、26 张任务窗格与使用说明截图、Release 编译、Ribbon 运行时图标验证及最终安装产物合同全部通过，产出 `0.1.670` ZIP、MSI 和 EXE，不自动安装。
- B481：统一测试暴露箭头参数可见性合同仍锁定旧版内联条件，实际实现已抽出等价的 `arrowEnabled` 变量；合同改为同时锁定变量定义与调用，避免把等价重构误报为功能断裂。
- B480：使用说明补充箭头三角形长宽的入口、范围、默认值、短线限制和实时重绘步骤，并明确 Ribbon 风格、填充、线条快捷项会同步重绘当前选区。
- B479：用户实测指出 Ribbon 风格菜单只更新后续插入风格，未统一触发选区重绘；同时 `LineArrow` 生成器把高度回退为 80 磅，导致手绘箭头头部异常放大。Ribbon 模板现复用选区样式重绘链路，箭头改为独立长度/宽度参数并在右侧线条参数中可调。
- B478：首次编译后图标验证表明 `IPictureDisp` 经 `FromHbitmap` 读取时透明底会被系统转为不透明浅灰，旧像素规则把背景误算为图标并假报非中性；运行时验证现以角点实测背景作差分，只对实际笔画检查中性深色、清晰暗部、蓝色占位和实心密度；修正后统一完整测试、UI 构建、截图、运行时验证、`0.1.666` 打包和最终产物合同全部通过。

## 关键里程碑

- B467-B474：Ribbon 拓扑收敛为 5 组唯一入口，编译后验证 78 个最终可见功能图标；安装合同确认当前用户事务安装、同版本覆盖和 ICE61/ICE91 定向抑制。
- B457-B466：使用说明产物纳入启动完整性校验，返回路径保持简洁/完整模式、活动工作区、搜索范围、滚动位置和 Office 原生形状图标；静态、运行时与消息合同共同防止导航回归。
- B452-B456：新增完整离线图文说明和右上角学习入口，覆盖全部功能与入口；建立窄窗、图片、本地导航及无渐变合同，并增加 PowerPoint 2013 以上、32/64 位 Office、WebView2、VSTO 与 .NET Framework 4.8 的宿主和安装兼容检测。
- B442-B446：简洁模式按选区变化进入正确工作区，同类轮询保留用户主动工作区；特征块方向工具按需展开，科研绘图无数据时隐藏不可用清空操作，并建立串联运行时合同。
- B437-B441：命令按钮改用本机 SimpleExperiment 当前主题的 `#5871EF/#6B83ED/#526FFF`，状态信息继续使用 `#2563EB`；同时压缩长状态并按上下文隐藏不可用的素材与配色命令。
- B432-B436：清除 Ribbon 图库、论文预设、配色布局卡片和科研图预览中的装饰渐变，保留真正表达配色映射的功能预览，并建立核心 UI 计算样式无渐变审计。
- B411-B415：任务窗格颜色、纯色按钮质感、30/24px 尺寸策略和状态反馈与 SimpleExperiment 对齐，并建立无装饰渐变验证合同。
- B116：建立 Zotero 图像库读取基础；后续批次统一遵守当前冻结的外部 SQLite 与受限 bridge 协议。
