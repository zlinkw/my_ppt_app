import fs from "node:fs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8"));
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const ribbonGallery = fs.readFileSync("src/RoughPptAddin/ui/ribbon-shape-gallery.mjs", "utf8");
const violations = [];
const style = {
  stroke: "#111111",
  strokeWidthPt: 1.5,
  roughness: 0,
  bowing: 0,
  fillMode: "none",
  arrowheadPosition: "end"
};

function visibleIconPaths(drawable) {
  const roles = generator.pathRoles;
  const visible = (drawable.paths ?? []).filter(path =>
    path.role !== roles.hitArea &&
    path.role !== roles.innerFillBoundary);
  return visible.length ? visible : (drawable.paths ?? []).filter(path => path.role !== roles.hitArea);
}

for (const source of [
  ["app.mjs", app],
  ["ribbon-shape-gallery.mjs", ribbonGallery]
]) {
  const [label, text] = source;
  for (const snippet of [
    "function iconVisiblePaths(drawable)",
    "path.role !== roles.innerFillBoundary",
    "path.role !== roles.hitArea",
    "if (path.closed) ctx.closePath();",
    "ctx.fillStyle = \"transparent\""
  ]) {
    if (!text.includes(snippet)) violations.push(`${label}: missing complete icon preview contract ${snippet}`);
  }
}

let checked = 0;
const threeDVisibleCounts = new Map();
const threeDSignatures = new Map();
const threeDRoles = new Map();
for (const item of catalog.items ?? []) {
  if (item.insertable === false) continue;
  checked++;
  const size = item.defaultSizePt ?? {};
  const width = 24;
  const height = Math.max(6, Math.min(24, ((size.height || 80) / Math.max(1, size.width || 120)) * width));
  const drawable = generator.preview(item.enumName, width, height, style);
  const visible = visibleIconPaths(drawable);
  if (!visible.length) violations.push(`${item.enumName}: icon preview has no visible path`);
  if (/^rough3d/i.test(item.enumName)) {
    threeDVisibleCounts.set(item.enumName, visible.length);
    threeDSignatures.set(item.enumName, visible.map(path => `${path.closed}:${path.segments.length}`).join("|"));
    threeDRoles.set(item.enumName, visible.map(path => path.role).join("|"));
  }
  if (visible.length <= 1 && visible.every(path => path.closed && path.segments.length <= 5) &&
      /Cube|Can|Bevel|Donut|NoSymbol|ActionButton|Cloud|Sun|Smiley|Gear/i.test(item.enumName)) {
    violations.push(`${item.enumName}: complex icon preview degraded to a simple outer contour`);
  }
}

if ((catalog.items ?? []).filter(item => item.category === "three-d-rough").length < 6) {
  violations.push("three-d rough group must contain at least 6 icon previews");
}
if ((catalog.items ?? []).filter(item => item.category === "three-d-plain").length < 6) {
  violations.push("three-d plain group must contain at least 6 icon previews");
}

for (const enumName of [
  "rough3dCubeRough",
  "rough3dCylinderRough",
  "rough3dConeRough",
  "rough3dSphereRough",
  "rough3dPyramidRough",
  "rough3dStackRough"
]) {
  if ((threeDVisibleCounts.get(enumName) ?? 0) < 2) violations.push(`${enumName}: 3D icon must include internal visible structure`);
  const plainName = enumName.replace(/Rough$/, "Plain");
  if (!String(threeDRoles.get(enumName) ?? "").includes(generator.pathRoles.outerJitter) &&
      threeDSignatures.get(enumName) === threeDSignatures.get(plainName)) {
    violations.push(`${enumName}: rough 3D preview must differ from plain geometry`);
  }
  if ((threeDVisibleCounts.get(enumName) ?? 0) < (threeDVisibleCounts.get(plainName) ?? 0)) {
    violations.push(`${enumName}: rough 3D must preserve plain 3D internal structure`);
  }
  const solid = generator.preview(enumName, 32, 24, { ...style, dashStyle: "solid" });
  const dashed = generator.preview(enumName, 32, 24, { ...style, dashStyle: "dash" });
  const signature = drawable => visibleIconPaths(drawable).map(path => `${path.role}:${path.closed}:${path.segments.length}`).join("|");
  if (signature(solid) !== signature(dashed)) {
    violations.push(`${enumName}: 3D structure must not change into a dashed-line substitute when dashStyle is dash`);
  }
}

if (checked < 202) violations.push(`too few insertable icon previews checked: ${checked}`);

if (violations.length) {
  throw new Error(`gallery icon preview validation failed:\n${violations.join("\n")}`);
}

console.log(`gallery icon preview ok: ${checked} shapes`);
