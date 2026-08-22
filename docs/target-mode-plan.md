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

1. B525-B555（已完成）：科研绘图扩展到 36 种图表并建立真实 Vega 回归；完成授权清理、UI 状态、搜索救援、导航高亮、编码修复、布局验证、存储守卫和共享浏览器 harness。
2. B556-B565（已完成）：压缩计划历史；宿主同步失败中文反馈；排序假控件回归；简洁工作台紧凑两列；科研绘图三栏与窄窗控制先行；适配 SimpleExperiment 新端点和旧兼容路径；刷新说明截图并修复同源预览留白。
3. B566-B575（已完成）：窄窗顶栏分行；说明目录滚动高亮；目录失败持续反馈；筛选输入可访问名称；校验形状目录与本地图库偏好；完成计划压缩和统一验证。
4. B576-B585（已完成）：科研绘图单选键盘导航和筛选选中保护；特征块默认值、风格模板参数、排序偏好、偏好数组长度和目录条目结构安全校验；修复风格参数初始化缺陷。
5. B586-B589（已完成）：图表筛选补充中文空结果；提升低对比文本；完成响应式、对比度和焦点审计；帮助页增加跳到正文链接。
6. B590（已完成）：按维护规则压缩目标计划历史。
7. B591（已完成）：守卫说明页返回滚动的会话存储读写，避免存储禁用时阻断入口。
8. B592（已完成）：同步项目约束中的 SimpleExperiment 端点和轻量结果路径，消除冻结协议文档漂移。
9. B593（已完成）：刷新使用说明截图，使其与低对比修复和当前任务窗格状态一致。
10. B594（已完成）：重构公开 README，新增面向使用者的 Markdown 使用说明，集中覆盖兼容环境、安装方式、功能入口、联动、更新和卸载。
11. B595（已完成）：压缩简洁模式空内容轨道，避免无选区首屏在最后一张卡片下方继续拉伸空白工作区。
12. B596（已完成）：新增 GitHub 正式 Release 更新检查入口；宿主只查询固定仓库 API，发现新版本时通过页面内气泡打开固定 Releases 页面，不自动下载或替换插件。
13. B597（已完成）：同步公开 README、Markdown 使用说明和插件内说明中的更新入口、下载页与手动安装边界。
14. B598（已完成）：为更新检查链路建立静态合同验证，并纳入完整测试基线。
15. B599（已完成）：重拍任务窗格总览和风格工作区截图，使说明图包含“检查更新”按钮并按实际内容高度收束，不再展示大块空背景。

### 下一批次方向

- 继续按 `PROJECT_CONSTRAINTS.md` 5.1 优先做 UI：外观、布局、发现性、首屏密度、图标一致性、状态可读性。
- 每批只做一个同风险面改动，新增可见控件必须同时补中文文案、tooltip 和对应静态合同。
- 下一个统一验证节点为 B591-B595；节点前不运行 `npm test`、UI 构建或打包。
- 下一个统一验证节点为 B596-B600；节点前不运行 `npm test`、UI 构建或打包。
- 四个 UI 页面已全部纳入真实浏览器验证，harness 已去重到 `scripts/lib/ui-browser.mjs` 单一来源。
- 用户若要求安装包，需先完成一次统一验证再运行 `npm run package`，只打包、不安装。

## 近期锚点

- B556-B565：简洁模式快捷工作台紧凑两列；科研绘图默认三栏、窄窗控制先行且同源预览从顶部开始；SimpleExperiment 使用新端点与 `simple_cluster` 路径并保留旧兼容。
- B553-B554 / B546：本机存储读写必须对称守卫；含中文的 PowerShell 脚本必须带 UTF-8 BOM。相关约定分别由资源守卫和编码验证锁定。
- B545 / B535-B540：导航映射必须经别名解析并用 rAF 合帧；科研图表证据必须来自真实 Vega Lite 编译与 Vega SVG 输出。
- B566-B570：窄窗顶栏按品牌、操作、状态、版本分行；说明目录滚动高亮唯一；目录失败反馈必须保留并与其它启动问题合并显示。
- B571-B574：筛选输入必须有显式 `aria-label`；形状目录和两侧数组偏好必须做非空与类型校验，异常时安全回退并给出中文反馈。
- B576-B579：科研绘图单选组支持方向键/Home/End 且筛选后保持可见选中项；特征块默认值和风格模板参数必须按类型、枚举、颜色和范围安全重建。
- B576-B579：科研绘图单选组支持方向键/Home/End 且筛选后保持可见选中项；特征块默认值和风格模板参数必须按类型、枚举、颜色和范围安全重建。
- B581-B585：缺失风格参数规则会让模块加载失败；本机排序、数组、模板参数和目录条目读取时必须校验类型、范围并裁剪到运行上限；统一测试和构建已复验全绿。
- B586-B589：筛选零结果必须给出中文建议；小号文本用深色同族色满足对比；320–1400px 响应式、对比度和焦点审计零缺陷；帮助页跳转正文后焦点必须落到正文容器。
- B586-B590 统一验证：完整 `npm.cmd test` 与 `npm.cmd run build:ui` 全绿；无产物漂移。按“未明确要求时不打包”边界未产出安装包。
- B591：会话存储读取、写入和删除必须经过守卫助手；写入失败时“使用说明”仍必须向宿主发送打开请求，浏览器回退也不得中断。
- B591 验证与提交：真实浏览器模拟 `sessionStorage.setItem` 抛出后验证宿主收到 `openUsageGuide`、页面保持当前地址；说明窗口合同、资源守卫和任务窗格交互通过。代码与本批计划同提交。
- B592：项目约束必须与 B581 后的实际协议一致；新端点、旧兼容端点和当前/旧项目轻量结果路径都要写明，避免后续按旧契约误报漂移。
- B593：使用说明 PNG 必须随界面结构、配色和状态变化重新生成；截图内容要与对应章节的入口和工作区一致。
- B593 验证与提交：真实浏览器重新捕获四张界面截图；说明窗口合同通过。截图与本批计划同提交。
- B592 验证与提交：外部插件兼容、自动化合同、源码约束和编码验证通过。代码与本批计划同提交。
- B594：公开文档必须先回答“能否安装”“装哪个包”“怎么用”“怎么更新卸载”；内部约束只作为开发者入口，不应占据 README 首屏。
- B595：简洁模式的内容列必须按实际可见卡片收束；剩余视口只保留页面背景，不再由空 grid track 撑出无效工作区。
- B591-B595 统一验证：完整 `npm.cmd test` 与 `npm.cmd run build:ui` 全绿；README 部署合同先暴露缺失的完整/快速部署表述，补齐后复验通过。无选区 800×900 捕获显示 `.shell` 收束到约 362px，最后卡片不再被空轨道拉伸。
- B596：更新检查必须读取安装包内 build-info 版本、只访问固定 GitHub API/Releases 地址、拒绝草稿与预发布、限制响应体积，并把“手动关闭 PowerPoint 后运行安装包”作为前端提示边界。
- B597：新增可见功能时，README、离线使用说明和仓库使用指南必须同时描述入口、结果动作和用户仍需执行的安装步骤。
- B598：更新检查合同必须覆盖固定地址、响应上限、正式版过滤、本机版本读取、前端按钮状态、宿主消息、手动安装提示和三处用户文档。
- B599：使用说明截图必须随新增顶栏动作更新；无选区和风格工作区示例应裁剪到实际卡片边界，保留真实状态色和中文提示。

## 关键里程碑

- B525-B540：科研绘图工作台从 28 种扩展到 36 种图表，并建立真实 Vega 运行时回归。
- B467-B474：Ribbon 收敛为 5 组唯一入口；安装合同覆盖当前用户、同版本覆盖和 ICE61/ICE91 定向抑制。
- B452-B466：离线图文说明、独立非模态使用说明窗口、窄窗和 PowerPoint 2013 以上兼容合同建立。
- B411-B446：任务窗格配色、按钮尺寸、按选区显示、功能边界和 SimpleExperiment 主题完成统一。
- B116：Zotero 图像库读取遵守冻结的外部 SQLite 与受限 bridge 协议。
