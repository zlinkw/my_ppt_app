Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
Start-Sleep -Seconds 5

$matches = @()
foreach ($addin in $ppt.COMAddIns) {
    if ($addin.ProgId -like "*Rough*" -or $addin.Description -like "*Rough*") {
        $connectError = $null
        if (-not $addin.Connect) {
            try {
                $addin.Connect = $true
            } catch {
                $connectError = $_.Exception.Message
            }
        }

        $matches += [pscustomobject]@{
            ProgId = $addin.ProgId
            Description = $addin.Description
            Connect = $addin.Connect
            ConnectError = $connectError
        }
    }
}

if ($matches.Count -eq 0) {
    throw "Rough add-in is not visible in PowerPoint COMAddIns collection."
}

$matches | Format-List *
