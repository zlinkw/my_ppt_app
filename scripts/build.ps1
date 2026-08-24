Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
. (Join-Path $PSScriptRoot "installer-version.ps1")

function Invoke-Checked {
    param(
        [scriptblock]$Command,
        [string]$Name
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Generating AutoShape catalog"
Invoke-Checked { powershell -ExecutionPolicy Bypass -File scripts\generate-autoshape-catalog.ps1 } "generate-autoshape-catalog"

Write-Host "Installing npm dependencies if needed"
if (-not (Test-Path "node_modules")) {
    Invoke-Checked { npm install } "npm install"
}

Write-Host "Running asset tests"
Invoke-Checked { npm test } "npm test"

Write-Host "Preparing UI assets"
Invoke-Checked { npm run build:ui } "npm run build:ui"

$msbuild = Get-Command msbuild -ErrorAction SilentlyContinue
if (-not $msbuild) {
    $msbuildPath = Get-ChildItem "C:\Program Files\Microsoft Visual Studio", "C:\Program Files (x86)\Microsoft Visual Studio" -Recurse -Filter MSBuild.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
} else {
    $msbuildPath = $msbuild.Source
}

if (-not $msbuildPath) {
    powershell -ExecutionPolicy Bypass -File scripts\diagnose.ps1
    throw "MSBuild not found. Install Visual Studio Build Tools with Office/VSTO workload, then rerun scripts\build.ps1."
}

$certificateSubject = "CN=RoughPptAddin Dev"
$certificateStore = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::My,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
)
$certificateStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
$signingCertificate = $certificateStore.Certificates |
    Where-Object { $_.Subject -eq $certificateSubject -and $_.HasPrivateKey -and $_.NotAfter -gt [DateTime]::Now } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
$certificateStore.Close()
if (-not $signingCertificate) {
    $signingCertificate = New-SelfSignedCertificate -Type CodeSigningCert -Subject $certificateSubject -CertStoreLocation Cert:\CurrentUser\My
}

Write-Host "Building VSTO add-in"
Invoke-Checked {
    & $msbuildPath RoughPptAddin.sln /t:Rebuild /p:Configuration=Release /p:LangVersion=latest /p:SignManifests=true /p:ManifestCertificateThumbprint=$($signingCertificate.Thumbprint) /m
} "MSBuild Rebuild"

Write-Host "Verifying compiled Ribbon icons"
Invoke-Checked { powershell -ExecutionPolicy Bypass -File scripts\verify-ribbon-icons.ps1 } "verify-ribbon-icons"

New-Item -ItemType Directory -Force publish | Out-Null
Copy-Item -Recurse -Force src\RoughPptAddin\bin\Release\* publish\

$commitCountText = (& git rev-list --count HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commitCountText -notmatch "^\d+$") {
    throw "Unable to derive local build version from Git history."
}

$packageInfo = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json
$statusText = (& git status --porcelain | Out-String).Trim()
$buildInfo = [ordered]@{
    name = $packageInfo.name
    version = Resolve-InstallerProductVersion -PackageJsonPath (Join-Path $root "package.json") -CommitCount ([int]$commitCountText)
    commit = (& git rev-parse --short=12 HEAD).Trim()
    branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    dirty = -not [string]::IsNullOrWhiteSpace($statusText)
    builtAtUtc = [DateTime]::UtcNow.ToString("o")
    source = "local-build"
}
$buildInfoJson = $buildInfo | ConvertTo-Json -Depth 3
foreach ($relativeTarget in @(
    "src\RoughPptAddin\bin\Release\ui\build-info.json",
    "publish\ui\build-info.json"
)) {
    $targetPath = Join-Path $root $relativeTarget
    New-Item -ItemType Directory -Force (Split-Path -Parent $targetPath) | Out-Null
    [IO.File]::WriteAllText($targetPath, $buildInfoJson, [Text.UTF8Encoding]::new($false))
}

Write-Host "Build staged in publish/"
