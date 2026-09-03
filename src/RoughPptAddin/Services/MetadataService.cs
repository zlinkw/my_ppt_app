using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class MetadataService
{
	public const string Prefix = "PPT_ROUGH_";

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 4194304
	};

	public void Write(Shape shape, RoughShapeRequest request)
	{
		if (string.IsNullOrWhiteSpace(request.GroupId))
		{
			request.GroupId = Guid.NewGuid().ToString("N");
		}
		shape.Tags.Add("PPT_ROUGH_ASSET_ID", Safe(request.AssetId));
		shape.Tags.Add("PPT_ROUGH_GROUP_ID", Safe(request.GroupId));
		shape.Tags.Add("PPT_ROUGH_NATIVE_CARRIER_ID", Safe(request.NativeCarrierId));
		shape.Tags.Add("PPT_ROUGH_INNER_FILL_CARRIER_ID", Safe(request.InnerFillCarrierId));
		shape.Tags.Add("PPT_ROUGH_INNER_BOUNDARY_ID", Safe(request.InnerBoundaryId));
		shape.Tags.Add("PPT_ROUGH_OUTER_JITTER_IDS", serializer.Serialize(request.OuterJitterIds ?? new List<string>()));
		shape.Tags.Add("PPT_ROUGH_SOURCE_MSO_TYPE", Safe(request.SourceMsoType));
		shape.Tags.Add("PPT_ROUGH_SHAPE_KIND", Safe(request.ShapeKind));
		shape.Tags.Add("PPT_ROUGH_PARAMS", serializer.Serialize(request.Style));
		shape.Tags.Add("PPT_ROUGH_BOUNDS", $"{request.Left},{request.Top},{request.Width},{request.Height}");
		shape.Tags.Add("PPT_ROUGH_ADJUSTMENTS", serializer.Serialize(request.Adjustments ?? new List<float>()));
		shape.Tags.Add("PPT_ROUGH_STYLE_VERSION", request.StyleVersion.ToString(CultureInfo.InvariantCulture));
		shape.Tags.Add("PPT_ROUGH_GEOMETRY_VERSION", request.GeometryVersion.ToString(CultureInfo.InvariantCulture));
		shape.Tags.Add("PPT_ROUGH_ENGINE_VERSION", "rough-js-live-0.1.0");
	}

	public void WriteRole(Shape shape, string role)
	{
		shape?.Tags.Add("PPT_ROUGH_OVERLAY_ROLE", role ?? string.Empty);
	}

	public string ReadRole(Shape shape)
	{
		if (shape == null)
		{
			return string.Empty;
		}
		return shape.Tags["PPT_ROUGH_OVERLAY_ROLE"] ?? string.Empty;
	}

	public bool TryRead(Shape shape, out RoughShapeRequest request)
	{
		request = null;
		if (shape == null)
		{
			return false;
		}
		string assetId = shape.Tags["PPT_ROUGH_ASSET_ID"];
		if (string.IsNullOrEmpty(assetId))
		{
			return false;
		}
		(shape.Tags["PPT_ROUGH_BOUNDS"] ?? string.Empty).Split(',');
		request = new RoughShapeRequest
		{
			AssetId = assetId,
			GroupId = shape.Tags["PPT_ROUGH_GROUP_ID"],
			NativeCarrierId = shape.Tags["PPT_ROUGH_NATIVE_CARRIER_ID"],
			InnerFillCarrierId = shape.Tags["PPT_ROUGH_INNER_FILL_CARRIER_ID"],
			InnerBoundaryId = shape.Tags["PPT_ROUGH_INNER_BOUNDARY_ID"],
			OuterJitterIds = ReadJsonList<string>(shape.Tags["PPT_ROUGH_OUTER_JITTER_IDS"]),
			SourceMsoType = shape.Tags["PPT_ROUGH_SOURCE_MSO_TYPE"],
			ShapeKind = shape.Tags["PPT_ROUGH_SHAPE_KIND"],
			Left = shape.Left,
			Top = shape.Top,
			Width = shape.Width,
			Height = shape.Height
		};
		string styleJson = shape.Tags["PPT_ROUGH_PARAMS"];
		if (!string.IsNullOrEmpty(styleJson))
		{
			request.Style = serializer.Deserialize<RoughStyle>(styleJson);
		}
		request.Adjustments = ReadJsonList<float>(shape.Tags["PPT_ROUGH_ADJUSTMENTS"]);
		request.StyleVersion = ReadInt(shape.Tags["PPT_ROUGH_STYLE_VERSION"], 1);
		request.GeometryVersion = ReadInt(shape.Tags["PPT_ROUGH_GEOMETRY_VERSION"], 1);
		return true;
	}

    	public string BuildInspectionReport(Selection selection)
    	{
    		StringBuilder builder = new StringBuilder();
    		int count;
    		try
    		{
    			if (selection == null || selection.ShapeRange == null || selection.ShapeRange.Count == 0)
    			{
    				return "未选择形状。";
    			}
    			count = selection.ShapeRange.Count;
    		}
    		catch (Exception)
    		{
    			return "当前没有可读取的形状选区。";
    		}
    		for (int i = 1; i <= count; i++)
    		{
    			try
    			{
    				Shape shape = selection.ShapeRange[i];
    				string name;
    				string type;
    				try { name = shape.Name; } catch { name = "（无法读取名称）"; }
    				try { type = Convert.ToString(shape.Type); } catch { type = "（无法读取类型）"; }
    				builder.AppendLine("名称：" + name);
    				builder.AppendLine("类型：" + type);
    				builder.AppendLine("Rough 素材：" + SafeTag(shape, "PPT_ROUGH_ASSET_ID"));
    				builder.AppendLine("Rough 组：" + SafeTag(shape, "PPT_ROUGH_GROUP_ID"));
    				builder.AppendLine("图层角色：" + SafeTag(shape, "PPT_ROUGH_OVERLAY_ROLE"));
    				builder.AppendLine("PPT 源形状：" + SafeTag(shape, "PPT_ROUGH_SOURCE_MSO_TYPE"));
    				builder.AppendLine("生成引擎：" + SafeTag(shape, "PPT_ROUGH_ENGINE_VERSION"));
    			}
    			catch (Exception ex)
    			{
    				builder.AppendLine("第 " + i + " 个形状读取失败：" + ex.Message);
    			}
    		}
    		return builder.ToString();
    	}
    
    	private static string SafeTag(Shape shape, string key)
    	{
    		try
    		{
    			return shape.Tags[key] ?? string.Empty;
    		}
    		catch
    		{
    			return string.Empty;
    		}
    	}

	private List<T> ReadJsonList<T>(string json)
	{
		if (string.IsNullOrWhiteSpace(json))
		{
			return new List<T>();
		}
		try
		{
			return serializer.Deserialize<List<T>>(json) ?? new List<T>();
		}
		catch
		{
			return new List<T>();
		}
	}

	private static int ReadInt(string value, int fallback)
	{
		if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
		{
			return parsed;
		}
		return fallback;
	}

	private static string Safe(string value)
	{
		return value ?? string.Empty;
	}
}
