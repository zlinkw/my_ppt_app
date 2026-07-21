param(
    [switch]$ConfirmCompleteRemoval
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$upgradeCode = "{8A0FEC41-54B6-40E9-9F4E-43A5273123E8}"
$certificateSubject = "CN=RoughPptAddin Dev"

if (-not $ConfirmCompleteRemoval) {
    throw "彻底卸载会永久删除 Rough 插件的本机配置、素材、缩略图、配色、预设和导出。请通过 Complete-Uninstall-RoughPptAddin.cmd 运行，或显式传入 -ConfirmCompleteRemoval。"
}

if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
    throw "PowerPoint 正在运行。请先保存演示文稿并手动关闭 PowerPoint，再重新运行彻底卸载；脚本不会自动关闭 PowerPoint。"
}

function Remove-FixedDirectory {
    param(
        [string]$Path,
        [string]$ExpectedPath,
        [string]$Label
    )

    $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
    $expected = [System.IO.Path]::GetFullPath($ExpectedPath).TrimEnd("\")
    if (-not [string]::Equals($resolved, $expected, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "拒绝删除非固定路径：$resolved"
    }
    if (-not (Test-Path -LiteralPath $resolved)) {
        Write-Host "未找到${Label}：$resolved"
        return
    }

    $item = Get-Item -LiteralPath $resolved -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "拒绝删除链接或目录联接：$resolved"
    }

    Remove-Item -LiteralPath $resolved -Recurse -Force
    Write-Host "已删除${Label}：$resolved"
}

$baseUninstall = Join-Path $PSScriptRoot "uninstall.ps1"
if (-not (Test-Path -LiteralPath $baseUninstall -PathType Leaf)) {
    throw "彻底卸载包缺少基础卸载脚本：$baseUninstall"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $baseUninstall -PurgeUserData
if ($LASTEXITCODE -ne 0) {
    throw "基础卸载失败，退出码：$LASTEXITCODE"
}

$installer = New-Object -ComObject WindowsInstaller.Installer
$relatedProducts = @($installer.RelatedProducts($upgradeCode))
foreach ($productCode in $relatedProducts) {
    $process = Start-Process -FilePath "$env:WINDIR\System32\msiexec.exe" `
        -ArgumentList @("/x", [string]$productCode, "/qn", "/norestart") `
        -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -notin @(0, 1605, 1614, 3010)) {
        throw "移除 Rough MSI 产品注册失败：$productCode，退出码：$($process.ExitCode)"
    }
    Write-Host "已移除 Rough MSI 产品注册：$productCode"
}

foreach ($registryPath in @(
    "HKCU:\Software\Microsoft\Office\PowerPoint\Addins\RoughPptAddin",
    "HKCU:\Software\RoughPptAddin\Installer"
)) {
    if (Test-Path -LiteralPath $registryPath) {
        Remove-Item -LiteralPath $registryPath -Recurse -Force
        Write-Host "已清除注册表项：$registryPath"
    }
}

$localAppDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$documentsBase = [Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)
$localStateRoot = Join-Path $localAppDataRoot "RoughPptAddin"
$documentsRoot = Join-Path $documentsBase "RoughPptAddin"
$installerPayloadRoot = Join-Path $localAppDataRoot "RoughPptAddinInstaller"
Remove-FixedDirectory -Path $localStateRoot -ExpectedPath (Join-Path $localAppDataRoot "RoughPptAddin") -Label "插件本机状态库"
Remove-FixedDirectory -Path $documentsRoot -ExpectedPath (Join-Path $documentsBase "RoughPptAddin") -Label "插件素材与配色库"
Remove-FixedDirectory -Path $installerPayloadRoot -ExpectedPath (Join-Path $localAppDataRoot "RoughPptAddinInstaller") -Label "安装器缓存"

foreach ($store in @("Cert:\CurrentUser\TrustedPublisher", "Cert:\CurrentUser\Root", "Cert:\CurrentUser\My")) {
    Get-ChildItem $store -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -eq $certificateSubject } |
        ForEach-Object {
            $thumbprint = $_.Thumbprint
            Remove-Item -LiteralPath $_.PSPath -Force
            Write-Host "已移除插件专用证书：$store\$thumbprint"
        }
}

$tempPrefixes = @(
    "RoughPptAddinSetup-",
    "RoughPptAddinMsiInstall-",
    "RoughPptAssetExport-",
    "RoughPptAssetImport-",
    "RoughPptPaletteExport-",
    "RoughPptPaletteImport-"
)
foreach ($directory in Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Directory -Force -ErrorAction SilentlyContinue) {
    if (-not ($tempPrefixes | Where-Object { $directory.Name.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) })) {
        continue
    }
    try {
        if (($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
            Remove-Item -LiteralPath $directory.FullName -Recurse -Force
            Write-Host "已删除临时目录：$($directory.FullName)"
        }
    }
    catch {
        Write-Warning "临时目录未能删除：$($directory.FullName)；$($_.Exception.Message)"
    }
}

Write-Host "彻底卸载完成。已保留 Zotero 共享论文图像库 %LOCALAPPDATA%\ZLK\paper-image-library，以及系统级 WebView2、VSTO 和 .NET Framework 运行时。"
