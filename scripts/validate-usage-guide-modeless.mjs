import fs from "node:fs";

const read = path => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const app = read("src/RoughPptAddin/ui/app.mjs");
const index = read("src/RoughPptAddin/ui/index.html");
const bridgeContract = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const guideWindow = read("src/RoughPptAddin/TaskPane/UsageGuideWindow.cs");
const project = read("src/RoughPptAddin/RoughPptAddin.csproj");
const interactions = read("scripts/validate-taskpane-ui-interactions.mjs");
const violations = [];

for (const snippet of [
  'guideLink?.addEventListener("click", event => {',
  "if (!describeHostConnection()) return;",
  "event.preventDefault();",
  'postHost({ type: "openUsageGuide" });'
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs missing modeless guide request: ${snippet}`);
}
if (!index.includes('href="./help.html"')) violations.push("index.html must retain standalone browser fallback");
if (!bridgeContract.includes('openUsageGuide: "openUsageGuide"')) violations.push("bridge contract missing openUsageGuide message type");

for (const snippet of [
  'if (type == "openUsageGuide")',
  "controller.ShowUsageGuide();"
]) {
  if (!taskPane.includes(snippet)) violations.push(`RoughTaskPaneControl.cs missing guide host wiring: ${snippet}`);
}

for (const snippet of [
  "private UsageGuideWindow usageGuideWindow;",
  "public void ShowUsageGuide()",
  "new UsageGuideWindow(",
  "usageGuideWindow.ShowAlongsidePowerPoint();",
  "usageGuideWindow?.Dispose();"
]) {
  if (!controller.includes(snippet)) violations.push(`RoughAddInController.cs missing guide window ownership: ${snippet}`);
}

for (const snippet of [
  "public sealed class UsageGuideWindow : Form",
  'Text = "Rough 使用说明";',
  "ShowInTaskbar = false;",
  "FormBorderStyle = FormBorderStyle.SizableToolWindow;",
  "public void ShowAlongsidePowerPoint()",
  "SetVirtualHostNameToFolderMapping",
  'Navigate("https://" + UiHostName + "/help.html")',
  "NavigationStarting += OnNavigationStarting;",
  'string.Equals(uri.AbsolutePath, "/index.html", StringComparison.OrdinalIgnoreCase)',
  "e.Cancel = true;",
  "e.CloseReason == CloseReason.UserClosing",
  "Hide();"
]) {
  if (!guideWindow.includes(snippet)) violations.push(`UsageGuideWindow.cs missing modeless behavior: ${snippet}`);
}
if (guideWindow.includes("ShowDialog(")) violations.push("UsageGuideWindow must remain modeless");

if (!project.includes('<Compile Include="TaskPane\\UsageGuideWindow.cs" />')) {
  violations.push("RoughPptAddin.csproj missing UsageGuideWindow compile item");
}

for (const snippet of [
  "async function validateGuideParallelUse",
  "opensModelessGuide",
  "taskPaneStaysLoaded",
  "generatorRemainsReady"
]) {
  if (!interactions.includes(snippet)) violations.push(`UI runtime regression missing: ${snippet}`);
}

if (violations.length) {
  throw new Error(`usage guide modeless validation failed:\n${violations.join("\n")}`);
}

console.log("usage guide modeless contract ok");
