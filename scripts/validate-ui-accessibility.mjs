import path from "node:path";
import {
  connectToBrowser,
  evaluate,
  launchBrowser,
  startStaticServer,
  waitFor,
  delay,
  waitForExit
} from "./lib/ui-browser.mjs";

const root = process.cwd();
const uiRoot = path.join(root, "src", "RoughPptAddin", "ui");
const pages = [
  "/index.html",
  "/research-chart-studio.html",
  "/ribbon-shape-gallery.html",
  "/help.html"
];
const widths = [320, 420, 700, 800, 1180];
const violations = [];

const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("ui-accessibility-browser");
const client = await connectToBrowser(browser.port);

try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.chrome = {
        webview: {
          postMessage() {},
          addEventListener() {}
        }
      };
    `
  });

  for (const page of pages) {
    for (const width of widths) {
      const height = width < 700 ? 900 : 820;
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 700
      });
      await client.send("Page.navigate", {
        url: `http://127.0.0.1:${server.port}${page}`
      });
      await waitFor(client, "document.readyState === 'complete'");
      await delay(650);
      const audit = await evaluate(client, `(() => {
        const visible = element => {
          if (element.closest(".skip-link") && document.activeElement !== element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" &&
            rect.width > 0 && rect.height > 0;
        };
        const idValues = [...document.querySelectorAll("[id]")].map(element => element.id);
        const duplicates = idValues.filter((value, index, values) => values.indexOf(value) !== index);
        const controls = [...document.querySelectorAll(
          "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        )].filter(visible);
        const accessibleName = element => {
          const labelledBy = element.getAttribute("aria-labelledby");
          if (labelledBy && labelledBy.trim()) {
            const text = labelledBy.split(/\\s+/)
              .map(id => document.getElementById(id)?.textContent ?? "")
              .join(" ")
              .trim();
            if (text) return text;
          }
          return [
            element.getAttribute("aria-label"),
            element.title,
            element.getAttribute("placeholder"),
            element.value,
            element.alt,
            element.innerText
          ].find(value => String(value ?? "").trim()) ?? "";
        };
        const unnamed = controls
          .filter(element => !accessibleName(element).trim())
          .map(element => element.tagName.toLowerCase() + (element.id ? "#" + element.id : ""));
        const nested = controls
          .filter(element => element.querySelector("button, a[href], input, select, textarea"))
          .map(element => element.tagName.toLowerCase() + (element.id ? "#" + element.id : ""));
        const tiny = controls
          .filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width < 24 || rect.height < 24;
          })
          .map(element => {
            const rect = element.getBoundingClientRect();
            const id = element.id ? "#" + element.id : "";
            return element.tagName.toLowerCase() + id + " " +
              Math.round(rect.width) + "x" + Math.round(rect.height);
          });
        const unnamedImages = [...document.querySelectorAll("img")]
          .filter(visible)
          .filter(element => !element.hasAttribute("alt"))
          .map(element => element.getAttribute("src") ?? "img");
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          duplicates: [...new Set(duplicates)],
          unnamed: [...new Set(unnamed)],
          nested: [...new Set(nested)],
          tiny: [...new Set(tiny)],
          unnamedImages
        };
      })()`);

      const label = `${page} @ ${width}px`;
      if (audit.scrollWidth > audit.clientWidth + 1) {
        violations.push(`${label}: horizontal overflow ${audit.scrollWidth} > ${audit.clientWidth}`);
      }
      if (audit.duplicates.length) violations.push(`${label}: duplicate ids ${audit.duplicates.join(", ")}`);
      if (audit.unnamed.length) violations.push(`${label}: controls without accessible names ${audit.unnamed.join(", ")}`);
      if (audit.nested.length) violations.push(`${label}: nested interactive controls ${audit.nested.join(", ")}`);
      if (audit.tiny.length) violations.push(`${label}: controls below 24px ${audit.tiny.join(", ")}`);
      if (audit.unnamedImages.length) violations.push(`${label}: images without alt ${audit.unnamedImages.join(", ")}`);
    }
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) {
  throw new Error(`UI accessibility validation failed:\n${violations.join("\n")}`);
}

console.log(`ui accessibility ok: ${pages.length * widths.length} page/width states`);
