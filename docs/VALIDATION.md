# Validation

## Required Checks

- Inserted visible objects are PowerPoint Freeforms or Groups.
- Rough and ZLK inserted visible objects are not `msoPicture`.
- No PNG, Canvas capture, or SVG is used as final Rough or ZLK slide content.
- Research SVG insertion is isolated to `ResearchChartStudioService`, uses a 4 MB UTF-8 limit, rejects active or external content, and rechecks SHA256 before insertion; the local preview uses the exact staged `view.toSVG()` string.
- The insert window lists all known `MsoAutoShapeType` catalog entries.
- The Ribbon shape dropdown loads the packaged AutoShape catalog, shows every insertable PPT shape, and returns unique dynamic item IDs so PowerPoint does not render a blank menu.
- Opening the task pane with no selected shape reports an empty selection state instead of failing initialization.
- Corrupt or locked user asset thumbnails do not block task pane initialization.
- Asset save, insert, import, and export command failures are isolated and surfaced as Chinese status text without breaking the task pane message loop.
- Resize regenerates rough geometry instead of stretching old geometry.
- Rough generation handles 20 continuous resize regenerations under the realtime threshold.
- Batch resize and batch style refresh regenerate every selected Rough group instead of only the last queued shape.
- All user-visible task pane pages, Ribbon commands, dialogs, statuses, and installer-facing names are Chinese-first.
- The standalone UI windows have no horizontal overflow, offscreen visible elements, unclickable buttons, or clipped control text at their host-defined minimum and default sizes, and every visible control carries a Chinese hover tooltip. Covered windows: the research chart studio at 720x560 and 1180x820, and the Ribbon shape gallery at 420x320 and 700x620.
- Every `.ps1` script containing Chinese text is saved as UTF-8 with a BOM. Windows PowerShell 5.1 decodes BOM-less files using the system ANSI codepage, which garbles Chinese output and can swallow a closing quote and break parsing.
- Every custom control, non-native PowerPoint command, ambiguous title, badge, chip, status, or action has a hover `title` tooltip or Office Ribbon `screentip`/`supertip`.
- End-user ZIP/MSI/EXE installers call the shared runtime installer path and never install Visual Studio Build Tools.
- End-user ZIP/MSI/EXE installers support overwrite installation for updating an already installed build.
- ZLK 集群自动绘图服务只监听 `127.0.0.1`，发现文件为 `%LOCALAPPDATA%\RoughPptAddin\automation.json`，令牌文件为 `%LOCALAPPDATA%\RoughPptAddin\automation.token`，所有请求必须带 `X-Rough-Ppt-Token`。
- ZLK 自动绘图必须复用 `zlk-cluster-result-importer.mjs` 归一化数据，并通过 `insertZlkChart` host message 插入 PPT 原生可编辑图表对象。
- ZLK 自动绘图源文件读取必须有数量、单文件大小和总字节上限，目录与通配符扫描必须使用惰性枚举，超限时返回中文错误。
- ZLK 自动绘图同一时刻只能执行一个 PPT 绘图请求；并发请求必须快速返回中文 `409` 忙碌错误，不能排队阻塞 PowerPoint UI。
- 外部插件兼容必须由 `validate-external-plugin-compat.mjs` 持续核对；本地存在 `zlk-cluster-orchestrator` 或 `my_img_manager` 时验证冻结协议，外部仓缺失时只跳过外部核对。
- Metadata exists on each Rough group:
  - `PPT_ROUGH_ASSET_ID`
  - `PPT_ROUGH_GROUP_ID`
  - `PPT_ROUGH_SOURCE_MSO_TYPE`
  - `PPT_ROUGH_PARAMS`
  - `PPT_ROUGH_BOUNDS`
  - `PPT_ROUGH_ENGINE_VERSION`

## Manual PowerPoint Smoke Test

1. Start PowerPoint.
2. Open `Rough Diagram`.
3. Open the insert pane.
4. Search for `diamond`.
5. Insert the shape.
6. Resize it.
7. Confirm rough strokes regenerate after resize.
8. Run object inspection.

## Load Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-powerpoint-load.ps1
```

The script opens PowerPoint and reports matching `COMAddIns` entries.

## Native Insert Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-insert.ps1
```

The script creates a temporary PowerPoint presentation, inserts a Rough native `Group` through `PptFreeformWriter`, verifies metadata tags, and rejects `msoPicture`.

## Full Native Smoke Suite

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-all.ps1
```

The script runs the native insert, resize, operation, adjustment, fill semantics, style sync, format preservation, selected shape conversion, user asset library, user asset package, and catalog batch checks. Use `-SkipSlow` during inner-loop iteration to skip only the full catalog batch.

## Rough Realtime Generation Smoke Test

```powershell
npm test
```

The `validate-rough-realtime.mjs` check regenerates representative Rough.js shapes across 20 resize steps, verifies output changes with the new bounds, and enforces a 200 ms p95 generation threshold.
The `validate-ui-contract.mjs` check enforces Chinese-first visible UI copy, static and dynamic hover tooltips, Ribbon screentips, and Chinese-first catalog display names.
The `validate-installer-runtime-prereqs.mjs` check enforces that portable, MSI, and EXE installers only install WebView2 Runtime and VSTO Runtime for end users. Build Tools remain development and packaging prerequisites only.
The `validate-external-plugin-compat.mjs` check compares the PPT add-in against local ZLK cluster and Zotero image saver contracts when those repos are present, and also enforces ZLK source-file resource guards.
The `validate-research-chart-studio.mjs` check enforces offline Papa Parse and Vega resources, 28 local chart types including violin, ECDF, forest, ROC, precision-recall, calibration, Bland–Altman, volcano, funnel, Kaplan–Meier survival, and cumulative-hazard plots, data filtering, configuration persistence without raw data, same-content SVG preview and download, direct SVG rendering, same-content staging and insertion, the PowerPoint version guard, and the retained native ZLK entry. It also rejects any browser launch from the task-pane quick entry; the four-site HTTPS whitelist remains available only through explicit buttons inside the workbench.

## Research SVG Manual Smoke Test

1. Open the research chart entry and confirm only the modeless local workbench opens; no browser tab or window may open automatically.
2. Paste or import CSV/TSV, exercise all five filter modes, switch all 28 chart types, and verify field mappings, facets, axis controls, annotations, error bands, and style controls update the SVG preview without page navigation. For violin plots use a categorical X field and numeric Y field; for ECDF use at least one numeric axis; for forest plots select numeric effect, lower-bound, and upper-bound fields. For ROC, precision-recall, and calibration curves, use 0-to-1 numeric X/Y fields and compare grouped series when a color field is selected. For Bland–Altman use two numeric measurements; for volcano use effect and P value; for funnel use effect and standard error. For survival and cumulative hazard use nonnegative time plus a valid event-status field, then verify grouped risk sets and censor marks.
3. Confirm the preview uses SIMPLEEXPERIMENT colors by default, then compare colors, axes, labels, aspect ratio, and spacing after insertion into the current slide.
4. Change a setting immediately before insertion and confirm the insert button remains disabled until the matching staged SVG is accepted by the host.
5. Save a configuration, change the current controls, restore it, and confirm valid fields and styles return without persisting the CSV/TSV data. Download SVG and confirm it matches the current preview source.
6. Expand external tools and explicitly open one site; confirm only the clicked whitelist site opens. Import an exported SVG and compare its preview with the inserted result.
7. Confirm a file over 4 MB, a scripted SVG, an SVG with an external URL, and a modified cached file are rejected with Chinese errors.
8. On PowerPoint 2013, confirm the SVG action reports the version requirement and the native JSON/CSV research chart path remains available.

## Native Resize Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-resize.ps1
```

The script creates a temporary PowerPoint presentation, inserts a Rough native `Group`, resizes it, regenerates visible paths through `PptFreeformWriter`, verifies metadata and bounds survive, and rejects `msoPicture`.

## Native Operations Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-operations.ps1
```

The script creates a temporary PowerPoint presentation, inserts a Rough native `Group`, then verifies move, resize, rotate, duplicate, z-order, and align operations while rejecting picture children.

## Ribbon Shape Menu Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-ribbon-shape-menu.ps1
```

The script loads the built add-in DLL, generates the Ribbon shape menu XML from the packaged catalog, verifies the menu is valid XML, checks unique dynamic IDs, and requires full catalog coverage.

## Native Format Preservation Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-format-preservation.ps1
```

The script verifies that redraw can copy native PowerPoint formatting from the old inner authoritative layers to the new inner layers, including gradient fill, line color, line width, and dash style.

## Native Fill Semantics Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-fill-semantics.ps1
```

The script verifies that irregular Rough inner boundaries become the native filled Freeform, while the native carrier, outer jitter, boundary overlays, and hit area do not provide regular fallback fill.
It also verifies that role normalization removes accidental fill from outer jitter, boundary overlays, hidden native carriers, and hit areas after a group-level PowerPoint fill operation.

## User Asset Library Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-user-asset-library.ps1
```

The script saves a selected native PowerPoint shape as a user asset, lists it through the asset library, reinserts it into the active slide, verifies the result remains native, and deletes the temporary asset files it created.
It also verifies that the asset library stores a preview thumbnail separately from the native template.

## User Asset Package Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-user-asset-package.ps1
```

The script creates a temporary native asset library, exports it as a Rough asset package, imports it into a separate temporary library, verifies metadata and template files survive, confirms same-content templates with different IDs and names are skipped both within one package and on repeated import, and deletes all temporary files.
It also verifies thumbnail files survive export and import.

## Native Catalog Batch Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-native-catalog-batch.ps1
```

The script first generates real Rough.js drawables for the full AutoShape catalog, asserts output diversity, inserts each item through `PptFreeformWriter`, verifies native Rough metadata, rejects picture output, and deletes each inserted group before moving to the next catalog item.
