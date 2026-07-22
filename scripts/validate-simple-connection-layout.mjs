import fs from "node:fs";

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const html = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const marker = "/* B513: connection buttons reuse the workflow action sizing and grid. */";
const block = css.slice(css.lastIndexOf(marker));
const required = [
  ".simple-connection-note.workflow-actions",
  ".simple-connection-note.workflow-actions > button",
  "grid-template-columns: repeat(3, minmax(0, 1fr))",
  "grid-template-columns: 18px minmax(0, 1fr)",
  "writing-mode: horizontal-tb",
  "text-overflow: ellipsis",
  "overflow: hidden"
];

if (!html.includes('class="simple-connection-note workflow-actions"')) throw new Error("简洁模式连接按钮未复用快捷工作台容器样式。");
if (!block) throw new Error("缺少 B513 简洁模式连接按钮共享布局规则。");
for (const snippet of required) {
  if (!block.includes(snippet)) throw new Error(`简洁模式连接状态布局合同缺少：${snippet}`);
}
if (block.indexOf(".simple-connection-note") > block.indexOf(".simple-connection-chip")) {
  throw new Error("简洁模式连接容器规则必须先于按钮规则。 ");
}

console.log("simple connection layout contract ok");
