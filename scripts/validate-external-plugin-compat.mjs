import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];
const notes = [];

const local = {
  automation: readLocal("src/RoughPptAddin/Services/AutomationServer.cs"),
  controller: readLocal("src/RoughPptAddin/Services/RoughAddInController.cs"),
  zoteroResolver: readLocal("src/RoughPptAddin/Services/ZoteroImageLibraryPathResolver.cs"),
  zoteroService: readLocal("src/RoughPptAddin/Services/ZoteroImageLibraryService.cs"),
  zoteroBridge: readLocal("src/RoughPptAddin/Services/ZoteroBridgeClient.cs"),
  ribbon: readLocal("src/RoughPptAddin/Ribbon/RoughRibbon.cs"),
  architecture: readLocal("docs/ARCHITECTURE.md"),
  validation: readLocal("docs/VALIDATION.md"),
  packageJson: readLocal("package.json"),
};

validateLocalResourceGuards();
validateZlkClusterOrchestrator();
validateZoteroImageSaver();

if (violations.length) {
  throw new Error(`external plugin compatibility validation failed:\n${violations.join("\n")}`);
}

console.log(`external plugin compatibility ok${notes.length ? ` (${notes.join("; ")})` : ""}`);

function validateLocalResourceGuards() {
  for (const snippet of [
    "MaxZlkSourceFiles = 64",
    "Directory.EnumerateFiles",
    "ZLK 绘图源文件过多",
    "ZLK 绘图源文件过大",
    "ZLK 绘图源文件总量过大",
    "请缩小 sourcePaths",
    "请传入轻量 summary、statistics 或表格文件",
    "请减少 sourcePaths 或导出轻量结果"
  ]) {
    requireIncludes(local.controller, snippet, `RoughAddInController.cs missing ZLK resource guard: ${snippet}`);
  }
  if (!/MaxZlkSourceFileBytes\s*=\s*(?:2L\s*\*\s*1024L\s*\*\s*1024L|2097152L)/.test(local.controller)) {
    violations.push("RoughAddInController.cs missing 2 MiB ZLK source guard");
  }
  if (!/MaxZlkTotalSourceBytes\s*=\s*(?:12L\s*\*\s*1024L\s*\*\s*1024L|12582912L)/.test(local.controller)) {
    violations.push("RoughAddInController.cs missing 12 MiB ZLK total source guard");
  }
  if (local.controller.includes("Directory.GetFiles(workDirs") || local.controller.includes("Directory.GetFiles(wildcardRoot")) {
    violations.push("RoughAddInController.cs must not eagerly enumerate large ZLK work_dirs/wildcard trees");
  }
  requireIncludes(local.packageJson, "node scripts/validate-external-plugin-compat.mjs", "package.json npm test missing external compatibility validation");
  for (const snippet of [
    "AppendThumbnails(connection, table, filtered)",
    "ReadImageBlobStoredBytes",
    "论文图像过大，已超过"
  ]) {
    requireIncludes(local.zoteroService, snippet, `ZoteroImageLibraryService.cs missing Zotero image resource guard: ${snippet}`);
  }
  requirePattern(local.zoteroService, /MaxThumbnailBytes\s*=\s*(?:512\s*\*\s*1024|524288)/, "ZoteroImageLibraryService.cs missing 512 KiB thumbnail guard");
  requirePattern(local.zoteroService, /MaxImageBlobBytes\s*=\s*(?:25\s*\*\s*1024\s*\*\s*1024|26214400)/, "ZoteroImageLibraryService.cs missing 25 MiB image guard");
  requirePattern(local.zoteroService, /ReadImageRows\(connection,\s*table,\s*BlobReadMode\.None,\s*(?:MetadataReadLimit|400)\)/, "ZoteroImageLibraryService.cs missing bounded metadata read");
}

function validateZlkClusterOrchestrator() {
  const zlkRoot = process.env.ZLK_CLUSTER_ORCHESTRATOR_ROOT || "D:\\GitRepo\\MCP\\zlk-cluster-orchestrator";
  if (!fs.existsSync(zlkRoot)) {
    notes.push("zlk external repo skipped");
    return;
  }
  if (!fs.existsSync(path.join(zlkRoot, ".git"))) {
    notes.push("zlk external repo has no auditable Git baseline");
    return;
  }
  if (!fs.existsSync(path.join(zlkRoot, "src/PptPlotBridge.ts"))) {
    notes.push("zlk external repo unavailable");
    return;
  }
  // PptPlotBridge.ts 已重构为 7 行 facade (export * from "./PptPlotBridge.legacy")，
  // 真实现在 524 行 PptPlotBridge.legacy.ts；拼接校验避免口径过严误报，阈值不变。
  // legacy 用 readExternal（缺失记 violations），勿用 optionalReadExternal。
  const bridge = readExternal(zlkRoot, "src/PptPlotBridge.ts") + "\n" + readExternal(zlkRoot, "src/PptPlotBridge.legacy.ts");
  const contract = readExternal(zlkRoot, "docs/output-contract-for-plotting.md");
  for (const snippet of [
    "schemaVersion: 1",
    "automation.json",
    "automation.token",
    "/health",
    "/api/simple-experiment/plot",
    "Authorization",
    "X-RoughPpt-Automation-Token",
    "X-Rough-Ppt-Token",
    "createIfMissing: true",
    "slideMode: \"append\"",
    "styleMode",
    "activePpt",
    "slice(0, 24_000)"
  ]) {
    requireIncludes(bridge, snippet, `external ZLK PptPlotBridge.ts drift: missing ${snippet}`);
  }
  for (const snippet of [
    "simple_cluster/results/statistics.json",
    "paper/tables/simple_results_table.csv",
    "原始数据集",
    "checkpoint",
    "不通过绘图契约传输"
  ]) {
    requireIncludes(contract, snippet, `external ZLK output contract drift: missing ${snippet}`);
  }

  for (const snippet of [
    "/api/simple-experiment/plot",
    "/api/zlk-cluster/plot",
    "/health",
    "Authorization",
    "Bearer ",
    "X-RoughPpt-Automation-Token",
    "X-Rough-Ppt-Token",
    "MaxZlkSourceFiles",
    "MaxZlkSourceFileBytes",
    "MaxZlkTotalSourceBytes",
    "Directory.EnumerateFiles",
    "plotGate.WaitAsync(0, cancel)",
    "WriteErrorAsync(context, 409",
    "已有 PPT 自动绘图请求正在执行，请等待完成后再试。",
    "plotGate.Release()",
    "zlk-cluster-result-importer.mjs",
    "completedRequests.TryGetValue(requestId",
    "CacheCompletedRequest(requestId, requestFingerprint, payload)",
    "SimpleExperiment 自动绘图"
  ]) {
    requireIncludes(local.automation + local.controller + local.architecture + local.validation, snippet, `local PPT ZLK contract missing ${snippet}`);
  }
  requirePattern(local.automation, /ReadBodyAsync\(context\.Request,\s*(?:1024\s*\*\s*1024|1048576)/, "local PPT ZLK contract missing 1 MiB request body guard");
}

function validateZoteroImageSaver() {
  const zoteroRoot = process.env.ZOTERO_IMAGE_SAVER_ROOT || "D:\\GitRepo\\my_img_manager";
  if (!fs.existsSync(zoteroRoot)) {
    notes.push("zotero external repo skipped");
    return;
  }
  const saver = readExternal(zoteroRoot, "content/pdf-image-saver.js");
  const tests = readExternal(zoteroRoot, "tests/open-pdf-uri.test.js");
  const accessProtocol = readExternal(zoteroRoot, "docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md");

  for (const snippet of [
    "SHARED_DB_SCHEMA_VERSION = 2",
    "SHARED_LIBRARY_LOCATOR_FILE_NAME = \"library.json\"",
    "SHARED_LIBRARY_LOCATOR_SCHEMA_VERSION = 1",
    "SHARED_LIBRARY_LOCATOR_PRODUCER = \"zotero-pdf-image-saver\"",
    "safeWriteSharedDatabaseLocator",
    "buildSharedDatabaseLocatorRecord",
    "databaseSchemaVersion",
    "databasePath",
    "producer",
    "updatedAt",
    "BRIDGE_ENDPOINT = \"/pdf-image-saver/bridge\"",
    "BRIDGE_STATUS_COMMANDS = [\"status\", \"getStatus\"]",
    "safeWriteBridgeState(\"token\", \"\")",
    "safeWriteBridgeState(\"status\"",
    "openPdfByImageId",
    "selectParentItemByImageId",
    "selectPdfAttachmentByImageId",
    "Requested Zotero URI invalid",
    "CREATE TABLE IF NOT EXISTS images",
    "source_region_key TEXT NOT NULL UNIQUE",
    "preview_duplicate_key TEXT",
    "CREATE TABLE IF NOT EXISTS image_palette_swatches",
    "CREATE TABLE IF NOT EXISTS bridge_state"
  ]) {
    requireIncludes(saver, snippet, `external Zotero pdf-image-saver.js drift: missing ${snippet}`);
  }
  for (const snippet of [
    'GLOBAL_LIBRARY_VIEW_VERSION = "37"',
    'GLOBAL_LIBRARY_DIRECTORY_NAME = "paper-image-library-view"',
    'command === "refreshLibrary"',
    'openGlobalImageLibrary'
  ]) {
    requireIncludes(saver, snippet, `external Zotero full-library contract drift: missing ${snippet}`);
  }
  for (const snippet of [
    "PPT 插件必须复用 Zotero 生成的完整图库界面",
    "%TEMP%\\pdf-image-saver\\paper-image-library-view\\paper-image-library.html"
  ]) {
    requireIncludes(accessProtocol, snippet, `external Zotero access protocol drift: missing ${snippet}`);
  }
  for (const command of ["deleteImages", "exportImages", "importImages"]) {
    requirePattern(accessProtocol, new RegExp(`(?:禁止 PPT 发送|PPT 不得(?:直接)?发送)[^\\n]*${command}`), `external Zotero access protocol drift: PPT boundary missing ${command}`);
  }
  for (const snippet of [
    "SHARED_LIBRARY_LOCATOR_FILE_NAME = \"library.json\"",
    "SHARED_LIBRARY_LOCATOR_SCHEMA_VERSION = 1",
    "SHARED_DB_SCHEMA_VERSION = 2",
    "SHARED_LIBRARY_LOCATOR_PRODUCER = \"zotero-pdf-image-saver\"",
    "isSafeAbsoluteSharedDatabasePath",
    "isZoteroInternalDatabasePath",
    'error: "Requested Zotero URI invalid"'
  ]) {
    requireIncludes(saver, snippet, `external Zotero locator/bridge contract drift: missing ${snippet}`);
  }

  for (const snippet of [
    "LibraryLocatorRelativePath = \"ZLK\\\\paper-image-library\\\\library.json\"",
    "DatabaseSchemaVersion = 2",
    "LocatorSchemaVersion = 1",
    "LocatorProducer = \"zotero-pdf-image-saver\"",
    "ReadLibraryLocatorDatabasePath",
    "DateTimeOffset.TryParse",
    "ZoteroImageLibraryPathResolver.ResolveDatabasePath()",
    "/pdf-image-saver/bridge",
    "bridge_state",
    "ReadBridgeState(\"status\")",
    "IsBridgeDisabledState(token, status)",
    'string.Equals(status?.Trim(), "ready", StringComparison.OrdinalIgnoreCase)',
    'HasJsonKey(text, "ok")',
    'ExtractJsonBool(text, "ok")',
    "Requested Zotero URI invalid",
    "image_palette_swatches",
    "PPT_ZOTERO_PREVIEW_DUPLICATE_KEY",
    "PreviewDuplicateKey = Pick(\"preview_duplicate_key\", \"previewDuplicateKey\")",
    "Shapes.AddPicture",
    "msoPicture"
  ]) {
    requireIncludes(local.zoteroResolver + local.zoteroService + local.zoteroBridge + local.architecture, snippet, `local PPT Zotero contract missing ${snippet}`);
  }
  requirePattern(local.zoteroBridge, /HasRegisteredField\s*=\s*HasJsonKey\(text,\s*"registered"\)[\s\S]*?Registered\s*=\s*ExtractJsonBool\(text,\s*"registered"\)[\s\S]*?HasRegisteredField\s*&&\s*!result\.Registered/, "local PPT Zotero contract missing registered:false handling");
  requireIncludes(local.zoteroBridge + local.zoteroService, 'ExtractJsonString(text, "preview_duplicate_key")', "local PPT Zotero contract missing preview_duplicate_key response parsing");
  for (const snippet of [
    "RefreshLibraryResult",
    'SendActionResult("refreshLibrary"',
    "OpenPaperImageLibrary",
    "openPaperImageLibrary",
    "paper-image-library-view",
    "paper-image-library.html"
  ]) {
    requireIncludes(local.zoteroBridge + local.controller + local.ribbon, snippet, `local PPT complete-library reuse missing ${snippet}`);
  }
  for (const forbidden of ['SendActionResult("deleteImages"', 'SendActionResult("exportImages"', 'SendActionResult("importImages"']) {
    if (local.zoteroBridge.includes(forbidden)) violations.push(`local PPT bridge must not send ${forbidden}`);
  }
}

function readLocal(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function readExternal(base, relative) {
  const file = path.join(base, relative);
  if (!fs.existsSync(file)) {
    violations.push(`external file missing: ${file}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function optionalReadExternal(base, relative) {
  const file = path.join(base, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function requireIncludes(text, snippet, label) {
  if (!String(text || "").includes(snippet)) violations.push(label);
}

function requirePattern(text, pattern, label) {
  if (!pattern.test(String(text || ""))) violations.push(label);
}
