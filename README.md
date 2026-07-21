# Rough PPT Add-in

PowerPoint VSTO add-in prototype for inserting fully Rough.js-styled diagrams as native editable PowerPoint `Freeform` and `Group` objects.

## 修改前必读

**任何功能、UI、协议、安装包或验证改动前，必须先阅读 [`docs/PROJECT_CONSTRAINTS.md`](docs/PROJECT_CONSTRAINTS.md)。**

该文件定义了本项目的硬约束、冻结协议、禁止事项，以及当前仍需优化的方向。不先读约束就改代码，容易造成：

- Rough / ZLK 最终对象退化成图片或不可编辑对象
- 破坏 Zotero / ZLK 外部连接协议
- UI 假按钮、危险操作误触、资源占用暴涨
- 修一个问题引发相邻回归

执行期队列见 [`docs/target-mode-plan.md`](docs/target-mode-plan.md)。架构细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。Zotero 端改动必须遵循 [`docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md`](docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md)：论文图像与配色只通过固定外部 SQLite `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite` 共享，bridge 仅用于来源操作，禁止读取 Zotero 内置数据库或创建第二份共享库。

论文图像、科研类别、色系、版位、用途、样式标签和配色色阶在界面中统一显示为中文，数据库机器值只保留在内部查询中。中文关键词可直接搜索“热图”“训练曲线”“主视觉”等类别；新记录未保存单独缩略图时，PPT 会在固定大小上限内直接复用原始图片进行预览。

## Target

- Windows desktop PowerPoint.
- VSTO + PowerPoint COM + WebView2.
- Rough.js is used only as the live geometry engine.
- Final visible slide objects must not be PNG, Canvas captures, or SVG.
- The insert window lists Rough.js versions of all PowerPoint `MsoAutoShapeType` shapes.
- User-visible pages are Chinese-first. Any custom/non-native PowerPoint control, title, or ambiguous status has a hover tooltip explaining its meaning.

## Current Status

This repository contains the first implementation scaffold:

- VSTO add-in source layout.
- WebView2 task pane UI.
- Rough.js bridge contract.
- PowerPoint native Freeform writer.
- AutoShape catalog generation script.
- Build, diagnose, install, and uninstall scripts.

Run `scripts/diagnose.ps1` before packaging to confirm PowerPoint, MSBuild/VSTO, WebView2, signing certificate, and add-in registration state.

## Quick Commands

```powershell
powershell -ExecutionPolicy Bypass -File scripts\diagnose.ps1
powershell -ExecutionPolicy Bypass -File scripts\install-prereqs.ps1
npm install
npm test
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
powershell -ExecutionPolicy Bypass -File scripts\verify-native-all.ps1 -SkipSlow
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

Iteration validation without installing:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -NoInstall -SkipInstallers
```

Final one-command local deployment:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

Final deployment builds and verifies the portable zip, MSI, and EXE installers before installing the latest build locally.

Create a redistributable one-click local package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package.ps1
```

The generated `dist\RoughPptAddin\Install-RoughPptAddin.cmd` checks runtime prerequisites, registers the VSTO add-in, and leaves diagnose, normal uninstall, and `Complete-Uninstall-RoughPptAddin.cmd` beside it.

Portable, MSI, and EXE setup detect PowerPoint, .NET Framework 4.8, WebView2, and VSTO before registration. Missing runtimes use winget when possible; otherwise setup opens the corresponding Microsoft official installation page.

Create local Windows installers:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-installers.ps1
```

This generates `RoughPptAddin-Windows11.zip`, `RoughPptAddin-Windows11.msi`, and `RoughPptAddin-Windows11-Setup.exe` in the repository root.

## Deployment Goal

`scripts/build.ps1` is the single entry for local validation and packaging. When VSTO build tools are installed, it restores dependencies, validates the AutoShape catalog, builds the add-in, and stages installer assets.
`scripts/deploy.ps1` wraps build, native smoke tests, installer packaging, install, and PowerPoint load verification for one-command local deployment. Use `-SkipInstallers` only for inner-loop validation.
