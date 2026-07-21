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
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using Microsoft.Office.Core;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

public static class RoughNativeFormatPreservationSmoke
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
                AssetId = "smoke-rough-native-format",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 120,
                Top = 100,
                Width = 160,
                Height = 90
            };
            request.Style.FillMode = "solid";
            request.Style.FillTransparency = 0;

            var group = writer.InsertGroup(slide, request, RectangleDrawable(160, 90));
            var innerBoundary = FindRole(group, RoughPathRoles.InnerBoundary);
            var innerFill = FindRole(group, RoughPathRoles.InnerFillBoundary);
            if (innerBoundary == null || innerFill == null)
            {
                throw new Exception("Native format smoke could not find inner layers.");
            }

            innerFill.Fill.Visible = MsoTriState.msoTrue;
            innerFill.Fill.ForeColor.RGB = Rgb("#2ca02c");
            innerFill.Fill.BackColor.RGB = Rgb("#f1c40f");
            innerFill.Fill.TwoColorGradient(MsoGradientStyle.msoGradientHorizontal, 1);
            innerBoundary.Line.ForeColor.RGB = Rgb("#1f77b4");
            innerBoundary.Line.Weight = 4.5f;
            innerBoundary.Line.DashStyle = MsoLineDashStyle.msoLineDashDot;

            sync.Capture(group, request);
            if (request.Style.FillMode != "native")
            {
                throw new Exception("Non-solid native fill was not captured as native mode.");
            }

            request.Width = 220;
            request.Height = 130;
            var replaced = writer.ReplaceVisiblePaths(group, request, RectangleDrawable(220, 130), (oldGroup, newGroup) => sync.ApplyNativeFormats(oldGroup, newGroup, request));
            sync.ApplyStructuralDefaults(replaced, request);

            var newBoundary = FindRole(replaced, RoughPathRoles.InnerBoundary);
            var newFill = FindRole(replaced, RoughPathRoles.InnerFillBoundary);
            if (newBoundary == null || newFill == null)
            {
                throw new Exception("Native format replacement lost inner layers.");
            }
            if (newFill.Fill.Visible == MsoTriState.msoFalse || newFill.Fill.Type != MsoFillType.msoFillGradient)
            {
                throw new Exception("Gradient fill was not preserved on inner fill carrier.");
            }
            if (newBoundary.Line.ForeColor.RGB != Rgb("#1f77b4") || Math.Abs(newBoundary.Line.Weight - 4.5f) > 0.2)
            {
                throw new Exception("Line color or width was not preserved with native format copy.");
            }
            if (newBoundary.Line.DashStyle != MsoLineDashStyle.msoLineDashDot)
            {
                throw new Exception("Line dash style was not preserved with native format copy.");
            }

            group = replaced;
            innerBoundary = newBoundary;
            innerFill = newFill;
            var picturePath = CreatePictureFillSource();
            innerFill.Fill.Visible = MsoTriState.msoTrue;
            innerFill.Fill.UserPicture(picturePath);
            if (innerFill.HasTextFrame == MsoTriState.msoTrue)
            {
                innerFill.TextFrame.TextRange.Text = "Native text";
            }
            innerBoundary.Line.EndArrowheadStyle = MsoArrowheadStyle.msoArrowheadStealth;
            innerBoundary.Shadow.Visible = MsoTriState.msoTrue;
            innerBoundary.Shadow.ForeColor.RGB = Rgb("#7f8c8d");

            sync.Capture(group, request);
            request.Width = 240;
            request.Height = 140;
            var pictureReplaced = writer.ReplaceVisiblePaths(group, request, RectangleDrawable(240, 140), (oldGroup, newGroup) => sync.ApplyNativeFormats(oldGroup, newGroup, request));
            sync.ApplyStructuralDefaults(pictureReplaced, request);
            var pictureBoundary = FindRole(pictureReplaced, RoughPathRoles.InnerBoundary);
            var pictureFill = FindRole(pictureReplaced, RoughPathRoles.InnerFillBoundary);
            if (pictureFill == null || pictureFill.Fill.Visible == MsoTriState.msoFalse || pictureFill.Fill.Type != MsoFillType.msoFillPicture)
            {
                throw new Exception("Picture fill was not preserved on inner fill carrier.");
            }
            if (pictureFill.HasTextFrame == MsoTriState.msoTrue && pictureFill.TextFrame.TextRange.Text != "Native text")
            {
                throw new Exception("Text was not preserved on inner fill carrier.");
            }
            if (pictureBoundary == null || pictureBoundary.Shadow.Visible != MsoTriState.msoTrue)
            {
                throw new Exception("Shadow state was not preserved on inner boundary.");
            }
            if (pictureBoundary.Line.EndArrowheadStyle != MsoArrowheadStyle.msoArrowheadStealth)
            {
                throw new Exception("Arrowhead style was not preserved on inner boundary.");
            }

            return "NativeFormat=OK;Gradient=" + newFill.Fill.Type + ";Picture=" + pictureFill.Fill.Type + ";Shadow=" + pictureBoundary.Shadow.Visible + ";Arrow=" + pictureBoundary.Line.EndArrowheadStyle;
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
        var innerFill = RectPath(width, height, RoughPathRoles.InnerFillBoundary);
        var innerBoundary = RectPath(width, height, RoughPathRoles.InnerBoundary);
        var jitter = RectPath(width - 2, height - 2, RoughPathRoles.OuterJitter);
        jitter.Segments[0].Data = new float[] { 1, 1 };
        drawable.Paths.Add(innerFill);
        drawable.Paths.Add(innerBoundary);
        drawable.Paths.Add(jitter);
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

    private static int Rgb(string hex)
    {
        var value = hex.TrimStart('#');
        var r = Convert.ToInt32(value.Substring(0, 2), 16);
        var g = Convert.ToInt32(value.Substring(2, 2), 16);
        var b = Convert.ToInt32(value.Substring(4, 2), 16);
        return r + (g << 8) + (b << 16);
    }

    private static string CreatePictureFillSource()
    {
        var path = Path.Combine(Path.GetTempPath(), "rough-native-fill-" + Guid.NewGuid().ToString("N") + ".png");
        using (var bitmap = new Bitmap(24, 24))
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.Clear(Color.FromArgb(255, 46, 204, 113));
            using (var brush = new SolidBrush(Color.FromArgb(255, 41, 128, 185)))
            {
                graphics.FillEllipse(brush, 4, 4, 16, 16);
            }
            bitmap.Save(path, ImageFormat.Png);
        }
        return path;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeFormatPreservationSmoke]::Run()