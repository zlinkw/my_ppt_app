# Ribbon 去重迁移：横条能放全放、右侧只留搬不动的

> 工作区干净确认：`git status --short` 仅 `build-info.json` 构建产物漂移，已 `git checkout` 恢复后干净。
> explore 包：`ses_f998b216dffeVH6vKb3yEngNcr`（首步已用 `session.messages` 拉取全量）。

## 目标

横条（`roughDiagramTab`）5 组锁死内完成高频操作；右侧只留参数/预览/数据中心/管理兜底。
去重部分右侧做折叠灰度（`hidden` + `disabled`，不删 `id`/wiring，可回滚）；物理删除（T7）本次不做。

## 约束（explore §3，执行中硬守）

1. 5 组锁死：`roughMainGroup/roughQuickGroup/roughStyleGroup/roughResearchGroup/roughLibraryGroup`，不新增 tab/group。
2. 同一 tab 内 `id` 与可见 `label` 唯一。
3. 每个 button/menu/gallery 中文 `screentip` 必填 + `supertip` 完整（执行 vs 定位语义）。
4. `gallery` 四件套齐全：`getItemCount/getItemID/getItemImage/getItemLabel(+Screentip)/onAction`。
5. T5 只加 `hidden`/`disabled`，保留 `id` 与 wiring；T7 独立验收。
6. Ribbon 直调与 taskpane `postHost` 落到同一 Controller 方法。
7. 预置模板不可覆盖/重命名；保存走 `localStorage roughPptStyleTemplates`（右侧保留）。
8. 素材导入去重/导出体积语义不变。
9. 新增 `postHost type` 必须同步 `bridge-contract.mjs` + `RoughTaskPaneControl.cs case`（本次不新增类型）。

## Todo

- [x] T0：`git status` 确认干净（恢复 `build-info.json`），写本计划。
- [ ] T1：`startStylePresetMenu` 内新增 `startTemplateSave/startTemplateRename`（`onAction=OpenPaneSection` + `PaneSectionForControl` 映射到 `templateSave/templateRename`），直调 `Controller.ShowTaskPaneSection`，中文 screentip/supertip + `getImage`。
- [ ] T2：`startStylePresetMenu` 内新增 `startStyleGallery`（gallery 四件套回调，13 内置先行：`stylePresetGentle…DenseFragments`，复用 `RibbonStylePreset` + `StylePresetIconFactory` + `StylePresetLabel`）；保留 `StylePresetTargetId` 映射与 `currentStylePresetId` 高亮；`InvalidateStylePresets` 追加 gallery；用户模板第二批仍走右侧 `localStorage`（Ribbon C# 读不到浏览器存储，本次结构预留）。
- [ ] T3：`roughLibraryGroup` 新增 `assetSelectAll` toggle（`getPressed/getLabel/onAction`，镜像 `app.mjs:5576` 全选/清空二态文案；Ribbon 侧只做入口态 + 定位 `assetSelect`，不复制 JS 勾选状态机）。
- [ ] T4：`roughResearchGroup` 首位新增 `openResearchChartStudio` button，直调 `Controller.ShowResearchChartStudio()`（与 `app.mjs:4002 postHost(openResearchChartStudio)` 同方法）。
- [ ] T5：`index.html` 折叠灰度（`style-quick-strip:166`、`style-param-jump:177`、`quick-actions:134`、`noviceGuideStrip:51`、`workflow-more:57` 加 `hidden`，内按钮加 `disabled`，不删 `id`/wiring；`workflow-actions:39` 保持可见以保 `ui-interactions` 密度探针）。
- [ ] T6：验收（`npm run build:ui` + 相关 validate 脚本全绿；Ribbon 5 组/label 唯一/中文提示/gallery 回调；右侧灰度可回滚）。
- [ ] T7（本次不做）：物理删除灰度 DOM + 废弃监听 + 收紧校验器，待 T5 灰度验收后单独执行。
- [ ] T8：同步 `validate-ribbon-top-commands/layout-density/icons/style-realtime` + `validate-taskpane-action-wiring/ui-interactions` 期望（新控件断言 + 灰度 `hidden` 断言）。

## 改动文件清单

- `src/RoughPptAddin/Ribbon/RoughRibbon.cs`（T1–T4）
- `src/RoughPptAddin/ui/index.html`（T5）
- `scripts/validate-ribbon-top-commands.mjs`、`validate-ribbon-layout-density.mjs`、`validate-ribbon-icons.mjs`、`validate-ribbon-style-realtime.mjs`、`validate-taskpane-action-wiring.mjs`（T8；`ui-interactions` 为浏览器探针，本次不改其断言逻辑，仅保证灰度不破坏其探针）
- 本计划 `docs/plans/ribbon-dedup/plan.md`（T0）
