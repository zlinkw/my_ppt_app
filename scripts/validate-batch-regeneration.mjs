import fs from "node:fs";

const regenerator = read("src/RoughPptAddin/Services/ShapeRegenerator.cs");
const validation = read("docs/VALIDATION.md");
const packageJson = JSON.parse(read("package.json"));
const violations = [];

requireIncludes(regenerator, "pendingRegenerations", "ShapeRegenerator.cs: missing batch regeneration queue");
requireIncludes(regenerator, "List<PendingRegeneration>", "ShapeRegenerator.cs: queue must retain multiple pending Rough objects");
requireAny(regenerator, [
  "for (int i = 1; i <= selection.ShapeRange.Count; i++)",
  "foreach (Microsoft.Office.Interop.PowerPoint.Shape target in targets)"
], "ShapeRegenerator.cs: manual refresh/style updates must cover full selection");
requireAny(regenerator, [
  "QueueRegeneration(selection.ShapeRange[i], styleOverride)",
  "QueueRegeneration(target, styleOverride)"
], "ShapeRegenerator.cs: selected shapes must be queued individually");
requireIncludes(regenerator, "RegenerationKey(shape, request)", "ShapeRegenerator.cs: queue must coalesce by stable Rough group key");
requireIncludes(regenerator, "batch = new List<PendingRegeneration>(pendingRegenerations)", "ShapeRegenerator.cs: drain must process a batch, not a single last shape");
rejectIncludes(regenerator, "private PowerPoint.Shape pendingShape", "ShapeRegenerator.cs: single pendingShape drops earlier batch resize events");
rejectIncludes(regenerator, "private RoughStyle pendingStyle", "ShapeRegenerator.cs: single pendingStyle cannot represent batch style refresh");
rejectIncludes(regenerator, "selection.ShapeRange[1], styleOverride", "ShapeRegenerator.cs: refresh must not be limited to first selected shape");

requireIncludes(
  validation,
  "Batch resize and batch style refresh regenerate every selected Rough group instead of only the last queued shape.",
  "docs/VALIDATION.md: batch regeneration invariant must be documented"
);
requireIncludes(
  packageJson.scripts?.test ?? "",
  "node scripts/validate-batch-regeneration.mjs",
  "package.json: npm test must include batch regeneration contract"
);

if (violations.length) {
  throw new Error(`batch regeneration validation failed:\n${violations.join("\n")}`);
}

console.log("batch regeneration contract ok");

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function requireIncludes(text, needle, message) {
  if (!text.includes(needle)) violations.push(message);
}

function requireAny(text, needles, message) {
  if (!needles.some((needle) => text.includes(needle))) violations.push(message);
}

function rejectIncludes(text, needle, message) {
  if (text.includes(needle)) violations.push(message);
}
