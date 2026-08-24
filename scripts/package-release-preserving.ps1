param(
    [string]$ReleaseRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
. (Join-Path $PSScriptRoot "installer-version.ps1")

function Invoke-Checked {
    param([scriptblock]$Command, [string]$Name)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

function XmlEscape([string]$Value) {
    return [System.Security.SecurityElement]::Escape($Value)
}

function Wait-ForFileReady {
    param([string]$Path, [int]$TimeoutSeconds = 90)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastLength = -1L
    $stableChecks = 0
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $Path -PathType Leaf) {
            try {
                $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
                try { $length = $stream.Length } finally { $stream.Dispose() }
                if ($length -gt 0 -and $length -eq $lastLength) {
                    $stableChecks++
                    if ($stableChecks -ge 2) { return }
                }
                else {
                    $lastLength = $length
                    $stableChecks = 0
                }
            }
            catch {
                $stableChecks = 0
            }
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for package output: $Path"
}

function New-FileManifest([string]$Path) {
    $item = Get-Item -LiteralPath $Path
    $stream = [IO.File]::OpenRead($Path)
    try {
        $hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash($stream)
        $sha256 = (($hashBytes | ForEach-Object { $_.ToString("X2") }) -join "")
    }
    finally {
        $stream.Dispose()
    }
    return [ordered]@{
        fileName = $item.Name
        length = $item.Length
        sha256 = $sha256
    }
}

function Resolve-MsBuild {
    $command = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Get-ChildItem "C:\Program Files\Microsoft Visual Studio", "C:\Program Files (x86)\Microsoft Visual Studio" -Recurse -Filter MSBuild.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\amd64\\" } |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $candidate) {
        throw "MSBuild not found. Install Visual Studio Build Tools with Office/VSTO workload."
    }
    return $candidate
}

function Resolve-Wix([string]$ToolRoot) {
    $candle = Get-Command candle.exe -ErrorAction SilentlyContinue
    $light = Get-Command light.exe -ErrorAction SilentlyContinue
    if ($candle -and $light) {
        return [ordered]@{ Candle = $candle.Source; Light = $light.Source }
    }

    $cachedRoot = Join-Path $root ".tools\wix314"
    $cachedCandle = Join-Path $cachedRoot "tools\candle.exe"
    $cachedLight = Join-Path $cachedRoot "tools\light.exe"
    if ((Test-Path -LiteralPath $cachedCandle) -and (Test-Path -LiteralPath $cachedLight)) {
        return [ordered]@{ Candle = $cachedCandle; Light = $cachedLight }
    }

    $wixRoot = Join-Path $ToolRoot "wix314"
    New-Item -ItemType Directory -Path $wixRoot | Out-Null
    $packagePath = Join-Path $wixRoot "wix.3.14.0.nupkg"
    $archivePath = Join-Path $wixRoot "wix.3.14.0.zip"
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/WiX/3.14.0" -OutFile $packagePath
    Copy-Item -LiteralPath $packagePath -Destination $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $wixRoot
    $resolvedCandle = Join-Path $wixRoot "tools\candle.exe"
    $resolvedLight = Join-Path $wixRoot "tools\light.exe"
    if (-not ((Test-Path -LiteralPath $resolvedCandle) -and (Test-Path -LiteralPath $resolvedLight))) {
        throw "WiX tools were not found after NuGet extraction."
    }
    return [ordered]@{ Candle = $resolvedCandle; Light = $resolvedLight }
}

function Resolve-Mage {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\mage.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.6.1 Tools\mage.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }
    throw "Mage.exe was not found. Install the .NET Framework 4.8 Developer Pack."
}

$commit = (& git rev-parse HEAD).Trim()
$shortCommit = (& git rev-parse --short=8 HEAD).Trim()
$commitCountText = (& git rev-list --count HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commitCountText -notmatch "^\d+$") {
    throw "Unable to derive release version from Git history."
}
$commitCount = [Math]::Max(1, [int]$commitCountText)
$installerProductVersion = Resolve-InstallerProductVersion -PackageJsonPath (Join-Path $root "package.json") -CommitCount $commitCount
$buildInfoSourcePath = Join-Path $root "src\RoughPptAddin\ui\build-info.json"
$originalBuildInfoBytes = [IO.File]::ReadAllBytes($buildInfoSourcePath)
$packageInfo = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json
$statusText = (& git status --porcelain -- . ":(exclude)src/RoughPptAddin/ui/build-info.json" | Out-String).Trim()
$buildInfo = [ordered]@{
    name = $packageInfo.name
    version = $installerProductVersion
    commit = (& git rev-parse --short=12 HEAD).Trim()
    branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    dirty = -not [string]::IsNullOrWhiteSpace($statusText)
    builtAtUtc = [DateTime]::UtcNow.ToString("o")
    source = "release-package"
}
[IO.File]::WriteAllText($buildInfoSourcePath, ($buildInfo | ConvertTo-Json -Depth 3), [Text.UTF8Encoding]::new($false))

try {
$releaseRootProvided = -not [string]::IsNullOrWhiteSpace($ReleaseRoot)
if ([string]::IsNullOrWhiteSpace($ReleaseRoot)) {
    $ReleaseRoot = Join-Path $root ("releases\RoughPptAddin-{0}-{1}" -f $installerProductVersion, $shortCommit)
}
$releasePath = [IO.Path]::GetFullPath($ReleaseRoot)
$repoPath = [IO.Path]::GetFullPath($root).TrimEnd("\")
if (-not $releasePath.StartsWith($repoPath + "\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "ReleaseRoot must stay inside the repository."
}
if (-not $releaseRootProvided) {
    $baseReleasePath = $releasePath
    $attempt = 2
    while (Test-Path -LiteralPath $releasePath) {
        $releasePath = $baseReleasePath + "-r" + $attempt
        $attempt++
    }
}
elseif (Test-Path -LiteralPath $releasePath) {
    throw "Release output already exists; review it manually before creating another package: $releasePath"
}

$publishRoot = Join-Path $releasePath "publish"
$objRoot = Join-Path $releasePath "obj"
$portableRoot = Join-Path $releasePath "RoughPptAddin"
$portablePublish = Join-Path $portableRoot "publish"
$portableScripts = Join-Path $portableRoot "scripts"
$portableDocs = Join-Path $portableRoot "docs"
$workRoot = Join-Path $releasePath "installer-build"
$toolRoot = Join-Path $releasePath "tools"
foreach ($path in @($releasePath, $publishRoot, $objRoot, $portableRoot, $portablePublish, $portableScripts, $portableDocs, $workRoot, $toolRoot)) {
    New-Item -ItemType Directory -Path $path | Out-Null
}

$manifestTemplateRoot = Join-Path $objRoot "manifest-templates"
New-Item -ItemType Directory -Path $manifestTemplateRoot | Out-Null
foreach ($manifestName in @("RoughPptAddin.dll.manifest", "RoughPptAddin.vsto")) {
    $source = Join-Path $root "publish\$manifestName"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "VSTO manifest template missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $manifestTemplateRoot $manifestName) -Force
}

Invoke-Checked {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1
} "MSBuild"

$binRelease = Join-Path $root "src\RoughPptAddin\bin\Release"
$assemblyPath = Join-Path $binRelease "RoughPptAddin.dll"
$vstoPath = Join-Path $publishRoot "RoughPptAddin.vsto"
$applicationManifestPath = Join-Path $publishRoot "RoughPptAddin.dll.manifest"
if (-not (Test-Path -LiteralPath $assemblyPath -PathType Leaf)) {
    throw "Fresh VSTO build did not produce required DLL."
}
Invoke-Checked {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-ribbon-icons.ps1 -AssemblyPath $assemblyPath
} "compiled Ribbon verification"

Copy-Item -Path (Join-Path $binRelease "*") -Destination $publishRoot -Recurse -Force
Copy-Item -Path (Join-Path $manifestTemplateRoot "*") -Destination $publishRoot -Force
$releaseBuildInfo = [ordered]@{
    name = $packageInfo.name
    version = $installerProductVersion
    commit = $commit.Substring(0, [Math]::Min(12, $commit.Length))
    branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    dirty = -not [string]::IsNullOrWhiteSpace($statusText)
    builtAtUtc = [DateTime]::UtcNow.ToString("o")
    source = "release-package"
}
[IO.File]::WriteAllText(
    (Join-Path $publishRoot "ui\build-info.json"),
    ($releaseBuildInfo | ConvertTo-Json -Depth 3),
    [Text.UTF8Encoding]::new($false)
)

$applicationManifestTemplate = Join-Path $manifestTemplateRoot "RoughPptAddin.dll.manifest"
$deploymentManifestTemplate = Join-Path $manifestTemplateRoot "RoughPptAddin.vsto"
Copy-Item -LiteralPath $applicationManifestTemplate -Destination $applicationManifestPath -Force
$manifestXml = New-Object System.Xml.XmlDocument
$manifestXml.Load($applicationManifestPath)
$obsoleteDependencies = @(
    $manifestXml.SelectNodes("//*[local-name()='dependency']") |
        Where-Object {
            $identity = $_.SelectSingleNode("*[local-name()='dependentAssembly']/*[local-name()='assemblyIdentity']")
            $identity -and ($identity.name -eq 'Microsoft.VisualStudio.Interop' -or $identity.name -eq 'Microsoft.VisualStudio.Imaging.Interop.14.0.DesignTime')
        }
)
foreach ($dependency in $obsoleteDependencies) {
    $dependency.ParentNode.RemoveChild($dependency) | Out-Null
}
$manifestXml.Save($applicationManifestPath)

$deploymentManifestPath = $vstoPath
Remove-Item -LiteralPath $deploymentManifestPath -Force

$certificateStore = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::My,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
)
$certificateStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
$signingCertificate = $certificateStore.Certificates |
    Where-Object { $_.Subject -eq "CN=RoughPptAddin Dev" -and $_.HasPrivateKey -and $_.NotAfter -gt [DateTime]::Now } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
$certificateStore.Close()
if (-not $signingCertificate) {
    throw "Current-user code-signing certificate CN=RoughPptAddin Dev with private key is required."
}

$mage = Resolve-Mage
Invoke-Checked {
    & $mage -u $applicationManifestPath -fd $publishRoot -ch $signingCertificate.Thumbprint -a sha256RSA
} "VSTO application manifest update"
Copy-Item -LiteralPath $deploymentManifestTemplate -Destination $deploymentManifestPath -Force
Invoke-Checked {
    & $mage -u $deploymentManifestPath -appm $applicationManifestPath -ch $signingCertificate.Thumbprint -a sha256RSA
} "VSTO deployment manifest update"
Invoke-Checked { & $mage -ver $applicationManifestPath } "VSTO application manifest verification"
Invoke-Checked { & $mage -ver $vstoPath } "VSTO deployment manifest verification"

Copy-Item -Path (Join-Path $publishRoot "*") -Destination $portablePublish -Recurse
Copy-Item -Path scripts\install.ps1,scripts\install-payload-core.ps1,scripts\uninstall.ps1,scripts\uninstall-completely.ps1,scripts\diagnose.ps1,scripts\install-prereqs.ps1 -Destination $portableScripts
Copy-Item -Path README.md -Destination $portableRoot
Copy-Item -Path docs\DEPLOYMENT.md,docs\VALIDATION.md -Destination $portableDocs

$commands = [ordered]@{
    "Install-RoughPptAddin.cmd" = "powershell -NoProfile -ExecutionPolicy Bypass -File `"scripts\install.ps1`" -SkipBuild -InstallPrereqs"
    "Uninstall-RoughPptAddin.cmd" = "powershell -NoProfile -ExecutionPolicy Bypass -File `"scripts\uninstall.ps1`""
    "Complete-Uninstall-RoughPptAddin.cmd" = "powershell -NoProfile -ExecutionPolicy Bypass -File `"scripts\uninstall-completely.ps1`" -ConfirmCompleteRemoval"
    "Diagnose-RoughPptAddin.cmd" = "powershell -NoProfile -ExecutionPolicy Bypass -File `"scripts\diagnose.ps1`""
}
foreach ($entry in $commands.GetEnumerator()) {
    $content = "@echo off`r`nsetlocal`r`ncd /d `"%~dp0`"`r`n$($entry.Value)`r`npause`r`n"
    [IO.File]::WriteAllText((Join-Path $portableRoot $entry.Key), $content, [Text.UTF8Encoding]::new($false))
}

$zipPath = Join-Path $releasePath "RoughPptAddin-Windows11.zip"
Compress-Archive -Path (Join-Path $portableRoot "*") -DestinationPath $zipPath

$msiRunnerPath = Join-Path $workRoot "RunMsiInstall.ps1"
$msiRunner = @'
param([Parameter(Mandatory = $true)][string]$PayloadZip)
$work = Join-Path ([IO.Path]::GetTempPath()) ("RoughPptAddinSetup-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work | Out-Null
Expand-Archive -LiteralPath $PayloadZip -DestinationPath $work
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $work "scripts\install.ps1") -SkipBuild -InstallPrereqs
exit $LASTEXITCODE
'@
[IO.File]::WriteAllText($msiRunnerPath, $msiRunner, [Text.UTF8Encoding]::new($false))

$wix = Resolve-Wix $toolRoot
$msiPath = Join-Path $releasePath "RoughPptAddin-Windows11.msi"
$wxsPath = Join-Path $workRoot "RoughPptAddin.wxs"
$wixObj = Join-Path $workRoot "RoughPptAddin.wixobj"
$zipSource = XmlEscape $zipPath
$runnerSource = XmlEscape $msiRunnerPath
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
        <Directory Id="RoughInstallerPayloadFolder" Name="RoughPptAddinInstaller">
          <Directory Id="ReleasePayloadFolder" Name="$shortCommit">
            <Component Id="PortableZipComponent" Guid="4E02E404-AE0E-4B1C-A207-31E0CB7A5B7A">
              <File Id="PortableZipFile" Name="RoughPptAddin-Windows11.zip" Source="$zipSource" KeyPath="no" />
              <RegistryValue Root="HKCU" Key="Software\RoughPptAddin\Installer" Name="PortableZip-$shortCommit" Type="integer" Value="1" KeyPath="yes" />
            </Component>
            <Component Id="MsiRunnerComponent" Guid="173992AF-6E42-4B7C-BD18-88355463FE68">
              <File Id="MsiRunnerFile" Name="RunMsiInstall.ps1" Source="$runnerSource" KeyPath="no" />
              <RegistryValue Root="HKCU" Key="Software\RoughPptAddin\Installer" Name="MsiRunner-$shortCommit" Type="integer" Value="1" KeyPath="yes" />
              <RemoveFolder Id="RemoveReleasePayloadFolder" Directory="ReleasePayloadFolder" On="uninstall" />
              <RemoveFolder Id="RemoveRoughInstallerPayloadFolder" Directory="RoughInstallerPayloadFolder" On="uninstall" />
            </Component>
          </Directory>
        </Directory>
      </Directory>
    </Directory>
    <Feature Id="MainFeature" Title="Rough PPT Add-in" Level="1">
      <ComponentRef Id="PortableZipComponent" />
      <ComponentRef Id="MsiRunnerComponent" />
    </Feature>
    <CustomAction Id="RunInstall" Directory="ReleasePayloadFolder" Execute="deferred" Impersonate="yes" Return="check" ExeCommand='powershell.exe -NoProfile -ExecutionPolicy Bypass -File "[ReleasePayloadFolder]RunMsiInstall.ps1" -PayloadZip "[ReleasePayloadFolder]RoughPptAddin-Windows11.zip"' />
    <InstallExecuteSequence>
      <Custom Action="RunInstall" After="InstallFiles">NOT REMOVE~="ALL"</Custom>
    </InstallExecuteSequence>
  </Product>
</Wix>
"@
[IO.File]::WriteAllText($wxsPath, $wxs, [Text.UTF8Encoding]::new($false))
Invoke-Checked { & $wix.Candle -nologo -out $wixObj $wxsPath } "WiX candle"
Invoke-Checked { & $wix.Light -nologo -sice:ICE61 -sice:ICE91 -out $msiPath $wixObj } "WiX light"

$exeRunnerPath = Join-Path $workRoot "RunIExpressInstall.cmd"
$exeRunner = @"
@echo off
setlocal
set "WORK=%TEMP%\RoughPptAddinSetup-%RANDOM%%RANDOM%"
mkdir "%WORK%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0RoughPptAddin-Windows11.zip' -DestinationPath '%WORK%'"
if errorlevel 1 exit /b %errorlevel%
powershell -NoProfile -ExecutionPolicy Bypass -File "%WORK%\scripts\install.ps1" -SkipBuild -InstallPrereqs
exit /b %errorlevel%
"@
[IO.File]::WriteAllText($exeRunnerPath, $exeRunner, [Text.UTF8Encoding]::new($false))
$iexpressZip = Join-Path $workRoot "RoughPptAddin-Windows11.zip"
Copy-Item -LiteralPath $zipPath -Destination $iexpressZip
$exePath = Join-Path $releasePath "RoughPptAddin-Windows11-Setup.exe"
$sedPath = Join-Path $workRoot "RoughPptAddin.sed"
$sourceDir = $workRoot.TrimEnd("\")
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
[IO.File]::WriteAllText($sedPath, $sed, [Text.UTF8Encoding]::new($false))
Invoke-Checked { & "$env:WINDIR\System32\iexpress.exe" /N /Q $sedPath } "IExpress"
Wait-ForFileReady $exePath

foreach ($path in @($zipPath, $msiPath, $exePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -le 0) {
        throw "Release artifact missing or empty: $path"
    }
}
$requiredPortable = @(
    "Install-RoughPptAddin.cmd",
    "Uninstall-RoughPptAddin.cmd",
    "Complete-Uninstall-RoughPptAddin.cmd",
    "Diagnose-RoughPptAddin.cmd",
    "publish\RoughPptAddin.vsto",
    "publish\RoughPptAddin.dll",
    "publish\ui\index.html",
    "scripts\install.ps1",
    "scripts\uninstall.ps1",
    "scripts\uninstall-completely.ps1"
)
foreach ($relative in $requiredPortable) {
    if (-not (Test-Path -LiteralPath (Join-Path $portableRoot $relative))) {
        throw "Portable package missing: $relative"
    }
}

$manifest = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    gitCommit = $commit
    installerProductVersion = $installerProductVersion
    artifacts = [ordered]@{
        portableZip = New-FileManifest $zipPath
        msi = New-FileManifest $msiPath
        exe = New-FileManifest $exePath
    }
}
$manifestPath = Join-Path $releasePath "installer-manifest.json"
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))

Write-Host "ReleaseRoot=$releasePath"
Write-Host "ZIP=$zipPath"
Write-Host "MSI=$msiPath"
Write-Host "EXE=$exePath"
Write-Host "Manifest=$manifestPath"
}
finally {
    [IO.File]::WriteAllBytes($buildInfoSourcePath, $originalBuildInfoBytes)
}
