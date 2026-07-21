Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $PSScriptRoot "install-payload-core.ps1")

function Assert-Contract {
    param(
        [Parameter(Mandatory = $true, Position = 0)][bool]$Condition,
        [Parameter(Mandatory = $true, Position = 1)][string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Write-TestFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $parent = [System.IO.Path]::GetDirectoryName($Path)
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function New-TestPayload {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Version
    )
    foreach ($relativePath in @(
        "RoughPptAddin.vsto",
        "RoughPptAddin.dll",
        "ui\index.html",
        "ui\app.mjs",
        "ui\help.html",
        "ui\help.mjs",
        "ui\build-info.json"
    )) {
        Write-TestFile -Path (Join-Path $Path $relativePath) -Content "${Version}::$relativePath"
    }
}

function Assert-PayloadVersion {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Version
    )
    $content = [System.IO.File]::ReadAllText((Join-Path $Path "RoughPptAddin.dll"))
    Assert-Contract -Condition ($content.StartsWith("${Version}::")) -Message "Payload version mismatch: expected=$Version actual=$content"
}

function Assert-NoTransactionResidue {
    param([Parameter(Mandatory = $true)][object]$Paths)
    Assert-Contract -Condition (-not (Test-Path -LiteralPath $Paths.Staging)) -Message "Staging directory was not removed: $($Paths.Staging)"
    Assert-Contract -Condition (-not (Test-Path -LiteralPath $Paths.Backup)) -Message "Rollback directory was not removed: $($Paths.Backup)"
    Assert-Contract -Condition (-not (Test-Path -LiteralPath $Paths.Marker)) -Message "Transaction marker was not removed: $($Paths.Marker)"
}

$testRoot = Join-Path $env:TEMP ("RoughPptInstallContract-" + [guid]::NewGuid().ToString("N"))
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd("\")
$resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
if (-not $resolvedTestRoot.StartsWith($resolvedTemp + "\RoughPptInstallContract-", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe transaction test directory rejected: $resolvedTestRoot"
}

try {
    $localAppDataRoot = Join-Path $testRoot "LocalAppData"
    $installRoot = Join-Path $localAppDataRoot "RoughPptAddin"
    $sourceV1 = Join-Path $testRoot "source-v1"
    $sourceV2 = Join-Path $testRoot "source-v2"
    $sourceBroken = Join-Path $testRoot "source-broken"
    New-TestPayload -Path $sourceV1 -Version "v1"
    New-TestPayload -Path $sourceV2 -Version "v2"
    Write-TestFile -Path (Join-Path $sourceBroken "RoughPptAddin.vsto") -Content "broken"

    $preserved = [ordered]@{
        "WebView2\Default\Local Storage\leveldb\000003.log" = "webview-state"
        "logs\addin.log" = "diagnostic-log"
        "feature-block-default.json" = '{"countX":7}'
        "automation.json" = '{"schemaVersion":1}'
        "automation.token" = "secret-token"
        "custom-user-config.json" = '{"keep":true}'
    }
    foreach ($entry in $preserved.GetEnumerator()) {
        Write-TestFile -Path (Join-Path $installRoot $entry.Key) -Content $entry.Value
    }
    $documentsRoot = Join-Path $testRoot "Documents\RoughPptAddin"
    $preservedDocuments = [ordered]@{
        "assets\templates\saved-asset.pptx" = "saved-native-asset"
        "assets\thumbnails\saved-asset.png" = "saved-thumbnail"
        "palettes\schemes\saved-palette.json" = '{"name":"saved palette"}'
        "paper-structures\saved-preset.json" = '{"name":"saved preset"}'
    }
    foreach ($entry in $preservedDocuments.GetEnumerator()) {
        Write-TestFile -Path (Join-Path $documentsRoot $entry.Key) -Content $entry.Value
    }

    $first = Start-RoughPayloadTransaction -SourcePublish $sourceV1 -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Assert-Contract -Condition (-not $first.HadCurrent) -Message "First install unexpectedly reported an existing payload."
    Assert-PayloadVersion -Path $first.Live -Version "v1"
    Complete-RoughPayloadTransaction -Paths $first
    Assert-NoTransactionResidue -Paths $first
    Write-TestFile -Path (Join-Path $first.Live "obsolete.txt") -Content "old-only"

    $replacement = Start-RoughPayloadTransaction -SourcePublish $sourceV2 -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Assert-Contract -Condition $replacement.HadCurrent -Message "Replacement did not detect the existing payload."
    Assert-PayloadVersion -Path $replacement.Live -Version "v2"
    Assert-Contract -Condition (-not (Test-Path -LiteralPath (Join-Path $replacement.Live "obsolete.txt"))) -Message "Replacement payload contains an obsolete file."
    Assert-Contract -Condition (Test-Path -LiteralPath (Join-Path $replacement.Backup "obsolete.txt")) -Message "Rollback payload was not retained during replacement."
    Undo-RoughPayloadTransaction -Paths $replacement
    Assert-PayloadVersion -Path $replacement.Live -Version "v1"
    Assert-Contract -Condition (Test-Path -LiteralPath (Join-Path $replacement.Live "obsolete.txt")) -Message "Rollback did not fully restore the previous payload."
    Assert-NoTransactionResidue -Paths $replacement

    $brokenRejected = $false
    try {
        Start-RoughPayloadTransaction -SourcePublish $sourceBroken -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot | Out-Null
    } catch {
        $brokenRejected = $true
    }
    Assert-Contract -Condition $brokenRejected -Message "An incomplete payload was not rejected."
    Assert-PayloadVersion -Path (Join-Path $installRoot "publish") -Version "v1"

    $customPathRejected = $false
    try {
        Get-RoughPayloadTransactionPaths -InstallRoot (Join-Path $localAppDataRoot "CustomInstall") -LocalAppDataRoot $localAppDataRoot | Out-Null
    } catch {
        $customPathRejected = $true
    }
    Assert-Contract -Condition $customPathRejected -Message "A custom install directory was not rejected."

    $success = Start-RoughPayloadTransaction -SourcePublish $sourceV2 -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Complete-RoughPayloadTransaction -Paths $success
    Assert-PayloadVersion -Path $success.Live -Version "v2"
    Assert-Contract -Condition (-not (Test-Path -LiteralPath (Join-Path $success.Live "obsolete.txt"))) -Message "Successful replacement retained an obsolete payload file."
    Assert-NoTransactionResidue -Paths $success

    $interrupted = Start-RoughPayloadTransaction -SourcePublish $sourceV1 -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Assert-PayloadVersion -Path $interrupted.Live -Version "v1"
    $recoveryPaths = Get-RoughPayloadTransactionPaths -InstallRoot $installRoot -LocalAppDataRoot $localAppDataRoot
    Restore-RoughInterruptedPayloadTransaction -Paths $recoveryPaths
    Assert-PayloadVersion -Path $recoveryPaths.Live -Version "v2"
    Assert-NoTransactionResidue -Paths $recoveryPaths

    foreach ($entry in $preserved.GetEnumerator()) {
        $path = Join-Path $installRoot $entry.Key
        Assert-Contract -Condition (Test-Path -LiteralPath $path -PathType Leaf) -Message "User data was removed: $($entry.Key)"
        Assert-Contract -Condition ([System.IO.File]::ReadAllText($path) -eq $entry.Value) -Message "User data was modified: $($entry.Key)"
    }
    foreach ($entry in $preservedDocuments.GetEnumerator()) {
        $path = Join-Path $documentsRoot $entry.Key
        Assert-Contract -Condition (Test-Path -LiteralPath $path -PathType Leaf) -Message "Saved material or palette was removed: $($entry.Key)"
        Assert-Contract -Condition ([System.IO.File]::ReadAllText($path) -eq $entry.Value) -Message "Saved material or palette was modified: $($entry.Key)"
    }

    $firstLocalAppDataRoot = Join-Path $testRoot "FirstInstallLocalAppData"
    $firstInstallRoot = Join-Path $firstLocalAppDataRoot "RoughPptAddin"
    $firstFailure = Start-RoughPayloadTransaction -SourcePublish $sourceV1 -InstallRoot $firstInstallRoot -LocalAppDataRoot $firstLocalAppDataRoot
    Undo-RoughPayloadTransaction -Paths $firstFailure
    Assert-Contract -Condition (-not (Test-Path -LiteralPath $firstFailure.Live)) -Message "Failed first install retained an active payload."
    Assert-NoTransactionResidue -Paths $firstFailure

    $firstInterrupted = Start-RoughPayloadTransaction -SourcePublish $sourceV1 -InstallRoot $firstInstallRoot -LocalAppDataRoot $firstLocalAppDataRoot
    $firstRecoveryPaths = Get-RoughPayloadTransactionPaths -InstallRoot $firstInstallRoot -LocalAppDataRoot $firstLocalAppDataRoot
    Restore-RoughInterruptedPayloadTransaction -Paths $firstRecoveryPaths
    Assert-Contract -Condition (-not (Test-Path -LiteralPath $firstInterrupted.Live)) -Message "Interrupted first install retained an unregistered payload."
    Assert-NoTransactionResidue -Paths $firstRecoveryPaths

    Write-Host "installer payload transaction ok"
} finally {
    if (Test-Path -LiteralPath $resolvedTestRoot) {
        Write-Warning "测试目录已保留，避免永久删除：$resolvedTestRoot"
    }
}
