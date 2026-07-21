import fs from "node:fs";
import { generator } from "../src/RoughPptAddin/ui/rough-shape-generator.mjs";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: node scripts/generate-native-catalog-smoke-data.mjs <output.json>");
}

const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8").replace(/^\uFEFF/, ""));
const style = {
  stroke: "#111111",
  strokeWidthPt: 1.5,
  roughness: 1.2,
  bowing: 1,
  seed: 12345,
  fillStyle: "none"
};

function signature(drawable) {
  const pathCount = drawable.paths.length;
  const segmentCounts = drawable.paths.map(path => path.segments.length).join(".");
  const firstEnd = drawable.paths
    .slice(0, 3)
    .map(path => {
      const last = path.segments[path.segments.length - 1];
      return `${last.type}:${(last.data ?? []).map(value => Math.round(value)).join(",")}`;
    })
    .join("|");
  return `${pathCount}:${segmentCounts}:${firstEnd}`;
}

function pathBounds(drawable) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let pointCount = 0;

  const includePoint = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    pointCount++;
  };

  const includeCubic = (from, data) => {
    const [x1, y1, x2, y2, x3, y3] = data.map(Number);
    if (!from || ![x1, y1, x2, y2, x3, y3].every(Number.isFinite)) return;
    for (let step = 0; step <= 24; step++) {
      const t = step / 24;
      const mt = 1 - t;
      const x = mt ** 3 * from[0] + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3;
      const y = mt ** 3 * from[1] + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3;
      includePoint(x, y);
    }
  };

  for (const path of drawable.paths ?? []) {
    let current = null;
    for (const segment of path.segments ?? []) {
      const data = segment.data ?? [];
      if ((segment.type === "move" || segment.type === "line") && data.length >= 2) {
        current = [Number(data[0]), Number(data[1])];
        includePoint(current[0], current[1]);
      } else if (segment.type === "curve" && data.length >= 6) {
        includeCubic(current, data);
        current = [Number(data[4]), Number(data[5])];
      }
    }
  }

  if (!pointCount) {
    throw new Error("drawable has no measurable points");
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

const items = catalog.items.map((item, index) => {
  const width = item.defaultSizePt?.width > 0 ? item.defaultSizePt.width : 120;
  const height = item.defaultSizePt?.height ?? 80;
  const request = {
    AssetId: `smoke-catalog-${item.enumName}`,
    SourceMsoType: item.enumName,
    ShapeKind: generator.kindFromMso(item.enumName),
    Left: 72 + (index % 4) * 160,
    Top: 72 + Math.floor((index % 16) / 4) * 110,
    Width: width,
    Height: height,
    Style: style
  };
  const drawable = generator.generateFromHost(request);
  return {
    enumName: item.enumName,
    request,
    drawable,
    signature: signature(drawable),
    bounds: pathBounds(drawable)
  };
});

const distinctSignatures = new Set(items.map(item => item.signature)).size;
if (items.length < 150) throw new Error(`catalog too small: ${items.length}`);
if (distinctSignatures < 40) throw new Error(`rough output too uniform: ${distinctSignatures} distinct signatures`);

fs.writeFileSync(outputPath, JSON.stringify({ items, distinctSignatures }, null, 2));
console.log(`generated ${items.length} real Rough drawables with ${distinctSignatures} signatures`);