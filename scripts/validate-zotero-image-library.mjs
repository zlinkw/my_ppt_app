import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const violations = [];

const models = read("src/RoughPptAddin/Models/RoughModels.cs");
const service = read("src/RoughPptAddin/Services/ZoteroImageLibraryService.cs");
const pathResolver = read("src/RoughPptAddin/Services/ZoteroImageLibraryPathResolver.cs");
const bridge = read("src/RoughPptAddin/Services/ZoteroBridgeClient.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const app = read("src/RoughPptAddin/ui/app.mjs");
const index = read("src/RoughPptAddin/ui/index.html");
const css = read("src/RoughPptAddin/ui/styles.css");
const contract = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const architecture = read("docs/ARCHITECTURE.md");
const externalDatabaseProtocol = read("docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md");
const sourceConstraints = read("scripts/validate-source-constraints.mjs");
const packageJson = JSON.parse(read("package.json"));
const targetPlan = read("docs/target-mode-plan.md");
const ribbon = read("src/RoughPptAddin/Ribbon/RoughRibbon.cs");

function requireIncludes(text, snippet, label) {
  if (!text.includes(snippet)) violations.push(label);
}

for (const model of ["ZoteroImageInfo", "ZoteroPaletteInfo", "ZoteroSwatchInfo", "ZoteroTraceInfo"]) {
  requireIncludes(models, `class ${model}`, `RoughModels.cs missing ${model}`);
}

for (const method of ["ListImages", "InsertImage", "GetPalette", "BuildPaletteGrid", "OpenPdfSource", "SelectParentItem", "CopyTraceIds"]) {
  requireIncludes(service, method, `ZoteroImageLibraryService missing ${method}`);
}

for (const snippet of [
  "Read Only=True",
  "FindImageTable",
  "ColumnMap",
  "thumbnail_blob",
  "image_blob",
  "image_palette_swatches",
  "ActiveRowsWhere",
  "CAST(COALESCE",
  "style_tags_json",
  "zotero_select_item_uri",
  "Shapes.AddPicture",
  "PPT_ZOTERO_IMAGE_ID",
  "PPT_ZOTERO_SOURCE_REGION_KEY",
  "PPT_ZOTERO_OPEN_PDF_URI",
  "PPT_ZOTERO_TITLE",
  "zotero://open-pdf",
  "zotero://select",
  "style_tags",
  "color_family"
]) {
  requireIncludes(service, snippet, `ZoteroImageLibraryService missing contract: ${snippet}`);
}
requireIncludes(pathResolver, 'DatabaseRelativePath = "ZLK\\\\paper-image-library\\\\paper_images.sqlite"', "Zotero database resolver missing fixed database path");
requireIncludes(pathResolver, "Environment.SpecialFolder.LocalApplicationData", "Zotero database resolver must anchor the fixed path in LOCALAPPDATA");

requireIncludes(service, "AppendSideTableSwatches", "ZoteroImageLibraryService must read image_palette_swatches side table");
requireIncludes(service, "ImageIdentityPredicate", "ZoteroImageLibraryService must resolve image_id/source_region_key identity");
requireIncludes(service, "SelectParentItemUri = FirstAllowedZoteroSelectUri(selectItemUri, selectPdfUri, BuildSelectUri(parentKey))", "Zotero select fallback must prefer a validated stored zotero_select_item_uri");

if (service.includes("zotero.sqlite")) {
  violations.push("ZoteroImageLibraryService must not read Zotero internal zotero.sqlite");
}

for (const method of ["GetStatus", "OpenPdfByImageId", "SelectParentItemByImageId"]) {
  requireIncludes(bridge, method, `ZoteroBridgeClient missing ${method}`);
}
for (const snippet of [
  "RefreshLibraryResult",
  'SendActionResult("refreshLibrary"',
  'IsAllowedBridgeEndpoint(endpoint)',
  'X-Rough-Ppt-Token'
]) {
  requireIncludes(bridge, snippet, `ZoteroBridgeClient missing complete-library bridge contract: ${snippet}`);
}
for (const forbidden of ['SendActionResult("deleteImages"', 'SendActionResult("exportImages"', 'SendActionResult("importImages"']) {
  if (bridge.includes(forbidden)) violations.push(`PPT bridge must not send Zotero management command: ${forbidden}`);
}
requireIncludes(bridge, "/pdf-image-saver/bridge", "ZoteroBridgeClient missing PDF Image Saver bridge endpoint");
requireIncludes(service, "bridgeClient.OpenPdfByImageId", "Open PDF must prefer bridge before URI fallback");
requireIncludes(service, 'TryShellExecuteZoteroUri(trace.ZoteroOpenPdfUri, "zotero://open-pdf")', "Open PDF must safely fallback to zotero_open_pdf_uri");
requireIncludes(service, "Clipboard.SetText(BuildTraceText(trace))", "Trace copy fallback missing");

for (const type of [
  "listZoteroImages",
  "getZoteroPalette",
  "insertZoteroImage",
  "openZoteroImagePdf",
  "selectZoteroImageItem",
  "copyZoteroTraceIds",
  "applyZoteroSwatch",
  "copyZoteroSwatchHex"
]) {
  requireIncludes(contract, `${type}: "${type}"`, `bridge-contract missing ${type}`);
  requireIncludes(taskPane, `case "${type}":`, `TaskPane missing handler ${type}`);
  requireIncludes(app, `type: "${type}"`, `app.mjs missing postHost ${type}`);
}

for (const snippet of [
  "GetPaletteByImageId",
  "activeZoteroReferenceImageId",
  "activeZoteroPaletteSaved",
  "skipReferenceChangePromptForSession",
  "覆盖未保存的参考图配色？",
  "本次 PowerPoint 会话不再询问",
  'type: "saveZoteroPalette", imageId:',
  'message.type === "zoteroPaletteSaved"'
]) {
  requireIncludes(service + app + taskPane, snippet, `single-image Zotero palette contract missing: ${snippet}`);
}
if (/localStorage[^\n]*(?:skipReferenceChangePromptForSession|ZoteroReference)/i.test(app)) {
  violations.push("Zotero reference change prompt preference must remain in current PowerPoint session memory");
}

for (const snippet of [
  "OpenPaperImageLibrary",
  'Path.Combine(tempRoot, "pdf-image-saver", "paper-image-library-view", "paper-image-library.html")',
  'Path.GetFileName(libraryPath), "paper-image-library.html"',
  "zoteroImages.RefreshFullLibrary()",
  "已只读打开上次生成的论文图片库",
  "尚未生成论文图片库",
  "openPaperImageLibrary",
  "打开论文图片库"
]) {
  requireIncludes(controller + ribbon, snippet, `PPT complete-library reuse contract missing: ${snippet}`);
}

for (const hostType of ["zoteroImages", "zoteroPalette", "zoteroTraceStatus"]) {
  requireIncludes(taskPane, `["type"] = "${hostType}"`, `TaskPane missing host response ${hostType}`);
  requireIncludes(app, `message.type === "${hostType}"`, `app.mjs missing host response handler ${hostType}`);
}

for (const snippet of [
  "论文图像与配色库",
  "zoteroImageSearch",
  "zoteroImageReload",
  "zoteroPaletteGrid",
  "zoteroImageGrid",
  "zoteroSwatchContextMenu",
  "打开 PDF",
  "定位条目",
  "复制溯源编号",
  "复制 HEX",
  "设为描边",
  "设为填充",
  "设为渐变起点",
  "设为渐变终点"
]) {
  requireIncludes(index + app, snippet, `UI missing Zotero image library text/hook: ${snippet}`);
}

for (const snippet of [
  ".zotero-image-panel",
  ".zotero-palette-grid",
  ".zotero-swatch-menu",
  ".zotero-image-card"
]) {
  requireIncludes(css, snippet, `styles.css missing Zotero image library style: ${snippet}`);
}
if (!/\.zotero-palette-grid[\s\S]*?grid-template-rows:\s*repeat\(7,\s*(?:16|18)px\)/.test(css)) {
  violations.push("styles.css missing seven-row Zotero palette grid");
}

for (const snippet of [
  "Zotero 论文图像是显式参考图像例外",
  "msoPicture",
  "不读取 Zotero 内部 `zotero.sqlite`",
  "Zotero 关闭时仍可预览",
  "bridge 只用于打开来源 PDF 或定位条目"
]) {
  requireIncludes(architecture, snippet, `ARCHITECTURE.md missing Zotero exception: ${snippet}`);
}

requireIncludes(sourceConstraints, "Zotero reference image exception", "source constraint must validate Zotero image exception");
requireIncludes(sourceConstraints, "ZoteroImageLibraryService", "source constraint must isolate AddPicture exception to Zotero service");

for (const snippet of [
  "唯一数据库路径固定为 `%LOCALAPPDATA%\\ZLK\\paper-image-library\\paper_images.sqlite`",
  "不提供环境变量、注册表、UI 输入框、Zotero preference 或其它路径覆盖",
  "`image_category`, `color_family`, `style_tags_json`",
  "`quality`, `detector`, `rendered_width`, `rendered_height`",
  "`content_sha256`",
  "`origin_type`, `source_match_status`, `imported_at`",
  "Zotero 全局浏览器图库只读同一数据库",
  "界面语言契约",
  "显示前必须映射为中文",
  "插件自身的操作说明和错误反馈不得回退为未解释的英文",
  "bridge 用于“打开 PDF / 定位 Zotero 条目”",
  "POST http://127.0.0.1:23119/pdf-image-saver/bridge",
  "bridge_state",
  "paper-image-library-share/v1",
  "`deleteImages`、`exportImages`、`importImages`",
  "完整图库界面由 Zotero 唯一维护",
  "PPT 必须复用 Zotero 生成的完整图库界面",
  "paper-image-library.html",
  "refreshLibrary",
  "PPT 不得复制或重实现图库",
  "PPT 不得发送 `deleteImages`、`exportImages`、`importImages`",
  "pdf-image-saver\\paper-image-library-view\\paper-image-library.html",
  "规范化 DOI 优先",
  "thumbnail_blob` 可为空",
  "zotero.sqlite"
]) {
  requireIncludes(externalDatabaseProtocol, snippet, `ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md missing frozen contract: ${snippet}`);
}

for (const method of [
  "ListZoteroImages",
  "GetZoteroPalette",
  "InsertZoteroImage",
  "OpenZoteroImagePdf",
  "SelectZoteroImageItem",
  "CopyZoteroTraceIds",
  "ApplyZoteroSwatch"
]) {
  requireIncludes(controller, method, `RoughAddInController missing ${method}`);
}

requireIncludes(targetPlan, "每个实现批次开始前必须重新读取 `D:\\GitRepo\\my_img_manager`", "target plan missing per-batch Zotero git refresh constraint");
if (!/(?:批次\s*116|B116)/.test(targetPlan)) violations.push("target plan missing batch 116 record");
requireIncludes(packageJson.scripts.test, "node scripts/validate-zotero-image-library.mjs", "package.json npm test must include Zotero image library validation");
requireIncludes(packageJson.scripts.test, "node scripts/validate-zlk-cluster-result-importer.mjs", "npm test must still include interrupted ZLK importer validation");

if (violations.length) {
  throw new Error(`Zotero image library validation failed:\n${violations.join("\n")}`);
}

console.log("zotero image library contract ok");
