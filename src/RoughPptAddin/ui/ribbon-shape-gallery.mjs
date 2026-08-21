import { generator } from "./rough-shape-generator.mjs";

const els = {
  close: document.querySelector("#closeGallery"),
  search: document.querySelector("#gallerySearch"),
  shapeDropdown: document.querySelector("#shapeDropdown"),
  contextMenu: document.querySelector("#shapeContextMenu"),
  status: document.querySelector("#galleryStatus")
};

const state = {
  catalog: [],
  recent: loadJson("roughPptRecentShapes", []),
  favorites: loadJson("roughPptFavoriteShapes", []),
  sortMode: localStorage.getItem("roughPptSortMode") || "smart",
  query: "",
  contextAnchor: null,
  params: {
    stroke: "#111111",
    strokeWidthPt: 2,
    strokeTransparency: 0,
    roughness: 0.8,
    bowing: 0.35,
    seed: 12345,
    fillMode: "none",
    fillColor: "#ffffff",
    fillTransparency: 0,
    fillStyle: "none",
    dashStyle: "solid",
    arrowheadStyle: "rough",
    arrowheadPosition: "end"
  }
};

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

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    if (Array.isArray(fallback)) {
      return Array.isArray(value) ? value.filter(item => typeof item === "string") : fallback;
    }
    return value;
  } catch {
    return fallback;
  }
}

// 与 loadJson 对称：本机存储被禁用或写满时写入会抛出，
// 而这些写入都发生在 setStatus 与 postHost 之前，异常会让插入和固定操作彻底丢失。
function persistSetting(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    if (!persistSetting.reported) {
      persistSetting.reported = true;
      setStatus("偏好无法写入本机存储，最近使用和快速插入只在本窗口生效。");
    }
    return false;
  }
}

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
  const response = await fetch("./autoshape-catalog.json").catch(() => null);
  try {
    if (!response?.ok) throw new Error(`HTTP ${response?.status ?? "network"}`);
    const catalog = await response.json();
    state.catalog = Array.isArray(catalog.items) ? catalog.items : [];
    if (!state.catalog.length) throw new Error("目录为空");
  } catch {
    state.catalog = [];
    setStatus("形状目录读取失败，请重新打开窗口；若重复出现请重新安装插件。");
  }
}

function renderIconDropdown(container, onClick) {
  if (!container) return;
  container.innerHTML = "";
  let renderedCount = 0;
  for (const group of galleryGroups) {
    const items = state.catalog
      .filter(item => item.insertable !== false && group.match(item) && matchesQuery(item))
      .sort(sortItems);
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
    for (const item of items) {
      list.append(renderGalleryButton(item, onClick));
      renderedCount += 1;
    }
    section.append(list);
    container.append(section);
  }
  if (renderedCount === 0 && state.query.trim()) {
    container.append(renderGalleryEmptyState());
  }
  if (!renderedCount && !container.querySelector(".gallery-empty")) {
    const empty = document.createElement("p");
    empty.className = "gallery-empty";
    empty.textContent = "形状目录不可用。";
    empty.title = "未读取到形状目录；请重新打开窗口或重新安装插件。";
    container.append(empty);
  }
}

function renderGalleryEmptyState() {
  const empty = document.createElement("section");
  empty.className = "gallery-empty";
  empty.dataset.galleryEmpty = "true";
  empty.setAttribute("role", "status");
  empty.setAttribute("aria-live", "polite");
  empty.title = "当前搜索没有匹配的形状，可清空搜索恢复完整形状图库";

  const title = document.createElement("strong");
  title.textContent = `没有匹配“${state.query.trim()}”`;
  title.title = "当前 Ribbon 形状图库没有匹配这个搜索词";

  const detail = document.createElement("span");
  detail.textContent = "可尝试中文形状名、英文枚举名，或清空搜索恢复全部分类。";
  detail.title = "搜索支持形状名称、PowerPoint 枚举名和分类关键词";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.dataset.galleryEmptyClear = "true";
  clear.textContent = "清空搜索";
  clear.title = "清空 Ribbon 形状图库搜索词并恢复全部分类";
  clear.setAttribute("aria-label", "清空搜索并恢复形状图库");
  clear.addEventListener("click", () => {
    state.query = "";
    if (els.search) {
      els.search.value = "";
      els.search.focus({ preventScroll: true });
    }
    renderIconDropdown(els.shapeDropdown, insertShape);
    setStatus("已清空搜索，已恢复形状图库。");
  });

  empty.append(title, detail, clear);
  return empty;
}

function renderGalleryButton(item, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `gallery-shape${isQuickShape(item.enumName) ? " pinned" : ""}`;
  button.title = displayName(item);
  button.setAttribute("aria-label", displayName(item));
  button.append(renderGalleryIcon(item));
  button.addEventListener("click", () => onClick(item));
  button.addEventListener("contextmenu", event => {
    event.preventDefault();
    openShapeContextMenu(event, item, button);
  });
  button.addEventListener("keydown", event => {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      openShapeContextMenu(event, item, button);
    }
  });
  return button;
}

function matchesQuery(item) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  return `${item.enumName} ${item.displayName ?? ""} ${item.displayNameZh ?? ""} ${(item.keywords ?? []).join(" ")} ${item.category ?? ""}`.toLowerCase().includes(query);
}

function renderGalleryIcon(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  safeDrawNativeIconPreview(canvas, item);
  return canvas;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(4, 4);
  ctx.strokeStyle = "#111111";
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
  } else {
    ctx.rect(4, 5, 16, 15);
  }
  ctx.stroke();
  ctx.restore();
}

function drawNativeIconPreview(canvas, item) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(4, 4);
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "transparent";
  ctx.lineWidth = 1.8;
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

function insertShape(item) {
  if (!item?.enumName) return;
  state.recent = [item.enumName, ...state.recent.filter(value => value !== item.enumName)].slice(0, 12);
  persistSetting("roughPptRecentShapes", JSON.stringify(state.recent));
  setStatus(`已插入：${displayName(item)}`);
  postHost({ type: "insertShape", enumName: item.enumName });
}

function pinQuickShape(item) {
  if (!item?.enumName) return;
  state.favorites = [item.enumName, ...state.favorites.filter(value => value !== item.enumName)].slice(0, 12);
  persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
  renderIconDropdown(els.shapeDropdown, insertShape);
  setStatus(`已添加到快速插入：${displayName(item)}`);
  postHost({ type: "pinQuickShape", enumName: item.enumName });
}

function unpinQuickShape(item) {
  if (!item?.enumName) return;
  state.favorites = state.favorites.filter(value => value !== item.enumName);
  persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
  renderIconDropdown(els.shapeDropdown, insertShape);
  setStatus(`已从快速插入移除：${displayName(item)}`);
  postHost({ type: "unpinQuickShape", enumName: item.enumName });
}

function openShapeContextMenu(event, item, anchor = null) {
  if (!els.contextMenu || !item?.enumName) return;
  const pinned = isQuickShape(item.enumName);
  state.contextAnchor = anchor;
  els.contextMenu.innerHTML = "";
  const title = document.createElement("div");
  title.className = "shape-context-title";
  title.textContent = displayName(item);
  els.contextMenu.append(title);

  const action = document.createElement("button");
  action.type = "button";
  action.setAttribute("role", "menuitem");
  action.textContent = pinned ? "从快速插入移除" : "添加到快速插入";
  action.title = action.textContent;
  action.addEventListener("click", () => {
    closeShapeContextMenu(true);
    if (pinned) unpinQuickShape(item);
    else pinQuickShape(item);
  });
  els.contextMenu.append(action);

  const x = Math.min(event.clientX, window.innerWidth - 156);
  const y = Math.min(event.clientY, window.innerHeight - 78);
  els.contextMenu.style.left = `${Math.max(6, x)}px`;
  els.contextMenu.style.top = `${Math.max(6, y)}px`;
  els.contextMenu.hidden = false;
  action.focus({ preventScroll: true });
}

function closeShapeContextMenu(restoreFocus = false) {
  if (els.contextMenu) els.contextMenu.hidden = true;
  if (restoreFocus && state.contextAnchor && document.contains(state.contextAnchor)) {
    state.contextAnchor.focus({ preventScroll: true });
  }
  if (restoreFocus) state.contextAnchor = null;
}

function isQuickShape(enumName) {
  return state.favorites.includes(enumName);
}

function setStatus(message) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.add("visible");
  clearTimeout(setStatus.timer);
  setStatus.timer = setTimeout(() => els.status.classList.remove("visible"), 1800);
}

function postHost(message) {
  if (window.chrome?.webview) window.chrome.webview.postMessage(message);
}

if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", event => {
    const message = event.data ?? {};
    if (message.type === "quickShapes") {
      state.favorites = (message.shapes ?? [])
        .map(item => typeof item === "string" ? item : item?.enumName)
        .filter(Boolean);
      persistSetting("roughPptFavoriteShapes", JSON.stringify(state.favorites));
      renderIconDropdown(els.shapeDropdown, insertShape);
    }
  });
}

document.addEventListener("click", () => closeShapeContextMenu(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeShapeContextMenu(true);
});
els.search?.addEventListener("input", () => {
  state.query = els.search.value;
  renderIconDropdown(els.shapeDropdown, insertShape);
});

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
    "rough3dCylinderRough",
    "rough3dConeRough",
    "rough3dSphereRough",
    "rough3dPyramidRough",
    "rough3dStackRough"
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

els.close?.addEventListener("click", () => postHost({ type: "close" }));
await loadCatalog();
renderIconDropdown(els.shapeDropdown, insertShape);
