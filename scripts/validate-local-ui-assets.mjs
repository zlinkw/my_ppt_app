import fs from "node:fs";
import path from "node:path";

const required = [
  "index.html",
  "help.html",
  "help.mjs",
  "help.css",
  "app.mjs",
  "rough-shape-generator.mjs",
  "office-preset-outlines.mjs",
  "zlk-cluster-result-importer.mjs",
  "autoshape-catalog.json",
  "styles.css",
  "vendor/rough.esm.js"
];

const requiredGuideImages = [
  "help-assets/taskpane-overview.png",
  "help-assets/style-workspace.png",
  "help-assets/feature-workspace.png",
  "help-assets/chart-workspace.png"
];

const validatePublish = process.argv.includes("--publish");
const roots = ["src/RoughPptAddin/ui"];
if (validatePublish) {
  if (!fs.existsSync("publish/ui")) {
    throw new Error("local UI asset validation failed:\npublish/ui missing. Run scripts/build.ps1 first.");
  }
  roots.push("publish/ui");
}

const violations = [];

for (const root of roots) {
  for (const file of required) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) violations.push(`${root}: missing ${file}`);
  }
  for (const file of requiredGuideImages) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) violations.push(`${root}: missing ${file}`);
  }
}

const checkedFiles = [
  "src/RoughPptAddin/ui/index.html",
  "src/RoughPptAddin/ui/help.html",
  "src/RoughPptAddin/ui/help.mjs",
  "src/RoughPptAddin/ui/help.css",
  "src/RoughPptAddin/ui/app.mjs",
  "src/RoughPptAddin/ui/rough-shape-generator.mjs",
  "src/RoughPptAddin/ui/office-preset-outlines.mjs",
  "src/RoughPptAddin/ui/zlk-cluster-result-importer.mjs",
  "src/RoughPptAddin/ui/styles.css"
];

for (const file of checkedFiles) {
  const text = fs.readFileSync(file, "utf8");
  const external = [...text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map(match => match[0]);
  for (const url of external) {
    if (url !== "http://www.w3.org/2000/svg") violations.push(`${file}: external URL ${url}`);
  }
  if (/\b(src|href)\s*=\s*["']https?:\/\//i.test(text)) {
    violations.push(`${file}: remote script/style/media URL is not allowed`);
  }
  if (/\bfetch\s*\(\s*["']https?:\/\//i.test(text)) {
    violations.push(`${file}: remote fetch is not allowed`);
  }
}

const bridge = fs.readFileSync("src/RoughPptAddin/Services/RoughJsBridge.cs", "utf8");
const pane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");

for (const [label, snippet] of [
  ["local virtual host", "SetVirtualHostNameToFolderMapping"],
  ["local WebView user data", "UserDataFolder"],
  ["external request block", "WebResourceRequested"],
  ["UI asset validation", "ValidateUiDirectory"],
  ["ready wait", "WaitUntilReadyAsync"],
  ["diagnostic log", "AddInLogger"],
  ["prewarm hidden pane", "PrewarmTaskPane"]
]) {
  if (!bridge.includes(snippet) && !pane.includes(snippet) && !controller.includes(snippet)) {
    violations.push(`local WebView contract missing: ${label}`);
  }
}

for (const [label, snippet] of [
  ["fixed local host", 'private const string UiHostName = "rough-ppt.local"'],
  ["virtual host navigation", '"https://" + UiHostName + "/index.html"'],
  ["folder mapping", "SetVirtualHostNameToFolderMapping(UiHostName, uiDirectory"],
  ["all-request filter", 'AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All)'],
  ["403 external block", "CreateWebResourceResponse("],
  ["required rough bundle", 'Path.Combine("vendor", "rough.esm.js")']
]) {
  if (!bridge.includes(snippet)) violations.push(`RoughJsBridge.cs: offline contract missing ${label}`);
}

if (!bridge.includes("IsAllowedLocalUri") ||
    !bridge.includes("UiHostName") ||
    !bridge.includes('string.Equals(uri.Scheme, "file"') ||
    !bridge.includes('string.Equals(uri.Scheme, "data"') ||
    !bridge.includes('string.Equals(uri.Scheme, "about"') ||
    !bridge.includes('string.Equals(uri.Scheme, "blob"')) {
  violations.push("RoughJsBridge.cs: allowed resource schemes are not explicitly local-only");
}

if (bridge.includes("CoreWebView2HostResourceAccessKind.AllowCors")) {
  violations.push("RoughJsBridge.cs: local UI mapping must not use AllowCors");
}

if (controller.includes("再次插入")) {
  violations.push("controller must auto-wait and continue insertion instead of asking user to retry");
}

if (violations.length) {
  throw new Error(`local UI asset validation failed:\n${violations.join("\n")}`);
}

console.log(`local UI assets ok: ${roots.join(", ")}`);
