import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

import fs from "node:fs";

const style = { strokeWidthPt: 2, roughness: 0.8, bowing: 0.35, seed: 12345, fillStyle: "none" };
const cases = [
  ["msoShapeRectangle", 180, 100, 5, 12],
  ["msoShapeRoundedRectangle", 180, 100, 5, 16],
  ["msoShapeOval", 180, 100, 2, 6],
  ["msoShapeCloud", 180, 100, 2, 24],
  ["msoShapeFlowchartProcess", 180, 100, 5, 12],
  ["msoShapeActionButtonInformation", 180, 100, 2, 16]
];
const violations = [];

for (const [enumName, width, height, minVisiblePaths, maxVisiblePaths] of cases) {
  const drawable = generator.preview(enumName, width, height, style);
  const visible = drawable.paths.filter(path => path.role !== generator.pathRoles.hitArea && path.role !== generator.pathRoles.innerFillBoundary);
  const fill = drawable.paths.find(path => path.role === generator.pathRoles.innerFillBoundary);
  const inner = drawable.paths.find(path => path.role === generator.pathRoles.innerBoundary);

  if (!fill?.closed || fill.segments.length < 4) {
    violations.push(`${enumName}: missing complete closed inner fill boundary`);
  }
  if (!inner) {
    violations.push(`${enumName}: missing visible inner boundary`);
  }
  if (enumName === "msoShapeRectangle" && inner && inner.segments.length < 8) {
    violations.push(`${enumName}: visible inner boundary is too regular for Rough style`);
  }
  if (visible.length < minVisiblePaths) {
    violations.push(`${enumName}: too few visible Rough paths ${visible.length} < ${minVisiblePaths}`);
  }
  if (visible.length > maxVisiblePaths) {
    violations.push(`${enumName}: too many visible PPT paths ${visible.length} > ${maxVisiblePaths}`);
  }

  for (const [index, path] of visible.entries()) {
    if (path.role === generator.pathRoles.outerJitter && path.closed && path.segments.length <= 3) {
      violations.push(`${enumName}: visible path ${index + 1} is a closed short fragment`);
    }
  }
}

const lineDrawable = generator.preview("msoShapeLine", 180, 1, style);
const lineInner = lineDrawable.paths.find(path => path.role === generator.pathRoles.innerBoundary);
if (!lineInner || lineInner.segments.length < 4) {
  violations.push("msoShapeLine: visible inner boundary must include deterministic hand-drawn perturbation points");
}

const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const models = fs.readFileSync("src/RoughPptAddin/Models/RoughModels.cs", "utf8");
const generatorSource = fs.readFileSync("src/RoughPptAddin/ui/rough-shape-generator.mjs", "utf8");
if (!app.includes("roughness: 0.8") || !app.includes("bowing: 0.35")) {
  violations.push("app.mjs: default UI roughness/bowing must be conservative");
}
if (!models.includes("Roughness { get; set; } = 0.8") || !models.includes("Bowing { get; set; } = 0.35")) {
  violations.push("RoughModels.cs: host default roughness/bowing must match UI");
}
if (!generatorSource.includes("preserveVertices: true") ||
    !generatorSource.includes("strokePassesForPathData") ||
    !generatorSource.includes("lightlyWarpBoundarySegments")) {
  violations.push("rough-shape-generator.mjs: must preserve vertices, lightly warp visible inner boundary, and control stroke passes");
}

if (violations.length) {
  throw new Error(`rough path continuity validation failed:\n${violations.join("\n")}`);
}

console.log("rough path continuity ok");
