using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using Microsoft.Office.Tools;
using RoughPptAddin.Models;
using RoughPptAddin.Ribbon;
using RoughPptAddin.TaskPane;
using System.Collections.Generic;
using System.Drawing.Imaging;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System;

namespace RoughPptAddin.Services
{
    public sealed class RoughAddInController : IDisposable
    {
    	private sealed class PictureConverter : AxHost
    	{
    		private PictureConverter()
    			: base(string.Empty)
    		{
    		}
    
    		public static Image FromPicture(object picture)
    		{
    			return AxHost.GetPictureFromIPicture(picture);
    		}
    	}
    
    	private const int MaxZlkSourceFiles = 64;
    
    	private const long MaxZlkSourceFileBytes = 2097152L;
    
    	private const long MaxZlkTotalSourceBytes = 12582912L;
    
    	private readonly Microsoft.Office.Interop.PowerPoint.Application application;
    
    	private readonly CustomTaskPaneCollection taskPanes;
    
    	private readonly MetadataService metadata = new MetadataService();
    
    	private readonly PptFreeformWriter writer;
    
    	private readonly PptStyleSynchronizer styleSynchronizer;
    
    	private readonly RoughJsBridge bridge;
    
    	private readonly SelectionCaptureService selectionCapture;
    
    	private readonly QuickShapeService quickShapes = new QuickShapeService();
    
    	private readonly FeatureBlockInserter featureBlocks = new FeatureBlockInserter();
    
    	private readonly FeatureBlockPresetService featureBlockPresets = new FeatureBlockPresetService();
    
    	private readonly PaperStructurePresetService paperPresets = new PaperStructurePresetService();
    
    	private readonly ZoteroImageLibraryService zoteroImages = new ZoteroImageLibraryService();
    
    	private readonly PaletteLibraryService palettes = new PaletteLibraryService();
    
    	private readonly PptZlkChartRenderer zlkCharts = new PptZlkChartRenderer();
    
    	private readonly Control dispatcher = new Control();
    
    	private readonly Dictionary<string, string> officeShapeIconCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    
    	private FeatureBlockOptions currentFeatureBlockOptions;
    
    	private RoughStyle currentRoughStyle = new RoughStyle();
    
    	private ShapeRegenerator regenerator;
    
    	private AutomationServer automationServer;
    
    	private Microsoft.Office.Tools.CustomTaskPane taskPane;
    
    	private RoughTaskPaneControl taskPaneControl;
    
    	private UsageGuideWindow usageGuideWindow;

	private ResearchChartStudioWindow researchChartStudioWindow;
    
    	public OfficeCompatibilityInfo Compatibility { get; }
    
    	public RoughAddInController(Microsoft.Office.Interop.PowerPoint.Application application, CustomTaskPaneCollection taskPanes)
    	{
    		this.application = application;
    		this.taskPanes = taskPanes;
    		Compatibility = OfficeCompatibilityService.Detect(application);
    		writer = new PptFreeformWriter(metadata);
    		styleSynchronizer = new PptStyleSynchronizer(metadata);
    		bridge = new RoughJsBridge();
    		selectionCapture = new SelectionCaptureService(application);
    		currentFeatureBlockOptions = featureBlockPresets.Load();
    		dispatcher.CreateControl();
    	}
    
    	public void Start()
    	{
    		AddInLogger.Info("宿主兼容环境：" + Compatibility.Summary);
    		if (!string.IsNullOrWhiteSpace(Compatibility.Warning))
    		{
    			AddInLogger.Info("宿主兼容提示：" + Compatibility.Warning);
    		}
    		regenerator = new ShapeRegenerator(application, bridge, writer, metadata, styleSynchronizer);
    		regenerator.Start();
    		application.WindowSelectionChange += OnWindowSelectionChange;
    		PrewarmTaskPane();
    		StartAutomationServer();
    	}
    
    	public void ShowTaskPane()
    	{
    		EnsureTaskPane(visible: true);
    	}
    
    	public void ShowTaskPaneSection(string section)
    	{
    		EnsureTaskPane(visible: true).FocusSection(section, "已定位到右侧窗格：" + SectionDisplayName(section));
    	}
    
    	public void ShowUsageGuide()
    	{
    		try
    		{
    			if (usageGuideWindow == null || usageGuideWindow.IsDisposed)
    			{
    				usageGuideWindow = new UsageGuideWindow(GetPowerPointWindowHandle, delegate(string message, bool isError)
    				{
    					NotifyUi(message, isError);
    				});
    			}
    			usageGuideWindow.ShowAlongsidePowerPoint();
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("打开独立使用说明失败。", ex);
    			NotifyUi("打开使用说明失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void NotifyRibbonStatus(string text, bool isError = false)
    	{
    		NotifyUi(text, isError);
    	}
    
    	private void NotifyUi(string text, bool isError = false)
    	{
    		try
    		{
    			EnsureTaskPane(visible: false).PostHostStatus(text, isError);
    		}
    		catch (Exception exception)
    		{
    			AddInLogger.Error("向任务窗格发送状态失败。", exception);
    		}
    	}
    
    	private void NotifyUiOrFallback(string text, bool isError = false)
    	{
    		try
    		{
    			EnsureTaskPane(visible: false).PostHostStatus(text, isError);
    		}
    		catch (Exception exception)
    		{
    			AddInLogger.Error("向任务窗格发送状态失败，回退系统提示。", exception);
    			MessageBox.Show(text, "Rough 手绘图形");
    		}
    	}
    
    	private RoughTaskPaneControl EnsureTaskPane(bool visible)
    	{
    		if (taskPane == null)
    		{
    			taskPaneControl = new RoughTaskPaneControl(this, bridge);
    			taskPane = taskPanes.Add(taskPaneControl, "Rough 手绘图形");
    			taskPane.Width = 420;
    			taskPane.Visible = false;
    		}
    		if (visible)
    		{
    			taskPane.Visible = true;
    		}
    		return taskPaneControl;
    	}
    
    	private void PrewarmTaskPane()
    	{
    		try
    		{
    			EnsureTaskPane(visible: false).BeginInitialization();
    		}
    		catch (Exception exception)
    		{
    			AddInLogger.Error("预热任务窗格失败。", exception);
    		}
    	}
    
    	public void InsertShape(string sourceMsoType)
    	{
    		InsertShape(sourceMsoType, currentRoughStyle);
    	}
    
    	public void InsertShape(string sourceMsoType, RoughStyle style)
    	{
    		InsertShape(sourceMsoType, style ?? currentRoughStyle, null, null);
    	}
    
    	public FeatureBlockMutationResult InsertFeatureBlock(FeatureBlockOptions options)
    	{
    		try
    		{
    			SetFeatureBlockPreset(options);
    			Slide slide = GetCurrentSlide();
    			if (slide == null)
    			{
    				NotifyUi("当前没有可用幻灯片。", isError: true);
    				return FeatureBlockMutationResult.Failed;
    			}
    			if (TryGetSelectedFeatureBlock(out var selectedFeatureBlock))
    			{
    				featureBlocks.Replace(slide, selectedFeatureBlock, options);
    				return FeatureBlockMutationResult.Updated;
    			}
    			featureBlocks.Insert(slide, options);
    			return FeatureBlockMutationResult.Inserted;
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("插入特征块失败。", ex);
    			NotifyUi("插入特征块失败：" + ex.Message + Environment.NewLine + "日志：" + AddInLogger.LogPath, isError: true);
    			return FeatureBlockMutationResult.Failed;
    		}
    	}
    
    	public bool UpdateSelectedFeatureBlock(FeatureBlockOptions options)
    	{
    		try
    		{
    			SetFeatureBlockPreset(options);
    			if (!TryGetSelectedFeatureBlock(out var selectedFeatureBlock))
    			{
    				return false;
    			}
    			featureBlocks.Replace(GetCurrentSlide(), selectedFeatureBlock, options);
    			taskPaneControl?.ApplyFeatureBlockFromHost(options, "已实时更新选中特征块。");
    			return true;
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("实时更新特征块失败。", ex);
    			NotifyUi("实时更新特征块失败：" + ex.Message, isError: true);
    			return false;
    		}
    	}
    
    	public void SetFeatureBlockPreset(FeatureBlockOptions options)
    	{
    		currentFeatureBlockOptions = options ?? new FeatureBlockOptions();
    	}
    
    	public void SetRoughStylePreset(RoughStyle style)
    	{
    		SetRoughStylePreset(style, syncTaskPane: true);
    	}
    
    	public void SetRoughStylePreset(RoughStyle style, bool syncTaskPane)
    	{
    		if (style != null)
    		{
    			currentRoughStyle = style;
    			if (syncTaskPane)
    			{
    				taskPaneControl?.ApplyStyleFromHost(currentRoughStyle, "已应用顶部风格预设，后续插入和转换会使用该风格。");
    			}
    		}
    	}
    
    	public void SetActiveRibbonStylePreset(string stylePresetId)
    	{
    		RoughRibbon.SetActiveStylePreset(stylePresetId);
    	}
    
    	public void ApplyRoughStyleShortcut(Action<RoughStyle> update, string label)
    	{
    		if (update != null)
    		{
    			RoughStyle style = CloneRoughStyle(currentRoughStyle ?? new RoughStyle());
    			update(style);
    			currentRoughStyle = style;
    			int count = UpdateSelectionStyle(style);
    			taskPaneControl?.ApplyStyleFromHost(currentRoughStyle, (count > 0) ? ("已应用顶部快捷：" + label + "，并发送选区重绘。") : ("已应用顶部快捷：" + label + "，后续插入会使用该样式。"));
    		}
    	}
    
    	public void RunSelectionNextAction()
    	{
    		try
    		{
    			if (!TryGetSelection(out var selection, out var reason))
    			{
    				ShowTaskPaneSection("catalog");
    				taskPaneControl?.ShowStatusFromHost(reason + " 已打开形状图库，可先插入形状。");
    				return;
    			}
    			if (selection.ShapeRange.Count == 1)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape shape = selection.ShapeRange[1];
    				if (featureBlocks.IsFeatureBlock(shape))
    				{
    					InsertFeatureBlockFromPreset();
    					return;
    				}
    				if (metadata.TryRead(shape, out var _))
    				{
    					if (RefreshSelection() == 0)
    					{
    						taskPaneControl?.ShowStatusFromHost("当前手绘选区未能重绘，请打开右侧窗格检查元数据。", isError: true);
    					}
    					return;
    				}
    			}
    			ConvertSelectionToRough(null);
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("执行顶部下一步失败。", ex);
    			NotifyUi("执行下一步失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void ApplyFeatureBlockShortcut(string shortcutId)
    	{
    		try
    		{
    			FeatureBlockOptions options = CloneFeatureBlockOptions(currentFeatureBlockOptions);
    			if (ApplyFeatureBlockShortcutPatch(shortcutId, options))
    			{
    				currentFeatureBlockOptions = options;
    				taskPaneControl?.ApplyFeatureBlockFromHost(options, "已应用顶部特征快捷：" + FeatureBlockShortcutLabel(shortcutId));
    				InsertFeatureBlock(options);
    			}
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("执行顶部特征块快捷失败。", ex);
    			NotifyUi("执行特征块快捷失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void SaveFeatureBlockPreset(FeatureBlockOptions options)
    	{
    		currentFeatureBlockOptions = featureBlockPresets.Save(options);
    	}
    
    	public void InsertFeatureBlockFromPreset()
    	{
    		InsertFeatureBlock(currentFeatureBlockOptions);
    	}
    
    	public void InsertFeatureBlockFromPreset(string mode, string visualStyle)
    	{
    		FeatureBlockOptions options = CloneFeatureBlockOptions(currentFeatureBlockOptions);
    		if (!string.IsNullOrWhiteSpace(mode))
    		{
    			options.Mode = mode;
    		}
    		if (!string.IsNullOrWhiteSpace(visualStyle))
    		{
    			options.VisualStyle = visualStyle;
    		}
    		InsertFeatureBlock(options);
    	}
    
    	public void InsertPaperStructurePreset(string presetId)
    	{
    		try
    		{
    			Slide slide = GetCurrentSlide();
    			if (slide == null)
    			{
    				NotifyUi("当前没有可用幻灯片。", isError: true);
    				return;
    			}
    			string normalized = PaperStructurePresetService.NormalizePresetId(presetId);
    			paperPresets.Insert(slide, normalized);
    			taskPaneControl?.ShowStatusFromHost("已插入论文图预设：" + PaperStructurePresetService.PresetTitle(normalized));
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("插入论文图预设失败：" + presetId, ex);
    			NotifyUi("插入论文图预设失败：" + ex.Message + Environment.NewLine + "日志：" + AddInLogger.LogPath, isError: true);
    		}
    	}
    
    	public void SaveCurrentFeatureBlockPreset()
    	{
    		try
    		{
    			SaveFeatureBlockPreset(currentFeatureBlockOptions);
    			NotifyUi("已保存当前特征块默认参数。");
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("保存特征块默认参数失败。", ex);
    			NotifyUi("保存特征块默认参数失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void AdjustFeatureBlockFromPreset(string direction, int delta)
    	{
    		AdjustFeatureBlockInternal(null, direction, delta);
    	}
    
    	public bool AdjustSelectedFeatureBlock(FeatureBlockOptions options, string direction, int delta)
    	{
    		return AdjustFeatureBlockInternal(options, direction, delta);
    	}
    
    	private bool AdjustFeatureBlockInternal(FeatureBlockOptions requestedOptions, string direction, int delta)
    	{
    		try
    		{
    			if (!TryGetSelectedFeatureBlock(out var selectedFeatureBlock))
    			{
    				ShowTaskPaneSection("featureBlock");
    				taskPaneControl?.ShowStatusFromHost("请先选中一个特征块后再调整方向；方向调整不会新建特征块。", isError: true);
    				return false;
    			}
    			if (!featureBlocks.TryReadOptions(selectedFeatureBlock, out var selectedOptions))
    			{
    				selectedOptions = currentFeatureBlockOptions;
    			}
    			FeatureBlockOptions options = CloneFeatureBlockOptions(requestedOptions ?? selectedOptions);
    			options.EditDirection = direction ?? string.Empty;
    			options.EditDelta = ((delta < 0) ? (-1) : ((delta > 0) ? 1 : 0));
    			if (options.EditDelta == 0 || string.IsNullOrWhiteSpace(options.EditDirection))
    			{
    				return false;
    			}
    			switch (options.EditDirection)
    			{
    			case "left":
    			case "right":
    				options.CountX = Math.Max(1, Math.Min(32, options.CountX + options.EditDelta));
    				break;
    			case "up":
    			case "down":
    				options.CountY = Math.Max(1, Math.Min(24, options.CountY + options.EditDelta));
    				break;
    			case "front":
    			case "back":
    				if (string.Equals(options.Mode, "2d", StringComparison.OrdinalIgnoreCase))
    				{
    					taskPaneControl?.ShowStatusFromHost("二维特征块没有前后层，请切换到三维特征块后再调整。", isError: true);
    					return false;
    				}
    				options.CountZ = Math.Max(1, Math.Min(16, options.CountZ + options.EditDelta));
    				break;
    			default:
    				return false;
    			}
    			currentFeatureBlockOptions = options;
    			featureBlocks.Replace(GetCurrentSlide(), selectedFeatureBlock, options);
    			taskPaneControl?.ApplyFeatureBlockFromHost(options, "已直接更新选中特征块：" + FeatureDirectionLabel(options.EditDirection, options.EditDelta));
    			return true;
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("调整特征块方向失败。", ex);
    			NotifyUi("调整特征块方向失败：" + ex.Message, isError: true);
    			return false;
    		}
    	}
    
    	public int ApplyRoughStylePreset(RoughStyle style, string label)
    	{
    		if (style == null)
    		{
    			return 0;
    		}
    		currentRoughStyle = style;
    		int count = UpdateSelectionStyle(style);
    		taskPaneControl?.ApplyStyleFromHost(currentRoughStyle, (count > 0) ? ("已应用顶部风格模板：" + (label ?? "风格") + "，并发送选区重绘。") : ("已应用顶部风格模板：" + (label ?? "风格") + "，后续插入会使用该样式。"));
    		return count;
    	}
    
    	public async void InsertShape(string sourceMsoType, RoughStyle style, float? width, float? height)
    	{
    		try
    		{
    			if (!bridge.IsReady)
    			{
    				await EnsureTaskPane(visible: true).WaitUntilReadyAsync(TimeSpan.FromSeconds(35.0)).ConfigureAwait(continueOnCapturedContext: true);
    			}
    			Slide slide = GetCurrentSlide();
    			if (slide == null)
    			{
    				NotifyUi("当前没有可用幻灯片。", isError: true);
    				return;
    			}
    			RoughShapeRequest request = CreateDefaultRequest(sourceMsoType);
    			if (style == null)
    			{
    				style = currentRoughStyle;
    			}
    			if (style != null)
    			{
    				request.Style = style;
    			}
    			if (width.HasValue && width.Value > 0f)
    			{
    				request.Width = width.Value;
    			}
    			if (height.HasValue)
    			{
    				request.Height = height.Value;
    			}
    			RoughDrawable drawable = await bridge.GenerateAsync(request);
    			writer.InsertGroup(slide, request, drawable);
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("插入形状失败：" + sourceMsoType, ex);
    			NotifyUi("插入失败：" + ex.Message + Environment.NewLine + "日志：" + AddInLogger.LogPath, isError: true);
    		}
    	}
    
    	public int RefreshSelection()
    	{
    		return regenerator?.RefreshSelection() ?? 0;
    	}
    
    	public int UpdateSelectionStyle(RoughStyle style)
    	{
    		if (style == null)
    		{
    			return 0;
    		}
    		return regenerator?.RefreshSelection(style) ?? 0;
    	}
    
    	public Task<int> RefreshSelectionNowAsync(RoughStyle style)
    	{
    		return regenerator?.RefreshSelectionNowAsync(style) ?? Task.FromResult(0);
    	}
    
    	public void ConvertSelectionToRough(RoughStyle style)
    	{
		_ = ConvertSelectionToRoughAsync(style);
    	}
    
    	public async Task<int> ConvertSelectionToRoughAsync(RoughStyle style)
    	{
    		try
    		{
    			if (!bridge.IsReady)
    			{
    				await EnsureTaskPane(visible: true).WaitUntilReadyAsync(TimeSpan.FromSeconds(35.0)).ConfigureAwait(continueOnCapturedContext: true);
    			}
    			Slide slide = GetCurrentSlide();
    			Selection selection = application.ActiveWindow?.Selection;
    			if (slide == null || selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
    			{
    				NotifyUi("请先选择一个或多个 PowerPoint 原生形状。", isError: true);
    				return 0;
    			}
    			List<Microsoft.Office.Interop.PowerPoint.Shape> sources = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
    			for (int i = 1; i <= selection.ShapeRange.Count; i++)
    			{
    				sources.Add(selection.ShapeRange[i]);
    			}
    			List<string> convertedNames = new List<string>();
    			int skipped = 0;
    			RoughStyle conversionStyle = style ?? currentRoughStyle ?? new RoughStyle();
    			foreach (Microsoft.Office.Interop.PowerPoint.Shape source in sources)
    			{
    				if (source == null || metadata.TryRead(source, out var _))
    				{
    					skipped++;
    					continue;
    				}
    				string sourceMsoType = ResolveSourceMsoType(source);
    				if (string.IsNullOrEmpty(sourceMsoType))
    				{
    					skipped++;
    					continue;
    				}
    				RoughShapeRequest request2 = CreateRequestFromShape(source, sourceMsoType, conversionStyle);
    				RoughDrawable drawable = await bridge.GenerateAsync(request2).ConfigureAwait(continueOnCapturedContext: true);
    				Microsoft.Office.Interop.PowerPoint.Shape roughGroup = writer.InsertGroup(slide, request2, drawable);
    				roughGroup.Rotation = source.Rotation;
    				styleSynchronizer.ApplyNativeShapeFormat(source, roughGroup, request2);
    				RestoreZOrder(roughGroup, source.ZOrderPosition);
    				convertedNames.Add(roughGroup.Name);
    				source.Delete();
    			}
    			if (convertedNames.Count > 0)
    			{
    				slide.Shapes.Range(convertedNames.ToArray()).Select();
    			}
    			if (convertedNames.Count == 0)
    			{
    				NotifyUi("当前选区没有可转换的 PowerPoint 原生形状。已生成的 Rough 手绘组不会重复转换。", isError: true);
    			}
    			else if (skipped > 0)
    			{
    				NotifyUi("已转换 " + convertedNames.Count + " 个形状，跳过 " + skipped + " 个不支持或已是手绘的对象。");
    			}
    			taskPaneControl?.SendSelectionState();
    			return convertedNames.Count;
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("转换选区为手绘风格失败。", ex);
    			NotifyUi("转换失败：" + ex.Message + Environment.NewLine + "日志：" + AddInLogger.LogPath, isError: true);
    			return 0;
    		}
    	}
    
    	public void InspectSelection()
    	{
    		Selection selection = application.ActiveWindow?.Selection;
    		string report = metadata.BuildInspectionReport(selection);
    		NotifyUi(report);
    	}
    
    	public void SelectNativeCarrier()
    	{
    		try
    		{
    			Selection selection = application.ActiveWindow?.Selection;
    			if (selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
    			{
    				NotifyUi("请先选择一个 Rough 原生组。", isError: true);
    				return;
    			}
    			Microsoft.Office.Interop.PowerPoint.Shape carrier = FindChildByRole(selection.ShapeRange[1], "nativeCarrier");
    			if (carrier == null)
    			{
    				NotifyUi("当前选区没有可选择的 PPT 原生载体。", isError: true);
    			}
    			else
    			{
    				carrier.Select();
    			}
    		}
    		catch (Exception ex)
    		{
    			NotifyUi("选择原生载体失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void SaveSelectionAsAsset()
    	{
    		try
    		{
    			UserAssetInfo result = SaveSelectionAsAssetInfo();
    			RoughRibbon.InvalidateActiveRecentAssets();
    			taskPaneControl?.SendUserAssets();
    			NotifyUi("已保存素材：" + result.DisplayName);
    		}
    		catch (Exception ex)
    		{
    			NotifyUi("保存素材失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void ImportUserAssetsFromRibbon()
    	{
    		try
    		{
    			UserAssetImportResult imported = ImportUserAssets();
    			RoughRibbon.InvalidateActiveRecentAssets();
    			taskPaneControl?.SendUserAssets();
    			NotifyUi(DescribeUserAssetImport(imported));
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("导入素材包失败。", ex);
    			NotifyUi("导入素材包失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void RefreshUserAssetsFromRibbon()
    	{
    		try
    		{
    			RoughRibbon.InvalidateActiveRecentAssets();
    			(taskPaneControl ?? EnsureTaskPane(visible: false)).RefreshUserAssetsFromHost("已刷新本机素材库，顶部最近素材菜单已同步。");
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("刷新素材库失败。", ex);
    			NotifyUi("刷新素材库失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public void ExportUserAssetsFromRibbon()
    	{
    		try
    		{
    			string packagePath = ExportUserAssets();
    			NotifyUi(string.IsNullOrEmpty(packagePath) ? "已取消分享素材包。" : ("已生成分享素材包：" + packagePath));
    		}
    		catch (Exception ex)
    		{
    			AddInLogger.Error("分享素材包失败。", ex);
    			NotifyUi("分享素材包失败：" + ex.Message, isError: true);
    		}
    	}
    
    	public object GetOfficeImageMso(string imageMso, int width, int height)
    	{
    		if (string.IsNullOrWhiteSpace(imageMso))
    		{
    			return null;
    		}
    		try
    		{
    			CommandBars commandBars = application.CommandBars;
    			return commandBars.GetType().InvokeMember("GetImageMso", BindingFlags.InvokeMethod, null, commandBars, new object[3] { imageMso, width, height });
    		}
    		catch
    		{
    			return null;
    		}
    	}
    
    	public IntPtr GetPowerPointWindowHandle()
    	{
    		try
    		{
    			return new IntPtr(application.HWND);
    		}
    		catch
    		{
    			return IntPtr.Zero;
    		}
    	}
    
    	public string GetOfficeShapeIconDataUrl(string enumName, string category, int width, int height)
    	{
    		if (string.IsNullOrWhiteSpace(enumName))
    		{
    			return null;
    		}
    		string key = enumName + "|" + width + "x" + height;
    		if (officeShapeIconCache.TryGetValue(key, out var cached))
    		{
    			return cached;
    		}
    		foreach (string imageMso in RoughRibbon.GetImageMsoCandidatesForShape(enumName, category))
    		{
    			string dataUrl = GetOfficeImageMsoDataUrl(imageMso, width, height);
    			if (!string.IsNullOrWhiteSpace(dataUrl))
    			{
    				officeShapeIconCache[key] = dataUrl;
    				return dataUrl;
    			}
    		}
    		return null;
    	}
    
    	public IList<string> ListQuickShapes()
    	{
    		return quickShapes.List();
    	}
    
    	public IList<string> PinQuickShape(string enumName)
    	{
    		IList<string> result = quickShapes.Pin(enumName);
    		RoughRibbon.InvalidateActiveQuickShapes();
    		return result;
    	}
    
    	public IList<string> UnpinQuickShape(string enumName)
    	{
    		IList<string> result = quickShapes.Unpin(enumName);
    		RoughRibbon.InvalidateActiveQuickShapes();
    		return result;
    	}
    
    	private string GetOfficeImageMsoDataUrl(string imageMso, int width, int height)
    	{
    		object picture = GetOfficeImageMso(imageMso, width, height);
    		if (picture == null)
    		{
    			return null;
    		}
    		try
    		{
    			using Image image = PictureConverter.FromPicture(picture);
    			using MemoryStream stream = new MemoryStream();
    			image.Save(stream, ImageFormat.Png);
    			return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
    		}
    		catch
    		{
    			return null;
    		}
    	}
    
    	private static string ImageMsoForShape(string enumName, string category)
    	{
    		return RoughRibbon.GetImageMsoForShape(enumName, category);
    	}
    
    	public UserAssetInfo SaveSelectionAsAssetInfo()
    	{
    		return selectionCapture.SaveCurrentSelection();
    	}
    
    	public IList<UserAssetInfo> ListUserAssets()
    	{
    		return selectionCapture.ListUserAssets();
    	}
    
    	public IList<ZoteroImageInfo> ListZoteroImages(string query, out string status, out bool databaseFound)
    	{
    		return zoteroImages.ListImages(query, out status, out databaseFound);
    	}
    
		public ZoteroPaletteInfo GetZoteroPalette(string query)
		{
			return zoteroImages.GetPalette(query);
		}

		public ZoteroPaletteInfo GetZoteroPaletteByImageId(string imageId)
		{
			return zoteroImages.GetPaletteByImageId(imageId);
		}
    
    	public ZoteroPaletteInfo BuildZoteroPaletteGrid(IEnumerable<ZoteroImageInfo> images, string status, bool databaseFound)
    	{
    		return zoteroImages.BuildPaletteGrid(images, status, databaseFound);
    	}
    
    	public ZoteroImageInfo InsertZoteroImage(string imageId)
    	{
    		return zoteroImages.InsertImage(application, imageId);
    	}
    
		public string OpenZoteroImagePdf(string imageId)
		{
			return zoteroImages.OpenPdfSource(imageId);
		}

		public void OpenPaperImageLibrary()
		{
			try
			{
				string tempRoot = Path.GetFullPath(Path.GetTempPath());
				string libraryPath = Path.GetFullPath(Path.Combine(tempRoot, "pdf-image-saver", "paper-image-library-view", "paper-image-library.html"));
				string allowedRoot = Path.GetFullPath(Path.Combine(tempRoot, "pdf-image-saver", "paper-image-library-view")) + Path.DirectorySeparatorChar;
				if (!libraryPath.StartsWith(allowedRoot, StringComparison.OrdinalIgnoreCase) || !string.Equals(Path.GetFileName(libraryPath), "paper-image-library.html", StringComparison.OrdinalIgnoreCase))
				{
					throw new InvalidOperationException("论文图片库路径校验失败。");
				}
				ZoteroBridgeResult refresh = zoteroImages.RefreshFullLibrary();
				if (refresh.Success)
				{
					if (!File.Exists(libraryPath))
					{
						NotifyUi("Zotero 已刷新论文图片库，但未找到生成页面。请在 Zotero 中点击“全部图库”后重试。", isError: true);
						return;
					}
					Process.Start(new ProcessStartInfo(libraryPath) { UseShellExecute = true });
					NotifyUi("已刷新并打开 Zotero 论文图片库。");
					return;
				}
				if (File.Exists(libraryPath))
				{
					Process.Start(new ProcessStartInfo(libraryPath) { UseShellExecute = true });
					NotifyUi("Zotero 当前未运行或连接未就绪，已只读打开上次生成的论文图片库；内容无法刷新，可能不是最新。");
					return;
				}
				NotifyUi("尚未生成论文图片库。请启动 Zotero，在 PDF 阅读器中点击“全部图库”，或通过 Zotero 菜单打开全部论文图片库后重试。", isError: true);
			}
			catch (Exception ex)
			{
				AddInLogger.Error("打开 Zotero 论文图片库失败。", ex);
				NotifyUi("打开论文图片库失败：" + ex.Message, isError: true);
			}
		}
    
    	public string SelectZoteroImageItem(string imageId)
    	{
    		return zoteroImages.SelectParentItem(imageId);
    	}
    
    	public string CopyZoteroTraceIds(string imageId)
    	{
    		return zoteroImages.CopyTraceIds(imageId);
    	}
    
    	public string CopyZoteroSwatchHex(string hex)
    	{
    		return zoteroImages.CopySwatchHex(hex);
    	}
    
    	public string ApplyZoteroSwatch(ZoteroSwatchInfo swatch, string target)
    	{
    		if (swatch == null || string.IsNullOrWhiteSpace(swatch.Hex))
    		{
    			throw new InvalidOperationException("色块 HEX 无效。");
    		}
    		string hex = NormalizeHex(swatch.Hex);
    		string normalizedTarget = (target ?? "fill").Trim().ToLowerInvariant();
    		RoughStyle style = CloneRoughStyle(currentRoughStyle ?? new RoughStyle());
    		switch (normalizedTarget)
    		{
    		case "stroke":
    		{
    			style.Stroke = hex;
    			currentRoughStyle = style;
    			ApplyColorToSelection(hex, "stroke");
    			int num2 = UpdateSelectionStyle(style);
    			taskPaneControl?.ApplyStyleFromHost(style, "已把 Zotero 色块设为描边：" + hex);
    			if (num2 <= 0)
    			{
    				return "已设为描边：" + hex;
    			}
    			return "已设为描边并重绘选区：" + hex;
    		}
    		case "gradientstart":
    			currentFeatureBlockOptions.StartColor = hex;
    			taskPaneControl?.ApplyFeatureBlockFromHost(currentFeatureBlockOptions, "已把 Zotero 色块设为特征块渐变起点：" + hex);
    			return "已设为渐变起点：" + hex;
    		case "gradientend":
    			currentFeatureBlockOptions.EndColor = hex;
    			taskPaneControl?.ApplyFeatureBlockFromHost(currentFeatureBlockOptions, "已把 Zotero 色块设为特征块渐变终点：" + hex);
    			return "已设为渐变终点：" + hex;
    		default:
    		{
    			style.FillMode = "solid";
    			style.FillColor = hex;
    			currentRoughStyle = style;
    			ApplyColorToSelection(hex, "fill");
    			int num = UpdateSelectionStyle(style);
    			taskPaneControl?.ApplyStyleFromHost(style, "已把 Zotero 色块设为填充：" + hex);
    			if (num <= 0)
    			{
    				return "已设为填充：" + hex;
    			}
    			return "已设为填充并重绘选区：" + hex;
    		}
    		}
    	}
    
    	public IList<PaletteSchemeInfo> ListPaletteSchemes()
    	{
    		return palettes.ListPalettes(application);
    	}
    
		public PaletteSchemeInfo SaveCurrentZoteroPalette(string imageId, string sourceTitle)
		{
			return palettes.SaveZoteroPalette(zoteroImages.GetPaletteByImageId(imageId), imageId, sourceTitle);
		}
    
    	public PaletteSchemeInfo ExtractPaletteFromClipboardImage()
    	{
    		return palettes.ExtractFromClipboardImage();
    	}
    
    	public PaletteSchemeInfo ExtractPaletteFromCurrentSlide()
    	{
    		return palettes.ExtractFromCurrentSlide(application);
    	}
    
    	public PaletteSchemeInfo DeletePalette(string paletteId)
    	{
    		return palettes.DeletePalette(paletteId);
    	}
    
    	public string ExportPalettes(IList<string> paletteIds = null)
    	{
    		using SaveFileDialog dialog = new SaveFileDialog();
    		dialog.Title = "分享 Rough 配色包";
    		dialog.Filter = "Rough 配色分享包 (*.zip)|*.zip";
    		dialog.FileName = "rough-share-palettes-" + DateTime.Now.ToString("yyyyMMddHHmmss") + ".zip";
    		if (dialog.ShowDialog() != DialogResult.OK)
    		{
    			return null;
    		}
    		return palettes.ExportPalettes(dialog.FileName, paletteIds);
    	}
    
    	public IList<PaletteSchemeInfo> ImportPalettes()
    	{
    		using OpenFileDialog dialog = new OpenFileDialog();
    		dialog.Title = "导入 Rough 配色分享包";
    		dialog.Filter = "Rough 配色分享包 (*.zip)|*.zip";
    		if (dialog.ShowDialog() != DialogResult.OK)
    		{
    			return new List<PaletteSchemeInfo>();
    		}
    		return palettes.ImportPalettes(dialog.FileName);
    	}
    
    	public string ApplyPaletteLayout(PaletteLayoutInfo layout)
    	{
    		if (layout == null)
    		{
    			throw new InvalidOperationException("配色布局无效。");
    		}
    		string stroke = NormalizeHex(layout.StrokeHex);
    		string fill = NormalizeHex(layout.FillHex);
    		string start = NormalizeHex(layout.FeatureStartHex);
    		string end = NormalizeHex(layout.FeatureEndHex);
    		RoughStyle style = CloneRoughStyle(currentRoughStyle ?? new RoughStyle());
    		style.Stroke = stroke;
    		style.FillMode = "solid";
    		style.FillColor = fill;
    		currentRoughStyle = style;
    		currentFeatureBlockOptions.StartColor = start;
    		currentFeatureBlockOptions.EndColor = end;
    		ApplyPaletteColorsToSelection(layout, stroke, fill);
    		int num = UpdateSelectionStyle(style);
    		taskPaneControl?.ApplyStyleFromHost(style, "已应用配色布局：" + (layout.DisplayName ?? layout.Id));
    		taskPaneControl?.ApplyFeatureBlockFromHost(currentFeatureBlockOptions, "已同步配色到特征块渐变。");
    		if (num <= 0)
    		{
    			return "已应用配色布局：" + (layout.DisplayName ?? layout.Id);
    		}
    		return "已应用配色布局并重绘选区：" + (layout.DisplayName ?? layout.Id);
    	}
    
    	public Task<ZlkChartRenderResult> PlotZlkClusterAsync(ZlkClusterPlotRequest request)
    	{
    		return RunOnUiThreadAsync(() => PlotZlkClusterOnUiAsync(request));
    	}
    
    	public ZlkChartRenderResult InsertZlkChart(ChartDataset dataset, ZlkChartSpec spec, ZlkClusterPlotRequest request)
    	{
    		dataset = dataset ?? new ChartDataset();
    		spec = spec ?? BuildDefaultZlkChartSpec(dataset, request?.ChartType);
    		if (string.Equals(request?.ChartType, "auto", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(request?.ChartType))
    		{
    			spec = BuildDefaultZlkChartSpec(dataset, spec.ChartType);
    		}
    		bool hasExplicitTarget = request?.Target != null && (!string.IsNullOrWhiteSpace(request.Target.PresentationPath) || request.Target.CreateIfMissing);
    		bool num = !string.IsNullOrWhiteSpace(request?.RequestId) || hasExplicitTarget;
    		List<string> warnings = new List<string>();
    		Presentation presentation;
    		bool saveAfterRender;
    		Slide slide;
    		if (num)
    		{
    			presentation = ResolveTargetPresentation(request?.Target, warnings, out saveAfterRender);
    			slide = presentation.Slides.Add(presentation.Slides.Count + 1, PpSlideLayout.ppLayoutBlank);
    		}
    		else
    		{
    			slide = GetCurrentSlide();
    			if (slide == null)
    			{
    				presentation = application.Presentations.Add();
    				slide = presentation.Slides.Add(presentation.Slides.Count + 1, PpSlideLayout.ppLayoutBlank);
    			}
    			else
    			{
    				presentation = (Presentation)slide.Parent;
    			}
    			saveAfterRender = false;
    		}
    		ZlkChartRenderResult result = zlkCharts.Render(slide, dataset, spec, currentRoughStyle ?? new RoughStyle(), currentFeatureBlockOptions ?? new FeatureBlockOptions());
    		result.Warnings.InsertRange(0, warnings);
    		result.PresentationPath = PresentationPath(presentation);
    		result.SlideIndex = slide.SlideIndex;
    		if (saveAfterRender)
    		{
    			presentation.Save();
    			result.PresentationPath = PresentationPath(presentation);
    		}
    		taskPaneControl?.ShowZlkAutomationStatus("已完成外部自动绘图：" + result.ChartType + "，第 " + result.SlideIndex + " 页，" + result.ShapeCount + " 个对象。");
    		return result;
    	}
    
    	private void StartAutomationServer()
    	{
    		try
    		{
    			automationServer = new AutomationServer(PlotZlkClusterAsync);
    			automationServer.Start();
			taskPaneControl?.ShowZlkAutomationStatus("SimpleExperiment 自动绘图服务已启动：" + automationServer.Endpoint);
    		}
    		catch (Exception ex)
    		{
			AddInLogger.Error("启动 SimpleExperiment 自动绘图服务失败。", ex);
			taskPaneControl?.ShowZlkAutomationStatus("SimpleExperiment 自动绘图服务启动失败：" + ex.Message, isError: true);
    		}
    	}
    
    	private Task<ZlkChartRenderResult> PlotZlkClusterOnUiAsync(ZlkClusterPlotRequest request)
    	{
    		request = request ?? new ZlkClusterPlotRequest();
    		if (string.IsNullOrWhiteSpace(request.RequestId))
    		{
    			request.RequestId = "zlk-" + Guid.NewGuid().ToString("N");
    		}
    		if (string.IsNullOrWhiteSpace(request.ChartType))
    		{
    			request.ChartType = "auto";
    		}
    		if (string.IsNullOrWhiteSpace(request.StyleMode))
    		{
    			request.StyleMode = "activePpt";
    		}
    		IList<ZlkPlotSourceFile> files = CollectZlkSourceFiles(request);
    		if (files.Count == 0)
    		{
			throw new InvalidOperationException("未找到可导入的 SimpleExperiment 结果文件。请检查 projectRoot、sourcePaths 或输出契约路径。");
    		}
    		return EnsureTaskPane(visible: false).NormalizeAndInsertZlkChartAsync(request, files);
    	}
    
    	private Task<T> RunOnUiThreadAsync<T>(Func<Task<T>> action)
    	{
    		if (action == null)
    		{
    			throw new ArgumentNullException("action");
    		}
    		if (dispatcher.IsDisposed)
    		{
    			throw new InvalidOperationException("PowerPoint 插件正在关闭，无法执行自动绘图。");
    		}
    		if (!dispatcher.InvokeRequired)
    		{
    			return action();
    		}
    		TaskCompletionSource<T> completion = new TaskCompletionSource<T>();
    		dispatcher.BeginInvoke((Action)async delegate
    		{
    			try
    			{
    				TaskCompletionSource<T> taskCompletionSource = completion;
    				taskCompletionSource.SetResult(await action().ConfigureAwait(continueOnCapturedContext: true));
    			}
    			catch (Exception exception)
    			{
    				completion.SetException(exception);
    			}
    		});
    		return completion.Task;
    	}
    
    	private IList<ZlkPlotSourceFile> CollectZlkSourceFiles(ZlkClusterPlotRequest request)
    	{
    		List<ZlkPlotSourceFile> result = new List<ZlkPlotSourceFile>();
    		HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    		string projectRoot = ResolveProjectRoot(request.ProjectRoot);
    		long totalBytes = 0L;
    		IList<string> list;
    		if (request.SourcePaths == null || request.SourcePaths.Count <= 0)
    		{
    			list = DefaultZlkSourcePatterns();
    		}
    		else
    		{
    			IList<string> sourcePaths = request.SourcePaths;
    			list = sourcePaths;
    		}
    		foreach (string source in list)
    		{
    			foreach (string fullPath in ExpandZlkSourcePath(projectRoot, source))
    			{
    				if (string.IsNullOrWhiteSpace(fullPath) || !File.Exists(fullPath))
    				{
    					continue;
    				}
    				string resolved = Path.GetFullPath(fullPath);
    				if (seen.Add(resolved))
    				{
    					if (result.Count >= 64)
    					{
    						throw new InvalidOperationException("ZLK 绘图源文件过多，已超过 " + 64 + " 个。请缩小 sourcePaths 或先汇总结果后再绘图。");
    					}
    					FileInfo fileInfo = new FileInfo(resolved);
    					if (fileInfo.Length > 2097152)
    					{
    						throw new InvalidOperationException("ZLK 绘图源文件过大：" + ToRelativeDisplayPath(projectRoot, resolved) + "，超过 " + FormatBytes(2097152L) + "。请传入轻量 summary、statistics 或表格文件。");
    					}
    					if (totalBytes + fileInfo.Length > 12582912)
    					{
    						throw new InvalidOperationException("ZLK 绘图源文件总量过大，已超过 " + FormatBytes(12582912L) + "。请减少 sourcePaths 或导出轻量结果。");
    					}
    					totalBytes += fileInfo.Length;
    					result.Add(new ZlkPlotSourceFile
    					{
    						SourcePath = ToRelativeDisplayPath(projectRoot, resolved),
    						FullPath = resolved,
    						Content = File.ReadAllText(resolved, Encoding.UTF8)
    					});
    				}
    			}
    		}
    		return result;
    	}
    
    	private static string ResolveProjectRoot(string projectRoot)
    	{
    		if (!string.IsNullOrWhiteSpace(projectRoot))
    		{
    			return Path.GetFullPath(Environment.ExpandEnvironmentVariables(projectRoot));
    		}
    		return Directory.GetCurrentDirectory();
    	}
    
    	private static IEnumerable<string> ExpandZlkSourcePath(string projectRoot, string source)
    	{
    		if (string.IsNullOrWhiteSpace(source))
    		{
    			yield break;
    		}
    		string expanded = Environment.ExpandEnvironmentVariables(source.Replace('/', Path.DirectorySeparatorChar));
    		string basePath = (Path.IsPathRooted(expanded) ? expanded : Path.Combine(projectRoot, expanded));
    		if (Directory.Exists(basePath))
    		{
    			foreach (string item in DiscoverZlkFiles(basePath))
    			{
    				yield return item;
    			}
    		}
    		else if (File.Exists(basePath))
    		{
    			yield return basePath;
    		}
    		else
    		{
    			if (expanded.IndexOf('*') < 0 && expanded.IndexOf('?') < 0)
    			{
    				yield break;
    			}
    			string obj = (Path.IsPathRooted(expanded) ? expanded : Path.Combine(projectRoot, expanded));
    			string wildcardRoot = WildcardRoot(obj);
    			string fileName = Path.GetFileName(obj);
    			foreach (string item2 in Directory.Exists(wildcardRoot) ? Directory.EnumerateFiles(wildcardRoot, fileName, SearchOption.AllDirectories) : Enumerable.Empty<string>())
    			{
    				yield return item2;
    			}
    		}
    	}
    
    	private static string WildcardRoot(string pattern)
    	{
    		int marker = pattern.IndexOfAny(new char[2] { '*', '?' });
    		if (marker < 0)
    		{
    			return Path.GetDirectoryName(pattern);
    		}
    		string prefix = pattern.Substring(0, marker);
    		string root = (prefix.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal) ? prefix.TrimEnd(Path.DirectorySeparatorChar) : Path.GetDirectoryName(prefix));
    		while (!string.IsNullOrWhiteSpace(root) && !Directory.Exists(root))
    		{
    			root = Path.GetDirectoryName(root);
    		}
    		if (!string.IsNullOrWhiteSpace(root))
    		{
    			return root;
    		}
    		return Directory.GetCurrentDirectory();
    	}
    
    	private static IEnumerable<string> DiscoverZlkFiles(string root)
    	{
		string[] array = new string[1] { "zlk_cluster\\results\\statistics.json" };
    		foreach (string relative in array)
    		{
    			string path = Path.Combine(root, relative);
    			if (File.Exists(path))
    			{
    				yield return path;
    			}
    		}
		array = new string[1] { "paper\\tables" };
    		foreach (string dir in array)
    		{
    			string full = Path.Combine(root, dir);
    			if (!Directory.Exists(full))
    			{
    				continue;
    			}
    			foreach (string item in Directory.EnumerateFiles(full, "*.csv"))
    			{
    				yield return item;
    			}
    			foreach (string item2 in Directory.EnumerateFiles(full, "*.tex"))
    			{
    				yield return item2;
    			}
    		}
		array = new string[5] { "zlk_cluster\\results\\summary.json", "zlk_cluster\\results\\result_registry.json", "zlk_cluster\\results\\quality_gate.json", "zlk_cluster\\results\\case_level_index.json", "zlk_cluster\\datasets\\profile.json" };
		foreach (string relative2 in array)
		{
			string path2 = Path.Combine(root, relative2);
			if (File.Exists(path2))
			{
				yield return path2;
			}
		}
		string experimentsResults = Path.Combine(root, "experiments\\results");
		if (Directory.Exists(experimentsResults))
		{
			foreach (string item3 in Directory.EnumerateFiles(experimentsResults, "*.csv"))
			{
				yield return item3;
			}
			foreach (string item4 in Directory.EnumerateFiles(experimentsResults, "*.tex"))
			{
				yield return item4;
			}
		}
    		string workDirs = Path.Combine(root, "work_dirs");
    		if (!Directory.Exists(workDirs))
    		{
    			yield break;
    		}
		foreach (string item5 in Directory.EnumerateFiles(workDirs, "metrics_summary.csv", SearchOption.AllDirectories))
    		{
			yield return item5;
    		}
		foreach (string item6 in Directory.EnumerateFiles(workDirs, "metrics_case.csv", SearchOption.AllDirectories))
    		{
			yield return item6;
    		}
    	}
    
    	private static string FormatBytes(long bytes)
    	{
    		if (bytes < 1024)
    		{
    			return bytes + " B";
    		}
    		if (bytes < 1048576)
    		{
    			return ((double)bytes / 1024.0).ToString("0.#", CultureInfo.InvariantCulture) + " KB";
    		}
    		return ((double)bytes / 1024.0 / 1024.0).ToString("0.#", CultureInfo.InvariantCulture) + " MB";
    	}
    
    	private static IList<string> DefaultZlkSourcePatterns()
    	{
		return new List<string> { "zlk_cluster\\results\\statistics.json", "paper\\tables", "zlk_cluster\\results\\summary.json", "zlk_cluster\\results\\result_registry.json", "zlk_cluster\\results\\quality_gate.json", "zlk_cluster\\results\\case_level_index.json", "zlk_cluster\\datasets\\profile.json", "experiments\\results", "work_dirs" };
    	}

	public void ShowResearchChartStudio()
	{
		try
		{
			if (researchChartStudioWindow == null || researchChartStudioWindow.IsDisposed)
			{
				researchChartStudioWindow = new ResearchChartStudioWindow(GetPowerPointWindowHandle, delegate(string message, bool isError)
				{
					NotifyUi(message, isError);
				}, InsertZlkChart, InsertResearchSvg);
			}
			researchChartStudioWindow.ShowAlongsidePowerPoint();
		}
		catch (Exception ex)
		{
			AddInLogger.Error("打开科研绘图工作区失败。", ex);
			NotifyUi("打开科研绘图工作区失败：" + ex.Message, isError: true);
		}
	}

	private string InsertResearchSvg(ResearchSvgDocument document)
	{
		return ResearchChartStudioService.InsertIntoCurrentSlide(application, document);
	}
    
    	private static string ToRelativeDisplayPath(string root, string path)
    	{
    		try
    		{
    			Uri uri = new Uri(AppendDirectorySeparator(Path.GetFullPath(root)));
    			Uri pathUri = new Uri(Path.GetFullPath(path));
    			return Uri.UnescapeDataString(uri.MakeRelativeUri(pathUri).ToString()).Replace('\\', '/');
    		}
    		catch
    		{
    			return path;
    		}
    	}
    
    	private static string AppendDirectorySeparator(string path)
    	{
    		if (!path.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal))
    		{
    			return path + Path.DirectorySeparatorChar;
    		}
    		return path;
    	}
    
    	private Presentation ResolveTargetPresentation(ZlkPlotTarget target, IList<string> warnings, out bool saveAfterRender)
    	{
    		saveAfterRender = false;
    		target = target ?? new ZlkPlotTarget();
    		string presentationPath = Environment.ExpandEnvironmentVariables(target.PresentationPath ?? string.Empty);
    		if (string.IsNullOrWhiteSpace(presentationPath))
    		{
    			return application.Presentations.Add();
    		}
    		presentationPath = Path.GetFullPath(presentationPath);
    		for (int i = 1; i <= application.Presentations.Count; i++)
    		{
    			Presentation candidate = application.Presentations[i];
    			if (string.Equals(PresentationPath(candidate), presentationPath, StringComparison.OrdinalIgnoreCase))
    			{
    				warnings?.Add("目标 PPT 已打开，已追加页面但未强制保存已有窗口。");
    				return candidate;
    			}
    		}
    		if (File.Exists(presentationPath))
    		{
    			saveAfterRender = true;
    			return application.Presentations.Open(presentationPath);
    		}
    		if (target.CreateIfMissing)
    		{
    			Directory.CreateDirectory(Path.GetDirectoryName(presentationPath));
    			Presentation presentation = application.Presentations.Add();
    			presentation.SaveAs(presentationPath);
    			saveAfterRender = true;
    			return presentation;
    		}
    		throw new FileNotFoundException("目标 PPT 不存在，且 createIfMissing 未开启。", presentationPath);
    	}
    
    	private static string PresentationPath(Presentation presentation)
    	{
    		try
    		{
    			return presentation?.FullName ?? string.Empty;
    		}
    		catch
    		{
    			return string.Empty;
    		}
    	}
    
    	private static ZlkChartSpec BuildDefaultZlkChartSpec(ChartDataset dataset, string requestedChartType)
    	{
    		string requested = (string.IsNullOrWhiteSpace(requestedChartType) ? "auto" : requestedChartType.Trim());
    		ChartRecommendation recommendation = null;
    		if (!string.Equals(requested, "auto", StringComparison.OrdinalIgnoreCase))
    		{
    			recommendation = dataset?.Recommendations?.FirstOrDefault((ChartRecommendation item) => string.Equals(item.ChartType, requested, StringComparison.OrdinalIgnoreCase));
    			return new ZlkChartSpec
    			{
    				ChartType = requested,
    				Title = (recommendation?.Title ?? ChartTypeTitle(requested)),
    				Reason = (recommendation?.Reason ?? "外部请求指定图表类型。")
    			};
    		}
    		recommendation = dataset?.Recommendations?.OrderByDescending((ChartRecommendation item) => item.Priority).FirstOrDefault();
    		return new ZlkChartSpec
    		{
    			ChartType = (recommendation?.ChartType ?? "genericTable"),
    			Title = (recommendation?.Title ?? ChartTypeTitle(recommendation?.ChartType)),
    			Reason = (recommendation?.Reason ?? "自动选择最高优先级图表建议。")
    		};
    	}
    
    	private static string ChartTypeTitle(string chartType)
    	{
    		return (chartType ?? string.Empty) switch
    		{
    			"meanStdErrorBar" => "均值误差图", 
    			"leaderboardBar" => "排行榜柱状图", 
    			"sensitivityCurve" => "敏感性曲线", 
    			"subgroupComparison" => "亚组对比图", 
    			"caseLevelDistribution" => "病例级分布图", 
    			"errorTypeSummary" => "错误类型汇总图", 
    			_ => "结果表格", 
    		};
    	}
    
    	public Dictionary<string, object> GetSelectionState()
    	{
    		Dictionary<string, object> state = new Dictionary<string, object>
    		{
    			["type"] = "selectionState",
    			["isRough"] = false,
    			["status"] = "未选择形状。"
    		};
    		if (!TryGetSelection(out var selection, out var reason))
    		{
    			state["status"] = reason;
    			return state;
    		}
    		if (selection.ShapeRange.Count != 1)
    		{
    			state["status"] = "已选择多个形状。";
    			state["shapeCount"] = selection.ShapeRange.Count;
    			return state;
    		}
    		Microsoft.Office.Interop.PowerPoint.Shape shape = selection.ShapeRange[1];
    		state["shapeName"] = shape.Name;
    		state["shapeType"] = Convert.ToString(shape.Type);
    		state["nativeOnly"] = shape.Type != MsoShapeType.msoPicture;
    		if (featureBlocks.TryReadOptions(shape, out var featureOptions))
    		{
    			state["isFeatureBlock"] = true;
    			state["status"] = "特征块：可回填参数并按当前面板更新。";
    			state["featureBlock"] = featureOptions;
    			state["bounds"] = new Dictionary<string, object>
    			{
    				["left"] = shape.Left,
    				["top"] = shape.Top,
    				["width"] = shape.Width,
    				["height"] = shape.Height
    			};
    			return state;
    		}
    		if (!metadata.TryRead(shape, out var request))
    		{
    			state["status"] = "普通 PPT 对象。";
    			return state;
    		}
    		styleSynchronizer.Capture(shape, request);
    		styleSynchronizer.ApplyStructuralDefaults(shape, request);
    		state["isRough"] = true;
    		state["status"] = "Rough 原生组：可重绘元数据完整。";
    		state["assetId"] = request.AssetId;
    		state["groupId"] = request.GroupId;
    		state["sourceMsoType"] = request.SourceMsoType;
    		state["shapeKind"] = request.ShapeKind;
    		state["bounds"] = new Dictionary<string, object>
    		{
    			["left"] = request.Left,
    			["top"] = request.Top,
    			["width"] = request.Width,
    			["height"] = request.Height
    		};
    		state["style"] = request.Style;
    		return state;
    	}
    
    	private bool TryGetSelectedFeatureBlock(out Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		shape = null;
    		if (!TryGetSelection(out var selection, out var _))
    		{
    			return false;
    		}
    		try
    		{
    			if (selection.ShapeRange.Count != 1)
    			{
    				return false;
    			}
    			Microsoft.Office.Interop.PowerPoint.Shape candidate = selection.ShapeRange[1];
    			if (!featureBlocks.IsFeatureBlock(candidate))
    			{
    				return false;
    			}
    			shape = candidate;
    			return true;
    		}
    		catch
    		{
    			return false;
    		}
    	}
    
    	private bool TryGetSelection(out Selection selection, out string reason)
    	{
    		selection = null;
    		reason = "未选择形状。";
    		try
    		{
    			DocumentWindow window = application.ActiveWindow;
    			if (window == null)
    			{
    				reason = "当前没有活动 PowerPoint 窗口。";
    				return false;
    			}
    			selection = window.Selection;
    			if (selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
    			{
    				reason = "未选择形状。";
    				return false;
    			}
    			return true;
    		}
    		catch (COMException)
    		{
    			selection = null;
    			reason = "当前没有可读取的形状选区。";
    			return false;
    		}
    		catch (InvalidCastException)
    		{
    			selection = null;
    			reason = "当前选区不是形状对象。";
    			return false;
    		}
    	}
    
    	public void InsertUserAsset(string assetId)
    	{
    		selectionCapture.InsertAsset(assetId);
    	}
    
    	public UserAssetInfo DeleteUserAsset(string assetId)
    	{
    		return selectionCapture.DeleteAsset(assetId);
    	}
    
    	public string ExportUserAssets(IList<string> assetIds = null)
    	{
    		using SaveFileDialog dialog = new SaveFileDialog();
    		dialog.Title = "分享 Rough 素材包";
    		dialog.Filter = "Rough 分享素材包 (*.zip)|*.zip";
    		dialog.FileName = "rough-share-assets-" + DateTime.Now.ToString("yyyyMMddHHmmss") + ".zip";
    		if (dialog.ShowDialog() != DialogResult.OK)
    		{
    			return null;
    		}
    		return selectionCapture.ExportUserAssets(dialog.FileName, assetIds);
    	}
    
    	public UserAssetImportResult ImportUserAssets()
    	{
    		using OpenFileDialog dialog = new OpenFileDialog();
    		dialog.Title = "导入 Rough 分享素材包";
    		dialog.Filter = "Rough 分享素材包 (*.zip)|*.zip";
    		if (dialog.ShowDialog() != DialogResult.OK)
    		{
    			return new UserAssetImportResult
    			{
    				Cancelled = true
    			};
    		}
    		return selectionCapture.ImportUserAssets(dialog.FileName);
    	}
    
    	public string DescribeUserAssetImport(UserAssetImportResult result)
    	{
    		if (result == null || result.Cancelled)
    		{
    			return "已取消导入素材包。";
    		}
    		if (result.SkippedDuplicateCount > 0)
    		{
    			if (result.Imported.Count <= 0)
    			{
    				return "未导入新素材，已跳过重复：" + result.SkippedDuplicateCount + " 个。";
    			}
    			return "已导入素材：" + result.Imported.Count + " 个，跳过重复：" + result.SkippedDuplicateCount + " 个。";
    		}
    		return "已导入素材：" + result.Imported.Count + " 个。";
    	}
    
    	public void Dispose()
    	{
    		automationServer?.Dispose();
    		application.WindowSelectionChange -= OnWindowSelectionChange;
    		regenerator?.Dispose();
    		usageGuideWindow?.Dispose();
		researchChartStudioWindow?.Dispose();
    		taskPaneControl?.Dispose();
    		dispatcher.Dispose();
    	}
    
    	private void OnWindowSelectionChange(Selection selection)
    	{
    		regenerator?.RememberSelection(selection);
    		taskPaneControl?.SendSelectionState();
    	}
    
    	private Slide GetCurrentSlide()
    	{
    		return application.ActiveWindow?.View?.Slide as Slide;
    	}
    
    	private Microsoft.Office.Interop.PowerPoint.Shape FindChildByRole(Microsoft.Office.Interop.PowerPoint.Shape shape, string role)
    	{
    		if (shape == null)
    		{
    			return null;
    		}
    		if (metadata.ReadRole(shape) == role)
    		{
    			return shape;
    		}
    		if (shape.Type != MsoShapeType.msoGroup)
    		{
    			return null;
    		}
    		for (int i = 1; i <= shape.GroupItems.Count; i++)
    		{
    			Microsoft.Office.Interop.PowerPoint.Shape child = shape.GroupItems[i];
    			if (metadata.ReadRole(child) == role)
    			{
    				return child;
    			}
    		}
    		return null;
    	}
    
    	private RoughShapeRequest CreateDefaultRequest(string sourceMsoType)
    	{
    		float slideWidth = application.ActivePresentation?.PageSetup?.SlideWidth ?? 960f;
    		float slideHeight = application.ActivePresentation?.PageSetup?.SlideHeight ?? 540f;
    		return new RoughShapeRequest
    		{
    			AssetId = "rough-" + sourceMsoType,
    			SourceMsoType = sourceMsoType,
    			ShapeKind = ShapeKindMapper.FromMsoType(sourceMsoType),
    			Width = (UsesZeroHeightLineDefault(sourceMsoType) ? 180 : 140),
    			Height = ((!UsesZeroHeightLineDefault(sourceMsoType)) ? 90 : 0),
    			Left = slideWidth / 2f - 70f,
    			Top = slideHeight / 2f - 45f
    		};
    	}
    
    	private static FeatureBlockOptions CloneFeatureBlockOptions(FeatureBlockOptions options)
    	{
    		options = options ?? new FeatureBlockOptions();
    		return new FeatureBlockOptions
    		{
    			Mode = options.Mode,
    			VisualStyle = options.VisualStyle,
    			CountX = options.CountX,
    			CountY = options.CountY,
    			CountZ = options.CountZ,
    			BlockWidthPt = options.BlockWidthPt,
    			BlockHeightPt = options.BlockHeightPt,
    			BlockDepthPt = options.BlockDepthPt,
    			GapPt = options.GapPt,
    			Roundness = options.Roundness,
    			StartColor = options.StartColor,
    			EndColor = options.EndColor,
    			StrokeColor = options.StrokeColor,
    			StrokeWidthPt = options.StrokeWidthPt,
    			GradientDirection = options.GradientDirection,
    			GradientReverse = options.GradientReverse,
    			GradientAmount = options.GradientAmount,
    			EditDirection = string.Empty,
    			EditDelta = 0
    		};
    	}
    
    	private static bool ApplyFeatureBlockShortcutPatch(string shortcutId, FeatureBlockOptions options)
    	{
    		if (options == null)
    		{
    			return false;
    		}
    		options.EditDirection = string.Empty;
    		options.EditDelta = 0;
    		switch (shortcutId ?? string.Empty)
    		{
    		case "featurePreset2DGrid":
    			ApplyFeatureBlockDefaults(options, "2d", "plain", 3, 3, 1);
    			return true;
    		case "featurePreset3DStack":
    			ApplyFeatureBlockDefaults(options, "3d", "plain", 3, 3, 3);
    			return true;
    		case "featurePreset2DRoughGrid":
    			ApplyFeatureBlockDefaults(options, "2d", "rough", 3, 3, 1);
    			return true;
    		case "featurePreset3DRoughStack":
    			ApplyFeatureBlockDefaults(options, "3d", "rough", 3, 3, 3);
    			return true;
    		case "featurePresetPaperMatrix":
    			ApplyFeatureBlockDefaults(options, "2d", "plain", 4, 4, 1);
    			ApplyFeatureBlockPaperPalette(options, 18f, 16f, 10f, 1f, "#d7ecff", "#6aa6ff", "xy");
    			return true;
    		case "featurePresetPaperStrip":
    			ApplyFeatureBlockDefaults(options, "2d", "plain", 6, 2, 1);
    			ApplyFeatureBlockPaperPalette(options, 22f, 14f, 10f, 2f, "#eef2ff", "#8b9cff", "x");
    			return true;
    		case "featurePresetPaperVolume":
    			ApplyFeatureBlockDefaults(options, "3d", "plain", 4, 3, 3);
    			ApplyFeatureBlockPaperPalette(options, 20f, 16f, 10f, 0f, "#d9fbe8", "#4f9cff", "diag");
    			return true;
    		case "featurePresetAttentionMap":
    			ApplyFeatureBlockDefaults(options, "2d", "plain", 5, 5, 1);
    			ApplyFeatureBlockPaperPalette(options, 14f, 14f, 8f, 0f, "#fff2cc", "#ff8fb3", "diag");
    			return true;
    		case "featureGapZero":
    			options.GapPt = 0f;
    			return true;
    		case "featureGapFour":
    			options.GapPt = 4f;
    			return true;
    		case "featureNoRound":
    			options.Roundness = 0f;
    			return true;
    		case "featureReverseGradient":
    			options.GradientReverse = !options.GradientReverse;
    			return true;
    		default:
    			return false;
    		}
    	}
    
    	private static void ApplyFeatureBlockPaperPalette(FeatureBlockOptions options, float width, float height, float depth, float gap, string startColor, string endColor, string gradientDirection)
    	{
    		options.BlockWidthPt = width;
    		options.BlockHeightPt = height;
    		options.BlockDepthPt = depth;
    		options.GapPt = gap;
    		options.Roundness = 0f;
    		options.StartColor = startColor;
    		options.EndColor = endColor;
    		options.StrokeColor = "#000000";
    		options.StrokeWidthPt = 0.8f;
    		options.GradientDirection = gradientDirection;
    		options.GradientReverse = false;
    		options.GradientAmount = 1.0;
    	}
    
    	private static void ApplyFeatureBlockDefaults(FeatureBlockOptions options, string mode, string visualStyle, int countX, int countY, int countZ)
    	{
    		options.Mode = mode;
    		options.VisualStyle = visualStyle;
    		options.CountX = countX;
    		options.CountY = countY;
    		options.CountZ = countZ;
    		options.GapPt = 0f;
    		options.Roundness = 0f;
    		options.StrokeColor = "#000000";
    		if (string.Equals(mode, "2d", StringComparison.OrdinalIgnoreCase) && string.Equals(options.GradientDirection, "z", StringComparison.OrdinalIgnoreCase))
    		{
    			options.GradientDirection = "x";
    		}
    	}
    
    	private static string FeatureBlockShortcutLabel(string shortcutId)
    	{
    		return (shortcutId ?? string.Empty) switch
    		{
    			"featurePreset2DGrid" => "二维 3x3", 
    			"featurePreset3DStack" => "三维 3x3x3", 
    			"featurePreset2DRoughGrid" => "手绘二维", 
    			"featurePreset3DRoughStack" => "手绘三维", 
    			"featurePresetPaperMatrix" => "论文矩阵", 
    			"featurePresetPaperStrip" => "长条特征", 
    			"featurePresetPaperVolume" => "体数据块", 
    			"featurePresetAttentionMap" => "注意力图", 
    			"featureGapZero" => "间距 0", 
    			"featureGapFour" => "间距 4", 
    			"featureNoRound" => "无圆角", 
    			"featureReverseGradient" => "反向渐变", 
    			_ => "特征块快捷", 
    		};
    	}
    
    	private void ApplyColorToSelection(string hex, string target)
    	{
    		try
    		{
    			Selection selection = application.ActiveWindow?.Selection;
    			if (selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
    			{
    				return;
    			}
    			int oleColor = ColorTranslator.ToOle(ColorTranslator.FromHtml(NormalizeHex(hex)));
    			for (int i = 1; i <= selection.ShapeRange.Count; i++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape shape = selection.ShapeRange[i];
    				if (string.Equals(target, "stroke", StringComparison.OrdinalIgnoreCase))
    				{
    					shape.Line.ForeColor.RGB = oleColor;
    					shape.Line.Visible = MsoTriState.msoTrue;
    				}
    				else
    				{
    					shape.Fill.ForeColor.RGB = oleColor;
    					shape.Fill.Visible = MsoTriState.msoTrue;
    				}
    			}
    		}
    		catch (Exception exception)
    		{
    			AddInLogger.Error("应用 Zotero 色块到当前选区失败。", exception);
    		}
    	}
    
    	private void ApplyPaletteColorsToSelection(PaletteLayoutInfo layout, string fallbackStroke, string fallbackFill)
    	{
    		try
    		{
    			Selection selection = application.ActiveWindow?.Selection;
    			if (selection?.ShapeRange != null && selection.ShapeRange.Count != 0)
    			{
    				IList<string> fills = NormalizeHexListForApply(layout?.ShapeFillHexes, layout?.ColorHexes, fallbackFill);
    				IList<string> strokes = NormalizeHexListForApply(layout?.ShapeStrokeHexes, null, fallbackStroke);
    				int index = 0;
    				for (int i = 1; i <= selection.ShapeRange.Count; i++)
    				{
    					ApplyPaletteColorsToShape(selection.ShapeRange[i], fills, strokes, ref index);
    				}
    			}
    		}
    		catch (Exception exception)
    		{
    			AddInLogger.Error("应用配色布局到当前选区失败。", exception);
    		}
    	}
    
    	private void ApplyPaletteColorsToShape(Microsoft.Office.Interop.PowerPoint.Shape shape, IList<string> fills, IList<string> strokes, ref int index)
    	{
    		if (shape == null)
    		{
    			return;
    		}
    		if (shape.Type == MsoShapeType.msoGroup)
    		{
    			for (int i = 1; i <= shape.GroupItems.Count; i++)
    			{
    				ApplyPaletteColorsToShape(shape.GroupItems[i], fills, strokes, ref index);
    			}
    			return;
    		}
    		string role = metadata.ReadRole(shape);
    		if (!string.Equals(role, "nativeCarrier", StringComparison.OrdinalIgnoreCase) && !string.Equals(role, "hitArea", StringComparison.OrdinalIgnoreCase))
    		{
    			string stroke = ((strokes.Count > 0) ? strokes[index % strokes.Count] : "#111111");
    			string fill = ((fills.Count > 0) ? fills[index % fills.Count] : "#FFFFFF");
    			if (string.Equals(role, "innerFillBoundary", StringComparison.OrdinalIgnoreCase))
    			{
    				ApplyShapeColor(shape, fill, "fill");
    			}
    			else if (string.Equals(role, "innerBoundary", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "outerJitter", StringComparison.OrdinalIgnoreCase))
    			{
    				ApplyShapeColor(shape, stroke, "stroke");
    			}
    			else if (string.Equals(role, "texture", StringComparison.OrdinalIgnoreCase))
    			{
    				ApplyShapeColor(shape, fill, "stroke");
    			}
    			else
    			{
    				ApplyShapeColor(shape, stroke, "stroke");
    				ApplyShapeColor(shape, fill, "fill");
    			}
    			index++;
    		}
    	}
    
    	private static void ApplyShapeColor(Microsoft.Office.Interop.PowerPoint.Shape shape, string hex, string target)
    	{
    		int oleColor = ColorTranslator.ToOle(ColorTranslator.FromHtml(NormalizeHex(hex)));
    		if (string.Equals(target, "stroke", StringComparison.OrdinalIgnoreCase))
    		{
    			shape.Line.ForeColor.RGB = oleColor;
    			shape.Line.Visible = MsoTriState.msoTrue;
    		}
    		else
    		{
    			shape.Fill.ForeColor.RGB = oleColor;
    			shape.Fill.Visible = MsoTriState.msoTrue;
    		}
    	}
    
    	private static IList<string> NormalizeHexListForApply(IEnumerable<string> primary, IEnumerable<string> fallback, string singleFallback)
    	{
    		List<string> result = (primary ?? new List<string>()).Where(IsHex).Select(NormalizeHex).ToList();
    		if (result.Count == 0)
    		{
    			result = (fallback ?? new List<string>()).Where(IsHex).Select(NormalizeHex).ToList();
    		}
    		if (result.Count == 0)
    		{
    			result.Add(NormalizeHex(singleFallback));
    		}
    		return result;
    	}
    
    	private static bool IsHex(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return false;
    		}
    		string text = value.Trim();
    		if (!text.StartsWith("#", StringComparison.Ordinal))
    		{
    			text = "#" + text;
    		}
    		return Regex.IsMatch(text, "^#[0-9a-fA-F]{6}$");
    	}
    
    	private static string FeatureDirectionLabel(string direction, int delta)
    	{
    		string action = ((delta > 0) ? "增加" : "删除");
    		return (direction ?? string.Empty).Trim().ToLowerInvariant() switch
    		{
    			"left" => action + "左侧列", 
    			"right" => action + "右侧列", 
    			"up" => action + "上方行", 
    			"down" => action + "下方行", 
    			"front" => action + "前方层", 
    			"back" => action + "后方层", 
    			_ => "方向调整", 
    		};
    	}
    
    	private static string NormalizeHex(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return "#000000";
    		}
    		string text = value.Trim();
    		if (!text.StartsWith("#", StringComparison.Ordinal))
    		{
    			text = "#" + text;
    		}
    		if (!Regex.IsMatch(text, "^#[0-9a-fA-F]{6}$"))
    		{
    			return "#000000";
    		}
    		return text.ToUpperInvariant();
    	}
    
    	private static RoughStyle CloneRoughStyle(RoughStyle style)
    	{
    		style = style ?? new RoughStyle();
    		return new RoughStyle
    		{
    			Stroke = style.Stroke,
    			StrokeWidthPt = style.StrokeWidthPt,
    			Roughness = style.Roughness,
    			Bowing = style.Bowing,
    			EdgeJitterPt = style.EdgeJitterPt,
    			MaxRandomnessOffset = style.MaxRandomnessOffset,
    			StrokePasses = style.StrokePasses,
    			CurveSampling = style.CurveSampling,
    			FragmentStrokeDensity = style.FragmentStrokeDensity,
    			RoughEngine = style.RoughEngine,
    			RoughSource = style.RoughSource,
    			FillSource = style.FillSource,
    			FillWeight = style.FillWeight,
    			HachureGap = style.HachureGap,
    			CurveFitting = style.CurveFitting,
    			PreserveVertices = style.PreserveVertices,
    			DisableMultiStroke = style.DisableMultiStroke,
    			DisableMultiStrokeFill = style.DisableMultiStrokeFill,
    			TldrawOffsetPt = style.TldrawOffsetPt,
    			RoughMode = style.RoughMode,
    			NestedLayers = style.NestedLayers,
    			NestedOverlap = style.NestedOverlap,
    			NestedGapPt = style.NestedGapPt,
    			NestedJitterPt = style.NestedJitterPt,
    			NestedDirection = style.NestedDirection,
    			Seed = style.Seed,
    			FillStyle = style.FillStyle,
    			BrushWidthPt = style.BrushWidthPt,
    			BrushDensity = style.BrushDensity,
    			BrushAngleDeg = style.BrushAngleDeg,
    			BrushJitterPt = style.BrushJitterPt,
    			BrushOverlap = style.BrushOverlap,
    			DashStyle = style.DashStyle,
    			ArrowheadStyle = style.ArrowheadStyle,
    			ArrowheadPosition = style.ArrowheadPosition,
    			ArrowheadLengthPt = style.ArrowheadLengthPt,
    			ArrowheadWidthPt = style.ArrowheadWidthPt,
    			StrokeTransparency = style.StrokeTransparency,
    			FillColor = style.FillColor,
    			FillTransparency = style.FillTransparency,
    			FillMode = style.FillMode,
    			NativeStyleVersion = style.NativeStyleVersion
    		};
    	}
    
    	private static string SectionDisplayName(string section)
    	{
    		return (section ?? string.Empty) switch
    		{
    			"catalog" => "形状图库", 
    			"search" => "功能搜索", 
    			"quickInsert" => "快速插入", 
    			"style" => "风格参数", 
    			"featureBlock" => "特征块", 
    			"paperPresets" => "论文图预设", 
    			"library" => "我的素材", 
    			"zoteroImages" => "论文图像与配色库", 
    			"templateApply" => "应用模板", 
    			"templateSave" => "保存模板", 
    			"templateRename" => "重命名模板", 
    			"templateSelect" => "模板选择", 
    			"assetSelect" => "选择素材", 
    			"assetRefresh" => "刷新素材", 
    			"assetImport" => "导入素材包", 
    			"assetShare" => "分享素材包", 
    			_ => "完整参数", 
    		};
    	}
    
    	private RoughShapeRequest CreateRequestFromShape(Microsoft.Office.Interop.PowerPoint.Shape shape, string sourceMsoType, RoughStyle style)
    	{
    		return new RoughShapeRequest
    		{
    			AssetId = "rough-converted-" + sourceMsoType,
    			SourceMsoType = sourceMsoType,
    			ShapeKind = ShapeKindMapper.FromMsoType(sourceMsoType),
    			Left = shape.Left,
    			Top = shape.Top,
    			Width = Math.Max(1f, shape.Width),
    			Height = Math.Max((!IsLineLike(sourceMsoType)) ? 1 : 0, shape.Height),
    			Style = (style ?? new RoughStyle()),
    			Adjustments = CaptureAdjustments(shape)
    		};
    	}
    
    	private static List<float> CaptureAdjustments(Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		List<float> values = new List<float>();
    		try
    		{
    			Microsoft.Office.Interop.PowerPoint.Adjustments adjustments = shape.Adjustments;
    			for (int i = 1; i <= adjustments.Count; i++)
    			{
    				values.Add(adjustments[i]);
    			}
    		}
    		catch
    		{
    		}
    		return values;
    	}
    
    	private static string ResolveSourceMsoType(Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		try
    		{
    			if (shape.Type == MsoShapeType.msoAutoShape || shape.Type == MsoShapeType.msoCallout || shape.Type == MsoShapeType.msoTextBox)
    			{
    				MsoAutoShapeType autoShapeType = shape.AutoShapeType;
    				if (autoShapeType != MsoAutoShapeType.msoShapeMixed)
    				{
    					return Enum.GetName(typeof(MsoAutoShapeType), autoShapeType);
    				}
    			}
    		}
    		catch
    		{
    		}
    		if (shape.Type == MsoShapeType.msoLine)
    		{
    			return ResolveLineSourceMsoType(shape);
    		}
    		return null;
    	}
    
    	private static string ResolveLineSourceMsoType(Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		if (HasArrowhead(shape))
    		{
    			return "msoShapeLineArrow";
    		}
    		try
    		{
    			switch (shape.ConnectorFormat.Type)
    			{
    			case MsoConnectorType.msoConnectorElbow:
    				return "msoShapeElbowConnector";
    			case MsoConnectorType.msoConnectorCurve:
    				return "msoShapeCurvedConnector";
    			case MsoConnectorType.msoConnectorStraight:
    				return "msoShapeStraightConnector";
    			}
    		}
    		catch
    		{
    		}
    		return "msoShapeLine";
    	}
    
    	private static bool HasArrowhead(Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		try
    		{
    			return shape.Line.BeginArrowheadStyle != MsoArrowheadStyle.msoArrowheadNone || shape.Line.EndArrowheadStyle != MsoArrowheadStyle.msoArrowheadNone;
    		}
    		catch
    		{
    			return false;
    		}
    	}
    
    	private static bool IsLineLike(string sourceMsoType)
    	{
    		return ShapeKindMapper.IsLineLike(sourceMsoType);
    	}
    
    	private static void RestoreZOrder(Microsoft.Office.Interop.PowerPoint.Shape shape, int targetPosition)
    	{
    		int guard = 0;
    		while (shape.ZOrderPosition > targetPosition && guard < 512)
    		{
    			shape.ZOrder(MsoZOrderCmd.msoSendBackward);
    			guard++;
    		}
    	}
    
    	private static bool UsesZeroHeightLineDefault(string sourceMsoType)
    	{
    		if (!string.Equals(sourceMsoType, "msoShapeLine", StringComparison.OrdinalIgnoreCase))
    		{
    			return string.Equals(sourceMsoType, "msoShapeStraightConnector", StringComparison.OrdinalIgnoreCase);
    		}
    		return true;
    	}
    }

    public static class ShapeKindMapper
    {
    	public static string FromMsoType(string sourceMsoType)
    	{
    		string name = sourceMsoType ?? string.Empty;
    		if (name.IndexOf("DashedRectangle", StringComparison.OrdinalIgnoreCase) >= 0 || name.IndexOf("DashedBox", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "dashedBox";
    		}
    		if (name.IndexOf("DoubleOval", StringComparison.OrdinalIgnoreCase) >= 0 || name.IndexOf("DoubleCircle", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "doubleCircle";
    		}
    		if (name.IndexOf("Curve", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "curve";
    		}
    		if (IsLineLike(name))
    		{
    			return "line";
    		}
    		if (name.IndexOf("Arrow", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "arrow";
    		}
    		if (name.IndexOf("Oval", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "ellipse";
    		}
    		if (name.IndexOf("Diamond", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "diamond";
    		}
    		if (name.IndexOf("Triangle", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "triangle";
    		}
    		if (name.IndexOf("Rectangle", StringComparison.OrdinalIgnoreCase) >= 0 || name.IndexOf("Rect", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "rectangle";
    		}
    		return "polygon";
    	}
    
    	public static bool IsNativeLine(string sourceMsoType)
    	{
    		string name = CleanMsoShapeName(sourceMsoType);
    		if (!string.Equals(name, "Line", StringComparison.OrdinalIgnoreCase) && !string.Equals(name, "LineArrow", StringComparison.OrdinalIgnoreCase))
    		{
    			return string.Equals(name, "LineInverse", StringComparison.OrdinalIgnoreCase);
    		}
    		return true;
    	}
    
    	public static bool IsLineLike(string sourceMsoType)
    	{
    		string name = CleanMsoShapeName(sourceMsoType);
    		if (!IsNativeLine(name))
    		{
    			return IsConnector(name);
    		}
    		return true;
    	}
    
    	public static bool IsConnector(string sourceMsoType)
    	{
    		string name = CleanMsoShapeName(sourceMsoType);
    		if (!string.Equals(name, "StraightConnector", StringComparison.OrdinalIgnoreCase) && !string.Equals(name, "ElbowConnector", StringComparison.OrdinalIgnoreCase))
    		{
    			return string.Equals(name, "CurvedConnector", StringComparison.OrdinalIgnoreCase);
    		}
    		return true;
    	}
    
    	public static string CleanMsoShapeName(string sourceMsoType)
    	{
    		string value = sourceMsoType ?? string.Empty;
    		if (!value.StartsWith("msoShape", StringComparison.OrdinalIgnoreCase))
    		{
    			return value;
    		}
    		return value.Substring("msoShape".Length);
    	}
    }
}
