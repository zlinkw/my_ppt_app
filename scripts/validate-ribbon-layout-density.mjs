import fs from "node:fs";
import { JSDOM } from "jsdom";

const source = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
const violations = [];
const sourceXml = source.match(/var sourceXml = @"([\s\S]*?)";\s*return BuildConsolidatedRibbonXml\(sourceXml\);/)?.[1];
if (!sourceXml) throw new Error("Ribbon source XML or consolidation call is missing");

const sourceDocument = new JSDOM(sourceXml.replace(/""/g, '"'), { contentType: "text/xml" }).window.document;
const groupSpecs = [];
for (const match of source.matchAll(/AppendRibbonGroup\(source,\s*output,\s*tab,\s*"([^"]+)",\s*"([^"]+)",\s*new\[\]\s*\{([\s\S]*?)\}\s*(?:,\s*true)?\);/g)) {
  groupSpecs.push({
    id: match[1],
    label: match[2],
    controlIds: [...match[3].matchAll(/"([^"]+)"/g)].map(item => item[1])
  });
}
for (const match of source.matchAll(/AppendExistingRibbonGroup\(source,\s*output,\s*tab,\s*"([^"]+)"\);/g)) {
  const sourceGroup = findSource(match[1]);
  groupSpecs.splice(1, 0, {
    id: match[1],
    label: sourceGroup.getAttribute("label") ?? "",
    controlIds: [...sourceGroup.children].map(control => control.getAttribute("id"))
  });
}

const expectedGroups = [
  ["roughMainGroup", "常用"],
  ["roughQuickGroup", "快速插入"],
  ["roughStyleGroup", "风格"],
  ["roughResearchGroup", "论文与特征"],
  ["roughLibraryGroup", "素材"]
];
if (groupSpecs.length !== expectedGroups.length) {
  violations.push(`visible Ribbon must contain exactly ${expectedGroups.length} groups; found ${groupSpecs.length}`);
}
for (const [id, label] of expectedGroups) {
  const group = groupSpecs.find(item => item.id === id);
  if (!group || group.label !== label) violations.push(`visible Ribbon group missing: ${id} [${label}]`);
}

const visibleRoots = [];
for (const group of groupSpecs) {
  for (const controlId of group.controlIds) {
    const control = findSource(controlId).cloneNode(true);
    if (controlId === "paperSuiteMenu") {
      for (const removedId of ["paperSuiteMatrix", "paperSuiteVolume", "paperSuiteAttention"]) {
        if (!source.includes(`RemoveRibbonDescendant(control, "${removedId}")`)) {
          violations.push(`paper suite duplicate removal missing: ${removedId}`);
        }
        control.querySelector(`[id="${removedId}"]`)?.remove();
      }
    }
    visibleRoots.push(control);
  }
}

const visibleControls = visibleRoots.flatMap(root => [root, ...root.querySelectorAll("button,toggleButton,menu,dynamicMenu,gallery")]);
const ids = new Map();
for (const control of visibleControls) {
  const id = control.getAttribute("id");
  if (!id) continue;
  ids.set(id, (ids.get(id) ?? 0) + 1);
  if (!control.getAttribute("getImage") && !control.getAttribute("getItemImage")) {
    violations.push(`visible control lacks a local icon callback: ${id}`);
  }
}
for (const [id, count] of ids) {
  if (count !== 1) violations.push(`visible Ribbon control is duplicated: ${id} x${count}`);
}

const uniqueActions = [
  "OpenShapeGallery",
  "ConvertSelectionToRough",
  "RefreshSelection",
  "SelectNativeCarrier",
  "InspectSelection",
  "OpenPane",
  "SaveSelectionAsAsset",
  "RefreshUserAssets",
  "ImportAssets",
  "ExportAssets"
];
for (const action of uniqueActions) {
  const matches = visibleControls.filter(control => control.getAttribute("onAction") === action);
  if (matches.length !== 1) violations.push(`visible Ribbon action must have one entry: ${action} x${matches.length}`);
}

for (const label of [
  "形状图库",
  "功能搜索",
  "转换手绘",
  "重绘选区",
  "选择载体",
  "检查选区",
  "保存素材",
  "导入素材",
  "分享素材",
  "论文矩阵",
  "体数据块",
  "注意力图"
]) {
  const matches = visibleControls.filter(control => control.getAttribute("label") === label);
  if (matches.length !== 1) violations.push(`visible Ribbon label must have one entry: ${label} x${matches.length}`);
}

for (const root of visibleRoots) {
  if (root.localName !== "menu") continue;
  const itemCount = root.querySelectorAll(":scope > button, :scope > toggleButton, :scope > menu, :scope > dynamicMenu").length;
  if (itemCount < 5) violations.push(`small collection must be flattened instead of using a menu: ${root.getAttribute("id")} has ${itemCount}`);
}

for (const obsoleteId of ["compactCommonMenu", "compactSelectionMenu", "roughShapeMenu", "openShapesPane", "startSelectionNext", "insertFeatureBlock"]) {
  if (ids.has(obsoleteId)) violations.push(`obsolete duplicate remains visible: ${obsoleteId}`);
}

const visibleStyleInvalidations = source.match(/VisibleStylePresetControlIds\s*=\s*\{([\s\S]*?)\};/)?.[1]
  ?.match(/"([^"]+)"/g)
  ?.map(item => item.slice(1, -1)) ?? [];
if (!source.includes("foreach (var id in VisibleStylePresetControlIds)")) {
  violations.push("style invalidation must target the final visible preset controls");
}
for (const controlId of visibleStyleInvalidations) {
  if (!ids.has(controlId)) violations.push(`style invalidation targets a hidden Ribbon control: ${controlId}`);
}
for (const controlId of visibleControls.filter(control => control.hasAttribute("getPressed")).map(control => control.getAttribute("id"))) {
  if (!visibleStyleInvalidations.includes(controlId)) violations.push(`visible toggle is missing invalidation wiring: ${controlId}`);
}

if (violations.length) {
  throw new Error(`Ribbon layout density validation failed:\n${violations.join("\n")}`);
}

console.log(`Ribbon layout density ok: ${groupSpecs.length} groups, ${ids.size} unique controls`);

function findSource(id) {
  const matches = [...sourceDocument.querySelectorAll(`[id="${id}"]`)];
  if (matches.length !== 1) throw new Error(`Ribbon source control missing or duplicated: ${id} x${matches.length}`);
  return matches[0];
}
