import fs from "node:fs";

const index = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const bridge = fs.readFileSync("src/RoughPptAddin/ui/bridge-contract.mjs", "utf8");
const taskPane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
const violations = [];

const expectedStaticActions = {
  convertSelection: ["els.convert.addEventListener", 'type: "convertSelectionToRough"'],
  refreshSelection: ["els.refresh.addEventListener", "redrawSelectionFromCurrentStyle"],
  redrawFromStyle: ["els.redrawFromStyle?.addEventListener", "redrawSelectionFromCurrentStyle"],
  inspectSelection: ["els.inspect.addEventListener", 'type: "inspectSelection"'],
  saveSelection: ["els.save.addEventListener", 'type: "saveSelectionAsAsset"'],
  selectCarrier: ["els.selectCarrier.addEventListener", 'type: "selectNativeCarrier"'],
  applyStyleTemplate: ["els.applyStyleTemplate?.addEventListener", "applySelectedStyleTemplate"],
  saveStyleTemplate: ["els.saveStyleTemplate?.addEventListener", "saveCurrentStyleTemplate"],
  renameStyleTemplate: ["els.renameStyleTemplate?.addEventListener", "renameSelectedStyleTemplate"],
  zlkChartImport: ["els.zlkChartImport?.addEventListener", "zlkChartFiles?.click"],
  zlkChartFolderButton: ["els.zlkChartFolderButton?.addEventListener", "zlkChartFolder?.click"],
  zlkChartClear: ["els.zlkChartClear?.addEventListener", "已清空科研绘图导入预览"],
  zoteroImageReload: ["els.zoteroImageReload?.addEventListener", "requestZoteroImages"],
  saveZoteroPalette: ["els.saveZoteroPalette?.addEventListener", 'type: "saveZoteroPalette"'],
  extractClipboardPalette: ["els.extractClipboardPalette?.addEventListener", 'type: "extractClipboardPalette"'],
  extractSlidePalette: ["els.extractSlidePalette?.addEventListener", 'type: "extractSlidePalette"'],
  importPalettes: ["els.importPalettes?.addEventListener", 'type: "importPalettes"'],
  exportPalettes: ["els.exportPalettes?.addEventListener", 'type: "exportPalettes"'],
  reloadPalettes: ["els.reloadPalettes?.addEventListener", "requestPalettes"],
  saveFeatureDefault: ["els.saveFeatureDefault?.addEventListener", "saveFeatureBlockDefault"],
  insertFeatureBlock: ["els.insertFeatureBlock?.addEventListener", 'type: "insertFeatureBlock"'],
  reloadAssets: ["els.reloadAssets.addEventListener", "requestUserAssets"],
  selectAssets: ["els.selectAssets.addEventListener", "toggleAssetSelection"],
  importAssets: ["els.importAssets.addEventListener", 'type: "importUserAssets"'],
  exportAssets: ["els.exportAssets.addEventListener", 'type: "exportUserAssets"'],
  galleryToggle: ["els.galleryToggle.addEventListener", "toggleShapeDropdown"],
  quickAddToggle: ["els.quickAddToggle.addEventListener", "toggleQuickShapeDropdown"],
  reloadQuickShapes: ["els.reloadQuickShapes.addEventListener", "requestQuickShapes"]
};

for (const [id, snippets] of Object.entries(expectedStaticActions)) {
  if (!index.includes(`id="${id}"`)) violations.push(`index.html missing action button: ${id}`);
  for (const snippet of snippets) {
    if (!app.includes(snippet)) violations.push(`app.mjs missing ${id} wiring: ${snippet}`);
  }
}

// T5 灰度折叠断言：去重高频区只加 hidden/disabled，不删 id/wiring（可回滚）。
// style-param-jump 为风格参数分组导航（常用/边界/填充/嵌套/线条），保留可见做任务窗格内跳转，不随 Ribbon 灰度折叠。
for (const pattern of [
  /id="noviceGuideStrip"[^>]*\bhidden\b/,
  /class="quick-actions"[^>]*\bhidden\b/,
  /class="style-quick-strip"[^>]*\bhidden\b/
]) {
  if (!pattern.test(index)) violations.push(`task pane gray-out missing hidden fold: ${pattern}`);
}
if (/class="style-param-jump"[^>]*\bhidden\b/.test(index)) violations.push("style-param-jump must stay visible for param group navigation");
for (const jump of ["常用", "边界", "填充纹理", "嵌套", "线条"]) {
  if (!index.includes(`data-param-group-jump="${jump}"`)) violations.push(`style-param-jump missing button: ${jump}`);
}

for (const type of [...app.matchAll(/postHost\(\{\s*type:\s*"([^"]+)"/g)].map(match => match[1])) {
  if (!bridge.includes(`${type}: "${type}"`)) violations.push(`bridge-contract.mjs missing message type: ${type}`);
  if (!new RegExp(`(?:case\\s+"${type}"\\s*:|type\\s*==\\s*"${type}")`).test(taskPane)) violations.push(`RoughTaskPaneControl.cs missing handler: ${type}`);
}

for (const snippet of [
  'case "updateParams":',
  "await controller.RefreshSelectionNowAsync(style2)",
  'case "refreshSelection":',
  "await controller.RefreshSelectionNowAsync(style)",
  'case "adjustFeatureBlockDirection":',
  "controller.AdjustSelectedFeatureBlock",
  'case "updateFeatureBlockSelection":',
  "controller.UpdateSelectedFeatureBlock",
  "FeatureBlockMutationResult.Updated",
  "FeatureBlockMutationResult.Inserted",
  "PostStatus(\"已按方向直接更新选中特征块。\""
]) {
  if (!taskPane.includes(snippet)) violations.push(`task pane missing non-fake action completion: ${snippet}`);
}

for (const snippet of [
  "AdjustSelectedFeatureBlock(FeatureBlockOptions options",
  "UpdateSelectedFeatureBlock(FeatureBlockOptions options)",
  "AdjustFeatureBlockInternal",
  "请先选中一个特征块后再调整方向；方向调整不会新建特征块。",
  "featureBlocks.Replace(GetCurrentSlide(), selectedFeatureBlock, options)"
]) {
  if (!controller.includes(snippet)) violations.push(`controller missing direct feature direction update: ${snippet}`);
}

for (const snippet of [
  'type: "adjustFeatureBlockDirection"',
  "postHost({ type: \"refreshSelection\", params: currentStyleParams() });",
  "postHost({ type: \"updateParams\", params: currentStyleParams() });",
  "fillMode",
  "fillColor",
  "stroke",
  "dashStyle",
  "arrowheadStyle"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing redraw/param action: ${snippet}`);
}

if (violations.length) {
  throw new Error(`task pane action wiring validation failed:\n${violations.join("\n")}`);
}

console.log("task pane action wiring ok");
