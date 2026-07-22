import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const html = read("src/RoughPptAddin/ui/research-chart-studio.html");
const css = read("src/RoughPptAddin/ui/research-chart-studio.css");
const app = read("src/RoughPptAddin/ui/research-chart-studio.mjs");
const taskPaneApp = read("src/RoughPptAddin/ui/app.mjs");
const windowHost = read("src/RoughPptAddin/TaskPane/ResearchChartStudioWindow.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const bridge = read("src/RoughPptAddin/Services/RoughJsBridge.cs");
const project = read("src/RoughPptAddin/RoughPptAddin.csproj");
const help = read("src/RoughPptAddin/ui/help.html");

const requiredFiles = [
  "src/RoughPptAddin/ui/research-chart-studio.html",
  "src/RoughPptAddin/ui/research-chart-studio.css",
  "src/RoughPptAddin/ui/research-chart-studio.mjs",
  "src/RoughPptAddin/ui/vendor/chart.umd.min.js",
  "src/RoughPptAddin/ui/vendor/chartjs-LICENSE.md",
  "src/RoughPptAddin/ui/vendor/papaparse.min.js",
  "src/RoughPptAddin/ui/vendor/papaparse-LICENSE.txt"
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`科研绘图工作区资源缺失：${file}`);
}

for (const snippet of ["vendor/chart.umd.min.js", "vendor/papaparse.min.js", "research-chart-studio.mjs", "id=\"insertButton\"", "id=\"chartTypes\""]) {
  if (!html.includes(snippet)) throw new Error(`科研绘图工作区 HTML 合同缺少：${snippet}`);
}
if (/https?:\/\//i.test(html)) throw new Error("科研绘图工作区运行时不得依赖外部 CDN。");
if (/gradient\s*\(/i.test(css)) throw new Error("科研绘图工作区不得使用渐变。");
for (const snippet of ["display: grid", "display: flex", "#5871ef", "min-height: 34px"]) {
  if (!css.toLowerCase().includes(snippet)) throw new Error(`科研绘图工作区流式布局或主题合同缺少：${snippet}`);
}
for (const snippet of ["window.Papa", "window.Chart", "leaderboardBar", "sensitivityCurve", "scatterPlot", "subgroupComparison", "meanStdErrorBar", "caseLevelDistribution", "genericTable", "insertResearchChart", "toHostDataset"]) {
  if (!app.includes(snippet)) throw new Error(`科研绘图工作区脚本合同缺少：${snippet}`);
}
for (const snippet of ["ResearchChartStudioWindow", "research-chart-studio.html", "WebMessageReceived", "insertChart(dataset, spec, request)", "researchChartInsertResult"]) {
  if (!windowHost.includes(snippet)) throw new Error(`科研绘图工作区宿主合同缺少：${snippet}`);
}
for (const snippet of ["ShowResearchChartStudio", "researchChartStudioWindow?.Dispose()", "InsertZlkChart"]) {
  if (!controller.includes(snippet)) throw new Error(`科研绘图控制器合同缺少：${snippet}`);
}
if (!taskPane.includes('case "openResearchChartStudio":')) throw new Error("任务窗格缺少科研绘图工作区消息入口。");
for (const snippet of ["function openResearchChartStudio()", 'postHost({ type: "openResearchChartStudio" })', 'if (action === "charts")', 'if (key === "charts")']) {
  if (!taskPaneApp.includes(snippet)) throw new Error(`任务窗格科研绘图跳转合同缺少：${snippet}`);
}
for (const file of ["research-chart-studio.html", "research-chart-studio.css", "research-chart-studio.mjs", "chart.umd.min.js", "papaparse.min.js"]) {
  if (!bridge.includes(file) || !project.includes(file)) throw new Error(`启动与构建资源清单缺少：${file}`);
}
for (const snippet of ["Papa Parse", "Chart.js", "同一 CSV", "插入 PPT"]) {
  if (!help.includes(snippet)) throw new Error(`使用说明缺少科研绘图工作区内容：${snippet}`);
}

console.log("research chart studio contract ok");
