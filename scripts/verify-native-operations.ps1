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

public static class RoughNativeOperationsSmoke
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
            var bottom = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, 30, 30, 70, 40);

            var metadata = new MetadataService();
            var writer = new PptFreeformWriter(metadata);
            var request = new RoughShapeRequest
            {
                AssetId = "smoke-rough-operations",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 120,
                Top = 100,
                Width = 140,
                Height = 80
            };
            request.Style.Stroke = "#111111";
            request.Style.StrokeWidthPt = 2;

            var group = writer.InsertGroup(slide, request, RectangleDrawable(140, 80));
            group.Name = "Rough_Operations_Source";
            var top = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, 360, 30, 70, 40);
            EnsureNativeGroup(group, "insert");

            var startLeft = group.Left;
            var startTop = group.Top;
            group.Left = startLeft + 42;
            group.Top = startTop + 24;
            if (!NearlyEqual(group.Left, startLeft + 42) || !NearlyEqual(group.Top, startTop + 24))
            {
                throw new Exception("Native group move did not preserve expected position.");
            }

            group.Width = 220;
            group.Height = 130;
            if (group.Width < 210 || group.Height < 120)
            {
                throw new Exception("Native group resize did not apply expected bounds.");
            }

            group.Rotation = 17;
            if (Math.Abs(group.Rotation - 17) > 0.5)
            {
                throw new Exception("Native group rotation did not apply.");
            }

            var zBefore = group.ZOrderPosition;
            group.ZOrder(MsoZOrderCmd.msoBringForward);
            var zForward = group.ZOrderPosition;
            group.ZOrder(MsoZOrderCmd.msoSendBackward);
            var zBackward = group.ZOrderPosition;
            if (zForward <= zBefore || zBackward >= zForward)
            {
                throw new Exception("Native group z-order commands did not move the group.");
            }
            if (bottom.ZOrderPosition == top.ZOrderPosition)
            {
                throw new Exception("PowerPoint z-order smoke setup is invalid.");
            }

            group.Rotation = 0;
            var peer = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, 320, 180, 90, 50);
            peer.Name = "Rough_Operations_Peer";
            var targetLeft = Math.Min(group.Left, peer.Left);
            var names = new string[] { group.Name, peer.Name };
            slide.Shapes.Range(names).Align(MsoAlignCmd.msoAlignLefts, MsoTriState.msoFalse);
            if (!NearlyEqual(group.Left, targetLeft) || !NearlyEqual(peer.Left, targetLeft))
            {
                throw new Exception("Native group align did not align left edges with peer shape.");
            }

            var duplicateRange = group.Duplicate();
            var duplicate = duplicateRange[1];
            EnsureNativeGroup(duplicate, "duplicate");
            if (duplicate.GroupItems.Count != group.GroupItems.Count)
            {
                throw new Exception("Duplicated rough group changed grouped item count.");
            }

            return "Name=" + group.Name +
                ";Type=" + group.Type +
                ";MoveLeft=" + group.Left +
                ";Width=" + group.Width +
                ";Rotation=" + group.Rotation +
                ";DuplicateType=" + duplicate.Type +
                ";ShapeCount=" + slide.Shapes.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static void EnsureNativeGroup(PowerPoint.Shape group, string phase)
    {
        if (group.Type != MsoShapeType.msoGroup)
        {
            throw new Exception("Rough object is not a native group during " + phase + ".");
        }
        if ((int)group.Type == 13)
        {
            throw new Exception("Rough object resolved to msoPicture during " + phase + ".");
        }
        if (group.GroupItems.Count < 2)
        {
            throw new Exception("Rough group is missing visible paths or interaction shell during " + phase + ".");
        }
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            if (child.Type == MsoShapeType.msoPicture || (int)child.Type == 13)
            {
                throw new Exception("Rough group contains picture child during " + phase + ".");
            }
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

    private static bool NearlyEqual(float a, float b)
    {
        return Math.Abs(a - b) < 0.75;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeOperationsSmoke]::Run()
