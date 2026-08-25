// 独立 UI 窗口的真实浏览器布局验证。
// 每个窗口的尺寸取自宿主 WinForms 窗口的 MinimumSize 与默认 Size，
// 这样验证的是用户真的能拉到的最窄状态，而不是任意猜测的宽度。
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

const windows = [
  {
    page: "research-chart-studio.html",
    label: "科研绘图工作台",
    source: "TaskPane/ResearchChartStudioWindow.cs",
    ready: "Boolean(document.querySelector('#chartTypeGrid'))",
    viewports: [
      { width: 720, height: 560, label: "最小窗口" },
      { width: 1180, height: 820, label: "默认窗口" }
    ],
    extraProbe: chartTypeProbe,
    checkExtra(result, push, viewport) {
      if (result.total < 36) push(`图表类型入口只有 ${result.total} 个，应至少 36 个`);
      if (result.overflowing.length) push(`图表类型入口横向越出容器 ${result.overflowing.slice(0, 6).join(", ")}`);
      if (!result.gridReachable) push("图表类型列表既未完整显示也未提供滚动");
      if (result.checkedCount !== 1) push(`图表类型单选状态异常，aria-checked=true 的入口有 ${result.checkedCount} 个`);
      if (viewport.width >= 1121 && result.layoutColumns !== 3) push(`默认科研绘图窗口应为三栏，实际 ${result.layoutColumns} 栏`);
      if (viewport.width <= 780 && !result.controlFirst) push("窄窗科研绘图必须先显示数据和图表控制，再显示预览");
      if (result.previewVerticalOffset > result.previewVerticalSlack + 4) push(`科研绘图预览未居中或越界：偏移 ${result.previewVerticalOffset}px，允许 ${result.previewVerticalSlack}px`);
      if (viewport.width >= 1121 && result.pageScroll > 2) push(`宽窗科研绘图不应整页滚动，当前额外高度 ${result.pageScroll}px`);
    }
  },
  {
    page: "ribbon-shape-gallery.html",
    label: "形状图库窗口",
    source: "Ribbon/ShapeGalleryWindow.cs",
    ready: "Boolean(document.querySelector('#shapeDropdown')) && document.querySelectorAll('#shapeDropdown button').length > 100",
    viewports: [
      { width: 420, height: 320, label: "最小窗口" },
      { width: 700, height: 620, label: "默认窗口" }
    ],
    extraProbe: shapeGalleryProbe,
    checkExtra(result, push) {
      if (result.cardCount < 200) push(`形状卡片只有 ${result.cardCount} 个，应覆盖完整目录`);
      if (result.groupCount < 10) push(`形状分组只有 ${result.groupCount} 个`);
      if (result.overflowing.length) push(`形状卡片横向越出容器 ${result.overflowing.slice(0, 6).join(", ")}`);
      if (result.iconMin < 34) push(`形状图标视觉尺寸不足：最小 ${result.iconMin}px，应至少 34px`);
    }
  }
];

const uiRoot = path.join(process.cwd(), "src", "RoughPptAddin", "ui");
const violations = [];

const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("ui-window-layout-browser");
const client = await connectToBrowser(browser.port);

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");

  for (const target of windows) {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/${target.page}` });
    await waitFor(client, `document.readyState === 'complete' && ${target.ready}`);

    for (const viewport of target.viewports) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await delay(300);
      const label = `${target.label} ${viewport.label} ${viewport.width}x${viewport.height}`;
      const push = message => violations.push(`${label}: ${message}`);

      const layout = await evaluate(client, layoutProbe());
      if (layout.hasHorizontalOverflow) {
        push(`存在横向滚动 (scrollWidth ${layout.scrollWidth} > clientWidth ${layout.clientWidth})`);
      }
      if (layout.offscreen.length) push(`可见元素横向超出窗口 ${layout.offscreen.slice(0, 6).join(", ")}`);
      if (layout.tinyButtons.length) push(`可见按钮过小无法点击 ${layout.tinyButtons.slice(0, 6).join(", ")}`);
      if (layout.clippedText.length) push(`控件文字被裁切 ${layout.clippedText.slice(0, 6).join(", ")}`);

      const tooltips = await evaluate(client, tooltipProbe());
      if (tooltips.missing.length) push(`可见控件缺少中文悬浮说明 ${tooltips.missing.join(", ")}`);
      if (tooltips.nonChinese.length) push(`悬浮说明缺少中文 ${tooltips.nonChinese.join(", ")}`);

      const extra = await evaluate(client, target.extraProbe());
      target.checkExtra(extra, push, viewport);
    }
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) {
  throw new Error(`UI window layout validation failed:\n${violations.join("\n")}`);
}

console.log(`UI window layout ok: ${windows.map(target => `${target.page} (${target.viewports.map(v => `${v.width}x${v.height}`).join(", ")})`).join("; ")}`);

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
  return `(() => { try {
    const grid = document.querySelector('#chartTypeGrid');
    const layout = document.querySelector('.studio-layout');
    const control = document.querySelector('.control-panel');
    const preview = document.querySelector('.preview-panel');
    const previewWrap = document.querySelector('#svgPreviewWrap');
    const chartPreview = document.querySelector('#chartPreview');
    const importedPreview = document.querySelector('#svgPreview');
    if (!grid || !layout || !control || !preview || !previewWrap || !chartPreview) {
      return { total: grid ? grid.querySelectorAll('[data-chart-type]').length : 0, overflowing: ['research layout surface missing'], gridReachable: false, checkedCount: 0 };
    }
    const buttons = [...grid.querySelectorAll('[data-chart-type]')];
    const gridRect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const layoutStyle = getComputedStyle(layout);
    const controlRect = control.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const wrapRect = previewWrap.getBoundingClientRect();
    const chartRect = chartPreview.getBoundingClientRect();
    const importedRect = importedPreview ? importedPreview.getBoundingClientRect() : { width: 0, height: 0, top: 0 };
    const contentRect = importedPreview && !importedPreview.hidden && importedRect.width > 0 && importedRect.height > 0 ? importedRect : chartRect;
    const gridReachable = /(auto|scroll)/.test(style.overflowY + ' ' + style.overflowX) ||
      grid.scrollHeight <= grid.clientHeight + 2;
    const overflowing = buttons.filter(button => {
      const rect = button.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return true;
      return rect.left < gridRect.left - 2 || rect.right > gridRect.right + 2;
    }).map(button => button.dataset.chartType);
    return {
      total: buttons.length,
      overflowing,
      gridReachable,
      checkedCount: buttons.filter(button => button.getAttribute('aria-checked') === 'true').length,
      layoutColumns: layoutStyle.gridTemplateColumns.split(' ').length,
      controlFirst: controlRect.top <= previewRect.top,
      previewTopGap: Math.round(contentRect.top - wrapRect.top),
      previewVerticalOffset: Math.round(Math.max(0, contentRect.top - wrapRect.top)),
      previewVerticalSlack: Math.round(Math.max(0, wrapRect.height - contentRect.height) / 2),
      pageScroll: Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight),
      importPreviewVisible: Boolean(importedPreview && !importedPreview.hidden && importedPreview.getBoundingClientRect().height > 0)
    };
  } catch (error) { return { probeError: String(error), stack: error?.stack }; }
  })()`;
}

function shapeGalleryProbe() {
  return `(() => {
    const dropdown = document.querySelector('#shapeDropdown');
    if (!dropdown) return { cardCount: 0, groupCount: 0, iconMin: 0, overflowing: ['shapeDropdown missing'] };
    const cards = [...dropdown.querySelectorAll('button')];
    const groups = [...dropdown.querySelectorAll('.gallery-group, details')];
    const dropdownRect = dropdown.getBoundingClientRect();
    const overflowing = cards.filter(card => {
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return rect.left < dropdownRect.left - 2 || rect.right > dropdownRect.right + 2;
    }).map(card => (card.dataset.enumName || card.textContent || '').trim().slice(0, 20));
    const iconRects = cards.map(card => {
      const icon = card.querySelector('canvas, img');
      return icon ? icon.getBoundingClientRect() : null;
    }).filter(Boolean);
    const iconMin = Math.round(Math.min(Infinity, ...iconRects.map(rect => Math.min(rect.width, rect.height))));
    return { cardCount: cards.length, groupCount: groups.length, iconMin, overflowing: [...new Set(overflowing)] };
  })()`;
}
