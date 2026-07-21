import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDirs = ["src", "scripts", "docs", "assets"];
const forbiddenPatterns = [
  { pattern: /\.Export\(/i, reason: "PowerPoint export APIs create raster/vector files, not final native objects", allowFiles: [/SelectionCaptureService\.cs$/] },
  { pattern: /AddPicture/i, reason: "AddPicture inserts raster images" },
  { pattern: /msoPicture/i, reason: "msoPicture violates final object constraint" },
  { pattern: /Insert.*SVG|SVG.*Insert/i, reason: "SVG insert is not accepted as final object" },
  { pattern: /canvas\.toDataURL|toBlob\(/i, reason: "Canvas capture is raster output" },
  { pattern: /<svg\b/i, reason: "Inline SVG is not accepted as final object" }
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = sourceDirs
  .filter(dir => fs.existsSync(dir))
  .flatMap(dir => walk(dir))
  .filter(file => /\.(cs|mjs|js|html|css|json|md|ps1|csproj|sln|config)$/i.test(file));

const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const rule of forbiddenPatterns) {
    if (rule.allowFiles?.some(allowed => allowed.test(file))) continue;
    if (rule.pattern.test(text)) {
      violations.push(`${file}: ${rule.reason}`);
    }
  }
}

const requiredFiles = [
  "src/RoughPptAddin/Services/PptFreeformWriter.cs",
  "src/RoughPptAddin/Services/InteractionShell.cs",
  "src/RoughPptAddin/Services/MetadataService.cs",
  "src/RoughPptAddin/ui/rough-shape-generator.mjs",
  "src/RoughPptAddin/ui/office-preset-outlines.mjs",
  "src/RoughPptAddin/ui/zlk-cluster-result-importer.mjs",
  "src/RoughPptAddin/ui/autoshape-catalog.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    violations.push(`${file}: required implementation file missing`);
  }
}

if (violations.length) {
  throw new Error(`source constraint violations:\n${violations.join("\n")}`);
}

console.log(`source constraints ok: ${files.length} files scanned`);