using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class PaletteLibraryService
{
	private sealed class ColorBucket
	{
		private long r;

		private long g;

		private long b;

		public int Count { get; private set; }

		public void Add(Color color)
		{
			r += color.R;
			g += color.G;
			b += color.B;
			Count++;
		}

		public Color ToColor()
		{
			return Color.FromArgb((int)(r / Count), (int)(g / Count), (int)(b / Count));
		}
	}

	private const int MaxPaletteColors = 10;

	private const long MaxPalettePackageBytes = 5242880L;

	private const long MaxPalettePackageUncompressedBytes = 12582912L;

	private readonly string paletteRoot;

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 4194304
	};

	public PaletteLibraryService()
		: this(GetDefaultPaletteRoot())
	{
	}

	public PaletteLibraryService(string paletteRoot)
	{
		this.paletteRoot = paletteRoot;
	}

	public IList<PaletteSchemeInfo> ListPalettes(Microsoft.Office.Interop.PowerPoint.Application application)
	{
		List<PaletteSchemeInfo> list = new List<PaletteSchemeInfo>();
		list.AddRange(ListPowerPointThemePalettes(application));
		list.AddRange(ListSavedPalettes());
		return list;
	}

	public PaletteSchemeInfo SavePalette(PaletteSchemeInfo palette)
	{
		palette = NormalizePalette(palette, assignNewId: true);
		Directory.CreateDirectory(paletteRoot);
		File.WriteAllText(PalettePath(palette.Id), serializer.Serialize(palette));
		return palette;
	}

	public PaletteSchemeInfo SaveZoteroPalette(ZoteroPaletteInfo palette, string query)
	{
		List<ZoteroSwatchInfo> swatches = (from @group in (palette?.Swatches ?? new List<ZoteroSwatchInfo>()).Where((ZoteroSwatchInfo item) => IsHex(item?.Hex)).GroupBy((ZoteroSwatchInfo item) => NormalizeHex(item.Hex), StringComparer.OrdinalIgnoreCase)
			select @group.First()).Take(10).ToList();
		if (swatches.Count == 0)
		{
			throw new InvalidOperationException("当前 Zotero 图像结果没有可保存的配色。");
		}
		return SavePalette(new PaletteSchemeInfo
		{
			DisplayName = (string.IsNullOrWhiteSpace(query) ? "Zotero 论文配色" : ("Zotero 论文配色：" + query)),
			Kind = "zotero-palette",
			Source = "Zotero PDF 图片保存插件",
			Keywords = new List<string>
			{
				"Zotero",
				"论文图像",
				"配色",
				"共享库",
				query ?? string.Empty
			},
			Swatches = swatches
		});
	}

	public PaletteSchemeInfo ExtractFromClipboardImage()
	{
		if (!Clipboard.ContainsImage())
		{
			throw new InvalidOperationException("剪贴板中没有可提取配色的图片。请先复制图片后再取色。");
		}
		using Image image = Clipboard.GetImage();
		return SavePalette(BuildExtractedPalette(image, "剪贴板图片配色", "clipboard-image", "剪贴板图片"));
	}

	public PaletteSchemeInfo ExtractFromCurrentSlide(Microsoft.Office.Interop.PowerPoint.Application application)
	{
		if (!(application?.ActiveWindow?.View?.Slide is Slide slide))
		{
			throw new InvalidOperationException("当前没有可提取配色的 PowerPoint 页面。");
		}
		string tempPath = Path.Combine(Path.GetTempPath(), "RoughPptAddin-slide-palette-" + Guid.NewGuid().ToString("N") + ".png");
		try
		{
			slide.Export(tempPath, "PNG", 1280, 720);
			using Image image = Image.FromFile(tempPath);
			return SavePalette(BuildExtractedPalette(image, "当前页面配色", "current-slide", "PowerPoint 当前页面"));
		}
		finally
		{
			TryDelete(tempPath);
		}
	}

	public PaletteSchemeInfo DeletePalette(string paletteId)
	{
		PaletteSchemeInfo saved = ListSavedPalettes().FirstOrDefault((PaletteSchemeInfo item) => string.Equals(item.Id, paletteId, StringComparison.OrdinalIgnoreCase));
		if (saved == null)
		{
			throw new InvalidOperationException("未找到可删除的配色方案：" + paletteId);
		}
		File.Delete(PalettePath(saved.Id));
		return saved;
	}

	public string ExportPalettes(string packagePath, IEnumerable<string> paletteIds)
	{
		IList<PaletteSchemeInfo> saved = ListSavedPalettes();
		HashSet<string> selectedIds = new HashSet<string>((paletteIds ?? new List<string>()).Where((string id) => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);
		if (selectedIds.Count > 0)
		{
			saved = saved.Where((PaletteSchemeInfo item) => selectedIds.Contains(item.Id)).ToList();
		}
		if (saved.Count == 0)
		{
			throw new InvalidOperationException((selectedIds.Count > 0) ? "勾选的配色方案不存在或已被删除。" : "没有可导出的配色方案。");
		}
		if (string.IsNullOrWhiteSpace(packagePath))
		{
			packagePath = DefaultExportPath();
		}
		packagePath = EnsureZipPath(packagePath);
		string targetDirectory = Path.GetDirectoryName(packagePath);
		if (!string.IsNullOrWhiteSpace(targetDirectory))
		{
			Directory.CreateDirectory(targetDirectory);
		}
		string stagingRoot = Path.Combine(Path.GetTempPath(), "RoughPptPaletteExport-" + Guid.NewGuid().ToString("N"));
		string palettesRoot = Path.Combine(stagingRoot, "palettes");
		Directory.CreateDirectory(palettesRoot);
		try
		{
			foreach (PaletteSchemeInfo item in saved)
			{
				PaletteSchemeInfo normalized = NormalizePalette(item, assignNewId: false);
				File.WriteAllText(Path.Combine(palettesRoot, SafeFileName(normalized.Id) + ".json"), serializer.Serialize(normalized));
			}
			Dictionary<string, object> manifest = new Dictionary<string, object>
			{
				["version"] = "0.1.0",
				["kind"] = "rough-ppt-palette-package",
				["format"] = "zip",
				["safeForSocialTransfer"] = true,
				["exportedAtUtc"] = DateTime.UtcNow.ToString("o"),
				["paletteCount"] = saved.Count,
				["selectedPaletteCount"] = ((selectedIds.Count > 0) ? saved.Count : 0),
				["maxPackageBytes"] = 5242880L
			};
			File.WriteAllText(Path.Combine(stagingRoot, "manifest.json"), serializer.Serialize(manifest));
			if (File.Exists(packagePath))
			{
				File.Delete(packagePath);
			}
			ZipFile.CreateFromDirectory(stagingRoot, packagePath, CompressionLevel.Optimal, includeBaseDirectory: false);
			if (new FileInfo(packagePath).Length > 5242880)
			{
				File.Delete(packagePath);
				throw new InvalidOperationException("配色包超过 5 MB。请减少勾选配色后重新分享。");
			}
			return packagePath;
		}
		finally
		{
			if (Directory.Exists(stagingRoot))
			{
				Directory.Delete(stagingRoot, recursive: true);
			}
		}
	}

	public IList<PaletteSchemeInfo> ImportPalettes(string packagePath)
	{
		if (string.IsNullOrWhiteSpace(packagePath) || !File.Exists(packagePath))
		{
			throw new FileNotFoundException("未找到配色包。", packagePath);
		}
		if (!string.Equals(Path.GetExtension(packagePath), ".zip", StringComparison.OrdinalIgnoreCase))
		{
			throw new InvalidOperationException("只支持导入 .zip 配色分享包。");
		}
		if (new FileInfo(packagePath).Length > 5242880)
		{
			throw new InvalidOperationException("配色包超过 5 MB，请让分享者减少配色数量后重新导出。");
		}
		string extractRoot = Path.Combine(Path.GetTempPath(), "RoughPptPaletteImport-" + Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(extractRoot);
		try
		{
			SafeExtractPaletteZip(packagePath, extractRoot);
			string manifestPath = Path.Combine(extractRoot, "manifest.json");
			if (!File.Exists(manifestPath) || !File.ReadAllText(manifestPath).Contains("rough-ppt-palette-package"))
			{
				throw new InvalidOperationException("配色包 manifest 类型不正确。");
			}
			string path = Path.Combine(extractRoot, "palettes");
			if (!Directory.Exists(path))
			{
				throw new InvalidOperationException("配色包缺少 palettes 文件夹。");
			}
			List<PaletteSchemeInfo> imported = new List<PaletteSchemeInfo>();
			string[] files = Directory.GetFiles(path, "*.json");
			foreach (string file in files)
			{
				PaletteSchemeInfo palette = ReadPalette(file);
				if (palette != null && palette.Swatches.Count != 0)
				{
					palette.Id = ImportedId(palette.Id);
					palette.BuiltIn = false;
					palette.Kind = (string.IsNullOrWhiteSpace(palette.Kind) ? "imported-palette" : palette.Kind);
					if (palette.Keywords == null)
					{
						palette.Keywords = new List<string>();
					}
					if (!palette.Keywords.Contains("已导入"))
					{
						palette.Keywords.Add("已导入");
					}
					imported.Add(SavePalette(palette));
				}
			}
			if (imported.Count == 0)
			{
				throw new InvalidOperationException("配色包中没有可导入的配色方案。");
			}
			return imported;
		}
		finally
		{
			if (Directory.Exists(extractRoot))
			{
				Directory.Delete(extractRoot, recursive: true);
			}
		}
	}

	private IList<PaletteSchemeInfo> ListSavedPalettes()
	{
		if (!Directory.Exists(paletteRoot))
		{
			return new List<PaletteSchemeInfo>();
		}
		return (from item in Directory.GetFiles(paletteRoot, "*.json").Select(ReadPalette)
			where item != null && item.Swatches.Count > 0
			select NormalizePalette(item, assignNewId: false) into item
			orderby item.CreatedAtUtc descending
			select item).ToList();
	}

	private IList<PaletteSchemeInfo> ListPowerPointThemePalettes(Microsoft.Office.Interop.PowerPoint.Application application)
	{
		List<PaletteSchemeInfo> palettes = new List<PaletteSchemeInfo>();
		PaletteSchemeInfo current = TryReadCurrentTheme(application);
		if (current != null)
		{
			palettes.Add(current);
		}
		palettes.AddRange(BuiltInFallbackPalettes());
		return palettes;
	}

	private PaletteSchemeInfo TryReadCurrentTheme(Microsoft.Office.Interop.PowerPoint.Application application)
	{
		try
		{
			OfficeTheme theme = application?.ActivePresentation?.SlideMaster?.Theme;
			if (theme == null)
			{
				return null;
			}
			dynamic colorScheme = theme.ThemeColorScheme;
			List<ZoteroSwatchInfo> swatches = new List<ZoteroSwatchInfo>();
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent1, "强调色 1");
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent2, "强调色 2");
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent3, "强调色 3");
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent4, "强调色 4");
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent5, "强调色 5");
			AddThemeSwatch(swatches, colorScheme, MsoThemeColorSchemeIndex.msoThemeAccent6, "强调色 6");
			if (swatches.Count == 0)
			{
				return null;
			}
			return NormalizePalette(new PaletteSchemeInfo
			{
				Id = "ppt-current-theme",
				DisplayName = "PPT 当前主题配色",
				Kind = "ppt-theme",
				Source = "PowerPoint ThemeColorScheme",
				BuiltIn = true,
				Keywords = new List<string> { "PPT", "PowerPoint", "主题", "内置", "配色方案" },
				Swatches = swatches
			}, assignNewId: false);
		}
		catch
		{
			return null;
		}
	}

	private static void AddThemeSwatch(IList<ZoteroSwatchInfo> swatches, dynamic colorScheme, MsoThemeColorSchemeIndex index, string role)
	{
		try
		{
			Color color = ColorTranslator.FromOle((int)colorScheme.Colors(index).RGB);
			string hex = ColorToHex(color);
			if (IsHex(hex) && swatches.All((ZoteroSwatchInfo item) => !SameHex(item.Hex, hex)))
			{
				swatches.Add(new ZoteroSwatchInfo
				{
					Hex = hex,
					BaseHex = hex,
					Role = role,
					SourceTitle = "PPT 当前主题",
					Variant = "base"
				});
			}
		}
		catch
		{
		}
	}

	private static IEnumerable<PaletteSchemeInfo> BuiltInFallbackPalettes()
	{
		yield return BuiltIn("ppt-built-in-office", "PPT 内置：Office", "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47");
		yield return BuiltIn("ppt-built-in-colorful", "PPT 内置：彩色", "#156082", "#E97132", "#196B24", "#0F9ED5", "#A02B93", "#4EA72E");
		yield return BuiltIn("ppt-built-in-blue", "PPT 内置：蓝色", "#1F4E79", "#5B9BD5", "#70ADFF", "#A9D18E", "#FFD966", "#ED7D31");
		yield return BuiltIn("ppt-built-in-green", "PPT 内置：绿色", "#375623", "#70AD47", "#A9D18E", "#4472C4", "#FFC000", "#A5A5A5");
		yield return BuiltIn("ppt-built-in-red", "PPT 内置：红色", "#C00000", "#ED7D31", "#FFC000", "#70AD47", "#4472C4", "#7030A0");
		yield return BuiltIn("ppt-built-in-grayscale", "PPT 内置：灰阶", "#000000", "#404040", "#808080", "#BFBFBF", "#D9D9D9", "#F2F2F2");
	}

	private static PaletteSchemeInfo BuiltIn(string id, string name, params string[] colors)
	{
		return NormalizePalette(new PaletteSchemeInfo
		{
			Id = id,
			DisplayName = name,
			Kind = "ppt-built-in",
			Source = "PowerPoint 内置配色方案",
			BuiltIn = true,
			Keywords = new List<string> { "PPT", "PowerPoint", "内置", "主题", "配色方案" },
			Swatches = colors.Select((string hex, int index) => new ZoteroSwatchInfo
			{
				Hex = hex,
				BaseHex = hex,
				Role = "主题色 " + (index + 1).ToString(CultureInfo.InvariantCulture),
				SourceTitle = name,
				Variant = "base"
			}).ToList()
		}, assignNewId: false);
	}

	private PaletteSchemeInfo BuildExtractedPalette(Image image, string displayName, string kind, string source)
	{
		List<ZoteroSwatchInfo> swatches = ExtractDominantColors(image).Select((string hex, int index) => new ZoteroSwatchInfo
		{
			Hex = hex,
			BaseHex = hex,
			Variant = "base",
			Role = "提取色 " + (index + 1).ToString(CultureInfo.InvariantCulture),
			SourceTitle = displayName
		}).ToList();
		if (swatches.Count == 0)
		{
			throw new InvalidOperationException("未能从图片中提取有效配色。");
		}
		return new PaletteSchemeInfo
		{
			DisplayName = displayName,
			Kind = kind,
			Source = source,
			Keywords = new List<string> { "配色", "取色", source },
			Swatches = swatches
		};
	}

	private static List<string> ExtractDominantColors(Image image)
	{
		if (image == null)
		{
			return new List<string>();
		}
		Dictionary<int, ColorBucket> buckets = new Dictionary<int, ColorBucket>();
		using (Bitmap bitmap = new Bitmap(image))
		{
			int step = Math.Max(1, Math.Max(bitmap.Width, bitmap.Height) / 128);
			for (int y = 0; y < bitmap.Height; y += step)
			{
				for (int x = 0; x < bitmap.Width; x += step)
				{
					Color color = bitmap.GetPixel(x, y);
					if (color.A >= 128)
					{
						int key = (color.R >> 3 << 10) | (color.G >> 3 << 5) | (color.B >> 3);
						if (!buckets.TryGetValue(key, out var bucket))
						{
							bucket = (buckets[key] = new ColorBucket());
						}
						bucket.Add(color);
					}
				}
			}
		}
		List<Color> list = (from colorBucket2 in buckets.Values
			where colorBucket2.Count > 0
			select colorBucket2.ToColor()).OrderByDescending(ScoreColor).ToList();
		List<Color> selected = new List<Color>();
		foreach (Color color2 in list)
		{
			if (selected.All((Color existing) => ColorDistance(existing, color2) >= 34.0))
			{
				selected.Add(color2);
			}
			if (selected.Count >= 10)
			{
				break;
			}
		}
		return selected.Select(ColorToHex).ToList();
	}

	private static double ScoreColor(Color color)
	{
		byte max = Math.Max(color.R, Math.Max(color.G, color.B));
		byte min = Math.Min(color.R, Math.Min(color.G, color.B));
		double num = ((max == 0) ? 0.0 : ((double)(max - min) / (double)(int)max));
		double lightness = (double)(max + min) / 510.0;
		double lightnessWeight = 1.0 - Math.Abs(lightness - 0.55) * 0.55;
		return num * 120.0 + lightnessWeight * 80.0 + (double)(int)max * 0.05;
	}

	private static double ColorDistance(Color left, Color right)
	{
		int num = left.R - right.R;
		int dg = left.G - right.G;
		int db = left.B - right.B;
		return Math.Sqrt(num * num + dg * dg + db * db);
	}

	private static PaletteSchemeInfo NormalizePalette(PaletteSchemeInfo palette, bool assignNewId)
	{
		palette = palette ?? new PaletteSchemeInfo();
		if (assignNewId || string.IsNullOrWhiteSpace(palette.Id))
		{
			palette.Id = SafeFileName((palette.Kind ?? "palette") + "-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture));
		}
		palette.Id = SafeFileName(palette.Id);
		if (string.IsNullOrWhiteSpace(palette.DisplayName))
		{
			palette.DisplayName = palette.Id;
		}
		if (string.IsNullOrWhiteSpace(palette.CreatedAtUtc))
		{
			palette.CreatedAtUtc = DateTime.UtcNow.ToString("o");
		}
		if (palette.Keywords == null)
		{
			palette.Keywords = new List<string>();
		}
		palette.Swatches = (from @group in (palette.Swatches ?? new List<ZoteroSwatchInfo>()).Where((ZoteroSwatchInfo item) => IsHex(item?.Hex)).GroupBy((ZoteroSwatchInfo item) => NormalizeHex(item.Hex), StringComparer.OrdinalIgnoreCase)
			select NormalizeSwatch(@group.First(), palette.DisplayName)).Take(10).ToList();
		palette.Layouts = BuildLayouts(palette);
		return palette;
	}

	private static ZoteroSwatchInfo NormalizeSwatch(ZoteroSwatchInfo swatch, string sourceTitle)
	{
		string hex = NormalizeHex(swatch.Hex);
		return new ZoteroSwatchInfo
		{
			Hex = hex,
			BaseHex = (IsHex(swatch.BaseHex) ? NormalizeHex(swatch.BaseHex) : hex),
			Variant = (string.IsNullOrWhiteSpace(swatch.Variant) ? "base" : swatch.Variant),
			Role = (string.IsNullOrWhiteSpace(swatch.Role) ? "配色" : swatch.Role),
			SourceTitle = (string.IsNullOrWhiteSpace(swatch.SourceTitle) ? sourceTitle : swatch.SourceTitle),
			ImageId = swatch.ImageId
		};
	}

	private static List<PaletteLayoutInfo> BuildLayouts(PaletteSchemeInfo palette)
	{
		List<string> colors = (palette.Swatches ?? new List<ZoteroSwatchInfo>()).Select((ZoteroSwatchInfo item) => NormalizeHex(item.Hex)).Where(IsHex).Distinct(StringComparer.OrdinalIgnoreCase)
			.ToList();
		if (colors.Count == 0)
		{
			colors.Add("#4472C4");
		}
		List<string> full = colors.Take(10).ToList();
		while (colors.Count < 4)
		{
			colors.Add(colors[colors.Count - 1]);
		}
		string primary = colors[0];
		string secondary = colors[1];
		string tertiary = colors[2];
		string last = colors[colors.Count - 1];
		List<string> reversed = full.AsEnumerable().Reverse().ToList();
		List<string> rotated = Rotate(full, 1);
		List<string> softFills = full.Select((string hex) => MixHex(hex, "#FFFFFF", 0.72)).ToList();
		List<string> darkStrokes = full.Select((string hex) => MixHex(hex, "#000000", 0.38)).ToList();
		return new List<PaletteLayoutInfo>
		{
			Layout(palette.Id, "black-primary", "黑线全色填充", "#111111", primary, primary, secondary, tertiary, "#FFFFFF", full, full, Repeat("#111111", full.Count)),
			Layout(palette.Id, "primary-light", "主色浅填轮换", primary, MixHex(primary, "#FFFFFF", 0.82), primary, secondary, tertiary, "#FFFFFF", full, softFills, darkStrokes),
			Layout(palette.Id, "contrast", "对比色轮换", secondary, MixHex(primary, "#FFFFFF", 0.68), secondary, tertiary, primary, "#FFFFFF", full, rotated, reversed),
			Layout(palette.Id, "gradient-reverse", "反向全色布局", "#111111", MixHex(last, "#FFFFFF", 0.76), last, primary, secondary, "#FFFFFF", full, reversed, Repeat("#111111", full.Count)),
			Layout(palette.Id, "dark-line-soft-fill", "深线浅底全色", MixHex(primary, "#000000", 0.45), MixHex(primary, "#FFFFFF", 0.88), primary, last, secondary, "#FFFFFF", full, softFills, darkStrokes)
		};
	}

	private static PaletteLayoutInfo Layout(string paletteId, string id, string name, string stroke, string fill, string start, string end, string accent, string background, IEnumerable<string> colors, IEnumerable<string> fills, IEnumerable<string> strokes)
	{
		return new PaletteLayoutInfo
		{
			Id = id,
			PaletteId = paletteId,
			DisplayName = name,
			StrokeHex = NormalizeHex(stroke),
			FillHex = NormalizeHex(fill),
			FeatureStartHex = NormalizeHex(start),
			FeatureEndHex = NormalizeHex(end),
			AccentHex = NormalizeHex(accent),
			BackgroundHex = NormalizeHex(background),
			ColorHexes = NormalizeHexList(colors),
			ShapeFillHexes = NormalizeHexList(fills),
			ShapeStrokeHexes = NormalizeHexList(strokes)
		};
	}

	private static List<string> NormalizeHexList(IEnumerable<string> values)
	{
		return (values ?? new List<string>()).Where(IsHex).Select(NormalizeHex).Distinct(StringComparer.OrdinalIgnoreCase)
			.Take(10)
			.ToList();
	}

	private static List<string> Rotate(IList<string> values, int offset)
	{
		if (values == null || values.Count == 0)
		{
			return new List<string>();
		}
		List<string> result = new List<string>();
		for (int i = 0; i < values.Count; i++)
		{
			result.Add(values[(i + offset) % values.Count]);
		}
		return result;
	}

	private static List<string> Repeat(string value, int count)
	{
		List<string> result = new List<string>();
		for (int i = 0; i < Math.Max(1, count); i++)
		{
			result.Add(value);
		}
		return result;
	}

	private PaletteSchemeInfo ReadPalette(string path)
	{
		try
		{
			return serializer.Deserialize<PaletteSchemeInfo>(File.ReadAllText(path));
		}
		catch
		{
			return null;
		}
	}

	private string PalettePath(string paletteId)
	{
		return Path.Combine(paletteRoot, SafeFileName(paletteId) + ".json");
	}

	private string ImportedId(string sourceId)
	{
		string baseId = (string.IsNullOrWhiteSpace(sourceId) ? "imported-palette" : SafeFileName(sourceId));
		string candidate = baseId;
		if (!File.Exists(PalettePath(candidate)))
		{
			return candidate;
		}
		return baseId + "-imported-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture);
	}

	private static void SafeExtractPaletteZip(string packagePath, string extractRoot)
	{
		string root = Path.GetFullPath(extractRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
		long totalUncompressed = 0L;
		ZipArchive zip = ZipFile.OpenRead(packagePath);
		try
		{
			foreach (ZipArchiveEntry entry in zip.Entries)
			{
				string entryName = (entry.FullName ?? string.Empty).Replace('\\', '/');
				if (!string.IsNullOrWhiteSpace(entryName) && !entryName.EndsWith("/", StringComparison.Ordinal))
				{
					if (entryName.StartsWith("/", StringComparison.Ordinal) || entryName.Contains("../") || entryName.Contains("..\\"))
					{
						throw new InvalidOperationException("配色包包含不安全路径。");
					}
					if (!string.Equals(Path.GetExtension(entryName), ".json", StringComparison.OrdinalIgnoreCase))
					{
						throw new InvalidOperationException("配色包包含不允许的文件类型：" + entryName);
					}
					totalUncompressed += entry.Length;
					if (totalUncompressed > 12582912)
					{
						throw new InvalidOperationException("配色包解压后过大，请减少配色数量后重新分享。");
					}
					string target = Path.GetFullPath(Path.Combine(extractRoot, entryName));
					if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
					{
						throw new InvalidOperationException("配色包包含路径穿越风险。");
					}
					string directory = Path.GetDirectoryName(target);
					if (!string.IsNullOrWhiteSpace(directory))
					{
						Directory.CreateDirectory(directory);
					}
					entry.ExtractToFile(target, overwrite: true);
				}
			}
		}
		finally
		{
			((IDisposable)zip)?.Dispose();
		}
	}

	private static string MixHex(string hex, string mixHex, double amount)
	{
		Color source = ColorTranslator.FromHtml(NormalizeHex(hex));
		Color mix = ColorTranslator.FromHtml(NormalizeHex(mixHex));
		double ratio = Math.Max(0.0, Math.Min(1.0, amount));
		return ColorToHex(Color.FromArgb((int)Math.Round((double)(int)source.R + (double)(mix.R - source.R) * ratio), (int)Math.Round((double)(int)source.G + (double)(mix.G - source.G) * ratio), (int)Math.Round((double)(int)source.B + (double)(mix.B - source.B) * ratio)));
	}

	private static string ColorToHex(Color color)
	{
		return "#" + color.R.ToString("X2", CultureInfo.InvariantCulture) + color.G.ToString("X2", CultureInfo.InvariantCulture) + color.B.ToString("X2", CultureInfo.InvariantCulture);
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

	private static bool SameHex(string left, string right)
	{
		return string.Equals(NormalizeHex(left), NormalizeHex(right), StringComparison.OrdinalIgnoreCase);
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
		if (!IsHex(text))
		{
			return "#000000";
		}
		return text.ToUpperInvariant();
	}

	private static string SafeFileName(string value)
	{
		char[] invalid = Path.GetInvalidFileNameChars();
		char[] chars = (value ?? "palette").ToCharArray();
		for (int i = 0; i < chars.Length; i++)
		{
			if (Array.IndexOf(invalid, chars[i]) >= 0)
			{
				chars[i] = '-';
			}
		}
		return new string(chars).Trim('-', ' ');
	}

	private static string EnsureZipPath(string packagePath)
	{
		if (!string.Equals(Path.GetExtension(packagePath), ".zip", StringComparison.OrdinalIgnoreCase))
		{
			return Path.ChangeExtension(packagePath, ".zip");
		}
		return packagePath;
	}

	private static string DefaultExportPath()
	{
		string text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "RoughPptAddin", "exports");
		Directory.CreateDirectory(text);
		return Path.Combine(text, "rough-share-palettes-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture) + ".zip");
	}

	private static string GetDefaultPaletteRoot()
	{
		return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "RoughPptAddin", "palettes", "schemes");
	}

	private static void TryDelete(string path)
	{
		try
		{
			if (File.Exists(path))
			{
				File.Delete(path);
			}
		}
		catch
		{
		}
	}
}
