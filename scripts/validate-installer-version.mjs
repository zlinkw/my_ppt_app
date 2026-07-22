import { execFileSync } from "node:child_process";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const baseline = packageJson.installerVersionBaseline;
if (baseline !== "0.1.695") {
  throw new Error(`installer version baseline must preserve recovered release 0.1.695; received ${baseline}`);
}

for (const path of ["scripts/package-installers.ps1", "scripts/package-release-preserving.ps1"]) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes('installer-version.ps1') || !source.includes('Resolve-InstallerProductVersion')) {
    throw new Error(`${path}: installer version must use shared monotonic resolver`);
  }
}

const output = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    ". ./scripts/installer-version.ps1; Resolve-InstallerProductVersion -PackageJsonPath ./package.json -CommitCount 1",
  ],
  { encoding: "utf8" },
).trim();

if (output !== "0.1.696") {
  throw new Error(`first recovered build must upgrade 0.1.695; received ${output}`);
}

console.log("installer version monotonicity ok");
