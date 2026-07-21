const ZLK_FIELD_ALIASES = Object.freeze({
  method: ["method", "model", "algorithm", "approach", "group", "name", "方法", "模型"],
  dataset: ["dataset", "data", "cohort", "数据集", "队列"],
  split: ["split", "phase", "stage", "划分"],
  fold: ["fold", "cv_fold", "折"],
  seed: ["seed", "random_seed", "随机种子"],
  metric: ["metric", "metric_name", "name", "指标"],
  value: ["value", "score", "result", "metric_value", "数值"],
  mean: ["mean", "avg", "average", "均值"],
  std: ["std", "sd", "stdev", "standard_deviation", "标准差"],
  ci: ["ci", "ci95", "confidence_interval", "置信区间"],
  pValue: ["pValue", "p_value", "p", "p值"],
  adjustedPValue: ["adjustedPValue", "adjusted_p_value", "qValue", "q_value", "校正p值"],
  significant: ["significant", "sig", "is_significant", "显著"],
  case_id: ["case_id", "caseId", "case", "sample_id", "样本"],
  patient_id: ["patient_id", "patientId", "patient", "病人"],
  subgroup: ["subgroup", "group", "sex", "age_group", "site", "class_name", "亚组"],
  error_type: ["error_type", "errorType", "error", "failure_type", "错误类型"]
});

const ZLK_CANONICAL_FIELDS = Object.freeze(Object.keys(ZLK_FIELD_ALIASES));
const RESULT_PATH_PATTERNS = Object.freeze([
  "zlk_cluster/results/summary.json",
  "zlk_cluster/results/result_registry.json",
  "zlk_cluster/results/statistics.json",
  "zlk_cluster/results/quality_gate.json",
  "zlk_cluster/results/case_level_index.json",
  "zlk_cluster/datasets/profile.json",
  "zlk_cluster/results/*.md",
  "paper/tables/*.csv",
  "paper/tables/*.tex",
  "experiments/results/*.csv",
  "work_dirs/**/metrics_summary.csv",
  "work_dirs/**/metrics_case.csv"
]);

const METRIC_COLUMN_HINTS = Object.freeze([
  "auc", "auroc", "auprc", "accuracy", "acc", "f1", "precision", "recall", "specificity", "dice", "dsc", "iou", "hd95", "loss", "mae", "mse", "rmse"
]);

export function detectZlkClusterOutput(filePath, content = "") {
  const normalizedPath = normalizePath(filePath);
  const extension = normalizedPath.split(".").pop()?.toLowerCase() || "";
  const detectedKind = detectKindFromPath(normalizedPath);
  const result = {
    schemaVersion: 1,
    sourcePath: normalizedPath,
    sourceType: extension === "json" ? "json" : extension === "tex" ? "latex_table" : extension === "csv" ? "csv" : extension === "md" ? "markdown_summary" : "unknown",
    kind: detectedKind,
    confidence: detectedKind === "unknown" ? 0.1 : 0.7,
    matchedPattern: matchedPathPattern(normalizedPath),
    fields: [],
    missingFields: [],
    warnings: [],
    suggestedFields: ZLK_CANONICAL_FIELDS
  };

  try {
    const rows = previewRows(normalizedPath, content);
    result.fields = inferFieldMap(rows.headers || Object.keys(rows.first || {}));
    result.confidence = Math.max(result.confidence, confidenceFromFields(result.fields));
    if (result.kind === "unknown" && looksLikeZlkRows(rows.first, result.fields)) result.kind = "generic_result_table";
    if (result.kind === "unknown" && /results?|metrics?|summary|paper\/tables|work_dirs/i.test(normalizedPath)) result.kind = "generic_result_table";
    result.missingFields = missingRequiredFieldsForKind(result.kind, result.fields);
    if (result.missingFields.length) {
      result.warnings.push(`缺少字段：${result.missingFields.join("、")}。建议至少包含 method、metric、value，或包含 mean/std。`);
    }
  } catch (error) {
    result.confidence = 0;
    result.warnings.push(`无法预览文件：${error?.message || error}`);
  }

  return result;
}

export function importZlkClusterResultFile(filePath, content = "") {
  const detection = detectZlkClusterOutput(filePath, content);
  const dataset = createDataset(detection);
  try {
    const data = parseByType(detection.sourcePath, content, detection);
    dataset.rows = data.rows;
    dataset.points = data.points;
    dataset.series = buildSeries(dataset.points);
    dataset.fields = Object.keys(dataset.rows[0] || {}).sort();
    dataset.recommendations = buildChartRecommendations(dataset);
    if (detection.kind === "markdown_summary" && dataset.rows.length) {
      dataset.recommendations.unshift({
        chartType: "genericTable",
        title: "Markdown 摘要页",
        reason: "外部请求提供 Markdown 摘要且没有同名 JSON，按摘要页插入 PPT 原生文本表格。",
        priority: 30
      });
      dataset.warnings.push("Markdown 摘要仅作为原生文本表格展示，不作为数值图。");
    }
    dataset.warnings.push(...detection.warnings);
    if (!dataset.points.length && !dataset.rows.length) {
      dataset.errors.push(unknownFormatError(detection));
    }
  } catch (error) {
    dataset.errors.push(`导入失败：${error?.message || error}。请检查文件编码和字段名。`);
  }
  return dataset;
}

export function buildChartRecommendations(dataset) {
  const points = Array.isArray(dataset?.points) ? dataset.points : [];
  const fields = fieldPresence(points);
  const recommendations = [];
  const add = (chartType, title, reason, priority, extra = {}) => {
    recommendations.push({ chartType, title, reason, priority, ...extra });
  };

  if (fields.mean && (fields.std || fields.ci)) {
    add("meanStdErrorBar", "均值误差图", "检测到 mean/std 或置信区间字段，适合展示平均性能和稳定性。", 100, { xField: "method", yField: "mean", errorField: fields.std ? "std" : "ci" });
  }
  if ((fields.method || fields.metric) && (fields.value || fields.mean)) {
    add("leaderboardBar", "排行榜柱状图", "检测到 method/metric/value 或 mean 字段，适合比较不同方法。", 92, { xField: fields.method ? "method" : "metric", yField: fields.value ? "value" : "mean", seriesField: fields.metric ? "metric" : "dataset" });
  }
  if (points.some(point => sensitivityXField(point))) {
    add("sensitivityCurve", "敏感性曲线", "检测到 fold、seed、threshold、missing_rate、noise_level、lambda、epoch 或 step 等横轴字段。", 82, { xField: "自动识别参数", yField: fields.value ? "value" : "mean", seriesField: "method" });
  }
  if (fields.subgroup) {
    add("subgroupComparison", "亚组对比图", "检测到 subgroup/sex/age_group/site/class_name 等亚组字段。", 78, { xField: "subgroup", yField: fields.value ? "value" : "mean", seriesField: "method" });
  }
  if (fields.case_id || fields.patient_id) {
    add("caseLevelDistribution", "病例级分布图", "检测到 case_id 或 patient_id，适合展示病例级指标分布。", 74, { xField: fields.case_id ? "case_id" : "patient_id", yField: fields.value ? "value" : "mean", seriesField: "method" });
  }
  if (fields.error_type) {
    add("errorTypeSummary", "错误类型汇总图", "检测到 error_type，适合展示混淆、失败类型或质量门禁问题分布。", 72, { xField: "error_type", yField: "count", seriesField: "method" });
  }
  const scatterField = ["latency", "time", "param_count", "secondary", "y2", "x", "precision", "recall", "auroc", "f1", "std"]
    .find(field => fields[field] && points.some(point => point[field] !== "" && point[field] != null && Number.isFinite(Number(point[field]))));
  if ((fields.value || fields.mean) && scatterField) {
    add("scatterPlot", "散点对比图", "检测到可用于二维对比的连续数值字段，适合性能-成本、精度-召回或双指标权衡散点图。", 70, { xField: scatterField, yField: fields.value ? "value" : "mean", seriesField: fields.method ? "method" : "metric" });
  }
  if (fields.pValue || fields.adjustedPValue || fields.significant) {
    add("significanceSummary", "显著性标注图", "检测到 pValue、adjustedPValue 或 significant，可在柱状/误差图上叠加显著性。", 68, { xField: "method", yField: fields.value ? "value" : "mean", annotationField: fields.adjustedPValue ? "adjustedPValue" : "pValue" });
  }
  if (!recommendations.length && points.length) {
    add("genericTable", "结果表格", "已识别数值点，但字段不足以稳定推荐具体图形，建议先补 method、metric、value。", 20, { xField: "label", yField: "value" });
  }
  return recommendations.sort((left, right) => right.priority - left.priority);
}

export function supportedZlkClusterPatterns() {
  return RESULT_PATH_PATTERNS.slice();
}

function createDataset(detection) {
  return {
    schemaVersion: 1,
    source: {
      path: detection.sourcePath,
      kind: detection.kind,
      type: detection.sourceType,
      confidence: detection.confidence
    },
    fields: [],
    rows: [],
    points: [],
    series: [],
    recommendations: [],
    errors: [],
    warnings: []
  };
}

function parseByType(filePath, content, detection) {
  if (detection.sourceType === "json") return parseJsonResult(filePath, content, detection);
  if (detection.sourceType === "latex_table") return parseTableRows(latexTableToRows(content), filePath, detection);
  if (detection.sourceType === "csv") return parseTableRows(csvToObjects(content), filePath, detection);
  if (detection.sourceType === "markdown_summary") return parseMarkdownSummary(content, filePath);
  throw new Error("暂不支持该文件类型，仅支持 JSON、CSV、Markdown 和 LaTeX 表格。");
}

function parseMarkdownSummary(content, filePath) {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^```/.test(line));
  const rows = [];
  let section = "摘要";
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      section = cleanMarkdownText(heading[2]).slice(0, 80) || "摘要";
      continue;
    }
    if (/^\|.+\|$/.test(line) || /^[-:|\s]+$/.test(line)) continue;
    const cleaned = cleanMarkdownText(line.replace(/^[-*+]\s+/, ""));
    if (!cleaned) continue;
    rows.push({
      section,
      content: cleaned.slice(0, 320),
      sourceFile: filePath
    });
    if (rows.length >= 8) break;
  }
  if (!rows.length) {
    rows.push({ section: "摘要", content: "Markdown 摘要为空，未发现可展示内容。", sourceFile: filePath });
  }
  return { rows, points: [] };
}

function cleanMarkdownText(value) {
  return String(value || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseJsonResult(filePath, content, detection) {
  const json = JSON.parse(content);
  if (detection.kind === "statistics") return parseStatisticsJson(json, filePath);
  if (detection.kind === "quality_gate") return parseQualityGateJson(json, filePath);
  if (detection.kind === "case_level_index") return parseCaseLevelJson(json, filePath);
  if (detection.kind === "dataset_profile") return parseDatasetProfileJson(json, filePath);
  const records = Array.isArray(json?.records) ? json.records : Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [json];
  const points = [];
  const rows = [];
  records.forEach((record, index) => {
    const dims = { ...(record?.dimensions || {}) };
    const metrics = record?.metrics && typeof record.metrics === "object" ? record.metrics : {};
    if (Object.keys(metrics).length) {
      for (const [metric, raw] of Object.entries(metrics)) {
        const metricObj = raw && typeof raw === "object" ? raw : { value: raw };
        const row = normalizePoint({
          ...dims,
          method: dims.method || record.method || record.experimentName || record.runKey,
          dataset: dims.dataset || record.dataset,
          split: dims.split || record.split,
          metric,
          value: metricObj.value ?? metricObj.mean,
          mean: metricObj.mean,
          std: metricObj.std,
          ci: metricObj.ci ?? metricObj.ci95,
          pValue: metricObj.pValue ?? metricObj.p_value,
          adjustedPValue: metricObj.adjustedPValue ?? metricObj.adjusted_p_value,
          significant: metricObj.significant,
          suite: record.suite,
          resultId: record.resultId,
          experimentId: record.experimentId,
          fold: dims.fold || record.fold || metricObj.fold,
          seed: dims.seed || record.seed || metricObj.seed,
          sourceFile: filePath
        }, index);
        rows.push(row);
        points.push(rowToPoint(row, points.length, filePath));
      }
      return;
    }
    const row = normalizePoint({ ...record, sourceFile: filePath }, index);
    rows.push(row);
    if (hasPointValue(row)) points.push(rowToPoint(row, points.length, filePath));
  });
  return { rows, points };
}

function parseStatisticsJson(json, filePath) {
  const rows = [];
  const points = [];
  for (const [rowIndex, row] of (json?.rows || []).entries()) {
    if (row?.metric && (row.mean !== undefined || row.value !== undefined)) {
      const normalized = normalizePoint({
        suite: row.suite,
        method: row.group || row.method,
        dataset: row.dataset,
        split: row.split,
        metric: row.metric,
        mean: row.mean,
        std: row.std,
        ci: row.ci ?? row.ci95,
        value: row.value ?? row.mean,
        pValue: row.pValue ?? row.p_value,
        adjustedPValue: row.adjustedPValue ?? row.adjusted_p_value,
        significant: row.significant,
        sourceFile: filePath
      }, rowIndex);
      rows.push(normalized);
      points.push(rowToPoint(normalized, points.length, filePath));
      continue;
    }

    const metrics = row?.metrics || {};
    for (const [metric, stats] of Object.entries(metrics)) {
      const normalized = normalizePoint({
        suite: row.suite,
        method: row.group,
        metric,
        mean: stats?.mean,
        std: stats?.std,
        ci: stats?.ci95,
        value: stats?.mean,
        sourceFile: filePath
      }, rowIndex);
      rows.push(normalized);
      points.push(rowToPoint(normalized, points.length, filePath));
    }
  }
  for (const [index, comparison] of (json?.pairedComparisons || []).entries()) {
    const normalized = normalizePoint({
      method: comparison.candidate,
      baseline: comparison.baseline,
      metric: comparison.metric || json.primaryMetric,
      value: comparison.meanDelta,
      pValue: comparison.pValueApprox ?? comparison.pValue,
      adjustedPValue: comparison.adjustedPValue,
      significant: comparison.significant,
      sourceFile: filePath
    }, index);
    rows.push(normalized);
    if (hasPointValue(normalized)) points.push(rowToPoint(normalized, points.length, filePath));
  }
  return { rows, points };
}

function parseQualityGateJson(json, filePath) {
  const counts = new Map();
  const issues = Array.isArray(json?.issues) ? json.issues : [];
  for (const issue of issues) {
    const errorType = String(issue.type || issue.metric || issue.message || "quality_issue");
    const severity = String(issue.severity || json.status || "warning");
    const key = `${severity}::${errorType}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [...counts.entries()].map(([key, count], index) => {
    const [subgroup, errorType] = key.split("::");
    return normalizePoint({ method: "质量门禁", subgroup, error_type: errorType, metric: "count", value: count, sourceFile: filePath }, index);
  });
  return { rows, points: rows.map((row, index) => rowToPoint(row, index, filePath)) };
}

function parseCaseLevelJson(json, filePath) {
  const rows = [];
  const points = [];
  const records = Array.isArray(json?.cases) ? json.cases : Array.isArray(json?.rows) ? json.rows : Array.isArray(json?.records) ? json.records : Array.isArray(json) ? json : [];
  for (const [index, record] of records.entries()) {
    const base = {
      method: record.method,
      dataset: record.dataset,
      split: record.split,
      fold: record.fold,
      seed: record.seed,
      case_id: record.caseId || record.case_id,
      patient_id: record.patientId || record.patient_id,
      subgroup: extractSubgroup(record.subgroup),
      error_type: record.errorType || record.error_type,
      sourceFile: filePath
    };
    const metrics = record.metrics && typeof record.metrics === "object" ? record.metrics : {};
    if (Object.keys(metrics).length) {
      for (const [metric, value] of Object.entries(metrics)) {
        const row = normalizePoint({ ...base, metric, value }, index);
        rows.push(row);
        points.push(rowToPoint(row, points.length, filePath));
      }
    } else if (base.error_type) {
      const row = normalizePoint({ ...base, metric: "count", value: 1 }, index);
      rows.push(row);
      points.push(rowToPoint(row, points.length, filePath));
    }
  }
  return { rows, points };
}

function parseDatasetProfileJson(json, filePath) {
  const rows = [];
  const points = [];
  const push = (record, index) => {
    const row = normalizePoint({
      method: record.method || "数据集画像",
      dataset: record.dataset || json.dataset,
      split: record.split,
      subgroup: record.class || record.label || record.subgroup || record.name,
      metric: record.metric || record.type || "count",
      value: record.value ?? record.count,
      case_id: record.case_id || record.caseId,
      patient_id: record.patient_id || record.patientId,
      sourceFile: filePath
    }, index);
    rows.push(row);
    if (hasPointValue(row)) points.push(rowToPoint(row, points.length, filePath));
  };

  for (const [split, count] of Object.entries(json?.splitDistribution || {})) {
    push({ dataset: json.dataset, split, subgroup: split, metric: "split_count", value: count }, rows.length);
  }
  for (const [label, count] of Object.entries(json?.classDistribution || {})) {
    push({ dataset: json.dataset, class: label, metric: "class_count", value: count }, rows.length);
  }
  const records = Array.isArray(json?.rows) ? json.rows : Array.isArray(json?.records) ? json.records : [];
  for (const [index, record] of records.entries()) push(record, index);
  return { rows, points };
}

function parseTableRows(rows, filePath, detection) {
  const fields = inferFieldMap(Object.keys(rows[0] || {}));
  const outRows = [];
  const points = [];
  rows.forEach((rawRow, index) => {
    const row = normalizeAliasedRow(rawRow, fields);
    if (row.metric && row.value !== undefined) {
      const normalized = normalizePoint({ ...row, sourceFile: filePath }, index);
      outRows.push(normalized);
      points.push(rowToPoint(normalized, points.length, filePath));
      return;
    }
    const metricFields = Object.keys(rawRow).filter(key => isMetricColumn(key, rawRow[key]));
    if (metricFields.length) {
      for (const key of metricFields) {
        const parsed = parseMetricCell(rawRow[key]);
        const normalized = normalizePoint({
          ...row,
          metric: normalizeMetricName(key),
          value: parsed.value,
          mean: parsed.mean,
          std: parsed.std,
          ci: parsed.ci,
          sourceFile: filePath
        }, index);
        outRows.push(normalized);
        points.push(rowToPoint(normalized, points.length, filePath));
      }
      return;
    }
    const normalized = normalizePoint({ ...row, sourceFile: filePath }, index);
    outRows.push(normalized);
    if (hasPointValue(normalized)) points.push(rowToPoint(normalized, points.length, filePath));
  });
  if (!points.length && detection?.missingFields?.length) {
    throw new Error(`未知结果表缺少可绘图字段：${detection.missingFields.join("、")}`);
  }
  return { rows: outRows, points };
}

function normalizePoint(row, index) {
  const parsed = parseMetricCell(row.value ?? row.mean);
  const meanCell = parseMetricCell(row.mean ?? row.value);
  const normalized = { ...row };
  for (const key of ["value", "mean", "std", "pValue", "adjustedPValue"]) {
    if (normalized[key] !== undefined && normalized[key] !== "") normalized[key] = toNumber(normalized[key]);
  }
  if (normalized.value === undefined && parsed.value !== undefined) normalized.value = parsed.value;
  if (normalized.mean === undefined && meanCell.mean !== undefined) normalized.mean = meanCell.mean;
  if (normalized.std === undefined && parsed.std !== undefined) normalized.std = parsed.std;
  if (normalized.ci === undefined && parsed.ci !== undefined) normalized.ci = parsed.ci;
  normalized.metric = normalized.metric || "value";
  normalized.method = normalized.method || normalized.model || normalized.group || normalized.name || `结果${index + 1}`;
  normalized.label = normalized.label || [normalized.method, normalized.dataset, normalized.metric].filter(Boolean).join(" / ");
  normalized.significant = parseBoolean(normalized.significant);
  return normalized;
}

function rowToPoint(row, index, sourcePath) {
  const y = firstFinite(row.value, row.mean);
  const point = {
    id: `point-${index + 1}`,
    label: row.label || String(row.method || row.metric || `结果${index + 1}`),
    x: pointXValue(row, index),
    y,
    method: row.method,
    dataset: row.dataset,
    split: row.split,
    fold: row.fold,
    seed: row.seed,
    metric: row.metric,
    value: row.value,
    mean: row.mean,
    std: row.std,
    ci: row.ci,
    pValue: row.pValue,
    adjustedPValue: row.adjustedPValue,
    significant: row.significant,
    case_id: row.case_id,
    patient_id: row.patient_id,
    subgroup: row.subgroup,
    error_type: row.error_type,
    sourcePath
  };
  for (const field of ["latency", "time", "param_count", "secondary", "y2", "precision", "recall", "auroc", "f1"]) {
    const value = firstFinite(row[field]);
    if (value !== undefined) point[field] = value;
  }
  return point;
}

function pointXValue(row, index) {
  const sensitivityField = sensitivityXField(row);
  if (sensitivityField) return firstFinite(row[sensitivityField]) ?? row[sensitivityField];
  for (const field of ["latency", "time", "param_count", "secondary", "y2", "x", "precision", "recall", "auroc", "f1", "std"]) {
    const value = firstFinite(row[field]);
    if (value !== undefined) return value;
  }
  return row.method || row.metric || index + 1;
}

function buildSeries(points) {
  const groups = new Map();
  for (const point of points) {
    const key = [point.metric || "value", point.dataset || "", point.split || ""].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        id: `series-${groups.size + 1}`,
        label: [point.metric || "value", point.dataset, point.split].filter(Boolean).join(" / "),
        metric: point.metric || "value",
        dataset: point.dataset,
        split: point.split,
        points: []
      });
    }
    groups.get(key).points.push(point);
  }
  return [...groups.values()];
}

function previewRows(filePath, content) {
  if (/\.json$/i.test(filePath)) {
    const json = JSON.parse(content);
    const row = Array.isArray(json?.records) ? json.records[0] : Array.isArray(json?.results) ? json.results[0] : Array.isArray(json?.rows) ? json.rows[0] : Array.isArray(json?.cases) ? json.cases[0] : Array.isArray(json) ? json[0] : json;
    return { first: flattenPreviewRow(row || {}), headers: Object.keys(flattenPreviewRow(row || {})) };
  }
  if (/\.tex$/i.test(filePath)) {
    const rows = latexTableToRows(content);
    return { first: rows[0] || {}, headers: Object.keys(rows[0] || {}) };
  }
  if (/\.md$/i.test(filePath)) {
    const rows = parseMarkdownSummary(content, filePath).rows;
    return { first: rows[0] || {}, headers: Object.keys(rows[0] || {}) };
  }
  const rows = csvToObjects(content);
  return { first: rows[0] || {}, headers: Object.keys(rows[0] || {}) };
}

function csvToObjects(text) {
  const rows = csvRows(text).filter(row => row.some(cell => String(cell).trim()));
  const headers = rows[0]?.map(cleanHeader) || [];
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < String(text).length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

function latexTableToRows(text) {
  const lines = String(text)
    .replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, "")
    .split(/\r?\n/)
    .map(line => line.replace(/%.*$/, "").trim())
    .filter(line => line.includes("&") && !/\\begin|\\end/.test(line));
  const matrix = lines.map(line => line.replace(/\\\\\s*$/, "").split("&").map(cell => cleanTexCell(cell)));
  const headers = (matrix[0] || []).map(cleanHeader);
  return matrix.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function cleanTexCell(value) {
  return String(value || "")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\mathbf\{([^}]*)\}/g, "$1")
    .replace(/\\pm/g, "±")
    .replace(/[{}$]/g, "")
    .trim();
}

function cleanHeader(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function normalizeAliasedRow(row, fields) {
  const out = { ...row };
  for (const [canonical, actual] of Object.entries(fields)) {
    if (actual && row[actual] !== undefined) out[canonical] = row[actual];
  }
  return out;
}

function inferFieldMap(headers) {
  const lowerToActual = new Map((headers || []).map(header => [normalizeKey(header), header]));
  const fields = {};
  for (const [canonical, aliases] of Object.entries(ZLK_FIELD_ALIASES)) {
    const actual = aliases.map(normalizeKey).map(alias => lowerToActual.get(alias)).find(Boolean);
    if (actual) fields[canonical] = actual;
  }
  return fields;
}

function parseMetricCell(value) {
  const text = String(value ?? "").replace(/\\pm/g, "±").replace(/[{}$]/g, "").trim();
  if (!text) return {};
  const pm = text.match(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(?:±|\+\/-)\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
  if (pm) return { value: Number(pm[1]), mean: Number(pm[1]), std: Number(pm[2]) };
  const ci = text.match(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*[\[(]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*[\])]/i);
  if (ci) return { value: Number(ci[1]), mean: Number(ci[1]), ci: [Number(ci[2]), Number(ci[3])] };
  const numeric = toNumber(text);
  return numeric === undefined ? {} : { value: numeric };
}

function toNumber(value) {
  if (Array.isArray(value)) return value.map(toNumber).filter(item => item !== undefined);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const percent = text.endsWith("%");
  const match = text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (!match) return undefined;
  const num = Number(match[0]);
  if (!Number.isFinite(num)) return undefined;
  return percent ? num / 100 : num;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return undefined;
  if (["true", "1", "yes", "y", "显著"].includes(text)) return true;
  if (["false", "0", "no", "n", "不显著"].includes(text)) return false;
  return undefined;
}

function isMetricColumn(key, value) {
  const normalized = normalizeMetricName(key).toLowerCase();
  if (ZLK_CANONICAL_FIELDS.includes(normalized)) return false;
  if (METRIC_COLUMN_HINTS.some(hint => normalized.includes(hint))) return true;
  return parseMetricCell(value).value !== undefined && !["fold", "seed", "epoch", "step", "count"].includes(normalized);
}

function normalizeMetricName(value) {
  return String(value || "").trim().replace(/\s+/g, "_").replace(/-/g, "_");
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s\-_]+/g, "");
}

function normalizePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function detectKindFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith("zlk_cluster/results/summary.json") || lower.endsWith("zlk_cluster/results_summary.json")) return "summary";
  if (lower.endsWith("zlk_cluster/results/result_registry.json")) return "result_registry";
  if (lower.endsWith("zlk_cluster/results/statistics.json")) return "statistics";
  if (lower.endsWith("zlk_cluster/results/quality_gate.json")) return "quality_gate";
  if (lower.endsWith("zlk_cluster/results/case_level_index.json")) return "case_level_index";
  if (lower.endsWith("zlk_cluster/datasets/profile.json")) return "dataset_profile";
  if (/\/?zlk_cluster\/results\/.+\.md$/i.test(lower) || lower.endsWith(".md")) return "markdown_summary";
  if (/\/?paper\/tables\/.+\.csv$/i.test(lower)) return "paper_table_csv";
  if (/\/?paper\/tables\/.+\.tex$/i.test(lower)) return "paper_table_tex";
  if (/\/?experiments\/results\/.+\.csv$/i.test(lower)) return "experiment_result_csv";
  if (/\/?work_dirs\/.+\/metrics_summary\.csv$/i.test(lower) || lower.endsWith("metrics_summary.csv")) return "metrics_summary_csv";
  if (/\/?work_dirs\/.+\/metrics_case\.csv$/i.test(lower) || lower.endsWith("metrics_case.csv")) return "metrics_case_csv";
  return "unknown";
}

function matchedPathPattern(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith("zlk_cluster/results/summary.json")) return "zlk_cluster/results/summary.json";
  if (lower.endsWith("zlk_cluster/results/result_registry.json")) return "zlk_cluster/results/result_registry.json";
  if (lower.endsWith("zlk_cluster/results/statistics.json")) return "zlk_cluster/results/statistics.json";
  if (lower.endsWith("zlk_cluster/results/quality_gate.json")) return "zlk_cluster/results/quality_gate.json";
  if (lower.endsWith("zlk_cluster/results/case_level_index.json")) return "zlk_cluster/results/case_level_index.json";
  if (lower.endsWith("zlk_cluster/datasets/profile.json")) return "zlk_cluster/datasets/profile.json";
  if (/\/?zlk_cluster\/results\/.+\.md$/i.test(lower) || lower.endsWith(".md")) return "zlk_cluster/results/*.md";
  if (/\/?paper\/tables\/.+\.csv$/i.test(lower)) return "paper/tables/*.csv";
  if (/\/?paper\/tables\/.+\.tex$/i.test(lower)) return "paper/tables/*.tex";
  if (/\/?experiments\/results\/.+\.csv$/i.test(lower)) return "experiments/results/*.csv";
  if (/\/?work_dirs\/.+\/metrics_summary\.csv$/i.test(lower)) return "work_dirs/**/metrics_summary.csv";
  if (/\/?work_dirs\/.+\/metrics_case\.csv$/i.test(lower)) return "work_dirs/**/metrics_case.csv";
  return "";
}

function confidenceFromFields(fields) {
  const keys = Object.keys(fields || {});
  if (keys.includes("metric") && keys.includes("value")) return 0.95;
  if (keys.includes("mean") && (keys.includes("std") || keys.includes("ci"))) return 0.9;
  if (keys.includes("method") && keys.some(key => ["value", "mean", "case_id", "error_type"].includes(key))) return 0.8;
  return keys.length ? 0.55 : 0.1;
}

function missingRequiredFieldsForKind(kind, fields) {
  if (kind === "markdown_summary") return [];
  if (kind === "quality_gate") return [];
  if (kind === "case_level_index" || kind === "metrics_case_csv") {
    return ["method", "case_id"].filter(key => !fields[key]);
  }
  if (fields.metric && fields.value) return [];
  if (fields.mean && (fields.std || fields.ci)) return [];
  return ["method", "metric", "value"].filter(key => !fields[key]);
}

function unknownFormatError(detection) {
  return `未识别到可绘图数据。当前字段：${Object.values(detection.fields || {}).join("、") || "无"}。建议补充字段：method、dataset、split、metric、value、mean、std、case_id、subgroup 或 error_type。`;
}

function looksLikeZlkRows(row, fields) {
  return Boolean(row && (fields.metric || fields.value || fields.mean || fields.case_id || fields.error_type || row.metrics || row.dimensions));
}

function flattenPreviewRow(row) {
  if (!row || typeof row !== "object") return {};
  return {
    ...row,
    ...(row.dimensions && typeof row.dimensions === "object" ? row.dimensions : {}),
    ...(row.metrics && typeof row.metrics === "object" ? Object.fromEntries(Object.keys(row.metrics).map(key => [key, "metric"])) : {})
  };
}

function extractSubgroup(value) {
  if (!value || typeof value !== "object") return value;
  return value.subgroup || value.sex || value.age_group || value.class_name || value.site || JSON.stringify(value);
}

function fieldPresence(points) {
  const fields = {};
  for (const point of points) {
    for (const key of ["method", "dataset", "split", "fold", "seed", "metric", "value", "mean", "std", "ci", "pValue", "adjustedPValue", "significant", "case_id", "patient_id", "subgroup", "error_type", "latency", "time", "param_count", "secondary", "y2", "x", "precision", "recall", "auroc", "f1"]) {
      if (point[key] !== undefined && point[key] !== "" && point[key] !== null) fields[key] = true;
    }
  }
  return fields;
}

function sensitivityXField(point) {
  for (const key of ["epoch", "step", "threshold", "missing_rate", "noise_level", "lambda", "fold", "seed"]) {
    if (point[key] !== undefined && point[key] !== "") return key;
  }
  return "";
}

function hasPointValue(row) {
  return firstFinite(row.value, row.mean) !== undefined;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== undefined && !Array.isArray(number)) return number;
  }
  return undefined;
}
