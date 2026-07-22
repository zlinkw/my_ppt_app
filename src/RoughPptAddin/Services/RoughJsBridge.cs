using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class RoughJsBridge
{
	private const string UiHostName = "rough-ppt.local";

	private static readonly string[] RequiredUiFiles = new string[25]
	{
		"index.html",
		"help.html",
		"help.mjs",
		"help.css",
		Path.Combine("help-assets", "taskpane-overview.png"),
		Path.Combine("help-assets", "style-workspace.png"),
		Path.Combine("help-assets", "feature-workspace.png"),
		Path.Combine("help-assets", "chart-workspace.png"),
		"app.mjs",
		"ribbon-shape-gallery.html",
		"ribbon-shape-gallery.mjs",
		"ribbon-shape-gallery.css",
		"rough-shape-generator.mjs",
		"office-preset-outlines.mjs",
		"zlk-cluster-result-importer.mjs",
		"autoshape-catalog.json",
		"styles.css",
		Path.Combine("vendor", "rough.esm.js"),
		"research-chart-studio.html",
		"research-chart-studio.css",
		"research-chart-studio.mjs",
		Path.Combine("vendor", "chart.umd.min.js"),
		Path.Combine("vendor", "chartjs-LICENSE.md"),
		Path.Combine("vendor", "papaparse.min.js"),
		Path.Combine("vendor", "papaparse-LICENSE.txt")
	};

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 8388608
	};

	private readonly object sync = new object();

	private WebView2 webView;

	private WebView2 eventSource;

	private Task initializationTask;

	private Exception lastFailure;

	private bool initialized;

	public bool IsReady
	{
		get
		{
			if (webView?.CoreWebView2 != null)
			{
				return initialized;
			}
			return false;
		}
	}

	public string LastFailureMessage => lastFailure?.Message;

	public static string UserDataFolder => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin", "WebView2");

	public static Task<CoreWebView2Environment> CreateEnvironmentAsync()
	{
		Directory.CreateDirectory(UserDataFolder);
		return CoreWebView2Environment.CreateAsync(null, UserDataFolder);
	}

	public void Attach(WebView2 webView)
	{
		this.webView = webView;
	}

	public async Task<RoughDrawable> GenerateAsync(RoughShapeRequest request)
	{
		if (!IsReady)
		{
			await WaitUntilReadyAsync(TimeSpan.FromSeconds(30.0)).ConfigureAwait(continueOnCapturedContext: true);
		}
		string json = serializer.Serialize(request);
		string script = "window.roughPpt.generateFromHost(" + json + ")";
		string raw = await webView.CoreWebView2.ExecuteScriptAsync(script).ConfigureAwait(continueOnCapturedContext: true);
		string unescaped = serializer.Deserialize<string>(raw);
		return serializer.Deserialize<RoughDrawable>(unescaped);
	}

	public async Task<ChartDataset> ImportZlkClusterResultAsync(string filePath, string content)
	{
		if (!IsReady)
		{
			await WaitUntilReadyAsync(TimeSpan.FromSeconds(30.0)).ConfigureAwait(continueOnCapturedContext: true);
		}
		string pathJson = serializer.Serialize(filePath ?? string.Empty);
		string contentJson = serializer.Serialize(content ?? string.Empty);
		string script = "window.roughPpt.importZlkClusterResultForHost(" + pathJson + ", " + contentJson + ")";
		string raw = await webView.CoreWebView2.ExecuteScriptAsync(script).ConfigureAwait(continueOnCapturedContext: true);
		string unescaped = serializer.Deserialize<string>(raw);
		return serializer.Deserialize<ChartDataset>(unescaped);
	}

	public async Task InitializeAsync(WebView2 view, string uiDirectory)
	{
		Attach(view);
		if (initialized)
		{
			return;
		}
		Task task;
		lock (sync)
		{
			if (initialized)
			{
				return;
			}
			if (initializationTask == null || initializationTask.IsFaulted || initializationTask.IsCanceled)
			{
				initializationTask = InitializeCoreAsync(view, uiDirectory);
			}
			task = initializationTask;
		}
		try
		{
			await task.ConfigureAwait(continueOnCapturedContext: true);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("Rough.js 本机界面初始化失败。", lastFailure = ex);
			throw;
		}
	}

	public async Task WaitUntilReadyAsync(TimeSpan timeout)
	{
		if (!IsReady)
		{
			Task task = initializationTask;
			if (task == null)
			{
				throw new InvalidOperationException("Rough.js 本机界面尚未开始加载。日志：" + AddInLogger.LogPath);
			}
			if (await Task.WhenAny(task, Task.Delay(timeout)).ConfigureAwait(continueOnCapturedContext: true) != task)
			{
				throw new TimeoutException("Rough.js 本机界面加载超时。日志：" + AddInLogger.LogPath);
			}
			await task.ConfigureAwait(continueOnCapturedContext: true);
			if (!IsReady)
			{
				throw new InvalidOperationException("Rough.js 桥接未就绪。日志：" + AddInLogger.LogPath);
			}
		}
	}

	private async Task InitializeCoreAsync(WebView2 view, string uiDirectory)
	{
		ValidateUiDirectory(uiDirectory);
		ValidateUiContent(uiDirectory);
		AddInLogger.Info("开始加载本机 UI：" + uiDirectory);
		if (view.CoreWebView2 == null)
		{
			await view.EnsureCoreWebView2Async(await CreateEnvironmentAsync().ConfigureAwait(continueOnCapturedContext: true)).ConfigureAwait(continueOnCapturedContext: true);
		}
		ConfigureWebView(view);
		view.CoreWebView2.SetVirtualHostNameToFolderMapping("rough-ppt.local", uiDirectory, CoreWebView2HostResourceAccessKind.Allow);
		await NavigateAsync(view, "https://rough-ppt.local/index.html", TimeSpan.FromSeconds(20.0)).ConfigureAwait(continueOnCapturedContext: true);
		await WaitForGeneratorAsync(view, TimeSpan.FromSeconds(20.0)).ConfigureAwait(continueOnCapturedContext: true);
		initialized = true;
		lastFailure = null;
		AddInLogger.Info("Rough.js 本机界面已就绪。");
	}

	private void ConfigureWebView(WebView2 view)
	{
		if (eventSource != view)
		{
			eventSource = view;
			CoreWebView2 coreWebView = view.CoreWebView2;
			coreWebView.Settings.AreDefaultContextMenusEnabled = false;
			coreWebView.Settings.AreDevToolsEnabled = false;
			coreWebView.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs args)
			{
				AddInLogger.Info("WebView 导航完成：success=" + args.IsSuccess + " status=" + args.WebErrorStatus);
			};
			coreWebView.ProcessFailed += delegate(object sender, CoreWebView2ProcessFailedEventArgs args)
			{
				AddInLogger.Info("WebView 进程失败：" + args.ProcessFailedKind.ToString() + " " + args.Reason);
			};
			coreWebView.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
			coreWebView.WebResourceRequested += OnWebResourceRequested;
		}
	}

	private void OnWebResourceRequested(object sender, CoreWebView2WebResourceRequestedEventArgs args)
	{
		if (!IsAllowedLocalUri(args.Request.Uri))
		{
			AddInLogger.Info("已阻止外部资源请求：" + args.Request.Uri);
			MemoryStream stream = new MemoryStream(Encoding.UTF8.GetBytes("RoughPptAddin blocks non-local resources."));
			args.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(stream, 403, "Forbidden", "Content-Type: text/plain; charset=utf-8");
		}
	}

	private static bool IsAllowedLocalUri(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return false;
		}
		if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
		{
			return false;
		}
		if (string.Equals(uri.Host, "rough-ppt.local", StringComparison.OrdinalIgnoreCase))
		{
			return true;
		}
		if (!string.Equals(uri.Scheme, "file", StringComparison.OrdinalIgnoreCase) && !string.Equals(uri.Scheme, "data", StringComparison.OrdinalIgnoreCase) && !string.Equals(uri.Scheme, "about", StringComparison.OrdinalIgnoreCase))
		{
			return string.Equals(uri.Scheme, "blob", StringComparison.OrdinalIgnoreCase);
		}
		return true;
	}

	private static async Task NavigateAsync(WebView2 view, string uri, TimeSpan timeout)
	{
		TaskCompletionSource<bool> completion = new TaskCompletionSource<bool>();
		EventHandler<CoreWebView2NavigationCompletedEventArgs> handler = null;
		handler = delegate(object sender, CoreWebView2NavigationCompletedEventArgs args)
		{
			view.CoreWebView2.NavigationCompleted -= handler;
			if (args.IsSuccess)
			{
				completion.TrySetResult(result: true);
			}
			else
			{
				completion.TrySetException(new InvalidOperationException("WebView2 页面加载失败：" + args.WebErrorStatus));
			}
		};
		view.CoreWebView2.NavigationCompleted += handler;
		view.CoreWebView2.Navigate(uri);
		Task obj = await Task.WhenAny(completion.Task, Task.Delay(timeout)).ConfigureAwait(continueOnCapturedContext: true);
		view.CoreWebView2.NavigationCompleted -= handler;
		if (obj != completion.Task)
		{
			throw new TimeoutException("WebView2 本机页面导航超时。");
		}
		await completion.Task.ConfigureAwait(continueOnCapturedContext: true);
	}

	private async Task WaitForGeneratorAsync(WebView2 view, TimeSpan timeout)
	{
		Exception lastProbe = null;
		DateTime started = DateTime.UtcNow;
		while (DateTime.UtcNow - started < timeout)
		{
			try
			{
				string raw = await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.roughPpt && window.roughPpt.generateFromHost && window.roughPptTaskPaneReady)").ConfigureAwait(continueOnCapturedContext: true);
				if (string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) || string.Equals(serializer.Deserialize<object>(raw)?.ToString(), "True", StringComparison.OrdinalIgnoreCase))
				{
					return;
				}
			}
			catch (Exception ex)
			{
				lastProbe = ex;
			}
			await Task.Delay(100).ConfigureAwait(continueOnCapturedContext: true);
		}
		throw new TimeoutException("WebView2 中的 Rough.js 生成器未能及时就绪。日志：" + AddInLogger.LogPath, lastProbe);
	}

	private static void ValidateUiContent(string uiDirectory)
	{
		string appPath = Path.Combine(uiDirectory, "app.mjs");
		string htmlPath = Path.Combine(uiDirectory, "index.html");
		string helpPath = Path.Combine(uiDirectory, "help.html");
		string helpScriptPath = Path.Combine(uiDirectory, "help.mjs");
		string appText = File.ReadAllText(appPath);
		string htmlText = File.ReadAllText(htmlPath);
		string helpText = File.ReadAllText(helpPath);
		string helpScriptText = File.ReadAllText(helpScriptPath);
		string[] appNeedles = new string[10] { "postHost", "chrome.webview", "roughPptTaskPaneReady", "listUserAssets", "getSelectionState", "function render(", "initWorkflowNavigation", "roughPptUiMode", "selectedChartPresetId", "openUsageGuide" };
		string[] htmlNeedles = new string[10] { "id=\"params\"", "id=\"search\"", "id=\"refreshSelection\"", "id=\"convertSelection\"", "id=\"shapeGrid\"", "id=\"uiModeSimple\"", "id=\"usageGuide\"", "href=\"./help.html\"", "id=\"chartPresetStrip\"", "type=\"module\" src=\"./app.mjs\"" };
		string[] helpNeedles = new string[8] { "id=\"quick-start\"", "id=\"entry-map\"", "id=\"rough-shapes\"", "id=\"charts\"", "id=\"troubleshooting\"", "href=\"./index.html\"", "data-guide-back", "type=\"module\" src=\"./help.mjs\"" };
		string[] helpScriptNeedles = new string[3] { "history.back()", "location.href = \"./index.html\"", "event.key !== \"Escape\"" };
		string[] array = appNeedles;
		foreach (string needle in array)
		{
			if (appText.IndexOf(needle, StringComparison.Ordinal) < 0)
			{
				throw new InvalidDataException("本机 UI 脚本缺少关键能力，可能不是完整前端：" + needle + " @ " + appPath);
			}
		}
		array = htmlNeedles;
		foreach (string needle2 in array)
		{
			if (htmlText.IndexOf(needle2, StringComparison.Ordinal) < 0)
			{
				throw new InvalidDataException("本机 UI 页面缺少关键结构，可能不是完整前端：" + needle2 + " @ " + htmlPath);
			}
		}
		array = helpNeedles;
		foreach (string needle3 in array)
		{
			if (helpText.IndexOf(needle3, StringComparison.Ordinal) < 0)
			{
				throw new InvalidDataException("本机使用说明缺少关键章节，可能不是完整前端：" + needle3 + " @ " + helpPath);
			}
		}
		array = helpScriptNeedles;
		foreach (string needle4 in array)
		{
			if (helpScriptText.IndexOf(needle4, StringComparison.Ordinal) < 0)
			{
				throw new InvalidDataException("本机使用说明返回脚本缺少关键能力，可能不是完整前端：" + needle4 + " @ " + helpScriptPath);
			}
		}
	}

	private static void ValidateUiDirectory(string uiDirectory)
	{
		if (string.IsNullOrWhiteSpace(uiDirectory) || !Directory.Exists(uiDirectory))
		{
			throw new DirectoryNotFoundException("本机 UI 目录不存在：" + uiDirectory);
		}
		string[] missing = (from file in RequiredUiFiles
			select Path.Combine(uiDirectory, file) into path
			where !File.Exists(path)
			select path).ToArray();
		if (missing.Length != 0)
		{
			throw new FileNotFoundException("本机 UI 文件缺失：" + string.Join("; ", missing));
		}
	}
}
