const guideBackLinks = [...document.querySelectorAll("[data-guide-back]")];
const guideNavLinks = [...document.querySelectorAll(".guide-nav a[href^='#']")];
const guideSections = guideNavLinks
  .map(link => document.querySelector(link.hash))
  .filter(section => section instanceof HTMLElement);
let guideScrollHandle = 0;

function openedFromTaskPane() {
  if (!document.referrer || history.length <= 1) return false;
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === location.origin && /\/index\.html$/.test(referrer.pathname);
  } catch {
    return false;
  }
}

function returnToTaskPane(event) {
  event?.preventDefault();
  if (openedFromTaskPane()) {
    history.back();
    return;
  }
  location.href = "./index.html";
}

for (const link of guideBackLinks) {
  link.addEventListener("click", returnToTaskPane);
}

function markActiveGuideSection() {
  const anchor = window.innerHeight * 0.28;
  let active = guideSections[0];
  for (const section of guideSections) {
    if (section.getBoundingClientRect().top <= anchor) active = section;
    else break;
  }
  for (const link of guideNavLinks) {
    const current = Boolean(active) && link.hash === `#${active.id}`;
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
}

function scheduleGuideScrollSync() {
  window.clearTimeout(guideScrollHandle);
  guideScrollHandle = window.setTimeout(() => {
    requestAnimationFrame(() => requestAnimationFrame(markActiveGuideSection));
  }, 32);
}

window.addEventListener("scroll", scheduleGuideScrollSync, { passive: true });
window.addEventListener("resize", scheduleGuideScrollSync, { passive: true });
markActiveGuideSection();

document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  returnToTaskPane(event);
});

document.documentElement.dataset.guideReturnReady = "true";

async function renderHelpVersionInfo() {
  const detail = document.querySelector("#buildInfoDetail");
  const meta = document.querySelector("#buildInfoMeta");
  if (!detail && !meta) return;
  try {
    const response = await fetch("./build-info.json", { cache: "no-store" });
    if (!response.ok) throw new Error("读取版本信息失败：" + response.status);
    const info = await response.json();
    const version = info.version || info.installedVersion || "未知版本";
    const commit = info.commit || info.revision || "";
    const time = info.buildTime || info.time || "";
    if (detail) {
      detail.textContent = "当前插件版本 " + version + (commit ? "（提交 " + commit + "）" : "") + (time ? "，构建于 " + time : "") + "。";
      detail.title = "当前安装版本 " + version + "；需要确认更新时可点击检查更新";
    }
    if (meta) meta.textContent = "版本核对以本区为准；安装包未生效时请关闭全部 PowerPoint 窗口后重装。";
  } catch (error) {
    if (detail) detail.textContent = "版本信息读取失败：" + error.message;
  }
}
renderHelpVersionInfo();
document.querySelector("#checkUpdates")?.addEventListener("click", () => {
  const detail = document.querySelector("#buildInfoDetail");
  if (detail) detail.textContent = "已记录检查请求：请联网后访问 GitHub Release 页核对最新正式版本。";
});
