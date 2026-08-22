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
const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("research-chart-keyboard-browser");
const client = await connectToBrowser(browser.port);
const violations = [];

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/research-chart-studio.html` });
  await waitFor(client, "document.readyState === 'complete' && Boolean(document.querySelector('#chartTypeGrid [data-chart-type=\"groupedBar\"][aria-checked=\"true\"]'))");
  await delay(200);

  await evaluate(client, "document.querySelector('#chartTypeGrid [data-chart-type=\"groupedBar\"]').focus()");
  await press(client, "#chartTypeGrid", "ArrowRight");
  await expectRadio(client, "#chartTypeGrid", "stackedBar", "图表类型右方向键");
  await evaluate(client, "document.querySelector('#chartTypeGrid [data-chart-type=\"polar\"]').focus()");
  await press(client, "#chartTypeGrid", "ArrowLeft");
  await expectRadio(client, "#chartTypeGrid", "donut", "图表类型左方向键");
  await press(client, "#chartTypeGrid", "ArrowUp");
  await expectRadio(client, "#chartTypeGrid", "radar", "图表类型上方向键");
  await press(client, "#chartTypeGrid", "Home");
  await expectRadio(client, "#chartTypeGrid", "bar", "图表类型 Home 键");

  await evaluate(client, "document.querySelector('#paletteList [data-palette=\"academic\"]').focus()");
  await press(client, "#paletteList", "ArrowDown");
  await expectRadio(client, "#paletteList", "colorblind", "配色方向键");

  const tabStops = await evaluate(client, `(() => {
    const groups = ['#chartTypeGrid', '#paletteList'].map(selector => {
      const radios = [...document.querySelectorAll(selector + ' [role="radio"]')];
      return radios.filter(button => button.tabIndex === 0).length;
    });
    return groups;
  })()`);
  if (tabStops.some(count => count !== 1)) violations.push(`每个单选组必须只有一个 roving tabindex：${JSON.stringify(tabStops)}`);

  await evaluate(client, `(() => {
    document.querySelector('#chartSearch').value = '雷达';
    document.querySelector('#chartSearch').dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await delay(180);
  const filteredSelection = await evaluate(client, `(() => ({
    visibleChecked: [...document.querySelectorAll('#chartTypeGrid [role="radio"]')]
      .filter(button => !button.hidden)
      .map(button => ({ type: button.dataset.chartType, checked: button.getAttribute('aria-checked') })),
    hiddenChecked: [...document.querySelectorAll('#chartTypeGrid [role="radio"][hidden][aria-checked="true"]')].length,
    label: document.querySelector('#currentChartType').textContent
  }))()`);
  if (
    filteredSelection.visibleChecked.length !== 1 ||
    filteredSelection.visibleChecked[0].type !== "radar" ||
    filteredSelection.visibleChecked[0].checked !== "true" ||
    filteredSelection.hiddenChecked !== 0 ||
    filteredSelection.label !== "雷达图"
  ) {
    violations.push(`筛选隐藏当前图表后未保持可见选中项：${JSON.stringify(filteredSelection)}`);
  }

  await evaluate(client, `(() => {
    const search = document.querySelector('#chartSearch');
    search.value = '不存在';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await delay(120);
  const emptyState = await evaluate(client, `(() => ({
    hidden: document.querySelector('#chartEmptyState').hidden,
    text: document.querySelector('#chartEmptyState').textContent,
    visibleRadios: [...document.querySelectorAll('#chartTypeGrid [role="radio"]:not([hidden])')].length,
    summary: document.querySelector('#chartSearchSummary').textContent
  }))()`);
  if (
    emptyState.hidden ||
    emptyState.text !== "没有匹配的图表。请更换关键词或类别。" ||
    emptyState.visibleRadios !== 0 ||
    emptyState.summary !== "显示 0 / 36 种图表"
  ) {
    violations.push(`图表筛选空结果状态异常：${JSON.stringify(emptyState)}`);
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) throw new Error(`research chart keyboard validation failed:\n${violations.join("\n")}`);
console.log("research chart keyboard navigation ok");

async function press(client, groupSelector, key) {
  await evaluate(client, `(() => {
    const group = document.querySelector(${JSON.stringify(groupSelector)});
    const event = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
  })()`);
  await delay(80);
}

async function expectRadio(client, groupSelector, chartValue, label) {
  const result = await evaluate(client, `(() => {
    const radio = document.querySelector(${JSON.stringify(groupSelector)} + ' [data-${groupSelector === '#paletteList' ? 'palette' : 'chart-type'}="${chartValue}"]');
    return {
      focused: document.activeElement === radio,
      checked: radio?.getAttribute('aria-checked'),
      tabIndex: radio?.tabIndex
    };
  })()`);
  if (!result.focused || result.checked !== "true" || result.tabIndex !== 0) {
    violations.push(`${label}后 ${chartValue} 状态异常：${JSON.stringify(result)}`);
  }
}
