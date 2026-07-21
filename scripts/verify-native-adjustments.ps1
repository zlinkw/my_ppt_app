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

public static class RoughNativeAdjustmentsSmoke
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
                AssetId = "smoke-rough-adjustments",
                SourceMsoType = "msoShapeRoundedRectangle",
                ShapeKind = "rectangle",
                Left = 100,
                Top = 90,
                Width = 160,
                Height = 90
            };
            request.Adjustments.Add(0.18f);

            var group = writer.InsertGroup(slide, request, RectangleDrawable(160, 90));
            var carrier = FindRole(group, "nativeCarrier");
            if (carrier == null || carrier.Adjustments.Count < 1)
            {
                throw new Exception("Rounded rectangle native carrier has no adjustment handle.");
            }
            if (Math.Abs(carrier.Adjustments[1] - 0.18f) > 0.08f)
            {
                throw new Exception("Initial native carrier adjustment was not applied.");
            }

            carrier.Adjustments[1] = 0.42f;
            sync.Capture(group, request);
            if (request.Adjustments.Count < 1 || Math.Abs(request.Adjustments[0] - 0.42f) > 0.08f)
            {
                throw new Exception("Native carrier adjustment was not captured.");
            }

            var replaced = writer.ReplaceVisiblePaths(group, request, RectangleDrawable(180, 100));
            sync.Apply(replaced, request);
            var newCarrier = FindRole(replaced, "nativeCarrier");
            if (newCarrier == null || newCarrier.Adjustments.Count < 1 || Math.Abs(newCarrier.Adjustments[1] - 0.42f) > 0.08f)
            {
                throw new Exception("Native carrier adjustment was not preserved after redraw.");
            }

            return "Adjustments=OK;Value=" + request.Adjustments[0];
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
        drawable.Paths.Add(jitter);
        return drawable;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeAdjustmentsSmoke]::Run()