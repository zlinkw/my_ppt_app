param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $SkipBuild) {
    powershell -ExecutionPolicy Bypass -File scripts\build.ps1
}

$publish = Join-Path $root "publish"
$manifest = Join-Path $publish "RoughPptAddin.vsto"
if (-not (Test-Path $manifest)) {
    throw "publish\RoughPptAddin.vsto missing. Run scripts\build.ps1 first."
}

$distRoot = Join-Path $root "dist"
$packageRoot = Join-Path $distRoot "RoughPptAddin"
$zipPath = Join-Path $distRoot "RoughPptAddin.zip"

if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Force $packageRoot | Out-Null
New-Item -ItemType Directory -Force (Join-Path $packageRoot "publish") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $packageRoot "scripts") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $packageRoot "docs") | Out-Null

Copy-Item -Path (Join-Path $publish "*") -Destination (Join-Path $packageRoot "publish") -Recurse -Force
Copy-Item -Path scripts\install.ps1,scripts\install-payload-core.ps1,scripts\uninstall.ps1,scripts\uninstall-completely.ps1,scripts\diagnose.ps1,scripts\install-prereqs.ps1 -Destination (Join-Path $packageRoot "scripts") -Force
Copy-Item -Path README.md -Destination $packageRoot -Force
Copy-Item -Path docs\DEPLOYMENT.md,docs\VALIDATION.md -Destination (Join-Path $packageRoot "docs") -Force

$installCmd = @"
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\install.ps1" -SkipBuild -InstallPrereqs
pause
"@
$uninstallCmd = @"
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\uninstall.ps1"
pause
"@
$completeUninstallCmd = @"
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\uninstall-completely.ps1" -ConfirmCompleteRemoval
pause
"@
$diagnoseCmd = @"
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\diagnose.ps1"
pause
"@

[System.IO.File]::WriteAllText((Join-Path $packageRoot "Install-RoughPptAddin.cmd"), $installCmd, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $packageRoot "Uninstall-RoughPptAddin.cmd"), $uninstallCmd, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $packageRoot "Complete-Uninstall-RoughPptAddin.cmd"), $completeUninstallCmd, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $packageRoot "Diagnose-RoughPptAddin.cmd"), $diagnoseCmd, [System.Text.UTF8Encoding]::new($false))

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -Force

Write-Host "Deploy package staged: $packageRoot"
Write-Host "Deploy package zip: $zipPath"
