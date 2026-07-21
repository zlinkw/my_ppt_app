import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const uiRoot = path.join(root, "src", "RoughPptAddin", "ui");
const keywords = ["重绘", "转换", "填充", "模板", "箭头", "素材", "特征块", "导入", "分享", "保存", "检查"];
const widths = [320, 420, 720];
const violations = [];

const server = await startStaticServer(uiRoot);
const browser = await launchBrowser();
const client = await connectToBrowser(browser.port);

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/index.html` });
  await waitFor(client, "document.readyState === 'complete' && Boolean(document.querySelector('#search'))");

  for (const width of widths) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width <= 420
    });
    await waitFor(client, "document.body && document.querySelector('.shell')");
    const layout = await evaluate(client, layoutProbe());
    if (layout.hasHorizontalOverflow) violations.push(`${width}px: 页面存在横向滚动`);
    if (layout.offscreen.length) violations.push(`${width}px: 可见元素超出视口 ${layout.offscreen.slice(0, 5).join(", ")}`);
    if (layout.zeroButtons.length) violations.push(`${width}px: 可见按钮尺寸异常 ${layout.zeroButtons.slice(0, 5).join(", ")}`);
  }

  for (const keyword of keywords) {
    const result = await evaluate(client, commandProbe(keyword));
    if (!result.visible) violations.push(`搜索 ${keyword}: 未显示功能命令结果`);
    if (!result.hasChineseCommand) violations.push(`搜索 ${keyword}: 功能命令缺少中文结果`);
    if (!result.targetFocused) violations.push(`搜索 ${keyword}: 点击功能命令后未定位或聚焦目标区`);
    if (result.executedRiskyAction) violations.push(`搜索 ${keyword}: 点击搜索结果不应直接执行删除、分享、导入等动作`);
  }

  const menu = await evaluate(client, contextMenuProbe());
  if (!menu.menuVisible) violations.push("Shift+F10: 未打开快速插入管理菜单");
  if (!menu.focusedMenuItem) violations.push("Shift+F10: 菜单打开后未聚焦第一项");
  if (!menu.hasMenuItemRole) violations.push("Shift+F10: 菜单项缺少 menuitem 角色");

  const dropdown = await evaluate(client, dropdownSearchProbe());
  if (!dropdown.filtered) violations.push("形状图库下拉框未按搜索词过滤");
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
  removeDirWithRetry(browser.userDataDir);
}

if (violations.length) {
  throw new Error(`task pane UI interaction validation failed:\n${violations.join("\n")}`);
}

console.log("task pane UI interactions ok");

function startStaticServer(baseDir) {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(baseDir, pathname));
      if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.writeHead(200, { "content-type": contentType(filePath) });
      fs.createReadStream(filePath).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve({
      port: server.address().port,
      close: () => new Promise(done => server.close(done))
    }));
  });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".mjs") || filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function launchBrowser() {
  const executable = findBrowserExecutable();
  let lastError = null;
  for (let launchAttempt = 0; launchAttempt < 3; launchAttempt++) {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rough-ppt-ui-"));
    const port = await freeTcpPort();
    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank"
    ];
    const child = spawn(executable, args, { stdio: "ignore" });
    let exited = false;
    child.once("exit", code => {
      exited = true;
      lastError = new Error(`浏览器进程提前退出，代码 ${code ?? "unknown"}`);
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (exited) break;
      try {
        const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
        if (version.webSocketDebuggerUrl) return { process: child, port, userDataDir };
      } catch (error) {
        lastError = error;
        await delay(100);
      }
    }
    child.kill();
    await waitForExit(child).catch(() => {});
    removeDirWithRetry(userDataDir);
  }
  throw new Error(`无法启动本机 Chromium/Edge 进行任务窗格 UI 验证：${lastError?.message ?? "未知原因"}`);
}

function freeTcpPort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function findBrowserExecutable() {
  const candidates = [
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe")
  ];
  const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!found) throw new Error("未找到本机 Edge 或 Chrome");
  return found;
}

async function connectToBrowser(port) {
  const tabs = await fetchJson(`http://127.0.0.1:${port}/json`);
  const tab = tabs.find(item => item.type === "page") ?? tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      ws.close();
      return Promise.resolve();
    }
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(client, expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`等待 UI 条件超时：${expression}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => child.once("exit", resolve));
}

function removeDirWithRetry(dir) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
    }
  }
}

function layoutProbe() {
  return `(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const offscreen = [];
    const zeroButtons = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left < -2 || rect.right > innerWidth + 2) offscreen.push(element.id || element.className || element.tagName);
      if (element.tagName === 'BUTTON' && (rect.width < 18 || rect.height < 18)) zeroButtons.push(element.id || element.textContent.trim());
    }
    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
      offscreen,
      zeroButtons
    };
  })()`;
}

function commandProbe(keyword) {
  return `(async () => {
    const risky = [];
    window.chrome = { webview: { postMessage: message => risky.push(message?.type) } };
    const input = document.querySelector('#search');
    document.querySelector('[data-search-scope="command"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 40));
    input.value = ${JSON.stringify(keyword)};
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(keyword)} }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const panel = document.querySelector('#commandResults');
    const button = panel?.querySelector('.command-result');
    const visible = Boolean(panel && !panel.hidden && button);
    if (button) button.click();
    await new Promise(resolve => setTimeout(resolve, 360));
    return {
      visible,
      hasChineseCommand: Boolean(button && /[\\u3400-\\u9fff]/.test(button.textContent)),
      targetFocused: Boolean(document.activeElement && document.activeElement !== input),
      executedRiskyAction: risky.some(type => ['deleteUserAsset', 'exportUserAssets', 'importUserAssets', 'saveSelectionAsAsset', 'insertShape', 'insertFeatureBlock'].includes(type))
    };
  })()`;
}

function contextMenuProbe() {
  return `(() => {
    const add = document.querySelector('#quickAddToggle');
    add.click();
    const button = document.querySelector('#quickShapeDropdown .gallery-shape');
    if (!button) return { menuVisible: false, focusedMenuItem: false, hasMenuItemRole: false };
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    const menu = document.querySelector('#quickShapeContextMenu');
    const item = menu?.querySelector('button');
    return {
      menuVisible: Boolean(menu && !menu.hidden),
      focusedMenuItem: document.activeElement === item,
      hasMenuItemRole: item?.getAttribute('role') === 'menuitem'
    };
  })()`;
}

function dropdownSearchProbe() {
  return `(() => {
    const input = document.querySelector('#search');
    input.value = '矩形';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '矩形' }));
    const toggle = document.querySelector('#galleryToggle');
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    const buttons = [...document.querySelectorAll('#shapeDropdown .gallery-shape')];
    return {
      filtered: buttons.length > 0 && buttons.length < 60
    };
  })()`;
}