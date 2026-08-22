import fs from "node:fs";
import path from "node:path";
import {
  startStaticServer,
  launchBrowser,
  connectToBrowser,
  evaluate,
  waitFor,
  waitForExit,
  delay
} from "./lib/ui-browser.mjs";

const read = path => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const app = read("src/RoughPptAddin/ui/app.mjs");
const index = read("src/RoughPptAddin/ui/index.html");
const bridgeContract = read("src/RoughPptAddin/ui/bridge-contract.mjs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const guideWindow = read("src/RoughPptAddin/TaskPane/UsageGuideWindow.cs");
const project = read("src/RoughPptAddin/RoughPptAddin.csproj");
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
  'case "openUsageGuide":',
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
  'Navigate("https://rough-ppt.local/help.html")',
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
  'querySelector("#usageGuide")',
  'postHost({ type: "openUsageGuide" })',
  "generator.generate",
  "roughPptTaskPaneReady"
]) {
  if (!app.includes(snippet)) violations.push(`UI runtime regression missing: ${snippet}`);
}

// 使用说明目录是自定义控件，每个章节链接都必须有中文悬浮说明，
// 让用户在点击前就知道该章节讲什么。
const help = read("src/RoughPptAddin/ui/help.html");
const helpCss = read("src/RoughPptAddin/ui/help.css");
const helpApp = read("src/RoughPptAddin/ui/help.mjs");
const guideNav = help.match(/<nav class="guide-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
if (!help.includes('id="guideSkipLink"') || !help.includes('href="#guideMain"')) violations.push("help.html missing skip-to-content link");
if (!help.includes('<main id="guideMain" tabindex="-1">')) violations.push("help.html main target must be focusable");
if (!helpCss.includes(".skip-link:focus-visible")) violations.push("help.css missing visible skip-link focus state");
if (!guideNav) {
  violations.push("help.html missing guide-nav table of contents");
} else {
  const links = [...guideNav.matchAll(/<a\s([^>]*)>([^<]*)<\/a>/g)];
  if (links.length < 10) violations.push(`help.html guide-nav must keep at least 10 section links, found ${links.length}`);
  for (const [, attributes, label] of links) {
    const title = attributes.match(/title="([^"]*)"/)?.[1] ?? "";
    if (!title.trim()) {
      violations.push(`help.html guide-nav link lacks a Chinese tooltip: ${label.trim()}`);
    } else if (!/[㐀-鿿]/.test(title)) {
      violations.push(`help.html guide-nav tooltip lacks Chinese text: ${label.trim()} => ${title}`);
    } else if (title.trim() === label.trim()) {
      violations.push(`help.html guide-nav tooltip must add information beyond the label: ${label.trim()}`);
    }
  }
}

for (const snippet of ["markActiveGuideSection", "scheduleGuideScrollSync", "requestAnimationFrame(() => requestAnimationFrame(markActiveGuideSection))", 'setAttribute("aria-current", "true")']) {
  if (!helpApp.includes(snippet)) violations.push(`help.mjs missing guide scroll highlight: ${snippet}`);
}
for (const snippet of [".guide-nav a.active", '.guide-nav a[aria-current="true"]', "box-shadow: inset 0 -2px 0"]) {
  if (!helpCss.includes(snippet)) violations.push(`help.css missing active section state: ${snippet}`);
}

if (violations.length) {
  throw new Error(`usage guide modeless validation failed:\n${violations.join("\n")}`);
}

const uiRoot = path.join(process.cwd(), "src", "RoughPptAddin", "ui");
const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("usage-guide-scroll-browser");
const client = await connectToBrowser(browser.port);

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/help.html` });
  await waitFor(client, "document.readyState === 'complete' && document.querySelector('.guide-nav a.active')?.hash === '#quick-start'");
  await evaluate(client, "document.querySelector('.guide-nav a[href=\\'#charts\\']')?.click()");
  await waitFor(client, "document.querySelector('.guide-nav a.active')?.hash === '#charts' && Math.abs(document.querySelector('#charts').getBoundingClientRect().top) < 240");
  const state = await evaluate(client, "({active:document.querySelector('.guide-nav a.active')?.textContent,current:document.querySelector('.guide-nav a[aria-current=true]')?.getAttribute('aria-current'),count:document.querySelectorAll('.guide-nav a.active').length})");
  if (state.count !== 1 || state.current !== "true" || state.active !== "科研绘图") {
    violations.push(`usage guide scroll highlight state invalid: ${JSON.stringify(state)}`);
  }
  await evaluate(client, "document.querySelector('#guideSkipLink').focus()");
  await evaluate(client, "document.querySelector('#guideSkipLink').click()");
  await delay(100);
  const skipState = await evaluate(client, `(() => ({
    hash: location.hash,
    focusedMain: document.activeElement === document.querySelector('#guideMain')
  }))()`);
  if (skipState.hash !== "#guideMain" || !skipState.focusedMain) {
    violations.push(`usage guide skip link failed: ${JSON.stringify(skipState)}`);
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) {
  throw new Error(`usage guide modeless validation failed:\n${violations.join("\n")}`);
}

console.log("usage guide modeless contract ok");
