param(
    [switch]$SkipInstallers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$packageRoot = Join-Path $root "dist\RoughPptAddin"
$zipPath = Join-Path $root "dist\RoughPptAddin.zip"
$portableZipPath = Join-Path $root "RoughPptAddin-Windows11.zip"
$msiPath = Join-Path $root "RoughPptAddin-Windows11.msi"
$exePath = Join-Path $root "RoughPptAddin-Windows11-Setup.exe"
$manifestPath = Join-Path $root "dist\installer-manifest.json"

$required = @(
    "Install-RoughPptAddin.cmd",
    "Uninstall-RoughPptAddin.cmd",
    "Complete-Uninstall-RoughPptAddin.cmd",
    "Diagnose-RoughPptAddin.cmd",
    "publish\RoughPptAddin.vsto",
    "publish\RoughPptAddin.dll",
    "publish\ui\index.html",
    "publish\ui\app.mjs",
    "publish\ui\rough-shape-generator.mjs",
    "publish\ui\autoshape-catalog.json",
    "scripts\install.ps1",
    "scripts\uninstall.ps1",
    "scripts\uninstall-completely.ps1",
    "scripts\diagnose.ps1",
    "scripts\install-prereqs.ps1"
)

foreach ($relative in $required) {
    $path = Join-Path $packageRoot $relative
    if (-not (Test-Path $path)) {
        throw "Deploy package missing $relative"
    }
}

if (-not (Test-Path $zipPath)) {
    throw "Deploy package zip missing."
}

$catalog = Get-Content -LiteralPath (Join-Path $packageRoot "publish\ui\autoshape-catalog.json") -Raw | ConvertFrom-Json
if ($catalog.items.Count -lt 180) {
    throw "Deploy package catalog is incomplete: $($catalog.items.Count)"
}

if (-not $SkipInstallers) {
    if (-not (Test-Path $portableZipPath -PathType Leaf)) {
        throw "Windows 11 portable installer missing."
    }
    if (-not (Test-Path $msiPath -PathType Leaf)) {
        throw "Windows 11 MSI installer missing."
    }
    if (-not (Test-Path $exePath -PathType Leaf)) {
        throw "Windows 11 EXE installer missing."
    }
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
        throw "Installer manifest missing."
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $expectedArtifacts = @{
        portableZip = $portableZipPath
        msi = $msiPath
        exe = $exePath
    }
    foreach ($entry in $expectedArtifacts.GetEnumerator()) {
        $record = $manifest.artifacts.($entry.Key)
        if ($null -eq $record -or [string]::IsNullOrWhiteSpace([string]$record.sha256)) {
            throw "Installer manifest entry missing: $($entry.Key)"
        }
        $actualHash = (Get-FileHash -LiteralPath $entry.Value -Algorithm SHA256).Hash
        if (-not $actualHash.Equals([string]$record.sha256, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Installer output does not match latest manifest: $($entry.Key)"
        }
        if ([int64]$record.length -ne (Get-Item -LiteralPath $entry.Value).Length) {
            throw "Installer output length does not match latest manifest: $($entry.Key)"
        }
    }
}

$msiValue = if ($SkipInstallers) { "SKIPPED" } else { $msiPath }
$exeValue = if ($SkipInstallers) { "SKIPPED" } else { $exePath }
Write-Host "DeployPackage=$zipPath;CatalogItems=$($catalog.items.Count);RequiredFiles=$($required.Count);MSI=$msiValue;EXE=$exeValue"
