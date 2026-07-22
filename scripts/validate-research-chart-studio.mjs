import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const html = read("src/RoughPptAddin/ui/research-chart-studio.html");
const css = read("src/RoughPptAddin/ui/research-chart-studio.css");
const app = read("src/RoughPptAddin/ui/research-chart-studio.mjs");
const taskPaneApp = read("src/RoughPptAddin/ui/app.mjs");
const windowHost = read("src/RoughPptAddin/TaskPane/ResearchChartStudioWindow.cs");
const studioService = read("src/RoughPptAddin/Services/ResearchChartStudioService.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const bridge = read("src/RoughPptAddin/Services/RoughJsBridge.cs");
const bridgeContract = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const project = read("src/RoughPptAddin/RoughPptAddin.csproj");
const help = read("src/RoughPptAddin/ui/help.html");

const vendorFiles = [
  "vendor/papaparse.min.js",
  "vendor/papaparse-LICENSE.txt",
  "vendor/vega.min.js",
  "vendor/vega-lite.min.js",
  "vendor/vega-embed.min.js",
  "vendor/vega-LICENSES.txt"
];
const requiredFiles = [
  "research-chart-studio.html",
  "research-chart-studio.css",
  "research-chart-studio.mjs",
  ...vendorFiles
].map(file => `src/RoughPptAddin/ui/${file}`);
for (const file of [...requiredFiles, "src/RoughPptAddin/Services/ResearchChartStudioService.cs"]) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`科研绘图工作区资源缺失：${file}`);
}

for (const snippet of [
  "research-chart-studio.mjs",
  "vendor/papaparse.min.js",
  "vendor/vega.min.js",
  "vendor/vega-lite.min.js",
  "vendor/vega-embed.min.js",
  'id="dataEditor"',
  'id="downloadSvgButton"',
  'id="filterField"',
  'id="filterMode"',
  'id="filterValue"',
  'id="saveConfigButton"',
  'id="loadConfigButton"',
  'id="fullscreenButton"',
  'id="xScaleType"',
  'id="yScaleType"',
  'id="xDomainMin"',
  'id="yDomainMax"',
  'id="referenceX"',
  'id="referenceY"',
  'id="referenceXMin"',
  'id="referenceYMax"',
  'id="annotationText"',
  'id="annotationX"',
  'id="annotationY"',
  'id="showErrorBand"',
  'id="chartTypeGrid"',
  'id="chartSearch"',
  'id="chartCategory"',
  'id="chartSearchSummary"',
  'id="websiteList"',
  'id="selectSvgButton"',
  'id="insertButton"',
  'id="svgPreview"'
]) {
  if (!html.includes(snippet)) throw new Error(`科研绘图工作区 HTML 合同缺少：${snippet}`);
}
if ((html.match(/data-chart-type=/g) || []).length !== 30) throw new Error("科研绘图工作区必须保留 30 种图表入口。");
if (/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html)) throw new Error("科研绘图工作区运行时不得依赖外部 CDN。");
if (/gradient\s*\(/i.test(css)) throw new Error("科研绘图工作区不得使用渐变。");
if (/position\s*:\s*(?:fixed|sticky)/i.test(css)) throw new Error("科研绘图工作区不得用 fixed/sticky 遮挡滚动内容。");
for (const snippet of ["display: grid", "display: flex", "#5871ef", "min-height: 32px", ".svg-preview-wrap", "grid-template-columns: minmax(300px, 338px)"]) {
  if (!css.toLowerCase().includes(snippet)) throw new Error(`科研绘图工作区流式布局或主题合同缺少：${snippet}`);
}

for (const snippet of [
  "window.Papa?.parse",
  "window.vegaEmbed",
  'renderer: "svg"',
  "result.view.toSVG()",
  "new Blob",
  'type: "stageResearchSvg"',
  'type: "selectResearchSvg"',
  'type: "insertResearchSvg"',
  'message.type === "researchSvgStageResult"',
  'message.type === "researchSvgSelectionResult"',
  'message.type === "researchSvgInsertResult"',
  "pendingStageRequestId",
  "scheduleRender",
  'type: "researchChartStudioReady"',
  'type: "toggleResearchChartStudioFullscreen"',
  'message.type === "researchChartFullscreenResult"',
  'event.key === "F11"',
  'event.key === "Escape"'
]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图工作区脚本合同缺少：${snippet}`);
}
for (const snippet of ["CHART_CATEGORIES", "filterChartTypeButtons", "aria-hidden", "显示 ${visible} / ${Object.keys(CHART_LABELS).length} 种图表"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图入口发现性合同缺少：${snippet}`);
}
for (const snippet of ["scaleSpec", "axisKeyElements", "domainMin", "domainMax", "xReverse", "yReverse", "xTickFormat", "yTickFormat"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图坐标控制合同缺少：${snippet}`);
}
for (const snippet of ["errorBandLayer", "annotationLayers", "annotationDatum", 'type: "rule"', 'type: "rect"', 'type: "text"', "strokeDash", "showErrorBand"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图论文标注合同缺少：${snippet}`);
}
for (const chartType of ["bar", "groupedBar", "stackedBar", "horizontalBar", "line", "step", "area", "scatter", "bubble", "histogram", "boxplot", "density", "violin", "ecdf", "strip", "regression", "forest", "roc", "precisionRecall", "calibration", "blandAltman", "volcano", "funnel", "survival", "cumulativeHazard", "heatmap", "correlationMatrix", "parallelCoordinates", "donut", "polar"]) {
  if (!app.includes(`${chartType}:`)) throw new Error(`科研绘图脚本缺少图表类型：${chartType}`);
}
for (const snippet of ['id="facetField"', 'id="facetColumns"']) {
  if (!html.includes(snippet)) throw new Error(`科研绘图分面合同缺少：${snippet}`);
}
for (const snippet of ["density:", "regression:", 'state.chartType === "step" ? "step-after"', "facet:", "columns: facetColumns", "resolve:"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图扩展图形合同缺少：${snippet}`);
}
for (const snippet of ['state.chartType === "violin"', 'density: yField', 'stack: "center"', 'state.chartType === "ecdf"', 'op: "cume_dist"', 'state.chartType === "forest"', "requireIntervalFields", 'x2: { field: high }']) {
  if (!app.includes(snippet)) throw new Error(`科研绘图统计图合同缺少：${snippet}`);
}
for (const snippet of ['["roc", "precisionRecall", "calibration"]', "requireUnitIntervalField", "probabilityScale", 'x2: { datum: 1 }', 'y2: { datum: 1 }']) {
  if (!app.includes(snippet)) throw new Error(`科研绘图评估曲线合同缺少：${snippet}`);
}
for (const snippet of ['state.chartType === "blandAltman"', 'state.chartType === "volcano"', 'state.chartType === "funnel"', "requirePValueField", "__baDifference", "__baUpper", "__volcanoPValue", "__funnelUpper", "1.96"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图一致性或显著性图合同缺少：${snippet}`);
}
for (const snippet of ['state.chartType === "survival"', 'state.chartType === "cumulativeHazard"', "buildKaplanMeierRows", "eventStatus", "__kmAtRisk", "__kmCensored", 'interpolate: "step-after"', 'filter: "datum.__kmCensored > 0"', "data: { values: chartData }"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图生存分析合同缺少：${snippet}`);
}
for (const snippet of ['state.chartType === "correlationMatrix"', 'state.chartType === "parallelCoordinates"', "buildCorrelationRows", "pearsonCorrelation", "buildParallelCoordinateRows", "__correlationLabel", "__parallelNormalized", "至少需要三个数值字段"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图多变量图合同缺少：${snippet}`);
}
for (const snippet of ["CONFIG_STORAGE_KEY", "PERSISTED_CONTROL_IDS", "applyFilter", "state.rawRows", "localStorage.setItem", "localStorage.getItem", "captureConfig", "restoreConfig", "downloadCurrentSvg", "state.latestSvgText", 'link.download =', "resetSvgOutput"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图筛选、配置或 SVG 下载合同缺少：${snippet}`);
}
if (app.includes('controls.dataEditor') || app.includes('"dataEditor", "xField"')) throw new Error("科研绘图配置不得持久化原始数据。");
if (/toDataURL|toBlob\(|getImageData|drawImage|renderer\s*:\s*["']canvas/i.test(app)) throw new Error("科研绘图工作区不得捕获 Canvas 或生成位图。");
if ((app.match(/openWebsite\(/g) || []).length !== 2 || !app.includes('button.addEventListener("click", () => openWebsite(button.dataset.siteId))')) {
  throw new Error("外部绘图网站必须只由工作台内的显式按钮点击打开。");
}

const quickEntry = taskPaneApp.match(/function openResearchChartStudio\(\) \{[\s\S]*?\n\}/)?.[0] || "";
for (const snippet of ['postHost({ type: "openResearchChartStudio" })', 'if (action === "charts")', 'if (key === "charts")']) {
  if (!taskPaneApp.includes(snippet)) throw new Error(`任务窗格科研绘图入口合同缺少：${snippet}`);
}
if (!quickEntry || /openResearchChartWebsite|rawgraphs/i.test(quickEntry) || taskPaneApp.includes('type: "openResearchChartWebsite"')) {
  throw new Error("任务窗格科研绘图快捷入口不得触发网页跳转。");
}
if (!taskPane.includes('case "openResearchChartStudio":') || taskPane.includes('case "openResearchChartWebsite":')) {
  throw new Error("主任务窗格宿主只能打开本地科研绘图工作台，不得接受网站跳转消息。");
}

for (const snippet of ["ResearchChartStudioWindow", "research-chart-studio.html", "WebMessageReceived", "StageResearchSvg", "SelectResearchSvg", "InsertResearchSvg", "PostSvgStageResult", "PostSvgSelectionResult", "PostSvgInsertResult", "OpenResearchChartWebsite", "ToggleFullscreen", "ProcessCmdKey", "researchChartFullscreenResult"]) {
  if (!windowHost.includes(snippet)) throw new Error(`科研绘图工作台宿主合同缺少：${snippet}`);
}
for (const snippet of ["StageSvg(string svgText", "StageSvgBytes", "https://app.rawgraphs.io/", "https://app.datawrapper.de/", "https://chart-studio.plotly.com/", "https://vega.github.io/editor/", "UseShellExecute = true", "MaxSvgBytes = 4194304L", "DtdProcessing = DtdProcessing.Prohibit", "ForbiddenElements", "ComputeSha256", "Shapes.AddPicture", "PowerPoint 2016"]) {
  if (!studioService.includes(snippet)) throw new Error(`科研绘图网站或 SVG 安全合同缺少：${snippet}`);
}
for (const snippet of ["ShowResearchChartStudio", "researchChartStudioWindow?.Dispose()", "InsertZlkChart", "InsertResearchSvg", "InsertIntoCurrentSlide"]) {
  if (!controller.includes(snippet)) throw new Error(`科研绘图控制器合同缺少：${snippet}`);
}
for (const type of ["openResearchChartWebsite", "researchChartStudioReady", "toggleResearchChartStudioFullscreen", "stageResearchSvg", "selectResearchSvg", "insertResearchSvg"]) {
  if (!bridgeContract.includes(`${type}: "${type}"`)) throw new Error(`桥接合同缺少科研绘图消息：${type}`);
}
for (const file of ["research-chart-studio.html", "research-chart-studio.css", "research-chart-studio.mjs", ...vendorFiles]) {
  const windowsPath = file.replaceAll("/", "\\");
  if (!bridge.includes(file.split("/").at(-1)) || !project.includes(windowsPath)) throw new Error(`启动与构建资源清单缺少：${file}`);
}
if (!project.includes("Services\\ResearchChartStudioService.cs")) throw new Error("项目文件缺少科研 SVG 服务。");
for (const snippet of ["Vega Lite", "30 种图表", "相关矩阵", "并行坐标", "小提琴", "经验累积分布", "森林图", "ROC", "精确率召回", "校准曲线", "Bland", "火山图", "漏斗图", "Kaplan", "累计风险", "数据筛选", "保存配置", "下载 SVG", "实时预览", "同一份 SVG", "PowerPoint 2016", "插入 PPT", "不会自动打开浏览器"]) {
  if (!help.includes(snippet)) throw new Error(`使用说明缺少本地科研绘图内容：${snippet}`);
}

console.log("research chart studio contract ok");
