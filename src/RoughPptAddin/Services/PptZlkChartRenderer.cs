using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class PptZlkChartRenderer
{
	private const string TagPrefix = "PPT_ZLK_";

	public ZlkChartRenderResult Render(Slide slide, ChartDataset dataset, ZlkChartSpec spec, RoughStyle style, FeatureBlockOptions feature)
	{
		if (slide == null)
		{
			throw new ArgumentNullException("slide");
		}
		dataset = dataset ?? new ChartDataset();
		spec = spec ?? new ZlkChartSpec();
		style = style ?? new RoughStyle();
		feature = feature ?? new FeatureBlockOptions();
		string chartType = NormalizeChartType(spec.ChartType);
		List<string> warnings = new List<string>();
		if (dataset.Errors != null && dataset.Errors.Count > 0)
		{
			warnings.AddRange(dataset.Errors);
		}
		List<RoughPptAddin.Models.ChartPoint> points = UsablePoints(dataset.Points).ToList();
		if (!points.Any() && chartType != "genericTable")
		{
			chartType = "genericTable";
			warnings.Add("没有足够数值点，已改为结果表格。");
		}
		List<Microsoft.Office.Interop.PowerPoint.Shape> shapes = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
		float width = ((slide.Parent is Presentation presentation) ? presentation.PageSetup.SlideWidth : 960f);
		float height = ((slide.Parent is Presentation presentation2) ? presentation2.PageSetup.SlideHeight : 540f);
		AddTitle(slide, shapes, spec.Title ?? ChartTitle(dataset, chartType), 36f, 20f, width - 72f, style);
		switch (chartType)
		{
		case "sensitivityCurve":
		case "caseLevelDistribution":
			RenderLineChart(slide, shapes, points, chartType, 72f, 88f, width - 120f, height - 150f, style, feature, warnings);
			break;
		case "scatterPlot":
			RenderScatterChart(slide, shapes, points, chartType, 72f, 88f, width - 120f, height - 150f, style, feature, warnings);
			break;
		case "meanStdErrorBar":
			RenderBarChart(slide, shapes, points, chartType, 72f, 88f, width - 120f, height - 150f, style, feature, errorBars: true, warnings);
			break;
		case "errorTypeSummary":
		case "leaderboardBar":
		case "subgroupComparison":
			RenderBarChart(slide, shapes, points, chartType, 72f, 88f, width - 120f, height - 150f, style, feature, errorBars: false, warnings);
			break;
		default:
			chartType = "genericTable";
			RenderTable(slide, shapes, dataset, 48f, 84f, width - 96f, height - 130f, style, feature, warnings);
			break;
		}
		Microsoft.Office.Interop.PowerPoint.Shape group = GroupIfNeeded(slide, shapes);
		if (group != null)
		{
			group.Tags.Add("PPT_ZLK_CHART", chartType);
			group.Tags.Add("PPT_ZLK_SOURCE", dataset.Source?.Path ?? string.Empty);
			group.Tags.Add("PPT_ZLK_POINTS", points.Count.ToString(CultureInfo.InvariantCulture));
		}
		return new ZlkChartRenderResult
		{
			SlideIndex = slide.SlideIndex,
			ShapeCount = shapes.Count,
			ChartType = chartType,
			Warnings = warnings
		};
	}

	private static void RenderBarChart(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, IList<RoughPptAddin.Models.ChartPoint> points, string chartType, float left, float top, float width, float height, RoughStyle style, FeatureBlockOptions feature, bool errorBars, IList<string> warnings)
	{
		List<double> values = (from v in points.Select(ValueOf)
			where v.HasValue
			select v.Value).ToList();
		if (!values.Any())
		{
			warnings.Add("柱状图缺少可用数值。");
			return;
		}
		double min = Math.Min(0.0, values.Min());
		double max = Math.Max(values.Max(), min + 0.0001);
		AddAxes(slide, shapes, left, top, width, height, style);
		AddAxisLabel(slide, shapes, "0", left - 38f, top + height - 8f, 34f, 16f, style);
		AddAxisLabel(slide, shapes, max.ToString("0.###", CultureInfo.InvariantCulture), left - 48f, top - 8f, 44f, 16f, style);
		int count = Math.Min(points.Count, 18);
		float gap = Math.Max(6f, width / (float)Math.Max(1, count) * 0.18f);
		float slot = width / (float)Math.Max(1, count);
		float barWidth = Math.Max(8f, slot - gap);
		for (int i = 0; i < count; i++)
		{
			RoughPptAddin.Models.ChartPoint point = points[i];
			double value = ValueOf(point).GetValueOrDefault();
			float barHeight = (float)((value - min) / (max - min) * (double)Math.Max(1f, height));
			float x = left + (float)i * slot + gap / 2f;
			float y = top + height - barHeight;
			Microsoft.Office.Interop.PowerPoint.Shape bar = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, x, y, barWidth, Math.Max(1f, barHeight));
			StyleFilledShape(bar, style, LerpColor(feature.StartColor, feature.EndColor, (count <= 1) ? 0.0 : ((double)i / (double)(count - 1))));
			shapes.Add(bar);
			if (errorBars)
			{
				AddErrorBar(slide, shapes, point, value, min, max, x + barWidth / 2f, top, height, style);
			}
			string label = ShortLabel(LabelFor(point, chartType), 16);
			AddAxisLabel(slide, shapes, label, x - 8f, top + height + 8f, barWidth + 16f, 30f, style);
		}
	}

	private static void RenderLineChart(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, IList<RoughPptAddin.Models.ChartPoint> points, string chartType, float left, float top, float width, float height, RoughStyle style, FeatureBlockOptions feature, IList<string> warnings)
	{
		List<double> values = (from v in points.Select(ValueOf)
			where v.HasValue
			select v.Value).ToList();
		if (!values.Any())
		{
			warnings.Add("曲线图缺少可用数值。");
			return;
		}
		List<RoughPptAddin.Models.ChartPoint> ordered = points.Take(24).ToList();
		List<double?> numericX = ordered.Select(NumericXOf).ToList();
		bool useNumericX = numericX.All((double? num) => num.HasValue) && numericX.Select((double? num) => num.Value).Distinct().Count() > 1;
		if (useNumericX)
		{
			ordered = ordered.OrderBy((RoughPptAddin.Models.ChartPoint point2) => NumericXOf(point2).Value).ToList();
			numericX = ordered.Select(NumericXOf).ToList();
		}
		double minX = (useNumericX ? numericX.Min((double? num) => num.Value) : 0.0);
		double maxX = (useNumericX ? numericX.Max((double? num) => num.Value) : ((double)Math.Max(1, ordered.Count - 1)));
		double min = Math.Min(0.0, values.Min());
		double max = Math.Max(values.Max(), min + 0.0001);
		AddAxes(slide, shapes, left, top, width, height, style);
		AddAxisLabel(slide, shapes, max.ToString("0.###", CultureInfo.InvariantCulture), left - 48f, top - 8f, 44f, 16f, style);
		Microsoft.Office.Interop.PowerPoint.Shape previousMarker = null;
		for (int i = 0; i < ordered.Count; i++)
		{
			RoughPptAddin.Models.ChartPoint point = ordered[i];
			double value = ValueOf(point).GetValueOrDefault();
			double xValue = (useNumericX ? numericX[i].Value : ((double)i));
			float x = ((ordered.Count <= 1) ? (left + width / 2f) : (left + (float)((xValue - minX) / (maxX - minX) * (double)width)));
			float y = top + height - (float)((value - min) / (max - min) * (double)Math.Max(1f, height));
			Microsoft.Office.Interop.PowerPoint.Shape marker = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeOval, x - 3.5f, y - 3.5f, 7f, 7f);
			StyleFilledShape(marker, style, LerpColor(feature.StartColor, feature.EndColor, (ordered.Count <= 1) ? 0.0 : ((double)i / (double)(ordered.Count - 1))));
			shapes.Add(marker);
			if (previousMarker != null)
			{
				Microsoft.Office.Interop.PowerPoint.Shape line = slide.Shapes.AddLine(previousMarker.Left + 3.5f, previousMarker.Top + 3.5f, x, y);
				StyleLine(line, style);
				shapes.Add(line);
			}
			if (i == 0 || i == ordered.Count - 1 || ordered.Count <= 8)
			{
				AddAxisLabel(slide, shapes, ShortLabel(LabelFor(point, chartType), 14), x - 34f, top + height + 8f, 68f, 24f, style);
			}
			previousMarker = marker;
		}
	}

	private static void RenderScatterChart(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, IList<RoughPptAddin.Models.ChartPoint> points, string chartType, float left, float top, float width, float height, RoughStyle style, FeatureBlockOptions feature, IList<string> warnings)
	{
		List<RoughPptAddin.Models.ChartPoint> usable = points.Where((RoughPptAddin.Models.ChartPoint p) => ValueOf(p).HasValue).Take(36).ToList();
		if (!usable.Any())
		{
			warnings.Add("散点图缺少可用数值。");
			return;
		}
		List<double> ys = usable.Select((RoughPptAddin.Models.ChartPoint p) => ValueOf(p).GetValueOrDefault()).ToList();
		double minY = Math.Min(0.0, ys.Min());
		double maxY = Math.Max(ys.Max(), minY + 0.0001);
		List<double?> numericX = usable.Select(NumericXOf).ToList();
		bool useNumericX = numericX.All((double? num) => num.HasValue) && numericX.Select((double? num) => num.Value).Distinct().Count() > 1;
		double minX = (useNumericX ? numericX.Min((double? num) => num.Value) : 0.0);
		double maxX = (useNumericX ? numericX.Max((double? num) => num.Value) : ((double)Math.Max(1, usable.Count - 1)));
		if (!useNumericX)
		{
			warnings.Add("散点图缺少可区分的连续横轴字段，已按点序号排列。");
		}
		AddAxes(slide, shapes, left, top, width, height, style);
		AddAxisLabel(slide, shapes, maxY.ToString("0.###", CultureInfo.InvariantCulture), left - 48f, top - 8f, 44f, 16f, style);
		for (int i = 0; i < usable.Count; i++)
		{
			RoughPptAddin.Models.ChartPoint point = usable[i];
			double value = ValueOf(point).GetValueOrDefault();
			double xValue = (useNumericX ? numericX[i].Value : ((double)i));
			float x = left + (float)((xValue - minX) / (maxX - minX) * (double)Math.Max(1f, width));
			float y = top + height - (float)((value - minY) / (maxY - minY) * (double)Math.Max(1f, height));
			Microsoft.Office.Interop.PowerPoint.Shape marker = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeOval, x - 4f, y - 4f, 8f, 8f);
			StyleFilledShape(marker, style, LerpColor(feature.StartColor, feature.EndColor, (usable.Count <= 1) ? 0.0 : ((double)i / (double)(usable.Count - 1))));
			shapes.Add(marker);
			if (i == 0 || i == usable.Count - 1 || usable.Count <= 8)
			{
				AddAxisLabel(slide, shapes, ShortLabel(LabelFor(point, chartType), 12), x - 30f, Math.Max(top, y - 18f), 60f, 18f, style);
			}
		}
	}

	private static void RenderTable(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, ChartDataset dataset, float left, float top, float width, float height, RoughStyle style, FeatureBlockOptions feature, IList<string> warnings)
	{
		List<string> fields = ((dataset.Fields != null && dataset.Fields.Count > 0) ? dataset.Fields : new List<string> { "method", "metric", "value", "mean", "std" }).Where((string field) => !string.IsNullOrWhiteSpace(field)).Take(5).ToList();
		List<Dictionary<string, object>> rows = dataset.Rows ?? new List<Dictionary<string, object>>();
		if (!rows.Any())
		{
			rows = (dataset.Points ?? new List<RoughPptAddin.Models.ChartPoint>()).Take(8).Select(PointRow).ToList();
		}
		if (!rows.Any())
		{
			warnings.Add("表格缺少可显示行。");
			rows.Add(new Dictionary<string, object> { ["提示"] = "未识别到可绘图数据" });
			fields = new List<string> { "提示" };
		}
		int rowCount = Math.Min(rows.Count, 8) + 1;
		int colCount = Math.Max(1, fields.Count);
		float cellW = width / (float)colCount;
		float cellH = Math.Min(34f, height / (float)Math.Max(1, rowCount));
		for (int col = 0; col < colCount; col++)
		{
			AddCell(slide, shapes, left + (float)col * cellW, top, cellW, cellH, fields[col], header: true, style, feature, col, colCount);
		}
		for (int row = 0; row < rowCount - 1; row++)
		{
			Dictionary<string, object> data = rows[row];
			for (int col2 = 0; col2 < colCount; col2++)
			{
				data.TryGetValue(fields[col2], out var value);
				AddCell(slide, shapes, left + (float)col2 * cellW, top + (float)(row + 1) * cellH, cellW, cellH, Convert.ToString(value, CultureInfo.InvariantCulture), header: false, style, feature, col2, colCount);
			}
		}
	}

	private static void AddErrorBar(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, RoughPptAddin.Models.ChartPoint point, double value, double min, double max, float x, float top, float height, RoughStyle style)
	{
		double? error = point.Std ?? CiHalfWidth(point.Ci);
		if (error.HasValue && !(error.Value <= 0.0))
		{
			float yTop = top + height - (float)((value + error.Value - min) / (max - min) * (double)height);
			float yBottom = top + height - (float)((value - error.Value - min) / (max - min) * (double)height);
			yTop = Math.Max(top, Math.Min(top + height, yTop));
			yBottom = Math.Max(top, Math.Min(top + height, yBottom));
			Microsoft.Office.Interop.PowerPoint.Shape[] array = new Microsoft.Office.Interop.PowerPoint.Shape[3]
			{
				slide.Shapes.AddLine(x, yTop, x, yBottom),
				slide.Shapes.AddLine(x - 5f, yTop, x + 5f, yTop),
				slide.Shapes.AddLine(x - 5f, yBottom, x + 5f, yBottom)
			};
			foreach (Microsoft.Office.Interop.PowerPoint.Shape line in array)
			{
				StyleLine(line, style);
				shapes.Add(line);
			}
		}
	}

	private static void AddAxes(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, float left, float top, float width, float height, RoughStyle style)
	{
		Microsoft.Office.Interop.PowerPoint.Shape yAxis = slide.Shapes.AddLine(left, top, left, top + height);
		Microsoft.Office.Interop.PowerPoint.Shape xAxis = slide.Shapes.AddLine(left, top + height, left + width, top + height);
		StyleLine(yAxis, style);
		StyleLine(xAxis, style);
		shapes.Add(yAxis);
		shapes.Add(xAxis);
	}

	private static void AddTitle(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, string text, float left, float top, float width, RoughStyle style)
	{
		Microsoft.Office.Interop.PowerPoint.Shape title = slide.Shapes.AddTextbox(MsoTextOrientation.msoTextOrientationHorizontal, left, top, width, 34f);
		title.TextFrame.TextRange.Text = text;
		title.TextFrame.TextRange.Font.Size = 18f;
		title.TextFrame.TextRange.Font.Bold = MsoTriState.msoTrue;
		title.TextFrame.TextRange.Font.Color.RGB = ParseRgb(style.Stroke);
		title.Line.Visible = MsoTriState.msoFalse;
		title.Fill.Visible = MsoTriState.msoFalse;
		shapes.Add(title);
	}

	private static void AddAxisLabel(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, string text, float left, float top, float width, float height, RoughStyle style)
	{
		Microsoft.Office.Interop.PowerPoint.Shape label = slide.Shapes.AddTextbox(MsoTextOrientation.msoTextOrientationHorizontal, left, top, Math.Max(4f, width), Math.Max(4f, height));
		label.TextFrame.TextRange.Text = text ?? string.Empty;
		label.TextFrame.TextRange.Font.Size = 8f;
		label.TextFrame.TextRange.Font.Color.RGB = ParseRgb(style.Stroke);
		label.Line.Visible = MsoTriState.msoFalse;
		label.Fill.Visible = MsoTriState.msoFalse;
		shapes.Add(label);
	}

	private static void AddCell(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, float left, float top, float width, float height, string text, bool header, RoughStyle style, FeatureBlockOptions feature, int col, int colCount)
	{
		Microsoft.Office.Interop.PowerPoint.Shape rect = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, left, top, width, height);
		StyleFilledShape(rect, style, header ? LerpColor(feature.StartColor, feature.EndColor, (colCount <= 1) ? 0.0 : ((double)col / (double)(colCount - 1))) : "#FFFFFF");
		shapes.Add(rect);
		Microsoft.Office.Interop.PowerPoint.Shape label = slide.Shapes.AddTextbox(MsoTextOrientation.msoTextOrientationHorizontal, left + 3f, top + 4f, Math.Max(4f, width - 6f), Math.Max(4f, height - 8f));
		label.TextFrame.TextRange.Text = ShortLabel(text, 24);
		label.TextFrame.TextRange.Font.Size = 8f;
		label.TextFrame.TextRange.Font.Bold = (header ? MsoTriState.msoTrue : MsoTriState.msoFalse);
		label.TextFrame.TextRange.Font.Color.RGB = ParseRgb(style.Stroke);
		label.Line.Visible = MsoTriState.msoFalse;
		label.Fill.Visible = MsoTriState.msoFalse;
		shapes.Add(label);
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape GroupIfNeeded(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes)
	{
		if (shapes.Count == 0)
		{
			return null;
		}
		if (shapes.Count == 1)
		{
			return shapes[0];
		}
		string[] names = shapes.Select((Microsoft.Office.Interop.PowerPoint.Shape shape2) => shape2.Name).ToArray();
		Microsoft.Office.Interop.PowerPoint.Shape shape = slide.Shapes.Range(names).Group();
		shape.Name = "ZLK_Chart_" + Guid.NewGuid().ToString("N").Substring(0, 8);
		return shape;
	}

	private static IEnumerable<RoughPptAddin.Models.ChartPoint> UsablePoints(IEnumerable<RoughPptAddin.Models.ChartPoint> points)
	{
		return (points ?? Enumerable.Empty<RoughPptAddin.Models.ChartPoint>()).Where((RoughPptAddin.Models.ChartPoint point) => ValueOf(point).HasValue || !string.IsNullOrWhiteSpace(point.ErrorType)).ToList();
	}

	private static double? ValueOf(RoughPptAddin.Models.ChartPoint point)
	{
		if (point == null)
		{
			return null;
		}
		if (point.Y.HasValue)
		{
			return point.Y.Value;
		}
		if (point.Value.HasValue)
		{
			return point.Value.Value;
		}
		if (point.Mean.HasValue)
		{
			return point.Mean.Value;
		}
		if (!string.IsNullOrWhiteSpace(point.ErrorType))
		{
			return 1.0;
		}
		return null;
	}

	private static double? NumericXOf(RoughPptAddin.Models.ChartPoint point)
	{
		if (point == null || point.X == null)
		{
			return null;
		}
		if (double.TryParse(Convert.ToString(point.X, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && !double.IsNaN(value) && !double.IsInfinity(value))
		{
			return value;
		}
		return null;
	}

	private static string LabelFor(RoughPptAddin.Models.ChartPoint point, string chartType)
	{
		if (point == null)
		{
			return string.Empty;
		}
		if (chartType == "subgroupComparison" && !string.IsNullOrWhiteSpace(point.Subgroup))
		{
			return point.Subgroup;
		}
		if (chartType == "errorTypeSummary" && !string.IsNullOrWhiteSpace(point.ErrorType))
		{
			return point.ErrorType;
		}
		if ((chartType == "sensitivityCurve" || chartType == "caseLevelDistribution") && point.X != null)
		{
			return Convert.ToString(point.X, CultureInfo.InvariantCulture);
		}
		return point.Method ?? point.Label ?? point.Metric ?? string.Empty;
	}

	private static Dictionary<string, object> PointRow(RoughPptAddin.Models.ChartPoint point)
	{
		return new Dictionary<string, object>
		{
			["method"] = point.Method ?? string.Empty,
			["metric"] = point.Metric ?? string.Empty,
			["value"] = ValueOf(point)?.ToString("0.####", CultureInfo.InvariantCulture) ?? string.Empty,
			["dataset"] = point.Dataset ?? string.Empty,
			["subgroup"] = point.Subgroup ?? point.ErrorType ?? string.Empty
		};
	}

	private static string ChartTitle(ChartDataset dataset, string chartType)
	{
		string source = dataset?.Source?.Path;
		return (string.IsNullOrWhiteSpace(source) ? "SimpleExperiment 实验结果" : (source.Split('/', '\\').LastOrDefault() ?? source)) + " · " + ChartTypeLabel(chartType);
	}

	private static string ChartTypeLabel(string chartType)
	{
		return chartType switch
		{
			"meanStdErrorBar" => "均值误差图", 
			"leaderboardBar" => "排行榜柱状图", 
			"sensitivityCurve" => "敏感性曲线", 
			"scatterPlot" => "散点对比图", 
			"subgroupComparison" => "亚组对比", 
			"caseLevelDistribution" => "病例级分布", 
			"errorTypeSummary" => "错误类型汇总", 
			_ => "结果表格", 
		};
	}

	private static string NormalizeChartType(string chartType)
	{
		switch ((chartType ?? string.Empty).Trim())
		{
		case "errorTypeSummary":
		case "sensitivityCurve":
		case "meanStdErrorBar":
		case "leaderboardBar":
		case "scatterPlot":
		case "subgroupComparison":
		case "caseLevelDistribution":
		case "genericTable":
			return chartType.Trim();
		case "significanceSummary":
			return "meanStdErrorBar";
		default:
			return "genericTable";
		}
	}

	private static double? CiHalfWidth(object ci)
	{
		if (!(ci is IEnumerable list))
		{
			return null;
		}
		List<double> values = new List<double>();
		foreach (object item in list)
		{
			if (double.TryParse(Convert.ToString(item, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
			{
				values.Add(parsed);
			}
		}
		if (values.Count < 2)
		{
			return null;
		}
		return Math.Abs(values[1] - values[0]) / 2.0;
	}

	private static void StyleFilledShape(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style, string fill)
	{
		shape.Line.Visible = MsoTriState.msoTrue;
		shape.Line.ForeColor.RGB = ParseRgb(style.Stroke);
		shape.Line.Weight = Math.Max(0.5f, style.StrokeWidthPt);
		shape.Fill.Visible = MsoTriState.msoTrue;
		shape.Fill.ForeColor.RGB = ParseRgb(fill);
		shape.Fill.Transparency = 0f;
	}

	private static void StyleLine(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		shape.Line.Visible = MsoTriState.msoTrue;
		shape.Line.ForeColor.RGB = ParseRgb(style.Stroke);
		shape.Line.Weight = Math.Max(0.5f, style.StrokeWidthPt);
	}

	private static string ShortLabel(string value, int max)
	{
		value = value ?? string.Empty;
		if (value.Length > max)
		{
			return value.Substring(0, Math.Max(1, max - 1)) + "…";
		}
		return value;
	}

	private static string LerpColor(string left, string right, double amount)
	{
		int[] a = ParseHex(left, "#DDEBFF");
		int[] b = ParseHex(right, "#A8C7FA");
		amount = Math.Max(0.0, Math.Min(1.0, amount));
		int r = (int)Math.Round((double)a[0] + (double)(b[0] - a[0]) * amount);
		int g = (int)Math.Round((double)a[1] + (double)(b[1] - a[1]) * amount);
		int bl = (int)Math.Round((double)a[2] + (double)(b[2] - a[2]) * amount);
		return "#" + r.ToString("X2") + g.ToString("X2") + bl.ToString("X2");
	}

	private static int[] ParseHex(string value, string fallback)
	{
		value = NormalizeHex(value, fallback).TrimStart('#');
		return new int[3]
		{
			int.Parse(value.Substring(0, 2), NumberStyles.HexNumber),
			int.Parse(value.Substring(2, 2), NumberStyles.HexNumber),
			int.Parse(value.Substring(4, 2), NumberStyles.HexNumber)
		};
	}

	private static string NormalizeHex(string value, string fallback)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			value = fallback;
		}
		value = value.Trim();
		if (!value.StartsWith("#", StringComparison.Ordinal))
		{
			value = "#" + value;
		}
		if (!Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$"))
		{
			return fallback;
		}
		return value;
	}

	private static int ParseRgb(string hex)
	{
		string text = NormalizeHex(hex, "#111111").TrimStart('#');
		int r = int.Parse(text.Substring(0, 2), NumberStyles.HexNumber);
		int g = int.Parse(text.Substring(2, 2), NumberStyles.HexNumber);
		int b = int.Parse(text.Substring(4, 2), NumberStyles.HexNumber);
		return r + (g << 8) + (b << 16);
	}
}
