import fs from "node:fs";
import path from "node:path";
import { writeUiBuildInfo } from "./lib/ui-build-info.mjs";

const root = process.cwd();
const source = path.join(root, "src", "RoughPptAddin", "ui");
writeUiBuildInfo(root);

const targets = [
  path.join(root, "src", "RoughPptAddin", "bin", "Release", "ui"),
  path.join(root, "src", "RoughPptAddin", "bin", "Debug", "ui"),
  path.join(root, "publish", "ui"),
  path.join(root, "dist", "RoughPptAddin", "publish", "ui")
];
if (process.argv.includes("--include-installed")) {
  targets.push(path.join(process.env.LOCALAPPDATA || "", "RoughPptAddin", "publish", "ui"));
}

// 中断的命令和手工备份会在 UI 源目录留下残留文件（例如 styles.css.bak345、app.mjs).Count）。
// 这些文件不是运行时资源，禁止随整目录复制进 bin、publish、dist 或已安装的 UI 目录。
const residuePatterns = [/\.bak\d*$/i, /\.orig$/i, /\.rej$/i, /\)\.Count$/, /\),$/, /^tmp_/, /^\.tmp-/, /\.log$/i, /\.tmp$/i];
const isResidueName = name => residuePatterns.some(pattern => pattern.test(name));

function pruneResidue(dir) {
  const resolvedRoot = path.resolve(dir);
  let removed = 0;
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (!path.resolve(full).startsWith(resolvedRoot + path.sep)) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!isResidueName(entry.name)) continue;
      fs.rmSync(full, { force: true });
      removed += 1;
    }
  };
  walk(resolvedRoot);
  return removed;
}

for (const target of targets.filter(Boolean)) {
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter: entry => !isResidueName(path.basename(entry))
  });
  const removed = pruneResidue(target);
  console.log(removed ? `已同步 UI：${target}（清除 ${removed} 个残留文件）` : `已同步 UI：${target}`);
}
