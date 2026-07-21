Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$packageRoot = Join-Path $root "dist\RoughPptAddin"
$zipPath = Join-Path $root "dist\RoughPptAddin.zip"

$required = @(
    "Install-RoughPptAddin.cmd",
    "Uninstall-RoughPptAddin.cmd",
    "Diagnose-RoughPptAddin.cmd",
    "publish\RoughPptAddin.vsto",
    "publish\RoughPptAddin.dll",
    "publish\ui\index.html",
    "publish\ui\app.mjs",
    "publish\ui\rough-shape-generator.mjs",
    "publish\ui\autoshape-catalog.json",
    "scripts\install.ps1",
    "scripts\uninstall.ps1",
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

Write-Host "DeployPackage=$zipPath;CatalogItems=$($catalog.items.Count);RequiredFiles=$($required.Count)"