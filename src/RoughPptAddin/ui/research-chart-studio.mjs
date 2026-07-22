const TYPES = [
  { id: "leaderboardBar", label: "柱状图", chart: "bar", reason: "比较多个方法或条目" },
  { id: "sensitivityCurve", label: "折线图", chart: "line", reason: "观察参数或实验趋势" },
  { id: "scatterPlot", label: "散点图", chart: "scatter", reason: "比较两个连续变量" },
  { id: "subgroupComparison", label: "分组对比", chart: "bar", reason: "按亚组或数据集并列比较" },
  { id: "meanStdErrorBar", label: "均值误差图", chart: "bar", reason: "展示均值和误差字段" },
  { id: "caseLevelDistribution", label: "病例分布", chart: "line", reason: "查看病例级数值变化" },
  { id: "genericTable", label: "结果表格", chart: "table", reason: "保留原始字段和行" }
];

const els = {
  csvFile: document.querySelector("#csvFile"), demoButton: document.querySelector("#demoButton"), insertButton: document.querySelector("#insertButton"),
  fileStatus: document.querySelector("#fileStatus"), rowCount: document.querySelector("#rowCount"), fieldCount: document.querySelector("#fieldCount"),
  xField: document.querySelector("#xField"), yField: document.querySelector("#yField"), seriesField: document.querySelector("#seriesField"), stdField: document.querySelector("#stdField"),
  chartTypes: document.querySelector("#chartTypes"), chartTitle: document.querySelector("#chartTitle"), previewTitle: document.querySelector("#previewTitle"), previewMeta: document.querySelector("#previewMeta"),
  previewCanvasWrap: document.querySelector("#previewCanvasWrap"), canvas: document.querySelector("#chartCanvas"), emptyState: document.querySelector("#emptyState"), tableWrap: document.querySelector("#tableWrap"), studioStatus: document.querySelector("#studioStatus")
};

const state = { fields: [], rows: [], sourceName: "", selectedType: TYPES[0].id, chart: null };
const demoCsv = `method,dataset,value,std\nOurs,外部测试,0.91,0.02\nBaseline A,外部测试,0.84,0.03\nBaseline B,外部测试,0.79,0.04\nOurs,内部测试,0.94,0.01\nBaseline A,内部测试,0.86,0.02\nBaseline B,内部测试,0.82,0.03`;

function setStatus(text, isError = false) {
  els.studioStatus.textContent = text;
  els.studioStatus.classList.toggle("is-error", Boolean(isError));
}

function numericRatio(field) {
  if (!state.rows.length) return 0;
  const count = state.rows.filter(row => Number.isFinite(Number(row[field]))).length;
  return count / state.rows.length;
}

function isNumericField(field) { return numericRatio(field) >= 0.55; }
function numericFields() { return state.fields.filter(isNumericField); }
function labelFields() { return state.fields.filter(field => !isNumericField(field)); }

function optionMarkup(fields, selected, includeBlank = false) {
  const values = includeBlank ? ["", ...fields] : fields;
  return values.map(field => `<option value="${escapeHtml(field)}"${field === selected ? " selected" : ""}>${field ? escapeHtml(field) : "不使用"}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function chooseFields() {
  const nums = numericFields();
  const labels = labelFields();
  const x = els.xField.value || labels[0] || state.fields[0] || "";
  const y = els.yField.value || nums[0] || state.fields[1] || "";
  els.xField.innerHTML = optionMarkup(state.fields, x);
  els.yField.innerHTML = optionMarkup(nums.length ? nums : state.fields, y);
  els.seriesField.innerHTML = optionMarkup(labels, els.seriesField.value, true);
  els.stdField.innerHTML = optionMarkup(nums.filter(field => field !== y), els.stdField.value, true);
  if (!els.xField.value && state.fields[0]) els.xField.value = state.fields[0];
  if (!els.yField.value && (nums[0] || state.fields[1])) els.yField.value = nums[0] || state.fields[1];
}

function renderTypeButtons() {
  els.chartTypes.innerHTML = TYPES.map(type => `<button type="button" role="option" aria-selected="${type.id === state.selectedType}" data-chart-type="${type.id}" title="${escapeHtml(type.reason)}">${escapeHtml(type.label)}</button>`).join("");
  els.chartTypes.querySelectorAll("[data-chart-type]").forEach(button => button.addEventListener("click", () => { state.selectedType = button.dataset.chartType; renderTypeButtons(); renderPreview(); }));
}

function parseCsvText(text, sourceName) {
  if (!window.Papa) throw new Error("CSV 解析组件未加载。");
  const parsed = window.Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: "greedy", transformHeader: header => String(header ?? "").trim() });
  if (parsed.errors?.length) throw new Error(`CSV 解析失败：${parsed.errors[0].message}`);
  const rows = (parsed.data ?? []).filter(row => row && Object.values(row).some(value => String(value ?? "").trim() !== ""));
  const fields = parsed.meta?.fields?.filter(Boolean) ?? Object.keys(rows[0] ?? {});
  if (!fields.length || !rows.length) throw new Error("CSV 没有可用的字段或数据行。");
  state.fields = fields;
  state.rows = rows;
  state.sourceName = sourceName || "本地 CSV";
  els.fileStatus.textContent = state.sourceName;
  els.rowCount.textContent = String(rows.length);
  els.fieldCount.textContent = String(fields.length);
  chooseFields();
  els.insertButton.disabled = false;
  els.emptyState.hidden = true;
  renderPreview();
}

function loadFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { parseCsvText(String(reader.result || ""), file.name); setStatus(`已载入 ${file.name}，可切换预览类型。`); } catch (error) { setStatus(error.message, true); } };
  reader.onerror = () => setStatus("读取 CSV 失败。", true);
  reader.readAsText(file, "utf-8");
}

function selectedRows() {
  const xField = els.xField.value;
  const yField = els.yField.value;
  const seriesField = els.seriesField.value;
  const stdField = els.stdField.value;
  return state.rows.map((row, index) => {
    const y = Number(row[yField]);
    const x = row[xField] ?? index;
    const label = String(row[xField] ?? row.method ?? row.label ?? index + 1);
    const value = Number.isFinite(y) ? y : null;
    const std = Number(row[stdField]);
    return { row, index, label, x, value, std: Number.isFinite(std) ? std : null, series: seriesField ? String(row[seriesField] ?? "") : "" };
  }).filter(item => item.value !== null || state.selectedType === "genericTable");
}

function buildChartConfig(type, points) {
  const colors = ["#5871EF", "#E35D6A", "#2F9E75", "#E49B3A", "#7C5CFC", "#1597B8"];
  const grouped = new Map();
  points.forEach(point => { const key = point.series || "数据"; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(point); });
  const datasets = [...grouped.entries()].map(([label, values], index) => {
    const data = type.chart === "scatter" ? values.map(point => ({ x: Number(point.x), y: point.value })) : values.map(point => point.value);
    return { label, data, borderColor: colors[index % colors.length], backgroundColor: `${colors[index % colors.length]}99`, borderWidth: 2, tension: .25, pointRadius: 4, fill: false };
  });
  const labels = points.map(point => point.label);
  const config = { type: type.chart, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } }, scales: { x: { grid: { color: "#e6eaf2" } }, y: { grid: { color: "#e6eaf2" } } } } };
  if (type.id === "subgroupComparison") config.options.scales.x.stacked = false;
  if (type.id === "leaderboardBar") { config.options.indexAxis = "y"; config.options.plugins.legend.display = false; }
  return config;
}

function renderTable() {
  const head = state.fields.map(field => `<th>${escapeHtml(field)}</th>`).join("");
  const body = state.rows.slice(0, 200).map(row => `<tr>${state.fields.map(field => `<td>${escapeHtml(row[field])}</td>`).join("")}</tr>`).join("");
  els.tableWrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderPreview() {
  if (!state.rows.length) return;
  const type = TYPES.find(item => item.id === state.selectedType) || TYPES[0];
  const points = selectedRows();
  els.previewTitle.textContent = `${els.chartTitle.value.trim() || "科研图表"} · ${type.label}`;
  els.previewMeta.textContent = `${state.sourceName} · ${state.rows.length} 行 · ${type.reason}`;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (type.chart === "table") {
    els.previewCanvasWrap.hidden = true;
    els.tableWrap.hidden = false;
    renderTable();
    return;
  }
  els.previewCanvasWrap.hidden = false;
  els.tableWrap.hidden = true;
  if (!window.Chart) { setStatus("Chart.js 预览组件未加载。", true); return; }
  state.chart = new window.Chart(els.canvas.getContext("2d"), buildChartConfig(type, points));
}

function toHostDataset() {
  const xField = els.xField.value;
  const yField = els.yField.value;
  const seriesField = els.seriesField.value;
  const stdField = els.stdField.value;
  const points = state.rows.map((row, index) => {
    const numeric = Number(row[yField]);
    const std = Number(row[stdField]);
    const label = String(row[xField] ?? row.method ?? row.label ?? index + 1);
    return { Id: String(index + 1), Label: label, X: row[xField] ?? index, Y: Number.isFinite(numeric) ? numeric : null, Value: Number.isFinite(numeric) ? numeric : null, Mean: Number.isFinite(numeric) ? numeric : null, Std: Number.isFinite(std) ? std : null, Method: String(row.method ?? label), Dataset: String(row.dataset ?? ""), Subgroup: seriesField ? String(row[seriesField] ?? "") : "", Metric: yField, SourcePath: state.sourceName };
  });
  return { SchemaVersion: 1, Source: { Path: state.sourceName, Kind: "csv", Type: "csv", Confidence: 1 }, Fields: state.fields, Rows: state.rows, Points: points, Series: [], Recommendations: [], Errors: [], Warnings: [] };
}

els.csvFile.addEventListener("change", event => loadFile(event.target.files?.[0]));
els.demoButton.addEventListener("click", () => { try { parseCsvText(demoCsv, "内置示例.csv"); setStatus("已加载内置示例，可切换预览类型。 "); } catch (error) { setStatus(error.message, true); } });
[els.xField, els.yField, els.seriesField, els.stdField].forEach(select => select.addEventListener("change", renderPreview));
els.chartTitle.addEventListener("input", renderPreview);
els.insertButton.addEventListener("click", () => {
  const type = TYPES.find(item => item.id === state.selectedType) || TYPES[0];
  const payload = { type: "insertResearchChart", requestId: `studio-${Date.now()}`, dataset: toHostDataset(), chartSpec: { ChartType: type.id, Title: els.chartTitle.value.trim() || "SimpleExperiment 实验结果", Reason: type.reason } };
  if (window.chrome?.webview?.postMessage) { window.chrome.webview.postMessage(payload); setStatus(`已发送 ${type.label} 插入请求，等待 PowerPoint 完成。`); }
  else setStatus("当前页面未连接 PowerPoint 宿主，无法插入。", true);
});

window.chrome?.webview?.addEventListener?.("message", event => {
  const message = event.data || {};
  if (message.type === "researchChartInsertResult") setStatus(message.ok ? "已插入 PPT 原生可编辑图表。" : `插入失败：${message.error || "未知错误"}`, !message.ok);
});

renderTypeButtons();
