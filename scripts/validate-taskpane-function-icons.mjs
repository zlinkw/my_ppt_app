import fs from "node:fs";
import { JSDOM } from "jsdom";

const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const html = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const violations = [];

const document = new JSDOM(html).window.document;
for (const button of document.querySelectorAll("button")) {
  const clone = button.cloneNode(true);
  clone.querySelectorAll('[aria-hidden="true"], .function-icon, .button-icon').forEach(node => node.remove());
  if (!clone.textContent.trim()) {
    violations.push(`taskpane text-only button has no visible label: ${button.id || button.getAttribute("aria-label") || button.outerHTML.slice(0, 80)}`);
  }
}

const b381Styles = css.slice(css.lastIndexOf("/* B381 final override: compact text-only task-pane commands. */"));
for (const snippet of [
  ".function-icon",
  ".button-icon",
  ".paper-preset-icon",
  "display: none !important",
  "grid-template-columns: none",
  "min-height: 48px"
]) {
  if (!b381Styles.includes(snippet)) violations.push(`taskpane text-only action contract missing: ${snippet}`);
}
for (const snippet of [
  ".preview-wrap",
  ".quick-shape canvas",
  ".gallery-icon"
]) {
  if (!css.includes(snippet)) violations.push(`shape visual preservation contract missing: ${snippet}`);
}

for (const snippet of [
  "const functionIconGlyphs = Object.freeze({",
  "function createFunctionIconGlyph(name)",
  "holder.dataset.functionIconKey",
  "function functionIconIdentityForTarget(target, fallback)",
  "createFunctionIcon(commandFunctionIconName(command), command.id)",
  "createFunctionIcon(action[2], action[0])",
  "createFunctionIcon(\"insert\", \"insertUserAsset\")",
  "createFunctionIcon(\"trash\", \"deleteUserAsset\")"
]) {
  if (!app.includes(snippet)) violations.push(`taskpane function icon distinctness missing: ${snippet}`);
}

const iconBody = app.match(/const functionIconGlyphs = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1] ?? "";
const iconPairs = [...iconBody.matchAll(/\n\s*(\w+): "(\\u[a-f0-9]{4})"/gi)].map(match => [match[1], match[2]]);
if (iconPairs.length < 40) violations.push(`too few local function icons: ${iconPairs.length}`);
if (new Set(iconPairs.map(([, glyph]) => glyph)).size < 38) violations.push("too few distinct Material Symbols glyphs");

for (const snippet of [
  '@font-face',
  'material-symbols-rounded.subset.woff2',
  'font-family: "Material Symbols Rounded Local"',
  'font-variation-settings: "FILL" 0'
]) {
  if (!css.includes(snippet)) violations.push(`Material Symbols Rounded CSS contract missing: ${snippet}`);
}
for (const snippet of [
  "/* B357: larger outline icons and adaptive spacing for the task pane. */",
  "font-size: 22px;",
  "grid-template-columns: minmax(0, 1fr) 72px;",
  "min-height: 60px;",
  "font-size: 28px;",
  "flex-direction: row;",
  ".app-rail button > span:last-child"
]) {
  if (!css.includes(snippet)) violations.push(`taskpane icon sizing guard missing: ${snippet}`);
}
if (css.includes(".app-rail button span:last-child")) {
  violations.push("taskpane rail label selector must target a direct child so it cannot shrink the nested icon glyph");
}
if (/content:\s*["'][^"']*\?{2,}[^"']*["']/.test(css)) {
  violations.push("taskpane CSS contains a visible question-mark mojibake label");
}
for (const file of [
  "src/RoughPptAddin/ui/vendor/material-symbols-rounded.subset.woff2",
  "src/RoughPptAddin/ui/vendor/material-symbols-rounded-LICENSE.txt"
]) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) violations.push(`Material Symbols Rounded local asset missing: ${file}`);
}

const commandIds = [...app.matchAll(/\{ id: "(cmd-[^"]+)"/g)].map(match => match[1]);
if (commandIds.length < 70) violations.push(`too few command icon targets checked: ${commandIds.length}`);
if (new Set(commandIds).size !== commandIds.length) violations.push("duplicate command ids would break command icon targeting");

const staticTargetBlock = app.match(/const staticFunctionIconTargets = Object\.freeze\(\[([\s\S]*?)\n\]\);/)?.[1] ?? "";
for (const required of [
  "[data-starter-action='catalog']",
  "[data-section-nav='catalog']",
  "[data-command-shortcut='cmd-paper-suite']",
  "#zoteroImageReload",
  "#saveZoteroPalette",
  "#importPalettes",
  "#exportAssets"
]) {
  if (!staticTargetBlock.includes(required)) violations.push(`static function icon target missing: ${required}`);
}

for (const id of [
  "jumpToCharts",
  "jumpToPaperPresets",
  "jumpToAssets",
  "jumpToFeature",
  "pathHints",
  "selectionState",
  "zoteroPaletteGrid",
  "paletteSchemeGrid"
]) {
  if (!html.includes(id)) violations.push(`taskpane icon surface missing expected UI id: ${id}`);
}

if (!/setFunctionIcon\(holder, name, functionIconIdentityForTarget\(target, identity \|\| name\)\)/.test(app)) {
  violations.push("hydrated static function icons must bind a per-control identity, not only a shared base glyph");
}

if (violations.length) {
  throw new Error(`taskpane function icon validation failed:\n${violations.join("\n")}`);
}

console.log("taskpane text actions ok");