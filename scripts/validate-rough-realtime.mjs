import { performance } from "node:perf_hooks";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const baseStyle = {
  stroke: "#111111",
  strokeWidthPt: 2,
  roughness: 1.2,
  bowing: 1,
  seed: 12345,
  fillStyle: "none",
  dashStyle: "solid",
  arrowheadStyle: "rough"
};

const resizeCases = [
  "msoShapeLine",
  "msoShapeLineArrow",
  "msoShapeRectangle",
  "msoShapeRoundedRectangle",
  "msoShapeOval",
  "msoShapeDiamond",
  "msoShapeDashedRectangle",
  "msoShapeFlowchartDecision",
  "msoShapeCurvedRightArrow",
  "msoShapeCloudCallout"
];

function maxCoordinate(drawable) {
  let max = 0;
  for (const path of drawable.paths ?? []) {
    for (const segment of path.segments ?? []) {
      for (const value of segment.data ?? []) {
        if (!Number.isFinite(value)) throw new Error("non-finite coordinate");
        max = Math.max(max, Math.abs(value));
      }
    }
  }
  return max;
}

function signature(drawable) {
  return (drawable.paths ?? [])
    .map(path => `${path.closed ? "c" : "o"}:${path.segments.map(segment => `${segment.type}:${segment.data.map(value => Math.round(value)).join(",")}`).join(";")}`)
    .join("|");
}

const timings = [];
for (const enumName of resizeCases) {
  const signatures = new Set();
  let previousMax = 0;

  for (let step = 0; step < 20; step++) {
    const width = 80 + step * 13;
    const height = enumName.includes("Line") ? step % 2 : 48 + step * 7;
    const started = performance.now();
    const drawable = generator.preview(enumName, width, height, { ...baseStyle, seed: baseStyle.seed + step });
    const elapsed = performance.now() - started;
    timings.push(elapsed);

    if (!drawable?.paths?.length) throw new Error(`no drawable for ${enumName}`);
    const currentMax = maxCoordinate(drawable);
    if (step > 0 && currentMax <= previousMax * 0.75) {
      throw new Error(`resize output did not scale naturally for ${enumName}`);
    }
    previousMax = currentMax;
    signatures.add(signature(drawable));
  }

  if (signatures.size < 12) {
    throw new Error(`resize output too static for ${enumName}: ${signatures.size} signatures`);
  }
}

timings.sort((a, b) => a - b);
const p95 = timings[Math.floor(timings.length * 0.95)];
const max = timings[timings.length - 1];
if (p95 > 200) {
  throw new Error(`rough realtime generation too slow: p95 ${p95.toFixed(1)}ms`);
}

console.log(`rough realtime ok: ${timings.length} regenerations, p95=${p95.toFixed(1)}ms, max=${max.toFixed(1)}ms`);