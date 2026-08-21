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
