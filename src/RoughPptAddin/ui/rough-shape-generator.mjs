import rough from "./vendor/rough.esm.js";
import { officePresetOutlines } from "./office-preset-outlines.mjs";

const roughGenerator = rough.generator();
const TAU = Math.PI * 2;
const PATH_ROLES = Object.freeze({
  innerFillBoundary: "innerFillBoundary",
  innerBoundary: "innerBoundary",
  outerJitter: "outerJitter",
  texture: "texture",
  hitArea: "hitArea"
});

function options(style = {}, tuning = {}) {
  const fillStyle = tuning.fillStyle ?? style.fillStyle ?? style.FillStyle;
  const includeFill = Boolean(tuning.includeFill);
  const roughFillStyle = includeFill && !isBrushFillStyle({ ...style, fillStyle }) ? fillStyle : "none";
  const dash = lineDash(style.dashStyle ?? style.DashStyle);
  const source = tuning.source ?? roughSource(style);
  const rawRough = tuning.source ? ["roughjs", "excalidraw", "drawio", "d2"].includes(String(source).toLowerCase()) : usesRawRoughStrokes(style);
  const sourceDefaults = roughSourceDefaults(source);
  const strokePasses = Number(style.strokePasses ?? style.StrokePasses ?? tuning.strokePasses ?? sourceDefaults.strokePasses);
  const result = {
    stroke: style.stroke ?? style.Stroke ?? "#111111",
    strokeWidth: readNumber(style, ["strokeWidth", "strokeWidthPt", "StrokeWidthPt"], sourceDefaults.strokeWidth),
    roughness: readNumber(style, ["roughness", "Roughness"], sourceDefaults.roughness),
    bowing: readNumber(style, ["bowing", "Bowing"], sourceDefaults.bowing),
    seed: readNumber(style, ["seed", "Seed"], sourceDefaults.seed),
    maxRandomnessOffset: readNumber(style, ["maxRandomnessOffset", "MaxRandomnessOffset"], sourceDefaults.maxRandomnessOffset),
    preserveVertices: readBool(style, ["preserveVertices", "PreserveVertices"], sourceDefaults.preserveVertices),
    disableMultiStroke: readBool(style, ["disableMultiStroke", "DisableMultiStroke"], rawRough ? sourceDefaults.disableMultiStroke : strokePasses <= 1),
    disableMultiStrokeFill: readBool(style, ["disableMultiStrokeFill", "DisableMultiStrokeFill"], sourceDefaults.disableMultiStrokeFill),
    curveFitting: readNumber(style, ["curveFitting", "CurveFitting"], sourceDefaults.curveFitting),
    fillWeight: readNumber(style, ["fillWeight", "FillWeight"], sourceDefaults.fillWeight),
    hachureGap: readNumber(style, ["hachureGap", "HachureGap"], sourceDefaults.hachureGap),
    fill: roughFillStyle && roughFillStyle !== "none" ? (style.fillColor ?? style.FillColor ?? "rgba(0,0,0,0.05)") : undefined,
    fillStyle: roughFillStyle && roughFillStyle !== "none" ? roughFillStyle : undefined,
    strokeLineDash: dash.length ? dash : undefined
  };
  if (!Number.isFinite(result.fillWeight)) delete result.fillWeight;
  if (!Number.isFinite(result.hachureGap)) delete result.hachureGap;
  return result;
}

function readNumber(style, names, fallback) {
  for (const name of names) {
    if (style[name] !== undefined && style[name] !== null && style[name] !== "") {
      const parsed = Number(style[name]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}

function readBool(style, names, fallback) {
  for (const name of names) {
    const value = style[name];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value).trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
  }

  return fallback;
}

function roughSource(style = {}) {
  const explicit = String(style.roughSource ?? style.RoughSource ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  return usesRawRoughStrokes(style) ? "roughjs" : "native";
}

function fillSource(style = {}) {
  const explicit = String(style.fillSource ?? style.FillSource ?? "auto").trim().toLowerCase();
  if (explicit && explicit !== "auto") return explicit;
  if (isBrushFillStyle(style)) return "brush";
  return roughSource(style);
}

function fillTextureStyle(style = {}) {
  const value = String(style.fillStyle ?? style.FillStyle ?? "none").trim().toLowerCase();
  return value || "none";
}

function roughSourceDefaults(source) {
  switch (source) {
    case "roughjs":
      return {
        strokeWidth: 1,
        roughness: 1,
        bowing: 1,
        seed: 0,
        maxRandomnessOffset: 2,
        preserveVertices: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        curveFitting: 0.95,
        fillWeight: -1,
        hachureGap: -1,
        strokePasses: 2
      };
    case "excalidraw":
      return {
        strokeWidth: 2,
        roughness: 1,
        bowing: 1,
        seed: 1,
        maxRandomnessOffset: 2,
        preserveVertices: true,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        curveFitting: 1,
        fillWeight: 1,
        hachureGap: 8,
        strokePasses: 2
      };
    case "drawio":
      return {
        strokeWidth: 2,
        roughness: 2,
        bowing: 1,
        seed: 1,
        maxRandomnessOffset: 2,
        preserveVertices: true,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        curveFitting: 1,
        fillWeight: -1,
        hachureGap: -1,
        strokePasses: 2
      };
    case "d2":
      return {
        strokeWidth: 2,
        roughness: 1,
        bowing: 2,
        seed: 1,
        maxRandomnessOffset: 2,
        preserveVertices: false,
        disableMultiStroke: false,
        disableMultiStrokeFill: false,
        curveFitting: 0.95,
        fillWeight: 2,
        hachureGap: 16,
        strokePasses: 2
      };
    default:
      return {
        strokeWidth: 2,
        roughness: 0.8,
        bowing: 0.35,
        seed: 12345,
        maxRandomnessOffset: 1.35,
        preserveVertices: true,
        disableMultiStroke: false,
        disableMultiStrokeFill: true,
        curveFitting: 0.95,
        fillWeight: -1,
        hachureGap: -1,
        strokePasses: 2
      };
  }
}

function pathStyle(style = {}) {
  return {
    stroke: style.stroke ?? style.Stroke ?? "#111111",
    strokeWidthPt: Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2)
  };
}

function normalizeDrawable(drawable, style = {}, role = PATH_ROLES.outerJitter, closedPath = false, preserveMoveBreaks = false) {
  const paths = [];
  const baseStyle = pathStyle(style);
  const mergeDistance = preserveMoveBreaks ? 0 : moveMergeDistance(drawable);

  for (const set of drawable.sets ?? []) {
    let path = null;
    let currentEnd = null;
    const pathRole = roleForSet(set, role);
    const startPath = data => {
      path = {
        closed: false,
        stroke: baseStyle.stroke,
        strokeWidthPt: baseStyle.strokeWidthPt,
        role: pathRole,
        segments: [{ type: "move", data }]
      };
      currentEnd = [data[0], data[1]];
    };
    const finishPath = () => {
      if (path?.segments?.length > 1) {
        path.closed = pathClosedBySegments(path);
        paths.push(path);
      }
      path = null;
      currentEnd = null;
    };

    for (const op of set.ops ?? []) {
      const data = Array.from(op.data ?? []).map(Number);
      if (op.op === "move") {
        if (path && currentEnd && pointDistance(currentEnd, data) <= mergeDistance) {
          path.segments.push({ type: "line", data });
          currentEnd = [data[0], data[1]];
          continue;
        }

        if (path) finishPath();
        startPath(data);
        continue;
      }
      if (!path && data.length >= 2) startPath([data[0], data[1]]);
      if (op.op === "lineTo") {
        path.segments.push({ type: "line", data });
        currentEnd = segmentEnd(data);
      }
      if (op.op === "bcurveTo") {
        path.segments.push({ type: "curve", data });
        currentEnd = segmentEnd(data);
      }
      if (op.op === "qcurveTo" && data.length >= 4) {
        const curve = [data[0], data[1], data[2], data[3], data[2], data[3]];
        path.segments.push({ type: "curve", data: curve });
        currentEnd = segmentEnd(curve);
      }
    }

    finishPath();
  }

  return { paths };
}

function segmentEnd(data) {
  if (!data || data.length < 2) return [0, 0];
  if (data.length >= 6) return [data[4], data[5]];
  return [data[data.length - 2], data[data.length - 1]];
}

function moveMergeDistance(drawable) {
  const points = [];
  for (const set of drawable?.sets ?? []) {
    for (const op of set.ops ?? []) {
      const data = Array.from(op.data ?? []).map(Number);
      for (let i = 0; i + 1 < data.length; i += 2) points.push([data[i], data[i + 1]]);
    }
  }

  if (!points.length) return 8;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.max(4, Math.min(16, diagonal * 0.08));
}

function roleForSet(set, fallbackRole) {
  if (set?.type === "fillSketch") return PATH_ROLES.texture;
  if (set?.type === "fillPath") return PATH_ROLES.innerFillBoundary;
  return fallbackRole;
}

function pathClosedBySegments(path) {
  const segments = path?.segments ?? [];
  if (segments.length < 3) return false;
  const first = segments[0]?.data;
  const last = segments[segments.length - 1]?.data;
  if (!first || !last || first.length < 2 || last.length < 2) return false;
  return Math.hypot(first[0] - last[last.length - 2], first[1] - last[last.length - 1]) < 0.75;
}

function lineDash(dashStyle) {
  if (dashStyle === "dash") return [10, 6];
  if (dashStyle === "dot") return [2, 5];
  if (dashStyle === "dash-dot") return [10, 5, 2, 5];
  return [];
}

function arrowheadStyle(style = {}) {
  return (style.arrowheadStyle ?? style.ArrowheadStyle ?? "rough").toLowerCase();
}

function arrowheadPosition(style = {}) {
  const value = (style.arrowheadPosition ?? style.ArrowheadPosition ?? "end").toLowerCase();
  return value === "start" || value === "both" ? value : "end";
}

function arrowheadMetrics(style = {}, width, height) {
  const available = Math.max(4, Math.abs(Number(width) || 0));
  const length = Math.max(4, Math.min(40, readNumber(style, ["arrowheadLengthPt", "ArrowheadLengthPt"], 14)));
  const configuredWidth = Math.max(4, Math.min(32, readNumber(style, ["arrowheadWidthPt", "ArrowheadWidthPt"], 10)));
  return {
    length: Math.min(length, Math.max(4, available * 0.35)),
    width: configuredWidth,
    height: Math.max(configuredWidth, Math.abs(Number(height) || 0))
  };
}

function combine(...drawables) {
  return { paths: drawables.flatMap(drawable => drawable?.paths ?? []) };
}

function hitAreaPath(width, height, style = {}) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Math.abs(Number(height)) || 1);
  return {
    closed: true,
    stroke: style.stroke ?? style.Stroke ?? "#111111",
    strokeWidthPt: 0,
    role: PATH_ROLES.hitArea,
    segments: [
      { type: "move", data: [0, 0] },
      { type: "line", data: [w, 0] },
      { type: "line", data: [w, h] },
      { type: "line", data: [0, h] }
    ]
  };
}

function withHitArea(drawable, width, height, style = {}) {
  const paths = [...(drawable?.paths ?? [])];
  if (!paths.some(path => path.role === PATH_ROLES.hitArea)) {
    paths.push(hitAreaPath(width, height, style));
  }
  return { paths };
}

function roughLine(x1, y1, x2, y2, style, tuning = {}) {
  return withNativeBoundary(
    normalizeDrawable(roughGenerator.line(x1, y1, x2, y2, options(style, tuning)), style, PATH_ROLES.outerJitter, false, usesRawRoughStrokes(style)),
    boundaryFromPoints([[x1, y1], [x2, y2]], style, false),
    style);
}

function roughPath(d, style, tuning = {}) {
  const rough = tuning.nativeOnly
    ? { paths: [] }
    : normalizeDrawable(roughGenerator.path(d, options(style, tuning)), style, PATH_ROLES.outerJitter, /\bZ\b/i.test(d), usesRawRoughStrokes(style));
  return withNativeBoundary(rough, boundaryFromPathData(d, style), style);
}

function roughPolygon(points, style, tuning = {}) {
  return withNativeBoundary(
    normalizeDrawable(roughGenerator.polygon(points, options(style, tuning)), style, PATH_ROLES.outerJitter, true, usesRawRoughStrokes(style)),
    boundaryFromPoints(points, style, true),
    style);
}

function roughRect(x, y, w, h, style) {
  return withNativeBoundary(
    normalizeDrawable(roughGenerator.rectangle(x, y, w, h, options(style)), style, PATH_ROLES.outerJitter, true, usesRawRoughStrokes(style)),
    boundaryFromPoints([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], style, true),
    style);
}

function roughEllipse(cx, cy, w, h, style) {
  return withNativeBoundary(
    normalizeDrawable(roughGenerator.ellipse(cx, cy, w, h, options(style)), style, PATH_ROLES.outerJitter, true, usesRawRoughStrokes(style)),
    boundaryFromEllipse(cx, cy, w, h, style),
    style);
}

function roughArc(cx, cy, w, h, start, stop, closed, style) {
  return withNativeBoundary(
    normalizeDrawable(roughGenerator.arc(cx, cy, w, h, start, stop, closed, options(style)), style, PATH_ROLES.outerJitter, closed, usesRawRoughStrokes(style)),
    boundaryFromPoints(arcPoints(cx, cy, w / 2, h / 2, start, stop, 28), style, Boolean(closed)),
    style);
}

function nativePath(d, style) {
  return withNativeBoundary({ paths: [] }, boundaryFromPathData(d, style), style);
}

function nativeLine(x1, y1, x2, y2, style) {
  return withNativeBoundary({ paths: [] }, boundaryFromPoints([[x1, y1], [x2, y2]], style, false), style);
}

function nativePolygon(points, style) {
  return withNativeBoundary({ paths: [] }, boundaryFromPoints(points, style, true), style);
}

function nativeRect(x, y, w, h, style) {
  return nativePolygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], style);
}

function nativeEllipse(cx, cy, w, h, style) {
  return withNativeBoundary({ paths: [] }, boundaryFromEllipse(cx, cy, w, h, style), style);
}

function dims(width, height, fallbackHeight = 80) {
  return {
    w: Math.max(1, Number(width) || 1),
    h: Math.max(1, Math.abs(Number(height)) || fallbackHeight)
  };
}

function cleanMso(enumName = "") {
  return String(enumName).replace(/^msoShape/i, "");
}

function pathFromPoints(points, close = true) {
  const [first, ...rest] = points;
  const body = rest.map(([x, y]) => `L ${x} ${y}`).join(" ");
  return `M ${first[0]} ${first[1]} ${body}${close ? " Z" : ""}`;
}

function roundedRectPath(w, h) {
  const r = Math.min(w, h) * 0.18;
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function regularPolygonPoints(sides, w, h, rotation = -Math.PI / 2) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return Array.from({ length: sides }, (_, index) => {
    const a = rotation + (TAU * index) / sides;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

function starPoints(points, w, h, innerRatio = 0.45, rotation = -Math.PI / 2) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return Array.from({ length: points * 2 }, (_, index) => {
    const outer = index % 2 === 0;
    const a = rotation + (TAU * index) / (points * 2);
    return [cx + Math.cos(a) * rx * (outer ? 1 : innerRatio), cy + Math.sin(a) * ry * (outer ? 1 : innerRatio)];
  });
}

function gearPoints(teeth, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return Array.from({ length: teeth * 4 }, (_, index) => {
    const phase = index % 4;
    const radius = phase === 0 || phase === 3 ? 1 : 0.72;
    const a = -Math.PI / 2 + (TAU * index) / (teeth * 4);
    return [cx + Math.cos(a) * rx * radius, cy + Math.sin(a) * ry * radius];
  });
}

function arcPoints(cx, cy, rx, ry, start, stop, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = start + ((stop - start) * index) / steps;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });
}

function sectorPoints(w, h, start, stop, steps = 26) {
  return [[w / 2, h / 2], ...arcPoints(w / 2, h / 2, w / 2, h / 2, start, stop, steps)];
}

function chordPoints(w, h, start, stop, steps = 28) {
  return arcPoints(w / 2, h / 2, w / 2, h / 2, start, stop, steps);
}

function blockArcPoints(w, h) {
  const start = -Math.PI * 0.78;
  const stop = Math.PI * 0.42;
  const outer = arcPoints(w / 2, h / 2, w / 2, h / 2, start, stop, 30);
  const inner = arcPoints(w / 2, h / 2, w * 0.28, h * 0.28, stop, start, 30);
  return [...outer, ...inner];
}

function pointDistance(a, b) {
  return Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));
}

function boundaryStyle(style = {}, role = PATH_ROLES.innerFillBoundary, closed = true) {
  const baseStyle = pathStyle(style);
  return {
    closed,
    stroke: baseStyle.stroke,
    strokeWidthPt: baseStyle.strokeWidthPt,
    role,
    segments: []
  };
}

function boundaryFromPoints(points, style, closed = true) {
  if (!points?.length) return null;
  const path = boundaryStyle(style, PATH_ROLES.innerBoundary, closed);
  path.segments.push({ type: "move", data: points[0] });
  for (const point of points.slice(1)) path.segments.push({ type: "line", data: point });
  return path;
}

function boundaryFromEllipse(cx, cy, w, h, style) {
  const k = 0.5522847498307936;
  const rx = w / 2;
  const ry = h / 2;
  const path = boundaryStyle(style, PATH_ROLES.innerBoundary, true);
  path.segments.push({ type: "move", data: [cx + rx, cy] });
  path.segments.push({ type: "curve", data: [cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry] });
  path.segments.push({ type: "curve", data: [cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy] });
  path.segments.push({ type: "curve", data: [cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry] });
  path.segments.push({ type: "curve", data: [cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy] });
  return path;
}

function boundaryFromPathData(d, style) {
  const tokens = String(d ?? "").match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) ?? [];
  if (!tokens.length) return null;
  const path = boundaryStyle(style, PATH_ROLES.innerBoundary, /[zZ]\s*$/.test(String(d).trim()));
  let index = 0;
  let command = "";
  let current = [0, 0];
  let start = [0, 0];

  const isCommand = token => /^[A-Za-z]$/.test(token);
  const number = () => Number(tokens[index++]);
  const point = relative => {
    const x = number();
    const y = number();
    return relative ? [current[0] + x, current[1] + y] : [x, y];
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (upper === "M") {
      current = point(relative);
      start = current;
      path.segments.push({ type: "move", data: current });
      command = relative ? "l" : "L";
      continue;
    }
    if (upper === "L") {
      current = point(relative);
      path.segments.push({ type: "line", data: current });
      continue;
    }
    if (upper === "H") {
      const x = number();
      current = [relative ? current[0] + x : x, current[1]];
      path.segments.push({ type: "line", data: current });
      continue;
    }
    if (upper === "V") {
      const y = number();
      current = [current[0], relative ? current[1] + y : y];
      path.segments.push({ type: "line", data: current });
      continue;
    }
    if (upper === "C") {
      const c1 = point(relative);
      const c2 = point(relative);
      current = point(relative);
      path.segments.push({ type: "curve", data: [c1[0], c1[1], c2[0], c2[1], current[0], current[1]] });
      continue;
    }
    if (upper === "Q") {
      const q = point(relative);
      const end = point(relative);
      const c1 = [current[0] + (2 / 3) * (q[0] - current[0]), current[1] + (2 / 3) * (q[1] - current[1])];
      const c2 = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])];
      current = end;
      path.segments.push({ type: "curve", data: [c1[0], c1[1], c2[0], c2[1], current[0], current[1]] });
      continue;
    }
    if (upper === "Z") {
      current = start;
      path.closed = true;
      break;
    }

    return null;
  }

  return path.segments.length > (path.closed ? 2 : 1) ? path : null;
}

function cloneBoundary(boundary, role) {
  if (!boundary) return null;
  return {
    ...boundary,
    role,
    segments: boundary.segments.map(segment => ({ ...segment, data: [...segment.data] }))
  };
}

function isNestedMode(style = {}) {
  const mode = String(style.roughMode ?? style.RoughMode ?? "classic").toLowerCase();
  return mode === "nested";
}

function isBrushFillStyle(style = {}) {
  const fillStyle = String(style.fillStyle ?? style.FillStyle ?? "none").trim().toLowerCase();
  const source = String(style.fillSource ?? style.FillSource ?? "auto").trim().toLowerCase();
  return fillStyle === "brush" || source === "brush";
}

function usesRawRoughStrokes(style = {}) {
  return String(style.roughEngine ?? style.RoughEngine ?? "nativeWarp").trim().toLowerCase() === "roughjs";
}

function usesTldrawSource(style = {}) {
  return roughSource(style) === "tldraw";
}

function visibleBoundaryFrom(boundary, style) {
  const visible = cloneBoundary(boundary, PATH_ROLES.innerBoundary);
  visible.segments = lightlyWarpBoundarySegments(boundary, style);
  return visible;
}

function visibleBoundaryPassesFrom(boundary, style) {
  if (usesTldrawSource(style)) return tldrawBoundaryPassesFrom(boundary, style);
  const passes = Math.max(1, Math.min(4, Math.round(Number(style.strokePasses ?? style.StrokePasses ?? 1))));
  const baseSeed = Number(style.seed ?? style.Seed ?? 12345);
  const result = [];
  for (let pass = 0; pass < passes; pass++) {
    const passStyle = pass === 0 ? style : {
      ...style,
      seed: baseSeed + pass * 7919,
      edgeJitterPt: boundaryJitterAmplitude(boundary.segments ?? [], style) * (1 + pass * 0.12)
    };
    const visible = visibleBoundaryFrom(boundary, passStyle);
    visible.role = pass === 0 ? PATH_ROLES.innerBoundary : PATH_ROLES.outerJitter;
    result.push(visible);
  }

  result.push(...fragmentStrokePathsFrom(boundary, style));
  return result;
}

function tldrawBoundaryPassesFrom(boundary, style = {}) {
  const passes = Math.max(1, Math.min(4, Math.round(Number(style.strokePasses ?? style.StrokePasses ?? 2))));
  const strokeWidth = Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2);
  const defaultOffset = Math.max(0.25, strokeWidth / 3);
  const offset = Number(style.tldrawOffsetPt ?? style.TldrawOffsetPt ?? defaultOffset);
  const baseSeed = Number(style.seed ?? style.Seed ?? 12345);
  const result = [];
  for (let pass = 0; pass < passes; pass++) {
    const passStyle = {
      ...style,
      seed: baseSeed + pass,
      edgeJitterPt: offset * (pass === 0 ? 0.95 : 1.18)
    };
    const visible = visibleBoundaryFrom(boundary, passStyle);
    visible.role = pass === 0 ? PATH_ROLES.innerBoundary : PATH_ROLES.outerJitter;
    result.push(visible);
  }

  result.push(...fragmentStrokePathsFrom(boundary, style));
  return result;
}

function fragmentStrokePathsFrom(boundary, style = {}) {
  const density = Math.max(0, Math.min(3, Number(style.fragmentStrokeDensity ?? style.FragmentStrokeDensity ?? 0)));
  if (density <= 0.05) return [];
  const segments = boundary?.segments ?? [];
  if (segments.length < 2) return [];

  const amplitude = boundaryJitterAmplitude(segments, style) * (0.35 + density * 0.14);
  const targetLength = Math.max(8, 22 - density * 4);
  const fragments = [];
  let currentPoint = segmentEnd(segments[0].data);
  for (let index = 1; index < segments.length; index++) {
    const segment = segments[index];
    const end = segmentEnd(segment.data);
    const length = pointDistance(currentPoint, end);
    if (length >= 8) {
      const count = Math.max(1, Math.min(12, Math.floor(length / targetLength) + Math.round(density)));
      for (let fragment = 0; fragment < count; fragment++) {
        const t = (fragment + 0.5) / count;
        const span = Math.min(0.42, 0.18 + density * 0.05);
        const startT = Math.max(0, t - span / 2);
        const endT = Math.min(1, t + span / 2);
        const start = interpolatePoint(currentPoint, end, startT);
        const stop = interpolatePoint(currentPoint, end, endT);
        const warpedStart = offsetFragmentPoint(start, currentPoint, end, amplitude, style, index * 101 + fragment * 7);
        const warpedStop = offsetFragmentPoint(stop, currentPoint, end, amplitude, style, index * 103 + fragment * 11);
        fragments.push({
          closed: false,
          stroke: style.stroke ?? style.Stroke ?? "#111111",
          strokeWidthPt: Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2),
          role: PATH_ROLES.outerJitter,
          segments: [
            { type: "move", data: warpedStart },
            { type: "line", data: warpedStop }
          ]
        });
      }
    }
    currentPoint = end;
  }

  return fragments;
}

function fillTexturePathsFrom(boundary, style = {}) {
  const polygon = boundaryEndPoints(boundary);
  if (!boundary?.closed || polygon.length < 3) return [];
  if (isBrushFillStyle(style)) return brushFillTexturePathsFrom(boundary, style);

  const textureStyle = fillTextureStyle(style);
  if (!textureStyle || textureStyle === "none" || textureStyle === "solid") return [];
  return roughFillTexturePathsFrom(boundary, style, textureStyle, fillSource(style));
}

function roughFillTexturePathsFrom(boundary, style = {}, textureStyle = "hachure", source = "roughjs") {
  const points = boundaryTexturePoints(boundary);
  if (points.length < 3) return [];
  const fillDefaults = roughSourceDefaults(source === "auto" ? roughSource(style) : source);
  const textureOptions = options(style, {
    includeFill: true,
    source,
    fillStyle: textureStyle,
    strokePasses: fillDefaults.strokePasses
  });
  textureOptions.stroke = "none";
  textureOptions.fill = style.fillColor ?? style.FillColor ?? "#111111";
  textureOptions.fillStyle = textureStyle;
  textureOptions.fillWeight = readNumber(style, ["fillWeight", "FillWeight"], fillDefaults.fillWeight);
  textureOptions.hachureGap = readNumber(style, ["hachureGap", "HachureGap"], fillDefaults.hachureGap);
  if (!Number.isFinite(textureOptions.fillWeight)) delete textureOptions.fillWeight;
  if (!Number.isFinite(textureOptions.hachureGap)) delete textureOptions.hachureGap;

  const drawable = normalizeDrawable(roughGenerator.polygon(points, textureOptions), style, PATH_ROLES.texture, true, true);
  const stroke = style.fillColor ?? style.FillColor ?? "#111111";
  const strokeWidthPt = Math.max(0.35, textureOptions.fillWeight > 0
    ? textureOptions.fillWeight
    : Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2) * 0.5);
  return drawable.paths
    .filter(path => path.role === PATH_ROLES.texture)
    .map(path => ({
      ...path,
      closed: false,
      stroke,
      strokeWidthPt,
      segments: path.segments.map(segment => ({ ...segment, data: [...segment.data] }))
    }));
}

function brushFillTexturePathsFrom(boundary, style = {}) {
  if (!boundary?.closed) return [];
  const polygon = brushPolygonPoints(boundary);
  if (polygon.length < 3) return [];
  const bounds = rectFromPoints(polygon);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width < 6 || height < 6) return [];

  const density = Math.max(0.3, Math.min(2.5, Number(style.brushDensity ?? style.BrushDensity ?? 1)));
  const brushWidth = Math.max(1, Math.min(24, Number(style.brushWidthPt ?? style.BrushWidthPt ?? Math.max(3, Number(style.strokeWidthPt ?? style.StrokeWidthPt ?? 2) * 2.5))));
  const overlap = Math.max(0, Math.min(0.9, Number(style.brushOverlap ?? style.BrushOverlap ?? 0.35)));
  const baseSeed = Number(style.seed ?? style.Seed ?? 12345);
  const stroke = style.fillColor ?? style.FillColor ?? style.stroke ?? style.Stroke ?? "#111111";
  const baseAngle = (Number(style.brushAngleDeg ?? style.BrushAngleDeg ?? -8) * Math.PI) / 180;
  const jitter = Math.max(0, Math.min(8, Number(style.brushJitterPt ?? style.BrushJitterPt ?? boundaryJitterAmplitude(boundary.segments ?? [], style) * 0.5)));
  const tangent = [Math.cos(baseAngle), Math.sin(baseAngle)];
  const normal = [-Math.sin(baseAngle), Math.cos(baseAngle)];
  const projections = polygon.map(point => dotPoint(point, normal));
  const minV = Math.min(...projections);
  const maxV = Math.max(...projections);
  const spacing = Math.max(brushWidth * 0.42, brushWidth * (1.22 - overlap * 0.72) / density);
  const maxPaths = 96;
  const paths = [];
  let scanIndex = 0;
  for (let v = minV - spacing * 0.35; v <= maxV + spacing * 0.35 && paths.length < maxPaths; v += spacing, scanIndex++) {
    const scanJitter = signedJitter(style, scanIndex * 157 + 11, v, maxV, Math.min(jitter, spacing * 0.32));
    const intersections = scanlineIntersections(polygon, tangent, normal, v + scanJitter);
    for (let index = 0; index + 1 < intersections.length && paths.length < maxPaths; index += 2) {
      const left = intersections[index];
      const right = intersections[index + 1];
      const length = right - left;
      if (length < brushWidth * 1.6) continue;
      const inset = Math.min(length * 0.22, brushWidth * (0.46 + deterministicUnit(baseSeed, scanIndex * 41 + index) * 0.34));
      const tailJitter = signedJitter(style, scanIndex * 173 + index, left, right, Math.min(jitter, length * 0.035));
      const startU = left + inset + tailJitter;
      const stopU = right - inset + signedJitter(style, scanIndex * 179 + index, right, left, Math.min(jitter, length * 0.035));
      if (stopU - startU < brushWidth * 1.2) continue;
      paths.push(brushStrokePath({
        startU,
        stopU,
        v: v + scanJitter,
        tangent,
        normal,
        polygon,
        stroke,
        brushWidth,
        style,
        salt: scanIndex * 191 + index
      }));
    }
  }

  return paths;
}

function brushPolygonPoints(boundary) {
  const points = boundaryTexturePoints(boundary);
  const fallback = points.length >= 3 ? points : boundaryEndPoints(boundary);
  if (fallback.length > 1 && pointDistance(fallback[0], fallback[fallback.length - 1]) < 0.001) {
    return fallback.slice(0, -1);
  }

  return fallback;
}

function rectFromPoints(points) {
  if (!points.length) return { left: 0, top: 0, right: 1, bottom: 1 };
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

function dotPoint(point, axis) {
  return point[0] * axis[0] + point[1] * axis[1];
}

function pointFromAxes(u, v, tangent, normal) {
  return [
    tangent[0] * u + normal[0] * v,
    tangent[1] * u + normal[1] * v
  ];
}

function scanlineIntersections(polygon, tangent, normal, v) {
  const intersections = [];
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const av = dotPoint(a, normal);
    const bv = dotPoint(b, normal);
    if ((av <= v && bv > v) || (bv <= v && av > v)) {
      const t = (v - av) / ((bv - av) || 1e-9);
      const au = dotPoint(a, tangent);
      const bu = dotPoint(b, tangent);
      intersections.push(au + (bu - au) * t);
    }
  }

  intersections.sort((a, b) => a - b);
  return intersections.filter((value, index) => index === 0 || Math.abs(value - intersections[index - 1]) > 0.01);
}

function brushStrokePath({ startU, stopU, v, tangent, normal, polygon, stroke, brushWidth, style, salt }) {
  const jitter = Math.max(0, Math.min(8, Number(style.brushJitterPt ?? style.BrushJitterPt ?? 1.2)));
  const midU = (startU + stopU) / 2 + signedJitter(style, salt + 13, startU, stopU, Math.min(jitter, (stopU - startU) * 0.04));
  let midV = v + signedJitter(style, salt + 17, v, midU, jitter * 0.42);
  let mid = pointFromAxes(midU, midV, tangent, normal);
  if (!pointInsidePolygon(mid, polygon)) {
    midV = v;
    mid = pointFromAxes(midU, midV, tangent, normal);
  }

  const widthScale = 0.96 + deterministicUnit(Number(style.seed ?? style.Seed ?? 12345), salt + 23) * 0.18;
  return {
    closed: false,
    stroke,
    strokeWidthPt: brushWidth * widthScale,
    role: PATH_ROLES.texture,
    segments: [
      { type: "move", data: pointFromAxes(startU, v, tangent, normal) },
      { type: "line", data: mid },
      { type: "line", data: pointFromAxes(stopU, v, tangent, normal) }
    ]
  };
}

function boundaryTexturePoints(boundary) {
  const segments = boundary?.segments ?? [];
  if (segments.length < 2) return [];
  const points = [segmentEnd(segments[0].data)];
  let current = points[0];
  for (const segment of segments.slice(1)) {
    if (segment.type === "curve" && segment.data?.length >= 6) {
      const length = pointDistance(current, [segment.data[0], segment.data[1]]) +
        pointDistance([segment.data[0], segment.data[1]], [segment.data[2], segment.data[3]]) +
        pointDistance([segment.data[2], segment.data[3]], segmentEnd(segment.data));
      const steps = Math.max(2, Math.min(12, Math.ceil(length / 18)));
      for (let step = 1; step <= steps; step++) points.push(cubicPoint(current, segment.data, step / steps));
      current = segmentEnd(segment.data);
      continue;
    }

    if (segment.data?.length >= 2) {
      current = segmentEnd(segment.data);
      points.push(current);
    }
  }

  return points;
}

function boundaryEndPoints(boundary) {
  const points = [];
  for (const segment of boundary?.segments ?? []) {
    const data = segment.data ?? [];
    if (data.length >= 2) points.push([Number(data[data.length - 2]), Number(data[data.length - 1])]);
  }
  return points;
}

function boundaryRect(boundary) {
  const points = boundaryPoints(boundary);
  if (!points.length) return { left: 0, top: 0, right: 1, bottom: 1 };
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

function pointInsidePolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function deterministicUnit(seed, salt) {
  const value = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function interpolatePoint(start, end, t) {
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}

function offsetFragmentPoint(point, lineStart, lineEnd, amplitude, style, salt) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const tx = dx / length;
  const ty = dy / length;
  const normal = signedJitter(style, salt, point[0], point[1], amplitude);
  const tangent = signedJitter(style, salt + 13, point[1], point[0], amplitude * 0.18);
  return [point[0] + nx * normal + tx * tangent, point[1] + ny * normal + ty * tangent];
}

function nestedBoundariesFrom(boundary, style = {}) {
  const layers = Math.max(2, Math.min(5, Math.round(Number(style.nestedLayers ?? style.NestedLayers ?? 2))));
  const overlap = Math.max(0, Math.min(1, Number(style.nestedOverlap ?? style.NestedOverlap ?? 0.55)));
  const gap = Math.max(0.25, Number(style.nestedGapPt ?? style.NestedGapPt ?? 4));
  const jitter = Math.max(0, Number(style.nestedJitterPt ?? style.NestedJitterPt ?? 0.8));
  const baseSeed = Number(style.seed ?? style.Seed ?? 12345);
  const baseAmplitude = boundaryJitterAmplitude(boundary.segments ?? [], style);
  const step = gap * (1 - overlap * 0.82);
  const direction = nestedDirectionVector(style);
  const centerOffset = (layers - 1) / 2;
  const result = [];

  for (let layer = layers - 1; layer >= 0; layer--) {
    const offsetDistance = (layer - centerOffset) * step;
    const layerBoundary = offsetBoundary(boundary, direction[0] * offsetDistance, direction[1] * offsetDistance);
    const layerStyle = {
      ...style,
      seed: baseSeed + layer * 9973,
      edgeJitterPt: baseAmplitude + jitter * (layer / Math.max(1, layers - 1)) * 0.55
    };
    const visible = cloneBoundary(layerBoundary, PATH_ROLES.innerBoundary);
    visible.segments = lightlyWarpBoundarySegments(layerBoundary, layerStyle);
    result.push(visible);
  }

  return result;
}

function nestedIntersectionBoundaryFrom(boundary, style = {}) {
  const layers = Math.max(2, Math.min(5, Math.round(Number(style.nestedLayers ?? style.NestedLayers ?? 2))));
  const overlap = Math.max(0, Math.min(1, Number(style.nestedOverlap ?? style.NestedOverlap ?? 0.55)));
  const gap = Math.max(0.25, Number(style.nestedGapPt ?? style.NestedGapPt ?? 4));
  const step = gap * (1 - overlap * 0.82);
  const totalShift = step * (layers - 1);
  const center = boundaryCenter(boundary);
  const bounds = boundaryBounds(boundary);
  const maxInset = Math.max(0.4, Math.min(bounds.width, bounds.height) * 0.28);
  const intersection = insetBoundary(boundary, center, Math.min(maxInset, totalShift * 0.58), 0, style);
  const visible = cloneBoundary(intersection, PATH_ROLES.innerFillBoundary);
  visible.segments = lightlyWarpBoundarySegments(intersection, { ...style, seed: Number(style.seed ?? style.Seed ?? 12345) + 4241 });
  return visible;
}

function nestedDirectionVector(style = {}) {
  const direction = String(style.nestedDirection ?? style.NestedDirection ?? "leftDownToRightUp");
  const length = Math.SQRT2;
  if (direction === "leftUpToRightDown") return [1 / length, 1 / length];
  return [1 / length, -1 / length];
}

function offsetBoundary(boundary, dx, dy) {
  const clone = cloneBoundary(boundary, PATH_ROLES.innerBoundary);
  clone.segments = clone.segments.map(segment => ({
    ...segment,
    data: offsetSegmentData(segment.data, dx, dy)
  }));
  return clone;
}

function offsetSegmentData(data = [], dx, dy) {
  const result = [];
  for (let index = 0; index + 1 < data.length; index += 2) {
    result.push(Number(data[index]) + dx, Number(data[index + 1]) + dy);
  }

  return result;
}

function boundaryCenter(boundary) {
  const points = boundaryPoints(boundary);
  if (!points.length) return [0, 0];
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  ];
}

function boundaryBounds(boundary) {
  const points = boundaryPoints(boundary);
  if (!points.length) return { width: 1, height: 1 };
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function boundaryPoints(boundary) {
  const points = [];
  for (const segment of boundary?.segments ?? []) {
    const data = segment.data ?? [];
    for (let index = 0; index + 1 < data.length; index += 2) {
      points.push([Number(data[index]), Number(data[index + 1])]);
    }
  }

  return points;
}

function insetBoundary(boundary, center, inset, layer, style) {
  const clone = cloneBoundary(boundary, PATH_ROLES.innerBoundary);
  const jitter = Math.max(0, Number(style.nestedJitterPt ?? style.NestedJitterPt ?? 0.8));
  clone.segments = clone.segments.map((segment, segmentIndex) => ({
    ...segment,
    data: insetSegmentData(segment.data, center, inset, layer, segmentIndex, style, jitter)
  }));
  return clone;
}

function insetSegmentData(data = [], center, inset, layer, segmentIndex, style, jitter) {
  const result = [];
  for (let index = 0; index + 1 < data.length; index += 2) {
    const point = insetPoint([Number(data[index]), Number(data[index + 1])], center, inset);
    const extra = layer > 0 && jitter > 0
      ? signedJitter(style, layer * 211 + segmentIndex * 17 + index, point[0], point[1], jitter * 0.32)
      : 0;
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    const distance = Math.hypot(dx, dy) || 1;
    result.push(point[0] + (dx / distance) * extra, point[1] + (dy / distance) * extra);
  }

  return result;
}

function insetPoint(point, center, inset) {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.01 || inset <= 0) return [...point];
  const scale = Math.max(0.08, (distance - inset) / distance);
  return [center[0] + dx * scale, center[1] + dy * scale];
}

function lightlyWarpBoundarySegments(boundary, style = {}) {
  const segments = boundary?.segments ?? [];
  if (segments.length < 2) return segments.map(segment => ({ ...segment, data: [...segment.data] }));

  const openComplexScale = !boundary.closed && segments.length > 2 ? 0.45 : 1;
  const amplitude = boundaryJitterAmplitude(segments, style) * openComplexScale;
  const closedCurveCount = boundary.closed ? segments.filter(segment => segment.type === "curve").length : 0;
  const result = [{ ...segments[0], data: [...segments[0].data] }];
  const firstPoint = segmentEnd(segments[0].data);
  let currentPoint = firstPoint;

  for (let index = 1; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.type === "line" && segment.data?.length >= 2) {
      const end = [segment.data[0], segment.data[1]];
      for (const point of warpedLineInteriorPoints(currentPoint, end, amplitude, style, index)) {
        result.push({ type: "line", data: point });
      }
      result.push({ type: "line", data: end });
      currentPoint = end;
      continue;
    }

    if (segment.type === "curve" && segment.data?.length >= 6) {
      if (closedCurveCount > 2) {
        result.push(...warpedCurveSegments(currentPoint, segment.data, amplitude, style, index));
      } else {
        result.push({ type: "curve", data: warpedCurveData(segment.data, amplitude, style, index) });
      }
      currentPoint = segmentEnd(segment.data);
      continue;
    }

    result.push({ ...segment, data: [...(segment.data ?? [])] });
    currentPoint = segmentEnd(segment.data);
  }

  if (boundary.closed && pointDistance(currentPoint, firstPoint) > 0.75) {
    for (const point of warpedLineInteriorPoints(currentPoint, firstPoint, amplitude, style, segments.length)) {
      result.push({ type: "line", data: point });
    }
  }

  return result;
}

function boundaryJitterAmplitude(segments, style = {}) {
  const points = [];
  for (const segment of segments) {
    const data = segment.data ?? [];
    for (let index = 0; index + 1 < data.length; index += 2) {
      points.push([Number(data[index]), Number(data[index + 1])]);
    }
  }

  if (!points.length) return 0.8;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const strokeWidth = Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2);
  const roughness = Number(style.roughness ?? style.Roughness ?? 0.8);
  const bowing = Number(style.bowing ?? style.Bowing ?? 0.35);
  const randomness = Number(style.maxRandomnessOffset ?? style.MaxRandomnessOffset ?? 1.35);
  const requested = Number(style.edgeJitterPt ?? style.EdgeJitterPt ??
    roughness * 1.75 + bowing * 0.55 + strokeWidth * 0.15 + Math.max(0, randomness - 1) * 0.3);
  const randomnessScale = 0.78 + Math.max(0.2, Math.min(4, randomness)) * 0.32;
  const bowingScale = 0.9 + Math.max(0, Math.min(4, bowing)) * 0.32;
  return Math.max(0.18, Math.min(4.8, requested * randomnessScale * bowingScale, Math.max(0.18, diagonal * 0.038)));
}

function warpedLineInteriorPoints(start, end, amplitude, style, salt) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 6 || amplitude <= 0) return [];

  const nx = -dy / length;
  const ny = dx / length;
  const tx = dx / length;
  const ty = dy / length;
  const roughness = Math.max(0, Number(style.roughness ?? style.Roughness ?? 0.8));
  const bowing = Math.max(0, Number(style.bowing ?? style.Bowing ?? 0.35));
  const sampling = Math.max(0.5, Math.min(2.5, Number(style.curveSampling ?? style.CurveSampling ?? 1)));
  const count = Math.max(1, Math.min(10, Math.ceil(length / (42 / sampling)) + (roughness > 1.25 ? 1 : 0)));
  const edgeBow = signedJitter(style, salt * 101, start[0] + end[0], start[1] + end[1],
    amplitude * Math.min(1.35, 0.22 + bowing * 0.56));
  const points = [];
  for (let index = 1; index <= count; index++) {
    const t = index / (count + 1);
    const baseX = start[0] + dx * t;
    const baseY = start[1] + dy * t;
    const normal = signedJitter(style, salt * 17 + index, baseX, baseY, amplitude * (0.95 + Math.min(roughness, 2) * 0.1)) +
      edgeBow * Math.sin(Math.PI * t);
    const tangent = signedJitter(style, salt * 31 + index, baseY, baseX, amplitude * 0.14);
    points.push([baseX + nx * normal + tx * tangent, baseY + ny * normal + ty * tangent]);
  }
  return points;
}

function warpedCurveSegments(start, data, amplitude, style, salt) {
  const end = segmentEnd(data);
  const length = pointDistance(start, [data[0], data[1]]) + pointDistance([data[0], data[1]], [data[2], data[3]]) +
    pointDistance([data[2], data[3]], end);
  if (length < 4 || amplitude <= 0) {
    return [{ type: "curve", data: warpedCurveData(data, amplitude, style, salt) }];
  }

  const roughness = Math.max(0, Number(style.roughness ?? style.Roughness ?? 0.8));
  const bowing = Math.max(0, Number(style.bowing ?? style.Bowing ?? 0.35));
  const sampling = Math.max(0.5, Math.min(2.5, Number(style.curveSampling ?? style.CurveSampling ?? 1)));
  const count = Math.max(2, Math.min(10, Math.ceil(length / (38 / sampling)) + (roughness > 1.25 ? 1 : 0)));
  const result = [];
  for (let index = 1; index <= count; index++) {
    const t = index / count;
    const point = cubicPoint(start, data, t);
    if (index === count) {
      result.push({ type: "line", data: end });
      continue;
    }

    const tangent = cubicDerivative(start, data, t);
    const tangentLength = Math.hypot(tangent[0], tangent[1]) || 1;
    const nx = -tangent[1] / tangentLength;
    const ny = tangent[0] / tangentLength;
    const tx = tangent[0] / tangentLength;
    const ty = tangent[1] / tangentLength;
    const normal = signedJitter(style, salt * 53 + index, point[0], point[1], amplitude * (0.58 + Math.min(4, bowing) * 0.18));
    const tangentOffset = signedJitter(style, salt * 59 + index, point[1], point[0], amplitude * 0.1);
    result.push({
      type: "line",
      data: [point[0] + nx * normal + tx * tangentOffset, point[1] + ny * normal + ty * tangentOffset]
    });
  }

  return result;
}

function cubicPoint(start, data, t) {
  const mt = 1 - t;
  const x = mt ** 3 * start[0] + 3 * mt ** 2 * t * data[0] + 3 * mt * t ** 2 * data[2] + t ** 3 * data[4];
  const y = mt ** 3 * start[1] + 3 * mt ** 2 * t * data[1] + 3 * mt * t ** 2 * data[3] + t ** 3 * data[5];
  return [x, y];
}

function cubicDerivative(start, data, t) {
  const mt = 1 - t;
  const x = 3 * mt ** 2 * (data[0] - start[0]) + 6 * mt * t * (data[2] - data[0]) + 3 * t ** 2 * (data[4] - data[2]);
  const y = 3 * mt ** 2 * (data[1] - start[1]) + 6 * mt * t * (data[3] - data[1]) + 3 * t ** 2 * (data[5] - data[3]);
  return [x, y];
}

function warpedCurveData(data, amplitude, style, salt) {
  const result = [...data];
  for (let index = 0; index < 4; index += 2) {
    const offsetX = signedJitter(style, salt * 43 + index, data[index], data[index + 1], amplitude * 0.38);
    const offsetY = signedJitter(style, salt * 47 + index, data[index + 1], data[index], amplitude * 0.38);
    result[index] += offsetX;
    result[index + 1] += offsetY;
  }
  return result;
}

function signedJitter(style, salt, x, y, amplitude) {
  const seed = Number(style.seed ?? style.Seed ?? 12345);
  const value = Math.sin((seed + 1) * 12.9898 + salt * 78.233 + x * 0.137 + y * 0.269) * 43758.5453;
  const unit = value - Math.floor(value);
  const sign = unit < 0.5 ? -1 : 1;
  return sign * (0.35 + Math.abs(unit - 0.5) * 1.3) * amplitude;
}

function withSourceBoundary(drawable, boundary, style = {}) {
  const drawablePaths = drawable?.paths ?? [];
  const paths = [];
  const { visibleInner, fillBoundary, consumed } = sourceBoundaryPartsFrom(drawablePaths, boundary, style);
  if (boundary.closed && fillBoundary) {
    paths.push(fillBoundary);
    paths.push(...fillTexturePathsFrom(fillBoundary, style));
  }

  if (visibleInner) paths.push(visibleInner);
  for (const path of drawablePaths) {
    if (consumed.has(path)) continue;
    if (path.role === PATH_ROLES.innerFillBoundary || path.role === PATH_ROLES.hitArea) continue;
    paths.push(path);
  }

  if (!visibleInner && boundary.closed) {
    const fallback = visibleBoundaryFrom(boundary, style);
    const fillBoundary = cloneBoundary(fallback, PATH_ROLES.innerFillBoundary);
    paths.unshift(fillBoundary, fallback);
  }

  return { paths };
}

function sourceBoundaryPartsFrom(drawablePaths, boundary, style = {}) {
  const consumed = new Set();
  const candidates = drawablePaths.filter(path =>
    path?.segments?.length > 1 &&
    (path.role === PATH_ROLES.outerJitter || path.role === PATH_ROLES.innerBoundary || !path.role));
  if (!candidates.length) return { visibleInner: null, fillBoundary: null, consumed };

  const visibleInner = cloneBoundary(candidates[0], PATH_ROLES.innerBoundary);
  visibleInner.closed = false;
  consumed.add(candidates[0]);
  if (!boundary.closed) {
    return { visibleInner, fillBoundary: null, consumed };
  }

  const expected = Math.max(1, countBoundaryDrawSegments(boundary));
  let selected = candidates.filter((_, index) => index % 2 === 0).slice(0, expected);
  if (selected.length < Math.min(expected, candidates.length)) {
    selected = candidates.slice(0, Math.min(expected, candidates.length));
  }

  if (selected.length === 1) {
    const fillBoundary = cloneBoundary(selected[0], PATH_ROLES.innerFillBoundary);
    fillBoundary.closed = true;
    return { visibleInner, fillBoundary, consumed };
  }

  const fillBoundary = stitchSourcePaths(selected, style, PATH_ROLES.innerFillBoundary);
  return { visibleInner, fillBoundary, consumed };
}

function countBoundaryDrawSegments(boundary) {
  const count = (boundary?.segments ?? []).filter(segment => segment.type !== "move").length;
  return Math.max(1, count);
}

function stitchSourcePaths(paths, style = {}, role = PATH_ROLES.innerBoundary) {
  const first = paths[0]?.segments?.[0];
  const start = first?.data?.length >= 2 ? [...first.data] : [0, 0];
  const result = {
    closed: true,
    stroke: style.stroke ?? style.Stroke ?? "#111111",
    strokeWidthPt: Number(style.strokeWidthPt ?? style.strokeWidth ?? style.StrokeWidthPt ?? 2),
    role,
    segments: [{ type: "move", data: start }]
  };

  for (const path of paths) {
    for (const segment of path.segments.slice(1)) {
      result.segments.push({ ...segment, data: [...(segment.data ?? [])] });
    }
  }

  return result;
}

function withNativeBoundary(drawable, boundary, style = {}) {
  if (!boundary) return drawable;
  const paths = [];
  const drawablePaths = drawable?.paths ?? [];
  if (boundary.closed && isNestedMode(style)) {
    const nestedBoundaries = nestedBoundariesFrom(boundary, style);
    if (nestedBoundaries.length) {
      const nestedFill = nestedIntersectionBoundaryFrom(boundary, style);
      paths.push(nestedFill);
      paths.push(...fillTexturePathsFrom(nestedFill, style));
      paths.push(...nestedBoundaries);
      return {
        paths
      };
    }
  }

  if (usesRawRoughStrokes(style)) {
    return withSourceBoundary(drawable, boundary, style);
  }

  const visibleBoundaries = visibleBoundaryPassesFrom(boundary, style);
  if (boundary.closed && visibleBoundaries[0]) {
    const fillBoundary = cloneBoundary(visibleBoundaries[0], PATH_ROLES.innerFillBoundary);
    paths.push(fillBoundary);
    paths.push(...fillTexturePathsFrom(fillBoundary, style));
  }
  paths.push(...visibleBoundaries);
  return {
    paths: [
      ...paths,
      ...drawablePaths.filter(path => {
        if (path.role === PATH_ROLES.innerFillBoundary || path.role === PATH_ROLES.hitArea) return false;
        if (!boundary.closed) return true;
        if (path.role === PATH_ROLES.outerJitter) return usesRawRoughStrokes(style);
        return true;
      })
    ]
  };
}

function withPlainBoundary(boundary) {
  if (!boundary) return { paths: [] };
  const paths = [];
  if (boundary.closed) paths.push(cloneBoundary(boundary, PATH_ROLES.innerFillBoundary));
  paths.push(cloneBoundary(boundary, PATH_ROLES.innerBoundary));
  return { paths };
}

function plainPath(d, style) {
  return withPlainBoundary(boundaryFromPathData(d, style));
}

function plainLine(x1, y1, x2, y2, style) {
  return withPlainBoundary(boundaryFromPoints([[x1, y1], [x2, y2]], style, false));
}

function plainPolygon(points, style) {
  return withPlainBoundary(boundaryFromPoints(points, style, true));
}

function plainEllipse(cx, cy, w, h, style) {
  return withPlainBoundary(boundaryFromEllipse(cx, cy, w, h, style));
}

function scaledOfficeNodes(path, w, h) {
  return (path.nodes ?? []).map(([x, y]) => [x * w, y * h]);
}

function catmullControl(points, index, closed) {
  if (closed) return points[(index + points.length) % points.length];
  return points[Math.max(0, Math.min(points.length - 1, index))];
}

function officePathDataFromRaw(raw, segments, w, h) {
  if (raw.length < 2) return "";
  const closed = raw.length > 2 && pointDistance(raw[0], raw[raw.length - 1]) < Math.max(w, h) * 0.02;
  const points = closed ? raw.slice(0, -1) : raw;
  if (points.length < 2) return "";

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentType = Number(segments[index] ?? segments[index - 1] ?? 0);
    if (segmentType === 1) {
      const p0 = catmullControl(points, index - 2, closed);
      const p3 = catmullControl(points, index + 1, closed);
      const c1 = [previous[0] + (current[0] - p0[0]) / 6, previous[1] + (current[1] - p0[1]) / 6];
      const c2 = [current[0] - (p3[0] - previous[0]) / 6, current[1] - (p3[1] - previous[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${current[0]} ${current[1]}`;
    } else {
      d += ` L ${current[0]} ${current[1]}`;
    }
  }

  if (closed) {
    const last = points[points.length - 1];
    const first = points[0];
    const segmentType = Number(segments[0] ?? segments[segments.length - 1] ?? 0);
    if (segmentType === 1) {
      const p0 = catmullControl(points, points.length - 2, true);
      const p3 = catmullControl(points, 1, true);
      const c1 = [last[0] + (first[0] - p0[0]) / 6, last[1] + (first[1] - p0[1]) / 6];
      const c2 = [first[0] - (p3[0] - last[0]) / 6, first[1] - (p3[1] - last[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${first[0]} ${first[1]}`;
    }
    d += " Z";
  }

  return d;
}

function officePathDataParts(path, w, h) {
  const raw = scaledOfficeNodes(path, w, h);
  const segments = path.segments ?? [];
  return splitOfficeRawPath(raw, segments).map(part => officePathDataFromRaw(part.points, part.segments, w, h)).filter(Boolean);
}

function splitOfficeRawPath(raw, segments) {
  if (raw.length < 4) return [{ points: raw, segments }];
  const parts = [];
  let start = 0;

  for (let index = 1; index < raw.length; index++) {
    const chunkSize = index - start + 1;
    const remainingSize = raw.length - index - 1;
    if (chunkSize < 4 || remainingSize < 2) continue;
    if (pointDistance(raw[start], raw[index]) > officeContourEpsilon(raw)) continue;

    parts.push({
      points: raw.slice(start, index + 1),
      segments: segments.slice(start, index + 1)
    });
    start = index + 1;
  }

  if (!parts.length) return [{ points: raw, segments }];
  parts.push({ points: raw.slice(start), segments: segments.slice(start) });
  return parts.filter(part => part.points.length >= 2);
}

function officeContourEpsilon(raw) {
  const xs = raw.map(point => point[0]);
  const ys = raw.map(point => point[1]);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.max(0.5, diagonal * 0.004);
}

function officeOutlineShape(enumName, w, h, style) {
  const outline = officePresetOutlines[enumName];
  if (!outline?.paths?.length) return null;
  const drawables = [];
  for (const path of outline.paths) {
    for (const d of officePathDataParts(path, w, h)) {
      drawables.push(roughPath(d, style, { strokePasses: strokePassesForPathData(d, enumName) }));
    }
  }
  return drawables.length ? combine(...drawables) : null;
}

function strokePassesForPathData(d, enumName = "") {
  const name = cleanMso(enumName);
  const commandCount = (String(d).match(/[AaCcHhLlMmQqSsTtVvZz]/g) ?? []).length;
  if (/RoundedRectangle|RoundRect|Round1|Round2|SnipRound/i.test(name)) return 2;
  return commandCount <= 8 ? 2 : 1;
}

function rectangleLike(name, w, h, style) {
  const r = Math.min(w, h) * 0.18;
  if (/Dashed/i.test(name)) return dashedRect(w, h, style);
  if (/Rounded|Round1|Round2|SnipRound/i.test(name)) {
    return roughPath(roundedRectPath(w, h), style);
  }

  if (/Snip2Diag/i.test(name)) return roughPolygon([[r, 0], [w, 0], [w, h - r], [w - r, h], [0, h], [0, r]], style);
  if (/Snip2Same/i.test(name)) return roughPolygon([[r, 0], [w - r, 0], [w, r], [w, h], [0, h], [0, r]], style);
  if (/Snip1/i.test(name)) return roughPolygon([[0, 0], [w - r, 0], [w, r], [w, h], [0, h]], style);
  if (/Frame/i.test(name)) return combine(roughRect(0, 0, w, h, style), roughRect(w * 0.16, h * 0.16, w * 0.68, h * 0.68, style));
  if (/HalfFrame/i.test(name)) return roughPolygon([[0, 0], [w, 0], [w, h * 0.22], [w * 0.22, h * 0.22], [w * 0.22, h], [0, h]], style);
  return roughRect(0, 0, w, h, style);
}

function basicShape(name, w, h, style) {
  if (/DoubleOval/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), roughEllipse(w / 2, h / 2, w * 0.72, h * 0.72, style));
  if (/Balloon/i.test(name)) return combine(roughEllipse(w / 2, h * 0.46, w, h * 0.78, style), roughPolygon([[w * 0.42, h * 0.82], [w * 0.52, h], [w * 0.6, h * 0.8]], style));
  if (/Oval|Balloon/i.test(name)) return roughEllipse(w / 2, h / 2, w, h, style);
  if (/PieWedge/i.test(name)) return roughPolygon(sectorPoints(w, h, -Math.PI / 2, 0, 18), style);
  if (/Pie/i.test(name)) return roughPolygon(sectorPoints(w, h, -Math.PI / 2, Math.PI * 0.72, 30), style);
  if (/Chord/i.test(name)) return roughPolygon(chordPoints(w, h, -Math.PI * 0.84, Math.PI * 0.2, 30), style);
  if (/Diamond|Collate|Sort/i.test(name)) return roughPolygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], style);
  if (/RightTriangle/i.test(name)) return roughPolygon([[0, 0], [w, h], [0, h]], style);
  if (/Triangle|Extract|Merge/i.test(name)) return roughPolygon([[w / 2, 0], [w, h], [0, h]], style);
  if (/Trapezoid|ManualOperation/i.test(name)) return roughPolygon([[w * 0.2, 0], [w * 0.8, 0], [w, h], [0, h]], style);
  if (/NonIsoscelesTrapezoid|ManualInput/i.test(name)) return roughPolygon([[w * 0.12, 0], [w, 0], [w * 0.82, h], [0, h]], style);
  if (/Parallelogram|Data/i.test(name)) return roughPolygon([[w * 0.18, 0], [w, 0], [w * 0.82, h], [0, h]], style);
  if (/Pentagon|RegularPentagon/i.test(name)) return roughPolygon(regularPolygonPoints(5, w, h), style);
  if (/Hexagon|Preparation/i.test(name)) return roughPolygon(regularPolygonPoints(6, w, h, 0), style);
  if (/Heptagon/i.test(name)) return roughPolygon(regularPolygonPoints(7, w, h), style);
  if (/Octagon/i.test(name)) return roughPolygon(regularPolygonPoints(8, w, h, Math.PI / 8), style);
  if (/Decagon/i.test(name)) return roughPolygon(regularPolygonPoints(10, w, h), style);
  if (/Dodecagon/i.test(name)) return roughPolygon(regularPolygonPoints(12, w, h), style);
  if (/Chevron/i.test(name)) return roughPolygon([[0, 0], [w * 0.72, 0], [w, h / 2], [w * 0.72, h], [0, h], [w * 0.28, h / 2]], style);
  if (/MathPlus/i.test(name)) return roughPolygon([[w * 0.38, 0], [w * 0.62, 0], [w * 0.62, h * 0.38], [w, h * 0.38], [w, h * 0.62], [w * 0.62, h * 0.62], [w * 0.62, h], [w * 0.38, h], [w * 0.38, h * 0.62], [0, h * 0.62], [0, h * 0.38], [w * 0.38, h * 0.38]], style);
  if (/Cross/i.test(name)) return roughPolygon([[w * 0.38, 0], [w * 0.62, 0], [w * 0.62, h * 0.38], [w, h * 0.38], [w, h * 0.62], [w * 0.62, h * 0.62], [w * 0.62, h], [w * 0.38, h], [w * 0.38, h * 0.62], [0, h * 0.62], [0, h * 0.38], [w * 0.38, h * 0.38]], style);
  if (/MathMinus/i.test(name)) return roughLine(w * 0.18, h / 2, w * 0.82, h / 2, style);
  if (/MathEqual/i.test(name)) return combine(roughLine(w * 0.18, h * 0.4, w * 0.82, h * 0.4, style), roughLine(w * 0.18, h * 0.6, w * 0.82, h * 0.6, style));
  if (/MathDivide/i.test(name)) return combine(roughLine(w * 0.18, h / 2, w * 0.82, h / 2, style), roughEllipse(w / 2, h * 0.24, 4, 4, style), roughEllipse(w / 2, h * 0.76, 4, 4, style));
  if (/MathMultiply|ChartX/i.test(name)) return combine(roughLine(w * 0.22, h * 0.22, w * 0.78, h * 0.78, style), roughLine(w * 0.78, h * 0.22, w * 0.22, h * 0.78, style));
  if (/MathNotEqual/i.test(name)) return combine(basicShape("MathEqual", w, h, style), roughLine(w * 0.62, h * 0.22, w * 0.38, h * 0.78, style));
  if (/Donut|FlowchartOr/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), roughEllipse(w / 2, h / 2, w * 0.48, h * 0.48, style));
  if (/NoSymbol/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), roughLine(w * 0.2, h * 0.8, w * 0.8, h * 0.2, style));
  if (/Heart/i.test(name)) return roughPath(`M ${w / 2} ${h * 0.88} C ${w * 0.08} ${h * 0.55} ${w * 0.02} ${h * 0.22} ${w * 0.28} ${h * 0.16} C ${w * 0.42} ${h * 0.12} ${w * 0.5} ${h * 0.24} ${w / 2} ${h * 0.34} C ${w * 0.5} ${h * 0.24} ${w * 0.58} ${h * 0.12} ${w * 0.72} ${h * 0.16} C ${w * 0.98} ${h * 0.22} ${w * 0.92} ${h * 0.55} ${w / 2} ${h * 0.88} Z`, style);
  if (/LightningBolt/i.test(name)) return roughPolygon([[w * 0.58, 0], [w * 0.18, h * 0.55], [w * 0.45, h * 0.55], [w * 0.32, h], [w * 0.82, h * 0.42], [w * 0.54, h * 0.42]], style);
  if (/Moon/i.test(name)) return roughPath(`M ${w * 0.74} ${h * 0.04} C ${w * 0.28} ${h * 0.12} ${w * 0.18} ${h * 0.78} ${w * 0.68} ${h * 0.96} C ${w * 0.18} ${h * 0.9} ${w * 0.02} ${h * 0.18} ${w * 0.74} ${h * 0.04} Z`, style);
  if (/Sun/i.test(name)) return combine(roughPolygon(starPoints(12, w, h, 0.72), style), roughEllipse(w / 2, h / 2, w * 0.45, h * 0.45, style));
  if (/SmileyFace/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), roughEllipse(w * 0.36, h * 0.38, 4, 4, style), roughEllipse(w * 0.64, h * 0.38, 4, 4, style), roughPath(`M ${w * 0.3} ${h * 0.58} Q ${w / 2} ${h * 0.78} ${w * 0.7} ${h * 0.58}`, style));
  if (/Tear/i.test(name)) return roughPath(`M ${w * 0.55} 0 C ${w * 0.98} ${h * 0.32} ${w * 0.88} ${h * 0.92} ${w * 0.42} ${h * 0.96} C ${w * 0.08} ${h * 0.92} ${w * 0.02} ${h * 0.54} ${w * 0.28} ${h * 0.32} C ${w * 0.38} ${h * 0.24} ${w * 0.48} ${h * 0.12} ${w * 0.55} 0 Z`, style);
  if (/Cloud/i.test(name)) return roughPath(`M ${w * 0.18} ${h * 0.66} C ${w * 0.02} ${h * 0.58} ${w * 0.08} ${h * 0.35} ${w * 0.28} ${h * 0.38} C ${w * 0.3} ${h * 0.18} ${w * 0.54} ${h * 0.14} ${w * 0.62} ${h * 0.32} C ${w * 0.82} ${h * 0.22} ${w * 0.98} ${h * 0.44} ${w * 0.84} ${h * 0.62} C ${w * 0.82} ${h * 0.8} ${w * 0.52} ${h * 0.82} ${w * 0.18} ${h * 0.66} Z`, style);
  if (/Can|MagneticDisk|DirectAccessStorage|SequentialAccessStorage/i.test(name)) return combine(roughEllipse(w / 2, h * 0.18, w, h * 0.32, style), roughLine(0, h * 0.18, 0, h * 0.82, style), roughLine(w, h * 0.18, w, h * 0.82, style), roughEllipse(w / 2, h * 0.82, w, h * 0.32, style));
  if (/Cube/i.test(name)) return combine(roughPolygon([[0, h * 0.25], [w * 0.7, h * 0.25], [w, 0], [w * 0.3, 0]], style), roughPolygon([[0, h * 0.25], [w * 0.7, h * 0.25], [w * 0.7, h], [0, h]], style), roughPolygon([[w * 0.7, h * 0.25], [w, 0], [w, h * 0.72], [w * 0.7, h]], style));
  if (/Bevel/i.test(name)) return combine(roughRect(0, 0, w, h, style), roughPolygon([[w * 0.16, h * 0.16], [w * 0.84, h * 0.16], [w * 0.84, h * 0.84], [w * 0.16, h * 0.84]], style));
  if (/FoldedCorner/i.test(name)) return combine(roughPolygon([[0, 0], [w * 0.75, 0], [w, h * 0.25], [w, h], [0, h]], style), roughLine(w * 0.75, 0, w * 0.75, h * 0.25, style), roughLine(w * 0.75, h * 0.25, w, h * 0.25, style));
  if (/Funnel/i.test(name)) return roughPolygon([[0, 0], [w, 0], [w * 0.62, h * 0.52], [w * 0.62, h], [w * 0.38, h], [w * 0.38, h * 0.52]], style);
  if (/Plaque/i.test(name)) return roughPath(`M ${w * 0.22} 0 C ${w * 0.18} ${h * 0.18} ${w * 0.02} ${h * 0.18} 0 ${h * 0.22} C ${w * 0.18} ${h * 0.32} ${w * 0.18} ${h * 0.68} 0 ${h * 0.78} C ${w * 0.18} ${h * 0.82} ${w * 0.18} ${h * 0.98} ${w * 0.22} ${h} C ${w * 0.32} ${h * 0.82} ${w * 0.68} ${h * 0.82} ${w * 0.78} ${h} C ${w * 0.82} ${h * 0.82} ${w * 0.98} ${h * 0.82} ${w} ${h * 0.78} C ${w * 0.82} ${h * 0.68} ${w * 0.82} ${h * 0.32} ${w} ${h * 0.22} C ${w * 0.82} ${h * 0.18} ${w * 0.82} ${h * 0.02} ${w * 0.78} 0 C ${w * 0.68} ${h * 0.18} ${w * 0.32} ${h * 0.18} ${w * 0.22} 0 Z`, style);
  if (/Brace/i.test(name)) return braceShape(name, w, h, style);
  if (/Bracket/i.test(name)) return bracketShape(name, w, h, style);
  if (/Wave/i.test(name)) return waveShape(name, w, h, style);
  if (/Scroll/i.test(name)) return scrollShape(name, w, h, style);
  if (/ChartPlus/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), translate(basicShape("MathPlus", w * 0.55, h * 0.55, style), w * 0.225, h * 0.225));
  if (/ChartStar/i.test(name)) return combine(roughEllipse(w / 2, h / 2, w, h, style), roughPolygon(starPoints(5, w * 0.58, h * 0.58, 0.45).map(([x, y]) => [x + w * 0.21, y + h * 0.21]), style));
  return roughPolygon(regularPolygonPoints(4, w, h, Math.PI / 4), style);
}

function arrowPolygon(direction, w, h) {
  const head = direction === "left" || direction === "right" ? Math.min(w * 0.35, h * 0.65) : Math.min(h * 0.35, w * 0.65);
  if (direction === "left") return [[w, h * 0.32], [head, h * 0.32], [head, 0], [0, h / 2], [head, h], [head, h * 0.68], [w, h * 0.68]];
  if (direction === "up") return [[w * 0.32, h], [w * 0.32, head], [0, head], [w / 2, 0], [w, head], [w * 0.68, head], [w * 0.68, h]];
  if (direction === "down") return [[w * 0.32, 0], [w * 0.32, h - head], [0, h - head], [w / 2, h], [w, h - head], [w * 0.68, h - head], [w * 0.68, 0]];
  return [[0, h * 0.32], [w - head, h * 0.32], [w - head, 0], [w, h / 2], [w - head, h], [w - head, h * 0.68], [0, h * 0.68]];
}

function doubleArrow(direction, w, h) {
  const head = direction === "horizontal" ? Math.min(w * 0.25, h * 0.55) : Math.min(h * 0.25, w * 0.55);
  if (direction === "vertical") {
    return [[w / 2, 0], [w, head], [w * 0.68, head], [w * 0.68, h - head], [w, h - head], [w / 2, h], [0, h - head], [w * 0.32, h - head], [w * 0.32, head], [0, head]];
  }
  return [[0, h / 2], [head, 0], [head, h * 0.32], [w - head, h * 0.32], [w - head, 0], [w, h / 2], [w - head, h], [w - head, h * 0.68], [head, h * 0.68], [head, h]];
}

function arrowShape(name, w, h, style) {
  if (/LeftRightUpArrow/i.test(name)) return roughPolygon([[0, h * 0.55], [w * 0.22, h * 0.25], [w * 0.22, h * 0.42], [w * 0.42, h * 0.42], [w * 0.42, h * 0.2], [w * 0.28, h * 0.2], [w / 2, 0], [w * 0.72, h * 0.2], [w * 0.58, h * 0.2], [w * 0.58, h * 0.42], [w * 0.78, h * 0.42], [w * 0.78, h * 0.25], [w, h * 0.55], [w * 0.78, h * 0.85], [w * 0.78, h * 0.68], [w * 0.22, h * 0.68], [w * 0.22, h * 0.85]], style);
  if (/QuadArrow/i.test(name)) return roughPolygon([[w / 2, 0], [w * 0.68, h * 0.2], [w * 0.58, h * 0.2], [w * 0.58, h * 0.42], [w * 0.8, h * 0.42], [w * 0.8, h * 0.32], [w, h / 2], [w * 0.8, h * 0.68], [w * 0.8, h * 0.58], [w * 0.58, h * 0.58], [w * 0.58, h * 0.8], [w * 0.68, h * 0.8], [w / 2, h], [w * 0.32, h * 0.8], [w * 0.42, h * 0.8], [w * 0.42, h * 0.58], [w * 0.2, h * 0.58], [w * 0.2, h * 0.68], [0, h / 2], [w * 0.2, h * 0.32], [w * 0.2, h * 0.42], [w * 0.42, h * 0.42], [w * 0.42, h * 0.2], [w * 0.32, h * 0.2]], style);
  if (/LeftRightCircular|CircularArrow|LeftCircular/i.test(name)) return combine(roughPath(`M ${w * 0.72} ${h * 0.18} C ${w * 0.25} ${h * 0.02} ${w * 0.08} ${h * 0.72} ${w * 0.52} ${h * 0.82}`, style), roughPolygon([[w * 0.52, h * 0.82], [w * 0.42, h * 0.62], [w * 0.72, h * 0.72]], style));
  if (/Curved/i.test(name) || /Swoosh/i.test(name) || /UTurn/i.test(name)) return combine(roughPath(`M ${w * 0.12} ${h * 0.72} C ${w * 0.3} ${h * 0.05} ${w * 0.74} ${h * 0.08} ${w * 0.82} ${h * 0.55}`, style), roughPolygon([[w * 0.82, h * 0.55], [w * 0.68, h * 0.45], [w * 0.84, h * 0.25], [w, h * 0.62]], style));
  if (/BentUp/i.test(name)) return roughPolygon([[0, h * 0.58], [w * 0.55, h * 0.58], [w * 0.55, h * 0.28], [w * 0.38, h * 0.28], [w * 0.72, 0], [w, h * 0.28], [w * 0.82, h * 0.28], [w * 0.82, h * 0.82], [0, h * 0.82]], style);
  if (/Bent/i.test(name)) return roughPolygon([[0, h * 0.36], [w * 0.58, h * 0.36], [w * 0.58, 0], [w, h / 2], [w * 0.58, h], [w * 0.58, h * 0.64], [0, h * 0.64]], style);
  if (/NotchedRight/i.test(name)) return roughPolygon([[0, 0], [w * 0.68, 0], [w, h / 2], [w * 0.68, h], [0, h], [w * 0.18, h / 2]], style);
  if (/StripedRight/i.test(name)) return combine(roughPolygon(arrowPolygon("right", w, h), style), roughLine(w * 0.1, h * 0.18, w * 0.1, h * 0.82, style), roughLine(w * 0.2, h * 0.18, w * 0.2, h * 0.82, style));
  if (/LeftRight/i.test(name)) return roughPolygon(doubleArrow("horizontal", w, h), style);
  if (/UpDown/i.test(name)) return roughPolygon(doubleArrow("vertical", w, h), style);
  if (/LeftUp/i.test(name)) return roughPolygon([[0, h * 0.6], [w * 0.24, h * 0.34], [w * 0.24, h * 0.48], [w * 0.55, h * 0.48], [w * 0.55, h * 0.22], [w * 0.42, h * 0.22], [w * 0.7, 0], [w, h * 0.22], [w * 0.86, h * 0.22], [w * 0.86, h * 0.76], [w * 0.24, h * 0.76], [w * 0.24, h * 0.88]], style);
  if (/Left/i.test(name)) return roughPolygon(arrowPolygon("left", w, h), style);
  if (/Up/i.test(name)) return roughPolygon(arrowPolygon("up", w, h), style);
  if (/Down/i.test(name)) return roughPolygon(arrowPolygon("down", w, h), style);
  return roughPolygon(arrowPolygon("right", w, h), style);
}

function calloutShape(name, w, h, style) {
  const tail = [[w * 0.45, h * 0.72], [w * 0.2, h], [w * 0.58, h * 0.76]];
  if (/Oval/i.test(name)) return combine(roughEllipse(w / 2, h * 0.43, w, h * 0.74, style), roughPolygon(tail, style));
  if (/Cloud/i.test(name)) return combine(basicShape("Cloud", w, h * 0.78, style), roughPolygon(tail, style));
  if (/Rounded/i.test(name)) return combine(rectangleLike("RoundedRectangle", w, h * 0.74, style), roughPolygon(tail, style));
  return combine(roughRect(0, 0, w, h * 0.74, style), roughPolygon(tail, style));
}

function lineShape(name, w, h, style) {
  if (/LineArrow/i.test(name)) {
    const head = arrowheadStyle(style);
    const position = head === "none" ? "none" : arrowheadPosition(style);
    const hasStart = position === "start" || position === "both";
    const hasEnd = position === "end" || position === "both";
    const metrics = arrowheadMetrics(style, w, h);
    const center = metrics.height / 2;
    const halfWidth = metrics.width / 2;
    const lineStart = head === "rough" && hasStart ? metrics.length : 0;
    const lineEnd = head === "rough" && hasEnd ? w - metrics.length : w;
    const shaft = roughLine(lineStart, center, lineEnd, center, style);
    if (head !== "rough") return shaft;
    return combine(
      shaft,
      hasEnd ? roughPolygon([[w - metrics.length, center - halfWidth], [w, center], [w - metrics.length, center + halfWidth]], style) : null,
      hasStart ? roughPolygon([[metrics.length, center - halfWidth], [0, center], [metrics.length, center + halfWidth]], style) : null);
  }
  if (/Curve/i.test(name)) return roughPath(`M 0 ${h * 0.72} C ${w * 0.28} ${h * 0.05} ${w * 0.68} ${h * 0.95} ${w} ${h * 0.28}`, style);
  if (/ElbowConnector/i.test(name)) return combine(roughLine(0, h * 0.18, w * 0.52, h * 0.18, style), roughLine(w * 0.52, h * 0.18, w * 0.52, h * 0.78, style), roughLine(w * 0.52, h * 0.78, w, h * 0.78, style));
  if (/CurvedConnector/i.test(name)) return roughPath(`M 0 ${h * 0.18} C ${w * 0.38} ${h * 0.18} ${w * 0.62} ${h * 0.78} ${w} ${h * 0.78}`, style);
  if (/BlockArc/i.test(name)) return roughPolygon(blockArcPoints(w, h), style);
  if (/Arc/i.test(name)) return roughArc(w / 2, h / 2, w, h, Math.PI * 0.84, Math.PI * 1.94, false, style);
  if (/LineInverse/i.test(name)) return roughLine(w, 0, 0, h, style);
  if (/Callout/i.test(name)) {
    const base = combine(roughLine(0, h, w * 0.38, h * 0.55, style), roughLine(w * 0.38, h * 0.55, w, h * 0.2, style));
    const accent = /AccentBar/i.test(name) ? roughLine(w * 0.82, h * 0.06, w * 0.82, h * 0.36, style) : null;
    const border = /Border/i.test(name) ? roughRect(w * 0.65, 0, w * 0.35, h * 0.42, style) : null;
    return combine(base, accent, border);
  }
  return roughLine(0, Number.isFinite(h) ? h * 0.5 : 0, w, Number.isFinite(h) ? h * 0.5 : 0, style);
}

function dashedRect(w, h, style) {
  const dash = Math.max(8, Math.min(w, h) * 0.12);
  const gap = dash * 0.65;
  const parts = [];
  for (let x = 0; x < w; x += dash + gap) {
    parts.push(roughLine(x, 0, Math.min(w, x + dash), 0, style, { strokePasses: 1 }));
    parts.push(roughLine(x, h, Math.min(w, x + dash), h, style, { strokePasses: 1 }));
  }
  for (let y = 0; y < h; y += dash + gap) {
    parts.push(roughLine(0, y, 0, Math.min(h, y + dash), style, { strokePasses: 1 }));
    parts.push(roughLine(w, y, w, Math.min(h, y + dash), style, { strokePasses: 1 }));
  }
  return combine(...parts);
}

function flowchartShape(name, w, h, style) {
  if (/Process|AlternateProcess|InternalStorage/i.test(name)) return rectangleLike(/Alternate/.test(name) ? "RoundedRectangle" : "Rectangle", w, h, style);
  if (/Terminator/i.test(name)) return rectangleLike("RoundedRectangle", w, h, style);
  if (/Decision/i.test(name)) return basicShape("Diamond", w, h, style);
  if (/Data|ManualInput/i.test(name)) return basicShape("Parallelogram", w, h, style);
  if (/Document/i.test(name)) return roughPath(`M 0 0 L ${w} 0 L ${w} ${h * 0.78} C ${w * 0.72} ${h * 0.95} ${w * 0.38} ${h * 0.62} 0 ${h * 0.86} Z`, style);
  if (/Multidocument/i.test(name)) return combine(roughPath(`M ${w * 0.12} 0 L ${w} 0 L ${w} ${h * 0.7} C ${w * 0.72} ${h * 0.86} ${w * 0.5} ${h * 0.6} ${w * 0.12} ${h * 0.78} Z`, style), roughPath(`M 0 ${h * 0.16} L ${w * 0.88} ${h * 0.16} L ${w * 0.88} ${h * 0.86} C ${w * 0.58} ${h} ${w * 0.35} ${h * 0.76} 0 ${h * 0.94} Z`, style));
  if (/Delay|Display/i.test(name)) return roughPath(`M 0 0 L ${w * 0.64} 0 C ${w * 1.1} ${h * 0.18} ${w * 1.1} ${h * 0.82} ${w * 0.64} ${h} L 0 ${h} Z`, style);
  if (/StoredData/i.test(name)) return roughPath(`M ${w * 0.18} 0 L ${w} 0 C ${w * 0.78} ${h * 0.25} ${w * 0.78} ${h * 0.75} ${w} ${h} L ${w * 0.18} ${h} C ${w * -0.04} ${h * 0.75} ${w * -0.04} ${h * 0.25} ${w * 0.18} 0 Z`, style);
  if (/Card/i.test(name)) return roughPolygon([[w * 0.18, 0], [w, 0], [w, h], [0, h], [0, h * 0.18]], style);
  if (/PunchedTape/i.test(name)) return roughPath(`M 0 ${h * 0.18} C ${w * 0.25} 0 ${w * 0.5} ${h * 0.34} ${w} ${h * 0.14} L ${w} ${h * 0.82} C ${w * 0.75} ${h} ${w * 0.5} ${h * 0.66} 0 ${h * 0.86} Z`, style);
  return basicShape(name, w, h, style);
}

function starOrBannerShape(name, w, h, style) {
  const starMatch = name.match(/(\d+)pointStar/i);
  if (starMatch) return roughPolygon(starPoints(Number(starMatch[1]), w, h, Number(starMatch[1]) > 12 ? 0.72 : 0.45), style);
  if (/Explosion1/i.test(name)) return roughPolygon(starPoints(12, w, h, 0.62, -Math.PI / 2), style);
  if (/Explosion2/i.test(name)) return roughPolygon(starPoints(16, w, h, 0.5, -Math.PI / 2 + 0.1), style);
  if (/Ribbon/i.test(name)) return ribbonShape(name, w, h, style);
  if (/Wave/i.test(name)) return waveShape(name, w, h, style);
  if (/Plaque/i.test(name)) return basicShape("Plaque", w, h, style);
  return roughPolygon(starPoints(5, w, h, 0.45), style);
}

function ribbonShape(name, w, h, style) {
  if (/LeftRight/i.test(name)) return combine(roughPolygon([[0, h * 0.22], [w * 0.18, h * 0.5], [0, h * 0.78], [w, h * 0.78], [w * 0.82, h * 0.5], [w, h * 0.22]], style), roughPath(`M ${w * 0.16} ${h * 0.32} C ${w * 0.36} ${h * 0.48} ${w * 0.64} ${h * 0.16} ${w * 0.84} ${h * 0.32}`, style));
  if (/Curved/i.test(name)) return roughPath(`M 0 ${h * 0.28} C ${w * 0.28} ${h * 0.02} ${w * 0.72} ${h * 0.54} ${w} ${h * 0.26} L ${w} ${h * 0.72} C ${w * 0.72} ${h} ${w * 0.28} ${h * 0.48} 0 ${h * 0.74} Z`, style);
  return roughPolygon([[0, h * 0.22], [w, h * 0.22], [w * 0.86, h * 0.5], [w, h * 0.78], [0, h * 0.78], [w * 0.14, h * 0.5]], style);
}

function waveShape(name, w, h, style) {
  const y1 = /Double/i.test(name) ? h * 0.35 : h * 0.5;
  const first = roughPath(`M 0 ${y1} C ${w * 0.25} ${y1 - h * 0.28} ${w * 0.25} ${y1 + h * 0.28} ${w * 0.5} ${y1} C ${w * 0.75} ${y1 - h * 0.28} ${w * 0.75} ${y1 + h * 0.28} ${w} ${y1}`, style);
  if (!/Double/i.test(name)) return first;
  return combine(first, roughPath(`M 0 ${h * 0.65} C ${w * 0.25} ${h * 0.37} ${w * 0.25} ${h * 0.93} ${w * 0.5} ${h * 0.65} C ${w * 0.75} ${h * 0.37} ${w * 0.75} ${h * 0.93} ${w} ${h * 0.65}`, style));
}

function scrollShape(name, w, h, style) {
  if (/Vertical/i.test(name)) return combine(roughPath(`M ${w * 0.24} ${h * 0.1} C ${w * 0.04} ${h * 0.18} ${w * 0.04} ${h * 0.38} ${w * 0.24} ${h * 0.45} L ${w * 0.24} ${h * 0.9} L ${w * 0.78} ${h * 0.9} L ${w * 0.78} ${h * 0.1} Z`, style), roughEllipse(w * 0.24, h * 0.18, w * 0.34, h * 0.18, style));
  return combine(roughPath(`M ${w * 0.1} ${h * 0.24} C ${w * 0.18} ${h * 0.04} ${w * 0.38} ${h * 0.04} ${w * 0.45} ${h * 0.24} L ${w * 0.9} ${h * 0.24} L ${w * 0.9} ${h * 0.78} L ${w * 0.1} ${h * 0.78} Z`, style), roughEllipse(w * 0.18, h * 0.24, w * 0.18, h * 0.34, style));
}

function braceShape(name, w, h, style) {
  if (/Double/i.test(name)) return combine(braceShape("LeftBrace", w / 2, h, style), translate(braceShape("RightBrace", w / 2, h, style), w / 2, 0));
  const left = /Left/i.test(name);
  const x0 = left ? w * 0.72 : w * 0.28;
  const x1 = left ? w * 0.22 : w * 0.78;
  return roughPath(`M ${x0} 0 C ${x1} ${h * 0.05} ${x1} ${h * 0.28} ${x0} ${h * 0.38} C ${left ? w * 0.95 : w * 0.05} ${h * 0.5} ${left ? w * 0.95 : w * 0.05} ${h * 0.5} ${x0} ${h * 0.62} C ${x1} ${h * 0.72} ${x1} ${h * 0.95} ${x0} ${h}`, style);
}

function bracketShape(name, w, h, style) {
  if (/Double/i.test(name)) return combine(bracketShape("LeftBracket", w / 2, h, style), translate(bracketShape("RightBracket", w / 2, h, style), w / 2, 0));
  const left = /Left/i.test(name);
  const xA = left ? w * 0.75 : w * 0.25;
  const xB = left ? w * 0.25 : w * 0.75;
  return combine(roughLine(xA, 0, xB, 0, style), roughLine(xB, 0, xB, h, style), roughLine(xB, h, xA, h, style));
}

function translate(drawable, dx, dy) {
  return {
    paths: drawable.paths.map(path => ({
      ...path,
      segments: path.segments.map(segment => ({
        ...segment,
        data: segment.data.map((value, index) => value + (index % 2 === 0 ? dx : dy))
      }))
    }))
  };
}

function actionButtonShape(name, w, h, style) {
  const box = rectangleLike("RoundedRectangle", w, h, style);
  const cx = w / 2;
  const cy = h / 2;
  if (/Back|Previous/i.test(name)) return combine(box, roughPolygon([[w * 0.62, h * 0.28], [w * 0.34, cy], [w * 0.62, h * 0.72]], style));
  if (/Forward|Next/i.test(name)) return combine(box, roughPolygon([[w * 0.38, h * 0.28], [w * 0.66, cy], [w * 0.38, h * 0.72]], style));
  if (/Beginning/i.test(name)) return combine(box, roughLine(w * 0.35, h * 0.28, w * 0.35, h * 0.72, style), roughPolygon([[w * 0.66, h * 0.28], [w * 0.42, cy], [w * 0.66, h * 0.72]], style));
  if (/End/i.test(name)) return combine(box, roughLine(w * 0.65, h * 0.28, w * 0.65, h * 0.72, style), roughPolygon([[w * 0.34, h * 0.28], [w * 0.58, cy], [w * 0.34, h * 0.72]], style));
  if (/Home/i.test(name)) return combine(box, roughPolygon([[w * 0.26, cy], [cx, h * 0.25], [w * 0.74, cy], [w * 0.66, cy], [w * 0.66, h * 0.72], [w * 0.34, h * 0.72], [w * 0.34, cy]], style));
  if (/Help/i.test(name)) return combine(box, roughPath(`M ${w * 0.38} ${h * 0.38} C ${w * 0.38} ${h * 0.22} ${w * 0.68} ${h * 0.22} ${w * 0.62} ${h * 0.42} C ${w * 0.58} ${h * 0.52} ${cx} ${h * 0.5} ${cx} ${h * 0.62}`, style), roughEllipse(cx, h * 0.75, 3, 3, style));
  if (/Information/i.test(name)) return combine(box, roughLine(cx, h * 0.42, cx, h * 0.74, style), roughEllipse(cx, h * 0.28, 3, 3, style));
  if (/Return/i.test(name)) return combine(box, roughPath(`M ${w * 0.7} ${h * 0.3} L ${w * 0.38} ${h * 0.3} C ${w * 0.18} ${h * 0.3} ${w * 0.18} ${h * 0.7} ${w * 0.42} ${h * 0.7}`, style), roughPolygon([[w * 0.42, h * 0.58], [w * 0.28, h * 0.7], [w * 0.42, h * 0.82]], style));
  if (/Sound/i.test(name)) return combine(box, roughPolygon([[w * 0.3, h * 0.44], [w * 0.44, h * 0.44], [w * 0.6, h * 0.3], [w * 0.6, h * 0.7], [w * 0.44, h * 0.56], [w * 0.3, h * 0.56]], style), roughPath(`M ${w * 0.66} ${h * 0.38} Q ${w * 0.76} ${h * 0.5} ${w * 0.66} ${h * 0.62}`, style));
  if (/Movie/i.test(name)) return combine(box, roughRect(w * 0.28, h * 0.32, w * 0.44, h * 0.36, style), roughLine(w * 0.38, h * 0.32, w * 0.38, h * 0.68, style), roughLine(w * 0.62, h * 0.32, w * 0.62, h * 0.68, style));
  if (/Document/i.test(name)) return combine(box, roughPolygon([[w * 0.34, h * 0.24], [w * 0.6, h * 0.24], [w * 0.72, h * 0.38], [w * 0.72, h * 0.76], [w * 0.34, h * 0.76]], style), roughLine(w * 0.6, h * 0.24, w * 0.6, h * 0.38, style), roughLine(w * 0.6, h * 0.38, w * 0.72, h * 0.38, style));
  return box;
}

function threeDPrimitive(plain, closedPoints, style) {
  return plain ? plainPolygon(closedPoints, style) : roughPolygon(closedPoints, style);
}

function threeDLine(plain, x1, y1, x2, y2, style) {
  return plain ? plainLine(x1, y1, x2, y2, style) : roughLine(x1, y1, x2, y2, style, { strokePasses: 1 });
}

function threeDPath(plain, d, style) {
  return plain ? plainPath(d, style) : roughPath(d, style, { strokePasses: 1 });
}

function threeDEllipse(plain, cx, cy, w, h, style) {
  return plain ? plainEllipse(cx, cy, w, h, style) : roughEllipse(cx, cy, w, h, style);
}

function threeDShape(name, w, h, style) {
  const plain = /Plain|Normal|Native/i.test(name);
  if (/Cylinder|Can|Database/i.test(name)) return threeDCylinder(w, h, style, plain);
  if (/Cone/i.test(name)) return threeDCone(w, h, style, plain);
  if (/Sphere|Ball/i.test(name)) return threeDSphere(w, h, style, plain);
  if (/Pyramid/i.test(name)) return threeDPyramid(w, h, style, plain);
  if (/Stack|Blocks/i.test(name)) return threeDStack(w, h, style, plain);
  return threeDCube(w, h, style, plain);
}

function threeDCube(w, h, style, plain) {
  const a = [w * 0.08, h * 0.28];
  const b = [w * 0.68, h * 0.28];
  const c = [w * 0.94, h * 0.08];
  const d = [w * 0.34, h * 0.08];
  const e = [w * 0.08, h * 0.9];
  const f = [w * 0.68, h * 0.9];
  const g = [w * 0.94, h * 0.7];
  return combine(
    threeDPrimitive(plain, [a, b, c, d], style),
    threeDPrimitive(plain, [b, c, g, f], style),
    threeDPrimitive(plain, [a, b, f, e], style)
  );
}

function threeDCylinder(w, h, style, plain) {
  const top = h * 0.18;
  const bottom = h * 0.82;
  const ellipseH = h * 0.28;
  const shell = `M ${w * 0.08} ${top} C ${w * 0.08} ${top - ellipseH * 0.45} ${w * 0.92} ${top - ellipseH * 0.45} ${w * 0.92} ${top} L ${w * 0.92} ${bottom} C ${w * 0.92} ${bottom + ellipseH * 0.45} ${w * 0.08} ${bottom + ellipseH * 0.45} ${w * 0.08} ${bottom} Z`;
  return combine(
    threeDPath(plain, shell, style),
    threeDEllipse(plain, w / 2, top, w * 0.84, ellipseH, style),
    threeDPath(plain, `M ${w * 0.08} ${bottom} C ${w * 0.08} ${bottom + ellipseH * 0.45} ${w * 0.92} ${bottom + ellipseH * 0.45} ${w * 0.92} ${bottom}`, style)
  );
}

function threeDCone(w, h, style, plain) {
  const bottom = h * 0.84;
  const shell = `M ${w / 2} ${h * 0.08} L ${w * 0.9} ${bottom} C ${w * 0.76} ${h * 0.98} ${w * 0.24} ${h * 0.98} ${w * 0.1} ${bottom} Z`;
  return combine(
    threeDPath(plain, shell, style),
    threeDPath(plain, `M ${w * 0.1} ${bottom} C ${w * 0.24} ${h * 0.98} ${w * 0.76} ${h * 0.98} ${w * 0.9} ${bottom}`, style),
    threeDLine(plain, w / 2, h * 0.08, w / 2, h * 0.9, style)
  );
}

function threeDSphere(w, h, style, plain) {
  return combine(
    threeDEllipse(plain, w / 2, h / 2, w * 0.86, h * 0.86, style),
    threeDPath(plain, `M ${w * 0.12} ${h / 2} C ${w * 0.32} ${h * 0.38} ${w * 0.68} ${h * 0.38} ${w * 0.88} ${h / 2} C ${w * 0.68} ${h * 0.62} ${w * 0.32} ${h * 0.62} ${w * 0.12} ${h / 2}`, style),
    threeDPath(plain, `M ${w / 2} ${h * 0.08} C ${w * 0.34} ${h * 0.28} ${w * 0.34} ${h * 0.72} ${w / 2} ${h * 0.92} C ${w * 0.66} ${h * 0.72} ${w * 0.66} ${h * 0.28} ${w / 2} ${h * 0.08}`, style)
  );
}

function threeDPyramid(w, h, style, plain) {
  const top = [w / 2, h * 0.06];
  const left = [w * 0.08, h * 0.88];
  const right = [w * 0.9, h * 0.88];
  const back = [w * 0.34, h * 0.62];
  return combine(
    threeDPrimitive(plain, [top, back, left], style),
    threeDPrimitive(plain, [top, right, back], style),
    threeDPrimitive(plain, [top, right, left], style)
  );
}

function threeDStack(w, h, style, plain) {
  const first = threeDCube(w * 0.72, h * 0.58, style, plain);
  const second = translate(threeDCube(w * 0.72, h * 0.58, style, plain), w * 0.2, h * 0.18);
  const third = translate(threeDCube(w * 0.72, h * 0.58, style, plain), w * 0.08, h * 0.36);
  return combine(first, second, third);
}

function shapeForMso(enumName, width, height, style) {
  const name = cleanMso(enumName);
  const { w, h } = dims(width, height, /^(?:Line|LineArrow|LineInverse)$|Connector/i.test(name) ? 1 : 80);
  if (/^rough3d/i.test(enumName)) return threeDShape(name, w, h, style);
  if (/ActionButton/i.test(name)) return actionButtonShape(name, w, h, style);
  if (/CloudCallout/i.test(name)) return calloutShape(name, w, h, style);
  if (usesLocalSemanticRecipe(name)) return basicShape(name, w, h, style);
  const officeOutline = officeOutlineShape(enumName, w, h, style);
  if (officeOutline) return officeOutline;

  if (/Callout/i.test(name) && !/ArrowCallout/i.test(name)) return calloutShape(name, w, h, style);
  if (/Flowchart/i.test(name)) return flowchartShape(name, w, h, style);
  if (isLineRecipeName(name)) return lineShape(name, w, h, style);
  if (/Arrow/i.test(name)) {
    if (/Callout/i.test(name)) return combine(arrowShape(name, w, h, style), rectangleLike("Rectangle", w * 0.52, h * 0.48, style));
    return arrowShape(name, w, h, style);
  }
  if (/Star|Explosion|Ribbon|Wave|Plaque/i.test(name)) return starOrBannerShape(name, w, h, style);
  if (/Gear6/i.test(name)) return roughPolygon(gearPoints(6, w, h), style);
  if (/Gear9/i.test(name)) return roughPolygon(gearPoints(9, w, h), style);
  if (/Rectangle|Frame/i.test(name)) return rectangleLike(name, w, h, style);
  if (/DoubleOval/i.test(name)) return basicShape(name, w, h, style);
  if (/CornerTabs|SquareTabs/i.test(name)) return combine(roughRect(0, 0, w, h, style), roughLine(w * 0.28, 0, w * 0.28, h * 0.28, style), roughLine(0, h * 0.28, w * 0.28, h * 0.28, style), roughLine(w * 0.72, h, w * 0.72, h * 0.72, style), roughLine(w, h * 0.72, w * 0.72, h * 0.72, style));
  if (/Corner/i.test(name)) return roughPolygon([[0, 0], [w, 0], [w, h * 0.24], [w * 0.24, h * 0.24], [w * 0.24, h], [0, h]], style);
  if (/DiagonalStripe/i.test(name)) return roughPolygon([[0, h * 0.25], [w * 0.25, 0], [w, 0], [w, h * 0.75], [w * 0.75, h], [0, h]], style);
  return basicShape(name, w, h, style);
}

function previewShapeForMso(enumName, width, height, style) {
  const name = cleanMso(enumName);
  const { w, h } = dims(width, height, /^(?:Line|LineArrow|LineInverse)$|Connector/i.test(name) ? 1 : 80);
  if (/^rough3d/i.test(enumName)) return threeDShape(name, w, h, style);
  if (usesSafeSemanticPreview(name)) return shapeForMso(enumName, width, height, style);
  const officeOutline = officeOutlineShape(enumName, w, h, style);
  if (officeOutline) return officeOutline;
  return shapeForMso(enumName, width, height, style);
}

function usesSafeSemanticPreview(name) {
  return /Cloud|ActionButton/i.test(name);
}

function usesLocalSemanticRecipe(name) {
  return /Cloud|SmileyFace|Sun|Moon|Heart|LightningBolt|Tear|NoSymbol|Can|Donut|DoubleOval|ChartPlus|ChartStar|Math|ActionButton|Brace|Bracket/i.test(name);
}

function kindDrawable(kind, width, height, style) {
  const { w, h } = dims(width, height, kind === "line" ? 1 : 80);
  if (kind === "threeD") return threeDCube(w, h, style, false);
  if (kind === "line") return roughLine(0, 0, w, Number(height) || 0, style);
  if (kind === "curve") return lineShape("Curve", w, h || 80, style);
  if (kind === "dashedBox") return dashedRect(w, h || 80, style);
  if (kind === "doubleCircle") return basicShape("DoubleOval", w, h || 80, style);
  if (kind === "arrow") return arrowShape("RightArrow", w, h || 60, style);
  if (kind === "ellipse") return roughEllipse(w / 2, h / 2, w, h, style);
  if (kind === "rectangle") return roughRect(0, 0, w, h, style);
  if (kind === "diamond") return basicShape("Diamond", w, h, style);
  if (kind === "triangle") return basicShape("Triangle", w, h, style);
  if (kind === "trapezoid") return basicShape("Trapezoid", w, h, style);
  return basicShape("Rectangle", w, h, style);
}

function kindFromMso(enumName = "") {
  const name = cleanMso(enumName);
  if (/^rough3d/i.test(enumName)) return "threeD";
  if (isLineRecipeName(name)) return "line";
  if (/Arrow/i.test(name)) return "arrow";
  if (/Oval|Ellipse/i.test(name)) return "ellipse";
  if (/Diamond/i.test(name)) return "diamond";
  if (/Triangle/i.test(name)) return "triangle";
  if (/Trapezoid/i.test(name)) return "trapezoid";
  if (/Rect|Rectangle|Frame/i.test(name)) return "rectangle";
  return "shape";
}

function recipeNameForMso(enumName = "") {
  const name = cleanMso(enumName);
  if (/^rough3d/i.test(enumName)) return /Plain/i.test(name) ? "three-d-plain" : "three-d-rough";
  if (/ActionButton/i.test(name)) return "action-button";
  if (/Callout/i.test(name) && !/ArrowCallout/i.test(name)) return "callout";
  if (/Flowchart/i.test(name)) return "flowchart";
  if (isLineRecipeName(name)) return "line";
  if (/Arrow/i.test(name)) return "arrow";
  if (/Star|Explosion|Ribbon|Wave|Plaque/i.test(name)) return "star-banner";
  if (/Gear/i.test(name)) return "gear";
  if (/Rectangle|Frame/i.test(name)) return "rectangle";
  return "basic";
}

function isLineRecipeName(name = "") {
  return /^(Line|LineArrow|LineInverse|Curve|StraightConnector|ElbowConnector|CurvedConnector|Arc|BlockArc)$/i.test(name);
}

export const generator = {
  pathRoles: PATH_ROLES,
  generate(shapeKind, params = {}) {
    const width = params.width ?? params.widthPt ?? 120;
    const height = params.height ?? params.heightPt ?? 80;
    return withHitArea(kindDrawable(shapeKind, width, height, params), width, height, params);
  },
  generateFromHost(request) {
    const style = request.Style ?? request.style ?? {};
    const source = request.SourceMsoType ?? request.sourceMsoType;
    const width = request.Width ?? request.width ?? 120;
    const height = request.Height ?? request.height ?? 80;
    if (source) return withHitArea(shapeForMso(source, width, height, style), width, height, style);
    const kind = request.ShapeKind ?? request.shapeKind ?? "rectangle";
    return withHitArea(kindDrawable(kind, width, height, style), width, height, style);
  },
  kindFromMso,
  usesOfficeOutline(enumName) {
    return Boolean(officePresetOutlines[enumName]?.paths?.length);
  },
  preview(enumName, width, height, style) {
    return withHitArea(previewShapeForMso(enumName, width, height, style), width, height, style);
  },
  recipeNameForMso
};

if (typeof window !== "undefined") {
  window.roughPpt = {
    generateFromHost(request) {
      return JSON.stringify(generator.generateFromHost(request));
    },
    preview(enumName, width, height, style) {
      return generator.preview(enumName, width, height, style);
    }
  };
}
