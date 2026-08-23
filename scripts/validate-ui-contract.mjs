import fs from "node:fs";

const files = [
  "src/RoughPptAddin/ui/index.html",
  "src/RoughPptAddin/ui/app.mjs",
  "src/RoughPptAddin/Ribbon/RoughRibbon.cs",
  "src/RoughPptAddin/Services/RoughAddInController.cs",
  "src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs",
  "src/RoughPptAddin/Services/MetadataService.cs",
  "src/RoughPptAddin/Services/RoughJsBridge.cs"
];

const forbiddenVisiblePhrases = [
  "Rough Diagram",
  "PowerPoint Native",
  "PowerPoint AutoShapes",
  "Insert request sent",
  "No saved assets yet",
  "PowerPoint host is unavailable",
  "Plain PowerPoint object",
  "metadata complete",
  "native editable",
  "Rough Group",
  "Saved asset:",
  "Inserted asset:",
  "Exported asset package:",
  "Imported assets:",
  "No selected shape",
  "Multiple shapes selected",
  "No active slide",
  "Insert failed:",
  "Save asset failed:"
];

const hasChinese = value => /[\u3400-\u9fff]/.test(value ?? "");
const firstVisibleHasChinese = value => /^[^A-Za-z]{0,4}[\u3400-\u9fff]/.test((value ?? "").trim());
const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const phrase of forbiddenVisiblePhrases) {
    if (text.includes(phrase)) violations.push(`${file}: visible English phrase remains: ${phrase}`);
  }
}

const index = fs.readFileSync("src/RoughPptAddin/ui/index.html", "utf8");
if (!/<html\s+lang="zh-CN">/.test(index)) violations.push("index.html: missing zh-CN document language");
if (!index.includes('id="convertSelection"')) violations.push("index.html: missing convert selected native shapes button");
if (!index.includes('data-feature-param="gradientReverse"')) violations.push("index.html: feature block gradient reverse control missing");
if (!index.includes('id="selectAssets"')) violations.push("index.html: selectable asset sharing control missing");
for (const emojiCode of ["&#128269;", "&#128190;", "&#128427;"]) {
  if (index.includes(emojiCode)) violations.push(`index.html: task pane action icons must avoid color emoji codepoint ${emojiCode}`);
}
if (!index.includes('id="commandResults"') || !/搜索形状、预设、素材、(功能|命令)/.test(index)) {
  violations.push("index.html: search must expose global command results and function-search copy");
}
if (!/data-search-scope|id="searchScope|name="searchScope/.test(index)) {
  violations.push("index.html: search must expose a stable search scope switch with data-search-scope/name=searchScope");
}
for (const scope of ["全部", "形状", "功能", "预设", "数据", "素材"]) {
  if (!index.includes(scope)) violations.push(`index.html: search scope switch missing Chinese scope ${scope}`);
}
if (!/id="searchEmptyState"|data-search-empty|class="[^"]*(search-empty|shape-empty|catalog-empty)/.test(index)) {
  violations.push("index.html: search empty state must expose a visible Chinese empty-state hook");
}
if (!/id="searchSuggestions"|data-search-suggestions|class="[^"]*search-suggestions/.test(index)) {
  violations.push("index.html: first-screen search suggestions must expose a stable hook");
}
const workflowIndex = index.indexOf('class="starter-panel workflow-panel') >= 0
  ? index.indexOf('class="starter-panel workflow-panel')
  : index.indexOf('class="workflow-panel');
const commandIndex = index.indexOf('class="command-bar');
const selectionIndex = index.indexOf('class="selection-panel');
const paramsIndex = index.indexOf('id="params"');
if (!(workflowIndex >= 0 && commandIndex > workflowIndex && selectionIndex > commandIndex && paramsIndex > selectionIndex)) {
  violations.push("index.html: command search must sit in the first viewport after common entries and before selection/style panels");
}
if (!index.includes("快捷工作台") || !index.includes("starter-panel") || !index.includes("data-starter-action")) {
  violations.push("index.html: first-screen quick workspace command band missing stable Chinese hooks");
}
if (!index.includes('id="buildInfo"') || !index.includes("版本检测")) {
  violations.push("index.html: top bar must expose build/version verification button");
}
for (const obsolete of ["connectionHealthStrip", "connectionZlk", "connectionZotero", "connection-health-strip", "connection-chip", "data-connection-zlk", "data-connection-zotero"]) {
  if (index.includes(obsolete)) violations.push(`index.html: duplicate external connection button remains ${obsolete}`);
}
if (!index.includes("paperPresetGrid") || !index.includes("paperPresetFilters") || !index.includes("论文图预设") || !index.includes("data-collapse-key=\"paperPresets\"")) {
  violations.push("index.html: paper figure preset panel missing stable Chinese hooks");
}
if (!index.includes("data-chart-layout=\"data-center\"") ||
    !index.includes("chart-import-hero") ||
    !index.includes("chart-support-grid") ||
    !index.includes("数据中心") ||
    !index.includes("图表建议")) {
  violations.push("index.html: chart import panel must use compact data-center layout with Chinese support summary");
}
for (const action of ["catalog", "next", "style", "charts", "paperPresets", "library", "featureBlock", "quickInsert", "convert", "redraw", "paperTemplate", "search"]) {
  if (!index.includes(`data-starter-action="${action}"`)) {
    violations.push(`index.html: start workflow missing action ${action}`);
  }
}
const workflowActionsBlock = index.match(/<div\b[^>]*class="[^"]*\bworkflow-actions\b[^"]*"[\s\S]*?<\/div>/)?.[0] ?? "";
const workflowMoreBlock = index.match(/<details\b[^>]*class="[^"]*\bworkflow-more\b[^"]*\bworkflow-quickfind\b[^"]*"[\s\S]*?<\/details>/)?.[0] ?? "";
const workflowMoreTag = index.match(/<details\b[^>]*class="[^"]*\bworkflow-more\b[^"]*\bworkflow-quickfind\b[^"]*"[^>]*>/)?.[0] ?? "";
const actionOrder = source => [...source.matchAll(/data-starter-action="([^"]+)"/g)].map(match => match[1]);
const sameOrder = (actual, expected) => actual.length === expected.length && expected.every((value, index) => actual[index] === value);
const primaryStarterActions = ["catalog", "next", "redraw", "style", "charts", "paperPresets", "library", "featureBlock"];
const foldedStarterActions = ["quickInsert", "search", "convert", "redraw", "paperTemplate"];
if (!sameOrder(actionOrder(workflowActionsBlock), primaryStarterActions)) {
  violations.push(`index.html: quick workspace must expose exactly 8 primary entries in order ${primaryStarterActions.join(", ")}`);
}
if (!workflowMoreBlock || !sameOrder(actionOrder(workflowMoreBlock.match(/<div\b[^>]*class="[^"]*\bworkflow-more-actions\b[^"]*"[\s\S]*?<\/div>/)?.[0] ?? ""), foldedStarterActions)) {
  violations.push(`index.html: more start actions must be folded under workflow-more with actions ${foldedStarterActions.join(", ")}`);
}
if (!workflowMoreTag || !workflowMoreTag.includes("data-workflow-more") || !workflowMoreTag.includes("data-quickfind") || /\sopen(?:\s|=|>)/.test(workflowMoreTag)) {
  violations.push("index.html: more start actions and quickfind must share one default-collapsed details entry");
}
if (!/快捷工作台[\s\S]{0,900}AI\s*预设|AI预设/.test(workflowActionsBlock)) {
  violations.push("index.html: quick workspace must make AI paper presets discoverable in the primary entries");
}
if (!/id="styleTemplatePreview"|data-style-template-preview|class="[^"]*style-template-preview/.test(index)) {
  violations.push("index.html: style templates must expose preview cards with active state hooks");
}
if (!/class="[^"]*style-param-jump/.test(index) || !/data-param-group-jump="常用"/.test(index) || !/data-param-group-jump="填充纹理"/.test(index)) {
  violations.push("index.html: style params must expose Chinese group jump buttons");
}
if (!/<button[^>]*id="refreshSelection"[^>]*>[\s\S]*重绘选区[\s\S]*<\/button>/.test(index)) {
  violations.push("index.html: regenerate selected rough command must be labeled 重绘选区");
}
if (!/id="featureDirectionGuide"|data-feature-direction-guide|class="[^"]*feature-direction/.test(index)) {
  violations.push("index.html: feature block direction indication must expose a stable visual guide hook");
}
for (const [direction, label] of [
  ["left", "左"],
  ["right", "右"],
  ["up", "上"],
  ["down", "下"],
  ["front", "前"],
  ["back", "后"]
]) {
  const pattern = new RegExp(`data-feature-dir=["']${direction}["'][\\s\\S]{0,220}(aria-label|title)=["'][^"']*${label}`);
  if (!pattern.test(index)) {
    violations.push(`index.html: feature block direction control missing readable ${label} direction hint`);
  }
}

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1]] = match[3];
  }
  return result;
}

function requireChinese(value, label) {
  if (!hasChinese(value)) violations.push(`${label}: missing Chinese-first visible copy or tooltip`);
}

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? "";
}

for (const [i, match] of [...index.matchAll(/\btitle=(["'])(.*?)\1/g)].entries()) {
  requireChinese(match[2], `index.html: title ${i + 1}`);
}

for (const [i, match] of [...index.matchAll(/\baria-label=(["'])(.*?)\1/g)].entries()) {
  requireChinese(match[2], `index.html: aria-label ${i + 1}`);
}

for (const [i, match] of [...index.matchAll(/<button\b[^>]*>/g)].entries()) {
  const attributes = attrs(match[0]);
  if (!attributes.title) violations.push(`index.html: static button ${i + 1} missing hover title`);
  else requireChinese(attributes.title, `index.html: static button ${i + 1} title`);
}

for (const [i, match] of [...index.matchAll(/<(input|select)\b[^>]*>/g)].entries()) {
  const attributes = attrs(match[0]);
  if (!attributes.title) violations.push(`index.html: static ${match[1]} ${i + 1} missing hover title`);
  else requireChinese(attributes.title, `index.html: static ${match[1]} ${i + 1} title`);
}

for (const [i, match] of [...index.matchAll(/<span\b[^>]*class="badge"[^>]*>/g)].entries()) {
  const attributes = attrs(match[0]);
  if (!attributes.title) violations.push(`index.html: badge ${i + 1} missing hover title`);
  else requireChinese(attributes.title, `index.html: badge ${i + 1} title`);
}

for (const [i, match] of [...index.matchAll(/<(strong|small|option|button)\b[^>]*>([^<]+)/g)].entries()) {
  const text = match[2].trim();
  if (text && !hasChinese(text)) violations.push(`index.html: visible text ${i + 1} is not Chinese-first: ${text}`);
}

const app = fs.readFileSync("src/RoughPptAddin/ui/app.mjs", "utf8");
const styles = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
for (const snippet of [
  "formatBuildTimeShort",
  "setSelectionBadge",
  "setSummaryBadge",
  "setLocalStatusTone",
  "当前搜索下全部形状",
  "zlkLocalStatusTone",
  "zoteroLocalStatusTone",
  "setSelectionStateTone",
  "state.zlkAutomationResult",
  "state.zoteroDatabaseFound",
  "if (key === \"zoteroImages\")"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: status presentation missing ${snippet}`);
}
for (const snippet of [
  ".badge.tone-ready",
  ".selection-state.feature",
  ".zlk-automation-status.ok",
  ".zotero-image-status.warn",
  "#count.tone-ok",
  ".param-section[open] .param-section-count",
  ".categories button small",
  "inset 0 -2px 0 var(--accent)",
  ".asset-card:hover",
  ".chart-dataset-card:hover",
  ".zotero-image-card:focus-within",
  ".feature-actions button[data-feature-dir]",
  ".feature-direction-guide",
  "#eef4fc",
  ".paper-preset-card:hover",
  ".resource-load-more",
  "var(--panel)",  "169a49",
  ".palette-card-actions button",
  ".zotero-image-actions button",
  ".shape-card",
  ".gallery-shape.pinned",
  ".quick-shape-list",
  ".favorite-toggle.active",
  "1b7fd0",
  ".param-section[open]"
]) {
  if (!styles.includes(snippet)) violations.push(`styles.css: external connection strip style missing ${snippet}`);
}
for (const emojiCode of ["\\u{1f4be}", "\\u{1f50d}", "\\u{1f5c3}", "💾", "🔍", "🗃"]) {
  if (app.includes(emojiCode)) violations.push(`app.mjs: task pane command icons must avoid color emoji token ${emojiCode}`);
}
const bridgeContract = fs.readFileSync("src/RoughPptAddin/ui/bridge-contract.mjs", "utf8");
const taskPane = fs.readFileSync("src/RoughPptAddin/TaskPane/RoughTaskPaneControl.cs", "utf8");
if (!app.includes("convertSelectionToRough")) violations.push("app.mjs: missing convertSelectionToRough host message");
const hostMessageTypes = new Set();
for (const match of app.matchAll(/postHost\(\{\s*type:\s*"([^"]+)"/g)) {
  hostMessageTypes.add(match[1]);
}
for (const match of app.matchAll(/postHost\(\{\s*type:\s*'([^']+)'/g)) {
  hostMessageTypes.add(match[1]);
}
for (const type of hostMessageTypes) {
  if (!bridgeContract.includes(`${type}: "${type}"`)) {
    violations.push(`bridge-contract.mjs: missing ${type} host message type`);
  }
  if (!new RegExp(`(?:case\\s+"${type}"\\s*:|type\\s*==\\s*"${type}")`).test(taskPane)) {
    violations.push(`RoughTaskPaneControl.cs: missing handler for host message type ${type}`);
  }
}
for (const snippet of [
  "button.title =",
  "card.title =",
  "favorite.title =",
  "previewWrap.title =",
  "meta.title =",
  "element.title =",
  "empty.title =",
  "els.status.title =",
  "els.selectionBadge.title =",
  "els.selectionState.title =",
  "card.setAttribute(\"aria-label\"",
  "favorite.setAttribute(\"aria-label\"",
  "button.setAttribute(\"aria-label\""
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: dynamic tooltip hook missing: ${snippet}`);
}

for (const snippet of [
  "commandSearchItems",
  "loadBuildInfo",
  "build-info.json",
  "buildInfoDetail",
  "当前插件版本",
  "怎么重绘",
  "哪里改颜色",
  "找不到素材",
  "如何分享",
  "帮助",
  "提示",
  "renderCommandResults",
  "matchedCommands",
  "commandCenterItems",
  "roughPptRecentCommands",
  "command-center",
  "searchScope",
  "searchScopeAllows(\"preset\")",
  "searchScopeAllows(\"chart\")",
  "data-search-scope",
  "searchSuggestionItems",
  "renderSearchSuggestions",
  "applySearchSuggestion",
  "data-command-shortcut",
  "activateCommandShortcut",
  "data-starter-action",
  "activateStarterAction",
  "applyStarterPaperTemplate",
  "focusControl",
  "openShapeDropdownAndFocusSearch",
  "已展开形状图库",
  "catalogSearchText",
  "iconDropdownItemsForQuery",
  "applyPaperPresetCommandState",
  "zlk-cluster-result-importer.mjs",
  "importZlkClusterResultFile",
  "supportedZlkClusterPatterns",
  "renderChartImportPanel",
  "handleZlkChartFiles",
  "cmd-zlk-chart-import",
  "hint-zlk-chart-import",
  "zlkChartResults",
  "chartDatasets",
  "cmd-redraw",
  "cmd-fill",
  "cmd-template",
  "cmd-paper-suite",
  "cmd-paper-presets",
  "cmd-paper-recommended-presets",
  "cmd-paper-recent-presets",
  "cmd-paper-favorite-presets",
  "paperPresetCategory: \"recommended\"",
  "paperPresetCategory: \"recent\"",
  "paperPresetCategory: \"favorites\"",
  "paperPresetCategories",
  "recommendedPaperPresetIds",
  "recentPaperPresets",
  "favoritePaperPresets",
  "paperPresetEmptyInfo",
  "paperPresetStateLabels",
  "roughPptRecentPaperPresets",
  "roughPptFavoritePaperPresets",
  "renderPaperPresetFilters",
  "resetPaperPresetCategory",
  "openPaperPresetsPanel",
  "switchToPaperPresetResults",
  "crossScopePaperPresetMatches",
  "focusFirstScopedSearchResult",
  "显示全部预设",
  "在预设中查找",
  "paperPresetCategory",
  "data-paper-preset-category",
  "cmd-paper-node",
  "cmd-paper-data",
  "cmd-paper-decision",
  "cmd-paper-group",
  "cmd-paper-highlight",
  "cmd-paper-arrow",
  "cmd-paper-matrix",
  "cmd-paper-volume",
  "cmd-paper-attention",
  "cmd-paper-transformer-encoder",
  "cmd-paper-transformer-decoder",
  "cmd-paper-vision-encoder",
  "cmd-paper-text-encoder",
  "cmd-paper-multimodal-fusion",
  "cmd-paper-contrastive-towers",
  "cmd-paper-classification-head",
  "cmd-paper-diagnosis-head",
  "cmd-paper-medical-image-report",
  "cmd-paper-trimodal-diagnosis",
  "cmd-paper-vlm-report-diagnosis",
  "cmd-paper-tabular-branch",
  "cmd-paper-cross-modal-attention",
  "cmd-paper-llm-adapter",
  "cmd-paper-unet-segmentation",
  "cmd-paper-large-model-rag",
  "cmd-paper-clinical-validation",
  "cmd-paper-diagnosis-evaluation",
  "cmd-paper-decoder-block",
  "cmd-paper-qformer-bridge",
  "cmd-paper-instruction-vlm",
  "cmd-paper-medclip-matching",
  "cmd-paper-mae-pretrain",
  "cmd-paper-report-table-rag",
  "cmd-paper-swin-unetr",
  "cmd-paper-tabtransformer-risk",
  "cmd-paper-deployment-monitoring",
  "cmd-paper-federated-learning",
  "cmd-paper-diffusion-augmentation",
  "cmd-paper-survival-outcome",
  "cmd-paper-active-learning",
  "cmd-paper-moe-routing",
  "paperStructurePresets",
  "paperPresetGrid",
  "renderPaperPresets",
  "insertPaperPreset",
  "toggleFavoritePaperPreset",
  "rememberRecentPaperPreset",
  "paper-preset-favorite",
  "paper-preset-state-labels",
  "hint-paper-recommended",
  "hint-paper-recent",
  "hint-paper-favorites",
  "clearQuery",
  "data-paper-preset-id",
  "论文套件",
  "论文图预设",
  "论文节点",
  "数据节点",
  "判断节点",
  "分组虚线",
  "高亮框",
  "粗箭头",
  "论文矩阵",
  "体数据块",
  "注意力图",
  "Transformer 编码器",
  "Transformer 解码器",
  "视觉编码器",
  "文本编码器",
  "多模态融合",
  "对比学习双塔",
  "分类头",
  "诊断头",
  "医学图像-报告流程",
  "三模态医学诊断",
  "医学 VLM 报告诊断",
  "表格临床分支",
  "跨模态注意力融合",
  "LLM Adapter 微调",
  "医学分割流程",
  "大模型诊断 RAG",
  "临床验证流程",
  "诊断评估面板",
  "Transformer 解码器块",
  "Q-Former VLM 桥接",
  "医学指令 VLM",
  "MedCLIP 语义匹配",
  "自监督预训练",
  "报告表格 RAG",
  "3D Swin UNETR 分割",
  "表格 Transformer 风险",
  "临床部署监测",
  "多中心联邦学习",
  "医学扩散增强",
  "生存预后预测",
  "主动学习标注",
  "MoE 专家路由",
  "纵向随访诊断",
  "弱监督 MIL",
  "医学知识图谱推理",
  "教师学生蒸馏",
  "医学基础模型提示调优",
  "非复刻单篇论文图",
  "不直接插入",
  "shapeQuery",
  "shapeCategory",
  "focusSearchAfterOpen",
  "cmd-assets",
  "cmd-save-selection",
  "cmd-inspect",
  "cmd-select-assets",
  "cmd-quick-refresh",
  "showInlinePrompt",
  "inlinePrompt",
  "functionIconPaths",
  "hydrateFunctionIcons",
  "ContextMenu",
  "shiftKey && event.key === \"F10\"",
  "role\", \"menuitem\"",
  "action.focus({ preventScroll: true })",
  "featureParamGroups",
  "groupFeatureBlockControls",
  "feature-section",
  "syncFeatureBlockModeAvailability",
  "data-feature-scope",
  "data-style-template-id",
  "aria-pressed",
  "style-template-preview",
  "styleParamJumpButtons",
  "wireStyleParamJumps",
  "focusParamGroup",
  "syncParamJumpButtons",
  "data-param-group-jump",
  "二维网格没有前后层",
  "不会直接执行删除或覆盖等操作"
]) {
  const equivalentFunctionIconMap = snippet === "functionIconPaths" && app.includes("functionIconGlyphs") && app.includes("functionIconByCommandId");
  if (!app.includes(snippet) && !equivalentFunctionIconMap) violations.push(`app.mjs: global command search missing: ${snippet}`);
}

if (/window\.(confirm|prompt)\s*\(/.test(app)) {
  violations.push("app.mjs: task pane must not use blocking WebView prompt/confirm dialogs");
}
if (!index.includes('id="inlinePrompt"') || !fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8").includes(".inline-prompt")) {
  violations.push("task pane: inline Chinese prompt surface missing");
}
for (const selector of ["#jumpToShapes", "#jumpToRedraw", "#convertSelection", "#zlkChartImport", "#saveZoteroPalette", "#reloadAssets"]) {
  if (!app.includes(selector)) violations.push(`app.mjs: functional SVG icon target missing ${selector}`);
}

const expectedPaperPresetCommandTargets = {
  "cmd-paper-transformer-encoder": "transformerEncoder",
  "cmd-paper-transformer-decoder": "transformerDecoderBlock",
  "cmd-paper-vision-encoder": "visionTransformer",
  "cmd-paper-text-encoder": "multimodalFusion",
  "cmd-paper-multimodal-fusion": "multimodalFusion",
  "cmd-paper-contrastive-towers": "contrastiveDualTower",
  "cmd-paper-classification-head": "classificationDiagnosis",
  "cmd-paper-diagnosis-head": "classificationDiagnosis",
  "cmd-paper-medical-image-report": "medicalImageReport",
  "cmd-paper-trimodal-diagnosis": "medicalTriModalDiagnosis",
  "cmd-paper-vlm-report-diagnosis": "medicalVlmReportDiagnosis",
  "cmd-paper-tabular-branch": "tabularClinicalBranch",
  "cmd-paper-cross-modal-attention": "crossModalAttentionFusion",
  "cmd-paper-llm-adapter": "llmAdapterFineTune",
  "cmd-paper-unet-segmentation": "unetSegmentation",
  "cmd-paper-large-model-rag": "largeModelRag",
  "cmd-paper-clinical-validation": "clinicalValidation",
  "cmd-paper-diagnosis-evaluation": "diagnosisEvaluationPanel",
  "cmd-paper-decoder-block": "transformerDecoderBlock",
  "cmd-paper-qformer-bridge": "blip2QformerBridge",
  "cmd-paper-instruction-vlm": "medicalInstructionVlm",
  "cmd-paper-medclip-matching": "medclipSemanticMatching",
  "cmd-paper-mae-pretrain": "selfSupervisedMaePretrain",
  "cmd-paper-report-table-rag": "multimodalRagReportTable",
  "cmd-paper-swin-unetr": "swinUnetr3DSegmentation",
  "cmd-paper-tabtransformer-risk": "tabTransformerRisk",
  "cmd-paper-deployment-monitoring": "clinicalDeploymentMonitoring",
  "cmd-paper-federated-learning": "federatedLearningMedical",
  "cmd-paper-diffusion-augmentation": "diffusionAugmentation",
  "cmd-paper-survival-outcome": "survivalOutcomePrediction",
  "cmd-paper-active-learning": "activeLearningAnnotation",
  "cmd-paper-moe-routing": "moeExpertRouting",
  "cmd-paper-longitudinal-followup": "longitudinalFollowupDiagnosis",
  "cmd-paper-weakly-supervised-mil": "weaklySupervisedMil",
  "cmd-paper-knowledge-graph-reasoning": "medicalKnowledgeGraphReasoning",
  "cmd-paper-distillation": "teacherStudentDistillation",
  "cmd-paper-prompt-tuning": "foundationPromptTuning"
};
for (const [commandId, presetId] of Object.entries(expectedPaperPresetCommandTargets)) {
  const commandBlock = app.match(new RegExp(`\\{ id: "${commandId}"[\\s\\S]*?\\}`))?.[0] ?? "";
  if (!commandBlock) {
    violations.push(`app.mjs: missing paper preset command ${commandId}`);
    continue;
  }
  if (!commandBlock.includes(`target: "paperPreset-${presetId}"`) || !commandBlock.includes(`presetId: "${presetId}"`)) {
    violations.push(`app.mjs: paper preset command ${commandId} must target paperPreset-${presetId} with presetId ${presetId}`);
  }
  const presetBlock = app.match(new RegExp(`\\{\\s*id: "${presetId}"[\\s\\S]*?\\}`))?.[0] ?? "";
  if (!presetBlock) violations.push(`app.mjs: paper preset command ${commandId} points to missing preset ${presetId}`);
}
for (const snippet of [
  "button.dataset.commandId = command.id",
  "button.dataset.paperPresetId = command.presetId",
  "button.dataset.commandTarget = command.target"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: command result dataset contract missing: ${snippet}`);
}

const paperService = fs.readFileSync("src/RoughPptAddin/Services/PaperStructurePresetService.cs", "utf8");
const tabTransformerBlock = paperService.match(/private static void BuildTabTransformerRisk[\s\S]*?\r?\n\s*}\r?\n/)?.[0] ?? "";
if (!tabTransformerBlock) {
  violations.push("PaperStructurePresetService.cs: missing BuildTabTransformerRisk");
} else {
  for (const match of tabTransformerBlock.matchAll(/Add(?:Node|Frame|Stack|Text)\(ctx,\s*([0-9.]+)f?,\s*[0-9.]+f?,\s*([0-9.]+)f?,/g)) {
    const right = Number(match[1]) + Number(match[2]);
    if (right > 730) violations.push(`PaperStructurePresetService.cs: tabTransformerRisk element exceeds preset width 730 at right=${right}`);
  }
}

if (/state\.styleTemplates\.slice\(0,\s*12\)/.test(app)) {
  violations.push("app.mjs: style template preview must show all built-in and user templates, not only first 12");
}
for (const snippet of [
  "featureDirectionInput",
  "state.featureBlock.editDirection",
  "state.featureBlock.editDelta"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: feature block directional edit state missing: ${snippet}`);
}
if (!/renderFeatureDirectionGuide|updateFeatureDirectionGuide|featureDirectionGuide/.test(app)) {
  violations.push("app.mjs: feature block direction indication must update a visible guide when controls or mode change");
}
for (const snippet of [
  "function ensureShapeSearchScope(clearWhenNoShapeMatch = false)",
  "shapeQueryHasMatches(queryBefore)",
  "clearShapeQuery(false)",
  "function clearShapeQuery(updateInput = true)"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: search pollution auto-clear hook missing: ${snippet}`);
}
if (!/function toggleShapeDropdown\(\)[\s\S]{0,180}ensureShapeSearchScope\(true\)/.test(app)) {
  violations.push("app.mjs: opening shape gallery must clear command-only search pollution before rendering");
}
if (!/function toggleQuickShapeDropdown\(\)[\s\S]{0,180}ensureShapeSearchScope\(true\)/.test(app)) {
  violations.push("app.mjs: opening quick insert gallery must clear command-only search pollution before rendering");
}
for (const term of ["AI 结构", "多模态", "医学图像报告", "模型框架图", "论文结构图", "神经网络结构图", "医学AI框架", "医学论文图", "怎么画多模态框图", "架构图", "方法流程图", "系统框图", "模型图", "pipeline", "paper pipeline", "网络架构图", "算法流程图", "研究流程图", "实验流程图", "模块图", "工作流", "workflow", "framework", "architecture", "framework diagram", "architecture diagram", "method diagram", "论文流程图", "系统流程图", "论文方法图", "方法结构图", "结构示意图", "框架示意图", "模型示意图", "医学多模态框架", "报告生成框架", "对比学习框架", "注意力机制图", "分类诊断流程", "编码器结构图", "解码器结构图", "联邦学习框架", "多中心联邦", "医学扩散增强", "生存预后模型", "主动学习标注", "MoE专家路由", "纵向随访诊断", "随访诊断框架", "弱监督MIL", "医学知识图谱", "教师学生蒸馏", "提示调优框架", "大模型诊断 RAG", "hint-ai-medical", "hint-model-framework", "hint-paper-structure", "hint-paper-architecture", "hint-paper-pipeline", "hint-paper-algorithm", "hint-paper-network", "hint-paper-flow", "hint-paper-framework", "hint-medical-multimodal-framework", "hint-report-generation-framework", "hint-contrastive-framework", "hint-attention-diagram", "hint-federated-learning", "hint-diffusion-augmentation", "hint-survival-outcome", "hint-active-learning", "hint-moe-routing", "hint-longitudinal-followup", "hint-weakly-supervised-mil", "hint-knowledge-graph", "hint-distillation", "hint-prompt-tuning"]) {
  if (!app.includes(term)) violations.push(`app.mjs: AI paper preset discoverability missing ${term}`);
}
for (const snippet of ["paperPresetDiscoveryKeywords", "...paperPresetDiscoveryKeywords", "paperPresetDiscoveryKeywords.join"]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: paper preset discovery terms must be shared: ${snippet}`);
}
for (const snippet of ["paperPresetMatchScore", "paperPresetSpecificSearchText", "right.score - left.score"]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: paper preset results must be ranked by query relevance: ${snippet}`);
}
for (const snippet of ["paperPresetsMatchingQueryIgnoringCategory", "preferredPaperPresetCard", "resetPaperPresetCategory();"]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: preset keyboard focus must recover from stale category filter: ${snippet}`);
}

const css = fs.readFileSync("src/RoughPptAddin/ui/styles.css", "utf8");
if (!css.includes("grid-template-rows: auto auto auto auto minmax(0, 1fr)")) {
  violations.push("styles.css: catalog panel must reserve explicit rows for gallery, quick insert, categories, and grid");
}
if (!css.includes("-webkit-line-clamp: 2")) {
  violations.push("styles.css: shape names must allow two visible lines before truncation");
}
if (!css.includes(".feature-section") || !css.includes(".feature-section-body")) {
  violations.push("styles.css: feature block controls must share grouped section styling");
}
if (!css.includes(".style-param-jump") || !css.includes(".style-param-jump button[aria-pressed=\"true\"]")) {
  violations.push("styles.css: style param group jump buttons must share grouped navigation styling and active state");
}
if (!css.includes(".paper-preset-grid") || !css.includes(".paper-preset-card") || !css.includes(".paper-preset-mini") || !css.includes(".paper-preset-filter") || !css.includes(".paper-preset-favorite") || !css.includes(".paper-preset-state-labels") || !css.includes("[aria-pressed=\"true\"]")) {
  violations.push("styles.css: paper preset cards must expose dedicated responsive styling");
}
if (!css.includes(".gallery-empty") || !app.includes("清空搜索")) {
  violations.push("styles.css/app.mjs: shape gallery dropdown empty state must be styled and include Chinese clear-search action");
}
for (const selector of [
  '.quick-actions button > span[aria-hidden="true"]',
  '.asset-actions button > span[aria-hidden="true"]',
  '.style-template-bar button > span[aria-hidden="true"]',
  '.feature-actions button > span[aria-hidden="true"]'
]) {
  if (!css.includes(selector)) violations.push(`styles.css: Office-like monochrome task pane icon rule missing: ${selector}`);
}
const statusRule = cssRule(css, ".status");
if (!statusRule) {
  violations.push("styles.css: task pane status style missing");
} else {
  if (/white-space\s*:\s*nowrap/.test(statusRule)) violations.push("styles.css: task pane status long text must not force nowrap");
  if (/text-overflow\s*:\s*ellipsis/.test(statusRule)) violations.push("styles.css: task pane status long text must not be hidden behind ellipsis");
  if (/overflow\s*:\s*hidden/.test(statusRule)) violations.push("styles.css: task pane status long text must not hide overflow");
if (!/(white-space\s*:\s*(normal|pre-wrap|break-spaces)|overflow-wrap\s*:\s*(anywhere|break-word)|word-break\s*:\s*break-word)/.test(statusRule)) {
    violations.push("styles.css: task pane status long text must wrap or break inside the top bar");
  }
}

for (const selector of [".style-template-preview", ".style-quick-strip", ".style-param-jump", ".search-suggestion-list"]) {
  if (!app.includes(selector)) {
    violations.push(`app.mjs: horizontal drag-scroll contract missing selector: ${selector}`);
  }
}
if (!/\.style-template-card\s*\{[^}]*min-width:\s*148px/.test(css)) {
  violations.push("styles.css: style template cards must reserve enough width for readable names and summaries");
}
if (!css.includes(".status:not(.expanded)") || !css.includes(".status:not(.expanded)::-webkit-scrollbar")) {
  violations.push("styles.css: collapsed status scrollbar must be visually hidden without clipping wrapped text");
}
if (!/\.feature-direction|data-feature-direction-guide/.test(css)) {
  violations.push("styles.css: feature block direction indication must have dedicated layout styling");
}

for (const [i, match] of [...app.matchAll(/\.title\s*=\s*(`[^`]*`|"[^"]*"|'[^']*')/g)].entries()) {
  const value = match[1].slice(1, -1);
  if (value && !hasChinese(value) && !value.includes("${")) {
    violations.push(`app.mjs: dynamic title ${i + 1} lacks Chinese text: ${value}`);
  }
}

for (const [i, match] of [...app.matchAll(/setStatus\((`[^`]*`|"[^"]*"|'[^']*')/g)].entries()) {
  const value = match[1].slice(1, -1);
  if (value && !hasChinese(value)) violations.push(`app.mjs: status text ${i + 1} lacks Chinese text: ${value}`);
}

// 状态可读性：空闲、进行中、完成和错误必须是四个可区分的状态色和中文状态名。
for (const snippet of [
  "function isDoneStatusText(text)",
  "function statusToneLabel(isError, busy, done)",
  "const done = !isError && !busy && isDoneStatusText(value)",
  'els.status.classList.toggle("ok", done)',
  '"完成状态"',
  '"进行中状态"'
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: status tone contract missing: ${snippet}`);
}
const doneSource = app.match(/function isDoneStatusText\(text\) \{[\s\S]*?\n\}/)?.[0] ?? "";
if (!doneSource) {
  violations.push("app.mjs: isDoneStatusText source could not be extracted for behaviour check");
} else {
  const isDone = new Function(`${doneSource}; return isDoneStatusText;`)();
  for (const sample of ["已插入 3 个手绘对象。", "已应用风格模板：论文框图", "完成配色替换。", "配色替换成功。"]) {
    if (!isDone(sample)) violations.push(`app.mjs: completed status must use the done tone: ${sample}`);
  }
  for (const sample of ["准备就绪", "", "正在重绘选区...", "读取论文图像库失败：数据库不存在", "已用尺寸超出上限，无法插入", "名称不能为空。"]) {
    if (isDone(sample)) violations.push(`app.mjs: non-completed status must not use the done tone: ${sample || "(空)"}`);
  }
}
const statusToneBlock = css.slice(css.indexOf("/* B542:"));
if (!statusToneBlock.includes(".status.ok {")) {
  violations.push("styles.css: completed status tone .status.ok must be defined after the later status overrides");
}
// 取每个状态色的最后一条生效规则，规则选择器可以是逗号分组。
const statusToneColors = new Map();
for (const [, prelude, body] of css.replace(/\/\*[\s\S]*?\*\//g, "\n").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = prelude.split(",").map(part => part.trim());
  const color = body.match(/(?:^|;|\{)\s*color:\s*([^;]+);/)?.[1]?.trim();
  if (!color) continue;
  for (const tone of ["ok", "busy", "error"]) {
    if (selectors.includes(`.status.${tone}`)) statusToneColors.set(tone, color);
  }
}
for (const tone of ["ok", "busy", "error"]) {
  if (!statusToneColors.has(tone)) violations.push(`styles.css: status tone .status.${tone} must set a text color`);
}
if (new Set(statusToneColors.values()).size !== statusToneColors.size) {
  violations.push(`styles.css: status tones must stay visually distinct: ${[...statusToneColors].map(pair => pair.join("=")).join(", ")}`);
}

// 健壮性：本机存储写入可能抛出（被禁用或写满），必须集中到带 try/catch 的
// persistSetting，否则异常会中断点击处理的后续逻辑（重渲染、postHost 通知等）。
for (const snippet of [
  "function persistSetting(key, value)",
  "persistSetting.reported",
  "界面偏好无法写入本机存储"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: guarded storage write contract missing: ${snippet}`);
}
const persistSource = app.match(/function persistSetting\(key, value\) \{[\s\S]*?\n\}/)?.[0] ?? "";
if (!persistSource) {
  violations.push("app.mjs: persistSetting source could not be extracted");
} else if (!/try\s*\{[\s\S]*localStorage\.setItem\(key, value\)[\s\S]*\}\s*catch/.test(persistSource)) {
  violations.push("app.mjs: persistSetting must wrap localStorage.setItem in try/catch");
}
const directWrites = [...app.matchAll(/localStorage\.setItem\(/g)].length;
if (directWrites !== 1) {
  violations.push(`app.mjs: localStorage.setItem must only appear inside persistSetting, found ${directWrites} occurrences`);
}

// 发现性：搜索空结果时，每个非当前范围都必须能被跨范围救援，并显示匹配数量。
for (const matcher of [
  "crossScopeShapeMatches",
  "crossScopeCommandMatches",
  "crossScopePaperPresetMatches",
  "crossScopeChartMatches",
  "crossScopeAssetMatches"
]) {
  if (!app.includes(`function ${matcher}()`)) violations.push(`app.mjs: cross-scope search rescue missing: ${matcher}`);
  if (!app.includes(`${matcher}()`)) violations.push(`app.mjs: cross-scope search rescue never called: ${matcher}`);
}
for (const [label, variable] of [
  ["形状", "shapeRescue"],
  ["功能", "commandRescue"],
  ["预设", "presetRescue"],
  ["数据", "chartRescue"],
  ["素材", "assetRescue"]
]) {
  if (!app.includes(`在${label}中查找（\${${variable}.length}）`)) {
    violations.push(`app.mjs: search rescue button for ${label} must show the cross-scope match count`);
  }
}
if (!app.includes("const rescueSummary = [")) {
  violations.push("app.mjs: search empty state must summarise which other scopes have results");
}

// 定位准确性：右侧导航高亮必须跟随滚动位置，并把面板 key 解析成实际存在的导航项。
for (const snippet of [
  "const sectionNavPanelAliases = Object.freeze({",
  "zoteroImages: \"paletteLibrary\"",
  "function sectionNavKeyForPanel(panelKey)",
  "const resolved = sectionNavKeyForPanel(key)",
  "function currentScrolledPanelKey(panels, anchor)",
  "function syncSectionNavToScroll()",
  "function scheduleSectionNavScrollSync()",
  'window.addEventListener("scroll", scheduleSectionNavScrollSync, { passive: true })',
  "window.requestAnimationFrame(run)"
]) {
  if (!app.includes(snippet)) violations.push(`app.mjs: section nav scroll tracking missing: ${snippet}`);
}
const aliasBody = app.match(/const sectionNavPanelAliases = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1] ?? "";
const aliasPairs = [...aliasBody.matchAll(/(\w+):\s*"(\w+)"/g)].map(match => [match[1], match[2]]);
if (!aliasPairs.length) violations.push("app.mjs: section nav panel aliases must map at least one panel to its rail entry");
for (const [panelKey, railKey] of aliasPairs) {
  if (!index.includes(`data-collapse-key="${panelKey}"`)) {
    violations.push(`app.mjs: section nav alias source panel does not exist in index.html: ${panelKey}`);
  }
  if (!index.includes(`data-section-nav="${railKey}"`)) {
    violations.push(`app.mjs: section nav alias target rail entry does not exist in index.html: ${railKey}`);
  }
}
// 每个面板都必须能高亮出一个真实存在的导航项，否则滚动到该面板时导航会整体失去高亮。
const railKeys = new Set([...index.matchAll(/data-section-nav="(\w+)"/g)].map(match => match[1]));
const aliasMap = new Map(aliasPairs);
for (const panelKey of new Set([...index.matchAll(/data-collapse-key="(\w+)"/g)].map(match => match[1]))) {
  const resolved = aliasMap.get(panelKey) ?? panelKey;
  if (!railKeys.has(resolved)) {
    violations.push(`app.mjs: panel ${panelKey} resolves to missing rail entry ${resolved}; add a data-section-nav entry or a sectionNavPanelAliases mapping`);
  }
}

const ribbon = fs.readFileSync("src/RoughPptAddin/Ribbon/RoughRibbon.cs", "utf8");
for (const snippet of [
  "openPaperPresetPane",
  "预设窗格",
  "case \"openPaperPresetPane\":",
  "return \"paperPresets\""
]) {
  if (!ribbon.includes(snippet)) violations.push(`RoughRibbon.cs: paper preset pane ribbon entry missing: ${snippet}`);
}
if (!ribbon.includes("ConvertSelectionToRough")) violations.push("RoughRibbon.cs: missing convert selected native shapes command");
if (!ribbon.includes("label='重绘选区'") || !ribbon.includes("screentip='重绘手绘选区'")) {
  violations.push("RoughRibbon.cs: regenerate selected rough command must be labeled 重绘选区");
}
if (!ribbon.includes("GetShapeMenuGalleryItemId") || !/(?:ShapePrefix|"roughShape_")\s*\+\s*index\.ToString\((?:System\.Globalization\.)?CultureInfo\.InvariantCulture\)/.test(ribbon)) {
  violations.push("RoughRibbon.cs: gallery item ids must be unique so the shape dropdown is not blank");
}
for (const [i, match] of [...ribbon.matchAll(/<(button|toggleButton)\b[^>]*>/g)].entries()) {
  const attributes = attrs(match[0]);
  const isQuickShapeButton = /^quickShape_\d+$/.test(attributes.id ?? "");
  if (isQuickShapeButton) {
    if (attributes.getScreentip !== "GetQuickShapeScreentip" || attributes.getSupertip !== "GetQuickShapeSupertip") {
      violations.push(`RoughRibbon.cs: ribbon button ${i + 1} missing dynamic Chinese quick shape tooltip callbacks`);
    }
    continue;
  }
  if (!attributes.label && !attributes.getLabel && !attributes.screentip && !attributes.supertip) continue;
  if (!attributes.screentip || !attributes.supertip) {
    violations.push(`RoughRibbon.cs: ribbon button ${i + 1} missing screentip or supertip`);
  } else {
    if (attributes.label || !attributes.getLabel) {
      requireChinese(attributes.label, `RoughRibbon.cs: ribbon button ${i + 1} label`);
    }
    requireChinese(attributes.screentip, `RoughRibbon.cs: ribbon button ${i + 1} screentip`);
    requireChinese(attributes.supertip, `RoughRibbon.cs: ribbon button ${i + 1} supertip`);
  }
}
for (const snippet of [
  "GetQuickShapeScreentip",
  "快速插入：",
  "GetQuickShapeSupertip",
  "GetQuickShapeDisplayName",
  "FindShapeLabel(enumName)"
]) {
  if (!ribbon.includes(snippet)) violations.push(`RoughRibbon.cs: dynamic quick shape tooltip missing ${snippet}`);
}
for (const snippet of [
  "public object GetFunctionalImage(IRibbonControl control)",
  "FunctionalIconFactory.Create(control?.Id, 32, 32)",
  "private static class FunctionalIconFactory",
  "private static class MaterialSymbolIconFactory",
  "MaterialSymbolIconFactory.Create",
  "RibbonRenderScale = 2"
]) {
  if (!ribbon.includes(snippet)) violations.push(`RoughRibbon.cs: local functional Ribbon icon contract missing ${snippet}`);
}
for (const id of ["paperStructurePresetMenu", "openShapesPane", "saveFeatureDefault", "compactCommonMenu", "compactSelectionMenu", "featureDirectionMenu"]) {
  const pattern = new RegExp(`id='${id}'[^>]*getImage='GetFunctionalImage'`);
  if (!pattern.test(ribbon)) violations.push(`RoughRibbon.cs: functional Ribbon command ${id} must use local GetFunctionalImage`);
}
for (const match of ribbon.matchAll(/<(button|menu|dynamicMenu)\b[^>]*\bid='([^']+)'[^>]*\bimageMso='([^']+)'/g)) {
  const [, tag, id, imageMso] = match;
  violations.push(`RoughRibbon.cs: ${tag} ${id} still uses PPT built-in imageMso ${imageMso}; Ribbon icons must be local`);
}

const controller = fs.readFileSync("src/RoughPptAddin/Services/RoughAddInController.cs", "utf8");
if (!controller.includes("TryGetSelection(out var selection, out var reason)")) {
  violations.push("RoughAddInController.cs: selection state must use a safe no-selection path");
}
if (!controller.includes("catch (COMException)")) {
  violations.push("RoughAddInController.cs: empty PowerPoint selection COMException must not break task pane loading");
}
if (!/AddInLogger\.Error\("读取选区状态失败。",\s*\w+\)/.test(taskPane)) {
  violations.push("RoughTaskPaneControl.cs: SendSelectionState must not fail pane initialization");
}
if (!/AddInLogger\.Error\("读取素材库失败。",\s*\w+\)/.test(taskPane)) {
  violations.push("RoughTaskPaneControl.cs: SendUserAssets must not fail pane initialization");
}
if (!/PostStatus\("素材库读取失败，已跳过异常素材。",\s*(?:isError:\s*)?true\)/.test(taskPane)) {
  violations.push("RoughTaskPaneControl.cs: asset library failure must be surfaced in Chinese status text");
}
if (!controller.includes("RefreshUserAssetsFromRibbon") ||
    !controller.includes("InvalidateActiveRecentAssets") ||
    !controller.includes("RefreshUserAssetsFromHost") ||
    !taskPane.includes("RefreshUserAssetsFromHostAsync") ||
    !taskPane.includes('["type"] = "focusSection"') ||
    !taskPane.includes('["section"] = "library"')) {
  violations.push("Ribbon one-click asset refresh must update recent assets and the task pane asset list with Chinese status");
}
if (!taskPane.includes("return null;") || !taskPane.includes("File.ReadAllBytes(thumbnailPath)")) {
  violations.push("RoughTaskPaneControl.cs: thumbnail read failures must be isolated");
}
for (const [command, action] of [
  ["saveSelectionAsAsset", "保存素材"],
  ["insertUserAsset", "插入素材"],
  ["deleteUserAsset", "删除素材"],
  ["exportUserAssets", "分享素材包"],
  ["importUserAssets", "导入素材包"]
]) {
  const caseMatch = new RegExp(`case\\s+"${command}"\\s*:`).exec(taskPane);
  const commandIndex = caseMatch?.index ?? taskPane.indexOf(`type == "${command}"`);
  const failureMatch = new RegExp(`PostCommandFailure\\("${action}",\\s*\\w+\\)`).exec(taskPane.slice(Math.max(0, commandIndex)));
  const failureIndex = failureMatch ? commandIndex + failureMatch.index : -1;
  if (commandIndex < 0 || failureIndex < commandIndex) {
    violations.push(`RoughTaskPaneControl.cs: ${command} must isolate failures with Chinese status`);
  }
}
if (!/PostStatus\("已取消分享素材包。",\s*(?:isError:\s*)?false\)/.test(taskPane)) {
  violations.push("RoughTaskPaneControl.cs: share package cancel must show Chinese non-error status");
}
if (!taskPane.includes("ReadStringList(message, \"assetIds\")")) {
  violations.push("RoughTaskPaneControl.cs: share package must read selected asset ids");
}
if (!/PostStatus\("已取消导入素材包。",\s*(?:isError:\s*)?false\)/.test(taskPane) &&
    !(taskPane.includes("DescribeUserAssetImport(imported)") && controller.includes('return "已取消导入素材包。"'))) {
  violations.push("RoughTaskPaneControl.cs: import cancel must show Chinese non-error status");
}
if (!taskPane.includes("AddInLogger.Error(action + \"失败。\", ex)")) {
  violations.push("RoughTaskPaneControl.cs: command failures must be logged with localized action");
}

const catalog = JSON.parse(fs.readFileSync("assets/autoshapes/mso-autoshape-catalog.json", "utf8"));
for (const item of catalog.items ?? []) {
  if (!hasChinese(item.displayNameZh)) {
    violations.push(`catalog: ${item.enumName} missing Chinese displayNameZh`);
  } else if (!firstVisibleHasChinese(item.displayNameZh)) {
    violations.push(`catalog: ${item.enumName} displayNameZh is not Chinese-first: ${item.displayNameZh}`);
  }
}

const architecture = fs.readFileSync("docs/ARCHITECTURE.md", "utf8");
if (!architecture.includes("All user-visible pages and dialogs are Chinese-first")) {
  violations.push("docs/ARCHITECTURE.md: missing global UI Chinese-first contract");
}

if (violations.length) {
  throw new Error(`UI contract validation failed:\n${violations.join("\n")}`);
}

console.log("ui contract ok");
