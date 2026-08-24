import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function writeUiBuildInfo(root = process.cwd(), source = "local-build") {
  const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commitCount = Number.parseInt(git("rev-list", "--count", "HEAD"), 10);
  if (!Number.isSafeInteger(commitCount) || commitCount < 1) {
    throw new Error("Unable to derive UI build version from Git history.");
  }

  const baseline = String(packageInfo.installerVersionBaseline || "").split(".").map(Number);
  if (baseline.length !== 3 || baseline.some(Number.isNaN) || baseline[2] < 0 || baseline[2] >= 65535) {
    throw new Error("package.json installerVersionBaseline is invalid.");
  }

  const buildInfo = {
    name: packageInfo.name,
    version: `${baseline[0]}.${baseline[1]}.${Math.min(65535, baseline[2] + commitCount)}`,
    commit: git("rev-parse", "--short=12", "HEAD"),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
    builtAtUtc: new Date().toISOString(),
    source
  };
  const target = path.join(root, "src", "RoughPptAddin", "ui", "build-info.json");
  fs.writeFileSync(target, `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");
  return buildInfo;
}
