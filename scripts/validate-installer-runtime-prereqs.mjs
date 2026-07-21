import fs from "node:fs";

const install = read("scripts/install.ps1");
const prereqs = read("scripts/install-prereqs.ps1");
const uninstall = read("scripts/uninstall.ps1");
const diagnose = read("scripts/diagnose.ps1");
const deploy = read("scripts/deploy.ps1");
const pack = read("scripts/package.ps1");
const installers = read("scripts/package-installers.ps1");
const deployment = read("docs/DEPLOYMENT.md");
const packageJson = JSON.parse(read("package.json"));
const violations = [];

requireRuntimeOnlyInstallPrereqs("scripts/install.ps1", install);
requireIncludes(
  install,
  "function Wait-ForPowerPointToExit",
  "install.ps1: installer must safely handle running PowerPoint before replacing files"
);
requireIncludes(
  install,
  "PowerPoint 正在运行且有打开的演示文稿。请保存并关闭 PowerPoint 后重新安装。",
  "install.ps1: running PowerPoint with open presentations must show localized actionable text"
);
requireIncludes(
  install,
  "$app.Quit()",
  "install.ps1: installer may close an empty PowerPoint instance automatically"
);
requireIncludes(
  deploy,
  'Invoke-CheckedScript "scripts\\install.ps1" @("-SkipBuild", "-InstallPrereqs")',
  "deploy.ps1: final local deployment must install missing runtime prerequisites through install.ps1"
);
requireIncludes(
  prereqs,
  "$needsBuildTools = -not $RuntimeOnly",
  "install-prereqs.ps1: Build Tools need must stay behind -RuntimeOnly guard"
);
requireIncludes(
  prereqs,
  'Install-WingetPackage "Microsoft.VisualStudio.2022.BuildTools"',
  "install-prereqs.ps1: development prerequisites must still install Office Build Tools"
);
rejectIncludes(
  prereqs,
  "Installing Rough PPT Add-in prerequisites",
  "install-prereqs.ps1: prerequisite installer status must be localized"
);
rejectIncludes(
  prereqs,
  "winget not found.",
  "install-prereqs.ps1: missing winget error must be localized"
);
requireIncludes(
  prereqs,
  "\\u6b63\\u5728\\u68c0\\u67e5 Rough PPT",
  "install-prereqs.ps1: prerequisite detector must show Chinese status text"
);
for (const snippet of [
  "function Open-OfficialPrerequisiteHelp",
  "https://apps.microsoft.com/detail/9NBLGGH4NNS1",
  "https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48",
  "https://developer.microsoft.com/microsoft-edge/webview2/",
  "https://www.microsoft.com/download/details.aspx?id=48217",
  "Start-Process -FilePath $parsed.AbsoluteUri",
  "已打开 Microsoft 官方",
  "\\u81ea\\u52a8\\u5b89\\u88c5\\u5931\\u8d25"
]) {
  requireIncludes(prereqs, snippet, `install-prereqs.ps1: missing official prerequisite guidance ${snippet}`);
}
for (const snippet of [
  "function Test-DotNetFramework48",
  "function Open-OfficialInstallPage",
  "https://www.microsoft.com/microsoft-365/powerpoint",
  "if ((-not (Test-DotNetFramework48))",
  "Start-Process -FilePath $Uri"
]) {
  requireIncludes(install, snippet, `install.ps1: missing installer environment guidance ${snippet}`);
}
rejectIncludes(
  uninstall,
  "Removed registry add-in key",
  "uninstall.ps1: uninstall status must be localized"
);
rejectIncludes(
  uninstall,
  "If the add-in remains",
  "uninstall.ps1: ClickOnce cache guidance must be localized"
);
requireIncludes(
  uninstall,
  "\\u5df2\\u79fb\\u9664 PowerPoint",
  "uninstall.ps1: uninstall success text must be Chinese"
);
rejectIncludes(
  diagnose,
  "Rough PPT Add-in diagnostics",
  "diagnose.ps1: diagnostic heading must be localized"
);
rejectIncludes(
  diagnose,
  "Diagnostics complete",
  "diagnose.ps1: diagnostic completion text must be localized"
);
requireIncludes(
  diagnose,
  "Rough PPT \\u63d2\\u4ef6\\u8bca\\u65ad",
  "diagnose.ps1: diagnostic heading must be Chinese"
);

requireIncludes(
  pack,
  'powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\\install.ps1" -SkipBuild -InstallPrereqs',
  "package.ps1: portable installer command must call install.ps1 -SkipBuild -InstallPrereqs"
);
rejectDirectPrereqInstall("scripts/package.ps1", pack);

requireIncludes(
  installers,
  '& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $work "scripts\\install.ps1") -SkipBuild -InstallPrereqs',
  "package-installers.ps1: MSI runner must call install.ps1 -SkipBuild -InstallPrereqs"
);
requireIncludes(
  installers,
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%WORK%\\scripts\\install.ps1" -SkipBuild -InstallPrereqs',
  "package-installers.ps1: EXE runner must call install.ps1 -SkipBuild -InstallPrereqs"
);
rejectDirectPrereqInstall("scripts/package-installers.ps1", installers);
rejectIncludes(
  installers,
  "Microsoft.VisualStudio.2022.BuildTools",
  "package-installers.ps1: installers must never embed Build Tools installation"
);
requireIncludes(
  installers,
  'AllowSameVersionUpgrades="yes"',
  "package-installers.ps1: MSI installer must support same-version overwrite installation"
);
requireIncludes(
  installers,
  '<Custom Action="RunInstall" After="InstallFiles">NOT REMOVE~="ALL"</Custom>',
  "package-installers.ps1: MSI repair/rerun must reinstall the payload for overwrite installation"
);
requireIncludes(
  installers,
  'InstallScope="perUser" InstallPrivileges="limited"',
  "package-installers.ps1: end-user MSI must remain current-user only and must not request elevation"
);
requireIncludes(
  installers,
  '<Directory Id="RoughInstallerPayloadFolder" Name="RoughPptAddinInstaller" />',
  "package-installers.ps1: end-user MSI staging must remain in a private fixed LocalAppData directory"
);
rejectIncludes(
  installers,
  '<Directory Id="INSTALLFOLDER"',
  "package-installers.ps1: end-user MSI must not expose an overridable installation directory"
);

requireIncludes(
  packageJson.scripts?.test ?? "",
  "node scripts/validate-installer-runtime-prereqs.mjs",
  "package.json: npm test must include runtime-only prerequisite contract validation"
);
requireIncludes(
  deployment,
  "End-user installers only install WebView2 Runtime and VSTO Runtime when missing. Build Tools are development and packaging prerequisites only.",
  "docs/DEPLOYMENT.md: end-user installer runtime-only contract must be documented"
);
requireIncludes(
  deployment,
  "The MSI is per-user and limited",
  "docs/DEPLOYMENT.md: non-elevated current-user installation must be documented"
);

if (violations.length) {
  throw new Error(`installer prerequisite contract failed:\n${violations.join("\n")}`);
}

console.log("installer runtime prerequisite contract ok");

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function requireIncludes(text, needle, message) {
  if (!text.includes(needle)) violations.push(message);
}

function rejectIncludes(text, needle, message) {
  if (text.includes(needle)) violations.push(message);
}

function requireRuntimeOnlyInstallPrereqs(path, text) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/install-prereqs\.ps1/i.test(line) && !/-RuntimeOnly\b/i.test(line)) {
      violations.push(`${path}:${index + 1}: install-prereqs.ps1 must be called with -RuntimeOnly`);
    }
  });
}

function rejectDirectPrereqInstall(path, text) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/(?:powershell|pwsh|&)\b.*install-prereqs\.ps1/i.test(line)) {
      violations.push(`${path}:${index + 1}: installer packaging must call install.ps1, not install-prereqs.ps1 directly`);
    }
  });
}
