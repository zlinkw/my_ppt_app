Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dll = Join-Path $root "publish\RoughPptAddin.dll"
if (-not (Test-Path $dll)) {
    throw "publish\RoughPptAddin.dll missing. Run scripts\build.ps1 first."
}

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

public static class RoughNativeInsertSmoke
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
                AssetId = "smoke-rough-rectangle",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 120,
                Top = 100,
                Width = 180,
                Height = 100
            };
            request.Style.Stroke = "#111111";
            request.Style.StrokeWidthPt = 2;

            var drawable = new RoughDrawable();
            var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 2 };
            path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, 0 } });
            path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 180, 0 } });
            path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 180, 100 } });
            path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 0, 100 } });
            drawable.Paths.Add(path);

            var group = writer.InsertGroup(slide, request, drawable);
            var assetId = group.Tags["PPT_ROUGH_ASSET_ID"];
            var groupId = group.Tags["PPT_ROUGH_GROUP_ID"];
            if (assetId != "smoke-rough-rectangle")
            {
                throw new Exception("Missing PPT_ROUGH_ASSET_ID tag on inserted group.");
            }
            if (String.IsNullOrEmpty(groupId))
            {
                throw new Exception("Missing PPT_ROUGH_GROUP_ID tag on inserted group.");
            }
            if ((int)group.Type == 13)
            {
                throw new Exception("Inserted group resolved to msoPicture.");
            }
            if (slide.Shapes.Count != 1)
            {
                throw new Exception("Insert created extra shell shapes instead of one native rough object.");
            }
            if (group.Name == "Rough_InteractionShell")
            {
                throw new Exception("Insert returned interaction shell instead of rough geometry.");
            }

            return "Name=" + group.Name + ";Type=" + group.Type + ";AssetId=" + assetId + ";GroupId=" + groupId + ";ShapeCount=" + slide.Shapes.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeInsertSmoke]::Run()