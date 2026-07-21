import fs from "node:fs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const baseParams = {
  width: 160,
  height: 90,
  stroke: "#111111",
  strokeWidthPt: 2,
  roughness: 1.2,
  bowing: 1,
  seed: 12345,
  fillStyle: "none"
};
const validRoles = new Set(Object.values(generator.pathRoles));

function assertDrawable(name, drawable) {
  if (!drawable || !Array.isArray(drawable.paths) || drawable.paths.length === 0) {
    throw new Error(`no paths for ${name}`);
  }

  for (const path of drawable.paths) {
    if (!validRoles.has(path.role)) {
      throw new Error(`invalid path role for ${name}: ${path.role}`);
    }
    if (!Array.isArray(path.segments) || path.segments.length < 2) {
      throw new Error(`too few segments for ${name}`);
    }
    if (path.segments[0].type !== "move") {
      throw new Error(`path must start with move for ${name}`);
    }

    for (const segment of path.segments) {
      for (const value of segment.data ?? []) {
        if (!Number.isFinite(value)) throw new Error(`non-finite coordinate for ${name}`);
      }
    }
  }

  if (!drawable.paths.some(path => path.role === generator.pathRoles.hitArea && path.closed)) {
    throw new Error(`missing closed hitArea path for ${name}`);
  }
}

const primitiveShapes = ["line", "arrow", "rectangle", "ellipse", "diamond", "triangle", "trapezoid", "curve", "dashedBox", "doubleCircle"];
for (const shapeKind of primitiveShapes) {
  assertDrawable(shapeKind, generator.generate(shapeKind, baseParams));
}

function countMoves(drawable) {
  return drawable.paths.reduce((count, path) => count + path.segments.filter(segment => segment.type === "move").length, 0);
}

const rectangle = generator.preview("msoShapeRectangle", 160, 90, baseParams);
if (countMoves(rectangle) !== rectangle.paths.length) {
  throw new Error("normalized Rough paths must not contain mid-path move commands");
}
if (!rectangle.paths.some(path => path.role === generator.pathRoles.innerBoundary)) {
  throw new Error("closed Rough shapes must mark an inner boundary path");
}
if (!rectangle.paths.some(path => path.role === generator.pathRoles.hitArea)) {
  throw new Error("Rough generator must emit a hitArea role path");
}

const dashedLine = generator.preview("msoShapeLine", 160, 0, { ...baseParams, dashStyle: "dash" });
if (dashedLine.paths.length < 2) {
  throw new Error("dashed Rough line must be segmented before native Freeform insertion");
}

const hatchedRectangle = generator.preview("msoShapeRectangle", 160, 90, { ...baseParams, fillStyle: "hachure" });
if (!hatchedRectangle.paths.some(path => path.role === generator.pathRoles.texture)) {
  throw new Error("hachure fill must mark Rough texture paths");
}

const dashedBox = generator.generate("dashedBox", baseParams);
if (dashedBox.paths.length < 8) {
  throw new Error("dashedBox shapeKind must render as a dashed rough frame");
}

const doubleCircle = generator.generate("doubleCircle", baseParams);
if (doubleCircle.paths.length < 2) {
  throw new Error("doubleCircle shapeKind must render as two native rough oval paths");
}

const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8").replace(/^\uFEFF/, ""));
const categories = new Set();
for (const item of catalog.items) {
  const width = item.defaultSizePt?.width ?? 160;
  const height = Math.max(1, item.defaultSizePt?.height ?? 96);
  const drawable = generator.preview(item.enumName, width, height, baseParams);
  assertDrawable(item.enumName, drawable);
  categories.add(item.category);
}

for (const category of ["action-buttons", "arrows", "basic", "callouts", "flowchart", "lines", "rectangles", "stars-and-banners"]) {
  if (!categories.has(category)) throw new Error(`category not exercised: ${category}`);
}

console.log(`rough bridge ok: ${catalog.items.length} catalog shapes, ${categories.size} categories`);