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

const requiredFiles = [
  "src/RoughPptAddin/ui/research-chart-studio.html",
  "src/RoughPptAddin/ui/research-chart-studio.css",
  "src/RoughPptAddin/ui/research-chart-studio.mjs",
  "src/RoughPptAddin/Services/ResearchChartStudioService.cs"
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`科研绘图工作区资源缺失：${file}`);
}

for (const snippet of ["research-chart-studio.mjs", "id=\"websiteList\"", "id=\"selectSvgButton\"", "id=\"insertButton\"", "id=\"svgPreview\""]) {
  if (!html.includes(snippet)) throw new Error(`科研绘图工作区 HTML 合同缺少：${snippet}`);
}
if (/https?:\/\//i.test(html)) throw new Error("科研绘图工作区运行时不得依赖外部 CDN。");
if (/vendor\/(?:chart|papaparse)/i.test(html)) throw new Error("科研绘图工作区不得继续加载本地 Chart.js 或 Papa Parse 编辑器。");
if (/gradient\s*\(/i.test(css)) throw new Error("科研绘图工作区不得使用渐变。");
for (const snippet of ["display: grid", "display: flex", "#5871ef", "min-height: 34px", ".svg-preview-wrap"]) {
  if (!css.toLowerCase().includes(snippet)) throw new Error(`科研绘图工作区流式布局或主题合同缺少：${snippet}`);
}
for (const snippet of ["rawgraphs", "datawrapper", "plotly", "vega", "openResearchChartWebsite", "selectResearchSvg", "insertResearchSvg", "new Blob", "image/svg+xml", "researchSvgSelectionResult", "researchSvgInsertResult"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图工作区脚本合同缺少：${snippet}`);
}
if (/window\.(?:Papa|Chart)|toHostDataset|chartCanvas/i.test(app)) throw new Error("科研绘图工作区仍包含旧本地图表渲染链路。");
for (const snippet of ["ResearchChartStudioWindow", "research-chart-studio.html", "WebMessageReceived", "SelectResearchSvg", "InsertResearchSvg", "PostSvgSelectionResult", "PostSvgInsertResult"]) {
  if (!windowHost.includes(snippet)) throw new Error(`科研绘图工作区宿主合同缺少：${snippet}`);
}
for (const snippet of ["https://app.rawgraphs.io/", "https://app.datawrapper.de/", "https://chart-studio.plotly.com/", "https://vega.github.io/editor/", "UseShellExecute = true", "MaxSvgBytes = 4194304L", "DtdProcessing = DtdProcessing.Prohibit", "ForbiddenElements", "ComputeSha256", "Shapes.AddPicture", "PowerPoint 2016"]) {
  if (!studioService.includes(snippet)) throw new Error(`科研绘图网站或 SVG 安全合同缺少：${snippet}`);
}
for (const snippet of ["ShowResearchChartStudio", "researchChartStudioWindow?.Dispose()", "InsertZlkChart", "InsertResearchSvg", "InsertIntoCurrentSlide"]) {
  if (!controller.includes(snippet)) throw new Error(`科研绘图控制器合同缺少：${snippet}`);
}
for (const snippet of ['case "openResearchChartStudio":', 'case "openResearchChartWebsite":']) {
  if (!taskPane.includes(snippet)) throw new Error(`任务窗格缺少科研绘图消息入口：${snippet}`);
}
for (const snippet of ["function openResearchChartStudio()", 'postHost({ type: "openResearchChartWebsite", siteId: "rawgraphs" })', 'postHost({ type: "openResearchChartStudio" })', 'if (action === "charts")', 'if (key === "charts")']) {
  if (!taskPaneApp.includes(snippet)) throw new Error(`任务窗格科研绘图跳转合同缺少：${snippet}`);
}
if (!bridgeContract.includes('openResearchChartWebsite: "openResearchChartWebsite"')) throw new Error("桥接合同缺少科研绘图网站消息。");
for (const file of ["research-chart-studio.html", "research-chart-studio.css", "research-chart-studio.mjs"]) {
  if (!bridge.includes(file) || !project.includes(file)) throw new Error(`启动与构建资源清单缺少：${file}`);
}
if (!project.includes("Services\\ResearchChartStudioService.cs")) throw new Error("项目文件缺少科研 SVG 服务。");
for (const snippet of ["RAWGraphs", "Datawrapper", "Plotly Chart Studio", "Vega Editor", "同一份 SVG", "PowerPoint 2016", "插入 PPT"]) {
  if (!help.includes(snippet)) throw new Error(`使用说明缺少科研绘图工作区内容：${snippet}`);
}

console.log("research chart studio contract ok");
