import fs from "node:fs";

const source = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const violations = [];
const hasChinese = value => /[\u3400-\u9fff]/.test(value ?? "");

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1]] = match[3];
  }
  return result;
}

function callbackReturnsChinese(name) {
  if (!name) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const method = source.match(new RegExp(`\\b${escapedName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,1600})`));
  return Boolean(method && hasChinese(method[1]));
}

for (const [index, match] of [...source.matchAll(/<(button|dynamicMenu)\b[^>\r\n]*>/g)].entries()) {
  const tag = match[0];
  const attributes = attrs(tag);
  const label = `${match[1]} ${attributes.id ?? index + 1}`;
  if (!attributes.imageMso && !attributes.getImage) violations.push(`${label}: missing imageMso/getImage`);
  if (!hasChinese(attributes.screentip) && !callbackReturnsChinese(attributes.getScreentip)) violations.push(`${label}: missing Chinese screentip`);
  if (!hasChinese(attributes.supertip) && !callbackReturnsChinese(attributes.getSupertip)) violations.push(`${label}: missing Chinese supertip`);
  if (attributes.label && !hasChinese(attributes.label)) violations.push(`${label}: label is not Chinese-first`);
}

if (!/GetShapeMenu/.test(source)) violations.push("shape dynamic menu callback missing");
if (!/InsertShapeFromMenu/.test(source)) violations.push("shape menu insert callback missing");
if (!/GetShapeMenuGalleryItemImage[\s\S]*?GetShapeImageForEnum/.test(source) || !/ShapeIconFactory\.Create/.test(source)) {
  violations.push("main shape menu must use local outline shape icons");
}

if (violations.length) {
  throw new Error(`Ribbon icon validation failed:\n${violations.join("\n")}`);
}

console.log("ribbon icons ok");
