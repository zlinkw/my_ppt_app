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

for (const [index, match] of [...source.matchAll(/<(button|dynamicMenu)\b[^>]*>/g)].entries()) {
  const tag = match[0];
  const attributes = attrs(tag);
  const label = `${match[1]} ${attributes.id ?? index + 1}`;
  if (!attributes.imageMso && !attributes.getImage) violations.push(`${label}: missing imageMso/getImage`);
  if (!attributes.screentip || !hasChinese(attributes.screentip)) violations.push(`${label}: missing Chinese screentip`);
  if (!attributes.supertip || !hasChinese(attributes.supertip)) violations.push(`${label}: missing Chinese supertip`);
  if (attributes.label && !hasChinese(attributes.label)) violations.push(`${label}: label is not Chinese-first`);
}

if (!/GetShapeMenu/.test(source)) violations.push("shape dynamic menu callback missing");
if (!/InsertShapeFromMenu/.test(source)) violations.push("shape menu insert callback missing");
if (!/imageMso='ShapesInsertGallery'/.test(source)) violations.push("main shape menu must reuse PPT shape gallery icon");

if (violations.length) {
  throw new Error(`Ribbon icon validation failed:\n${violations.join("\n")}`);
}

console.log("ribbon icons ok");
