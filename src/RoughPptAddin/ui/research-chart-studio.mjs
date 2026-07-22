const SITES = [
  { id: "rawgraphs", label: "RAWGraphs", detail: "复杂图表" },
  { id: "datawrapper", label: "Datawrapper", detail: "统计图表" },
  { id: "plotly", label: "Plotly Chart Studio", detail: "交互图表" },
  { id: "vega", label: "Vega Editor", detail: "声明式图表" }
];

const CHART_LABELS = {
  bar: "柱状图",
  groupedBar: "分组柱状图",
  stackedBar: "堆叠柱状图",
  horizontalBar: "横向柱状图",
  line: "折线图",
  step: "阶梯图",
  area: "面积图",
  scatter: "散点图",
  bubble: "气泡图",
  histogram: "直方图",
  boxplot: "箱线图",
  density: "密度图",
  violin: "小提琴图",
  ecdf: "经验累积分布图",
  strip: "条带图",
  regression: "回归图",
  forest: "森林图",
  roc: "ROC 曲线",
  precisionRecall: "精确率召回曲线",
  calibration: "校准曲线",
  heatmap: "热力图",
  donut: "环形图",
  polar: "极坐标图"
};

const PALETTES = {
  simple: ["#5871ef", "#2f9e44", "#7c5cbf", "#d97706", "#0f9f9a", "#d44773", "#6b83ed", "#64748b"],
  academic: ["#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf", "#8c564b", "#7f7f7f"],
  colorblind: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"],
  gray: ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#4b5563", "#e5e7eb", "#000000"]
};

const SAMPLE_DATA = `方法,准确率,标准差,数据集
Baseline,0.842,0.018,A
Ours,0.913,0.012,A
Baseline,0.815,0.021,B
Ours,0.887,0.015,B`;

const STYLE_DEFAULTS = {
  chartTitle: "模型性能比较",
  xAxisTitle: "方法",
  yAxisTitle: "准确率",
  xScaleType: "linear",
  yScaleType: "linear",
  xTickFormat: "",
  yTickFormat: "",
  xDomainMin: "",
  xDomainMax: "",
  yDomainMin: "",
  yDomainMax: "",
  xReverse: false,
  yReverse: false,
  referenceX: "",
  referenceY: "",
  referenceXMin: "",
  referenceXMax: "",
  referenceYMin: "",
  referenceYMax: "",
  annotationText: "",
  annotationX: "",
  annotationY: "",
  annotationColor: "#b42318",
  showErrorBand: false,
  facetColumns: "2",
  chartWidth: "760",
  chartHeight: "480",
  fontSize: "13",
  lineWidth: "2",
  markSize: "90",
  markOpacity: "0.9",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  axisColor: "#6b7280",
  showLegend: true,
  showGrid: true,
  includeZero: true,
  showLabels: false,
  smoothLine: false
};

const CONFIG_STORAGE_KEY = "simpleexperiment.researchChartStudio.v1";
const PERSISTED_CONTROL_IDS = [
  "xField", "yField", "colorField", "sizeField", "errorLowField", "errorHighField", "aggregateMode", "sortMode", "facetField", "facetColumns",
  "filterField", "filterMode", "filterValue", "chartTitle", "xAxisTitle", "yAxisTitle", "xScaleType", "yScaleType", "xTickFormat", "yTickFormat",
  "xDomainMin", "xDomainMax", "yDomainMin", "yDomainMax", "xReverse", "yReverse", "referenceX", "referenceY", "referenceXMin", "referenceXMax",
  "referenceYMin", "referenceYMax", "annotationText", "annotationX", "annotationY", "annotationColor", "showErrorBand", "chartWidth", "chartHeight",
  "fontSize", "lineWidth", "markSize", "markOpacity", "backgroundColor", "textColor", "axisColor", "showLegend", "showGrid", "includeZero", "showLabels", "smoothLine"
];

const byId = id => document.getElementById(id);
const els = {
  fullscreenButton: byId("fullscreenButton"),
  downloadSvgButton: byId("downloadSvgButton"),
  dataFileInput: byId("dataFileInput"),
  loadDataButton: byId("loadDataButton"),
  loadSampleButton: byId("loadSampleButton"),
  selectSvgButton: byId("selectSvgButton"),
  insertButton: byId("insertButton"),
  dataEditor: byId("dataEditor"),
  applyDataButton: byId("applyDataButton"),
  resetDataButton: byId("resetDataButton"),
  dataSummary: byId("dataSummary"),
  dataSource: byId("dataSource"),
  filterField: byId("filterField"),
  filterMode: byId("filterMode"),
  filterValue: byId("filterValue"),
  saveConfigButton: byId("saveConfigButton"),
  loadConfigButton: byId("loadConfigButton"),
  chartTypeGrid: byId("chartTypeGrid"),
  currentChartType: byId("currentChartType"),
  xField: byId("xField"),
  yField: byId("yField"),
  colorField: byId("colorField"),
  sizeField: byId("sizeField"),
  errorLowField: byId("errorLowField"),
  errorHighField: byId("errorHighField"),
  aggregateMode: byId("aggregateMode"),
  sortMode: byId("sortMode"),
  facetField: byId("facetField"),
  facetColumns: byId("facetColumns"),
  chartTitle: byId("chartTitle"),
  xAxisTitle: byId("xAxisTitle"),
  yAxisTitle: byId("yAxisTitle"),
  xScaleType: byId("xScaleType"),
  yScaleType: byId("yScaleType"),
  xTickFormat: byId("xTickFormat"),
  yTickFormat: byId("yTickFormat"),
  xDomainMin: byId("xDomainMin"),
  xDomainMax: byId("xDomainMax"),
  yDomainMin: byId("yDomainMin"),
  yDomainMax: byId("yDomainMax"),
  xReverse: byId("xReverse"),
  yReverse: byId("yReverse"),
  referenceX: byId("referenceX"),
  referenceY: byId("referenceY"),
  referenceXMin: byId("referenceXMin"),
  referenceXMax: byId("referenceXMax"),
  referenceYMin: byId("referenceYMin"),
  referenceYMax: byId("referenceYMax"),
  annotationText: byId("annotationText"),
  annotationX: byId("annotationX"),
  annotationY: byId("annotationY"),
  annotationColor: byId("annotationColor"),
  showErrorBand: byId("showErrorBand"),
  chartWidth: byId("chartWidth"),
  chartHeight: byId("chartHeight"),
  fontSize: byId("fontSize"),
  lineWidth: byId("lineWidth"),
  markSize: byId("markSize"),
  markOpacity: byId("markOpacity"),
  paletteList: byId("paletteList"),
  backgroundColor: byId("backgroundColor"),
  textColor: byId("textColor"),
  axisColor: byId("axisColor"),
  showLegend: byId("showLegend"),
  showGrid: byId("showGrid"),
  includeZero: byId("includeZero"),
  showLabels: byId("showLabels"),
  smoothLine: byId("smoothLine"),
  resetStyleButton: byId("resetStyleButton"),
  websiteList: byId("websiteList"),
  previewTitle: byId("previewTitle"),
  previewMeta: byId("previewMeta"),
  rowCount: byId("rowCount"),
  columnCount: byId("columnCount"),
  renderState: byId("renderState"),
  chartPreview: byId("chartPreview"),
  svgPreview: byId("svgPreview"),
  emptyState: byId("emptyState"),
  studioStatus: byId("studioStatus")
};

const state = {
  rawRows: [],
  rows: [],
  fields: [],
  fieldTypes: {},
  chartType: "groupedBar",
  palette: "simple",
  renderToken: 0,
  pendingStageRequestId: "",
  previewUrl: "",
  renderTimer: 0,
  dataTimer: 0,
  filterTimer: 0,
  fieldsInitialized: false,
  sourceLabel: "内置示例",
  fullscreen: false,
  latestSvgText: ""
};

function setStatus(text, isError = false) {
  els.studioStatus.textContent = text;
  els.studioStatus.classList.toggle("is-error", Boolean(isError));
}

function setRenderState(text, mode = "") {
  els.renderState.textContent = text;
  els.renderState.classList.toggle("ready", mode === "ready");
  els.renderState.classList.toggle("error", mode === "error");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function postHost(message) {
  if (!window.chrome?.webview?.postMessage) {
    setStatus("当前页面未连接 PowerPoint 宿主。预览可用，插入不可用。", true);
    return false;
  }
  window.chrome.webview.postMessage(message);
  return true;
}

function setFullscreenState(fullscreen) {
  state.fullscreen = Boolean(fullscreen);
  document.body.classList.toggle("is-fullscreen", state.fullscreen);
  els.fullscreenButton?.setAttribute("aria-pressed", state.fullscreen ? "true" : "false");
  const label = els.fullscreenButton?.querySelector("span:last-child");
  if (label) label.textContent = state.fullscreen ? "退出全屏" : "全屏";
  if (els.fullscreenButton) {
    els.fullscreenButton.title = state.fullscreen ? "退出全屏并恢复窗口大小；也可按 Esc" : "让科研绘图工作区占满屏幕；再次点击或按 Esc 恢复窗口";
  }
}

function toggleFullscreen() {
  postHost({ type: "toggleResearchChartStudioFullscreen" });
}

function openWebsite(siteId) {
  const site = SITES.find(item => item.id === siteId);
  if (!site || !postHost({ type: "openResearchChartWebsite", siteId })) return;
  setStatus(`正在使用系统浏览器打开 ${site.label}。`);
}

function renderWebsites() {
  els.websiteList.innerHTML = SITES.map(site => `<button type="button" role="listitem" data-site-id="${site.id}" title="使用系统默认浏览器打开 ${escapeHtml(site.label)}"><strong>${escapeHtml(site.label)}</strong><small>${escapeHtml(site.detail)}</small></button>`).join("");
  els.websiteList.querySelectorAll("[data-site-id]").forEach(button => button.addEventListener("click", () => openWebsite(button.dataset.siteId)));
}

function inferFieldType(field, rows = state.rawRows) {
  const values = rows.map(row => row[field]).filter(value => value !== null && value !== undefined && value !== "");
  if (values.length && values.every(value => typeof value === "number" && Number.isFinite(value))) return "quantitative";
  if (values.length && values.every(value => typeof value === "string" && /^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?/.test(value) && Number.isFinite(Date.parse(value)))) return "temporal";
  return "nominal";
}

function parseEditorData(sourceLabel = state.sourceLabel) {
  if (!window.Papa?.parse) throw new Error("CSV 解析组件未加载。");
  const parsed = window.Papa.parse(els.dataEditor.value, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader: header => String(header ?? "").trim()
  });
  const fatal = (parsed.errors || []).find(error => error.code !== "UndetectableDelimiter");
  if (fatal) throw new Error(`第 ${Number(fatal.row || 0) + 1} 行：${fatal.message}`);
  const fields = (parsed.meta?.fields || []).map(field => String(field ?? "").trim()).filter(Boolean);
  if (!fields.length) throw new Error("未识别到表头，请使用 CSV 或 TSV 首行字段名。");
  const rows = (parsed.data || []).map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])));
  if (!rows.length) throw new Error("表格没有可绘制的数据行。");
  state.rawRows = rows;
  state.rows = rows;
  state.fields = fields;
  state.fieldTypes = Object.fromEntries(fields.map(field => [field, inferFieldType(field, rows)]));
  state.sourceLabel = sourceLabel;
  updateFieldOptions();
  applyFilter();
  updateDataSummary();
}

function chooseDefaultFields() {
  const quantitative = state.fields.filter(field => state.fieldTypes[field] === "quantitative");
  const categorical = state.fields.filter(field => state.fieldTypes[field] !== "quantitative");
  return {
    x: categorical[0] || state.fields[0] || "",
    y: quantitative[0] || state.fields[1] || state.fields[0] || "",
    color: categorical[1] || "",
    size: quantitative[1] || ""
  };
}

function fillFieldSelect(select, fields, preferred, allowNone, preserveCurrent) {
  const current = select.value;
  select.innerHTML = `${allowNone ? '<option value="">不使用</option>' : ""}${fields.map(field => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join("")}`;
  const currentIsValid = fields.includes(current) || (allowNone && current === "");
  const next = preserveCurrent && currentIsValid ? current : preferred;
  select.value = fields.includes(next) || (allowNone && next === "") ? next : (allowNone ? "" : fields[0] || "");
}

function updateFieldOptions() {
  const defaults = chooseDefaultFields();
  const preserveCurrent = state.fieldsInitialized;
  fillFieldSelect(els.xField, state.fields, defaults.x, false, preserveCurrent);
  fillFieldSelect(els.yField, state.fields, defaults.y, false, preserveCurrent);
  fillFieldSelect(els.colorField, state.fields, defaults.color, true, preserveCurrent);
  fillFieldSelect(els.sizeField, state.fields, defaults.size, true, preserveCurrent);
  fillFieldSelect(els.errorLowField, state.fields, "", true, preserveCurrent);
  fillFieldSelect(els.errorHighField, state.fields, "", true, preserveCurrent);
  fillFieldSelect(els.facetField, state.fields, "", true, preserveCurrent);
  const currentFilter = els.filterField.value;
  els.filterField.innerHTML = `<option value="">全部数据</option>${state.fields.map(field => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join("")}`;
  els.filterField.value = state.fields.includes(currentFilter) ? currentFilter : "";
  state.fieldsInitialized = true;
}

function applyFilter() {
  const field = els.filterField.value;
  const rawQuery = els.filterValue.value.trim();
  if (!field || !rawQuery) {
    state.rows = state.rawRows.slice();
    return;
  }
  const mode = els.filterMode.value;
  const query = rawQuery.toLocaleLowerCase("zh-CN");
  const numericQuery = Number(rawQuery);
  state.rows = state.rawRows.filter(row => {
    const value = row[field];
    const text = String(value ?? "").trim().toLocaleLowerCase("zh-CN");
    if (mode === "contains") return text.includes(query);
    if (mode === "equals") return text === query;
    if (mode === "notEquals") return text !== query;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || !Number.isFinite(numericQuery)) return false;
    return mode === "greater" ? numericValue > numericQuery : numericValue < numericQuery;
  });
}

function applyFilterAndRender() {
  applyFilter();
  updateDataSummary();
  scheduleRender(0);
}

function updateDataSummary() {
  const rows = state.rows.length;
  const columns = state.fields.length;
  els.dataSummary.textContent = `${rows} 行 · ${columns} 列`;
  els.rowCount.textContent = String(rows);
  els.columnCount.textContent = String(columns);
  els.dataSource.textContent = state.sourceLabel;
}

function numericValue(element, fallback, min, max) {
  const value = Number(element.value);
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

function fieldType(field, fallback = "nominal") {
  return state.fieldTypes[field] || fallback;
}

function requireQuantitativeField(field, label) {
  if (!field || fieldType(field) !== "quantitative") throw new Error(`${label}必须选择数值字段。`);
}

function requireUnitIntervalField(field, label) {
  requireQuantitativeField(field, label);
  if (state.rows.some(row => !Number.isFinite(Number(row[field])) || Number(row[field]) < 0 || Number(row[field]) > 1)) {
    throw new Error(`${label}必须全部位于 0 至 1。`);
  }
}

function probabilityScale(axisKey) {
  const scale = scaleSpec(axisKey, true);
  if (scale.type === "log") throw new Error("概率曲线包含 0，不能使用对数坐标。");
  scale.domainMin = 0;
  scale.domainMax = 1;
  return scale;
}

function requireIntervalFields() {
  const low = els.errorLowField.value;
  const high = els.errorHighField.value;
  if (!low || !high) throw new Error("森林图需要选择误差下限和误差上限字段。");
  requireQuantitativeField(low, "误差下限");
  requireQuantitativeField(high, "误差上限");
  const invalid = state.rows.find(row => !Number.isFinite(Number(row[low])) || !Number.isFinite(Number(row[high])) || Number(row[low]) > Number(row[high]));
  if (invalid) throw new Error("森林图的误差上下限必须是数值，且下限不得大于上限。");
  return { low, high };
}

function sortValue() {
  return els.sortMode.value === "ascending" || els.sortMode.value === "descending" ? els.sortMode.value : null;
}

function axisKeyElements(axisKey) {
  return axisKey === "x"
    ? { scale: els.xScaleType, format: els.xTickFormat, min: els.xDomainMin, max: els.xDomainMax, reverse: els.xReverse }
    : { scale: els.yScaleType, format: els.yTickFormat, min: els.yDomainMin, max: els.yDomainMax, reverse: els.yReverse };
}

function optionalNumber(element) {
  const raw = String(element?.value ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function scaleSpec(axisKey, zero = false) {
  const controls = axisKeyElements(axisKey);
  const scale = { type: controls.scale?.value || "linear", zero: controls.scale?.value === "log" ? false : zero, reverse: Boolean(controls.reverse?.checked) };
  const min = optionalNumber(controls.min);
  const max = optionalNumber(controls.max);
  if (min !== null && max !== null && min >= max) throw new Error(`${axisKey.toUpperCase()} 轴最小值必须小于最大值。`);
  if (min !== null) scale.domainMin = min;
  if (max !== null) scale.domainMax = max;
  return scale;
}

function axis(title, numeric = false, axisKey = "y") {
  const controls = axisKeyElements(axisKey);
  return {
    title: title || null,
    grid: numeric && els.showGrid.checked,
    domainColor: els.axisColor.value,
    tickColor: els.axisColor.value,
    gridColor: "#e5e7eb",
    labelColor: els.textColor.value,
    titleColor: els.textColor.value,
    ...(numeric && controls.format?.value ? { format: controls.format.value } : {}),
    labelFontSize: numericValue(els.fontSize, 13, 8, 28),
    titleFontSize: numericValue(els.fontSize, 13, 8, 28)
  };
}

function quantitativeEncoding(field, title = "", axisKey = "y") {
  const aggregate = els.aggregateMode.value;
  const encoding = { type: "quantitative", title: title || null, axis: axis(title, true, axisKey), scale: scaleSpec(axisKey, els.includeZero.checked) };
  if (aggregate === "count") encoding.aggregate = "count";
  else {
    encoding.field = field;
    if (aggregate) encoding.aggregate = aggregate;
  }
  return encoding;
}

function categoricalEncoding(field, title = "") {
  const encoding = { field, type: fieldType(field), title: title || null, axis: axis(title, false) };
  const sort = sortValue();
  if (sort) encoding.sort = sort;
  return encoding;
}

function colorEncoding(field) {
  if (!field) return null;
  return {
    field,
    type: fieldType(field),
    scale: { range: PALETTES[state.palette] },
    legend: els.showLegend.checked ? { title: field, labelColor: els.textColor.value, titleColor: els.textColor.value } : null
  };
}

function mark(type, extra = {}) {
  return {
    type,
    color: PALETTES[state.palette][0],
    opacity: numericValue(els.markOpacity, 0.9, 0.1, 1),
    ...extra
  };
}

function addColor(encoding, field = els.colorField.value) {
  const color = colorEncoding(field);
  if (color) encoding.color = color;
  return encoding;
}

function labelLayer(encoding, direction = "vertical") {
  const yField = els.yField.value;
  if (!els.showLabels.checked || !yField) return null;
  const text = { field: yField, type: "quantitative", format: ".3~g" };
  return {
    mark: mark("text", { color: els.textColor.value, dy: direction === "vertical" ? -8 : 0, dx: direction === "horizontal" ? 8 : 0, align: direction === "horizontal" ? "left" : "center", opacity: 1 }),
    encoding: { ...encoding, text }
  };
}

function errorLayer(baseEncoding) {
  const low = els.errorLowField.value;
  const high = els.errorHighField.value;
  if (!low || !high) return null;
  const encoding = { ...baseEncoding, y: { field: low, type: "quantitative" }, y2: { field: high } };
  delete encoding.color;
  return { mark: { type: "errorbar", color: els.axisColor.value, ticks: true }, encoding };
}

function errorBandLayer(baseEncoding) {
  const low = els.errorLowField.value;
  const high = els.errorHighField.value;
  if (!els.showErrorBand.checked || !low || !high || !baseEncoding.x) return null;
  const encoding = {
    x: baseEncoding.x,
    y: { field: low, type: "quantitative" },
    y2: { field: high }
  };
  if (baseEncoding.color) encoding.color = baseEncoding.color;
  return { mark: mark("area", { opacity: 0.16, line: false }), encoding };
}

function annotationDatum(element, field) {
  const raw = String(element?.value ?? "").trim();
  if (!raw) return null;
  if (fieldType(field) === "quantitative") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  return raw;
}

function annotationLayers(xField) {
  const color = els.annotationColor.value;
  const layers = [];
  const xMin = optionalNumber(els.referenceXMin);
  const xMax = optionalNumber(els.referenceXMax);
  const yMin = optionalNumber(els.referenceYMin);
  const yMax = optionalNumber(els.referenceYMax);
  if (xMin !== null && xMax !== null) {
    if (xMin >= xMax) throw new Error("X 参考区间下限必须小于上限。");
    layers.push({ mark: { type: "rect", color, opacity: 0.08 }, encoding: { x: { datum: xMin }, x2: { datum: xMax } } });
  }
  if (yMin !== null && yMax !== null) {
    if (yMin >= yMax) throw new Error("Y 参考区间下限必须小于上限。");
    layers.push({ mark: { type: "rect", color, opacity: 0.08 }, encoding: { y: { datum: yMin }, y2: { datum: yMax } } });
  }
  const referenceX = annotationDatum(els.referenceX, xField);
  const referenceY = optionalNumber(els.referenceY);
  if (referenceX !== null) layers.push({ mark: { type: "rule", color, strokeWidth: 1.5, strokeDash: [6, 4] }, encoding: { x: { datum: referenceX } } });
  if (referenceY !== null) layers.push({ mark: { type: "rule", color, strokeWidth: 1.5, strokeDash: [6, 4] }, encoding: { y: { datum: referenceY } } });
  const annotationText = els.annotationText.value.trim();
  const annotationX = annotationDatum(els.annotationX, xField);
  const annotationY = optionalNumber(els.annotationY);
  if (annotationText && annotationX !== null && annotationY !== null) {
    layers.push({
      mark: { type: "text", color, align: "left", baseline: "bottom", dx: 5, dy: -5, fontWeight: 700 },
      encoding: { x: { datum: annotationX }, y: { datum: annotationY }, text: { value: annotationText } }
    });
  }
  return layers;
}

function buildSpec() {
  const xField = els.xField.value;
  const yField = els.yField.value;
  const colorField = els.colorField.value;
  if (!xField || !yField) throw new Error("请选择 X 轴和 Y 轴字段。");
  const x = categoricalEncoding(xField, els.xAxisTitle.value);
  const y = quantitativeEncoding(yField, els.yAxisTitle.value, "y");
  const lineWidth = numericValue(els.lineWidth, 2, 1, 8);
  const pointSize = numericValue(els.markSize, 90, 10, 500);
  let layers;
  let violinSpec = null;
  let annotationXField = xField;

  if (["bar", "groupedBar", "stackedBar"].includes(state.chartType)) {
    const encoding = addColor({ x, y: { ...y, stack: state.chartType === "stackedBar" ? "zero" : null } }, state.chartType === "bar" ? "" : colorField);
    if (state.chartType === "groupedBar" && colorField) encoding.xOffset = { field: colorField };
    layers = [{ mark: mark("bar", { cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 }), encoding }];
    const errors = errorLayer(encoding);
    const labels = labelLayer(encoding);
    if (errors) layers.push(errors);
    if (labels) layers.push(labels);
  } else if (state.chartType === "horizontalBar") {
    const encoding = addColor({ y: categoricalEncoding(xField, els.xAxisTitle.value), x: { ...quantitativeEncoding(yField, els.yAxisTitle.value, "y"), axis: axis(els.yAxisTitle.value, true, "y"), scale: scaleSpec("y", els.includeZero.checked) } }, colorField);
    layers = [{ mark: mark("bar", { cornerRadiusTopRight: 2, cornerRadiusBottomRight: 2 }), encoding }];
    const labels = labelLayer(encoding, "horizontal");
    if (labels) layers.push(labels);
  } else if (state.chartType === "line" || state.chartType === "step" || state.chartType === "area") {
    const encoding = addColor({ x, y }, colorField);
    const type = state.chartType === "line" ? "line" : "area";
    const band = errorBandLayer(encoding);
    const lineType = state.chartType === "step" ? "line" : type;
    const interpolation = state.chartType === "step" ? "step-after" : (els.smoothLine.checked ? "monotone" : "linear");
    layers = [...(band ? [band] : []), { mark: mark(lineType, { strokeWidth: lineWidth, point: state.chartType === "line" ? { size: pointSize, filled: true } : false, interpolate: interpolation }), encoding }];
    const errors = errorLayer(encoding);
    const labels = labelLayer(encoding);
    if (errors) layers.push(errors);
    if (labels) layers.push(labels);
  } else if (state.chartType === "scatter" || state.chartType === "bubble") {
    const encoding = addColor({
      x: { field: xField, type: "quantitative", title: els.xAxisTitle.value || null, axis: axis(els.xAxisTitle.value, true, "x"), scale: scaleSpec("x", els.includeZero.checked) },
      y
    }, colorField);
    if (state.chartType === "bubble" && els.sizeField.value) encoding.size = { field: els.sizeField.value, type: "quantitative", legend: els.showLegend.checked ? { title: els.sizeField.value } : null, scale: { range: [20, pointSize * 3] } };
    layers = [{ mark: mark("point", { filled: true, size: pointSize, stroke: "#ffffff", strokeWidth: 0.6 }), encoding }];
  } else if (state.chartType === "histogram") {
    const numericField = fieldType(xField) === "quantitative" ? xField : yField;
    const encoding = addColor({
      x: { field: numericField, type: "quantitative", bin: true, title: els.xAxisTitle.value || numericField, axis: axis(els.xAxisTitle.value || numericField, true, "x") },
      y: { aggregate: "count", type: "quantitative", title: "频数", axis: axis("频数", true, "y"), scale: scaleSpec("y", true) }
    }, colorField);
    layers = [{ mark: mark("bar"), encoding }];
  } else if (state.chartType === "boxplot") {
    layers = [{ mark: mark("boxplot", { extent: 1.5, size: Math.max(12, Math.sqrt(pointSize) * 3) }), encoding: addColor({ x, y: { field: yField, type: "quantitative", title: els.yAxisTitle.value || null, axis: axis(els.yAxisTitle.value, true, "y"), scale: scaleSpec("y", false) } }, colorField) }];
  } else if (state.chartType === "density") {
    const numericField = fieldType(xField) === "quantitative" ? xField : yField;
    const densityField = `${numericField}_density`;
    const encoding = addColor({
      x: { field: numericField, type: "quantitative", title: els.xAxisTitle.value || numericField, axis: axis(els.xAxisTitle.value || numericField, true, "x"), scale: scaleSpec("x", false) },
      y: { field: densityField, type: "quantitative", title: "密度", axis: axis("密度", true, "y"), scale: scaleSpec("y", true) }
    }, colorField);
    layers = [{
      transform: [{ density: numericField, ...(colorField ? { groupby: [colorField] } : {}), as: [numericField, densityField] }],
      mark: mark("area", { opacity: 0.28, line: { strokeWidth: lineWidth } }),
      encoding
    }];
  } else if (state.chartType === "violin") {
    requireQuantitativeField(yField, "小提琴图的 Y 轴");
    const densityField = "__violinDensity";
    const densityGroup = [xField, ...(colorField && colorField !== xField ? [colorField] : [])];
    violinSpec = {
      transform: [{ density: yField, groupby: densityGroup, as: [yField, densityField] }],
      mark: mark("area", { orient: "horizontal", opacity: 0.42, line: { strokeWidth: lineWidth } }),
      encoding: addColor({
        x: { field: densityField, type: "quantitative", stack: "center", impute: null, title: null, axis: { labels: false, values: [0], grid: false, ticks: true, domain: false } },
        y: { field: yField, type: "quantitative", title: els.yAxisTitle.value || yField, axis: axis(els.yAxisTitle.value || yField, true, "y"), scale: scaleSpec("y", false) },
        tooltip: [{ field: xField, type: fieldType(xField) }, { field: yField, type: "quantitative", title: yField }]
      }, colorField || xField)
    };
  } else if (state.chartType === "ecdf") {
    const numericField = fieldType(xField) === "quantitative" ? xField : yField;
    requireQuantitativeField(numericField, "经验累积分布图的数值轴");
    annotationXField = numericField;
    const groupby = colorField ? [colorField] : [];
    const probabilityScale = scaleSpec("y", true);
    probabilityScale.domainMax = 1;
    if (probabilityScale.type !== "log") probabilityScale.domainMin = 0;
    const encoding = addColor({
      x: { field: numericField, type: "quantitative", title: els.xAxisTitle.value || numericField, axis: axis(els.xAxisTitle.value || numericField, true, "x"), scale: scaleSpec("x", false) },
      y: { field: "__ecdf", type: "quantitative", title: "累计概率", axis: axis("累计概率", true, "y"), scale: probabilityScale },
      tooltip: [{ field: numericField, type: "quantitative", title: numericField }, { field: "__ecdf", type: "quantitative", title: "累计概率", format: ".3f" }]
    }, colorField);
    layers = [{
      transform: [{ window: [{ op: "cume_dist", as: "__ecdf" }], sort: [{ field: numericField, order: "ascending" }], ...(groupby.length ? { groupby } : {}) }],
      mark: mark("line", { interpolate: "step-after", strokeWidth: lineWidth, point: { filled: true, size: Math.max(18, pointSize * 0.32) } }),
      encoding
    }];
  } else if (state.chartType === "strip") {
    layers = [{
      mark: mark("point", { filled: true, size: pointSize, opacity: 0.66, stroke: "#ffffff", strokeWidth: 0.5 }),
      encoding: addColor({ x, y: { field: yField, type: "quantitative", title: els.yAxisTitle.value || null, axis: axis(els.yAxisTitle.value, true, "y"), scale: scaleSpec("y", false) } }, colorField)
    }];
  } else if (state.chartType === "regression") {
    if (fieldType(xField) !== "quantitative") throw new Error("回归图的 X 轴必须选择数值字段。");
    const encoding = addColor({
      x: { field: xField, type: "quantitative", title: els.xAxisTitle.value || null, axis: axis(els.xAxisTitle.value, true, "x"), scale: scaleSpec("x", false) },
      y: { field: yField, type: "quantitative", title: els.yAxisTitle.value || null, axis: axis(els.yAxisTitle.value, true, "y"), scale: scaleSpec("y", false) }
    }, colorField);
    layers = [
      { mark: mark("point", { filled: true, size: pointSize, opacity: 0.7 }), encoding },
      { transform: [{ regression: yField, on: xField, ...(colorField ? { groupby: [colorField] } : {}) }], mark: mark("line", { strokeWidth: lineWidth, opacity: 1 }), encoding }
    ];
  } else if (state.chartType === "forest") {
    requireQuantitativeField(yField, "森林图的 Y 轴效应值");
    const { low, high } = requireIntervalFields();
    const category = { field: xField, type: fieldType(xField), title: els.yAxisTitle.value || xField, axis: axis(els.yAxisTitle.value || xField, false), sort: sortValue() };
    const effect = { field: yField, type: "quantitative", title: els.xAxisTitle.value || yField, axis: axis(els.xAxisTitle.value || yField, true, "x"), scale: scaleSpec("x", false) };
    const intervalColor = colorEncoding(colorField);
    const withColor = encoding => intervalColor ? { ...encoding, color: intervalColor } : encoding;
    layers = [
      { mark: { type: "rule", color: PALETTES[state.palette][0], strokeWidth: Math.max(1.5, lineWidth) }, encoding: withColor({ x: { field: low, type: "quantitative", scale: scaleSpec("x", false) }, x2: { field: high }, y: category }) },
      { mark: { type: "tick", color: PALETTES[state.palette][0], orient: "vertical", size: 10, thickness: 1.5 }, encoding: withColor({ x: { field: low, type: "quantitative", scale: scaleSpec("x", false) }, y: category }) },
      { mark: { type: "tick", color: PALETTES[state.palette][0], orient: "vertical", size: 10, thickness: 1.5 }, encoding: withColor({ x: { field: high, type: "quantitative", scale: scaleSpec("x", false) }, y: category }) },
      { mark: mark("point", { filled: true, size: pointSize, stroke: "#ffffff", strokeWidth: 0.8 }), encoding: withColor({ x: effect, y: category, tooltip: [{ field: xField, type: fieldType(xField) }, { field: yField, type: "quantitative", title: "效应值" }, { field: low, type: "quantitative", title: "下限" }, { field: high, type: "quantitative", title: "上限" }] }) }
    ];
    const reference = optionalNumber(els.referenceX);
    if (reference !== null) layers.unshift({ mark: { type: "rule", color: els.annotationColor.value, strokeWidth: 1.5, strokeDash: [6, 4] }, encoding: { x: { datum: reference } } });
    if (els.showLabels.checked) layers.push({ mark: mark("text", { color: els.textColor.value, dx: 8, align: "left", opacity: 1 }), encoding: { x: effect, y: category, text: { field: yField, type: "quantitative", format: ".3~g" } } });
  } else if (["roc", "precisionRecall", "calibration"].includes(state.chartType)) {
    const xLabel = state.chartType === "roc" ? "假阳性率" : state.chartType === "precisionRecall" ? "召回率" : "预测概率";
    const yLabel = state.chartType === "roc" ? "真阳性率" : state.chartType === "precisionRecall" ? "精确率" : "观测概率";
    requireUnitIntervalField(xField, xLabel);
    requireUnitIntervalField(yField, yLabel);
    const encoding = addColor({
      x: { field: xField, type: "quantitative", title: els.xAxisTitle.value || xLabel, axis: axis(els.xAxisTitle.value || xLabel, true, "x"), scale: probabilityScale("x") },
      y: { field: yField, type: "quantitative", title: els.yAxisTitle.value || yLabel, axis: axis(els.yAxisTitle.value || yLabel, true, "y"), scale: probabilityScale("y") },
      order: { field: xField, type: "quantitative", sort: "ascending" },
      tooltip: [{ field: xField, type: "quantitative", title: xLabel, format: ".3f" }, { field: yField, type: "quantitative", title: yLabel, format: ".3f" }]
    }, colorField);
    layers = [{ mark: mark("line", { strokeWidth: lineWidth, point: { filled: true, size: Math.max(24, pointSize * 0.4) } }), encoding }];
    if (state.chartType !== "precisionRecall") {
      layers.unshift({
        data: { values: [{}] },
        mark: { type: "rule", color: els.axisColor.value, strokeWidth: 1.2, strokeDash: [6, 4], opacity: 0.8 },
        encoding: { x: { datum: 0 }, x2: { datum: 1 }, y: { datum: 0 }, y2: { datum: 1 } }
      });
    }
  } else if (state.chartType === "heatmap") {
    const yCategory = colorField || xField;
    layers = [{
      mark: mark("rect", { stroke: els.backgroundColor.value, strokeWidth: 1 }),
      encoding: {
        x,
        y: categoricalEncoding(yCategory, yCategory),
        color: { field: yField, type: "quantitative", scale: { scheme: "blues" }, legend: els.showLegend.checked ? { title: yField } : null }
      }
    }];
  } else if (state.chartType === "donut") {
    const encoding = {
      theta: quantitativeEncoding(yField, els.yAxisTitle.value, "y"),
      color: colorEncoding(xField),
      tooltip: [{ field: xField, type: fieldType(xField) }, { field: yField, type: "quantitative" }]
    };
    layers = [{ mark: mark("arc", { innerRadius: 72, stroke: els.backgroundColor.value, strokeWidth: 1 }), encoding }];
    if (els.showLabels.checked) layers.push({ mark: mark("text", { radius: 118, color: els.textColor.value, opacity: 1 }), encoding: { theta: encoding.theta, text: { field: xField, type: "nominal" } } });
  } else if (state.chartType === "polar") {
    layers = [{
      mark: mark("arc", { innerRadius: 16, stroke: els.backgroundColor.value, strokeWidth: 1 }),
      encoding: {
        theta: { field: xField, type: fieldType(xField), sort: sortValue() },
        radius: { field: yField, type: "quantitative", scale: { type: "sqrt", zero: true } },
        color: colorEncoding(colorField || xField),
        tooltip: [{ field: xField, type: fieldType(xField) }, { field: yField, type: "quantitative" }]
      }
    }];
  } else {
    throw new Error("当前图表类型不受支持。");
  }

  if (!["density", "violin", "forest", "donut", "polar"].includes(state.chartType)) layers.push(...annotationLayers(annotationXField));

  const chartWidth = numericValue(els.chartWidth, 760, 360, 1600);
  const chartHeight = numericValue(els.chartHeight, 480, 260, 1200);
  const facetField = els.facetField.value;
  const facetColumns = Math.round(numericValue(els.facetColumns, 2, 1, 6));
  const common = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    background: els.backgroundColor.value,
    padding: 18,
    title: els.chartTitle.value ? { text: els.chartTitle.value, color: els.textColor.value, fontSize: numericValue(els.fontSize, 13, 8, 28) + 3, anchor: "middle" } : null,
    data: { values: state.rows },
    config: {
      font: "Segoe UI, Microsoft YaHei",
      view: { stroke: null },
      axis: { labelLimit: 180, titlePadding: 10 },
      legend: { labelColor: els.textColor.value, titleColor: els.textColor.value, labelFontSize: numericValue(els.fontSize, 13, 8, 28) },
      text: { font: "Segoe UI, Microsoft YaHei" }
    }
  };

  if (violinSpec) {
    const facet = facetField
      ? {
          row: { field: facetField, type: fieldType(facetField), header: { title: null, labelColor: els.textColor.value } },
          column: { field: xField, type: fieldType(xField), header: { title: els.xAxisTitle.value || xField, labelColor: els.textColor.value } }
        }
      : { field: xField, type: fieldType(xField), header: { title: els.xAxisTitle.value || xField, labelColor: els.textColor.value } };
    return {
      ...common,
      facet,
      ...(facetField ? {} : { columns: facetColumns }),
      spec: { width: Math.max(150, Math.floor(chartWidth / facetColumns) - 46), height: chartHeight, ...violinSpec },
      resolve: { scale: { x: "independent", y: "shared" } }
    };
  }

  if (facetField) {
    return {
      ...common,
      facet: { field: facetField, type: fieldType(facetField), header: { title: null, labelColor: els.textColor.value } },
      columns: facetColumns,
      spec: { width: Math.max(180, Math.floor(chartWidth / facetColumns) - 46), height: chartHeight, layer: layers },
      resolve: { scale: { y: "shared" } }
    };
  }

  return {
    ...common,
    width: chartWidth,
    height: chartHeight,
    layer: layers,
  };
}

function clearPreviewUrl() {
  if (!state.previewUrl) return;
  URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = "";
}

function resetSvgOutput() {
  state.latestSvgText = "";
  els.downloadSvgButton.disabled = true;
}

function showSvgText(svgText, label) {
  clearPreviewUrl();
  state.latestSvgText = svgText;
  els.downloadSvgButton.disabled = !svgText;
  state.previewUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  els.svgPreview.src = state.previewUrl;
  els.svgPreview.alt = `${label} SVG 预览`;
  els.svgPreview.hidden = false;
  els.chartPreview.hidden = true;
  els.emptyState.hidden = true;
  els.previewMeta.textContent = `${label} · 同源 SVG`;
}

function stageGeneratedSvg(svgText, token) {
  const requestId = `research-svg-stage-${Date.now()}-${token}`;
  state.pendingStageRequestId = requestId;
  els.insertButton.disabled = true;
  if (!postHost({ type: "stageResearchSvg", requestId, fileName: "local-research-chart.svg", svgText })) {
    setRenderState("仅预览", "ready");
    return;
  }
  setStatus("预览已生成，正在执行 SVG 安全校验。");
}

async function renderChart() {
  const token = ++state.renderToken;
  state.pendingStageRequestId = "";
  els.insertButton.disabled = true;
  resetSvgOutput();
  setRenderState("渲染中");
  els.emptyState.hidden = true;
  try {
    if (!state.rows.length) throw new Error("暂无可绘制数据。");
    if (!window.vegaEmbed) throw new Error("Vega-Lite 绘图组件未加载。");
    els.svgPreview.hidden = true;
    els.chartPreview.hidden = false;
    const result = await window.vegaEmbed(els.chartPreview, buildSpec(), { renderer: "svg", actions: false, tooltip: false });
    const svgText = await result.view.toSVG();
    result.view.finalize();
    if (token !== state.renderToken) return;
    showSvgText(svgText, CHART_LABELS[state.chartType]);
    setRenderState("待校验");
    els.previewTitle.textContent = CHART_LABELS[state.chartType];
    stageGeneratedSvg(svgText, token);
  } catch (error) {
    if (token !== state.renderToken) return;
    resetSvgOutput();
    els.chartPreview.replaceChildren();
    els.chartPreview.hidden = true;
    els.svgPreview.hidden = true;
    els.emptyState.hidden = false;
    els.emptyState.textContent = error?.message || "无法生成预览";
    setRenderState("失败", "error");
    setStatus(`绘图失败：${error?.message || "未知错误"}`, true);
  }
}

function scheduleRender(delay = 120) {
  window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(renderChart, delay);
}

function applyData(sourceLabel = state.sourceLabel, { render = true } = {}) {
  try {
    parseEditorData(sourceLabel);
    if (render) scheduleRender(0);
  } catch (error) {
    state.rawRows = [];
    state.rows = [];
    state.fields = [];
    state.fieldTypes = {};
    resetSvgOutput();
    updateDataSummary();
    els.insertButton.disabled = true;
    setRenderState("数据错误", "error");
    setStatus(`数据解析失败：${error?.message || "未知错误"}`, true);
  }
}

function captureConfig() {
  const controls = {};
  for (const id of PERSISTED_CONTROL_IDS) {
    const element = els[id];
    if (!element) continue;
    controls[id] = element.type === "checkbox" ? element.checked : element.value;
  }
  return { version: 1, chartType: state.chartType, palette: state.palette, controls };
}

function saveConfig() {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(captureConfig()));
    setStatus("当前图表、字段、筛选和样式配置已保存到本机。" );
  } catch (error) {
    setStatus(`保存配置失败：${error?.message || "本机存储不可用"}`, true);
  }
}

function restoreControlValue(id, value) {
  const element = els[id];
  if (!element) return;
  if (element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }
  const next = String(value ?? "");
  if (element instanceof HTMLSelectElement && !Array.from(element.options).some(option => option.value === next)) return;
  element.value = next;
}

function restoreConfig({ silent = false, render = true } = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "null");
    if (!saved || saved.version !== 1 || !saved.controls || typeof saved.controls !== "object") {
      if (!silent) setStatus("本机尚未保存科研绘图配置。", true);
      return false;
    }
    for (const id of PERSISTED_CONTROL_IDS) {
      if (Object.prototype.hasOwnProperty.call(saved.controls, id)) restoreControlValue(id, saved.controls[id]);
    }
    setChartType(saved.chartType, false);
    setPalette(saved.palette, false);
    applyFilter();
    updateDataSummary();
    if (render) scheduleRender(0);
    if (!silent) setStatus("已恢复本机保存的图表和样式配置。" );
    return true;
  } catch (error) {
    if (!silent) setStatus(`恢复配置失败：${error?.message || "配置内容无效"}`, true);
    return false;
  }
}

function downloadCurrentSvg() {
  if (!state.latestSvgText) return;
  const url = URL.createObjectURL(new Blob([state.latestSvgText], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${CHART_LABELS[state.chartType] || "科研绘图"}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus("已下载当前预览使用的同一份 SVG。" );
}

function setChartType(chartType, render = true) {
  if (!CHART_LABELS[chartType]) return;
  state.chartType = chartType;
  els.chartTypeGrid.querySelectorAll("[data-chart-type]").forEach(button => {
    const active = button.dataset.chartType === chartType;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
  els.currentChartType.textContent = CHART_LABELS[chartType];
  if (render) scheduleRender(0);
}

function setPalette(palette, render = true) {
  if (!PALETTES[palette]) return;
  state.palette = palette;
  els.paletteList.querySelectorAll("[data-palette]").forEach(button => {
    const active = button.dataset.palette === palette;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
  if (render) scheduleRender();
}

function resetStyles() {
  for (const [id, value] of Object.entries(STYLE_DEFAULTS)) {
    const element = els[id];
    if (!element) continue;
    if (typeof value === "boolean") element.checked = value;
    else element.value = value;
  }
  els.facetField.value = "";
  setPalette("simple");
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function showImportedSvg(message) {
  ++state.renderToken;
  state.pendingStageRequestId = "";
  showSvgText(String(message.svgText || ""), message.fileName || "导入 SVG");
  els.previewTitle.textContent = message.fileName || "导入 SVG";
  els.previewMeta.textContent = `${formatBytes(message.sizeBytes)} · ${message.width && message.height ? `${message.width} x ${message.height}` : "自适应"} · 同源 SVG`;
  els.insertButton.disabled = false;
  setRenderState("已校验", "ready");
  setStatus("导入 SVG 已通过校验，预览与插入使用同一份内容。");
}

function bindEvents() {
  els.fullscreenButton?.addEventListener("click", toggleFullscreen);
  els.downloadSvgButton.addEventListener("click", downloadCurrentSvg);
  els.loadDataButton.addEventListener("click", () => els.dataFileInput.click());
  els.loadSampleButton.addEventListener("click", () => {
    els.dataEditor.value = SAMPLE_DATA;
    applyData("内置示例");
  });
  els.resetDataButton.addEventListener("click", () => {
    els.dataEditor.value = SAMPLE_DATA;
    applyData("内置示例");
  });
  els.applyDataButton.addEventListener("click", () => applyData("编辑器数据"));
  els.dataEditor.addEventListener("input", () => {
    window.clearTimeout(state.dataTimer);
    state.dataTimer = window.setTimeout(() => applyData("编辑器数据"), 420);
  });
  els.dataFileInput.addEventListener("change", async () => {
    const file = els.dataFileInput.files?.[0];
    if (!file) return;
    try {
      els.dataEditor.value = await file.text();
      applyData(file.name);
    } catch (error) {
      setStatus(`读取数据失败：${error?.message || "未知错误"}`, true);
    } finally {
      els.dataFileInput.value = "";
    }
  });
  els.chartTypeGrid.querySelectorAll("[data-chart-type]").forEach(button => button.addEventListener("click", () => setChartType(button.dataset.chartType)));
  els.paletteList.querySelectorAll("[data-palette]").forEach(button => button.addEventListener("click", () => setPalette(button.dataset.palette)));

  els.filterField.addEventListener("change", applyFilterAndRender);
  els.filterMode.addEventListener("change", applyFilterAndRender);
  els.filterValue.addEventListener("input", () => {
    window.clearTimeout(state.filterTimer);
    state.filterTimer = window.setTimeout(applyFilterAndRender, 180);
  });
  els.saveConfigButton.addEventListener("click", saveConfig);
  els.loadConfigButton.addEventListener("click", () => restoreConfig());

  for (const element of [els.xField, els.yField, els.colorField, els.sizeField, els.errorLowField, els.errorHighField, els.aggregateMode, els.sortMode, els.facetField, els.xScaleType, els.yScaleType, els.xTickFormat, els.yTickFormat, els.xReverse, els.yReverse, els.showErrorBand, els.showLegend, els.showGrid, els.includeZero, els.showLabels, els.smoothLine]) {
    element.addEventListener("change", () => scheduleRender(0));
  }
  for (const element of [els.chartTitle, els.xAxisTitle, els.yAxisTitle, els.xDomainMin, els.xDomainMax, els.yDomainMin, els.yDomainMax, els.referenceX, els.referenceY, els.referenceXMin, els.referenceXMax, els.referenceYMin, els.referenceYMax, els.annotationText, els.annotationX, els.annotationY, els.annotationColor, els.facetColumns, els.chartWidth, els.chartHeight, els.fontSize, els.lineWidth, els.markSize, els.markOpacity, els.backgroundColor, els.textColor, els.axisColor]) {
    element.addEventListener("input", () => scheduleRender());
  }
  els.resetStyleButton.addEventListener("click", resetStyles);
  els.selectSvgButton.addEventListener("click", () => {
    ++state.renderToken;
    state.pendingStageRequestId = "";
    els.insertButton.disabled = true;
    resetSvgOutput();
    if (postHost({ type: "selectResearchSvg" })) setStatus("正在选择 SVG 文件。");
  });
  els.insertButton.addEventListener("click", () => {
    const requestId = `research-svg-insert-${Date.now()}`;
    els.insertButton.disabled = true;
    if (postHost({ type: "insertResearchSvg", requestId })) setStatus("正在插入当前预览 SVG。");
  });
  document.addEventListener("keydown", event => {
    if (event.key === "F11") {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === "Escape" && state.fullscreen) {
      event.preventDefault();
      toggleFullscreen();
    }
  });
}

window.chrome?.webview?.addEventListener?.("message", event => {
  const message = event.data || {};
  if (message.type === "researchSvgStageResult") {
    if (message.requestId !== state.pendingStageRequestId) return;
    state.pendingStageRequestId = "";
    if (message.ok) {
      els.insertButton.disabled = false;
      setRenderState("已校验", "ready");
      setStatus(`本地 SVG 已通过安全校验，可插入 PowerPoint（${formatBytes(message.sizeBytes)}）。`);
    } else {
      els.insertButton.disabled = true;
      setRenderState("校验失败", "error");
      setStatus(`SVG 校验失败：${message.error || "未知错误"}`, true);
    }
  }
  if (message.type === "researchSvgSelectionResult") {
    if (message.ok) showImportedSvg(message);
    else if (!message.canceled) setStatus(`SVG 读取失败：${message.error || "未知错误"}`, true);
  }
  if (message.type === "researchSvgInsertResult") {
    els.insertButton.disabled = false;
    setStatus(message.ok ? "已将当前预览 SVG 插入 PowerPoint。" : `插入失败：${message.error || "未知错误"}`, !message.ok);
  }
  if (message.type === "researchWebsiteOpenResult" && !message.ok) setStatus(`网站打开失败：${message.error || "未知错误"}`, true);
  if (message.type === "researchChartFullscreenResult") setFullscreenState(message.fullscreen);
});

window.addEventListener("beforeunload", clearPreviewUrl);
renderWebsites();
bindEvents();
setFullscreenState(false);
postHost({ type: "researchChartStudioReady" });
applyData("内置示例", { render: false });
restoreConfig({ silent: true, render: false });
scheduleRender(0);
