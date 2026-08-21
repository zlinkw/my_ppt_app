import fs from "node:fs";

const index = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const violations = [];

for (const snippet of [
  'id="galleryToggle"',
  'id="shapeDropdown"',
  'id="quickShapes"',
  'class="library-icon"',
  "形状图库",
  "像 PowerPoint 插入形状一样展开分类图库",
  "快速插入"
]) {
  if (!index.includes(snippet)) violations.push(`index.html missing ${snippet}`);
}

for (const group of ["最近使用", "线条", "矩形", "基本形状", "箭头总汇", "公式形状", "流程图", "星与旗帜", "标注", "动作按钮"]) {
  if (!app.includes(group)) violations.push(`task pane gallery group missing: ${group}`);
}

for (const snippet of [
  "renderShapeDropdown",
  "renderGalleryButton",
  "renderGalleryIcon",
  "toggleShapeDropdown",
  "closeShapeDropdown",
  "aria-expanded",
  "drawPreview(canvas, item)",
  "shapeIcons",
  "message.type === \"shapeIcons\"",
  "message.type === \"quickShapes\"",
  "renderQuickShapes",
  "toggleQuickShape",
  "pinQuickShape",
  "unpinQuickShape",
  "button.title = displayName(item)"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing ${snippet}`);
}
if (!app.includes("完整形状目录读取失败，当前只显示常用形状兜底")) {
  violations.push("app.mjs missing catalog fallback user feedback");
}
if (!app.includes("state.catalogDegraded = true") || !app.includes("if (state.catalogDegraded) {")) {
  violations.push("app.mjs must preserve catalog fallback feedback after initialization status updates");
}

const galleryApp = fs.readFileSync("src/RoughPptAddin/ui/ribbon-shape-gallery.mjs", "utf8");
for (const snippet of [
  "形状目录读取失败，请重新打开窗口",
  "形状目录不可用。",
  "未读取到形状目录"
]) {
  if (!galleryApp.includes(snippet)) violations.push(`ribbon-shape-gallery.mjs missing catalog failure feedback: ${snippet}`);
}
if (app.includes("button.title = `${group.title} - ${displayName(item)}")) {
  violations.push("app.mjs shape dropdown hover text must be only the shape name");
}
if (app.includes("name.textContent = displayName(item);") && app.includes("button.append(canvas, name);")) {
  violations.push("app.mjs shape dropdown should not duplicate names under every icon");
}

const generator = fs.readFileSync("src/RoughPptAddin/ui/rough-shape-generator.mjs", "utf8");
if (!generator.includes("function previewShapeForMso")) {
  violations.push("rough-shape-generator.mjs missing Office-outline-first preview path");
}
if (!generator.includes("const officeOutline = officeOutlineShape(enumName, w, h, style);")) {
  violations.push("rough-shape-generator.mjs preview must prefer Office-derived outlines");
}

for (const selector of [".gallery-toggle", ".shape-dropdown", ".gallery-group", ".gallery-shape", ".gallery-icon", ".quick-shapes", ".quick-shape", ".quick-empty", ".library-icon"]) {
  if (!css.includes(selector)) violations.push(`styles.css missing ${selector}`);
}
for (const snippet of ["resize: both", "min-width:", "min-height:", "max-width: calc(100vw - 20px)", "display: flex", "flex-wrap: wrap"]) {
  if (!css.includes(snippet)) violations.push(`styles.css missing resizable dense dropdown rule: ${snippet}`);
}

const taskPane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
for (const snippet of [
  "SendShapeIcons();",
  "SendQuickShapes();",
  "type\"] = \"shapeIcons\"",
  "type\"] = \"quickShapes\"",
  "BuildShapeIconPayload",
  "BuildQuickShapePayload",
  "controller.GetOfficeShapeIconDataUrl(item.EnumName, item.Category, 32, 32)"
]) {
  if (!taskPane.includes(snippet)) violations.push(`RoughTaskPaneControl.cs missing shape icon payload hook: ${snippet}`);
}

const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
for (const snippet of [
  "GetOfficeShapeIconDataUrl",
  "CommandBars",
  "GetImageMso",
  "PictureConverter.FromPicture",
  "data:image/png;base64,",
  "ListQuickShapes",
  "PinQuickShape",
  "UnpinQuickShape"
]) {
  if (!controller.includes(snippet)) violations.push(`RoughAddInController.cs missing local PowerPoint icon reuse hook: ${snippet}`);
}

const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
for (const snippet of [
  "getImage='GetLibraryImage'",
  "public object GetLibraryImage(IRibbonControl control)",
  "LibraryIconFactory.Create(control?.Id, 32, 32)"
]) {
  if (!ribbon.includes(snippet)) violations.push(`RoughRibbon.cs missing library icon contract: ${snippet}`);
}

const quickShapeService = fs.readFileSync("src/RoughPptAddin/Services/QuickShapeService.cs", "utf8");
for (const snippet of ["MaxQuickShapes", "quick-shapes.json", "public IList<string> Pin", "public IList<string> Unpin"]) {
  if (!quickShapeService.includes(snippet)) violations.push(`QuickShapeService.cs missing quick shape persistence: ${snippet}`);
}

if (violations.length) {
  throw new Error(`task pane shape gallery validation failed:\n${violations.join("\n")}`);
}

console.log("task pane shape gallery ok");
