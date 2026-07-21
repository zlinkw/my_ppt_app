import assert from "node:assert/strict";
import {
  detectZlkClusterOutput,
  importZlkClusterResultFile,
  supportedZlkClusterPatterns
} from "../src/RoughPptAddin/ui/zlk-cluster-result-importer.mjs";

const metricsSummaryCsv = [
  "experiment_id,suite,method,dataset,split,fold,seed,metric,value,unit,higher_is_better",
  "exp1,main,Baseline,CheXpert,test,0,1,AUC,0.81,,true",
  "exp2,main,NewModel,CheXpert,test,0,1,AUC,0.86,,true",
  "exp3,main,NewModel,CheXpert,test,0,2,AUC,0.88,,true"
].join("\n");

const registryJson = JSON.stringify({
  schemaVersion: 1,
  records: [
    {
      schemaVersion: 1,
      resultId: "r1",
      experimentId: "exp1",
      runKey: "baseline_seed1",
      suite: "main",
      experimentName: "Baseline",
      status: "parsed",
      metrics: { AUC: { value: 0.82 }, F1: { value: 0.71 } },
      dimensions: { method: "Baseline", dataset: "MIMIC", split: "test", seed: 1 }
    },
    {
      schemaVersion: 1,
      resultId: "r2",
      experimentId: "exp2",
      runKey: "new_seed1",
      suite: "main",
      experimentName: "NewModel",
      status: "parsed",
      metrics: { AUC: { value: 0.89 }, F1: { value: 0.77 } },
      dimensions: { method: "NewModel", dataset: "MIMIC", split: "test", seed: 1 }
    }
  ]
});

const statisticsJson = JSON.stringify({
  schemaVersion: 1,
  primaryMetric: "AUC",
  rows: [
    { suite: "main", group: "Baseline", metrics: { AUC: { n: 3, mean: 0.82, std: 0.02, ci95: [0.79, 0.85] } } },
    { suite: "main", group: "NewModel", metrics: { AUC: { n: 3, mean: 0.89, std: 0.01, ci95: [0.87, 0.91] } } }
  ],
  pairedComparisons: [
    { metric: "AUC", baseline: "Baseline", candidate: "NewModel", meanDelta: 0.07, pValueApprox: 0.03, significant: true }
  ]
});

const paperTableCsv = [
  "Method,AUC,F1",
  "Baseline,0.82 ± 0.02,0.71 ± 0.03",
  "NewModel,0.89 ± 0.01,0.77 ± 0.02"
].join("\n");

const tradeoffCsv = [
  "method,metric,value,latency",
  "Baseline,AUC,0.82,24.5",
  "NewModel,AUC,0.89,12.25"
].join("\n");

const plainComparisonCsv = [
  "method,metric,value",
  "Baseline,AUC,0.82",
  "NewModel,AUC,0.89"
].join("\n");

const missingFieldsCsv = [
  "name,note",
  "Baseline,no metric value"
].join("\n");

const qualityGateJson = JSON.stringify({
  schemaVersion: 1,
  status: "warning",
  issues: [
    { severity: "warning", metric: "AUC", message: "缺少主指标" },
    { severity: "critical", type: "nan", message: "不是有效数字" },
    { severity: "critical", type: "nan", message: "不是有效数字" }
  ]
});

const caseIndexJson = JSON.stringify({
  schemaVersion: 1,
  cases: [
    { caseId: "c1", patientId: "p1", method: "NewModel", dataset: "MIMIC", split: "test", metrics: { AUC: 0.9 }, subgroup: { sex: "F" }, errorType: "fp" },
    { caseId: "c2", patientId: "p2", method: "NewModel", dataset: "MIMIC", split: "test", metrics: { AUC: 0.7 }, subgroup: { sex: "M" }, errorType: "fn" }
  ]
});

const flatStatisticsJson = JSON.stringify({
  schemaVersion: 1,
  rows: [
    { suite: "main", group: "Baseline", metric: "AUC", mean: 0.82, std: 0.02, ci: [0.79, 0.85], pValue: 0.2 },
    { suite: "main", group: "NewModel", metric: "AUC", mean: 0.89, std: 0.01, ci: [0.87, 0.91], pValue: 0.03, significant: true }
  ]
});

const datasetProfileJson = JSON.stringify({
  schemaVersion: 1,
  dataset: "MIMIC",
  splitDistribution: { train: 120, test: 40 },
  classDistribution: { normal: 90, abnormal: 70 }
});

const patterns = supportedZlkClusterPatterns();
for (const expected of [
  "zlk_cluster/results/summary.json",
  "zlk_cluster/results/result_registry.json",
  "zlk_cluster/results/statistics.json",
  "zlk_cluster/results/quality_gate.json",
  "zlk_cluster/results/case_level_index.json",
  "zlk_cluster/datasets/profile.json",
  "paper/tables/*.csv",
  "paper/tables/*.tex",
  "experiments/results/*.csv",
  "work_dirs/**/metrics_summary.csv",
  "work_dirs/**/metrics_case.csv"
]) {
  assert.ok(patterns.includes(expected), `missing supported pattern ${expected}`);
}

const summaryDetection = detectZlkClusterOutput("work_dirs/run_001/metrics_summary.csv", metricsSummaryCsv);
assert.equal(summaryDetection.kind, "metrics_summary_csv");
assert.equal(summaryDetection.fields.metric, "metric");
assert.equal(summaryDetection.fields.value, "value");

const summaryDataset = importZlkClusterResultFile("work_dirs/run_001/metrics_summary.csv", metricsSummaryCsv);
assert.equal(summaryDataset.points.length, 3);
assert.ok(summaryDataset.recommendations.some(item => item.chartType === "leaderboardBar"));
assert.ok(summaryDataset.recommendations.some(item => item.chartType === "sensitivityCurve"));

const registryDataset = importZlkClusterResultFile("zlk_cluster/results/result_registry.json", registryJson);
assert.equal(registryDataset.source.kind, "result_registry");
assert.equal(registryDataset.points.length, 4);
assert.ok(registryDataset.series.some(item => item.metric === "AUC"));

const statisticsDataset = importZlkClusterResultFile("zlk_cluster/results/statistics.json", statisticsJson);
assert.equal(statisticsDataset.source.kind, "statistics");
assert.ok(statisticsDataset.points.some(point => point.std === 0.02));
assert.ok(statisticsDataset.recommendations.some(item => item.chartType === "meanStdErrorBar"));
assert.ok(statisticsDataset.recommendations.some(item => item.chartType === "significanceSummary"));

const flatStatisticsDataset = importZlkClusterResultFile("zlk_cluster/results/statistics.json", flatStatisticsJson);
assert.equal(flatStatisticsDataset.points.length, 2);
assert.ok(flatStatisticsDataset.points.some(point => point.ci?.length === 2));

const tableDataset = importZlkClusterResultFile("paper/tables/zlk_results_table.csv", paperTableCsv);
assert.equal(tableDataset.source.kind, "paper_table_csv");
assert.equal(tableDataset.points.length, 4);
assert.ok(tableDataset.points.every(point => Number.isFinite(point.y)));
assert.ok(tableDataset.recommendations.some(item => item.chartType === "meanStdErrorBar"));

const tradeoffDataset = importZlkClusterResultFile("experiments/results/tradeoff.csv", tradeoffCsv);
assert.ok(tradeoffDataset.recommendations.some(item => item.chartType === "scatterPlot"));
assert.deepEqual(tradeoffDataset.points.map(point => point.x), [24.5, 12.25]);

const plainComparisonDataset = importZlkClusterResultFile("experiments/results/plain.csv", plainComparisonCsv);
assert.equal(plainComparisonDataset.recommendations.some(item => item.chartType === "scatterPlot"), false);

const qualityDataset = importZlkClusterResultFile("zlk_cluster/results/quality_gate.json", qualityGateJson);
assert.equal(qualityDataset.source.kind, "quality_gate");
assert.ok(qualityDataset.recommendations.some(item => item.chartType === "errorTypeSummary"));

const caseDataset = importZlkClusterResultFile("zlk_cluster/results/case_level_index.json", caseIndexJson);
assert.equal(caseDataset.source.kind, "case_level_index");
assert.equal(caseDataset.points.length, 2);
assert.ok(caseDataset.recommendations.some(item => item.chartType === "caseLevelDistribution"));
assert.ok(caseDataset.recommendations.some(item => item.chartType === "subgroupComparison"));

const profileDataset = importZlkClusterResultFile("zlk_cluster/datasets/profile.json", datasetProfileJson);
assert.equal(profileDataset.source.kind, "dataset_profile");
assert.equal(profileDataset.points.length, 4);
assert.ok(profileDataset.recommendations.some(item => item.chartType === "subgroupComparison"));

const missingDataset = importZlkClusterResultFile("experiments/results/bad.csv", missingFieldsCsv);
assert.ok(missingDataset.errors.some(error => /未识别|缺少|建议/.test(error)), "missing field error should be Chinese and actionable");

console.log("zlk cluster result importer ok");