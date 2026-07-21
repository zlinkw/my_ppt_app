Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function U {
    param([string]$Value)
    return [regex]::Replace($Value, "\\u([0-9A-Fa-f]{4})", {
        param($Match)
        [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
    })
}

function Test-Command($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Get-PowerPointInstallInfo {
    $appPathKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE"
    )
    $powerPointPath = $null
    foreach ($keyPath in $appPathKeys) {
        try {
            $key = Get-Item -LiteralPath $keyPath -ErrorAction Stop
            $candidate = [string]$key.GetValue("")
            if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
                $powerPointPath = $candidate
                break
            }
        }
        catch {
        }
    }

    if (-not $powerPointPath) {
        $powerPoint = Get-ChildItem "C:\Program Files\Microsoft Office", "C:\Program Files (x86)\Microsoft Office" -Recurse -Filter POWERPNT.EXE -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($powerPoint) { $powerPointPath = $powerPoint.FullName }
    }

    $clickToRun = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration" -ErrorAction SilentlyContinue
    $fileVersion = $null
    if ($powerPointPath) {
        try { $fileVersion = (Get-Item -LiteralPath $powerPointPath).VersionInfo.FileVersion } catch {}
    }

    return [pscustomobject]@{
        Path = $powerPointPath
        FileVersion = $fileVersion
        VersionToReport = if ($clickToRun) { [string]$clickToRun.VersionToReport } else { $null }
        Platform = if ($clickToRun) { [string]$clickToRun.Platform } elseif ($powerPointPath -like "*Program Files (x86)*") { "x86" } elseif ($powerPointPath) { "x64" } else { $null }
        ProductReleaseIds = if ($clickToRun) { [string]$clickToRun.ProductReleaseIds } else { $null }
    }
}

Write-Host (U "Rough PPT \u63d2\u4ef6\u8bca\u65ad")
Write-Host ((U "\u4ed3\u5e93\uff1a") + $((Get-Location).Path))
$result = [ordered]@{
    repository = (Get-Location).Path
    checks = [ordered]@{}
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}

$powerPoint = Get-PowerPointInstallInfo
if ($powerPoint.Path) {
    Write-Host "PowerPoint: OK $($powerPoint.Path) version=$($powerPoint.VersionToReport) platform=$($powerPoint.Platform)"
    $result.checks.powerPoint = [ordered]@{
        ok = $true
        path = $powerPoint.Path
        fileVersion = $powerPoint.FileVersion
        versionToReport = $powerPoint.VersionToReport
        platform = $powerPoint.Platform
        productReleaseIds = $powerPoint.ProductReleaseIds
    }
} else {
    Write-Warning (U "PowerPoint\uff1a\u672a\u68c0\u6d4b\u5230")
    $result.checks.powerPoint = [ordered]@{ ok = $false; path = $null }
}

$dotnet = Test-Command "dotnet"
if ($dotnet) {
    Write-Host "dotnet: $dotnet"
    $result.checks.dotnet = [ordered]@{ ok = $true; path = $dotnet }
    dotnet --info
} else {
    Write-Warning (U "dotnet\uff1a\u672a\u68c0\u6d4b\u5230")
    $result.checks.dotnet = [ordered]@{ ok = $false; path = $null }
}

$msbuild = Test-Command "msbuild"
if (-not $msbuild) {
    $msbuild = Get-ChildItem "C:\Program Files\Microsoft Visual Studio", "C:\Program Files (x86)\Microsoft Visual Studio" -Recurse -Filter MSBuild.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if ($msbuild) {
    Write-Host "MSBuild: OK $msbuild"
    $result.checks.msbuild = [ordered]@{ ok = $true; path = $msbuild }
} else {
    Write-Warning (U "MSBuild\uff1a\u672a\u68c0\u6d4b\u5230\u3002\u8bf7\u5b89\u88c5\u5305\u542b Office/VSTO \u5de5\u4f5c\u8d1f\u8f7d\u7684 Visual Studio Build Tools\u3002")
    $result.checks.msbuild = [ordered]@{ ok = $false; path = $null; remediation = "Install Visual Studio Build Tools 2022 with Microsoft.VisualStudio.Workload.OfficeBuildTools." }
}

$node = Test-Command "node"
if ($node) { Write-Host "Node: OK $node"; $result.checks.node = [ordered]@{ ok = $true; path = $node } } else { Write-Warning (U "Node\uff1a\u672a\u68c0\u6d4b\u5230"); $result.checks.node = [ordered]@{ ok = $false; path = $null } }

$npm = Test-Command "npm"
if ($npm) { Write-Host "npm: OK $npm"; $result.checks.npm = [ordered]@{ ok = $true; path = $npm } } else { Write-Warning (U "npm\uff1a\u672a\u68c0\u6d4b\u5230"); $result.checks.npm = [ordered]@{ ok = $false; path = $null } }

$webView2Runtime = Get-ItemProperty `
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}", `
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}", `
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($webView2Runtime) {
    Write-Host "WebView2 Runtime: OK $($webView2Runtime.pv)"
    $result.checks.webView2Runtime = [ordered]@{ ok = $true; version = $webView2Runtime.pv }
} else {
    Write-Warning (U "WebView2 Runtime\uff1a\u672a\u5728 HKLM EdgeUpdate \u6ce8\u518c\u8868\u4e2d\u68c0\u6d4b\u5230")
    $result.checks.webView2Runtime = [ordered]@{ ok = $false; version = $null; remediation = "Install Microsoft Edge WebView2 Evergreen Runtime." }
}

$vstoRuntime = Get-ItemProperty `
    "HKLM:\SOFTWARE\Microsoft\VSTO Runtime Setup\v4R", `
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VSTO Runtime Setup\v4R" `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($vstoRuntime) {
    Write-Host "VSTO Runtime: OK $($vstoRuntime.Version)"
    $result.checks.vstoRuntime = [ordered]@{ ok = $true; version = $vstoRuntime.Version }
} else {
    Write-Warning (U "VSTO Runtime\uff1a\u672a\u68c0\u6d4b\u5230")
    $result.checks.vstoRuntime = [ordered]@{ ok = $false; remediation = "Install Visual Studio Tools for Office Runtime." }
}

$dotNet48 = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -Name Release -ErrorAction SilentlyContinue
if ($dotNet48 -and [int]$dotNet48.Release -ge 528040) {
    Write-Host ".NET Framework 4.8: OK release=$($dotNet48.Release)"
    $result.checks.dotNetFramework48 = [ordered]@{ ok = $true; release = [int]$dotNet48.Release }
} else {
    Write-Warning (U ".NET Framework 4.8\uff1a\u672a\u68c0\u6d4b\u5230")
    $result.checks.dotNetFramework48 = [ordered]@{ ok = $false; remediation = "Install .NET Framework 4.8 through Windows Update or Microsoft official installer." }
}

$signingCert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.Subject -eq "CN=RoughPptAddin Dev" -and $_.HasPrivateKey } |
    Select-Object -First 1
if ($signingCert) {
    Write-Host "ClickOnce signing cert: OK $($signingCert.Thumbprint)"
    $result.checks.clickOnceSigningCert = [ordered]@{ ok = $true; thumbprint = $signingCert.Thumbprint }
} else {
    Write-Warning (U "ClickOnce \u7b7e\u540d\u8bc1\u4e66\uff1a\u672a\u68c0\u6d4b\u5230\u3002scripts\\build.ps1 \u4f1a\u521b\u5efa\u5f53\u524d\u7528\u6237\u5f00\u53d1\u8bc1\u4e66\u3002")
    $result.checks.clickOnceSigningCert = [ordered]@{ ok = $false; remediation = "Run scripts\\build.ps1 to create the local development signing certificate." }
}

$addInKey = "HKCU:\Software\Microsoft\Office\PowerPoint\Addins\RoughPptAddin"
if (Test-Path $addInKey) {
    $addIn = Get-ItemProperty $addInKey
    Write-Host "PowerPoint add-in registration: OK $($addIn.Manifest)"
    $result.checks.powerPointAddInRegistration = [ordered]@{ ok = $true; manifest = $addIn.Manifest; loadBehavior = $addIn.LoadBehavior }
} else {
    Write-Warning (U "PowerPoint \u63d2\u4ef6\u6ce8\u518c\uff1a\u672a\u68c0\u6d4b\u5230")
    $result.checks.powerPointAddInRegistration = [ordered]@{ ok = $false; remediation = "Run scripts\\install.ps1." }
}

$diagnosticsDir = Join-Path (Get-Location) "diagnostics"
New-Item -ItemType Directory -Force $diagnosticsDir | Out-Null
$jsonPath = Join-Path $diagnosticsDir "latest.json"
[System.IO.File]::WriteAllText($jsonPath, ($result | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
Write-Host ((U "\u8bca\u65ad JSON\uff1a") + $jsonPath)
Write-Host (U "\u8bca\u65ad\u5b8c\u6210")
