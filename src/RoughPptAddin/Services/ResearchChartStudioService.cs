using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;

namespace RoughPptAddin.Services;

public sealed class ResearchSvgDocument
{
	public string SourcePath { get; set; }

	public string CachedPath { get; set; }

	public string FileName { get; set; }

	public string SvgText { get; set; }

	public string Sha256 { get; set; }

	public long SizeBytes { get; set; }

	public double Width { get; set; }

	public double Height { get; set; }
}

public static class ResearchChartStudioService
{
	public const string DefaultWebsiteId = "rawgraphs";

	public const long MaxSvgBytes = 4194304L;

	private const string SvgNamespace = "http://www.w3.org/2000/svg";

	private static readonly HashSet<string> ForbiddenElements = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
	{
		"script", "foreignObject", "iframe", "object", "embed", "audio", "video", "image", "animate", "animateMotion", "animateTransform", "set"
	};

	private static readonly Regex CssUrlPattern = new Regex("url\\s*\\(\\s*(['\\\"]?)([^)'\\\"]+)\\1\\s*\\)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

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

	public static ResearchSvgDocument LoadSvg(string sourcePath)
	{
		string fullPath = Path.GetFullPath(sourcePath ?? string.Empty);
		if (!string.Equals(Path.GetExtension(fullPath), ".svg", StringComparison.OrdinalIgnoreCase))
		{
			throw new InvalidDataException("请选择扩展名为 .svg 的文件。");
		}
		byte[] bytes = ReadBoundedSvg(fullPath);
		string text;
		try
		{
			text = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true).GetString(bytes).TrimStart('\uFEFF');
		}
		catch (DecoderFallbackException ex)
		{
			throw new InvalidDataException("SVG 必须使用 UTF-8 编码。", ex);
		}
		XDocument xml = ValidateSvg(text);
		ReadDimensions(xml.Root, out double width, out double height);
		string cacheDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin", "ResearchSvg");
		Directory.CreateDirectory(cacheDirectory);
		string cachedPath = Path.Combine(cacheDirectory, "current.svg");
		File.WriteAllBytes(cachedPath, bytes);
		return new ResearchSvgDocument
		{
			SourcePath = fullPath,
			CachedPath = cachedPath,
			FileName = Path.GetFileName(fullPath),
			SvgText = text,
			Sha256 = ComputeSha256(bytes),
			SizeBytes = bytes.LongLength,
			Width = width,
			Height = height
		};
	}

	public static string InsertIntoCurrentSlide(Microsoft.Office.Interop.PowerPoint.Application application, ResearchSvgDocument document)
	{
		if (document == null || string.IsNullOrWhiteSpace(document.CachedPath))
		{
			throw new InvalidOperationException("请先选择并预览一个 SVG 文件。");
		}
		if (ParsePowerPointMajorVersion(application?.Version) < 16)
		{
			throw new NotSupportedException("当前 PowerPoint 版本不支持直接插入 SVG。请使用 PowerPoint 2016 或更高版本，或改用右侧原生科研绘图入口。");
		}
		byte[] bytes = ReadBoundedSvg(document.CachedPath);
		string hash = ComputeSha256(bytes);
		if (!string.Equals(hash, document.Sha256, StringComparison.OrdinalIgnoreCase))
		{
			throw new InvalidDataException("当前 SVG 内容已变化，请重新选择文件后再插入。");
		}
		string text = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true).GetString(bytes).TrimStart('\uFEFF');
		ValidateSvg(text);
		if (!(application?.ActiveWindow?.View?.Slide is Slide slide))
		{
			throw new InvalidOperationException("当前没有可用幻灯片。");
		}
		float slideWidth = application.ActivePresentation?.PageSetup?.SlideWidth ?? 960f;
		float slideHeight = application.ActivePresentation?.PageSetup?.SlideHeight ?? 540f;
		double aspectRatio = (document.Width > 0.0 && document.Height > 0.0) ? document.Width / document.Height : 16.0 / 9.0;
		float width = slideWidth * 0.78f;
		float height = (float)(width / aspectRatio);
		float maxHeight = slideHeight * 0.78f;
		if (height > maxHeight)
		{
			height = maxHeight;
			width = (float)(height * aspectRatio);
		}
		float left = (slideWidth - width) / 2f;
		float top = (slideHeight - height) / 2f;
		Microsoft.Office.Interop.PowerPoint.Shape shape = slide.Shapes.AddPicture(document.CachedPath, MsoTriState.msoFalse, MsoTriState.msoTrue, left, top, width, height);
		shape.LockAspectRatio = MsoTriState.msoTrue;
		shape.Name = "ResearchSvg_" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture);
		shape.AlternativeText = "科研绘图 SVG：" + document.FileName + "；SHA256=" + document.Sha256.Substring(0, 12);
		shape.Select();
		return shape.Name;
	}

	private static byte[] ReadBoundedSvg(string path)
	{
		if (!File.Exists(path))
		{
			throw new FileNotFoundException("SVG 文件不存在。", path);
		}
		FileInfo info = new FileInfo(path);
		if (info.Length <= 0L)
		{
			throw new InvalidDataException("SVG 文件为空。");
		}
		if (info.Length > MaxSvgBytes)
		{
			throw new InvalidDataException("SVG 文件超过 4 MB 上限。");
		}
		return File.ReadAllBytes(path);
	}

	private static XDocument ValidateSvg(string text)
	{
		XmlReaderSettings settings = new XmlReaderSettings
		{
			DtdProcessing = DtdProcessing.Prohibit,
			XmlResolver = null,
			MaxCharactersFromEntities = 0L,
			MaxCharactersInDocument = MaxSvgBytes * 2L
		};
		XDocument document;
		try
		{
			using (StringReader input = new StringReader(text ?? string.Empty))
			using (XmlReader reader = XmlReader.Create(input, settings))
			{
				document = XDocument.Load(reader, LoadOptions.PreserveWhitespace);
			}
		}
		catch (XmlException ex)
		{
			throw new InvalidDataException("SVG XML 无效或包含禁止的 DTD。", ex);
		}
		XElement root = document.Root;
		if (root == null || !string.Equals(root.Name.LocalName, "svg", StringComparison.OrdinalIgnoreCase) || !string.Equals(root.Name.NamespaceName, SvgNamespace, StringComparison.Ordinal))
		{
			throw new InvalidDataException("文件不是标准 SVG 文档。");
		}
		if (document.DescendantNodes().OfType<XProcessingInstruction>().Any())
		{
			throw new InvalidDataException("SVG 不得包含处理指令。");
		}
		foreach (XElement element in root.DescendantsAndSelf())
		{
			if (ForbiddenElements.Contains(element.Name.LocalName))
			{
				throw new InvalidDataException("SVG 包含不允许的元素：" + element.Name.LocalName + "。");
			}
			foreach (XAttribute attribute in element.Attributes())
			{
				string name = attribute.Name.LocalName;
				string value = attribute.Value ?? string.Empty;
				if (name.StartsWith("on", StringComparison.OrdinalIgnoreCase) || string.Equals(name, "base", StringComparison.OrdinalIgnoreCase))
				{
					throw new InvalidDataException("SVG 包含不允许的事件或基址属性。");
				}
				if (string.Equals(name, "href", StringComparison.OrdinalIgnoreCase) || string.Equals(name, "src", StringComparison.OrdinalIgnoreCase))
				{
					if (!value.StartsWith("#", StringComparison.Ordinal))
					{
						throw new InvalidDataException("SVG 不得引用外部资源。");
					}
				}
				ValidateCssReferences(value);
			}
			if (string.Equals(element.Name.LocalName, "style", StringComparison.OrdinalIgnoreCase))
			{
				ValidateCssReferences(element.Value);
			}
		}
		return document;
	}

	private static void ValidateCssReferences(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return;
		}
		if (value.IndexOf("javascript:", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("vbscript:", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("@import", StringComparison.OrdinalIgnoreCase) >= 0)
		{
			throw new InvalidDataException("SVG 包含不允许的脚本或外部样式引用。");
		}
		foreach (Match match in CssUrlPattern.Matches(value))
		{
			if (!match.Groups[2].Value.Trim().StartsWith("#", StringComparison.Ordinal))
			{
				throw new InvalidDataException("SVG 样式不得引用外部资源。");
			}
		}
	}

	private static void ReadDimensions(XElement root, out double width, out double height)
	{
		width = ParseSvgLength(root?.Attribute("width")?.Value);
		height = ParseSvgLength(root?.Attribute("height")?.Value);
		string viewBox = root?.Attribute("viewBox")?.Value;
		if (!string.IsNullOrWhiteSpace(viewBox))
		{
			double[] values = Regex.Split(viewBox.Trim(), "[\\s,]+")
				.Select(value => double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed) ? parsed : double.NaN)
				.ToArray();
			if (values.Length == 4 && values[2] > 0.0 && values[3] > 0.0)
			{
				width = values[2];
				height = values[3];
			}
		}
		if (!(width > 0.0) || !(height > 0.0))
		{
			width = 960.0;
			height = 540.0;
		}
	}

	private static double ParseSvgLength(string value)
	{
		Match match = Regex.Match(value ?? string.Empty, "^\\s*([0-9]+(?:\\.[0-9]+)?)", RegexOptions.CultureInvariant);
		return match.Success && double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed) ? parsed : 0.0;
	}

	private static string ComputeSha256(byte[] bytes)
	{
		using (SHA256 algorithm = SHA256.Create())
		{
			return BitConverter.ToString(algorithm.ComputeHash(bytes)).Replace("-", string.Empty).ToLowerInvariant();
		}
	}

	private static int ParsePowerPointMajorVersion(string version)
	{
		return Version.TryParse(version, out Version parsed) ? parsed.Major : 0;
	}
}
