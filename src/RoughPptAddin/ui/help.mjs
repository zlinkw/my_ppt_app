const guideBackLinks = [...document.querySelectorAll("[data-guide-back]")];

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

document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  returnToTaskPane(event);
});

document.documentElement.dataset.guideReturnReady = "true";
