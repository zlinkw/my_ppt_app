import fs from "node:fs";

const catalogPath = "assets/autoshapes/mso-autoshape-catalog.json";
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));
const items = catalog.items ?? [];

const nonInsertable = items.filter(item => item.insertable === false);
if (nonInsertable.length !== 1 || nonInsertable[0].enumName !== "msoShapeNotPrimitive") {
  throw new Error(`expected only msoShapeNotPrimitive as non-insertable sentinel, got: ${nonInsertable.map(item => item.enumName).join(", ")}`);
}

const insertable = items.filter(item => item.insertable !== false);
if (insertable.length < 190) {
  throw new Error(`insertable catalog too small: ${insertable.length}`);
}

const nonExact = insertable.filter(item => item.fidelity !== "exact" || item.generationStrategy === "roughApproximation");
if (nonExact.length) {
  throw new Error(`insertable catalog must be exact:\n${nonExact.map(item => `${item.enumName}: ${item.generationStrategy}/${item.fidelity}`).join("\n")}`);
}

if (nonInsertable[0].fidelity !== "sentinel" || nonInsertable[0].generationStrategy !== "sentinel") {
  throw new Error("msoShapeNotPrimitive must use fidelity=sentinel and generationStrategy=sentinel");
}

console.log(`catalog exactness ok: ${insertable.length} exact insertable shapes, ${nonInsertable.length} sentinel`);
