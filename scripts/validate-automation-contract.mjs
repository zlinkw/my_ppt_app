import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const project = read("src/RoughPptAddin/RoughPptAddin.csproj");
const automation = read("src/RoughPptAddin/Services/AutomationServer.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const app = read("src/RoughPptAddin/ui/app.mjs");
const contract = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const importer = read("src/RoughPptAddin/ui/zlk-cluster-result-importer.mjs");
const models = read("src/RoughPptAddin/Models/RoughModels.cs");
const renderer = read("src/RoughPptAddin/Services/PptZlkChartRenderer.cs");
const architecture = read("docs/ARCHITECTURE.md");
const validation = read("docs/VALIDATION.md");
const packageJson = read("package.json");

const violations = [];
const requireIncludes = (text, snippet, message) => {
  if (!text.includes(snippet)) violations.push(message);
};
const requirePattern = (text, pattern, message) => {
  if (!pattern.test(text)) violations.push(message);
};
const rejectIncludes = (text, snippet, message) => {
  if (text.includes(snippet)) violations.push(message);
};

for (const snippet of [
  "Services\\AutomationServer.cs",
  "Services\\PptZlkChartRenderer.cs",
  "Models\\RoughModels.cs"
]) {
  requireIncludes(project, snippet, `csproj missing ${snippet}`);
}

for (const snippet of [
  "HttpListener",
  "127.0.0.1",
  "automation.json",
  "automation.token",
  "X-Rough-Ppt-Token",
  "Environment.SpecialFolder.LocalApplicationData",
  "RoughPptAddin",
  "WriteErrorAsync(context, 401",
  "WriteErrorAsync(context, 409",
  "WriteErrorAsync(context, 405",
  "SemaphoreSlim",
  "plotGate.WaitAsync(0, cancel)",
  "已有 PPT 自动绘图请求正在执行，请等待完成后再试。",
  "plotGate.Release()",
  "Dispose()"
]) {
  requireIncludes(automation, snippet, `AutomationServer.cs missing ${snippet}`);
}
for (const forbidden of ["http://*", "http://+", "IPAddress.Any", "application.Quit()", ".Close("]) {
  rejectIncludes(automation, forbidden, `AutomationServer.cs must not use ${forbidden}`);
}

for (const snippet of [
  "automationServer.Start()",
  "automationServer?.Dispose()",
  "PlotZlkClusterAsync",
  "InsertZlkChart",
  "MaxZlkSourceFiles = 64",
  "Directory.EnumerateFiles",
  "ZLK 绘图源文件过多",
  "ZLK 绘图源文件过大",
  "ZLK 绘图源文件总量过大",
  "ResolveTargetPresentation",
  "createIfMissing",
  "Environment.ExpandEnvironmentVariables(target.PresentationPath",
  "string.IsNullOrWhiteSpace(presentationPath)",
  "Path.GetFullPath(presentationPath)",
  "PresentationPath(candidate)",
  "File.Exists(presentationPath)",
  "application.Presentations.Open(",
  "target.CreateIfMissing",
  "目标 PPT 不存在，且 createIfMissing 未开启"
]) {
  requireIncludes(controller, snippet, `RoughAddInController.cs missing ${snippet}`);
}
requirePattern(controller, /MaxZlkSourceFileBytes\s*=\s*(?:2L\s*\*\s*1024L\s*\*\s*1024L|2097152L)/, "RoughAddInController.cs missing 2 MiB source limit");
requirePattern(controller, /MaxZlkTotalSourceBytes\s*=\s*(?:12L\s*\*\s*1024L\s*\*\s*1024L|12582912L)/, "RoughAddInController.cs missing 12 MiB total source limit");
requirePattern(controller, /application\.Presentations\.Add\(\s*(?:Office\.MsoTriState\.msoTrue\s*)?\)/, "RoughAddInController.cs missing visible presentation creation");
requirePattern(controller, /\b\w+\.SaveAs\(presentationPath\)/, "RoughAddInController.cs missing new target SaveAs");
requirePattern(
  controller,
  /DefaultZlkSourcePatterns\(\)[\s\S]*?new List<string>\s*\{\s*"zlk_cluster\\\\results\\\\statistics\.json",\s*"paper\\\\tables"/,
  "RoughAddInController.cs must prioritize statistics.json and paper table sources"
);
rejectIncludes(controller, "application.Quit()", "controller must not quit PowerPoint");
rejectIncludes(controller, "Presentations.Open(presentationPath, Office.MsoTriState.msoFalse, Office.MsoTriState.msoFalse, Office.MsoTriState.msoFalse)", "target PPT must open visibly for append workflow");

for (const snippet of [
  "[\"type\"] = \"normalizeZlkChartFile\"",
  "NormalizeAndInsertZlkChartAsync",
  "ReadMessageValue<ChartDataset>",
  "zlkAutomationStatus"
]) {
  requireIncludes(taskPane, snippet, `RoughTaskPaneControl.cs missing ${snippet}`);
}
requirePattern(taskPane, /(?:type\s*==|case)\s*\"insertZlkChart\"/, "RoughTaskPaneControl.cs missing insertZlkChart dispatch");

for (const snippet of [
  "buildChartRecommendations",
  "importZlkClusterResultFile",
  "message.type === \"normalizeZlkChartFile\"",
  "postHost({",
  "type: \"insertZlkChart\"",
  "normalizeZlkChartFilesForHost",
  "zlkAutomationStatus"
]) {
  requireIncludes(app, snippet, `app.mjs missing ${snippet}`);
}

requireIncludes(contract, 'insertZlkChart: "insertZlkChart"', "bridge contract missing insertZlkChart");
for (const snippet of ["detectZlkClusterOutput", "importZlkClusterResultFile", "buildChartRecommendations"]) {
  requireIncludes(importer, snippet, `importer missing ${snippet}`);
}
for (const snippet of [
  "MarkdownSummary",
  "markdown_summary",
  "zlk_cluster/results/*.md",
  "Markdown 摘要页",
  "不作为数值图"
]) {
  requireIncludes(models + app + importer + architecture, snippet, `automation markdown summary contract missing ${snippet}`);
}

for (const snippet of ["ChartDataset", "ChartSeries", "ChartPoint", "ChartRecommendation", "ZlkClusterPlotRequest", "ZlkChartRenderResult"]) {
  requireIncludes(models, snippet, `models missing ${snippet}`);
}

for (const snippet of [
  "leaderboardBar",
  "meanStdErrorBar",
  "sensitivityCurve",
  "subgroupComparison",
  "caseLevelDistribution",
  "errorTypeSummary",
  "genericTable",
  "AddShape",
  "AddLine",
  "AddTextbox",
  "Group()"
]) {
  requireIncludes(renderer, snippet, `PptZlkChartRenderer.cs missing ${snippet}`);
}
const chartTypeLabelBlock = renderer.slice(
  renderer.indexOf("private static string ChartTypeLabel"),
  renderer.indexOf("private static string NormalizeChartType")
);
const renderChartTypeBlock = renderer.slice(
  renderer.indexOf("switch (chartType)"),
  renderer.indexOf("var group = GroupIfNeeded")
);
const normalizeChartTypeBlock = renderer.slice(
  renderer.indexOf("private static string NormalizeChartType"),
  renderer.indexOf("private static double? CiHalfWidth")
);
const lineChartBlock = renderer.slice(
  renderer.indexOf("private static void RenderLineChart"),
  renderer.indexOf("private static void RenderScatterChart")
);
const scatterChartBlock = renderer.slice(
  renderer.indexOf("private static void RenderScatterChart"),
  renderer.indexOf("private static void RenderTable")
);
const researchChartPresetBlock = app.slice(
  app.indexOf("const RESEARCH_CHART_PRESETS"),
  app.indexOf("function currentChartPreset")
);
const researchChartTypes = [...researchChartPresetBlock.matchAll(/chartType:\s*"([^"]+)"/g)]
  .map(match => match[1]);
if (!researchChartTypes.length) violations.push("app.mjs must expose research chart preset types");
for (const chartType of new Set(researchChartTypes)) {
  requireIncludes(normalizeChartTypeBlock, `case "${chartType}":`, `${chartType} UI preset must survive C# chart type normalization`);
  requireIncludes(renderChartTypeBlock, `case "${chartType}":`, `${chartType} UI preset must reach a native C# renderer branch`);
  requirePattern(chartTypeLabelBlock, new RegExp(`(?:case\\s+)?"${chartType}"\\s*(?::|=>)`), `${chartType} must expose a C# chart title`);
}
requirePattern(chartTypeLabelBlock, /(?:case\s+)?"scatterPlot"\s*(?::\s*return|=>)\s*"散点对比图"/, "scatterPlot must expose a Chinese chart title");
requireIncludes(lineChartBlock, "NumericXOf", "sensitivity curves must position numeric X values instead of using row order only");
requireIncludes(scatterChartBlock, "NumericXOf", "scatter plots must use the imported continuous X field");
rejectIncludes(scatterChartBlock, "var xValue = i;", "scatter plots must not discard the imported continuous X field");
if (/\}\?\$\{/.test(app)) {
  violations.push("app.mjs must not render question-mark separators between Chinese chart status fields");
}
for (const forbidden of ["AddPicture", ".Export(", "toDataURL", "<svg"]) {
  rejectIncludes(renderer, forbidden, `PptZlkChartRenderer.cs must not use ${forbidden}`);
}

for (const snippet of [
  "127.0.0.1",
  "%LOCALAPPDATA%\\RoughPptAddin\\automation.json",
  "automation.token",
  "X-Rough-Ppt-Token",
  "insertZlkChart",
  "zlk-cluster-result-importer.mjs"
]) {
  requireIncludes(architecture + validation, snippet, `docs missing ${snippet}`);
}

requireIncludes(packageJson, "node scripts/validate-automation-contract.mjs", "package.json npm test missing automation validation");
requireIncludes(packageJson, "node scripts/validate-external-plugin-compat.mjs", "package.json npm test missing external plugin compatibility validation");

if (violations.length) {
  throw new Error(`automation contract violations:\n${violations.join("\n")}`);
}

console.log("automation contract ok");
