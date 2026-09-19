import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import * as vega from "vega";
import * as vegaLite from "vega-lite";

const html = fs.readFileSync("src/RoughPptAddin/ui/research-chart-studio.html", "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://rough-ppt.local/research-chart-studio.html" });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.Blob = window.Blob;

let blobIndex = 0;
window.URL.createObjectURL = () => `blob:research-chart-${++blobIndex}`;
window.URL.revokeObjectURL = () => {};
globalThis.URL = window.URL;

const hostMessages = [];
let receiveHostMessage;
window.chrome = { webview: {
  postMessage: message => hostMessages.push(message),
  addEventListener: (type, listener) => { if (type === "message") receiveHostMessage = listener; }
} };

window.eval(fs.readFileSync("src/RoughPptAddin/ui/vendor/papaparse.min.js", "utf8"));

const rendered = [];
let activeChartType = "initial";
let lastRenderError = null;
window.vegaEmbed = async (_element, spec) => {
  try {
    lastRenderError = null;
    const compiled = vegaLite.compile(spec).spec;
    const view = new vega.View(vega.parse(compiled), { renderer: "none" });
    await view.runAsync();
    const svg = await view.toSVG();
    rendered.push({ chartType: activeChartType, spec, svg });
    return {
      view: {
        toSVG: async () => svg,
        finalize: () => view.finalize()
      }
    };
  } catch (error) {
    lastRenderError = error;
    throw error;
  }
};

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(predicate, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(25);
  }
  throw new Error(`科研绘图运行时等待超时：${label}`);
}

await import(`${pathToFileURL("src/RoughPptAddin/ui/research-chart-studio.mjs").href}?runtime=${Date.now()}`);
await waitFor(() => rendered.length > 0, "初始图表");
await waitFor(() => hostMessages.some(message => message.type === "stageResearchSvg"), "SVG 暂存请求");
const stage = hostMessages.findLast(message => message.type === "stageResearchSvg");
const editableButton = window.document.getElementById("insertEditableButton");
if (!editableButton.disabled) throw new Error("SVG 校验前不可执行可编辑插入。");
receiveHostMessage({ data: { type: "researchSvgStageResult", requestId: stage.requestId, ok: true, sizeBytes: 1024 } });
if (editableButton.disabled) throw new Error("SVG 校验后可编辑插入入口未启用。");
editableButton.click();
const editableRequest = hostMessages.findLast(message => message.type === "insertEditableResearchSvg");
if (!editableRequest || !editableButton.disabled) throw new Error("可编辑插入未发送宿主请求或未防止重复点击。");
receiveHostMessage({ data: { type: "researchSvgInsertResult", requestId: editableRequest.requestId, editable: true, ok: false, error: "测试拒绝" } });
if (editableButton.disabled || !window.document.getElementById("studioStatus").textContent.includes("测试拒绝")) {
  throw new Error("可编辑插入失败后未恢复入口和错误反馈。");
}

const sample = `id,group,facet,a,b,c,m1,m2,m3,m4
S1,A,F1,30,45,25,1.2,3.1,7.2,9.4
S2,A,F1,22,38,40,2.0,3.9,6.8,8.7
S3,A,F2,35,30,35,2.8,5.1,8.0,9.8
S4,A,F2,28,42,30,3.5,5.8,7.5,10.2
S5,B,F1,18,47,35,4.1,6.9,9.1,11.3
S6,B,F1,25,25,50,5.0,7.6,8.8,12.1
S7,B,F2,40,36,24,5.8,8.7,10.4,13.0
S8,B,F2,32,28,40,6.6,9.5,11.2,13.8`;

const editor = window.document.getElementById("dataEditor");
editor.value = sample;
window.document.getElementById("applyDataButton").click();
await waitFor(() => window.document.getElementById("dataSummary").textContent.startsWith("8 行"), "运行时样本解析");

function setSelect(id, value) {
  const select = window.document.getElementById(id);
  if (!Array.from(select.options).some(option => option.value === value)) throw new Error(`${id} 缺少字段：${value}`);
  select.value = value;
}

const cases = [
  { chartType: "correlationMatrix", x: "id", y: "m1" },
  { chartType: "parallelCoordinates", x: "id", y: "m1", color: "group" },
  { chartType: "qqPlot", x: "m1", y: "m2", color: "group" },
  { chartType: "ppPlot", x: "m1", y: "m2", color: "group" },
  { chartType: "ternary", x: "a", y: "b", size: "c", color: "group" },
  { chartType: "radar", x: "id", y: "m1", color: "group" },
  { chartType: "raincloud", x: "group", y: "m1" },
  { chartType: "ridgeline", x: "m1", y: "group", color: "group" }
];

for (const testCase of cases) {
  setSelect("xField", testCase.x);
  setSelect("yField", testCase.y);
  setSelect("colorField", testCase.color || "");
  setSelect("sizeField", testCase.size || "");
  setSelect("facetField", "");
  activeChartType = testCase.chartType;
  const previousCount = rendered.length;
  const button = window.document.querySelector(`[data-chart-type="${testCase.chartType}"]`);
  if (!button) throw new Error(`缺少图表入口：${testCase.chartType}`);
  button.click();
  try {
    await waitFor(() => rendered.length > previousCount, testCase.chartType);
  } catch {
    throw new Error(`${testCase.chartType} 渲染失败：${lastRenderError?.stack || window.document.getElementById("studioStatus").textContent}`);
  }
  const result = rendered.at(-1);
  if (result.chartType !== testCase.chartType || !result.svg.startsWith("<svg") || result.svg.length < 300) {
    throw new Error(`科研绘图未生成有效 SVG：${testCase.chartType}`);
  }
}

console.log(`research chart runtime ok: ${cases.length} new charts rendered as SVG`);
