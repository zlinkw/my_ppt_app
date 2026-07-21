# Zotero 外部数据库与通信协议

本文件是 Rough PPT Add-in 与 Zotero PDF Image Saver 的冻结对齐标准。修改 Zotero 插件、PPT 插件、验证脚本或部署路径前必须先按本文件核对。外部 SQLite 是唯一跨插件数据面；不得把 Zotero 内置数据库、HTTP bridge 或本地临时缓存作为论文图像库的数据源。完整图库界面由 Zotero 唯一维护，PPT 必须复用 Zotero 生成的完整图库界面；PPT 不得复制或重实现图库。

## 边界

- Zotero 插件负责采集论文图像、提取配色、写入外部 SQLite，并发布 locator 与可选 bridge 状态。
- PPT 插件只读外部 SQLite，负责搜索、预览、取色、插入参考图像和溯源操作。
- 禁止读取 Zotero 内置数据库；也禁止复制、锁定或推断 Zotero profile 内的 `zotero.sqlite`、`zotero.sqlite-wal`、`zotero.sqlite-shm` 及其 ADS 变体。
- Zotero 未运行时，PPT 仍必须能从外部 SQLite 预览、搜索、取色和插入已有参考图像。
- 对 PPT 插件，HTTP bridge 用于“打开 PDF / 定位 Zotero 条目”，并允许 PPT 以 `refreshLibrary` 请求重新生成并打开同一完整图库界面。Zotero 生成的本地图库可在同一受 token 保护的 endpoint 上执行软删除、分享和导入；不提供图片 HTTP 数据接口。PPT 不得发送 `deleteImages`、`exportImages`、`importImages`。bridge 不可用不得影响外部数据库的读操作。

## 完整图库界面复用合同

- Zotero 是完整图库界面的唯一所有者。图库 HTML、CSS、JavaScript、卡片、表格、筛选、排序、高清查看、批量选择、刷新、分享、导入和软删除均由 Zotero 生成页提供。PPT 不得复制或重实现图库。
- PPT 的“打开论文图片库”必须打开 Zotero 生成的 `paper-image-library.html`。PPT 必须复用 Zotero 生成的完整图库界面，不得在 PPT 仓库复制、改写或重实现完整图库界面。PPT 任务窗格可保留轻量 SQLite 快速搜索、取色和插入，不得把它扩展成第二套完整图库。
- 生成文件固定位于系统临时目录下的 `pdf-image-saver\paper-image-library-view\paper-image-library.html`，典型 Windows 路径为 `%TEMP%\pdf-image-saver\paper-image-library-view\paper-image-library.html`。PPT 必须使用系统临时目录 API 拼接路径，并验证路径仍在系统临时目录内。
- Zotero 运行且 bridge 就绪时，PPT 先发送 `refreshLibrary`，收到 `ok: true` 后再打开生成文件。PPT 不得把临时 HTML 或 `images` 目录作为 SQLite 数据源或长期图片缓存。
- Zotero 关闭时若生成文件仍存在，PPT 可以只读方式打开最后生成版本；刷新和管理按钮必须明确禁用或提示启动 Zotero。若文件不存在，PPT 显示中文恢复说明，不得生成另一份完整图库来替代。
- 默认浏览器打开与 WebView2 直接导航到同一个 `file:///` URI 均可；不得把生成页资源复制到 PPT 安装目录、注入第二套业务脚本或通过 DOM 选择器代替页面自身交互。

## 数据库定位

唯一数据库路径固定为 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`。禁止每台机器、每个 Zotero profile 或每次启动创建另一份共享库。

1. Zotero 插件只将共享 SQLite 写到该固定路径。
2. Zotero 插件发布 `%LOCALAPPDATA%\ZLK\paper-image-library\library.json`。
3. PPT 先校验 locator；无 locator、locator 无效、不安全或目标不存在时，回落到 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`。
4. 不提供环境变量、注册表、UI 输入框、Zotero preference 或其它路径覆盖。这样两端始终从同一个冻结发现规则取得数据库。

`library.json` 必须是 UTF-8 JSON，字段和值必须完全匹配：

```json
{
  "schemaVersion": 1,
  "databaseSchemaVersion": 2,
  "producer": "zotero-pdf-image-saver",
  "databasePath": "C:\\Users\\<user>\\AppData\\Local\\ZLK\\paper-image-library\\paper_images.sqlite",
  "updatedAt": "2026-07-14T12:00:00.000Z"
}
```

`databasePath` 必须精确等于该固定路径，不能指向 Zotero 内置数据库、其旁车文件或任意自定义目录。数据库完成事务提交并且文件可读后，才允许原子替换 locator。

## SQLite 兼容契约

PPT 以只读 SQLite 连接访问共享库。当前主表名为 `images`；迁移兼容时可保留 `paper_images`，但不要让旧表覆盖 `images`。PPT 的表选择顺序固定为 `images` -> `paper_images` -> 字段完整度最高的兼容候选表。

`images` 至少应发布以下字段，名称可保持 snake_case：

| 字段 | 用途 |
| --- | --- |
| `image_id` | 稳定图像主标识，用于 bridge 与溯源 |
| `image_blob` | 原始图像字节，PPT 插入参考图像时读取 |
| `thumbnail_blob` | 任务窗格预览，可缺失时降级 |
| `title`, `year`, `doi`, `page_number`, `created_at` | 搜索、排序和显示 |
| `source_region_key`, `preview_duplicate_key` | 稳定区域及重复预览溯源 |
| `parent_item_key`, `pdf_attachment_key` | Zotero 定位 fallback |
| `zotero_open_pdf_uri`, `zotero_select_item_uri`, `zotero_select_pdf_uri` | 仅允许 `zotero://` 白名单 URI |
| `library_id`, `library_type`, `group_id`, `bbox_json` | group library 与区域溯源 |
| `palette_json` | 图像内嵌配色兼容字段 |
| `image_category`, `color_family`, `style_tags_json` | 可选科研图片类别、色系与样式标签，用于筛选和搜索 |
| `quality`, `detector`, `rendered_width`, `rendered_height` | 可选采集质量、识别方式和已保存图像尺寸 |
| `dominant_hex`, `contrast_hex` | 可选主色与对比色 |
| `content_sha256` | 可选原图 SHA-256，用于分享完整性校验与重复导入拦截 |
| `origin_type`, `source_match_status`, `imported_at` | 可选来源、文献匹配状态与导入时间 |
| `deleted` 或 `is_deleted` | 存在时，活动记录必须为 `0` |

配色侧表固定为 `image_palette_swatches`，至少有 `image_id` 与 `hex`；建议附加 `swatch_index`、`role`。写入侧必须在同一 SQLite 事务中保持图像、配色与溯源字段一致。不要复用或重写已有 `image_id` 对应的不同图像内容。

上述可选元数据列属于 schema 2 的向后兼容扩展，不改变固定数据库路径、locator schema 或 `databaseSchemaVersion`。Zotero 全局浏览器图库只读同一数据库作为图片数据源，按记录读取有界 `image_blob` 并原样写入临时浏览文件，不读取 Zotero 内置数据库、不另建图库数据库，也不增加图片 HTTP endpoint。图库写操作只允许通过下文受 token 保护的固定 endpoint 执行软删除或经过校验的导入。

## 界面语言契约

- Zotero 与 PPT 插件的按钮、菜单、筛选项、提示、状态、错误、对话框、图库和元数据名称必须使用中文母语表达。PDF、PPT、DOI、Zotero、Python、JSON、SQLite、MB 与 KB 等必要专名和单位可保留。
- `image_category`、`quality`、`detector`、`color_family`、`style_tags_json` 等数据库字段及其内部英文值只用于存储和查询。显示前必须映射为中文，不得把 `metric_curve`、`manual_selection`、`unknown`、`ins-large` 等机器值直接呈现给用户。
- 论文标题、原始图注和用户自定义标签属于文献内容，可保留来源语言；插件自身的操作说明和错误反馈不得回退为未解释的英文。

## 统一通信方式

两端通信分为只读数据面和可选命令面，禁止其它私有端口、随机 endpoint、WebSocket、直接读取 Zotero profile 或未文档化的文件消息。

### 只读数据面

- 协议：SQLite 只读访问。
- 发现：只允许上文的 `library.json` 与固定 fallback 路径；locator 的 `databasePath` 不等于固定路径时必须 fail closed。
- 发布：Zotero 写端使用 SQLite 事务；PPT 读端不得写表、迁移 schema 或清理 bridge 状态。
- 失败：数据库不可用时，PPT 显示只读错误并保留已有 UI 状态；不得尝试访问 Zotero 内置数据库。

### 可选命令面

- endpoint：只允许 `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- `bridge_state` 存在于同一个共享 SQLite，结构为 `key TEXT PRIMARY KEY, value TEXT`。
- Zotero 发布 `token`、`status`、`endpoint` 三个 key。`endpoint` 只可为 `/pdf-image-saver/bridge` 或完整默认 URL；PPT 会忽略所有其它值。
- 请求使用 `application/x-www-form-urlencoded; charset=utf-8`，同时发送 header `X-Rough-Ppt-Token: <token>` 和表单字段 `token`、`command`、`image_id`。
- PPT 允许命令：`status`、`getStatus`、`openPdfByImageId`、`selectParentItemByImageId`、`selectPdfAttachmentByImageId`，以及仅用于复用完整图库界面的 `refreshLibrary`。PPT 将 `getStatus` 发送为 `status`，不得发送 `deleteImages`、`exportImages`、`importImages` 等图库管理命令。
- Zotero 生成的本地图库可额外发送 `deleteImages`、`exportImages`、`importImages`。`deleteImages` 接收 JSON 编码的 `image_ids` 并只设置外部库软删除标记；`exportImages` 和 `importImages` 必须在 Zotero 内使用原生文件选择器。三个命令均不得在 HTTP 响应或请求中传输图片字节。
- 本地图库从 `file://` 页面发起表单 POST 时可不发送 PPT 专用 header，但仍必须携带同一个 token。endpoint 可对该生成页返回 CORS 读取许可；所有命令继续执行 token 校验。
- 响应至少使用 JSON `ok`；建议保留 `registered`、`error`、`fallback_used` 和 `preview_duplicate_key`。`registered:false` 表示 bridge 不可用。
- token 为空或 status 表示 `disabled`、`shutdown`、`stopped`、`unregistered`、`invalid-shared-db-path` 时，PPT 不发 HTTP 请求，转为白名单 `zotero://open-pdf/...` 或 `zotero://select/...` fallback。
- bridge 返回 `Requested Zotero URI invalid` 时，PPT 不执行 URI，只复制 `image_id`、`parent_item_key`、`pdf_attachment_key`、`page_number`、`source_region_key` 等溯源信息。

## 图片分享与导入

- 文件扩展名为 `.pislib`，格式标识固定为 `paper-image-library-share/v1`，schema 为 1。JSON 可按 gzip 压缩，导入按文件头识别。
- 分享包包含原始图片字节、论文标题、年份、DOI、页码、采集时间、类别、配色、标签、清晰度、识别方式、尺寸和边界框等独立元数据。
- 分享包禁止包含 PDF 文件、Zotero 条目／附件、`parent_item_key`、`pdf_attachment_key`、`library_id`、`group_id` 或本机 `zotero://` URI。
- 导入必须校验图片类型、大小和 `content_sha256`，按内容哈希去重，不得用相同 `image_id` 覆盖不同图片。
- 文献匹配顺序固定为规范化 DOI 优先，唯一的规范化标题与年份其次。匹配成功后仅写入本机 Zotero 定位字段；无匹配时保留文献名称和独立图片元数据，并清空所有自动跳转字段。
- 新写入记录只在 `image_blob` 保存一份原始字节；`thumbnail_blob` 可为空，PPT 必须回落读取 `image_blob`。

## Zotero 插件变更清单

1. 先兼容本文件的字段、固定数据库路径、locator 与 bridge 请求，再新增字段或 UI。
2. schema 扩展采用向后兼容的可选列或新侧表；`databaseSchemaVersion` 变更前必须同步更新 PPT 端解析器和两端验证。
3. bridge 注册失败、共享路径不安全或插件关闭时，清空 token 并发布不可用状态；只能清理自身注册的 endpoint。
4. 每次修改后，验证 locator、外部 SQLite 读、Zotero 关闭后的 PPT 浏览、bridge 可用与不可用 fallback。
5. 不通过修改 PPT 仓库的兼容校验来掩盖 Zotero 仓库漂移；两端应按同一冻结契约修复。

## 当前安装审计

2026-07-16 本机固定路径的 SQLite 与 `library.json` 已初始化，当前 `images` 活动记录数为 0。首次确认保存论文图像后，Zotero 全局图库与 PPT 插件均从同一数据库读取；不得以额外路径或 Zotero 内置数据库绕过该数据面。

## 验证入口

PPT 仓库：`node scripts/validate-zotero-image-library.mjs`。

跨仓冻结对齐：`node scripts/validate-external-plugin-compat.mjs`。该检查报告外部 Zotero 源漂移时，应在 Zotero 插件按本协议修复，不应修改外部仓或放宽 PPT 校验。
