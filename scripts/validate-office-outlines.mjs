import fs from "node:fs";
import { officePresetOutlines } from "../src/RoughPptAddin/ui/office-preset-outlines.mjs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8").replace(/^\uFEFF/, ""));
const insertable = catalog.items.filter(item => item.insertable !== false);
const outlineNames = new Set(Object.keys(officePresetOutlines));

const allowedRecipeOnly = new Set([
  "msoShapeLine",
  "msoShapeLineArrow",
  "msoShapeCurve",
  "msoShapeStraightConnector",
  "msoShapeElbowConnector",
  "msoShapeCurvedConnector",
  "msoShapeDashedRectangle",
  "msoShapeDoubleOval",
  "msoShapeActionButtonCustom",
  "msoShapeFlowchartConnector",
  "msoShapeFlowchartProcess",
  "msoShapeLineCallout1",
  "msoShapeLineCallout1AccentBar",
  "msoShapeLineCallout1BorderandAccentBar",
  "msoShapeLineCallout1NoBorder",
  "msoShapeLineCallout2",
  "msoShapeLineCallout2NoBorder",
  "msoShapeLineInverse",
  "msoShapeMathMinus",
  "msoShapeOval",
  "msoShapeRectangle",
  "msoShapeSquareTabs",
  "rough3dCubeRough",
  "rough3dCubePlain",
  "rough3dCylinderRough",
  "rough3dCylinderPlain",
  "rough3dConeRough",
  "rough3dConePlain",
  "rough3dSphereRough",
  "rough3dSpherePlain",
  "rough3dPyramidRough",
  "rough3dPyramidPlain",
  "rough3dStackRough",
  "rough3dStackPlain"
]);

const missing = insertable.filter(item => !outlineNames.has(item.enumName) && !allowedRecipeOnly.has(item.enumName));
if (missing.length) {
  throw new Error(`missing Office-derived outlines:\n${missing.map(item => item.enumName).join("\n")}`);
}

const highRisk = [
  "msoShapeArc",
  "msoShapeBlockArc",
  "msoShapeChord",
  "msoShapePie",
  "msoShapePieWedge",
  "msoShapeGear6",
  "msoShapeGear9",
  "msoShapeHeart",
  "msoShapeMoon",
  "msoShapeSun",
  "msoShapeTear",
  "msoShapeSmileyFace",
  "msoShapeLightningBolt",
  "msoShapeMathDivide",
  "msoShapeMathEqual",
  "msoShapeMathMultiply",
  "msoShapeMathNotEqual",
  "msoShapeMathPlus",
  "msoShapeWave",
  "msoShapeDoubleWave",
  "msoShapeHorizontalScroll",
  "msoShapeVerticalScroll",
  "msoShapeFrame",
  "msoShapeHalfFrame",
  "msoShapeFoldedCorner",
  "msoShapeBevel",
  "msoShapeFunnel",
  "msoShapePlaque"
];

for (const enumName of highRisk) {
  if (!generator.usesOfficeOutline(enumName)) {
    throw new Error(`high-risk shape must use Office-derived outline: ${enumName}`);
  }
}

const style = {
  stroke: "#111111",
  strokeWidthPt: 2,
  roughness: 1.2,
  bowing: 1,
  seed: 12345,
  fillStyle: "none",
  dashStyle: "solid",
  arrowheadStyle: "rough"
};

function signature(drawable) {
  return (drawable.paths ?? [])
    .map(path => path.segments.map(segment => `${segment.type}:${segment.data.map(value => Math.round(value)).join(",")}`).join(";"))
    .join("|");
}

const signatures = new Map();
for (const item of insertable) {
  const drawable = generator.preview(item.enumName, item.defaultSizePt?.width ?? 120, item.defaultSizePt?.height ?? 80, style);
  if (!drawable?.paths?.length) throw new Error(`no drawable for ${item.enumName}`);
  const sig = signature(drawable);
  if (!signatures.has(sig)) signatures.set(sig, []);
  signatures.get(sig).push(item.enumName);
}

if (signatures.size < 165) {
  throw new Error(`Office-derived outline diversity too low: ${signatures.size}`);
}

console.log(`office outlines ok: ${outlineNames.size} derived, ${allowedRecipeOnly.size} recipe-only, ${signatures.size} distinct signatures`);