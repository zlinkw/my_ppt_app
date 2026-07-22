param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Invoke-Checked {
    param(
        [scriptblock]$Command,
        [string]$Name
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

function XmlEscape([string]$Value) {
    return [System.Security.SecurityElement]::Escape($Value)
}

function IdSafe([string]$Value) {
    $safe = [regex]::Replace($Value, "[^A-Za-z0-9_]", "_")
    if ($safe -match "^[0-9]") {
        return "i_$safe"
    }
    return $safe
}

function Wait-ForFileReady {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$TimeoutSeconds = 60
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastLength = -1L
    $stableChecks = 0
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $Path -PathType Leaf) {
            try {
                $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
                try {
                    $length = $stream.Length
                }
                finally {
                    $stream.Dispose()
                }
                if ($length -gt 0 -and $length -eq $lastLength) {
                    $stableChecks++
                    if ($stableChecks -ge 2) { return }
                }
                else {
                    $stableChecks = 0
                    $lastLength = $length
                }
            }
            catch {
                $stableChecks = 0
            }
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for installer output: $Path"
}

function New-FileManifest([string]$Path) {
    $item = Get-Item -LiteralPath $Path
    return [ordered]@{
        fileName = $item.Name
        length = $item.Length
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
}

function Ensure-Wix {
    $candle = Get-Command candle.exe -ErrorAction SilentlyContinue
    $light = Get-Command light.exe -ErrorAction SilentlyContinue
    if ($candle -and $light) {
        return [ordered]@{ Candle = $candle.Source; Light = $light.Source }
    }

    $wixDir = Join-Path $root ".tools\wix314"
    $candlePath = Join-Path $wixDir "tools\candle.exe"
    $lightPath = Join-Path $wixDir "tools\light.exe"
    if ((Test-Path $candlePath) -and (Test-Path $lightPath)) {
        return [ordered]@{ Candle = $candlePath; Light = $lightPath }
    }

    New-Item -ItemType Directory -Force $wixDir | Out-Null
    $pkg = Join-Path $wixDir "wix.3.14.0.nupkg"
    $zip = Join-Path $wixDir "wix.3.14.0.zip"
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/WiX/3.14.0" -OutFile $pkg
    Copy-Item -LiteralPath $pkg -Destination $zip -Force
    Expand-Archive -LiteralPath $zip -DestinationPath $wixDir -Force
    if (-not ((Test-Path $candlePath) -and (Test-Path $lightPath))) {
        throw "WiX tools were not found after NuGet extraction."
    }
    return [ordered]@{ Candle = $candlePath; Light = $lightPath }
}

if (-not $SkipBuild) {
    Invoke-Checked { powershell -ExecutionPolicy Bypass -File scripts\build.ps1 } "build"
}
Invoke-Checked { powershell -ExecutionPolicy Bypass -File scripts\package.ps1 -SkipBuild } "package"

$packageRoot = Join-Path $root "dist\RoughPptAddin"
$rootZip = Join-Path $root "RoughPptAddin-Windows11.zip"
$msiPath = Join-Path $root "RoughPptAddin-Windows11.msi"
$exePath = Join-Path $root "RoughPptAddin-Windows11-Setup.exe"
$workRoot = Join-Path $root "dist\installer-build"
$manifestPath = Join-Path $root "dist\installer-manifest.json"

$packageMetadata = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$applicationVersion = [Version]$packageMetadata.version
$commitCountText = (& git rev-list --count HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commitCountText -notmatch "^\d+$") {
    throw "Unable to derive installer version from Git history."
}
$commitCount = [Math]::Min(65535, [Math]::Max(1, [int]$commitCountText))
$installerProductVersion = "$($applicationVersion.Major).$($applicationVersion.Minor).$commitCount"

if (Test-Path $workRoot) {
    Remove-Item -LiteralPath $workRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $workRoot | Out-Null

$wix = Ensure-Wix

$msiRunner = @'
param([Parameter(Mandatory = $true)][string]$work)
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $work "scripts\install.ps1") -SkipBuild -InstallPrereqs
exit $LASTEXITCODE
'@
[System.IO.File]::WriteAllText((Join-Path $packageRoot "scripts\run-msi-install.ps1"), $msiRunner, [System.Text.UTF8Encoding]::new($false))

$directories = [ordered]@{ "" = "RoughInstallerPayloadFolder" }
$directoryXml = [System.Collections.Generic.List[string]]::new()
$componentXml = [System.Collections.Generic.List[string]]::new()
$componentRefs = [System.Collections.Generic.List[string]]::new()
$componentIndex = 0

function Ensure-DirectoryId([string]$RelativeDirectory) {
    if ($directories.Contains($RelativeDirectory)) {
        return $directories[$RelativeDirectory]
    }

    $parts = $RelativeDirectory -split "[\\/]+"
    $current = ""
    $parentId = "RoughInstallerPayloadFolder"
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $current = if ($current) { Join-Path $current $part } else { $part }
        if (-not $directories.Contains($current)) {
            $id = "DIR_" + (IdSafe $current)
            $directories[$current] = $id
            $directoryXml.Add("<Directory Id=`"$id`" Name=`"$(XmlEscape $part)`" ParentId=`"$parentId`" />")
        }
        $parentId = $directories[$current]
    }

    return $directories[$RelativeDirectory]
}

$files = Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName
foreach ($file in $files) {
    $relative = $file.FullName.Substring($packageRoot.Length).TrimStart("\", "/")
    $relativeDirectory = Split-Path $relative -Parent
    if ($null -eq $relativeDirectory) { $relativeDirectory = "" }
    $directoryId = Ensure-DirectoryId $relativeDirectory
    $componentIndex++
    $componentId = "CMP_$componentIndex"
    $fileId = "FIL_$componentIndex"
    $componentXml.Add("<Component Id=`"$componentId`" Directory=`"$directoryId`" Guid=`"*`"><File Id=`"$fileId`" Source=`"$(XmlEscape $file.FullName)`" KeyPath=`"yes`" /></Component>")
    $componentRefs.Add("<ComponentRef Id=`"$componentId`" />")
}

$wxs = @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="Rough PPT Add-in" Language="1033" Version="$installerProductVersion" Manufacturer="RoughPptAddin" UpgradeCode="8A0FEC41-54B6-40E9-9F4E-43A5273123E8">
    <Package InstallerVersion="500" Compressed="yes" InstallScope="perUser" InstallPrivileges="limited" Description="Rough.js native PowerPoint add-in" />
    <MajorUpgrade AllowSameVersionUpgrades="yes" DowngradeErrorMessage="A newer Rough PPT Add-in is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <Property Id="ARPNOMODIFY" Value="1" />
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="LocalAppDataFolder">
        <Directory Id="RoughInstallerPayloadFolder" Name="RoughPptAddinInstaller" />
      </Directory>
    </Directory>
    $($directoryXml -join "`n    ")
    $($componentXml -join "`n    ")
    <Feature Id="MainFeature" Title="Rough PPT Add-in" Level="1">
      $($componentRefs -join "`n      ")
    </Feature>
    <CustomAction Id="RunInstall" Directory="RoughInstallerPayloadFolder" Execute="deferred" Impersonate="yes" Return="check" ExeCommand='powershell.exe -NoProfile -ExecutionPolicy Bypass -File "[RoughInstallerPayloadFolder]scripts\run-msi-install.ps1" -work "[RoughInstallerPayloadFolder]"' />
    <InstallExecuteSequence>
      <Custom Action="RunInstall" After="InstallFiles">NOT REMOVE~="ALL"</Custom>
    </InstallExecuteSequence>
  </Product>
</Wix>
"@

$wxsPath = Join-Path $workRoot "RoughPptAddin.wxs"
$wixObj = Join-Path $workRoot "RoughPptAddin.wixobj"
[System.IO.File]::WriteAllText($wxsPath, $wxs, [System.Text.UTF8Encoding]::new($false))

if (Test-Path $msiPath) {
    Remove-Item -LiteralPath $msiPath -Force
}
Invoke-Checked { & $wix.Candle -nologo -out $wixObj $wxsPath } "wix candle"
Invoke-Checked { & $wix.Light -nologo -out $msiPath $wixObj } "wix light"

$runner = @"
@echo off
setlocal
set "WORK=%TEMP%\RoughPptAddinSetup-%RANDOM%%RANDOM%"
mkdir "%WORK%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0RoughPptAddin-Windows11.zip' -DestinationPath '%WORK%' -Force"
if errorlevel 1 exit /b %errorlevel%
powershell -NoProfile -ExecutionPolicy Bypass -File "%WORK%\scripts\install.ps1" -SkipBuild -InstallPrereqs
set "ERR=%errorlevel%"
if "%ERR%"=="0" rmdir /s /q "%WORK%" >nul 2>nul
exit /b %ERR%
"@

$runnerPath = Join-Path $workRoot "RunIExpressInstall.cmd"
[System.IO.File]::WriteAllText($runnerPath, $runner, [System.Text.UTF8Encoding]::new($false))

$sedPath = Join-Path $workRoot "RoughPptAddin.sed"
$sourceDir = $workRoot.TrimEnd("\")
Copy-Item -LiteralPath $rootZip -Destination (Join-Path $workRoot "RoughPptAddin-Windows11.zip") -Force
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=Rough PPT Add-in install completed.
TargetName=$exePath
FriendlyName=Rough PPT Add-in Setup
AppLaunched=RunIExpressInstall.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=RunIExpressInstall.cmd
UserQuietInstCmd=RunIExpressInstall.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$sourceDir
[SourceFiles0]
RunIExpressInstall.cmd=
RoughPptAddin-Windows11.zip=
"@
[System.IO.File]::WriteAllText($sedPath, $sed, [System.Text.UTF8Encoding]::new($false))
if (Test-Path $exePath) {
    Remove-Item -LiteralPath $exePath -Force
}
Invoke-Checked { & "$env:WINDIR\System32\iexpress.exe" /N /Q $sedPath } "iexpress"
Wait-ForFileReady $exePath

$installerManifest = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    gitCommit = (& git rev-parse HEAD).Trim()
    installerProductVersion = $installerProductVersion
    artifacts = [ordered]@{
        portableZip = New-FileManifest $rootZip
        msi = New-FileManifest $msiPath
        exe = New-FileManifest $exePath
    }
}
$installerManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "MSI=$msiPath"
Write-Host "EXE=$exePath"
