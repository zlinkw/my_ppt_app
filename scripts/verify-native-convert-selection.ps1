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
using System.Reflection;
using Microsoft.Office.Core;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

public static class RoughNativeConvertSelectionSmoke
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
            var rect = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, 80, 70, 130, 80);
            rect.Line.ForeColor.RGB = Rgb("#1f77b4");
            rect.Line.Weight = 4.5f;
            rect.Fill.Visible = MsoTriState.msoTrue;
            rect.Fill.ForeColor.RGB = Rgb("#2ca02c");
            rect.Fill.Transparency = 0.25f;
            rect.TextFrame.TextRange.Text = "转换测试";

            var arrow = slide.Shapes.AddLine(260, 120, 410, 120);
            arrow.Line.EndArrowheadStyle = MsoArrowheadStyle.msoArrowheadTriangle;
            arrow.Line.ForeColor.RGB = Rgb("#d62728");
            arrow.Line.Weight = 3.5f;

            var metadata = new MetadataService();
            var writer = new PptFreeformWriter(metadata);
            var sync = new PptStyleSynchronizer(metadata);
            var controllerType = typeof(RoughAddInController);
            var resolve = controllerType.GetMethod("ResolveSourceMsoType", BindingFlags.NonPublic | BindingFlags.Static);
            if (resolve == null) throw new Exception("ResolveSourceMsoType reflection hook missing.");

            var rectType = (string)resolve.Invoke(null, new object[] { rect });
            var arrowType = (string)resolve.Invoke(null, new object[] { arrow });
            if (rectType != "msoShapeRectangle") throw new Exception("Rectangle resolver failed: " + rectType);
            if (arrowType != "msoShapeLineArrow") throw new Exception("Line arrow resolver failed: " + arrowType);

            var rectGroup = ConvertShape(slide, rect, rectType, writer, sync, RectangleDrawable(130, 80));
            var arrowGroup = ConvertShape(slide, arrow, arrowType, writer, sync, LineDrawable(150, 0));

            if (slide.Shapes.Count != 2) throw new Exception("Batch conversion should leave two rough groups.");
            AssertRoughGroup(rectGroup, "msoShapeRectangle");
            AssertRoughGroup(arrowGroup, "msoShapeLineArrow");

            var rectBoundary = FindRole(rectGroup, RoughPathRoles.InnerBoundary);
            var rectFill = FindRole(rectGroup, RoughPathRoles.InnerFillBoundary);
            if (rectBoundary.Line.ForeColor.RGB != Rgb("#1f77b4") || Math.Abs(rectBoundary.Line.Weight - 4.5f) > 0.2)
            {
                throw new Exception("Converted rectangle did not preserve line style.");
            }
            if (rectFill.Fill.Visible == MsoTriState.msoFalse || rectFill.Fill.ForeColor.RGB != Rgb("#2ca02c") || Math.Abs(rectFill.Fill.Transparency - 0.25f) > 0.05)
            {
                throw new Exception("Converted rectangle did not preserve fill style.");
            }
            if (rectFill.TextFrame.TextRange.Text != "转换测试")
            {
                throw new Exception("Converted rectangle did not preserve text on fill carrier.");
            }

            var arrowBoundary = FindRole(arrowGroup, RoughPathRoles.InnerBoundary);
            if (arrowBoundary.Line.ForeColor.RGB != Rgb("#d62728") || Math.Abs(arrowBoundary.Line.Weight - 3.5f) > 0.2)
            {
                throw new Exception("Converted arrow did not preserve line style.");
            }

            return "ConvertSelection=OK;Converted=2;RectType=" + rectType + ";ArrowType=" + arrowType + ";SlideShapes=" + slide.Shapes.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static PowerPoint.Shape ConvertShape(PowerPoint.Slide slide, PowerPoint.Shape source, string sourceMsoType, PptFreeformWriter writer, PptStyleSynchronizer sync, RoughDrawable drawable)
    {
        var request = new RoughShapeRequest
        {
            AssetId = "rough-converted-" + sourceMsoType,
            SourceMsoType = sourceMsoType,
            ShapeKind = ShapeKindMapper.FromMsoType(sourceMsoType),
            Left = source.Left,
            Top = source.Top,
            Width = Math.Max(1, source.Width),
            Height = Math.Max(sourceMsoType.IndexOf("Line", StringComparison.OrdinalIgnoreCase) >= 0 ? 0 : 1, source.Height)
        };
        var roughGroup = writer.InsertGroup(slide, request, drawable);
        roughGroup.Rotation = source.Rotation;
        sync.ApplyNativeShapeFormat(source, roughGroup, request);
        source.Delete();
        return roughGroup;
    }

    private static void AssertRoughGroup(PowerPoint.Shape group, string sourceMsoType)
    {
        if (group.Type != MsoShapeType.msoGroup) throw new Exception("Converted object is not a group: " + sourceMsoType);
        if ((int)group.Type == 13) throw new Exception("Converted object is a picture: " + sourceMsoType);
        if (group.Tags["PPT_ROUGH_SOURCE_MSO_TYPE"] != sourceMsoType) throw new Exception("Converted group lost source type metadata: " + sourceMsoType);
        if (FindRole(group, RoughPathRoles.InnerBoundary) == null) throw new Exception("Converted group missing inner boundary: " + sourceMsoType);
        if (FindRole(group, RoughPathRoles.HitArea) == null) throw new Exception("Converted group missing hit area: " + sourceMsoType);
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
        drawable.Paths.Add(RectPath(width, height, RoughPathRoles.InnerFillBoundary));
        drawable.Paths.Add(RectPath(width, height, RoughPathRoles.InnerBoundary));
        drawable.Paths.Add(RectPath(width - 2, height - 2, RoughPathRoles.OuterJitter));
        return drawable;
    }

    private static RoughPath RectPath(float width, float height, string role)
    {
        var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 2, Role = role };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 0, height } });
        return path;
    }

    private static RoughDrawable LineDrawable(float width, float height)
    {
        var drawable = new RoughDrawable();
        var inner = new RoughPath { Closed = false, Stroke = "#111111", StrokeWidthPt = 2, Role = RoughPathRoles.InnerBoundary };
        inner.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, height } });
        inner.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height } });
        drawable.Paths.Add(inner);
        var jitter = new RoughPath { Closed = false, Stroke = "#111111", StrokeWidthPt = 2, Role = RoughPathRoles.OuterJitter };
        jitter.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, height + 1 } });
        jitter.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height - 1 } });
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
[RoughNativeConvertSelectionSmoke]::Run()