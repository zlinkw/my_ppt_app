# Rough PPT Add-in（手绘图形 Rough）

Rough PPT Add-in 是面向 Windows 桌面版 PowerPoint 的科研绘图插件。它把 Rough.js 风格图形转换成 PowerPoint 原生 `Freeform`、`Group`、文本框和线条对象，而不是把截图或图片贴到页面里，因此插入后仍可继续选择、拖动、缩放、旋转、改色和编辑文字。

插件覆盖四条主要工作流：

- 手绘风格流程图与论文框图。
- 二维和三维特征块示意图。
- CSV/TSV 数据图表与 SimpleExperiment 实验结果绘图。
- 论文素材、参考图像和配色管理。

## 界面预览

| 简洁模式 | 风格调整 |
| --- | --- |
| ![简洁模式任务窗格](src/RoughPptAddin/ui/help-assets/taskpane-overview.png) | ![选中对象后的风格工作区](src/RoughPptAddin/ui/help-assets/style-workspace.png) |

![科研绘图工作台](src/RoughPptAddin/ui/help-assets/chart-workspace.png)

## 功能总览

| 功能 | 说明 | 主要入口 |
| --- | --- | --- |
| 手绘形状图库 | 提供 202 种 PowerPoint 原生形状的手绘版本，插入结果为原生可编辑组。 | Ribbon → 手绘图形 Rough → 形状图库 |
| 选区转换与重绘 | 把已有普通形状转换为手绘风格；修改尺寸或载体后按新边界重绘。 | Ribbon → 常用 → 转换手绘 / 重绘选区 |
| 风格与实时更新 | 调整线宽、粗糙度、弯曲度、填充、线条、箭头和视觉来源；选中的手绘对象会立即重绘。 | Ribbon → 风格；右侧窗格 → 风格 |
| 特征块 | 创建二维矩阵、三维体块、注意力图等结构，并支持方向增删和默认参数保存。 | Ribbon → 论文与特征；右侧窗格精调 |
| 科研绘图工作台 | 本地解析 CSV/TSV，提供筛选、字段映射、36 种图表、实时 SVG 预览和配置复用。 | 右侧窗格 → 科研绘图 |
| 论文套件 | 快速插入 Transformer、多模态、医学 AI、MIL、知识图谱等论文常用结构骨架。 | Ribbon → 论文与特征 → 论文套件 |
| 素材库 | 保存、搜索、导入、分享和复用原生 PowerPoint 对象；导入时自动检测重复。 | Ribbon → 素材；右侧窗格完整管理 |
| Zotero 图像与配色 | 搜索本机共享论文图像库，插入参考图，提取和管理配色。 | Ribbon → 素材 → 打开论文图片库；右侧窗格 → 论文图像与配色 |
| SimpleExperiment 联动 | 通过本机回环接口接收实验绘图请求，追加原生可编辑结果图。 | SimpleExperiment 自动调用 |
| 使用说明 | 内置图文说明，可在独立非模态窗口中边看边操作。 | 右侧窗格右上角 → 使用说明 |

完整的安装后排障、功能入口、操作步骤和截图见 [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)。插件内同名“使用说明”按钮会打开同一套离线图文说明。

## 兼容环境

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 或 Windows 11 桌面环境 |
| PowerPoint | 桌面版 PowerPoint 2013、2016、2019、2021、2024 或 Microsoft 365 |
| Office 架构 | 32 位或 64 位桌面 Office 均可 |
| 运行时 | .NET Framework 4.8、Visual Studio Tools for Office Runtime、Microsoft Edge WebView2 Evergreen Runtime |
| 不支持 | PowerPoint 网页版、macOS 版 PowerPoint、平板/手机版 Office |
| 版本差异 | 科研绘图 SVG 直接插入需要 PowerPoint 2016 及以上；PowerPoint 2013 可继续使用旧任务窗格的原生绘图入口 |

安装包会先检查桌面 PowerPoint、.NET Framework 4.8、WebView2 和 VSTO Runtime。缺少 WebView2 或 VSTO Runtime 时优先通过 winget 自动补齐；无法自动安装时，会打开 Microsoft 官方下载页并用中文提示下一步。PowerPoint 本身缺失时不会继续注册插件。

## 安装方式

三种发布包包含同一份插件载荷，区别只在启动和维护方式。普通用户推荐使用 EXE 安装器。

### 推荐：EXE 一键安装器

1. 打开仓库的 [GitHub Releases](https://github.com/zlinkw/my_ppt_app/releases) 页面。
2. 下载最新版本的 `RoughPptAddin-Windows11-Setup.exe`。
3. 保存正在编辑的演示文稿，完全退出所有 PowerPoint 窗口。
4. 运行安装器，等待中文提示完成。
5. 重新打开 PowerPoint；如果 Office 显示加载项信任提示，选择启用。

EXE 安装器适合个人电脑。它按当前用户注册插件，不需要管理员权限，也不会自动关闭 PowerPoint。

### MSI 安装包

1. 从 Releases 下载 `RoughPptAddin-Windows11.msi`。
2. 关闭全部 PowerPoint 窗口。
3. 双击 MSI 并按提示完成当前用户安装。
4. 重新打开 PowerPoint 并确认 Ribbon 中出现“手绘图形 Rough”。

MSI 使用固定升级码，支持同版本修复和覆盖升级，适合需要统一分发文件类型的环境。

### ZIP 免安装引导包

1. 从 Releases 下载 `RoughPptAddin-Windows11.zip`。
2. 解压到本地任意有读写权限的目录。
3. 关闭全部 PowerPoint 窗口。
4. 运行解压目录中的 `Install-RoughPptAddin.cmd`。
5. 按提示补齐运行时、完成注册，再打开 PowerPoint。

ZIP 包便于离线转存和检查载荷；`Install-RoughPptAddin.cmd` 会执行与图形安装器相同的环境检查和注册流程。

## 安装位置与数据

插件使用当前用户路径，不要求写入 Program Files：

| 内容 | 位置 |
| --- | --- |
| 当前插件载荷 | `%LOCALAPPDATA%\RoughPptAddin\publish` |
| 安装日志 | `%LOCALAPPDATA%\RoughPptAddin\logs` |
| 用户素材、缩略图、配色、预设和导出 | `%USERPROFILE%\Documents\RoughPptAddin` |
| Zotero 共享论文图像库 | `%LOCALAPPDATA%\ZLK\paper-image-library` |
| 共享运行时 | WebView2、VSTO Runtime 和 .NET Framework 的系统位置 |

普通卸载只移除插件注册和程序载荷，保留用户素材、配色、预设和日志。完整卸载脚本会删除上述插件专属数据和缓存，且要求先关闭 PowerPoint；它不会删除 Zotero 共享图库和系统共享运行时。

## 更新与卸载

### 更新到新版本

1. 在右侧任务窗格点击“版本检测”，记录版本号、提交和构建时间。
2. 前往 [GitHub Releases](https://github.com/zlinkw/my_ppt_app/releases) 查看最新发布说明。
3. 保存演示文稿并关闭全部 PowerPoint 窗口。
4. 运行新版 EXE、MSI 或 ZIP 引导安装器。安装事务会替换旧载荷，失败时恢复回滚目录。
5. 重新打开 PowerPoint，再次点击“版本检测”核对提交和构建时间。

当前发布流程以 GitHub Releases 为更新来源；插件不会在后台静默替换自身文件。

### 卸载

- 普通卸载：运行安装目录中的 `Uninstall-RoughPptAddin.cmd`。
- 完整卸载：运行 `Complete-Uninstall-RoughPptAddin.cmd`。该操作不可恢复，会在执行前拒绝 PowerPoint 处于打开状态，并明确删除本机素材、配色、预设、导出、日志、WebView2 插件状态和自动化令牌。

## 快速上手

1. 打开 PowerPoint，进入“手绘图形 Rough”选项卡。
2. 点击“形状图库”插入第一个手绘矩形、箭头或流程节点。
3. 保持对象选中，在右侧窗格的“风格”中调整粗糙度、线宽、颜色、填充或箭头。
4. 需要处理已有图形时，选中它后点击“转换手绘”；需要按新尺寸重新生成边界时点击“重绘选区”。
5. 点击右上角“使用说明”，在独立窗口中查看完整图文教程，同时继续在幻灯片中练习。

更多入口对照、科研绘图流程、Zotero 图像限制、快捷键和无选区时的功能边界见 [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)。

## 排障

| 现象 | 处理方法 |
| --- | --- |
| Ribbon 没有“手绘图形 Rough” | 打开 PowerPoint 的 COM 加载项列表确认 `RoughPptAddin` 已启用；必要时重新运行安装器。 |
| 安装器提示 PowerPoint 正在运行 | 保存并手动退出全部 PowerPoint 窗口后重新运行；安装器不会替你关闭文档。 |
| 安装后仍是旧界面 | 点击“版本检测”核对提交和构建时间，然后重启 PowerPoint。若仍不一致，重新运行同一个新版安装器。 |
| 缺少 WebView2 或 VSTO Runtime | 允许安装器通过 winget 补齐，或按提示从 Microsoft 官方页面安装后重试。 |
| 需要诊断报告 | 运行 `Diagnose-RoughPptAddin.cmd`，报告会输出到 `diagnostics/latest.json`。 |
| 安装失败需要日志 | 查看 `%LOCALAPPDATA%\RoughPptAddin\logs` 中最新的 `install-*.log`，以及注册表 `HKCU\Software\RoughPptAddin\InstallerDiagnostics` 中的最近状态。 |

Windows SmartScreen 或 Office 信任提示来自未建立系统信誉的新发布包或开发签名。请只从本项目 GitHub Releases 或本地构建产物获取安装包，确认来源后再选择继续运行。

## 开发者入口

- 产品硬约束与冻结协议：[`docs/PROJECT_CONSTRAINTS.md`](docs/PROJECT_CONSTRAINTS.md)
- 目标模式批次流水：[`docs/target-mode-plan.md`](docs/target-mode-plan.md)
- 架构与协议：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 构建、安装事务和打包策略：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- 验证命令与基线：[`docs/VALIDATION.md`](docs/VALIDATION.md)
- Zotero 外部数据库协议：[`docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md`](docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md)

本地开发常用命令：

```powershell
npm install
npm test
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
powershell -ExecutionPolicy Bypass -File scripts\package-release-preserving.ps1
powershell -ExecutionPolicy Bypass -File scripts\diagnose.ps1
```

`npm test` 是提交前基线；`scripts/package-release-preserving.ps1` 会生成带版本号目录的 ZIP、MSI、EXE 和哈希清单。开发机构建使用本地开发证书；对外分发前应替换为受信任的组织签名证书。

发布前完整部署路径是 `powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1`。它会构建并验证 portable zip, MSI, and EXE installers，完成本机安装和 PowerPoint 加载检查；只做内部迭代验证时可追加 `-NoInstall -SkipInstallers`，跳过安装器生成与本机安装。
