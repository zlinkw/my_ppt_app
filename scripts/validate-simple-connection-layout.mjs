import fs from "node:fs";

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
const html = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");

for (const obsolete of ["simpleConnectionZlk", "simpleConnectionZotero", "simple-connection-chip", "data-simple-connection-", "connectionHealthStrip", "connectionZlk", "connectionZotero", "connection-health-strip", "connection-chip", "data-connection-zlk", "data-connection-zotero"]) {
  if (html.includes(obsolete) || css.includes(obsolete) || app.includes(obsolete)) {
    throw new Error(`简洁模式重复连接入口仍有残留：${obsolete}`);
  }
}

if (!html.includes('id="simpleModeActions" class="simple-mode-actions workflow-actions"')) {
  throw new Error("简洁模式操作区未复用快捷工作台按钮布局。");
}
if (!html.includes('id="simpleModeFullSwitch"')) throw new Error("完整模式切换按钮被误删。");
if (!css.includes("body.ux-simple .simple-mode-actions")) throw new Error("缺少简洁模式操作区显示规则。");

console.log("simple mode action layout contract ok");
