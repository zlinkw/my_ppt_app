# Deployment

## Prerequisites

- Windows desktop PowerPoint.
- .NET Framework 4.8 Developer Pack.
- Visual Studio 2022 or Build Tools with Office/VSTO workload.
- Visual Studio Tools for Office Runtime.
- Microsoft Edge WebView2 Evergreen Runtime.
- Node.js for UI asset preparation.

## Commands

```powershell
powershell -ExecutionPolicy Bypass -File scripts\diagnose.ps1
powershell -ExecutionPolicy Bypass -File scripts\install-prereqs.ps1
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
powershell -ExecutionPolicy Bypass -File scripts\package.ps1
powershell -ExecutionPolicy Bypass -File scripts\package-installers.ps1
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -NoInstall -SkipInstallers
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

## Packaging Strategy

The first packaging target is a staged publish directory under `publish/`. `scripts\package.ps1` creates a redistributable local bootstrap package at `dist\RoughPptAddin` and `dist\RoughPptAddin.zip`.

`scripts\package-installers.ps1` wraps that package into root-level Windows installers: `RoughPptAddin-Windows11.zip`, `RoughPptAddin-Windows11.msi`, and `RoughPptAddin-Windows11-Setup.exe`. The MSI and EXE extract the same native editable VSTO add-in payload and run `scripts\install.ps1 -SkipBuild -InstallPrereqs`.
The MSI allows same-version overwrite upgrades, and the EXE/portable installer overwrite the local `%LOCALAPPDATA%\RoughPptAddin\publish` payload after PowerPoint is closed. Rerunning the same MSI repairs and overwrites the local payload instead of leaving the previous files in place.
Packaging derives the MSI `ProductVersion` from the app major/minor version plus the git commit count, then records it as `installerProductVersion` in `dist\installer-manifest.json`. Packaging also writes SHA256 hashes for the portable zip, MSI, and EXE. `scripts\verify-deploy-package.ps1` verifies the hashes and MSI `ProductVersion` so stale installer artifacts cannot pass final deployment validation.

## Fixed Per-user Installation

The MSI is per-user and limited, so it does not request administrator privileges or install files for other Windows accounts. Its bootstrap payload directory is fixed at `%LOCALAPPDATA%\RoughPptAddinInstaller`. The active add-in payload is fixed at `%LOCALAPPDATA%\RoughPptAddin\publish`. Neither directory is an end-user option, and the installer rejects a different root or a symbolic link or directory junction at the protected paths.

Each installation copies the complete new add-in into `publish.installing`, validates required VSTO and UI files, moves the old `publish` to `publish.rollback`, and activates the new payload. The old payload is deleted only after VSTO registration succeeds. A registration error restores `publish.rollback`; the next installation also resolves an interrupted transaction before starting another replacement. Files that existed only in the old `publish` are therefore removed instead of being merged into the new version.

Replacement never includes sibling user data under `%LOCALAPPDATA%\RoughPptAddin`, including WebView2 state, logs, feature-block defaults, and automation discovery files. Saved materials, thumbnails, palettes, presets, and exports under `%USERPROFILE%\Documents\RoughPptAddin` are also outside the payload transaction. Normal uninstall removes the add-in payload and transaction residue but preserves those user files. Run `scripts\uninstall.ps1 -PurgeUserData` only when all local configuration and saved content must be removed explicitly.

WiX validation suppresses only `ICE61` and `ICE91`. `ICE61` is expected because same-version overwrite is enabled intentionally; the build-derived `ProductVersion`, generated manifest, and artifact hashes remain mandatory. `ICE91` is expected because the limited per-user package stores its bootstrap files under LocalAppData and never supports a per-machine `ALLUSERS` installation. The final package verifier checks those source and compiled-MSI conditions before accepting the artifacts. Every other ICE remains enabled.

`scripts\deploy.ps1` is the final deployment path. By default it builds, runs the native verification suite, creates and verifies all three installer formats, installs missing runtime prerequisites, installs the latest build locally, and verifies PowerPoint loads the add-in. Use `-NoInstall -SkipInstallers` only for fast inner-loop validation when MSI/EXE generation is intentionally deferred.

`Install-RoughPptAddin.cmd` runs `scripts\install.ps1 -SkipBuild -InstallPrereqs`, installs missing WebView2 and VSTO runtime components through winget, registers the VSTO add-in, and keeps final slide content as native PowerPoint Freeform or Group objects.

End-user installers only install WebView2 Runtime and VSTO Runtime when missing. Build Tools are development and packaging prerequisites only.

Every portable, MSI, and EXE install first checks desktop PowerPoint, .NET Framework 4.8, WebView2 Runtime, and VSTO Runtime. Missing WebView2 or VSTO components are installed automatically through winget when available. If .NET Framework or PowerPoint is missing, winget is unavailable, or automatic installation fails, the installer opens the matching Microsoft official page and shows a Chinese instruction to complete installation before rerunning Rough setup.

`Uninstall-RoughPptAddin.cmd` removes the PowerPoint add-in registry entry and local installed files.

`Complete-Uninstall-RoughPptAddin.cmd` is the explicit one-click complete removal path. It refuses to run while PowerPoint is open, removes related MSI registration, `%LOCALAPPDATA%\RoughPptAddin`, `%USERPROFILE%\Documents\RoughPptAddin`, `%LOCALAPPDATA%\RoughPptAddinInstaller`, plugin-specific certificates, and bounded Rough temporary directories. This permanently deletes saved materials, thumbnails, palettes, presets, exports, logs, WebView2 state, and automation tokens. It preserves the external Zotero library at `%LOCALAPPDATA%\ZLK\paper-image-library` and shared system WebView2, VSTO, and .NET Framework runtimes.

`Diagnose-RoughPptAddin.cmd` writes Office, VSTO, WebView2, signing, and add-in registration state to `diagnostics\latest.json`.

`install-prereqs.ps1` installs WebView2 Runtime and VSTO Runtime through winget. Without `-RuntimeOnly`, it also installs Visual Studio Build Tools with Office/VSTO build components for development and packaging machines.

`build.ps1` creates a CurrentUser development ClickOnce code-signing certificate named `CN=RoughPptAddin Dev` when one is missing. Production packaging should replace that certificate with an organization-issued signing cert.

`install.ps1` builds by default, closes an empty PowerPoint instance if needed, refuses to continue while presentations are open, replaces `%LOCALAPPDATA%\RoughPptAddin\publish` with the current `publish/` payload, then launches the local `RoughPptAddin.vsto` through ClickOnce `dfshim.dll`. Save and close open presentations before running it, then reopen PowerPoint and enable the add-in if Office shows a trust prompt. Use `-SkipBuild` only after a successful build.
