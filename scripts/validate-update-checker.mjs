import fs from "node:fs";

const service = read("src/RoughPptAddin/Services/GitHubUpdateService.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const app = read("src/RoughPptAddin/ui/app.mjs");
const html = read("src/RoughPptAddin/ui/index.html");
const readme = read("README.md");
const guide = read("docs/USER_GUIDE.md");
const help = read("src/RoughPptAddin/ui/help.html");
const violations = [];

for (const needle of [
  "https://api.github.com/repos/zlinkw/my_ppt_app/releases/latest",
  "https://github.com/zlinkw/my_ppt_app/releases",
  "MaxResponseBytes = 1048576L",
  'IsTrue(release, "draft")',
  'IsTrue(release, "prerelease")',
  "ReadInstalledVersion()",
  "CompareVersions(result.CurrentVersion, result.LatestVersion)",
  "GitHub 更新响应为空。",
  "GitHub 访问频率受限，请稍后再试。",
  "无法连接 GitHub 更新服务。"
]) {
  if (!service.includes(needle)) violations.push(`GitHub update service missing contract: ${needle}`);
}

if (!service.includes("Process.Start(new ProcessStartInfo")) {
  violations.push("GitHub update service must open the release page through the host shell");
}

for (const needle of [
  'case "checkForUpdates":',
  'case "openUpdateReleases":',
  "CheckForUpdatesAsync()",
  '"updateCheckState"',
  '"updateCheckResult"'
]) {
  if (!taskPane.includes(needle)) violations.push(`Task pane update bridge missing contract: ${needle}`);
}

for (const needle of [
  'id="checkUpdates"',
  'type="button"',
  "检查更新",
  "GitHub 正式 Release"
]) {
  if (!help.includes(needle)) violations.push(`Help version section missing update control contract: ${needle}`);
}
if (html.includes('id="checkUpdates"')) violations.push("Task pane top bar must not retain checkUpdates; version actions live in help.html");

for (const needle of [
  "setUpdateChecking(false)",
  'message.type === "updateCheckResult"',
  'postHost({ type: "checkForUpdates" })',
  'postHost({ type: "openUpdateReleases" })',
  "插件不会自动替换自身文件"
]) {
  if (!app.includes(needle)) violations.push(`Front-end update flow missing contract: ${needle}`);
}

for (const [name, text] of [["README.md", readme], ["docs/USER_GUIDE.md", guide], ["help.html", help]]) {
  for (const needle of ["检查更新", "GitHub", "关闭全部 PowerPoint 窗口"]) {
    if (!text.includes(needle)) violations.push(`${name} missing user-facing update guidance: ${needle}`);
  }
}

if (violations.length) {
  throw new Error(`update checker validation failed:\n${violations.join("\n")}`);
}

console.log("GitHub release update checker ok");

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}
