import fs from "node:fs";

const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");
const violations = [];
const hasChinese = value => /[\u3400-\u9fff]/.test(value ?? "");

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1]] = match[3];
  }
  return result;
}

const tags = new Map();
for (const match of ribbon.matchAll(/<(button|toggleButton|dynamicMenu)\b[^>\r\n]*>/g)) {
  const attributes = attrs(match[0]);
  if (attributes.id) tags.set(attributes.id, { kind: match[1], tag: match[0], attributes });
}

const expected = {
  openPane: { action: "OpenPane" },
  saveAsset: { action: "SaveSelectionAsAsset" },
  importAssets: { action: "ImportAssets" },
  exportAssets: { action: "ExportAssets" },
  roughShapeMenu: { action: "OpenShapeGallery" },
  commonLine: { action: "InsertCommonShape", enumName: "msoShapeLine" },
  commonArrow: { action: "InsertCommonShape", enumName: "msoShapeLineArrow" },
  commonRectangle: { action: "InsertCommonShape", enumName: "msoShapeRectangle" },
  commonRoundedRectangle: { action: "InsertCommonShape", enumName: "msoShapeRoundedRectangle" },
  commonOval: { action: "InsertCommonShape", enumName: "msoShapeOval" },
  commonDiamond: { action: "InsertCommonShape", enumName: "msoShapeDiamond" },
  commonTriangle: { action: "InsertCommonShape", enumName: "msoShapeIsoscelesTriangle" },
  commonDashedFrame: { action: "InsertCommonShape", enumName: "msoShapeRectangle" },
  commonCurve: { action: "InsertCommonShape", enumName: "msoShapeCurve" },
  commonDoubleCircle: { action: "InsertCommonShape", enumName: "msoShapeDonut" },
  commonTrapezoid: { action: "InsertCommonShape", enumName: "msoShapeTrapezoid" },
  commonPentagon: { action: "InsertCommonShape", enumName: "msoShapeRegularPentagon" },
  commonHexagon: { action: "InsertCommonShape", enumName: "msoShapeHexagon" },
  commonBidirectionalArrow: { action: "InsertCommonShape", enumName: "msoShapeLeftRightArrow" },
  commonCubeRough: { action: "InsertCommonShape", enumName: "rough3dCubeRough" },
  commonCylinderRough: { action: "InsertCommonShape", enumName: "rough3dCylinderRough" },
  commonStraightConnector: { action: "InsertCommonShape", enumName: "msoShapeStraightConnector" },
  commonElbowConnector: { action: "InsertCommonShape", enumName: "msoShapeElbowConnector" },
  commonCurvedConnector: { action: "InsertCommonShape", enumName: "msoShapeCurvedConnector" },
  commonFlowProcess: { action: "InsertCommonShape", enumName: "msoShapeFlowchartProcess" },
  commonFlowDecision: { action: "InsertCommonShape", enumName: "msoShapeFlowchartDecision" },
  commonFlowData: { action: "InsertCommonShape", enumName: "msoShapeFlowchartData" },
  commonFlowTerminator: { action: "InsertCommonShape", enumName: "msoShapeFlowchartTerminator" },
  commonFlowDocument: { action: "InsertCommonShape", enumName: "msoShapeFlowchartDocument" },
  commonFlowPreparation: { action: "InsertCommonShape", enumName: "msoShapeFlowchartPreparation" },
  commonRectCallout: { action: "InsertCommonShape", enumName: "msoShapeRectangularCallout" },
  commonRoundRectCallout: { action: "InsertCommonShape", enumName: "msoShapeRoundedRectangularCallout" },
  commonOvalCallout: { action: "InsertCommonShape", enumName: "msoShapeOvalCallout" },
  commonCloudCallout: { action: "InsertCommonShape", enumName: "msoShapeCloudCallout" },
  commonCubePlain: { action: "InsertCommonShape", enumName: "rough3dCubePlain" },
  commonCylinderPlain: { action: "InsertCommonShape", enumName: "rough3dCylinderPlain" },
  commonConePlain: { action: "InsertCommonShape", enumName: "rough3dConePlain" },
  commonPyramidPlain: { action: "InsertCommonShape", enumName: "rough3dPyramidPlain" },
  commonSpherePlain: { action: "InsertCommonShape", enumName: "rough3dSpherePlain" },
  commonStackPlain: { action: "InsertCommonShape", enumName: "rough3dStackPlain" },
  commonConeRough: { action: "InsertCommonShape", enumName: "rough3dConeRough" },
  commonPyramidRough: { action: "InsertCommonShape", enumName: "rough3dPyramidRough" },
  commonSphereRough: { action: "InsertCommonShape", enumName: "rough3dSphereRough" },
  commonStackRough: { action: "InsertCommonShape", enumName: "rough3dStackRough" },
  stylePresetGentle: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetPaper: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetBold: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetNested: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetTextured: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetRoughJs: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetExcalidraw: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetDrawio: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetD2: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetTldraw: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetBrush: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetFragments: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  stylePresetDenseFragments: { action: "ApplyRibbonStylePreset", kind: "toggleButton" },
  fillNoneShortcut: { action: "ApplyStyleShortcut", patch: "FillMode = \"none\"" },
  fillSolidShortcut: { action: "ApplyStyleShortcut", patch: "FillStyle = \"solid\"" },
  fillWhiteShortcut: { action: "ApplyStyleShortcut", patch: "FillColor = \"#ffffff\"" },
  fillBrushShortcut: { action: "ApplyStyleShortcut", patch: "FillSource = \"brush\"" },
  fillHachureShortcut: { action: "ApplyStyleShortcut", patch: "FillStyle = \"hachure\"" },
  fillCrossShortcut: { action: "ApplyStyleShortcut", patch: "FillStyle = \"cross-hatch\"" },
  lineThinShortcut: { action: "ApplyStyleShortcut", patch: "StrokeWidthPt = 1" },
  lineNormalShortcut: { action: "ApplyStyleShortcut", patch: "StrokeWidthPt = 2" },
  lineBoldShortcut: { action: "ApplyStyleShortcut", patch: "StrokeWidthPt = 4" },
  dashSolidShortcut: { action: "ApplyStyleShortcut", patch: "DashStyle = \"solid\"" },
  dashDashShortcut: { action: "ApplyStyleShortcut", patch: "DashStyle = \"dash\"" },
  dashDotShortcut: { action: "ApplyStyleShortcut", patch: "DashStyle = \"dot\"" },
  dashDashDotShortcut: { action: "ApplyStyleShortcut", patch: "DashStyle = \"dash-dot\"" },
  arrowNoneShortcut: { action: "ApplyStyleShortcut", patch: "ArrowheadStyle = \"none\"" },
  arrowStartShortcut: { action: "ApplyStyleShortcut", patch: "ArrowheadPosition = \"start\"" },
  arrowEndShortcut: { action: "ApplyStyleShortcut", patch: "ArrowheadPosition = \"end\"" },
  arrowBothShortcut: { action: "ApplyStyleShortcut", patch: "ArrowheadPosition = \"both\"" },
  boundaryRoughJsShortcut: { action: "ApplyStyleShortcut", patch: "ApplyBoundarySource(style, \"roughjs\"" },
  boundaryExcalidrawShortcut: { action: "ApplyStyleShortcut", patch: "ApplyBoundarySource(style, \"excalidraw\"" },
  boundaryDrawioShortcut: { action: "ApplyStyleShortcut", patch: "ApplyBoundarySource(style, \"drawio\"" },
  boundaryD2Shortcut: { action: "ApplyStyleShortcut", patch: "ApplyBoundarySource(style, \"d2\"" },
  boundaryTldrawShortcut: { action: "ApplyStyleShortcut", patch: "ApplyBoundarySource(style, \"tldraw\"" },
  fillSourceAutoShortcut: { action: "ApplyStyleShortcut", patch: "FillSource = \"auto\"" },
  fillSourceRoughJsShortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"roughjs\"" },
  fillSourceExcalidrawShortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"excalidraw\"" },
  fillSourceDrawioShortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"drawio\"" },
  fillSourceD2Shortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"d2\"" },
  fillSourceTldrawShortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"tldraw\"" },
  fillSourceBrushShortcut: { action: "ApplyStyleShortcut", patch: "ApplyFillSource(style, \"brush\"" },
  strokeBlackShortcut: { action: "ApplyStyleShortcut", patch: "Stroke = \"#000000\"" },
  strokeBlueShortcut: { action: "ApplyStyleShortcut", patch: "Stroke = \"#0f6cbd\"" },
  strokeRedShortcut: { action: "ApplyStyleShortcut", patch: "Stroke = \"#c42b1c\"" },
  strokeGreenShortcut: { action: "ApplyStyleShortcut", patch: "Stroke = \"#107c41\"" },
  fillYellowShortcut: { action: "ApplyStyleShortcut", patch: "ApplySolidFillColor(style, \"#fff2cc\")" },
  fillBlueShortcut: { action: "ApplyStyleShortcut", patch: "ApplySolidFillColor(style, \"#d7ecff\")" },
  fillPinkShortcut: { action: "ApplyStyleShortcut", patch: "ApplySolidFillColor(style, \"#fde2e8\")" },
  fillGreenShortcut: { action: "ApplyStyleShortcut", patch: "ApplySolidFillColor(style, \"#dff3df\")" },
  openShapesPane: { action: "OpenPaneSection", section: "catalog" },
  openSearchPane: { action: "OpenPaneSection", section: "search" },
  openStylePane: { action: "OpenPaneSection", section: "style" },
  openFeaturePane: { action: "OpenPaneSection", section: "featureBlock" },
  openAssetPane: { action: "OpenPaneSection", section: "library" },
  quickShapeManageMenu: { kind: "dynamicMenu" },
  insertFeatureBlock: { action: "InsertFeatureBlock" },
  insertFeatureBlock2D: { action: "InsertFeatureBlock2D" },
  insertFeatureBlock3D: { action: "InsertFeatureBlock3D" },
  insertRoughFeatureBlock: { action: "InsertRoughFeatureBlock" },
  saveFeatureDefault: { action: "SaveFeatureDefault" },
  featureLeftMinus: { action: "AdjustFeatureBlockDirection", feature: ["left", -1] },
  featureLeftPlus: { action: "AdjustFeatureBlockDirection", feature: ["left", 1] },
  featureRightMinus: { action: "AdjustFeatureBlockDirection", feature: ["right", -1] },
  featureRightPlus: { action: "AdjustFeatureBlockDirection", feature: ["right", 1] },
  featureUpMinus: { action: "AdjustFeatureBlockDirection", feature: ["up", -1] },
  featureUpPlus: { action: "AdjustFeatureBlockDirection", feature: ["up", 1] },
  featureDownMinus: { action: "AdjustFeatureBlockDirection", feature: ["down", -1] },
  featureDownPlus: { action: "AdjustFeatureBlockDirection", feature: ["down", 1] },
  featureFrontMinus: { action: "AdjustFeatureBlockDirection", feature: ["front", -1] },
  featureFrontPlus: { action: "AdjustFeatureBlockDirection", feature: ["front", 1] },
  featureBackMinus: { action: "AdjustFeatureBlockDirection", feature: ["back", -1] },
  featureBackPlus: { action: "AdjustFeatureBlockDirection", feature: ["back", 1] },
  convertSelection: { action: "ConvertSelectionToRough" },
  refreshShape: { action: "RefreshSelection" },
  selectCarrier: { action: "SelectNativeCarrier" },
  inspectShape: { action: "InspectSelection" }
};

for (let i = 0; i < 12; i++) {
  expected[`quickShape_${i}`] = { action: "InsertQuickShape", dynamicQuick: true };
}

for (const [id, expectation] of Object.entries(expected)) {
  const entry = tags.get(id);
  if (!entry) {
    violations.push(`Ribbon missing top command: ${id}`);
    continue;
  }
  const { kind, attributes } = entry;
  if (expectation.kind && kind !== expectation.kind) violations.push(`${id}: expected ${expectation.kind}, got ${kind}`);
  if (expectation.action && attributes.onAction !== expectation.action) violations.push(`${id}: expected onAction=${expectation.action}, got ${attributes.onAction}`);
  if (!attributes.imageMso && !attributes.getImage && !attributes.getContent) violations.push(`${id}: missing icon or dynamic menu content`);
  if (expectation.dynamicQuick) {
    if (attributes.getScreentip !== "GetQuickShapeScreentip" || attributes.getSupertip !== "GetQuickShapeSupertip") {
      violations.push(`${id}: quick shape tooltip must be dynamic`);
    }
  } else if (kind !== "dynamicMenu") {
    if (!attributes.label || !hasChinese(attributes.label)) violations.push(`${id}: missing Chinese label`);
    if (!attributes.screentip || !hasChinese(attributes.screentip)) violations.push(`${id}: missing Chinese screentip`);
    if (!attributes.supertip || !hasChinese(attributes.supertip)) violations.push(`${id}: missing Chinese supertip`);
  }
}

for (const [id, expectation] of Object.entries(expected)) {
  if (expectation.enumName) {
    const pattern = new RegExp(`case "${id}"[\\s\\S]{0,120}return "${expectation.enumName}"`);
    if (!pattern.test(ribbon)) violations.push(`${id}: CommonShapeEnum must map to ${expectation.enumName}`);
  }
  if (expectation.patch && !ribbon.includes(expectation.patch)) {
    violations.push(`${id}: style shortcut patch missing ${expectation.patch}`);
  }
  if (expectation.section) {
    const pattern = new RegExp(`case "${id}"[\\s\\S]{0,80}return "${expectation.section}"`);
    if (!pattern.test(ribbon)) violations.push(`${id}: pane section must map to ${expectation.section}`);
  }
  if (expectation.feature) {
    const [direction, delta] = expectation.feature;
    const statementPattern = new RegExp(`case "${id}"[\\s\\S]{0,120}new FeatureDirectionCommand\\("${direction}", ${delta}\\)`);
    const expressionPattern = new RegExp(`"${id}"\\s*=>\\s*new FeatureDirectionCommand\\("${direction}", ${delta}\\)`);
    if (!statementPattern.test(ribbon) && !expressionPattern.test(ribbon)) violations.push(`${id}: feature direction mapping missing ${direction}/${delta}`);
  }
}

for (const snippet of [
  "AdjustFeatureBlockDirection",
  "FeatureDirectionAdjustment",
  "FeatureDirectionCommand",
  "AdjustFeatureBlockFromPreset",
  "options.CountX = Math.Max(1, Math.Min(32",
  "options.CountY = Math.Max(1, Math.Min(24",
  "options.CountZ = Math.Max(1, Math.Min(16",
  "二维特征块没有前后层",
  "focusGlobalSearch",
  "section === \"search\"",
  "已定位功能搜索"
]) {
  if (!ribbon.includes(snippet) && !controller.includes(snippet) && !app.includes(snippet)) {
    violations.push(`top command implementation missing: ${snippet}`);
  }
}

if (!packageJson.includes("validate-ribbon-top-commands.mjs")) {
  violations.push("package.json test script must include validate-ribbon-top-commands.mjs");
}

if (violations.length) {
  throw new Error(`Ribbon top command validation failed:\n${violations.join("\n")}`);
}

console.log(`ribbon top commands ok: ${Object.keys(expected).length} controls`);
