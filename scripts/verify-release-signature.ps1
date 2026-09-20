param([Parameter(Mandatory = $true)][string]$ReleaseRoot)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$release = [IO.Path]::GetFullPath($ReleaseRoot)
$manifestPath = Join-Path $release 'installer-manifest.json'
$signaturePath = "$manifestPath.p7s"
$manifestBytes = [IO.File]::ReadAllBytes($manifestPath)
$manifest = [Text.Encoding]::UTF8.GetString($manifestBytes) | ConvertFrom-Json

Add-Type -AssemblyName System.Security.Cryptography.Pkcs
$content = [System.Security.Cryptography.Pkcs.ContentInfo]::new($manifestBytes)
$cms = [System.Security.Cryptography.Pkcs.SignedCms]::new($content, $true)
$cms.Decode([IO.File]::ReadAllBytes($signaturePath))
$cms.CheckSignature($true)
if ($cms.SignerInfos.Count -ne 1 -or
    $cms.SignerInfos[0].Certificate.Thumbprint -ne $manifest.signing.thumbprint) {
    throw 'Release manifest signer mismatch.'
}

foreach ($artifact in $manifest.artifacts.PSObject.Properties) {
    $record = $artifact.Value
    $path = Join-Path $release $record.fileName
    $item = Get-Item -LiteralPath $path
    if ($item.Length -ne $record.length -or
        -not [string]::Equals((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash, $record.sha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Release artifact hash mismatch: $($artifact.Name)"
    }
    if ($artifact.Name -in @('msi', 'exe')) {
        $signature = Get-AuthenticodeSignature -LiteralPath $path
        if ($signature.Status -ne 'Valid' -or
            $signature.SignerCertificate.Thumbprint -ne $manifest.signing.thumbprint) {
            throw "Installer Authenticode signature invalid: $($artifact.Name)"
        }
    }
}
Write-Host "Release signatures and hashes verified: $release"
Write-Host "Signer: $($manifest.signing.subject) [$($manifest.signing.scope)]"
