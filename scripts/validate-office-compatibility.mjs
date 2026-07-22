import fs from "node:fs";
import { spawnSync } from "node:child_process";

const service = read("src/RoughPptAddin/Services/OfficeCompatibilityService.cs");
const controller = read("src/RoughPptAddin/Services/RoughAddInController.cs");
const taskPane = read("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs");
const csproj = read("src/RoughPptAddin/RoughPptAddin.csproj");
const prereqs = read("scripts/install-prereqs.ps1");
const diagnose = read("scripts/diagnose.ps1");
const help = read("src/RoughPptAddin/ui/help.html");
const packageJson = JSON.parse(read("package.json"));
const violations = [];

validatePowerShellSyntax("scripts/install-prereqs.ps1");
validatePowerShellSyntax("scripts/diagnose.ps1");

for (const snippet of [
  "MinimumSupportedPowerPointMajor = 15",
  "Environment.Is64BitProcess",
  'return "ARM64 Office"',
  "CoreWebView2Environment.GetAvailableBrowserVersionString()",
  "WebView2RuntimeNotFoundException",
  "UnauthorizedAccessException",
  "Evergreen WebView2 Runtime"
]) requireIncludes(service, snippet, `OfficeCompatibilityService.cs: missing compatibility contract ${snippet}`);

for (const [pattern, label] of [
  [/if\s*\(major\s*==\s*15\)[\s\S]{0,100}?return\s+"PowerPoint 2013"/, 'if (major == 15) return "PowerPoint 2013"'],
  [/if\s*\(major\s*==\s*16\)[\s\S]{0,100}?return\s+"PowerPoint 2016\/2019\/2021\/2024\/Microsoft 365"/, 'if (major == 16) return current PowerPoint family'],
  [/if\s*\(major\s*>\s*16\)[\s\S]{0,100}?return\s+"新版 PowerPoint"/, 'if (major > 16) return "新版 PowerPoint"']
]) requirePattern(service, pattern, `OfficeCompatibilityService.cs: missing compatibility contract ${label}`);

for (const snippet of [
  "Compatibility = OfficeCompatibilityService.Detect(application)",
  'AddInLogger.Info("宿主兼容环境：" + Compatibility.Summary)',
  "public OfficeCompatibilityInfo Compatibility"
]) requireIncludes(controller, snippet, `RoughAddInController.cs: missing host compatibility integration ${snippet}`);

for (const snippet of [
  '"宿主：" + controller.Compatibility.Summary',
  "OfficeCompatibilityService.InitializationFailureMessage(exception, controller.Compatibility)",
  "当前 PowerPoint 环境无法加载右侧窗格"
]) requireIncludes(taskPane, snippet, `RoughTaskPaneControl.cs: missing localized compatibility fallback ${snippet}`);

requireIncludes(csproj, 'Compile Include="Services\\OfficeCompatibilityService.cs"', "RoughPptAddin.csproj: compatibility service must be compiled");

for (const snippet of [
  "function Get-WebView2RuntimeVersion",
  "function Get-VstoRuntimeVersion",
  "function Test-DotNetFramework48",
  'HKCU:\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients',
  "$needsWebView2",
  "$needsVsto",
  "$needsBuildTools",
  "if ($needsWebView2 -or $needsVsto -or $needsBuildTools)",
  "if (-not $winget)",
  'Install-WingetPackage "Microsoft.EdgeWebView2Runtime"',
  'Install-WingetPackage "Microsoft.VSTOR"',
  ".NET Framework 4.8"
]) requireIncludes(prereqs, snippet, `install-prereqs.ps1: missing multi-version runtime prerequisite contract ${snippet}`);

const firstWingetGuard = prereqs.indexOf("if (-not $winget)");
const runtimeDetection = prereqs.indexOf("$needsWebView2 =");
if (!(runtimeDetection >= 0 && firstWingetGuard > runtimeDetection)) {
  violations.push("install-prereqs.ps1: winget must only be required after installed runtimes are detected");
}

for (const snippet of [
  "function Get-PowerPointInstallInfo",
  "App Paths\\POWERPNT.EXE",
  "VersionToReport",
  "ProductReleaseIds",
  "Platform",
  "dotNetFramework48",
  'HKCU:\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients'
]) requireIncludes(diagnose, snippet, `diagnose.ps1: missing Office installation compatibility probe ${snippet}`);

for (const snippet of ["PowerPoint 2013", "2013、2016", "2021、2024", "Microsoft 365", "32 位或 64 位 Office"]) {
  requireIncludes(help, snippet, `help.html: compatibility guide missing ${snippet}`);
}

requireIncludes(
  packageJson.scripts?.test ?? "",
  "node scripts/validate-office-compatibility.mjs",
  "package.json: npm test must include Office compatibility validation"
);

if (violations.length) {
  throw new Error(`Office compatibility validation failed:\n${violations.join("\n")}`);
}

console.log("office compatibility contract ok");

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function requireIncludes(text, snippet, message) {
  if (!text.includes(snippet)) violations.push(message);
}

function requirePattern(text, pattern, message) {
  if (!pattern.test(text)) violations.push(message);
}

function validatePowerShellSyntax(path) {
  const escaped = path.replace(/'/g, "''");
  const command = `$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escaped}',[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object{Write-Error $_.Message};exit 1}`;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], { encoding: "utf8" });
  if (result.status !== 0) {
    violations.push(`${path}: PowerShell syntax invalid: ${(result.stderr || result.stdout || "unknown parse error").trim()}`);
  }
}
