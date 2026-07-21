param(
    [switch]$SkipSlow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Invoke-CheckedScript {
    param([string]$Path)

    & powershell -ExecutionPolicy Bypass -File $Path
    if ($LASTEXITCODE -ne 0) {
        throw "$Path failed with exit code $LASTEXITCODE."
    }
}

$scripts = @(
    "scripts\verify-native-insert.ps1",
    "scripts\verify-native-resize.ps1",
    "scripts\verify-native-operations.ps1",
    "scripts\verify-native-adjustments.ps1",
    "scripts\verify-native-fill-semantics.ps1",
    "scripts\verify-native-style-sync.ps1",
    "scripts\verify-native-format-preservation.ps1",
    "scripts\verify-native-convert-selection.ps1",
    "scripts\verify-ribbon-shape-menu.ps1",
    "scripts\verify-user-asset-library.ps1",
    "scripts\verify-user-asset-package.ps1"
)

if (-not $SkipSlow) {
    $scripts += "scripts\verify-native-catalog-batch.ps1"
}

foreach ($script in $scripts) {
    Invoke-CheckedScript $script
}

Write-Host "NativeAll=OK;Scripts=$($scripts.Count);SkipSlow=$SkipSlow"
