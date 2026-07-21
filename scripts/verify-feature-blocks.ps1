Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ribbonSource = Get-Content -LiteralPath (Join-Path $root "src\RoughPptAddin\Ribbon\RoughRibbon.cs") -Raw -Encoding UTF8
$controllerSource = Get-Content -LiteralPath (Join-Path $root "src\RoughPptAddin\Services\RoughAddInController.cs") -Raw -Encoding UTF8
foreach ($snippet in @(
    "featurePresetPaperMatrix",
    "featurePresetPaperStrip",
    "featurePresetPaperVolume",
    "featurePresetAttentionMap"
)) {
    if (-not $ribbonSource.Contains($snippet)) {
        throw "Ribbon feature preset missing: $snippet"
    }
    if (-not $controllerSource.Contains($snippet)) {
        throw "Controller feature preset missing: $snippet"
    }
}
foreach ($snippet in @(
    "ApplyFeatureBlockPaperPalette",
    "ApplyFeatureBlockPaperPalette(options, 18, 16, 10, 1, ""#d7ecff"", ""#6aa6ff"", ""xy"")",
    "ApplyFeatureBlockPaperPalette(options, 22, 14, 10, 2, ""#eef2ff"", ""#8b9cff"", ""x"")",
    "ApplyFeatureBlockPaperPalette(options, 20, 16, 10, 0, ""#d9fbe8"", ""#4f9cff"", ""diag"")",
    "ApplyFeatureBlockPaperPalette(options, 14, 14, 8, 0, ""#fff2cc"", ""#ff8fb3"", ""diag"")"
)) {
    if (-not $controllerSource.Contains($snippet)) {
        throw "Controller feature paper preset contract missing: $snippet"
    }
}

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

public static class RoughFeatureBlockSmoke
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
            var inserter = new FeatureBlockInserter();

            var twoD = new FeatureBlockOptions
            {
                Mode = "2d",
                CountX = 3,
                CountY = 2,
                CountZ = 1,
                BlockWidthPt = 18,
                BlockHeightPt = 16,
                GapPt = 1,
                Roundness = 0.2f,
                StartColor = "#ff0000",
                EndColor = "#00ff00",
                StrokeColor = "#111111",
                StrokeWidthPt = 1.2f,
                GradientDirection = "x",
                GradientAmount = 1.4
            };
            var twoDGroup = inserter.Insert(slide, twoD);
            AssertFeatureGroup(twoDGroup, 6, "2D");
            FeatureBlockOptions readTwoD;
            if (!inserter.TryReadOptions(twoDGroup, out readTwoD) || readTwoD.CountX != 3 || readTwoD.GapPt != 1 || readTwoD.Roundness < 0.19f || readTwoD.GradientAmount < 1.3)
            {
                throw new Exception("2D feature block options were not stored and read back completely.");
            }

            var threeD = new FeatureBlockOptions
            {
                Mode = "3d",
                VisualStyle = "plain",
                CountX = 2,
                CountY = 2,
                CountZ = 2,
                BlockWidthPt = 20,
                BlockHeightPt = 18,
                BlockDepthPt = 10,
                GapPt = 1,
                Roundness = 0.25f,
                StartColor = "#3366ff",
                EndColor = "#ff66aa",
                StrokeColor = "#222222",
                StrokeWidthPt = 0.9f,
                GradientDirection = "diag",
                GradientReverse = true,
                GradientAmount = 0.8
            };
            var threeDGroup = inserter.Insert(slide, threeD);
            AssertFeatureGroup(threeDGroup, 24, "3D");
            AssertThreeDRoundness(threeDGroup, 0.20f);
            AssertThreeDFaceOrder(threeDGroup, "3D");

            var zeroGap = new FeatureBlockOptions
            {
                Mode = "3d",
                VisualStyle = "plain",
                CountX = 3,
                CountY = 2,
                CountZ = 2,
                BlockWidthPt = 20,
                BlockHeightPt = 18,
                BlockDepthPt = 12,
                GapPt = 0,
                Roundness = 0.25f,
                StartColor = "#3366ff",
                EndColor = "#ff66aa",
                StrokeColor = "#222222",
                StrokeWidthPt = 0.9f,
                GradientDirection = "diag",
                GradientReverse = true,
                GradientAmount = 0.8
            };
            var zeroGapGroup = inserter.Insert(slide, zeroGap);
            AssertFeatureGroup(zeroGapGroup, 16, "3DZeroGap");
            AssertThreeDShell(zeroGapGroup, 3, 2, 2, 0.20f);
            AssertThreeDFaceOrder(zeroGapGroup, "3DZeroGap");

            var oldLeft = threeDGroup.Left;
            var oldTop = threeDGroup.Top;
            var update = new FeatureBlockOptions
            {
                Mode = "3d",
                VisualStyle = "plain",
                CountX = 3,
                CountY = 2,
                CountZ = 2,
                BlockWidthPt = 20,
                BlockHeightPt = 18,
                BlockDepthPt = 10,
                GapPt = 1,
                Roundness = 0.25f,
                StartColor = "#3366ff",
                EndColor = "#ff66aa",
                StrokeColor = "#222222",
                StrokeWidthPt = 0.9f,
                GradientDirection = "diag",
                GradientReverse = true,
                GradientAmount = 0.8,
                EditDirection = "left",
                EditDelta = 1
            };
            var replaced = inserter.Replace(slide, threeDGroup, update);
            AssertFeatureGroup(replaced, 36, "3DReplace");
            AssertThreeDRoundness(replaced, 0.20f);
            if (replaced.Left >= oldLeft - 0.5f)
            {
                throw new Exception("Left-direction feature block update did not move the anchor left.");
            }
            if (Math.Abs(replaced.Top - oldTop) > 1.0f)
            {
                throw new Exception("Left-direction feature block update should not drift vertically. oldTop=" + oldTop + ";newTop=" + replaced.Top);
            }

            return "FeatureBlocks=OK;TwoDChildren=" + twoDGroup.GroupItems.Count + ";ThreeDChildren=24;ZeroGapChildren=" + zeroGapGroup.GroupItems.Count + ";ReplacedChildren=" + replaced.GroupItems.Count + ";NoPictures=True;ThreeDRoundness=True;ZeroGapShell=True;GradientReverse=True";
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static void AssertFeatureGroup(PowerPoint.Shape group, int expectedChildren, string label)
    {
        if (group == null) throw new Exception(label + " feature block was not inserted.");
        if (group.Type != MsoShapeType.msoGroup) throw new Exception(label + " feature block is not a PowerPoint group.");
        if (group.Tags[FeatureBlockInserter.FeatureBlockTag] != "1") throw new Exception(label + " feature block tag missing.");
        if (string.IsNullOrWhiteSpace(group.Tags[FeatureBlockInserter.FeatureBlockOptionsTag])) throw new Exception(label + " feature block options tag missing.");
        if (group.GroupItems.Count != expectedChildren)
        {
            throw new Exception(label + " child count mismatch: " + group.GroupItems.Count + " != " + expectedChildren);
        }

        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            if (child.Type == MsoShapeType.msoPicture || (int)child.Type == 13)
            {
                throw new Exception(label + " feature block contains a picture child.");
            }
            if (child.Type != MsoShapeType.msoAutoShape && child.Type != MsoShapeType.msoFreeform)
            {
                throw new Exception(label + " feature block child is not editable AutoShape/Freeform: " + child.Type);
            }
        }
    }

    private static void AssertThreeDRoundness(PowerPoint.Shape group, float minimumRoundness)
    {
        var frontFaces = 0;
        var roundedFrontFaces = 0;
        var topSideFaces = 0;
        var roundedFreeformFaces = 0;
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            var name = child.Name ?? "";
            if (name.Contains("Feature3DFront"))
            {
                frontFaces++;
                if (child.Type != MsoShapeType.msoAutoShape || child.AutoShapeType != MsoAutoShapeType.msoShapeRoundedRectangle)
                {
                    throw new Exception("3D front face must be a rounded rectangle AutoShape.");
                }
                if (child.Adjustments.Count <= 0 || child.Adjustments[1] < minimumRoundness)
                {
                    throw new Exception("3D front face roundness did not apply.");
                }
                roundedFrontFaces++;
            }
            if (name.Contains("Feature3DTop") || name.Contains("Feature3DSide"))
            {
                topSideFaces++;
                if (child.Type != MsoShapeType.msoFreeform)
                {
                    throw new Exception("3D top/side rounded faces must remain editable Freeform.");
                }
                if (child.Nodes.Count > 5)
                {
                    roundedFreeformFaces++;
                }
            }
        }

        if (frontFaces == 0 || roundedFrontFaces != frontFaces)
        {
            throw new Exception("3D rounded front faces missing.");
        }
        if (topSideFaces == 0 || roundedFreeformFaces != topSideFaces)
        {
            throw new Exception("3D top/side rounded freeform faces missing curved nodes.");
        }
    }

    private static void AssertThreeDShell(PowerPoint.Shape group, int countX, int countY, int countZ, float minimumRoundness)
    {
        var expectedFront = countX * countY;
        var expectedTop = countX * countZ;
        var expectedSide = countY * countZ;
        var front = 0;
        var top = 0;
        var side = 0;
        var roundedFaces = 0;
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            var name = child.Name ?? "";
            if (name.Contains("Feature3DFront")) front++;
            if (name.Contains("Feature3DTop")) top++;
            if (name.Contains("Feature3DSide")) side++;
            if (name.Contains("Feature3D"))
            {
                if (child.Type != MsoShapeType.msoFreeform)
                {
                    throw new Exception("Zero-gap 3D shell faces must be closed editable Freeform.");
                }
                if (child.Fill.Visible != MsoTriState.msoTrue)
                {
                    throw new Exception("Zero-gap 3D shell face must have visible fill.");
                }
                if (child.Nodes.Count < 5)
                {
                    throw new Exception("Zero-gap 3D shell face is not closed.");
                }
                if (child.Nodes.Count > 5)
                {
                    roundedFaces++;
                }
            }
        }

        if (front != expectedFront || top != expectedTop || side != expectedSide)
        {
            throw new Exception("Zero-gap 3D shell face count mismatch: front=" + front + "/" + expectedFront + ";top=" + top + "/" + expectedTop + ";side=" + side + "/" + expectedSide);
        }
        if (roundedFaces < 6)
        {
            throw new Exception("Zero-gap 3D shell rounded outer faces missing.");
        }
    }

    private static void AssertThreeDFaceOrder(PowerPoint.Shape group, string label)
    {
        var minFront = int.MaxValue;
        var maxTop = int.MinValue;
        var minSide = int.MaxValue;
        var maxSide = int.MinValue;
        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            var name = child.Name ?? "";
            if (name.Contains("Feature3DFront")) minFront = Math.Min(minFront, child.ZOrderPosition);
            if (name.Contains("Feature3DTop")) maxTop = Math.Max(maxTop, child.ZOrderPosition);
            if (name.Contains("Feature3DSide"))
            {
                minSide = Math.Min(minSide, child.ZOrderPosition);
                maxSide = Math.Max(maxSide, child.ZOrderPosition);
            }
        }

        if (minFront == int.MaxValue || maxTop == int.MinValue || minSide == int.MaxValue)
        {
            throw new Exception(label + " 3D face order could not be inspected.");
        }
        if (minSide <= maxTop)
        {
            throw new Exception(label + " 3D side faces must be above top faces.");
        }
        if (minFront <= maxSide)
        {
            throw new Exception(label + " 3D front faces must be above top/side faces.");
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughFeatureBlockSmoke]::Run()