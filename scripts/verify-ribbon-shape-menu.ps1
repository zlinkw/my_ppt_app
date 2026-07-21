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

$ribbon = [RoughPptAddin.Ribbon.RoughRibbon]::new($null)
$menu = $ribbon.GetShapeMenu($null)
if ([string]::IsNullOrWhiteSpace($menu)) {
    throw "Ribbon shape menu is empty."
}

[xml]$xml = $menu
$namespace = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$namespace.AddNamespace("r", "http://schemas.microsoft.com/office/2009/07/customui")
$buttons = $xml.SelectNodes("//r:button", $namespace)
$separators = $xml.SelectNodes("//r:menuSeparator", $namespace)

if ($buttons.Count -lt 190) {
    throw "Ribbon shape menu did not load the full packaged catalog: $($buttons.Count) buttons."
}

$ids = @{}
foreach ($button in $buttons) {
    $id = $button.id
    if ([string]::IsNullOrWhiteSpace($id)) {
        throw "Ribbon shape menu contains a button without id."
    }
    if ($ids.ContainsKey($id)) {
        throw "Ribbon shape menu contains duplicate id: $id"
    }
    $ids[$id] = $true

    if ([string]::IsNullOrWhiteSpace($button.label)) {
        throw "Ribbon shape menu contains a button without Chinese label: $id"
    }
    if ($button.label -notmatch "[\u3400-\u9fff]") {
        throw "Ribbon shape menu label is not Chinese-first: $($button.label)"
    }
    if ([string]::IsNullOrWhiteSpace($button.onAction) -or $button.onAction -ne "InsertShapeFromMenu") {
        throw "Ribbon shape menu button has invalid action: $id"
    }
}

foreach ($required in @("msoShapeLine", "msoShapeRectangle", "msoShapeOval", "msoShapeCloudCallout", "msoShapeActionButtonHome")) {
    $found = $false
    foreach ($button in $buttons) {
        if ($button.id -like "*$required") {
            $found = $true
            break
        }
    }
    if (-not $found) {
        throw "Ribbon shape menu missing required catalog shape: $required"
    }
}

Write-Host "RibbonShapeMenu=OK;Buttons=$($buttons.Count);Groups=$($separators.Count)"
