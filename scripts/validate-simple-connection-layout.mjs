import fs from "node:fs";

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const html = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");

for (const obsolete of ["simpleConnectionZlk", "simpleConnectionZotero", "simple-connection-chip", "data-simple-connection-", "connectionHealthStrip", "connectionZlk", "connectionZotero", "connection-health-strip", "connection-chip", "data-connection-zlk", "data-connection-zotero"]) {
  if (html.includes(obsolete) || css.includes(obsolete) || app.includes(obsolete)) {
    throw new Error(`简洁模式重复连接入口仍有残留：${obsolete}`);
  }
}

if (html.includes('id="simpleModeActions"')) {
  throw new Error("完整模式切换必须复用快捷工作台容器，不得保留独立操作区。");
}
if (!html.includes('id="simpleModeFullSwitch"')) throw new Error("完整模式切换按钮被误删。");
const workflowStart = html.indexOf('class="workflow-actions"');
const featureButton = html.indexOf('id="jumpToFeature"');
const fullSwitch = html.indexOf('id="simpleModeFullSwitch"');
const moreDisclosure = html.indexOf('class="workflow-more workflow-quickfind"');
if (workflowStart < 0 || featureButton < 0 || fullSwitch < 0 || moreDisclosure < 0 ||
    !(workflowStart < featureButton && featureButton < fullSwitch && fullSwitch < moreDisclosure)) {
  throw new Error("完整模式切换按钮未纳入简洁模式快捷工作台顺序。");
}
if (!css.includes('body.ux-simple[data-selection-kind="none"] .workflow-actions')) {
  throw new Error("缺少简洁模式快捷工作台两列密度规则。");
}

console.log("simple mode action layout contract ok");
