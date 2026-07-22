const SITES = [
  { id: "rawgraphs", label: "RAWGraphs", detail: "复杂图表" },
  { id: "datawrapper", label: "Datawrapper", detail: "统计图表" },
  { id: "plotly", label: "Plotly Chart Studio", detail: "交互图表" },
  { id: "vega", label: "Vega Editor", detail: "声明式图表" }
];

const els = {
  openDefaultSite: document.querySelector("#openDefaultSite"),
  selectSvgButton: document.querySelector("#selectSvgButton"),
  insertButton: document.querySelector("#insertButton"),
  websiteList: document.querySelector("#websiteList"),
  fileStatus: document.querySelector("#fileStatus"),
  fileSize: document.querySelector("#fileSize"),
  fileDimensions: document.querySelector("#fileDimensions"),
  previewTitle: document.querySelector("#previewTitle"),
  previewMeta: document.querySelector("#previewMeta"),
  svgPreview: document.querySelector("#svgPreview"),
  emptyState: document.querySelector("#emptyState"),
  studioStatus: document.querySelector("#studioStatus")
};

let previewUrl = "";

function setStatus(text, isError = false) {
  els.studioStatus.textContent = text;
  els.studioStatus.classList.toggle("is-error", Boolean(isError));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function postHost(message) {
  if (!window.chrome?.webview?.postMessage) {
    setStatus("当前页面未连接 PowerPoint 宿主。", true);
    return false;
  }
  window.chrome.webview.postMessage(message);
  return true;
}

function openWebsite(siteId) {
  const site = SITES.find(item => item.id === siteId);
  if (!site || !postHost({ type: "openResearchChartWebsite", siteId })) return;
  setStatus(`正在使用系统浏览器打开 ${site.label}。`);
}

function renderWebsites() {
  els.websiteList.innerHTML = SITES.map(site => `<button type="button" role="listitem" data-site-id="${site.id}" title="使用系统默认浏览器打开 ${escapeHtml(site.label)}"><strong>${escapeHtml(site.label)}</strong><small>${escapeHtml(site.detail)}</small></button>`).join("");
  els.websiteList.querySelectorAll("[data-site-id]").forEach(button => button.addEventListener("click", () => openWebsite(button.dataset.siteId)));
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function showSvg(message) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const content = String(message.svgText || "");
  previewUrl = URL.createObjectURL(new Blob([content], { type: "image/svg+xml" }));
  els.svgPreview.src = previewUrl;
  els.svgPreview.hidden = false;
  els.emptyState.hidden = true;
  els.insertButton.disabled = false;
  els.fileStatus.textContent = message.fileName || "已选择 SVG";
  els.fileSize.textContent = formatBytes(message.sizeBytes);
  els.fileDimensions.textContent = message.width && message.height ? `${message.width} x ${message.height}` : "自适应";
  els.previewMeta.textContent = message.fileName || "本地 SVG";
  setStatus("SVG 已通过校验，预览与插入使用同一份内容。");
}

els.openDefaultSite.addEventListener("click", () => openWebsite("rawgraphs"));
els.selectSvgButton.addEventListener("click", () => {
  if (postHost({ type: "selectResearchSvg" })) setStatus("正在选择 SVG 文件。");
});
els.insertButton.addEventListener("click", () => {
  if (postHost({ type: "insertResearchSvg", requestId: `research-svg-${Date.now()}` })) setStatus("正在插入当前 SVG。");
});

window.chrome?.webview?.addEventListener?.("message", event => {
  const message = event.data || {};
  if (message.type === "researchSvgSelectionResult") {
    if (message.ok) showSvg(message);
    else if (!message.canceled) setStatus(`SVG 读取失败：${message.error || "未知错误"}`, true);
  }
  if (message.type === "researchSvgInsertResult") setStatus(message.ok ? "已将当前 SVG 插入 PowerPoint。" : `插入失败：${message.error || "未知错误"}`, !message.ok);
  if (message.type === "researchWebsiteOpenResult" && !message.ok) setStatus(`网站打开失败：${message.error || "未知错误"}`, true);
});

window.addEventListener("beforeunload", () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
renderWebsites();
