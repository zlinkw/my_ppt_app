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

// 完整模式固定：顶栏模式切换与快捷工作台切换按钮必须删除，只留完整模式。
for (const removed of ['id="simpleModeFullSwitch"', 'id="uiModeSimple"', 'id="uiModeFull"']) {
  if (html.includes(removed)) throw new Error(`完整模式固定后仍残留切换入口：${removed}`);
}
if (!html.includes("topbar-mode-note")) throw new Error("完整模式顶栏缺少固定模式说明。");
const workflowStart = html.indexOf('class="workflow-actions"');
const featureButton = html.indexOf('id="jumpToFeature"');
const moreDisclosure = html.indexOf('class="workflow-more workflow-quickfind"');
if (workflowStart < 0 || featureButton < 0 || moreDisclosure < 0 ||
    !(workflowStart < featureButton && featureButton < moreDisclosure)) {
  throw new Error("快捷工作台顺序异常：特征块入口必须位于工作区容器与折叠区之间。");
}
if (!html.includes('class="ux-full"') && !app.includes('uiMode: "full"')) {
  throw new Error("任务窗格必须固定为完整模式。");
}
if (!css.includes('body.ux-simple[data-selection-kind="none"] .workflow-actions')) {
  throw new Error("缺少简洁模式快捷工作台两列密度规则。");
}

console.log("simple mode action layout contract ok");
