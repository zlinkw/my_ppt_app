import fs from "node:fs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
const model = fs.readFileSync("src/RoughPptAddin/Models/RoughModels.cs", "utf8");
const taskPane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
const ui = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const html = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const violations = [];

for (const snippet of [
  "Controller?.ApplyRoughStylePreset(style, StylePresetLabel(presetId))",
  "Controller?.ApplyRoughStylePreset(style, \"论文风格\")",
  "ArrowheadLengthPt",
  "ArrowheadWidthPt"
]) {
  if (!ribbon.includes(snippet) && !controller.includes(snippet) && !model.includes(snippet) && !taskPane.includes(snippet)) {
    violations.push(`host style wiring missing: ${snippet}`);
  }
}
if (!/(?:var|int)\s+count\s*=\s*UpdateSelectionStyle\(style\);/.test(controller)) {
  violations.push("host style wiring missing: selection style update count");
}
for (const snippet of [
  'ReadDouble(dict, "arrowheadLengthPt", style.ArrowheadLengthPt)',
  'ReadDouble(dict, "arrowheadWidthPt", style.ArrowheadWidthPt)'
]) {
  if (!taskPane.includes(snippet)) violations.push(`host style parsing missing: ${snippet}`);
}
for (const snippet of ["arrowheadLengthPt", "arrowheadWidthPt", "postHost({ type: \"updateParams\"", "postHost({ type: \"refreshSelection\""]) {
  if (!ui.includes(snippet)) violations.push(`task pane style wiring missing: ${snippet}`);
}
for (const snippet of ['name="arrowheadLengthPt"', 'name="arrowheadWidthPt"']) {
  if (!html.includes(snippet)) violations.push(`arrow control missing: ${snippet}`);
}

const baseStyle = { strokeWidthPt: 2, roughness: 0.8, bowing: 0.35, seed: 12, fillStyle: "none", arrowheadStyle: "rough", arrowheadPosition: "end" };
const extents = drawable => {
  const points = drawable.paths.filter(path => path.role !== generator.pathRoles.hitArea)
    .flatMap(path => path.segments ?? [])
    .flatMap(segment => segment.data ?? []);
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};
const defaultArrow = extents(generator.preview("msoShapeLineArrow", 260, 0, baseStyle));
const wideArrow = extents(generator.preview("msoShapeLineArrow", 260, 0, { ...baseStyle, arrowheadWidthPt: 24 }));
const shortArrow = JSON.stringify(generator.preview("msoShapeLineArrow", 260, 0, { ...baseStyle, arrowheadLengthPt: 7 }));
const longArrow = JSON.stringify(generator.preview("msoShapeLineArrow", 260, 0, { ...baseStyle, arrowheadLengthPt: 28 }));
if (defaultArrow.height > 24) violations.push(`default hand-drawn arrowhead is oversized: ${defaultArrow.height}`);
if (wideArrow.height < defaultArrow.height + 8) violations.push("arrowhead width does not independently change geometry");
if (shortArrow === longArrow) violations.push("arrowhead length does not independently change geometry");

if (violations.length) throw new Error(`Ribbon style realtime validation failed:\n${violations.join("\n")}`);
console.log(`Ribbon style realtime ok: default arrow ${defaultArrow.width.toFixed(1)}x${defaultArrow.height.toFixed(1)}`);
