Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dll = Join-Path $root "publish\RoughPptAddin.dll"
if (-not (Test-Path $dll)) {
    throw "publish\RoughPptAddin.dll missing. Run scripts\build.ps1 first."
}

$smokeData = Join-Path ([System.IO.Path]::GetTempPath()) ("rough-native-catalog-smoke-" + [System.Guid]::NewGuid().ToString("N") + ".json")
try {
    Push-Location $root
    & node "scripts\generate-native-catalog-smoke-data.mjs" $smokeData
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate real Rough catalog smoke data."
    }
}
finally {
    Pop-Location
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
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;
using Microsoft.Office.Core;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

public sealed class RoughCatalogSmokeRoot
{
    public List<RoughCatalogSmokeItem> items { get; set; }
    public int distinctSignatures { get; set; }
}

public sealed class RoughCatalogSmokeItem
{
    public string enumName { get; set; }
    public RoughShapeRequest request { get; set; }
    public RoughDrawable drawable { get; set; }
    public string signature { get; set; }
    public RoughCatalogSmokeBounds bounds { get; set; }
}

public sealed class RoughCatalogSmokeBounds
{
    public float minX { get; set; }
    public float minY { get; set; }
    public float maxX { get; set; }
    public float maxY { get; set; }
    public float width { get; set; }
    public float height { get; set; }
}

public static class RoughNativeCatalogBatchSmoke
{
    public static string Run(string smokeDataPath)
    {
        var hadPowerPoint = System.Diagnostics.Process.GetProcessesByName("POWERPNT").Length > 0;
        var app = new PowerPoint.Application();
        app.Visible = MsoTriState.msoTrue;
        PowerPoint.Presentation presentation = null;
        try
        {
            var serializer = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 * 64 };
            var smoke = serializer.Deserialize<RoughCatalogSmokeRoot>(File.ReadAllText(smokeDataPath));
            if (smoke == null || smoke.items == null || smoke.items.Count < 150)
            {
                throw new Exception("Smoke data did not load enough items.");
            }
            if (smoke.distinctSignatures < 40)
            {
                throw new Exception("Rough smoke data is too uniform: " + smoke.distinctSignatures);
            }

            presentation = app.Presentations.Add(MsoTriState.msoTrue);
            var slide = presentation.Slides.Add(1, PowerPoint.PpSlideLayout.ppLayoutBlank);
            var metadata = new MetadataService();
            var writer = new PptFreeformWriter(metadata);
            var inserted = 0;
            var maxPathCount = 0;

            foreach (var item in smoke.items)
            {
                if (item.request == null || item.drawable == null || item.drawable.Paths == null || item.drawable.Paths.Count == 0)
                {
                    throw new Exception("Missing real Rough drawable for: " + item.enumName);
                }

                var group = writer.InsertGroup(slide, item.request, item.drawable);
                if ((int)group.Type == 13)
                {
                    throw new Exception("Catalog item inserted as picture: " + item.enumName);
                }
                if (group.Tags["PPT_ROUGH_ASSET_ID"] != item.request.AssetId)
                {
                    throw new Exception("Missing metadata for: " + item.enumName);
                }
                if (String.IsNullOrEmpty(group.Tags["PPT_ROUGH_GROUP_ID"]))
                {
                    throw new Exception("Missing rough group id for: " + item.enumName);
                }
                if (item.bounds == null)
                {
                    throw new Exception("Missing drawable bounds for: " + item.enumName);
                }
                if (RequiresVisibleBoundsCheck(item))
                {
                    var childBounds = VisibleChildBounds(group);
                    if (item.bounds.width > 4 && childBounds.Width < item.bounds.width * 0.55f)
                    {
                        throw new Exception("Inserted native width is too small for Rough output: " + item.enumName + ";Expected=" + item.bounds.width + ";Actual=" + childBounds.Width);
                    }
                    if (item.request.Height > 4 && item.bounds.height > 4 && childBounds.Height < item.bounds.height * 0.55f)
                    {
                        throw new Exception("Inserted native height is too small for Rough output: " + item.enumName + ";Expected=" + item.bounds.height + ";Actual=" + childBounds.Height);
                    }
                }
                else
                {
                    VisibleChildBounds(group);
                }

                maxPathCount = Math.Max(maxPathCount, item.drawable.Paths.Count);
                inserted++;
                group.Delete();
            }

            if (maxPathCount < 4)
            {
                throw new Exception("Rough catalog output lacks complex multi-path shapes.");
            }

            return "CatalogItems=" + smoke.items.Count + ";InsertedNative=" + inserted + ";DistinctRoughSignatures=" + smoke.distinctSignatures + ";MaxPathCount=" + maxPathCount + ";SlideShapes=" + slide.Shapes.Count;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
        }
    }

    private static RoughNativeBounds VisibleChildBounds(PowerPoint.Shape group)
    {
        var minLeft = float.MaxValue;
        var minTop = float.MaxValue;
        var maxRight = float.MinValue;
        var maxBottom = float.MinValue;
        var found = false;

        for (int i = 1; i <= group.GroupItems.Count; i++)
        {
            var child = group.GroupItems[i];
            if (child.Name == "Rough_InteractionShell") continue;
            minLeft = Math.Min(minLeft, child.Left);
            minTop = Math.Min(minTop, child.Top);
            maxRight = Math.Max(maxRight, child.Left + child.Width);
            maxBottom = Math.Max(maxBottom, child.Top + child.Height);
            found = true;
        }

        if (!found)
        {
            throw new Exception("Rough group has no visible children.");
        }

        return new RoughNativeBounds
        {
            Width = maxRight - minLeft,
            Height = maxBottom - minTop
        };
    }

    private static bool RequiresVisibleBoundsCheck(RoughCatalogSmokeItem item)
    {
        var kind = item.request == null ? string.Empty : item.request.ShapeKind ?? string.Empty;
        var enumName = item.enumName ?? string.Empty;
        if (kind.Equals("line", StringComparison.OrdinalIgnoreCase)) return false;
        if (enumName.IndexOf("Line", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Connector", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Arc", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Curve", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Brace", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Bracket", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("Wave", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("MathMinus", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("MathEqual", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("MathDivide", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("MathMultiply", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        if (enumName.IndexOf("MathNotEqual", StringComparison.OrdinalIgnoreCase) >= 0) return false;
        return true;
    }
}

public sealed class RoughNativeBounds
{
    public float Width { get; set; }
    public float Height { get; set; }
}
"@

try {
    Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
    [RoughNativeCatalogBatchSmoke]::Run($smokeData)
}
finally {
    if (Test-Path $smokeData) {
        Remove-Item -LiteralPath $smokeData -Force
    }
}