using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using RoughPptAddin.Services;

namespace RoughPptAddin.Ribbon;

public sealed class ShapeGalleryWindow : Form
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

	private readonly Action<string> insertShape;

	private readonly Action<string> pinQuickShape;

	private readonly Action<string> unpinQuickShape;

	private readonly Func<IList<string>> listQuickShapes;

	private readonly Func<IntPtr> ownerWindowHandle;

	private readonly Action<string, bool> reportStatus;

	private readonly WebView2 webView = new WebView2();

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();

	private bool initializationStarted;

	public ShapeGalleryWindow(Action<string> insertShape, Action<string> pinQuickShape, Action<string> unpinQuickShape, Func<IList<string>> listQuickShapes, Func<IntPtr> ownerWindowHandle, Action<string, bool> reportStatus = null)
	{
		this.insertShape = insertShape;
		this.pinQuickShape = pinQuickShape;
		this.unpinQuickShape = unpinQuickShape;
		this.listQuickShapes = listQuickShapes;
		this.ownerWindowHandle = ownerWindowHandle;
		this.reportStatus = reportStatus;
		Text = "Rough 形状图库";
		base.ShowIcon = false;
		base.ShowInTaskbar = false;
		base.MinimizeBox = false;
		base.MaximizeBox = false;
		base.FormBorderStyle = FormBorderStyle.SizableToolWindow;
		base.SizeGripStyle = SizeGripStyle.Show;
		MinimumSize = new Size(420, 320);
		base.Size = new Size(700, 620);
		base.StartPosition = FormStartPosition.Manual;
		base.TopMost = false;
		webView.Dock = DockStyle.Fill;
		base.Controls.Add(webView);
	}

	public void ShowNearCursor()
	{
		BeginInitialization();
		SendQuickShapes();
		Rectangle workingArea = Screen.FromPoint(Cursor.Position).WorkingArea;
		int left = Math.Min(Cursor.Position.X, workingArea.Right - base.Width);
		int top = Math.Min(Cursor.Position.Y + 8, workingArea.Bottom - base.Height);
		base.Location = new Point(Math.Max(workingArea.Left, left), Math.Max(workingArea.Top, top));
		if (!base.Visible)
		{
			IntPtr handle = ownerWindowHandle?.Invoke() ?? IntPtr.Zero;
			if (handle != IntPtr.Zero)
			{
				Show(new WindowOwner(handle));
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
			webView.CoreWebView2.SetVirtualHostNameToFolderMapping("rough-ppt.local", uiDirectory, CoreWebView2HostResourceAccessKind.Allow);
			webView.CoreWebView2.WebMessageReceived -= OnWebMessageReceived;
			webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
			webView.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
			webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
			webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
			webView.CoreWebView2.Navigate("https://rough-ppt.local/ribbon-shape-gallery.html");
		}
		catch (Exception ex)
		{
			initializationStarted = false;
			AddInLogger.Error("打开 Ribbon 形状图库失败。", ex);
			ReportOpenFailure(ex);
		}
	}

	private void ReportOpenFailure(Exception ex)
	{
		string message = "打开形状图库失败：" + ex.Message + Environment.NewLine + "日志：" + AddInLogger.LogPath;
		if (reportStatus != null)
		{
			try
			{
				reportStatus(message, arg2: true);
				return;
			}
			catch (Exception exception)
			{
				AddInLogger.Error("形状图库状态回传失败。", exception);
			}
		}
		MessageBox.Show(message, "Rough 手绘图形");
	}

	private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
	{
		try
		{
			Dictionary<string, object> message = serializer.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson);
			if (!message.TryGetValue("type", out var typeValue))
			{
				return;
			}
			string type = Convert.ToString(typeValue);
			if (string.Equals(type, "insertShape", StringComparison.OrdinalIgnoreCase))
			{
				if (message.TryGetValue("enumName", out var enumValue))
				{
					string enumName = Convert.ToString(enumValue);
					if (!string.IsNullOrWhiteSpace(enumName))
					{
						insertShape?.Invoke(enumName);
						SendQuickShapes();
					}
				}
			}
			else if (string.Equals(type, "pinQuickShape", StringComparison.OrdinalIgnoreCase))
			{
				if (message.TryGetValue("enumName", out var enumValue2))
				{
					string enumName2 = Convert.ToString(enumValue2);
					if (!string.IsNullOrWhiteSpace(enumName2))
					{
						pinQuickShape?.Invoke(enumName2);
						SendQuickShapes();
					}
				}
			}
			else if (string.Equals(type, "unpinQuickShape", StringComparison.OrdinalIgnoreCase))
			{
				if (message.TryGetValue("enumName", out var enumValue3))
				{
					string enumName3 = Convert.ToString(enumValue3);
					if (!string.IsNullOrWhiteSpace(enumName3))
					{
						unpinQuickShape?.Invoke(enumName3);
						SendQuickShapes();
					}
				}
			}
			else if (string.Equals(type, "close", StringComparison.OrdinalIgnoreCase))
			{
				Hide();
			}
		}
		catch (Exception exception)
		{
			AddInLogger.Error("处理 Ribbon 形状图库消息失败。", exception);
		}
	}

	private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
	{
		if (!e.IsSuccess)
		{
			initializationStarted = false;
			AddInLogger.Error("Ribbon 形状图库导航失败。", new InvalidOperationException(e.WebErrorStatus.ToString()));
		}
		else
		{
			SendQuickShapes();
		}
	}

	private void SendQuickShapes()
	{
		try
		{
			if (webView.CoreWebView2 != null)
			{
				Dictionary<string, object> payload = new Dictionary<string, object>
				{
					["type"] = "quickShapes",
					["shapes"] = listQuickShapes?.Invoke() ?? new List<string>()
				};
				webView.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(payload));
			}
		}
		catch (Exception exception)
		{
			AddInLogger.Error("发送 Ribbon 形状图库快速插入状态失败。", exception);
		}
	}

	protected override void Dispose(bool disposing)
	{
		if (disposing)
		{
			if (webView.CoreWebView2 != null)
			{
				webView.CoreWebView2.WebMessageReceived -= OnWebMessageReceived;
				webView.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
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
			Path.Combine(Path.GetDirectoryName(typeof(ShapeGalleryWindow).Assembly.Location) ?? string.Empty, "ui")
		};
		string[] array = candidates;
		foreach (string candidate in array)
		{
			if (File.Exists(Path.Combine(candidate, "ribbon-shape-gallery.html")))
			{
				return candidate;
			}
		}
		return candidates[0];
	}
}
