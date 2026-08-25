# 目标模式计划

> 执行期目标源。详细过程保留在 Git 历史；本文件只保留当前约束、冻结协议、验证基线、活跃队列和少量追溯锚点。

## 目标与边界

- PPT 插件作为科研绘图中枢：Rough 原生图形、SimpleExperiment 自动绘图、Zotero 论文图像与配色库。
- Rough 原生图形和 SimpleExperiment 自动绘图最终必须是 PPT 原生可编辑对象；禁止 PNG、SVG、Canvas 截图作为这些链路的最终对象。
- Zotero 论文参考图像与白名单科研绘图网站导出的受校验 SVG 是相互隔离的外部图像例外；科研 SVG 例外不得扩展到 Rough 或自动绘图。
- 所有界面使用中文母语表达；必要英文只保留官方名称或缩写，并与中文语义组合。意义不明确的按钮、标题、徽标和命令必须有中文悬浮说明。
- Ribbon 放高频入口；右侧任务窗格保留完整参数、素材与配色管理和兜底操作。
- 优先优化 UI 外观、布局、发现性、首屏密度、图标一致性、状态可读性和功能边界；阻塞、危险操作或兼容断裂可插队。
- 插件整体保留“插入 / 重绘 / 风格 / 数据”主路径；插入和重绘由 Ribbon 执行，右侧简洁模式只显示当前选区状态或单个参数/数据工作区，完整模式保留全部专业面板。
- 右侧任务窗格命令和导航使用纯文字；仅原生形状预览、素材/论文图缩略图、配色色块和状态标记保留视觉内容。
- 未明确要求时不安装、不部署、不关闭或重启 PowerPoint/VS Code、不打包。

## 执行规则

- 每批开始先读 `docs/PROJECT_CONSTRAINTS.md`、本文件、`git status --short --branch` 和最近提交。
- 脏文件先判定归属；禁止覆盖、回滚、暂存或提交用户改动。
- 涉及外部兼容时，只读核对 `D:\GitRepo\MCP\zlk-cluster-orchestrator`；每个实现批次开始前必须重新读取 `D:\GitRepo\my_img_manager` 的状态、最近提交和相关协议。禁止修改外部仓或追随未冻结协议。
- 新故障先写入本计划或验证清单，再修代码；修复后同步验证相邻旧合同。
- 每个小批次只做一个同风险面改动并独立提交；单个小批次不运行测试、构建或打包。
- 每完成连续 5 个小批次，统一运行完整 `npm test` 和 UI 构建；涉及 C# 时运行 Release `scripts/build.ps1`。全部通过后再按用户要求打包。
- 五批次统一验证失败时先修复并重新完整验证；禁止产出或交付已知失败的安装包。
- 人工清理候选仅限需要完整删除的文件或目录；保留文件内的局部内容由 Codex 直接修改，但禁止清空整个文件。
- UI 批次必须保持中文、tooltip、危险操作不直接执行，以及非顶栏内容不使用 sticky/fixed 遮挡滚动。
- 修改 `src/RoughPptAddin/ui/**` 后，在五批次节点运行 `npm run build:ui`。
- 提交信息只描述已验证能力，不写未验证承诺。
- 禁止启用多角色或多智能体后台流程。

## 冻结协议

### SimpleExperiment / ZLK Cluster

- discovery：`%LOCALAPPDATA%\RoughPptAddin\automation.json`、`automation.token`。
- endpoint：`GET /health`、`POST /api/simple-experiment/plot`，并保留旧兼容端点 `POST /api/zlk-cluster/plot`；仅允许 `127.0.0.1` / `localhost`。
- token header：`Authorization: Bearer`、`X-Rough-Ppt-Token`、`X-RoughPpt-Automation-Token`。
- `schemaVersion=1`；未知字段忽略，未来只接受 optional additive extensions。
- target 已打开则复用追加；存在未打开则打开追加；不存在且允许时新建保存；不得关闭已有 PPT 或退出 PowerPoint。
- 结果必须经 `zlk-cluster-result-importer.mjs` 归一化，再用 PPT 原生 shape、line、text、table 绘制。
- 默认优先当前 `simple_cluster/results/statistics.json` 和论文表格 CSV；旧项目兼容 `zlk_cluster/`。单 seed/raw result 仅用于发现、追踪和审计。
- Markdown 摘要只生成原生文本表格摘要页；存在同名 JSON 时优先 JSON。
- 相同 `requestId` 可安全重放；不同内容必须返回中文冲突。忙碌时快速返回，不进入 UI 队列。

### Zotero Image Saver

- 完整协议源：`docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md`；PPT 只读外部 SQLite，禁止读取 `zotero.sqlite`。
- 唯一数据库固定为 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`；其它路径均回落固定路径。
- 表优先级：`images` -> `paper_images` -> 兼容候选表；只读活动行，并读取 palette 字段。
- bridge 只允许状态、刷新、打开 PDF 和定位条目/附件命令；不可用时使用受控 fallback。
- 完整图库界面由 Zotero 唯一维护；PPT 不复制第二套图库，也不发送删除、分享或导入命令。
- 返回非法 Zotero URI 时禁止 ShellExecute，只复制溯源 ID。

## 验证基线

- 轻量：`node scripts/validate-ui-contract.mjs`、相关专项合同脚本、`node --check src/RoughPptAddin/ui/app.mjs`。
- 外部协议：自动化合同、Zotero 图像库合同和外部插件兼容验证。
- 全量：`npm test`。
- 构建：`npm run build:ui`；C# Release 构建为 `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`。
- 打包：仅用户明确要求时运行 `npm run package`；只打包，不安装。
- 提交前：`git diff --check`、`git status --short`。

## 功能归属

| 区域 | 功能类型 | 当前功能 |
| --- | --- | --- |
| Ribbon | 高频直接执行 | 形状图库、选区动作、风格快捷项、特征块、论文套件、保存素材 |
| 右侧任务窗格 | 参数配置、预览、资源管理 | 风格精调、科研绘图、论文预设、Zotero 图像与配色、特征块方向、素材管理 |
| 更新入口 | 手动检查 | 固定 GitHub Release API 查询；新版本只引导用户手动下载安装 |

右侧任务窗格不得再次显示已经由 Ribbon 直接执行的高频命令。保留隐藏接线仅用于兼容与回归测试，不构成可见入口。

## 活跃队列

1. B596-B650（已完成，已压缩）：建立更新检查、中文说明、状态与控件密度、外部兼容、后台任务治理、形状图库密度和固定操作发现性基线；0.1.906 前安装包均已无感验证。
2. B651-B655（已完成）：修复构建失败后误装旧本体，补充前端就绪与无障碍验证，放大形状图标，移除重复命令中心，模式切换双向化，并收窄居中宽窗简洁内容。
3. B656（已完成）：B651-B655 统一验证后生成 0.1.913 三格式安装包，MSI 无感安装并核对安装载荷与已安装前端。
4. B657（已完成）：按当前图标密度、命令结果和简洁模式布局重建帮助截图，避免在线说明展示过期界面。
5. B658（已完成）：压缩历史流水，只保留当前约束、活跃结论和 B651 后追溯锚点。

## 近期锚点

- B596-B650 历史锚点：更新检查、中文说明、横向控件、状态密度、外部兼容、后台任务治理、形状图库密度和固定操作发现性已建立；详细验证和安装记录保留在 Git 历史与对应 Release 清单。
- B651 验证锚点：安装脚本改用受控子进程退出码，任务窗格验证等待 `roughPptTaskPaneReady` 和科研预设渲染；无障碍合同覆盖四个页面五个宽度并通过。0.1.908 本地构建已无感安装，安装注册表 `LoadBehavior=3`。
- B652 验证锚点：形状预览画布提高到 64px，Ribbon 图标显示 36px，任务窗格图库图标显示 32px；202 个图标预览、窗口布局、UI 合同、任务窗格交互和无障碍检查通过。700px 截图确认图标占位更满、轮廓更清晰，截图已回收。
- B653 验证锚点：空搜索命令中心不再渲染，搜索命中结果使用单列完整宽度卡；UI 合同、动作接线、任务窗格交互、无障碍、编码和本地资产检查通过。800px 截图确认空搜索无重复命令卡，搜索“重绘”结果可读，截图已回收。
- B654 验证锚点：快捷工作台切换按钮按模式显示目标模式，点击可双向切换并更新说明；UI 合同、简洁连接布局、任务窗格交互和无障碍检查通过。800px 完整模式截图确认按钮显示“简洁模式”，截图已回收。
- B655 验证锚点：700px 以上简洁模式内容列收窄到 640px 并居中；UI 合同、简洁连接布局、任务窗格交互和无障碍检查通过。800px 截图确认卡片不再满宽拉伸，截图已回收。
- B656 验证锚点：`npm test`、`npm run build:ui`、Release 构建和 `npm run package` 通过，仅保留既有 stdole 版本冲突告警；`releases\RoughPptAddin-0.1.913-54c5bc0a` 生成 ZIP、MSI、EXE，三个产物哈希与清单一致。MSI 静默返回 0，安装元数据为 `0.1.913 / 54c5bc0a9ff5`、`dirty=false`、`LoadBehavior=3`，关键载荷哈希一致；800px 已安装前端截图复核后已回收。
- B657 验证锚点：四张帮助截图按当前构建重建；编码、本地 UI 资产、UI 合同和非模态帮助合同通过。总览与风格截图确认简洁模式居中布局、放大形状图标和当前版本位。

## 关键里程碑

- B596-B605：插件具备公开版文档、手动 GitHub Release 更新检查和更一致的横向控制/状态呈现。
- B636-B641：任务窗格卡片、预设卡和参数组完成可读性重构，0.1.897 安装包通过无感安装验证。
- B642-B650：后台任务治理、形状图库可访问性和图标密度建立稳定基线，0.1.906 安装包通过无感验证。
- B651-B657：安装失败保护、无障碍验证、形状图标清晰度、命令结果边界、双向模式切换和宽窗简洁布局完成，0.1.913 安装包通过无感验证。
- B525-B555：科研绘图扩展到 36 种图表并建立真实 Vega 运行时回归。
- B467-B474：Ribbon 收敛为五组唯一入口，建立当前用户覆盖安装和定向 ICE 抑制。
- B452-B466：离线图文说明、独立非模态窗口和 PowerPoint 2013 以上兼容合同建立。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
