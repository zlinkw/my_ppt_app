import fs from "node:fs";

const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const index = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const violations = [];

function requireIncludes(text, snippet, label) {
  if (!text.includes(snippet)) violations.push(label);
}

function requirePattern(text, pattern, label) {
  if (!pattern.test(text)) violations.push(label);
}

for (const snippet of [
  "const ZOTERO_IMAGE_RENDER_BATCH = 30",
  "const PALETTE_SCHEME_RENDER_BATCH = 16",
  "const CHART_DATASET_RENDER_BATCH = 24",
  "let scheduledRenderHandle = 0",
  "function scheduleRender()",
  "function flushScheduledRender()",
  "function scheduleZoteroLibraryRender()",
  "function flushZoteroLibraryRender()",
  "let zoteroImageRequestInFlight = false",
  "let queuedZoteroImageQuery = null",
  "window.requestAnimationFrame(run)",
  "window.setTimeout(run, 16)",
  "zoteroImageVisibleCount: ZOTERO_IMAGE_RENDER_BATCH",
  "paletteSchemeVisibleCount: PALETTE_SCHEME_RENDER_BATCH",
  "chartDatasetVisibleCount: CHART_DATASET_RENDER_BATCH",
  "function resetResourceRenderWindows",
  "function renderResourceLoadMore",
  "避免一次渲染大量缩略图或卡片导致卡顿",
  "显示更多",
  "datasets.slice(0, visibleCount)",
  "images.slice(0, visibleCount)",
  "palettes.slice(0, visibleCount)"
]) {
  requireIncludes(app, snippet, `app.mjs missing resource guard: ${snippet}`);
}

for (const snippet of [
  'localStorage.getItem("roughPptRecentShapes")',
  'Array.isArray(values) ? values.filter(value => typeof value === "string") : []',
  'localStorage.getItem("roughPptFavoriteShapes")'
]) {
  requireIncludes(app, snippet, "app.mjs missing shape preference validation");
}

for (const snippet of [
  'allowedValue("mode", "3d", ["3d", "2d"])',
  'boundedNumber("countX", 3, 1, 32, true)',
  'boundedNumber("gapPt", 0, 0, 16)',
  'colorValue("strokeColor", "#000000")',
  "source.gradientReverse === true"
]) {
  requireIncludes(app, snippet, "app.mjs missing feature block default validation");
}

for (const snippet of [
  "const styleParamRules = Object.freeze({",
  'roughSource: { type: "enum", values: ["native", "roughjs", "excalidraw", "drawio", "d2", "tldraw"] },',
  "result[name] = rule.values.includes(value) ? value : baseStyleParams[name];",
  "result[name] = \"min\" in rule ? Math.min(rule.max, Math.max(rule.min, rounded)) : rounded;"
]) {
  requireIncludes(app, snippet, "app.mjs missing style template parameter validation");
}

requirePattern(app, /els\.search\.addEventListener\("input",\s*\(\)\s*=>\s*\{[\s\S]*?state\.query\s*=\s*els\.search\.value;[\s\S]*?resetResourceRenderWindows\((?:"chart"|\[[^\]]*"chart"[^\]]*\])\);[\s\S]*?scheduleRender\(\);/, "search input must schedule one render per frame");
requirePattern(app, /els\.search\.addEventListener\("keydown",\s*event\s*=>\s*\{\s*flushScheduledRender\(\);/, "keyboard command handling must flush pending search render first");
requireIncludes(app, "function requestZoteroImages(force = false)", "Zotero image requests must support forced reloads");
requireIncludes(app, "if (zoteroImageRequestInFlight)", "Zotero image requests must be single-flight");
requireIncludes(app, "completeZoteroImageRequest();", "Zotero image responses must release queued requests");
requirePattern(app, /els\.zoteroImageSearch\?\.addEventListener\("input",\s*\(\)\s*=>\s*\{[\s\S]*?state\.zoteroQuery\s*=\s*els\.zoteroImageSearch\.value;[\s\S]*?resetResourceRenderWindows\((?:\[[^\]]*"zotero"[^\]]*"palette"[^\]]*\])\);[\s\S]*?scheduleZoteroLibraryRender\(\);/, "Zotero search input must batch image and palette render");
requirePattern(app, /els\.zoteroImageSearch\?\.addEventListener\("keydown",\s*event\s*=>\s*\{\s*flushZoteroLibraryRender\(\);/, "Zotero keyboard handling must flush batched render first");

for (const snippet of [
  "const ZLK_IMPORT_MAX_FILES = 120",
  "const ZLK_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024",
  "const ZLK_IMPORT_SUPPORTED_EXTENSIONS = new Set([\".json\", \".csv\", \".tex\", \".md\"])",
  "function filterZlkChartFilesForImport",
  "file.size || 0",
  "文件超过 2MB，已跳过",
  "避免扫描 raw dataset、checkpoint 或日志全文",
  "没有选择可读取的轻量结果文件",
  "ZLK_IMPORT_MAX_FILES"
]) {
  requireIncludes(app, snippet, `app.mjs missing ZLK import guard: ${snippet}`);
}

for (const snippet of [
  'resetResourceRenderWindows("chart");',
  'resetResourceRenderWindows("zotero");',
  'resetResourceRenderWindows("palette");'
]) {
  const count = app.split(snippet).length - 1;
  if (count < 2) violations.push(`app.mjs should reset resource window on data/search changes: ${snippet}`);
}

requireIncludes(css, ".resource-load-more", "styles.css missing resource load-more button");
requireIncludes(css, "border: 1px dashed var(--accent-line)", "styles.css missing non-destructive load-more affordance");
requireIncludes(index, 'accept=".json,.csv,.tex,.md"', "index.html ZLK file picker must accept Markdown summaries");
requireIncludes(index, "超大文件会被跳过", "index.html ZLK picker must explain large-file skip in Chinese tooltip");
requireIncludes(packageJson.scripts.test, "node scripts/validate-taskpane-resource-guards.mjs", "npm test must include resource guard validation");

if (violations.length) {
  throw new Error(`taskpane resource guard validation failed:\n${violations.join("\n")}`);
}

console.log("taskpane resource guards ok");
