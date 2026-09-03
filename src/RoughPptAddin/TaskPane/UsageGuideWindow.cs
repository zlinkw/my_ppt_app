using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using RoughPptAddin.Services;

namespace RoughPptAddin.TaskPane;

public sealed class UsageGuideWindow : Form
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

	private readonly WebView2 webView = new WebView2();

	private bool initializationStarted;

	public UsageGuideWindow(Func<IntPtr> ownerWindowHandle, Action<string, bool> reportStatus)
	{
		this.ownerWindowHandle = ownerWindowHandle;
		this.reportStatus = reportStatus;
		Text = "Rough 使用说明";
		base.ShowIcon = false;
		base.ShowInTaskbar = true;
		base.MinimizeBox = true;
		base.MaximizeBox = true;
		base.FormBorderStyle = FormBorderStyle.Sizable;
		base.SizeGripStyle = SizeGripStyle.Show;
		MinimumSize = new Size(520, 420);
		base.Size = new Size(920, 760);
		base.StartPosition = FormStartPosition.Manual;
		base.TopMost = false;
		base.KeyPreview = true;
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
			webView.CoreWebView2.SetVirtualHostNameToFolderMapping("rough-ppt.local", uiDirectory, CoreWebView2HostResourceAccessKind.Allow);
			webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
			webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
			webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
			webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
			webView.CoreWebView2.Navigate("https://rough-ppt.local/help.html");
		}
		catch (Exception ex)
		{
			initializationStarted = false;
			AddInLogger.Error("打开独立使用说明失败。", ex);
			reportStatus?.Invoke("打开使用说明失败：" + ex.Message, arg2: true);
		}
	}

	private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
	{
		if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || !string.Equals(uri.Host, "rough-ppt.local", StringComparison.OrdinalIgnoreCase))
		{
			e.Cancel = true;
		}
		else if (string.Equals(uri.AbsolutePath, "/index.html", StringComparison.OrdinalIgnoreCase))
		{
			e.Cancel = true;
			Hide();
		}
		else if (!string.Equals(uri.AbsolutePath, "/help.html", StringComparison.OrdinalIgnoreCase))
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
			AddInLogger.Error("独立使用说明导航失败。", exception);
			reportStatus?.Invoke("使用说明页面加载失败：" + e.WebErrorStatus, arg2: true);
		}
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
			Path.Combine(Path.GetDirectoryName(typeof(UsageGuideWindow).Assembly.Location) ?? string.Empty, "ui")
		};
		string[] array = candidates;
		foreach (string candidate in array)
		{
			if (File.Exists(Path.Combine(candidate, "help.html")))
			{
				return candidate;
			}
		}
		return candidates[0];
	}
}
