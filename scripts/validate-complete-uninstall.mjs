import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const complete = read("scripts/uninstall-completely.ps1");
const pack = read("scripts/package.ps1");
const verify = read("scripts/verify-deploy-package.ps1");
const deployment = read("docs/DEPLOYMENT.md");
const packageJson = JSON.parse(read("package.json"));
const violations = [];

for (const snippet of [
  "[switch]$ConfirmCompleteRemoval",
  "if (-not $ConfirmCompleteRemoval)",
  "Get-Process POWERPNT",
  "脚本不会自动关闭 PowerPoint",
  '& powershell -NoProfile -ExecutionPolicy Bypass -File $baseUninstall -PurgeUserData',
  '$installer.RelatedProducts($upgradeCode)',
  'Start-Process -FilePath "$env:WINDIR\\System32\\msiexec.exe"',
  '"HKCU:\\Software\\Microsoft\\Office\\PowerPoint\\Addins\\RoughPptAddin"',
  '"HKCU:\\Software\\RoughPptAddin\\Installer"',
  'Join-Path $localAppDataRoot "RoughPptAddin"',
  'Join-Path $documentsBase "RoughPptAddin"',
  'Join-Path $localAppDataRoot "RoughPptAddinInstaller"',
  '"Cert:\\CurrentUser\\TrustedPublisher"',
  '"Cert:\\CurrentUser\\Root"',
  '"Cert:\\CurrentUser\\My"',
  "RoughPptAddinSetup-",
  "彻底卸载完成"
]) {
  if (!complete.includes(snippet)) violations.push(`uninstall-completely.ps1 missing: ${snippet}`);
}

if (!complete.includes("已保留 Zotero 共享论文图像库") || !complete.includes("系统级 WebView2、VSTO 和 .NET Framework 运行时")) {
  violations.push("complete uninstall must state shared external data and system runtime preservation");
}
if (complete.includes("CleanOnlineAppCache")) violations.push("complete uninstall must not wipe the global ClickOnce cache");

for (const snippet of [
  "scripts\\uninstall-completely.ps1",
  "Complete-Uninstall-RoughPptAddin.cmd",
  'scripts\\uninstall-completely.ps1" -ConfirmCompleteRemoval'
]) {
  if (!pack.includes(snippet)) violations.push(`package.ps1 missing complete uninstall payload: ${snippet}`);
}
for (const snippet of ["Complete-Uninstall-RoughPptAddin.cmd", "scripts\\uninstall-completely.ps1"]) {
  if (!verify.includes(snippet)) violations.push(`verify-deploy-package.ps1 missing complete uninstall artifact: ${snippet}`);
}
for (const snippet of ["Complete-Uninstall-RoughPptAddin.cmd", "%LOCALAPPDATA%\\RoughPptAddin", "%USERPROFILE%\\Documents\\RoughPptAddin", "%LOCALAPPDATA%\\ZLK\\paper-image-library"]) {
  if (!deployment.includes(snippet)) violations.push(`DEPLOYMENT.md missing complete uninstall scope: ${snippet}`);
}
if (!(packageJson.scripts?.test || "").includes("node scripts/validate-complete-uninstall.mjs")) {
  violations.push("package.json npm test missing complete uninstall validation");
}

if (violations.length) throw new Error(`complete uninstall validation failed:\n${violations.join("\n")}`);
console.log("complete uninstall contract ok");
