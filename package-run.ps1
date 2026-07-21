$ErrorActionPreference = "Stop"
$root = "D:\GitRepo\my_ppt_app"
Set-Location $root
$log = Join-Path $root "package-run.out.log"
$exitFile = Join-Path $root "package-run.exit"
function Log($m) {
  $line = ("[{0}] {1}" -f (Get-Date -Format o), $m)
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
try {
  Get-Process -Name node,msedge,MSBuild,dotnet,candle,light,iexpress -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Log "start package pipeline"
  node scripts/build-ui.mjs
  if ($LASTEXITCODE -ne 0) { throw "build-ui failed $LASTEXITCODE" }
  Log "build-ui ok"
  node scripts/sync-ui-output.mjs
  if ($LASTEXITCODE -ne 0) { throw "sync-ui failed $LASTEXITCODE" }
  Log "sync-ui ok"
  node scripts/validate-local-ui-assets.mjs --publish
  if ($LASTEXITCODE -ne 0) { throw "validate local ui failed $LASTEXITCODE" }
  $msbuild = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
  $thumb = "34B02F7625CE1F8B091A7DA88DD2F04ABB90648F"
  Log "msbuild start"
  & $msbuild RoughPptAddin.sln /restore /p:Configuration=Release /p:SignManifests=true /p:ManifestCertificateThumbprint=$thumb /m
  if ($LASTEXITCODE -ne 0) { throw "msbuild failed $LASTEXITCODE" }
  Log "msbuild ok"
  New-Item -ItemType Directory -Force publish | Out-Null
  Copy-Item -Recurse -Force src\RoughPptAddin\bin\Release\* publish\
  node scripts/validate-local-ui-assets.mjs --publish
  if ($LASTEXITCODE -ne 0) { throw "validate publish ui failed $LASTEXITCODE" }
  Log "publish validated"
  powershell -ExecutionPolicy Bypass -File scripts\package-installers.ps1 -SkipBuild
  if ($LASTEXITCODE -ne 0) { throw "package-installers failed $LASTEXITCODE" }
  Log "package-installers ok"
  Get-ChildItem RoughPptAddin-Windows11.zip,RoughPptAddin-Windows11.msi,RoughPptAddin-Windows11-Setup.exe | ForEach-Object {
    Log (("{0} {1} {2}" -f $_.Name, $_.Length, $_.LastWriteTime.ToString("o")))
  }
  if (Test-Path dist\installer-manifest.json) {
    Log (Get-Content dist\installer-manifest.json -Raw)
  }
  Set-Content -LiteralPath $exitFile -Value "0" -Encoding ASCII
  Log "done"
}
catch {
  Log $_.Exception.Message
  Set-Content -LiteralPath $exitFile -Value "1" -Encoding ASCII
  exit 1
}
