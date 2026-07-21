param(
    [switch]$NoInstall,
    [switch]$SkipBuild,
    [switch]$SkipSmokes,
    [switch]$SkipInstallers,
    [switch]$KeepPowerPointOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function U {
    param([string]$Value)
    return [regex]::Replace($Value, "\\u([0-9A-Fa-f]{4})", {
        param($Match)
        [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
    })
}

function Invoke-CheckedScript {
    param(
        [string]$Path,
        [string[]]$Arguments = @()
    )

    & powershell -ExecutionPolicy Bypass -File $Path @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Path failed with exit code $LASTEXITCODE."
    }
}

function Wait-ForPowerPointToExit {
    for ($i = 0; $i -lt 30; $i++) {
        $process = Get-Process POWERPNT -ErrorAction SilentlyContinue
        if (-not $process) {
            return
        }

        try {
            $app = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
            if ($app.Presentations.Count -eq 0) {
                $app.Quit()
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    $process = Get-Process POWERPNT -ErrorAction SilentlyContinue
    if ($process) {
        throw (U "PowerPoint \u4ecd\u5728\u8fd0\u884c\u3002\u8bf7\u4fdd\u5b58\u5e76\u5173\u95ed PowerPoint \u540e\u91cd\u65b0\u5b89\u88c5\u3002")
    }
}

if (-not $SkipBuild) {
    Invoke-CheckedScript "scripts\build.ps1"
}

if (-not $SkipSmokes) {
    Invoke-CheckedScript "scripts\verify-native-all.ps1"
}

if ($SkipInstallers) {
    Invoke-CheckedScript "scripts\package.ps1" @("-SkipBuild")
    Invoke-CheckedScript "scripts\verify-deploy-package.ps1" @("-SkipInstallers")
}
else {
    Invoke-CheckedScript "scripts\package-installers.ps1" @("-SkipBuild")
    Invoke-CheckedScript "scripts\verify-deploy-package.ps1"
}

if ($NoInstall) {
    Write-Host (U "\u90e8\u7f72\u9a8c\u8bc1\u5b8c\u6210\uff0c\u672a\u5b89\u88c5\u3002")
    exit 0
}

Wait-ForPowerPointToExit
Invoke-CheckedScript "scripts\install.ps1" @("-SkipBuild", "-InstallPrereqs")

$keepOpen = if ($KeepPowerPointOpen) { "true" } else { "false" }
Invoke-CheckedScript "scripts\verify-powerpoint-load.ps1" @("-KeepOpen", $keepOpen)

Write-Host (U "\u90e8\u7f72\u5b8c\u6210\u3002")