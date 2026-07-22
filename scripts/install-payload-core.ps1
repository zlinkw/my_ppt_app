Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:RoughPayloadDirectoryName = "publish"
$script:RoughPayloadStagingName = "publish.installing"
$script:RoughPayloadBackupName = "publish.rollback"
$script:RoughPayloadTransactionName = "install-transaction.json"
$script:RoughPayloadRemovalAction = $null
$script:RoughPreservedLocalData = @(
    "WebView2",
    "logs",
    "feature-block-default.json",
    "automation.json",
    "automation.token"
)

function Get-RoughCanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
}

function Assert-RoughDirectChildPath {
    param(
        [Parameter(Mandatory = $true)][string]$InstallRoot,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $root = Get-RoughCanonicalPath $InstallRoot
    $candidate = Get-RoughCanonicalPath $Path
    $parent = Get-RoughCanonicalPath ([System.IO.Path]::GetDirectoryName($candidate))
    if (-not [string]::Equals($root, $parent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "拒绝操作默认安装目录之外的路径：$candidate"
    }
}

function Assert-RoughNotReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "默认安装目录不能是符号链接或目录联接：$Path"
    }
}

function Get-RoughPayloadTransactionPaths {
    param(
        [Parameter(Mandatory = $true)][string]$InstallRoot,
        [Parameter(Mandatory = $true)][string]$LocalAppDataRoot
    )

    $expectedRoot = Get-RoughCanonicalPath (Join-Path $LocalAppDataRoot "RoughPptAddin")
    $actualRoot = Get-RoughCanonicalPath $InstallRoot
    if (-not [string]::Equals($expectedRoot, $actualRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "安装目录已锁定为 $expectedRoot，拒绝使用其它目录：$actualRoot"
    }

    Assert-RoughNotReparsePoint $actualRoot
    $paths = [pscustomobject]@{
        InstallRoot = $actualRoot
        Live = Join-Path $actualRoot $script:RoughPayloadDirectoryName
        Staging = Join-Path $actualRoot $script:RoughPayloadStagingName
        Backup = Join-Path $actualRoot $script:RoughPayloadBackupName
        Marker = Join-Path $actualRoot $script:RoughPayloadTransactionName
        HadCurrent = $false
    }
    foreach ($path in @($paths.Live, $paths.Staging, $paths.Backup, $paths.Marker)) {
        Assert-RoughDirectChildPath -InstallRoot $actualRoot -Path $path
    }
    return $paths
}

function Remove-RoughPayloadDirectory {
    param(
        [Parameter(Mandatory = $true)][object]$Paths,
        [Parameter(Mandatory = $true)][string]$Path
    )
    Assert-RoughDirectChildPath -InstallRoot $Paths.InstallRoot -Path $Path
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    Assert-RoughNotReparsePoint $Path
    Invoke-RoughPayloadRemoval -Path $Path -Recurse
}

function Invoke-RoughPayloadRemoval {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$Recurse
    )

    if ($script:RoughPayloadRemovalAction) {
        & $script:RoughPayloadRemovalAction $Path ([bool]$Recurse)
        return
    }
    if ($Recurse) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    else {
        Remove-Item -LiteralPath $Path -Force
    }
}

function Assert-RoughPublishPayload {
    param([Parameter(Mandatory = $true)][string]$PublishDirectory)

    Assert-RoughNotReparsePoint $PublishDirectory
    foreach ($relativePath in @(
        "RoughPptAddin.vsto",
        "RoughPptAddin.dll",
        "ui\index.html",
        "ui\app.mjs",
        "ui\help.html",
        "ui\help.mjs",
        "ui\build-info.json"
    )) {
        $path = Join-Path $PublishDirectory $relativePath
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "安装本体不完整，缺少文件：$relativePath"
        }
        if ((Get-Item -LiteralPath $path).Length -le 0) {
            throw "安装本体包含空文件：$relativePath"
        }
    }
}

function Restore-RoughInterruptedPayloadTransaction {
    param([Parameter(Mandatory = $true)][object]$Paths)

    foreach ($path in @($Paths.Live, $Paths.Staging, $Paths.Backup, $Paths.Marker)) {
        Assert-RoughNotReparsePoint $path
    }

    if (Test-Path -LiteralPath $Paths.Marker) {
        try {
            $transaction = Get-Content -Raw -Encoding UTF8 -LiteralPath $Paths.Marker | ConvertFrom-Json
            if ($transaction.schemaVersion -ne 1 -or $transaction.hadCurrent -isnot [bool]) {
                throw "unsupported marker"
            }
        } catch {
            throw "安装事务标记损坏，已停止自动替换以保护现有本体：$($Paths.Marker)"
        }

        if (Test-Path -LiteralPath $Paths.Backup) {
            Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Live
            Move-Item -LiteralPath $Paths.Backup -Destination $Paths.Live
        } elseif (-not $transaction.hadCurrent) {
            Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Live
        }
        Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Staging
        Invoke-RoughPayloadRemoval -Path $Paths.Marker
        return
    }

    Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Staging
    if (Test-Path -LiteralPath $Paths.Backup) {
        if (Test-Path -LiteralPath $Paths.Live) {
            Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Backup
        } else {
            Move-Item -LiteralPath $Paths.Backup -Destination $Paths.Live
        }
    }
}

function Undo-RoughPayloadTransaction {
    param([Parameter(Mandatory = $true)][object]$Paths)

    if (Test-Path -LiteralPath $Paths.Backup) {
        Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Live
        Move-Item -LiteralPath $Paths.Backup -Destination $Paths.Live
    } elseif (-not $Paths.HadCurrent) {
        Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Live
    }
    Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Staging
    if (Test-Path -LiteralPath $Paths.Marker) {
        Invoke-RoughPayloadRemoval -Path $Paths.Marker
    }
}

function Start-RoughPayloadTransaction {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePublish,
        [Parameter(Mandatory = $true)][string]$InstallRoot,
        [Parameter(Mandatory = $true)][string]$LocalAppDataRoot
    )

    $paths = Get-RoughPayloadTransactionPaths -InstallRoot $InstallRoot -LocalAppDataRoot $LocalAppDataRoot
    New-Item -ItemType Directory -Path $paths.InstallRoot -Force | Out-Null
    Assert-RoughNotReparsePoint $paths.InstallRoot
    Restore-RoughInterruptedPayloadTransaction -Paths $paths

    $source = Get-RoughCanonicalPath $SourcePublish
    if ([string]::Equals($source, $paths.Live, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "安装源不能与默认安装目录相同：$source"
    }
    Assert-RoughPublishPayload $source

    New-Item -ItemType Directory -Path $paths.Staging -Force | Out-Null
    Copy-Item -Path (Join-Path $source "*") -Destination $paths.Staging -Recurse -Force
    Assert-RoughPublishPayload $paths.Staging

    $paths.HadCurrent = Test-Path -LiteralPath $paths.Live
    $marker = [ordered]@{
        schemaVersion = 1
        hadCurrent = [bool]$paths.HadCurrent
        startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        liveDirectory = $script:RoughPayloadDirectoryName
        stagingDirectory = $script:RoughPayloadStagingName
        backupDirectory = $script:RoughPayloadBackupName
    } | ConvertTo-Json
    [System.IO.File]::WriteAllText($paths.Marker, $marker, [System.Text.UTF8Encoding]::new($false))

    try {
        if ($paths.HadCurrent) {
            Move-Item -LiteralPath $paths.Live -Destination $paths.Backup
        }
        Move-Item -LiteralPath $paths.Staging -Destination $paths.Live
        Assert-RoughPublishPayload $paths.Live
        return $paths
    } catch {
        Undo-RoughPayloadTransaction -Paths $paths
        throw
    }
}

function Complete-RoughPayloadTransaction {
    param([Parameter(Mandatory = $true)][object]$Paths)

    if (Test-Path -LiteralPath $Paths.Marker) {
        Invoke-RoughPayloadRemoval -Path $Paths.Marker
    }
    try {
        Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Backup
        Remove-RoughPayloadDirectory -Paths $Paths -Path $Paths.Staging
    } catch {
        Write-Warning "新版本已安装，但旧本体清理将在下次安装时重试：$($_.Exception.Message)"
    }
}
