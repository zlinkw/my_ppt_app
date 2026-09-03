import fs from "node:fs";
import path from "node:path";
import {
  startStaticServer,
  launchBrowser,
  connectToBrowser,
  evaluate,
  waitFor,
  waitForExit
} from "./lib/ui-browser.mjs";

const root = process.cwd();
const uiRoot = path.join(root, "src", "RoughPptAddin", "ui");
const keywords = ["重绘", "转换", "填充", "模板", "箭头", "素材", "特征块", "导入", "分享", "保存", "检查"];
const widths = [320, 420, 720, 1000];
const violations = [];

const controllerSrc = fs.readFileSync(path.join(root, "src", "RoughPptAddin", "Services", "RoughAddInController.cs"), "utf8");
const ribbonSrc = fs.readFileSync(path.join(root, "src", "RoughPptAddin", "Ribbon", "RoughRibbon.cs"), "utf8");
for (const s of ["RecreateTaskPane", "IsTaskPaneDead", "taskPaneControl.IsDisposed", "taskPanes.Remove", "NotifyUiOrFallback", "TryGetSelection(out Selection selection"]) {
  if (!controllerSrc.includes(s)) violations.push(`任务窗格重建语义缺失: ${s}`);
}
if (!ribbonSrc.includes("NotifyRibbonStatus")) violations.push("Ribbon回调缺少NotifyRibbonStatus兜底");
const server = await startStaticServer(uiRoot);
const browser = await launchBrowser("taskpane-ui-browser");
const client = await connectToBrowser(browser.port);

try {
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/index.html` });
  await waitFor(client,
    "document.readyState === 'complete' && window.roughPptTaskPaneReady === true && " +
    "Boolean(document.querySelector('#search')) && " +
    "document.querySelectorAll('#chartPresetStrip .chart-preset-card').length >= 3 && " +
    "document.querySelector('#chartPresetStrip')?.dataset.dragScrollReady === 'true'");

  for (const width of widths) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width <= 420
    });
    await waitFor(client, "document.body && document.querySelector('.shell')");
    const layout = await evaluate(client, layoutProbe());
    if (layout.hasHorizontalOverflow) violations.push(`${width}px: 页面存在横向滚动`);
    if (layout.offscreen.length) violations.push(`${width}px: 可见元素超出视口 ${layout.offscreen.slice(0, 5).join(", ")}`);
    if (layout.zeroButtons.length) violations.push(`${width}px: 可见按钮尺寸异常 ${layout.zeroButtons.slice(0, 5).join(", ")}`);
  }

  for (const width of widths) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width <= 420
    });
    const readable = await evaluate(client, horizontalControlProbe());
    if (!readable.chartScrollable) violations.push(`${width}px: 科研图预设轨道未保留可读宽度或横向滚动`);
    if (!readable.dragReady) violations.push(`${width}px: 横向轨道未启用鼠标拖动滚动`);
    if (!readable.cardsReadable) violations.push(`${width}px: 科研图预设卡片文字被裁切或压缩`);
    if (!readable.suggestionsScrollable) violations.push(`${width}px: 常用搜索建议未保留横向滚动`);
    if (!readable.suggestionDragReady) violations.push(`${width}px: 常用搜索建议未启用鼠标拖动滚动`);
    if (width >= 720) {
      const wideControls = await evaluate(client, wideControlProbe());
      if (wideControls.foldedMax > 340 || wideControls.galleryWidth > 520 || wideControls.quickToolMax > 320 || wideControls.buildInfoWidth > 240) {
        violations.push(`${width}px: 宽窗折叠控件或图库入口异常拉伸 ${JSON.stringify(wideControls)}`);
      }
    }
    const simpleModeActions = await evaluate(client, simpleModeActionsProbe());
    if (!simpleModeActions.bounded || simpleModeActions.count < 4) violations.push(`${width}px: 完整模式操作区异常拉伸 ${JSON.stringify(simpleModeActions)}`);
    if (!simpleModeActions.horizontalText) violations.push(`${width}px: 完整模式按钮文字未保持横排 ${JSON.stringify(simpleModeActions)}`);
    const modeSwitch = await evaluate(client, fullModePinnedProbe());
    if (!modeSwitch.fullMode || !modeSwitch.noModeSwitch || !modeSwitch.hasFullNote) {
      violations.push(`${width}px: 任务窗格未固定完整模式 ${JSON.stringify(modeSwitch)}`);
    }
    const workflowDensity = await evaluate(client, simpleWorkflowDensityProbe());
    if (!workflowDensity.twoColumns || !workflowDensity.compact || !workflowDensity.notOversized || !workflowDensity.wideEnough || !workflowDensity.readable || !workflowDensity.bounded) {
      violations.push(`${width}px: 完整模式工作台按钮密度异常 ${JSON.stringify(workflowDensity)}`);
    }
    if (width >= 720) {
      const centered = await evaluate(client, simpleCenteredProbe());
      if (!centered.fullMode || centered.width <= 0) violations.push(`${width}px: 宽窗完整模式内容列异常 ${JSON.stringify(centered)}`);
    }
    if (width <= 420) {
      const topbarFlow = await evaluate(client, narrowTopbarFlowProbe());
      if (!topbarFlow.statusFullRow || !topbarFlow.noteAboveStatus || topbarFlow.horizontalOverlap) {
        violations.push(`${width}px: 窄窗顶栏长状态与模式说明布局异常 ${JSON.stringify(topbarFlow)}`);
      }
    }
    const curve = await evaluate(client, chartCurvePreviewProbe());
    if (!curve.continuous || !curve.inBounds) violations.push(`${width}px: 科研图曲线预览断裂或越界 ${JSON.stringify(curve)}`);
  }

  for (const keyword of keywords) {
    const result = await evaluate(client, commandProbe(keyword));
    if (!result.visible) violations.push(`搜索 ${keyword}: 未显示功能命令结果`);
    if (!result.hasChineseCommand) violations.push(`搜索 ${keyword}: 功能命令缺少中文结果`);
    if (!result.targetFocused) violations.push(`搜索 ${keyword}: 点击功能命令后未定位或聚焦目标区`);
    if (result.executedRiskyAction) violations.push(`搜索 ${keyword}: 点击搜索结果不应直接执行删除、分享、导入等动作`);
  }

  const menu = await evaluate(client, contextMenuProbe());
  if (!menu.menuVisible) violations.push("Shift+F10: 未打开快速插入管理菜单");
  if (!menu.focusedMenuItem) violations.push("Shift+F10: 菜单打开后未聚焦第一项");
  if (!menu.hasMenuItemRole) violations.push("Shift+F10: 菜单项缺少 menuitem 角色");

  const dropdown = await evaluate(client, dropdownSearchProbe());
  if (!dropdown.filtered) violations.push("形状图库下拉框未按搜索词过滤");

  // 假控件合同：排序只影响形状列表，其他搜索范围必须禁用并说明原因。
  const sortAvailability = await evaluate(client, scopeSortAvailabilityProbe());
  if (sortAvailability.missing) {
    violations.push("排序控件缺失，无法验证按范围启用状态");
  } else {
    const shapeScopes = new Set(["all", "shape"]);
    for (const row of sortAvailability.rows) {
      const shouldBeEnabled = shapeScopes.has(row.scope);
      if (shouldBeEnabled && row.disabled) {
        violations.push(`搜索范围 ${row.scope}: 排序应可用但被禁用 ${JSON.stringify(row)}`);
      }
      if (!shouldBeEnabled && !row.disabled) {
        violations.push(`搜索范围 ${row.scope}: 排序对该范围无效，必须禁用而不是留成假控件 ${JSON.stringify(row)}`);
      }
      if (!shouldBeEnabled && row.ariaDisabled !== "true") {
        violations.push(`搜索范围 ${row.scope}: 禁用的排序控件缺少 aria-disabled=true`);
      }
      if (!row.titleChinese) violations.push(`搜索范围 ${row.scope}: 排序控件悬浮说明缺少中文`);
      if (!row.titleExplains) {
        violations.push(`搜索范围 ${row.scope}: 排序被禁用时必须说明原因 ${JSON.stringify(row)}`);
      }
    }
    if (sortAvailability.rows.length !== 6) {
      violations.push(`排序可用性检查只覆盖了 ${sortAvailability.rows.length} 个搜索范围，应为 6 个`);
    }
  }

  const guideSessionFailure = await evaluate(client, guideSessionFailureProbe());
  if (!guideSessionFailure.guideLinkAbsent || !guideSessionFailure.fullNote) {
    violations.push(`完整模式顶栏仍保留旧使用说明入口 ${JSON.stringify(guideSessionFailure)}`);
  }

  // 该检查会展开全部面板并追加占位元素，必须放在其他交互检查之后。
  const sticky = await evaluate(client, stickyChromeMetricProbe());
  if (!sticky.metricFollowsHeight) {
    violations.push(`状态条展开后粘性顶栏度量未跟随实际高度 ${JSON.stringify(sticky)}`);
  }
  if (sticky.panelHeadOccluded) {
    violations.push(`状态条展开后定位面板被粘性顶栏遮挡 ${sticky.occludedPx}px ${JSON.stringify(sticky)}`);
  }
} finally {
  await client.close().catch(() => {});
  browser.process.kill();
  await waitForExit(browser.process).catch(() => {});
  await server.close();
}

if (violations.length) {
  throw new Error(`task pane UI interaction validation failed:\n${violations.join("\n")}`);
}

console.log("task pane UI interactions ok");

function layoutProbe() {
  return `(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const offscreen = [];
    const zeroButtons = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      const scrollContainer = element.closest('.horizontal-drag-scroll');
      if (!scrollContainer && (rect.left < -2 || rect.right > innerWidth + 2)) offscreen.push(element.id || element.className || element.tagName);
      if (element.tagName === 'BUTTON' && (rect.width < 18 || rect.height < 18)) zeroButtons.push(element.id || element.textContent.trim());
    }
    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
      offscreen,
      zeroButtons
    };
  })()`;
}

function commandProbe(keyword) {
  return `(async () => {
    const risky = [];
    window.chrome = { webview: { postMessage: message => risky.push(message?.type) } };
    const input = document.querySelector('#search');
    document.querySelector('[data-search-scope="command"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 40));
    input.value = ${JSON.stringify(keyword)};
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(keyword)} }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const panel = document.querySelector('#commandResults');
    const button = panel?.querySelector('.command-result');
    const visible = Boolean(panel && !panel.hidden && button);
    if (button) button.click();
    await new Promise(resolve => setTimeout(resolve, 360));
    return {
      visible,
      hasChineseCommand: Boolean(button && /[\\u3400-\\u9fff]/.test(button.textContent)),
      targetFocused: Boolean(document.activeElement && document.activeElement !== input),
      executedRiskyAction: risky.some(type => ['deleteUserAsset', 'exportUserAssets', 'importUserAssets', 'saveSelectionAsAsset', 'insertShape', 'insertFeatureBlock'].includes(type))
    };
  })()`;
}

function contextMenuProbe() {
  return `(() => {
    document.querySelector('#uiModeFull')?.click();
    const add = document.querySelector('#quickAddToggle');
    add.click();
    const button = document.querySelector('#quickShapeDropdown .gallery-shape');
    if (!button) return { menuVisible: false, focusedMenuItem: false, hasMenuItemRole: false };
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    const menu = document.querySelector('#quickShapeContextMenu');
    const item = menu?.querySelector('button');
    return {
      menuVisible: Boolean(menu && !menu.hidden),
      focusedMenuItem: document.activeElement === item,
      hasMenuItemRole: item?.getAttribute('role') === 'menuitem'
    };
  })()`;
}

function dropdownSearchProbe() {
  return `(() => {
    const input = document.querySelector('#search');
    input.value = '矩形';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '矩形' }));
    const toggle = document.querySelector('#galleryToggle');
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    const buttons = [...document.querySelectorAll('#shapeDropdown .gallery-shape')];
    return {
      filtered: buttons.length > 0 && buttons.length < 60
    };
  })()`;
}

function horizontalControlProbe() {
  return `(() => {
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const rect = element => element?.getBoundingClientRect();
    const setFullMode = () => document.querySelector('#uiModeFull')?.click();
    setFullMode();
    const chartShell = document.querySelector('#chartPresetShell');
    if (chartShell) chartShell.open = true;
    const chart = document.querySelector('#chartPresetStrip');
    const cards = [...(chart?.querySelectorAll('.chart-preset-card') ?? [])].filter(visible);
    const chartScrollable = Boolean(visible(chart) && cards.length >= 3 && cards.every(card => rect(card).width >= 167) && chart.scrollWidth > chart.clientWidth + 1);
    const dragReady = Boolean(
      chart?.classList.contains('horizontal-drag-scroll') && chart?.dataset.dragScrollReady === 'true'
    );
    const suggestions = document.querySelector('.search-suggestion-list');
    const suggestionButtons = [...(suggestions?.querySelectorAll('.search-suggestion') ?? [])].filter(visible);
    const suggestionsScrollable = Boolean(visible(suggestions) && suggestionButtons.length >= 3 && suggestions.scrollWidth > suggestions.clientWidth + 1);
    const suggestionDragReady = Boolean(
      suggestions?.classList.contains('horizontal-drag-scroll') && suggestions?.dataset.dragScrollReady === 'true'
    );
    const cardsReadable = cards.length >= 3 && cards.every(card => {
      const title = card.querySelector('strong');
      const summary = card.querySelector('small');
      return card.scrollWidth <= card.clientWidth + 1 && card.scrollHeight <= card.clientHeight + 1 &&
        (!title || (title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1)) &&
        (!summary || (summary.scrollWidth <= summary.clientWidth + 1 && summary.scrollHeight <= summary.clientHeight + 1));
    });
    return { chartScrollable, dragReady, cardsReadable, suggestionsScrollable, suggestionDragReady };
  })()`;
}

function wideControlProbe() {
  return `(() => {
    document.querySelector('#uiModeFull')?.click();
    const folded = [...document.querySelectorAll('.workflow-more-actions button, .workflow-quickfind-actions button')]
      .filter(button => getComputedStyle(button).display !== 'none')
      .map(button => button.getBoundingClientRect().width);
    const gallery = document.querySelector('.gallery-toggle')?.getBoundingClientRect().width ?? 0;
    const quickTools = [...document.querySelectorAll('.quick-shape-tools button')]
      .filter(button => getComputedStyle(button).display !== 'none')
      .map(button => button.getBoundingClientRect().width);
    const buildInfo = document.querySelector('.topbar .build-info')?.getBoundingClientRect().width ?? 0;
    return {
      foldedMax: Math.max(0, ...folded),
      galleryWidth: Math.round(gallery),
      quickToolMax: Math.max(0, ...quickTools),
      buildInfoWidth: Math.round(buildInfo)
    };
  })()`;
}

function simpleModeActionsProbe() {
  return `(() => {
    const actions = document.querySelector('.workflow-actions');
    const buttons = [...document.querySelectorAll('.workflow-actions button')].filter(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    const rect = actions?.getBoundingClientRect();
    return {
      bounded: Boolean(rect && rect.width <= innerWidth + 1 &&
        !document.querySelector('#simpleConnectionZlk, #simpleConnectionZotero, .simple-connection-chip')),
      count: buttons.length,
      height: Math.round(rect?.height ?? 0),
      horizontalText: buttons.every(button => {
        const label = button.querySelector('span:last-child') || button;
        return getComputedStyle(label)?.writingMode === 'horizontal-tb';
      }),
      buttonWidth: 0
    };
  })()`;
}

function fullModePinnedProbe() {
  return `(() => {
    return {
      fullMode: document.body.classList.contains('ux-full') && !document.body.classList.contains('ux-simple'),
      noModeSwitch: !document.querySelector('#uiModeSimple') && !document.querySelector('#uiModeFull') && !document.querySelector('#simpleModeFullSwitch'),
      hasFullNote: Boolean(document.querySelector('.topbar-mode-note'))
    };
  })()`;
}

function simpleCenteredProbe() {
  return `(() => {
    const rect = document.querySelector('.app-content')?.getBoundingClientRect();
    const width = Math.round(rect?.width ?? 0);
    return {
      width,
      fullMode: document.body.classList.contains('ux-full')
    };
  })()`;
}

function simpleWorkflowDensityProbe() {
  return `(() => {
    const buttons = [...document.querySelectorAll('.workflow-actions button, #simpleModeActions button')].filter(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    const rects = buttons.map(button => button.getBoundingClientRect());
    const columns = new Set(rects.map(rect => Math.round(rect.left))).size;
    return {
      count: buttons.length,
      columns,
      twoColumns: buttons.length >= 4 && columns >= 2,
      compact: rects.every(rect => rect.height <= 64),
      notOversized: rects.every(rect => rect.width <= 560),
      wideEnough: rects.every(rect => rect.width >= 120),
      readable: buttons.every(button => button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1),
      bounded: rects.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1)
    };
  })()`;
}

function chartCurvePreviewProbe() {
  return `(() => {
    const shell = document.querySelector('#chartPresetShell');
    if (shell) shell.open = true;
    const sensitivity = [...document.querySelectorAll('#chartPresetStrip .chart-preset-card')]
      .find(card => card.querySelector('strong')?.textContent.trim() === '敏感性曲线');
    sensitivity?.click();
    const svg = document.querySelector('#chartPresetPreview .chart-mini-curve');
    const line = svg?.querySelector('.chart-mini-curve-line');
    const circles = [...(svg?.querySelectorAll('.chart-mini-curve-dot') ?? [])];
    const coordinates = (line?.getAttribute('points') ?? '').trim().split(/\\s+/).filter(Boolean).map(pair => pair.split(',').map(Number));
    return {
      continuous: Boolean(svg && line && coordinates.length >= 2 && coordinates.length === circles.length),
      inBounds: coordinates.length > 0 && coordinates.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 60),
      pointCount: coordinates.length,
      dotCount: circles.length
    };
  })()`;
}

function narrowTopbarFlowProbe() {
  return `(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
    const brand = rect('.topbar .brand');
    const note = rect('.topbar .topbar-mode-note');
    const status = rect('.topbar .status');
    const bar = document.querySelector('.topbar')?.getBoundingClientRect();
    const isHidden = sel => { const n = document.querySelector(sel); return !n || n.hidden || getComputedStyle(n).display === 'none'; };
    const collapsed = Boolean(bar && bar.height <= 1 && isHidden('.topbar .brand') && isHidden('.topbar .topbar-mode-note') && isHidden('.topbar .status'));
    if (collapsed) return { brandTop: 0, noteBottom: 0, statusTop: 0, statusBottom: 0, statusWidthRatio: 1, statusFullRow: true, noteAboveStatus: true, horizontalOverlap: false, collapsed: true };
    return {
      brandTop: Math.round(brand?.top ?? -1),
      noteBottom: Math.round(note?.bottom ?? -1),
      statusTop: Math.round(status?.top ?? -1),
      statusBottom: Math.round(status?.bottom ?? -1),
      statusWidthRatio: status ? Number((status.width / innerWidth).toFixed(3)) : 0,
      statusFullRow: Boolean(status && status.width >= innerWidth * 0.85),
      noteAboveStatus: Boolean(note && status && note.bottom <= status.top + 1),
      horizontalOverlap: Boolean(note && status && note.bottom > status.top + 1 && note.left < status.right - 1 && status.top < note.bottom - 1 && status.left < note.right - 1)
    };
  })()`;
}

function stickyChromeMetricProbe() {
  return `(() => {
    const de = document.documentElement;
    const status = document.querySelector('#status');
    const topbar = document.querySelector('.topbar');
    if (!status || !topbar) return { metricFollowsHeight: false, reason: 'missing topbar or status' };
    const readVar = name => parseFloat(getComputedStyle(de).getPropertyValue(name)) || 0;
    const nextFrames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));

    status.classList.remove('error', 'expanded', 'long', 'busy');
    status.textContent = '准备就绪';

    return (async () => {
      await nextFrames();
      const idleBar = Math.round(topbar.getBoundingClientRect().height);
      const idleVar = readVar('--sticky-topbar-height');

      status.classList.add('error', 'long', 'expanded');
      status.textContent = '读取论文图像库失败：固定数据库路径不存在，请先在 Zotero 中确认共享图库已初始化，然后重新打开任务窗格重试。';
      for (const panel of document.querySelectorAll('.panel.collapsed, .catalog-panel.collapsed')) panel.classList.remove('collapsed');
      const filler = document.createElement('div');
      filler.style.height = '1600px';
      document.querySelector('.app-content')?.append(filler);

      await nextFrames();
      await nextFrames();
      const expandedBar = Math.round(topbar.getBoundingClientRect().height);
      const expandedVar = readVar('--sticky-topbar-height');
      const expandedMargin = readVar('--panel-scroll-margin');

      const panel = document.querySelector('[data-collapse-key="charts"]');
      panel?.scrollIntoView({ block: 'start' });
      await nextFrames();
      const barBottom = topbar.getBoundingClientRect().bottom;
      const panelTop = panel ? panel.getBoundingClientRect().top : 0;

      return {
        idleBar,
        idleVar,
        expandedBar,
        expandedVar,
        expandedMargin,
        grew: expandedBar > idleBar,
        metricFollowsHeight: expandedBar <= idleBar || (Math.abs(expandedVar - expandedBar) <= 2 && expandedMargin >= expandedBar),
        occludedPx: Math.round(barBottom - panelTop),
        panelHeadOccluded: Boolean(panel) && barBottom - panelTop > 1
      };
    })();
  })()`;
}

function scopeSortAvailabilityProbe() {
  return `(() => {
    const sort = document.querySelector('#sortMode');
    const scopeButton = scope => document.querySelector('[data-search-scope="' + scope + '"]');
    if (!sort) return { missing: true, rows: [] };
    const hasChinese = text => /[\u3400-\u9fff]/.test(text || '');
    const rows = [];
    const order = ['all', 'shape', 'command', 'preset', 'chart', 'asset'];
    const step = index => {
      if (index >= order.length) return Promise.resolve();
      const scope = order[index];
      scopeButton(scope)?.click();
      return new Promise(next => setTimeout(() => {
        rows.push({
          scope,
          disabled: sort.disabled,
          ariaDisabled: sort.getAttribute('aria-disabled'),
          title: sort.title,
          titleChinese: hasChinese(sort.title),
          titleExplains: !sort.disabled || /排序只影响形状列表|不适用/.test(sort.title + ' ' + (sort.getAttribute('aria-label') || ''))
        });
        next();
      }, 260)).then(() => step(index + 1));
    };
    return step(0).then(() => {
      scopeButton('all')?.click();
      return { missing: false, rows };
    });
  })()`;
}

function guideSessionFailureProbe() {
  return `(() => {
    return {
      guideLinkAbsent: !document.querySelector('#usageGuide'),
      noCheckUpdates: !document.querySelector('#checkUpdates'),
      noBuildInfo: !document.querySelector('#buildInfo'),
      fullNote: Boolean(document.querySelector('.topbar-mode-note'))
    };
  })()`;
}
