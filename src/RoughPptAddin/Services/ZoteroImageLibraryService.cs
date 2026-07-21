using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class ZoteroImageLibraryService
{
	private enum BlobReadMode
	{
		None,
		Thumbnail,
		Image
	}

	private sealed class ImageTable
	{
		public string Name { get; }

		public ColumnMap Mapping { get; }

		public int Score { get; }

		public ImageTable(string name, ColumnMap mapping, int score)
		{
			Name = name;
			Mapping = mapping;
			Score = score;
		}
	}

	private sealed class ColumnMap
	{
		private readonly HashSet<string> columns;

		public string ImageId { get; }

		public string Title { get; }

		public string Year { get; }

		public string Doi { get; }

		public string PageNumber { get; }

		public string SourceRegionKey { get; }

		public string PreviewDuplicateKey { get; }

		public string ZoteroOpenPdfUri { get; }

		public string ZoteroSelectItemUri { get; }

		public string ZoteroSelectPdfUri { get; }

		public string ParentItemKey { get; }

		public string PdfAttachmentKey { get; }

		public string LibraryId { get; }

		public string LibraryType { get; }

		public string GroupId { get; }

		public string BboxJson { get; }

		public string ThumbnailBlob { get; }

		public string ImageBlob { get; }

		public string ImageCategory { get; }

		public string StyleTags { get; }

		public string ColorFamily { get; }

		public string PaletteJson { get; }

		public string DominantHex { get; }

		public string CreatedAt { get; }

		public string Deleted { get; }

		public ColumnMap(HashSet<string> columns)
		{
			this.columns = columns;
			ImageId = Pick("image_id", "imageId", "id", "preview_index_key", "source_region_key");
			Title = Pick("title", "source_title", "parent_title", "paper_title");
			Year = Pick("year", "publication_year", "date_year");
			Doi = Pick("doi", "DOI");
			PageNumber = Pick("page_number", "pageNumber", "page", "page_index");
			SourceRegionKey = Pick("source_region_key", "sourceRegionKey");
			PreviewDuplicateKey = Pick("preview_duplicate_key", "previewDuplicateKey");
			ZoteroOpenPdfUri = Pick("zotero_open_pdf_uri", "open_pdf_uri", "openPDFURI");
			ZoteroSelectItemUri = Pick("zotero_select_item_uri", "select_item_uri", "selectItemURI", "selectParentItemUri");
			ZoteroSelectPdfUri = Pick("zotero_select_pdf_uri", "select_pdf_uri", "selectPdfURI", "selectPdfAttachmentUri");
			ParentItemKey = Pick("parent_item_key", "parentItemKey", "parent_key", "parent_key");
			PdfAttachmentKey = Pick("pdf_attachment_key", "pdfAttachmentKey", "attachment_key", "pdf_key");
			LibraryId = Pick("library_id", "libraryId");
			LibraryType = Pick("library_type", "libraryType");
			GroupId = Pick("group_id", "groupId");
			BboxJson = Pick("bbox_json", "bboxJson", "bbox");
			ThumbnailBlob = Pick("thumbnail_blob", "thumbnail", "thumbnail_bytes", "thumbnailBlob");
			ImageBlob = Pick("image_blob", "image", "image_bytes", "imageBlob", "preview_blob");
			ImageCategory = Pick("image_category", "imageCategory", "category");
			StyleTags = Pick("style_tags_json", "style_tags", "styleTags", "tags", "style_tag");
			ColorFamily = Pick("color_family", "colorFamily", "palette_family");
			PaletteJson = Pick("palette_json", "palette", "paletteJson", "colors_json");
			DominantHex = Pick("dominant_hex", "dominantHex", "base_hex", "main_hex");
			CreatedAt = Pick("created_at", "createdAt", "saved_at", "updated_at");
			Deleted = Pick("deleted", "is_deleted", "isDeleted");
		}

		public IEnumerable<string> ListColumns(BlobReadMode blobMode)
		{
			return new string[24]
			{
				ImageId,
				Title,
				Year,
				Doi,
				PageNumber,
				SourceRegionKey,
				PreviewDuplicateKey,
				ZoteroOpenPdfUri,
				ZoteroSelectItemUri,
				ZoteroSelectPdfUri,
				ParentItemKey,
				PdfAttachmentKey,
				LibraryId,
				LibraryType,
				GroupId,
				BboxJson,
				(blobMode == BlobReadMode.Thumbnail) ? ThumbnailBlob : null,
				(blobMode == BlobReadMode.Image) ? ImageBlob : null,
				ImageCategory,
				StyleTags,
				ColorFamily,
				PaletteJson,
				DominantHex,
				CreatedAt
			}.Where((string item) => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase);
		}

		private string Pick(params string[] names)
		{
			return names.FirstOrDefault((string name) => columns.Contains(name));
		}
	}

	private const int DefaultListLimit = 96;

	private const int MetadataReadLimit = 400;

	private const int ThumbnailBatchLimit = 96;

	private const int MaxThumbnailBytes = 524288;

	private const int MaxImageBlobBytes = 26214400;

	private const string ZoteroOpenPdfScheme = "zotero://open-pdf";

	private const string ZoteroSelectScheme = "zotero://select";

	private static readonly Regex HexRegex = new Regex("#[0-9a-fA-F]{6}\\b", RegexOptions.Compiled);

	private static readonly Regex ChineseTextRegex = new Regex("[\\u3400-\\u9fff]", RegexOptions.Compiled);

	private static readonly IDictionary<string, string> MetadataSearchLabels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
	{
		{ "auto", "自动判断" },
		{ "metric_curve", "指标 训练曲线" },
		{ "heatmap", "热图 矩阵图" },
		{ "bar_chart", "柱状图 条形图" },
		{ "distribution", "分布图 降维图" },
		{ "qualitative", "定性结果对比" },
		{ "architecture", "网络结构图 模型结构图" },
		{ "pipeline", "方法流程图" },
		{ "table", "科研表格" },
		{ "equation", "公式" },
		{ "schematic", "装置示意 原理示意" },
		{ "photo", "照片 医学影像" },
		{ "chart", "图表" },
		{ "diagram", "流程图 示意图" },
		{ "figure", "其他插图" },
		{ "red", "红色" },
		{ "orange", "橙色" },
		{ "yellow", "黄色" },
		{ "green", "绿色" },
		{ "cyan", "青色" },
		{ "blue", "蓝色" },
		{ "purple", "紫色" },
		{ "pink", "粉色" },
		{ "brown", "棕色" },
		{ "gray", "灰色" },
		{ "grey", "灰色" },
		{ "black", "黑色" },
		{ "white", "白色" },
		{ "wide", "横向" },
		{ "tall", "纵向" },
		{ "square", "近方形" },
		{ "hero", "主视觉区" },
		{ "side", "侧栏区" },
		{ "footer", "底部区" },
		{ "inset", "嵌入区" },
		{ "result", "结果" },
		{ "method", "方法" },
		{ "evidence", "证据" },
		{ "compare", "对比" },
		{ "context", "背景" },
		{ "research", "科研绘图" },
		{ "matrix", "矩阵" },
		{ "bright", "明亮" },
		{ "dark", "深色" },
		{ "balanced", "明暗均衡" },
		{ "colorful", "多彩" },
		{ "muted", "低饱和" },
		{ "moderate-saturation", "中等饱和" },
		{ "warm", "暖色" },
		{ "cool", "冷色" },
		{ "grid", "网格" },
		{ "cells", "单元格" },
		{ "plot", "科研图表" },
		{ "axes", "坐标轴" },
		{ "metrics", "指标" },
		{ "curve", "曲线" },
		{ "color-scale", "色标" },
		{ "bars", "柱形" },
		{ "points", "散点" },
		{ "result-panels", "结果面板" },
		{ "visual-comparison", "可视化对比" },
		{ "network", "网络结构" },
		{ "blocks", "模块" },
		{ "connections", "连接关系" },
		{ "flow", "流程" },
		{ "steps", "步骤" },
		{ "boxes", "方框" },
		{ "circuit", "电路" },
		{ "lines", "线条" },
		{ "math", "数学公式" },
		{ "symbols", "数学符号" },
		{ "photo-ref", "照片参考" },
		{ "figure-ref", "插图参考" },
		{ "banner", "横幅" },
		{ "landscape", "横版" },
		{ "portrait", "竖版" },
		{ "stack", "堆叠" },
		{ "tile", "方形分块" },
		{ "lead-visual", "主视觉" },
		{ "support", "辅助证据" },
		{ "before-after", "前后对比" },
		{ "background", "背景" }
	};

	private readonly ZoteroBridgeClient bridgeClient;

	public string DatabasePath => ZoteroImageLibraryPathResolver.ResolveDatabasePath();

	public string DatabaseSource => ZoteroImageLibraryPathResolver.ResolveDatabasePathInfo().SourceDescription;

	public ZoteroImageLibraryService()
		: this(new ZoteroBridgeClient())
	{
	}

	public ZoteroImageLibraryService(ZoteroBridgeClient bridgeClient)
	{
		this.bridgeClient = bridgeClient ?? new ZoteroBridgeClient();
	}

	public IList<ZoteroImageInfo> ListImages(string query, out string status, out bool databaseFound)
	{
		status = string.Empty;
		ZoteroImageLibraryPathInfo pathInfo = ZoteroImageLibraryPathResolver.ResolveDatabasePathInfo();
		databaseFound = File.Exists(pathInfo.DatabasePath);
		if (!databaseFound)
		{
			status = "未找到 Zotero 论文图像库：" + pathInfo.DatabasePath + "。" + pathInfo.SourceDescription + "。" + ZoteroImageLibraryPathResolver.MissingDatabaseHint();
			return new List<ZoteroImageInfo>();
		}
		try
		{
			using SQLiteConnection connection = OpenReadOnlyConnection();
			ImageTable table = FindImageTable(connection);
			if (table == null)
			{
				status = "SQLite 中未找到可用的论文图像数据表。";
				return new List<ZoteroImageInfo>();
			}
			List<ZoteroImageInfo> filtered = (from item in ReadImageRows(connection, table, BlobReadMode.None, 400)
				where MatchesQuery(item, query)
				select item).Take(96).ToList();
			AppendThumbnails(connection, table, filtered);
			status = ((filtered.Count > 0) ? ("已读取论文图像：" + filtered.Count + " 张；" + pathInfo.SourceDescription + "。") : ("没有匹配的论文图像。" + pathInfo.SourceDescription + "；可搜索标题、年份、DOI、页码、样式标签或色系。"));
			return filtered;
		}
		catch (Exception exception)
		{
			AddInLogger.Error("读取 Zotero 论文图像库失败。", exception);
			status = "读取 Zotero 论文图像库失败。请检查共享数据库是否可读，然后重试。";
			return new List<ZoteroImageInfo>();
		}
	}

	public ZoteroPaletteInfo GetPalette(string query)
	{
		string status;
		bool databaseFound;
		IList<ZoteroImageInfo> images = ListImages(query, out status, out databaseFound);
		return BuildPaletteGrid(images, status, databaseFound);
	}

	public ZoteroPaletteInfo GetPaletteByImageId(string imageId)
	{
		string normalizedImageId = (imageId ?? string.Empty).Trim();
		if (string.IsNullOrWhiteSpace(normalizedImageId))
		{
			throw new InvalidOperationException("请先选择一张论文图像作为配色参考。");
		}
		ZoteroImageLibraryPathInfo pathInfo = ZoteroImageLibraryPathResolver.ResolveDatabasePathInfo();
		if (!File.Exists(pathInfo.DatabasePath))
		{
			throw new InvalidOperationException("未找到 Zotero 论文图像库。请先在 Zotero 中保存论文图像。");
		}
		ZoteroImageInfo image = ReadImageForInsert(normalizedImageId);
		if (image == null)
		{
			throw new InvalidOperationException("未找到所选论文图像。请重新读取图库后再试。");
		}
		return BuildPaletteGrid(new[] { image }, "已读取当前参考图的配色。", databaseFound: true);
	}

	public ZoteroPaletteInfo BuildPaletteGrid(IEnumerable<ZoteroImageInfo> images, string status, bool databaseFound)
	{
		ZoteroPaletteInfo palette = new ZoteroPaletteInfo
		{
			Status = (status ?? string.Empty),
			DatabasePath = DatabasePath,
			DatabaseSource = DatabaseSource,
			DatabaseFound = databaseFound
		};
		List<ZoteroSwatchInfo> bases = new List<ZoteroSwatchInfo>();
		foreach (ZoteroImageInfo image in images ?? new List<ZoteroImageInfo>())
		{
			foreach (ZoteroSwatchInfo swatch in image.Swatches ?? new List<ZoteroSwatchInfo>())
			{
				if (IsHex(swatch.Hex) && bases.All((ZoteroSwatchInfo item) => !SameHex(item.Hex, swatch.Hex)))
				{
					bases.Add(new ZoteroSwatchInfo
					{
						Hex = NormalizeHex(swatch.Hex),
						BaseHex = NormalizeHex(swatch.Hex),
						Variant = "base",
						Role = (string.IsNullOrWhiteSpace(swatch.Role) ? "来源色" : swatch.Role),
						SourceTitle = (swatch.SourceTitle ?? image.Title),
						ImageId = (swatch.ImageId ?? image.ImageId)
					});
				}
			}
		}
		palette.Swatches.AddRange(bases);
		return palette;
	}

	public ZoteroImageInfo InsertImage(Microsoft.Office.Interop.PowerPoint.Application application, string imageId)
	{
		ZoteroImageInfo row = ReadImageForInsert(imageId);
		if (row == null)
		{
			throw new InvalidOperationException("未找到所选论文图像。请重新读取图库后再试。");
		}
		byte[] bytes = ReadImageBlob(imageId);
		if (bytes == null || bytes.Length == 0)
		{
			throw new InvalidOperationException("所选论文图像没有可插入的原始图像。");
		}
		if (bytes.Length > 26214400)
		{
			throw new InvalidOperationException("论文图像过大，已超过 " + FormatBytes(26214400L) + "。请在 Zotero 中保存较小参考图或降低原图质量后再插入。");
		}
		if (!(application?.ActiveWindow?.View?.Slide is Slide slide))
		{
			throw new InvalidOperationException("当前没有可用幻灯片。");
		}
		string tempFile = WriteTempImage(bytes, row.ImageId);
		try
		{
			Size size = ReadImageSize(bytes);
			float slideWidth = application.ActivePresentation?.PageSetup?.SlideWidth ?? 960f;
			float slideHeight = application.ActivePresentation?.PageSetup?.SlideHeight ?? 540f;
			float widthPt = Math.Max(60f, (float)size.Width * 72f / 96f);
			float heightPt = Math.Max(40f, (float)size.Height * 72f / 96f);
			float scale = Math.Min(1f, Math.Min((float)((double)slideWidth * 0.72 / (double)widthPt), (float)((double)slideHeight * 0.72 / (double)heightPt)));
			widthPt *= scale;
			heightPt *= scale;
			float left = slideWidth / 2f - widthPt / 2f;
			float top = slideHeight / 2f - heightPt / 2f;
			Microsoft.Office.Interop.PowerPoint.Shape shape = slide.Shapes.AddPicture(tempFile, MsoTriState.msoFalse, MsoTriState.msoTrue, left, top, widthPt, heightPt);
			shape.LockAspectRatio = MsoTriState.msoTrue;
			WriteTraceTags(shape, row);
			shape.Name = UniqueShapeName("ZoteroRefImage");
			shape.AlternativeText = "Zotero 参考图像：" + (row.Title ?? row.ImageId);
			shape.Select();
			return row;
		}
		finally
		{
			TryDelete(tempFile);
		}
	}

	public string OpenPdfSource(string imageId)
	{
		ZoteroTraceInfo trace = GetTrace(imageId);
		ZoteroBridgeResult bridgeResult = bridgeClient.OpenPdfByImageIdResult(trace.ImageId);
		if (bridgeResult.Success)
		{
			return "已通过 Zotero 本地连接打开 PDF 来源。";
		}
		if (bridgeResult.RejectedInvalidUri)
		{
			CopyTraceIds(trace);
			return "Zotero 本地连接拒绝了不安全的 PDF 地址，已复制溯源编号：" + BuildBridgeFailureText(bridgeResult);
		}
		if (!string.IsNullOrWhiteSpace(trace.ZoteroOpenPdfUri) && IsAllowedZoteroUri(trace.ZoteroOpenPdfUri, "zotero://open-pdf") && TryShellExecuteZoteroUri(trace.ZoteroOpenPdfUri, "zotero://open-pdf"))
		{
			return "已通过 Zotero PDF 定位链接打开来源。";
		}
		CopyTraceIds(trace);
		return "无法直接打开 PDF，已复制溯源编号，可粘贴查看。";
	}

	public ZoteroBridgeResult RefreshFullLibrary()
	{
		return bridgeClient.RefreshLibraryResult();
	}

	public string SelectParentItem(string imageId)
	{
		ZoteroTraceInfo trace = GetTrace(imageId);
		ZoteroBridgeResult bridgeResult = bridgeClient.SelectParentItemByImageIdResult(trace.ImageId);
		if (bridgeResult.Success)
		{
			if (!bridgeResult.FallbackUsed)
			{
				return "已通过 Zotero 本地连接定位条目。";
			}
			return "已通过 Zotero 本地连接定位 PDF 附件。";
		}
		if (bridgeResult.RejectedInvalidUri)
		{
			CopyTraceIds(trace);
			return "Zotero 本地连接拒绝了不安全的定位地址，已复制溯源编号：" + BuildBridgeFailureText(bridgeResult);
		}
		if (TryShellExecuteZoteroUri(trace.SelectParentItemUri, "zotero://select"))
		{
			return "已通过 Zotero 条目定位链接打开来源条目。";
		}
		if (!string.Equals(trace.SelectParentItemUri, trace.SelectPdfAttachmentUri, StringComparison.OrdinalIgnoreCase) && TryShellExecuteZoteroUri(trace.SelectPdfAttachmentUri, "zotero://select"))
		{
			return "已通过 Zotero PDF 定位链接打开来源附件。";
		}
		CopyTraceIds(trace);
		return "无法直接定位条目，已复制溯源编号，可粘贴查看。";
	}

	public string CopyTraceIds(string imageId)
	{
		CopyTraceIds(GetTrace(imageId));
		return "已复制溯源编号，可粘贴查看。";
	}

	public string CopySwatchHex(string hex)
	{
		string normalized = NormalizeHex(hex);
		if (string.IsNullOrWhiteSpace(normalized))
		{
			throw new InvalidOperationException("色块 HEX 无效。");
		}
		Clipboard.SetText(normalized);
		return "已复制 HEX：" + normalized;
	}

	private SQLiteConnection OpenReadOnlyConnection()
	{
		SQLiteConnection sQLiteConnection = new SQLiteConnection("Data Source=" + DatabasePath + ";Version=3;Read Only=True;FailIfMissing=True;");
		sQLiteConnection.Open();
		return sQLiteConnection;
	}

	private ImageTable FindImageTable(SQLiteConnection connection)
	{
		List<ImageTable> candidates = new List<ImageTable>();
		using (SQLiteCommand command = new SQLiteCommand("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", connection))
		{
			using SQLiteDataReader reader = command.ExecuteReader();
			while (reader.Read())
			{
				string tableName = Convert.ToString(reader["name"], CultureInfo.InvariantCulture);
				HashSet<string> columns = LoadColumns(connection, tableName);
				if (columns.Count != 0)
				{
					ColumnMap mapping = new ColumnMap(columns);
					int score = 0;
					if (mapping.ImageBlob != null)
					{
						score += 8;
					}
					if (mapping.ThumbnailBlob != null)
					{
						score += 6;
					}
					if (mapping.ImageId != null)
					{
						score += 3;
					}
					if (mapping.SourceRegionKey != null)
					{
						score += 2;
					}
					if (tableName.IndexOf("paper", StringComparison.OrdinalIgnoreCase) >= 0)
					{
						score++;
					}
					if (score >= 6)
					{
						candidates.Add(new ImageTable(tableName, mapping, score));
					}
				}
			}
		}
		return (from item in candidates
			orderby ImageTablePriority(item.Name) descending, item.Score descending
			select item).FirstOrDefault();
	}

	private static int ImageTablePriority(string tableName)
	{
		if (string.Equals(tableName, "images", StringComparison.OrdinalIgnoreCase))
		{
			return 3;
		}
		if (string.Equals(tableName, "paper_images", StringComparison.OrdinalIgnoreCase))
		{
			return 2;
		}
		if ((tableName ?? string.Empty).IndexOf("paper", StringComparison.OrdinalIgnoreCase) >= 0)
		{
			return 1;
		}
		return 0;
	}

	private static HashSet<string> LoadColumns(SQLiteConnection connection, string tableName)
	{
		HashSet<string> columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
		using SQLiteCommand command = new SQLiteCommand("PRAGMA table_info(" + QuoteIdentifier(tableName) + ")", connection);
		using SQLiteDataReader reader = command.ExecuteReader();
		while (reader.Read())
		{
			columns.Add(Convert.ToString(reader["name"], CultureInfo.InvariantCulture));
		}
		return columns;
	}

	private List<ZoteroImageInfo> ReadImageRows(SQLiteConnection connection, ImageTable table, BlobReadMode blobMode, int limit)
	{
		List<string> selected = table.Mapping.ListColumns(blobMode).ToList();
		if (selected.Count == 0)
		{
			return new List<ZoteroImageInfo>();
		}
		string orderColumn = table.Mapping.CreatedAt ?? table.Mapping.PageNumber ?? table.Mapping.ImageId;
		string commandText = "SELECT " + string.Join(", ", selected.Select(QuoteIdentifier)) + " FROM " + QuoteIdentifier(table.Name) + ActiveRowsWhere(table.Mapping) + ((orderColumn == null) ? string.Empty : (" ORDER BY " + QuoteIdentifier(orderColumn) + " DESC")) + " LIMIT " + Math.Max(1, limit).ToString(CultureInfo.InvariantCulture);
		List<ZoteroImageInfo> rows = new List<ZoteroImageInfo>();
		using (SQLiteCommand command = new SQLiteCommand(commandText, connection))
		{
			using SQLiteDataReader reader = command.ExecuteReader();
			while (reader.Read())
			{
				ZoteroImageInfo item = BuildImageInfo(reader, table.Mapping, blobMode == BlobReadMode.Thumbnail);
				if (!string.IsNullOrWhiteSpace(item.ImageId))
				{
					rows.Add(item);
				}
			}
		}
		AppendSideTableSwatches(connection, rows);
		return rows;
	}

	private void AppendThumbnails(SQLiteConnection connection, ImageTable table, IList<ZoteroImageInfo> rows)
	{
		if (connection == null || table == null || rows == null || rows.Count == 0)
		{
			return;
		}
		ColumnMap map = table.Mapping;
		if ((map.ThumbnailBlob == null && map.ImageBlob == null) || map.ImageId == null || string.IsNullOrWhiteSpace(ImageIdentityPredicate(map)))
		{
			return;
		}
		foreach (ZoteroImageInfo row in rows.Take(96))
		{
			if (row != null && !string.IsNullOrWhiteSpace(row.ImageId))
			{
				row.ThumbnailDataUrl = ReadThumbnailDataUrl(connection, table, row.ImageId);
			}
		}
	}

	private string ReadThumbnailDataUrl(SQLiteConnection connection, ImageTable table, string imageId)
	{
		ColumnMap map = table.Mapping;
		string identityPredicate = ImageIdentityPredicate(map);
		string thumbnailExpression = ((map.ThumbnailBlob == null) ? "NULL" : QuoteIdentifier(map.ThumbnailBlob));
		string imageExpression = ((map.ImageBlob == null) ? "NULL" : QuoteIdentifier(map.ImageBlob));
		using SQLiteCommand command = new SQLiteCommand("SELECT CASE WHEN " + thumbnailExpression + " IS NOT NULL AND length(" + thumbnailExpression + ") BETWEEN 1 AND @maxBytes THEN " + thumbnailExpression + " WHEN " + imageExpression + " IS NOT NULL AND length(" + imageExpression + ") BETWEEN 1 AND @maxBytes THEN " + imageExpression + " ELSE NULL END FROM " + QuoteIdentifier(table.Name) + " WHERE (" + identityPredicate + ")" + ActiveRowsAnd(map) + " LIMIT 1", connection);
		command.Parameters.AddWithValue("@imageId", imageId ?? string.Empty);
		command.Parameters.AddWithValue("@maxBytes", 524288);
		return BlobValueToDataUrl(command.ExecuteScalar(), 524288);
	}

	private void AppendSideTableSwatches(SQLiteConnection connection, IList<ZoteroImageInfo> rows)
	{
		if (connection == null || rows == null || rows.Count == 0 || !TableExists(connection, "image_palette_swatches"))
		{
			return;
		}
		HashSet<string> columns = LoadColumns(connection, "image_palette_swatches");
		if (!columns.Contains("image_id") || !columns.Contains("hex"))
		{
			return;
		}
		Dictionary<string, ZoteroImageInfo> itemsById = new Dictionary<string, ZoteroImageInfo>(StringComparer.OrdinalIgnoreCase);
		foreach (ZoteroImageInfo row in rows)
		{
			if (row != null && !string.IsNullOrWhiteSpace(row.ImageId) && !itemsById.ContainsKey(row.ImageId))
			{
				itemsById.Add(row.ImageId, row);
			}
		}
		if (itemsById.Count == 0)
		{
			return;
		}
		List<string> ids = itemsById.Keys.Take(400).ToList();
		List<string> parameterNames = ids.Select((string id, int index) => "@id" + index.ToString(CultureInfo.InvariantCulture)).ToList();
		bool selectRole = columns.Contains("role");
		string orderColumn = (columns.Contains("swatch_index") ? "swatch_index" : null);
		using SQLiteCommand command = new SQLiteCommand("SELECT " + QuoteIdentifier("image_id") + ", " + QuoteIdentifier("hex") + (selectRole ? (", " + QuoteIdentifier("role")) : string.Empty) + " FROM " + QuoteIdentifier("image_palette_swatches") + " WHERE " + QuoteIdentifier("image_id") + " IN (" + string.Join(", ", parameterNames) + ")" + ((orderColumn == null) ? string.Empty : (" ORDER BY " + QuoteIdentifier("image_id") + ", " + QuoteIdentifier(orderColumn))), connection);
		for (int i = 0; i < ids.Count; i++)
		{
			command.Parameters.AddWithValue(parameterNames[i], ids[i]);
		}
		using SQLiteDataReader reader = command.ExecuteReader();
		while (reader.Read())
		{
			string imageId = ReadText(reader, "image_id");
			string hex = ReadText(reader, "hex");
			if (!itemsById.TryGetValue(imageId, out var item) || !IsHex(hex))
			{
				continue;
			}
			string role = (selectRole ? ReadText(reader, "role") : string.Empty);
			ZoteroSwatchInfo existing = item.Swatches.FirstOrDefault((ZoteroSwatchInfo swatch) => SameHex(swatch.Hex, hex));
			if (existing != null)
			{
				if (!string.IsNullOrWhiteSpace(role) && string.Equals(existing.Role, "论文配色", StringComparison.OrdinalIgnoreCase))
				{
					existing.Role = role;
				}
			}
			else
			{
				item.Swatches.Add(MakeSwatch(hex, string.IsNullOrWhiteSpace(role) ? "论文配色" : role, item));
			}
		}
	}

	private ZoteroImageInfo BuildImageInfo(SQLiteDataReader reader, ColumnMap map, bool includeThumbnail)
	{
		string imageId = ReadText(reader, map.ImageId);
		string title = ReadText(reader, map.Title);
		int pageNumber = ReadInt(reader, map.PageNumber);
		string parentKey = ReadText(reader, map.ParentItemKey);
		string pdfKey = ReadText(reader, map.PdfAttachmentKey);
		string openPdfUri = ReadText(reader, map.ZoteroOpenPdfUri);
		string selectItemUri = ReadText(reader, map.ZoteroSelectItemUri);
		string selectPdfUri = ReadText(reader, map.ZoteroSelectPdfUri);
		string sourceRegionKey = ReadText(reader, map.SourceRegionKey);
		string previewDuplicateKey = ReadText(reader, map.PreviewDuplicateKey);
		string libraryId = ReadText(reader, map.LibraryId);
		string libraryType = ReadText(reader, map.LibraryType);
		string groupId = ReadText(reader, map.GroupId);
		string bboxJson = ReadText(reader, map.BboxJson);
		if (string.IsNullOrWhiteSpace(imageId))
		{
			imageId = sourceRegionKey;
		}
		ZoteroImageInfo item = new ZoteroImageInfo
		{
			ImageId = imageId,
			Title = title,
			Year = ReadText(reader, map.Year),
			Doi = ReadText(reader, map.Doi),
			PageNumber = pageNumber,
			SourceRegionKey = sourceRegionKey,
			PreviewDuplicateKey = previewDuplicateKey,
			ZoteroOpenPdfUri = openPdfUri,
			ZoteroSelectPdfUri = selectPdfUri,
			ParentItemKey = parentKey,
			PdfAttachmentKey = pdfKey,
			LibraryId = libraryId,
			LibraryType = libraryType,
			GroupId = groupId,
			BboxJson = bboxJson,
			ImageCategory = ReadText(reader, map.ImageCategory),
			ColorFamily = ReadText(reader, map.ColorFamily),
			CreatedAt = ReadText(reader, map.CreatedAt),
			ThumbnailDataUrl = (includeThumbnail ? ReadBlobDataUrl(reader, map.ThumbnailBlob) : string.Empty)
		};
		item.StyleTags = ParseTags(ReadText(reader, map.StyleTags));
		item.Trace = new ZoteroTraceInfo
		{
			ImageId = imageId,
			ParentItemKey = parentKey,
			PdfAttachmentKey = pdfKey,
			PageNumber = pageNumber,
			SourceRegionKey = sourceRegionKey,
			PreviewDuplicateKey = previewDuplicateKey,
			LibraryId = libraryId,
			LibraryType = libraryType,
			GroupId = groupId,
			BboxJson = bboxJson,
			ZoteroOpenPdfUri = openPdfUri,
			SelectParentItemUri = FirstAllowedZoteroSelectUri(selectItemUri, selectPdfUri, BuildSelectUri(parentKey)),
			SelectPdfAttachmentUri = selectPdfUri,
			Title = title
		};
		item.Swatches = ParseSwatches(ReadText(reader, map.PaletteJson), item);
		string dominant = ReadText(reader, map.DominantHex);
		if (IsHex(dominant) && item.Swatches.All((ZoteroSwatchInfo swatch) => !SameHex(swatch.Hex, dominant)))
		{
			item.Swatches.Add(new ZoteroSwatchInfo
			{
				Hex = NormalizeHex(dominant),
				BaseHex = NormalizeHex(dominant),
				Variant = "base",
				Role = "主色",
				SourceTitle = item.Title,
				ImageId = item.ImageId
			});
		}
		if (item.Swatches.Count == 0 && !string.IsNullOrWhiteSpace(item.ColorFamily))
		{
			string fallback = ColorFamilyFallback(item.ColorFamily);
			if (fallback != null)
			{
				item.Swatches.Add(MakeSwatch(fallback, "色系", item));
			}
		}
		return item;
	}

	private ZoteroImageInfo ReadImageForInsert(string imageId)
	{
		using SQLiteConnection connection = OpenReadOnlyConnection();
		ImageTable table = FindImageTable(connection);
		if (table == null)
		{
			return null;
		}
		ColumnMap map = table.Mapping;
		if (map.ImageId == null)
		{
			return null;
		}
		List<string> selected = map.ListColumns(BlobReadMode.None).ToList();
		if (!selected.Contains(map.ImageId, StringComparer.OrdinalIgnoreCase))
		{
			selected.Add(map.ImageId);
		}
		string identityPredicate = ImageIdentityPredicate(map);
		if (string.IsNullOrWhiteSpace(identityPredicate))
		{
			return null;
		}
		using SQLiteCommand command = new SQLiteCommand("SELECT " + string.Join(", ", selected.Select(QuoteIdentifier)) + " FROM " + QuoteIdentifier(table.Name) + " WHERE (" + identityPredicate + ")" + ActiveRowsAnd(map) + " LIMIT 1", connection);
		command.Parameters.AddWithValue("@imageId", imageId ?? string.Empty);
		using SQLiteDataReader reader = command.ExecuteReader();
		if (!reader.Read())
		{
			return null;
		}
		ZoteroImageInfo item = BuildImageInfo(reader, map, includeThumbnail: false);
		AppendSideTableSwatches(connection, new List<ZoteroImageInfo> { item });
		return item;
	}

	private byte[] ReadImageBlob(string imageId)
	{
		using SQLiteConnection connection = OpenReadOnlyConnection();
		ImageTable table = FindImageTable(connection);
		if (table == null || table.Mapping.ImageBlob == null || table.Mapping.ImageId == null)
		{
			return null;
		}
		string identityPredicate = ImageIdentityPredicate(table.Mapping);
		if (string.IsNullOrWhiteSpace(identityPredicate))
		{
			return null;
		}
		if (ReadImageBlobStoredBytes(connection, table, imageId) > MaxImageBlobBytes)
		{
			throw new InvalidOperationException("论文图像数据过大，已超过 " + FormatBytes(MaxImageBlobBytes) + " 安全读取上限。请在 Zotero 中保存较小参考图或降低原图质量后再插入。");
		}
		using SQLiteCommand command = new SQLiteCommand("SELECT " + QuoteIdentifier(table.Mapping.ImageBlob) + " FROM " + QuoteIdentifier(table.Name) + " WHERE (" + identityPredicate + ")" + ActiveRowsAnd(table.Mapping) + " LIMIT 1", connection);
		command.Parameters.AddWithValue("@imageId", imageId ?? string.Empty);
		object value = command.ExecuteScalar();
		if (value is string text)
		{
			return DecodeDataUrl(text);
		}
		return (value == DBNull.Value) ? null : (value as byte[]);
	}

	private long ReadImageBlobStoredBytes(SQLiteConnection connection, ImageTable table, string imageId)
	{
		string identityPredicate = ImageIdentityPredicate(table.Mapping);
		using SQLiteCommand command = new SQLiteCommand("SELECT length(" + QuoteIdentifier(table.Mapping.ImageBlob) + ") FROM " + QuoteIdentifier(table.Name) + " WHERE (" + identityPredicate + ")" + ActiveRowsAnd(table.Mapping) + " LIMIT 1", connection);
		command.Parameters.AddWithValue("@imageId", imageId ?? string.Empty);
		object value = command.ExecuteScalar();
		if (value == null || value == DBNull.Value)
		{
			return 0L;
		}
		return Convert.ToInt64(value, CultureInfo.InvariantCulture);
	}

	private ZoteroTraceInfo GetTrace(string imageId)
	{
		return (ReadImageForInsert(imageId) ?? throw new InvalidOperationException("未找到所选论文图像。请重新读取图库后再试。")).Trace;
	}

	private static bool MatchesQuery(ZoteroImageInfo item, string query)
	{
		if (string.IsNullOrWhiteSpace(query))
		{
			return true;
		}
		return string.Join(" ", item.ImageId, item.Title, item.Year, item.Doi, (item.PageNumber > 0) ? item.PageNumber.ToString(CultureInfo.InvariantCulture) : string.Empty, item.ImageCategory, MetadataSearchLabel(item.ImageCategory), item.ColorFamily, MetadataSearchLabel(item.ColorFamily), item.SourceRegionKey, item.ParentItemKey, item.PdfAttachmentKey, string.Join(" ", item.StyleTags ?? new List<string>()), string.Join(" ", (item.StyleTags ?? new List<string>()).Select(MetadataSearchLabel)), string.Join(" ", (item.Swatches ?? new List<ZoteroSwatchInfo>()).Select((ZoteroSwatchInfo swatch) => swatch.Hex + " " + swatch.Role))).IndexOf(query.Trim(), StringComparison.OrdinalIgnoreCase) >= 0;
	}

	private static string MetadataSearchLabel(string value)
	{
		string key = (value ?? string.Empty).Trim().ToLowerInvariant();
		if (string.IsNullOrWhiteSpace(key))
		{
			return string.Empty;
		}
		if (MetadataSearchLabels.TryGetValue(key, out var label))
		{
			return label;
		}
		Match match = Regex.Match(key, "^(?:ins|insert)-(large|medium|small)$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			if (!(match.Groups[1].Value == "large"))
			{
				if (!(match.Groups[1].Value == "small"))
				{
					return "中尺寸";
				}
				return "小尺寸";
			}
			return "大尺寸";
		}
		match = Regex.Match(key, "^(?:cap|caption)-(result|method|compare|context)$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			return MetadataSearchLabel(match.Groups[1].Value) + "型图注";
		}
		match = Regex.Match(key, "^(?:beat|story)-(hook|setup|method|result|compare|close)$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
			{
				{ "hook", "引入阶段" },
				{ "setup", "铺垫阶段" },
				{ "method", "方法阶段" },
				{ "result", "结果阶段" },
				{ "compare", "对比阶段" },
				{ "close", "收束阶段" }
			}[match.Groups[1].Value];
		}
		match = Regex.Match(key, "^slide-(hero|side|footer|inset)$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			return MetadataSearchLabel(match.Groups[1].Value) + "版位";
		}
		match = Regex.Match(key, "^role-(result|method|evidence|compare|context)$", RegexOptions.IgnoreCase);
		if (match.Success)
		{
			return MetadataSearchLabel(match.Groups[1].Value);
		}
		if (!ChineseTextRegex.IsMatch(value ?? string.Empty))
		{
			return string.Empty;
		}
		return value;
	}

	private List<ZoteroSwatchInfo> ParseSwatches(string paletteJson, ZoteroImageInfo item)
	{
		List<ZoteroSwatchInfo> swatches = new List<ZoteroSwatchInfo>();
		if (string.IsNullOrWhiteSpace(paletteJson))
		{
			return swatches;
		}
		foreach (Match match in HexRegex.Matches(paletteJson))
		{
			string hex = NormalizeHex(match.Value);
			if (!swatches.Any((ZoteroSwatchInfo swatch) => SameHex(swatch.Hex, hex)))
			{
				swatches.Add(MakeSwatch(hex, "论文配色", item));
			}
		}
		return swatches;
	}

	private static ZoteroSwatchInfo MakeSwatch(string hex, string role, ZoteroImageInfo item)
	{
		return new ZoteroSwatchInfo
		{
			Hex = NormalizeHex(hex),
			BaseHex = NormalizeHex(hex),
			Variant = "base",
			Role = role,
			SourceTitle = item?.Title,
			ImageId = item?.ImageId
		};
	}

	private static IEnumerable<ZoteroSwatchInfo> PaletteVariants(ZoteroSwatchInfo baseSwatch)
	{
		var variants = new[]
		{
			new
			{
				Name = "80% 浅色",
				Hex = MixHex(baseSwatch.Hex, "#ffffff", 0.8)
			},
			new
			{
				Name = "60% 浅色",
				Hex = MixHex(baseSwatch.Hex, "#ffffff", 0.6)
			},
			new
			{
				Name = "35% 浅色",
				Hex = MixHex(baseSwatch.Hex, "#ffffff", 0.35)
			},
			new
			{
				Name = "基准色",
				Hex = NormalizeHex(baseSwatch.Hex)
			},
			new
			{
				Name = "20% 深色",
				Hex = MixHex(baseSwatch.Hex, "#000000", 0.2)
			},
			new
			{
				Name = "40% 深色",
				Hex = MixHex(baseSwatch.Hex, "#000000", 0.4)
			},
			new
			{
				Name = "60% 深色",
				Hex = MixHex(baseSwatch.Hex, "#000000", 0.6)
			}
		};
		var array = variants;
		foreach (var variant in array)
		{
			yield return new ZoteroSwatchInfo
			{
				Hex = variant.Hex,
				BaseHex = NormalizeHex(baseSwatch.Hex),
				Variant = variant.Name,
				Role = baseSwatch.Role,
				SourceTitle = baseSwatch.SourceTitle,
				ImageId = baseSwatch.ImageId
			};
		}
	}

	private static string MixHex(string hex, string mixHex, double amount)
	{
		Color source = ColorTranslator.FromHtml(NormalizeHex(hex));
		Color mix = ColorTranslator.FromHtml(NormalizeHex(mixHex));
		double ratio = Math.Max(0.0, Math.Min(1.0, amount));
		return "#" + ((int)Math.Round((double)(int)source.R + (double)(mix.R - source.R) * ratio)).ToString("X2", CultureInfo.InvariantCulture) + ((int)Math.Round((double)(int)source.G + (double)(mix.G - source.G) * ratio)).ToString("X2", CultureInfo.InvariantCulture) + ((int)Math.Round((double)(int)source.B + (double)(mix.B - source.B) * ratio)).ToString("X2", CultureInfo.InvariantCulture);
	}

	private static string ColorFamilyFallback(string colorFamily)
	{
		string value = (colorFamily ?? string.Empty).ToLowerInvariant();
		if (value.Contains("red") || value.Contains("红"))
		{
			return "#d13438";
		}
		if (value.Contains("orange") || value.Contains("橙"))
		{
			return "#f7630c";
		}
		if (value.Contains("yellow") || value.Contains("黄"))
		{
			return "#ffb900";
		}
		if (value.Contains("green") || value.Contains("绿"))
		{
			return "#107c10";
		}
		if (value.Contains("blue") || value.Contains("蓝"))
		{
			return "#0078d4";
		}
		if (value.Contains("purple") || value.Contains("紫"))
		{
			return "#5c2d91";
		}
		if (value.Contains("gray") || value.Contains("grey") || value.Contains("灰"))
		{
			return "#605e5c";
		}
		return null;
	}

	private static List<string> ParseTags(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return new List<string>();
		}
		return (from item in value.Replace("[", string.Empty).Replace("]", string.Empty).Replace("\"", string.Empty)
				.Split(new char[4] { ',', ';', '|', ' ' }, StringSplitOptions.RemoveEmptyEntries)
			select item.Trim() into item
			where item.Length > 0
			select item).Distinct(StringComparer.OrdinalIgnoreCase).Take(12).ToList();
	}

	private static string ReadText(SQLiteDataReader reader, string column)
	{
		if (column == null)
		{
			return string.Empty;
		}
		try
		{
			object value = reader[column];
			return (value == DBNull.Value) ? string.Empty : Convert.ToString(value, CultureInfo.InvariantCulture);
		}
		catch
		{
			return string.Empty;
		}
	}

	private static int ReadInt(SQLiteDataReader reader, string column)
	{
		if (!int.TryParse(ReadText(reader, column), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
		{
			return 0;
		}
		return value;
	}

	private static string ReadBlobDataUrl(SQLiteDataReader reader, string column)
	{
		if (column == null)
		{
			return string.Empty;
		}
		try
		{
			return BlobValueToDataUrl(reader[column], 524288);
		}
		catch
		{
			return string.Empty;
		}
	}

	private static string BlobValueToDataUrl(object value, int maxBytes)
	{
		if (value is string text && text.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
		{
			byte[] decoded = DecodeDataUrl(text);
			if (decoded != null && decoded.Length > maxBytes)
			{
				return string.Empty;
			}
			return text;
		}
		byte[] bytes = ((value == DBNull.Value) ? null : (value as byte[]));
		if (bytes == null || bytes.Length == 0 || bytes.Length > maxBytes)
		{
			return string.Empty;
		}
		return MimeForBytes(bytes) + Convert.ToBase64String(bytes);
	}

	private static byte[] DecodeDataUrl(string text)
	{
		if (string.IsNullOrWhiteSpace(text))
		{
			return null;
		}
		int comma = text.IndexOf(',');
		if (comma < 0)
		{
			return null;
		}
		try
		{
			return Convert.FromBase64String(text.Substring(comma + 1));
		}
		catch
		{
			return null;
		}
	}

	private static string MimeForBytes(byte[] bytes)
	{
		if (bytes.Length > 3 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71)
		{
			return "data:image/png;base64,";
		}
		if (bytes.Length > 2 && bytes[0] == byte.MaxValue && bytes[1] == 216)
		{
			return "data:image/jpeg;base64,";
		}
		if (bytes.Length > 5 && bytes[0] == 71 && bytes[1] == 73 && bytes[2] == 70)
		{
			return "data:image/gif;base64,";
		}
		return "data:image/png;base64,";
	}

	private static string ExtensionForBytes(byte[] bytes)
	{
		if (bytes.Length > 3 && bytes[0] == 137 && bytes[1] == 80)
		{
			return ".png";
		}
		if (bytes.Length > 2 && bytes[0] == byte.MaxValue && bytes[1] == 216)
		{
			return ".jpg";
		}
		if (bytes.Length > 5 && bytes[0] == 71 && bytes[1] == 73)
		{
			return ".gif";
		}
		return ".png";
	}

	private static Size ReadImageSize(byte[] bytes)
	{
		using MemoryStream stream = new MemoryStream(bytes);
		using Image image = Image.FromStream(stream);
		return image.Size;
	}

	private static string WriteTempImage(byte[] bytes, string imageId)
	{
		string text = Path.Combine(Path.GetTempPath(), "RoughPptAddin", "zotero-images");
		Directory.CreateDirectory(text);
		string safeName = Regex.Replace(imageId ?? Guid.NewGuid().ToString("N"), "[^A-Za-z0-9_.-]+", "_");
		string text2 = Path.Combine(text, safeName + "-" + Guid.NewGuid().ToString("N") + ExtensionForBytes(bytes));
		File.WriteAllBytes(text2, bytes);
		return text2;
	}

	private static void WriteTraceTags(Microsoft.Office.Interop.PowerPoint.Shape shape, ZoteroImageInfo info)
	{
		shape.Tags.Add("PPT_ZOTERO_IMAGE_ID", info.ImageId ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_SOURCE_REGION_KEY", info.SourceRegionKey ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_PREVIEW_DUPLICATE_KEY", info.PreviewDuplicateKey ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_OPEN_PDF_URI", info.ZoteroOpenPdfUri ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_TITLE", info.Title ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_LIBRARY_ID", info.LibraryId ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_LIBRARY_TYPE", info.LibraryType ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_GROUP_ID", info.GroupId ?? string.Empty);
		shape.Tags.Add("PPT_ZOTERO_BBOX_JSON", info.BboxJson ?? string.Empty);
	}

	private static bool TryShellExecute(string uri)
	{
		if (string.IsNullOrWhiteSpace(uri))
		{
			return false;
		}
		try
		{
			Process.Start(new ProcessStartInfo(uri)
			{
				UseShellExecute = true
			});
			return true;
		}
		catch
		{
			return false;
		}
	}

	private static bool TryShellExecuteZoteroUri(string uri, string requiredPrefix)
	{
		if (IsAllowedZoteroUri(uri, requiredPrefix))
		{
			return TryShellExecute(uri);
		}
		return false;
	}

	private static bool IsAllowedZoteroUri(string uri, string requiredPrefix)
	{
		if (string.IsNullOrWhiteSpace(uri) || string.IsNullOrWhiteSpace(requiredPrefix))
		{
			return false;
		}
		return uri.Trim().StartsWith(requiredPrefix + "/", StringComparison.OrdinalIgnoreCase);
	}

	private static string FirstAllowedZoteroSelectUri(params string[] candidates)
	{
		string[] array = candidates ?? new string[0];
		foreach (string candidate in array)
		{
			if (IsAllowedZoteroUri(candidate, "zotero://select"))
			{
				return candidate;
			}
		}
		return string.Empty;
	}

	private static string BuildBridgeFailureText(ZoteroBridgeResult result)
	{
		if (result == null)
		{
			return "Zotero 本地连接无响应。";
		}
		string status = ((result.StatusCode > 0) ? result.StatusCode.ToString(CultureInfo.InvariantCulture) : "无状态码");
		string error = BridgeErrorLabel(result.Error);
		string previewDuplicate = (string.IsNullOrWhiteSpace(result.SourcePreviewDuplicateKey) ? string.Empty : "；已识别来源记录");
		return "Zotero 本地连接状态 " + status + "，错误 " + error + "。" + previewDuplicate;
	}

	private static string BridgeErrorLabel(string error)
	{
		string value = (error ?? string.Empty).Trim();
		if (string.IsNullOrWhiteSpace(value))
		{
			return "未知错误";
		}
		if (value.IndexOf("Requested Zotero URI invalid", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("invalid", StringComparison.OrdinalIgnoreCase) >= 0)
		{
			return "来源定位地址无效";
		}
		if (value.IndexOf("timed out", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("timeout", StringComparison.OrdinalIgnoreCase) >= 0)
		{
			return "连接超时";
		}
		if (value.IndexOf("connect", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("network", StringComparison.OrdinalIgnoreCase) >= 0 || value.IndexOf("refused", StringComparison.OrdinalIgnoreCase) >= 0)
		{
			return "无法连接 Zotero";
		}
		if (!ChineseTextRegex.IsMatch(value))
		{
			return "连接请求失败";
		}
		return value;
	}

	private static void CopyTraceIds(ZoteroTraceInfo trace)
	{
		Clipboard.SetText(BuildTraceText(trace));
	}

	private static string BuildTraceText(ZoteroTraceInfo trace)
	{
		string[] lines = new string[10]
		{
			"图像编号=" + (trace.ImageId ?? string.Empty),
			"父条目编号=" + (trace.ParentItemKey ?? string.Empty),
			"PDF 附件编号=" + (trace.PdfAttachmentKey ?? string.Empty),
			"页码=" + trace.PageNumber.ToString(CultureInfo.InvariantCulture),
			"来源区域编号=" + (trace.SourceRegionKey ?? string.Empty),
			"预览去重编号=" + (trace.PreviewDuplicateKey ?? string.Empty),
			"文库编号=" + (trace.LibraryId ?? string.Empty),
			"文库类型=" + (trace.LibraryType ?? string.Empty),
			"群组编号=" + (trace.GroupId ?? string.Empty),
			"来源区域坐标=" + (trace.BboxJson ?? string.Empty)
		};
		return string.Join(Environment.NewLine, lines);
	}

	private static string ActiveRowsWhere(ColumnMap map)
	{
		string predicate = ActiveRowsPredicate(map);
		if (!string.IsNullOrWhiteSpace(predicate))
		{
			return " WHERE " + predicate;
		}
		return string.Empty;
	}

	private static string ActiveRowsAnd(ColumnMap map)
	{
		string predicate = ActiveRowsPredicate(map);
		if (!string.IsNullOrWhiteSpace(predicate))
		{
			return " AND " + predicate;
		}
		return string.Empty;
	}

	private static string ActiveRowsPredicate(ColumnMap map)
	{
		if (map == null || string.IsNullOrWhiteSpace(map.Deleted))
		{
			return string.Empty;
		}
		return "(CAST(COALESCE(" + QuoteIdentifier(map.Deleted) + ", 0) AS INTEGER) = 0)";
	}

	private static string ImageIdentityPredicate(ColumnMap map)
	{
		if (map == null)
		{
			return string.Empty;
		}
		List<string> predicates = new List<string>();
		if (!string.IsNullOrWhiteSpace(map.ImageId))
		{
			predicates.Add(QuoteIdentifier(map.ImageId) + " = @imageId");
		}
		if (!string.IsNullOrWhiteSpace(map.SourceRegionKey) && !string.Equals(map.SourceRegionKey, map.ImageId, StringComparison.OrdinalIgnoreCase))
		{
			predicates.Add(QuoteIdentifier(map.SourceRegionKey) + " = @imageId");
		}
		return string.Join(" OR ", predicates);
	}

	private static string BuildSelectUri(string parentItemKey)
	{
		if (!string.IsNullOrWhiteSpace(parentItemKey))
		{
			return "zotero://select/library/items/" + Uri.EscapeDataString(parentItemKey);
		}
		return string.Empty;
	}

	private static bool TableExists(SQLiteConnection connection, string tableName)
	{
		using SQLiteCommand command = new SQLiteCommand("SELECT 1 FROM sqlite_master WHERE type='table' AND name=@name LIMIT 1", connection);
		command.Parameters.AddWithValue("@name", tableName ?? string.Empty);
		object value = command.ExecuteScalar();
		return value != null && value != DBNull.Value;
	}

	private static string UniqueShapeName(string prefix)
	{
		return prefix + "_" + DateTime.Now.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);
	}

	private static string QuoteIdentifier(string value)
	{
		return "\"" + (value ?? string.Empty).Replace("\"", "\"\"") + "\"";
	}

	private static bool IsHex(string value)
	{
		if (!string.IsNullOrWhiteSpace(value))
		{
			return Regex.IsMatch(value.Trim(), "^#[0-9a-fA-F]{6}$");
		}
		return false;
	}

	private static bool SameHex(string left, string right)
	{
		return string.Equals(NormalizeHex(left), NormalizeHex(right), StringComparison.OrdinalIgnoreCase);
	}

	private static string NormalizeHex(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return string.Empty;
		}
		string text = value.Trim();
		if (!text.StartsWith("#", StringComparison.Ordinal))
		{
			text = "#" + text;
		}
		if (!IsHex(text))
		{
			return string.Empty;
		}
		return text.ToUpperInvariant();
	}

	private static string FormatBytes(long bytes)
	{
		if (bytes < 1024)
		{
			return bytes.ToString(CultureInfo.InvariantCulture) + " B";
		}
		if (bytes < 1048576)
		{
			return ((double)bytes / 1024.0).ToString("0.#", CultureInfo.InvariantCulture) + " KB";
		}
		return ((double)bytes / 1024.0 / 1024.0).ToString("0.#", CultureInfo.InvariantCulture) + " MB";
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
