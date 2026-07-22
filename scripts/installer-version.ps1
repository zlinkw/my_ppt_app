function Resolve-InstallerProductVersion {
    param(
        [Parameter(Mandatory = $true)][string]$PackageJsonPath,
        [Parameter(Mandatory = $true)][int]$CommitCount
    )

    if ($CommitCount -lt 1) {
        throw "CommitCount must be at least 1."
    }

    $metadata = Get-Content -LiteralPath $PackageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$metadata.installerVersionBaseline)) {
        throw "package.json must define installerVersionBaseline."
    }

    $baseline = [Version]$metadata.installerVersionBaseline
    if ($baseline.Build -lt 0 -or $baseline.Build -ge 65535) {
        throw "installerVersionBaseline build must be between 0 and 65534."
    }

    $build = [Math]::Min(65535, [long]$baseline.Build + $CommitCount)
    return "$($baseline.Major).$($baseline.Minor).$build"
}
