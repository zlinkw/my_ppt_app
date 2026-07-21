Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$stateRoot = Join-Path $env:LOCALAPPDATA "RoughPptAddin"
$discoveryPath = Join-Path $stateRoot "automation.json"
$tokenPath = Join-Path $stateRoot "automation.token"
if (-not (Test-Path -LiteralPath $discoveryPath)) {
    throw "未找到 ZLK 自动绘图发现文件：$discoveryPath。请先启动 PowerPoint 并加载插件。"
}
if (-not (Test-Path -LiteralPath $tokenPath)) {
    throw "未找到 ZLK 自动绘图令牌文件：$tokenPath。"
}

$discovery = Get-Content -Encoding UTF8 -LiteralPath $discoveryPath -Raw | ConvertFrom-Json
$token = Get-Content -Encoding UTF8 -LiteralPath $tokenPath -Raw
$headers = @{ "X-Rough-Ppt-Token" = $token.Trim() }
$health = Invoke-RestMethod -Method Get -Uri "$($discovery.endpoint)/health" -Headers $headers
if (-not $health.ok) {
    throw "ZLK 自动绘图 health 失败。"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("rough-zlk-plot-" + [Guid]::NewGuid().ToString("N"))
$resultDir = Join-Path $tempRoot "work_dirs\run_001"
New-Item -ItemType Directory -Path $resultDir -Force | Out-Null
$csvPath = Join-Path $resultDir "metrics_summary.csv"
@"
method,dataset,split,fold,seed,metric,value
Baseline,MIMIC,test,0,1,AUC,0.82
NewModel,MIMIC,test,0,1,AUC,0.89
"@ | Set-Content -Encoding UTF8 -LiteralPath $csvPath

$targetPath = Join-Path $tempRoot "zlk-auto-plot.pptx"
$body = @{
    requestId = "verify-" + [Guid]::NewGuid().ToString("N")
    projectRoot = $tempRoot
    sourcePaths = @("work_dirs\run_001\metrics_summary.csv")
    plottingContractPath = ""
    chartType = "auto"
    styleMode = "activePpt"
    target = @{
        presentationPath = $targetPath
        createIfMissing = $true
    }
} | ConvertTo-Json -Depth 8

$result = Invoke-RestMethod -Method Post -Uri "$($discovery.endpoint)/api/zlk-cluster/plot" -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
if (-not $result.ok) {
    throw "ZLK 自动绘图失败：$($result.error)"
}
if ($result.shapeCount -lt 1) {
    throw "ZLK 自动绘图没有生成 PPT 原生对象。"
}
if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "ZLK 自动绘图未创建目标 PPT：$targetPath"
}

Write-Host "ZLKPlotSmoke=OK;Presentation=$($result.presentationPath);Slide=$($result.slideIndex);Shapes=$($result.shapeCount);Chart=$($result.chartType)"