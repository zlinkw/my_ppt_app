using System;
using System.Drawing;
using System.IO;
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

	private readonly WebView2 webView = new WebView2();

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 8388608
	};

	private bool initializationStarted;

	public ResearchChartStudioWindow(Func<IntPtr> ownerWindowHandle, Action<string, bool> reportStatus, Func<ChartDataset, ZlkChartSpec, ZlkClusterPlotRequest, ZlkChartRenderResult> insertChart)
	{
		this.ownerWindowHandle = ownerWindowHandle;
		this.reportStatus = reportStatus;
		this.insertChart = insertChart;
		Text = "科研绘图工作区";
		base.ShowIcon = false;
		base.ShowInTaskbar = false;
		base.MinimizeBox = false;
		base.MaximizeBox = true;
		base.FormBorderStyle = FormBorderStyle.SizableToolWindow;
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
			if (!string.Equals(Convert.ToString(message?["type"]), "insertResearchChart", StringComparison.OrdinalIgnoreCase))
			{
				return;
			}
			ChartDataset dataset = DeserializeValue<ChartDataset>(message, "dataset") ?? new ChartDataset();
			ZlkChartSpec spec = DeserializeValue<ZlkChartSpec>(message, "chartSpec") ?? new ZlkChartSpec();
			string requestId = ReadString(message, "requestId", "studio-" + DateTime.UtcNow.Ticks);
			ZlkClusterPlotRequest request = new ZlkClusterPlotRequest
			{
				RequestId = requestId,
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
