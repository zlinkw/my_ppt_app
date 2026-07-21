import fs from "node:fs";
import path from "node:path";

const roots = ["README.md", "docs", "scripts", "src", "assets"];
const filePattern = /\.(cs|mjs|js|html|css|json|md|ps1|csproj|sln|config)$/i;
const mojibakePattern = /\uFFFD|鑿|鍥|涓|Ã|â|鈽|脳|鏀惰棌|绱犳潗|鎻掑叆/;
const allowed = new Set(["src/RoughPptAddin/ui/vendor/rough.esm.js", "scripts/validate-encoding.mjs"]);

function walk(entry) {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap(child => {
    if (["bin", "obj", "node_modules"].includes(child.name)) return [];
    return walk(path.join(entry, child.name));
  });
}

const violations = [];
for (const file of roots.flatMap(walk).filter(file => filePattern.test(file))) {
  const normalized = file.replaceAll("\\", "/");
  if (allowed.has(normalized)) continue;
  const buffer = fs.readFileSync(file);
  const text = buffer.toString("utf8");
  if (mojibakePattern.test(text)) violations.push(`${file}: mojibake marker found`);
  if (text.includes("\u0000")) violations.push(`${file}: contains NUL bytes`);
}

if (violations.length) {
  throw new Error(`encoding validation failed:\n${violations.join("\n")}`);
}

console.log("encoding ok");
