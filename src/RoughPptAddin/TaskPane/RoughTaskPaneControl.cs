using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

namespace RoughPptAddin.TaskPane;

public sealed class RoughTaskPaneControl : UserControl
{
	private struct ShapeSize(float? width, float? height)
	{
		public float? Width { get; } = width;

		public float? Height { get; } = height;
	}

	private readonly RoughAddInController controller;

	private readonly RoughJsBridge bridge;

	private readonly WebView2 webView = new WebView2();

	private readonly Panel loadingPanel = new Panel();

	private readonly Label loadingTitle = new Label();

	private readonly Label loadingDetail = new Label();

	private readonly ToolTip toolTip = new ToolTip();

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 16777216
	};

	private readonly Dictionary<string, TaskCompletionSource<ZlkChartRenderResult>> pendingZlkCharts = new Dictionary<string, TaskCompletionSource<ZlkChartRenderResult>>(StringComparer.OrdinalIgnoreCase);

	private Task initializationTask;

	public RoughTaskPaneControl(RoughAddInController controller, RoughJsBridge bridge)
	{
		this.controller = controller;
		this.bridge = bridge;
		Dock = DockStyle.Fill;
		BuildLoadingPanel();
		webView.Dock = DockStyle.Fill;
		base.Controls.Add(webView);
		base.Controls.Add(loadingPanel);
		loadingPanel.BringToFront();
		base.Load += OnLoad;
	}

	private async void OnLoad(object sender, EventArgs e)
	{
		try
		{
			await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
		}
		catch
		{
		}
	}

	public void BeginInitialization()
	{
		EnsureInitializedAsync();
	}

	public void ShowStatusFromHost(string text, bool isError = false)
	{
		PostStatus(text, isError);
	}

	public void ShowZlkAutomationStatus(string text, bool isError = false)
	{
		PostZlkAutomationStatus(text, null, isError);
	}

	public async Task<ZlkChartRenderResult> NormalizeAndInsertZlkChartAsync(ZlkClusterPlotRequest request, IList<ZlkPlotSourceFile> files)
	{
		request = request ?? new ZlkClusterPlotRequest();
		if (string.IsNullOrWhiteSpace(request.RequestId))
		{
			request.RequestId = "zlk-" + Guid.NewGuid().ToString("N");
		}
		await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
		TaskCompletionSource<ZlkChartRenderResult> completion = new TaskCompletionSource<ZlkChartRenderResult>();
		lock (pendingZlkCharts)
		{
			pendingZlkCharts[request.RequestId] = completion;
		}
		PostZlkAutomationStatus("正在归一化 SimpleExperiment 绘图请求：" + request.RequestId, null, isError: false);
		PostToWeb(new Dictionary<string, object>
		{
			["type"] = "normalizeZlkChartFile",
			["request"] = request,
			["files"] = files ?? new List<ZlkPlotSourceFile>()
		});
		if (await Task.WhenAny(completion.Task, Task.Delay(TimeSpan.FromSeconds(75.0))).ConfigureAwait(continueOnCapturedContext: true) != completion.Task)
		{
			lock (pendingZlkCharts)
			{
				pendingZlkCharts.Remove(request.RequestId);
			}
			throw new TimeoutException("SimpleExperiment 绘图数据归一化或插入超时。");
		}
		return await completion.Task.ConfigureAwait(continueOnCapturedContext: true);
	}

	public void ApplyStyleFromHost(RoughStyle style, string status)
	{
		ApplyStyleFromHostAsync(style, status);
	}

	private async Task ApplyStyleFromHostAsync(RoughStyle style, string status)
	{
		try
		{
			await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "applyStyleFromHost",
				["style"] = style ?? new RoughStyle(),
				["status"] = status ?? string.Empty
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("同步顶部风格到任务窗格失败。", exception);
		}
	}

	public void ApplyFeatureBlockFromHost(FeatureBlockOptions options, string status)
	{
		ApplyFeatureBlockFromHostAsync(options, status);
	}

	private async Task ApplyFeatureBlockFromHostAsync(FeatureBlockOptions options, string status)
	{
		try
		{
			await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "applyFeatureBlockFromHost",
				["feature"] = options ?? new FeatureBlockOptions(),
				["status"] = status ?? string.Empty
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("同步顶部特征块参数到任务窗格失败。", exception);
		}
	}

	public void FocusSection(string section, string status)
	{
		FocusSectionAsync(section, status);
	}

	public void RefreshUserAssetsFromHost(string status)
	{
		RefreshUserAssetsFromHostAsync(status);
	}

	private async Task RefreshUserAssetsFromHostAsync(string status)
	{
		try
		{
			await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
			SendUserAssets();
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "focusSection",
				["section"] = "library",
				["status"] = status ?? string.Empty
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("刷新任务窗格素材库失败。", exception);
		}
	}

	private async Task FocusSectionAsync(string section, string status)
	{
		try
		{
			await EnsureInitializedAsync().ConfigureAwait(continueOnCapturedContext: true);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "focusSection",
				["section"] = section ?? string.Empty,
				["status"] = status ?? string.Empty
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("定位任务窗格功能区失败。", exception);
		}
	}

	public async Task WaitUntilReadyAsync(TimeSpan timeout)
	{
		Task task = EnsureInitializedAsync();
		if (await Task.WhenAny(task, Task.Delay(timeout)).ConfigureAwait(continueOnCapturedContext: true) != task)
		{
			throw new TimeoutException("手绘图形窗格加载超时。日志：" + AddInLogger.LogPath);
		}
		await task.ConfigureAwait(continueOnCapturedContext: true);
		await bridge.WaitUntilReadyAsync(TimeSpan.FromSeconds(3.0)).ConfigureAwait(continueOnCapturedContext: true);
	}

	private Task EnsureInitializedAsync()
	{
		if (initializationTask == null || initializationTask.IsFaulted || initializationTask.IsCanceled)
		{
			initializationTask = InitializeCoreAsync();
		}
		return initializationTask;
	}

	private async Task InitializeCoreAsync()
	{
		_ = 2;
		try
		{
			string uiDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui");
			ShowLoading("正在加载本机 Rough.js 界面...", "正在验证本机脚本、形状目录和 WebView2 环境。" + Environment.NewLine + "宿主：" + controller.Compatibility.Summary, isError: false);
			if (webView.CoreWebView2 == null)
			{
				CoreWebView2Environment environment = await RoughJsBridge.CreateEnvironmentAsync().ConfigureAwait(continueOnCapturedContext: true);
				await webView.EnsureCoreWebView2Async(environment).ConfigureAwait(continueOnCapturedContext: true);
			}
			webView.CoreWebView2.WebMessageReceived -= OnWebMessageReceived;
			webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
			await bridge.InitializeAsync(webView, uiDirectory).ConfigureAwait(continueOnCapturedContext: true);
			loadingPanel.Visible = false;
			webView.BringToFront();
			string compatibilityWarning = controller.Compatibility.Warning;
			PostStatus(string.IsNullOrWhiteSpace(compatibilityWarning) ? "本机 Rough.js 界面已加载。" : compatibilityWarning, !string.IsNullOrWhiteSpace(compatibilityWarning));
			SendUserAssets();
			SendSelectionState();
			SendQuickShapes();
			SendZoteroImages(string.Empty);
			SendPalettes();
		}
		catch (Exception exception)
		{
			ShowInitializationFailure(exception);
			throw;
		}
	}

	private void BuildLoadingPanel()
	{
		loadingPanel.Dock = DockStyle.Fill;
		loadingPanel.BackColor = Color.FromArgb(248, 250, 252);
		loadingPanel.Padding = new Padding(18);
		loadingTitle.Dock = DockStyle.Top;
		loadingTitle.Height = 42;
		loadingTitle.Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold);
		loadingTitle.ForeColor = Color.FromArgb(31, 35, 40);
		loadingTitle.TextAlign = ContentAlignment.MiddleLeft;
		loadingDetail.Dock = DockStyle.Top;
		loadingDetail.Height = 110;
		loadingDetail.Font = new Font("Microsoft YaHei UI", 9f);
		loadingDetail.ForeColor = Color.FromArgb(80, 88, 99);
		loadingDetail.TextAlign = ContentAlignment.TopLeft;
		loadingPanel.Controls.Add(loadingDetail);
		loadingPanel.Controls.Add(loadingTitle);
		toolTip.SetToolTip(loadingPanel, "显示本机 Rough.js 插入窗口加载状态。");
		toolTip.SetToolTip(loadingTitle, "显示本机界面当前加载阶段。");
		toolTip.SetToolTip(loadingDetail, "如果加载失败，这里会显示本机日志位置。");
		ShowLoading("正在加载本机 Rough.js 界面...", "首次打开可能需要几秒钟。", isError: false);
	}

	private void ShowLoading(string title, string detail, bool isError)
	{
		loadingPanel.Visible = true;
		loadingPanel.BringToFront();
		loadingTitle.Text = title;
		loadingTitle.ForeColor = (isError ? Color.FromArgb(161, 38, 34) : Color.FromArgb(31, 35, 40));
		loadingDetail.Text = detail + Environment.NewLine + "日志：" + AddInLogger.LogPath;
	}

	private void ShowInitializationFailure(Exception exception)
	{
		AddInLogger.Error("任务窗格加载失败。", exception);
		ShowLoading("当前 PowerPoint 环境无法加载右侧窗格", OfficeCompatibilityService.InitializationFailureMessage(exception, controller.Compatibility), isError: true);
	}

	private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
	{
		try
		{
			Dictionary<string, object> message = serializer.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson);
			await HandleWebMessageAsync(message).ConfigureAwait(continueOnCapturedContext: true);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("处理 WebView 消息失败。", ex);
			PostStatus("失败：" + ex.Message, isError: true);
		}
	}

	private async Task HandleWebMessageAsync(Dictionary<string, object> message)
	{
		if (!message.TryGetValue("type", out var typeValue))
		{
			return;
		}
		switch (Convert.ToString(typeValue))
		{
		case "openUsageGuide":
			controller.ShowUsageGuide();
			break;
		case "getShapeIcons":
			SendShapeIcons();
			break;
		case "insertShape":
		{
			string enumName = Convert.ToString(message["enumName"]);
			string displayName = ReadString(message, "displayName", enumName);
			ShapeSize size = ReadSize(message);
			controller.InsertShape(enumName, ReadStyle(message), size.Width, size.Height);
			PostStatus("已发送插入请求：" + displayName, isError: false);
			break;
		}
		case "insertFeatureBlock":
			switch (controller.InsertFeatureBlock(ReadFeatureBlockOptions(message)))
			{
			case FeatureBlockMutationResult.Updated:
				PostStatus("已按当前参数更新选中特征块。", isError: false);
				break;
			case FeatureBlockMutationResult.Inserted:
				PostStatus("已插入特征块，可在 PowerPoint 中继续编辑每个原生块。", isError: false);
				break;
			}
			SendSelectionState();
			break;
		case "updateFeatureBlockSelection":
			if (controller.UpdateSelectedFeatureBlock(ReadFeatureBlockOptions(message)))
			{
				PostStatus("已实时更新选中特征块。", isError: false);
			}
			SendSelectionState();
			break;
		case "adjustFeatureBlockDirection":
			if (controller.AdjustSelectedFeatureBlock(ReadFeatureBlockOptions(message), ReadString(message, "direction", string.Empty), (int)ReadDouble(message, "delta", 0.0)))
			{
				PostStatus("已按方向直接更新选中特征块。", isError: false);
			}
			SendSelectionState();
			break;
		case "insertPaperPreset":
		{
			string presetId = ReadString(message, "presetId", string.Empty);
			string displayName2 = ReadString(message, "displayName", PaperStructurePresetService.PresetTitle(presetId));
			controller.InsertPaperStructurePreset(presetId);
			PostStatus("已发送插入论文图预设：" + displayName2, isError: false);
			SendSelectionState();
			break;
		}
		case "insertZlkChart":
		{
			ZlkClusterPlotRequest request = ReadMessageValue<ZlkClusterPlotRequest>(message, "request") ?? new ZlkClusterPlotRequest();
			string requestId = ReadString(message, "requestId", request.RequestId ?? string.Empty);
			if (!string.IsNullOrWhiteSpace(requestId))
			{
				request.RequestId = requestId;
			}
			try
			{
				string errorText = ReadString(message, "error", string.Empty);
				if (!string.IsNullOrWhiteSpace(errorText))
				{
					throw new InvalidOperationException(errorText);
				}
				ChartDataset dataset = ReadMessageValue<ChartDataset>(message, "dataset") ?? new ChartDataset();
				ZlkChartSpec chartSpec = ReadMessageValue<ZlkChartSpec>(message, "chartSpec") ?? new ZlkChartSpec();
				ZlkChartRenderResult result = controller.InsertZlkChart(dataset, chartSpec, request);
				CompletePendingZlkChart(request.RequestId, result, null);
				PostZlkAutomationStatus("已插入 SimpleExperiment 图表：" + result.ChartType + "，第 " + result.SlideIndex + " 页。", result, isError: false);
				PostStatus("已插入 SimpleExperiment 图表：" + result.ChartType, isError: false);
				SendSelectionState();
				break;
			}
			catch (Exception ex16)
			{
				AddInLogger.Error("插入 SimpleExperiment 图表失败。", ex16);
				CompletePendingZlkChart(request.RequestId, null, ex16);
				PostZlkAutomationStatus("插入 SimpleExperiment 图表失败：" + ex16.Message, null, isError: true);
				PostStatus("插入 SimpleExperiment 图表失败：" + ex16.Message, isError: true);
				break;
			}
		}
		case "updateFeatureBlockPreset":
			controller.SetFeatureBlockPreset(ReadFeatureBlockOptions(message));
			break;
		case "saveFeatureBlockDefault":
			controller.SaveFeatureBlockPreset(ReadFeatureBlockOptions(message));
			PostStatus("已保存当前特征块参数为默认。", isError: false);
			break;
		case "setInsertStylePreset":
			controller.SetRoughStylePreset(ReadStyle(message), syncTaskPane: false);
			controller.SetActiveRibbonStylePreset(ReadString(message, "ribbonStylePresetId", string.Empty));
			PostStatus("已更新插入风格预设。", isError: false);
			break;
		case "updateParams":
		{
			RoughStyle style2 = ReadStyle(message);
			controller.SetRoughStylePreset(style2, syncTaskPane: false);
			int count2 = await controller.RefreshSelectionNowAsync(style2).ConfigureAwait(continueOnCapturedContext: true);
			if (count2 > 0)
			{
				PostStatus("已实时重绘：" + count2 + " 个手绘对象", isError: false);
			}
			else
			{
				PostStatus("当前没有可实时重绘的手绘选区。", isError: false);
			}
			break;
		}
		case "refreshSelection":
		{
			RoughStyle style = ReadStyle(message);
			controller.SetRoughStylePreset(style, syncTaskPane: false);
			int count = await controller.RefreshSelectionNowAsync(style).ConfigureAwait(continueOnCapturedContext: true);
			if (count > 0)
			{
				PostStatus("已重绘：" + count + " 个手绘对象", isError: false);
			}
			else
			{
				PostStatus("未完成重绘：请确认已选中手绘原生组，失败详情见日志。", isError: true);
			}
			SendSelectionState();
			break;
		}
		case "convertSelectionToRough":
			controller.ConvertSelectionToRough(ReadStyle(message));
			PostStatus("已开始把当前选区转换为 Rough.js 手绘原生对象。", isError: false);
			SendSelectionState();
			break;
		case "inspectSelection":
			controller.InspectSelection();
			break;
		case "selectNativeCarrier":
			controller.SelectNativeCarrier();
			PostStatus("已尝试选择组内 PPT 原生载体；调整后点击“重绘选区”。", isError: false);
			break;
		case "saveSelectionAsAsset":
			try
			{
				UserAssetInfo asset = controller.SaveSelectionAsAssetInfo();
				SendUserAssets();
				PostStatus("已保存素材：" + asset.DisplayName, isError: false);
				break;
			}
			catch (Exception ex15)
			{
				PostCommandFailure("保存素材", ex15);
				SendUserAssets();
				break;
			}
		case "listUserAssets":
			SendUserAssets();
			SendQuickShapes();
			SendSelectionState();
			break;
		case "listQuickShapes":
			SendQuickShapes();
			break;
		case "listZoteroImages":
			SendZoteroImages(ReadString(message, "query", string.Empty));
			break;
		case "getZoteroPalette":
			try
			{
				SendZoteroPalette(ReadString(message, "imageId", string.Empty));
				break;
			}
			catch (Exception ex16)
			{
				PostCommandFailure("读取当前参考图配色", ex16);
				PostToWeb(new Dictionary<string, object>
				{
					["type"] = "zoteroPaletteLoadFailed",
					["imageId"] = ReadString(message, "imageId", string.Empty)
				});
				break;
			}
		case "insertZoteroImage":
			try
			{
				ZoteroImageInfo image = controller.InsertZoteroImage(ReadString(message, "imageId", string.Empty));
				PostStatus("已插入 Zotero 参考图像：" + (image.Title ?? image.ImageId), isError: false);
				SendSelectionState();
				break;
			}
			catch (Exception ex14)
			{
				PostCommandFailure("插入 Zotero 参考图像", ex14);
				break;
			}
		case "openZoteroImagePdf":
			PostZoteroTraceStatus(controller.OpenZoteroImagePdf(ReadString(message, "imageId", string.Empty)), isError: false);
			break;
		case "selectZoteroImageItem":
			PostZoteroTraceStatus(controller.SelectZoteroImageItem(ReadString(message, "imageId", string.Empty)), isError: false);
			break;
		case "copyZoteroTraceIds":
			PostZoteroTraceStatus(controller.CopyZoteroTraceIds(ReadString(message, "imageId", string.Empty)), isError: false);
			break;
		case "applyZoteroSwatch":
			try
			{
				string status2 = controller.ApplyZoteroSwatch(ReadZoteroSwatch(message), ReadString(message, "target", "fill"));
				PostZoteroTraceStatus(status2, isError: false);
				SendSelectionState();
				break;
			}
			catch (Exception ex13)
			{
				PostCommandFailure("应用 Zotero 色块", ex13);
				break;
			}
		case "copyZoteroSwatchHex":
			try
			{
				PostZoteroTraceStatus(controller.CopyZoteroSwatchHex(ReadString(message, "hex", string.Empty)), isError: false);
				break;
			}
			catch (Exception ex12)
			{
				PostCommandFailure("复制 Zotero 色块 HEX", ex12);
				break;
			}
		case "listPalettes":
			SendPalettes();
			break;
		case "saveZoteroPalette":
			try
			{
				string imageId = ReadString(message, "imageId", string.Empty);
				PaletteSchemeInfo palette4 = controller.SaveCurrentZoteroPalette(imageId, ReadString(message, "sourceTitle", string.Empty));
				SendPalettes();
				PostStatus("已保存配色方案：" + palette4.DisplayName, isError: false);
				PostToWeb(new Dictionary<string, object>
				{
					["type"] = "zoteroPaletteSaved",
					["imageId"] = imageId,
					["paletteId"] = palette4.Id
				});
				break;
			}
			catch (Exception ex11)
			{
				PostCommandFailure("保存 Zotero 配色", ex11);
				SendPalettes();
				break;
			}
		case "extractClipboardPalette":
			try
			{
				PaletteSchemeInfo palette3 = controller.ExtractPaletteFromClipboardImage();
				SendPalettes();
				PostStatus("已从剪贴板图片提取配色：" + palette3.DisplayName, isError: false);
				break;
			}
			catch (Exception ex10)
			{
				PostCommandFailure("提取剪贴板配色", ex10);
				SendPalettes();
				break;
			}
		case "extractSlidePalette":
			try
			{
				PaletteSchemeInfo palette2 = controller.ExtractPaletteFromCurrentSlide();
				SendPalettes();
				PostStatus("已从当前页面提取配色：" + palette2.DisplayName, isError: false);
				break;
			}
			catch (Exception ex9)
			{
				PostCommandFailure("提取当前页面配色", ex9);
				SendPalettes();
				break;
			}
		case "deletePalette":
			try
			{
				PaletteSchemeInfo palette = controller.DeletePalette(ReadString(message, "paletteId", string.Empty));
				SendPalettes();
				PostStatus("已删除配色方案：" + palette.DisplayName, isError: false);
				break;
			}
			catch (Exception ex8)
			{
				PostCommandFailure("删除配色方案", ex8);
				SendPalettes();
				break;
			}
		case "exportPalettes":
			try
			{
				string packagePath2 = controller.ExportPalettes(ReadStringList(message, "paletteIds"));
				PostStatus(string.IsNullOrEmpty(packagePath2) ? "已取消分享配色包。" : ("已生成配色分享包：" + packagePath2), isError: false);
			}
			catch (Exception ex7)
			{
				PostCommandFailure("分享配色包", ex7);
			}
			SendPalettes();
			break;
		case "importPalettes":
			try
			{
				IList<PaletteSchemeInfo> imported2 = controller.ImportPalettes();
				SendPalettes();
				PostStatus((imported2.Count > 0) ? ("已导入配色方案：" + imported2.Count + " 个") : "已取消导入配色包。", isError: false);
				break;
			}
			catch (Exception ex6)
			{
				PostCommandFailure("导入配色包", ex6);
				SendPalettes();
				break;
			}
		case "applyPaletteLayout":
			try
			{
				string status = controller.ApplyPaletteLayout(ReadPaletteLayout(message));
				PostStatus(status, isError: false);
				SendSelectionState();
				break;
			}
			catch (Exception ex5)
			{
				PostCommandFailure("应用配色布局", ex5);
				break;
			}
		case "pinQuickShape":
			controller.PinQuickShape(ReadString(message, "enumName", string.Empty));
			SendQuickShapes();
			break;
		case "unpinQuickShape":
			controller.UnpinQuickShape(ReadString(message, "enumName", string.Empty));
			SendQuickShapes();
			break;
		case "getSelectionState":
			SendSelectionState();
			break;
		case "insertUserAsset":
			try
			{
				string assetId2 = ReadString(message, "assetId", string.Empty);
				controller.InsertUserAsset(assetId2);
				PostStatus("已插入素材：" + assetId2, isError: false);
				SendSelectionState();
				break;
			}
			catch (Exception ex4)
			{
				PostCommandFailure("插入素材", ex4);
				SendSelectionState();
				break;
			}
		case "deleteUserAsset":
			try
			{
				string assetId = ReadString(message, "assetId", string.Empty);
				UserAssetInfo deleted = controller.DeleteUserAsset(assetId);
				SendUserAssets();
				PostStatus("已删除素材：" + deleted.DisplayName, isError: false);
				break;
			}
			catch (Exception ex3)
			{
				PostCommandFailure("删除素材", ex3);
				SendUserAssets();
				break;
			}
		case "exportUserAssets":
			try
			{
				IList<string> assetIds = ReadStringList(message, "assetIds");
				string packagePath = controller.ExportUserAssets(assetIds);
				if (!string.IsNullOrEmpty(packagePath))
				{
					PostStatus("已生成分享素材包：" + packagePath, isError: false);
				}
				else
				{
					PostStatus("已取消分享素材包。", isError: false);
				}
			}
			catch (Exception ex2)
			{
				PostCommandFailure("分享素材包", ex2);
			}
			SendUserAssets();
			break;
		case "importUserAssets":
			try
			{
				UserAssetImportResult imported = controller.ImportUserAssets();
				SendUserAssets();
				PostStatus(controller.DescribeUserAssetImport(imported), isError: false);
				break;
			}
			catch (Exception ex)
			{
				PostCommandFailure("导入素材包", ex);
				SendUserAssets();
				break;
			}
		}
	}

	public void SendSelectionState()
	{
		try
		{
			PostToWeb(controller.GetSelectionState());
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取选区状态失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "selectionState",
				["isRough"] = false,
				["status"] = "当前没有可读取的形状选区。"
			});
		}
	}

	public void SendUserAssets()
	{
		try
		{
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "userAssets",
				["assets"] = BuildUserAssetPayload()
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取素材库失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "userAssets",
				["assets"] = new List<Dictionary<string, object>>()
			});
			PostStatus("素材库读取失败，已跳过异常素材。", isError: true);
		}
	}

	public void SendPalettes()
	{
		try
		{
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "paletteSchemes",
				["palettes"] = controller.ListPaletteSchemes()
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取配色库失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "paletteSchemes",
				["palettes"] = new List<PaletteSchemeInfo>()
			});
			PostStatus("配色库读取失败，已显示空状态。", isError: true);
		}
	}

	private void SendShapeIcons()
	{
		try
		{
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "shapeIcons",
				["icons"] = BuildShapeIconPayload()
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取 PowerPoint 形状图标失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "shapeIcons",
				["icons"] = new List<Dictionary<string, object>>()
			});
		}
	}

	private void SendQuickShapes()
	{
		try
		{
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "quickShapes",
				["shapes"] = BuildQuickShapePayload()
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取快速插入形状失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "quickShapes",
				["shapes"] = new List<Dictionary<string, object>>()
			});
		}
	}

	private void SendZoteroImages(string query)
	{
		try
		{
			string status;
			bool databaseFound;
			IList<ZoteroImageInfo> images = controller.ListZoteroImages(query, out status, out databaseFound);
			ZoteroImageLibraryPathInfo pathInfo = ZoteroImageLibraryPathResolver.ResolveDatabasePathInfo();
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "zoteroImages",
				["query"] = query ?? string.Empty,
				["images"] = images,
				["status"] = status,
				["databasePath"] = pathInfo.DatabasePath,
				["databaseSource"] = pathInfo.SourceDescription,
				["databaseFound"] = databaseFound
			});
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取 Zotero 论文图像库失败。", exception);
			PostToWeb(new Dictionary<string, object>
			{
				["type"] = "zoteroImages",
				["query"] = query ?? string.Empty,
				["images"] = new List<ZoteroImageInfo>(),
				["status"] = "读取 Zotero 论文图像库失败。请检查共享数据库是否可读，然后重试。",
				["databasePath"] = string.Empty,
				["databaseSource"] = string.Empty,
				["databaseFound"] = false
			});
			PostStatus("读取 Zotero 论文图像库失败，已显示空状态。", isError: true);
		}
	}

	private void SendZoteroPalette(string imageId)
	{
		PostToWeb(new Dictionary<string, object>
		{
			["type"] = "zoteroPalette",
			["imageId"] = imageId ?? string.Empty,
			["palette"] = controller.GetZoteroPaletteByImageId(imageId)
		});
	}

	private IList<Dictionary<string, object>> BuildShapeIconPayload()
	{
		List<Dictionary<string, object>> payload = new List<Dictionary<string, object>>();
		foreach (CatalogItem item in LoadCatalogItems())
		{
			if (item != null && item.Insertable && !string.IsNullOrWhiteSpace(item.EnumName))
			{
				string dataUrl = controller.GetOfficeShapeIconDataUrl(item.EnumName, item.Category, 32, 32);
				if (!string.IsNullOrWhiteSpace(dataUrl))
				{
					payload.Add(new Dictionary<string, object>
					{
						["enumName"] = item.EnumName,
						["dataUrl"] = dataUrl
					});
				}
			}
		}
		return payload;
	}

	private IList<Dictionary<string, object>> BuildQuickShapePayload()
	{
		Dictionary<string, CatalogItem> catalog = new Dictionary<string, CatalogItem>(StringComparer.OrdinalIgnoreCase);
		foreach (CatalogItem item in LoadCatalogItems())
		{
			if (item != null && item.EnumName != null && !catalog.ContainsKey(item.EnumName))
			{
				catalog.Add(item.EnumName, item);
			}
		}
		List<Dictionary<string, object>> payload = new List<Dictionary<string, object>>();
		foreach (string enumName in controller.ListQuickShapes())
		{
			catalog.TryGetValue(enumName, out var item2);
			payload.Add(new Dictionary<string, object>
			{
				["enumName"] = enumName,
				["displayName"] = item2?.DisplayNameZh ?? enumName,
				["category"] = item2?.Category ?? string.Empty,
				["dataUrl"] = controller.GetOfficeShapeIconDataUrl(enumName, item2?.Category, 32, 32)
			});
		}
		return payload;
	}

	private static IReadOnlyList<CatalogItem> LoadCatalogItems()
	{
		string catalogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "autoshape-catalog.json");
		if (!File.Exists(catalogPath))
		{
			return new List<CatalogItem>();
		}
		return new CatalogService().Load(catalogPath);
	}

	private IList<Dictionary<string, object>> BuildUserAssetPayload()
	{
		List<Dictionary<string, object>> payload = new List<Dictionary<string, object>>();
		foreach (UserAssetInfo asset in controller.ListUserAssets())
		{
			payload.Add(new Dictionary<string, object>
			{
				["Id"] = asset.Id,
				["DisplayName"] = asset.DisplayName,
				["Kind"] = asset.Kind,
				["CreatedAtUtc"] = asset.CreatedAtUtc,
				["ShapeCount"] = asset.ShapeCount,
				["TemplatePath"] = asset.TemplatePath,
				["ThumbnailPath"] = asset.ThumbnailPath,
				["ThumbnailDataUrl"] = ReadThumbnailDataUrl(asset.ThumbnailPath),
				["NativeOnly"] = asset.NativeOnly,
				["Keywords"] = asset.Keywords
			});
		}
		return payload;
	}

	private static string ReadThumbnailDataUrl(string thumbnailPath)
	{
		if (string.IsNullOrWhiteSpace(thumbnailPath) || !File.Exists(thumbnailPath))
		{
			return null;
		}
		try
		{
			byte[] bytes = File.ReadAllBytes(thumbnailPath);
			return "data:image/png;base64," + Convert.ToBase64String(bytes);
		}
		catch
		{
			return null;
		}
	}

	public void PostHostStatus(string text, bool isError)
	{
		PostStatus(text, isError);
	}

	private void PostStatus(string text, bool isError)
	{
		PostToWeb(new Dictionary<string, object>
		{
			["type"] = "status",
			["text"] = text,
			["isError"] = isError
		});
	}

	private void PostCommandFailure(string action, Exception ex)
	{
		AddInLogger.Error(action + "失败。", ex);
		PostStatus(action + "失败：" + ex.Message, isError: true);
	}

	private void PostZoteroTraceStatus(string text, bool isError)
	{
		PostToWeb(new Dictionary<string, object>
		{
			["type"] = "zoteroTraceStatus",
			["text"] = text ?? string.Empty,
			["isError"] = isError
		});
		PostStatus(text ?? string.Empty, isError);
	}

	private void PostZlkAutomationStatus(string text, ZlkChartRenderResult result, bool isError)
	{
		PostToWeb(new Dictionary<string, object>
		{
			["type"] = "zlkAutomationStatus",
			["text"] = text ?? string.Empty,
			["isError"] = isError,
			["result"] = result
		});
	}

	private void PostToWeb(object payload)
	{
		if (webView.CoreWebView2 != null)
		{
			webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(payload));
		}
	}

	private void CompletePendingZlkChart(string requestId, ZlkChartRenderResult result, Exception error)
	{
		if (string.IsNullOrWhiteSpace(requestId))
		{
			return;
		}
		TaskCompletionSource<ZlkChartRenderResult> completion = null;
		lock (pendingZlkCharts)
		{
			if (pendingZlkCharts.TryGetValue(requestId, out completion))
			{
				pendingZlkCharts.Remove(requestId);
			}
		}
		if (completion != null)
		{
			if (error != null)
			{
				completion.TrySetException(error);
			}
			else
			{
				completion.TrySetResult(result);
			}
		}
	}

	private RoughStyle ReadStyle(Dictionary<string, object> message)
	{
		if (!message.TryGetValue("params", out var paramsValue))
		{
			return null;
		}
		if (!(paramsValue is Dictionary<string, object> dict))
		{
			return serializer.ConvertToType<RoughStyle>(paramsValue);
		}
		RoughStyle style = new RoughStyle();
		style.Stroke = ReadString(dict, "stroke", style.Stroke);
		style.StrokeWidthPt = (float)ReadDouble(dict, "strokeWidthPt", style.StrokeWidthPt);
		style.StrokeTransparency = ReadDouble(dict, "strokeTransparency", style.StrokeTransparency);
		style.Roughness = ReadDouble(dict, "roughness", style.Roughness);
		style.Bowing = ReadDouble(dict, "bowing", style.Bowing);
		style.EdgeJitterPt = ReadDouble(dict, "edgeJitterPt", style.EdgeJitterPt);
		style.MaxRandomnessOffset = ReadDouble(dict, "maxRandomnessOffset", style.MaxRandomnessOffset);
		style.StrokePasses = (int)ReadDouble(dict, "strokePasses", style.StrokePasses);
		style.CurveSampling = ReadDouble(dict, "curveSampling", style.CurveSampling);
		style.FragmentStrokeDensity = ReadDouble(dict, "fragmentStrokeDensity", style.FragmentStrokeDensity);
		style.RoughEngine = ReadString(dict, "roughEngine", style.RoughEngine);
		style.RoughSource = ReadString(dict, "roughSource", style.RoughSource);
		style.FillSource = ReadString(dict, "fillSource", style.FillSource);
		style.FillWeight = ReadDouble(dict, "fillWeight", style.FillWeight);
		style.HachureGap = ReadDouble(dict, "hachureGap", style.HachureGap);
		style.CurveFitting = ReadDouble(dict, "curveFitting", style.CurveFitting);
		style.PreserveVertices = ReadBool(dict, "preserveVertices", style.PreserveVertices);
		style.DisableMultiStroke = ReadBool(dict, "disableMultiStroke", style.DisableMultiStroke);
		style.DisableMultiStrokeFill = ReadBool(dict, "disableMultiStrokeFill", style.DisableMultiStrokeFill);
		style.TldrawOffsetPt = ReadDouble(dict, "tldrawOffsetPt", style.TldrawOffsetPt);
		style.RoughMode = ReadString(dict, "roughMode", style.RoughMode);
		style.NestedLayers = (int)ReadDouble(dict, "nestedLayers", style.NestedLayers);
		style.NestedOverlap = ReadDouble(dict, "nestedOverlap", style.NestedOverlap);
		style.NestedGapPt = ReadDouble(dict, "nestedGapPt", style.NestedGapPt);
		style.NestedJitterPt = ReadDouble(dict, "nestedJitterPt", style.NestedJitterPt);
		style.NestedDirection = ReadString(dict, "nestedDirection", style.NestedDirection);
		style.Seed = (int)ReadDouble(dict, "seed", style.Seed);
		style.FillMode = ReadString(dict, "fillMode", style.FillMode);
		style.FillColor = ReadString(dict, "fillColor", style.FillColor);
		style.FillTransparency = ReadDouble(dict, "fillTransparency", style.FillTransparency);
		style.FillStyle = ReadString(dict, "fillStyle", style.FillStyle);
		style.BrushWidthPt = ReadDouble(dict, "brushWidthPt", style.BrushWidthPt);
		style.BrushDensity = ReadDouble(dict, "brushDensity", style.BrushDensity);
		style.BrushAngleDeg = ReadDouble(dict, "brushAngleDeg", style.BrushAngleDeg);
		style.BrushJitterPt = ReadDouble(dict, "brushJitterPt", style.BrushJitterPt);
		style.BrushOverlap = ReadDouble(dict, "brushOverlap", style.BrushOverlap);
		style.DashStyle = ReadString(dict, "dashStyle", style.DashStyle);
		style.ArrowheadStyle = ReadString(dict, "arrowheadStyle", style.ArrowheadStyle);
		style.ArrowheadPosition = ReadString(dict, "arrowheadPosition", style.ArrowheadPosition);
		style.ArrowheadLengthPt = ReadDouble(dict, "arrowheadLengthPt", style.ArrowheadLengthPt);
		style.ArrowheadWidthPt = ReadDouble(dict, "arrowheadWidthPt", style.ArrowheadWidthPt);
		return style;
	}

	private ShapeSize ReadSize(Dictionary<string, object> message)
	{
		if (!message.TryGetValue("size", out var sizeValue) || sizeValue == null)
		{
			return new ShapeSize(null, null);
		}
		if (!(sizeValue is Dictionary<string, object> dict))
		{
			return new ShapeSize(null, null);
		}
		return new ShapeSize((float)ReadDouble(dict, "width", 0.0), (float)ReadDouble(dict, "height", 0.0));
	}

	private FeatureBlockOptions ReadFeatureBlockOptions(Dictionary<string, object> message)
	{
		if (!message.TryGetValue("feature", out var value) || value == null)
		{
			return new FeatureBlockOptions();
		}
		if (!(value is Dictionary<string, object> dict))
		{
			return serializer.ConvertToType<FeatureBlockOptions>(value);
		}
		return new FeatureBlockOptions
		{
			Mode = ReadString(dict, "mode", "3d"),
			VisualStyle = ReadString(dict, "visualStyle", "plain"),
			CountX = (int)ReadDouble(dict, "countX", 3.0),
			CountY = (int)ReadDouble(dict, "countY", 3.0),
			CountZ = (int)ReadDouble(dict, "countZ", 3.0),
			BlockWidthPt = (float)ReadDouble(dict, "blockWidthPt", 24.0),
			BlockHeightPt = (float)ReadDouble(dict, "blockHeightPt", 20.0),
			BlockDepthPt = (float)ReadDouble(dict, "blockDepthPt", 12.0),
			GapPt = (float)ReadDouble(dict, "gapPt", 0.0),
			Roundness = (float)ReadDouble(dict, "roundness", 0.0),
			StartColor = ReadString(dict, "startColor", "#f8b6c8"),
			EndColor = ReadString(dict, "endColor", "#c97a96"),
			StrokeColor = ReadString(dict, "strokeColor", "#000000"),
			StrokeWidthPt = (float)ReadDouble(dict, "strokeWidthPt", 0.8),
			GradientDirection = ReadString(dict, "gradientDirection", "x"),
			GradientReverse = ReadBool(dict, "gradientReverse", fallback: false),
			GradientAmount = ReadDouble(dict, "gradientAmount", 1.0),
			EditDirection = ReadString(dict, "editDirection", string.Empty),
			EditDelta = (int)ReadDouble(dict, "editDelta", 0.0)
		};
	}

	private ZoteroSwatchInfo ReadZoteroSwatch(Dictionary<string, object> message)
	{
		ZoteroSwatchInfo swatch = new ZoteroSwatchInfo
		{
			Hex = ReadString(message, "hex", string.Empty),
			BaseHex = ReadString(message, "baseHex", string.Empty),
			Variant = ReadString(message, "variant", string.Empty),
			Role = ReadString(message, "role", string.Empty),
			SourceTitle = ReadString(message, "sourceTitle", string.Empty),
			ImageId = ReadString(message, "imageId", string.Empty)
		};
		if (message.TryGetValue("swatch", out var value) && value is Dictionary<string, object> dict)
		{
			swatch.Hex = ReadString(dict, "hex", swatch.Hex);
			swatch.BaseHex = ReadString(dict, "baseHex", swatch.BaseHex);
			swatch.Variant = ReadString(dict, "variant", swatch.Variant);
			swatch.Role = ReadString(dict, "role", swatch.Role);
			swatch.SourceTitle = ReadString(dict, "sourceTitle", swatch.SourceTitle);
			swatch.ImageId = ReadString(dict, "imageId", swatch.ImageId);
		}
		return swatch;
	}

	private PaletteLayoutInfo ReadPaletteLayout(Dictionary<string, object> message)
	{
		if (message.TryGetValue("layout", out var value) && value != null)
		{
			try
			{
				return serializer.ConvertToType<PaletteLayoutInfo>(value);
			}
			catch
			{
				try
				{
					return serializer.Deserialize<PaletteLayoutInfo>(serializer.Serialize(value));
				}
				catch
				{
				}
			}
		}
		return new PaletteLayoutInfo
		{
			Id = ReadString(message, "layoutId", string.Empty),
			PaletteId = ReadString(message, "paletteId", string.Empty),
			DisplayName = ReadString(message, "displayName", string.Empty),
			StrokeHex = ReadString(message, "strokeHex", "#111111"),
			FillHex = ReadString(message, "fillHex", "#ffffff"),
			FeatureStartHex = ReadString(message, "featureStartHex", "#f8b6c8"),
			FeatureEndHex = ReadString(message, "featureEndHex", "#c97a96"),
			AccentHex = ReadString(message, "accentHex", "#4472C4"),
			BackgroundHex = ReadString(message, "backgroundHex", "#ffffff")
		};
	}

	private T ReadMessageValue<T>(Dictionary<string, object> message, string key) where T : class
	{
		if (!message.TryGetValue(key, out var value) || value == null)
		{
			return null;
		}
		try
		{
			return serializer.ConvertToType<T>(value);
		}
		catch
		{
			try
			{
				return serializer.Deserialize<T>(serializer.Serialize(value));
			}
			catch
			{
				return null;
			}
		}
	}

	private static string ReadString(Dictionary<string, object> dict, string key, string fallback)
	{
		if (!dict.TryGetValue(key, out var value))
		{
			return fallback;
		}
		return Convert.ToString(value, CultureInfo.InvariantCulture);
	}

	private static IList<string> ReadStringList(Dictionary<string, object> dict, string key)
	{
		List<string> result = new List<string>();
		if (!dict.TryGetValue(key, out var value) || value == null)
		{
			return result;
		}
		string single = value as string;
		if (!string.IsNullOrWhiteSpace(single))
		{
			result.Add(single);
			return result;
		}
		if (value is object[] array)
		{
			object[] array2 = array;
			for (int i = 0; i < array2.Length; i++)
			{
				string text = Convert.ToString(array2[i], CultureInfo.InvariantCulture);
				if (!string.IsNullOrWhiteSpace(text))
				{
					result.Add(text);
				}
			}
			return result;
		}
		if (value is IEnumerable list)
		{
			foreach (object item in list)
			{
				string text2 = Convert.ToString(item, CultureInfo.InvariantCulture);
				if (!string.IsNullOrWhiteSpace(text2))
				{
					result.Add(text2);
				}
			}
		}
		return result;
	}

	private static double ReadDouble(Dictionary<string, object> dict, string key, double fallback)
	{
		if (!dict.TryGetValue(key, out var value))
		{
			return fallback;
		}
		if (value == null)
		{
			return fallback;
		}
		if (double.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
		{
			return parsed;
		}
		return fallback;
	}

	private static bool ReadBool(Dictionary<string, object> dict, string key, bool fallback)
	{
		if (!dict.TryGetValue(key, out var value) || value == null)
		{
			return fallback;
		}
		if (value is bool)
		{
			return (bool)value;
		}
		if (!bool.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), out var parsed))
		{
			return fallback;
		}
		return parsed;
	}
}
