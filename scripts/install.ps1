param(
    [switch]$SkipBuild,
    [switch]$InstallPrereqs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$payloadCore = Join-Path $PSScriptRoot "install-payload-core.ps1"
if (-not (Test-Path -LiteralPath $payloadCore -PathType Leaf)) {
    throw "安装包缺少本体事务模块：$payloadCore"
}
. $payloadCore

if (-not $SkipBuild) {
    powershell -ExecutionPolicy Bypass -File scripts\build.ps1
}

function Test-RegistryPath {
    param([string[]]$Path)
    foreach ($item in $Path) {
        if (Get-ItemProperty $item -ErrorAction SilentlyContinue) {
            return $true
        }
    }
    return $false
}

function U {
    param([string]$Value)
    return [regex]::Replace($Value, "\\u([0-9A-Fa-f]{4})", {
        param($Match)
        [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
    })
}

function Test-PowerPointInstalled {
    $powerPoint = Get-ChildItem "C:\Program Files\Microsoft Office", "C:\Program Files (x86)\Microsoft Office" -Recurse -Filter POWERPNT.EXE -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool]$powerPoint
}

function Test-WebView2Runtime {
    return Test-RegistryPath @(
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    )
}

function Test-VstoRuntime {
    return Test-RegistryPath @(
        "HKLM:\SOFTWARE\Microsoft\VSTO Runtime Setup\v4R",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VSTO Runtime Setup\v4R"
    )
}

function Test-DotNetFramework48 {
    $value = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -Name Release -ErrorAction SilentlyContinue
    return [bool]($value -and [int]$value.Release -ge 528040)
}

function Open-OfficialInstallPage {
    param([string]$Uri, [string]$Label)
    try {
        Start-Process -FilePath $Uri
        Write-Host "已打开 Microsoft 官方${Label}安装页面：$Uri"
    }
    catch {
        Write-Warning "无法自动打开${Label}安装页面，请手动访问：$Uri"
    }
}

function Wait-ForPowerPointToExit {
    param([int]$TimeoutSeconds = 30)

    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        $process = Get-Process POWERPNT -ErrorAction SilentlyContinue
        if (-not $process) {
            return
        }

        $hasOpenPresentations = $false
        try {
            $app = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
            if ($app.Presentations.Count -gt 0) {
                $hasOpenPresentations = $true
            }
            else {
                $app.Quit()
            }
        }
        catch {
        }

        if ($hasOpenPresentations) {
            throw (U "PowerPoint \u6b63\u5728\u8fd0\u884c\u4e14\u6709\u6253\u5f00\u7684\u6f14\u793a\u6587\u7a3f\u3002\u8bf7\u4fdd\u5b58\u5e76\u5173\u95ed PowerPoint \u540e\u91cd\u65b0\u5b89\u88c5\u3002")
        }

        Start-Sleep -Seconds 1
    }

    if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
        throw (U "PowerPoint \u4ecd\u5728\u8fd0\u884c\u3002\u8bf7\u5173\u95ed PowerPoint \u540e\u91cd\u65b0\u5b89\u88c5\uff0c\u4ee5\u4fbf\u5b89\u5168\u66ff\u6362 WebView2/VSTO \u6587\u4ef6\u3002")
    }
}

if (-not (Test-PowerPointInstalled)) {
    if ($InstallPrereqs) {
        Open-OfficialInstallPage "https://www.microsoft.com/microsoft-365/powerpoint" "PowerPoint"
        throw (U "\u672a\u68c0\u6d4b\u5230\u684c\u9762\u7248 PowerPoint\uff0c\u5df2\u6253\u5f00 Microsoft \u5b98\u65b9\u9875\u9762\u3002\u5b89\u88c5 PowerPoint \u540e\u8bf7\u91cd\u65b0\u8fd0\u884c Rough \u5b89\u88c5\u5305\u3002")
    }
    throw (U "\u672a\u68c0\u6d4b\u5230\u684c\u9762\u7248 PowerPoint\uff0c\u65e0\u6cd5\u5b89\u88c5 Rough \u624b\u7ed8\u56fe\u5f62\u63d2\u4ef6\u3002")
}

if ((-not (Test-DotNetFramework48)) -or (-not (Test-WebView2Runtime)) -or (-not (Test-VstoRuntime))) {
    if ($InstallPrereqs) {
        powershell -ExecutionPolicy Bypass -File scripts\install-prereqs.ps1 -RuntimeOnly
    } else {
        throw (U "\u7f3a\u5c11 .NET Framework 4.8\u3001WebView2 Runtime \u6216 VSTO Runtime\u3002\u8bf7\u4f7f\u7528 -InstallPrereqs \u91cd\u65b0\u8fd0\u884c\uff0c\u6216\u6267\u884c scripts\install-prereqs.ps1 -RuntimeOnly\u3002")
    }
}

$publish = Join-Path $root "publish"
$sourceManifest = Join-Path $publish "RoughPptAddin.vsto"

if (-not (Test-Path $sourceManifest)) {
    throw (U "\u672a\u627e\u5230 RoughPptAddin.vsto\u3002\u8bf7\u5148\u8fd0\u884c scripts\build.ps1\u3002")
}

Wait-ForPowerPointToExit

$dfshim = Join-Path $env:WINDIR "System32\dfshim.dll"
if (-not (Test-Path $dfshim)) {
    if ($InstallPrereqs) {
        powershell -ExecutionPolicy Bypass -File scripts\install-prereqs.ps1 -RuntimeOnly
    }
    if (-not (Test-Path $dfshim)) {
        if ($InstallPrereqs) { Open-OfficialInstallPage "https://www.microsoft.com/download/details.aspx?id=48217" "VSTO Runtime" }
        throw (U "\u672a\u627e\u5230 dfshim.dll\u3002\u8bf7\u5b89\u88c5 .NET Framework ClickOnce \u652f\u6301\u6216 VSTO Runtime\u3002")
    }
}

$localAppDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$installRoot = Join-Path $localAppDataRoot "RoughPptAddin"
$installDir = Join-Path $installRoot "publish"
$resolvedInstallRoot = [System.IO.Path]::GetFullPath($installRoot).TrimEnd("\")
$resolvedInstallDir = [System.IO.Path]::GetFullPath($installDir)
if (-not $resolvedInstallDir.StartsWith($resolvedInstallRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw ((U "\u62d2\u7edd\u66ff\u6362\u4e0d\u5b89\u5168\u7684\u5b89\u88c5\u8def\u5f84\uff1a") + $installDir)
}
$payloadTransaction = Start-RoughPayloadTransaction -SourcePublish $publish -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
$installDir = $payloadTransaction.Live

$manifest = Join-Path $installDir "RoughPptAddin.vsto"
$manifestUri = (New-Object System.Uri($manifest)).AbsoluteUri
$addInKey = "HKCU:\Software\Microsoft\Office\PowerPoint\Addins\RoughPptAddin"

try {
$packagedCert = Join-Path $root "certificates\RoughPptAddin.cer"
if (Test-Path $packagedCert) {
    Import-Certificate -FilePath $packagedCert -CertStoreLocation Cert:\CurrentUser\TrustedPublisher | Out-Null
    Import-Certificate -FilePath $packagedCert -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Write-Host ((U "\u5df2\u4fe1\u4efb\u6253\u5305\u7b7e\u540d\u8bc1\u4e66\uff1a") + $packagedCert)
}

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.Subject -eq "CN=RoughPptAddin Dev" -and $_.HasPrivateKey } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
if ($cert) {
    $certPath = Join-Path $env:TEMP "RoughPptAddin-Dev.cer"
    Export-Certificate -Cert $cert -FilePath $certPath -Force | Out-Null
    Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\CurrentUser\TrustedPublisher | Out-Null
    Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Remove-Item -LiteralPath $certPath -Force
    Write-Host ((U "\u5df2\u4fe1\u4efb\u5f00\u53d1\u7b7e\u540d\u8bc1\u4e66\uff1a") + $cert.Thumbprint)
}

Write-Host ((U "\u6b63\u5728\u5b89\u88c5 VSTO \u63d2\u4ef6\uff1a") + $manifestUri)
$registrationProcess = Start-Process -FilePath "$env:WINDIR\System32\rundll32.exe" -ArgumentList "dfshim.dll,ShOpenVerbApplication `"$manifestUri`"" -Wait -PassThru -WindowStyle Hidden
if ($registrationProcess.ExitCode -ne 0) {
    throw ((U "VSTO \u6ce8\u518c\u5931\u8d25\uff0c\u5df2\u6062\u590d\u5b89\u88c5\u524d\u7684\u63d2\u4ef6\u672c\u4f53\u3002\u9000\u51fa\u7801\uff1a") + $registrationProcess.ExitCode)
}

New-Item -Path $addInKey -Force | Out-Null
New-ItemProperty -Path $addInKey -Name "Description" -Value (U "Rough.js \u89c6\u89c9\u7684 PPT \u539f\u751f\u53ef\u7f16\u8f91\u624b\u7ed8\u56fe\u5f62\u63d2\u4ef6") -PropertyType String -Force | Out-Null
New-ItemProperty -Path $addInKey -Name "FriendlyName" -Value (U "Rough \u624b\u7ed8\u56fe\u5f62\u63d2\u4ef6") -PropertyType String -Force | Out-Null
New-ItemProperty -Path $addInKey -Name "LoadBehavior" -Value 3 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $addInKey -Name "Manifest" -Value ($manifestUri + "|vstolocal") -PropertyType String -Force | Out-Null
Complete-RoughPayloadTransaction -Paths $payloadTransaction
} catch {
    Undo-RoughPayloadTransaction -Paths $payloadTransaction
    if (-not $payloadTransaction.HadCurrent -and (Test-Path $addInKey)) {
        Remove-Item -LiteralPath $addInKey -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
}

Write-Host (U "\u5b89\u88c5\u8bf7\u6c42\u5df2\u5b8c\u6210\u3002\u5982 PowerPoint \u63d0\u793a\uff0c\u8bf7\u542f\u7528 Rough \u624b\u7ed8\u56fe\u5f62\u63d2\u4ef6\u3002")
Write-Host ((U "\u5df2\u5b89\u88c5\u6587\u4ef6\uff1a") + $installDir)
Write-Host ((U "\u6ce8\u518c\u8868\u9879\uff1a") + $addInKey)
