// 本机 Chromium/Edge 无头浏览器与静态文件服务，供 UI 布局类验证脚本复用。
// 只服务 src/RoughPptAddin/ui 下的本地文件，不访问外部网络。
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export function startStaticServer(baseDir) {
  const root = path.resolve(baseDir);
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.normalize(path.join(root, pathname));
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
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
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export async function launchBrowser(userDataDirName) {
  const executable = findBrowserExecutable();
  let lastError = null;
  for (let launchAttempt = 0; launchAttempt < 3; launchAttempt++) {
    void userDataDirName;
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rough-ui-browser-"));
    const port = await freeTcpPort();
    const child = spawn(executable, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank"
    ], { stdio: "ignore" });
    let exited = false;
    child.once("exit", code => {
      exited = true;
      lastError = new Error(`浏览器进程提前退出，代码 ${code ?? "unknown"}`);
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (exited) break;
      try {
        const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
        if (version.webSocketDebuggerUrl) return { process: child, port };
      } catch (error) {
        lastError = error;
        await delay(100);
      }
    }
    child.kill();
    await waitForExit(child).catch(() => {});
  }
  throw new Error(`无法启动本机 Chromium/Edge 进行 UI 布局验证：${lastError?.message ?? "未知原因"}`);
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
    path.join(process.env.ProgramFiles ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe")
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("未找到本机 Microsoft Edge 或 Google Chrome，无法运行 UI 布局验证");
}

export async function connectToBrowser(port) {
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

export async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

export async function waitFor(client, expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`等待 UI 条件超时：${expression}`);
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => child.once("exit", resolve));
}
