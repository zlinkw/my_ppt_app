import fs from "node:fs";
import path from "node:path";
import {
  connectToBrowser,
  evaluate,
  delay,
  launchBrowser,
  startStaticServer,
  waitFor,
  waitForExit
} from "./lib/ui-browser.mjs";

const root = process.cwd();
const outputRoot = path.join(root, "src", "RoughPptAddin", "ui", "help-assets");
const uiRoot = path.join(root, "src", "RoughPptAddin", "ui");
fs.mkdirSync(outputRoot, { recursive: true });

const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("help-screenshot-browser");
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

  async function capture(name, { width, height, navigate = "/index.html", prepare }) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false
    });
    await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}${navigate}` });
    await waitFor(client, "document.readyState === 'complete'");
    await delay(700);
    if (prepare) {
      await evaluate(client, prepare);
      await delay(700);
    }
    await evaluate(client, `(() => {
      const build = document.querySelector('#buildInfoDetail');
      if (build) build.textContent = '版本 当前构建';
    })()`);
    await delay(100);
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true
    });
    const output = path.join(outputRoot, name);
    fs.writeFileSync(output, Buffer.from(screenshot.data, "base64"));
    console.log(`generated ${path.relative(root, output)}`);
  }

  await capture("taskpane-overview.png", {
    width: 800,
    height: 400,
    prepare: `(() => {
      document.body.classList.add('ux-full');
      document.body.dataset.selectionKind = 'none';
      const selection = document.querySelector('[data-collapse-key="selection"]');
      if (selection) selection.dataset.selectionKind = 'none';
      const status = document.querySelector('#status');
      if (status) {
        status.className = 'status';
        status.textContent = '准备就绪';
      }
      window.scrollTo(0, 0);
    })()`
  });

  await capture("style-workspace.png", {
    width: 800,
    height: 820,
    prepare: `(() => {
      document.body.classList.add('ux-full');
      document.body.dataset.selectionKind = 'normal';
      const selection = document.querySelector('[data-collapse-key="selection"]');
      if (selection) selection.dataset.selectionKind = 'normal';
      document.querySelector('#jumpToStyle')?.click();
      const status = document.querySelector('#status');
      if (status) {
        status.className = 'status';
        status.textContent = '选中普通对象后可在风格工作区实时重绘。';
      }
      window.scrollTo(0, 0);
    })()`
  });

  await capture("feature-workspace.png", {
    width: 800,
    height: 820,
    prepare: `(() => {
      document.body.classList.add('ux-full');
      document.body.dataset.selectionKind = 'feature';
      const selection = document.querySelector('[data-collapse-key="selection"]');
      if (selection) selection.dataset.selectionKind = 'feature';
      document.querySelector('#jumpToFeature')?.click();
      const status = document.querySelector('#status');
      if (status) {
        status.className = 'status';
        status.textContent = '选中特征块后可在当前工作区实时更新。';
      }
      window.scrollTo(0, 0);
    })()`
  });

  await capture("chart-workspace.png", {
    width: 1180,
    height: 820,
    navigate: "/research-chart-studio.html",
    prepare: `(() => {
      document.querySelector('#loadSampleButton')?.click();
      const state = document.querySelector('#renderState');
      if (state) {
        state.className = 'render-state ready';
        state.textContent = '仅预览';
      }
      const status = document.querySelector('#studioStatus');
      if (status) {
        status.classList.remove('is-error');
        status.textContent = '本地预览已生成；连接 PowerPoint 后可插入。';
      }
    })()`
  });
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}
