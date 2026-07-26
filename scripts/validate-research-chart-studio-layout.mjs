// 科研绘图工作台的真实浏览器布局验证。
// 窗口尺寸取自 ResearchChartStudioWindow.cs：MinimumSize 720x560，默认 1180x820。
import path from "node:path";
import {
  startStaticServer,
  launchBrowser,
  connectToBrowser,
  evaluate,
  waitFor,
  waitForExit,
  delay
} from "./lib/ui-browser.mjs";

const uiRoot = path.join(process.cwd(), "src", "RoughPptAddin", "ui");
const viewports = [
  { width: 720, height: 560, label: "最小窗口" },
  { width: 1180, height: 820, label: "默认窗口" }
];
const violations = [];

const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("research-chart-studio-browser");
const client = await connectToBrowser(browser.port);

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/research-chart-studio.html` });
  await waitFor(client, "document.readyState === 'complete' && Boolean(document.querySelector('#chartTypeGrid'))");

  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await delay(250);
    const label = `${viewport.label} ${viewport.width}x${viewport.height}`;

    const layout = await evaluate(client, layoutProbe());
    if (layout.hasHorizontalOverflow) {
      violations.push(`${label}: 工作台存在横向滚动 (scrollWidth ${layout.scrollWidth} > ${layout.clientWidth})`);
    }
    if (layout.offscreen.length) {
      violations.push(`${label}: 可见元素横向超出窗口 ${layout.offscreen.slice(0, 6).join(", ")}`);
    }
    if (layout.tinyButtons.length) {
      violations.push(`${label}: 可见按钮过小无法点击 ${layout.tinyButtons.slice(0, 6).join(", ")}`);
    }
    if (layout.clippedText.length) {
      violations.push(`${label}: 控件文字被裁切 ${layout.clippedText.slice(0, 6).join(", ")}`);
    }

    const tooltips = await evaluate(client, tooltipProbe());
    if (tooltips.missing.length) {
      violations.push(`${label}: 可见控件缺少中文悬浮说明 ${tooltips.missing.join(", ")}`);
    }
    if (tooltips.nonChinese.length) {
      violations.push(`${label}: 悬浮说明缺少中文 ${tooltips.nonChinese.join(", ")}`);
    }

    const charts = await evaluate(client, chartTypeProbe());
    if (charts.total < 36) violations.push(`${label}: 图表类型入口只有 ${charts.total} 个，应至少 36 个`);
    if (charts.hidden.length) {
      violations.push(`${label}: 图表类型入口不可见或无法滚动到 ${charts.hidden.slice(0, 6).join(", ")}`);
    }
    if (!charts.gridScrollable) {
      violations.push(`${label}: 图表类型列表既未完整显示也未提供滚动`);
    }
    if (charts.checkedCount !== 1) {
      violations.push(`${label}: 图表类型单选状态异常，aria-checked=true 的入口有 ${charts.checkedCount} 个`);
    }
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) {
  throw new Error(`research chart studio layout validation failed:\n${violations.join("\n")}`);
}

console.log(`research chart studio layout ok: ${viewports.map(v => `${v.width}x${v.height}`).join(", ")}`);

function layoutProbe() {
  return `(() => {
    const de = document.documentElement;
    const isVisible = element => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const scrollableAncestor = element => {
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowX + ' ' + style.overflowY)) return node;
      }
      return null;
    };
    const name = element => element.id || (element.className || '').toString().split(/\\s+/)[0] || element.tagName;
    const offscreen = [];
    const tinyButtons = [];
    const clippedText = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (!scrollableAncestor(element) && (rect.left < -2 || rect.right > innerWidth + 2)) offscreen.push(name(element));
      if (element.tagName === 'BUTTON' && (rect.width < 18 || rect.height < 18)) tinyButtons.push(name(element));
      if ((element.tagName === 'BUTTON' || element.tagName === 'LABEL') &&
          element.scrollWidth > element.clientWidth + 2 &&
          getComputedStyle(element).overflowX === 'hidden') {
        clippedText.push(name(element));
      }
    }
    return {
      hasHorizontalOverflow: de.scrollWidth > de.clientWidth + 2,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      offscreen: [...new Set(offscreen)],
      tinyButtons: [...new Set(tinyButtons)],
      clippedText: [...new Set(clippedText)]
    };
  })()`;
}

function tooltipProbe() {
  return `(() => {
    const hasChinese = text => /[\\u3400-\\u9fff]/.test(text || '');
    const isVisible = element => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const describe = element => element.id || (element.textContent || '').trim().slice(0, 18) || element.tagName;
    const missing = [];
    const nonChinese = [];
    for (const element of document.querySelectorAll('button, select, input:not([type=hidden]), summary, [role=radio]')) {
      if (!isVisible(element)) continue;
      const tip = element.getAttribute('title') || element.getAttribute('aria-label') ||
        element.closest('label')?.getAttribute('title') || '';
      if (!tip.trim()) {
        missing.push(describe(element));
        continue;
      }
      if (!hasChinese(tip)) nonChinese.push(describe(element) + ' => ' + tip.slice(0, 24));
    }
    return { missing: [...new Set(missing)], nonChinese: [...new Set(nonChinese)] };
  })()`;
}

function chartTypeProbe() {
  return `(() => {
    const grid = document.querySelector('#chartTypeGrid');
    if (!grid) return { total: 0, hidden: ['chartTypeGrid missing'], gridScrollable: false, checkedCount: 0 };
    const buttons = [...grid.querySelectorAll('[data-chart-type]')];
    const gridRect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const gridScrollable = /(auto|scroll)/.test(style.overflowY + ' ' + style.overflowX) ||
      grid.scrollHeight <= grid.clientHeight + 2;
    const hidden = buttons.filter(button => {
      const rect = button.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return true;
      // 允许纵向在滚动容器内溢出，但不允许横向越出容器
      return rect.left < gridRect.left - 2 || rect.right > gridRect.right + 2;
    }).map(button => button.dataset.chartType);
    return {
      total: buttons.length,
      hidden,
      gridScrollable,
      checkedCount: buttons.filter(button => button.getAttribute('aria-checked') === 'true').length
    };
  })()`;
}
