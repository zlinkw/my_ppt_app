import fs from "node:fs";

const violations = [];

const models = read("src/RoughPptAddin/Models/RoughModels.cs");
const service = read("src/RoughPptAddin/Services/PaletteLibraryService.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const app = read("src/RoughPptAddin/ui/app.mjs");
const index = read("src/RoughPptAddin/ui/index.html");
const css = read("src/RoughPptAddin/ui/styles.css");
const bridge = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const architecture = read("docs/ARCHITECTURE.md");
const sourceConstraints = read("scripts/validate-source-constraints.mjs");

for (const snippet of [
  "PaletteSchemeInfo",
  "PaletteLayoutInfo",
  "List<ZoteroSwatchInfo> Swatches",
  "List<PaletteLayoutInfo> Layouts",
]) {
  requireIncludes(models, snippet, `models missing palette contract: ${snippet}`);
}

for (const snippet of [
  "public sealed class PaletteLibraryService",
  "ListPalettes(PowerPoint.Application application)",
  "ListPowerPointThemePalettes(application)",
  "TryReadCurrentTheme",
  "BuiltInFallbackPalettes",
  "SaveZoteroPalette",
  "ExtractFromClipboardImage",
  "Clipboard.ContainsImage()",
  "ExtractFromCurrentSlide",
  "slide.Export(tempPath, \"PNG\", 1280, 720)",
  "BuildExtractedPalette",
  "ExtractDominantColors",
  "BuildLayouts",
  "ExportPalettes",
  "ImportPalettes",
  "MaxPalettePackageBytes = 5L * 1024L * 1024L",
  "SafeExtractPaletteZip",
  "rough-ppt-palette-package",
  "safeForSocialTransfer",
  "Path.GetFullPath",
  "entryName.Contains(\"../\")",
]) {
  requireIncludes(service, snippet, `PaletteLibraryService missing: ${snippet}`);
}

for (const snippet of [
  "private readonly PaletteLibraryService palettes",
  "ListPaletteSchemes",
  "SaveCurrentZoteroPalette",
  "ExtractPaletteFromClipboardImage",
  "ExtractPaletteFromCurrentSlide",
  "ExportPalettes",
  "ImportPalettes",
  "ApplyPaletteLayout",
  "currentFeatureBlockOptions.StartColor",
  "currentFeatureBlockOptions.EndColor",
  "ApplyColorToSelection(stroke, \"stroke\")",
  "ApplyColorToSelection(fill, \"fill\")",
]) {
  requireIncludes(controller, snippet, `RoughAddInController missing palette bridge: ${snippet}`);
}

for (const type of [
  "listPalettes",
  "saveZoteroPalette",
  "extractClipboardPalette",
  "extractSlidePalette",
  "deletePalette",
  "exportPalettes",
  "importPalettes",
  "applyPaletteLayout",
]) {
  requireIncludes(taskPane, `type == "${type}"`, `task pane missing palette message: ${type}`);
  requireIncludes(bridge, `${type}: "${type}"`, `bridge contract missing palette message: ${type}`);
}

for (const snippet of [
  "SendPalettes",
  "paletteSchemes",
  "PostCommandFailure(\"保存 Zotero 配色\", ex)",
  "PostCommandFailure(\"提取剪贴板配色\", ex)",
  "PostCommandFailure(\"提取当前页面配色\", ex)",
  "PostCommandFailure(\"分享配色包\", ex)",
  "PostCommandFailure(\"导入配色包\", ex)",
  "ReadPaletteLayout",
]) {
  requireIncludes(taskPane, snippet, `task pane missing palette failure isolation: ${snippet}`);
}

for (const snippet of [
  "保存论文配色",
  "剪贴板取色",
  "页面取色",
  "导入配色",
  "分享配色",
  "PPT 内置主题配色",
  "paletteSchemeGrid",
  "paletteLibrarySummary",
]) {
  requireIncludes(index, snippet, `UI missing palette text/control: ${snippet}`);
}

const paletteToolsStart = index.indexOf('<details id="paletteToolsDetails"');
const paletteToolsEnd = index.indexOf("</details>", paletteToolsStart);
const paletteLibraryHead = index.indexOf('<div id="paletteLibraryHead"');
if (paletteToolsStart < 0 || paletteToolsEnd < 0 || paletteToolsEnd > paletteLibraryHead) {
  violations.push("palette tools details must close before the always-visible palette library");
}

for (const snippet of [
  "paletteSchemes",
  "selectedPaletteIds",
  "renderPaletteLibrary",
  "renderPaletteLayoutButton",
  "applyPaletteLayout",
  "exportPaletteIds",
  "requestPalettes",
  "saveZoteroPalette",
  "extractClipboardPalette",
  "extractSlidePalette",
  "importPalettes",
  "exportPalettes",
  "reloadPalettes",
  "cmd-palette-library",
]) {
  requireIncludes(app, snippet, `app.mjs missing palette UI behavior: ${snippet}`);
}

for (const snippet of [
  ".palette-library-toolbar",
  ".palette-scheme-grid",
  ".palette-card",
  ".palette-layout-grid",
  ".palette-layout-preview",
  ".palette-library-empty",
]) {
  requireIncludes(css, snippet, `styles.css missing palette style: ${snippet}`);
}

for (const snippet of [
  "## Palette Library",
  "当前页面取色只允许把页面临时导出为本机图片用于颜色采样",
  "分享和导入使用 `.zip` 包",
  "PowerPoint 内置主题配色只读展示",
  "不会把 PNG、SVG 或 Canvas 作为最终图形对象",
]) {
  requireIncludes(architecture, snippet, `ARCHITECTURE.md missing palette contract: ${snippet}`);
}

requireIncludes(sourceConstraints, "PaletteLibraryService\\.cs$", "source constraints must isolate palette extraction raster exception");
requireIncludes(sourceConstraints, "Palette extraction raster export exception", "source constraints must validate palette exception docs");

if (violations.length) {
  throw new Error(`palette library validation failed:\n${violations.join("\n")}`);
}

console.log("palette library contract ok");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function requireIncludes(text, snippet, message) {
  if (!text.includes(snippet)) violations.push(message);
}