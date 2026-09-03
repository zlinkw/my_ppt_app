import fs from "node:fs";

const deploy = read("scripts/deploy.ps1");
const build = read("scripts/build.ps1");
const verify = read("scripts/verify-deploy-package.ps1");
const installers = read("scripts/package-installers.ps1");
const preservingPackage = read("scripts/package-release-preserving.ps1");
const packageJson = JSON.parse(read("package.json"));
const readme = read("README.md");
const deployment = read("docs/DEPLOYMENT.md");
const violations = [];

requireIncludes(deploy, "[switch]$SkipInstallers", "deploy.ps1: missing fast inner-loop SkipInstallers switch");
requireIncludes(deploy, 'Invoke-CheckedScript "scripts\\package-installers.ps1" @("-SkipBuild")', "deploy.ps1: final path must build MSI/EXE installers");
requireIncludes(deploy, 'Invoke-CheckedScript "scripts\\verify-deploy-package.ps1"', "deploy.ps1: final path must verify installer package");
requireIncludes(deploy, 'Invoke-CheckedScript "scripts\\verify-deploy-package.ps1" @("-SkipInstallers")', "deploy.ps1: fast path must explicitly skip installer verification");
requireIncludes(deploy, 'Invoke-CheckedScript "scripts\\install.ps1" @("-SkipBuild", "-InstallPrereqs")', "deploy.ps1: final local install must use runtime prerequisite self-healing");
requireOrder(deploy, "scripts\\package-installers.ps1", "scripts\\verify-deploy-package.ps1", "deploy.ps1: package-installers must run before final deploy verification");
requireIncludes(build, "/t:Rebuild", "build.ps1: VSTO build must force a rebuild so updated Ribbon icons cannot reuse stale binaries");
requireIncludes(build, "New-SelfSignedCertificate -Type CodeSigningCert", "build.ps1: missing local ClickOnce certificate bootstrap");
requireIncludes(build, "/p:LangVersion=latest", "build.ps1: recovered C# sources require the current compiler language version");
requireIncludes(build, "/p:SignManifests=true", "build.ps1: VSTO ClickOnce manifests must be signed");
requireIncludes(build, "/p:ManifestCertificateThumbprint=$($signingCertificate.Thumbprint)", "build.ps1: VSTO build must use the resolved signing certificate");
requireIncludes(build, "scripts\\verify-ribbon-icons.ps1", "build.ps1: built Ribbon icons must pass runtime rendering verification");

requireIncludes(verify, "ReleaseRoot", "verify-deploy-package.ps1: final verification must support releases via ReleaseRoot");
requireIncludes(verify, "releases", "verify-deploy-package.ps1: final verification must resolve installer artifacts under releases");
requireIncludes(verify, "Windows 11 MSI installer missing.", "verify-deploy-package.ps1: final verification must require MSI");
requireIncludes(verify, "Windows 11 EXE installer missing.", "verify-deploy-package.ps1: final verification must require EXE");
requireIncludes(verify, "Installer manifest missing.", "verify-deploy-package.ps1: final verification must require installer manifest");
requireIncludes(verify, "Get-FileHash", "verify-deploy-package.ps1: stale artifact check must use content hashes");
requireIncludes(verify, "Installer output does not match latest manifest", "verify-deploy-package.ps1: must reject stale installer artifacts by manifest hash");
requireIncludes(verify, '$msiValue = if ($SkipInstallers) { "SKIPPED" }', "verify-deploy-package.ps1: fast mode must report skipped MSI");
requireIncludes(verify, '$exeValue = if ($SkipInstallers) { "SKIPPED" }', "verify-deploy-package.ps1: fast mode must report skipped EXE");
requireIncludes(installers, 'AllowSameVersionUpgrades="yes"', "package-installers.ps1: MSI must allow same-version overwrite upgrades");
requireIncludes(installers, '<Custom Action="RunInstall" After="InstallFiles">NOT REMOVE~="ALL"</Custom>', "package-installers.ps1: MSI repair/rerun must reinstall payload instead of skipping installed products");
requireIncludes(installers, "Copy-Item -LiteralPath $rootZip -Destination", "package-installers.ps1: installer payload zip must be overwritten on rebuild");
requireIncludes(installers, 'Join-Path $releasePath "installer-manifest.json"', "package-installers.ps1: final package build must write installer manifest under releases");
requireIncludes(installers, "releases\\RoughPptAddin-", "package-installers.ps1: installer outputs must resolve under releases");
requireIncludes(installers, "New-FileManifest $exePath", "package-installers.ps1: installer manifest must include EXE hash");
requireIncludes(installers, "function Wait-ForFileReady", "package-installers.ps1: EXE packaging must wait for asynchronous IExpress output");
requireIncludes(installers, "Wait-ForFileReady $exePath", "package-installers.ps1: IExpress EXE output must be ready before hashing");
requireIncludes(preservingPackage, '$buildInfoSourcePath = Join-Path $root "src\\RoughPptAddin\\ui\\build-info.json"', "package-release-preserving.ps1: release must stage current build metadata");
requireIncludes(preservingPackage, "version = $installerProductVersion", "package-release-preserving.ps1: build metadata must expose installer version");
requireIncludes(preservingPackage, 'source = "release-package"', "package-release-preserving.ps1: build metadata must identify release source");
requireIncludes(preservingPackage, "[IO.File]::WriteAllBytes($buildInfoSourcePath, $originalBuildInfoBytes)", "package-release-preserving.ps1: packaging must restore tracked build metadata");
requireIncludes(deployment, "Rerunning the same MSI after closing PowerPoint repairs and overwrites the local payload", "docs/DEPLOYMENT.md: same-MSI overwrite behavior and PowerPoint precondition must be documented");

const testScript = packageJson.scripts?.test ?? "";
requireIncludes(testScript, "node scripts/validate-deploy-contract.mjs", "package.json: npm test must include deploy contract validation");

requireIncludes(readme, "portable zip, MSI, and EXE installers", "README.md: final deployment must document all installer formats");
requireIncludes(readme, "-SkipInstallers", "README.md: fast deploy mode must be documented");
requireIncludes(deployment, "creates and verifies all three installer formats", "docs/DEPLOYMENT.md: final deploy contract must be documented");

if (violations.length) {
  throw new Error(`deploy contract validation failed:\n${violations.join("\n")}`);
}

console.log("deploy contract ok");

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function requireIncludes(text, needle, message) {
  if (!text.includes(needle)) violations.push(message);
}

function requireOrder(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second, firstIndex + first.length);
  if (firstIndex < 0 || secondIndex < 0 || secondIndex < firstIndex) violations.push(message);
}
