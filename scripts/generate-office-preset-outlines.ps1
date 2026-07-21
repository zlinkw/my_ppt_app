Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$catalogPath = Join-Path $root "assets\autoshapes\mso-autoshape-catalog.json"
$outPath = Join-Path $root "src\RoughPptAddin\ui\office-preset-outlines.mjs"

$office = Get-ChildItem "C:\Windows\assembly\GAC_MSIL" -Recurse -Filter Office.dll -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$powerPointInterop = Get-ChildItem "C:\Windows\assembly\GAC_MSIL\Microsoft.Office.Interop.PowerPoint" -Recurse -Filter Microsoft.Office.Interop.PowerPoint.dll -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $office -or -not $powerPointInterop) {
    throw "Office interop assemblies not found."
}

Add-Type -Path $office
Add-Type -Path $powerPointInterop

function Read-Point($node) {
    $points = $node.Points
    if ($null -eq $points) {
        return $null
    }

    [double[]]@(
        [double]$points.GetValue($points.GetLowerBound(0), $points.GetLowerBound(1)),
        [double]$points.GetValue($points.GetLowerBound(0), $points.GetLowerBound(1) + 1)
    )
}

function Add-FreeformPath($shape, [System.Collections.ArrayList]$paths) {
    if ($shape.Type -ne [Microsoft.Office.Core.MsoShapeType]::msoFreeform) {
        return
    }

    $nodes = @()
    $segments = @()
    for ($i = 1; $i -le $shape.Nodes.Count; $i++) {
        $node = $shape.Nodes.Item($i)
        $point = Read-Point $node
        if ($null -eq $point) {
            continue
        }
        $nodes += ,@([math]::Round($point[0], 4), [math]::Round($point[1], 4))
        $segments += [int]$node.SegmentType
    }

    if ($nodes.Count -ge 3) {
        [void]$paths.Add([ordered]@{
            nodes = $nodes
            segments = $segments
        })
    }
}

function Expand-Shape($shape, [System.Collections.ArrayList]$paths) {
    if ($shape.Type -eq [Microsoft.Office.Core.MsoShapeType]::msoFreeform) {
        Add-FreeformPath $shape $paths
        return
    }

    if ($shape.Type -ne [Microsoft.Office.Core.MsoShapeType]::msoGroup) {
        return
    }

    try {
        $range = $shape.Ungroup()
        for ($i = 1; $i -le $range.Count; $i++) {
            Expand-Shape $range.Item($i) $paths
        }
    }
    catch {
    }
}

function Normalize-Paths([System.Collections.ArrayList]$paths) {
    $all = @()
    foreach ($path in $paths) {
        foreach ($node in $path.nodes) {
            $all += ,$node
        }
    }
    if ($all.Count -eq 0) {
        return @()
    }

    $minX = ($all | ForEach-Object { $_[0] } | Measure-Object -Minimum).Minimum
    $maxX = ($all | ForEach-Object { $_[0] } | Measure-Object -Maximum).Maximum
    $minY = ($all | ForEach-Object { $_[1] } | Measure-Object -Minimum).Minimum
    $maxY = ($all | ForEach-Object { $_[1] } | Measure-Object -Maximum).Maximum
    $width = [math]::Max(0.0001, $maxX - $minX)
    $height = [math]::Max(0.0001, $maxY - $minY)

    $seen = @{}
    $normalized = @()
    foreach ($path in $paths) {
        $nodes = @()
        foreach ($node in $path.nodes) {
            $nodes += ,@(
                [math]::Round((([double]$node[0] - $minX) / $width), 5),
                [math]::Round((([double]$node[1] - $minY) / $height), 5)
            )
        }

        $signature = ($nodes | ForEach-Object { "$($_[0]):$($_[1])" }) -join "|"
        if ($seen.ContainsKey($signature)) {
            continue
        }

        $seen[$signature] = $true
        $normalized += ,[ordered]@{
            nodes = $nodes
            segments = $path.segments
        }
    }

    $normalized
}

$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$hadPowerPoint = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$app = New-Object -ComObject PowerPoint.Application
$app.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
$presentation = $null
$outlines = [ordered]@{}

try {
    $presentation = $app.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)
    $slide = $presentation.Slides.Add(1, [Microsoft.Office.Interop.PowerPoint.PpSlideLayout]::ppLayoutBlank)

    foreach ($item in $catalog.items) {
        if ($item.insertable -eq $false) {
            continue
        }

        $enumName = [string]$item.enumName
        try {
            $parsed = [Microsoft.Office.Core.MsoAutoShapeType]$enumName
        }
        catch {
            continue
        }

        $paths = [System.Collections.ArrayList]::new()
        try {
            $shape = $slide.Shapes.AddShape($parsed, 100, 100, 180, 120)
            $shape.Copy()
            $pasted = $slide.Shapes.PasteSpecial([Microsoft.Office.Interop.PowerPoint.PpPasteDataType]::ppPasteEnhancedMetafile)
            Expand-Shape $pasted.Item(1) $paths
        }
        catch {
        }
        finally {
            while ($slide.Shapes.Count -gt 0) {
                $slide.Shapes.Item(1).Delete()
            }
        }

        $normalized = @(Normalize-Paths $paths)
        if ($normalized.Count -gt 0) {
            $outlines[$enumName] = [ordered]@{
                paths = $normalized
            }
        }
    }
}
finally {
    if ($presentation -ne $null) {
        $presentation.Close()
    }
    if (-not $hadPowerPoint) {
        $app.Quit()
    }
}

$json = $outlines | ConvertTo-Json -Depth 12 -Compress
$module = "export const officePresetOutlines = $json;`n"
[System.IO.File]::WriteAllText($outPath, $module, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated $outPath with $($outlines.Count) Office-derived outlines"