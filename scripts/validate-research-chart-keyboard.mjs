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
