# 人工清理候选列表

本文件只记录需要完整删除的文件或目录，不授予自动删除权限。请逐项确认用途、备份和运行状态后，由用户手动删除或明确授权后执行。保留文件内的过期行、段落、函数、类、配置项或其他局部内容由 Codex 直接删除或修改，不进入本列表；但不得清空整个文件或留下无意义空壳。

执行删除时必须逐项审核绝对路径：路径必须位于 `D:\GitRepo\my_ppt_app\` 之下且不是仓库根、`.git` 或 `src/`；任何路径拼接异常直接拒绝，不得继续删除。

发现日期：2026-07-22
处置日期：2026-07-26（B541 已授权批次）

## 已处置

删除前审核结论：`package-run.pid` 内容为 `cleaned` 且记录的 PID 45308 未运行；正式脚本 `scripts/verify-deploy-package.ps1`、`scripts/verify-native-all.ps1` 通过 PowerShell 解析器语法检查；已注册的 PowerPoint 加载项清单指向 `%LOCALAPPDATA%\RoughPptAddin\publish\RoughPptAddin.vsto`，不依赖仓内 `publish/`；`scripts/sync-ui-output.mjs` 用递归 `mkdirSync` 重建 `publish/ui` 与 `dist/RoughPptAddin/publish/ui`，`scripts/validate-local-ui-assets.mjs` 只在 `--publish` 参数下要求 `publish/ui`，`npm test` 未传该参数；打包脚本把产物写入 `releases/<版本>/publish`，不复用仓内 `publish/`。删除时 PowerPoint 与打包进程均未运行。

| 相对路径 | 类型 | 候选原因 | 状态 |
| --- | --- | --- | --- |
| `恢复审计报告_20260721.md` | 历史恢复报告 | 恢复阶段记录，当前计划和 Git 历史已保存主要结论 | 已删除 |
| `package-run.pid` | 运行标记文件 | 仅用于中断的打包会话，当前不是源码或依赖 | 已删除 |
| `scripts/verify-deploy-package.ps1),` | 恢复抽取副产物文件 | 文件名带有抽取残留的 `),`，内容只有一行控制台输出 | 已删除 |
| `scripts/verify-native-all.ps1),` | 恢复抽取副产物文件 | 文件名带有抽取残留的 `),`，内容只有一行控制台输出 | 已删除 |
| `dist/installer-build/` | 生成的 WiX/IExpress 临时目录 | 仅为安装器构建过程产物，不是源码 | 已删除（随 `dist/`） |
| `dist/` | 生成的发布输出目录 | 包含 UI、运行时和安装器清单等可重新生成内容 | 已删除 |
| `publish/` | 生成的 VSTO 发布目录 | 由 `scripts/build.ps1` 重建；已安装副本在 `%LOCALAPPDATA%` | 已删除 |
| `diagnostics/` | 运行诊断输出目录 | 诊断 JSON 可由 `scripts/diagnose.ps1` 重新生成 | 已删除 |
| `node_modules/nwsapi/dist/lint.log` | 依赖生成的空日志 | 空的依赖工具日志，`npm install` 时自动重建 | 已删除 |
| `releases/RoughPptAddin-0.1.21-97febadc/` 至 `-r7/` | 失败与被取代的恢复打包目录 | 七次恢复打包尝试，未生成可交付三件套或基于打包修复前工作树 | 已删除（7 个目录） |
| `releases/RoughPptAddin-0.1.22-ab02a492/` | 版本号失效的安装包目录 | MSI ProductVersion 低于已安装版本，会触发错误的降级拦截 | 已删除 |
| `releases/RoughPptAddin-0.1.723-f597c25e/` | 构建信息失效的安装包目录 | 内置 `build-info.json` 指向恢复前提交 | 已删除 |
| `releases/RoughPptAddin-0.1.743-7dff41b2/` | 已被视觉修复取代的安装包目录 | 帮助截图复核发现科研 SVG 空状态破图与长按钮省略问题 | 已删除 |
| `releases/RoughPptAddin-0.1.762-e045e31e/` | 失败的安装包目录 | WiX NuGet 下载不完整，未生成可交付 MSI/EXE | 已删除；`-e045e31e-r2/` 按原记录保留 |

## 已评估但保留

| 相对路径 | 保留原因 |
| --- | --- |
| `node_modules/` | `npm test`（`roughjs`、`vega`、`vega-lite`、`jsdom`）与 `npm run build:ui`（从 `node_modules` 复制 vendor 包和许可证）均直接依赖该目录。删除后必须联网重装才能恢复验证基线，因此本轮不删除。 |

## 待人工审核

| 相对路径 | 类型 | 候选原因 | 风险与人工确认项 | 状态 |
| --- | --- | --- | --- | --- |
| `docs/target-mode-plan.md).Count` | 恢复抽取副产物文件 | 文件名带有抽取残留的 `).Count`，内容是历史提交的控制台输出，不被任何脚本或文档引用；与已删除的 `scripts/*),` 属同一类残留 | 该文件已被 Git 跟踪，删除会进入提交；确认不再需要该批次的控制台记录（同等信息可由 `git log` 追溯） | 待人工审核 |
| `src/RoughPptAddin/Ribbon/RoughRibbon.cs).Count` | 恢复抽取副产物文件 | 7 字节，内容只有一个行数 `2532`；无任何脚本、工程文件或文档引用 | 位于 `src/` 之下，必须与正式源文件 `RoughRibbon.cs` 区分确认后再删除 | 待人工审核 |
| `src/RoughPptAddin/ui/app.mjs).Count` | 恢复抽取副产物文件 | 7 字节，内容只有一个行数 `2802`；无任何脚本、工程文件或文档引用 | 位于 `src/` 之下，必须与正式源文件 `app.mjs` 区分确认后再删除 | 待人工审核 |
| `src/RoughPptAddin/ui/styles.css.bak345` | 手工样式备份 | 185 KB 的旧版 `styles.css` 备份（2026-07-13），当前 `styles.css` 已增长到 245 KB；无任何脚本、工程文件或文档引用 | 位于运行时 UI 源目录内。B543 起同步脚本会过滤并清除运行时目录中的同类残留，但源目录副本仍需人工确认历史样式不再需要后删除 | 待人工审核 |

## 后续清理方向

- `releases/` 仍保留 11 个历史发布目录，约 2.1 GB。除最新交付 `RoughPptAddin-0.1.786-735227c7/` 外，其余目录的取证价值需由用户确认后再逐个进入本列表。

人工处理后，请在提交前重新运行 `git status --short`，避免把用户手动删除以外的清理动作误纳入代码批次。
