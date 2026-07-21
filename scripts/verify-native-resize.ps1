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

$office = Get-ChildItem "C:\Windows\assembly\GAC_MSIL" -Recurse -Filter Office.dll -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$powerPointInterop = Get-ChildItem "C:\Windows\assembly\GAC_MSIL\Microsoft.Office.Interop.PowerPoint" -Recurse -Filter Microsoft.Office.Interop.PowerPoint.dll -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $office -or -not $powerPointInterop) {
    throw "Office interop assemblies not found."
}

$source = @"
using System;
using Microsoft.Office.Core;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

public static class RoughNativeResizeSmoke
{
    public static string Run()
    {
        var hadPowerPoint = System.Diagnostics.Process.GetProcessesByName("POWERPNT").Length > 0;
        var app = new PowerPoint.Application();
        app.Visible = MsoTriState.msoTrue;
        PowerPoint.Presentation presentation = null;
        try
        {
            presentation = app.Presentations.Add(MsoTriState.msoTrue);
            var slide = presentation.Slides.Add(1, PowerPoint.PpSlideLayout.ppLayoutBlank);

            var metadata = new MetadataService();
            var writer = new PptFreeformWriter(metadata);
            var request = new RoughShapeRequest
            {
                AssetId = "smoke-rough-resize",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 120,
                Top = 100,
                Width = 120,
                Height = 70
            };
            request.Style.Stroke = "#111111";
            request.Style.StrokeWidthPt = 2;

            var group = writer.InsertGroup(slide, request, RectangleDrawable(120, 70));
            group.Width = 260;
            group.Height = 140;

            request.Left = group.Left;
            request.Top = group.Top;
            request.Width = group.Width;
            request.Height = group.Height;
            var replaced = writer.ReplaceVisiblePaths(group, request, RectangleDrawable(request.Width, request.Height));

            if ((int)replaced.Type == 13)
            {
                throw new Exception("Resize replacement resolved to msoPicture.");
            }
            if (replaced.Tags["PPT_ROUGH_ASSET_ID"] != "smoke-rough-resize")
            {
                throw new Exception("Missing rough metadata after resize replacement.");
            }
            if (!metadata.TryRead(replaced, out var readBack))
            {
                throw new Exception("Metadata could not be read after resize replacement.");
            }
            if (readBack.Width < 250 || readBack.Height < 130)
            {
                throw new Exception("Resize bounds were not persisted in metadata.");
            }

            return "Name=" + replaced.Name + ";Type=" + replaced.Type + ";AssetId=" + replaced.Tags["PPT_ROUGH_ASSET_ID"] + ";Width=" + replaced.Width + ";Height=" + replaced.Height + ";ShapeCount=" + slide.Shapes.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static RoughDrawable RectangleDrawable(float width, float height)
    {
        var drawable = new RoughDrawable();

        var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 2 };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 0, height } });
        drawable.Paths.Add(path);

        var jitter = new RoughPath { Closed = false, Stroke = "#111111", StrokeWidthPt = 2 };
        jitter.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 1, 2 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width - 2, 1 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width - 1, height - 2 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 2, height - 1 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 1, 2 } });
        drawable.Paths.Add(jitter);

        return drawable;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeResizeSmoke]::Run()