param(
    [switch]$KeepFiles,
    [switch]$PurgeUserData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($KeepFiles -and $PurgeUserData) {
    throw "-KeepFiles 与 -PurgeUserData 不能同时使用。"
}

$payloadCore = Join-Path $PSScriptRoot "install-payload-core.ps1"
if (-not (Test-Path -LiteralPath $payloadCore -PathType Leaf)) {
    throw "卸载包缺少本体事务模块：$payloadCore"
}
. $payloadCore

function U {
    param([string]$Value)
    return [regex]::Replace($Value, "\\u([0-9A-Fa-f]{4})", {
        param($Match)
        [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
    })
}

$addInKey = "HKCU:\Software\Microsoft\Office\PowerPoint\Addins\RoughPptAddin"
if (Test-Path $addInKey) {
    Remove-Item -LiteralPath $addInKey -Recurse -Force
    Write-Host ((U "\u5df2\u79fb\u9664 PowerPoint \u63d2\u4ef6\u6ce8\u518c\u8868\u9879：") + $addInKey)
} else {
    Write-Host ((U "\u672a\u627e\u5230 PowerPoint \u63d2\u4ef6\u6ce8\u518c\u8868\u9879：") + $addInKey)
}

if (-not $KeepFiles) {
    $localAppDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    $installRoot = Join-Path $localAppDataRoot "RoughPptAddin"
    $paths = Get-RoughPayloadTransactionPaths -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Restore-RoughInterruptedPayloadTransaction -Paths $paths
    foreach ($path in @($paths.Live, $paths.Staging, $paths.Backup)) {
        Remove-RoughPayloadDirectory -Paths $paths -Path $path
    }
    if (Test-Path -LiteralPath $paths.Marker) {
        Remove-Item -LiteralPath $paths.Marker -Force
    }
    Write-Host ((U "\u5df2\u79fb\u9664\u672c\u673a\u5b89\u88c5\u672c\u4f53：") + $paths.Live)

    if ($PurgeUserData) {
        if (Test-Path -LiteralPath $installRoot) {
            Assert-RoughNotReparsePoint $installRoot
            Remove-Item -LiteralPath $installRoot -Recurse -Force
        }
        $documentsRoot = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)) "RoughPptAddin"
        if (Test-Path -LiteralPath $documentsRoot) {
            Assert-RoughNotReparsePoint $documentsRoot
            Remove-Item -LiteralPath $documentsRoot -Recurse -Force
        }
        Write-Host (U "\u5df2\u6309\u660e\u786e\u8bf7\u6c42\u6e05\u9664\u914d\u7f6e\u3001\u7d20\u6750\u3001\u914d\u8272\u548c\u65e5\u5fd7\u3002")
    } else {
        Write-Host (U "\u5df2\u4fdd\u7559\u914d\u7f6e\u3001\u7d20\u6750\u3001\u914d\u8272\u3001WebView2 \u6570\u636e\u548c\u65e5\u5fd7\u3002")
    }
}

Write-Host (U "\u5982\u63d2\u4ef6\u4ecd\u7559\u5728 ClickOnce \u5e94\u7528\u7f13\u5b58\u4e2d，\u8bf7\u5728 Windows \u8bbe\u7f6e > \u5e94\u7528 \u4e2d\u79fb\u9664\u3002")
