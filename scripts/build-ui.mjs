import fs from "node:fs";
import path from "node:path";
import { writeUiBuildInfo } from "./lib/ui-build-info.mjs";

const destDir = "src/RoughPptAddin/ui/vendor";
fs.mkdirSync(destDir, { recursive: true });

const bundles = [
  ["node_modules/roughjs/bundled/rough.esm.js", "rough.esm.js"],
  ["node_modules/vega/build/vega.min.js", "vega.min.js"],
  ["node_modules/vega-lite/build/vega-lite.min.js", "vega-lite.min.js"],
  ["node_modules/vega-embed/build/vega-embed.min.js", "vega-embed.min.js"]
];

for (const [src, fileName] of bundles) {
  if (!fs.existsSync(src)) throw new Error(`${src} missing. Run npm install.`);
  const dest = path.join(destDir, fileName);
  fs.copyFileSync(src, dest);
  console.log(`copied ${src} -> ${dest}`);
}

const licenses = [
  ["Vega", "node_modules/vega/LICENSE"],
  ["Vega-Lite", "node_modules/vega-lite/LICENSE"],
  ["Vega-Embed", "node_modules/vega-embed/LICENSE"]
];
const licenseText = licenses.map(([name, src]) => {
  if (!fs.existsSync(src)) throw new Error(`${src} missing. Run npm install.`);
  return `===== ${name} =====\n\n${fs.readFileSync(src, "utf8").trim()}\n`;
}).join("\n");
fs.writeFileSync(path.join(destDir, "vega-LICENSES.txt"), licenseText, "utf8");

writeUiBuildInfo();
