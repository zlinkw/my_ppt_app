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

public static class RoughNativeFillSemanticsSmoke
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
                AssetId = "smoke-rough-fill-semantics",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 100,
                Top = 80,
                Width = 180,
                Height = 100
            };
            request.Style.FillMode = "solid";
            request.Style.FillColor = "#f1c40f";
            request.Style.FillTransparency = 0.15;
            request.Style.Stroke = "#111111";

            var group = writer.InsertGroup(slide, request, IrregularDrawable(180, 100));
            AssertNoPicture(group);

            var carrier = FindRole(group, "nativeCarrier");
            var innerFill = FindRole(group, RoughPathRoles.InnerFillBoundary);
            var innerBoundary = FindRole(group, RoughPathRoles.InnerBoundary);
            var outer = FindRole(group, RoughPathRoles.OuterJitter);
            var texture = FindRole(group, RoughPathRoles.Texture);
            var hitArea = FindRole(group, RoughPathRoles.HitArea);
            if (carrier == null || innerFill == null || innerBoundary == null || outer == null || texture == null || hitArea == null)
            {
                throw new Exception("Required rough native layers are missing.");
            }

            if (innerFill.Type != MsoShapeType.msoFreeform)
            {
                throw new Exception("Inner fill carrier must be a native Freeform.");
            }
            if (innerFill.Fill.Visible != MsoTriState.msoTrue)
            {
                throw new Exception("Inner fill carrier must own the visible fill.");
            }
            if (innerFill.Line.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Inner fill carrier must not draw the boundary line.");
            }
            if (innerFill.Nodes.Count < 6)
            {
                throw new Exception("Inner fill carrier did not preserve irregular Rough boundary nodes.");
            }
            if (carrier.Fill.Visible != MsoTriState.msoFalse || carrier.Line.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Native carrier must not provide a regular fill or visible line.");
            }
            if (innerBoundary.Fill.Visible != MsoTriState.msoFalse || outer.Fill.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Rough boundary overlays must not participate in fill.");
            }
            if (texture.Line.Visible != MsoTriState.msoTrue || texture.Fill.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Texture overlay must be a visible line-only native Freeform.");
            }
            if (hitArea.Fill.Visible != MsoTriState.msoFalse || hitArea.Line.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Hit area must remain invisible.");
            }

            innerBoundary.Fill.Visible = MsoTriState.msoTrue;
            outer.Fill.Visible = MsoTriState.msoTrue;
            outer.Line.Visible = MsoTriState.msoFalse;
            texture.Fill.Visible = MsoTriState.msoTrue;
            texture.Line.Visible = MsoTriState.msoFalse;
            carrier.Fill.Visible = MsoTriState.msoTrue;
            hitArea.Fill.Visible = MsoTriState.msoTrue;

            var synchronizer = new PptStyleSynchronizer(metadata);
            synchronizer.ApplyStructuralDefaults(group, request);
            if (carrier.Fill.Visible != MsoTriState.msoFalse || carrier.Line.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Structural normalization must hide native carrier fill and line.");
            }
            if (innerBoundary.Fill.Visible != MsoTriState.msoFalse || outer.Fill.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Structural normalization must remove fill from boundary overlays.");
            }
            if (outer.Line.Visible != MsoTriState.msoTrue)
            {
                throw new Exception("Structural normalization must restore visible outer jitter lines.");
            }
            if (texture.Fill.Visible != MsoTriState.msoFalse || texture.Line.Visible != MsoTriState.msoTrue)
            {
                throw new Exception("Structural normalization must keep texture overlays line-only.");
            }
            if (hitArea.Fill.Visible != MsoTriState.msoFalse || hitArea.Line.Visible != MsoTriState.msoFalse)
            {
                throw new Exception("Structural normalization must keep hit area invisible.");
            }

            var nestedRequest = new RoughShapeRequest
            {
                AssetId = "smoke-rough-nested-fill",
                SourceMsoType = "msoShapeRectangle",
                ShapeKind = "rectangle",
                Left = 320,
                Top = 80,
                Width = 140,
                Height = 80
            };
            nestedRequest.Style.FillMode = "solid";
            nestedRequest.Style.FillColor = "#ddeeff";
            nestedRequest.Style.RoughMode = "nested";
            nestedRequest.Style.NestedLayers = 2;
            var nestedGroup = writer.InsertGroup(slide, nestedRequest, NestedDrawable(140, 80));
            AssertNoPicture(nestedGroup);
            var nestedFill = FindRole(nestedGroup, RoughPathRoles.InnerFillBoundary);
            var nestedInner = FindRole(nestedGroup, RoughPathRoles.InnerBoundary);
            if (CountRole(nestedGroup, RoughPathRoles.InnerFillBoundary) != 1)
            {
                throw new Exception("Nested mode must use exactly one intersection fill carrier.");
            }
            if (CountRole(nestedGroup, RoughPathRoles.InnerBoundary) < 2)
            {
                throw new Exception("Nested mode must preserve multiple visible inner boundaries.");
            }
            AssertSameFreeformBoundary(nestedFill, nestedInner, 0.8f);

            return "FillSemantics=OK;InnerFillType=" + innerFill.Type + ";InnerFillNodes=" + innerFill.Nodes.Count + ";NestedInner=" + CountRole(nestedGroup, RoughPathRoles.InnerBoundary) + ";Children=" + group.GroupItems.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static void AssertNoPicture(PowerPoint.Shape group)
    {
        if (group.Type == MsoShapeType.msoPicture)
        {
            throw new Exception("Rough group resolved to picture.");
        }
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            if (group.GroupItems[i].Type == MsoShapeType.msoPicture)
            {
                throw new Exception("Rough group contains picture child.");
            }
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

    private static int CountRole(PowerPoint.Shape group, string role)
    {
        var count = 0;
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            if (group.GroupItems[i].Tags["PPT_ROUGH_OVERLAY_ROLE"] == role) count++;
        }
        return count;
    }

    private static RoughDrawable IrregularDrawable(float width, float height)
    {
        var drawable = new RoughDrawable();
        drawable.Paths.Add(IrregularPath(width, height, RoughPathRoles.InnerFillBoundary, 0));
        drawable.Paths.Add(IrregularPath(width, height, RoughPathRoles.InnerBoundary, 0));
        drawable.Paths.Add(IrregularPath(width, height, RoughPathRoles.OuterJitter, 4));
        drawable.Paths.Add(TexturePath(width, height));
        drawable.Paths.Add(RectPath(width, height, RoughPathRoles.HitArea));
        return drawable;
    }

    private static RoughDrawable NestedDrawable(float width, float height)
    {
        var drawable = new RoughDrawable();
        drawable.Paths.Add(IrregularPath(width - 12, height - 10, RoughPathRoles.InnerFillBoundary, -5));
        drawable.Paths.Add(IrregularPath(width - 12, height - 10, RoughPathRoles.InnerBoundary, -5));
        drawable.Paths.Add(IrregularPath(width, height, RoughPathRoles.InnerBoundary, 0));
        drawable.Paths.Add(RectPath(width, height, RoughPathRoles.HitArea));
        return drawable;
    }

    private static RoughPath IrregularPath(float width, float height, string role, float offset)
    {
        var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 2, Role = role };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0 - offset, 6 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width * 0.36f, 0 - offset } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width + offset, 9 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width - 8, height + offset } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 12, height - 4 } });
        return path;
    }

    private static RoughPath RectPath(float width, float height, string role)
    {
        var path = new RoughPath { Closed = true, Stroke = "#111111", StrokeWidthPt = 0, Role = role };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { 0, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, 0 } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width, height } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { 0, height } });
        return path;
    }

    private static RoughPath TexturePath(float width, float height)
    {
        var path = new RoughPath { Closed = false, Stroke = "#f1c40f", StrokeWidthPt = 1, Role = RoughPathRoles.Texture };
        path.Segments.Add(new RoughSegment { Type = "move", Data = new float[] { width * 0.2f, height * 0.35f } });
        path.Segments.Add(new RoughSegment { Type = "line", Data = new float[] { width * 0.74f, height * 0.28f } });
        return path;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughNativeFillSemanticsSmoke]::Run()