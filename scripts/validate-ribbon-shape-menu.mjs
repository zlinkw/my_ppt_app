import fs from "node:fs";

const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const windowSource = fs.readFileSync("src/RoughPptAddin/Ribbon/ShapeGalleryWindow.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
const taskPaneApp = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const gallery = fs.readFileSync("src/RoughPptAddin/ui/ribbon-shape-gallery.mjs", "utf8");
const galleryHtml = fs.readFileSync("src/RoughPptAddin/ui/ribbon-shape-gallery.html", "utf8");
const galleryCss = fs.readFileSync("src/RoughPptAddin/ui/ribbon-shape-gallery.css", "utf8");
const project = fs.readFileSync("src/RoughPptAddin/RoughPptAddin.csproj", "utf8");
const allNative = fs.readFileSync("scripts/verify-native-all.ps1", "utf8");
const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8"));
const violations = [];

if (!ribbon.includes("<button id='roughShapeMenu'")) violations.push("roughShapeMenu must be a button that opens the resizable gallery window");
if (!ribbon.includes("onAction='OpenShapeGallery'")) violations.push("roughShapeMenu must call OpenShapeGallery");
if (ribbon.includes("<dynamicMenu id='roughShapeMenu'")) violations.push("roughShapeMenu must not remain a fixed-size Office dynamicMenu");
if (!ribbon.includes("ShapeGalleryWindow")) violations.push("RoughRibbon must own ShapeGalleryWindow");
if (!/new ShapeGalleryWindow\([\s\S]*?Controller\?\.InsertShape\(enumName\)/.test(ribbon)) violations.push("Ribbon gallery must insert through the same Rough native shape path");
if (!/new ShapeGalleryWindow\([\s\S]*?Controller\?\.PinQuickShape\(enumName\)/.test(ribbon)) violations.push("Ribbon gallery must pin through the same quick shape service");
if (!/new ShapeGalleryWindow\([\s\S]*?Controller\?\.UnpinQuickShape\(enumName\)/.test(ribbon)) violations.push("Ribbon gallery must unpin through the same quick shape service");
if (!ribbon.includes("() => Controller?.ListQuickShapes()")) violations.push("Ribbon gallery must read the same quick shape service");
if (!ribbon.includes("() => Controller?.GetPowerPointWindowHandle() ?? IntPtr.Zero")) violations.push("Ribbon gallery must bind to the PowerPoint owner window");
if (!ribbon.includes("showLabel='false'")) violations.push("Ribbon quick insert buttons must stay compact icon-first buttons");

for (const snippet of [
  "FormBorderStyle.Sizable",
  "SizeGripStyle.Show",
  "MinimumSize = new Size(420, 320)",
  "TopMost = false",
  "Func<IntPtr> ownerWindowHandle",
  "Show(new WindowOwner(handle))",
  "private sealed class WindowOwner : IWin32Window",
  "WebView2",
  "ribbon-shape-gallery.html",
  "WebMessageReceived",
  "NavigationCompleted",
  "insertShape?.Invoke(enumName)",
  "SendQuickShapes();"
]) {
  if (!windowSource.includes(snippet)) violations.push(`ShapeGalleryWindow.cs missing ${snippet}`);
}
if (!/SetVirtualHostNameToFolderMapping\((?:UiHostName|"rough-ppt\.local")/.test(windowSource)) {
  violations.push("ShapeGalleryWindow.cs missing local virtual host mapping");
}
if (!/pinQuickShape\?\.Invoke\(enumName\d*\)/.test(windowSource)) {
  violations.push("ShapeGalleryWindow.cs missing pin quick shape callback");
}
if (!/unpinQuickShape\?\.Invoke\(enumName\d*\)/.test(windowSource)) {
  violations.push("ShapeGalleryWindow.cs missing unpin quick shape callback");
}
if (!controller.includes("GetPowerPointWindowHandle") || !controller.includes("application.HWND")) {
  violations.push("RoughAddInController must expose PowerPoint HWND for owner-bound Ribbon gallery");
}

for (const file of ["Ribbon\\ShapeGalleryWindow.cs", "ui\\ribbon-shape-gallery.html", "ui\\ribbon-shape-gallery.mjs", "ui\\ribbon-shape-gallery.css"]) {
  if (!project.includes(file)) violations.push(`csproj missing ${file}`);
}

for (const title of ["最近使用", "线条", "矩形", "基本形状", "箭头总汇", "公式形状", "流程图", "星与旗帜", "标注", "三维对象（手绘）", "三维对象（普通）", "动作按钮"]) {
  if (!gallery.includes(`title: "${title}"`)) violations.push(`Ribbon gallery group missing: ${title}`);
  if (!taskPaneApp.includes(`title: "${title}"`)) violations.push(`Task pane gallery group missing: ${title}`);
}

for (const snippet of [
  "renderIconDropdown",
  "gallerySearch",
  "matchesQuery",
  "renderGalleryButton",
  "button.title = displayName(item)",
  "button.setAttribute(\"aria-label\", displayName(item))",
  "safeDrawNativeIconPreview(canvas, item)",
  "generator.preview?.(item.enumName",
  "ctx.strokeStyle = \"#111111\"",
  "postHost({ type: \"insertShape\", enumName: item.enumName })",
  "postHost({ type: \"pinQuickShape\", enumName: item.enumName })",
  "postHost({ type: \"unpinQuickShape\", enumName: item.enumName })",
  "button.addEventListener(\"contextmenu\"",
  "button.addEventListener(\"keydown\"",
  "event.key === \"ContextMenu\"",
  "shiftKey && event.key === \"F10\"",
  "openShapeContextMenu(event, item",
  "action.setAttribute(\"role\", \"menuitem\")",
  "action.focus({ preventScroll: true })",
  "textContent = pinned ? \"从快速插入移除\" : \"添加到快速插入\"",
  "className = `gallery-shape${isQuickShape(item.enumName) ? \" pinned\" : \"\"}`",
  "function iconVisiblePaths(drawable)",
  "path.role !== roles.innerFillBoundary",
  "message.type === \"quickShapes\"",
  "persistSetting(\"roughPptRecentShapes\"",
  "persistSetting(\"roughPptFavoriteShapes\"",
  "setStatus(`已添加到快速插入：${displayName(item)}`)",
  "renderedCount === 0 && state.query.trim()",
  "renderGalleryEmptyState",
  "className = \"gallery-empty\"",
  "dataset.galleryEmpty = \"true\"",
  "setAttribute(\"role\", \"status\")",
  "setAttribute(\"aria-live\", \"polite\")",
  "没有匹配",
  "英文枚举名",
  "清空搜索",
  "dataset.galleryEmptyClear = \"true\"",
  "clear.setAttribute(\"aria-label\", \"清空搜索并恢复形状图库\")",
  "state.query = \"\"",
  "els.search.value = \"\"",
  "els.search.focus({ preventScroll: true })",
  "已清空搜索，已恢复形状图库。",
  "renderIconDropdown(els.shapeDropdown, insertShape)"
]) {
  if (!gallery.includes(snippet)) violations.push(`Ribbon gallery script missing task-pane-equivalent behavior: ${snippet}`);
}

if (gallery.includes("name.textContent = displayName(item)") || gallery.includes("button.append(canvas, name)")) {
  violations.push("Ribbon gallery items must render icons only, not visible names");
}
if (!galleryHtml.includes('id="shapeDropdown"') || !galleryHtml.includes('class="shape-dropdown ribbon-shape-dropdown"') || !galleryHtml.includes('id="shapeContextMenu"') || !galleryHtml.includes('id="gallerySearch"')) {
  violations.push("Ribbon gallery HTML must use the same shape dropdown class");
}
if (galleryHtml.includes("closeGallery") || galleryHtml.includes("ribbon-gallery-header")) {
  violations.push("Ribbon gallery HTML must not render duplicate in-page title or close button");
}
for (const snippet of ["grid-template-rows: auto minmax(0, 1fr)", ".ribbon-gallery-search", "height: 100%", "overflow: auto", "resize: none", "scrollbar-width: thin", ".ribbon-gallery-status", ".gallery-shape.pinned", ".gallery-empty", ".gallery-empty button", "border: 1px dashed", ".shape-context-menu"]) {
  if (!galleryCss.includes(snippet)) violations.push(`Ribbon gallery CSS missing ${snippet}`);
}
if (/linear-gradient|radial-gradient|conic-gradient/.test(galleryCss)) {
  violations.push("Ribbon gallery must use flat SimpleExperiment surfaces without gradients");
}

if ((catalog.items ?? []).filter(item => item.insertable !== false).length < 202) {
  violations.push("catalog insertable coverage unexpectedly low");
}
if (!allNative.includes("scripts\\verify-ribbon-shape-menu.ps1")) {
  violations.push("native verification suite must include Ribbon shape gallery smoke test");
}

// 插入和固定操作的存储写入排在 setStatus 与 postHost 之前，写入抛出会让操作彻底丢失。
for (const snippet of [
  "function persistSetting(key, value)",
  "persistSetting.reported",
  "偏好无法写入本机存储"
]) {
  if (!gallery.includes(snippet)) violations.push(`ribbon-shape-gallery.mjs guarded storage write missing: ${snippet}`);
}
const galleryPersist = gallery.match(/function persistSetting\(key, value\) \{[\s\S]*?\n\}/)?.[0] ?? "";
if (!/try\s*\{[\s\S]*localStorage\.setItem\(key, value\)[\s\S]*\}\s*catch/.test(galleryPersist)) {
  violations.push("ribbon-shape-gallery.mjs persistSetting must wrap localStorage.setItem in try/catch");
}
const galleryDirectWrites = [...gallery.matchAll(/localStorage\.setItem\(/g)].length;
if (galleryDirectWrites !== 1) {
  violations.push(`ribbon-shape-gallery.mjs localStorage.setItem must only appear inside persistSetting, found ${galleryDirectWrites}`);
}

if (violations.length) {
  throw new Error(`Ribbon shape gallery validation failed:\n${violations.join("\n")}`);
}

console.log(`ribbon shape gallery ok: ${(catalog.items ?? []).filter(item => item.insertable !== false).length} items`);
