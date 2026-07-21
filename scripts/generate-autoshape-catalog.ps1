Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $root "assets\autoshapes"
$outFile = Join-Path $outDir "mso-autoshape-catalog.json"
New-Item -ItemType Directory -Force $outDir | Out-Null

$officeDll = Get-ChildItem "C:\Windows\assembly\GAC_MSIL" -Recurse -Filter Office.dll -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $officeDll) {
    throw "Office.dll not found. Microsoft Office interop assemblies are required to generate the catalog."
}

Add-Type -Path $officeDll

function Get-Category([string]$name) {
    if ($name -match "Flowchart") { return "flowchart" }
    if ($name -match "Callout") { return "callouts" }
    if (Test-LineRecipeName $name) { return "lines" }
    if ($name -match "Arrow") { return "arrows" }
    if ($name -match "Star|Ribbon|Wave|Explosion|Plaque|Seal") { return "stars-and-banners" }
    if ($name -match "ActionButton") { return "action-buttons" }
    if ($name -match "Rectangle|RoundRect|Snip|Frame") { return "rectangles" }
    return "basic"
}

function Test-LineRecipeName([string]$name) {
    $value = $name -replace "^msoShape", ""
    return $value -match "^(Line|LineArrow|LineInverse|Curve|StraightConnector|ElbowConnector|CurvedConnector|Arc|BlockArc)$"
}

function Get-Strategy([string]$name) {
    if ($name -match "Rectangle|RoundRect|Oval|Diamond|Triangle|Trapezoid|Parallelogram|Hexagon|Pentagon|Octagon|Decagon|Dodecagon") { return "roughPrimitive" }
    if ($name -match "Line|Arc|Connector|Arrow|Flowchart|Callout|Star|Ribbon|Button|Brace|Bracket|Donut|Cube|Can|Cloud|Balloon|Bevel|Chart|Chevron|Chord|Corner|Cross|DiagonalStripe|Explosion|FoldedCorner|Frame|Funnel|Gear|Heart|Heptagon|LightningBolt|Math|Moon|NoSymbol|Pie|Plaque|Scroll|SmileyFace|Sun|Tabs|Tear|Wave") { return "roughPathRecipe" }
    return "roughApproximation"
}

function Get-RecipeId([string]$category, [string]$displayName) {
    $value = [regex]::Replace("$category-$displayName", "([a-z0-9])([A-Z])", '$1-$2').ToLowerInvariant()
    $value = [regex]::Replace($value, "[^a-z0-9]+", "-").Trim("-")
    return $value
}

function U([string]$value) {
    return [regex]::Unescape($value)
}

function Get-ZhCategory([string]$category) {
    switch ($category) {
        "lines" { return (U "\u7ebf\u6761") }
        "arrows" { return (U "\u7bad\u5934") }
        "rectangles" { return (U "\u77e9\u5f62") }
        "flowchart" { return (U "\u6d41\u7a0b\u56fe") }
        "callouts" { return (U "\u6807\u6ce8") }
        "stars-and-banners" { return (U "\u661f\u4e0e\u65d7\u5e1c") }
        "action-buttons" { return (U "\u52a8\u4f5c\u6309\u94ae") }
        default { return (U "\u57fa\u672c\u5f62\u72b6") }
    }
}

function Split-ShapeNameTokens([string]$displayName) {
    $normalized = $displayName `
        -replace "Backor", "Back Or" `
        -replace "Forwardor", "Forward Or" `
        -replace "Borderand", "Border And" `
        -replace "UTurn", "U Turn"
    [regex]::Matches($normalized, "\d+|[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+") |
        ForEach-Object { $_.Value }
}

function Get-FallbackZhName([string]$displayName, [string]$category) {
    $phraseMap = @{
        ActionButtonBackorPrevious = (U "\u8fd4\u56de\u6216\u4e0a\u4e00\u5f20\u52a8\u4f5c\u6309\u94ae")
        ActionButtonBeginning = (U "\u8f6c\u5230\u5f00\u5934\u52a8\u4f5c\u6309\u94ae")
        ActionButtonCustom = (U "\u81ea\u5b9a\u4e49\u52a8\u4f5c\u6309\u94ae")
        ActionButtonDocument = (U "\u6587\u6863\u52a8\u4f5c\u6309\u94ae")
        ActionButtonEnd = (U "\u8f6c\u5230\u7ed3\u5c3e\u52a8\u4f5c\u6309\u94ae")
        ActionButtonForwardorNext = (U "\u524d\u8fdb\u6216\u4e0b\u4e00\u5f20\u52a8\u4f5c\u6309\u94ae")
        ActionButtonHelp = (U "\u5e2e\u52a9\u52a8\u4f5c\u6309\u94ae")
        ActionButtonHome = (U "\u4e3b\u9875\u52a8\u4f5c\u6309\u94ae")
        ActionButtonInformation = (U "\u4fe1\u606f\u52a8\u4f5c\u6309\u94ae")
        ActionButtonMovie = (U "\u5f71\u7247\u52a8\u4f5c\u6309\u94ae")
        ActionButtonReturn = (U "\u8fd4\u56de\u52a8\u4f5c\u6309\u94ae")
        ActionButtonSound = (U "\u58f0\u97f3\u52a8\u4f5c\u6309\u94ae")
        NotPrimitive = (U "\u975e\u57fa\u672c\u5f62\u72b6")
    }
    if ($phraseMap.ContainsKey($displayName)) {
        return $phraseMap[$displayName]
    }

    $tokenMap = @{
        Accent = (U "\u5f3a\u8c03")
        Access = (U "\u8bbf\u95ee")
        Alternate = (U "\u5907\u7528")
        And = (U "\u548c")
        Arc = (U "\u5f27\u5f62")
        Arrow = (U "\u7bad\u5934")
        Balloon = (U "\u6c14\u7403")
        Bar = (U "\u7ebf")
        Beginning = (U "\u5f00\u5934")
        Bent = (U "\u6298\u5f2f")
        Bevel = (U "\u68f1\u53f0")
        Block = (U "\u5757")
        Border = (U "\u8fb9\u6846")
        Brace = (U "\u5927\u62ec\u53f7")
        Bracket = (U "\u65b9\u62ec\u53f7")
        Button = (U "\u6309\u94ae")
        Callout = (U "\u6807\u6ce8")
        Can = (U "\u5706\u67f1")
        Card = (U "\u5361\u7247")
        Chart = (U "\u56fe\u8868")
        Chevron = (U "\u6298\u5f62")
        Chord = (U "\u5f26\u5f62")
        Circular = (U "\u73af\u5f62")
        Collate = (U "\u5bf9\u7167")
        Connector = (U "\u8fde\u63a5\u7b26")
        Corner = (U "\u89d2")
        Cross = (U "\u5341\u5b57\u5f62")
        Cube = (U "\u7acb\u65b9\u4f53")
        Curved = (U "\u5f27\u5f62")
        Custom = (U "\u81ea\u5b9a\u4e49")
        Data = (U "\u6570\u636e")
        Diagonal = (U "\u5bf9\u89d2")
        Direct = (U "\u76f4\u63a5")
        Disk = (U "\u78c1\u76d8")
        Divide = (U "\u9664\u53f7")
        Document = (U "\u6587\u6863")
        Donut = (U "\u5706\u73af")
        Down = (U "\u4e0b")
        End = (U "\u7ed3\u5c3e")
        Equal = (U "\u7b49\u53f7")
        Extract = (U "\u63d0\u53d6")
        Folded = (U "\u6298\u89d2")
        Flowchart = (U "\u6d41\u7a0b\u56fe")
        Frame = (U "\u6846")
        Funnel = (U "\u6f0f\u6597")
        Gear = (U "\u9f7f\u8f6e")
        Half = (U "\u534a")
        Horizontal = (U "\u6c34\u5e73")
        Internal = (U "\u5185\u90e8")
        Inverse = (U "\u53cd\u5411")
        Junction = (U "\u6c47\u5408")
        Left = (U "\u5de6")
        Line = (U "\u7ebf\u6761")
        Magnetic = (U "\u78c1")
        Manual = (U "\u624b\u52a8")
        Math = (U "\u6570\u5b66")
        Merge = (U "\u5408\u5e76")
        Minus = (U "\u51cf\u53f7")
        Movie = (U "\u5f71\u7247")
        Multiply = (U "\u4e58\u53f7")
        No = (U "\u65e0")
        Not = (U "\u4e0d")
        Notched = (U "\u7f3a\u53e3")
        Off = (U "\u79bb\u9875")
        Offline = (U "\u8131\u673a")
        Operation = (U "\u64cd\u4f5c")
        Or = (U "\u6216")
        Page = (U "\u9875")
        Pie = (U "\u997c\u5f62")
        Plaque = (U "\u9970\u724c")
        Plus = (U "\u52a0\u53f7")
        Predefined = (U "\u9884\u5b9a\u4e49")
        Previous = (U "\u4e0a\u4e00\u5f20")
        Punched = (U "\u6253\u5b54")
        Quad = (U "\u56db\u5411")
        Return = (U "\u8fd4\u56de")
        Right = (U "\u53f3")
        Scroll = (U "\u5377\u8f74")
        Sequential = (U "\u987a\u5e8f")
        Sort = (U "\u6392\u5e8f")
        Sound = (U "\u58f0\u97f3")
        Square = (U "\u65b9\u5f62")
        Star = (U "\u661f")
        Storage = (U "\u5b58\u50a8")
        Stored = (U "\u5df2\u5b58\u50a8")
        Stripe = (U "\u6761\u7eb9")
        Striped = (U "\u6761\u7eb9")
        Summing = (U "\u6c42\u548c")
        Symbol = (U "\u7b26\u53f7")
        Swoosh = (U "\u98de\u626c")
        Tabs = (U "\u9009\u9879\u5361")
        Tape = (U "\u5e26")
        Tear = (U "\u6c34\u6ef4")
        Turn = (U "\u8f6c\u5f2f")
        U = "U"
        Up = (U "\u4e0a")
        Vertical = (U "\u5782\u76f4")
        Wedge = (U "\u6247\u5f62")
        X = "X"
    }

    $tokens = @(Split-ShapeNameTokens $displayName)
    if ($tokens.Count -eq 0) {
        return "$(Get-ZhCategory $category)"
    }

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($token in $tokens) {
        if ($token -match "^\d+$") {
            $parts.Add($token)
        }
        elseif ($tokenMap.ContainsKey($token)) {
            $parts.Add([string]$tokenMap[$token])
        }
    }

    if ($parts.Count -eq 0) {
        return "$(Get-ZhCategory $category)"
    }

    $value = ($parts -join "")
    $value = $value `
        -replace (U "\u6d41\u7a0b\u56fe\u6d41\u7a0b\u56fe"), (U "\u6d41\u7a0b\u56fe") `
        -replace (U "\u7ebf\u6761\u6807\u6ce8"), (U "\u7ebf\u6761\u6807\u6ce8") `
        -replace (U "\u6570\u5b66\u52a0\u53f7"), (U "\u52a0\u53f7") `
        -replace (U "\u6570\u5b66\u51cf\u53f7"), (U "\u51cf\u53f7") `
        -replace (U "\u6570\u5b66\u4e58\u53f7"), (U "\u4e58\u53f7") `
        -replace (U "\u6570\u5b66\u9664\u53f7"), (U "\u9664\u53f7") `
        -replace (U "\u6570\u5b66\u7b49\u53f7"), (U "\u7b49\u53f7") `
        -replace (U "\u6570\u5b66\u4e0d\u7b49\u53f7"), (U "\u4e0d\u7b49\u53f7")
    return $value
}

function Get-ZhName([string]$displayName, [string]$category) {
    $map = @{
        Line = (U "\u76f4\u7ebf")
        LineArrow = (U "\u76f4\u7ebf\u7bad\u5934")
        Curve = (U "\u66f2\u7ebf")
        StraightConnector = (U "\u76f4\u7ebf\u8fde\u63a5\u7b26")
        ElbowConnector = (U "\u8098\u5f62\u8fde\u63a5\u7b26")
        CurvedConnector = (U "\u66f2\u7ebf\u8fde\u63a5\u7b26")
        Rectangle = (U "\u77e9\u5f62")
        RoundedRectangle = (U "\u5706\u89d2\u77e9\u5f62")
        Round1Rectangle = (U "\u5355\u5706\u89d2\u77e9\u5f62")
        Round2SameRectangle = (U "\u53cc\u540c\u4fa7\u5706\u89d2\u77e9\u5f62")
        Round2DiagRectangle = (U "\u53cc\u5bf9\u89d2\u5706\u89d2\u77e9\u5f62")
        Snip1Rectangle = (U "\u5355\u526a\u89d2\u77e9\u5f62")
        Snip2SameRectangle = (U "\u53cc\u540c\u4fa7\u526a\u89d2\u77e9\u5f62")
        Snip2DiagRectangle = (U "\u53cc\u5bf9\u89d2\u526a\u89d2\u77e9\u5f62")
        SnipRoundRectangle = (U "\u526a\u89d2\u5706\u89d2\u77e9\u5f62")
        DashedRectangle = (U "\u865a\u7ebf\u6846")
        Oval = (U "\u692d\u5706")
        DoubleOval = (U "\u53cc\u5708")
        Diamond = (U "\u83f1\u5f62")
        IsoscelesTriangle = (U "\u7b49\u8170\u4e09\u89d2\u5f62")
        RightTriangle = (U "\u76f4\u89d2\u4e09\u89d2\u5f62")
        Trapezoid = (U "\u68af\u5f62")
        NonIsoscelesTrapezoid = (U "\u975e\u7b49\u8170\u68af\u5f62")
        Parallelogram = (U "\u5e73\u884c\u56db\u8fb9\u5f62")
        Pentagon = (U "\u4e94\u8fb9\u5f62")
        RegularPentagon = (U "\u6b63\u4e94\u8fb9\u5f62")
        Hexagon = (U "\u516d\u8fb9\u5f62")
        Heptagon = (U "\u4e03\u8fb9\u5f62")
        Octagon = (U "\u516b\u8fb9\u5f62")
        Decagon = (U "\u5341\u8fb9\u5f62")
        Dodecagon = (U "\u5341\u4e8c\u8fb9\u5f62")
        RightArrow = (U "\u53f3\u7bad\u5934")
        LeftArrow = (U "\u5de6\u7bad\u5934")
        UpArrow = (U "\u4e0a\u7bad\u5934")
        DownArrow = (U "\u4e0b\u7bad\u5934")
        LeftRightArrow = (U "\u5de6\u53f3\u7bad\u5934")
        UpDownArrow = (U "\u4e0a\u4e0b\u7bad\u5934")
        QuadArrow = (U "\u56db\u5411\u7bad\u5934")
        BentArrow = (U "\u6298\u5f2f\u7bad\u5934")
        CurvedRightArrow = (U "\u53f3\u5f27\u5f62\u7bad\u5934")
        CurvedLeftArrow = (U "\u5de6\u5f27\u5f62\u7bad\u5934")
        CurvedUpArrow = (U "\u4e0a\u5f27\u5f62\u7bad\u5934")
        CurvedDownArrow = (U "\u4e0b\u5f27\u5f62\u7bad\u5934")
        CircularArrow = (U "\u73af\u5f62\u7bad\u5934")
        Cloud = (U "\u4e91\u5f62")
        CloudCallout = (U "\u4e91\u5f62\u6807\u6ce8")
        RectangularCallout = (U "\u77e9\u5f62\u6807\u6ce8")
        RoundedRectangularCallout = (U "\u5706\u89d2\u77e9\u5f62\u6807\u6ce8")
        OvalCallout = (U "\u692d\u5706\u6807\u6ce8")
        FlowchartProcess = (U "\u6d41\u7a0b\u56fe\u8fc7\u7a0b")
        FlowchartDecision = (U "\u6d41\u7a0b\u56fe\u5224\u65ad")
        FlowchartData = (U "\u6d41\u7a0b\u56fe\u6570\u636e")
        FlowchartTerminator = (U "\u6d41\u7a0b\u56fe\u7ec8\u6b62")
        FlowchartDocument = (U "\u6d41\u7a0b\u56fe\u6587\u6863")
        FlowchartManualInput = (U "\u6d41\u7a0b\u56fe\u624b\u52a8\u8f93\u5165")
        FlowchartManualOperation = (U "\u6d41\u7a0b\u56fe\u624b\u52a8\u64cd\u4f5c")
        FlowchartPreparation = (U "\u6d41\u7a0b\u56fe\u51c6\u5907")
        FlowchartConnector = (U "\u6d41\u7a0b\u56fe\u8fde\u63a5")
        FlowchartDelay = (U "\u6d41\u7a0b\u56fe\u5ef6\u8fdf")
        FlowchartDisplay = (U "\u6d41\u7a0b\u56fe\u663e\u793a")
        Heart = (U "\u5fc3\u5f62")
        Sun = (U "\u592a\u9633")
        Moon = (U "\u6708\u4eae")
        SmileyFace = (U "\u7b11\u8138")
        LightningBolt = (U "\u95ea\u7535")
        Explosion1 = (U "\u7206\u70b8\u5f621")
        Explosion2 = (U "\u7206\u70b8\u5f622")
        Wave = (U "\u6ce2\u5f62")
        DoubleWave = (U "\u53cc\u6ce2\u5f62")
        Plaque = (U "\u9970\u724c")
        DownRibbon = (U "\u4e0b\u5f2f\u5e26\u5f62")
        UpRibbon = (U "\u4e0a\u5f2f\u5e26\u5f62")
        LeftRightRibbon = (U "\u5de6\u53f3\u5e26\u5f62")
    }

    if ($map.ContainsKey($displayName)) {
        return $map[$displayName]
    }

    if ($displayName -match "pointStar") {
        return ($displayName -replace "pointStar", (U "\u89d2\u661f"))
    }

    return Get-FallbackZhName $displayName $category
}

function New-CatalogItem([string]$name, [string]$displayName, [string]$category, [string]$strategy, [string]$fidelity, [int]$width, [int]$height) {
    $displayNameZh = Get-ZhName $displayName $category
    $categoryZh = Get-ZhCategory $category
    [ordered]@{
        enumName = $name
        displayName = $displayName
        displayNameZh = $displayNameZh
        category = $category
        keywords = @($name.ToLowerInvariant(), $displayName.ToLowerInvariant(), $category, $categoryZh, $displayNameZh)
        defaultSizePt = [ordered]@{ width = $width; height = $height }
        generationStrategy = $strategy
        recipeId = Get-RecipeId $category $displayName
        fidelity = $fidelity
        insertable = ($name -ne "msoShapeNotPrimitive")
        supportedParams = @("stroke", "strokeWidthPt", "roughness", "bowing", "seed", "fillStyle", "dashStyle", "arrowheadStyle")
    }
}

$manualItems = @(
    New-CatalogItem "msoShapeLine" "Line" "lines" "roughPrimitive" "exact" 180 0
    New-CatalogItem "msoShapeLineArrow" "LineArrow" "lines" "roughPathRecipe" "exact" 180 28
    New-CatalogItem "msoShapeCurve" "Curve" "lines" "roughPathRecipe" "exact" 180 80
    New-CatalogItem "msoShapeStraightConnector" "StraightConnector" "lines" "roughPrimitive" "exact" 180 0
    New-CatalogItem "msoShapeElbowConnector" "ElbowConnector" "lines" "roughPathRecipe" "exact" 160 80
    New-CatalogItem "msoShapeCurvedConnector" "CurvedConnector" "lines" "roughPathRecipe" "exact" 160 80
    New-CatalogItem "msoShapeDashedRectangle" "DashedRectangle" "rectangles" "roughPathRecipe" "exact" 140 90
    New-CatalogItem "msoShapeDoubleOval" "DoubleOval" "basic" "roughPathRecipe" "exact" 120 90
    New-CatalogItem "rough3dCubeRough" "ThreeDCubeRough" "three-d-rough" "roughPathRecipe" "exact" 130 100
    New-CatalogItem "rough3dCubePlain" "ThreeDCubePlain" "three-d-plain" "native3dRecipe" "exact" 130 100
    New-CatalogItem "rough3dCylinderRough" "ThreeDCylinderRough" "three-d-rough" "roughPathRecipe" "exact" 130 100
    New-CatalogItem "rough3dCylinderPlain" "ThreeDCylinderPlain" "three-d-plain" "native3dRecipe" "exact" 130 100
    New-CatalogItem "rough3dConeRough" "ThreeDConeRough" "three-d-rough" "roughPathRecipe" "exact" 130 100
    New-CatalogItem "rough3dConePlain" "ThreeDConePlain" "three-d-plain" "native3dRecipe" "exact" 130 100
    New-CatalogItem "rough3dSphereRough" "ThreeDSphereRough" "three-d-rough" "roughPathRecipe" "exact" 120 120
    New-CatalogItem "rough3dSpherePlain" "ThreeDSpherePlain" "three-d-plain" "native3dRecipe" "exact" 120 120
    New-CatalogItem "rough3dPyramidRough" "ThreeDPyramidRough" "three-d-rough" "roughPathRecipe" "exact" 130 110
    New-CatalogItem "rough3dPyramidPlain" "ThreeDPyramidPlain" "three-d-plain" "native3dRecipe" "exact" 130 110
    New-CatalogItem "rough3dStackRough" "ThreeDStackRough" "three-d-rough" "roughPathRecipe" "exact" 150 120
    New-CatalogItem "rough3dStackPlain" "ThreeDStackPlain" "three-d-plain" "native3dRecipe" "exact" 150 120
)

$enumItems = [Enum]::GetNames([Microsoft.Office.Core.MsoAutoShapeType]) |
    Where-Object { $_ -ne "msoShapeMixed" } |
    Sort-Object |
    ForEach-Object {
        $name = $_
        $category = Get-Category $name
        $strategy = Get-Strategy $name
        $displayName = ($name -replace "^msoShape", "")
        $insertable = $name -ne "msoShapeNotPrimitive"
        if (-not $insertable) {
            $strategy = "sentinel"
        }
        New-CatalogItem $name $displayName $category $strategy $(if ($insertable) { "exact" } else { "sentinel" }) 120 80
    }

$items = @($manualItems) + @($enumItems)

$catalog = [ordered]@{
    version = "0.1.0"
    source = "Microsoft.Office.Core.MsoAutoShapeType plus native line primitives and editable 3D objects"
    count = @($items).Count
    items = @($items)
}

$json = $catalog | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($outFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated $outFile with $(@($items).Count) shapes"
