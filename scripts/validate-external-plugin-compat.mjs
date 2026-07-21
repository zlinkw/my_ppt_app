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
    "MaxZlkSourceFileBytes = 2L * 1024L * 1024L",
    "MaxZlkTotalSourceBytes = 12L * 1024L * 1024L",
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
  if (local.controller.includes("Directory.GetFiles(workDirs") || local.controller.includes("Directory.GetFiles(wildcardRoot")) {
    violations.push("RoughAddInController.cs must not eagerly enumerate large ZLK work_dirs/wildcard trees");
  }
  requireIncludes(local.packageJson, "node scripts/validate-external-plugin-compat.mjs", "package.json npm test missing external compatibility validation");
  for (const snippet of [
    "MaxThumbnailBytes = 512 * 1024",
    "MaxImageBlobBytes = 25 * 1024 * 1024",
    "ReadImageRows(connection, table, BlobReadMode.None, MetadataReadLimit)",
    "AppendThumbnails(connection, table, filtered)",
    "ReadImageBlobStoredBytes",
    "论文图像过大，已超过"
  ]) {
    requireIncludes(local.zoteroService, snippet, `ZoteroImageLibraryService.cs missing Zotero image resource guard: ${snippet}`);
  }
}

function validateZlkClusterOrchestrator() {
  const zlkRoot = process.env.ZLK_CLUSTER_ORCHESTRATOR_ROOT || "D:\\GitRepo\\MCP\\zlk-cluster-orchestrator";
  if (!fs.existsSync(zlkRoot)) {
    notes.push("zlk external repo skipped");
    return;
  }
  const bridge = readExternal(zlkRoot, "src/PptPlotBridge.ts");
  const contract = readExternal(zlkRoot, "docs/output-contract-for-plotting.md");
  const runtime = readExternal(zlkRoot, "src/clusterAgentRuntime.ts");
  const targetPlan = readExternal(zlkRoot, "docs/target-mode-plan.md");
  const tests = optionalReadExternal(zlkRoot, "test/pptPlotBridge.test.js");
  const clusterRuntimeTests = optionalReadExternal(zlkRoot, "test/clusterRuntime.test.js");
  const fileTransferRuntimeTests = optionalReadExternal(zlkRoot, "test/agent/fileTransferRuntimeState.test.js");

  for (const snippet of [
    "schemaVersion: 1",
    "automation.json",
    "automation.token",
    "/health",
    "/api/zlk-cluster/plot",
    "Authorization",
    "X-RoughPpt-Automation-Token",
    "X-Rough-Ppt-Token",
    "createIfMissing: true",
    "slideMode: \"append\"",
    "styleMode",
    "activePpt",
    "activePlotRequests",
    "healthTimeoutMs",
    "postTimeoutMs",
    "AbortController",
    "slice(0, 24_000)"
  ]) {
    requireIncludes(bridge, snippet, `external ZLK PptPlotBridge.ts drift: missing ${snippet}`);
  }
  for (const snippet of [
    "discovery 固定为 `%LOCALAPPDATA%\\RoughPptAddin\\automation.json`",
    "token header 同时发送",
    "未来新增字段只能 additive",
    "缺少 `statistics`",
    "不扫描 raw dataset 或 checkpoint",
    "大文件不通过 automation server 传输"
  ]) {
    requireIncludes(contract, snippet, `external ZLK output contract drift: missing ${snippet}`);
  }
  for (const snippet of [
    "def transfer_status_path(root, transfer_id):",
    "safe_project_path(root, \"zlk_cluster/file_transfers/\" + safe_record_name(transfer_id))",
    "def state_child_path(root, folder, name):",
    "state_child_path(root, \"uploads\"",
    "def append_event(root, event):",
    "path_for(root, \"events.jsonl\")",
    "worker_command_path(root, worker_id)",
    "safe_project_path(root, f\"zlk_cluster/archive_manifests/{op_id}.json\")",
    "append_project_jsonl(root, \"zlk_cluster/deleted_experiments.jsonl\", rows)",
    "append_project_jsonl(root, \"zlk_cluster/deleted_scheduler_rows.jsonl\""
  ]) {
    requireIncludes(runtime, snippet, `external ZLK runtime state boundary drift: missing ${snippet}`);
  }
  for (const snippet of [
    "Agent runtime cache",
    "文件传输状态、归档 manifest、归档状态、删除墓碑、scheduler 项目临时状态必须留在当前项目",
    "Agent cache、事件和 Worker 命令队列才可进 runtime cache"
  ]) {
    requireIncludes(targetPlan, snippet, `external ZLK target plan state-boundary drift: missing ${snippet}`);
  }
  for (const snippet of [
    "PptPlotBridge rejects duplicate active request",
    "PptPlotBridge times out hung PPT automation requests",
    "PptPlotBridge rejects non 127.0.0.1 or localhost automation endpoints"
  ]) {
    requireIncludes(tests, snippet, `external ZLK pptPlotBridge.test.js drift: missing ${snippet}`);
  }
  for (const snippet of [
    "scheduler runtime keeps worker command cache in agent state and project state in project dir",
    "agent file transfer status is project-scoped and sanitized",
    "agent project ledgers stay project-scoped when agent state dir is external"
  ]) {
    requireIncludes(clusterRuntimeTests + fileTransferRuntimeTests, snippet, `external ZLK runtime state test drift: missing ${snippet}`);
  }

  for (const snippet of [
    "/api/zlk-cluster/plot",
    "/health",
    "Authorization",
    "Bearer ",
    "X-RoughPpt-Automation-Token",
    "X-Rough-Ppt-Token",
    "ReadBodyAsync(context.Request, 1024 * 1024",
    "MaxZlkSourceFiles",
    "MaxZlkSourceFileBytes",
    "MaxZlkTotalSourceBytes",
    "Directory.EnumerateFiles",
    "plotGate.WaitAsync(0, cancel)",
    "WriteErrorAsync(context, 409",
    "已有 PPT 自动绘图请求正在执行，请等待完成后再试。",
    "plotGate.Release()",
    "zlk-cluster-result-importer.mjs"
  ]) {
    requireIncludes(local.automation + local.controller + local.architecture + local.validation, snippet, `local PPT ZLK contract missing ${snippet}`);
  }
}

function validateZoteroImageSaver() {
  const zoteroRoot = process.env.ZOTERO_IMAGE_SAVER_ROOT || "D:\\GitRepo\\my_img_manager";
  if (!fs.existsSync(zoteroRoot)) {
    notes.push("zotero external repo skipped");
    return;
  }
  const saver = readExternal(zoteroRoot, "content/pdf-image-saver.js");
  const tests = readExternal(zoteroRoot, "tests/open-pdf-uri.test.js");

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
    "shared DB locator must use frozen library.json path",
    "locator schema version must be frozen at 1",
    "locator must advertise SQLite schema version 2",
    "locator must identify Zotero producer",
    "locator must reject relative DB paths",
    "locator must reject Zotero internal DB paths",
    "bridge invalid URI error text must stay stable for PPT classification"
  ]) {
    requireIncludes(tests, snippet, `external Zotero open-pdf-uri.test.js drift: missing ${snippet}`);
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
    "\"registered\":false",
    "Requested Zotero URI invalid",
    "image_palette_swatches",
    "PPT_ZOTERO_PREVIEW_DUPLICATE_KEY",
    "PreviewDuplicateKey = Pick(\"preview_duplicate_key\", \"previewDuplicateKey\")",
    "preview_duplicate_key=",
    "Shapes.AddPicture",
    "msoPicture"
  ]) {
    requireIncludes(local.zoteroResolver + local.zoteroService + local.zoteroBridge + local.architecture, snippet, `local PPT Zotero contract missing ${snippet}`);
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