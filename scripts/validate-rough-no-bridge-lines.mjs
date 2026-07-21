import fs from "node:fs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const catalog = JSON.parse(fs.readFileSync("src/RoughPptAddin/ui/autoshape-catalog.json", "utf8")).items ?? [];
const style = { strokeWidthPt: 2, roughness: 0.8, bowing: 0.35, seed: 12345, fillStyle: "none" };
const violations = [];

for (const item of catalog.filter(item => item.insertable !== false)) {
  const size = item.defaultSizePt ?? {};
  const width = Number(size.width ?? 180);
  const height = Math.max(1, Number(size.height ?? 100));
  const drawable = generator.preview(item.enumName, width, height, style);
  const visible = drawable.paths.filter(path => path.role !== generator.pathRoles.hitArea && path.role !== generator.pathRoles.innerFillBoundary);

  for (const [pathIndex, path] of visible.entries()) {
    const moves = (path.segments ?? []).filter(segment => segment.type === "move").length;
    if (moves !== 1) {
      violations.push(`${item.enumName}: path ${pathIndex + 1} has ${moves} move commands`);
    }
    if (hasInteriorClosedContour(path)) {
      violations.push(`${item.enumName}: path ${pathIndex + 1} contains a bridged nested contour`);
    }
  }
}

if (violations.length) {
  throw new Error(`rough bridge-line validation failed:\n${violations.slice(0, 80).join("\n")}`);
}

console.log("rough bridge-line validation ok");

function hasInteriorClosedContour(path) {
  const points = pathPoints(path);
  if (points.length < 5) return false;
  const first = points[0];
  const epsilon = contourEpsilon(points);
  for (let index = 3; index < points.length - 1; index++) {
    if (pointDistance(first, points[index]) <= epsilon) return true;
  }
  return false;
}

function pathPoints(path) {
  const points = [];
  for (const segment of path.segments ?? []) {
    if (segment.type === "move" && segment.data?.length >= 2) points.push([segment.data[0], segment.data[1]]);
    if (segment.type === "line" && segment.data?.length >= 2) points.push([segment.data[0], segment.data[1]]);
    if (segment.type === "curve" && segment.data?.length >= 6) points.push([segment.data[4], segment.data[5]]);
  }
  return points;
}

function contourEpsilon(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.max(0.75, diagonal * 0.004);
}

function pointDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}