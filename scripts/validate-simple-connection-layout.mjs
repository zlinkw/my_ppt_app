import fs from "node:fs";

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const marker = "/* B505: final compact connection sizing must win over global fluid button rules. */";
const block = css.slice(css.lastIndexOf(marker));
const required = [
  "grid-auto-rows: minmax(40px, 44px)",
  "max-height: 48px",
  "height: 40px",
  "max-height: 40px",
  "grid-template-columns: 8px minmax(0, 1fr)",
  "writing-mode: horizontal-tb",
  "text-overflow: ellipsis",
  "overflow: hidden !important"
];

if (!block) throw new Error("缺少 B505 简洁模式连接状态最终布局规则。");
for (const snippet of required) {
  if (!block.includes(snippet)) throw new Error(`简洁模式连接状态布局合同缺少：${snippet}`);
}
if (block.indexOf(".simple-connection-note") > block.indexOf(".simple-connection-chip")) {
  throw new Error("简洁模式连接容器规则必须先于按钮规则。 ");
}

console.log("simple connection layout contract ok");
