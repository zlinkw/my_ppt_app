import fs from "node:fs";

const catalogPath = "assets/autoshapes/mso-autoshape-catalog.json";
if (!fs.existsSync(catalogPath)) {
  throw new Error(`${catalogPath} missing. Run npm run generate:catalog.`);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
if (!Array.isArray(catalog.items)) {
  throw new Error("catalog.items must be an array");
}

if (catalog.items.length < 150) {
  throw new Error(`catalog too small: ${catalog.items.length}`);
}

const seen = new Set();
for (const item of catalog.items) {
  for (const key of ["enumName", "category", "generationStrategy", "recipeId", "fidelity"]) {
    if (!item[key]) throw new Error(`missing ${key} in ${JSON.stringify(item)}`);
  }
  if (!item.displayNameZh) throw new Error(`missing displayNameZh in ${item.enumName}`);
  for (const param of ["dashStyle", "arrowheadStyle"]) {
    if (!item.supportedParams?.includes(param)) throw new Error(`missing supported param ${param} in ${item.enumName}`);
  }
  if (seen.has(item.enumName)) throw new Error(`duplicate ${item.enumName}`);
  seen.add(item.enumName);
}

const flowchartOffline = catalog.items.find(item => item.enumName === "msoShapeFlowchartOfflineStorage");
if (!flowchartOffline) throw new Error("msoShapeFlowchartOfflineStorage missing from catalog");
if (flowchartOffline.category !== "flowchart") {
  throw new Error(`msoShapeFlowchartOfflineStorage must be flowchart, got ${flowchartOffline.category}`);
}
if (!/^流程图/.test(flowchartOffline.displayNameZh)) {
  throw new Error(`msoShapeFlowchartOfflineStorage must have Chinese flowchart label, got ${flowchartOffline.displayNameZh}`);
}

for (const enumName of [
  "msoShapeLineCallout1",
  "msoShapeLineCallout2",
  "msoShapeLineCallout3",
  "msoShapeLineCallout4"
]) {
  const item = catalog.items.find(candidate => candidate.enumName === enumName);
  if (!item) throw new Error(`${enumName} missing from catalog`);
  if (item.category !== "callouts") throw new Error(`${enumName} must be callouts, got ${item.category}`);
}

const requiredThreeD = [
  ["rough3dCubeRough", "roughPathRecipe"],
  ["rough3dCubePlain", "native3dRecipe"],
  ["rough3dCylinderRough", "roughPathRecipe"],
  ["rough3dCylinderPlain", "native3dRecipe"],
  ["rough3dConeRough", "roughPathRecipe"],
  ["rough3dConePlain", "native3dRecipe"],
  ["rough3dSphereRough", "roughPathRecipe"],
  ["rough3dSpherePlain", "native3dRecipe"],
  ["rough3dPyramidRough", "roughPathRecipe"],
  ["rough3dPyramidPlain", "native3dRecipe"],
  ["rough3dStackRough", "roughPathRecipe"],
  ["rough3dStackPlain", "native3dRecipe"]
];
for (const [enumName, generationStrategy] of requiredThreeD) {
  const item = catalog.items.find(candidate => candidate.enumName === enumName);
  if (!item) throw new Error(`${enumName} missing from catalog`);
  const expectedCategory = /Plain$/.test(enumName) ? "three-d-plain" : "three-d-rough";
  if (item.category !== expectedCategory) throw new Error(`${enumName} must be ${expectedCategory}, got ${item.category}`);
  if (item.generationStrategy !== generationStrategy) {
    throw new Error(`${enumName} must use ${generationStrategy}, got ${item.generationStrategy}`);
  }
  if (item.insertable === false) throw new Error(`${enumName} must be insertable`);
}

const rough3d = catalog.items.filter(item => item.category === "three-d-rough");
const plain3d = catalog.items.filter(item => item.category === "three-d-plain");
if (rough3d.length < 6 || plain3d.length < 6) {
  throw new Error(`3D groups must be split with at least 6 items each, got rough=${rough3d.length}, plain=${plain3d.length}`);
}

console.log(`catalog ok: ${catalog.items.length} shapes`);
