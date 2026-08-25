import { generator } from "./rough-shape-generator.mjs";
import { buildChartRecommendations, importZlkClusterResultFile, supportedZlkClusterPatterns } from "./zlk-cluster-result-importer.mjs";

function loadRecent() {
  try {
    const values = JSON.parse(localStorage.getItem("roughPptRecentShapes") || "[]");
    return Array.isArray(values) ? values.filter(value => typeof value === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function loadFavorites() {
  try {
    const values = JSON.parse(localStorage.getItem("roughPptFavoriteShapes") || "[]");
    return Array.isArray(values) ? values.filter(value => typeof value === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function loadRecentPaperPresets() {
  try {
    const ids = JSON.parse(localStorage.getItem("roughPptRecentPaperPresets") || "[]");
    return Array.isArray(ids) ? ids.filter(id => typeof id === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function loadFavoritePaperPresets() {
  try {
    const ids = JSON.parse(localStorage.getItem("roughPptFavoritePaperPresets") || "[]");
    return Array.isArray(ids) ? ids.filter(id => typeof id === "string").slice(0, 16) : [];
  } catch {
    return [];
  }
}

function loadRecentCommands() {
  try {
    const ids = JSON.parse(localStorage.getItem("roughPptRecentCommands") || "[]");
    return Array.isArray(ids) ? ids.filter(id => typeof id === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

const defaultFeatureBlock = {
  mode: "3d",
  visualStyle: "plain",
  countX: 3,
  countY: 3,
  countZ: 3,
  blockWidthPt: 24,
  blockHeightPt: 20,
  blockDepthPt: 12,
  gapPt: 0,
  roundness: 0,
  startColor: "#f8b6c8",
  endColor: "#c97a96",
  strokeColor: "#000000",
  strokeWidthPt: 0.8,
  gradientDirection: "x",
  gradientReverse: false,
  gradientAmount: 1,
  editDirection: "",
  editDelta: 0
};

const styleParamNames = [
  "stroke",
  "strokeWidthPt",
  "strokeTransparency",
  "roughness",
  "bowing",
  "edgeJitterPt",
  "maxRandomnessOffset",
  "strokePasses",
  "curveSampling",
  "fragmentStrokeDensity",
  "roughEngine",
  "roughSource",
  "fillSource",
  "fillWeight",
  "hachureGap",
  "curveFitting",
  "preserveVertices",
  "disableMultiStroke",
  "disableMultiStrokeFill",
  "tldrawOffsetPt",
  "roughMode",
  "nestedLayers",
  "nestedOverlap",
  "nestedGapPt",
  "nestedJitterPt",
  "nestedDirection",
  "seed",
  "fillMode",
  "fillColor",
  "fillTransparency",
  "fillStyle",
  "brushWidthPt",
  "brushDensity",
  "brushAngleDeg",
  "brushJitterPt",
  "brushOverlap",
  "dashStyle",
  "arrowheadStyle",
  "arrowheadPosition",
  "arrowheadLengthPt",
  "arrowheadWidthPt"
];

const baseStyleParams = Object.freeze({
  stroke: "#111111",
  strokeWidthPt: 2,
  strokeTransparency: 0,
  roughness: 0.8,
  bowing: 0.35,
  edgeJitterPt: 1.35,
  maxRandomnessOffset: 1.35,
  strokePasses: 1,
  curveSampling: 1,
  fragmentStrokeDensity: 0,
  roughEngine: "nativeWarp",
  roughSource: "native",
  fillSource: "auto",
  fillWeight: -1,
  hachureGap: -1,
  curveFitting: 0.95,
  preserveVertices: true,
  disableMultiStroke: false,
  disableMultiStrokeFill: true,
  tldrawOffsetPt: 0.67,
  roughMode: "classic",
  nestedLayers: 2,
  nestedOverlap: 0.55,
  nestedGapPt: 4,
  nestedJitterPt: 0.8,
  nestedDirection: "leftDownToRightUp",
  seed: 12345,
  fillMode: "none",
  fillColor: "#ffffff",
  fillTransparency: 0,
  fillStyle: "none",
  brushWidthPt: 5,
  brushDensity: 1,
  brushAngleDeg: -8,
  brushJitterPt: 1.2,
  brushOverlap: 0.35,
  dashStyle: "solid",
  arrowheadStyle: "rough",
  arrowheadPosition: "end",
  arrowheadLengthPt: 14,
  arrowheadWidthPt: 10
});

const styleParamRules = Object.freeze({
  stroke: { type: "color" },
  strokeWidthPt: { type: "number", min: 1, max: 8 },
  strokeTransparency: { type: "number", min: 0, max: 1 },
  roughness: { type: "number", min: 0.2, max: 4 },
  bowing: { type: "number", min: 0, max: 4 },
  edgeJitterPt: { type: "number", min: 0.2, max: 4 },
  maxRandomnessOffset: { type: "number", min: 0.2, max: 4 },
  strokePasses: { type: "number", min: 1, max: 4, integer: true },
  curveSampling: { type: "number", min: 0.5, max: 2.5 },
  fragmentStrokeDensity: { type: "number", min: 0, max: 3 },
  roughEngine: { type: "enum", values: ["nativeWarp", "roughJs"] },
  roughSource: { type: "enum", values: ["native", "roughjs", "excalidraw", "drawio", "d2", "tldraw"] },
  fillSource: { type: "enum", values: ["auto", "roughjs", "excalidraw", "drawio", "d2", "tldraw", "brush", "native"] },
  fillMode: { type: "enum", values: ["none", "solid"] },
  fillColor: { type: "color" },
  fillTransparency: { type: "number", min: 0, max: 1 },
  fillStyle: { type: "enum", values: ["none", "hachure", "cross-hatch", "zigzag", "dots", "dashed", "zigzag-line", "solid", "brush"] },
  fillWeight: { type: "number", min: -1, max: 12 },
  hachureGap: { type: "number", min: -1, max: 40 },
  curveFitting: { type: "number", min: 0.5, max: 1 },
  brushWidthPt: { type: "number", min: 1, max: 24 },
  brushDensity: { type: "number", min: 0.3, max: 2.5 },
  brushAngleDeg: { type: "number", min: -90, max: 90 },
  brushJitterPt: { type: "number", min: 0, max: 4 },
  brushOverlap: { type: "number", min: 0, max: 0.9 },
  dashStyle: { type: "enum", values: ["solid", "dash", "dot", "dash-dot"] },
  arrowheadStyle: { type: "enum", values: ["rough", "none", "triangle", "open", "stealth"] },
  arrowheadPosition: { type: "enum", values: ["end", "start", "both"] },
  arrowheadLengthPt: { type: "number", min: 4, max: 40 },
  arrowheadWidthPt: { type: "number", min: 4, max: 32 },
  tldrawOffsetPt: { type: "number", min: 0, max: 4 },
  preserveVertices: { type: "boolean" },
  disableMultiStroke: { type: "boolean" },
  disableMultiStrokeFill: { type: "boolean" },
  curveFitting: { type: "number", min: 0.5, max: 1 },
  hachureGap: { type: "number", min: -1, max: 40 },
  nestedLayers: { type: "number", min: 2, max: 5, integer: true },
  nestedOverlap: { type: "number", min: 0, max: 1 },
  nestedGapPt: { type: "number", min: 1, max: 12 },
  nestedJitterPt: { type: "number", min: 0, max: 3 },
  nestedDirection: { type: "enum", values: ["leftDownToRightUp", "leftUpToRightDown"] },
  seed: { type: "number", integer: true },
  roughMode: { type: "enum", values: ["classic", "nested"] }
});

const builtInStyleTemplates = Object.freeze([
  {
    id: "builtin-gentle",
    name: "轻微手绘",
    builtIn: true,
    params: { roughness: 0.55, bowing: 0.2, edgeJitterPt: 0.85, maxRandomnessOffset: 0.8, strokePasses: 1, curveSampling: 0.8, fragmentStrokeDensity: 0, roughMode: "classic", fillSource: "auto", fillStyle: "none" }
  },
  {
    id: "builtin-paper",
    name: "论文框图",
    builtIn: true,
    params: { roughness: 0.8, bowing: 0.35, edgeJitterPt: 1.35, maxRandomnessOffset: 1.35, strokePasses: 1, curveSampling: 1, fragmentStrokeDensity: 0, roughMode: "classic", fillSource: "auto", fillStyle: "none" }
  },
  {
    id: "builtin-bold",
    name: "粗线草图",
    builtIn: true,
    params: { strokeWidthPt: 2.8, roughness: 1.25, bowing: 0.7, edgeJitterPt: 2.1, maxRandomnessOffset: 1.9, strokePasses: 2, curveSampling: 1.25, fragmentStrokeDensity: 0.4, roughMode: "classic" }
  },
  {
    id: "builtin-nested-diagonal",
    name: "双线错位",
    builtIn: true,
    params: { roughness: 0.9, bowing: 0.35, edgeJitterPt: 1.35, maxRandomnessOffset: 1.25, strokePasses: 1, curveSampling: 1, fragmentStrokeDensity: 0, roughMode: "nested", nestedLayers: 2, nestedOverlap: 0.58, nestedGapPt: 5, nestedJitterPt: 0.55, nestedDirection: "leftDownToRightUp" }
  },
  {
    id: "builtin-textured",
    name: "纹理草稿",
    builtIn: true,
    params: { roughness: 1.05, bowing: 0.55, edgeJitterPt: 1.7, maxRandomnessOffset: 1.7, strokePasses: 2, curveSampling: 1.1, fragmentStrokeDensity: 0.6, roughMode: "classic", fillMode: "solid", fillSource: "roughjs", fillStyle: "hachure" }
  },
  {
    id: "builtin-roughjs",
    name: "Rough.js 原版",
    builtIn: true,
    params: { strokeWidthPt: 1, roughness: 1, bowing: 1, edgeJitterPt: 1.25, maxRandomnessOffset: 2, strokePasses: 2, curveSampling: 1, fragmentStrokeDensity: 0, roughEngine: "roughJs", roughSource: "roughjs", fillSource: "roughjs", preserveVertices: false, disableMultiStroke: false, disableMultiStrokeFill: false, curveFitting: 0.95, fillWeight: -1, hachureGap: -1, seed: 0, roughMode: "classic", fillStyle: "none" }
  },
  {
    id: "builtin-excalidraw",
    name: "Excalidraw",
    builtIn: true,
    params: { strokeWidthPt: 2, roughness: 1, bowing: 1, edgeJitterPt: 1.45, maxRandomnessOffset: 2, strokePasses: 2, curveSampling: 1, fragmentStrokeDensity: 0.15, roughEngine: "roughJs", roughSource: "excalidraw", fillMode: "solid", fillSource: "excalidraw", preserveVertices: true, disableMultiStroke: false, disableMultiStrokeFill: false, curveFitting: 1, fillWeight: 1, hachureGap: 8, seed: 1, roughMode: "classic", fillStyle: "solid" }
  },
  {
    id: "builtin-drawio-sketch",
    name: "draw.io 手绘",
    builtIn: true,
    params: { roughness: 2, bowing: 1, edgeJitterPt: 1.55, maxRandomnessOffset: 2, strokePasses: 2, curveSampling: 1, fragmentStrokeDensity: 0.2, roughEngine: "roughJs", roughSource: "drawio", fillSource: "drawio", preserveVertices: true, disableMultiStroke: false, disableMultiStrokeFill: false, curveFitting: 1, fillWeight: -1, hachureGap: -1, seed: 1, roughMode: "classic", fillStyle: "none" }
  },
  {
    id: "builtin-d2-sketch",
    name: "D2 草图",
    builtIn: true,
    params: { roughness: 1, bowing: 2, edgeJitterPt: 1.1, maxRandomnessOffset: 2, strokePasses: 2, curveSampling: 1, fragmentStrokeDensity: 0.05, roughEngine: "roughJs", roughSource: "d2", fillMode: "solid", fillSource: "d2", preserveVertices: false, disableMultiStroke: false, disableMultiStrokeFill: false, curveFitting: 0.95, fillWeight: 2, hachureGap: 16, seed: 1, roughMode: "classic", fillStyle: "solid" }
  },
  {
    id: "builtin-tldraw-draw",
    name: "tldraw 手绘线",
    builtIn: true,
    params: { roughness: 0.75, bowing: 0.35, edgeJitterPt: 0.67, maxRandomnessOffset: 1.1, strokePasses: 2, curveSampling: 1.15, fragmentStrokeDensity: 0.15, roughEngine: "nativeWarp", roughSource: "tldraw", fillSource: "tldraw", tldrawOffsetPt: 0.67, roughMode: "classic", fillStyle: "none" }
  },
  {
    id: "builtin-brush-fill",
    name: "涂刷填充",
    builtIn: true,
    params: { roughness: 0.9, bowing: 0.45, edgeJitterPt: 1.35, maxRandomnessOffset: 1.35, strokePasses: 1, curveSampling: 1, fragmentStrokeDensity: 0.15, roughMode: "classic", fillMode: "solid", fillSource: "brush", fillStyle: "brush", brushWidthPt: 6, brushDensity: 1.2, brushAngleDeg: -8, brushJitterPt: 1.35, brushOverlap: 0.45 }
  },
  {
    id: "builtin-fragmented",
    name: "短笔画碎线",
    builtIn: true,
    params: { roughness: 1.15, bowing: 0.7, edgeJitterPt: 1.45, maxRandomnessOffset: 1.8, strokePasses: 1, curveSampling: 1, fragmentStrokeDensity: 2.2, roughMode: "classic", fillStyle: "none" }
  },
  {
    id: "builtin-fragmented-dense",
    name: "密集短笔画",
    builtIn: true,
    params: { roughness: 1.05, bowing: 0.55, edgeJitterPt: 1.25, maxRandomnessOffset: 1.55, strokePasses: 1, curveSampling: 0.9, fragmentStrokeDensity: 3, roughMode: "classic", fillStyle: "none" }
  }
]);

function loadFeatureBlockDefault() {
  try {
    const saved = JSON.parse(localStorage.getItem("roughPptFeatureBlockDefaults") || "{}");
    return sanitizeFeatureBlockDefault({ ...defaultFeatureBlock, ...saved });
  } catch {
    return { ...defaultFeatureBlock };
  }
}

function sanitizeFeatureBlockDefault(feature) {
  const source = feature && typeof feature === "object" ? feature : {};
  const boundedNumber = (key, fallback, min, max, integer = false) => {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) return fallback;
    const clamped = Math.min(max, Math.max(min, integer ? Math.round(value) : value));
    return integer ? Math.max(min, clamped) : clamped;
  };
  const allowedValue = (key, fallback, allowed) => allowed.includes(source[key]) ? source[key] : fallback;
  const colorValue = (key, fallback) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(source[key]) ? source[key] : fallback;
  return {
    mode: allowedValue("mode", "3d", ["3d", "2d"]),
    visualStyle: allowedValue("visualStyle", "plain", ["plain", "rough"]),
    countX: boundedNumber("countX", 3, 1, 32, true),
    countY: boundedNumber("countY", 3, 1, 24, true),
    countZ: boundedNumber("countZ", 3, 1, 16, true),
    blockWidthPt: boundedNumber("blockWidthPt", 24, 6, 80),
    blockHeightPt: boundedNumber("blockHeightPt", 20, 6, 80),
    blockDepthPt: boundedNumber("blockDepthPt", 12, 2, 48),
    gapPt: boundedNumber("gapPt", 0, 0, 16),
    roundness: boundedNumber("roundness", 0, 0, 0.5),
    startColor: colorValue("startColor", "#f8b6c8"),
    endColor: colorValue("endColor", "#c97a96"),
    strokeColor: colorValue("strokeColor", "#000000"),
    strokeWidthPt: boundedNumber("strokeWidthPt", 0.8, 0.25, 6),
    gradientDirection: allowedValue("gradientDirection", "x", ["x", "y", "z", "diag"]),
    gradientReverse: source.gradientReverse === true,
    gradientAmount: boundedNumber("gradientAmount", 1, 0.1, 4),
    editDirection: "",
    editDelta: 0
  };
}

function loadStyleTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem("roughPptStyleTemplates") || "[]");
    const userTemplates = Array.isArray(saved) ? saved
      .filter(template => template && typeof template.id === "string" && typeof template.name === "string")
      .map(template => ({ ...template, builtIn: false, params: pickStyleParams(template.params ?? {}) })) : [];
    return [...builtInStyleTemplates.map(template => ({ ...template, params: pickStyleParams({ ...baseStyleParams, ...template.params }) })), ...userTemplates];
  } catch {
    return builtInStyleTemplates.map(template => ({ ...template, params: pickStyleParams({ ...baseStyleParams, ...template.params }) }));
  }
}

// 本机存储可能被禁用或写满，写入失败时界面必须继续可用，只是偏好不再持久化。
// 读取路径本来就有 try/catch，写入路径必须对称处理。
function persistSetting(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // 这里可能在 els 初始化之前被调用，所以反馈本身也要隔离。
    try {
      if (!persistSetting.reported && els?.status) {
        persistSetting.reported = true;
        setStatus("界面偏好无法写入本机存储，本次设置只在当前窗口生效。", true);
      }
    } catch {}
    return false;
  }
}

function readSessionSetting(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionSetting(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeSessionSetting(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function saveUserStyleTemplates(templates) {
  persistSetting("roughPptStyleTemplates", JSON.stringify(templates.filter(template => !template.builtIn)));
}

function pickStyleParams(params) {
  const source = params && typeof params === "object" ? params : {};
  const result = {};
  for (const name of styleParamNames) {
    const rule = styleParamRules[name];
    const value = source[name];
    if (rule.type === "enum") {
      result[name] = rule.values.includes(value) ? value : baseStyleParams[name];
      continue;
    }
    if (rule.type === "color") {
      result[name] = typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
        ? value
        : baseStyleParams[name];
      continue;
    }
    if (rule.type === "boolean") {
      result[name] = typeof value === "boolean" ? value : baseStyleParams[name];
      continue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      result[name] = baseStyleParams[name];
      continue;
    }
    const rounded = rule.integer ? Math.round(parsed) : parsed;
    result[name] = "min" in rule ? Math.min(rule.max, Math.max(rule.min, rounded)) : rounded;
  }
  return result;
}

function paramsForTemplateId(templates, templateId) {
  const template = templates.find(item => item.id === templateId) ?? templates.find(item => item.id === "builtin-paper") ?? templates[0];
  return pickStyleParams(normalizeStyle({ ...baseStyleParams, ...(template?.params ?? {}) }, baseStyleParams));
}

const initialStyleTemplates = loadStyleTemplates();
const initialStyleTemplateId = localStorage.getItem("roughPptSelectedStyleTemplate") || "builtin-paper";
const initialInsertParams = paramsForTemplateId(initialStyleTemplates, initialStyleTemplateId);
const validSearchScopes = new Set(["all", "shape", "command", "preset", "chart", "asset"]);
const savedSearchScope = localStorage.getItem("roughPptSearchScope") || "all";
const validShapeSortModes = new Set(["smart", "favorites", "recent", "az"]);
const savedSortMode = localStorage.getItem("roughPptSortMode") || "smart";
const GUIDE_RETURN_SCROLL_KEY = "roughPptGuideReturnScrollY";
const ZOTERO_IMAGE_RENDER_BATCH = 30;
const PALETTE_SCHEME_RENDER_BATCH = 16;
const CHART_DATASET_RENDER_BATCH = 24;
const SHAPE_CARD_RENDER_BATCH = 36;
const PAPER_PRESET_RENDER_BATCH = 24;
const USER_ASSET_RENDER_BATCH = 24;
const ZLK_IMPORT_MAX_FILES = 120;
const ZLK_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const ZLK_IMPORT_SUPPORTED_EXTENSIONS = new Set([".json", ".csv", ".tex", ".md"]);

const state = {
  uiMode: localStorage.getItem("roughPptUiMode") === "full" ? "full" : "simple",
  selectedChartPresetId: localStorage.getItem("roughPptChartPresetId") || "leaderboardBar",
  catalog: [],
  catalogDegraded: false,
  userAssets: [],
  zoteroImages: [],
  zoteroPalette: { swatches: [] },
  activeZoteroReferenceImageId: "",
  activeZoteroReferenceTitle: "",
  activeZoteroPaletteSaved: true,
  skipReferenceChangePromptForSession: false,
  zoteroImageStatus: "",
  zoteroDatabasePath: "",
  zoteroDatabaseSource: "",
  zoteroDatabaseFound: false,
  zoteroQuery: "",
  zoteroImageVisibleCount: ZOTERO_IMAGE_RENDER_BATCH,
  shapeCardVisibleCount: SHAPE_CARD_RENDER_BATCH,
  paperPresetVisibleCount: PAPER_PRESET_RENDER_BATCH,
  userAssetVisibleCount: USER_ASSET_RENDER_BATCH,
  activeZoteroSwatch: null,
  paletteSchemes: [],
  paletteSchemeVisibleCount: PALETTE_SCHEME_RENDER_BATCH,
  selectedPaletteIds: new Set(),
  selectedAssetIds: new Set(),
  shapeIcons: {},
  quickShapeDetails: {},
  preferOfficeIcons: false,
  recent: loadRecent(),
  favorites: loadFavorites(),
  quickShapes: [],
  quickShapesLoaded: false,
  sortMode: validShapeSortModes.has(savedSortMode) ? savedSortMode : "smart",
  searchScope: validSearchScopes.has(savedSearchScope) ? savedSearchScope : "all",
  query: "",
  recentCommands: loadRecentCommands(),
  category: "all",
  paperPresetCategory: localStorage.getItem("roughPptPaperPresetCategory") || "all",
  recentPaperPresets: loadRecentPaperPresets(),
  favoritePaperPresets: loadFavoritePaperPresets(),
  chartDatasets: [],
  chartDatasetVisibleCount: CHART_DATASET_RENDER_BATCH,
  chartImportError: "",
  zlkAutomationStatus: "等待 SimpleExperiment 自动绘图请求。",
  zlkAutomationResult: null,
  buildInfo: null,
  buildInfoUnavailable: false,
  updateChecking: false,
  selectionKey: "",
  lastRoughSelectionKey: "",
  pendingParamEdit: null,
  featureBlock: loadFeatureBlockDefault(),
  styleTemplates: initialStyleTemplates,
  selectedStyleTemplateId: initialStyleTemplateId,
  insertParams: { ...initialInsertParams },
  params: { ...initialInsertParams }
};

const els = {
  search: document.querySelector("#search"),
  sortMode: document.querySelector("#sortMode"),
  categories: document.querySelector("#categories"),
  grid: document.querySelector("#shapeGrid"),
  count: document.querySelector("#count"),
  searchSuggestions: document.querySelector("#searchSuggestions"),
  commandResults: document.querySelector("#commandResults"),
  searchEmptyState: document.querySelector("#searchEmptyState"),
  searchScopeButtons: Array.from(document.querySelectorAll("[data-search-scope]")),
  sectionNav: document.querySelector("#sectionNav"),
  sectionNavToggle: document.querySelector("#sectionNavToggle"),
  sectionNavButtons: Array.from(document.querySelectorAll("[data-section-nav]")),
  pathShortcutButtons: Array.from(document.querySelectorAll("[data-path-shortcut]")),
  params: document.querySelector("#params"),
  refresh: document.querySelector("#refreshSelection"),
  convert: document.querySelector("#convertSelection"),
  inspect: document.querySelector("#inspectSelection"),
  save: document.querySelector("#saveSelection"),
  selectCarrier: document.querySelector("#selectCarrier"),
  reloadAssets: document.querySelector("#reloadAssets"),
  selectAssets: document.querySelector("#selectAssets"),
  importAssets: document.querySelector("#importAssets"),
  exportAssets: document.querySelector("#exportAssets"),
  userAssets: document.querySelector("#userAssets"),
  assetCount: document.querySelector("#assetCount"),
  quickShapes: document.querySelector("#quickShapes"),
  quickAddToggle: document.querySelector("#quickAddToggle"),
  quickShapeDropdown: document.querySelector("#quickShapeDropdown"),
  quickShapeContextMenu: document.querySelector("#quickShapeContextMenu"),
  reloadQuickShapes: document.querySelector("#reloadQuickShapes"),
  styleTemplateSelect: document.querySelector("#styleTemplateSelect"),
  styleTemplatePreview: document.querySelector("#styleTemplatePreview"),
  styleTemplateTools: document.querySelector("#styleTemplateTools"),
  styleQuickButtons: Array.from(document.querySelectorAll("[data-style-quick]")),
  styleParamJumpButtons: Array.from(document.querySelectorAll("[data-param-group-jump]")),
  applyStyleTemplate: document.querySelector("#applyStyleTemplate"),
  redrawFromStyle: document.querySelector("#redrawFromStyle"),
  saveStyleTemplate: document.querySelector("#saveStyleTemplate"),
  renameStyleTemplate: document.querySelector("#renameStyleTemplate"),
  paperPresetFilters: document.querySelector("#paperPresetFilters"),
  paperPresetGrid: document.querySelector("#paperPresetGrid"),
  paperPresetCount: document.querySelector("#paperPresetCount"),
  zlkChartFiles: document.querySelector("#zlkChartFiles"),
  zlkChartFolder: document.querySelector("#zlkChartFolder"),
  zlkChartFolderButton: document.querySelector("#zlkChartFolderButton"),
  zlkChartImport: document.querySelector("#zlkChartImport"),
  zlkChartClear: document.querySelector("#zlkChartClear"),
  zlkChartSummary: document.querySelector("#zlkChartSummary"),
  zlkAutomationStatus: document.querySelector("#zlkAutomationStatus"),
  zlkChartResults: document.querySelector("#zlkChartResults"),
  chartPresetShell: document.querySelector("#chartPresetShell"),
  chartPresetStrip: document.querySelector("#chartPresetStrip"),
  chartPresetPreview: document.querySelector("#chartPresetPreview"),
  uiModeSimple: document.querySelector("#uiModeSimple"),
  uiModeFull: document.querySelector("#uiModeFull"),
  zoteroImageSearch: document.querySelector("#zoteroImageSearch"),
  zoteroImageReload: document.querySelector("#zoteroImageReload"),
  zoteroImageSummary: document.querySelector("#zoteroImageSummary"),
  zoteroImageStatus: document.querySelector("#zoteroImageStatus"),
  zoteroImageGrid: document.querySelector("#zoteroImageGrid"),
  zoteroPaletteGrid: document.querySelector("#zoteroPaletteGrid"),
  paletteSchemeGrid: document.querySelector("#paletteSchemeGrid"),
  paletteLibrarySummary: document.querySelector("#paletteLibrarySummary"),
  saveZoteroPalette: document.querySelector("#saveZoteroPalette"),
  zoteroPaletteSummary: document.querySelector("#zoteroPaletteSummary"),
  extractClipboardPalette: document.querySelector("#extractClipboardPalette"),
  extractSlidePalette: document.querySelector("#extractSlidePalette",
    ".paper-preset-card button, .paper-preset-grid button, #paperPresetGrid button"),
  importPalettes: document.querySelector("#importPalettes"),
  exportPalettes: document.querySelector("#exportPalettes"),
  reloadPalettes: document.querySelector("#reloadPalettes"),
  zoteroSwatchContextMenu: document.querySelector("#zoteroSwatchContextMenu"),
  insertFeatureBlock: document.querySelector("#insertFeatureBlock"),
  saveFeatureDefault: document.querySelector("#saveFeatureDefault"),
  featureDirectionTools: document.querySelector("#featureDirectionTools"),
  featurePanel: document.querySelector(".feature-block-panel"),
  featureBlockSummary: document.querySelector("#featureBlockSummary"),
  jumpToNext: document.querySelector("#jumpToNext"),
  selectionBadge: document.querySelector("#selectionBadge"),
  selectionState: document.querySelector("#selectionState"),
  selectionNextStep: document.querySelector("#selectionNextStep"),
  selectionNextIcon: document.querySelector(".selection-next-icon"),
  selectionNextTitle: document.querySelector("[data-selection-next-title]"),
  selectionNextDetail: document.querySelector("[data-selection-next-detail]"),
  selectionNextAction: document.querySelector("#selectionNextAction"),
  selectionEmptyActions: document.querySelector("#selectionEmptyActions"),
  status: document.querySelector("#status"),
  buildInfo: document.querySelector("#buildInfo"),
  checkUpdates: document.querySelector("#checkUpdates"),
  inlinePrompt: document.querySelector("#inlinePrompt")
};

els.galleryToggle = document.querySelector("#galleryToggle");
els.shapeDropdown = document.querySelector("#shapeDropdown");

let updateTimer = 0;
let featurePresetTimer = 0;
let zoteroSearchTimer = 0;
let busyLockWatchdog = 0;
let focusPulseTimer = 0;
let quickShapeContextArmTimer = 0;
let zoteroSwatchMenuArmTimer = 0;
let scheduledRenderHandle = 0;
let shapePreviewObserver = null;
const galleryIconObservers = new Map();
let scheduledRenderCancel = null;
let scheduledZoteroLibraryHandle = 0;
let scheduledZoteroLibraryCancel = null;
let zoteroImageRequestInFlight = false;
let zoteroImageRequestQuery = null;
let queuedZoteroImageQuery = null;
let queuedZoteroImageForce = false;
let featureDirectionInput = false;
const PARAM_SYNC_HOLD_MS = 2400;
const numericParamNames = new Set(["strokeWidthPt", "strokeTransparency", "roughness", "bowing", "edgeJitterPt", "maxRandomnessOffset", "strokePasses", "curveSampling", "fragmentStrokeDensity", "fillWeight", "hachureGap", "curveFitting", "tldrawOffsetPt", "nestedLayers", "nestedOverlap", "nestedGapPt", "nestedJitterPt", "seed", "fillTransparency", "brushWidthPt", "brushDensity", "brushAngleDeg", "brushJitterPt", "brushOverlap", "arrowheadLengthPt", "arrowheadWidthPt"]);

const styleParamGroups = [
  {
    title: "常用",
    hint: "线宽、粗糙、弯曲、颜色、填充",
    open: true,
    names: ["strokeWidthPt", "roughness", "bowing", "stroke", "fillMode", "fillColor", "fillStyle"]
  },
  {
    title: "边界",
    hint: "扰动、偏移、采样、来源、种子",
    open: false,
    names: ["edgeJitterPt", "maxRandomnessOffset", "strokePasses", "curveSampling", "fragmentStrokeDensity", "roughEngine", "roughSource", "seed"]
  },
  {
    title: "填充纹理",
    hint: "来源、透明、纹理、宽刷",
    open: false,
    names: ["fillSource", "fillTransparency", "fillWeight", "hachureGap", "curveFitting", "brushWidthPt", "brushDensity", "brushAngleDeg", "brushJitterPt", "brushOverlap"]
  },
  {
    title: "嵌套",
    hint: "模式、层数、重合、错位、方向",
    open: false,
    names: ["roughMode", "nestedLayers", "nestedOverlap", "nestedGapPt", "nestedJitterPt", "nestedDirection"]
  },
  {
    title: "线条",
    hint: "透明、虚线、箭头、多笔画",
    open: false,
    names: ["strokeTransparency", "dashStyle", "arrowheadStyle", "arrowheadPosition", "arrowheadLengthPt", "arrowheadWidthPt", "tldrawOffsetPt", "preserveVertices", "disableMultiStroke", "disableMultiStrokeFill"]
  }
];

const featureParamGroups = [
  {
    title: "模式与数量",
    hint: "维度、视觉风格、X/Y/Z 数量",
    open: true,
    names: ["mode", "visualStyle", "countX", "countY", "countZ"]
  },
  {
    title: "尺寸与结构",
    hint: "块宽、块高、深度、间距、圆角",
    open: true,
    names: ["blockWidthPt", "blockHeightPt", "blockDepthPt", "gapPt", "roundness"]
  },
  {
    title: "颜色与边线",
    hint: "起止色、边线、渐变方向",
    open: false,
    names: ["startColor", "endColor", "strokeColor", "strokeWidthPt", "gradientDirection", "gradientReverse", "gradientAmount"]
  }
];

const galleryGroups = [
  { id: "recent", title: "最近使用", match: item => recentGalleryEnums().includes(item.enumName) },
  { id: "lines", title: "线条", match: item => item.category === "lines" },
  { id: "rectangles", title: "矩形", match: item => item.category === "rectangles" },
  { id: "basic", title: "基本形状", match: item => item.category === "basic" && !/^msoShapeMath/i.test(item.enumName) },
  { id: "arrows", title: "箭头总汇", match: item => item.category === "arrows" },
  { id: "math", title: "公式形状", match: item => /^msoShapeMath/i.test(item.enumName) },
  { id: "flowchart", title: "流程图", match: item => item.category === "flowchart" },
  { id: "stars-and-banners", title: "星与旗帜", match: item => item.category === "stars-and-banners" },
  { id: "callouts", title: "标注", match: item => item.category === "callouts" || /Callout/i.test(item.enumName) },
  { id: "three-d-rough", title: "三维对象（手绘）", match: item => item.category === "three-d-rough" },
  { id: "three-d-plain", title: "三维对象（普通）", match: item => item.category === "three-d-plain" },
  { id: "action-buttons", title: "动作按钮", match: item => item.category === "action-buttons" }
];

const categoryOrder = Object.freeze(["all", ...galleryGroups.map(group => group.id)]);

const paperStructurePresets = Object.freeze([
  {
    id: "transformerEncoder",
    title: "Transformer 编码器",
    detail: "自注意力、前馈网络、残差归一化和上下文特征的通用编码器堆叠。",
    icon: "\u25a6",
    color: "#2563eb",
    category: "ai",
    tags: ["编码器", "注意力", "大模型"],
    keywords: ["Transformer 编码器", "编码器", "编码器结构图", "自注意力", "注意力机制图", "前馈网络", "残差", "归一化", "encoder", "attention", "AI结构"]
  },
  {
    id: "encoderDecoder",
    title: "编码器-解码器",
    detail: "输入、编码器、潜变量、解码器和输出组成的通用生成或重建结构。",
    icon: "\u25b7",
    color: "#4f46e5",
    category: "ai",
    tags: ["编码", "解码", "生成"],
    keywords: ["编码器", "解码器", "编码器结构图", "解码器结构图", "encoder", "decoder", "生成", "生成框架", "报告生成", "报告生成框架", "重建"]
  },
  {
    id: "visionTransformer",
    title: "视觉编码器",
    detail: "医学图像、Patch 切分、嵌入、视觉编码器和分类节点。",
    icon: "\u25a3",
    color: "#195a9a",
    category: "medical",
    tags: ["图像", "Patch", "分类"],
    keywords: ["视觉编码器", "图像编码器", "ViT", "CNN", "Swin", "Patch", "医学影像", "特征图"]
  },
  {
    id: "contrastiveDualTower",
    title: "图文对比双塔",
    detail: "图像塔、文本塔、投影头、相似度矩阵和对比目标。",
    icon: "\u25eb",
    color: "#8b6f1d",
    category: "multimodal",
    tags: ["图文", "对比学习", "双塔"],
    keywords: ["对比学习双塔", "对比学习框架", "图文对比框架", "CLIP", "双塔", "图文对齐", "投影头", "相似度", "contrastive"]
  },
  {
    id: "multimodalFusion",
    title: "多模态融合",
    detail: "影像、报告、表格三分支编码，跨模态融合后输出分类和诊断。",
    icon: "\u25c7",
    color: "#2f855a",
    category: "multimodal",
    tags: ["多模态", "融合", "诊断"],
    keywords: ["多模态融合", "医学多模态框架", "多模态框架", "医学图像报告", "表格", "图文融合", "跨模态", "fusion", "诊断"]
  },
  {
    id: "medicalImageReport",
    title: "医学图像-报告流程",
    detail: "影像输入、视觉特征、ROI、报告生成、诊断输出和医生审阅。",
    icon: "\u25b1",
    color: "#b4233c",
    category: "medical",
    tags: ["医学图像", "报告", "诊断"],
    keywords: ["医学图像-报告流程", "医学影像报告", "报告生成", "报告生成框架", "图像报告生成", "radiology report", "ROI", "诊断输出"]
  },
  {
    id: "unetSegmentation",
    title: "医学分割流程",
    detail: "编码器、瓶颈、解码器、跳跃连接和分割掩膜的通用分割结构。",
    icon: "\u25a9",
    color: "#16a34a",
    category: "medical",
    tags: ["分割", "U-Net", "跳连"],
    keywords: ["医学分割流程", "U-Net", "分割", "跳跃连接", "解码器", "编码器", "mask", "segmentation"]
  },
  {
    id: "classificationDiagnosis",
    title: "分类诊断头",
    detail: "融合特征、池化、分类头、诊断头、概率校准和解释输出。",
    icon: "\u25ce",
    color: "#be123c",
    category: "medical",
    tags: ["分类", "诊断", "校准"],
    keywords: ["分类头", "诊断头", "分类诊断流程", "分类诊断框架", "classification head", "logits", "softmax", "风险评分", "概率校准"]
  },
  {
    id: "largeModelRag",
    title: "大模型诊断 RAG",
    detail: "多模态输入、知识检索、多模态大模型、诊断建议和人工复核。",
    icon: "\u25c9",
    color: "#6d28d9",
    category: "llm",
    tags: ["大模型", "RAG", "解释"],
    keywords: ["大模型诊断", "大模型诊断框架", "RAG", "多模态大模型", "知识检索", "人工复核", "LLM", "解释报告"]
  },
  {
    id: "clinicalValidation",
    title: "临床验证流程",
    detail: "训练、内部验证、外部测试、指标、曲线、校准和临床报告。",
    icon: "\u25a4",
    color: "#334155",
    category: "evaluation",
    tags: ["验证", "指标", "临床"],
    keywords: ["临床验证流程", "外部测试", "ROC", "PR", "校准", "亚组", "失败案例", "临床报告"]
  },
  {
    id: "medicalTriModalDiagnosis",
    title: "三模态医学诊断",
    detail: "图像、报告文本和表格变量三路编码，融合后输出分类、风险和解释证据。",
    icon: "\u25c8",
    color: "#0f766e",
    category: "multimodal",
    tags: ["三模态", "医学诊断", "融合"],
    keywords: ["三模态医学诊断", "医学多模态框架", "三模态框架", "图像文本表格", "医学图像报告表格", "多模态诊断", "风险分层", "解释证据"]
  },
  {
    id: "medicalVlmReportDiagnosis",
    title: "医学 VLM 报告诊断",
    detail: "视觉编码器、提示词、医学 VLM/LLM、结构化报告和诊断分类闭环。",
    icon: "\u25b1",
    color: "#7c3aed",
    category: "llm",
    tags: ["VLM", "报告生成", "诊断"],
    keywords: ["医学 VLM", "医学视觉语言模型", "报告诊断", "报告生成", "报告生成框架", "医学报告生成框架", "LLM", "VLM", "医生复核"]
  },
  {
    id: "tabularClinicalBranch",
    title: "表格临床分支",
    detail: "人口学、检验指标、病史和 EHR 变量，经缺失值处理与表格编码器输出临床表征。",
    icon: "\u25a4",
    color: "#16a34a",
    category: "medical",
    tags: ["表格", "临床变量", "EHR"],
    keywords: ["表格临床分支", "表格特征", "临床变量", "EHR", "检验指标", "缺失值", "TabTransformer"]
  },
  {
    id: "crossModalAttentionFusion",
    title: "跨模态注意力融合",
    detail: "图像、文本、表格 token 经 Cross Attention 和门控融合形成共享表示。",
    icon: "\u25c7",
    color: "#4f46e5",
    category: "multimodal",
    tags: ["注意力", "融合", "Token"],
    keywords: ["跨模态注意力融合", "注意力机制图", "跨模态注意力图", "cross attention", "门控融合", "图像 token", "文本 token", "表格 token", "共享表示"]
  },
  {
    id: "llmAdapterFineTune",
    title: "LLM Adapter 微调",
    detail: "冻结 LLM/VLM 主干，只训练 Adapter、LoRA、Prompt 和医学任务头。",
    icon: "\u25ce",
    color: "#6d28d9",
    category: "llm",
    tags: ["大模型", "LoRA", "微调"],
    keywords: ["LLM Adapter 微调", "LoRA", "Adapter", "Prompt", "参数高效微调", "冻结大模型", "医学任务头"]
  },
  {
    id: "diagnosisEvaluationPanel",
    title: "诊断评估面板",
    detail: "ROC、PR、校准、决策曲线、混淆矩阵、亚组分析和失败案例输出。",
    icon: "\u25a9",
    color: "#334155",
    category: "evaluation",
    tags: ["评估", "校准", "临床报告"],
    keywords: ["诊断评估面板", "ROC", "PR", "校准曲线", "决策曲线", "混淆矩阵", "亚组分析", "失败案例"]
  },
  {
    id: "transformerDecoderBlock",
    title: "Transformer 解码器块",
    detail: "掩码自注意力、交叉注意力、前馈网络和输出投影组成的通用解码结构。",
    icon: "\u25a6",
    color: "#4f46e5",
    category: "ai",
    tags: ["解码器", "交叉注意力", "生成"],
    keywords: ["Transformer 解码器块", "解码器结构图", "Transformer Decoder", "掩码注意力", "交叉注意力", "注意力机制图", "自回归", "生成输出", "词表投影"]
  },
  {
    id: "blip2QformerBridge",
    title: "Q-Former VLM 桥接",
    detail: "视觉特征、Query Transformer、压缩语义 token 与冻结 LLM 的通用桥接结构。",
    icon: "\u25c9",
    color: "#7c3aed",
    category: "llm",
    tags: ["VLM", "Q-Former", "桥接"],
    keywords: ["Q-Former", "BLIP-2", "VLM 桥接", "Query Transformer", "冻结 LLM", "视觉语言模型", "报告推理"]
  },
  {
    id: "medicalInstructionVlm",
    title: "医学指令 VLM",
    detail: "医学图像、临床指令、视觉投影、多模态对齐和诊断回答生成流程。",
    icon: "\u25b1",
    color: "#6d28d9",
    category: "llm",
    tags: ["指令微调", "VLM", "诊断问答"],
    keywords: ["医学指令 VLM", "LLaVA", "视觉指令", "临床问题", "多模态指令", "医学问答", "诊断建议"]
  },
  {
    id: "medclipSemanticMatching",
    title: "MedCLIP 语义匹配",
    detail: "图像分支、文本分支、归一化嵌入、相似度矩阵和零样本诊断。",
    icon: "\u25eb",
    color: "#8b6f1d",
    category: "multimodal",
    tags: ["医学图文", "语义匹配", "零样本"],
    keywords: ["MedCLIP", "医学图文匹配", "语义相似度", "零样本分类", "检索诊断", "图文对齐", "对比学习", "对比学习框架"]
  },
  {
    id: "selfSupervisedMaePretrain",
    title: "自监督预训练",
    detail: "未标注影像经遮挡重建预训练，再迁移到分类、分割等下游任务。",
    icon: "\u25a3",
    color: "#2563eb",
    category: "ai",
    tags: ["自监督", "预训练", "迁移"],
    keywords: ["自监督预训练", "MAE", "弱监督", "掩码重建", "未标注数据", "迁移学习", "下游微调"]
  },
  {
    id: "multimodalRagReportTable",
    title: "报告表格 RAG",
    detail: "图像、报告、表格统一检索键，经多模态大模型输出诊断、证据和结构化表格。",
    icon: "\u25c7",
    color: "#0f766e",
    category: "llm",
    tags: ["RAG", "报告表格", "证据引用"],
    keywords: ["报告表格 RAG", "多模态 RAG", "结构化表格", "证据引用", "病例检索", "医学知识库", "医生复核"]
  },
  {
    id: "swinUnetr3DSegmentation",
    title: "3D Swin UNETR 分割",
    detail: "3D 影像经层级 Transformer 编码、UNETR 解码和跳连输出器官或病灶掩膜。",
    icon: "\u25a9",
    color: "#16a34a",
    category: "medical",
    tags: ["3D 分割", "Swin", "UNETR"],
    keywords: ["3D Swin UNETR", "Swin UNETR", "3D 分割", "体数据", "多尺度特征", "器官分割", "病灶掩膜"]
  },
  {
    id: "tabTransformerRisk",
    title: "表格 Transformer 风险",
    detail: "类别变量、连续变量和缺失掩码经表格 Transformer 输出风险评分与校准概率。",
    icon: "\u25a4",
    color: "#16a34a",
    category: "medical",
    tags: ["表格", "风险预测", "校准"],
    keywords: ["表格 Transformer 风险", "TabTransformer", "风险预测", "类别变量", "连续变量", "校准概率", "临床分层"]
  },
  {
    id: "clinicalDeploymentMonitoring",
    title: "临床部署监测",
    detail: "上线输入、部署模型、数据漂移、性能监测、人审告警和再训练闭环。",
    icon: "\u25a4",
    color: "#334155",
    category: "evaluation",
    tags: ["部署", "漂移监测", "人机闭环"],
    keywords: ["临床部署监测", "部署", "数据漂移", "性能监测", "医生反馈", "主动学习", "再训练", "质控"]
  },
  {
    id: "federatedLearningMedical",
    title: "多中心联邦学习",
    detail: "多家医院本地训练，安全聚合为全局模型，并进行外部验证和闭环更新。",
    icon: "\u25a4",
    color: "#195a9a",
    category: "medical",
    tags: ["多中心", "联邦学习", "隐私"],
    keywords: ["多中心联邦学习", "联邦学习", "多中心医学", "隐私保护", "安全聚合", "外部验证", "federated learning"]
  },
  {
    id: "diffusionAugmentation",
    title: "医学扩散增强",
    detail: "真实影像和标签经条件扩散生成合成样本，再质控后用于下游训练。",
    icon: "\u25a3",
    color: "#7c3aed",
    category: "ai",
    tags: ["扩散模型", "数据增强", "生成"],
    keywords: ["医学扩散增强", "扩散模型", "数据增强", "合成数据", "生成模型", "diffusion", "synthetic data"]
  },
  {
    id: "survivalOutcomePrediction",
    title: "生存预后预测",
    detail: "影像、报告和随访表格融合后输出风险函数、生存曲线和预后分层。",
    icon: "\u25ce",
    color: "#be123c",
    category: "evaluation",
    tags: ["预后", "生存分析", "风险分层"],
    keywords: ["生存预后预测", "生存分析", "预后预测", "风险分层", "C-index", "Hazard", "survival"]
  },
  {
    id: "activeLearningAnnotation",
    title: "主动学习标注",
    detail: "未标注样本经模型不确定性筛选，医生优先标注后增量训练闭环。",
    icon: "\u25c9",
    color: "#0f766e",
    category: "medical",
    tags: ["主动学习", "标注", "闭环"],
    keywords: ["主动学习标注", "主动学习", "不确定性采样", "医生标注", "增量训练", "标注闭环", "active learning"]
  },
  {
    id: "moeExpertRouting",
    title: "专家路由 MoE",
    detail: "多模态标记经路由门控分发到专家网络，再加权融合输出任务结果。",
    icon: "\u25c7",
    color: "#4f46e5",
    category: "llm",
    tags: ["MoE", "专家路由", "大模型"],
    keywords: ["MoE 专家路由", "MoE", "专家混合", "专家路由", "Router", "Top-k", "大模型结构"]
  },
  {
    id: "longitudinalFollowupDiagnosis",
    title: "纵向随访诊断",
    detail: "多时间点影像、报告和表格变量经时序编码后输出进展趋势、疗效评估和风险预警。",
    icon: "\u25ce",
    color: "#be123c",
    category: "medical",
    tags: ["随访", "时序", "风险预警"],
    keywords: ["纵向随访诊断", "随访诊断", "时序诊断", "疾病进展", "治疗响应", "风险预警", "longitudinal", "follow-up"]
  },
  {
    id: "weaklySupervisedMil",
    title: "弱监督 MIL",
    detail: "Patch 包、实例编码、注意力池化和高权重病灶定位组成的弱监督切片诊断结构。",
    icon: "\u25a9",
    color: "#16a34a",
    category: "medical",
    tags: ["弱监督", "MIL", "病灶定位"],
    keywords: ["弱监督 MIL", "弱监督", "MIL", "多实例学习", "病灶定位", "WSI", "Patch", "注意力池化", "热力图解释"]
  },
  {
    id: "medicalKnowledgeGraphReasoning",
    title: "医学知识图谱推理",
    detail: "报告实体、检验指标和医学知识图谱结合路径推理，输出可追溯诊断解释。",
    icon: "\u25c9",
    color: "#6d28d9",
    category: "llm",
    tags: ["知识图谱", "推理", "解释"],
    keywords: ["医学知识图谱推理", "知识图谱", "医学知识图谱", "图谱推理", "实体链接", "关系抽取", "证据链", "可解释诊断", "knowledge graph"]
  },
  {
    id: "teacherStudentDistillation",
    title: "教师学生蒸馏",
    detail: "教师模型向轻量学生模型传递 logits 或特征知识，用于部署压缩和低延迟推理。",
    icon: "\u25b7",
    color: "#4f46e5",
    category: "ai",
    tags: ["蒸馏", "压缩", "部署"],
    keywords: ["教师学生蒸馏", "知识蒸馏", "模型压缩", "学生模型", "教师模型", "低延迟推理", "distillation", "teacher student"]
  },
  {
    id: "foundationPromptTuning",
    title: "医学基础模型提示调优",
    detail: "冻结 VLM/LLM 基础模型，只训练可学习 Prompt、Prefix 和任务头完成医学下游任务。",
    icon: "\u25ce",
    color: "#7c3aed",
    category: "llm",
    tags: ["基础模型", "Prompt", "调优"],
    keywords: ["医学基础模型提示调优", "基础模型", "提示调优", "Prompt Tuning", "Prefix Tuning", "冻结基础模型", "医学大模型", "下游任务"]
  }
]);

const paperPresetCategories = Object.freeze([
  { id: "all", label: "全部", keywords: [], title: "显示全部论文图预设" },
  { id: "recommended", label: "推荐", keywords: ["推荐", "常用", "高频"], title: "显示智能模型、医学、多模态和论文绘图高频推荐预设" },
  { id: "recent", label: "最近", keywords: ["最近", "刚用", "历史"], title: "显示最近插入过的论文图预设" },
  { id: "favorites", label: "常用", keywords: ["常用", "固定", "收藏"], title: "显示手动星标固定的常用论文图预设" },
  { id: "ai", label: "智能基础", keywords: ["编码器", "解码", "生成", "扩散", "蒸馏"], title: "筛选 Transformer、编码器、解码器、扩散生成和蒸馏压缩等智能基础结构" },
  { id: "multimodal", label: "多模态", keywords: ["多模态", "图文", "融合", "三模态", "注意力"], title: "筛选图文对比、多模态融合、三模态和跨模态注意力结构" },
  { id: "medical", label: "医学诊断", keywords: ["医学", "诊断", "分割", "表格", "分类", "联邦", "标注", "随访", "MIL"], title: "筛选医学图像、报告、表格、分割、分类、联邦学习、随访和弱监督结构" },
  { id: "llm", label: "大模型", keywords: ["大模型", "VLM", "LLM", "RAG", "LoRA", "MoE", "知识图谱", "Prompt"], title: "筛选 VLM、LLM、RAG、MoE、知识图谱和提示调优结构" },
  { id: "evaluation", label: "评估临床", keywords: ["评估", "验证", "临床", "ROC", "校准", "预后", "生存"], title: "筛选临床验证、诊断评估、生存预后和论文结果面板" }
]);

const recommendedPaperPresetIds = Object.freeze([
  "medicalTriModalDiagnosis",
  "medicalVlmReportDiagnosis",
  "crossModalAttentionFusion",
  "largeModelRag",
  "contrastiveDualTower",
  "classificationDiagnosis",
  "longitudinalFollowupDiagnosis",
  "weaklySupervisedMil",
  "medicalKnowledgeGraphReasoning",
  "foundationPromptTuning"
]);

const paperPresetDiscoveryKeywords = Object.freeze([
  "论文套件", "论文图预设", "AI套件", "AI 结构", "AI论文图", "医学论文图", "大模型论文图", "多模态论文图", "图文多模态结构",
  "怎么画模型框图", "怎么画多模态框图", "画网络结构", "论文框图", "论文组件", "论文框架图", "论文结构图", "论文流程图", "论文方法图",
  "结构示意图", "框架示意图", "模型示意图", "架构图", "系统架构图", "网络架构图", "模型框架图", "模型结构图", "模型图", "模块图",
  "网络结构图", "神经网络结构图", "方法框图", "方法图", "方法结构图", "方法流程图", "算法流程图", "研究流程图", "实验流程图",
  "系统框图", "系统图", "系统流程图", "工作流", "pipeline", "paper pipeline", "workflow", "framework", "architecture",
  "framework diagram", "architecture diagram", "method diagram", "医学AI框架", "医学多模态框架", "大模型诊断框架", "报告生成框架",
  "对比学习框架", "注意力机制图", "分类诊断流程", "编码器结构图", "解码器结构图", "表格融合框架", "临床验证图",
  "联邦学习框架", "多中心联邦", "扩散模型框架", "医学扩散增强", "生存预后模型", "主动学习标注", "MoE专家路由",
  "纵向随访诊断", "随访诊断框架", "弱监督MIL", "弱监督 MIL", "医学知识图谱", "图谱推理框架", "教师学生蒸馏", "知识蒸馏框架", "提示调优框架",
  "推荐预设", "推荐论文预设", "最近预设", "最近使用预设", "常用预设", "常用论文预设",
  "大模型", "多模态", "医学图像报告", "表格", "分类", "诊断"
]);

// Function icons use the official Material Symbols Rounded outline font (Apache 2.0).
// Shape gallery / autoshape previews stay on the existing custom icon pipeline and must not use this map.
const functionIconGlyphs = Object.freeze({
  ai: "\ue10e",
  apply: "\ue668",
  arrow: "\ue5c8",
  assets: "\ue1a1",
  brush: "\ue3ae",
  carrier: "\ue162",
  charts: "\uf190",
  checkSquare: "\ue9de",
  clipboard: "\ue14f",
  close: "\ue5cd",
  convert: "\uf604",
  dash: "\uf108",
  download: "\uf090",
  eyedropper: "\ue3b8",
  feature: "\uefc9",
  fill: "\ue23a",
  folder: "\ue2c8",
  favorite: "\ue87e",
  image: "\ue3f4",
  info: "\ue88e",
  insert: "\ue146",
  layers: "\ue53b",
  library: "\ue54b",
  history: "\ue8b3",
  next: "\ueaaa",
  noFill: "\ue23b",
  palette: "\ue40a",
  paperSuite: "\ue97a",
  pencil: "\uf097",
  plus: "\ue145",
  redraw: "\ue5d5",
  refreshCw: "\ue627",
  save: "\ue161",
  search: "\uef7a",
  select: "\ue162",
  shapes: "\ue72c",
  share: "\ue80d",
  sparkles: "\ue65f",
  stroke: "\ue22b",
  style: "\ue429",
  template: "\ue99b",
  theme: "\ue997",
  trash: "\ue92e",
  upload: "\uf09b"
});
const functionIconTextAliases = Object.freeze({
  "\u00d7": "trash",
  "\u21b5": "insert"
});

const functionIconByCommandId = Object.freeze({
  "cmd-start-workflow": "sparkles",
  "cmd-insert-shapes": "shapes",
  "cmd-quick-insert": "plus",
  "cmd-quick-refresh": "refreshCw",
  "cmd-style": "style",
  "cmd-fill": "fill",
  "cmd-template": "template",
  "cmd-template-apply": "apply",
  "cmd-template-save": "save",
  "cmd-template-rename": "pencil",
  "cmd-arrow": "arrow",
  "cmd-paper-suite": "paperSuite",
  "cmd-paper-presets": "ai",
  "cmd-paper-recommended-presets": "favorite",
  "cmd-paper-recent-presets": "history",
  "cmd-paper-favorite-presets": "favorite",
  "cmd-zlk-chart-import": "charts",
  "cmd-zotero-image-library": "image",
  "cmd-palette-library": "palette",
  "cmd-redraw": "redraw",
  "cmd-convert": "convert",
  "cmd-inspect": "info",
  "cmd-carrier": "carrier",
  "cmd-save-selection": "library",
  "cmd-feature": "feature",
  "cmd-assets": "assets",
  "cmd-assets-refresh": "refreshCw",
  "cmd-select-assets": "select",
  "cmd-import": "download",
  "cmd-share": "share"
});

const staticFunctionIconTargets = Object.freeze([
  ["#jumpToShapes, [data-starter-action='catalog']", "shapes"],
  ["#jumpToNext, [data-starter-action='next']", "next"],
  ["#jumpToRedraw, #jumpToSelection, [data-starter-action='redraw'], #refreshSelection, #redrawFromStyle", "redraw"],
  ["#jumpToStyle, [data-starter-action='style']", "style"],
  ["#jumpToCharts, [data-starter-action='charts'], #zlkChartImport", "charts"],
  ["#jumpToPaperPresets, [data-starter-action='paperPresets']", "ai"],
  ["#jumpToAssets, [data-starter-action='library'], #reloadAssets", "assets"],
  ["#jumpToFeature, [data-starter-action='featureBlock'], #insertFeatureBlock", "feature"],
  ["#jumpToQuickInsert, [data-starter-action='quickInsert'], #quickAddToggle", "plus"],
  ["#jumpToStyle, [data-starter-action='style'], #emptyStyleHelp", "style"],
  ["#jumpToSearch, [data-starter-action='search'], #emptySearchHelp", "search"],
  ["#jumpToConvert, [data-starter-action='convert'], #convertSelection", "convert"],
  ["#jumpToPaperTemplate, [data-starter-action='paperTemplate']", "template"],
  ["[data-section-nav='catalog'], #emptyInsertShape, #galleryToggle", "shapes"],
  ["[data-section-nav='style']", "style"],
  ["[data-section-nav='selection']", "redraw"],
  ["[data-section-nav='charts']", "charts"],
  ["[data-section-nav='zoteroImages']", "image"],
  ["[data-section-nav='paperPresets']", "ai"],
  ["[data-section-nav='library']", "assets"],
  ["[data-section-nav='paletteLibrary']", "palette"],
  ["[data-section-nav='featureBlock']", "feature"],
  ["[data-command-shortcut='cmd-redraw']", "redraw"],
  ["[data-command-shortcut='cmd-convert']", "convert"],
  ["[data-command-shortcut='cmd-fill']", "fill"],
  ["[data-command-shortcut='cmd-template']", "template"],
  ["[data-command-shortcut='cmd-paper-suite']", "template"],
  ["[data-command-shortcut='cmd-paper-presets']", "ai"],
  ["[data-command-shortcut='cmd-feature']", "feature"],
  ["[data-command-shortcut='cmd-assets']", "assets"],
  ["#inspectSelection", "info"],
  ["#saveSelection, #saveStyleTemplate, #saveFeatureDefault", "save"],
  ["#selectCarrier", "carrier"],
  ["#applyStyleTemplate", "apply"],
  ["#renameStyleTemplate", "pencil"],
  ["[data-style-quick='paper']", "template"],
  ["[data-style-quick='whiteFill']", "fill"],
  ["[data-style-quick='noFill']", "noFill"],
  ["[data-style-quick='brushFill']", "brush"],
  ["[data-style-quick='blackStroke'], [data-style-quick='blueStroke'], [data-style-quick='boldLine']", "stroke"],
  ["[data-style-quick='dashLine']", "dash"],
  ["[data-style-quick='endArrow']", "arrow"],
  ["[data-param-group-jump='常用']", "sparkles"],
  ["[data-param-group-jump='边界']", "stroke"],
  ["[data-param-group-jump='填充纹理']", "fill"],
  ["[data-param-group-jump='嵌套']", "layers"],
  ["[data-param-group-jump='线条']", "arrow"],
  ["#zlkChartFolderButton", "folder"],
  ["#zlkChartClear", "close"],
  ["#zoteroImageReload, #reloadPalettes, #reloadQuickShapes", "redraw"],
  ["#saveZoteroPalette", "palette"],
  ["#extractClipboardPalette", "clipboard"],
  ["#extractSlidePalette", "eyedropper"],
  ["#importPalettes, #importAssets", "download"],
  ["#exportPalettes, #exportAssets", "share"],
  ["#selectAssets", "select"]
]);

const staticFunctionIconHolders = Object.freeze([
  [".search-box > span", "search"],
  [".zotero-search-box > span", "search"],
  [".selection-next-icon", "next"]
]);

const commandSearchItems = Object.freeze([
  { id: "cmd-start-workflow", icon: "\u25ce", title: "开始绘图", detail: "定位到插入形状、转换、重绘、论文模板和功能搜索主入口", panel: "start", target: "jumpToShapes", keywords: ["开始", "开始绘图", "主入口", "入口", "一键入口", "下一步", "帮助", "提示", "怎么用", "找功能", "找不到功能", "start"] },
  { id: "cmd-insert-shapes", icon: "\u25a6", title: "插入形状", detail: "打开 PPT 原生形状手绘版图库", panel: "catalog", target: "galleryToggle", keywords: ["插入", "形状", "图库", "图形", "自选图形", "画形状", "画框", "找不到形状", "插入窗口", "autoshape", "shape"] },
  { id: "cmd-quick-insert", icon: "\uff0b", title: "快速插入", detail: "打开添加常用形状图库，把形状固定到快速插入栏和顶部 Ribbon", panel: "catalog", target: "quickAddToggle", keywords: ["快速", "常用", "固定", "收藏", "添加形状", "添加常用", "快速插入", "quick"] },
  { id: "cmd-quick-refresh", icon: "\u21bb", title: "刷新快速插入", detail: "重新读取本机保存的快速插入形状", panel: "catalog", target: "reloadQuickShapes", keywords: ["刷新快速", "常用刷新", "快速插入管理", "quick refresh"] },
  { id: "cmd-style", icon: "\u2699", title: "编辑风格", detail: "调整线条、边界来源、填充来源和手绘参数", panel: "style", target: "styleTemplateSelect", keywords: ["风格", "参数", "线宽", "颜色", "改颜色", "换颜色", "哪里改颜色", "在哪里改颜色", "怎么改颜色", "调整样式", "参数在哪", "改线条", "线条变粗", "加粗线条", "粗糙", "弯曲", "手绘", "草图", "透明", "半透明", "边界", "边界来源", "填充来源", "来源", "帮助", "提示", "style"] },
  { id: "cmd-fill", icon: "\u25d2", title: "填充与涂刷", detail: "定位到填充颜色、填充来源、纹理和宽刷涂刷参数", panel: "style", target: "fillStyle", paramGroup: "填充纹理", keywords: ["填充", "填色", "怎么填充", "白底", "白色背景", "背景白色", "底色", "背景", "改颜色", "换颜色", "哪里改颜色", "填充颜色", "填充来源", "涂刷", "刷子", "纹理", "透明", "半透明", "hachure", "brush", "fill"] },
  { id: "cmd-template", icon: "\u2605", title: "风格模板", detail: "选择 Rough.js、Excalidraw、draw.io、D2、tldraw 或自定义模板", panel: "style", target: "styleTemplateSelect", keywords: ["模板", "预设", "论文模板", "开始绘图", "手绘", "草图", "变手绘", "转草图", "rough", "roughjs", "excalidraw", "draw.io", "d2", "tldraw", "template"] },
  { id: "cmd-template-apply", icon: "\u2713", title: "应用模板", detail: "定位到把当前模板应用到参数和选区的按钮", panel: "style", target: "applyStyleTemplate", keywords: ["应用模板", "使用模板", "套用模板", "应用风格", "套用风格", "apply template"] },
  { id: "cmd-template-save", icon: "\u25a3", title: "保存模板", detail: "定位到把当前风格参数保存为自定义模板的按钮", panel: "style", target: "saveStyleTemplate", keywords: ["保存模板", "存模板", "新增模板", "自定义模板", "保存风格", "保存方案", "save template"] },
  { id: "cmd-template-rename", icon: "\u270e", title: "重命名模板", detail: "定位到重命名当前自定义模板的按钮", panel: "style", target: "renameStyleTemplate", keywords: ["重命名模板", "改名模板", "模板改名", "rename template"] },
  { id: "cmd-arrow", icon: "\u2192", title: "箭头和虚线", detail: "定位到箭头样式、箭头位置和虚线参数", panel: "style", target: "arrowheadStyle", paramGroup: "线条", keywords: ["箭头", "加箭头", "删箭头", "删除箭头", "去箭头", "虚线", "点线", "点划线", "粗线", "线条变粗", "加粗线条", "细线", "线条", "改线条", "起始", "末尾", "arrow", "dash"] },
  { id: "cmd-paper-suite", icon: "\u25a6", title: "论文套件", detail: "只定位到论文框图常用入口，不直接插入对象：节点、判断、数据、分组、高亮、箭头、特征图、智能模型、多模态和医学结构预设", panel: "paperPresets", target: "paperPresetGrid", keywords: [...paperPresetDiscoveryKeywords, "AI", "AI结构", "医学", "paper suite"] },
  { id: "cmd-paper-presets", icon: "\u25a3", title: "论文图预设", detail: "只定位到可插入预设卡片，不直接插入对象；卡片会插入 PPT 原生可编辑通用结构图，非复刻单篇论文图", panel: "paperPresets", target: "paperPresetGrid", keywords: [...paperPresetDiscoveryKeywords, "paper preset"] },
  { id: "cmd-paper-recommended-presets", icon: "\u2605", title: "推荐预设", detail: "只定位到推荐论文图预设筛选，不直接插入对象；用于快速查看智能模型、医学和多模态高频结构", panel: "paperPresets", target: "paperPresetGrid", paperPresetCategory: "recommended", keywords: ["推荐预设", "推荐论文预设", "推荐", "高频预设", "常用推荐", "AI推荐", "医学推荐", "论文套件"] },
  { id: "cmd-paper-recent-presets", icon: "\u21ba", title: "最近预设", detail: "只定位到最近使用的论文图预设筛选，不直接插入对象；插入预设后会自动记录到最近", panel: "paperPresets", target: "paperPresetGrid", paperPresetCategory: "recent", keywords: ["最近预设", "最近使用预设", "最近论文预设", "刚用过", "历史预设", "论文套件"] },
  { id: "cmd-paper-favorite-presets", icon: "\u2606", title: "常用预设", detail: "只定位到星标固定的常用论文图预设筛选，不直接插入对象；星标只保存本机偏好", panel: "paperPresets", target: "paperPresetGrid", paperPresetCategory: "favorites", keywords: ["常用预设", "常用论文预设", "收藏预设", "固定预设", "星标预设", "我的预设", "论文套件"] },
  { id: "cmd-zlk-chart-import", icon: "\u25a5", title: "科研绘图导入", detail: "定位到 SimpleExperiment 实验结果导入面板，可识别 metrics_summary、result_registry、statistics、quality_gate、case_level 和论文表格", panel: "charts", target: "zlkChartImport", keywords: ["科研绘图", "实验结果", "导入结果", "结果导入", "SimpleExperiment", "ZLK", "zlk cluster", "metrics_summary", "statistics", "quality_gate", "paper table", "论文表格", "误差棒", "排行榜", "敏感性曲线", "亚组分析"] },
  { id: "cmd-zotero-image-library", icon: "\u25a8", title: "论文图像与配色库", detail: "定位到 Zotero PDF 图片保存插件的共享 SQLite 图片库，可预览论文图、取色、插入参考图和反向溯源", panel: "zoteroImages", target: "zoteroImageSearch", keywords: ["论文图像与配色库", "论文图像", "论文图片", "参考图", "配色库", "取色", "Zotero", "PDF Image Saver", "样式标签", "色系", "打开PDF", "定位条目", "复制溯源", "palette", "swatch"] },
  { id: "cmd-palette-library", icon: "\u25d2", title: "配色库", detail: "保存 Zotero 配色、从剪贴板图片或当前页面提取配色，并使用 PPT 内置主题配色布局预览后一键替换", panel: "zoteroImages", target: "paletteSchemeGrid", keywords: ["配色库", "配色方案", "保存配色", "分享配色", "导入配色", "剪贴板取色", "页面取色", "PPT内置配色", "主题色", "整体换色", "配色布局", "palette scheme", "theme colors"] },
  { id: "cmd-paper-node", icon: "\u25a2", title: "论文节点", detail: "只定位到圆角矩形图库，不直接插入；插入后可用论文模板、白填充和黑线形成普通论文节点", panel: "catalog", target: "galleryToggle", shapeQuery: "圆角矩形", shapeCategory: "rectangles", focusSearchAfterOpen: false, keywords: ["论文节点", "普通节点", "模块节点", "白底节点", "圆角节点", "圆角矩形"] },
  { id: "cmd-paper-data", icon: "\u25b1", title: "数据节点", detail: "只定位到流程图数据形状，不直接插入；适合输入、输出或数据模块", panel: "catalog", target: "galleryToggle", shapeQuery: "流程图数据", shapeCategory: "flowchart", focusSearchAfterOpen: false, keywords: ["数据节点", "数据模块", "输入输出", "输入节点", "输出节点", "流程图数据"] },
  { id: "cmd-paper-decision", icon: "\u25c7", title: "判断节点", detail: "只定位到流程图判断形状，不直接插入；适合论文流程分支", panel: "catalog", target: "galleryToggle", shapeQuery: "流程图判断", shapeCategory: "flowchart", focusSearchAfterOpen: false, keywords: ["判断节点", "判断", "决策节点", "分支节点", "流程图判断"] },
  { id: "cmd-paper-group", icon: "\u25a1", title: "分组虚线", detail: "只定位到线条参数，不直接插入；把边界改为虚线并关闭填充即可得到论文分组框", panel: "style", target: "dashStyle", paramGroup: "线条", keywords: ["分组虚线", "虚线分组", "分组框", "虚线框", "无填充分组", "模块分区"] },
  { id: "cmd-paper-highlight", icon: "\u25d2", title: "高亮框", detail: "只定位到填充纹理参数，不直接插入；可用涂刷或浅黄色填充制作论文高亮框", panel: "style", target: "fillStyle", paramGroup: "填充纹理", keywords: ["高亮框", "高亮", "涂刷高亮", "黄色高亮", "重点区域", "强调框"] },
  { id: "cmd-paper-arrow", icon: "\u2192", title: "粗箭头", detail: "只定位到箭头和线宽参数，不直接插入；适合论文流程连接线", panel: "style", target: "arrowheadStyle", paramGroup: "线条", keywords: ["粗箭头", "粗箭头线", "流程箭头", "连接箭头", "主流程", "箭头线"] },
  { id: "cmd-redraw", icon: "\u21bb", title: "重绘选区", detail: "查看当前选区状态；请在 Ribbon 的“选区操作”中执行重绘", panel: "selection", target: "selectionState", selectionKinds: ["rough"], keywords: ["重绘", "怎么重绘", "哪里重绘", "生成", "刷新", "更新", "重新生成", "实时重绘", "重绘没反应", "redraw", "refresh"] },
  { id: "cmd-convert", icon: "\u270e", title: "转换选区", detail: "查看当前选区状态；请在 Ribbon 的“选区操作”中执行转换手绘", panel: "selection", target: "selectionState", selectionKinds: ["normal"], keywords: ["转换", "怎么转换", "转手绘", "变手绘", "怎么变手绘", "转草图", "草图", "手绘", "选区", "convert", "rough"] },
  { id: "cmd-inspect", icon: "\u25ce", title: "检查选区", detail: "右侧显示当前选区摘要；完整检查命令位于 Ribbon 的“选区操作”", panel: "selection", target: "selectionState", selectionKinds: ["normal", "rough", "feature"], keywords: ["检查", "查看", "元数据", "诊断", "报错", "问题", "哪里看状态", "帮助", "inspect"] },
  { id: "cmd-carrier", icon: "\u25c9", title: "选择载体", detail: "查看当前选区状态；请在 Ribbon 的“选区操作”中执行选择载体", panel: "selection", target: "selectionState", selectionKinds: ["rough"], keywords: ["载体", "调整点", "原生", "carrier"] },
  { id: "cmd-save-selection", icon: "\u25a3", title: "保存为素材", detail: "查看当前选区状态；请在 Ribbon 的“常用功能”中执行保存素材", panel: "selection", target: "selectionState", selectionKinds: ["normal", "rough", "feature"], keywords: ["保存", "保存素材", "怎么保存素材", "存素材", "保存为素材", "保存到素材库", "save"] },
  { id: "cmd-feature", icon: "\u25a3", title: "特征块", detail: "定位到 2D/3D 特征块工具", panel: "featureBlock", target: "insertFeatureBlock", keywords: ["特征块", "特征图", "二维", "三维", "三维块", "三维特征", "3d块", "2d", "3d", "feature", "block", "立方体"] },
  { id: "cmd-paper-matrix", icon: "\u25a6", title: "论文矩阵", detail: "只定位到 2D 特征块工具，不直接插入；可设置为矩阵式特征图", panel: "featureBlock", target: "insertFeatureBlock", keywords: ["论文矩阵", "矩阵", "二维矩阵", "2d矩阵", "网络结构", "特征图矩阵"] },
  { id: "cmd-paper-volume", icon: "\u25a3", title: "体数据块", detail: "只定位到 3D 特征块工具，不直接插入；可设置为体数据或体素特征示意", panel: "featureBlock", target: "insertFeatureBlock", keywords: ["体数据块", "体数据", "三维体", "体素", "3d体数据", "三维医学", "体数据特征"] },
  { id: "cmd-paper-attention", icon: "\u25a9", title: "注意力图", detail: "只定位到 2D 特征块工具，不直接插入；可制作注意力热图或权重图", panel: "featureBlock", target: "insertFeatureBlock", keywords: ["注意力图", "attention", "热图", "权重图", "注意力热图", "可视化模块"] },
  { id: "cmd-paper-transformer-encoder", icon: "\u25a6", title: "Transformer 编码器", detail: "只定位到可插入预设卡片，不直接插入；通用示意包含注意力、前馈、归一化和残差堆叠，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-transformerEncoder", presetId: "transformerEncoder", keywords: ["Transformer 编码器", "编码器", "encoder", "self attention", "自注意力", "前馈网络", "残差", "归一化", "AI", "AI结构", "论文套件"] },
  { id: "cmd-paper-transformer-decoder", icon: "\u25a6", title: "Transformer 解码器", detail: "只定位到 Transformer 解码器块预设卡片，不直接插入；通用示意适合掩码注意力、交叉注意力、词表投影和生成输出，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-transformerDecoderBlock", presetId: "transformerDecoderBlock", keywords: ["Transformer 解码器", "解码器", "decoder", "masked attention", "掩码注意力", "交叉注意力", "输出序列", "词表投影", "生成输出", "AI", "AI结构", "论文套件"] },
  { id: "cmd-paper-vision-encoder", icon: "\u25a3", title: "视觉编码器", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合图像 patch、CNN 或 ViT 特征流，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-visionTransformer", presetId: "visionTransformer", keywords: ["视觉编码器", "图像编码器", "vision encoder", "ViT", "CNN", "Swin", "图像特征", "特征图", "AI", "医学影像", "论文套件"] },
  { id: "cmd-paper-text-encoder", icon: "\u25a2", title: "文本编码器", detail: "只定位到多模态融合预设卡片，不直接插入；通用示意适合 token、词嵌入、语言模型或报告文本分支，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-multimodalFusion", presetId: "multimodalFusion", keywords: ["文本编码器", "语言编码器", "text encoder", "BERT", "LLM", "token", "词嵌入", "文本分支", "报告文本", "AI", "论文套件"] },
  { id: "cmd-paper-multimodal-fusion", icon: "\u25c7", title: "多模态融合", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合图像、文本、表格等分支汇合结构，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-multimodalFusion", presetId: "multimodalFusion", keywords: ["多模态融合", "多模态", "融合", "fusion", "cross attention", "交叉注意力", "图文融合", "医学图像报告", "AI", "论文套件"] },
  { id: "cmd-paper-contrastive-towers", icon: "\u25eb", title: "对比学习双塔", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合图像塔、文本塔、投影头和相似度连接，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-contrastiveDualTower", presetId: "contrastiveDualTower", keywords: ["对比学习双塔", "对比学习", "双塔", "CLIP", "contrastive", "图文对齐", "投影头", "相似度", "正负样本", "AI", "论文套件"] },
  { id: "cmd-paper-classification-head", icon: "\u25ce", title: "分类头", detail: "只定位到分类诊断预设卡片，不直接插入；通用示意适合 logits、softmax、类别输出和预测结果，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-classificationDiagnosis", presetId: "classificationDiagnosis", keywords: ["分类头", "分类器", "classification head", "logits", "softmax", "类别输出", "预测结果", "AI", "论文套件"] },
  { id: "cmd-paper-diagnosis-head", icon: "\u25c9", title: "诊断头", detail: "只定位到分类诊断预设卡片，不直接插入；通用示意适合医学诊断、风险评分、病灶类别或报告结论，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-classificationDiagnosis", presetId: "classificationDiagnosis", keywords: ["诊断头", "诊断输出", "医学诊断", "风险评分", "病灶类别", "报告结论", "medical diagnosis", "AI", "医学", "论文套件"] },
  { id: "cmd-paper-medical-image-report", icon: "\u25b1", title: "医学图像-报告流程", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合医学图像输入、视觉编码、报告生成和诊断输出链路，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medicalImageReport", presetId: "medicalImageReport", keywords: ["医学图像-报告流程", "医学图像报告流程", "医学影像报告", "报告生成", "radiology report", "image report", "放射报告", "多模态医学", "AI", "论文套件"] },
  { id: "cmd-paper-trimodal-diagnosis", icon: "\u25c8", title: "三模态医学诊断", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合图像、报告文本和表格变量联合诊断，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medicalTriModalDiagnosis", presetId: "medicalTriModalDiagnosis", keywords: ["三模态医学诊断", "图像文本表格", "医学图像报告表格", "多模态诊断", "风险分层", "AI", "医学", "论文套件"] },
  { id: "cmd-paper-vlm-report-diagnosis", icon: "\u25b1", title: "医学 VLM 报告诊断", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合视觉语言模型、报告生成和诊断分类闭环，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medicalVlmReportDiagnosis", presetId: "medicalVlmReportDiagnosis", keywords: ["医学 VLM", "VLM 报告诊断", "医学视觉语言模型", "报告生成", "LLM", "医生复核", "论文套件"] },
  { id: "cmd-paper-tabular-branch", icon: "\u25a4", title: "表格临床分支", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合临床变量、结构化表格、EHR 和检验指标分支，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-tabularClinicalBranch", presetId: "tabularClinicalBranch", keywords: ["表格临床分支", "表格特征分支", "表格特征", "临床变量", "结构化数据", "tabular", "EHR", "临床特征", "额外特征", "医学", "论文套件"] },
  { id: "cmd-paper-cross-modal-attention", icon: "\u25c7", title: "跨模态注意力融合", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合图像、文本、表格 token 之间的 cross attention 和门控融合，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-crossModalAttentionFusion", presetId: "crossModalAttentionFusion", keywords: ["跨模态注意力融合", "cross attention", "门控融合", "图像 token", "文本 token", "表格 token", "共享表示", "论文套件"] },
  { id: "cmd-paper-llm-adapter", icon: "\u25ce", title: "LLM Adapter 微调", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合冻结 LLM/VLM 主干和训练 Adapter、LoRA、Prompt 或任务头，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-llmAdapterFineTune", presetId: "llmAdapterFineTune", keywords: ["LLM Adapter 微调", "LoRA", "Adapter", "Prompt", "参数高效微调", "冻结大模型", "医学任务头", "论文套件"] },
  { id: "cmd-paper-unet-segmentation", icon: "\u25a9", title: "医学分割流程", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合编码器、瓶颈、解码器、跳连和分割掩膜结构，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-unetSegmentation", presetId: "unetSegmentation", keywords: ["医学分割流程", "医学分割", "U-Net", "分割", "segmentation", "跳跃连接", "掩膜", "mask", "论文套件"] },
  { id: "cmd-paper-large-model-rag", icon: "\u25c9", title: "大模型诊断 RAG", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合多模态输入、检索增强、大模型诊断建议和人工复核，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-largeModelRag", presetId: "largeModelRag", keywords: ["大模型诊断 RAG", "大模型诊断", "RAG", "LLM", "多模态大模型", "知识检索", "人工复核", "论文套件"] },
  { id: "cmd-paper-clinical-validation", icon: "\u25a4", title: "临床验证流程", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合训练、验证、外部测试、指标曲线、校准和临床报告，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-clinicalValidation", presetId: "clinicalValidation", keywords: ["临床验证流程", "外部测试", "验证集", "ROC", "PR", "校准", "亚组分析", "失败案例", "论文套件"] },
  { id: "cmd-paper-diagnosis-evaluation", icon: "\u25a9", title: "诊断评估面板", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合 ROC、PR、校准、决策曲线、混淆矩阵、亚组和失败案例，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-diagnosisEvaluationPanel", presetId: "diagnosisEvaluationPanel", keywords: ["诊断评估面板", "ROC", "PR", "校准曲线", "决策曲线", "混淆矩阵", "亚组分析", "失败案例", "论文套件"] },
  { id: "cmd-paper-decoder-block", icon: "\u25a6", title: "Transformer 解码器块", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合掩码注意力、交叉注意力、词表投影和生成输出，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-transformerDecoderBlock", presetId: "transformerDecoderBlock", keywords: ["Transformer 解码器块", "Transformer Decoder", "掩码注意力", "交叉注意力", "自回归生成", "词表投影", "论文套件"] },
  { id: "cmd-paper-qformer-bridge", icon: "\u25c9", title: "Q-Former VLM 桥接", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合 BLIP-2 类视觉查询、语义压缩和冻结 LLM 桥接，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-blip2QformerBridge", presetId: "blip2QformerBridge", keywords: ["Q-Former VLM 桥接", "Q-Former", "BLIP-2", "视觉语言桥接", "Query Transformer", "冻结 LLM", "论文套件"] },
  { id: "cmd-paper-instruction-vlm", icon: "\u25b1", title: "医学指令 VLM", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合医学图像、临床指令、多模态对齐和诊断问答，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medicalInstructionVlm", presetId: "medicalInstructionVlm", keywords: ["医学指令 VLM", "LLaVA", "视觉指令", "临床问题", "医学问答", "诊断建议", "论文套件"] },
  { id: "cmd-paper-medclip-matching", icon: "\u25eb", title: "MedCLIP 语义匹配", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合医学图文匹配、相似度矩阵和零样本诊断，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medclipSemanticMatching", presetId: "medclipSemanticMatching", keywords: ["MedCLIP 语义匹配", "MedCLIP", "医学图文匹配", "零样本分类", "语义相似度", "图文检索", "论文套件"] },
  { id: "cmd-paper-mae-pretrain", icon: "\u25a3", title: "自监督预训练", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合 MAE、掩码重建、弱监督和下游微调，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-selfSupervisedMaePretrain", presetId: "selfSupervisedMaePretrain", keywords: ["自监督预训练", "MAE", "弱监督", "掩码重建", "未标注数据", "迁移学习", "论文套件"] },
  { id: "cmd-paper-report-table-rag", icon: "\u25c7", title: "报告表格 RAG", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合报告、表格、知识检索、证据引用和结构化输出，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-multimodalRagReportTable", presetId: "multimodalRagReportTable", keywords: ["报告表格 RAG", "多模态 RAG", "结构化表格", "证据引用", "病例检索", "医学知识库", "论文套件"] },
  { id: "cmd-paper-swin-unetr", icon: "\u25a9", title: "3D Swin UNETR 分割", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合 3D 医学影像、层级 Transformer、UNETR 解码和病灶掩膜，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-swinUnetr3DSegmentation", presetId: "swinUnetr3DSegmentation", keywords: ["3D Swin UNETR 分割", "Swin UNETR", "3D 分割", "体数据", "器官分割", "病灶掩膜", "论文套件"] },
  { id: "cmd-paper-tabtransformer-risk", icon: "\u25a4", title: "表格 Transformer 风险", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合临床变量、表格 Transformer、风险评分和校准概率，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-tabTransformerRisk", presetId: "tabTransformerRisk", keywords: ["表格 Transformer 风险", "TabTransformer", "表格风险预测", "临床变量", "风险评分", "校准概率", "论文套件"] },
  { id: "cmd-paper-deployment-monitoring", icon: "\u25a4", title: "临床部署监测", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合上线推理、数据漂移、性能监测、人审告警和再训练闭环，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-clinicalDeploymentMonitoring", presetId: "clinicalDeploymentMonitoring", keywords: ["临床部署监测", "部署", "数据漂移", "性能监测", "医生反馈", "主动学习", "再训练", "论文套件"] },
  { id: "cmd-paper-federated-learning", icon: "\u25a4", title: "多中心联邦学习", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合多医院本地训练、安全聚合、全局模型和外部验证，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-federatedLearningMedical", presetId: "federatedLearningMedical", keywords: ["多中心联邦学习", "联邦学习", "多中心医学", "隐私保护", "安全聚合", "外部验证", "论文套件"] },
  { id: "cmd-paper-diffusion-augmentation", icon: "\u25a3", title: "医学扩散增强", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合条件扩散、合成数据、质控筛选和下游训练，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-diffusionAugmentation", presetId: "diffusionAugmentation", keywords: ["医学扩散增强", "扩散模型", "数据增强", "合成数据", "生成模型", "diffusion", "论文套件"] },
  { id: "cmd-paper-survival-outcome", icon: "\u25ce", title: "生存预后预测", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合生存分析、风险函数、生存曲线和预后分层，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-survivalOutcomePrediction", presetId: "survivalOutcomePrediction", keywords: ["生存预后预测", "生存分析", "预后预测", "风险分层", "C-index", "Hazard", "论文套件"] },
  { id: "cmd-paper-active-learning", icon: "\u25c9", title: "主动学习标注", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合不确定性采样、医生标注和增量训练闭环，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-activeLearningAnnotation", presetId: "activeLearningAnnotation", keywords: ["主动学习标注", "主动学习", "不确定性采样", "医生标注", "增量训练", "标注闭环", "论文套件"] },
  { id: "cmd-paper-moe-routing", icon: "\u25c7", title: "专家路由 MoE", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合路由门控、专家网络、Top-k 激活和加权融合，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-moeExpertRouting", presetId: "moeExpertRouting", aliases: ["MoE 专家路由"], keywords: ["MoE", "专家混合", "专家路由", "Router", "Top-k", "论文套件"] },
  { id: "cmd-paper-longitudinal-followup", icon: "\u25ce", title: "纵向随访诊断", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合多时间点影像、报告、表格、疾病进展和风险预警，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-longitudinalFollowupDiagnosis", presetId: "longitudinalFollowupDiagnosis", keywords: ["纵向随访诊断", "随访诊断", "随访诊断框架", "时序诊断", "疾病进展", "治疗响应", "风险预警", "论文套件"] },
  { id: "cmd-paper-weakly-supervised-mil", icon: "\u25a9", title: "弱监督 MIL", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合 Patch 包、多实例学习、注意力池化和病灶定位，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-weaklySupervisedMil", presetId: "weaklySupervisedMil", keywords: ["弱监督 MIL", "弱监督MIL", "弱监督", "MIL", "多实例学习", "病灶定位", "WSI", "Patch", "论文套件"] },
  { id: "cmd-paper-knowledge-graph-reasoning", icon: "\u25c9", title: "医学知识图谱推理", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合实体链接、关系抽取、医学知识图谱、路径推理和诊断解释，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-medicalKnowledgeGraphReasoning", presetId: "medicalKnowledgeGraphReasoning", keywords: ["医学知识图谱推理", "医学知识图谱", "知识图谱", "图谱推理", "实体链接", "关系抽取", "证据链", "论文套件"] },
  { id: "cmd-paper-distillation", icon: "\u25b7", title: "教师学生蒸馏", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合教师模型、学生模型、蒸馏损失、模型压缩和部署，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-teacherStudentDistillation", presetId: "teacherStudentDistillation", keywords: ["教师学生蒸馏", "知识蒸馏", "蒸馏", "模型压缩", "学生模型", "教师模型", "低延迟推理", "论文套件"] },
  { id: "cmd-paper-prompt-tuning", icon: "\u25ce", title: "医学基础模型提示调优", detail: "只定位到可插入预设卡片，不直接插入；通用示意适合冻结 VLM/LLM 基础模型、可学习 Prompt、Prefix 和医学任务头，非复刻单篇论文图", panel: "paperPresets", target: "paperPreset-foundationPromptTuning", presetId: "foundationPromptTuning", keywords: ["医学基础模型提示调优", "基础模型", "提示调优", "Prompt Tuning", "Prefix Tuning", "冻结基础模型", "医学大模型", "论文套件"] },
  { id: "cmd-assets", icon: "\u25a4", title: "我的素材", detail: "定位到保存、插入、删除、导入和分享素材包", panel: "library", target: "reloadAssets", keywords: ["素材", "素材库", "找不到素材", "素材在哪", "保存", "删除", "管理", "管理素材", "素材管理", "导入包", "分享包", "素材包", "library", "asset"] },
  { id: "cmd-assets-refresh", icon: "\u21bb", title: "刷新素材", detail: "定位到重新读取本机素材库的按钮", panel: "library", target: "reloadAssets", keywords: ["刷新素材", "重新读取素材", "更新素材库", "reload assets"] },
  { id: "cmd-select-assets", icon: "\u2611", title: "选择素材", detail: "定位到全选或清空当前筛选素材的按钮", panel: "library", target: "selectAssets", keywords: ["选择素材", "全选", "清空", "勾选", "select"] },
  { id: "cmd-import", icon: "\u21e9", title: "导入素材包", detail: "定位到素材包导入按钮", panel: "library", target: "importAssets", keywords: ["导入", "导入包", "导入素材", "导入分享", "导入素材包", "素材包", "import", "zip"] },
  { id: "cmd-share", icon: "\u21e7", title: "分享素材包", detail: "定位到选择素材并分享 zip 素材包", panel: "library", target: "exportAssets", keywords: ["分享", "如何分享", "怎么分享", "分享包", "导出", "导入分享", "素材包", "分享素材包", "export", "share", "zip"] }
]);

const defaultCommandCenterIds = Object.freeze([
  "cmd-insert-shapes",
  "cmd-quick-insert",
  "cmd-convert",
  "cmd-redraw",
  "cmd-template",
  "cmd-paper-suite",
  "cmd-paper-presets",
  "cmd-zotero-image-library",
  "cmd-fill",
  "cmd-feature",
  "cmd-assets"
]);

const hostFocusTargets = Object.freeze({
  templateApply: { panel: "style", target: "applyStyleTemplate", title: "应用模板" },
  templateSave: { panel: "style", target: "saveStyleTemplate", title: "保存模板" },
  templateRename: { panel: "style", target: "renameStyleTemplate", title: "重命名模板" },
  templateSelect: { panel: "style", target: "styleTemplateSelect", title: "选择模板" },
  paperPresets: { panel: "paperPresets", target: "paperPresetGrid", title: "论文图预设" },
  charts: { panel: "charts", target: "zlkChartImport", title: "科研绘图导入" },
  zoteroImages: { panel: "zoteroImages", target: "zoteroImageSearch", title: "论文图像与配色库" },
  paletteLibrary: { panel: "zoteroImages", target: "paletteSchemeGrid", title: "配色库" },
  assetSelect: { panel: "library", target: "selectAssets", title: "选择素材" },
  assetRefresh: { panel: "library", target: "reloadAssets", title: "刷新素材" },
  assetImport: { panel: "library", target: "importAssets", title: "导入素材包" },
  assetShare: { panel: "library", target: "exportAssets", title: "分享素材包" },
  selectionSave: { panel: "selection", target: "saveSelection", title: "保存为素材" }
});

const searchSuggestionItems = Object.freeze([
  { id: "hint-start", label: "开始绘图", query: "开始绘图", scope: "command", detail: "功能" },
  { id: "hint-redraw", label: "重绘选区", query: "重绘", scope: "command", detail: "功能", selectionKinds: ["rough"] },
  { id: "hint-convert", label: "转换选区", query: "转换", scope: "command", detail: "功能", selectionKinds: ["normal"] },
  { id: "hint-white-fill", label: "白底", query: "白底", scope: "command", detail: "风格", panel: "style" },
  { id: "hint-dash", label: "虚线", query: "虚线", scope: "command", detail: "线条", panel: "style" },
  { id: "hint-quick", label: "快速插入", query: "快速插入", scope: "command", detail: "形状" },
  { id: "hint-rectangle", label: "矩形", query: "矩形", scope: "shape", detail: "形状" },
  { id: "hint-arrow", label: "箭头", query: "箭头", scope: "all", detail: "全部" },
  { id: "hint-template", label: "风格模板", query: "模板", scope: "command", detail: "功能", panel: "style" },
  { id: "hint-paper-suite", label: "论文套件", query: "论文套件", scope: "command", detail: "论文" },
  { id: "hint-paper-presets", label: "论文图预设", query: "论文图预设", scope: "preset", detail: "预设" },
  { id: "hint-zlk-chart-import", label: "科研绘图", query: "科研绘图", scope: "chart", detail: "数据" },
  { id: "hint-zlk-results", label: "实验结果", query: "metrics_summary", scope: "chart", detail: "数据" },
  { id: "hint-zotero-images", label: "论文图像", query: "论文图像", scope: "command", detail: "配色" },
  { id: "hint-palette", label: "配色库", query: "配色库", scope: "command", detail: "换色" },
  { id: "hint-paper-recommended", label: "推荐预设", query: "推荐预设", scope: "preset", detail: "预设", paperPresetCategory: "recommended", clearQuery: true },
  { id: "hint-paper-recent", label: "最近预设", query: "最近预设", scope: "preset", detail: "预设", paperPresetCategory: "recent", clearQuery: true },
  { id: "hint-paper-favorites", label: "常用预设", query: "常用预设", scope: "preset", detail: "预设", paperPresetCategory: "favorites", clearQuery: true },
  { id: "hint-ai-medical", label: "医学智能", query: "多模态医学", scope: "preset", detail: "预设" },
  { id: "hint-model-framework", label: "模型框架图", query: "模型框架图", scope: "preset", detail: "预设" },
  { id: "hint-paper-structure", label: "论文结构图", query: "论文结构图", scope: "preset", detail: "预设" },
  { id: "hint-paper-architecture", label: "架构图", query: "架构图", scope: "preset", detail: "预设" },
  { id: "hint-paper-pipeline", label: "方法流程图", query: "方法流程图", scope: "preset", detail: "预设" },
  { id: "hint-paper-algorithm", label: "算法流程图", query: "算法流程图", scope: "preset", detail: "预设" },
  { id: "hint-paper-network", label: "网络架构图", query: "网络架构图", scope: "preset", detail: "预设" },
  { id: "hint-paper-flow", label: "论文流程图", query: "论文流程图", scope: "preset", detail: "预设" },
  { id: "hint-paper-framework", label: "框架示意图", query: "框架示意图", scope: "preset", detail: "预设" },
  { id: "hint-medical-multimodal-framework", label: "医学多模态框架", query: "医学多模态框架", scope: "preset", detail: "预设" },
  { id: "hint-report-generation-framework", label: "报告生成框架", query: "报告生成框架", scope: "preset", detail: "预设" },
  { id: "hint-contrastive-framework", label: "对比学习框架", query: "对比学习框架", scope: "preset", detail: "预设" },
  { id: "hint-attention-diagram", label: "注意力机制图", query: "注意力机制图", scope: "preset", detail: "预设" },
  { id: "hint-trimodal", label: "三模态诊断", query: "三模态医学诊断", scope: "preset", detail: "预设" },
  { id: "hint-vlm", label: "医学 VLM", query: "医学 VLM 报告诊断", scope: "preset", detail: "预设" },
  { id: "hint-tabular", label: "表格临床", query: "表格临床分支", scope: "preset", detail: "预设" },
  { id: "hint-federated-learning", label: "联邦学习", query: "多中心联邦学习", scope: "preset", detail: "预设" },
  { id: "hint-diffusion-augmentation", label: "扩散增强", query: "医学扩散增强", scope: "preset", detail: "预设" },
  { id: "hint-survival-outcome", label: "生存预后", query: "生存预后预测", scope: "preset", detail: "预设" },
  { id: "hint-active-learning", label: "主动学习", query: "主动学习标注", scope: "preset", detail: "预设" },
  { id: "hint-moe-routing", label: "专家路由", query: "专家路由 MoE", scope: "preset", detail: "预设" },
  { id: "hint-longitudinal-followup", label: "随访诊断", query: "纵向随访诊断", scope: "preset", detail: "预设" },
  { id: "hint-weakly-supervised-mil", label: "弱监督 MIL", query: "弱监督 MIL", scope: "preset", detail: "预设" },
  { id: "hint-knowledge-graph", label: "知识图谱", query: "医学知识图谱推理", scope: "preset", detail: "预设" },
  { id: "hint-distillation", label: "知识蒸馏", query: "教师学生蒸馏", scope: "preset", detail: "预设" },
  { id: "hint-prompt-tuning", label: "提示调优", query: "医学基础模型提示调优", scope: "preset", detail: "预设" },
  { id: "hint-fill", label: "填充纹理", query: "填充", scope: "command", detail: "功能", panel: "style" },
  { id: "hint-feature", label: "特征块", query: "特征块", scope: "command", detail: "功能", panel: "featureBlock" },
  { id: "hint-assets", label: "素材管理", query: "素材", scope: "command", detail: "功能" }
]);

function recentGalleryEnums() {
  if (state.recent.length) return state.recent;
  return [
    "msoShapeLine",
    "msoShapeLineArrow",
    "msoShapeRectangle",
    "msoShapeRoundedRectangle",
    "msoShapeOval",
    "msoShapeRightArrow",
    "msoShapeDiamond",
    "msoShapeIsoscelesTriangle"
  ];
}

async function loadCatalog() {
  try {
    const response = await fetch("./autoshape-catalog.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    state.catalog = Array.isArray(catalog.items) ? catalog.items.filter(item =>
      item && typeof item === "object" &&
      typeof item.enumName === "string" && item.enumName &&
      typeof item.displayName === "string" &&
      typeof item.displayNameZh === "string" && item.displayNameZh &&
      typeof item.category === "string" && item.category
    ) : [];
    if (!state.catalog.length) throw new Error("形状目录为空");
    state.catalogDegraded = false;
  } catch {
    state.catalog = [
      { enumName: "msoShapeLine", displayName: "Line", displayNameZh: "直线", category: "lines", fidelity: "exact" },
      { enumName: "msoShapeRightArrow", displayName: "Right Arrow", displayNameZh: "右箭头", category: "arrows", fidelity: "exact" },
    { enumName: "msoShapeRectangle", displayName: "Rectangle", displayNameZh: "矩形", category: "rectangles", fidelity: "exact" },
    { enumName: "msoShapeOval", displayName: "Oval", displayNameZh: "椭圆", category: "basic", fidelity: "exact" }
    ];
    state.catalogDegraded = true;
    setStatus("完整形状目录读取失败，当前只显示常用形状兜底；重启任务窗格可重试。");
  }
}

function renderCategories() {
  const available = Array.from(new Set(state.catalog.map(item => item.category)));
  const ordered = categoryOrder.filter(category => category === "all" || available.includes(category));
  const categories = [...ordered, ...available.filter(category => !ordered.includes(category)).sort()];
  const query = state.query;
  const countFor = category => state.catalog.filter(item => {
    const categoryMatch = category === "all" || item.category === category;
    return categoryMatch && matchesSearchText(catalogSearchText(item), query);
  }).length;
  els.categories.innerHTML = "";
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    const count = countFor(category);
    const countEl = document.createElement("small");
    countEl.textContent = String(count);
    countEl.title = category === "all"
      ? `当前搜索下全部形状 ${count} 个`
      : `当前搜索下${categoryLabel(category)}分类 ${count} 个`;
    button.append(iconSpan(categoryIcon(category)), document.createTextNode(categoryLabel(category)), countEl);
    button.title = `${categoryLabel(category)}分类：点击筛选插入窗口中的 PPT 原生形状手绘版；当前 ${count} 个`;
    button.setAttribute("aria-label", button.title);
    button.className = category === state.category ? "active" : "";
    button.addEventListener("click", () => {
      state.category = category;
      resetResourceRenderWindows("shape");
      render();
    });
    els.categories.append(button);
  }
}

function renderShapeDropdown() {
  renderIconDropdown(els.shapeDropdown, item => {
    insertShape(item);
    closeShapeDropdown();
  });
}

function renderQuickShapeDropdown() {
  renderIconDropdown(els.quickShapeDropdown, item => {
    pinQuickShape(item.enumName);
    closeQuickShapeDropdown();
  });
}

function renderIconDropdown(container, onClick) {
  if (!container) return;
  container.innerHTML = "";
  if (!searchScopeAllows("shape")) return;
  let renderedCount = 0;
  for (const group of galleryGroups) {
    const items = state.catalog.filter(item => item.insertable !== false && group.match(item)).sort(sortItems);
    if (!items.length) continue;

    const section = document.createElement("section");
    section.className = "gallery-group";
    section.title = group.title;

    const title = document.createElement("h3");
    title.textContent = group.title;
    title.title = `${group.title}分类`;
    section.append(title);

    const list = document.createElement("div");
    list.className = "gallery-list";
    const visibleItems = iconDropdownItemsForQuery(items);
    for (const item of visibleItems) list.append(renderGalleryButton(item, onClick, container));
    if (!visibleItems.length && state.query.trim()) continue;
    renderedCount += visibleItems.length;
    section.append(list);
    container.append(section);
  }
  if (!renderedCount && state.query.trim()) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.title = "当前搜索词没有匹配形状，可清空搜索恢复完整图库";
    const copy = document.createElement("span");
    copy.textContent = `没有匹配“${state.query.trim()}”的形状`;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "清空搜索";
    clear.title = "清空搜索并恢复完整形状图库";
    clear.addEventListener("click", () => {
      clearShapeQuery();
      render();
      renderIconDropdown(container, onClick);
      els.search?.focus({ preventScroll: true });
      setStatus("已清空形状搜索，恢复完整图库。");
    });
    empty.append(copy, clear);
    container.append(empty);
  }
}

function iconDropdownItemsForQuery(items) {
  if (!state.query.trim()) return items;
  return items.filter(item => matchesSearchText(catalogSearchText(item), state.query));
}

function renderGalleryButton(item, onClick, scrollRoot = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `gallery-shape${isQuickShape(item.enumName) ? " pinned" : ""}`;
  button.title = displayName(item);
  button.setAttribute("aria-label", displayName(item));
  button.append(renderGalleryIcon(item, scrollRoot));
  button.addEventListener("click", () => onClick(item));
  button.addEventListener("contextmenu", event => {
    event.preventDefault();
    event.stopPropagation();
    openQuickShapeContextMenu(event, item, isQuickShape(item.enumName) ? "remove" : "add");
  });
  button.addEventListener("keydown", event => {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      event.stopPropagation();
      openQuickShapeContextMenu(event, item, isQuickShape(item.enumName) ? "remove" : "add");
    }
  });
  return button;
}

function resolveGalleryIconDataUrl(item) {
  if (!state.preferOfficeIcons || !item) return null;
  return item.dataUrl || state.shapeIcons[item.enumName] || state.quickShapeDetails?.[item.enumName]?.dataUrl || null;
}

function renderGalleryIcon(item, scrollRoot = null, { eager = false } = {}) {
  const dataUrl = state.preferOfficeIcons ? (item?.dataUrl || state.shapeIcons[item.enumName]) : null;
  if (dataUrl) {
    const image = document.createElement("img");
    image.className = "gallery-icon";
    image.alt = "";
    image.loading = eager ? "eager" : "lazy";
    image.decoding = "async";
    image.src = dataUrl;
    image.addEventListener("error", () => image.replaceWith(renderLocalGalleryIcon(item, scrollRoot, { eager })));
    return image;
  }

  return renderLocalGalleryIcon(item, scrollRoot, { eager });
}

function renderLocalGalleryIcon(item, scrollRoot = null, { eager = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "gallery-icon";
  canvas.width = 64;
  canvas.height = 64;
  if (eager) {
    safeDrawNativeIconPreview(canvas, item);
    canvas.dataset.previewDrawn = "1";
    delete canvas.__roughPreviewItem;
    return canvas;
  }
  scheduleGalleryIconPreview(canvas, item, scrollRoot);
  return canvas;
}

function toggleShapeDropdown() {
  const opened = els.shapeDropdown.hidden;
  if (opened) ensureShapeSearchScope(true);
  if (opened) renderShapeDropdown();
  els.shapeDropdown.hidden = !opened;
  els.shapeDropdown.dataset.open = opened ? "true" : "false";
  els.shapeDropdown.classList.toggle("is-open", opened);
  els.galleryToggle.setAttribute("aria-expanded", opened ? "true" : "false");
  els.galleryToggle.classList.toggle("active", opened);
}

function closeShapeDropdown() {
  els.shapeDropdown.hidden = true;
  els.shapeDropdown.dataset.open = "false";
  els.shapeDropdown.classList.remove("is-open");
  els.galleryToggle.setAttribute("aria-expanded", "false");
  els.galleryToggle.classList.remove("active");
  releaseGalleryIconObservers();
}

function toggleQuickShapeDropdown() {
  const opened = els.quickShapeDropdown.hidden;
  if (opened) ensureShapeSearchScope(true);
  if (opened) renderQuickShapeDropdown();
  els.quickShapeDropdown.hidden = !opened;
  els.quickShapeDropdown.dataset.open = opened ? "true" : "false";
  els.quickShapeDropdown.classList.toggle("is-open", opened);
  els.quickAddToggle.setAttribute("aria-expanded", opened ? "true" : "false");
  els.quickAddToggle.classList.toggle("active", opened);
}

function closeQuickShapeDropdown() {
  els.quickShapeDropdown.hidden = true;
  els.quickShapeDropdown.dataset.open = "false";
  els.quickShapeDropdown.classList.remove("is-open");
  els.quickAddToggle.setAttribute("aria-expanded", "false");
  els.quickAddToggle.classList.remove("active");
  releaseGalleryIconObservers();
}

function ensureShapeSearchScope(clearWhenNoShapeMatch = false) {
  const queryBefore = state.query.trim();
  const wasShapeScope = searchScopeAllows("shape");
  const shouldClearQuery = clearWhenNoShapeMatch && !wasShapeScope && queryBefore && !shapeQueryHasMatches(queryBefore);
  if (shouldClearQuery) clearShapeQuery(false);
  if (wasShapeScope) {
    if (shouldClearQuery) {
      renderSearchScopeControls();
      renderSortModeControl();
    }
    return;
  }
  state.searchScope = "shape";
  persistSetting("roughPptSearchScope", state.searchScope);
  renderSearchScopeControls();
  renderSortModeControl();
}

function resetPaperPresetCategory(persist = true) {
  if (state.paperPresetCategory === "all") return false;
  state.paperPresetCategory = "all";
  if (persist) persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
  return true;
}

function ensurePresetSearchScope(clearQuery = false, resetCategory = false) {
  state.searchScope = "preset";
  if (clearQuery) {
    state.query = "";
    if (els.search) els.search.value = "";
  }
  if (resetCategory) resetPaperPresetCategory();
  persistSetting("roughPptSearchScope", state.searchScope);
  render();
}

function openPaperPresetsPanel({ clearQuery = true, resetCategory = true, status = "" } = {}) {
  ensurePresetSearchScope(clearQuery, resetCategory);
  focusPanel("paperPresets");
  window.setTimeout(() => els.paperPresetGrid?.focus({ preventScroll: true }), 260);
  if (status) setStatus(status);
}

function shapeQueryHasMatches(query) {
  return state.catalog.some(item => item.insertable !== false && matchesSearchText(catalogSearchText(item), query));
}

function clearShapeQuery(updateInput = true) {
  state.query = "";
  if (updateInput && els.search) els.search.value = "";
  if (!updateInput && els.search) els.search.value = "";
}

function setSectionNavCollapsed(collapsed, { persist = true } = {}) {
  if (!els.sectionNav || !els.sectionNavToggle) return;
  els.sectionNav.classList.toggle("is-collapsed", collapsed);
  document.body.classList.toggle("section-nav-collapsed", collapsed);
  els.sectionNavToggle.setAttribute("aria-expanded", String(!collapsed));
  els.sectionNavToggle.textContent = collapsed ? "功能" : "收起";
  els.sectionNavToggle.title = collapsed ? "展开功能导航" : "收起功能导航";
  if (persist) persistSetting("roughPptSectionNavCollapsed", String(collapsed));
}

function initSectionNavDrawer() {
  if (!els.sectionNav || !els.sectionNavToggle) return;
  const saved = localStorage.getItem("roughPptSectionNavCollapsed");
  setSectionNavCollapsed(saved == null ? true : saved === "true", { persist: false });
  els.sectionNavToggle.addEventListener("click", () => {
    setSectionNavCollapsed(!els.sectionNav.classList.contains("is-collapsed"));
  });
}

function initWorkflowNavigation() {
  for (const button of document.querySelectorAll("[data-scroll-target]")) {
    button.addEventListener("click", () => {
      focusPanel(button.dataset.scrollTarget);
      if (button.dataset.scrollTarget === "catalog") {
        openShapeDropdownAndFocusSearch();
      }
    });
  }
  for (const button of document.querySelectorAll("[data-starter-action]")) {
    button.addEventListener("click", () => activateStarterAction(button.dataset.starterAction));
  }
  for (const button of document.querySelectorAll("[data-command-shortcut]")) {
    button.addEventListener("click", () => activateCommandShortcut(button.dataset.commandShortcut));
  }
  for (const button of document.querySelectorAll("[data-section-nav]")) {
    if (button.dataset.navWired === "true") continue;
    button.dataset.navWired = "true";
    button.addEventListener("click", () => {
      activateSectionNav(button.dataset.sectionNav);
      if (button.closest("#sectionNav")) setSectionNavCollapsed(true);
    });
  }
  for (const button of document.querySelectorAll("[data-path-shortcut]")) {
    if (button.dataset.pathWired === "true") continue;
    button.dataset.pathWired = "true";
    button.addEventListener("click", () => activatePathShortcut(button.dataset.pathShortcut, button.dataset.pathLabel));
  }
}

function activateSectionNav(key) {
  const focusLater = selector => {
    const focus = () => document.querySelector(selector)?.focus({ preventScroll: true });
    focus();
    window.requestAnimationFrame?.(focus);
    window.setTimeout(focus, 260);
    window.setTimeout(focus, 520);
  };
  if (key === "quick") {
    openQuickInsertAndFocus();
    markSectionNavActive("quick");
    return;
  }
  if (key === "catalog") {
    focusPanel("catalog", false);
    openShapeDropdownAndFocusSearch();
    markSectionNavActive("catalog");
    return;
  }
  if (key === "selection") {
    focusPanel("selection", false);
    focusLater("#selectionState");
    return;
  }
  if (key === "style") {
    if (!focusPanel("style", false)) return;
    focusLater("#styleTemplateSelect");
    return;
  }
  if (key === "paperPresets") {
    openPaperPresetsPanel({ status: "已显示全部论文图预设。" });
    return;
  }
  if (key === "charts") {
    openResearchChartStudio();
    return;
  }
  if (key === "zoteroImages") {
    focusPanel("zoteroImages", false);
    focusLater("#zoteroImageSearch");
    return;
  }
  if (key === "library") {
    focusPanel("library", false);
    focusLater("#reloadAssets");
    setStatus(state.userAssets?.length ? "已定位我的素材库。" : "已定位我的素材库：可保存选区、导入或刷新素材。");
    return;
  }
  if (key === "paletteLibrary") {
    focusPanel("zoteroImages", false);
    markSectionNavActive("paletteLibrary");
    focusLater("#paletteSchemeGrid");
    setStatus("已定位配色库：可保存、导入、分享配色，并预览整体替换布局。");
    return;
  }
  if (key === "featureBlock") {
    if (!focusPanel("featureBlock", false)) return;
    focusLater("#insertFeatureBlock");
    return;
  }
  focusPanel("start", false);
  focusLater("#jumpToShapes");
}

// 面板 collapse-key 与右侧导航项不是一一对应：论文图像与配色库面板在导航中的入口是“配色”。
const sectionNavPanelAliases = Object.freeze({
  zoteroImages: "paletteLibrary"
});

function sectionNavKeyForPanel(panelKey) {
  const key = String(panelKey ?? "");
  return sectionNavPanelAliases[key] ?? key;
}

function markSectionNavActive(key) {
  const resolved = sectionNavKeyForPanel(key);
  for (const button of els.sectionNavButtons ?? []) {
    const active = button.dataset.sectionNav === resolved;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
  }
}

// 滚动定位：导航高亮必须跟随当前阅读位置，否则粘性侧栏会一直指向上一次点击的面板。
function currentScrolledPanelKey(panels, anchor) {
  let fallback = "";
  let current = "";
  for (const panel of panels) {
    const rect = panel.getBoundingClientRect?.();
    if (!rect || (rect.width <= 0 && rect.height <= 0)) continue;
    if (rect.bottom <= anchor) continue;
    if (rect.top > window.innerHeight) continue;
    if (!fallback) fallback = panel.dataset.collapseKey || "";
    if (rect.top <= anchor + 4) current = panel.dataset.collapseKey || "";
  }
  return current || fallback;
}

function syncSectionNavToScroll() {
  if (!els.sectionNavButtons?.length) return;
  const panels = Array.from(document.querySelectorAll("[data-collapse-key]"));
  if (!panels.length) return;
  const topbar = document.querySelector(".topbar");
  const anchor = Math.ceil(topbar?.getBoundingClientRect?.().height || 44) + 12;
  const key = currentScrolledPanelKey(panels, anchor);
  if (key) markSectionNavActive(key);
}

let sectionNavScrollHandle = 0;
function scheduleSectionNavScrollSync() {
  if (sectionNavScrollHandle) return;
  const run = () => {
    sectionNavScrollHandle = 0;
    syncSectionNavToScroll();
  };
  if (typeof window.requestAnimationFrame === "function") {
    sectionNavScrollHandle = window.requestAnimationFrame(run);
    return;
  }
  sectionNavScrollHandle = window.setTimeout(run, 32);
}

function activateStarterAction(action) {
  if (action === "catalog") {
    focusPanel("catalog");
    openShapeDropdownAndFocusSearch();
    return;
  }
  if (action === "quickInsert") {
    openQuickInsertAndFocus();
    return;
  }
  if (action === "search") {
    focusGlobalSearch();
    return;
  }
  if (action === "style") {
    if (!focusPanel("style")) return;
    window.setTimeout(() => els.styleTemplateSelect?.focus({ preventScroll: true }), 260);
    return;
  }
  if (action === "paperPresets") {
    openPaperPresetsPanel({ status: "已显示全部论文图预设。" });
    return;
  }
  if (action === "charts") {
    openResearchChartStudio();
    return;
  }
  if (action === "library") {
    focusPanel("library");
    window.setTimeout(() => els.reloadAssets?.focus({ preventScroll: true }), 260);
    return;
  }
  if (action === "featureBlock") {
    if (!focusPanel("featureBlock")) return;
    window.setTimeout(() => els.insertFeatureBlock?.focus({ preventScroll: true }), 260);
    return;
  }
  if (action === "next") {
    runSelectionNextStepFromStarter();
    return;
  }
  if (action === "paperTemplate") {
    applyStarterPaperTemplate();
    return;
  }
  if (action === "convert") {
    runSelectionStarterAction(els.convert, "转换选区", "当前没有可转换的普通 PPT 形状，请先在 PowerPoint 中选择形状。");
    return;
  }
  if (action === "redraw") {
    runRedrawStarterAction();
  }
}

function runSelectionNextStepFromStarter() {
  if (els.selectionNextStep?.dataset.selectionKind === "none") {
    focusPanel("catalog");
    openShapeDropdownAndFocusSearch();
    return;
  }
  if (els.selectionNextAction && !els.selectionNextAction.hidden && !els.selectionNextAction.disabled) {
    setStatus("正在执行当前选区推荐下一步...");
    els.selectionNextAction.click();
    return;
  }
  focusPanel("catalog");
  openShapeDropdownAndFocusSearch();
}

function runSelectionStarterAction(button, label, unavailableText) {
  focusPanel("selection");
  if (!button) return;
  window.setTimeout(() => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      button.focus({ preventScroll: true });
      setStatus(unavailableText);
      return;
    }
    setStatus(`正在执行：${label}`);
    button.click();
  }, 160);
}

function runRedrawStarterAction() {
  focusPanel("selection");
  window.setTimeout(() => {
    if (els.refresh && !els.refresh.disabled && els.refresh.getAttribute("aria-disabled") !== "true") {
      setStatus("正在执行：重绘选区");
      els.refresh.click();
      return;
    }
    if (state.lastRoughSelectionKey) {
      redrawSelectionFromCurrentStyle("正在重绘最近选中的手绘对象...");
      return;
    }
    els.refresh?.focus({ preventScroll: true });
    setStatus("当前没有可重绘的手绘对象，请先选择已生成的手绘组。");
  }, 160);
}

function applyStarterPaperTemplate() {
  focusPanel("style");
  const template = state.styleTemplates.find(item => item.id === "builtin-paper");
  if (!template) {
    setStatus("未找到论文框图模板。", true);
    return;
  }
  state.selectedStyleTemplateId = template.id;
  persistSetting("roughPptSelectedStyleTemplate", state.selectedStyleTemplateId);
  if (els.styleTemplateSelect) els.styleTemplateSelect.value = template.id;
  updateStyleTemplatePreviewActive();
  if (els.renameStyleTemplate) {
    els.renameStyleTemplate.disabled = true;
    els.renameStyleTemplate.title = "预置模板不能重命名，请先保存为自定义模板";
  }
  applySelectedStyleTemplate();
}

function openShapeDropdownAndFocusSearch() {
  window.setTimeout(() => {
    if (els.shapeDropdown.hidden) toggleShapeDropdown();
    els.search?.focus({ preventScroll: true });
    setStatus("已展开形状图库，可直接搜索或点击形状插入。");
  }, 280);
}

function openQuickInsertAndFocus() {
  focusPanel("catalog");
  window.setTimeout(() => {
    if (els.quickShapeDropdown?.hidden) toggleQuickShapeDropdown();
    els.quickAddToggle?.focus({ preventScroll: true });
    setStatus("已展开快速插入添加图库，可选择常用形状固定到顶部和右侧快速插入栏。");
  }, 280);
}

function focusGlobalSearch() {
  state.searchScope = "all";
  state.query = "";
  persistSetting("roughPptSearchScope", state.searchScope);
  if (els.search) els.search.value = "";
  render();
  window.setTimeout(() => {
    els.search?.scrollIntoView({ behavior: "smooth", block: "center" });
    els.search?.focus({ preventScroll: true });
    setStatus("已定位功能搜索，可输入重绘、转换、填充、模板、素材等关键词。");
  }, 120);
}

function activateCommandShortcut(commandId) {
  const command = commandSearchItems.find(item => item.id === commandId);
  if (!command) return;
  if (!commandAvailableInCurrentContext(command)) {
    setStatus(command.panel === "featureBlock" ? "请先在 PowerPoint 中选中特征块。" : "请先在 PowerPoint 中选择形状，再调整风格参数。", false);
    return;
  }
  rememberCommand(command.id);
  document.querySelector(".workflow-quickfind")?.setAttribute("open", "");
  if (command.panel === "paperPresets") {
    applyPaperPresetCommandState(command);
  } else {
    state.searchScope = searchScopeForCommand(command);
    state.query = queryForCommandActivation(command);
  }
  persistSetting("roughPptSearchScope", state.searchScope);
  if (els.search) els.search.value = state.query;
  render();
  window.setTimeout(() => {
    focusControl(command);
    setStatus(command.panel === "paperPresets" ? `已定位预设：${command.title}` : `已定位功能：${command.title}`);
  }, 80);
}

function activatePathShortcut(commandId, pathLabel = "") {
  const command = commandSearchItems.find(item => item.id === commandId);
  if (!command) return;
  if (!commandAvailableInCurrentContext(command)) {
    setStatus(command.panel === "featureBlock" ? "请先在 PowerPoint 中选中特征块。" : "请先在 PowerPoint 中选择形状，再调整风格参数。", false);
    return;
  }
  rememberCommand(command.id);
  document.querySelector("[data-quickfind]")?.setAttribute("open", "");
  if (command.panel === "paperPresets") {
    applyPaperPresetCommandState(command);
  } else {
    state.searchScope = searchScopeForCommand(command);
    state.query = queryForCommandActivation(command);
  }
  persistSetting("roughPptSearchScope", state.searchScope);
  if (els.search) els.search.value = state.query;
  render();
  window.setTimeout(() => {
    focusControl(command);
    const targetName = command.panel === "paperPresets" ? "预设卡片" : command.title;
    setStatus(`路径提示：${pathLabel || command.title}，已定位到${targetName}。`);
  }, 80);
}

function searchScopeForCommand(command) {
  return command?.panel === "paperPresets" ? "preset" : "command";
}

function queryForCommandActivation(command) {
  if (command?.panel !== "paperPresets") return command?.title ?? "";
  if (command.paperPresetCategory) return "";
  if (!command.presetId) return command.title || "论文图预设";
  return paperStructurePresets.find(preset => preset.id === command.presetId)?.title || command.title || "论文图预设";
}

function applyPaperPresetCommandState(command) {
  state.searchScope = "preset";
  state.query = queryForCommandActivation(command);
  if (command?.paperPresetCategory) {
    state.paperPresetCategory = command.paperPresetCategory;
    persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
  } else {
    resetPaperPresetCategory();
  }
}

function safeScrollIntoView(node, options) {
  if (!node || typeof node.scrollIntoView !== "function") return;
  try { node.scrollIntoView(options); } catch {}
}


function updateStickyChromeMetrics() {
  try {
    const topbar = document.querySelector(".topbar");
    const top = Math.ceil(topbar?.getBoundingClientRect?.().height || 44);
    const root = document.documentElement;
    // 只在数值变化时写入，避免多余样式写入以及与 ResizeObserver 形成回环。
    if (root.style.getPropertyValue("--sticky-topbar-height") !== `${top}px`) {
      root.style.setProperty("--sticky-topbar-height", `${top}px`);
      root.style.setProperty("--panel-scroll-margin", `${top + 12}px`);
    }
  } catch {}
}

// 顶栏高度会随状态条展开、长文案换行和界面模式变化，度量必须跟随实际高度，
// 否则 scroll-margin-top 会失准，定位到的面板会被粘性顶栏遮挡。
function observeStickyChromeHeight() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || typeof ResizeObserver !== "function") return false;
  if (window.__roughStickyChromeObserver) return true;
  const observer = new ResizeObserver(() => updateStickyChromeMetrics());
  observer.observe(topbar);
  window.__roughStickyChromeObserver = observer;
  return true;
}

function panelAvailableInCurrentContext(key) {
  if (state.uiMode === "full") return true;
  const kind = document.body.dataset.selectionKind || "none";
  if (key === "style") return kind === "normal" || kind === "rough";
  if (key === "featureBlock") return kind === "feature";
  return true;
}

function unavailablePanelStatus(key) {
  return key === "featureBlock"
    ? "请先在 PowerPoint 中选中特征块。"
    : "请先在 PowerPoint 中选择普通形状或手绘对象，再调整风格参数。";
}

function focusPanel(key, focusSelf = true) {
  if (!panelAvailableInCurrentContext(key)) {
    const kind = document.body.dataset.selectionKind || "none";
    setSimpleActivePanel(kind === "feature" ? "featureBlock" : "selection");
    setStatus(unavailablePanelStatus(key), false);
    return false;
  }
  const panel = key === "start"
    ? document.querySelector(".starter-panel")
    : document.querySelector(`[data-collapse-key="${key}"]`);
  if (!panel) return false;
  markSectionNavActive(key);
  for (const other of document.querySelectorAll(".focus-target")) {
    if (other !== panel) other.classList.remove("focus-target");
  }
  const toggle = panel.querySelector(".collapse-toggle");
  if (toggle && state.uiMode === "simple" && panel.dataset.collapseKey) {
    setSimpleActivePanel(panel.dataset.collapseKey);
  } else if (toggle && panel.classList.contains("collapsed")) {
    setPanelCollapsed(panel, toggle, false);
    persistSetting(`roughPptCollapsed:${key}`, "false");
  }
  updateStickyChromeMetrics();
  safeScrollIntoView(panel, { behavior: "smooth", block: "start" });
  panel.classList.add("focus-target");
  panel.classList.remove("focus-pulse");
  // reflow then pulse once
  void panel.offsetWidth;
  panel.classList.add("focus-pulse");
  if (focusPulseTimer) window.clearTimeout(focusPulseTimer);
  focusPulseTimer = window.setTimeout(() => {
    focusPulseTimer = 0;
    panel.classList.remove("focus-pulse");
  }, 1200);
  panel.tabIndex = -1;
  if (focusSelf) window.setTimeout(() => panel.focus({ preventScroll: true }), 220);
  window.setTimeout(() => panel.classList.remove("focus-pulse"), 900);
  return true;
}

function focusControl(item) {
  if (!focusPanel(item.panel)) return false;
  if (item.target === "paletteSchemeGrid" || item.id === "cmd-palette-library") {
    markSectionNavActive("paletteLibrary");
  }
  if (item.paramGroup) {
    const group = Array.from(document.querySelectorAll(".param-section"))
      .find(section => section.dataset.paramGroup === item.paramGroup);
    if (group) openParamGroup(group);
  }

  const target = targetElementForCommand(item.target);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("control-focus-pulse");
  if (typeof target.focus === "function") {
    window.setTimeout(() => target.focus({ preventScroll: true }), 260);
  }
  if (item.target === "quickAddToggle") {
    if (els.quickShapeDropdown?.hidden) toggleQuickShapeDropdown();
    els.quickAddToggle?.focus({ preventScroll: true });
    window.setTimeout(() => {
      if (els.quickShapeDropdown?.hidden) toggleQuickShapeDropdown();
      els.quickAddToggle?.focus({ preventScroll: true });
    }, 300);
  }
  if (item.target === "galleryToggle") {
    window.setTimeout(() => {
      if (item.shapeQuery) {
        state.searchScope = "shape";
        state.query = item.shapeQuery;
        if (item.shapeCategory && categoryOrder.includes(item.shapeCategory)) state.category = item.shapeCategory;
        persistSetting("roughPptSearchScope", state.searchScope);
        if (els.search) els.search.value = item.shapeQuery;
        render();
      }
      if (els.shapeDropdown?.hidden) toggleShapeDropdown();
      if (item.focusSearchAfterOpen === false) {
        const firstGalleryResult = els.shapeDropdown?.querySelector(".gallery-shape");
        (firstGalleryResult ?? els.galleryToggle)?.focus({ preventScroll: true });
      } else {
        els.search?.focus({ preventScroll: true });
      }
    }, 300);
  }
  window.setTimeout(() => target.classList.remove("control-focus-pulse"), 1100);
  return true;
}

function openParamGroup(groupOrTitle) {
  const group = typeof groupOrTitle === "string"
    ? Array.from(document.querySelectorAll(".param-section")).find(section => section.dataset.paramGroup === groupOrTitle)
    : groupOrTitle;
  if (!group) return null;
  group.open = true;
  syncParamJumpButtons(group.dataset.paramGroup || "");
  return group;
}

function focusParamGroup(title) {
  if (!focusPanel("style")) return;
  const group = openParamGroup(title);
  if (!group) return;
  group.scrollIntoView({ behavior: "smooth", block: "center" });
  group.classList.add("control-focus-pulse");
  const summary = group.querySelector("summary");
  window.setTimeout(() => summary?.focus({ preventScroll: true }), 220);
  window.setTimeout(() => group.classList.remove("control-focus-pulse"), 1100);
  setStatus(`已定位风格参数组：${title}`);
}

function syncParamJumpButtons(activeTitle = "") {
  for (const button of els.styleParamJumpButtons ?? []) {
    const active = button.dataset.paramGroupJump === activeTitle;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function syncParamJumpButtonsForSectionToggle(details) {
  const title = details?.dataset?.paramGroup || "";
  if (details?.open) {
    syncParamJumpButtons(title);
    return;
  }
  const activeButton = (els.styleParamJumpButtons ?? [])
    .find(button => button.getAttribute("aria-pressed") === "true" || button.classList.contains("active"));
  if (activeButton?.dataset.paramGroupJump === title) {
    syncParamJumpButtons("");
  }
}

function targetElementForCommand(target) {
  if (!target) return null;
  return document.getElementById(target) ??
    document.querySelector(`[name="${target}"]`) ??
    document.querySelector(`[data-paper-preset-id="${target.replace(/^paperPreset-/, "")}"]`);
}

function searchScopeAllows(kind) {
  const scope = state.searchScope || "all";
  if (scope === "all") return true;
  return scope === kind;
}

function searchScopeLabel(scope = state.searchScope) {
  if (scope === "shape") return "形状";
  if (scope === "command") return "功能";
  if (scope === "preset") return "预设";
  if (scope === "chart") return "数据";
  if (scope === "asset") return "素材";
  return "全部";
}

function commandAvailableInCurrentContext(command) {
  if (state.uiMode === "full") return true;
  const kind = document.body.dataset.selectionKind || "none";
  if (Array.isArray(command.selectionKinds)) return command.selectionKinds.includes(kind);
  if (command.panel === "style") return kind === "normal" || kind === "rough";
  if (command.panel === "featureBlock") return kind === "feature";
  return true;
}

function contextualSearchExamples() {
  const kind = document.body.dataset.selectionKind || "none";
  if (state.uiMode === "full") return "重绘、模板、填充、特征块、论文图预设、科研绘图";
  if (kind === "normal" || kind === "rough") return "重绘、模板、填充、论文图预设、科研绘图";
  if (kind === "feature") return "特征块、论文图预设、科研绘图";
  return "插入形状、论文图预设、科研绘图、素材";
}

function syncContextualCommandShortcuts() {
  let availableCount = 0;
  for (const button of document.querySelectorAll("[data-command-shortcut]")) {
    const command = commandSearchItems.find(item => item.id === button.dataset.commandShortcut);
    const available = Boolean(command && commandAvailableInCurrentContext(command));
    button.hidden = !available;
    button.setAttribute("aria-hidden", available ? "false" : "true");
    if (available) availableCount += 1;
  }
  const quickfind = document.querySelector(".workflow-quickfind");
  const summary = quickfind?.querySelector(":scope > summary");
  const label = summary?.querySelector(".quickfind-label");
  const hint = summary?.querySelector(".quickfind-hint");
  if (!quickfind || !summary || !label || !hint) return;
  const kind = document.body.dataset.selectionKind || "none";
  const copy = state.uiMode === "full"
    ? ["更多与速查", "添加常用 / 转换 / 重绘 / 路径", "添加常用、转换、重绘、模板、填充、特征块和素材等路径提示"]
    : kind === "normal"
      ? ["形状调整", "转换 / 风格 / 素材 / 路径", "转换、模板、填充和素材等当前可用路径提示"]
      : kind === "rough"
        ? ["手绘调整", "重绘 / 风格 / 素材 / 路径", "重绘、模板、填充和素材等当前可用路径提示"]
        : kind === "feature"
          ? ["特征块工具", "特征块 / 素材 / 路径", "特征块和素材等当前可用路径提示"]
          : ["更多可用功能", "添加常用 / 素材 / 路径", "添加常用和素材等当前可用路径提示"];
  quickfind.dataset.availablePathCount = String(availableCount);
  label.textContent = `${copy[0]} · ${availableCount} 条`;
  label.title = `${copy[0]}，当前有 ${availableCount} 个可用路径`;
  hint.textContent = copy[1];
  hint.title = copy[2];
  summary.title = `${copy[0]}：展开或收起当前 ${availableCount} 个可用操作与路径`;
  summary.setAttribute("aria-label", summary.title);
}

function refreshContextualSearchUi() {
  syncContextualCommandShortcuts();
  renderSearchSuggestions();
  renderCommandResults();
  renderSearchEmpty();
}

function matchedCommands() {
  const query = state.query.trim().toLowerCase();
  if (!searchScopeAllows("command")) return [];
  if (!query) return commandCenterItems();
  return commandMatchesForQuery(query);
}

function commandMatchesForQuery(query, limit = 8) {
  query = String(query ?? "").trim().toLowerCase();
  if (!query) return commandCenterItems();
  return commandSearchItems
    .filter(commandAvailableInCurrentContext)
    .map(item => ({ item, score: commandMatchScore(item, query) }))
    .filter(match => match.score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title, "zh-CN"))
    .slice(0, limit)
    .map(match => match.item);
}

function crossScopeCommandMatches() {
  const query = state.query.trim();
  if (!query || searchScopeAllows("command")) return [];
  return commandMatchesForQuery(query);
}

function commandCenterItems() {
  const byId = new Map(commandSearchItems.filter(commandAvailableInCurrentContext).map(item => [item.id, item]));
  const result = [];
  for (const id of [...state.recentCommands, ...defaultCommandCenterIds]) {
    const command = byId.get(id);
    if (command && !result.some(item => item.id === command.id)) result.push(command);
  }
  return result.slice(0, 9);
}

function rememberCommand(commandId) {
  if (!commandId) return;
  state.recentCommands = [commandId, ...state.recentCommands.filter(id => id !== commandId)].slice(0, 8);
  persistSetting("roughPptRecentCommands", JSON.stringify(state.recentCommands));
}

function commandMatchScore(item, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const title = normalizeSearchText(item.title);
  const detail = normalizeSearchText(item.detail);
  if (title === normalizedQuery) return 160;
  if (title.includes(normalizedQuery)) return 100;
  if (detail.includes(normalizedQuery)) return 70;
  let score = 0;
  for (const alias of item.aliases ?? []) {
    const text = normalizeSearchText(alias);
    if (text === normalizedQuery) score = Math.max(score, 145);
    else if (text.includes(normalizedQuery) || normalizedQuery.includes(text)) score = Math.max(score, 95);
  }
  for (const keyword of item.keywords ?? []) {
    const text = normalizeSearchText(keyword);
    if (text === normalizedQuery) score = Math.max(score, 90);
    else if (text.includes(normalizedQuery) || normalizedQuery.includes(text)) score = Math.max(score, 60);
  }
  const haystack = commandSearchText(item);
  const queryTokens = searchTokens(normalizedQuery);
  if (queryTokens.length) {
    const matched = queryTokens.filter(token => haystack.includes(token)).length;
    if (matched) score = Math.max(score, Math.round(25 + (matched / queryTokens.length) * 20));
  }
  if (normalizedQuery.length >= 2 && fuzzySubsequenceMatch(normalizedQuery, haystack)) score = Math.max(score, 35);
  return score;
}

function commandSearchText(item) {
  return normalizeSearchText(`${item.title} ${item.detail} ${(item.aliases ?? []).join(" ")} ${(item.keywords ?? []).join(" ")}`);
}

function normalizeSearchText(value) {
  return String(value ?? "").toLowerCase().replace(/[\s，。、“”‘’：:；;（）()[\]{}_\-]+/g, "");
}

function searchTokens(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  const tokens = new Set();
  for (const match of normalized.matchAll(/[a-z0-9]+|[\u3400-\u9fff]/g)) tokens.add(match[0]);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const pair = normalized.slice(index, index + 2);
    if (/[\u3400-\u9fff]{2}/.test(pair)) tokens.add(pair);
  }
  if (normalized.length >= 3) tokens.add(normalized);
  return [...tokens].filter(token => token.length > 0);
}

function fuzzySubsequenceMatch(needle, haystack) {
  let cursor = 0;
  for (const char of needle) {
    cursor = haystack.indexOf(char, cursor);
    if (cursor < 0) return false;
    cursor += 1;
  }
  return true;
}

function activateCommandResult(command) {
  rememberCommand(command.id);
  if (command.panel === "paperPresets") {
    applyPaperPresetCommandState(command);
    persistSetting("roughPptSearchScope", state.searchScope);
    if (els.search) els.search.value = state.query;
    render();
    window.setTimeout(() => {
      focusControl(command);
      setStatus(`已定位预设：${command.title}`);
    }, 100);
    return;
  }
  focusControl(command);
  setStatus(`已定位功能：${command.title}`);
}

function renderCommandResults() {
  if (!els.commandResults) return;
  const query = state.query.trim();
  els.commandResults.classList.remove("command-center");
  els.commandResults.innerHTML = "";
  if (!query) {
    els.commandResults.hidden = true;
    return;
  }
  const commands = matchedCommands();
  els.commandResults.hidden = commands.length === 0;
  if (!commands.length) return;

  const header = document.createElement("header");
  header.className = "command-results-head";
  const title = document.createElement("strong");
  title.textContent = "匹配功能";
  title.title = "根据当前搜索词匹配到的插件功能命令";
  const hint = document.createElement("span");
  hint.className = "badge";
  hint.textContent = `${commands.length} 项`;
  hint.title = "点击命令会定位到对应功能区，不会直接执行删除或覆盖等操作";
  header.append(title, hint);

  const list = document.createElement("div");
  list.className = "command-result-list";
  for (const command of commands) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-result";
    button.dataset.commandId = command.id;
    if (command.presetId) button.dataset.paperPresetId = command.presetId;
    if (command.target) button.dataset.commandTarget = command.target;
    button.title = `${command.title}：${command.detail}`;
    button.setAttribute("aria-label", button.title);
    const icon = createFunctionIcon(commandFunctionIconName(command), command.id);
    icon.classList.add("command-result-icon");
    const copy = document.createElement("span");
    copy.className = "command-result-copy";
    const name = document.createElement("strong");
    name.textContent = command.title;
    const detail = document.createElement("small");
    detail.textContent = command.detail;
    copy.append(name, detail);
    button.append(icon, copy);
    button.addEventListener("click", () => activateCommandResult(command));
    button.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusAdjacentCommandButton(button, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusEdgeCommandButton(event.key === "End" ? -1 : 0);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateCommandResult(command);
      }
    });
    list.append(button);
  }

  els.commandResults.append(header, list);
  initHorizontalDragScroll();
}

function renderSearchScopeControls() {
  for (const button of els.searchScopeButtons ?? []) {
    const active = button.dataset.searchScope === state.searchScope;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = active
      ? `当前搜索范围：${searchScopeLabel(button.dataset.searchScope)}`
      : `切换到${searchScopeLabel(button.dataset.searchScope)}搜索范围`;
  }
  renderSortModeControl();
}

function renderSortModeControl() {
  if (!els.sortMode) return;
  const enabled = searchScopeAllows("shape");
  els.sortMode.disabled = !enabled;
  els.sortMode.setAttribute("aria-disabled", enabled ? "false" : "true");
  els.sortMode.title = enabled
    ? "选择形状列表的排序方式；该排序只影响 PPT 原生形状手绘版列表"
    : `当前范围为${searchScopeLabel()}，排序只影响形状列表；切换到“全部”或“形状”后可用`;
  els.sortMode.setAttribute("aria-label", enabled ? "形状排序" : `形状排序，当前${searchScopeLabel()}范围不适用`);
}

function renderSearchSuggestions() {
  if (!els.searchSuggestions) return;
  const query = state.query.trim();
  els.searchSuggestions.hidden = query.length > 0;
  els.searchSuggestions.innerHTML = "";
  if (query) return;

  const label = document.createElement("span");
  label.className = "search-suggestions-label";
  label.textContent = "常搜";
  label.title = "常用搜索关键词";

  const list = document.createElement("div");
  list.className = "search-suggestion-list";
  for (const suggestion of searchSuggestionItems.filter(commandAvailableInCurrentContext)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    button.dataset.searchSuggestionId = suggestion.id;
    button.dataset.suggestionScope = suggestion.scope;
    button.dataset.suggestionQuery = suggestion.query;
    if (suggestion.paperPresetCategory) button.dataset.paperPresetCategory = suggestion.paperPresetCategory;
    button.title = suggestion.clearQuery
      ? `${suggestion.label}：打开${suggestion.label}筛选，范围 ${searchScopeLabel(suggestion.scope)}`
      : `${suggestion.label}：搜索“${suggestion.query}”，范围 ${searchScopeLabel(suggestion.scope)}`;
    button.setAttribute("aria-label", button.title);

    const label = document.createElement("span");
    label.className = "search-suggestion-label";
    label.textContent = suggestion.label;
    const detail = document.createElement("span");
    detail.className = "search-suggestion-scope";
    detail.textContent = suggestion.detail;
    button.append(label, detail);
    button.addEventListener("click", () => applySearchSuggestion(suggestion));
    list.append(button);
  }

  els.searchSuggestions.append(label, list);
  initHorizontalDragScroll();
}

function applySearchSuggestion(suggestion) {
  const nextQuery = suggestion.clearQuery ? "" : suggestion.query;
  state.query = nextQuery;
  if (els.search) els.search.value = nextQuery;
  state.searchScope = suggestion.scope || "all";
  if (state.searchScope === "preset" && suggestion.paperPresetCategory) {
    state.paperPresetCategory = suggestion.paperPresetCategory;
    persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
  } else if (state.searchScope === "preset") {
    resetPaperPresetCategory();
  }
  persistSetting("roughPptSearchScope", state.searchScope);
  render();
  els.search?.focus({ preventScroll: true });
  setStatus(suggestion.clearQuery ? `已打开：${suggestion.label}` : `已搜索：${suggestion.label}`);
}

function renderSearchEmpty(items = filteredItems()) {
  if (!els.searchEmptyState) return;
  const query = state.query.trim();
  if (!query) {
    els.searchEmptyState.hidden = true;
    els.searchEmptyState.textContent = "";
    return;
  }

  const hasShapes = searchScopeAllows("shape") && items.length > 0;
  const hasCommands = searchScopeAllows("command") && matchedCommands().length > 0;
  const hasPresets = searchScopeAllows("preset") && filteredPaperPresets().length > 0;
  const hasCharts = searchScopeAllows("chart") && filteredChartDatasets().length > 0;
  const hasAssets = searchScopeAllows("asset") && filteredAssets().length > 0;
  const shapeRescue = crossScopeShapeMatches();
  const commandRescue = crossScopeCommandMatches();
  const presetRescue = crossScopePaperPresetMatches();
  const chartRescue = crossScopeChartMatches();
  const assetRescue = crossScopeAssetMatches();
  if (hasShapes || hasCommands || hasPresets || hasCharts || hasAssets) {
    els.searchEmptyState.hidden = true;
    els.searchEmptyState.textContent = "";
    return;
  }

  els.searchEmptyState.hidden = false;
  els.searchEmptyState.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = `没有匹配“${query}”`;
  title.title = "当前搜索词没有匹配结果";
  const rescueSummary = [
    ["形状", shapeRescue.length],
    ["功能", commandRescue.length],
    ["预设", presetRescue.length],
    ["数据", chartRescue.length],
    ["素材", assetRescue.length]
  ].filter(([, count]) => count > 0);
  const detail = document.createElement("span");
  detail.textContent = rescueSummary.length
    ? `当前范围：${searchScopeLabel()}。其他范围中有结果：${rescueSummary.map(([label, count]) => `${label} ${count} 个`).join("、")}，可直接切换查找。`
    : `当前范围：${searchScopeLabel()}。可切换到全部、形状、功能、预设、数据或素材，也可试试：${contextualSearchExamples()}。`;
  detail.title = "提示当前搜索范围、其他范围的匹配数量，并给出可尝试的关键词";
  const canTryShapeRescue = shapeRescue.length > 0;
  const canTryPresetRescue = presetRescue.length > 0;
  const canTryChartRescue = chartRescue.length > 0;
  const canTryAssetRescue = assetRescue.length > 0;
  if (commandRescue.length || canTryShapeRescue || canTryPresetRescue || canTryChartRescue || canTryAssetRescue) {
    const actions = document.createElement("span");
    actions.className = "search-rescue-actions";
    if (canTryShapeRescue) {
      const shape = document.createElement("button");
      shape.type = "button";
      shape.textContent = `在形状中查找（${shapeRescue.length}）`;
      shape.title = `切换到形状范围并显示匹配的 ${shapeRescue.length} 个 PPT 原生形状手绘版，不会直接插入形状`;
      shape.addEventListener("click", () => {
        state.searchScope = "shape";
        persistSetting("roughPptSearchScope", state.searchScope);
        render();
        setStatus(`已切换到形状范围，匹配 ${shapeRescue.length} 个形状。`);
        window.setTimeout(() => document.querySelector("#shapeGrid .shape-card")?.focus({ preventScroll: true }), 260);
      });
      actions.append(shape);
    }
    if (canTryPresetRescue) {
      const preset = document.createElement("button");
      preset.type = "button";
      preset.textContent = `在预设中查找（${presetRescue.length}）`;
      preset.title = `切换到预设范围并显示匹配的 ${presetRescue.length} 个论文图预设，不会直接插入 PPT`;
      preset.addEventListener("click", () => switchToPaperPresetResults(true));
      actions.append(preset);
    }
    if (commandRescue.length) {
      const rescue = document.createElement("button");
      rescue.type = "button";
      rescue.textContent = `在功能中查找（${commandRescue.length}）`;
      rescue.title = `切换到功能范围并显示匹配的 ${commandRescue.length} 个插件命令，不会直接执行插入、删除、分享或重绘`;
      rescue.addEventListener("click", () => switchToCommandResults(commandRescue[0], true));
      actions.append(rescue);
    }
    if (canTryChartRescue) {
      const chart = document.createElement("button");
      chart.type = "button";
      chart.textContent = `在数据中查找（${chartRescue.length}）`;
      chart.title = `切换到数据范围并显示匹配的 ${chartRescue.length} 个已导入科研绘图数据集，不会直接插入图表`;
      chart.addEventListener("click", () => {
        state.searchScope = "chart";
        persistSetting("roughPptSearchScope", state.searchScope);
        render();
        setStatus(`已切换到数据范围，匹配 ${chartRescue.length} 个数据集。`);
        window.setTimeout(() => document.querySelector("#zlkChartResults .chart-dataset-card")?.focus({ preventScroll: true }), 260);
      });
      actions.append(chart);
    }
    if (canTryAssetRescue) {
      const asset = document.createElement("button");
      asset.type = "button";
      asset.textContent = `在素材中查找（${assetRescue.length}）`;
      asset.title = `切换到素材范围并显示匹配的 ${assetRescue.length} 个我的素材，不会直接插入或删除`;
      asset.addEventListener("click", () => {
        state.searchScope = "asset";
        persistSetting("roughPptSearchScope", state.searchScope);
        render();
        setStatus(`已切换到素材范围，匹配 ${assetRescue.length} 个素材。`);
        window.setTimeout(() => document.querySelector("#userAssets .asset-card")?.focus({ preventScroll: true }), 260);
      });
      actions.append(asset);
    }
    els.searchEmptyState.append(title, detail, actions);
    return;
  }
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "清空搜索";
  clear.title = "清空当前搜索词并恢复列表";
  clear.addEventListener("click", () => {
    state.query = "";
    els.search.value = "";
    render();
    els.search.focus({ preventScroll: true });
  });
  els.searchEmptyState.append(title, detail, clear);
}

function switchToCommandResults(command = null, focusResult = false) {
  state.searchScope = "command";
  persistSetting("roughPptSearchScope", state.searchScope);
  render();
  focusElementRepeatedly(firstVisibleCommandButton, focusResult);
  window.setTimeout(() => {
    const firstButton = firstVisibleCommandButton();
    if (focusResult && firstButton) firstButton.focus({ preventScroll: true });
    if (command) setStatus(`已切换到功能范围：${command.title}`);
    window.setTimeout(() => {
      const button = firstVisibleCommandButton();
      if (focusResult && button && document.activeElement !== button) button.focus({ preventScroll: true });
    }, 120);
  }, 80);
}

function switchToPaperPresetResults(focusResult = false) {
  state.searchScope = "preset";
  resetPaperPresetCategory();
  persistSetting("roughPptSearchScope", state.searchScope);
  render();
  focusElementRepeatedly(firstVisiblePaperPresetCard, focusResult);
  window.setTimeout(() => {
    const firstCard = firstVisiblePaperPresetCard();
    if (focusResult) firstCard?.focus({ preventScroll: true });
    setStatus("已切换到预设范围。");
    window.setTimeout(() => {
      const card = firstVisiblePaperPresetCard();
      if (focusResult && card && document.activeElement !== card) card.focus({ preventScroll: true });
    }, 120);
  }, 80);
}

function crossScopeShapeMatches() {
  const query = state.query.trim();
  if (!query || searchScopeAllows("shape")) return [];
  return state.catalog.filter(item => {
    const categoryMatch = state.category === "all" || item.category === state.category;
    return categoryMatch && matchesSearchText(catalogSearchText(item), query);
  });
}

function crossScopePaperPresetMatches() {
  const query = state.query.trim();
  if (!query || searchScopeAllows("preset")) return [];
  return paperStructurePresets.filter(preset => matchesSearchText(paperPresetSearchText(preset), query));
}

function crossScopeChartMatches() {
  const query = state.query.trim();
  if (!query || searchScopeAllows("chart")) return [];
  return state.chartDatasets.filter(dataset => {
    const text = [
      dataset.source?.path,
      dataset.source?.kind,
      dataset.source?.type,
      ...(dataset.recommendations ?? []).map(item => `${item.title} ${item.chartType} ${item.reason}`),
      ...(dataset.points ?? []).slice(0, 40).map(point => `${point.method} ${point.dataset} ${point.metric} ${point.subgroup} ${point.errorType}`)
    ].filter(Boolean).join(" ");
    return matchesSearchText(text, query);
  });
}

function crossScopeAssetMatches() {
  const query = state.query.trim();
  if (!query || searchScopeAllows("asset")) return [];
  return state.userAssets.filter(asset => {
    const text = `${asset.Id ?? ""} ${asset.DisplayName ?? ""} ${asset.Kind ?? ""} ${(asset.Keywords ?? []).join(" ")}`;
    return matchesSearchText(text, query);
  });
}

function firstVisibleCommandButton() {
  const buttons = Array.from(document.querySelectorAll("#commandResults .command-result"));
  return buttons
    .find(button => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }) ?? buttons[0] ?? null;
}

function firstVisiblePaperPresetCard() {
  const cards = Array.from(document.querySelectorAll("[data-paper-preset-id]"));
  return cards
    .find(button => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }) ?? cards[0] ?? null;
}

function paperPresetsMatchingQueryIgnoringCategory() {
  const query = state.query.trim();
  if (!query) return paperStructurePresets;
  return paperStructurePresets.filter(preset => matchesSearchText(paperPresetSearchText(preset), query));
}

function preferredPaperPresetCard() {
  const query = normalizeSearchText(state.query);
  const presets = filteredPaperPresets();
  const exact = query
    ? presets.find(preset => normalizeSearchText(preset.title) === query)
    : null;
  const preset = exact ?? presets[0] ?? null;
  if (!preset) return firstVisiblePaperPresetCard();
  return document.querySelector(`[data-paper-preset-id="${preset.id}"]`) ?? firstVisiblePaperPresetCard();
}

function focusElementRepeatedly(getElement, enabled = true) {
  if (!enabled) return;
  const focus = () => getElement()?.focus({ preventScroll: true });
  focus();
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focus);
  window.setTimeout(focus, 60);
  window.setTimeout(focus, 180);
}

function focusFirstScopedSearchResult() {
  if (state.searchScope === "preset") {
    let presets = filteredPaperPresets();
    if (!presets.length && state.query.trim() && paperPresetsMatchingQueryIgnoringCategory().length) {
      resetPaperPresetCategory();
      render();
      presets = filteredPaperPresets();
    }
    if (!presets.length) return false;
    focusElementRepeatedly(preferredPaperPresetCard);
    setStatus("已聚焦匹配的论文图预设，按 Enter 可插入。");
    return true;
  }
  if (state.searchScope === "shape" && filteredItems().length) {
    focusElementRepeatedly(() => document.querySelector("#shapeGrid .shape-card"));
    setStatus("已聚焦第一个形状结果。");
    return true;
  }
  if (state.searchScope === "asset" && filteredAssets().length) {
    focusElementRepeatedly(() => document.querySelector("#userAssets .asset-card button, #userAssets .asset-select"));
    setStatus("已聚焦第一个素材结果。");
    return true;
  }
  if (state.searchScope === "chart" && filteredChartDatasets().length) {
    focusElementRepeatedly(() => document.querySelector("#zlkChartResults .chart-dataset-card"));
    setStatus("已聚焦第一个科研绘图数据集。");
    return true;
  }
  return false;
}

function focusAdjacentCommandButton(current, direction) {
  const buttons = Array.from(document.querySelectorAll("#commandResults .command-result"));
  if (!buttons.length) return false;
  const index = Math.max(0, buttons.indexOf(current));
  const nextIndex = (index + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus({ preventScroll: true });
  return true;
}

function focusEdgeCommandButton(index) {
  const buttons = Array.from(document.querySelectorAll("#commandResults .command-result"));
  if (!buttons.length) return false;
  buttons[index < 0 ? buttons.length - 1 : 0]?.focus({ preventScroll: true });
  return true;
}

function locateFirstCommandFromSearch(focusOnly = false) {
  if (focusFirstScopedSearchResult()) return true;
  const query = state.query.trim();
  const commands = searchScopeAllows("command") ? matchedCommands() : commandMatchesForQuery(query);
  const command = commands[0];
  if (!command) return false;
  if (!searchScopeAllows("command")) {
    state.searchScope = "command";
    persistSetting("roughPptSearchScope", state.searchScope);
    render();
    window.setTimeout(() => {
      if (focusOnly) {
        firstVisibleCommandButton()?.focus({ preventScroll: true });
      } else {
        activateCommandResult(command);
      }
    }, 100);
    return true;
  }
  const button = firstVisibleCommandButton();
  if (focusOnly) {
    button?.focus({ preventScroll: true });
    return Boolean(button);
  }
  activateCommandResult(command);
  return true;
}

function filteredItems() {
  if (!searchScopeAllows("shape")) return [];
  const q = state.query;
  return state.catalog
    .filter(item => {
      const categoryMatch = state.category === "all" || item.category === state.category;
      return categoryMatch && matchesSearchText(catalogSearchText(item), q);
    })
    .sort(sortItems);
}

function catalogSearchText(item) {
  return `${item.enumName} ${item.displayName} ${item.displayNameZh ?? ""} ${item.generationStrategy ?? ""} ${item.recipeId ?? ""} ${item.fidelity ?? ""} ${(item.keywords ?? []).join(" ")}`;
}

function matchesSearchText(text, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText(text);
  if (haystack.includes(normalizedQuery)) return true;
  const queryTokens = searchTokens(query);
  if (queryTokens.length && queryTokens.every(token => haystack.includes(token))) return true;
  return /[\u3400-\u9fff]/.test(normalizedQuery) &&
    normalizedQuery.length >= 2 &&
    fuzzySubsequenceMatch(normalizedQuery, haystack);
}

function createFunctionIcon(name, identity = "") {
  const icon = document.createElement("span");
  setFunctionIcon(icon, name, identity);
  return icon;
}

function createFunctionIconGlyph(name) {
  const glyph = document.createElement("span");
  glyph.className = "function-icon-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = functionIconGlyphs[name] || functionIconGlyphs.sparkles;
  return glyph;
}

function setFunctionIcon(holder, name, identity = "") {
  const iconName = functionIconGlyphs[name] ? name : "sparkles";
  holder.className = holder.className
    .split(/\s+/)
    .filter(className => className && className !== "button-icon")
    .join(" ");
  holder.classList.add("function-icon");
  holder.dataset.functionIcon = iconName;
  holder.dataset.functionIconKey = identity || iconName;
  holder.setAttribute("aria-hidden", "true");
  holder.textContent = "";
  holder.append(createFunctionIconGlyph(iconName));
}

function directIconHolder(element) {
  return Array.from(element?.children ?? [])
    .find(child => child.matches?.("span[aria-hidden='true'], .button-icon, .function-icon"));
}

function functionIconIdentityForTarget(target, fallback) {
  return target?.id ||
    target?.dataset?.commandShortcut ||
    target?.dataset?.starterAction ||
    target?.dataset?.sectionNav ||
    target?.dataset?.styleQuick ||
    target?.dataset?.paramGroupJump ||
    target?.getAttribute?.("aria-label") ||
    target?.title ||
    fallback ||
    "function";
}

function upgradeFunctionalIconTarget(target, name, identity = "") {
  if (!target) return;
  const holder = directIconHolder(target) || document.createElement("span");
  setFunctionIcon(holder, name, functionIconIdentityForTarget(target, identity || name));
  if (!holder.parentElement) target.prepend(holder);
}

function hydrateFunctionIcons(root = document) {
  for (const [selector, name, identity] of staticFunctionIconTargets) {
    for (const target of root.querySelectorAll(selector)) upgradeFunctionalIconTarget(target, name, identity || selector);
  }
  for (const [selector, name, identity] of staticFunctionIconHolders) {
    for (const holder of root.querySelectorAll(selector)) setFunctionIcon(holder, name, identity || selector);
  }
}

function commandFunctionIconName(command) {
  if (functionIconByCommandId[command.id]) return functionIconByCommandId[command.id];
  if (command.id?.startsWith("cmd-paper-")) return command.id.includes("matrix") || command.id.includes("volume") ? "feature" : "ai";
  return functionIconTextAliases[command.icon] || "sparkles";
}

function iconSpan(text) {
  const iconName = functionIconTextAliases[text];
  if (iconName) return createFunctionIcon(iconName, text);
  const icon = document.createElement("span");
  icon.className = "button-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = text;
  return icon;
}

function renderShapeCard(item) {
  const insertable = item.insertable !== false;
  const shell = document.createElement("div");
  shell.className = "shape-card-shell";
  const card = document.createElement("div");
  card.className = `shape-card${insertable ? "" : " disabled"}`;
  card.title = insertable
    ? `${displayName(item)}：点击插入 Rough.js 视觉的 PPT 原生可编辑对象（${item.enumName}）`
    : `${displayName(item)}：这是 PowerPoint 占位枚举，当前不能插入（${item.enumName}）`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", insertable ? `${displayName(item)}，插入 PPT 原生可编辑手绘对象` : `${displayName(item)}，当前不能插入`);
  if (!insertable) card.setAttribute("aria-disabled", "true");

  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-wrap";
  previewWrap.title = `${displayName(item)} 的 Rough.js 预览；实际插入为 PPT 原生 Freeform/Group`;
  const preview = document.createElement("canvas");
  preview.width = 160;
  preview.height = 96;
  previewWrap.append(preview);

  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = `favorite-toggle${isQuickShape(item.enumName) ? " active" : ""}`;
  favorite.textContent = isQuickShape(item.enumName) ? "已固定" : "固定";
  favorite.title = isQuickShape(item.enumName) ? "从快速插入栏移除此形状" : "固定到快速插入栏";
  favorite.setAttribute("aria-label", favorite.title);
  favorite.addEventListener("click", event => {
    event.stopPropagation();
    toggleQuickShape(item);
  });

  scheduleShapePreview(preview, item);

  const name = document.createElement("span");
  name.className = "shape-name";
  name.textContent = displayName(item);

  const meta = document.createElement("span");
  meta.className = "shape-meta";
  const markers = [
    categoryLabel(item.category),
    state.recent.includes(item.enumName) ? "最近" : "",
    isQuickShape(item.enumName) ? "常用" : ""
  ].filter(Boolean);
  meta.textContent = markers.join(" · ");
  meta.title = `PowerPoint 枚举：${item.enumName}；生成策略：${strategyLabel(item.generationStrategy)}；精度：${fidelityLabel(item.fidelity)}`;

  const chips = document.createElement("div");
  chips.className = "shape-chips";
  chips.append(
    chip(fidelityLabel(item.fidelity), fidelityLabel(item.fidelity), "几何生成精度：精确表示可直接插入，占位表示暂不插入")
  );

  card.append(previewWrap, name, meta, chips);
  card.addEventListener("click", () => {
    if (insertable) insertShape(item);
    else setStatus(`${displayName(item)} 是 PowerPoint 占位枚举，当前不能插入。`, true);
  });
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (insertable) insertShape(item);
    }
  });
  shell.append(card, favorite);
  return shell;
}

function chip(text, tone = "", title = "") {
  const element = document.createElement("span");
  element.className = `chip ${tone}`.trim();
  element.textContent = text;
  element.title = title || text;
  return element;
}

function drawPreview(canvas, item) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(16, 16);
  ctx.strokeStyle = state.params.stroke;
  ctx.globalAlpha = 1 - clamp01(state.params.strokeTransparency);
  ctx.lineWidth = state.params.strokeWidthPt;
  ctx.setLineDash(canvasDash(state.params.dashStyle));
  const size = item.defaultSizePt ?? {};
  const previewWidth = 120;
  const previewHeight = Math.max(28, Math.min(70, ((size.height || 80) / Math.max(1, size.width || 120)) * previewWidth));
  const drawable = generator.preview?.(item.enumName, previewWidth, previewHeight, state.params) ?? generator.generate(generator.kindFromMso(item.enumName), { width: previewWidth, height: previewHeight, ...state.params });
  for (const path of drawable.paths) {
    if (path.role === generator.pathRoles.hitArea) continue;
    ctx.beginPath();
    for (const segment of path.segments) {
      if (segment.type === "move") ctx.moveTo(segment.data[0], segment.data[1]);
      if (segment.type === "line") ctx.lineTo(segment.data[0], segment.data[1]);
      if (segment.type === "curve") ctx.bezierCurveTo(...segment.data);
    }
    if (path.closed && path.role === generator.pathRoles.innerFillBoundary && state.params.fillMode === "solid") {
      ctx.save();
      ctx.globalAlpha = 1 - clamp01(state.params.fillTransparency);
      ctx.fillStyle = state.params.fillColor;
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.globalAlpha = path.role === generator.pathRoles.texture
      ? 1 - clamp01(state.params.fillTransparency)
      : 1 - clamp01(state.params.strokeTransparency);
    ctx.strokeStyle = path.role === generator.pathRoles.texture ? (path.stroke ?? state.params.fillColor) : state.params.stroke;
    ctx.lineWidth = path.strokeWidthPt || state.params.strokeWidthPt;
    ctx.stroke();
  }
  ctx.restore();
}

function safeDrawPreview(canvas, item) {
  try {
    drawPreview(canvas, item);
  } catch {
    try {
      drawNativeIconPreview(canvas, item);
    } catch {
      // Preview canvas is optional; never abort taskpane render/host wiring.
    }
  }
}

function releaseGalleryIconObservers() {
  for (const observer of galleryIconObservers.values()) {
    try { observer.disconnect(); } catch {}
  }
  galleryIconObservers.clear();
}

function releaseShapePreviewObserver() {
  if (!shapePreviewObserver) return;
  try { shapePreviewObserver.disconnect(); } catch {}
  shapePreviewObserver = null;
}

function ensureShapePreviewObserver() {
  if (shapePreviewObserver || typeof IntersectionObserver !== "function") return shapePreviewObserver;
  shapePreviewObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const canvas = entry.target;
      const item = canvas.__roughPreviewItem;
      if (!item || canvas.dataset.previewDrawn === "1") {
        shapePreviewObserver.unobserve(canvas);
        continue;
      }
      safeDrawPreview(canvas, item);
      canvas.dataset.previewDrawn = "1";
      delete canvas.__roughPreviewItem;
      shapePreviewObserver.unobserve(canvas);
    }
  }, { root: els.grid || null, rootMargin: "80px 0px", threshold: 0.01 });
  return shapePreviewObserver;
}

function scheduleShapePreview(canvas, item) {
  if (!canvas || !item) return;
  canvas.dataset.previewDrawn = "0";
  canvas.__roughPreviewItem = item;
  const observer = ensureShapePreviewObserver();
  if (!observer) {
    safeDrawPreview(canvas, item);
    canvas.dataset.previewDrawn = "1";
    delete canvas.__roughPreviewItem;
    return;
  }
  observer.observe(canvas);
}

function galleryIconObserverKey(root) {
  return root || document;
}

function ensureGalleryIconObserver(root = null) {
  if (typeof IntersectionObserver !== "function") return null;
  const key = galleryIconObserverKey(root);
  let observer = galleryIconObservers.get(key);
  if (observer) return observer;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const canvas = entry.target;
      const item = canvas.__roughPreviewItem;
      if (!item || canvas.dataset.previewDrawn === "1") {
        observer.unobserve(canvas);
        continue;
      }
      safeDrawNativeIconPreview(canvas, item);
      canvas.dataset.previewDrawn = "1";
      delete canvas.__roughPreviewItem;
      observer.unobserve(canvas);
    }
  }, { root: root || null, rootMargin: "48px 0px", threshold: 0.01 });
  galleryIconObservers.set(key, observer);
  return observer;
}

function scheduleGalleryIconPreview(canvas, item, root = null) {
  if (!canvas || !item) return;
  canvas.dataset.previewDrawn = "0";
  canvas.__roughPreviewItem = item;
  const observer = ensureGalleryIconObserver(root);
  if (!observer) {
    safeDrawNativeIconPreview(canvas, item);
    canvas.dataset.previewDrawn = "1";
    delete canvas.__roughPreviewItem;
    return;
  }
  observer.observe(canvas);
}

function safeDrawNativeIconPreview(canvas, item) {
  try {
    drawNativeIconPreview(canvas, item);
  } catch {
    drawIconFallback(canvas, item);
  }
}

function drawIconFallback(canvas, item = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(8, 8);
  ctx.scale(11 / 6, 11 / 6);
  ctx.strokeStyle = "#242d37";
  ctx.fillStyle = "transparent";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const name = item.enumName || "";
  ctx.beginPath();
  if (/LineArrow|RightArrow|Arrow/i.test(name)) {
    ctx.moveTo(3, 20);
    ctx.lineTo(20, 5);
    ctx.moveTo(14, 5);
    ctx.lineTo(20, 5);
    ctx.lineTo(20, 11);
  } else if (/Line|Connector/i.test(name)) {
    ctx.moveTo(4, 20);
    ctx.lineTo(20, 6);
  } else if (/Oval|Ellipse|Sphere/i.test(name)) {
    ctx.ellipse(12, 12, 9, 9, 0, 0, Math.PI * 2);
  } else if (/Cylinder|Can/i.test(name)) {
    ctx.ellipse(12, 7, 9, 4, 0, 0, Math.PI * 2);
    ctx.moveTo(3, 7);
    ctx.lineTo(3, 18);
    ctx.ellipse(12, 18, 9, 4, 0, 0, Math.PI);
    ctx.moveTo(21, 7);
    ctx.lineTo(21, 18);
  } else if (/Cube|Stack|3d/i.test(name)) {
    ctx.moveTo(4, 9);
    ctx.lineTo(14, 4);
    ctx.lineTo(22, 8);
    ctx.lineTo(22, 18);
    ctx.lineTo(12, 22);
    ctx.lineTo(4, 18);
    ctx.closePath();
    ctx.moveTo(4, 9);
    ctx.lineTo(12, 13);
    ctx.lineTo(22, 8);
    ctx.moveTo(12, 13);
    ctx.lineTo(12, 22);
  } else if (/Rounded|Round/i.test(name)) {
    roundRectPath(ctx, 4, 5, 18, 16, 4);
  } else {
    ctx.rect(4, 5, 16, 15);
  }
  ctx.stroke();
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawNativeIconPreview(canvas, item) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(8, 8);
  ctx.scale(11 / 6, 11 / 6);
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "transparent";
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const size = item.defaultSizePt ?? {};
  const width = 24;
  const height = Math.max(6, Math.min(24, ((size.height || 80) / Math.max(1, size.width || 120)) * width));
  const top = (24 - height) / 2;
  const drawable = generator.preview?.(item.enumName, width, height, { ...state.params, roughness: 0, bowing: 0, strokeWidthPt: 1.5 }) ??
    generator.generate(generator.kindFromMso(item.enumName), { width, height, ...state.params, roughness: 0, bowing: 0, strokeWidthPt: 1.5 });
  const visiblePaths = iconVisiblePaths(drawable);
  for (const path of visiblePaths) {
    ctx.beginPath();
    tracePath(ctx, path, top);
    ctx.stroke();
  }
  ctx.restore();
}

function iconVisiblePaths(drawable) {
  const roles = generator.pathRoles;
  const visiblePaths = (drawable.paths ?? []).filter(path =>
    path.role !== roles.hitArea &&
    path.role !== roles.innerFillBoundary);
  if (visiblePaths.length) return visiblePaths;
  return (drawable.paths ?? []).filter(path => path.role !== roles.hitArea);
}

function tracePath(ctx, path, yOffset = 0) {
  for (const segment of path.segments) {
    if (segment.type === "move") ctx.moveTo(segment.data[0], segment.data[1] + yOffset);
    if (segment.type === "line") ctx.lineTo(segment.data[0], segment.data[1] + yOffset);
    if (segment.type === "curve") {
      const data = [...segment.data];
      data[1] += yOffset;
      data[3] += yOffset;
      data[5] += yOffset;
      ctx.bezierCurveTo(...data);
    }
  }
  if (path.closed) ctx.closePath();
}

function filteredPaperPresets() {
  if (!searchScopeAllows("preset")) return [];
  const query = state.query.trim();
  const selectedCategory = paperPresetCategories.some(category => category.id === state.paperPresetCategory)
    ? state.paperPresetCategory
    : "all";
  const matches = [];
  paperStructurePresets.forEach((preset, index) => {
    if (!paperPresetMatchesCategory(preset, selectedCategory)) return;
    if (!query) {
      matches.push({ preset, score: 0, index });
      return;
    }
    if (!matchesSearchText(paperPresetSearchText(preset), query)) return;
    matches.push({ preset, score: paperPresetMatchScore(preset, query), index });
  });
  if (!query) {
    return matches
      .sort((left, right) => paperPresetCategoryRank(left.preset, selectedCategory) - paperPresetCategoryRank(right.preset, selectedCategory) || left.index - right.index)
      .map(match => match.preset);
  }
  return matches
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(match => match.preset);
}

function paperPresetCategoryRank(preset, categoryId) {
  if (categoryId === "recommended") {
    const index = recommendedPaperPresetIds.indexOf(preset.id);
    return index < 0 ? 10000 : index;
  }
  if (categoryId === "recent") {
    const index = state.recentPaperPresets.indexOf(preset.id);
    return index < 0 ? 10000 : index;
  }
  if (categoryId === "favorites") {
    const index = state.favoritePaperPresets.indexOf(preset.id);
    return index < 0 ? 10000 : index;
  }
  return 10000;
}

function paperPresetMatchesCategory(preset, categoryId) {
  if (categoryId === "all") return true;
  if (categoryId === "recommended") return recommendedPaperPresetIds.includes(preset.id);
  if (categoryId === "recent") return state.recentPaperPresets.includes(preset.id);
  if (categoryId === "favorites") return state.favoritePaperPresets.includes(preset.id);
  return preset.category === categoryId;
}

function paperPresetCategoryCount(categoryId) {
  return paperStructurePresets.filter(preset => paperPresetMatchesCategory(preset, categoryId)).length;
}

function isFavoritePaperPreset(presetId) {
  return state.favoritePaperPresets.includes(presetId);
}

function toggleFavoritePaperPreset(preset) {
  if (!preset?.id) return;
  if (isFavoritePaperPreset(preset.id)) {
    state.favoritePaperPresets = state.favoritePaperPresets.filter(id => id !== preset.id);
    setStatus(`已从常用论文预设移除：${preset.title}`);
  } else {
    state.favoritePaperPresets = [preset.id, ...state.favoritePaperPresets.filter(id => id !== preset.id)].slice(0, 16);
    setStatus(`已固定常用论文预设：${preset.title}`);
  }
  persistSetting("roughPptFavoritePaperPresets", JSON.stringify(state.favoritePaperPresets));
  renderPaperPresetFilters();
  renderPaperPresets();
}

function rememberRecentPaperPreset(preset) {
  if (!preset?.id) return;
  state.recentPaperPresets = [preset.id, ...state.recentPaperPresets.filter(id => id !== preset.id)].slice(0, 12);
  persistSetting("roughPptRecentPaperPresets", JSON.stringify(state.recentPaperPresets));
}

function paperPresetEmptyInfo(categoryId) {
  if (categoryId === "recent") {
    return {
      title: "还没有最近使用的论文图预设。",
      detail: "点击任意预设卡插入后会自动进入最近使用；此操作不会直接修改当前幻灯片。",
      action: "显示推荐预设",
      targetCategory: "recommended"
    };
  }
  if (categoryId === "favorites") {
    return {
      title: "尚未固定常用论文图预设。",
      detail: "点击预设卡右上角星标即可固定到常用；星标只保存本机偏好，不会插入 PPT。",
      action: "显示推荐预设",
      targetCategory: "recommended"
    };
  }
  if (categoryId === "recommended") {
    return {
      title: "推荐论文图预设暂不可用。",
      detail: "可切回全部分类查看完整预设库。",
      action: "显示全部预设",
      targetCategory: "all"
    };
  }
  return {
    title: "没有匹配当前条件的论文图预设。",
    detail: categoryId === "all"
      ? "可搜索智能模型、多模态、医学图像报告、分类头、诊断头、分割流程等关键词。"
      : "当前分类可能隐藏了相关预设，可一键切回全部分类。",
    action: "显示全部预设",
    targetCategory: "all"
  };
}

function paperPresetStateLabels(preset) {
  const labels = [];
  if (recommendedPaperPresetIds.includes(preset.id)) labels.push("推荐");
  if (state.recentPaperPresets.includes(preset.id)) labels.push("最近");
  if (state.favoritePaperPresets.includes(preset.id)) labels.push("常用");
  return labels;
}

function paperPresetSearchText(preset) {
  const category = paperPresetCategories.find(item => item.id === preset.category);
  const categoryText = category ? `${category.label} ${category.title} ${(category.keywords ?? []).join(" ")}` : "";
  return `${preset.title} ${preset.detail} ${categoryText} ${paperPresetDiscoveryKeywords.join(" ")} AI医学结构 通用示意 非复刻 ${(preset.tags ?? []).join(" ")} ${(preset.keywords ?? []).join(" ")}`;
}

function paperPresetSpecificSearchText(preset) {
  const category = paperPresetCategories.find(item => item.id === preset.category);
  const categoryText = category ? `${category.label} ${category.title} ${(category.keywords ?? []).join(" ")}` : "";
  return `${preset.title} ${preset.detail} ${categoryText} ${(preset.tags ?? []).join(" ")} ${(preset.keywords ?? []).join(" ")}`;
}

function paperPresetMatchScore(preset, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const title = normalizeSearchText(preset.title);
  const detail = normalizeSearchText(preset.detail);
  const tagTexts = (preset.tags ?? []).map(normalizeSearchText);
  const keywordTexts = (preset.keywords ?? []).map(normalizeSearchText);
  const category = paperPresetCategories.find(item => item.id === preset.category);
  const categoryText = normalizeSearchText(`${category?.label ?? ""} ${category?.title ?? ""} ${(category?.keywords ?? []).join(" ")}`);
  let score = 0;
  if (title === normalizedQuery) score = Math.max(score, 260);
  if (title.includes(normalizedQuery) || normalizedQuery.includes(title)) score = Math.max(score, 190);
  if (detail.includes(normalizedQuery)) score = Math.max(score, 90);
  for (const text of keywordTexts) {
    if (text === normalizedQuery) score = Math.max(score, 210);
    else if (text.includes(normalizedQuery) || normalizedQuery.includes(text)) score = Math.max(score, 155);
  }
  for (const text of tagTexts) {
    if (text === normalizedQuery) score = Math.max(score, 130);
    else if (text.includes(normalizedQuery) || normalizedQuery.includes(text)) score = Math.max(score, 105);
  }
  if (categoryText.includes(normalizedQuery)) score = Math.max(score, 80);
  const specificHaystack = normalizeSearchText(paperPresetSpecificSearchText(preset));
  const tokens = searchTokens(normalizedQuery);
  if (tokens.length) {
    const matched = tokens.filter(token => specificHaystack.includes(token)).length;
    if (matched) score = Math.max(score, Math.round(35 + (matched / tokens.length) * 45));
  }
  if (normalizedQuery.length >= 2 && fuzzySubsequenceMatch(normalizedQuery, specificHaystack)) score = Math.max(score, 45);
  if (!score && paperPresetDiscoveryKeywords.some(keyword => normalizeSearchText(keyword) === normalizedQuery)) score = 20;
  return score;
}

function renderPaperPresetFilters() {
  if (!els.paperPresetFilters) return;
  els.paperPresetFilters.innerHTML = "";
  if (!paperPresetCategories.some(category => category.id === state.paperPresetCategory)) {
    state.paperPresetCategory = "all";
  }
  for (const category of paperPresetCategories) {
    const count = paperPresetCategoryCount(category.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "paper-preset-filter";
    button.setAttribute("data-paper-preset-category", category.id);
    button.setAttribute("aria-pressed", category.id === state.paperPresetCategory ? "true" : "false");
    button.title = `${category.title}，当前分类包含 ${count} 个预设；点击只筛选卡片，不会插入 PPT。`;
    const label = document.createElement("span");
    label.textContent = category.label;
    const badge = document.createElement("small");
    badge.textContent = String(count);
    button.append(label, badge);
    button.addEventListener("click", () => {
      state.paperPresetCategory = category.id;
      persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
      resetResourceRenderWindows("preset");
      renderPaperPresetFilters();
      renderPaperPresets();
      setStatus(`已筛选论文图预设：${category.label}`);
    });
    els.paperPresetFilters.append(button);
  }
}

function renderPaperPresets() {
  if (!els.paperPresetGrid) return;
  const presets = filteredPaperPresets();
  if (els.paperPresetCount) {
    setSummaryBadge(
      els.paperPresetCount,
      `${presets.length} 个`,
      `当前显示 ${presets.length} 个可插入论文图结构预设`,
      presets.length ? "ok" : "idle"
    );
  }
  els.paperPresetGrid.innerHTML = "";
  if (!presets.length) {
    const emptyInfo = paperPresetEmptyInfo(state.paperPresetCategory);
    const empty = document.createElement("div");
    empty.className = "paper-preset-empty";
    const title = document.createElement("strong");
    title.textContent = emptyInfo.title;
    title.title = emptyInfo.title;
    const detail = document.createElement("span");
    detail.textContent = emptyInfo.detail;
    detail.title = "提示当前无结果的可能原因和恢复方式";
    const actions = document.createElement("div");
    actions.className = "paper-preset-empty-actions";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = emptyInfo.action;
    reset.title = `${emptyInfo.action}，只改变预设卡片显示，不会插入或修改 PPT`;
    reset.addEventListener("click", () => {
      state.query = "";
      if (els.search) els.search.value = "";
      state.paperPresetCategory = emptyInfo.targetCategory;
      persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
      state.searchScope = "preset";
      persistSetting("roughPptSearchScope", state.searchScope);
      render();
      els.paperPresetGrid?.focus({ preventScroll: true });
      setStatus(emptyInfo.targetCategory === "recommended" ? "已显示推荐论文图预设。" : "已显示全部论文图预设。");
    });
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "显示全部预设";
    allBtn.title = "切回全部分类并显示完整论文图预设库，不会插入 PPT";
    allBtn.hidden = emptyInfo.targetCategory === "all";
    allBtn.addEventListener("click", () => {
      state.query = "";
      if (els.search) els.search.value = "";
      state.paperPresetCategory = "all";
      persistSetting("roughPptPaperPresetCategory", state.paperPresetCategory);
      state.searchScope = "preset";
      persistSetting("roughPptSearchScope", state.searchScope);
      render();
      setStatus("已显示全部论文图预设。");
    });
    actions.append(reset);
    if (!allBtn.hidden) actions.append(allBtn);
    empty.append(title, detail, actions);
    empty.title = "可搜索智能模型、多模态、医学图像报告、分类头、诊断头、分割流程等关键词，也可显示全部预设";
    els.paperPresetGrid.append(empty);
    return;
  }
  const visibleCount = Math.max(resourceBatchFor(PAPER_PRESET_RENDER_BATCH), state.paperPresetVisibleCount || resourceBatchFor(PAPER_PRESET_RENDER_BATCH));
  const visiblePresets = presets.slice(0, visibleCount);
  for (const preset of visiblePresets) {
    els.paperPresetGrid.append(renderPaperPresetCard(preset));
  }
  if (presets.length > visiblePresets.length) {
    els.paperPresetGrid.append(renderResourceLoadMore("预设", presets.length - visiblePresets.length, "继续显示论文图结构预设卡片", () => {
      state.paperPresetVisibleCount = Math.min(presets.length, visibleCount + resourceBatchFor(PAPER_PRESET_RENDER_BATCH));
      renderPaperPresets();
    }));
  }
}

function renderPaperPresetCard(preset) {
  const card = document.createElement("div");
  card.id = `paperPreset-${preset.id}`;
  card.className = "paper-preset-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.dataset.paperPresetId = preset.id;
  card.style.setProperty("--preset-color", preset.color || "#2563eb");
  card.title = `${preset.title}：点击插入 PPT 原生可编辑组合图。${preset.detail} 通用示意，非复刻单篇论文图。`;
  card.setAttribute("aria-label", card.title);

  const favorite = document.createElement("button");
  favorite.type = "button";
  const favorited = isFavoritePaperPreset(preset.id);
  favorite.className = `paper-preset-favorite${favorited ? " active" : ""}`;
  favorite.textContent = favorited ? "取消常用" : "设为常用";
  favorite.setAttribute("aria-pressed", favorited ? "true" : "false");
  favorite.title = favorited
    ? `从常用论文预设移除：${preset.title}`
    : `固定到常用论文预设：${preset.title}`;
  favorite.setAttribute("aria-label", favorite.title);
  favorite.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoritePaperPreset(preset);
  });

  const icon = document.createElement("span");
  icon.className = "paper-preset-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = preset.icon || "\u25a6";

  const mini = document.createElement("span");
  mini.className = `paper-preset-mini ${preset.id}`;
  mini.setAttribute("aria-hidden", "true");
  mini.append(...paperPresetMiniNodes(preset));

  const copy = document.createElement("span");
  copy.className = "paper-preset-copy";
  const title = document.createElement("strong");
  title.textContent = preset.title;
  const detail = document.createElement("small");
  detail.textContent = preset.detail;
  const tags = document.createElement("span");
  tags.className = "paper-preset-tags";
  tags.textContent = (preset.tags ?? []).join(" · ");
  tags.title = "预设关键词：" + (preset.tags ?? []).join("、");
  const states = document.createElement("span");
  states.className = "paper-preset-state-labels";
  for (const labelText of paperPresetStateLabels(preset)) {
    const label = document.createElement("span");
    label.textContent = labelText;
    label.title = `${preset.title} 属于${labelText}论文预设`;
    states.append(label);
  }
  copy.append(title, detail, states, tags);

  card.append(favorite, icon, mini, copy);
  card.addEventListener("click", () => insertPaperPreset(preset));
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    insertPaperPreset(preset);
  });
  return card;
}

function paperPresetMiniNodes(preset) {
  const flowCount = preset.id === "multimodalFusion" || preset.id === "contrastiveDualTower" || preset.id === "largeModelRag" ? 3 : 2;
  const nodes = [];
  for (let lane = 0; lane < flowCount; lane += 1) {
    const row = document.createElement("span");
    row.className = "paper-preset-mini-row";
    for (let step = 0; step < 4; step += 1) {
      const node = document.createElement("span");
      node.className = step === 2 ? "paper-preset-mini-node wide" : "paper-preset-mini-node";
      row.append(node);
      if (step < 3) {
        const line = document.createElement("span");
        line.className = "paper-preset-mini-line";
        row.append(line);
      }
    }
    nodes.push(row);
  }
  return nodes;
}

function insertPaperPreset(preset) {
  if (!preset?.id) return;
  setStatus(`正在插入论文图预设：${preset.title}...`);
  rememberRecentPaperPreset(preset);
  renderPaperPresetFilters();
  postHost({
    type: "insertPaperPreset",
    presetId: preset.id,
    displayName: preset.title
  });
}

function insertShape(item) {
  rememberRecent(item.enumName);
  setStatus(`已发送插入请求：${displayName(item)}`);
  postHost({
    type: "insertShape",
    enumName: item.enumName,
    displayName: displayName(item),
    size: item.defaultSizePt ?? null,
    params: currentInsertParams()
  });
}

function filteredAssets() {
  if (!searchScopeAllows("asset")) return [];
  return state.userAssets.filter(asset => {
    const text = `${asset.Id ?? ""} ${asset.DisplayName ?? ""} ${asset.Kind ?? ""} ${(asset.Keywords ?? []).join(" ")}`;
    return matchesSearchText(text, state.query);
  });
}

function filteredChartDatasets() {
  if (!searchScopeAllows("chart")) return [];
  const query = state.query.trim();
  if (!query) return state.chartDatasets;
  return state.chartDatasets.filter(dataset => {
    const text = [
      dataset.source?.path,
      dataset.source?.kind,
      dataset.source?.type,
      ...(dataset.recommendations ?? []).map(item => `${item.title} ${item.chartType} ${item.reason}`),
      ...(dataset.points ?? []).slice(0, 40).map(point => `${point.method} ${point.dataset} ${point.metric} ${point.subgroup} ${point.error_type}`)
    ].join(" ");
    return matchesSearchText(text, query);
  });
}

function resetResourceRenderWindows(scope = "all") {
  const scopes = Array.isArray(scope) ? scope : [scope];
  const all = scopes.includes("all");
  if (all || scopes.includes("chart")) state.chartDatasetVisibleCount = CHART_DATASET_RENDER_BATCH;
  if (all || scopes.includes("zotero")) state.zoteroImageVisibleCount = ZOTERO_IMAGE_RENDER_BATCH;
  if (all || scopes.includes("palette")) state.paletteSchemeVisibleCount = PALETTE_SCHEME_RENDER_BATCH;
  if (all || scopes.includes("shape")) state.shapeCardVisibleCount = SHAPE_CARD_RENDER_BATCH;
  if (all || scopes.includes("preset")) state.paperPresetVisibleCount = PAPER_PRESET_RENDER_BATCH;
  if (all || scopes.includes("asset")) state.userAssetVisibleCount = USER_ASSET_RENDER_BATCH;
}

function renderResourceLoadMore(label, hiddenCount, title, onClick) {
  const wrap = document.createElement("div");
  wrap.className = "resource-load-more-wrap";
  wrap.title = `${title}；分批显示可避免一次渲染大量缩略图或卡片导致卡顿`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "resource-load-more";
  button.textContent = `显示更多${label}（剩余 ${hiddenCount}）`;
  button.title = `${title}；分批显示可避免一次渲染大量缩略图或卡片导致卡顿`;
  button.addEventListener("click", onClick);
  const hint = document.createElement("span");
  hint.className = "resource-load-more-hint";
  hint.textContent = "分批加载，降低卡顿";
  hint.title = "不会一次渲染全部卡片，点击后仅追加下一批";
  wrap.append(button, hint);
  return wrap;
}


const RESEARCH_CHART_PRESETS = [
  {
    id: "leaderboardBar",
    chartType: "leaderboardBar",
    kind: "bar",
    title: "排行榜柱状图",
    summary: "比较不同方法或模型的主指标高低",
    tooltip: "适合 method × metric 排行。常见于模型对比表转图，一眼看出最优方法。",
    needs: ["method/metric", "value 或 mean"]
  },
  {
    id: "meanStdErrorBar",
    chartType: "meanStdErrorBar",
    kind: "error",
    title: "均值误差图",
    summary: "展示 mean±std 或置信区间稳定性",
    tooltip: "适合多次 seed/fold 的平均性能。误差线帮助判断是否只是偶然领先。",
    needs: ["mean", "std 或 ci"]
  },
  {
    id: "sensitivityCurve",
    chartType: "sensitivityCurve",
    kind: "curve",
    title: "敏感性曲线",
    summary: "参数变化时指标如何升降",
    tooltip: "适合 threshold、lambda、missing_rate、epoch 等横轴。用来展示模型对超参是否稳健。",
    needs: ["参数横轴", "value/mean"]
  },
  {
    id: "scatterPlot",
    chartType: "scatterPlot",
    kind: "scatter",
    title: "散点对比图",
    summary: "两个连续指标的点分布与相关趋势",
    tooltip: "适合 accuracy vs latency、precision vs recall、AUROC vs 参数量等二维权衡。每个点通常是一个方法或配置。",
    needs: ["两个数值字段", "method 可选"]
  },
  {
    id: "subgroupComparison",
    chartType: "subgroupComparison",
    kind: "bar",
    title: "亚组对比图",
    summary: "按性别、年龄、站点等亚组比较",
    tooltip: "适合 fairness / domain shift 分析。可快速看到某亚组是否明显掉点。",
    needs: ["subgroup", "value/mean"]
  },
  {
    id: "caseLevelDistribution",
    chartType: "caseLevelDistribution",
    kind: "curve",
    title: "病例级分布",
    summary: "病例或样本级指标的走势/分布",
    tooltip: "适合 case_id/patient_id 级结果。用于检查长尾失败，而不是只看平均值。",
    needs: ["case_id/patient_id", "value"]
  }
];

function currentChartPreset() {
  return RESEARCH_CHART_PRESETS.find(item => item.id === state.selectedChartPresetId) || RESEARCH_CHART_PRESETS[0];
}

const simpleWorkflowPanelKeys = Object.freeze([
  "selection",
  "style",
  "charts",
  "catalog",
  "paperPresets",
  "zoteroImages",
  "featureBlock",
  "library"
]);

const defaultCollapsedPanelKeys = new Set(["featureBlock", "library", "paperPresets", "zoteroImages"]);

function panelForCollapseKey(key) {
  return document.querySelector(`[data-collapse-key="${key}"]`);
}

function setSimpleActivePanel(key, { persist = true } = {}) {
  if (state.uiMode !== "simple") return;
  let activeKey = simpleWorkflowPanelKeys.includes(key) ? key : "";
  if (activeKey && !panelAvailableInCurrentContext(activeKey)) {
    activeKey = document.body.dataset.selectionKind === "feature" ? "featureBlock" : "selection";
  }
  for (const panelKey of simpleWorkflowPanelKeys) {
    const panel = panelForCollapseKey(panelKey);
    const button = panel?.querySelector(".collapse-toggle");
    if (!panel || !button) continue;
    setPanelCollapsed(panel, button, panelKey !== activeKey);
  }
  if (persist) persistSetting("roughPptSimpleActivePanel", activeKey || "none");
}

function applySimplePanelLayout() {
  const saved = localStorage.getItem("roughPptSimpleActivePanel");
  const kind = document.body.dataset.selectionKind || "none";
  const activeKey = kind === "feature"
    ? "featureBlock"
    : saved === "none" ? "" : simpleWorkflowPanelKeys.includes(saved) ? saved : "selection";
  setSimpleActivePanel(activeKey, { persist: false });
}

function syncSimplePanelForSelection(kind, previousKind = kind) {
  if (state.uiMode !== "simple") return;
  const activeKey = simpleWorkflowPanelKeys.find(key => {
    const panel = panelForCollapseKey(key);
    return panel && !panel.classList.contains("collapsed");
  }) || "";
  if (kind === "feature") {
    setSimpleActivePanel("featureBlock", { persist: false });
    return;
  }
  if ((kind === "normal" || kind === "rough") && kind !== previousKind) {
    setSimpleActivePanel("style", { persist: false });
    return;
  }
  if (kind === "none" && kind !== previousKind) {
    setSimpleActivePanel("selection", { persist: false });
    return;
  }
  if (activeKey === "featureBlock" || (kind === "none" && activeKey === "style")) {
    setSimpleActivePanel("selection", { persist: false });
  }
}

function restoreFullPanelLayout() {
  for (const key of simpleWorkflowPanelKeys) {
    const panel = panelForCollapseKey(key);
    const button = panel?.querySelector(".collapse-toggle");
    if (!panel || !button) continue;
    const saved = localStorage.getItem(`roughPptCollapsed:${key}`);
    setPanelCollapsed(panel, button, saved == null ? defaultCollapsedPanelKeys.has(key) : saved === "true");
  }
}

function syncStyleSectionsForUiMode(mode = state.uiMode) {
  if (!els.params) return;
  for (const section of els.params.querySelectorAll("details.param-section")) {
    const group = section.dataset.paramGroup || "";
    if (mode === "simple") {
      section.open = group === "常用";
    }
  }
}

function syncChartPresetDisclosureForUiMode(mode = state.uiMode) {
  if (!els.chartPresetShell) return;
  els.chartPresetShell.open = mode === "full" || state.chartDatasets.length > 0;
}

function applyUiMode(mode = state.uiMode, { persist = true } = {}) {
  const next = mode === "full" ? "full" : "simple";
  state.uiMode = next;
  document.body.classList.toggle("ux-simple", next === "simple");
  document.body.classList.toggle("ux-full", next === "full");
  if (els.uiModeSimple) {
    els.uiModeSimple.classList.toggle("is-active", next === "simple");
    els.uiModeSimple.setAttribute("aria-pressed", String(next === "simple"));
  }
  if (els.uiModeFull) {
    els.uiModeFull.classList.toggle("is-active", next === "full");
    els.uiModeFull.setAttribute("aria-pressed", String(next === "full"));
  }
  const modeSwitch = document.querySelector("#simpleModeFullSwitch");
  if (modeSwitch) {
    const label = modeSwitch.querySelector("span:last-child");
    if (label) label.textContent = next === "full" ? "简洁模式" : "完整模式";
    modeSwitch.title = next === "full"
      ? "切换到简洁模式：只显示当前选区状态或正在使用的单个工作区"
      : "切换到完整模式：显示全部专业面板";
    modeSwitch.setAttribute("aria-label", modeSwitch.title);
  }
  if (persist) persistSetting("roughPptUiMode", next);
  syncStyleSectionsForUiMode(next);
  if (next === "simple") applySimplePanelLayout();
  else restoreFullPanelLayout();
  syncChartPresetDisclosureForUiMode(next);
  refreshContextualSearchUi();
  renderBuildInfo();
  updateStickyChromeMetrics();
}

function initUsageGuideNavigation() {
  const guideLink = document.querySelector("#usageGuide");
  guideLink?.addEventListener("click", event => {
    writeSessionSetting(GUIDE_RETURN_SCROLL_KEY, String(Math.round(window.scrollY)));
    if (!describeHostConnection()) return;
    event.preventDefault();
    postHost({ type: "openUsageGuide" });
  });
  const restoreScroll = () => {
    const stored = readSessionSetting(GUIDE_RETURN_SCROLL_KEY);
    if (stored == null) return;
    const saved = Number(stored);
    if (!Number.isFinite(saved) || saved < 0) return;
    const apply = () => window.scrollTo(0, saved);
    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
    for (const delay of [50, 150, 300]) window.setTimeout(apply, delay);
    window.setTimeout(() => {
      if (readSessionSetting(GUIDE_RETURN_SCROLL_KEY) === stored) {
        removeSessionSetting(GUIDE_RETURN_SCROLL_KEY);
      }
    }, 360);
  };
  window.addEventListener("pageshow", restoreScroll);
  window.addEventListener("popstate", restoreScroll);
  restoreScroll();
}

function openResearchChartStudio() {
  if (!describeHostConnection()) {
    setStatus("当前页面未连接 PowerPoint，无法打开科研绘图工作区。", true);
    return;
  }
  setStatus("正在打开本地科研绘图工作区。");
  postHost({ type: "openResearchChartStudio" });
}

function samplePointsForPreset(preset, dataset = null) {
  const points = Array.isArray(dataset && dataset.points) ? dataset.points.filter(p => Number.isFinite(Number(p.value ?? p.mean))) : [];
  if (points.length) {
    return points.slice(0, 12).map((p, index) => ({
      label: String(p.method || p.metric || p.subgroup || p.case_id || p.patient_id || ("#" + (index + 1))),
      x: Number(p.x ?? p.threshold ?? p.lambda ?? p.epoch ?? p.step ?? index),
      y: Number(p.value ?? p.mean ?? 0),
      err: Number(p.std ?? p.ci ?? 0),
      y2: Number(p.y2 ?? p.secondary ?? p.latency ?? p.time ?? p.param_count ?? (Number(p.value ?? p.mean ?? 0) * 0.8 + index))
    }));
  }
  return [
    { label: "A", x: 0, y: 0.72, err: 0.04, y2: 0.40 },
    { label: "B", x: 1, y: 0.81, err: 0.03, y2: 0.55 },
    { label: "C", x: 2, y: 0.76, err: 0.05, y2: 0.48 },
    { label: "D", x: 3, y: 0.88, err: 0.02, y2: 0.62 },
    { label: "E", x: 4, y: 0.84, err: 0.03, y2: 0.70 },
    { label: "F", x: 5, y: 0.91, err: 0.02, y2: 0.58 }
  ];
}

function buildMiniPlotDom(preset, points) {
  const wrap = document.createElement("div");
  wrap.className = "chart-mini-plot-canvas";
  wrap.title = preset.tooltip;
  const ys = points.map(p => p.y);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 1);
  const span = Math.max(1e-6, yMax - yMin);
  const n = Math.max(1, points.length);

  if (preset.kind === "bar" || preset.kind === "error") {
    wrap.classList.add("is-bars");
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const bar = document.createElement("span");
      bar.className = "chart-mini-bar";
      const h = ((p.y - yMin) / span) * 100;
      bar.style.height = Math.max(8, h) + "%";
      bar.title = p.label + ": " + p.y;
      if (preset.kind === "error" && p.err) {
        const err = document.createElement("i");
        err.className = "chart-mini-error";
        err.style.setProperty("--err", Math.min(28, Math.abs(p.err) / span * 100) + "%");
        bar.append(err);
      }
      wrap.append(bar);
    }
    return wrap;
  }

  if (preset.kind === "scatter") {
    wrap.classList.add("is-scatter");
    const xs = points.map((p, i) => Number.isFinite(p.y2) ? p.y2 : (Number.isFinite(p.x) ? p.x : i));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const xSpan = Math.max(1e-6, xMax - xMin);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const xVal = Number.isFinite(p.y2) ? p.y2 : (Number.isFinite(p.x) ? p.x : i);
      const dot = document.createElement("span");
      dot.className = "chart-mini-dot";
      dot.style.left = (((xVal - xMin) / xSpan) * 100) + "%";
      dot.style.bottom = (((p.y - yMin) / span) * 100) + "%";
      dot.title = p.label + ": " + p.y;
      wrap.append(dot);
    }
    return wrap;
  }

  wrap.classList.add("is-curve");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("chart-mini-curve");
  svg.setAttribute("viewBox", "0 0 100 60");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const left = 6;
  const right = 94;
  const top = 6;
  const bottom = 54;
  const curvePoints = points.map((point, index) => {
    const value = Number.isFinite(point.y) ? point.y : yMin;
    const x = left + (index / Math.max(1, n - 1)) * (right - left);
    const y = bottom - ((value - yMin) / span) * (bottom - top);
    return { point, x, y: Math.min(bottom, Math.max(top, y)) };
  });
  const line = document.createElementNS(svgNamespace, "polyline");
  line.classList.add("chart-mini-curve-line");
  line.setAttribute("points", curvePoints.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "));
  svg.append(line);
  for (const { point, x, y } of curvePoints) {
    const dot = document.createElementNS(svgNamespace, "circle");
    dot.classList.add("chart-mini-curve-dot");
    dot.setAttribute("cx", x.toFixed(2));
    dot.setAttribute("cy", y.toFixed(2));
    dot.setAttribute("r", "2.2");
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = point.label + ": " + point.y;
    dot.append(title);
    svg.append(dot);
  }
  wrap.append(svg);
  return wrap;
}

function renderChartPresetStrip() {
  if (!els.chartPresetStrip) return;
  initHorizontalDragScroll();
  const active = currentChartPreset();
  els.chartPresetStrip.innerHTML = "";
  els.chartPresetStrip.dataset.activePreset = active.id;
  els.chartPresetStrip.setAttribute("aria-label", `${active.title}：${active.tooltip}`);
  for (const preset of RESEARCH_CHART_PRESETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chart-preset-card" + (preset.id === active.id ? " is-active" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(preset.id === active.id));
    btn.title = preset.title + "：" + preset.tooltip;
    const thumb = document.createElement("span");
    thumb.className = "chart-preset-thumb";
    thumb.dataset.kind = preset.kind;
    thumb.title = preset.tooltip;
    const title = document.createElement("strong");
    title.textContent = preset.title;
    title.title = preset.tooltip;
    const summary = document.createElement("small");
    summary.textContent = preset.summary;
    summary.title = "需要字段：" + preset.needs.join("、") + "。" + preset.tooltip;
    btn.append(thumb, title, summary);
    btn.addEventListener("click", () => {
      state.selectedChartPresetId = preset.id;
      persistSetting("roughPptChartPresetId", preset.id);
      renderChartPresetStrip();
      renderChartPresetPreview();
      setStatus("已选择科研图预设：" + preset.title);
    });
    els.chartPresetStrip.append(btn);
  }
  renderChartPresetPreview();
  const activeCard = els.chartPresetStrip.querySelector(".chart-preset-card.is-active");
  if (activeCard) {
    const cardLeft = activeCard.offsetLeft;
    const cardRight = cardLeft + activeCard.offsetWidth;
    const visibleLeft = els.chartPresetStrip.scrollLeft;
    const visibleRight = visibleLeft + els.chartPresetStrip.clientWidth;
    if (cardLeft < visibleLeft) {
      els.chartPresetStrip.scrollLeft = Math.max(0, cardLeft - 4);
    } else if (cardRight > visibleRight) {
      els.chartPresetStrip.scrollLeft = Math.min(
        Math.max(0, els.chartPresetStrip.scrollWidth - els.chartPresetStrip.clientWidth),
        cardRight - els.chartPresetStrip.clientWidth + 4
      );
    }
  }
}


function renderChartPresetPreview() {
  if (!els.chartPresetPreview) return;
  const preset = currentChartPreset();
  const dataset = (state.chartDatasets || []).find(ds => (ds.points && ds.points.length) > 0) || state.chartDatasets?.[0] || null;
  const usingData = !!(dataset && dataset.points && dataset.points.length);
  const points = samplePointsForPreset(preset, dataset);
  els.chartPresetPreview.innerHTML = "";
  const head = document.createElement("div");
  head.className = "chart-preset-preview-head";
  const title = document.createElement("strong");
  title.textContent = usingData ? (preset.title + " · 基于已导入数据") : (preset.title + " · 示例示意");
  title.title = preset.tooltip;
  const desc = document.createElement("span");
  desc.textContent = usingData
    ? ("预览当前数据按“" + preset.title + "”绘制后的大致样子；确认后插入 PPT 原生图表。")
    : "尚未导入数据，先显示示例。导入后将自动改用你的数据预览。";
  desc.title = "用途：" + preset.tooltip + " 需要：" + preset.needs.join("、");
  head.append(title, desc);
  const plot = document.createElement("div");
  plot.className = "chart-mini-plot";
  plot.title = preset.tooltip;
  plot.append(buildMiniPlotDom(preset, points));
  const actions = document.createElement("div");
  actions.className = "chart-import-empty-actions";
  const useBtn = document.createElement("button");
  useBtn.type = "button";
  useBtn.className = "primary-action";
  useBtn.textContent = usingData ? "插入此预设图表" : "先导入数据";
  useBtn.title = usingData
    ? ("按 " + preset.title + " 插入当前识别到的数据集（PPT 原生 shape/line/text）；插入后仍可编辑")
    : "先导入 SimpleExperiment 结果或 CSV，再预览并绘制";
  useBtn.addEventListener("click", () => {
    if (!usingData) {
      els.zlkChartImport && els.zlkChartImport.click();
      setStatus("请先导入实验结果，再预览和绘制。");
      return;
    }
    insertZlkChartDataset(dataset, {
      chartType: preset.chartType,
      title: preset.title,
      reason: preset.tooltip
    });
  });
  const help = document.createElement("button");
  help.type = "button";
  help.textContent = "查看用途";
  help.title = preset.tooltip;
  help.addEventListener("click", () => setStatus(preset.title + "：" + preset.tooltip));
  actions.append(useBtn, help);
  els.chartPresetPreview.append(head, plot, actions);
}

function initUiModeControls() {
  applyUiMode(state.uiMode, { persist: false });
  document.querySelector("#simpleModeFullSwitch")?.addEventListener("click", () => {
    const next = state.uiMode === "full" ? "simple" : "full";
    applyUiMode(next);
    setStatus(next === "full"
      ? "已切换到完整模式：显示全部专业面板与连接详情。"
      : "已切换到简洁模式：只显示当前右侧工作区；高频命令保留在 PowerPoint Ribbon。");
  });
  els.uiModeSimple && els.uiModeSimple.addEventListener("click", () => {
    applyUiMode("simple");
    setStatus("已切换到简洁模式：只显示当前右侧工作区；高频命令保留在 PowerPoint Ribbon。");
  });
  els.uiModeFull && els.uiModeFull.addEventListener("click", () => {
    applyUiMode("full");
    setStatus("已切换到完整模式：显示全部专业面板。");
  });
}

function renderChartImportPanel() {
  if (!els.zlkChartResults || !els.zlkChartSummary) return;
  const hasChartDatasets = state.chartDatasets.length > 0;
  if (els.zlkChartClear) {
    els.zlkChartClear.disabled = !hasChartDatasets;
    els.zlkChartClear.title = hasChartDatasets
      ? "清空当前导入预览，不删除本机任何文件"
      : "当前没有可清空的科研绘图数据";
    els.zlkChartClear.setAttribute("aria-label", els.zlkChartClear.title);
  }
  const datasets = filteredChartDatasets();
  const totalPoints = state.chartDatasets.reduce((sum, dataset) => sum + (dataset.points?.length ?? 0), 0);
  const totalRecommendations = state.chartDatasets.reduce((sum, dataset) => sum + (dataset.recommendations?.length ?? 0), 0);
  setSummaryBadge(
    els.zlkChartSummary,
    state.chartDatasets.length
      ? `${state.chartDatasets.length} 个数据集 | ${totalPoints} 个点 | ${totalRecommendations} 个推荐`
      : "未导入",
    state.chartDatasets.length
      ? "当前已导入的 SimpleExperiment 实验绘图数据、可绘图点和推荐图表数量"
      : "还没有导入科研绘图数据",
    state.chartDatasets.length ? "ok" : "idle"
  );
  if (els.zlkAutomationStatus) {
    const result = state.zlkAutomationResult;
    const tone = zlkLocalStatusTone();
    els.zlkAutomationStatus.textContent = state.zlkAutomationStatus || "等待 SimpleExperiment 自动绘图请求。";
    els.zlkAutomationStatus.title = result
      ? `最近一次 SimpleExperiment 自动绘图：${result.chartType ?? result.ChartType ?? ""}，第 ${result.slideIndex ?? result.SlideIndex ?? ""} 页，${result.shapeCount ?? result.ShapeCount ?? ""} 个对象`
      : "显示 SimpleExperiment 通过 127.0.0.1 自动调用 PowerPoint 绘图的最近状态";
    els.zlkAutomationStatus.dataset.statusTone = tone;
    setLocalStatusTone(els.zlkAutomationStatus, tone);
  }
  els.zlkChartResults.innerHTML = "";

  if (!state.chartDatasets.length) {
    els.zlkChartResults.append(renderChartEmptyState());
    return;
  }
  if (!datasets.length) {
    const empty = document.createElement("div");
    empty.className = "chart-import-empty";
    empty.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "当前搜索词没有匹配已导入的数据集";
    title.title = "切换到全部或数据范围，或清空搜索词后查看全部导入结果";
    const detail = document.createElement("span");
    detail.textContent = "可清空搜索、切换到数据范围，或重新导入 SimpleExperiment 实验结果。";
    detail.title = "科研绘图只绘制 PPT 原生 shape/line/text/table，不会插入截图";
    const actions = document.createElement("div");
    actions.className = "chart-import-empty-actions";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "清空搜索";
    clearBtn.title = "清空当前搜索词并显示全部已导入数据集";
    clearBtn.addEventListener("click", () => {
      if (els.search) {
        els.search.value = "";
        state.query = "";
        render();
        setStatus("已清空搜索，显示全部已导入数据集。");
      }
    });
    const scopeBtn = document.createElement("button");
    scopeBtn.type = "button";
    scopeBtn.textContent = "仅看数据";
    scopeBtn.title = "把搜索范围切换到数据，只查看科研绘图导入结果";
    scopeBtn.addEventListener("click", () => {
      state.searchScope = "chart";
      persistSetting("roughPptSearchScope", state.searchScope);
      render();
      setStatus("已切换到数据搜索范围。");
    });
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "导入文件";
    importBtn.title = "选择结果文件并自动识别图表数据";
    importBtn.addEventListener("click", () => els.zlkChartImport?.click());
    actions.append(clearBtn, scopeBtn, importBtn);
    empty.append(title, detail, actions);
    empty.title = "切换到全部或数据范围，或清空搜索词后查看全部导入结果";
    els.zlkChartResults.append(empty);
    return;
  }
  const visibleCount = Math.max(resourceBatchFor(CHART_DATASET_RENDER_BATCH), state.chartDatasetVisibleCount || resourceBatchFor(CHART_DATASET_RENDER_BATCH));
  const visibleDatasets = datasets.slice(0, visibleCount);
  for (const dataset of visibleDatasets) {
    els.zlkChartResults.append(renderChartDatasetCard(dataset));
  }
  if (datasets.length > visibleDatasets.length) {
    els.zlkChartResults.append(renderResourceLoadMore("数据集", datasets.length - visibleDatasets.length, "继续显示已导入科研绘图数据集", () => {
      state.chartDatasetVisibleCount = Math.min(datasets.length, visibleCount + resourceBatchFor(CHART_DATASET_RENDER_BATCH));
      renderChartImportPanel();
    }));
  }
}

function renderChartEmptyState() {
  const wrap = document.createElement("div");
  wrap.className = "chart-import-empty chart-import-guidance";
  wrap.title = "使用上方唯一导入入口，选择 SimpleExperiment 结果输出、论文表格或 experiments/work_dirs 下的结果 CSV";
  const title = document.createElement("strong");
  title.textContent = "等待导入实验结果";
  title.title = "支持排行榜、均值误差、敏感性曲线、亚组对比、病例级分布和错误类型汇总";
  const detail = document.createElement("span");
  detail.textContent = "使用上方导入入口读取结果；也可展开图表类型，先查看用途与示意。";
  detail.title = `支持路径：${supportedZlkClusterPatterns().join("；")}`;
  wrap.append(title, detail);
  if (state.chartImportError) {
    const error = document.createElement("small");
    error.textContent = state.chartImportError;
    error.title = "最近一次导入的中文错误或字段建议";
    wrap.append(error);
  }
  return wrap;
}

function renderChartDatasetCard(dataset) {
  const card = document.createElement("article");
  card.className = "chart-dataset-card";
  card.tabIndex = 0;
  card.title = `${dataset.source?.path || "未知来源"}：${dataset.points?.length ?? 0} 个可绘图点，${dataset.recommendations?.length ?? 0} 个图表推荐`;

  const head = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = displayChartSourceName(dataset);
  title.title = `数据来源：${dataset.source?.path || "未知数据"}`;
  const meta = document.createElement("span");
  meta.className = "badge";
  meta.textContent = chartKindLabel(dataset.source?.kind);
  meta.title = `识别格式：${chartKindLabel(dataset.source?.kind)}，置信度 ${Math.round((dataset.source?.confidence || 0) * 100)}%`;
  head.append(title, meta);

  const stats = document.createElement("div");
  stats.className = "chart-dataset-stats";
  stats.title = "数据集行数、可绘图点数、序列数和字段数量";
  for (const item of [
    ["行", dataset.rows?.length ?? 0],
    ["点", dataset.points?.length ?? 0],
    ["序列", dataset.series?.length ?? 0],
    ["字段", dataset.fields?.length ?? 0]
  ]) {
    const chip = document.createElement("span");
    chip.textContent = `${item[0]} ${item[1]}`;
    chip.title = `${item[0]}数量：${item[1]}`;
    stats.append(chip);
  }

  const recList = document.createElement("div");
  recList.className = "chart-recommendations";
  recList.title = "按推荐顺序选择图表；点击“插入推荐图表”才会写入 PPT 原生可编辑对象";
  const recommendations = (dataset.recommendations ?? []).slice(0, 4);
  let alternatives = null;
  let alternativeList = null;
  if (recommendations.length > 1) {
    alternatives = document.createElement("details");
    alternatives.className = "chart-recommendation-alternatives";
    alternatives.title = "展开其它可用图表，不会立即插入或修改 PPT";
    const alternativeSummary = document.createElement("summary");
    alternativeSummary.textContent = `其它图表 ${recommendations.length - 1}`;
    alternativeSummary.title = "展开或收起备选科研图表";
    alternativeList = document.createElement("div");
    alternatives.append(alternativeSummary, alternativeList);
  }
  for (const [index, recommendation] of recommendations.entries()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = index === 0 ? "primary-action" : "secondary-action";
    chip.dataset.chartRecommendation = recommendation.chartType || "";
    chip.textContent = index === 0 ? "插入推荐图表：" + recommendation.title : recommendation.title;
    chip.title = (index === 0 ? "首选推荐。" : "备选图表。") + chartRecommendationTooltip(recommendation);
    chip.addEventListener("click", () => {
      insertZlkChartDataset(dataset, recommendation);
    });
    if (index === 0) recList.append(chip);
    else alternativeList?.append(chip);
  }
  if (alternatives) recList.append(alternatives);

  const messages = [...(dataset.errors ?? []), ...(dataset.warnings ?? [])].slice(0, 3);
  if (messages.length) {
    const note = document.createElement("div");
    note.className = dataset.errors?.length ? "chart-dataset-message error" : "chart-dataset-message";
    note.textContent = messages.join("；");
    note.title = "导入诊断信息和字段建议";
    card.append(head, stats, recList, note);
  } else {
    card.append(head, stats, recList);
  }
  return card;
}

function displayChartSourceName(dataset) {
  const path = dataset.source?.path || "未知数据";
  return path.split("/").pop() || path;
}

function chartKindLabel(kind = "") {
  const labels = {
    summary: "结果摘要",
    result_registry: "结果注册表",
    statistics: "统计摘要",
    quality_gate: "质量门禁",
    case_level_index: "病例级索引",
    paper_table_csv: "论文表格",
    paper_table_tex: "LaTeX 表格",
    experiment_result_csv: "实验结果 CSV",
    metrics_summary_csv: "指标汇总",
    metrics_case_csv: "病例指标",
    generic_result_table: "通用结果表"
  };
  return labels[kind] || "未知格式";
}

const ZOTERO_IMAGE_CATEGORY_LABELS = Object.freeze({
  auto: "自动判断", metric_curve: "指标／训练曲线", heatmap: "热图／矩阵图", bar_chart: "柱状／条形图",
  distribution: "分布／降维图", qualitative: "定性结果对比", architecture: "网络／模型结构图",
  pipeline: "方法流程图", table: "科研表格", equation: "公式", schematic: "装置／原理示意",
  photo: "照片／医学影像", chart: "图表", diagram: "流程图／示意图", figure: "其他插图"
});

const ZOTERO_COLOR_FAMILY_LABELS = Object.freeze({
  red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", cyan: "青色", blue: "蓝色",
  purple: "紫色", pink: "粉色", brown: "棕色", gray: "灰色", grey: "灰色", black: "黑色",
  white: "白色", unknown: "未知色系"
});

const ZOTERO_STYLE_TAG_LABELS = Object.freeze({
  research: "科研绘图", matrix: "矩阵", table: "表格", bright: "明亮", dark: "深色", balanced: "明暗均衡",
  colorful: "多彩", muted: "低饱和", "moderate-saturation": "中等饱和", warm: "暖色", cool: "冷色",
  grid: "网格", cells: "单元格", wide: "横向", tall: "纵向", square: "近方形",
  result: "结果", method: "方法", evidence: "证据", compare: "对比", context: "背景",
  hero: "主视觉区", side: "侧栏区", footer: "底部区", inset: "嵌入区", plot: "科研图表",
  axes: "坐标轴", metrics: "指标", curve: "曲线", "color-scale": "色标", heatmap: "热图",
  bars: "柱形", distribution: "分布", points: "散点", "result-panels": "结果面板",
  "visual-comparison": "可视化对比", network: "网络结构", blocks: "模块", connections: "连接关系",
  flow: "流程", steps: "步骤", boxes: "方框", circuit: "电路", lines: "线条", math: "数学公式",
  symbols: "数学符号", "photo-ref": "照片参考", "figure-ref": "插图参考", banner: "横幅",
  landscape: "横版", portrait: "竖版", stack: "堆叠", tile: "方形分块", "lead-visual": "主视觉",
  pipeline: "方法流程", support: "辅助证据", "before-after": "前后对比", background: "背景"
});

const ZOTERO_LAYOUT_LABELS = Object.freeze({ wide: "横向", tall: "纵向", square: "近方形", unknown: "未知布局" });
const ZOTERO_SLOT_LABELS = Object.freeze({ hero: "主视觉区", side: "侧栏区", footer: "底部区", inset: "嵌入区", unknown: "未知版位" });
const ZOTERO_ROLE_LABELS = Object.freeze({ result: "结果主图", method: "方法说明", evidence: "证据支撑", compare: "对比展示", context: "背景说明", unknown: "通用用途" });
const ZOTERO_INSERT_SIZE_LABELS = Object.freeze({ large: "大尺寸", medium: "中尺寸", small: "小尺寸" });
const ZOTERO_CAPTION_LABELS = Object.freeze({ result: "结果型图注", method: "方法型图注", compare: "对比型图注", context: "背景型图注" });
const ZOTERO_STORY_LABELS = Object.freeze({ hook: "引入阶段", setup: "铺垫阶段", method: "方法阶段", result: "结果阶段", compare: "对比阶段", close: "收束阶段" });

function zoteroMetadataKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function zoteroImageCategoryLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return ZOTERO_IMAGE_CATEGORY_LABELS[zoteroMetadataKey(raw)] || (/[㐀-鿿]/.test(raw) ? raw : "其他插图");
}

function zoteroColorFamilyLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return ZOTERO_COLOR_FAMILY_LABELS[zoteroMetadataKey(raw)] || (/[㐀-鿿]/.test(raw) ? raw : "其他色系");
}

function zoteroStyleTagLabel(value) {
  const raw = String(value ?? "").trim();
  const key = zoteroMetadataKey(raw);
  if (!key) return "";
  if (ZOTERO_IMAGE_CATEGORY_LABELS[key]) return ZOTERO_IMAGE_CATEGORY_LABELS[key];
  if (ZOTERO_STYLE_TAG_LABELS[key]) return ZOTERO_STYLE_TAG_LABELS[key];
  if (ZOTERO_COLOR_FAMILY_LABELS[key]) return ZOTERO_COLOR_FAMILY_LABELS[key];
  if (ZOTERO_LAYOUT_LABELS[key]) return ZOTERO_LAYOUT_LABELS[key];
  if (ZOTERO_SLOT_LABELS[key]) return ZOTERO_SLOT_LABELS[key];
  if (ZOTERO_ROLE_LABELS[key]) return ZOTERO_ROLE_LABELS[key];
  let match = key.match(/^(?:ins|insert)-(large|medium|small)$/);
  if (match) return ZOTERO_INSERT_SIZE_LABELS[match[1]];
  match = key.match(/^(?:cap|caption)-(result|method|compare|context)$/);
  if (match) return ZOTERO_CAPTION_LABELS[match[1]];
  match = key.match(/^(?:beat|story)-(hook|setup|method|result|compare|close)$/);
  if (match) return ZOTERO_STORY_LABELS[match[1]];
  match = key.match(/^slide-(hero|side|footer|inset)$/);
  if (match) return `${ZOTERO_SLOT_LABELS[match[1]]}版位`;
  match = key.match(/^role-(result|method|evidence|compare|context)$/);
  if (match) return ZOTERO_ROLE_LABELS[match[1]];
  return /[㐀-鿿]/.test(raw) ? raw : "其他标签";
}

function zoteroSwatchVariantLabel(value) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();
  if (!raw || key === "base" || raw === "基准色") return "基准色";
  let match = key.match(/^tint\s*(\d+)%$/) || raw.match(/^浅色\s*(\d+)%$/) || raw.match(/^(\d+)%\s*浅色$/);
  if (match) return `${match[1]}% 浅色`;
  match = key.match(/^shade\s*(\d+)%$/) || raw.match(/^深色\s*(\d+)%$/) || raw.match(/^(\d+)%\s*深色$/);
  if (match) return `${match[1]}% 深色`;
  return /[㐀-鿿]/.test(raw) ? raw : "其他色阶";
}

function zoteroSwatchRoleLabel(value) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();
  if (!raw) return "来源色";
  if (key === "dominant") return "主色";
  const match = key.match(/^accent-(\d+)$/);
  if (match) return `辅助色 ${match[1]}`;
  return /[㐀-鿿]/.test(raw) ? raw : "辅助色";
}

function zoteroValue(item, camel, pascal, fallback = "") {
  return item?.[camel] ?? item?.[pascal] ?? fallback;
}

function zoteroSwatchesFromPalette() {
  const palette = state.zoteroPalette ?? {};
  return Array.isArray(palette.swatches) ? palette.swatches : Array.isArray(palette.Swatches) ? palette.Swatches : [];
}

function zoteroImageTitle(item) {
  return zoteroValue(item, "title", "Title", "") || "未命名论文图像";
}

function zoteroImageId(item) {
  return zoteroValue(item, "imageId", "ImageId", "");
}

function filteredZoteroImages() {
  const query = state.zoteroQuery.trim();
  if (!query) return state.zoteroImages;
  return state.zoteroImages.filter(item => {
    const swatches = Array.isArray(zoteroValue(item, "swatches", "Swatches", [])) ? zoteroValue(item, "swatches", "Swatches", []) : [];
    const styleTags = Array.isArray(zoteroValue(item, "styleTags", "StyleTags", [])) ? zoteroValue(item, "styleTags", "StyleTags", []) : [];
    const imageCategory = zoteroValue(item, "imageCategory", "ImageCategory", "");
    const colorFamily = zoteroValue(item, "colorFamily", "ColorFamily", "");
    const text = [
      zoteroImageId(item),
      zoteroImageTitle(item),
      zoteroValue(item, "year", "Year", ""),
      zoteroValue(item, "doi", "Doi", ""),
      zoteroValue(item, "pageNumber", "PageNumber", ""),
      imageCategory,
      zoteroImageCategoryLabel(imageCategory),
      colorFamily,
      zoteroColorFamilyLabel(colorFamily),
      zoteroValue(item, "sourceRegionKey", "SourceRegionKey", ""),
      styleTags.join(" "),
      styleTags.map(zoteroStyleTagLabel).join(" "),
      swatches.map(swatch => `${zoteroValue(swatch, "hex", "Hex", "")} ${zoteroValue(swatch, "role", "Role", "")} ${zoteroSwatchRoleLabel(zoteroValue(swatch, "role", "Role", ""))}`).join(" ")
    ].join(" ");
    return matchesSearchText(text, query);
  });
}

function renderZoteroImagePanel() {
  if (!els.zoteroImageGrid || !els.zoteroPaletteGrid || !els.zoteroImageSummary) return;
  const images = filteredZoteroImages();
  els.zoteroImageSummary.textContent = state.zoteroImages.length ? `显示 ${images.length} 张，共 ${state.zoteroImages.length} 张` : "未读取";
  els.zoteroImageSummary.title = state.zoteroDatabaseFound
    ? `Zotero 论文图像库已读取，当前匹配 ${images.length} 张`
    : `Zotero 共享数据库未找到或未读取：${state.zoteroDatabasePath || "%LOCALAPPDATA%\\ZLK\\paper-image-library\\paper_images.sqlite"}`;
  if (els.zoteroImageStatus) {
    els.zoteroImageStatus.textContent = state.zoteroImageStatus || "等待读取本机论文图像库。";
    els.zoteroImageStatus.title = `共享数据库：${state.zoteroDatabasePath || "%LOCALAPPDATA%\\ZLK\\paper-image-library\\paper_images.sqlite"}；来源：${state.zoteroDatabaseSource || "等待 Zotero library.json 或默认路径检测"}`;
    setLocalStatusTone(els.zoteroImageStatus, zoteroLocalStatusTone());
  }

  renderZoteroPaletteGrid();
  els.zoteroImageGrid.innerHTML = "";
  if (!state.zoteroImages.length) {
    const empty = document.createElement("div");
    empty.className = "zotero-image-empty";
    empty.title = "PPT 只读 Zotero PDF 图片保存插件的共享 SQLite；Zotero 关闭时仍可读取已保存图像";
    const title = document.createElement("strong");
    title.textContent = state.zoteroDatabaseFound ? "图像库暂无可预览图片" : "未找到 Zotero 论文图像库";
    title.title = "如果尚未在 Zotero 中保存论文图像，请先用 PDF 图片保存插件保存一次";
    const detail = document.createElement("span");
    detail.textContent = state.zoteroDatabasePath || "%LOCALAPPDATA%\\ZLK\\paper-image-library\\paper_images.sqlite";
    detail.title = `共享 SQLite 主库路径；PPT 只读这个数据库，不读取 Zotero 内部 zotero.sqlite；来源：${state.zoteroDatabaseSource || "等待检测"}`;
    const actions = document.createElement("div");
    actions.className = "zotero-image-empty-actions";
    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.textContent = "重新读取";
    reloadBtn.title = "重新只读扫描 Zotero PDF 图片保存插件的共享 SQLite 主库";
    reloadBtn.addEventListener("click", () => els.zoteroImageReload?.click());
    const paletteBtn = document.createElement("button");
    paletteBtn.type = "button";
    paletteBtn.textContent = "打开配色库";
    paletteBtn.title = "定位跨文件配色库，可保存、导入或应用 PPT 主题配色";
    paletteBtn.addEventListener("click", () => activateSectionNav("paletteLibrary"));
    actions.append(reloadBtn, paletteBtn);
    empty.append(title, detail, actions);
    els.zoteroImageGrid.append(empty);
    return;
  }

  if (!images.length) {
    const empty = document.createElement("div");
    empty.className = "zotero-image-empty";
    empty.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "当前搜索词没有匹配论文图像";
    title.title = "可搜索标题、年份、DOI、页码、样式标签、色系或 HEX 颜色";
    const detail = document.createElement("span");
    detail.textContent = "可清空搜索词，或重新读取本机共享图像库。";
    detail.title = "PPT 只读共享 SQLite；Zotero 关闭时仍可预览已保存图像";
    const actions = document.createElement("div");
    actions.className = "zotero-image-empty-actions";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "清空搜索";
    clearBtn.title = "清空论文图像搜索词并显示全部结果";
    clearBtn.addEventListener("click", () => {
      if (els.zoteroImageSearch) {
        els.zoteroImageSearch.value = "";
        state.zoteroQuery = "";
        resetResourceRenderWindows("zotero");
        resetResourceRenderWindows("palette");
        renderZoteroImagePanel();
        setStatus("已清空论文图像搜索。");
      }
    });
    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.textContent = "重新读取";
    reloadBtn.title = "重新只读扫描 Zotero PDF 图片保存插件的共享 SQLite 主库";
    reloadBtn.addEventListener("click", () => els.zoteroImageReload?.click());
    actions.append(clearBtn, reloadBtn);
    empty.append(title, detail, actions);
    empty.title = "可搜索标题、年份、DOI、页码、样式标签、色系或 HEX 颜色";
    els.zoteroImageGrid.append(empty);
    return;
  }

  const visibleCount = Math.max(resourceBatchFor(ZOTERO_IMAGE_RENDER_BATCH), state.zoteroImageVisibleCount || resourceBatchFor(ZOTERO_IMAGE_RENDER_BATCH));
  const visibleImages = images.slice(0, visibleCount);
  for (const image of visibleImages) {
    els.zoteroImageGrid.append(renderZoteroImageCard(image));
  }
  if (images.length > visibleImages.length) {
    els.zoteroImageGrid.append(renderResourceLoadMore("论文图像", images.length - visibleImages.length, "继续显示论文图像缩略图", () => {
      state.zoteroImageVisibleCount = Math.min(images.length, visibleCount + resourceBatchFor(ZOTERO_IMAGE_RENDER_BATCH));
      renderZoteroImagePanel();
    }));
  }
}

function renderZoteroImageCard(image) {
  const card = document.createElement("article");
  card.className = "zotero-image-card";
  card.tabIndex = 0;
  const titleText = zoteroImageTitle(image);
  const imageId = zoteroImageId(image);
  const pageNumber = zoteroValue(image, "pageNumber", "PageNumber", "");
  card.title = `${titleText}；页码 ${pageNumber || "未知"}；点击按钮可插入参考图、打开 PDF、定位条目或复制溯源编号`;

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "zotero-thumb";
  thumbWrap.title = "缩略图来自共享 SQLite 数据库，只用于 PPT 窗格预览";
  const thumbnail = zoteroValue(image, "thumbnailDataUrl", "ThumbnailDataUrl", "");
  if (thumbnail) {
    const img = document.createElement("img");
    img.alt = titleText;
    img.title = "论文图像缩略图";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbnail;
    thumbWrap.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = "无预览";
    fallback.title = "该记录没有缩略图，仍可尝试插入原始图像";
    thumbWrap.append(fallback);
  }

  const copy = document.createElement("div");
  copy.className = "zotero-image-copy";
  const title = document.createElement("strong");
  title.textContent = titleText;
  title.title = "来源论文标题或 Zotero 图像标题";
  const meta = document.createElement("small");
  const year = zoteroValue(image, "year", "Year", "");
  const doi = zoteroValue(image, "doi", "Doi", "");
  meta.textContent = [year && `年份 ${year}`, pageNumber && `第 ${pageNumber} 页`, doi && "DOI"].filter(Boolean).join(" · ") || "暂无文献信息";
  meta.title = "论文来源摘要；点击“复制溯源编号”可获取完整来源标识";
  const tags = document.createElement("div");
  tags.className = "zotero-image-tags";
  tags.title = "样式标签和色系均可搜索";
  const styleTags = Array.isArray(zoteroValue(image, "styleTags", "StyleTags", [])) ? zoteroValue(image, "styleTags", "StyleTags", []) : [];
  const visibleTags = [
    [zoteroImageCategoryLabel(zoteroValue(image, "imageCategory", "ImageCategory", "")), "科研类别"],
    ...styleTags.map(tag => [zoteroStyleTagLabel(tag), "样式标签"]),
    [zoteroColorFamilyLabel(zoteroValue(image, "colorFamily", "ColorFamily", "")), "色系"]
  ].filter(item => item[0]);
  const seenTags = new Set();
  for (const [tag, kind] of visibleTags.filter(item => !seenTags.has(item[0]) && seenTags.add(item[0])).slice(0, 5)) {
    const chip = document.createElement("span");
    chip.textContent = tag;
    chip.title = `${kind}：${tag}`;
    tags.append(chip);
  }
  copy.append(title, meta, tags);

  const actions = document.createElement("div");
  actions.className = "zotero-image-actions";
  actions.title = "论文图像操作，均只针对当前图像记录";
  for (const action of [
    ["setZoteroPaletteReference", imageId === state.activeZoteroReferenceImageId ? "当前配色参考" : "设为配色参考", "", "只读取当前这一张论文图像的全部实际配色；不会跨图累积"],
    ["insertZoteroImage", "插入", "image", "把共享数据库中的原始图像写入临时文件，并用 PowerPoint 图片接口插入为参考图像"],
    ["openZoteroImagePdf", "打开 PDF", "library", "优先通过 Zotero 本地连接打开来源 PDF；失败后改用 Zotero PDF 链接"],
    ["selectZoteroImageItem", "定位条目", "carrier", "优先通过 Zotero 本地连接定位父条目；失败后改用 Zotero 条目链接"],
    ["copyZoteroTraceIds", "复制溯源编号", "clipboard", "复制图像、父条目、PDF 附件、页码和来源区域的溯源编号"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    if (action[2]) button.append(createFunctionIcon(action[2], action[0]));
    button.append(document.createTextNode(action[1]));
    button.title = action[3];
    button.addEventListener("click", () => {
      setStatus(`正在${action[1]}：${titleText}`);
      if (action[0] === "setZoteroPaletteReference") selectZoteroPaletteReference(image);
      if (action[0] === "insertZoteroImage") postHost({ type: "insertZoteroImage", imageId });
      if (action[0] === "openZoteroImagePdf") postHost({ type: "openZoteroImagePdf", imageId });
      if (action[0] === "selectZoteroImageItem") postHost({ type: "selectZoteroImageItem", imageId });
      if (action[0] === "copyZoteroTraceIds") postHost({ type: "copyZoteroTraceIds", imageId });
    });
    actions.append(button);
  }

  card.append(thumbWrap, copy, actions);
  return card;
}

function renderZoteroPaletteGrid() {
  const swatches = zoteroSwatchesFromPalette();
  if (els.zoteroPaletteSummary) {
    els.zoteroPaletteSummary.textContent = state.activeZoteroReferenceImageId
      ? `${state.activeZoteroReferenceTitle || "当前参考图"} · ${swatches.length} 色${state.activeZoteroPaletteSaved ? " · 已保存" : " · 未保存"}`
      : "未选择参考图";
    els.zoteroPaletteSummary.title = state.activeZoteroReferenceImageId
      ? `当前配色只来自：${state.activeZoteroReferenceTitle || state.activeZoteroReferenceImageId}；共 ${swatches.length} 个实际提取色`
      : "请在下方论文图像中点击“设为配色参考”";
  }
  if (els.saveZoteroPalette) {
    els.saveZoteroPalette.disabled = swatches.length === 0;
    els.saveZoteroPalette.title = swatches.length
      ? "把当前单张参考图的全部实际配色保存到跨文件配色库"
      : "当前没有可保存的论文配色；请先选择一张配色参考图";
    els.saveZoteroPalette.setAttribute("aria-label", els.saveZoteroPalette.title);
  }
  els.zoteroPaletteGrid.classList.toggle("is-empty", swatches.length === 0);
  els.zoteroPaletteGrid.innerHTML = "";
  if (!swatches.length) {
    const empty = document.createElement("div");
    empty.className = "zotero-palette-empty";
    empty.textContent = "暂无配色。请在下方选择一张论文图像作为配色参考。";
    empty.title = "配色严格来自当前单张参考图，不会跨图累积";
    els.zoteroPaletteGrid.append(empty);
    return;
  }

  for (const swatch of swatches) {
    const button = document.createElement("button");
    const hex = normalizeHexText(zoteroValue(swatch, "hex", "Hex", "#000000"));
    const variant = zoteroValue(swatch, "variant", "Variant", "base");
    const sourceTitle = zoteroValue(swatch, "sourceTitle", "SourceTitle", "未知来源");
    const role = zoteroValue(swatch, "role", "Role", "来源色");
    button.type = "button";
    button.className = "zotero-swatch";
    button.style.setProperty("--swatch", hex);
    button.dataset.hex = hex;
    button.dataset.variant = variant;
    const activeHex = normalizeHexText(state.activeZoteroSwatch?.hex || state.activeZoteroSwatch?.Hex || "");
    const isActive = activeHex && activeHex === normalizeHexText(hex);
    button.classList.toggle("active", Boolean(isActive));
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.title = `${hex}；来源：${sourceTitle}；用途：${zoteroSwatchRoleLabel(role)}；色阶：${zoteroSwatchVariantLabel(variant)}`;
    button.setAttribute("aria-label", isActive ? `当前色块 ${hex}` : `应用色块 ${hex}`);
    button.addEventListener("click", () => applyZoteroSwatch(swatch, "fill"));
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      showZoteroSwatchMenu(swatch, event.clientX, event.clientY);
    });
    button.addEventListener("keydown", event => {
      if (event.key === "Enter") applyZoteroSwatch(swatch, "fill");
      if (event.shiftKey && event.key === "F10") {
        event.preventDefault();
        const rect = button.getBoundingClientRect();
        showZoteroSwatchMenu(swatch, rect.left, rect.bottom);
      }
    });
    els.zoteroPaletteGrid.append(button);
  }
}

function paletteId(palette) {
  return zoteroValue(palette, "id", "Id", "");
}

function paletteName(palette) {
  return zoteroValue(palette, "displayName", "DisplayName", paletteId(palette) || "未命名配色");
}

function paletteSwatches(palette) {
  const swatches = zoteroValue(palette, "swatches", "Swatches", []);
  return Array.isArray(swatches) ? swatches : [];
}

function paletteLayouts(palette) {
  const layouts = zoteroValue(palette, "layouts", "Layouts", []);
  return Array.isArray(layouts) ? layouts : [];
}

function paletteLayoutValue(layout, camel, pascal, fallback = "") {
  return layout?.[camel] ?? layout?.[pascal] ?? fallback;
}

function paletteLayoutColors(layout, camel, pascal, fallback = []) {
  const values = paletteLayoutValue(layout, camel, pascal, fallback);
  return Array.isArray(values) ? values.map(normalizeHexText).filter(Boolean) : fallback;
}

function paletteIsBuiltIn(palette) {
  return Boolean(zoteroValue(palette, "builtIn", "BuiltIn", false));
}

function filteredPaletteSchemes() {
  const query = state.zoteroQuery.trim();
  if (!query) return state.paletteSchemes;
  return state.paletteSchemes.filter(palette => {
    const text = [
      paletteId(palette),
      paletteName(palette),
      zoteroValue(palette, "kind", "Kind", ""),
      zoteroValue(palette, "source", "Source", ""),
      ...(Array.isArray(zoteroValue(palette, "keywords", "Keywords", [])) ? zoteroValue(palette, "keywords", "Keywords", []) : []),
      ...paletteSwatches(palette).map(swatch => `${zoteroValue(swatch, "hex", "Hex", "")} ${zoteroValue(swatch, "role", "Role", "")} ${zoteroSwatchRoleLabel(zoteroValue(swatch, "role", "Role", ""))}`)
    ].join(" ");
    return matchesSearchText(text, query);
  });
}

function pruneSelectedPaletteIds() {
  const existing = new Set(state.paletteSchemes.map(paletteId).filter(Boolean));
  for (const paletteIdValue of [...state.selectedPaletteIds]) {
    if (!existing.has(paletteIdValue)) state.selectedPaletteIds.delete(paletteIdValue);
  }
}

function renderPaletteLibrary() {
  if (!els.paletteSchemeGrid || !els.paletteLibrarySummary) return;
  pruneSelectedPaletteIds();
  const palettes = filteredPaletteSchemes();
  const exportable = palettes.filter(palette => !paletteIsBuiltIn(palette));
  const selectedExportable = exportable.filter(palette => state.selectedPaletteIds.has(paletteId(palette)));
  const selectedInFilter = palettes.filter(palette => state.selectedPaletteIds.has(paletteId(palette))).length;
  const exportCount = selectedExportable.length || exportable.length;
  setSummaryBadge(
    els.paletteLibrarySummary,
    selectedInFilter
      ? `${palettes.length} 个 | 已选 ${selectedInFilter}`
      : `${palettes.length} 个 | 可分享 ${exportable.length}`,
    selectedExportable.length
      ? `当前筛选 ${palettes.length} 个方案，已勾选 ${selectedExportable.length} 个用户配色可导出分享`
      : `配色库包含 PowerPoint 内置主题配色和跨文件保存的用户配色；当前可分享用户配色 ${exportable.length} 个`,
    selectedInFilter ? "ok" : (palettes.length ? "ready" : "idle")
  );
  if (els.exportPalettes) {
    els.exportPalettes.disabled = exportCount === 0;
    els.exportPalettes.title = exportCount === 0
      ? "没有可分享的用户配色；请先保存、取色或导入配色"
      : selectedExportable.length
        ? `把已勾选的 ${selectedExportable.length} 个用户配色导出为体积受控的 zip 分享包`
        : `未勾选时导出当前筛选中的 ${exportable.length} 个用户配色为 zip 分享包`;
    els.exportPalettes.setAttribute("aria-label", els.exportPalettes.title);
  }
  if (els.importPalettes) {
    els.importPalettes.title = "从安全 zip 配色分享包导入跨文件可用的用户配色方案";
    els.importPalettes.setAttribute("aria-label", els.importPalettes.title);
  }
  els.paletteSchemeGrid.innerHTML = "";
  if (!palettes.length) {
    const empty = document.createElement("div");
    empty.className = "palette-library-empty";
    empty.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = state.paletteSchemes.length ? "当前搜索词没有匹配配色方案" : "暂无保存的配色方案";
    title.title = "配色库支持 PPT 内置主题配色、Zotero 论文配色和用户保存方案";
    const detail = document.createElement("span");
    detail.textContent = "可保存论文配色、剪贴板取色、页面取色，或导入配色分享包。";
    detail.title = "用户配色会跨 PPT 文件保存，并可导出为体积受控的 zip 分享包";
    const actions = document.createElement("div");
    actions.className = "palette-library-empty-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "保存论文配色";
    saveBtn.title = "把当前 Zotero 搜索结果中的论文图像配色保存到跨文件配色库";
    saveBtn.addEventListener("click", () => els.saveZoteroPalette?.click());
    const clipBtn = document.createElement("button");
    clipBtn.type = "button";
    clipBtn.textContent = "剪贴板取色";
    clipBtn.title = "从剪贴板图片自动提取主色并保存为配色方案";
    clipBtn.addEventListener("click", () => els.extractClipboardPalette?.click());
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "导入配色";
    importBtn.title = "从安全 zip 配色分享包导入跨文件可用的配色方案";
    importBtn.addEventListener("click", () => els.importPalettes?.click());
    actions.append(saveBtn, clipBtn, importBtn);
    empty.append(title, detail, actions);
    empty.title = "可保存 Zotero 配色、从剪贴板图片取色、从当前页面取色，或导入配色分享包";
    els.paletteSchemeGrid.append(empty);
    return;
  }

  const visibleCount = Math.max(resourceBatchFor(PALETTE_SCHEME_RENDER_BATCH), state.paletteSchemeVisibleCount || resourceBatchFor(PALETTE_SCHEME_RENDER_BATCH));
  const visiblePalettes = palettes.slice(0, visibleCount);
  for (const palette of visiblePalettes) {
    els.paletteSchemeGrid.append(renderPaletteCard(palette));
  }
  if (palettes.length > visiblePalettes.length) {
    els.paletteSchemeGrid.append(renderResourceLoadMore("配色方案", palettes.length - visiblePalettes.length, "继续显示配色方案和布局预览", () => {
      state.paletteSchemeVisibleCount = Math.min(palettes.length, visibleCount + resourceBatchFor(PALETTE_SCHEME_RENDER_BATCH));
      renderPaletteLibrary();
    }));
  }
}

function renderPaletteCard(palette) {
  const id = paletteId(palette);
  const builtIn = paletteIsBuiltIn(palette);
  const card = document.createElement("article");
  card.className = `palette-card${builtIn ? " built-in" : ""}${state.selectedPaletteIds.has(id) ? " selected" : ""}`;
  card.title = `${paletteName(palette)}：选择下方布局可整体替换描边、填充和特征块渐变配色`;

  const head = document.createElement("header");
  const select = document.createElement("input");
  select.type = "checkbox";
  select.checked = state.selectedPaletteIds.has(id);
  select.disabled = builtIn;
  select.title = builtIn ? "PowerPoint 内置主题配色只读显示，不能作为用户配色导出" : "勾选后分享配色包时包含此方案";
  select.setAttribute("aria-label", `选择配色 ${paletteName(palette)}`);
  select.addEventListener("change", () => {
    if (select.checked) state.selectedPaletteIds.add(id);
    else state.selectedPaletteIds.delete(id);
    renderPaletteLibrary();
  });
  const title = document.createElement("strong");
  title.textContent = paletteName(palette);
  title.title = zoteroValue(palette, "source", "Source", "配色方案");
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = builtIn ? "PPT 内置" : "已保存";
  badge.title = builtIn ? "来自 PowerPoint 当前主题或内置主题候选" : "保存到本机跨文件配色库，可分享导入";
  head.append(select, title, badge);

  const swatchRow = document.createElement("div");
  swatchRow.className = "palette-swatch-row";
  swatchRow.title = "该配色方案的主色列表";
  for (const swatch of paletteSwatches(palette).slice(0, 10)) {
    const dot = document.createElement("span");
    const hex = normalizeHexText(zoteroValue(swatch, "hex", "Hex", "#000000"));
    dot.style.setProperty("--swatch", hex);
    dot.title = `${hex}；${zoteroSwatchRoleLabel(zoteroValue(swatch, "role", "Role", "配色"))}`;
    swatchRow.append(dot);
  }

  const layouts = document.createElement("div");
  layouts.className = "palette-layout-grid";
  layouts.title = "同一配色方案的不同整体替换布局预览；点击最满意的布局应用";
  for (const layout of paletteLayouts(palette)) {
    layouts.append(renderPaletteLayoutButton(layout));
  }

  const actions = document.createElement("div");
  actions.className = "palette-card-actions";
  if (!builtIn) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.append(createFunctionIcon("trash", "deletePalette"), document.createTextNode("删除"));
    remove.dataset.danger = "true";
    markDangerButton(remove);
    remove.title = `删除配色方案：${paletteName(palette)}`;
    remove.addEventListener("click", () => {
      showInlinePrompt({
        title: "删除配色方案",
        message: `确认删除配色方案“${paletteName(palette)}”？`,
        danger: true,
        confirmLabel: "删除",
        cancelStatus: "已取消删除配色方案。",
        onConfirm: () => postHost({ type: "deletePalette", paletteId: id })
      });
    });
    actions.append(remove);
  }

  card.append(head, swatchRow, layouts);
  if (actions.childNodes.length) card.append(actions);
  return card;
}

function renderPaletteLayoutButton(layout) {
  const button = document.createElement("button");
  const name = paletteLayoutValue(layout, "displayName", "DisplayName", paletteLayoutValue(layout, "id", "Id", "布局"));
  const stroke = normalizeHexText(paletteLayoutValue(layout, "strokeHex", "StrokeHex", "#111111"));
  const fill = normalizeHexText(paletteLayoutValue(layout, "fillHex", "FillHex", "#ffffff"));
  const start = normalizeHexText(paletteLayoutValue(layout, "featureStartHex", "FeatureStartHex", fill));
  const end = normalizeHexText(paletteLayoutValue(layout, "featureEndHex", "FeatureEndHex", stroke));
  const accent = normalizeHexText(paletteLayoutValue(layout, "accentHex", "AccentHex", start));
  const colors = paletteLayoutColors(layout, "shapeFillHexes", "ShapeFillHexes", paletteLayoutColors(layout, "colorHexes", "ColorHexes", [fill, start, end, accent]));
  button.type = "button";
  button.className = "palette-layout-button";
  button.style.setProperty("--layout-stroke", stroke);
  button.style.setProperty("--layout-fill", fill);
  button.style.setProperty("--layout-start", start);
  button.style.setProperty("--layout-end", end);
  button.style.setProperty("--layout-accent", accent);
  button.title = `${name}：描边 ${stroke}，填充轮换 ${colors.join("、")}，渐变 ${start} → ${end}`;
  const preview = document.createElement("span");
  preview.className = "palette-layout-preview";
  preview.setAttribute("aria-hidden", "true");
  for (const color of colors.slice(0, 8)) {
    const swatch = document.createElement("i");
    swatch.style.setProperty("--layout-swatch", color);
    preview.append(swatch);
  }
  const label = document.createElement("span");
  label.textContent = name;
  button.append(preview, label);
  button.addEventListener("click", () => applyPaletteLayout(layout));
  return button;
}

function applyPaletteLayout(layout) {
  const stroke = normalizeHexText(paletteLayoutValue(layout, "strokeHex", "StrokeHex", "#111111"));
  const fill = normalizeHexText(paletteLayoutValue(layout, "fillHex", "FillHex", "#ffffff"));
  const start = normalizeHexText(paletteLayoutValue(layout, "featureStartHex", "FeatureStartHex", fill));
  const end = normalizeHexText(paletteLayoutValue(layout, "featureEndHex", "FeatureEndHex", stroke));
  state.params.stroke = stroke;
  state.params.fillMode = "solid";
  state.params.fillColor = fill;
  state.insertParams.stroke = stroke;
  state.insertParams.fillMode = "solid";
  state.insertParams.fillColor = fill;
  state.featureBlock.startColor = start;
  state.featureBlock.endColor = end;
  syncParamControls("stroke", stroke, null);
  syncParamControls("fillMode", "solid", null);
  syncParamControls("fillColor", fill, null);
  applyFeatureBlockControls(state.featureBlock);
  setStatus(`正在应用配色布局：${paletteLayoutValue(layout, "displayName", "DisplayName", "布局")}`);
  postHost({ type: "applyPaletteLayout", layout });
}

function exportPaletteIds() {
  const filtered = filteredPaletteSchemes().filter(palette => !paletteIsBuiltIn(palette)).map(paletteId).filter(Boolean);
  const selected = filtered.filter(id => state.selectedPaletteIds.has(id));
  return selected.length ? selected : filtered;
}

function requestPalettes() {
  postHost({ type: "listPalettes" });
}

function showZoteroSwatchMenu(swatch, left, top) {
  if (!els.zoteroSwatchContextMenu) return;
  state.activeZoteroSwatch = swatch;
  const hex = normalizeHexText(zoteroValue(swatch, "hex", "Hex", "#000000"));
  const actions = [
    ["copy", "复制 HEX", "复制当前色块 HEX 到剪贴板"],
    ["stroke", "设为描边", "应用到当前 Rough 描边和当前选中 PPT 形状线条"],
    ["fill", "设为填充", "应用到当前 Rough 填充和当前选中 PPT 形状填充"],
    ["gradientStart", "设为渐变起点", "应用到特征块起始色"],
    ["gradientEnd", "设为渐变终点", "应用到特征块结束色"]
  ];
  els.zoteroSwatchContextMenu.innerHTML = "";
  for (const [target, label, title] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "menuitem";
    button.textContent = label;
    button.title = `${title}：${hex}`;
    button.disabled = true;
    button.dataset.armed = "false";
    button.addEventListener("click", () => {
      if (button.dataset.armed !== "true" || button.disabled) return;
      if (target === "copy") copyZoteroSwatchHex(hex);
      else applyZoteroSwatch(swatch, target);
      closeZoteroSwatchMenu();
    });
    els.zoteroSwatchContextMenu.append(button);
  }
  els.zoteroSwatchContextMenu.hidden = false;
  els.zoteroSwatchContextMenu.style.left = `${Math.max(8, Number(left) + 6)}px`;
  els.zoteroSwatchContextMenu.style.top = `${Math.max(8, Number(top) + 6)}px`;
  if (zoteroSwatchMenuArmTimer) window.clearTimeout(zoteroSwatchMenuArmTimer);
  zoteroSwatchMenuArmTimer = window.setTimeout(() => {
    zoteroSwatchMenuArmTimer = 0;
    for (const button of els.zoteroSwatchContextMenu.querySelectorAll("button")) {
      button.disabled = false;
      button.dataset.armed = "true";
    }
  }, 220);
}

function closeZoteroSwatchMenu() {
  if (!els.zoteroSwatchContextMenu) return;
  els.zoteroSwatchContextMenu.hidden = true;
  state.activeZoteroSwatch = null;
}

function applyZoteroSwatch(swatch, target) {
  const hex = normalizeHexText(zoteroValue(swatch, "hex", "Hex", "#000000"));
  state.activeZoteroSwatch = { ...(swatch || {}), hex, Hex: hex, target };
  if (target === "stroke") {
    state.params.stroke = hex;
    state.insertParams.stroke = hex;
    syncParamControls("stroke", hex, null);
  } else if (target === "gradientStart") {
    state.featureBlock.startColor = hex;
    applyFeatureBlockControls(state.featureBlock);
  } else if (target === "gradientEnd") {
    state.featureBlock.endColor = hex;
    applyFeatureBlockControls(state.featureBlock);
  } else {
    state.params.fillMode = "solid";
    state.params.fillColor = hex;
    state.insertParams.fillMode = "solid";
    state.insertParams.fillColor = hex;
    syncParamControls("fillMode", "solid", null);
    syncParamControls("fillColor", hex, null);
  }
    document.querySelectorAll(".zotero-swatch").forEach(node => {
    const active = normalizeHexText(node.dataset.hex || "") === hex;
    node.classList.toggle("active", active);
    node.setAttribute("aria-pressed", active ? "true" : "false");
  });
  setStatus(`正在应用 Zotero 色块：${hex}`);
  postHost({
    type: "applyZoteroSwatch",
    target,
    hex,
    baseHex: zoteroValue(swatch, "baseHex", "BaseHex", ""),
    variant: zoteroValue(swatch, "variant", "Variant", ""),
    role: zoteroValue(swatch, "role", "Role", ""),
    sourceTitle: zoteroValue(swatch, "sourceTitle", "SourceTitle", ""),
    imageId: zoteroValue(swatch, "imageId", "ImageId", "")
  });
}

function copyZoteroSwatchHex(hex) {
  setStatus(`正在复制色块 HEX：${hex}`);
  postHost({ type: "copyZoteroSwatchHex", hex });
}

function requestZoteroImages(force = false) {
  const query = String(state.zoteroQuery ?? "");
  if (zoteroImageRequestInFlight) {
    queuedZoteroImageQuery = query;
    queuedZoteroImageForce = queuedZoteroImageForce || Boolean(force);
    return;
  }
  zoteroImageRequestInFlight = true;
  zoteroImageRequestQuery = query;
  queuedZoteroImageQuery = null;
  queuedZoteroImageForce = false;
  postHost({ type: "listZoteroImages", query });
}

function completeZoteroImageRequest() {
  const completedQuery = zoteroImageRequestQuery;
  zoteroImageRequestInFlight = false;
  zoteroImageRequestQuery = null;
  const query = queuedZoteroImageQuery;
  const force = queuedZoteroImageForce;
  queuedZoteroImageQuery = null;
  queuedZoteroImageForce = false;
  if (query !== null && (force || query !== completedQuery)) {
    requestZoteroImages(force);
  }
}

function zoteroResponseQuery(message) {
  if (Object.prototype.hasOwnProperty.call(message, "query")) return String(message.query ?? "");
  if (Object.prototype.hasOwnProperty.call(message, "requestQuery")) return String(message.requestQuery ?? "");
  return null;
}

function isStaleZoteroLibraryResponse(message) {
  const responseQuery = zoteroResponseQuery(message);
  if (responseQuery === null) return false;
  return responseQuery !== String(state.zoteroQuery ?? "");
}

function normalizeHexText(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toUpperCase()}`;
  return "#000000";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function zlkImportSourcePath(file) {
  return String(file?.webkitRelativePath || file?.name || "未知文件");
}

function zlkImportExtension(sourcePath) {
  const name = String(sourcePath || "").split(/[\\/]/).pop() || "";
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function filterZlkChartFilesForImport(fileList) {
  const candidates = Array.from(fileList ?? []).filter(file => file && typeof file.text === "function");
  const selected = [];
  const errors = [];
  let skippedUnsupported = 0;
  let skippedLarge = 0;
  for (const file of candidates) {
    const sourcePath = zlkImportSourcePath(file);
    const extension = zlkImportExtension(sourcePath);
    if (!ZLK_IMPORT_SUPPORTED_EXTENSIONS.has(extension)) {
      skippedUnsupported += 1;
      continue;
    }
    if (Number(file.size || 0) > ZLK_IMPORT_MAX_FILE_BYTES) {
      skippedLarge += 1;
      if (errors.length < 3) errors.push(`${sourcePath}: 文件超过 2MB，已跳过。请导出轻量 JSON/CSV/Markdown/TeX 结果。`);
      continue;
    }
    if (selected.length < ZLK_IMPORT_MAX_FILES) {
      selected.push(file);
    }
  }
  if (skippedUnsupported) errors.push(`已跳过 ${skippedUnsupported} 个非 JSON/CSV/Markdown/TeX 文件，避免扫描 raw dataset、checkpoint 或日志全文。`);
  if (skippedLarge && errors.length < 4) errors.push(`已跳过 ${skippedLarge} 个超过 2MB 的文件，避免一次性读入过大内容。`);
  if (candidates.length > selected.length + skippedUnsupported + skippedLarge) {
    errors.push(`一次最多导入 ${ZLK_IMPORT_MAX_FILES} 个轻量结果文件，其余文件已跳过。`);
  }
  return { files: selected, errors };
}

async function handleZlkChartFiles(fileList) {
  const { files, errors } = filterZlkChartFilesForImport(fileList);
  if (!files.length) {
    state.chartImportError = errors[0] || "没有选择可读取的轻量结果文件。请选择 JSON、CSV、Markdown 或 LaTeX 表格文件。";
    renderChartImportPanel();
    setStatus(state.chartImportError, true);
    return;
  }
  setStatus(`正在识别 ${files.length} 个轻量科研绘图文件...`);
  const imported = [];
  for (const file of files) {
    const sourcePath = zlkImportSourcePath(file);
    try {
      const text = await file.text();
      const dataset = importZlkClusterResultFile(sourcePath, text);
      imported.push(dataset);
      if (dataset.errors?.length) errors.push(`${sourcePath}: ${dataset.errors[0]}`);
    } catch (error) {
      errors.push(`${sourcePath}: ${error?.message || error}`);
    }
  }
  state.chartDatasets = imported;
  if (els.chartPresetShell && imported.length) els.chartPresetShell.open = true;
  resetResourceRenderWindows("chart");
  state.chartImportError = errors[0] || "";
  state.searchScope = "chart";
  persistSetting("roughPptSearchScope", state.searchScope);
  render();
  focusPanel("charts");
  const points = imported.reduce((sum, dataset) => sum + (dataset.points?.length ?? 0), 0);
  setStatus(errors.length ? `已导入 ${imported.length} 个文件，${points} 个点；有 ${errors.length} 个字段提示。` : `已导入 ${imported.length} 个文件，${points} 个可绘图点。`, Boolean(errors.length && !points));
  renderChartImportPanel();
}

function zlkDatasetForHost(filePath, content) {
  const dataset = importZlkClusterResultFile(filePath, content);
  const pointForHost = point => ({
    Id: point.id ?? "",
    Label: point.label ?? "",
    X: point.x ?? "",
    Y: Number.isFinite(Number(point.y)) ? Number(point.y) : null,
    Method: point.method ?? "",
    Dataset: point.dataset ?? "",
    Split: point.split ?? "",
    Fold: point.fold ?? "",
    Seed: point.seed ?? "",
    Metric: point.metric ?? "",
    Value: Number.isFinite(Number(point.value)) ? Number(point.value) : null,
    Mean: Number.isFinite(Number(point.mean)) ? Number(point.mean) : null,
    Std: Number.isFinite(Number(point.std)) ? Number(point.std) : null,
    Ci: point.ci ?? null,
    PValue: Number.isFinite(Number(point.pValue)) ? Number(point.pValue) : null,
    AdjustedPValue: Number.isFinite(Number(point.adjustedPValue)) ? Number(point.adjustedPValue) : null,
    Significant: typeof point.significant === "boolean" ? point.significant : null,
    CaseId: point.case_id ?? "",
    PatientId: point.patient_id ?? "",
    Subgroup: point.subgroup ?? "",
    ErrorType: point.error_type ?? "",
    SourcePath: point.sourcePath ?? filePath
  });
  return {
    SchemaVersion: dataset.schemaVersion ?? 1,
    Source: {
      Path: dataset.source?.path ?? filePath,
      Kind: dataset.source?.kind ?? "",
      Type: dataset.source?.type ?? "",
      Confidence: dataset.source?.confidence ?? 0
    },
    Fields: Array.isArray(dataset.fields) ? dataset.fields : [],
    Rows: Array.isArray(dataset.rows) ? dataset.rows : [],
    Points: Array.isArray(dataset.points) ? dataset.points.map(pointForHost) : [],
    Series: Array.isArray(dataset.series) ? dataset.series.map(series => ({
      Id: series.id ?? "",
      Label: series.label ?? "",
      Metric: series.metric ?? "",
      Dataset: series.dataset ?? "",
      Split: series.split ?? "",
      Points: Array.isArray(series.points) ? series.points.map(pointForHost) : []
    })) : [],
    Recommendations: Array.isArray(dataset.recommendations) ? dataset.recommendations.map(item => ({
      ChartType: item.chartType ?? "",
      Title: item.title ?? "",
      Reason: item.reason ?? "",
      Priority: Number(item.priority ?? 0)
    })) : [],
    Errors: Array.isArray(dataset.errors) ? dataset.errors : [],
    Warnings: Array.isArray(dataset.warnings) ? dataset.warnings : []
  };
}

function toHostZlkDataset(dataset = {}) {
  const pointForHost = point => ({
    Id: point.id ?? "",
    Label: point.label ?? "",
    X: point.x ?? "",
    Y: Number.isFinite(Number(point.y)) ? Number(point.y) : null,
    Method: point.method ?? "",
    Dataset: point.dataset ?? "",
    Split: point.split ?? "",
    Fold: point.fold ?? "",
    Seed: point.seed ?? "",
    Metric: point.metric ?? "",
    Value: Number.isFinite(Number(point.value)) ? Number(point.value) : null,
    Mean: Number.isFinite(Number(point.mean)) ? Number(point.mean) : null,
    Std: Number.isFinite(Number(point.std)) ? Number(point.std) : null,
    Ci: point.ci ?? null,
    PValue: Number.isFinite(Number(point.pValue)) ? Number(point.pValue) : null,
    AdjustedPValue: Number.isFinite(Number(point.adjustedPValue)) ? Number(point.adjustedPValue) : null,
    Significant: typeof point.significant === "boolean" ? point.significant : null,
    CaseId: point.case_id ?? point.caseId ?? "",
    PatientId: point.patient_id ?? point.patientId ?? "",
    Subgroup: point.subgroup ?? "",
    ErrorType: point.error_type ?? point.errorType ?? "",
    SourcePath: point.sourcePath ?? dataset.source?.path ?? ""
  });
  return {
    SchemaVersion: dataset.schemaVersion ?? 1,
    Source: {
      Path: dataset.source?.path ?? "",
      Kind: dataset.source?.kind ?? "",
      Type: dataset.source?.type ?? "",
      Confidence: dataset.source?.confidence ?? 0
    },
    Fields: Array.isArray(dataset.fields) ? dataset.fields : [],
    Rows: Array.isArray(dataset.rows) ? dataset.rows : [],
    Points: Array.isArray(dataset.points) ? dataset.points.map(pointForHost) : [],
    Series: Array.isArray(dataset.series) ? dataset.series.map(series => ({
      Id: series.id ?? "",
      Label: series.label ?? "",
      Metric: series.metric ?? "",
      Dataset: series.dataset ?? "",
      Split: series.split ?? "",
      Points: Array.isArray(series.points) ? series.points.map(pointForHost) : []
    })) : [],
    Recommendations: Array.isArray(dataset.recommendations) ? dataset.recommendations.map(item => ({
      ChartType: item.chartType ?? "",
      Title: item.title ?? "",
      Reason: item.reason ?? "",
      Priority: Number(item.priority ?? 0)
    })) : [],
    Errors: Array.isArray(dataset.errors) ? dataset.errors : [],
    Warnings: Array.isArray(dataset.warnings) ? dataset.warnings : []
  };
}

function normalizeZlkRequestForHost(request = null) {
  const value = request ?? {};
  const target = value.target ?? value.Target ?? {};
  const markdownSummary = value.markdownSummary ?? value.MarkdownSummary ?? null;
  return {
    SchemaVersion: value.schemaVersion ?? value.SchemaVersion ?? 1,
    RequestId: value.requestId ?? value.RequestId ?? "",
    ProjectRoot: value.projectRoot ?? value.ProjectRoot ?? "",
    SourcePaths: value.sourcePaths ?? value.SourcePaths ?? [],
    PlottingContractPath: value.plottingContractPath ?? value.PlottingContractPath ?? "",
    SelectedResultId: value.selectedResultId ?? value.SelectedResultId ?? "",
    RunKey: value.runKey ?? value.RunKey ?? "",
    ArchiveKey: value.archiveKey ?? value.ArchiveKey ?? "",
    ChartType: value.chartType ?? value.ChartType ?? "auto",
    StyleMode: value.styleMode ?? value.StyleMode ?? "activePpt",
    SourceLabel: value.sourceLabel ?? value.SourceLabel ?? "",
    MarkdownSummary: markdownSummary ? {
      Path: markdownSummary.path ?? markdownSummary.Path ?? "",
      Text: String(markdownSummary.text ?? markdownSummary.Text ?? "").slice(0, 24000)
    } : null,
    Target: {
      PresentationPath: target.presentationPath ?? target.PresentationPath ?? "",
      CreateIfMissing: Boolean(target.createIfMissing ?? target.CreateIfMissing),
      SlideMode: target.slideMode ?? target.SlideMode ?? "append"
    }
  };
}

function insertZlkChartDataset(dataset, recommendation = null, request = null) {
  const chartSpec = zlkChartSpecFor(dataset, recommendation?.chartType ?? request?.chartType ?? request?.ChartType ?? "auto", recommendation);
  setStatus(`正在插入 SimpleExperiment 图表：${chartSpec.Title}`);
  postHost({
    type: "insertZlkChart",
    requestId: request?.requestId ?? request?.RequestId ?? "",
    request: normalizeZlkRequestForHost(request),
    dataset: toHostZlkDataset(dataset),
    chartSpec
  });
}

async function normalizeZlkChartFilesForHost(request, files) {
  const imported = [];
  const errors = [];
  for (const file of Array.isArray(files) ? files : []) {
    const sourcePath = file.sourcePath ?? file.SourcePath ?? file.fullPath ?? file.FullPath ?? "未知路径";
    const content = file.content ?? file.Content ?? "";
    try {
      const dataset = importZlkClusterResultFile(sourcePath, content);
      if (!dataset.recommendations?.length) dataset.recommendations = buildChartRecommendations(dataset);
      imported.push(dataset);
      if (dataset.errors?.length) errors.push(`${sourcePath}: ${dataset.errors[0]}`);
    } catch (error) {
      errors.push(`${sourcePath}: ${error?.message || error}`);
    }
  }

  const selected = chooseZlkDataset(imported, request?.chartType ?? request?.ChartType ?? "auto");
  if (!selected) {
    throw new Error(errors[0] || "未识别到可绘图数据。请检查 method、metric、value、mean、std、case_id、subgroup 或 error_type 字段。");
  }

  state.chartDatasets = imported;
  if (els.chartPresetShell && imported.length) els.chartPresetShell.open = true;
  resetResourceRenderWindows("chart");
  state.chartImportError = errors[0] || "";
  state.searchScope = "chart";
  persistSetting("roughPptSearchScope", state.searchScope);
  state.zlkAutomationStatus = `已归一化外部请求：${imported.length} 个文件，准备绘图。`;
  render();
  return {
    dataset: selected,
    chartSpec: zlkChartSpecFor(selected, request?.chartType ?? request?.ChartType ?? "auto"),
    errors
  };
}

function chooseZlkDataset(datasets, requestedChartType = "auto") {
  const candidates = (datasets ?? []).filter(dataset => (dataset.points?.length ?? 0) > 0 || (dataset.rows?.length ?? 0) > 0);
  if (!candidates.length) return null;
  if (requestedChartType && requestedChartType !== "auto") {
    return candidates.find(dataset => (dataset.recommendations ?? []).some(item => item.chartType === requestedChartType)) ?? candidates[0];
  }

  return candidates
    .map(dataset => ({ dataset, priority: Math.max(0, ...(dataset.recommendations ?? []).map(item => item.priority ?? 0)) }))
    .sort((left, right) => right.priority - left.priority)[0]?.dataset ?? candidates[0];
}

function zlkChartSpecFor(dataset, requestedChartType = "auto", recommendation = null) {
  const selected = recommendation ?? (requestedChartType && requestedChartType !== "auto"
    ? (dataset.recommendations ?? []).find(item => item.chartType === requestedChartType)
    : (dataset.recommendations ?? [])[0]);
  const chartType = requestedChartType && requestedChartType !== "auto" ? requestedChartType : selected?.chartType ?? "genericTable";
  return {
    ChartType: chartType,
    Title: selected?.title ?? zlkChartTypeTitle(chartType),
    Reason: selected?.reason ?? "自动选择可绘图数据。"
  };
}

function chartRecommendationTooltip(recommendation = {}) {
  const preset = RESEARCH_CHART_PRESETS.find(item => item.chartType === recommendation.chartType);
  const role = preset ? preset.tooltip : "根据字段自动推荐的科研图表类型。";
  return (recommendation.title || "图表") + "：" + (recommendation.reason || role) + " " + role;
}

function zlkChartTypeTitle(chartType) {
  const titles = {
    meanStdErrorBar: "均值误差图",
    leaderboardBar: "排行榜柱状图",
    sensitivityCurve: "敏感性曲线",
    subgroupComparison: "亚组对比图",
    caseLevelDistribution: "病例级分布图",
    errorTypeSummary: "错误类型汇总图",
    significanceSummary: "显著性标注图",
    scatterPlot: "散点对比图",
    genericTable: "结果表格"
  };
  return titles[chartType] ?? "结果表格";
}

function renderUserAssets() {
  const assets = filteredAssets();
  const libraryPanel = els.userAssets?.closest(".library-panel");
  if (libraryPanel) libraryPanel.dataset.assetView = assets.length ? "populated" : "empty";
  pruneSelectedAssets();
  const selectedAssets = assets.filter(asset => state.selectedAssetIds.has(asset.Id));
  const selectedInFilter = selectedAssets.length;
  const exportCount = selectedInFilter || assets.length;
  setSummaryBadge(
    els.assetCount,
    selectedInFilter
      ? `${assets.length} 个 | 已选 ${selectedInFilter} 个`
      : `${assets.length} 个 | 可分享 ${assets.length}`,
    selectedInFilter
      ? `当前筛选 ${assets.length} 个素材，已勾选 ${selectedInFilter} 个可导出分享`
      : `当前筛选 ${assets.length} 个素材；未勾选时分享会导出全部筛选结果`,
    selectedInFilter ? "ok" : (assets.length ? "ready" : "idle")
  );
  if (els.selectAssets) {
    const allFilteredSelected = assets.length > 0 && assets.every(asset => state.selectedAssetIds.has(asset.Id));
    els.selectAssets.disabled = assets.length === 0;
    els.selectAssets.lastChild.textContent = allFilteredSelected ? "清空" : "全选";
    els.selectAssets.title = assets.length === 0
      ? "当前没有可选择的素材"
      : allFilteredSelected
        ? "取消勾选当前筛选出的全部素材"
        : "勾选当前筛选出的全部素材，便于只分享选中素材";
    els.selectAssets.setAttribute("aria-label", els.selectAssets.title);
  }
  if (els.exportAssets) {
    els.exportAssets.disabled = exportCount === 0;
    els.exportAssets.title = exportCount === 0
      ? "没有可分享的素材；请先保存或筛选素材"
      : selectedInFilter
        ? `把已勾选的 ${selectedInFilter} 个素材导出为体积受控的 zip 分享包`
        : `未勾选时导出当前筛选中的 ${assets.length} 个素材为 zip 分享包`;
    els.exportAssets.setAttribute("aria-label", els.exportAssets.title);
  }
  if (els.importAssets) {
    els.importAssets.title = "从安全 zip 分享素材包导入 PPT 原生素材；自动按原生模板内容跳过重复项";
    els.importAssets.setAttribute("aria-label", els.importAssets.title);
  }
  els.userAssets.innerHTML = "";
  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "asset-empty";
    empty.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = state.userAssets.length ? "没有匹配当前搜索的素材" : "还没有保存的素材";
    title.title = "素材库保存的是 PPT 原生可编辑对象，不是图片截图";
    const detail = document.createElement("span");
    detail.textContent = state.userAssets.length
      ? "可清空搜索词，或导入已有素材分享包。"
      : "先在 PowerPoint 选择对象并保存，也可直接导入素材分享包。";
    detail.title = "用户素材会跨 PPT 文件保存，并可导出为体积受控的 zip 分享包";
    const actions = document.createElement("div");
    actions.className = "asset-empty-actions";
    if (!state.userAssets.length) {
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "去保存素材";
      saveBtn.title = "定位到当前选区的保存按钮，把 PPT 原生对象加入素材库";
      saveBtn.addEventListener("click", () => {
        focusPanel("selection");
        window.setTimeout(() => els.save?.focus({ preventScroll: true }), 260);
        setStatus("已定位保存素材：请先在 PowerPoint 中选中对象，再点击保存。");
      });
      actions.append(saveBtn);
    } else {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "清空搜索";
      clearBtn.title = "清空当前搜索词并显示全部素材";
      clearBtn.addEventListener("click", () => {
        if (els.search) {
          els.search.value = "";
          state.query = "";
          render();
          setStatus("已清空搜索，显示全部素材。");
        }
      });
      actions.append(clearBtn);
    }
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "导入素材包";
    importBtn.title = "从安全 zip 分享素材包导入 PPT 原生素材；自动按原生模板内容跳过重复项";
    importBtn.addEventListener("click", () => els.importAssets?.click());
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.textContent = "刷新素材";
    refreshBtn.title = "重新读取本机素材库";
    refreshBtn.addEventListener("click", () => els.reloadAssets?.click());
    actions.append(importBtn, refreshBtn);
    empty.append(title, detail, actions);
    empty.title = "先在 PowerPoint 中选择对象，再点击“保存”加入素材库；也可导入或刷新素材包";
    els.userAssets.append(empty);
    return;
  }

  const visibleCount = Math.max(resourceBatchFor(USER_ASSET_RENDER_BATCH), state.userAssetVisibleCount || resourceBatchFor(USER_ASSET_RENDER_BATCH));
  const visibleAssets = assets.slice(0, visibleCount);
  for (const asset of visibleAssets) {
    const card = document.createElement("div");
    card.className = `asset-card${state.selectedAssetIds.has(asset.Id) ? " selected" : ""}`;
    card.title = `${asset.DisplayName ?? asset.Id}：使用“插入”“选择”“删除”按钮管理此 PPT 原生素材`;
    const thumbnail = createAssetThumbnail(asset);
    thumbnail.title = "素材预览，插入后仍为 PPT 原生可编辑对象";
    const selectRow = document.createElement("span");
    selectRow.className = "asset-select-row";
    const select = document.createElement("input");
    select.type = "checkbox";
    select.className = "asset-select";
    select.checked = state.selectedAssetIds.has(asset.Id);
    select.title = `${asset.DisplayName ?? asset.Id}：勾选后导出分享素材包时包含此素材`;
    select.setAttribute("aria-label", `选择素材 ${asset.DisplayName ?? asset.Id}`);
    select.addEventListener("click", event => {
      event.stopPropagation();
      toggleAssetSelection(asset.Id, select.checked);
    });
    select.addEventListener("keydown", event => event.stopPropagation());
    const name = document.createElement("span");
    name.className = "shape-name";
    name.textContent = asset.DisplayName ?? asset.Id;
    selectRow.append(name, select);
    const meta = document.createElement("span");
    meta.className = "shape-meta";
    meta.textContent = `${asset.ShapeCount ?? 0} \u4e2a\u539f\u751f\u5bf9\u8c61`;
    meta.title = "素材由 PPT 原生对象组成，插入后可继续编辑";
    const actions = document.createElement("span");
    actions.className = "asset-card-actions";
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "asset-insert";
    insert.append(createFunctionIcon("insert", "insertUserAsset"), document.createTextNode("插入"));
    insert.title = `${asset.DisplayName ?? asset.Id}：插入保存的 PPT 原生素材`;
    insert.setAttribute("aria-label", `插入素材 ${asset.DisplayName ?? asset.Id}`);
    insert.addEventListener("click", event => {
      event.stopPropagation();
      setStatus(`正在插入已保存素材：${asset.DisplayName ?? asset.Id}`);
      postHost({ type: "insertUserAsset", assetId: asset.Id });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "asset-delete";
    remove.append(createFunctionIcon("trash", "deleteUserAsset"), document.createTextNode("删除"));
    remove.title = `${asset.DisplayName ?? asset.Id}：从本机素材库删除此素材及缩略图`;
    remove.dataset.danger = "true";
    remove.classList.add("danger-action");
    remove.setAttribute("aria-label", `删除素材 ${asset.DisplayName ?? asset.Id}`);
    remove.addEventListener("click", event => {
      event.stopPropagation();
      showInlinePrompt({
        title: "删除素材",
        message: `确认删除素材“${asset.DisplayName ?? asset.Id}”？删除后需要重新从 PPT 选区保存。`,
        danger: true,
        confirmLabel: "删除",
        cancelStatus: "已取消删除素材。",
        onConfirm: () => {
          setStatus(`正在删除素材：${asset.DisplayName ?? asset.Id}`);
          postHost({ type: "deleteUserAsset", assetId: asset.Id });
        }
      });
    });
    remove.addEventListener("keydown", event => event.stopPropagation());
    actions.append(insert, remove);
    card.append(thumbnail, selectRow, meta, actions);
    els.userAssets.append(card);
  }
  if (assets.length > visibleAssets.length) {
    els.userAssets.append(renderResourceLoadMore("素材", assets.length - visibleAssets.length, "继续显示我的素材卡片", () => {
      state.userAssetVisibleCount = Math.min(assets.length, visibleCount + resourceBatchFor(USER_ASSET_RENDER_BATCH));
      renderUserAssets();
    }));
  }
}

function toggleAssetSelection(assetId, selected) {
  if (!assetId) return;
  if (selected) state.selectedAssetIds.add(assetId);
  else state.selectedAssetIds.delete(assetId);
  renderUserAssets();
}

function pruneSelectedAssets() {
  const existing = new Set(state.userAssets.map(asset => asset.Id).filter(Boolean));
  for (const assetId of [...state.selectedAssetIds]) {
    if (!existing.has(assetId)) state.selectedAssetIds.delete(assetId);
  }
}

function exportAssetIds() {
  const filtered = filteredAssets().map(asset => asset.Id).filter(Boolean);
  const selected = filtered.filter(assetId => state.selectedAssetIds.has(assetId));
  return selected.length ? selected : filtered;
}

function renderQuickShapes() {
  if (!els.quickShapes) return;
  els.quickShapes.innerHTML = "";
  const items = effectiveQuickShapes()
    .map(enumName => hydrateQuickShape(enumName))
    .filter(item => item.insertable !== false);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "quick-empty";
    empty.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "快速插入栏还没有常用形状";
    title.title = "快速插入栏会复用形状图库同一套预览图，并同步到顶部 Ribbon";
    const detail = document.createElement("span");
    detail.textContent = "点击“添加”打开图标库固定形状，或刷新本机已保存的快速插入列表。";
    detail.title = "添加后可在顶部和右侧快速插入栏一键插入 PPT 原生手绘形状";
    const actions = document.createElement("div");
    actions.className = "quick-empty-actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "添加形状";
    addBtn.title = "打开紧凑图标库，选择要固定到快速插入栏的形状";
    addBtn.addEventListener("click", () => {
      if (els.quickShapeDropdown?.hidden) toggleQuickShapeDropdown();
      els.quickAddToggle?.focus({ preventScroll: true });
      setStatus("已打开快速插入添加图库，选择常用形状即可固定。");
    });
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.textContent = "刷新列表";
    refreshBtn.title = "重新读取本机保存的快速插入形状";
    refreshBtn.addEventListener("click", () => els.reloadQuickShapes?.click());
    actions.append(addBtn, refreshBtn);
    empty.append(title, detail, actions);
    empty.title = "快速插入栏会使用形状图库内同一套预览图。";
    els.quickShapes.append(empty);
    return;
  }

  for (const item of items) {
    const wrapper = document.createElement("span");
    wrapper.className = "quick-shape-item";
    wrapper.title = displayName(item);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-shape";
    button.title = displayName(item);
    button.setAttribute("aria-label", displayName(item));
    button.append(renderGalleryIcon(item, els.quickShapes, { eager: true }));
    button.addEventListener("click", () => insertShape(item));
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      openQuickShapeContextMenu(event, item, "remove");
    });
    button.addEventListener("keydown", event => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        event.stopPropagation();
        openQuickShapeContextMenu(event, item, "remove");
      }
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quick-shape-remove danger-action";
    remove.dataset.danger = "true";
    remove.append(iconSpan("\u00d7"));
    remove.title = `从快速插入栏移除 ${displayName(item)}`;
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", event => {
      event.stopPropagation();
      confirmUnpinQuickShape(item);
    });

    wrapper.append(button, remove);
    els.quickShapes.append(wrapper);
  }
}

function openQuickShapeContextMenu(event, item, mode = "remove") {
  if (!els.quickShapeContextMenu || !item?.enumName) return;
  els.quickShapeContextMenu.innerHTML = "";
  const pinned = isQuickShape(item.enumName);
  const title = document.createElement("div");
  title.className = "quick-shape-context-title";
  title.textContent = displayName(item);
  title.title = displayName(item);
  const action = document.createElement("button");
  action.type = "button";
  action.setAttribute("role", "menuitem");
  const shouldRemove = mode === "remove" || pinned;
  action.textContent = shouldRemove ? "从快速插入移除" : "添加到快速插入";
  action.classList.toggle("danger-action", shouldRemove);
  action.dataset.danger = shouldRemove ? "true" : "false";
  action.title = shouldRemove ? `从快速插入栏移除 ${displayName(item)}` : `固定 ${displayName(item)} 到快速插入栏`;
  action.setAttribute("aria-label", action.title);
  action.dataset.armed = "false";
  action.addEventListener("click", () => {
    if (action.dataset.armed !== "true") return;
    closeQuickShapeContextMenu();
    if (shouldRemove) confirmUnpinQuickShape(item);
    else pinQuickShape(item.enumName);
  });
  els.quickShapeContextMenu.append(title, action);
  // 防止右键松手点穿到危险按钮
  if (quickShapeContextArmTimer) window.clearTimeout(quickShapeContextArmTimer);
  quickShapeContextArmTimer = window.setTimeout(() => {
    quickShapeContextArmTimer = 0;
    action.dataset.armed = "true";
  }, 220);
  const sourceRect = event.currentTarget?.getBoundingClientRect?.();
  const fallbackX = sourceRect ? sourceRect.left : 16;
  const fallbackY = sourceRect ? sourceRect.bottom : 16;
  const rawX = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : fallbackX;
  const rawY = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : fallbackY;
  const x = Math.min(rawX, window.innerWidth - 150);
  const y = Math.min(rawY, window.innerHeight - 72);
  els.quickShapeContextMenu.style.left = `${Math.max(8, x)}px`;
  els.quickShapeContextMenu.style.top = `${Math.max(8, y)}px`;
  els.quickShapeContextMenu.hidden = false;
  action.focus({ preventScroll: true });
}

function hydrateQuickShape(enumName) {
  const catalogItem = state.catalog.find(item => item.enumName === enumName);
  const detail = state.quickShapeDetails[enumName] ?? {};
  return {
    ...(catalogItem ?? {}),
    ...detail,
    enumName,
    displayNameZh: catalogItem?.displayNameZh ?? detail.displayName ?? detail.displayNameZh ?? enumName,
    category: catalogItem?.category ?? detail.category ?? categoryFromEnum(enumName),
    defaultSizePt: catalogItem?.defaultSizePt ?? detail.defaultSizePt ?? defaultSizeForEnum(enumName),
    insertable: catalogItem?.insertable ?? true
  };
}

function closeQuickShapeContextMenu() {
  if (els.quickShapeContextMenu) els.quickShapeContextMenu.hidden = true;
}

function createAssetThumbnail(asset) {
  if (asset.ThumbnailDataUrl) {
    const image = document.createElement("img");
    image.className = "asset-thumb";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = asset.ThumbnailDataUrl;
    return image;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "asset-thumb";
  canvas.width = 160;
  canvas.height = 96;
  drawAssetPlaceholder(canvas, asset);
  return canvas;
}

function drawAssetPlaceholder(canvas, asset) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fbfbfa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#b9b9b2";
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  const count = Math.max(1, Math.min(4, Number(asset.ShapeCount ?? 1)));
  for (let i = 0; i < count; i++) {
    const x = 26 + i * 16;
    const y = 24 + i * 7;
    drawPreviewShape(ctx, x, y, 82, 38, i);
  }
}

function drawPreviewShape(ctx, x, y, width, height, index) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = index % 2 ? "#0b6bcb" : "#151515";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(width - 4, 0);
  ctx.lineTo(width, height - 5);
  ctx.lineTo(5, height);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function rememberRecent(enumName) {
  state.recent = [enumName, ...state.recent.filter(item => item !== enumName)].slice(0, 12);
  persistSetting("roughPptRecentShapes", JSON.stringify(state.recent));
  render();
}

function toggleFavorite(enumName) {
  const item = state.catalog.find(shape => shape.enumName === enumName) ?? { enumName };
  toggleQuickShape(item);
}

function isQuickShape(enumName) {
  return effectiveQuickShapes().includes(enumName);
}

function effectiveQuickShapes() {
  if (state.quickShapesLoaded) return state.quickShapes;
  if (state.quickShapes.length) return state.quickShapes;
  if (state.favorites.length) return state.favorites;
  return defaultQuickShapeEnums();
}

function defaultQuickShapeEnums() {
  return [
    "msoShapeLine",
    "msoShapeLineArrow",
    "msoShapeRectangle",
    "msoShapeOval",
    "msoShapeRoundedRectangle",
    "msoShapeRightArrow"
  ];
}

function toggleQuickShape(item) {
  if (!item?.enumName) return;
  if (isQuickShape(item.enumName)) {
    confirmUnpinQuickShape(item);
  } else {
    pinQuickShape(item.enumName);
  }
}

function pinQuickShape(enumName) {
  if (!enumName) {
    setStatus("请先在添加图库中选择一个形状。", true);
    return;
  }
  state.quickShapes = [enumName, ...effectiveQuickShapes().filter(item => item !== enumName)].slice(0, 12);
  state.quickShapesLoaded = true;
  state.favorites = [...state.quickShapes];
  persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
  render();
  postHost({ type: "pinQuickShape", enumName });
}


function confirmUnpinQuickShape(itemOrEnum, display = "") {
  const enumName = typeof itemOrEnum === "string" ? itemOrEnum : itemOrEnum?.enumName;
  if (!enumName) return;
  const label = display || (typeof itemOrEnum === "object" && itemOrEnum ? displayName(itemOrEnum) : enumName);
  showInlinePrompt({
    title: "移除快速插入",
    message: "确定从快速插入栏移除「" + label + "」吗？仅影响常用栏，不会删除已插入的幻灯片对象。",
    danger: true,
    confirmLabel: "移除",
    cancelStatus: "已取消移除快速插入。",
    onConfirm: () => unpinQuickShape(enumName)
  });
}

function unpinQuickShape(enumName) {
  state.quickShapes = effectiveQuickShapes().filter(item => item !== enumName);
  state.quickShapesLoaded = true;
  state.favorites = [...state.quickShapes];
  persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
  render();
  postHost({ type: "unpinQuickShape", enumName });
}

function sortItems(a, b) {
  if (state.sortMode === "az") return displayName(a).localeCompare(displayName(b));
  if (state.sortMode === "recent") return recentRank(a.enumName) - recentRank(b.enumName) || displayName(a).localeCompare(displayName(b));
  if (state.sortMode === "favorites") return favoriteRank(a.enumName) - favoriteRank(b.enumName) || displayName(a).localeCompare(displayName(b));
  return commonRank(a.enumName) - commonRank(b.enumName) || favoriteRank(a.enumName) - favoriteRank(b.enumName) || recentRank(a.enumName) - recentRank(b.enumName) || displayName(a).localeCompare(displayName(b));
}

function recentRank(enumName) {
  const index = state.recent.indexOf(enumName);
  return index < 0 ? 10000 : index;
}

function favoriteRank(enumName) {
  const index = state.favorites.indexOf(enumName);
  return index < 0 ? 10000 : index;
}

function commonRank(enumName) {
  const order = [
    "msoShapeLine",
    "msoShapeLineArrow",
    "msoShapeRectangle",
    "msoShapeRoundedRectangle",
    "msoShapeOval",
    "msoShapeDoubleOval",
    "msoShapeDiamond",
    "msoShapeTriangle",
    "msoShapeRightTriangle",
    "msoShapeTrapezoid",
    "msoShapeParallelogram",
    "msoShapeHexagon",
    "msoShapeDashedRectangle",
    "msoShapeRightArrow",
    "msoShapeDownArrow",
    "msoShapeLeftRightArrow",
    "msoShapeFlowchartProcess",
    "msoShapeFlowchartDecision",
    "msoShapeFlowchartTerminator",
    "msoShapeFlowchartData",
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
  ];
  const index = order.indexOf(enumName);
  return index < 0 ? 10000 : index;
}

function displayName(item) {
  if (item.displayNameZh) return item.displayNameZh;
  const name = item.displayName || item.enumName.replace(/^msoShape/, "");
  return shapeNameLabel(name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
}

function shapeNameLabel(name) {
  const labels = {
    Line: "直线",
    "Line Arrow": "直线箭头",
    Rectangle: "矩形",
    "Rounded Rectangle": "圆角矩形",
    Oval: "椭圆",
    Diamond: "菱形",
    Triangle: "三角形",
    Trapezoid: "梯形",
    "Right Arrow": "右箭头"
  };
  return labels[name] ?? name;
}

function categoryLabel(category) {
  const labels = {
    all: "\u5168\u90e8",
    basic: "\u57fa\u7840",
    lines: "\u7ebf\u6761",
    arrows: "\u7bad\u5934",
    rectangles: "\u77e9\u5f62",
    flowchart: "\u6d41\u7a0b\u56fe",
    callouts: "\u6807\u6ce8",
    "stars-and-banners": "\u661f\u4e0e\u65d7\u5e1c",
    "three-d": "三维对象",
    "three-d-rough": "三维对象（手绘）",
    "three-d-plain": "三维对象（普通）",
    "action-buttons": "\u52a8\u4f5c\u6309\u94ae"
  };
  return labels[category] ?? category;
}

function categoryIcon(category) {
  const icons = {
    all: "\u25a6",
    basic: "\u25cb",
    lines: "\u2571",
    arrows: "\u2192",
    rectangles: "\u25ad",
    flowchart: "\u25c7",
    callouts: "\u25a3",
    "stars-and-banners": "\u2605",
    "three-d": "\u25e9",
    "three-d-rough": "\u25e9",
    "three-d-plain": "\u25e7",
    "action-buttons": "\u25b6"
  };
  return icons[category] ?? "\u25ab";
}

function strategyLabel(strategy) {
  const labels = {
    roughPrimitive: "基础生成",
    roughPathRecipe: "轮廓配方",
    native3dRecipe: "普通三维"
  };
  return labels[strategy] ?? "轮廓配方";
}

function categoryFromEnum(enumName = "") {
  if (/^rough3d.*Plain$/i.test(enumName)) return "three-d-plain";
  if (/^rough3d/i.test(enumName)) return "three-d-rough";
  if (/Line|Connector/i.test(enumName)) return "lines";
  if (/Arrow/i.test(enumName)) return "arrows";
  if (/Rectangle|Rect/i.test(enumName)) return "rectangles";
  if (/Oval|Ellipse/i.test(enumName)) return "basic";
  return "basic";
}

function defaultSizeForEnum(enumName = "") {
  if (/Line|Connector/i.test(enumName)) return { width: 120, height: 0 };
  if (/rough3d|Cube|Cylinder|Cone|Pyramid|Stack/i.test(enumName)) return { width: 130, height: 100 };
  return { width: 120, height: 80 };
}

function fidelityLabel(fidelity) {
  return fidelity === "sentinel" ? "占位" : "精确";
}

function describeHostConnection() {
  return Boolean(window.chrome?.webview?.postMessage);
}

function postHost(message) {
  if (describeHostConnection()) {
    window.chrome.webview.postMessage(message);
    return true;
  }
  setStatus("无法连接 PowerPoint 宿主。请通过 PPT 加载项任务窗格打开本界面，不要直接用浏览器打开本地 HTML。", true);
  return false;
}


function applyFeatureBlockControls(feature) {
  if (!els.featurePanel) return;
  for (const control of els.featurePanel.querySelectorAll("[data-feature-param]")) {
    const key = control.dataset.featureParam;
    if (key in feature) {
      if (control.type === "checkbox") control.checked = Boolean(feature[key]);
      else control.value = feature[key];
    }
  }
  syncFeatureBlockModeAvailability();
  renderFeatureDirectionGuide();
}

function readFeatureBlockControls() {
  if (!els.featurePanel) return state.featureBlock;
  for (const control of els.featurePanel.querySelectorAll("[data-feature-param]")) {
    const key = control.dataset.featureParam;
    state.featureBlock[key] = control.type === "checkbox" ? control.checked : control.type === "number" ? Number(control.value) : control.value;
  }

  if (state.featureBlock.mode === "2d" && state.featureBlock.gradientDirection === "z") {
    state.featureBlock.gradientDirection = "x";
    const gradient = els.featurePanel.querySelector('[data-feature-param="gradientDirection"]');
    if (gradient) gradient.value = "x";
  }
  syncFeatureBlockModeAvailability();
  renderFeatureDirectionGuide();
  return { ...state.featureBlock };
}

function syncFeatureBlockControls(key, value, source = null) {
  if (!els.featurePanel || !key) return;
  for (const control of els.featurePanel.querySelectorAll(`[data-feature-param="${key}"]`)) {
    if (control === source) continue;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  }
}

function activateZoteroPaletteReference(image) {
  const imageId = zoteroImageId(image);
  state.activeZoteroReferenceImageId = imageId;
  state.activeZoteroReferenceTitle = zoteroImageTitle(image);
  state.activeZoteroPaletteSaved = false;
  state.zoteroPalette = { imageId, sourceTitle: state.activeZoteroReferenceTitle, swatches: [] };
  renderZoteroImagePanel();
  setStatus(`正在读取当前参考图配色：${state.activeZoteroReferenceTitle}`);
  postHost({ type: "getZoteroPalette", imageId });
}

function selectZoteroPaletteReference(image) {
  const imageId = zoteroImageId(image);
  if (!imageId || imageId === state.activeZoteroReferenceImageId) return;
  if (!state.activeZoteroReferenceImageId || state.activeZoteroPaletteSaved || state.skipReferenceChangePromptForSession) {
    activateZoteroPaletteReference(image);
    return;
  }
  showInlinePrompt({
    title: "覆盖未保存的参考图配色？",
    message: `“${state.activeZoteroReferenceTitle || "当前参考图"}”的配色尚未保存。切换到“${zoteroImageTitle(image)}”后，当前配色会被覆盖。`,
    confirmLabel: "覆盖并切换",
    cancelLabel: "继续使用当前图",
    cancelStatus: "未切换参考图，当前配色保持不变。",
    checkboxLabel: "本次 PowerPoint 会话不再询问",
    onConfirm: (_value, promptState) => {
      state.skipReferenceChangePromptForSession = Boolean(promptState?.checked);
      activateZoteroPaletteReference(image);
    }
  });
}

function syncFeatureBlockModeAvailability() {
  if (!els.featurePanel) return;
  const mode = els.featurePanel.querySelector('[data-feature-param="mode"]')?.value ?? state.featureBlock.mode;
  const is3d = mode !== "2d";
  for (const element of els.featurePanel.querySelectorAll('[data-feature-scope="3d"]')) {
    element.hidden = !is3d;
    const controls = element.matches("input, select, button") ? [element] : Array.from(element.querySelectorAll("input, select, button"));
    for (const control of controls) {
      control.disabled = !is3d;
      control.setAttribute("aria-disabled", String(!is3d));
      const label = control.closest("label");
      if (label) label.classList.toggle("disabled", !is3d);
    }
  }
  const gradient = els.featurePanel.querySelector('[data-feature-param="gradientDirection"]');
  const zOption = gradient?.querySelector('option[value="z"]');
  if (zOption) zOption.disabled = !is3d;
  if (!is3d && gradient?.value === "z") {
    gradient.value = "x";
    state.featureBlock.gradientDirection = "x";
  }
  renderFeatureDirectionGuide();
}

function renderFeatureDirectionGuide() {
  const guide = document.querySelector("[data-feature-direction-guide]");
  if (!guide) return;
  const feature = state.featureBlock ?? defaultFeatureBlock;
  const is3d = feature.mode !== "2d";
  guide.classList.toggle("is-2d", !is3d);
  for (const element of guide.querySelectorAll('[data-feature-scope="3d"]')) {
    element.hidden = !is3d;
  }
  const size = is3d
    ? `${Number(feature.countX || 1)}×${Number(feature.countY || 1)}×${Number(feature.countZ || 1)}`
    : `${Number(feature.countX || 1)}×${Number(feature.countY || 1)}`;
  setSummaryBadge(
    els.featureBlockSummary,
    `${is3d ? "三维" : "二维"} ${size}`,
    `当前${is3d ? "三维堆叠" : "二维网格"}特征块，尺寸 ${size}`,
    "feature"
  );
  syncFeatureBlockPrimaryAction();
  const center = guide.querySelector("[data-guide-center]");
  if (center) center.textContent = `尺寸 ${size}`;
  const sizeLabel = guide.querySelector("[data-feature-size]");
  if (sizeLabel) sizeLabel.textContent = `尺寸 ${size}`;
  const lastLabel = guide.querySelector("[data-feature-last]");
  if (lastLabel) lastLabel.textContent = featureDirectionText(feature.editDirection, feature.editDelta);
  for (const marker of guide.querySelectorAll("[data-guide-dir]")) {
    const active = marker.dataset.guideDir === feature.editDirection && Number(feature.editDelta || 0) !== 0;
    marker.classList.toggle("active", active);
  }
}

function featureDirectionText(direction, delta) {
  if (!direction || !Number(delta || 0)) return "方向 未选择";
  const action = Number(delta) > 0 ? "增加" : "删除";
  const labels = {
    left: "左侧列",
    right: "右侧列",
    up: "上方行",
    down: "下方行",
    front: "前方层",
    back: "后方层"
  };
  return `${action} ${labels[direction] ?? "当前方向"}`;
}

function saveFeatureBlockDefault() {
  const feature = sanitizeFeatureBlockDefault(readFeatureBlockControls());
  state.featureBlock = { ...feature };
  persistSetting("roughPptFeatureBlockDefaults", JSON.stringify(feature));
  postHost({ type: "updateFeatureBlockPreset", feature });
  postHost({ type: "saveFeatureBlockDefault", feature });
  setStatus("已保存当前特征块参数为默认。");
}

function scheduleFeatureBlockPresetSync() {
  window.clearTimeout(featurePresetTimer);
  featurePresetTimer = window.setTimeout(() => {
    postHost({ type: "updateFeatureBlockSelection", feature: readFeatureBlockControls() });
  }, 120);
}

function syncFeatureBlockPrimaryAction(forceUpdate = null) {
  if (!els.insertFeatureBlock) return;
  const mode = els.featurePanel?.querySelector('[data-feature-param="mode"]')?.value ?? state.featureBlock.mode;
  const modeLabel = mode === "2d" ? "二维" : "三维";
  const selectionPanel = document.querySelector(".selection-panel");
  const isUpdate = forceUpdate == null ? selectionPanel?.dataset.selectionKind === "feature" : Boolean(forceUpdate);
  const label = els.insertFeatureBlock.querySelector("[data-feature-primary-label]");
  if (label) label.textContent = `${isUpdate ? "更新" : "插入"}${modeLabel}特征块`;
  els.insertFeatureBlock.title = `按当前参数${isUpdate ? "替换当前选中的" : "插入"}${modeLabel} PPT 原生可编辑特征块`;
}

function syncFeatureDirectionTools(hasFeatureSelection) {
  if (!els.featureDirectionTools) return;
  const enabled = Boolean(hasFeatureSelection);
  if (!enabled) els.featureDirectionTools.open = false;
  els.featureDirectionTools.classList.toggle("is-disabled", !enabled);
  els.featureDirectionTools.title = enabled
    ? "当前已选中特征块；按需展开后可沿六个方向逐行、逐列或逐层增删"
    : "请先在 PowerPoint 中选中特征块；选中后可按需展开方向增删操作";
  const summary = els.featureDirectionTools.querySelector(":scope > summary");
  if (summary) {
    summary.setAttribute("aria-disabled", String(!enabled));
    summary.title = enabled ? "展开或收起方向增删操作" : "请先在 PowerPoint 中选中特征块";
  }
}

function syncContextualStyleEntry(kind) {
  const button = document.querySelector("#jumpToStyle");
  const label = button?.querySelector(":scope > span:last-child");
  if (!button || !label) return;
  if (kind === "normal") {
    label.textContent = "转换风格";
    button.title = "设置当前普通形状转换为手绘对象时使用的线条、填充和 Rough.js 参数";
    return;
  }
  if (kind === "rough") {
    label.textContent = "调整选区";
    button.title = "调整当前选中手绘对象的线条、填充和 Rough.js 参数，修改后实时重绘";
    return;
  }
  label.textContent = "风格参数";
  button.title = "选中普通形状或手绘对象后显示可用的风格参数";
}

function adjustFeatureBlock(editDirection, delta) {
  if ((editDirection === "front" || editDirection === "back") && state.featureBlock.mode === "2d") {
    setStatus("二维网格没有前后层，请切换到三维堆叠后再调整。", false);
    return;
  }
  const key = editDirection === "left" || editDirection === "right" ? "countX" :
    editDirection === "up" || editDirection === "down" ? "countY" :
    "countZ";
  const controls = Array.from(els.featurePanel?.querySelectorAll(`[data-feature-param="${key}"]`) ?? []);
  const control = controls.find(candidate => candidate.type === "number") ?? controls[0];
  if (!control) return;
  const featureBeforeEdit = readFeatureBlockControls();
  const min = Number(control.min || 1);
  const max = Number(control.max || 32);
  const next = Math.max(min, Math.min(max, Number(control.value || state.featureBlock[key]) + delta));
  control.value = String(next);
  syncFeatureBlockControls(key, next, control);
  state.featureBlock.editDirection = editDirection;
  state.featureBlock.editDelta = delta;
  featureDirectionInput = true;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  featureDirectionInput = false;
  postHost({
    type: "adjustFeatureBlockDirection",
    direction: editDirection,
    delta,
    feature: { ...featureBeforeEdit, editDirection, editDelta: delta }
  });
  setStatus(`正在直接更新选中特征块：${featureDirectionText(editDirection, delta)}`);
}

function render() {
  renderSearchScopeControls();
  renderCategories();
  renderSearchSuggestions();
  renderCommandResults();
  renderStyleQuickActions();
  renderPaperPresetFilters();
  renderPaperPresets();
  renderChartImportPanel();
  renderZoteroImagePanel();
  renderPaletteLibrary();
  if (!els.shapeDropdown.hidden) renderShapeDropdown();
  if (!els.quickShapeDropdown.hidden) renderQuickShapeDropdown();
  const items = filteredItems();
  setSummaryBadge(
    els.count,
    `${items.length} 个形状`,
    items.length ? `当前筛选后可插入的手绘形状数量：${items.length}` : "当前筛选下没有可显示的形状",
    items.length ? "ok" : "idle"
  );
  els.grid.innerHTML = "";
  const visibleCount = Math.max(resourceBatchFor(SHAPE_CARD_RENDER_BATCH), state.shapeCardVisibleCount || resourceBatchFor(SHAPE_CARD_RENDER_BATCH));
  const visibleItems = items.slice(0, visibleCount);
  for (const item of visibleItems) els.grid.append(renderShapeCard(item));
  if (items.length > visibleItems.length) {
    els.grid.append(renderResourceLoadMore("形状", items.length - visibleItems.length, "继续显示形状卡片预览", () => {
      state.shapeCardVisibleCount = Math.min(items.length, visibleCount + resourceBatchFor(SHAPE_CARD_RENDER_BATCH));
      render();
    }));
  }
  renderQuickShapes();
  renderUserAssets();
  renderSearchEmpty(items);
}

function scheduleRender() {
  if (scheduledRenderHandle) return;
  const run = () => {
    scheduledRenderHandle = 0;
    scheduledRenderCancel = null;
    render();
  };
  if (typeof window.requestAnimationFrame === "function") {
    const handle = window.requestAnimationFrame(run);
    scheduledRenderHandle = handle;
    scheduledRenderCancel = () => window.cancelAnimationFrame?.(handle);
  } else {
    const handle = window.setTimeout(run, 16);
    scheduledRenderHandle = handle;
    scheduledRenderCancel = () => window.clearTimeout(handle);
  }
}

function flushScheduledRender() {
  if (!scheduledRenderHandle) return;
  const cancel = scheduledRenderCancel;
  scheduledRenderHandle = 0;
  scheduledRenderCancel = null;
  cancel?.();
  render();
}

function scheduleZoteroLibraryRender() {
  if (scheduledZoteroLibraryHandle) return;
  const run = () => {
    scheduledZoteroLibraryHandle = 0;
    scheduledZoteroLibraryCancel = null;
    renderZoteroImagePanel();
    renderPaletteLibrary();
  };
  if (typeof window.requestAnimationFrame === "function") {
    const handle = window.requestAnimationFrame(run);
    scheduledZoteroLibraryHandle = handle;
    scheduledZoteroLibraryCancel = () => window.cancelAnimationFrame?.(handle);
  } else {
    const handle = window.setTimeout(run, 16);
    scheduledZoteroLibraryHandle = handle;
    scheduledZoteroLibraryCancel = () => window.clearTimeout(handle);
  }
}

function flushZoteroLibraryRender() {
  if (!scheduledZoteroLibraryHandle) return;
  const cancel = scheduledZoteroLibraryCancel;
  scheduledZoteroLibraryHandle = 0;
  scheduledZoteroLibraryCancel = null;
  cancel?.();
  renderZoteroImagePanel();
  renderPaletteLibrary();
}

function isBusyStatusText(text) {
  const value = String(text ?? "");
  if (!value) return false;
  if (/^正在/.test(value)) return true;
  return /正在|请稍候|处理中|导入中|导出中|识别中|重绘中|转换中|应用中|保存中|读取中|同步中|删除中|插入中|取色中|分享中/.test(value);
}

function isDoneStatusText(text) {
  const value = String(text ?? "");
  if (!value) return false;
  if (/失败|错误|无法|不支持|超出|拒绝|未找到|不能为空/.test(value)) return false;
  return /^(已|完成)/.test(value) || /已完成|成功/.test(value);
}


function resourceBatchFor(base) {
  return state.uiMode === "simple" ? Math.max(8, Math.floor(base * 0.75)) : base;
}

function busyActionSelectors() {
  return [
    "#convertSelection",
    "#refreshSelection",
    "#redrawFromStyle",
    "#insertFeatureBlock",
    "#saveFeatureDefault",
    "#zlkChartImport",
    "#zlkChartFolderButton",
    "#zlkChartClear",
    "#applyStyleTemplate",
    "#selectionNextAction",
    "#emptyInsertShape",
    "#saveSelection",
    "#inspectSelection",
    "#selectCarrier",
    "#importAssets",
    "#exportAssets",
    "#reloadAssets",
    "#importPalettes",
    "#exportPalettes",
    "#reloadPalettes",
    "#saveZoteroPalette",
    "#extractClipboardPalette",
    "#extractSlidePalette",
    "#zoteroImageReload",
    "#reloadQuickShapes",
    ".resource-load-more",
    ".chart-recommendations button",
    "#chartPresetPreview .primary-action",
    ".feature-actions [data-feature-dir]",
    ".novice-guide-strip button[data-starter-action=\"redraw\"]",
    ".novice-guide-strip button[data-starter-action=\"catalog\"]",
    "[data-starter-action=\"convert\"]",
    "[data-starter-action=\"redraw\"]"
  ].join(",");
}

function syncBusyActionLocks(busy) {
  const locked = Boolean(busy);
  for (const button of document.querySelectorAll(busyActionSelectors())) {
    if (!button) continue;
    if (locked) {
      if (!button.dataset.busyLockArmed) {
        button.dataset.busyLockWasDisabled = button.disabled ? "true" : "false";
        button.dataset.busyLockArmed = "true";
      }
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-busy-locked");
    } else if (button.dataset.busyLockArmed === "true") {
      const selectionEnabled = button.dataset.selectionEnabled;
      const wasDisabled = selectionEnabled === undefined
        ? button.dataset.busyLockWasDisabled === "true"
        : selectionEnabled !== "true";
      button.disabled = wasDisabled;
      button.setAttribute("aria-disabled", wasDisabled ? "true" : "false");
      button.removeAttribute("aria-busy");
      button.classList.remove("is-busy-locked");
      delete button.dataset.busyLockArmed;
      delete button.dataset.busyLockWasDisabled;
    }
  }
  if (busyLockWatchdog) {
    window.clearTimeout(busyLockWatchdog);
    busyLockWatchdog = 0;
  }
  if (locked) {
    busyLockWatchdog = window.setTimeout(() => {
      busyLockWatchdog = 0;
      // 防止宿主未回传状态时主按钮长期锁死
      if (els.status?.classList.contains("busy")) {
        setStatus("操作时间较长，已解除按钮锁定，可重试或查看状态详情。");
      } else {
        syncBusyActionLocks(false);
      }
    }, 20000);
  }
}

function statusToneLabel(isError, busy, done) {
  if (isError) return "错误状态";
  if (busy) return "进行中状态";
  if (done) return "完成状态";
  return "当前状态";
}

function setStatus(text, isError = false) {
  if (!els.status) return;
  const value = String(text ?? "");
  const busy = !isError && isBusyStatusText(value);
  const done = !isError && !busy && isDoneStatusText(value);
  els.status.textContent = value || "准备就绪";
  els.status.title = value
    ? `${statusToneLabel(isError, busy, done)}：${value}；点击可展开或收起完整文本`
    : "当前没有状态信息；点击可展开或收起";
  els.status.classList.toggle("error", Boolean(isError));
  els.status.classList.toggle("busy", busy);
  els.status.classList.toggle("ok", done);
  els.status.classList.toggle("long", value.length > 12);
  els.status.setAttribute("aria-busy", busy ? "true" : "false");
  syncBusyActionLocks(busy);
  if (isError) toggleStatusExpanded(true);
  else if (!value || value.length > 48) toggleStatusExpanded(false);
}

function sanitizeBuildInfo(info) {
  const value = info && typeof info === "object" ? info : {};
  return {
    name: String(value.name || "rough-ppt-addin"),
    version: String(value.version || "未知"),
    commit: String(value.commit || "未知"),
    branch: String(value.branch || "未知"),
    dirty: Boolean(value.dirty),
    builtAtUtc: String(value.builtAtUtc || ""),
    source: String(value.source || "local-build")
  };
}

function formatBuildTime(info) {
  if (!info?.builtAtUtc) return "未知时间";
  const date = new Date(info.builtAtUtc);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function buildInfoShortLabel(info) {
  if (!info) return "版本检测";
  const commit = info.commit && info.commit !== "未知" ? info.commit.slice(0, 7) : "";
  const dirty = info.dirty ? "*" : "";
  const built = formatBuildTimeShort(info);
  const core = commit ? `v${info.version} · ${commit}${dirty}` : `v${info.version}${dirty}`;
  return built ? `${core} · ${built}` : core;
}

function buildInfoCompactLabel(info) {
  if (!info) return "版本检测";
  const dirty = info.dirty ? "*" : "";
  return `版本 v${info.version}${dirty}`;
}

function formatBuildTimeShort(info) {
  if (!info?.builtAtUtc) return "";
  const date = new Date(info.builtAtUtc);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function buildInfoDetail(info = state.buildInfo) {
  if (!info) return "当前安装包未包含构建信息，请重新打包后安装最新版。";
  const dirty = info.dirty ? "构建时存在未提交改动" : "构建时工作区干净";
  return `当前插件版本：v${info.version}；提交：${info.commit}；分支：${info.branch}；构建时间：${formatBuildTime(info)}；状态：${dirty}。若安装后无变化，请对照此提交与安装包是否一致。`;
}

function renderBuildInfo() {
  if (!els.buildInfo) return;
  const shortLabel = buildInfoShortLabel(state.buildInfo);
  const visibleLabel = state.uiMode === "simple" ? buildInfoCompactLabel(state.buildInfo) : shortLabel;
  const detail = buildInfoDetail();
  els.buildInfo.textContent = visibleLabel;
  els.buildInfo.title = `${detail} 点击把这条版本信息显示到状态栏。`;
  els.buildInfo.setAttribute("aria-label", `版本检测：${shortLabel}；点击显示完整构建信息`);
  els.buildInfo.classList.toggle("error", Boolean(state.buildInfoUnavailable));
  els.buildInfo.classList.toggle("ready", Boolean(state.buildInfo) && !state.buildInfoUnavailable);
}

function formatBuildInfoLabel(info) {
  if (!info) return "版本未知";
  const commit = info.commit || info.Commit || info.sha || info.Sha || "";
  const builtAt = info.builtAt || info.BuiltAt || info.time || "";
  if (commit && builtAt) return commit;
  if (commit) return commit;
  return "版本就绪";
}

function formatBuildInfoTitle(info) {
  if (!info) return "未能读取 build-info.json；若按钮无响应，请先执行 node scripts/sync-ui-output.mjs 并重开任务窗格。";
  const commit = info.commit || info.Commit || "";
  const builtAt = info.builtAt || info.BuiltAt || "";
  return "当前 UI 构建：" + (commit || "未知提交") + (builtAt ? ("，时间 " + builtAt) : "") + "。若与仓库最新提交差距很大，说明 PPT 仍在加载旧前端。";
}

async function loadBuildInfo() {
  if (!els.buildInfo) return;
  els.buildInfo.classList.add("loading");
  els.buildInfo.classList.remove("ready", "error");
  els.buildInfo.textContent = "版本读取中";
  els.buildInfo.title = "正在读取当前安装包的构建信息，用于核对是否已安装最新版。";
  els.buildInfo.setAttribute("aria-label", "版本检测：正在读取构建信息");
  try {
    const response = await fetch("./build-info.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.buildInfo = sanitizeBuildInfo(await response.json());
    state.buildInfoUnavailable = false;
    els.buildInfo.classList.add("ready");
    els.buildInfo.classList.remove("error");
    els.buildInfo.textContent = formatBuildInfoLabel(state.buildInfo);
    els.buildInfo.title = formatBuildInfoTitle(state.buildInfo);
    els.buildInfo.setAttribute("aria-label", els.buildInfo.title);
  } catch {
    state.buildInfo = null;
    state.buildInfoUnavailable = true;
  } finally {
    els.buildInfo.classList.remove("loading");
  }
  renderBuildInfo();
}

function showBuildInfo() {
  const detail = buildInfoDetail();
  setStatus(detail, state.buildInfoUnavailable);
  toggleStatusExpanded(true);
}

function setUpdateChecking(checking) {
  state.updateChecking = Boolean(checking);
  if (!els.checkUpdates) return;
  els.checkUpdates.disabled = state.updateChecking;
  els.checkUpdates.textContent = state.updateChecking ? "检查中" : "检查更新";
  els.checkUpdates.setAttribute("aria-label", state.updateChecking ? "正在检查 GitHub 更新" : "检查 GitHub 正式版本更新");
}

function handleUpdateResult(message) {
  setUpdateChecking(false);
  const status = String(message.status || "error");
  const text = String(message.message || "更新检查完成。");
  els.checkUpdates?.classList.toggle("available", status === "update-available");
  setStatus(text, status === "error");
  if (status !== "update-available") return;
  showInlinePrompt({
    title: "发现新版本",
    message: `${text} 更新需要关闭 PowerPoint 并运行安装包，插件不会自动替换自身文件。`,
    confirmLabel: "打开下载页",
    cancelLabel: "稍后再说",
    onConfirm: () => {
      if (!postHost({ type: "openUpdateReleases" })) {
        setStatus("未连接 PowerPoint 宿主，无法打开下载页。", true);
      }
    }
  });
}

function closeInlinePrompt(message = "") {
  if (!els.inlinePrompt) return;
  const returnFocus = els.inlinePrompt.__returnFocus;
  els.inlinePrompt.__returnFocus = null;
  els.inlinePrompt.hidden = true;
  els.inlinePrompt.innerHTML = "";
  if (message) setStatus(message);
  if (returnFocus?.isConnected && typeof returnFocus.focus === "function") {
    window.setTimeout(() => returnFocus.focus({ preventScroll: true }), 0);
  }
}

function markDangerButton(button, title) {
  if (!button) return button;
  button.classList.add("danger-action");
  if (title) button.title = title;
  return button;
}

function showInlinePrompt(options) {
  const root = els.inlinePrompt;
  if (!root) return;
  root.__returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.hidden = false;
  root.innerHTML = "";
  root.dataset.promptConfirmArmed = "true";
  root.className = `inline-prompt${options.danger ? " danger" : ""}${options.input ? " has-input" : ""}`;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  root.setAttribute("aria-label", options.title || "确认操作");

  const copy = document.createElement("div");
  copy.className = "inline-prompt-copy";
  const title = document.createElement("strong");
  title.textContent = options.title || "确认操作";
  title.title = options.title || "确认操作";
  const message = document.createElement("span");
  message.textContent = options.message || "";
  message.title = options.message || "";
  copy.append(title, message);

  let input = null;
  if (options.input) {
    input = document.createElement("input");
    input.type = "text";
    input.value = options.defaultValue || "";
    input.placeholder = options.placeholder || "请输入名称";
    input.title = options.placeholder || "请输入名称";
    input.setAttribute("aria-label", input.placeholder);
  }

  let checkbox = null;
  if (options.checkboxLabel) {
    const label = document.createElement("label");
    label.className = "inline-prompt-checkbox";
    checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(options.checkboxChecked);
    const checkboxText = document.createElement("span");
    checkboxText.textContent = options.checkboxLabel;
    label.append(checkbox, checkboxText);
    copy.append(label);
  }

  const actions = document.createElement("div");
  actions.className = "inline-prompt-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "prompt-cancel";
  cancel.dataset.action = "cancel";
  cancel.textContent = options.cancelLabel || "取消";
  cancel.title = "取消当前页面内操作，不会调用 PowerPoint";
  cancel.addEventListener("click", () => closeInlinePrompt(options.cancelStatus || "已取消操作。"));
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = options.danger ? "danger-action" : "primary-action";
  confirm.textContent = options.confirmLabel || "确认";
  confirm.setAttribute("aria-label", options.danger ? `危险操作：${options.confirmLabel || "确认"}` : (options.confirmLabel || "确认"));
  confirm.title = options.danger
    ? "确认执行此删除或危险操作；取消不会修改任何内容"
    : "确认执行当前操作";
  confirm.addEventListener("click", () => {
    if (confirm.dataset.confirming === "true") return;
    const value = input ? input.value.trim() : true;
    if (input && !value) {
      setStatus("名称不能为空。", true);
      input.focus({ preventScroll: true });
      return;
    }
    if (root.dataset.promptConfirmArmed !== "true" || confirm.dataset.confirming === "true") return;
    root.dataset.promptConfirmArmed = "false";
    confirm.dataset.confirming = "true";
    confirm.disabled = true;
    cancel.disabled = true;
    closeInlinePrompt();
    options.onConfirm?.(value, { checked: Boolean(checkbox?.checked) });
  });
  actions.append(cancel, confirm);
  root.append(copy);
  if (input) root.append(input);
  root.append(actions);
  root.onkeydown = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeInlinePrompt(options.cancelStatus || "已取消操作。");
    }
    if (event.key === "Enter" && input && document.activeElement === input) {
      event.preventDefault();
      confirm.click();
    }
  };
  window.setTimeout(() => {
    if (input) input.focus({ preventScroll: true });
    else if (options.danger) cancel.focus({ preventScroll: true });
    else confirm.focus({ preventScroll: true });
  }, 40);
}

function toggleStatusExpanded(force) {
  if (!els.status) return;
  const expanded = typeof force === "boolean" ? force : !els.status.classList.contains("expanded");
  els.status.classList.toggle("expanded", expanded);
  els.status.setAttribute("aria-expanded", String(expanded));
  // 没有 ResizeObserver 的宿主上，这里是顶栏度量的兜底刷新路径。
  if (!window.__roughStickyChromeObserver) updateStickyChromeMetrics();
}

function handleHostMessage(message) {
  if (typeof message === "string") {
    try {
      message = JSON.parse(message);
    } catch {
      return;
    }
  }
  if (!message || typeof message !== "object") return;

  if (message.type === "userAssets") {
    state.userAssets = Array.isArray(message.assets) ? message.assets : [];
    renderUserAssets();
  }

  if (message.type === "shapeIcons") {
    state.shapeIcons = {};
    for (const icon of Array.isArray(message.icons) ? message.icons : []) {
      if (icon?.enumName && icon?.dataUrl) state.shapeIcons[icon.enumName] = icon.dataUrl;
    }
    if (Object.keys(state.shapeIcons).length) state.preferOfficeIcons = true;
    if (!els.shapeDropdown.hidden) renderShapeDropdown();
    if (!els.quickShapeDropdown.hidden) renderQuickShapeDropdown();
    renderQuickShapes();
  }

  if (message.type === "quickShapes") {
    const shapes = Array.isArray(message.shapes) ? message.shapes : [];
    state.quickShapeDetails = {};
    state.quickShapes = shapes
      .map(item => {
        const enumName = typeof item === "string" ? item : item?.enumName;
        if (enumName && typeof item === "object") state.quickShapeDetails[enumName] = item;
        return enumName;
      })
      .filter(Boolean);
    state.quickShapesLoaded = true;
    state.favorites = [...state.quickShapes];
    persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
    for (const item of shapes) {
      if (item?.enumName && item?.dataUrl) state.shapeIcons[item.enumName] = item.dataUrl;
    }
    if (Object.keys(state.shapeIcons).length) state.preferOfficeIcons = true;
    renderQuickShapes();
    if (!els.shapeDropdown.hidden) renderShapeDropdown();
    if (!els.quickShapeDropdown.hidden) renderQuickShapeDropdown();
  }

  if (message.type === "zoteroImages") {
    if (isStaleZoteroLibraryResponse(message)) {
      completeZoteroImageRequest();
      return;
    }
    state.zoteroImages = Array.isArray(message.images) ? message.images : [];
    state.zoteroImageStatus = message.status ?? "";
    state.zoteroDatabasePath = message.databasePath ?? "";
    state.zoteroDatabaseSource = message.databaseSource ?? "";
    state.zoteroDatabaseFound = Boolean(message.databaseFound);
    resetResourceRenderWindows("zotero");
    renderZoteroImagePanel();
    completeZoteroImageRequest();
  }

  if (message.type === "zoteroPalette") {
    if (String(message.imageId ?? "") !== state.activeZoteroReferenceImageId) return;
    state.zoteroPalette = message.palette ?? { swatches: [] };
    renderZoteroPaletteGrid();
  }

  if (message.type === "zoteroPaletteSaved") {
    if (String(message.imageId ?? "") !== state.activeZoteroReferenceImageId) return;
    state.activeZoteroPaletteSaved = true;
    renderZoteroPaletteGrid();
  }

  if (message.type === "zoteroPaletteLoadFailed") {
    if (String(message.imageId ?? "") !== state.activeZoteroReferenceImageId) return;
    state.activeZoteroReferenceImageId = "";
    state.activeZoteroReferenceTitle = "";
    state.activeZoteroPaletteSaved = true;
    state.zoteroPalette = { swatches: [] };
    renderZoteroImagePanel();
  }

  if (message.type === "paletteSchemes") {
    state.paletteSchemes = Array.isArray(message.palettes) ? message.palettes : [];
    resetResourceRenderWindows("palette");
    renderPaletteLibrary();
  }

  if (message.type === "zoteroTraceStatus") {
    setStatus(message.text ?? "", Boolean(message.isError));
    state.zoteroImageStatus = message.text ?? state.zoteroImageStatus;
    renderZoteroImagePanel();
  }

  if (message.type === "status") {
    setStatus(message.text ?? "", Boolean(message.isError));
  }

  if (message.type === "updateCheckState") {
    setUpdateChecking(String(message.state) === "checking");
  }

  if (message.type === "updateCheckResult") {
    handleUpdateResult(message);
  }

  if (message.type === "zlkAutomationStatus") {
    state.zlkAutomationStatus = message.text ?? "等待 SimpleExperiment 自动绘图请求。";
    state.zlkAutomationResult = message.result ?? null;
    renderChartImportPanel();
    setStatus(state.zlkAutomationStatus, Boolean(message.isError));
  }

  if (message.type === "normalizeZlkChartFile") {
    (async () => {
      const request = message.request ?? {};
      const requestId = request.requestId ?? request.RequestId ?? message.requestId ?? "";
      try {
        state.zlkAutomationStatus = `正在处理 SimpleExperiment 自动绘图请求：${requestId || "未命名"}`;
        renderChartImportPanel();
        const normalized = await normalizeZlkChartFilesForHost(request, message.files ?? []);
        postHost({
          type: "insertZlkChart",
          requestId,
          request: normalizeZlkRequestForHost(request),
          dataset: toHostZlkDataset(normalized.dataset),
          chartSpec: normalized.chartSpec
        });
      } catch (error) {
        state.zlkAutomationStatus = `SimpleExperiment 自动绘图失败：${error?.message || error}`;
        renderChartImportPanel();
        postHost({
          type: "insertZlkChart",
          requestId,
          request: normalizeZlkRequestForHost(request),
          error: state.zlkAutomationStatus,
          dataset: toHostZlkDataset({ errors: [state.zlkAutomationStatus], warnings: [], points: [], rows: [], recommendations: [] }),
          chartSpec: { ChartType: "genericTable", Title: "导入失败", Reason: state.zlkAutomationStatus }
        });
      }
    })();
  }

  if (message.type === "applyStyleFromHost") {
    const normalized = normalizeStyle(message.style ?? {}, state.params);
    state.params = normalized;
    state.insertParams = normalizeStyle(normalized, baseStyleParams);
    state.selectedStyleTemplateId = "";
    persistSetting("roughPptSelectedStyleTemplate", "");
    applyParamsToControls(normalized);
    if (message.status) setStatus(message.status);
  }

  if (message.type === "applyFeatureBlockFromHost") {
    state.featureBlock = normalizeFeatureBlock(message.feature ?? {}, state.featureBlock);
    applyFeatureBlockControls(state.featureBlock);
    if (message.status) setStatus(message.status);
  }

  if (message.type === "focusSection") {
    const section = typeof message.section === "string" ? message.section : "catalog";
    if (section === "paperPresets") {
      openPaperPresetsPanel({ status: message.status || "已显示全部论文图预设。" });
      return;
    }
    const focusTarget = hostFocusTargets[section];
    if (focusTarget) {
      if (focusControl(focusTarget)) setStatus(message.status || `已定位：${focusTarget.title}`);
      return;
    }
    if (section === "search") {
      focusGlobalSearch();
      if (message.status) setStatus(message.status);
      return;
    }
    if (section === "quickInsert") {
      openQuickInsertAndFocus();
      if (message.status) setStatus(message.status);
      return;
    }
    const focused = focusPanel(section);
    if (section === "catalog") openShapeDropdownAndFocusSearch();
    if (focused && message.status) setStatus(message.status);
  }

  if (message.type === "selectionState") {
    renderSelectionState(message);
  }
}

function requestUserAssets() {
  postHost({ type: "listUserAssets" });
}

function requestShapeIcons() {
  postHost({ type: "getShapeIcons" });
}

function requestSelectionState() {
  postHost({ type: "getSelectionState" });
}

function requestQuickShapes() {
  postHost({ type: "listQuickShapes" });
}

function setSelectionActionAvailability(kind) {
  const configs = {
    none: {
      convert: [false, "请先在 PowerPoint 中选择一个或多个原生形状"],
      refresh: [false, "请先选择插件生成的手绘原生组"],
      inspect: [false, "请先选择一个对象"],
      save: [false, "请先选择要保存为素材的 PPT 原生对象"],
      carrier: [false, "请先选择插件生成的手绘原生组"]
    },
    normal: {
      convert: [true, "把当前普通 PPT 原生形状转换为手绘风格"],
      refresh: [false, "普通 PPT 对象还不是手绘组，请先点击“转换”"],
      inspect: [true, "检查当前普通 PPT 对象的可转换状态"],
      save: [true, "把当前普通 PPT 原生对象保存为素材"],
      carrier: [false, "普通 PPT 对象没有插件载体"]
    },
    rough: {
      convert: [false, "当前对象已经是手绘原生组，无需重复转换"],
      refresh: [true, "按当前风格参数重绘选中的手绘原生组"],
      inspect: [true, "检查当前手绘组的元数据和图层角色"],
      save: [true, "把当前手绘原生组保存为素材"],
      carrier: [true, "选择组内隐藏载体以调整 PowerPoint 原生调整点"]
    },
    feature: {
      convert: [false, "特征块由插件专用入口更新，不需要转换"],
      refresh: [false, "特征块请使用“更新特征块”按钮"],
      inspect: [true, "检查当前特征块对象"],
      save: [true, "把当前特征块保存为素材"],
      carrier: [false, "特征块没有可单独选择的手绘载体"]
    }
  };
  const resolvedKind = configs[kind] ? kind : "none";
  const previousKind = document.body.dataset.selectionKind || "none";
  const selected = configs[resolvedKind];
  document.body.dataset.selectionKind = resolvedKind;
  syncContextualStyleEntry(resolvedKind);
  syncSimplePanelForSelection(resolvedKind, previousKind);
  refreshContextualSearchUi();
  syncFeatureDirectionTools(resolvedKind === "feature");
  const selectionPanel = els.selectionState?.closest(".selection-panel");
  if (selectionPanel) selectionPanel.dataset.selectionKind = resolvedKind;
  for (const [name, button] of Object.entries({
    convert: els.convert,
    refresh: els.refresh,
    inspect: els.inspect,
    save: els.save,
    carrier: els.selectCarrier
  })) {
    if (!button) continue;
    const [enabled, title] = selected[name] ?? [false, "当前状态不可用"];
    button.dataset.selectionEnabled = enabled ? "true" : "false";
    const disabled = button.dataset.busyLockArmed === "true" || !enabled;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.title = title;
    button.classList.toggle("selection-primary", enabled && (
      (kind === "normal" && name === "convert") ||
      (kind === "rough" && name === "refresh")
    ));
  }
  updateSelectionNextStep(kind);
}

function updateSelectionNextStep(kind) {
  if (!els.selectionNextStep || !els.selectionNextAction) return;
  const configs = {
    none: {
      title: "先插入或选择形状",
      detail: "没有选区时先打开形状图库，或在 PowerPoint 中选择已有对象。",
      label: "插入形状",
      starterLabel: "推荐插入",
      starterIcon: "shapes",
      titleAttr: "打开形状图库，先插入一个可编辑的手绘 PPT 原生形状",
      run: () => activateStarterAction("catalog")
    },
    normal: {
      title: "建议转换为手绘",
      detail: "当前是普通 PPT 对象，可一键转换为当前风格的手绘原生组。",
      label: "转换选区",
      starterLabel: "推荐转换",
      starterIcon: "convert",
      titleAttr: "把当前普通 PPT 原生形状转换为手绘风格",
      run: () => els.convert?.click()
    },
    rough: {
      title: "建议重绘选区",
      detail: "当前是手绘原生组，修改大小、颜色或参数后可直接重绘。",
      label: "重绘选区",
      starterLabel: "推荐重绘",
      starterIcon: "redraw",
      titleAttr: "按当前风格参数重绘选中的手绘原生组",
      run: () => els.refresh?.click()
    },
    feature: {
      title: "建议更新特征块",
      detail: "当前是特征块，修改右侧参数后可在原位置更新。",
      label: "去更新",
      starterLabel: "推荐更新",
      starterIcon: "feature",
      titleAttr: "定位到特征块参数和更新按钮，不会立即替换对象",
      run: () => {
        focusPanel("featureBlock");
        window.setTimeout(() => els.insertFeatureBlock?.focus({ preventScroll: true }), 180);
      }
    }
  };
  const config = configs[kind] ?? configs.none;
  const resolvedKind = configs[kind] ? kind : "none";
  if (els.jumpToNext) {
    upgradeFunctionalIconTarget(els.jumpToNext, config.starterIcon, `jumpToNext-${resolvedKind}`);
    const starterLabel = els.jumpToNext.querySelector(":scope > span:last-child");
    if (starterLabel) starterLabel.textContent = config.starterLabel;
    const starterTitle = `${config.starterLabel}：${config.titleAttr}`;
    els.jumpToNext.title = starterTitle;
    els.jumpToNext.setAttribute("aria-label", starterTitle);
    els.jumpToNext.dataset.selectionKind = resolvedKind;
  }
  els.selectionNextStep.classList.remove("is-none", "is-normal", "is-rough", "is-feature");
  els.selectionNextStep.classList.add(`is-${resolvedKind}`);
  els.selectionNextStep.dataset.selectionKind = resolvedKind;
  els.selectionNextStep.hidden = false;
  els.selectionNextStep.dataset.selectionKind = resolvedKind;
  els.selectionNextStep.setAttribute("data-selection-kind", resolvedKind);
  els.selectionNextStep.setAttribute("aria-label", `当前选区下一步：${config.title}`);
  if (els.selectionNextIcon) {
    const iconMap = { none: "\u8250", normal: "\u270E", rough: "\u21BB", feature: "\u25CE" };
    els.selectionNextIcon.textContent = iconMap[resolvedKind] || iconMap.none;
    els.selectionNextIcon.setAttribute("aria-hidden", "true");
  }
  if (els.selectionNextTitle) els.selectionNextTitle.textContent = config.title;
  if (els.selectionNextDetail) els.selectionNextDetail.textContent = config.detail;
  els.selectionNextAction.textContent = config.label;
  els.selectionNextAction.title = config.titleAttr;
  els.selectionNextAction.setAttribute("aria-label", config.titleAttr);
  els.selectionNextAction.dataset.selectionKind = resolvedKind;
  els.selectionNextAction.classList.add("selection-next-action");
  els.selectionNextAction.classList.toggle("primary-action", resolvedKind !== "feature");
  els.selectionNextAction.classList.toggle("is-none", resolvedKind === "none");
  els.selectionNextAction.classList.toggle("is-normal", resolvedKind === "normal");
  els.selectionNextAction.classList.toggle("is-rough", resolvedKind === "rough");
  els.selectionNextAction.classList.toggle("is-feature", resolvedKind === "feature");
  els.selectionNextAction.dataset.selectionEnabled = "true";
  const nextBusyLocked = els.selectionNextAction.dataset.busyLockArmed === "true";
  els.selectionNextAction.disabled = nextBusyLocked;
  els.selectionNextAction.setAttribute("aria-disabled", nextBusyLocked ? "true" : "false");
  els.selectionNextAction.onclick = () => {
    if (els.selectionNextAction.disabled) return;
    config.run();
  };
  // Keep the recommended CTA visible even before the first host selection event.
  els.selectionNextStep.hidden = false;
  if (els.selectionEmptyActions) {
    els.selectionEmptyActions.hidden = resolvedKind !== "none";
  }
}




function setLocalStatusTone(el, tone = "idle") {
  if (!el) return;
  el.classList.remove("ok", "warn", "error", "idle");
  if (tone && tone !== "idle") el.classList.add(tone);
}

function zlkLocalStatusTone(text = state.zlkAutomationStatus || "") {
  if (/失败|错误|无效|缺少|超时/.test(text)) return "error";
  if (state.zlkAutomationResult) return "ok";
  if (/已启动|已就绪|监听中|服务已启动|127\.0\.0\.1/.test(text)) return "ok";
  if (/正在|处理中|请求/.test(text) && !/等待/.test(text)) return "warn";
  return "idle";
}

function zoteroLocalStatusTone(text = state.zoteroImageStatus || "") {
  if (/失败|错误|拒绝|不可用/.test(text)) return "error";
  if (state.zoteroDatabaseFound && state.zoteroImages.length) return "ok";
  if (state.zoteroDatabaseFound || /未找到|缺失|未读取/.test(text)) return "warn";
  return "idle";
}

function setSummaryBadge(el, label, title, tone = "idle") {
  if (!el) return;
  el.textContent = label;
  el.title = title;
  el.classList.remove("tone-idle", "tone-ok", "tone-ready", "tone-warn", "tone-feature");
  el.classList.add(`tone-${tone}`);
}

function setSelectionBadge(label, title, tone = "idle") {
  if (!els.selectionBadge) return;
  els.selectionBadge.textContent = label;
  els.selectionBadge.title = title;
  els.selectionBadge.setAttribute("aria-label", title ? `选区状态：${label}。${title}` : `选区状态：${label}`);
  els.selectionBadge.classList.remove("tone-idle", "tone-ok", "tone-ready", "tone-warn", "tone-feature");
  els.selectionBadge.classList.add(`tone-${tone}`);
}

function setSelectionStateTone(tone = "empty") {
  if (!els.selectionState) return;
  els.selectionState.classList.remove("rough", "normal", "feature", "empty");
  els.selectionState.classList.add(tone);
}

function renderSelectionState(selection) {
  if (selection.hasSelection === false) {
    state.selectionKey = "";
    state.pendingParamEdit = null;
    setSelectionBadge("无选区", "PowerPoint 当前没有选中对象", "idle");
    setSelectionStateTone("empty");
    els.selectionState.textContent = selection.status ?? "未选中对象。请在 PowerPoint 中选择一个形状。";
    els.selectionState.title = "请先在 PowerPoint 中选择形状、手绘组或特征块，再使用转换、重绘、检查、保存等操作。";
    if (els.selectionEmptyActions) els.selectionEmptyActions.hidden = false;
    setSelectionActionAvailability("none");
    syncFeatureBlockPrimaryAction(false);
    return;
  }

  if (selection.isFeatureBlock) {
    if (els.selectionEmptyActions) els.selectionEmptyActions.hidden = true;
    state.selectionKey = selection.shapeName ?? "feature-block";
    state.pendingParamEdit = null;
    setSelectionBadge("特征块", "当前选区是插件生成的 PPT 原生可编辑特征块", "feature");
    setSelectionStateTone("feature");
    applyFeatureBlockFromSelection(selection.featureBlock ?? {});
    const bounds = selection.bounds ?? {};
    els.selectionState.textContent = `特征块 | ${Math.round(bounds.width ?? 0)}×${Math.round(bounds.height ?? 0)} pt | 参数已回填 | 原生可编辑`;
    els.selectionState.title = "修改特征块参数会实时替换当前选中特征块并保持在原位置；“更新特征块”可用于手动确认。";
    setSelectionActionAvailability("feature");
    syncFeatureBlockPrimaryAction(true);
    return;
  }

  const rough = Boolean(selection.isRough);
  if (els.selectionEmptyActions) els.selectionEmptyActions.hidden = true;
  if (rough) {
    setSelectionBadge("手绘原生组", "当前选区是插件生成的 PPT 原生可编辑手绘组", "ready");
    setSelectionStateTone("rough");
  } else {
    setSelectionBadge("普通对象", "当前选区不是插件生成的手绘组", "warn");
    setSelectionStateTone("normal");
  }
  syncFeatureBlockPrimaryAction(false);
  if (!rough) {
    state.selectionKey = "";
    state.pendingParamEdit = null;
    els.selectionState.textContent = selection.status ?? "普通 PPT 对象。";
    els.selectionState.title = "普通 PPT 对象不会自动回填手绘参数；可先插入或选择手绘原生组。";
    setSelectionActionAvailability("normal");
    return;
  }

  const key = selectionKey(selection);
  const style = selection.style ?? {};
  const holdLocalParams = shouldHoldLocalParams(key, style);
  if (!holdLocalParams) applyParamsFromSelection(style);
  state.selectionKey = key;
  if (key) state.lastRoughSelectionKey = key;
  const bounds = selection.bounds ?? {};
  els.selectionState.textContent = `${selection.sourceMsoType ?? "手绘对象"} | ${Math.round(bounds.width ?? 0)}×${Math.round(bounds.height ?? 0)} pt | ${holdLocalParams ? "正在应用面板参数" : "元数据完整"} | 原生可编辑`;
  els.selectionState.title = holdLocalParams ? "正在等待 PowerPoint 完成实时重绘，暂不使用旧元数据覆盖当前面板参数。" : "当前手绘原生组可按尺寸、样式和元数据实时重绘。";
  setSelectionActionAvailability("rough");
}

function applyFeatureBlockFromSelection(feature) {
  const normalized = normalizeFeatureBlock(feature, state.featureBlock);
  normalized.editDirection = "";
  normalized.editDelta = 0;
  state.featureBlock = normalized;
  applyFeatureBlockControls(normalized);
}

function normalizeFeatureBlock(feature, fallback) {
  const read = (upper, lower, defaultValue) => feature[upper] ?? feature[lower] ?? defaultValue;
  const readBool = (upper, lower, defaultValue) => {
    const value = read(upper, lower, defaultValue);
    if (typeof value === "string") return value.toLowerCase() === "true";
    return Boolean(value);
  };
  return {
    mode: read("Mode", "mode", fallback.mode),
    visualStyle: read("VisualStyle", "visualStyle", fallback.visualStyle),
    countX: Number(read("CountX", "countX", fallback.countX)),
    countY: Number(read("CountY", "countY", fallback.countY)),
    countZ: Number(read("CountZ", "countZ", fallback.countZ)),
    blockWidthPt: Number(read("BlockWidthPt", "blockWidthPt", fallback.blockWidthPt)),
    blockHeightPt: Number(read("BlockHeightPt", "blockHeightPt", fallback.blockHeightPt)),
    blockDepthPt: Number(read("BlockDepthPt", "blockDepthPt", fallback.blockDepthPt)),
    gapPt: Number(read("GapPt", "gapPt", fallback.gapPt)),
    roundness: Number(read("Roundness", "roundness", fallback.roundness)),
    startColor: read("StartColor", "startColor", fallback.startColor),
    endColor: read("EndColor", "endColor", fallback.endColor),
    strokeColor: read("StrokeColor", "strokeColor", fallback.strokeColor),
    strokeWidthPt: Number(read("StrokeWidthPt", "strokeWidthPt", fallback.strokeWidthPt)),
    gradientDirection: read("GradientDirection", "gradientDirection", fallback.gradientDirection),
    gradientReverse: readBool("GradientReverse", "gradientReverse", fallback.gradientReverse),
    gradientAmount: Number(read("GradientAmount", "gradientAmount", fallback.gradientAmount)),
    editDirection: read("EditDirection", "editDirection", ""),
    editDelta: Number(read("EditDelta", "editDelta", 0))
  };
}

function applyParamsFromSelection(style) {
  const normalized = normalizeStyle(style, state.params);
  state.params = normalized;
  applyParamsToControls(normalized);
}

function applyParamsToControls(params) {
  for (const input of els.params.querySelectorAll("input, select")) {
    if (input.name in params) input.value = params[input.name];
  }
  syncNestedParamAvailability();
  renderStyleTemplates();
}

function normalizeStyle(style, fallback) {
  return {
    stroke: style.Stroke ?? style.stroke ?? fallback.stroke,
    strokeWidthPt: Number(style.StrokeWidthPt ?? style.strokeWidthPt ?? fallback.strokeWidthPt),
    strokeTransparency: Number(style.StrokeTransparency ?? style.strokeTransparency ?? fallback.strokeTransparency),
    roughness: Number(style.Roughness ?? style.roughness ?? fallback.roughness),
    bowing: Number(style.Bowing ?? style.bowing ?? fallback.bowing),
    edgeJitterPt: Number(style.EdgeJitterPt ?? style.edgeJitterPt ?? fallback.edgeJitterPt ?? baseStyleParams.edgeJitterPt),
    maxRandomnessOffset: Number(style.MaxRandomnessOffset ?? style.maxRandomnessOffset ?? fallback.maxRandomnessOffset ?? baseStyleParams.maxRandomnessOffset),
    strokePasses: Number(style.StrokePasses ?? style.strokePasses ?? fallback.strokePasses ?? baseStyleParams.strokePasses),
    curveSampling: Number(style.CurveSampling ?? style.curveSampling ?? fallback.curveSampling ?? baseStyleParams.curveSampling),
    fragmentStrokeDensity: Number(style.FragmentStrokeDensity ?? style.fragmentStrokeDensity ?? fallback.fragmentStrokeDensity ?? baseStyleParams.fragmentStrokeDensity),
    roughEngine: style.RoughEngine ?? style.roughEngine ?? fallback.roughEngine ?? "nativeWarp",
    roughSource: style.RoughSource ?? style.roughSource ?? fallback.roughSource ?? "native",
    fillSource: style.FillSource ?? style.fillSource ?? fallback.fillSource ?? "auto",
    fillWeight: Number(style.FillWeight ?? style.fillWeight ?? fallback.fillWeight ?? -1),
    hachureGap: Number(style.HachureGap ?? style.hachureGap ?? fallback.hachureGap ?? -1),
    curveFitting: Number(style.CurveFitting ?? style.curveFitting ?? fallback.curveFitting ?? 0.95),
    preserveVertices: readBooleanStyle(style.PreserveVertices ?? style.preserveVertices ?? fallback.preserveVertices ?? true),
    disableMultiStroke: readBooleanStyle(style.DisableMultiStroke ?? style.disableMultiStroke ?? fallback.disableMultiStroke ?? false),
    disableMultiStrokeFill: readBooleanStyle(style.DisableMultiStrokeFill ?? style.disableMultiStrokeFill ?? fallback.disableMultiStrokeFill ?? true),
    tldrawOffsetPt: Number(style.TldrawOffsetPt ?? style.tldrawOffsetPt ?? fallback.tldrawOffsetPt ?? 0.67),
    roughMode: style.RoughMode ?? style.roughMode ?? fallback.roughMode ?? "classic",
    nestedLayers: Number(style.NestedLayers ?? style.nestedLayers ?? fallback.nestedLayers ?? 2),
    nestedOverlap: Number(style.NestedOverlap ?? style.nestedOverlap ?? fallback.nestedOverlap ?? 0.55),
    nestedGapPt: Number(style.NestedGapPt ?? style.nestedGapPt ?? fallback.nestedGapPt ?? 4),
    nestedJitterPt: Number(style.NestedJitterPt ?? style.nestedJitterPt ?? fallback.nestedJitterPt ?? 0.8),
    nestedDirection: style.NestedDirection ?? style.nestedDirection ?? fallback.nestedDirection ?? "leftDownToRightUp",
    seed: Number(style.Seed ?? style.seed ?? fallback.seed),
    fillMode: style.FillMode ?? style.fillMode ?? fallback.fillMode,
    fillColor: style.FillColor ?? style.fillColor ?? fallback.fillColor,
    fillTransparency: Number(style.FillTransparency ?? style.fillTransparency ?? fallback.fillTransparency),
    fillStyle: style.FillStyle ?? style.fillStyle ?? fallback.fillStyle,
    brushWidthPt: Number(style.BrushWidthPt ?? style.brushWidthPt ?? fallback.brushWidthPt ?? 5),
    brushDensity: Number(style.BrushDensity ?? style.brushDensity ?? fallback.brushDensity ?? 1),
    brushAngleDeg: Number(style.BrushAngleDeg ?? style.brushAngleDeg ?? fallback.brushAngleDeg ?? -8),
    brushJitterPt: Number(style.BrushJitterPt ?? style.brushJitterPt ?? fallback.brushJitterPt ?? 1.2),
    brushOverlap: Number(style.BrushOverlap ?? style.brushOverlap ?? fallback.brushOverlap ?? 0.35),
    dashStyle: style.DashStyle ?? style.dashStyle ?? fallback.dashStyle,
    arrowheadStyle: style.ArrowheadStyle ?? style.arrowheadStyle ?? fallback.arrowheadStyle,
    arrowheadPosition: style.ArrowheadPosition ?? style.arrowheadPosition ?? fallback.arrowheadPosition,
    arrowheadLengthPt: Number(style.ArrowheadLengthPt ?? style.arrowheadLengthPt ?? fallback.arrowheadLengthPt ?? baseStyleParams.arrowheadLengthPt),
    arrowheadWidthPt: Number(style.ArrowheadWidthPt ?? style.arrowheadWidthPt ?? fallback.arrowheadWidthPt ?? baseStyleParams.arrowheadWidthPt)
  };
}

function readBooleanStyle(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return String(value).trim().toLowerCase() === "true";
}

function selectionKey(selection) {
  return selection.groupId || selection.assetId || selection.shapeName || "";
}

function markLocalParamEdit() {
  if (!state.selectionKey) return;
  state.pendingParamEdit = {
    selectionKey: state.selectionKey,
    signature: paramsSignature(state.params),
    until: Date.now() + PARAM_SYNC_HOLD_MS
  };
}

function shouldHoldLocalParams(key, style) {
  const pending = state.pendingParamEdit;
  if (!pending) return false;
  if (Date.now() > pending.until || pending.selectionKey !== key) {
    state.pendingParamEdit = null;
    return false;
  }

  const incomingSignature = paramsSignature(normalizeStyle(style, state.params));
  if (incomingSignature === pending.signature) {
    state.pendingParamEdit = null;
    return false;
  }

  return true;
}

function paramsSignature(params) {
  const normalized = normalizeStyle(params, state.params);
  return [
    normalized.stroke,
    Number(normalized.strokeWidthPt).toFixed(2),
    Number(normalized.strokeTransparency).toFixed(3),
    Number(normalized.roughness).toFixed(3),
    Number(normalized.bowing).toFixed(3),
    Number(normalized.edgeJitterPt).toFixed(2),
    Number(normalized.maxRandomnessOffset).toFixed(2),
    Number(normalized.strokePasses).toFixed(0),
    Number(normalized.curveSampling).toFixed(2),
    Number(normalized.fragmentStrokeDensity).toFixed(2),
    normalized.roughEngine,
    normalized.roughSource,
    normalized.fillSource,
    Number(normalized.fillWeight).toFixed(2),
    Number(normalized.hachureGap).toFixed(2),
    Number(normalized.curveFitting).toFixed(2),
    String(normalized.preserveVertices),
    String(normalized.disableMultiStroke),
    String(normalized.disableMultiStrokeFill),
    Number(normalized.tldrawOffsetPt).toFixed(2),
    normalized.roughMode,
    Number(normalized.nestedLayers).toFixed(0),
    Number(normalized.nestedOverlap).toFixed(3),
    Number(normalized.nestedGapPt).toFixed(2),
    Number(normalized.nestedJitterPt).toFixed(2),
    normalized.nestedDirection,
    Number(normalized.seed),
    normalized.fillMode,
    normalized.fillColor,
    Number(normalized.fillTransparency).toFixed(3),
    normalized.fillStyle,
    Number(normalized.brushWidthPt).toFixed(2),
    Number(normalized.brushDensity).toFixed(2),
    Number(normalized.brushAngleDeg).toFixed(2),
    Number(normalized.brushJitterPt).toFixed(2),
    Number(normalized.brushOverlap).toFixed(2),
    normalized.dashStyle,
    normalized.arrowheadStyle,
    normalized.arrowheadPosition,
    Number(normalized.arrowheadLengthPt).toFixed(2),
    Number(normalized.arrowheadWidthPt).toFixed(2)
  ].join("|");
}

function canvasDash(dashStyle) {
  if (dashStyle === "dash") return [10, 6];
  if (dashStyle === "dot") return [2, 5];
  if (dashStyle === "dash-dot") return [10, 5, 2, 5];
  return [];
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}


function enhanceFeatureParamControls() {
  const panel = els.featurePanel;
  if (!panel) return;
  const inputs = Array.from(panel.querySelectorAll('input[type="range"], input[type="number"][data-feature-param]'));
  for (const input of inputs) {
    if (input.dataset.enhancedNumber === "true") continue;
    input.dataset.enhancedNumber = "true";
    const name = input.dataset.featureParam || input.name;
    if (!name) continue;
    // reuse createParamNumberRow but feature inputs use data-feature-param, not name always
    if (!input.name) input.name = name;
    if (input.type === "range") {
      const row = createParamNumberRow(input, false);
      // mark stepper buttons for feature scope
      for (const btn of row.querySelectorAll("[data-param-step]")) {
        btn.dataset.featureStep = name;
        delete btn.dataset.paramStep;
      }
      const number = row.querySelector("input[type=number]");
      if (number) {
        number.dataset.featureParam = name;
        number.dataset.featureNumber = name;
      }
      input.insertAdjacentElement("afterend", row);
    } else {
      const row = createParamNumberRow(input, false);
      for (const btn of row.querySelectorAll("[data-param-step]")) {
        btn.dataset.featureStep = name;
        delete btn.dataset.paramStep;
      }
      const number = row.querySelector("input[type=number]");
      if (number) {
        number.dataset.featureParam = name;
        number.dataset.featureNumber = name;
        number.name = name;
      }
      input.replaceWith(row);
    }
  }
  // wire feature step buttons once
  if (panel.dataset.stepWired === "true") return;
  panel.dataset.stepWired = "true";
  panel.addEventListener("click", event => {
    const button = event.target.closest("[data-feature-step]");
    if (!button) return;
    const key = button.dataset.featureStep;
    const dir = Number(button.dataset.direction || "1");
    const input = panel.querySelector(`input[data-feature-param="${key}"][type="number"], input[name="${key}"][type="number"]`)
      || panel.querySelector(`input[data-feature-param="${key}"]`);
    if (!input) return;
    const step = Number(input.step || "1") || 1;
    const min = input.min === "" ? Number.NEGATIVE_INFINITY : Number(input.min);
    const max = input.max === "" ? Number.POSITIVE_INFINITY : Number(input.max);
    let next = Number(input.value || 0) + dir * step;
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);
    // keep integer if step integer
    if (Math.abs(step - Math.round(step)) < 1e-9) next = Math.round(next);
    else next = Math.round(next * 1000) / 1000;
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function enhanceParamControls() {
  if (!els.params) return;
  const inputs = Array.from(els.params.querySelectorAll('input[type="range"], input[type="number"]'))
    .filter(input => numericParamNames.has(input.name));
  for (const input of inputs) {
    if (input.dataset.enhancedNumber === "true") continue;
    input.dataset.enhancedNumber = "true";
    if (input.type === "range") {
      const row = createParamNumberRow(input, false);
      input.insertAdjacentElement("afterend", row);
    } else {
      const row = createParamNumberRow(input, false);
      input.replaceWith(row);
    }
  }
}

function groupStyleParamControls() {
  const grid = els.params?.querySelector(".params-grid");
  if (!grid || grid.dataset.grouped === "true") return;
  const labels = Array.from(grid.children).filter(child => child.matches?.("label"));
  groupLabelsIntoSections(grid, labels, styleParamGroups, "param-section", "param-section-body", label => label.querySelector("[name]")?.name);
}

function groupFeatureBlockControls() {
  const grid = els.featurePanel?.querySelector(".feature-grid");
  if (!grid || grid.dataset.grouped === "true") return;
  const labels = Array.from(grid.children).filter(child => child.matches?.("label"));
  groupLabelsIntoSections(grid, labels, featureParamGroups, "feature-section", "feature-section-body", label => label.querySelector("[data-feature-param]")?.dataset.featureParam);
}

function groupLabelsIntoSections(grid, labels, groups, sectionClass, bodyClass, nameFromLabel) {
  grid.dataset.grouped = "true";
  const byName = new Map(labels.map(label => [nameFromLabel(label), label]));
  const used = new Set();
  for (const group of groups) {
    const details = document.createElement("details");
    details.className = sectionClass;
    details.open = group.open;
    details.dataset.paramGroup = group.title;
    const hintText = group.hint || "更多参数";
    details.title = `${group.title}参数组：${hintText}，点击可展开或收起`;
    const summary = document.createElement("summary");
    const copy = document.createElement("span");
    copy.className = "param-section-summary-copy";
    const title = document.createElement("span");
    title.className = "param-section-title";
    title.textContent = group.title;
    const hint = document.createElement("span");
    hint.className = "param-section-hint";
    hint.textContent = hintText;
    hint.title = hintText;
    copy.append(title, hint);
    const body = document.createElement("div");
    body.className = bodyClass;
    for (const name of group.names) {
      const label = byName.get(name);
      if (!label) continue;
      used.add(label);
      body.append(label);
    }
    const countText = `${body.children.length} 项`;
    const count = document.createElement("span");
    count.className = "param-section-count";
    count.textContent = countText;
    count.setAttribute("aria-hidden", "true");
    summary.dataset.count = countText;
    summary.dataset.hint = hintText;
    summary.title = `${group.title}参数组：${hintText}，共 ${countText}，点击展开或收起`;
    summary.setAttribute("aria-label", `${group.title}参数组，关键参数：${hintText}，共 ${countText}。点击展开或收起`);
    summary.append(copy, count);
    if (sectionClass === "param-section") {
      details.addEventListener("toggle", () => syncParamJumpButtonsForSectionToggle(details));
    }
    details.append(summary, body);
    grid.append(details);
  }

  const remaining = labels.filter(label => !used.has(label));
  if (remaining.length) {
    const details = document.createElement("details");
    details.className = sectionClass;
    details.dataset.paramGroup = "其他";
    details.title = "其他参数组：点击可展开或收起";
    const summary = document.createElement("summary");
    const copy = document.createElement("span");
    copy.className = "param-section-summary-copy";
    const title = document.createElement("span");
    title.className = "param-section-title";
    title.textContent = "其他";
    const hint = document.createElement("span");
    hint.className = "param-section-hint";
    hint.textContent = "未分组参数";
    hint.title = "未分组参数";
    copy.append(title, hint);
    const countText = `${remaining.length} 项`;
    const count = document.createElement("span");
    count.className = "param-section-count";
    count.textContent = countText;
    count.setAttribute("aria-hidden", "true");
    summary.title = `其他参数组：未分组参数，共 ${countText}，点击展开或收起`;
    summary.dataset.count = countText;
    summary.dataset.hint = "未分组参数";
    summary.setAttribute("aria-label", `其他参数组，关键参数：未分组参数，共 ${countText}。点击展开或收起`);
    summary.append(copy, count);
    const body = document.createElement("div");
    body.className = bodyClass;
    for (const label of remaining) body.append(label);
    if (sectionClass === "param-section") {
      details.addEventListener("toggle", () => syncParamJumpButtonsForSectionToggle(details));
    }
    details.append(summary, body);
    grid.append(details);
  }
}

function wireStyleParamJumps() {
  for (const button of els.styleParamJumpButtons ?? []) {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => focusParamGroup(button.dataset.paramGroupJump || ""));
  }
  const firstOpen = Array.from(document.querySelectorAll(".param-section")).find(section => section.open);
  syncParamJumpButtons(firstOpen?.dataset.paramGroup || "");
}

function createParamNumberRow(sourceInput, reuseSource = false) {
  const name = sourceInput.name || sourceInput.dataset.featureParam || sourceInput.dataset.paramNumber || "";
  const row = document.createElement("span");
  row.className = "param-number-row";
  row.title = "可手动输入数字，也可点击加号或减号按步进调整。";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "param-step";
  minus.textContent = "-";
  minus.dataset.paramStep = name;
  minus.dataset.direction = "-1";
  minus.title = "减少当前数值";

  // Always create a fresh number input. Reusing a live DOM node then replaceWith(row)
  // throws HierarchyRequestError and aborts the entire taskpane boot sequence.
  const number = document.createElement("input");
  number.type = "number";
  if (name) number.name = name;
  number.value = sourceInput.value;
  if (sourceInput.min != null && sourceInput.min !== "") number.min = sourceInput.min;
  if (sourceInput.max != null && sourceInput.max !== "") number.max = sourceInput.max;
  number.step = sourceInput.step || "1";
  number.dataset.paramNumber = name;
  if (sourceInput.dataset.nestedParam) number.dataset.nestedParam = sourceInput.dataset.nestedParam;
  if (sourceInput.dataset.featureParam) number.dataset.featureParam = sourceInput.dataset.featureParam;
  if (sourceInput.dataset.featureNumber) number.dataset.featureNumber = sourceInput.dataset.featureNumber;
  if (sourceInput.disabled) number.disabled = true;
  number.classList.add("param-number-input");
  number.title = sourceInput.title || "直接输入精确数值";
  if (reuseSource) number.dataset.reusedSource = "true";

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "param-step";
  plus.textContent = "+";
  plus.dataset.paramStep = name;
  plus.dataset.direction = "1";
  plus.title = "增加当前数值";

  row.append(minus, number, plus);
  return row;
}


function syncParamControls(name, value, source = null) {
  for (const input of els.params.querySelectorAll(`input[name="${name}"], select[name="${name}"]`)) {
    if (input !== source) input.value = value;
  }
}

function adjustParamValue(name, direction) {
  const controls = Array.from(els.params.querySelectorAll(`input[name="${name}"]`));
  const numberInput = controls.find(input => input.dataset.paramNumber === name) ?? controls[0];
  if (!numberInput) return;
  const step = parseFloat(numberInput.step || "1") || 1;
  const current = Number.isFinite(Number(numberInput.value)) ? Number(numberInput.value) : Number(state.params[name] ?? 0);
  const precision = decimalPlaces(step);
  let next = Number((current + direction * step).toFixed(precision));
  if (numberInput.min !== "") next = Math.max(Number(numberInput.min), next);
  if (numberInput.max !== "") next = Math.min(Number(numberInput.max), next);
  numberInput.value = String(next);
  numberInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function decimalPlaces(value) {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}


function syncStyleTemplateBarState(selectedId = "") {
  const id = selectedId || "";
  const template = id ? state.styleTemplates.find(item => item.id === id) ?? null : null;
  if (els.styleTemplateSelect) {
    els.styleTemplateSelect.dataset.templateSelected = id;
    els.styleTemplateSelect.setAttribute("aria-label", id ? "风格模板：已选中模板" : "风格模板：自定义参数");
  }
  const bar = els.styleTemplateSelect?.closest(".style-template-bar");
  if (bar) {
    bar.classList.toggle("has-selection", Boolean(id));
    bar.classList.toggle("is-custom", !id);
    bar.dataset.hasSelection = id ? "true" : "false";
    bar.dataset.templateSelected = id;
    bar.title = id
      ? "当前已选择风格模板；可应用、保存或重命名"
      : "当前为自定义参数；可从下拉或预览卡选择模板，或保存为新模板";
  }
  if (els.styleTemplateTools) {
    const kind = !template ? "custom-params" : template.builtIn ? "built-in" : "user";
    const summary = els.styleTemplateTools.querySelector(":scope > summary");
    els.styleTemplateTools.dataset.templateKind = kind;
    els.styleTemplateTools.classList.toggle("can-rename", kind === "user");
    if (summary) {
      summary.textContent = kind === "user" ? "模板管理 · 可重命名" : kind === "built-in" ? "模板管理 · 可另存" : "模板管理 · 保存当前";
      summary.title = kind === "user" ? "展开保存副本或重命名当前自定义模板" : kind === "built-in" ? "展开把预置模板另存为自定义模板" : "展开把当前自定义参数保存为模板";
    }
  }
}
function renderStyleTemplates() {
  if (!els.styleTemplateSelect) return;
  const currentId = state.selectedStyleTemplateId === "" ? "" : state.styleTemplates.some(template => template.id === state.selectedStyleTemplateId)
    ? state.selectedStyleTemplateId
    : state.styleTemplates[0]?.id;
  els.styleTemplateSelect.innerHTML = "";
  const customOption = document.createElement("option");
  customOption.value = "";
  customOption.textContent = "自定义参数";
  customOption.title = "当前参数已手动修改，未绑定到任何模板";
  els.styleTemplateSelect.append(customOption);
  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = "预置模板";
  const userGroup = document.createElement("optgroup");
  userGroup.label = "我的模板";
  for (const template of state.styleTemplates) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.builtIn ? template.name : `${template.name}`;
    option.title = template.builtIn ? "预置风格模板" : "自定义风格模板";
    (template.builtIn ? builtInGroup : userGroup).append(option);
  }
  els.styleTemplateSelect.append(builtInGroup, userGroup);
  els.styleTemplateSelect.value = currentId ?? "";
  if (els.applyStyleTemplate) {
    els.applyStyleTemplate.disabled = !currentId;
    els.applyStyleTemplate.setAttribute("aria-disabled", currentId ? "false" : "true");
  }
  if (els.redrawFromStyle) {
    els.redrawFromStyle.classList.add("primary-action", "style-redraw-cta");
  }
  syncStyleTemplateBarState(currentId ?? "");
  state.selectedStyleTemplateId = els.styleTemplateSelect.value;
  persistSetting("roughPptSelectedStyleTemplate", state.selectedStyleTemplateId);
  const template = selectedStyleTemplate();
  if (els.saveStyleTemplate) {
    const label = els.saveStyleTemplate.querySelector("[data-style-template-save-label]");
    if (label) label.textContent = !template ? "保存模板" : template.builtIn ? "另存模板" : "另存副本";
    els.saveStyleTemplate.title = !template
      ? "把当前自定义参数保存为新的跨文件风格模板"
      : template.builtIn
        ? "把当前预置模板另存为可重命名的自定义模板"
        : "把当前自定义模板和参数另存为一个新副本";
  }
  if (els.renameStyleTemplate) {
    els.renameStyleTemplate.disabled = !template || template.builtIn;
    els.renameStyleTemplate.title = !template ? "当前为自定义参数；请选择或保存自定义模板后再重命名" : template.builtIn ? "预置模板不能重命名，请先保存为自定义模板" : "重命名当前自定义风格模板";
  }
  renderStyleTemplatePreview();
}

function renderStyleTemplatePreview() {
  if (!els.styleTemplatePreview) return;
  initHorizontalDragScroll();
  els.styleTemplatePreview.classList.add("style-template-preview");
  els.styleTemplatePreview.innerHTML = "";
  const templates = state.styleTemplates;
  const selectedId = state.selectedStyleTemplateId || "";
  els.styleTemplatePreview.dataset.templateCount = String(templates.length);
  els.styleTemplatePreview.dataset.templateSelected = selectedId;
  els.styleTemplatePreview.dataset.hasSelection = selectedId ? "true" : "false";
  els.styleTemplatePreview.title = selectedId
    ? "当前已选择风格模板；点击其他预览卡可切换。预览只用于界面提示，不生成图片或 SVG 内容"
    : "当前为自定义参数，未绑定模板；点击预览卡可应用对应风格模板。预览只用于界面提示，不生成图片或 SVG 内容";
  if (!templates.length) {
    const empty = document.createElement("div");
    empty.className = "style-template-empty";
    empty.textContent = "暂无风格模板";
    empty.title = "预置模板加载后会显示在这里；也可保存当前参数为自定义模板";
    els.styleTemplatePreview.append(empty);
    return;
  }
  for (const template of templates) {
    const params = normalizeStyle({ ...baseStyleParams, ...(template.params ?? {}) }, baseStyleParams);
    const card = document.createElement("button");
    card.type = "button";
    const selected = template.id === state.selectedStyleTemplateId;
    card.className = `style-template-card${selected ? " active" : ""}`;
    card.setAttribute("data-style-template-id", template.id);
    card.setAttribute("aria-pressed", selected ? "true" : "false");
    card.title = selected
      ? `${template.name}：当前已应用，后续插入和重绘会使用该模板参数`
      : `${template.name}：点击应用此风格模板，后续插入和重绘都会使用对应参数`;
    card.setAttribute("aria-label", card.title);

    const swatch = document.createElement("span");
    swatch.className = "style-template-swatch";
    swatch.dataset.templatePreviewShape = "true";
    swatch.style.setProperty("--template-stroke", params.stroke || "#111111");
    swatch.style.setProperty("--template-fill", params.fillMode === "solid" ? (params.fillColor || "#ffffff") : "transparent");
    swatch.style.setProperty("--template-line-width", `${Math.max(1, Number(params.strokeWidthPt || 2))}px`);
    swatch.style.setProperty("--template-jitter", `${Math.min(6, Math.max(1, Number(params.edgeJitterPt || params.roughness || 1)))}px`);
    const line = document.createElement("span");
    line.className = "style-template-line";
    const texture = document.createElement("span");
    texture.className = `style-template-texture${params.fillStyle && params.fillStyle !== "none" ? " active" : ""}`;
    swatch.append(line, texture);

    const label = document.createElement("span");
    label.className = "style-template-name";
    label.textContent = template.name;
    label.title = template.name;

    const meta = document.createElement("span");
    meta.className = "style-template-meta";
    meta.textContent = templatePreviewMeta(params);
    meta.title = "风格摘要：边界来源、填充纹理和模式";

    card.append(swatch, label, meta);
    card.addEventListener("click", () => {
      state.selectedStyleTemplateId = template.id;
      persistSetting("roughPptSelectedStyleTemplate", state.selectedStyleTemplateId);
      if (els.styleTemplateSelect) els.styleTemplateSelect.value = template.id;
      updateStyleTemplatePreviewActive();
      if (els.renameStyleTemplate) {
        els.renameStyleTemplate.disabled = Boolean(template.builtIn);
        els.renameStyleTemplate.title = template.builtIn ? "预置模板不能重命名，请先保存为自定义模板" : "重命名当前自定义风格模板";
      }
      applySelectedStyleTemplate();
    });
    els.styleTemplatePreview.append(card);
  }
}

function updateStyleTemplatePreviewActive() {
  if (!els.styleTemplatePreview) return;
  for (const card of els.styleTemplatePreview.querySelectorAll("[data-style-template-id]")) {
    const active = card.getAttribute("data-style-template-id") === state.selectedStyleTemplateId;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function templatePreviewMeta(params) {
  const source = params.roughSource === "roughjs" ? "Rough.js" :
    params.roughSource === "excalidraw" ? "白板" :
    params.roughSource === "drawio" ? "draw.io" :
    params.roughSource === "d2" ? "D2" :
    params.roughSource === "tldraw" ? "手线" :
    "默认";
  const fill = params.fillStyle === "brush" || params.fillSource === "brush" ? "涂刷" :
    params.fillStyle && params.fillStyle !== "none" ? "纹理" :
    params.fillMode === "solid" ? "纯色" :
    "无填充";
  const mode = params.roughMode === "nested" ? "嵌套" : "普通";
  return `${source} | ${fill} | ${mode}`;
}

function selectedStyleTemplate() {
  if (!state.selectedStyleTemplateId) return null;
  return state.styleTemplates.find(template => template.id === state.selectedStyleTemplateId) ?? null;
}

function currentStyleParams() {
  return pickStyleParams(normalizeStyle(state.params, baseStyleParams));
}

function currentInsertParams() {
  return pickStyleParams(normalizeStyle(state.insertParams, baseStyleParams));
}

function ribbonStylePresetIdForTemplateId(templateId) {
  const map = {
    "builtin-gentle": "stylePresetGentle",
    "builtin-paper": "stylePresetPaper",
    "builtin-bold": "stylePresetBold",
    "builtin-nested-diagonal": "stylePresetNested",
    "builtin-textured": "stylePresetTextured",
    "builtin-roughjs": "stylePresetRoughJs",
    "builtin-excalidraw": "stylePresetExcalidraw",
    "builtin-drawio-sketch": "stylePresetDrawio",
    "builtin-d2-sketch": "stylePresetD2",
    "builtin-tldraw-draw": "stylePresetTldraw",
    "builtin-brush-fill": "stylePresetBrush",
    "builtin-fragmented": "stylePresetFragments",
    "builtin-fragmented-dense": "stylePresetDenseFragments"
  };
  return map[templateId] ?? "";
}

function syncInsertStylePresetToHost() {
  postHost({
    type: "setInsertStylePreset",
    params: currentInsertParams(),
    styleTemplateId: state.selectedStyleTemplateId || "",
    ribbonStylePresetId: ribbonStylePresetIdForTemplateId(state.selectedStyleTemplateId)
  });
}

function redrawSelectionFromCurrentStyle(status = "正在按当前风格参数重绘选区...") {
  setStatus(status);
  markLocalParamEdit();
  syncInsertStylePresetToHost();
  postHost({ type: "refreshSelection", params: currentStyleParams() });
}

function clearStyleTemplateSelection() {
  state.selectedStyleTemplateId = "";
  persistSetting("roughPptSelectedStyleTemplate", "");
  if (els.styleTemplateSelect) els.styleTemplateSelect.value = "";
  if (els.renameStyleTemplate) {
    els.renameStyleTemplate.disabled = true;
    els.renameStyleTemplate.title = "当前为自定义参数；请选择或保存自定义模板后再重命名";
  }
  renderStyleTemplatePreview();
}

function selectStyleTemplate(templateId) {
  const template = state.styleTemplates.find(item => item.id === templateId);
  if (!template) return false;
  state.selectedStyleTemplateId = template.id;
  persistSetting("roughPptSelectedStyleTemplate", state.selectedStyleTemplateId);
  if (els.styleTemplateSelect) els.styleTemplateSelect.value = template.id;
  updateStyleTemplatePreviewActive();
  if (els.renameStyleTemplate) {
    els.renameStyleTemplate.disabled = Boolean(template.builtIn);
    els.renameStyleTemplate.title = template.builtIn ? "预置模板不能重命名，请先保存为自定义模板" : "重命名当前自定义风格模板";
  }
  return true;
}

function applySelectedStyleTemplate() {
  const template = selectedStyleTemplate();
  if (!template) return;
  const normalized = normalizeStyle({ ...state.insertParams, ...template.params }, state.insertParams);
  state.insertParams = normalized;
  state.params = normalized;
  applyParamsToControls(state.params);
  markLocalParamEdit();
  render();
  syncInsertStylePresetToHost();
  postHost({ type: "updateParams", params: currentStyleParams() });
  setStatus(`已应用风格模板：${template.name}`);
}

function applyStyleQuickAction(action) {
  if (action === "paper") {
    if (selectStyleTemplate("builtin-paper")) applySelectedStyleTemplate();
    else setStatus("未找到论文框图模板。", true);
    return;
  }

  clearStyleTemplateSelection();
  const next = normalizeStyle(state.params, baseStyleParams);
  switch (action) {
    case "whiteFill":
      next.fillMode = "solid";
      next.fillStyle = "solid";
      next.fillSource = "auto";
      next.fillColor = "#ffffff";
      next.fillTransparency = 0;
      break;
    case "noFill":
      next.fillMode = "none";
      next.fillStyle = "none";
      next.fillSource = "auto";
      next.fillTransparency = 0;
      break;
    case "brushFill":
      next.fillMode = "solid";
      next.fillSource = "brush";
      next.fillStyle = "brush";
      next.brushWidthPt = Math.max(5, Number(next.brushWidthPt || 5));
      next.brushDensity = Math.max(1.1, Number(next.brushDensity || 1));
      next.brushOverlap = Math.max(0.35, Number(next.brushOverlap || 0.35));
      next.fillTransparency = 0;
      break;
    case "blackStroke":
      next.stroke = "#000000";
      next.strokeTransparency = 0;
      break;
    case "blueStroke":
      next.stroke = "#0f6cbd";
      next.strokeTransparency = 0;
      break;
    case "boldLine":
      next.strokeWidthPt = 4;
      break;
    case "dashLine":
      next.dashStyle = "dash";
      break;
    case "endArrow":
      next.arrowheadStyle = "rough";
      next.arrowheadPosition = "end";
      break;
    default:
      return;
  }

  state.params = normalizeStyle(next, baseStyleParams);
  state.insertParams = normalizeStyle(state.params, baseStyleParams);
  applyParamsToControls(state.params);
  markLocalParamEdit();
  render();
  syncInsertStylePresetToHost();
  postHost({ type: "updateParams", params: currentStyleParams() });
  setStatus(`已应用常用样式：${styleQuickLabel(action)}`);
}

function renderStyleQuickActions() {
  for (const button of els.styleQuickButtons ?? []) {
    const action = button.dataset.styleQuick || "";
    const active = styleQuickActive(action);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function styleQuickActive(action) {
  const params = normalizeStyle(state.params, baseStyleParams);
  switch (action) {
    case "paper":
      return state.selectedStyleTemplateId === "builtin-paper";
    case "whiteFill":
      return params.fillMode === "solid" && params.fillStyle === "solid" && params.fillColor.toLowerCase() === "#ffffff" && params.fillTransparency === 0;
    case "noFill":
      return params.fillMode === "none";
    case "brushFill":
      return params.fillMode === "solid" && (params.fillSource === "brush" || params.fillStyle === "brush");
    case "blackStroke":
      return params.stroke.toLowerCase() === "#000000" && params.strokeTransparency === 0;
    case "blueStroke":
      return params.stroke.toLowerCase() === "#0f6cbd" && params.strokeTransparency === 0;
    case "boldLine":
      return Number(params.strokeWidthPt) >= 4;
    case "dashLine":
      return params.dashStyle === "dash";
    case "endArrow":
      return params.arrowheadStyle !== "none" && params.arrowheadPosition === "end";
    default:
      return false;
  }
}

function styleQuickLabel(action) {
  const labels = {
    paper: "论文",
    whiteFill: "白填充",
    noFill: "无填充",
    brushFill: "涂刷",
    blackStroke: "黑线",
    blueStroke: "蓝线",
    boldLine: "粗线",
    dashLine: "虚线",
    endArrow: "末箭头"
  };
  return labels[action] || "常用样式";
}

function finishStyleTemplateManagement() {
  if (els.styleTemplateTools) els.styleTemplateTools.open = false;
  els.styleTemplateSelect?.focus({ preventScroll: true });
}

function saveCurrentStyleTemplate() {
  showInlinePrompt({
    title: "保存风格模板",
    message: "输入新模板名称，保存后会作为自定义模板跨文件可用。",
    input: true,
    defaultValue: `我的风格 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
    placeholder: "风格模板名称",
    confirmLabel: "保存",
    cancelStatus: "已取消保存风格模板。",
    onConfirm: name => {
      const template = {
        id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        builtIn: false,
        params: pickStyleParams(normalizeStyle(state.params, baseStyleParams))
      };
      state.styleTemplates.push(template);
      state.selectedStyleTemplateId = template.id;
      state.insertParams = normalizeStyle(template.params, baseStyleParams);
      saveUserStyleTemplates(state.styleTemplates);
      renderStyleTemplates();
      syncInsertStylePresetToHost();
      setStatus(`已保存风格模板：${template.name}`);
      finishStyleTemplateManagement();
    }
  });
}

function renameSelectedStyleTemplate() {
  const template = selectedStyleTemplate();
  if (!template || template.builtIn) {
    setStatus("预置模板不能重命名，请先保存为自定义模板。", true);
    return;
  }
  showInlinePrompt({
    title: "重命名风格模板",
    message: `输入“${template.name}”的新名称。`,
    input: true,
    defaultValue: template.name,
    placeholder: "新的风格模板名称",
    confirmLabel: "重命名",
    cancelStatus: "已取消重命名风格模板。",
    onConfirm: name => {
      template.name = name;
      saveUserStyleTemplates(state.styleTemplates);
      renderStyleTemplates();
      setStatus(`已重命名风格模板：${template.name}`);
      finishStyleTemplateManagement();
    }
  });
}

function setStyleParamRelevance(names, relevant) {
  for (const name of names) {
    const label = els.params.querySelector(`[name="${name}"]`)?.closest("label");
    if (!label) continue;
    label.classList.toggle("param-irrelevant", !relevant);
    label.setAttribute("aria-hidden", relevant ? "false" : "true");
  }
}

function refreshStyleParamSectionCounts() {
  for (const section of els.params.querySelectorAll(".param-section")) {
    const summary = section.querySelector(":scope > summary");
    const count = summary?.querySelector(".param-section-count");
    const relevantCount = section.querySelectorAll(".param-section-body > label:not(.param-irrelevant)").length;
    const countText = `${relevantCount} 项`;
    const hintText = summary?.dataset.hint || "更多参数";
    const group = section.dataset.paramGroup || "风格";
    if (count) count.textContent = countText;
    if (summary) {
      summary.dataset.count = countText;
      summary.title = `${group}参数组：${hintText}，当前显示 ${countText}，点击展开或收起`;
      summary.setAttribute("aria-label", `${group}参数组，关键参数：${hintText}，当前显示 ${countText}。点击展开或收起`);
    }
  }
}

function syncStyleParamAvailability() {
  const enabled = state.params.roughMode === "nested";
  for (const input of els.params.querySelectorAll("[data-nested-param]")) {
    input.disabled = !enabled;
    input.closest(".param-number-row")?.querySelectorAll("button").forEach(button => {
      button.disabled = !enabled;
    });
    const label = input.closest("label");
    if (label) label.classList.toggle("disabled", !enabled);
  }
  setStyleParamRelevance(["nestedLayers", "nestedOverlap", "nestedGapPt", "nestedJitterPt", "nestedDirection"], enabled);
  const brushEnabled = state.params.fillSource === "brush" || state.params.fillStyle === "brush";
  setStyleParamRelevance(["brushWidthPt", "brushDensity", "brushAngleDeg", "brushJitterPt", "brushOverlap"], brushEnabled);
  const textureEnabled = new Set(["hachure", "cross-hatch", "zigzag", "dots", "dashed", "zigzag-line"]).has(state.params.fillStyle);
  setStyleParamRelevance(["fillWeight", "hachureGap"], textureEnabled);
  const arrowEnabled = state.params.arrowheadStyle !== "none";
  setStyleParamRelevance(["arrowheadPosition"], arrowEnabled);
  setStyleParamRelevance(["arrowheadLengthPt", "arrowheadWidthPt"], state.params.arrowheadStyle === "rough");
  setStyleParamRelevance(["tldrawOffsetPt"], state.params.roughSource === "tldraw");
  refreshStyleParamSectionCounts();
}

function syncNestedParamAvailability() {
  syncStyleParamAvailability();
}

function initCollapsiblePanels() {
  for (const section of document.querySelectorAll("[data-collapsible]")) {
    const button = section.querySelector(".collapse-toggle");
    if (!button) continue;
    const key = section.dataset.collapseKey || "";
    const saved = localStorage.getItem(`roughPptCollapsed:${key}`);
    const collapsed = saved == null ? defaultCollapsedPanelKeys.has(key) : saved === "true";
    setPanelCollapsed(section, button, collapsed);
    button.addEventListener("click", () => {
      const next = !section.classList.contains("collapsed");
      if (state.uiMode === "simple" && simpleWorkflowPanelKeys.includes(key)) {
        if (next) {
          setPanelCollapsed(section, button, true);
          persistSetting("roughPptSimpleActivePanel", "none");
        } else {
          setSimpleActivePanel(key);
        }
      } else {
        setPanelCollapsed(section, button, next);
        persistSetting(`roughPptCollapsed:${key}`, String(next));
      }
    });
  }
}

function setPanelCollapsed(section, button, collapsed) {
  section.classList.toggle("collapsed", collapsed);
  button.textContent = collapsed ? "展开" : "收起";
  button.setAttribute("aria-expanded", String(!collapsed));
  const title = section.dataset.collapseTitle || "功能区";
  button.title = collapsed ? `展开${title}功能区` : `收起${title}功能区`;
}

function wireParams() {
  for (const input of els.params.querySelectorAll("input[name], select[name]")) {
    const onParamInput = () => {
      const key = input.name;
      clearStyleTemplateSelection();
      state.params[key] = input.type === "number" || input.type === "range" ? Number(input.value) : input.value;
      syncParamControls(key, input.value, input);
      if (key === "roughSource") {
        const rawSources = new Set(["roughjs", "excalidraw", "drawio", "d2"]);
        state.params.roughEngine = rawSources.has(String(state.params.roughSource).toLowerCase()) ? "roughJs" : "nativeWarp";
        syncParamControls("roughEngine", state.params.roughEngine, null);
      }
      syncNestedParamAvailability();
      if (state.params.fillMode === "none" && (key === "fillColor" || (key === "fillSource" && state.params.fillSource !== "auto") || (key === "fillStyle" && state.params.fillStyle !== "none"))) {
        state.params.fillMode = "solid";
        const fillMode = els.params.querySelector('[name="fillMode"]');
        if (fillMode) fillMode.value = "solid";
        setStatus(key === "fillStyle" ? "已启用填充纹理并准备实时重绘。" : "已启用纯色填充并准备实时重绘。");
      }
      markLocalParamEdit();
      state.insertParams = normalizeStyle(state.params, baseStyleParams);
      render();
      window.clearTimeout(updateTimer);
      updateTimer = window.setTimeout(() => {
        syncInsertStylePresetToHost();
        postHost({ type: "updateParams", params: currentStyleParams() });
      }, 180);
    };
    input.addEventListener("input", onParamInput);
    input.addEventListener("change", onParamInput);
  }

  for (const button of els.params.querySelectorAll("[data-param-step]")) {
    button.addEventListener("click", () => {
      adjustParamValue(button.dataset.paramStep, Number(button.dataset.direction || "1"));
    });
  }
}

function wireStyleTemplates() {
  renderStyleTemplates();
  els.styleTemplateSelect?.addEventListener("change", () => {
    state.selectedStyleTemplateId = els.styleTemplateSelect.value;
    persistSetting("roughPptSelectedStyleTemplate", state.selectedStyleTemplateId);
    renderStyleTemplates();
    if (state.selectedStyleTemplateId) applySelectedStyleTemplate();
    else {
      state.insertParams = normalizeStyle(state.params, baseStyleParams);
      syncInsertStylePresetToHost();
    }
  });
  els.applyStyleTemplate?.addEventListener("click", applySelectedStyleTemplate);
  els.redrawFromStyle?.addEventListener("click", () => redrawSelectionFromCurrentStyle("正在按风格面板参数重绘选区..."));
  els.saveStyleTemplate?.addEventListener("click", saveCurrentStyleTemplate);
  els.renameStyleTemplate?.addEventListener("click", renameSelectedStyleTemplate);
  for (const button of els.styleQuickButtons ?? []) {
    button.addEventListener("click", () => applyStyleQuickAction(button.dataset.styleQuick));
  }
}

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  resetResourceRenderWindows(["chart", "shape", "preset", "asset"]);
  scheduleRender();
});
els.search.addEventListener("keydown", event => {
  flushScheduledRender();
  if (event.key === "Enter") {
    if (locateFirstCommandFromSearch(false)) event.preventDefault();
  } else if (event.key === "ArrowDown") {
    if (locateFirstCommandFromSearch(true)) event.preventDefault();
  }
});
for (const button of els.searchScopeButtons ?? []) {
  button.addEventListener("click", () => {
    state.searchScope = button.dataset.searchScope || "all";
    persistSetting("roughPptSearchScope", state.searchScope);
    resetResourceRenderWindows("chart");
    render();
    setStatus(`已切换搜索范围：${searchScopeLabel()}`);
  });
}
els.sortMode.value = state.sortMode;
els.sortMode.addEventListener("change", () => {
  state.sortMode = els.sortMode.value;
  persistSetting("roughPptSortMode", state.sortMode);
  render();
});
els.galleryToggle.addEventListener("click", toggleShapeDropdown);
els.quickAddToggle.addEventListener("click", toggleQuickShapeDropdown);
els.reloadQuickShapes.addEventListener("click", () => {
  setStatus("正在刷新快速插入栏...");
  requestQuickShapes();
});
if (els.featurePanel) {
  applyFeatureBlockControls(state.featureBlock);
  postHost({ type: "updateFeatureBlockPreset", feature: sanitizeFeatureBlockDefault(state.featureBlock) });
  els.featurePanel.addEventListener("input", event => {
    const control = event.target.closest?.("[data-feature-param]");
    if (!control || !els.featurePanel.contains(control)) return;
    syncFeatureBlockControls(
      control.dataset.featureParam,
      control.type === "checkbox" ? control.checked : control.value,
      control
    );
    readFeatureBlockControls();
    if (!featureDirectionInput) {
      state.featureBlock.editDirection = "";
      state.featureBlock.editDelta = 0;
      scheduleFeatureBlockPresetSync();
    }
  });
  for (const button of els.featurePanel.querySelectorAll("[data-feature-dir]")) {
    button.addEventListener("click", () => adjustFeatureBlock(button.dataset.featureDir, Number(button.dataset.featureDelta || "1")));
  }
}
els.status?.addEventListener("click", () => toggleStatusExpanded());
els.status?.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleStatusExpanded();
  }
});
els.buildInfo?.addEventListener("click", showBuildInfo);
els.buildInfo?.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showBuildInfo();
  }
});
els.checkUpdates?.addEventListener("click", () => {
  if (state.updateChecking) return;
  if (!describeHostConnection()) {
    setStatus("无法连接 PowerPoint 宿主，不能检查更新。请通过 PPT 任务窗格打开本界面。", true);
    return;
  }
  setUpdateChecking(true);
  setStatus("正在检查 GitHub 正式 Release...");
  postHost({ type: "checkForUpdates" });
});
els.saveFeatureDefault?.addEventListener("click", saveFeatureBlockDefault);
els.featureDirectionTools?.querySelector(":scope > summary")?.addEventListener("click", event => {
  const selectionPanel = els.selectionState?.closest(".selection-panel");
  if (selectionPanel?.dataset.selectionKind === "feature") return;
  event.preventDefault();
  syncFeatureDirectionTools(false);
  setStatus("请先在 PowerPoint 中选中特征块，再使用方向增删。", false);
});
els.insertFeatureBlock?.addEventListener("click", () => {
  const feature = readFeatureBlockControls();
  setStatus(`正在${els.insertFeatureBlock.textContent.includes("更新") ? "更新" : "插入"}${feature.mode === "2d" ? "二维" : "三维"}特征块...`);
  postHost({ type: "insertFeatureBlock", feature });
  state.featureBlock.editDirection = "";
  state.featureBlock.editDelta = 0;
});
document.addEventListener("click", event => {
  if (!els.shapeDropdown.hidden &&
      !els.shapeDropdown.contains(event.target) &&
      !els.galleryToggle.contains(event.target)) {
    closeShapeDropdown();
  }

  if (!els.quickShapeDropdown.hidden &&
      !els.quickShapeDropdown.contains(event.target) &&
      !els.quickAddToggle.contains(event.target)) {
    closeQuickShapeDropdown();
  }

  if (els.quickShapeContextMenu && !els.quickShapeContextMenu.hidden && !els.quickShapeContextMenu.contains(event.target)) {
    closeQuickShapeContextMenu();
  }

  if (els.zoteroSwatchContextMenu && !els.zoteroSwatchContextMenu.hidden && !els.zoteroSwatchContextMenu.contains(event.target)) {
    closeZoteroSwatchMenu();
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeShapeDropdown();
    closeQuickShapeDropdown();
    closeQuickShapeContextMenu();
    closeZoteroSwatchMenu();
    closeInlinePrompt();
    toggleStatusExpanded(false);
  }
});
els.refresh.addEventListener("click", () => redrawSelectionFromCurrentStyle("正在重绘当前手绘选区..."));
els.convert.addEventListener("click", () => {
  setStatus("正在转换选区为手绘原生对象...");
  postHost({ type: "convertSelectionToRough", params: currentStyleParams() });
});
els.inspect.addEventListener("click", () => postHost({ type: "inspectSelection" }));
els.selectCarrier.addEventListener("click", () => postHost({ type: "selectNativeCarrier" }));
els.save.addEventListener("click", () => {
  setStatus("正在保存选中的 PPT 原生对象...");
  postHost({ type: "saveSelectionAsAsset" });
});
els.reloadAssets.addEventListener("click", requestUserAssets);
els.selectAssets.addEventListener("click", () => {
  const assets = filteredAssets();
  const allFilteredSelected = assets.length > 0 && assets.every(asset => state.selectedAssetIds.has(asset.Id));
  if (allFilteredSelected) {
    for (const asset of assets) state.selectedAssetIds.delete(asset.Id);
    setStatus("已取消选择当前筛选素材。");
  } else {
    for (const asset of assets) if (asset.Id) state.selectedAssetIds.add(asset.Id);
    setStatus(`已选择当前筛选素材：${assets.length} 个`);
  }
  renderUserAssets();
});
els.importAssets.addEventListener("click", () => {
  setStatus("正在导入素材包...");
  postHost({ type: "importUserAssets" });
});
els.exportAssets.addEventListener("click", () => {
  const assetIds = exportAssetIds();
  if (!assetIds.length) {
    setStatus("没有可分享的素材，请先保存或筛选素材。", true);
    return;
  }
  const selected = assetIds.filter(assetId => state.selectedAssetIds.has(assetId)).length;
  setStatus(selected
    ? `正在生成已选素材分享包：${assetIds.length} 个素材`
    : `未勾选，正在导出当前筛选素材：${assetIds.length} 个`);
  postHost({ type: "exportUserAssets", assetIds });
});
els.zlkChartImport?.addEventListener("click", () => els.zlkChartFiles?.click());
els.zlkChartFolderButton?.addEventListener("click", () => els.zlkChartFolder?.click());
els.zlkChartFiles?.addEventListener("change", event => {
  handleZlkChartFiles(event.target.files);
  event.target.value = "";
});
els.zlkChartFolder?.addEventListener("change", event => {
  handleZlkChartFiles(event.target.files);
  event.target.value = "";
});
els.zlkChartClear?.addEventListener("click", () => {
  state.chartDatasets = [];
  if (els.chartPresetShell && state.uiMode === "simple") els.chartPresetShell.open = false;
  resetResourceRenderWindows("chart");
  state.chartImportError = "";
  renderChartImportPanel();
  setStatus("已清空科研绘图导入预览。");
});
els.zoteroImageSearch?.addEventListener("input", () => {
  state.zoteroQuery = els.zoteroImageSearch.value;
  resetResourceRenderWindows(["zotero", "palette"]);
  scheduleZoteroLibraryRender();
  window.clearTimeout(zoteroSearchTimer);
  zoteroSearchTimer = window.setTimeout(requestZoteroImages, 280);
});
els.zoteroImageSearch?.addEventListener("keydown", event => {
  flushZoteroLibraryRender();
  if (event.key === "Enter") {
    event.preventDefault();
    requestZoteroImages(true);
  }
});
els.zoteroImageReload?.addEventListener("click", () => {
  setStatus("正在读取 Zotero 论文图像库...");
  requestZoteroImages(true);
});
els.saveZoteroPalette?.addEventListener("click", () => {
	if (!state.activeZoteroReferenceImageId) {
		setStatus("请先选择一张论文图像作为配色参考。", true);
		return;
	}
  setStatus("正在保存当前 Zotero 论文图像配色...");
  postHost({ type: "saveZoteroPalette", imageId: state.activeZoteroReferenceImageId, sourceTitle: state.activeZoteroReferenceTitle });
});
els.extractClipboardPalette?.addEventListener("click", () => {
  setStatus("正在从剪贴板图片提取配色...");
  postHost({ type: "extractClipboardPalette" });
});
els.extractSlidePalette?.addEventListener("click", () => {
  setStatus("正在从当前页面提取配色...");
  postHost({ type: "extractSlidePalette" });
});
els.importPalettes?.addEventListener("click", () => {
  setStatus("正在导入配色分享包...");
  postHost({ type: "importPalettes" });
});
els.exportPalettes?.addEventListener("click", () => {
  const paletteIds = exportPaletteIds();
  if (!paletteIds.length) {
    setStatus("没有可分享的用户配色，请先保存、取色或导入配色。", true);
    return;
  }
  const selectedCount = filteredPaletteSchemes()
    .filter(palette => !paletteIsBuiltIn(palette) && state.selectedPaletteIds.has(paletteId(palette)))
    .length;
  setStatus(selectedCount
    ? `正在生成已选配色分享包：${paletteIds.length} 个用户配色`
    : `未勾选，正在导出当前筛选用户配色：${paletteIds.length} 个`);
  postHost({ type: "exportPalettes", paletteIds });
});
els.reloadPalettes?.addEventListener("click", () => {
  setStatus("正在刷新配色库...");
  requestPalettes();
});
if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", event => handleHostMessage(event.data));
}

function safeInitStep(label, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[RoughPpt] ${label} failed`, error);
    try {
      setStatus(`${label}初始化失败：${error?.message || error}`, true);
    } catch {}
  }
}

function initHorizontalDragScroll() {
  const containers = document.querySelectorAll(
    ".chart-preset-strip, .style-template-preview, .style-quick-strip, .style-param-jump, .search-suggestion-list"
  );
  for (const container of containers) {
    if (container.dataset.dragScrollReady === "true") continue;
    container.dataset.dragScrollReady = "true";
    container.classList.add("horizontal-drag-scroll");
    if (!container.hasAttribute("tabindex")) container.tabIndex = 0;
    if (!container.hasAttribute("aria-label")) {
      const label = container.classList.contains("style-template-preview")
        ? "风格模板预览，可横向拖动或按左右方向键查看更多"
        : container.classList.contains("search-suggestion-list")
            ? "常用搜索建议，可横向拖动或按左右方向键查看更多"
          : container.classList.contains("style-quick-strip")
            ? "常用风格快捷项，可横向拖动或按左右方向键查看更多"
          : container.classList.contains("style-param-jump")
            ? "风格参数分组，可横向拖动或按左右方向键查看更多"
            : "科研图预设，可横向拖动或按左右方向键查看更多";
      container.setAttribute("aria-label", label);
    }
    if (!container.title) {
      container.title = "内容较多时可左右拖动；聚焦后也可按左右方向键滚动。";
    }

    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;
    let dragged = false;
    let suppressClickUntil = 0;

    const finishDrag = event => {
      if (pointerId === null || (event.pointerId != null && event.pointerId !== pointerId)) return;
      const finishedPointerId = pointerId;
      pointerId = null;
      container.classList.remove("is-dragging");
      if (dragged) suppressClickUntil = Date.now() + 250;
      if (container.hasPointerCapture?.(finishedPointerId)) container.releasePointerCapture(finishedPointerId);
    };

    container.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (container.scrollWidth <= container.clientWidth + 1) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = container.scrollLeft;
      dragged = false;
      container.setPointerCapture?.(pointerId);
    });
    container.addEventListener("pointermove", event => {
      if (event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      if (!dragged && Math.abs(deltaX) < 4) return;
      dragged = true;
      container.classList.add("is-dragging");
      container.scrollLeft = startScrollLeft - deltaX;
      event.preventDefault();
    });
    container.addEventListener("pointerup", finishDrag);
    container.addEventListener("pointercancel", finishDrag);
    container.addEventListener("lostpointercapture", finishDrag);
    container.addEventListener("click", event => {
      if (Date.now() > suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntil = 0;
    }, true);
    container.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (container.scrollWidth <= container.clientWidth + 1) return;
      event.preventDefault();
      container.scrollBy({ left: event.key === "ArrowLeft" ? -120 : 120, behavior: "smooth" });
    });
  }
}

safeInitStep("功能图标", () => hydrateFunctionIcons());
safeInitStep("上下文下一步", () => updateSelectionNextStep("none"));
safeInitStep("风格参数分组", () => groupStyleParamControls());
safeInitStep("特征块参数分组", () => groupFeatureBlockControls());
safeInitStep("风格数字步进", () => enhanceParamControls());
safeInitStep("特征块数字步进", () => enhanceFeatureParamControls());
safeInitStep("风格分区同步", () => syncStyleSectionsForUiMode(state.uiMode));
safeInitStep("风格参数跳转", () => wireStyleParamJumps());
safeInitStep("风格参数绑定", () => wireParams());
safeInitStep("风格模板绑定", () => wireStyleTemplates());
safeInitStep("折叠面板", () => initCollapsiblePanels());
safeInitStep("界面模式", () => initUiModeControls());
safeInitStep("功能导航抽屉", () => initSectionNavDrawer());
safeInitStep("使用说明返回位置", () => initUsageGuideNavigation());
safeInitStep("粘性顶栏度量", () => {
  updateStickyChromeMetrics();
  observeStickyChromeHeight();
  if (!window.__roughStickyChromeWired) {
    window.__roughStickyChromeWired = true;
    window.addEventListener("resize", updateStickyChromeMetrics, { passive: true });
  }
});

safeInitStep("导航滚动定位", () => {
  if (!window.__roughSectionNavScrollWired) {
    window.__roughSectionNavScrollWired = true;
    window.addEventListener("scroll", scheduleSectionNavScrollSync, { passive: true });
    window.addEventListener("resize", scheduleSectionNavScrollSync, { passive: true });
  }
  syncSectionNavToScroll();
});

safeInitStep("工作流导航", () => initWorkflowNavigation());
safeInitStep("横向拖动滚动", () => initHorizontalDragScroll());
safeInitStep("科研图预设条", () => renderChartPresetStrip());
safeInitStep("参数回填", () => applyParamsToControls(state.params));
safeInitStep("嵌套参数可用性", () => syncNestedParamAvailability());
safeInitStep("选区动作可用性", () => setSelectionActionAvailability("none"));
safeInitStep("插入风格同步", () => syncInsertStylePresetToHost());
await loadCatalog();
safeInitStep("首屏渲染", () => render());
requestUserAssets();
requestShapeIcons();
requestQuickShapes();
requestZoteroImages();
requestPalettes();
requestSelectionState();
loadBuildInfo();
window.roughPpt = window.roughPpt || {};
window.roughPpt.importZlkClusterResultForHost = (filePath, content) => JSON.stringify(zlkDatasetForHost(filePath, content));
window.roughPpt.normalizeZlkChartFiles = async (request, files) => {
  const normalized = await normalizeZlkChartFilesForHost(request, files);
  return JSON.stringify({
    dataset: toHostZlkDataset(normalized.dataset),
    chartSpec: normalized.chartSpec,
    errors: normalized.errors
  });
};
window.roughPptTaskPaneReady = true;
const startupIssues = [];
if (!describeHostConnection()) {
  startupIssues.push("未连接 PowerPoint 宿主；插入和重绘需在 PPT 任务窗格中使用。");
}
if (state.catalogDegraded) {
  startupIssues.push("完整形状目录读取失败，当前只显示常用形状兜底；重启任务窗格可重试。");
}
if (startupIssues.length) {
  setStatus(startupIssues.join(" "), true);
}
