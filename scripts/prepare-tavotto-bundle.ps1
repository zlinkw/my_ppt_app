param([Parameter(Mandatory = $true)][string]$Destination)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$lock = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'tavotto-bundle.lock.json') | ConvertFrom-Json
$cache = Join-Path $root ('.tools\tavotto\' + $lock.tag)
$extractorCache = Join-Path $root ('.tools\7zip\' + $lock.extractor.version)
[IO.Directory]::CreateDirectory($cache) | Out-Null
[IO.Directory]::CreateDirectory($extractorCache) | Out-Null

function Get-PinnedAsset([object]$Asset, [string]$Directory) {
    $path = Join-Path $Directory $Asset.name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Invoke-WebRequest -Uri $Asset.url -OutFile $path
    }
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if (-not [string]::Equals($hash, $Asset.sha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Pinned asset SHA256 mismatch: $path"
    }
    return $path
}

$setup = Get-PinnedAsset $lock.assets[0] $cache
$source = Get-PinnedAsset $lock.assets[1] $cache
$license = Get-PinnedAsset $lock.assets[2] $cache
$converterCache = Join-Path $cache 'converter-cache'
[IO.Directory]::CreateDirectory($converterCache) | Out-Null
$converterWheel = Get-PinnedAsset $lock.converter.wheel $converterCache
$converterSource = Get-PinnedAsset $lock.converter.source $converterCache
$bootstrap = Get-PinnedAsset $lock.extractor.bootstrap $extractorCache
$extractorPackage = Get-PinnedAsset $lock.extractor.package $extractorCache
$extractorBin = Join-Path $extractorCache 'full'
$sevenZip = Join-Path $extractorBin '7z.exe'
$sevenDll = Join-Path $extractorBin '7z.dll'
if (-not ((Test-Path -LiteralPath $sevenZip -PathType Leaf) -and (Test-Path -LiteralPath $sevenDll -PathType Leaf))) {
    [IO.Directory]::CreateDirectory($extractorBin) | Out-Null
    & $bootstrap e $extractorPackage '7z.exe' '7z.dll' "-o$extractorBin" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '7-Zip extractor bootstrap failed.' }
}

$destinationPath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationPath) { throw "Tavotto bundle destination already exists: $destinationPath" }
[IO.Directory]::CreateDirectory($destinationPath) | Out-Null
& $sevenZip x $setup 'Tavotto.exe' 'LICENSE' 'sidecar\Tavotto\*' "-o$destinationPath" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Tavotto NSIS payload extraction failed.' }
$cli = Join-Path $destinationPath 'sidecar\Tavotto\tavotto-cli.exe'
$desktop = Join-Path $destinationPath 'Tavotto.exe'
if (-not ((Test-Path -LiteralPath $cli -PathType Leaf) -and (Test-Path -LiteralPath $desktop -PathType Leaf))) {
    throw 'Tavotto package lacks desktop or console CLI.'
}
$previousConfigDir = [Environment]::GetEnvironmentVariable('TAVOTTO_CONFIG_DIR')
$previousUpdateCheck = [Environment]::GetEnvironmentVariable('TAVOTTO_NO_UPDATE_CHECK')
$env:TAVOTTO_CONFIG_DIR = Join-Path $cache 'doctor-config'
$env:TAVOTTO_NO_UPDATE_CHECK = '1'
try {
    $doctorText = & $cli doctor --json
    if ($LASTEXITCODE -ne 0) { throw 'Bundled Tavotto doctor failed.' }
    $doctor = $doctorText | ConvertFrom-Json
    if (-not $doctor.ok -or $doctor.protocol -ne $lock.protocol -or $doctor.version -ne $lock.version) {
        throw 'Bundled Tavotto version or handoff protocol mismatch.'
    }
}
finally {
    [Environment]::SetEnvironmentVariable('TAVOTTO_CONFIG_DIR', $previousConfigDir)
    [Environment]::SetEnvironmentVariable('TAVOTTO_NO_UPDATE_CHECK', $previousUpdateCheck)
}
[IO.Directory]::CreateDirectory((Join-Path $destinationPath 'source')) | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $destinationPath 'source\tavotto-v0.15.0-full-source.tar.gz')
Copy-Item -LiteralPath $license -Destination (Join-Path $destinationPath 'source\LICENSE')
$converterRoot = Join-Path $destinationPath 'converter'
$converterPackages = Join-Path $converterRoot 'site-packages'
[IO.Directory]::CreateDirectory($converterPackages) | Out-Null
[IO.Compression.ZipFile]::ExtractToDirectory($converterWheel, $converterPackages)
$converterScript = Join-Path $converterRoot 'tavotto-vector-converter.py'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'tavotto-vector-converter.py') -Destination $converterScript
Copy-Item -LiteralPath $converterSource -Destination (Join-Path $destinationPath 'source\pymupdf-1.28.2.tar.gz')
$runtimePython = Join-Path $destinationPath 'sidecar\Tavotto\_internal\runtime\python.exe'
if (-not (Test-Path -LiteralPath $runtimePython -PathType Leaf)) { throw 'Tavotto bundled Python runtime is missing.' }
& $runtimePython $converterScript --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bundled Tavotto vector converter is unavailable.' }
$bundleInfo = [ordered]@{
    version = $lock.version
    tag = $lock.tag
    commit = $lock.commit
    protocol = $lock.protocol
    setupSha256 = $lock.assets[0].sha256
    cliSha256 = (Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash.ToLowerInvariant()
    desktopSha256 = (Get-FileHash -LiteralPath $desktop -Algorithm SHA256).Hash.ToLowerInvariant()
    sourceSha256 = $lock.assets[1].sha256
    sourceUrl = $lock.assets[1].url
    license = 'AGPL-3.0-only'
    converterVersion = $lock.converter.version
    converterWheelSha256 = $lock.converter.wheel.sha256
    converterSourceSha256 = $lock.converter.source.sha256
    converterScriptSha256 = (Get-FileHash -LiteralPath $converterScript -Algorithm SHA256).Hash.ToLowerInvariant()
    converterNativeSha256 = (Get-FileHash -LiteralPath (Join-Path $converterPackages 'pymupdf\_mupdf.pyd') -Algorithm SHA256).Hash.ToLowerInvariant()
}
[IO.File]::WriteAllText((Join-Path $destinationPath 'bundle.json'), ($bundleInfo | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
Write-Host "TavottoBundle=$destinationPath;Version=$($lock.version)"
