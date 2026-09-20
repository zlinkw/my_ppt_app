using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

namespace RoughPptAddin.TaskPane;

public sealed class ResearchChartStudioWindow : Form
{
	private sealed class WindowOwner : IWin32Window
	{
		public IntPtr Handle { get; }

		public WindowOwner(IntPtr handle)
		{
			Handle = handle;
		}
	}

	private const string UiHostName = "rough-ppt.local";

	private readonly Func<IntPtr> ownerWindowHandle;

	private readonly Action<string, bool> reportStatus;

	private readonly Func<ChartDataset, ZlkChartSpec, ZlkClusterPlotRequest, ZlkChartRenderResult> insertChart;

	private readonly Func<ResearchSvgDocument, string> insertSvg;
	private readonly Func<ResearchSvgDocument, string> insertEditableSvg;
	private readonly Func<string> convertCroppedSvg;

	private readonly WebView2 webView = new WebView2();

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 16777216
	};

	private bool initializationStarted;

	private ResearchSvgDocument selectedSvg;
	private bool tavottoBusy;
	private string tavottoProjectDirectory;

	public ResearchChartStudioWindow(Func<IntPtr> ownerWindowHandle, Action<string, bool> reportStatus, Func<ChartDataset, ZlkChartSpec, ZlkClusterPlotRequest, ZlkChartRenderResult> insertChart, Func<ResearchSvgDocument, string> insertSvg, Func<ResearchSvgDocument, string> insertEditableSvg, Func<string> convertCroppedSvg)
	{
		this.ownerWindowHandle = ownerWindowHandle;
		this.reportStatus = reportStatus;
		this.insertChart = insertChart;
		this.insertSvg = insertSvg;
		this.insertEditableSvg = insertEditableSvg;
		this.convertCroppedSvg = convertCroppedSvg;
		Text = "科研绘图工作区";
		base.ShowIcon = false;
		base.ShowInTaskbar = true;
		base.MinimizeBox = true;
		base.MaximizeBox = true;
		base.FormBorderStyle = FormBorderStyle.Sizable;
		base.SizeGripStyle = SizeGripStyle.Show;
		MinimumSize = new Size(720, 560);
		base.Size = new Size(1180, 820);
		base.StartPosition = FormStartPosition.Manual;
		base.TopMost = false;
		webView.Dock = DockStyle.Fill;
		base.Controls.Add(webView);
	}

	public void ShowAlongsidePowerPoint()
	{
		BeginInitialization();
		IntPtr ownerHandle = ownerWindowHandle?.Invoke() ?? IntPtr.Zero;
		Rectangle workingArea = ((ownerHandle != IntPtr.Zero) ? Screen.FromHandle(ownerHandle).WorkingArea : Screen.FromPoint(Cursor.Position).WorkingArea);
		if (!base.Visible)
		{
			base.Width = Math.Min(base.Width, Math.Max(MinimumSize.Width, workingArea.Width - 48));
			base.Height = Math.Min(base.Height, Math.Max(MinimumSize.Height, workingArea.Height - 48));
			base.Location = new Point(workingArea.Left + Math.Max(24, (workingArea.Width - base.Width) / 2), workingArea.Top + Math.Max(24, (workingArea.Height - base.Height) / 2));
			if (ownerHandle != IntPtr.Zero)
			{
				Show(new WindowOwner(ownerHandle));
			}
			else
			{
				Show();
			}
		}
		base.TopMost = false;
		Activate();
	}

	private async void BeginInitialization()
	{
		if (initializationStarted)
		{
			return;
		}
		initializationStarted = true;
		try
		{
			string uiDirectory = ResolveUiDirectory();
			CoreWebView2Environment environment = await RoughJsBridge.CreateEnvironmentAsync().ConfigureAwait(continueOnCapturedContext: true);
			await webView.EnsureCoreWebView2Async(environment).ConfigureAwait(continueOnCapturedContext: true);
			webView.CoreWebView2.SetVirtualHostNameToFolderMapping(UiHostName, uiDirectory, CoreWebView2HostResourceAccessKind.Allow);
			webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
			webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
			webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
			webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
			webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
			webView.CoreWebView2.Navigate("https://" + UiHostName + "/research-chart-studio.html");
		}
		catch (Exception ex)
		{
			initializationStarted = false;
			AddInLogger.Error("打开科研绘图工作区失败。", ex);
			reportStatus?.Invoke("打开科研绘图工作区失败：" + ex.Message, true);
		}
	}

	private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
	{
		if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || !string.Equals(uri.Host, UiHostName, StringComparison.OrdinalIgnoreCase) || !string.Equals(uri.AbsolutePath, "/research-chart-studio.html", StringComparison.OrdinalIgnoreCase))
		{
			e.Cancel = true;
		}
	}

	private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
	{
		if (!e.IsSuccess)
		{
			initializationStarted = false;
			InvalidOperationException exception = new InvalidOperationException(e.WebErrorStatus.ToString());
			AddInLogger.Error("科研绘图工作区导航失败。", exception);
			reportStatus?.Invoke("科研绘图工作区加载失败：" + e.WebErrorStatus, true);
		}
	}

	private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
	{
		try
		{
			var message = serializer.Deserialize<System.Collections.Generic.Dictionary<string, object>>(e.WebMessageAsJson);
			string messageType = ReadString(message, "type", string.Empty);
			if (string.Equals(messageType, "researchChartStudioReady", StringComparison.OrdinalIgnoreCase))
			{
				PostNativeMaximizeResult();
				return;
			}
			if (string.Equals(messageType, "toggleResearchChartStudioFullscreen", StringComparison.OrdinalIgnoreCase))
			{
				WindowState = ((WindowState == FormWindowState.Maximized) ? FormWindowState.Normal : FormWindowState.Maximized);
				Activate();
				PostNativeMaximizeResult();
				return;
			}
			if (string.Equals(messageType, "openResearchChartWebsite", StringComparison.OrdinalIgnoreCase))
			{
				OpenResearchChartWebsite(ReadString(message, "siteId", string.Empty));
				return;
			}
			if (string.Equals(messageType, "selectResearchSvg", StringComparison.OrdinalIgnoreCase))
			{
				SelectResearchSvg();
				return;
			}
			if (string.Equals(messageType, "importTavottoSvg", StringComparison.OrdinalIgnoreCase))
			{
				SelectResearchSvg(fromTavotto: true);
				return;
			}
			if (string.Equals(messageType, "checkTavotto", StringComparison.OrdinalIgnoreCase) ||
				string.Equals(messageType, "openCurrentInTavotto", StringComparison.OrdinalIgnoreCase) ||
				string.Equals(messageType, "openFigureInTavotto", StringComparison.OrdinalIgnoreCase))
			{
				HandleTavottoHandoff(messageType, ReadString(message, "requestId", string.Empty));
				return;
			}
			if (string.Equals(messageType, "stageResearchSvg", StringComparison.OrdinalIgnoreCase))
			{
				StageResearchSvg(
					ReadString(message, "requestId", string.Empty),
					ReadString(message, "svgText", string.Empty),
					ReadString(message, "fileName", "local-research-chart.svg"));
				return;
			}
			if (string.Equals(messageType, "insertResearchSvg", StringComparison.OrdinalIgnoreCase))
			{
				InsertResearchSvg(ReadString(message, "requestId", string.Empty), editable: false);
				return;
			}
			if (string.Equals(messageType, "insertEditableResearchSvg", StringComparison.OrdinalIgnoreCase))
			{
				InsertResearchSvg(ReadString(message, "requestId", string.Empty), editable: true);
				return;
			}
			if (string.Equals(messageType, "convertCroppedResearchSvg", StringComparison.OrdinalIgnoreCase))
			{
				ConvertCroppedResearchSvg(ReadString(message, "requestId", string.Empty));
				return;
			}
			if (!string.Equals(messageType, "insertResearchChart", StringComparison.OrdinalIgnoreCase))
			{
				return;
			}
			ChartDataset dataset = DeserializeValue<ChartDataset>(message, "dataset") ?? new ChartDataset();
			ZlkChartSpec spec = DeserializeValue<ZlkChartSpec>(message, "chartSpec") ?? new ZlkChartSpec();
			string requestId = ReadString(message, "requestId", "studio-" + DateTime.UtcNow.Ticks);
			ZlkClusterPlotRequest request = new ZlkClusterPlotRequest
			{
				// Keep the UI correlation id out of the automation target resolver so insertion stays in the current presentation.
				RequestId = string.Empty,
				ChartType = spec.ChartType ?? "genericTable",
				SourceLabel = dataset.Source?.Path ?? "科研绘图工作区"
			};
			ZlkChartRenderResult result = insertChart(dataset, spec, request);
			PostResult(requestId, true, result?.ChartType, null);
			reportStatus?.Invoke("已从科研绘图工作区插入 PPT 原生图表。", false);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("科研绘图工作区插入失败。", ex);
			PostResult(string.Empty, false, string.Empty, ex.Message);
			reportStatus?.Invoke("科研绘图工作区插入失败：" + ex.Message, true);
		}
	}

	private void PostNativeMaximizeResult()
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchChartFullscreenResult",
			fullscreen = (WindowState == FormWindowState.Maximized)
		}));
	}

	private void StageResearchSvg(string requestId, string svgText, string fileName)
	{
		try
		{
			selectedSvg = ResearchChartStudioService.StageSvg(svgText, fileName);
			PostSvgStageResult(requestId, selectedSvg, null);
			reportStatus?.Invoke("本地科研 SVG 已通过安全校验。", false);
		}
		catch (Exception ex)
		{
			selectedSvg = null;
			AddInLogger.Error("暂存本地科研 SVG 失败。", ex);
			PostSvgStageResult(requestId, null, ex.Message);
			reportStatus?.Invoke("本地科研 SVG 校验失败：" + ex.Message, true);
		}
	}

	private void SelectResearchSvg(bool fromTavotto = false)
	{
		using (OpenFileDialog dialog = new OpenFileDialog
		{
			Title = fromTavotto ? "选择 Tavotto 导出的 SVG" : "选择科研绘图 SVG",
			Filter = "SVG 矢量图 (*.svg)|*.svg",
			CheckFileExists = true,
			Multiselect = false,
			RestoreDirectory = true,
			InitialDirectory = fromTavotto ? TavottoExportDirectory() : string.Empty
		})
		{
			if (dialog.ShowDialog(this) != DialogResult.OK)
			{
				PostSvgSelectionResult(null, canceled: true, null);
				return;
			}
			try
			{
				selectedSvg = ResearchChartStudioService.LoadSvg(dialog.FileName);
				PostSvgSelectionResult(selectedSvg, canceled: false, null);
				reportStatus?.Invoke("科研 SVG 已通过安全校验。", false);
			}
			catch (Exception ex)
			{
				selectedSvg = null;
				AddInLogger.Error("读取科研 SVG 失败。", ex);
				PostSvgSelectionResult(null, canceled: false, ex.Message);
				reportStatus?.Invoke("读取科研 SVG 失败：" + ex.Message, true);
			}
		}
	}

	private void InsertResearchSvg(string requestId, bool editable)
	{
		try
		{
			if (selectedSvg == null)
			{
				throw new InvalidOperationException("请先选择并预览一个 SVG 文件。");
			}
			string shapeName = editable ? insertEditableSvg(selectedSvg) : insertSvg(selectedSvg);
			PostSvgInsertResult(requestId, true, shapeName, null, editable);
			reportStatus?.Invoke(editable ? "已将科研 SVG 转为可编辑图形。" : "已将科研 SVG 插入当前幻灯片。", false);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("插入科研 SVG 失败。", ex);
			PostSvgInsertResult(requestId, false, string.Empty, ex.Message, editable);
			reportStatus?.Invoke("插入科研 SVG 失败：" + ex.Message, true);
		}
	}

	private void ConvertCroppedResearchSvg(string requestId)
	{
		try
		{
			string shapeName = convertCroppedSvg();
			PostSvgCropResult(requestId, true, shapeName, null);
			reportStatus?.Invoke("已按选中 SVG 的裁剪区域转换为可编辑图形。", false);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("按裁剪区域转换 SVG 失败。", ex);
			PostSvgCropResult(requestId, false, string.Empty, ex.Message);
			reportStatus?.Invoke("按裁剪区域转换 SVG 失败：" + ex.Message, true);
		}
	}

	private string TavottoExportDirectory()
	{
		if (string.IsNullOrWhiteSpace(tavottoProjectDirectory)) return string.Empty;
		string export = Path.Combine(tavottoProjectDirectory, "tavottofile", "export");
		return Directory.Exists(export) ? export : tavottoProjectDirectory;
	}

	private async void HandleTavottoHandoff(string action, string requestId)
	{
		if (tavottoBusy)
		{
			PostTavottoResult(requestId, action, null, "Tavotto 交接正在进行，请等待当前操作完成。");
			return;
		}
		string figurePath = null;
		if (string.Equals(action, "openFigureInTavotto", StringComparison.OrdinalIgnoreCase))
		{
			using (OpenFileDialog dialog = new OpenFileDialog
			{
				Title = "选择交给 Tavotto 的科研图",
				Filter = "科研图 (*.pdf;*.svg;*.png;*.jpg;*.jpeg;*.eps;*.tif;*.tiff)|*.pdf;*.svg;*.png;*.jpg;*.jpeg;*.eps;*.tif;*.tiff",
				CheckFileExists = true,
				Multiselect = false,
				RestoreDirectory = true
			})
			{
				if (dialog.ShowDialog(this) != DialogResult.OK)
				{
					PostTavottoResult(requestId, action, null, string.Empty, canceled: true);
					return;
				}
				figurePath = dialog.FileName;
			}
		}
		tavottoBusy = true;
		try
		{
			ResearchSvgDocument svgSnapshot = selectedSvg;
			TavottoHandoffResult result = await Task.Run(() =>
				string.Equals(action, "checkTavotto", StringComparison.OrdinalIgnoreCase) ? TavottoHandoffService.Check() :
				string.Equals(action, "openCurrentInTavotto", StringComparison.OrdinalIgnoreCase) ? TavottoHandoffService.OpenCurrentSvg(svgSnapshot) :
				TavottoHandoffService.OpenFigure(figurePath));
			if (IsDisposed || webView.CoreWebView2 == null) return;
			if (!string.IsNullOrWhiteSpace(result.Project)) tavottoProjectDirectory = result.Project;
			PostTavottoResult(requestId, action, result, null);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("Tavotto 交接失败。", ex);
			if (!IsDisposed) PostTavottoResult(requestId, action, null, ex.Message);
		}
		finally
		{
			tavottoBusy = false;
		}
	}

	private void PostTavottoResult(string requestId, string action, TavottoHandoffResult result, string error, bool canceled = false)
	{
		if (webView.CoreWebView2 == null) return;
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "tavottoHandoffResult",
			requestId,
			action,
			ok = result != null,
			canceled,
			version = result?.Version ?? string.Empty,
			project = result?.Project ?? string.Empty,
			launchMode = result?.LaunchMode ?? string.Empty,
			parameterizable = result?.Parameterizable ?? false,
			error = error ?? string.Empty
		}));
	}

	private void PostSvgSelectionResult(ResearchSvgDocument document, bool canceled, string error)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchSvgSelectionResult",
			ok = document != null,
			canceled,
			fileName = document?.FileName ?? string.Empty,
			sizeBytes = document?.SizeBytes ?? 0L,
			width = document?.Width ?? 0.0,
			height = document?.Height ?? 0.0,
			svgText = document?.SvgText ?? string.Empty,
			error = error ?? string.Empty
		}));
	}

	private void PostSvgStageResult(string requestId, ResearchSvgDocument document, string error)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchSvgStageResult",
			requestId,
			ok = document != null,
			fileName = document?.FileName ?? string.Empty,
			sizeBytes = document?.SizeBytes ?? 0L,
			width = document?.Width ?? 0.0,
			height = document?.Height ?? 0.0,
			sha256 = document?.Sha256 ?? string.Empty,
			error = error ?? string.Empty
		}));
	}

	private void PostSvgInsertResult(string requestId, bool ok, string shapeName, string error, bool editable)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchSvgInsertResult",
			requestId,
			ok,
			shapeName = shapeName ?? string.Empty,
			editable,
			error = error ?? string.Empty
		}));
	}

	private void PostSvgCropResult(string requestId, bool ok, string shapeName, string error)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchSvgCropResult",
			requestId,
			ok,
			shapeName = shapeName ?? string.Empty,
			error = error ?? string.Empty
		}));
	}

	private void OpenResearchChartWebsite(string websiteId)
	{
		try
		{
			ResearchChartStudioService.OpenWebsite(websiteId);
			PostWebsiteResult(true, null);
			reportStatus?.Invoke("已使用系统浏览器打开科研绘图网站。", false);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("打开科研绘图网站失败。", ex);
			PostWebsiteResult(false, ex.Message);
			reportStatus?.Invoke("打开科研绘图网站失败：" + ex.Message, true);
		}
	}

	private void PostWebsiteResult(bool ok, string error)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchWebsiteOpenResult",
			ok,
			error = error ?? string.Empty
		}));
	}

	private void PostResult(string requestId, bool ok, string chartType, string error)
	{
		if (webView.CoreWebView2 == null)
		{
			return;
		}
		webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(new
		{
			type = "researchChartInsertResult",
			requestId,
			ok,
			chartType,
			error = error ?? string.Empty
		}));
	}

	private T DeserializeValue<T>(System.Collections.Generic.Dictionary<string, object> message, string key) where T : class
	{
		if (!message.TryGetValue(key, out object value) || value == null)
		{
			return null;
		}
		return serializer.ConvertToType<T>(value);
	}

	private static string ReadString(System.Collections.Generic.Dictionary<string, object> message, string key, string fallback)
	{
		return message.TryGetValue(key, out object value) && !string.IsNullOrWhiteSpace(Convert.ToString(value)) ? Convert.ToString(value) : fallback;
	}

	protected override void OnFormClosing(FormClosingEventArgs e)
	{
		if (e.CloseReason == CloseReason.UserClosing)
		{
			e.Cancel = true;
			Hide();
		}
		else
		{
			base.OnFormClosing(e);
		}
	}

	protected override void Dispose(bool disposing)
	{
		if (disposing)
		{
			if (webView.CoreWebView2 != null)
			{
				webView.CoreWebView2.NavigationStarting -= OnNavigationStarting;
				webView.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
				webView.CoreWebView2.WebMessageReceived -= OnWebMessageReceived;
			}
			webView.Dispose();
		}
		base.Dispose(disposing);
	}

	private static string ResolveUiDirectory()
	{
		string[] candidates = new string[2]
		{
			Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui"),
			Path.Combine(Path.GetDirectoryName(typeof(ResearchChartStudioWindow).Assembly.Location) ?? string.Empty, "ui")
		};
		foreach (string candidate in candidates)
		{
			if (File.Exists(Path.Combine(candidate, "research-chart-studio.html")))
			{
				return candidate;
			}
		}
		return candidates[0];
	}
}
