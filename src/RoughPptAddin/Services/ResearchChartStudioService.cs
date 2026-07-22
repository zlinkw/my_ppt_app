using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace RoughPptAddin.Services;

public static class ResearchChartStudioService
{
	public const string DefaultWebsiteId = "rawgraphs";

	private static readonly IReadOnlyDictionary<string, string> WebsiteUrls = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
	{
		["rawgraphs"] = "https://app.rawgraphs.io/",
		["datawrapper"] = "https://app.datawrapper.de/",
		["plotly"] = "https://chart-studio.plotly.com/",
		["vega"] = "https://vega.github.io/editor/"
	};

	public static string OpenWebsite(string websiteId)
	{
		if (string.IsNullOrWhiteSpace(websiteId) || !WebsiteUrls.TryGetValue(websiteId.Trim(), out string url))
		{
			throw new InvalidOperationException("不允许打开未登记的科研绘图网站。");
		}
		Process.Start(new ProcessStartInfo
		{
			FileName = url,
			UseShellExecute = true
		});
		return url;
	}
}
