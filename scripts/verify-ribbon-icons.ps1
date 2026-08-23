param(
    [string]$AssemblyPath = "src\RoughPptAddin\bin\Release\RoughPptAddin.dll"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
$assemblyFile = Resolve-Path $AssemblyPath

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName stdole
Add-Type -AssemblyName Microsoft.VisualBasic

function Move-VerifiedTempDirectoryToRecycleBin {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolved = [System.IO.Path]::GetFullPath($Path)
    $tempRoot = [System.IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\")
    if (-not $resolved.StartsWith($tempRoot + "\rough-ribbon-icons-", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to recycle an unexpected Ribbon verification path: $resolved"
    }
    Write-Host "Recycle Bin move: $resolved"
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
        $resolved,
        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
    )
}

function Get-VerifiedSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [IO.File]::OpenRead($Path)
    try {
        $bytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash($stream)
        return (($bytes | ForEach-Object { $_.ToString("X2") }) -join "")
    }
    finally {
        $stream.Dispose()
    }
}

$assembly = [Reflection.Assembly]::LoadFrom($assemblyFile)
$ribbonType = $assembly.GetType("RoughPptAddin.Ribbon.RoughRibbon", $true)
$ribbonInstance = [Runtime.Serialization.FormatterServices]::GetUninitializedObject($ribbonType)
$customUi = $ribbonType.GetMethod("GetCustomUI").Invoke($ribbonInstance, @("Microsoft.PowerPoint.Presentation"))
[xml]$customUiDocument = $customUi
$namespaceManager = [Xml.XmlNamespaceManager]::new($customUiDocument.NameTable)
$namespaceManager.AddNamespace("r", "http://schemas.microsoft.com/office/2009/07/customui")

$groups = @($customUiDocument.SelectNodes("//r:tab[@id='roughDiagramTab']/r:group", $namespaceManager))
$expectedGroups = @("roughMainGroup", "roughQuickGroup", "roughStyleGroup", "roughResearchGroup", "roughLibraryGroup")
if ($groups.Count -ne $expectedGroups.Count) {
    throw "Compiled Ribbon must expose exactly $($expectedGroups.Count) groups; found $($groups.Count)"
}
for ($index = 0; $index -lt $expectedGroups.Count; $index++) {
    if ($groups[$index].id -ne $expectedGroups[$index]) {
        throw "Compiled Ribbon group order mismatch at $index`: expected $($expectedGroups[$index]), found $($groups[$index].id)"
    }
}

$shapeGalleryEntries = @($customUiDocument.SelectNodes("//*[@onAction='OpenShapeGallery']", $namespaceManager))
if ($shapeGalleryEntries.Count -ne 1) {
    throw "Compiled Ribbon must expose one shape gallery action; found $($shapeGalleryEntries.Count)"
}

$obsoleteIds = @("compactCommonMenu", "compactSelectionMenu", "roughShapeMenu", "openShapesPane", "startSelectionNext", "insertFeatureBlock")
foreach ($controlId in $obsoleteIds) {
    if ($customUiDocument.SelectSingleNode("//*[@id='$controlId']", $namespaceManager)) {
        throw "Compiled Ribbon still exposes obsolete duplicate: $controlId"
    }
}

$factory = $assembly.GetType("RoughPptAddin.Ribbon.RoughRibbon+FunctionalIconFactory", $true)
$flags = [Reflection.BindingFlags]"Public,NonPublic,Static"
$create = $factory.GetMethod("Create", $flags, $null, @([string], [int], [int]), $null)
$propertyFlags = [Reflection.BindingFlags]"GetProperty"
$controls = @($customUiDocument.SelectNodes("//*[@getImage='GetFunctionalImage']", $namespaceManager) | ForEach-Object { $_.id })
if ($controls.Count -eq 0) {
    throw "Compiled Ribbon has no visible functional icon callbacks"
}
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("rough-ribbon-icons-" + [guid]::NewGuid().ToString("N"))
$hashes = @{}

try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    foreach ($controlId in $controls) {
        $picture = $create.Invoke($null, @($controlId, 32, 32))
        $handle = [int]$picture.GetType().InvokeMember("Handle", $propertyFlags, $null, $picture, $null)
        if ($handle -eq 0) {
            throw "Ribbon icon did not produce a valid bitmap: $controlId"
        }

        $bitmap = [Drawing.Bitmap]::FromHbitmap([IntPtr]::new($handle))
        try {
            $path = Join-Path $tempRoot ($controlId + ".png")
            $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png)
            $hash = Get-VerifiedSha256 -Path $path
            $hashes[$hash] = $true

            $background = $bitmap.GetPixel(0, 0)
            $ink = 0
            $blue = 0
            $neutral = 0
            $darkAnchor = 0
            for ($y = 0; $y -lt $bitmap.Height; $y++) {
                for ($x = 0; $x -lt $bitmap.Width; $x++) {
                    $pixel = $bitmap.GetPixel($x, $y)
                    if ($pixel.A -eq 0) { continue }
                    $backgroundDistance = [Math]::Abs($pixel.R - $background.R) +
                        [Math]::Abs($pixel.G - $background.G) +
                        [Math]::Abs($pixel.B - $background.B)
                    if ($background.A -gt 0 -and $backgroundDistance -le 18) { continue }
                    $ink++
                    if ($pixel.B -gt ($pixel.R + 24) -and $pixel.B -gt ($pixel.G + 12)) { $blue++ }
                    $maximum = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
                    $minimum = [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))
                    if (($maximum - $minimum) -le 24) { $neutral++ }
                    if ($maximum -le 128 -and ($maximum - $minimum) -le 24) { $darkAnchor++ }
                }
            }
            if ($ink -eq 0) {
                throw "Ribbon icon is blank: $controlId"
            }
            if ($blue -gt [Math]::Max(2, [Math]::Floor($ink * 0.05))) {
                throw "Ribbon icon is still dominated by a blue placeholder: $controlId"
            }
            if ($neutral -lt [Math]::Floor($ink * 0.95)) {
                throw "Ribbon icon is not a neutral black outline: $controlId"
            }
            if ($darkAnchor -lt [Math]::Max(8, [Math]::Floor($ink * 0.25))) {
                throw "Ribbon icon lacks a crisp dark outline: $controlId"
            }
            if ($ink -gt [Math]::Floor($bitmap.Width * $bitmap.Height * 0.5)) {
                throw "Ribbon icon is too dense to be an outline icon: $controlId"
            }
        }
        finally {
            $bitmap.Dispose()
        }
    }

    if ($hashes.Count -lt 8) {
        throw "Compiled Ribbon functional icons are insufficiently distinct: $($hashes.Count) unique renderings"
    }
}
finally {
    if (Test-Path $tempRoot) {
        Move-VerifiedTempDirectoryToRecycleBin -Path $tempRoot
    }
}

Write-Host "Ribbon layout and vector icons verified: $($groups.Count) groups, $($controls.Count) functional icons"
