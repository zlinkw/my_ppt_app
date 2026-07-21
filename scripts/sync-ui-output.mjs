import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = path.join(root, "src", "RoughPptAddin", "ui");
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const commit = git("rev-parse", "--short=12", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const dirty = Boolean(git("status", "--porcelain"));
const buildInfo = {
  name: packageInfo.name,
  version: packageInfo.version,
  commit,
  branch,
  dirty,
  builtAtUtc: new Date().toISOString(),
  source: "local-build"
};

fs.writeFileSync(path.join(source, "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");

const targets = [
  path.join(root, "src", "RoughPptAddin", "bin", "Release", "ui"),
  path.join(root, "src", "RoughPptAddin", "bin", "Debug", "ui"),
  path.join(root, "publish", "ui"),
  path.join(root, "dist", "RoughPptAddin", "publish", "ui")
];
if (process.argv.includes("--include-installed")) {
  targets.push(path.join(process.env.LOCALAPPDATA || "", "RoughPptAddin", "publish", "ui"));
}

for (const target of targets.filter(Boolean)) {
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
  console.log(`已同步 UI：${target}`);
}
