import fs from "node:fs";

const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const taskPane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
const index = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const models = fs.readFileSync("src/RoughPptAddin/Models/RoughModels.cs", "utf8");
const writer = fs.readFileSync("src/RoughPptAddin/Services/PptFreeformWriter.cs", "utf8");
const sync = fs.readFileSync("src/RoughPptAddin/Services/PptStyleSynchronizer.cs", "utf8");
const violations = [];

for (const snippet of [
  "pendingParamEdit",
  "PARAM_SYNC_HOLD_MS",
  "markLocalParamEdit();",
  "shouldHoldLocalParams(key, style)",
  "正在等待 PowerPoint 完成实时重绘",
  "enhanceParamControls",
  "adjustParamValue",
  "syncParamControls"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing style sync guard: ${snippet}`);
}
if (!/postHost\(\{ type: "refreshSelection", params: (?:state\.params|currentStyleParams\(\)) \}\);/.test(app)) {
  violations.push("app.mjs missing style sync guard: refreshSelection post");
}
for (const snippet of ["dataset.paramNumber", "dataset.paramStep"]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing style sync guard: ${snippet}`);
}

for (const name of ["strokeWidthPt", "strokeTransparency", "roughness", "bowing", "seed", "fillTransparency"]) {
  if (!app.includes(`"${name}"`)) violations.push(`app.mjs missing numeric param control: ${name}`);
}
for (const snippet of [
  'fillTransparency: 0',
  'arrowheadPosition: "end"',
  'name="arrowheadPosition"',
  "style.ArrowheadPosition",
  "public string ArrowheadPosition",
  "FillTransparency { get; set; }",
  "BeginArrowheadStyle",
  "EndArrowheadStyle"
]) {
  const haystack = [app, index, taskPane, models, writer, sync].join("\n");
  if (!haystack.includes(snippet)) violations.push(`missing arrow/fill style contract: ${snippet}`);
}

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
for (const selector of [".param-number-row", ".param-number-input", ".param-step"]) {
  if (!css.includes(selector)) violations.push(`styles.css missing numeric param selector: ${selector}`);
}

const updateParamsStart = taskPane.indexOf('case "updateParams"');
const updateParamsEnd = taskPane.indexOf('case "refreshSelection"', updateParamsStart);
const updateParamsBlock = taskPane.slice(updateParamsStart, updateParamsEnd);
if (updateParamsBlock.includes("SendSelectionState();")) {
  violations.push("updateParams must not immediately send stale selection state back to the pane");
}

const refreshBlock = taskPane.slice(updateParamsEnd, taskPane.indexOf('case "convertSelectionToRough"', updateParamsEnd));
if (!/RoughStyle\s+style\s*=\s*ReadStyle\(message\);/.test(refreshBlock)) violations.push("refreshSelection must use current pane params: ReadStyle(message)");
if (!/RefreshSelectionNowAsync\(style\)\.ConfigureAwait\(continueOnCapturedContext:\s*true\)/.test(refreshBlock)) violations.push("refreshSelection must use current pane params: RefreshSelectionNowAsync(style)");
if (!refreshBlock.includes("SendSelectionState();")) violations.push("refreshSelection must use current pane params: SendSelectionState()");

const regenerator = fs.readFileSync("src/RoughPptAddin/Services/ShapeRegenerator.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
for (const snippet of [
  "RegenerateWithTimeoutAsync(target, styleOverride, TimeSpan.FromSeconds(20",
  "return completed;",
  "Task.WhenAny(task, Task.Delay(timeout))",
  "return true;",
  "return false;"
]) {
  if (!regenerator.includes(snippet)) violations.push(`ShapeRegenerator.cs missing synchronous redraw completion contract: ${snippet}`);
}

for (const snippet of [
  "private RoughStyle currentRoughStyle = new RoughStyle();",
  "InsertShape(sourceMsoType, currentRoughStyle);",
  "currentRoughStyle = style;",
  "style = currentRoughStyle;"
]) {
  if (!controller.includes(snippet)) violations.push(`RoughAddInController.cs missing insert style preset contract: ${snippet}`);
}

const paramsIndex = index.indexOf('<section id="params"');
const commandIndex = index.indexOf('<section class="command-bar">');
const libraryIndex = index.indexOf('<section class="library-panel panel"');
const starterIndex = index.indexOf('<section class="starter-panel');
if (!(starterIndex >= 0 && commandIndex > starterIndex && commandIndex < paramsIndex && paramsIndex < libraryIndex)) {
  violations.push("search command bar must sit below the quick workbench and above parameter workspaces");
}

for (const snippet of [
  "categoryIcon(category)",
  "iconSpan(\"\\u00d7\")",
  "className = \"button-icon\""
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing button marker hook: ${snippet}`);
}

for (const snippet of [
  "public object GetShapeImage(IRibbonControl control)",
  "GetShapeImageForEnum(item.EnumName)",
  "ShapeIconFactory.Create(enumName, 32, 32"
]) {
  if (!ribbon.includes(snippet)) violations.push(`RoughRibbon.cs missing shape dropdown preview contract: ${snippet}`);
}

if (violations.length) {
  throw new Error(`style panel sync validation failed:\n${violations.join("\n")}`);
}

console.log("style panel sync ok");
