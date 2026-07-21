Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dll = Join-Path $root "publish\RoughPptAddin.dll"
if (-not (Test-Path $dll)) {
    throw "publish\RoughPptAddin.dll missing. Run scripts\build.ps1 first."
}

$publishDir = Split-Path $dll -Parent
[System.AppDomain]::CurrentDomain.add_AssemblyResolve({
    param($sender, $args)
    $name = (New-Object System.Reflection.AssemblyName($args.Name)).Name + ".dll"
    $candidate = Join-Path $publishDir $name
    if (Test-Path $candidate) {
        return [System.Reflection.Assembly]::LoadFrom($candidate)
    }
    return $null
})
Add-Type -Path $dll

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("RoughPptAssetPackageSmoke-" + [System.Guid]::NewGuid().ToString("N"))
$sourceRoot = Join-Path $tempRoot "source"
$targetRoot = Join-Path $tempRoot "target"
$sourceThumbnailRoot = Join-Path $tempRoot "source-thumbnails"
$targetThumbnailRoot = Join-Path $tempRoot "target-thumbnails"
$packagePath = Join-Path $tempRoot "rough-assets.zip"
try {
    New-Item -ItemType Directory -Force $sourceRoot, $targetRoot, $sourceThumbnailRoot, $targetThumbnailRoot | Out-Null

    $assetId = "smoke-native-template"
    $pptxPath = Join-Path $sourceRoot "$assetId.pptx"
    $metadataPath = Join-Path $sourceRoot "$assetId.json"
    $thumbnailPath = Join-Path $sourceThumbnailRoot "$assetId.png"
    [System.IO.File]::WriteAllText($pptxPath, "native ppt template placeholder")
    [System.IO.File]::WriteAllBytes($thumbnailPath, [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0VhWQAAAABJRU5ErkJggg=="))
    $metadata = @{
        Id = $assetId
        DisplayName = "Smoke Native Template"
        Kind = "user-native-template"
        CreatedAtUtc = [DateTime]::UtcNow.ToString("o")
        ShapeCount = 1
        TemplatePath = $pptxPath
        ThumbnailPath = $thumbnailPath
        NativeOnly = $true
        Keywords = @("smoke", "native", "asset")
    } | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($metadataPath, $metadata)

    $source = [RoughPptAddin.Services.SelectionCaptureService]::new($null, $sourceRoot, $sourceThumbnailRoot)
    $exported = $source.ExportUserAssets($packagePath)
    if (-not (Test-Path $exported)) {
        throw "Export package missing."
    }

    $target = [RoughPptAddin.Services.SelectionCaptureService]::new($null, $targetRoot, $targetThumbnailRoot)
    $imported = $target.ImportUserAssets($exported)
    if ($imported.Count -ne 1) {
        throw "Expected one imported asset, got $($imported.Count)."
    }

    $list = $target.ListUserAssets()
    if ($list.Count -ne 1) {
        throw "Expected one listed imported asset, got $($list.Count)."
    }
    if (-not $list[0].NativeOnly) {
        throw "Imported asset did not preserve nativeOnly flag."
    }
    if (-not (Test-Path $list[0].TemplatePath)) {
        throw "Imported template file missing."
    }
    if (-not (Test-Path $list[0].ThumbnailPath)) {
        throw "Imported thumbnail file missing."
    }

    "Package=$exported;Imported=$($imported.Count);Listed=$($list.Count);NativeOnly=$($list[0].NativeOnly);Thumbnail=True"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}