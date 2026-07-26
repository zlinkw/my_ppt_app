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

const cjkPattern = /[㐀-鿿豈-﫿]/;
const hasUtf8Bom = buffer => buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

const violations = [];
for (const file of roots.flatMap(walk).filter(file => filePattern.test(file))) {
  const normalized = file.replaceAll("\\", "/");
  if (allowed.has(normalized)) continue;
  const buffer = fs.readFileSync(file);
  const text = buffer.toString("utf8");
  if (mojibakePattern.test(text)) violations.push(`${file}: mojibake marker found`);
  // Windows PowerShell 5.1 按系统 ANSI 代码页读取没有 BOM 的脚本，中文会变成乱码，
  // 甚至可能吞掉字符串结束引号导致脚本解析失败。含中文的 .ps1 必须带 UTF-8 BOM。
  if (/\.ps1$/i.test(file) && cjkPattern.test(text) && !hasUtf8Bom(buffer)) {
    violations.push(`${file}: PowerShell script contains Chinese text but has no UTF-8 BOM; Windows PowerShell 5.1 would decode it as the system ANSI codepage`);
  }
  if (text.includes("\u0000")) violations.push(`${file}: contains NUL bytes`);
}

if (violations.length) {
  throw new Error(`encoding validation failed:\n${violations.join("\n")}`);
}

console.log("encoding ok");
