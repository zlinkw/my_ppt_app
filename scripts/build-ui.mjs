import fs from "node:fs";
import path from "node:path";

const src = "node_modules/roughjs/bundled/rough.esm.js";
const destDir = "src/RoughPptAddin/ui/vendor";
const dest = path.join(destDir, "rough.esm.js");

if (!fs.existsSync(src)) {
  throw new Error("roughjs bundle missing. Run npm install.");
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);