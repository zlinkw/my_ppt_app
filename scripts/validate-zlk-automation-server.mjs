import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const requireIncludes = (text, needle, label) => {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${needle}`);
  }
};

const csproj = read("src/RoughPptAddin/RoughPptAddin.csproj");
const server = read("src/RoughPptAddin/Services/AutomationServer.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const app = read("src/RoughPptAddin/ui/app.mjs");
const index = read("src/RoughPptAddin/ui/index.html");
const clusterImporter = read("src/RoughPptAddin/ui/zlk-cluster-result-importer.mjs");
const packageJson = read("package.json");

requireIncludes(csproj, 'Compile Include="Services\\AutomationServer.cs"', "csproj");
requireIncludes(csproj, 'Compile Include="Services\\PptZlkChartRenderer.cs"', "csproj");
requireIncludes(server, "/api/zlk-cluster/plot", "automation server route");
requireIncludes(server, "/health", "automation health route");
requireIncludes(server, "automation.json", "automation discovery");
requireIncludes(server, "automation.token", "automation token");
requireIncludes(server, "X-Rough-Ppt-Token", "cluster token header");
requireIncludes(server, "X-RoughPpt-Automation-Token", "cluster token header compatibility");
requireIncludes(server, "Authorization", "bearer token compatibility");
requireIncludes(server, '["busy"] = plotGate.CurrentCount == 0', "automation health busy state");
requireIncludes(server, "completedRequests.TryGetValue(requestId", "automation request replay cache");
requireIncludes(server, ' ["replayed"] = true'.trim(), "automation replay response marker");
requireIncludes(controller, "StartAutomationServer()", "controller startup");
requireIncludes(controller, "PlotZlkClusterAsync", "controller plot handler");
requireIncludes(controller, "MaxZlkSourceFiles = 64", "controller source file count guard");
if (!/MaxZlkSourceFileBytes\s*=\s*(?:2L\s*\*\s*1024L\s*\*\s*1024L|2097152L)/.test(controller)) {
  throw new Error("controller single source size guard: missing 2 MiB limit");
}
if (!/MaxZlkTotalSourceBytes\s*=\s*(?:12L\s*\*\s*1024L\s*\*\s*1024L|12582912L)/.test(controller)) {
  throw new Error("controller total source size guard: missing 12 MiB limit");
}
requireIncludes(controller, "Directory.EnumerateFiles", "controller lazy ZLK file enumeration");
requireIncludes(controller, "ZLK 绘图源文件过多", "controller Chinese source count error");
requireIncludes(taskPane, "normalizeZlkChartFile", "taskpane normalize message");
requireIncludes(taskPane, "insertZlkChart", "taskpane insert message");
requireIncludes(app, "normalizeZlkChartFilesForHost", "ui normalization");
requireIncludes(app, "importZlkClusterResultFile", "ui uses shared ZLK importer");
requireIncludes(clusterImporter, "buildChartRecommendations", "shared chart recommendations");
requireIncludes(index + app + taskPane, "SimpleExperiment 自动绘图", "SimpleExperiment primary connection copy");
requireIncludes(packageJson, "node scripts/validate-zlk-automation-server.mjs", "npm test");
requireIncludes(packageJson, "node scripts/validate-external-plugin-compat.mjs", "external compatibility validation in npm test");

console.log("[validate-zlk-automation-server] ok");
