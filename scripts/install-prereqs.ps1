param(
    [switch]$RuntimeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$officialUrls = @{
    AppInstaller = "https://apps.microsoft.com/detail/9NBLGGH4NNS1"
    DotNet48 = "https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48"
    WebView2 = "https://developer.microsoft.com/microsoft-edge/webview2/"
    Vsto = "https://www.microsoft.com/download/details.aspx?id=48217"
    BuildTools = "https://visualstudio.microsoft.com/downloads/"
}

function U {
    param([string]$Value)
    return [regex]::Replace($Value, "\\u([0-9A-Fa-f]{4})", {
        param($Match)
        [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
    })
}

function Get-WebView2RuntimeVersion {
    $paths = @(
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    )
    foreach ($path in $paths) {
        $value = Get-ItemProperty -LiteralPath $path -Name pv -ErrorAction SilentlyContinue
        if ($value -and -not [string]::IsNullOrWhiteSpace([string]$value.pv) -and $value.pv -ne "0.0.0.0") {
            return [string]$value.pv
        }
    }
    return $null
}

function Get-VstoRuntimeVersion {
    $paths = @(
        "HKLM:\SOFTWARE\Microsoft\VSTO Runtime Setup\v4R",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VSTO Runtime Setup\v4R"
    )
    foreach ($path in $paths) {
        $value = Get-ItemProperty -LiteralPath $path -Name Version -ErrorAction SilentlyContinue
        if ($value -and -not [string]::IsNullOrWhiteSpace([string]$value.Version)) {
            return [string]$value.Version
        }
    }
    return $null
}

function Test-DotNetFramework48 {
    $value = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -Name Release -ErrorAction SilentlyContinue
    return [bool]($value -and [int]$value.Release -ge 528040)
}

function Open-OfficialPrerequisiteHelp {
    param(
        [string]$Uri,
        [string]$Label
    )

    $parsed = [Uri]$Uri
    $allowedHosts = @("apps.microsoft.com", "dotnet.microsoft.com", "developer.microsoft.com", "www.microsoft.com", "visualstudio.microsoft.com")
    if ($parsed.Scheme -ne "https" -or $allowedHosts -notcontains $parsed.Host.ToLowerInvariant()) {
        throw "拒绝打开非 Microsoft 官方前置组件地址：$Uri"
    }

    try {
        Start-Process -FilePath $parsed.AbsoluteUri
        Write-Host "已打开 Microsoft 官方${Label}安装页面：$($parsed.AbsoluteUri)"
    }
    catch {
        Write-Warning "无法自动打开${Label}安装页面，请手动访问：$($parsed.AbsoluteUri)"
    }
}

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$Label,
        [string]$HelpUrl,
        [string]$Override = ""
    )
    $arguments = @("install", "--id", $Id, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements")
    if (-not [string]::IsNullOrWhiteSpace($Override)) {
        $arguments += @("--override", $Override)
    }
    & winget @arguments
    if ($LASTEXITCODE -ne 0) {
        Open-OfficialPrerequisiteHelp -Uri $HelpUrl -Label $Label
        throw ((U "\u524d\u7f6e\u7ec4\u4ef6\u81ea\u52a8\u5b89\u88c5\u5931\u8d25\uff0c\u5df2\u6253\u5f00 Microsoft \u5b98\u65b9\u5b89\u88c5\u9875\uff1a") + $Label + " (" + $Id + ")")
    }
}

Write-Host (U "\u6b63\u5728\u68c0\u67e5 Rough PPT \u63d2\u4ef6\u524d\u7f6e\u7ec4\u4ef6\u3002")

$webView2Version = Get-WebView2RuntimeVersion
$vstoVersion = Get-VstoRuntimeVersion
$hasDotNet48 = Test-DotNetFramework48
$needsWebView2 = [string]::IsNullOrWhiteSpace($webView2Version)
$needsVsto = [string]::IsNullOrWhiteSpace($vstoVersion)
$needsBuildTools = -not $RuntimeOnly

if (-not $needsWebView2) { Write-Host "WebView2 Runtime: OK $webView2Version" }
if (-not $needsVsto) { Write-Host "VSTO Runtime: OK $vstoVersion" }
if ($hasDotNet48) { Write-Host ".NET Framework 4.8: OK" }

if (-not $hasDotNet48) {
    Open-OfficialPrerequisiteHelp -Uri $officialUrls.DotNet48 -Label ".NET Framework 4.8"
    throw (U "\u672a\u68c0\u6d4b\u5230 .NET Framework 4.8\uff0c\u5df2\u6253\u5f00 Microsoft \u5b98\u65b9\u5b89\u88c5\u9875\u3002\u5b89\u88c5\u5b8c\u6210\u540e\u8bf7\u91cd\u65b0\u8fd0\u884c Rough \u5b89\u88c5\u5305\u3002")
}

if ($needsWebView2 -or $needsVsto -or $needsBuildTools) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Open-OfficialPrerequisiteHelp -Uri $officialUrls.AppInstaller -Label "App Installer"
        if ($needsWebView2) { Open-OfficialPrerequisiteHelp -Uri $officialUrls.WebView2 -Label "WebView2 Runtime" }
        if ($needsVsto) { Open-OfficialPrerequisiteHelp -Uri $officialUrls.Vsto -Label "VSTO Runtime" }
        if ($needsBuildTools) { Open-OfficialPrerequisiteHelp -Uri $officialUrls.BuildTools -Label "Visual Studio Build Tools" }
        throw (U "\u7cfb\u7edf\u7f3a\u5c11\u524d\u7f6e\u7ec4\u4ef6\u4e14\u672a\u627e\u5230 winget\uff0c\u5df2\u6253\u5f00 Microsoft \u5b98\u65b9\u5b89\u88c5\u9875\u3002\u8bf7\u8865\u9f50\u540e\u91cd\u65b0\u8fd0\u884c Rough \u5b89\u88c5\u5305\u3002")
    }
}

if ($needsWebView2) {
    Install-WingetPackage "Microsoft.EdgeWebView2Runtime" "Microsoft Edge WebView2 Runtime" $officialUrls.WebView2
}
if ($needsVsto) {
    Install-WingetPackage "Microsoft.VSTOR" "Visual Studio Tools for Office Runtime" $officialUrls.Vsto
}
if ($needsBuildTools) {
    Install-WingetPackage "Microsoft.VisualStudio.2022.BuildTools" "Visual Studio Build Tools 2022" $officialUrls.BuildTools "--wait --quiet --add Microsoft.VisualStudio.Workload.OfficeBuildTools --add Microsoft.Net.Component.4.8.SDK --add Microsoft.Net.Component.4.8.TargetingPack --includeRecommended --norestart"
}

$webView2Version = Get-WebView2RuntimeVersion
$vstoVersion = Get-VstoRuntimeVersion
if ([string]::IsNullOrWhiteSpace($webView2Version) -or [string]::IsNullOrWhiteSpace($vstoVersion)) {
    if ([string]::IsNullOrWhiteSpace($webView2Version)) { Open-OfficialPrerequisiteHelp -Uri $officialUrls.WebView2 -Label "WebView2 Runtime" }
    if ([string]::IsNullOrWhiteSpace($vstoVersion)) { Open-OfficialPrerequisiteHelp -Uri $officialUrls.Vsto -Label "VSTO Runtime" }
    throw (U "\u524d\u7f6e\u7ec4\u4ef6\u5b89\u88c5\u540e\u4ecd\u672a\u68c0\u6d4b\u5230 WebView2 \u6216 VSTO Runtime\uff0c\u5df2\u6253\u5f00 Microsoft \u5b98\u65b9\u5b89\u88c5\u9875\u3002\u8bf7\u5b89\u88c5\u6216\u91cd\u542f Windows \u540e\u91cd\u65b0\u8fd0\u884c Rough \u5b89\u88c5\u5305\u3002")
}

if ($RuntimeOnly) {
    Write-Host (U "\u8fd0\u884c\u65f6\u524d\u7f6e\u7ec4\u4ef6\u5df2\u5c31\u7eea\u3002\u5982 VSTO \u8981\u6c42\u91cd\u542f\uff0c\u8bf7\u91cd\u542f\u540e\u518d\u8fd0\u884c scripts\\diagnose.ps1\u3002")
} else {
    Write-Host (U "\u5f00\u53d1\u4e0e\u8fd0\u884c\u524d\u7f6e\u7ec4\u4ef6\u5df2\u5c31\u7eea\u3002\u5982 Build Tools \u6216 VSTO \u8981\u6c42\u91cd\u542f\uff0c\u8bf7\u91cd\u542f\u540e\u518d\u8fd0\u884c scripts\\diagnose.ps1\u3002")
}
