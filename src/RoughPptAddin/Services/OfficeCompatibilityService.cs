using Microsoft.Office.Interop.PowerPoint;
using Microsoft.Web.WebView2.Core;
using System.Collections.Generic;
using System.Globalization;
using System;

namespace RoughPptAddin.Services
{
    public static class OfficeCompatibilityService
    {
    	private const int MinimumSupportedPowerPointMajor = 15;
    
    	public static OfficeCompatibilityInfo Detect(Application application)
    	{
    		string versionText = SafeValue(() => application?.Version, "未知版本");
    		int major = ParseMajorVersion(versionText);
    		string webViewVersion = SafeValue(() => CoreWebView2Environment.GetAvailableBrowserVersionString(), string.Empty);
    		string architecture = DetectProcessArchitecture();
    		List<string> warnings = new List<string>();
    		bool supportedPowerPoint = major == 0 || major >= 15;
    		if (!supportedPowerPoint)
    		{
    			warnings.Add("当前 PowerPoint 版本低于 2013，Ribbon 与任务窗格能力不在兼容范围内；建议升级到 PowerPoint 2013 或更高版本。");
    		}
    		if (string.IsNullOrWhiteSpace(webViewVersion))
    		{
    			warnings.Add("未检测到 Microsoft Edge WebView2 Runtime；Ribbon 原生操作仍可显示，但右侧任务窗格无法加载。请安装 Evergreen WebView2 Runtime。");
    		}
    		if (architecture.IndexOf("ARM", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			warnings.Add("检测到 ARM64 Office。手绘与原生绘图可继续使用，但当前 SQLite 本机组件仅保证 x86/x64，Zotero 论文图像库可能不可用。");
    		}
    		return new OfficeCompatibilityInfo
    		{
    			PowerPointVersion = versionText,
    			PowerPointMajorVersion = major,
    			PowerPointRelease = ReleaseName(major),
    			OfficeArchitecture = architecture,
    			WindowsVersion = Environment.OSVersion.VersionString,
    			WebView2Version = webViewVersion,
    			IsSupportedPowerPoint = supportedPowerPoint,
    			HasWebView2Runtime = !string.IsNullOrWhiteSpace(webViewVersion),
    			Warning = string.Join(" ", warnings)
    		};
    	}
    
    	public static string InitializationFailureMessage(Exception exception, OfficeCompatibilityInfo compatibility)
    	{
    		string summary = compatibility?.Summary ?? "未能读取当前 PowerPoint 环境信息。";
    		if (ContainsException(exception, "WebView2RuntimeNotFoundException") || ContainsText(exception, "WebView2 Runtime"))
    		{
    			return "未检测到可用的 Microsoft Edge WebView2 Runtime。请安装 Evergreen WebView2 Runtime 后重新打开 PowerPoint。环境：" + summary;
    		}
    		if (ContainsException(exception, "UnauthorizedAccessException"))
    		{
    			return "右侧窗格无法访问本机 WebView2 数据目录。请确认当前用户可写入 %LOCALAPPDATA%\\RoughPptAddin，并避免使用只读或受限配置文件。环境：" + summary;
    		}
    		if (compatibility != null && !compatibility.IsSupportedPowerPoint)
    		{
    			return compatibility.Warning + " 环境：" + summary;
    		}
    		return (exception?.Message ?? "未知错误") + Environment.NewLine + "环境：" + summary;
    	}
    
    	private static int ParseMajorVersion(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return 0;
    		}
    		if (Version.TryParse(value, out var parsed))
    		{
    			return parsed.Major;
    		}
    		if (!int.TryParse(value.Split('.')[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var major))
    		{
    			return 0;
    		}
    		return major;
    	}
    
    	private static string ReleaseName(int major)
    	{
    		if (major == 15)
    		{
    			return "PowerPoint 2013";
    		}
    		if (major == 16)
    		{
    			return "PowerPoint 2016/2019/2021/2024/Microsoft 365";
    		}
    		if (major > 16)
    		{
    			return "新版 PowerPoint";
    		}
    		if (major > 0)
    		{
    			return "旧版 PowerPoint";
    		}
    		return "PowerPoint";
    	}
    
    	private static string DetectProcessArchitecture()
    	{
    		string obj = Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? string.Empty;
    		string wowArchitecture = Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432") ?? string.Empty;
    		if (obj.IndexOf("ARM", StringComparison.OrdinalIgnoreCase) >= 0 || wowArchitecture.IndexOf("ARM", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return "ARM64 Office";
    		}
    		if (!Environment.Is64BitProcess)
    		{
    			return "32 位 Office";
    		}
    		return "64 位 Office";
    	}
    
    	private static string SafeValue(Func<string> getter, string fallback)
    	{
    		try
    		{
    			string value = getter?.Invoke();
    			return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    		}
    		catch
    		{
    			return fallback;
    		}
    	}
    
    	private static bool ContainsException(Exception exception, string typeName)
    	{
    		for (Exception current = exception; current != null; current = current.InnerException)
    		{
    			if (string.Equals(current.GetType().Name, typeName, StringComparison.OrdinalIgnoreCase))
    			{
    				return true;
    			}
    		}
    		return false;
    	}
    
    	private static bool ContainsText(Exception exception, string text)
    	{
    		for (Exception current = exception; current != null; current = current.InnerException)
    		{
    			if ((current.Message ?? string.Empty).IndexOf(text, StringComparison.OrdinalIgnoreCase) >= 0)
    			{
    				return true;
    			}
    		}
    		return false;
    	}
    }

    public sealed class OfficeCompatibilityInfo
    {
    	public string PowerPointVersion { get; set; }
    
    	public int PowerPointMajorVersion { get; set; }
    
    	public string PowerPointRelease { get; set; }
    
    	public string OfficeArchitecture { get; set; }
    
    	public string WindowsVersion { get; set; }
    
    	public string WebView2Version { get; set; }
    
    	public bool IsSupportedPowerPoint { get; set; }
    
    	public bool HasWebView2Runtime { get; set; }
    
    	public string Warning { get; set; }
    
    	public string Summary
    	{
    		get
    		{
    			string webView = (HasWebView2Runtime ? ("WebView2 " + WebView2Version) : "未检测到 WebView2 Runtime");
    			return PowerPointRelease + " " + PowerPointVersion + "，" + OfficeArchitecture + "，" + WindowsVersion + "，" + webView + "。";
    		}
    	}
    }
}
