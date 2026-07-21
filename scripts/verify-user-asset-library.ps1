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
using System.IO;
using Microsoft.Office.Core;
using PowerPoint = Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Services;

public static class RoughUserAssetLibrarySmoke
{
    public static string Run()
    {
        var hadPowerPoint = System.Diagnostics.Process.GetProcessesByName("POWERPNT").Length > 0;
        var app = new PowerPoint.Application();
        app.Visible = MsoTriState.msoTrue;
        PowerPoint.Presentation presentation = null;
        string pptxPath = null;
        string metadataPath = null;
        string thumbnailPath = null;
        try
        {
            presentation = app.Presentations.Add(MsoTriState.msoTrue);
            var slide = presentation.Slides.Add(1, PowerPoint.PpSlideLayout.ppLayoutBlank);
            slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRoundedRectangle, 80, 80, 120, 70).Select(MsoTriState.msoTrue);

            var capture = new SelectionCaptureService(app);
            var info = capture.SaveCurrentSelection();
            pptxPath = info.TemplatePath;
            metadataPath = Path.ChangeExtension(pptxPath, ".json");
            thumbnailPath = info.ThumbnailPath;
            if (String.IsNullOrEmpty(thumbnailPath) || !File.Exists(thumbnailPath))
            {
                throw new Exception("Saved asset thumbnail missing.");
            }

            var found = false;
            foreach (var asset in capture.ListUserAssets())
            {
                if (asset.Id == info.Id && asset.NativeOnly && File.Exists(asset.TemplatePath) && File.Exists(asset.ThumbnailPath))
                {
                    found = true;
                    break;
                }
            }
            if (!found)
            {
                throw new Exception("Saved asset missing from library list.");
            }

            var before = slide.Shapes.Count;
            var pasted = capture.InsertAsset(info.Id);
            if (slide.Shapes.Count <= before)
            {
                throw new Exception("Saved asset did not insert native shapes.");
            }
            if ((int)pasted.Type == 13)
            {
                throw new Exception("Saved asset inserted as picture.");
            }

            return "AssetId=" + info.Id + ";ShapeCount=" + info.ShapeCount + ";Thumbnail=True;SlideShapes=" + slide.Shapes.Count + ";PastedType=" + pasted.Type;
        }
        finally
        {
            if (presentation != null) presentation.Close();
            if (!hadPowerPoint) app.Quit();
            if (metadataPath != null && File.Exists(metadataPath)) File.Delete(metadataPath);
            if (pptxPath != null && File.Exists(pptxPath)) File.Delete(pptxPath);
            if (thumbnailPath != null && File.Exists(thumbnailPath)) File.Delete(thumbnailPath);
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies @($dll, $office, $powerPointInterop, "System.dll", "System.Core.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll")
[RoughUserAssetLibrarySmoke]::Run()