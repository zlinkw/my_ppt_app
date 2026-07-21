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

1. R001（运行中）：以本机已安装 `530de39`、恢复审计报告和 Codex 会话流水为证据重建删除前源码；本批先建立本地 Git 与私有远程恢复基线。
2. R002（通过）：已按会话中的 `096509d` 恢复 B503 横向可读布局、鼠标拖动/键盘滚动及科研图卡片正文完整显示；`node scripts/validate-taskpane-ui-interactions.mjs` 通过。
3. R003（五批统一验证节点）：统一 `npm test` 正在修复恢复源码与旧验证文本的断点。R003-D 已从恢复源码重新生成 203 项形状目录；R003-E 已修正 Zotero bridge 固定 endpoint 解析和 25 MB `image_blob` 读取上限，两个 Zotero 协议验证均通过。全量测试当前下一断点是恢复后的 UI 合同；通过后再执行 UI 构建和安全打包。保护用户安装态，不执行含进程终止的 `package-run.ps1`。
4. R004（已实现，待五批统一验证）：配色改为按明确 `imageId` 只读当前单张参考图的全部实际色系；未保存时切换图片使用页面内确认，拒绝则保持当前图，并支持仅存于当前 PowerPoint WebView 内存的免询问；保存成功后解除切换保护。R004-A 未运行测试、构建或打包，仅完成差异检查；统一验证失败时回到本项修复。
5. R005（已更新，待五批统一验证）：使用说明已补充 Zotero 完整图库复用入口、在线刷新与离线只读行为，以及单图配色、未保存切换确认和会话级免询问；R005-A 仅完成差异检查，未运行测试、构建或打包。累计五个小批次后统一运行完整测试、UI 构建与打包，不自动安装。

### 当前恢复批次

- 目标：恢复删除前最新源码与中断的配色工作流。
- 范围：本仓源码、UI、验证脚本、使用说明、构建和安装产物；当前批次只建立可追踪 Git 基线。
- 排除：不修改 `D:\GitRepo\my_img_manager`、不生成第二套 Zotero 完整图库、不自动安装、不关闭或重启 PowerPoint/VS Code。
- 保护区：固定外部 SQLite、`image_blob` 插图、Zotero 生成的完整图库页面、受限 bridge 命令和 PPT 原生可编辑对象约束。
- 回归检查：Git 忽略恢复副产物和构建输出；初始提交可复现；`origin/master` 与本地 `HEAD` 一致；后续功能批次执行各自合同，五批节点执行全量验证与打包。

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
