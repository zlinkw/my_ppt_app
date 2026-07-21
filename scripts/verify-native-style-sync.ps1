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

public static class RoughNativeStyleSyncSmoke
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
            var sync = new PptStyleSynchronizer(metadata);
            var request = new RoughShapeRequest
            {
                AssetId = "smoke-rough-style",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 100,
                Top = 90,
                Width = 140,
                Height = 80
            };
            request.Style.Stroke = "#111111";
            request.Style.StrokeWidthPt = 2;
            request.Style.FillMode = "solid";
            request.Style.FillColor = "#ffffff";
            request.Style.FillTransparency = 0;

            var group = writer.InsertGroup(slide, request, RectangleDrawable(140, 80));
            var innerBoundary = FindRole(group, RoughPathRoles.InnerBoundary);
            var innerFill = FindRole(group, RoughPathRoles.InnerFillBoundary);
            if (innerBoundary == null || innerFill == null)
            {
                throw new Exception("Style sync smoke could not find inner layers.");
            }

            innerBoundary.Line.ForeColor.RGB = Rgb("#1f77b4");
            innerBoundary.Line.Weight = 5;
            innerBoundary.Line.DashStyle = MsoLineDashStyle.msoLineDash;
            innerFill.Fill.Visible = MsoTriState.msoTrue;
            innerFill.Fill.ForeColor.RGB = Rgb("#2ca02c");
            innerFill.Fill.Transparency = 0.35f;

            sync.Capture(group, request);
            request.Width = 210;
            request.Height = 120;
            var replaced = writer.ReplaceVisiblePaths(group, request, RectangleDrawable(210, 120));
            sync.Apply(replaced, request);

            var newBoundary = FindRole(replaced, RoughPathRoles.InnerBoundary);
            var newFill = FindRole(replaced, RoughPathRoles.InnerFillBoundary);
            if (newBoundary == null || newFill == null)
            {
                throw new Exception("Style sync replacement lost inner layers.");
            }
            if (newBoundary.Line.ForeColor.RGB != Rgb("#1f77b4") || Math.Abs(newBoundary.Line.Weight - 5) > 0.2)
            {
                throw new Exception("Line style was not preserved after redraw.");
            }
            if (newBoundary.Line.DashStyle != MsoLineDashStyle.msoLineDash)
            {
                throw new Exception("Dash style was not preserved after redraw.");
            }
            if (newFill.Fill.Visible == MsoTriState.msoFalse || newFill.Fill.ForeColor.RGB != Rgb("#2ca02c") || Math.Abs(newFill.Fill.Transparency - 0.35f) > 0.05)
            {
                throw new Exception("Fill style was not preserved on inner fill carrier after redraw.");
            }

            return "StyleSync=OK;Stroke=" + request.Style.Stroke + ";Width=" + request.Style.StrokeWidthPt + ";Fill=" + request.Style.FillColor + ";FillTransparency=" + request.Style.FillTransparency;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static PowerPoint.Shape FindRole(PowerPoint.Shape group, string role)
    {
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            if (child.Tags["PPT_ROUGH_OVERLAY_ROLE"] == role) return child;
        }
        return null;
    }

    private static RoughDrawable RectangleDrawable(float width, float height)
    {
        var drawable = new RoughDrawable();
        var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 2, Role = RoughPathRoles.InnerBoundary };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 0, height } });
        drawable.Paths.Add(path);
        var jitter = new RoughPath { Closed = false, Stroke = "#111111", StrokeWidthPt = 2, Role = RoughPathRoles.OuterJitter };
        jitter.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 1, 1 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width - 1, 2 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width - 2, height - 1 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 2, height - 2 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 1, 1 } });
        drawable.Paths.Add(jitter);
        return drawable;
    }

    private static int Rgb(string hex)
    {
        var value = hex.TrimStart('#');
        var r = Convert.ToInt32(value.Substring(0, 2), 16);
        var g = Convert.ToInt32(value.Substring(2, 2), 16);
        var b = Convert.ToInt32(value.Substring(4, 2), 16);
        return r + (g << 8) + (b << 16);
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeStyleSyncSmoke]::Run()