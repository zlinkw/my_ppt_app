using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;
using System;

namespace RoughPptAddin.Services
{
    public sealed class FeatureBlockInserter
    {
    	private struct RoundedCorner(PointF before, PointF corner, PointF after, bool rounded)
    	{
    		public PointF Before { get; } = before;
    
    		public PointF Corner { get; } = corner;
    
    		public PointF After { get; } = after;
    
    		public bool Rounded { get; } = rounded;
    	}
    
    	private struct PointF(float x, float y)
    	{
    		public float X { get; } = x;
    
    		public float Y { get; } = y;
    	}
    
    	private struct ColorParts(int r, int g, int b)
    	{
    		public int R { get; } = r;
    
    		public int G { get; } = g;
    
    		public int B { get; } = b;
    	}
    
    	public const string FeatureBlockTag = "ROUGH_FEATURE_BLOCK";
    
    	public const string FeatureBlockOptionsTag = "ROUGH_FEATURE_BLOCK_OPTIONS";
    
    	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
    
    	public Microsoft.Office.Interop.PowerPoint.Shape Insert(Slide slide, FeatureBlockOptions options)
    	{
    		return Insert(slide, options, null, null);
    	}
    
    	public Microsoft.Office.Interop.PowerPoint.Shape Insert(Slide slide, FeatureBlockOptions options, float? left, float? top)
    	{
    		if (slide == null)
    		{
    			throw new InvalidOperationException("当前没有可用幻灯片。");
    		}
    		options = Normalize(options);
    		IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes = (string.Equals(options.Mode, "2d", StringComparison.OrdinalIgnoreCase) ? Insert2D(slide, options, left, top) : Insert3D(slide, options, left, top));
    		if (shapes.Count == 0)
    		{
    			throw new InvalidOperationException("特征块没有生成任何 PPT 原生对象。");
    		}
    		string[] names = new string[shapes.Count];
    		for (int i = 0; i < shapes.Count; i++)
    		{
    			names[i] = shapes[i].Name;
    		}
    		Microsoft.Office.Interop.PowerPoint.Shape shape = slide.Shapes.Range(names).Group();
    		shape.Name = "Rough_FeatureBlock_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    		shape.Tags.Add("ROUGH_FEATURE_BLOCK", "1");
    		shape.Tags.Add("ROUGH_FEATURE_BLOCK_OPTIONS", SerializeOptions(options));
    		shape.Select();
    		return shape;
    	}
    
    	public Microsoft.Office.Interop.PowerPoint.Shape Replace(Slide slide, Microsoft.Office.Interop.PowerPoint.Shape existingGroup, FeatureBlockOptions options)
    	{
    		if (existingGroup == null)
    		{
    			throw new InvalidOperationException("请先选择一个特征块。");
    		}
    		if (slide == null)
    		{
    			throw new InvalidOperationException("无法读取当前特征块所在幻灯片。");
    		}
    		TryReadOptions(existingGroup, out var previous);
    		options = Normalize(options);
    		float left = existingGroup.Left;
    		float top = GroupTopToOriginTop(existingGroup.Top, previous ?? options);
    		ApplyDirectionalAnchor(previous ?? options, options, ref left, ref top);
    		options.EditDirection = string.Empty;
    		options.EditDelta = 0;
    		existingGroup.Delete();
    		return Insert(slide, options, left, top);
    	}
    
    	public bool IsFeatureBlock(Microsoft.Office.Interop.PowerPoint.Shape shape)
    	{
    		try
    		{
    			return string.Equals(shape?.Tags["ROUGH_FEATURE_BLOCK"], "1", StringComparison.OrdinalIgnoreCase);
    		}
    		catch
    		{
    			return false;
    		}
    	}
    
    	public bool TryReadOptions(Microsoft.Office.Interop.PowerPoint.Shape shape, out FeatureBlockOptions options)
    	{
    		options = null;
    		if (!IsFeatureBlock(shape))
    		{
    			return false;
    		}
    		try
    		{
    			options = DeserializeOptions(shape.Tags["ROUGH_FEATURE_BLOCK_OPTIONS"]);
    			return options != null;
    		}
    		catch
    		{
    			options = new FeatureBlockOptions();
    			return true;
    		}
    	}
    
    	private static IList<Microsoft.Office.Interop.PowerPoint.Shape> Insert2D(Slide slide, FeatureBlockOptions options, float? left, float? top)
    	{
    		List<Microsoft.Office.Interop.PowerPoint.Shape> shapes = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
    		PointF origin = ((left.HasValue && top.HasValue) ? P(left.Value, top.Value) : CenterOrigin(slide, options, is3D: false));
    		bool rough = IsRoughVisual(options);
    		if (rough && options.GapPt <= 0.001f)
    		{
    			Insert2DRoughSharedGrid(slide, shapes, options, origin.X, origin.Y);
    			return shapes;
    		}
    		for (int y = 0; y < options.CountY; y++)
    		{
    			for (int x = 0; x < options.CountX; x++)
    			{
    				float cellLeft = origin.X + (float)x * (options.BlockWidthPt + options.GapPt);
    				float cellTop = origin.Y + (float)y * (options.BlockHeightPt + options.GapPt);
    				Microsoft.Office.Interop.PowerPoint.Shape shape = (rough ? AddRoughRectangle(slide, cellLeft, cellTop, options.BlockWidthPt, options.BlockHeightPt, options.Roundness, x, y) : slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRoundedRectangle, cellLeft, cellTop, options.BlockWidthPt, options.BlockHeightPt));
    				shape.Name = (rough ? "Rough_Feature2DRough_" : "Rough_Feature2DCell_") + Guid.NewGuid().ToString("N").Substring(0, 8);
    				ApplyShapeStyle(shape, InterpolateColor(options, x, y, 0), options, 1f);
    				if (!rough)
    				{
    					TrySetRoundness(shape, options.Roundness);
    				}
    				shapes.Add(shape);
    			}
    		}
    		return shapes;
    	}
    
    	private static IList<Microsoft.Office.Interop.PowerPoint.Shape> Insert3D(Slide slide, FeatureBlockOptions options, float? left, float? top)
    	{
    		List<Microsoft.Office.Interop.PowerPoint.Shape> shapes = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
    		PointF origin = ((left.HasValue && top.HasValue) ? P(left.Value, top.Value) : CenterOrigin(slide, options, is3D: true));
    		if (options.GapPt <= 0.001f)
    		{
    			Insert3DShell(slide, shapes, options, origin.X, origin.Y);
    			return shapes;
    		}
    		for (int z = options.CountZ - 1; z >= 0; z--)
    		{
    			for (int y = 0; y < options.CountY; y++)
    			{
    				for (int x = 0; x < options.CountX; x++)
    				{
    					InsertCube(slide, shapes, options, origin.X, origin.Y, x, y, z);
    				}
    			}
    		}
    		return shapes;
    	}
    
    	private static void Insert3DShell(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, FeatureBlockOptions options, float originX, float originY)
    	{
    		int maxX = options.CountX - 1;
    		int maxY = options.CountY - 1;
    		int maxZ = options.CountZ - 1;
    		for (int z = maxZ; z >= 0; z--)
    		{
    			for (int x = 0; x < options.CountX; x++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape face = AddTopFace(slide, options, originX, originY, x, 0, z, new bool[4]
    				{
    					false,
    					x == 0 && z == maxZ,
    					x == maxX && z == maxZ,
    					false
    				});
    				shapes.Add(face);
    			}
    		}
    		for (int z2 = maxZ; z2 >= 0; z2--)
    		{
    			for (int y = 0; y < options.CountY; y++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape face2 = AddSideFace(slide, options, originX, originY, maxX, y, z2, new bool[4]
    				{
    					false,
    					y == 0 && z2 == maxZ,
    					y == maxY && z2 == maxZ,
    					false
    				});
    				shapes.Add(face2);
    			}
    		}
    		for (int i = 0; i < options.CountY; i++)
    		{
    			for (int j = 0; j < options.CountX; j++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape face3 = AddFrontFace(slide, options, originX, originY, j, i, 0, new bool[4]
    				{
    					j == 0 && i == 0,
    					j == maxX && i == 0,
    					j == maxX && i == maxY,
    					j == 0 && i == maxY
    				});
    				shapes.Add(face3);
    			}
    		}
    	}
    
    	private static void InsertCube(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, FeatureBlockOptions options, float originX, float originY, int x, int y, int z)
    	{
    		shapes.Add(AddTopFace(slide, options, originX, originY, x, y, z, new bool[4] { false, true, true, false }));
    		shapes.Add(AddSideFace(slide, options, originX, originY, x, y, z, new bool[4] { false, true, true, false }));
    		shapes.Add(AddFrontFace(slide, options, originX, originY, x, y, z, null));
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddTopFace(Slide slide, FeatureBlockOptions options, float originX, float originY, int x, int y, int z, bool[] roundedCorners)
    	{
    		float w = options.BlockWidthPt;
    		float blockDepthPt = options.BlockDepthPt;
    		float dx = blockDepthPt * 0.58f;
    		float dy = blockDepthPt * 0.42f;
    		PointF p = CubeOrigin(options, originX, originY, x, y, z);
    		int color = InterpolateColor(options, x, y, z);
    		Microsoft.Office.Interop.PowerPoint.Shape shape = AddFace(slide, new PointF[4]
    		{
    			P(p.X, p.Y),
    			P(p.X + dx, p.Y - dy),
    			P(p.X + dx + w, p.Y - dy),
    			P(p.X + w, p.Y)
    		}, options.Roundness, roundedCorners);
    		shape.Name = "Rough_Feature3DTop_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    		ApplyShapeStyle(shape, Lighten(color, 0.22), options, 0.9f);
    		return shape;
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddSideFace(Slide slide, FeatureBlockOptions options, float originX, float originY, int x, int y, int z, bool[] roundedCorners)
    	{
    		float w = options.BlockWidthPt;
    		float h = options.BlockHeightPt;
    		float blockDepthPt = options.BlockDepthPt;
    		float dx = blockDepthPt * 0.58f;
    		float dy = blockDepthPt * 0.42f;
    		PointF p = CubeOrigin(options, originX, originY, x, y, z);
    		int color = InterpolateColor(options, x, y, z);
    		Microsoft.Office.Interop.PowerPoint.Shape shape = AddFace(slide, new PointF[4]
    		{
    			P(p.X + w, p.Y),
    			P(p.X + dx + w, p.Y - dy),
    			P(p.X + dx + w, p.Y - dy + h),
    			P(p.X + w, p.Y + h)
    		}, options.Roundness, roundedCorners);
    		shape.Name = "Rough_Feature3DSide_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    		ApplyShapeStyle(shape, Darken(color, 0.12), options, 0.95f);
    		return shape;
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddFrontFace(Slide slide, FeatureBlockOptions options, float originX, float originY, int x, int y, int z, bool[] roundedCorners)
    	{
    		float w = options.BlockWidthPt;
    		float h = options.BlockHeightPt;
    		PointF p = CubeOrigin(options, originX, originY, x, y, z);
    		int color = InterpolateColor(options, x, y, z);
    		Microsoft.Office.Interop.PowerPoint.Shape frontFace;
    		if (roundedCorners == null)
    		{
    			frontFace = slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRoundedRectangle, p.X, p.Y, w, h);
    			TrySetRoundness(frontFace, options.Roundness);
    		}
    		else
    		{
    			frontFace = AddFace(slide, new PointF[4]
    			{
    				P(p.X, p.Y),
    				P(p.X + w, p.Y),
    				P(p.X + w, p.Y + h),
    				P(p.X, p.Y + h)
    			}, options.Roundness, roundedCorners);
    		}
    		frontFace.Name = "Rough_Feature3DFront_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    		ApplyShapeStyle(frontFace, color, options, 1f);
    		return frontFace;
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddFace(Slide slide, PointF[] points, float roundness)
    	{
    		return AddFace(slide, points, roundness, null);
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddFace(Slide slide, PointF[] points, float roundness, bool[] roundedCorners)
    	{
    		if (!(roundness <= 0.001f))
    		{
    			return AddRoundedPolygon(slide, points, roundness, roundedCorners);
    		}
    		return AddPolygon(slide, points);
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddRoughRectangle(Slide slide, float left, float top, float width, float height, float roundness, int x, int y)
    	{
    		return AddPolygon(slide, RoughRectanglePoints(left, top, width, height, roundness, x, y).ToArray());
    	}
    
    	private static void Insert2DRoughSharedGrid(Slide slide, IList<Microsoft.Office.Interop.PowerPoint.Shape> shapes, FeatureBlockOptions options, float originX, float originY)
    	{
    		List<PointF>[,] verticalEdges = new List<PointF>[options.CountX + 1, options.CountY];
    		List<PointF>[,] horizontalEdges = new List<PointF>[options.CountY + 1, options.CountX];
    		for (int x = 0; x <= options.CountX; x++)
    		{
    			for (int y = 0; y < options.CountY; y++)
    			{
    				float px = originX + (float)x * options.BlockWidthPt;
    				float top = originY + (float)y * options.BlockHeightPt;
    				verticalEdges[x, y] = RoughStrokePoints(P(px, top), P(px, top + options.BlockHeightPt), 1f, 0f, ((x + 1) * 73856093) ^ ((y + 1) * 19349663) ^ 0x35A7);
    			}
    		}
    		for (int i = 0; i <= options.CountY; i++)
    		{
    			for (int j = 0; j < options.CountX; j++)
    			{
    				float py = originY + (float)i * options.BlockHeightPt;
    				float left = originX + (float)j * options.BlockWidthPt;
    				horizontalEdges[i, j] = RoughStrokePoints(P(left, py), P(left + options.BlockWidthPt, py), 0f, 1f, ((j + 1) * 83492791) ^ ((i + 1) * 297121507) ^ 0x51C3);
    			}
    		}
    		for (int k = 0; k < options.CountY; k++)
    		{
    			for (int l = 0; l < options.CountX; l++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape fill = AddPolygon(slide, CellBoundaryPoints(horizontalEdges[k, l], verticalEdges[l + 1, k], horizontalEdges[k + 1, l], verticalEdges[l, k]).ToArray());
    				fill.Name = "Rough_Feature2DRoughFill_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    				ApplyShapeStyle(fill, InterpolateColor(options, l, k, 0), options, 1f);
    				fill.Line.Visible = MsoTriState.msoFalse;
    				shapes.Add(fill);
    			}
    		}
    		for (int m = 0; m <= options.CountX; m++)
    		{
    			for (int n = 0; n < options.CountY; n++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape edge = AddOpenPolyline(slide, verticalEdges[m, n].ToArray());
    				edge.Name = "Rough_Feature2DRoughEdge_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    				ApplyLineStyle(edge, options, 1f);
    				shapes.Add(edge);
    			}
    		}
    		for (int num = 0; num <= options.CountY; num++)
    		{
    			for (int num2 = 0; num2 < options.CountX; num2++)
    			{
    				Microsoft.Office.Interop.PowerPoint.Shape edge2 = AddOpenPolyline(slide, horizontalEdges[num, num2].ToArray());
    				edge2.Name = "Rough_Feature2DRoughEdge_" + Guid.NewGuid().ToString("N").Substring(0, 8);
    				ApplyLineStyle(edge2, options, 1f);
    				shapes.Add(edge2);
    			}
    		}
    	}
    
    	private static List<PointF> CellBoundaryPoints(List<PointF> top, List<PointF> right, List<PointF> bottom, List<PointF> left)
    	{
    		List<PointF> list = new List<PointF>();
    		AppendPoints(list, top, skipFirst: false);
    		AppendPoints(list, right, skipFirst: true);
    		AppendPoints(list, Reversed(bottom), skipFirst: true);
    		AppendPoints(list, Reversed(left), skipFirst: true);
    		return list;
    	}
    
    	private static void AppendPoints(List<PointF> target, IList<PointF> source, bool skipFirst)
    	{
    		if (source != null)
    		{
    			for (int i = (skipFirst ? 1 : 0); i < source.Count; i++)
    			{
    				target.Add(source[i]);
    			}
    		}
    	}
    
    	private static List<PointF> Reversed(IList<PointF> source)
    	{
    		List<PointF> result = new List<PointF>();
    		if (source == null)
    		{
    			return result;
    		}
    		for (int i = source.Count - 1; i >= 0; i--)
    		{
    			result.Add(source[i]);
    		}
    		return result;
    	}
    
    	private static List<PointF> RoughRectanglePoints(float left, float top, float width, float height, float roundness, int x, int y)
    	{
    		List<PointF> points = new List<PointF>();
    		float right = left + width;
    		float bottom = top + height;
    		float radius = Math.Min(width, height) * Clamp(roundness, 0f, 0.45f);
    		int seed = ((x + 1) * 73856093) ^ ((y + 1) * 19349663);
    		if (radius <= 0.001f)
    		{
    			AddRoughSegment(points, P(left, top), P(right, top), 0f, -1f, seed, 0, includeStart: true);
    			AddRoughSegment(points, P(right, top), P(right, bottom), 1f, 0f, seed, 11, includeStart: false);
    			AddRoughSegment(points, P(right, bottom), P(left, bottom), 0f, 1f, seed, 23, includeStart: false);
    			AddRoughSegment(points, P(left, bottom), P(left, top), -1f, 0f, seed, 37, includeStart: false);
    			return points;
    		}
    		AddRoughSegment(points, P(left + radius, top), P(right - radius, top), 0f, -1f, seed, 0, includeStart: true);
    		AddRoughArc(points, P(right - radius, top + radius), radius, -Math.PI / 2.0, 0.0, seed, 11);
    		AddRoughSegment(points, P(right, top + radius), P(right, bottom - radius), 1f, 0f, seed, 23, includeStart: false);
    		AddRoughArc(points, P(right - radius, bottom - radius), radius, 0.0, Math.PI / 2.0, seed, 37);
    		AddRoughSegment(points, P(right - radius, bottom), P(left + radius, bottom), 0f, 1f, seed, 41, includeStart: false);
    		AddRoughArc(points, P(left + radius, bottom - radius), radius, Math.PI / 2.0, Math.PI, seed, 53);
    		AddRoughSegment(points, P(left, bottom - radius), P(left, top + radius), -1f, 0f, seed, 61, includeStart: false);
    		AddRoughArc(points, P(left + radius, top + radius), radius, Math.PI, 4.71238898038469, seed, 71);
    		return points;
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddRoughStroke(Slide slide, PointF start, PointF end, float normalX, float normalY, int seed)
    	{
    		return AddOpenPolyline(slide, RoughStrokePoints(start, end, normalX, normalY, seed).ToArray());
    	}
    
    	private static List<PointF> RoughStrokePoints(PointF start, PointF end, float normalX, float normalY, int seed)
    	{
    		List<PointF> points = new List<PointF> { start };
    		for (int i = 1; i < 5; i++)
    		{
    			float t = (float)i / 5f;
    			float x = start.X + (end.X - start.X) * t;
    			float y = start.Y + (end.Y - start.Y) * t;
    			float jitter = Noise(seed, i) * 0.95f;
    			points.Add(P(x + normalX * jitter, y + normalY * jitter));
    		}
    		points.Add(end);
    		return points;
    	}
    
    	private static void AddRoughSegment(List<PointF> points, PointF start, PointF end, float normalX, float normalY, int seed, int salt, bool includeStart)
    	{
    		if (includeStart)
    		{
    			points.Add(start);
    		}
    		for (int i = 1; i <= 5; i++)
    		{
    			float t = (float)i / 5f;
    			float x = start.X + (end.X - start.X) * t;
    			float y = start.Y + (end.Y - start.Y) * t;
    			float jitter = Noise(seed, salt + i) * 1.15f;
    			if (i == 5)
    			{
    				jitter *= 0.35f;
    			}
    			points.Add(P(x + normalX * jitter, y + normalY * jitter));
    		}
    	}
    
    	private static void AddRoughArc(List<PointF> points, PointF center, float radius, double start, double stop, int seed, int salt)
    	{
    		for (int i = 1; i <= 5; i++)
    		{
    			double t = (double)i / 5.0;
    			double angle = start + (stop - start) * t;
    			float jitter = Noise(seed, salt + i) * 0.75f;
    			float r = radius + jitter;
    			points.Add(P(center.X + (float)(Math.Cos(angle) * (double)r), center.Y + (float)(Math.Sin(angle) * (double)r)));
    		}
    	}
    
    	private static float Noise(int seed, int salt)
    	{
    		int value = seed;
    		value ^= salt * 374761393;
    		value = (value << 13) ^ value;
    		int n = value * (value * value * 15731 + 789221) + 1376312589;
    		return 1f - (float)(n & 0x7FFFFFFF) / 1.0737418E+09f;
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddPolygon(Slide slide, PointF[] points)
    	{
    		Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder = slide.Shapes.BuildFreeform(MsoEditingType.msoEditingCorner, points[0].X, points[0].Y);
    		for (int i = 1; i < points.Length; i++)
    		{
    			builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingCorner, points[i].X, points[i].Y);
    		}
    		builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingCorner, points[0].X, points[0].Y);
    		return builder.ConvertToShape();
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddOpenPolyline(Slide slide, PointF[] points)
    	{
    		Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder = slide.Shapes.BuildFreeform(MsoEditingType.msoEditingCorner, points[0].X, points[0].Y);
    		for (int i = 1; i < points.Length; i++)
    		{
    			builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingCorner, points[i].X, points[i].Y);
    		}
    		return builder.ConvertToShape();
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddRoundedPolygon(Slide slide, PointF[] points, float roundness)
    	{
    		return AddRoundedPolygon(slide, points, roundness, null);
    	}
    
    	private static Microsoft.Office.Interop.PowerPoint.Shape AddRoundedPolygon(Slide slide, PointF[] points, float roundness, bool[] roundedCorners)
    	{
    		if (points == null || points.Length < 3)
    		{
    			return AddPolygon(slide, points);
    		}
    		roundness = Math.Max(0f, Math.Min(0.45f, roundness));
    		RoundedCorner[] corners = new RoundedCorner[points.Length];
    		bool hasRoundedCorner = false;
    		for (int i = 0; i < points.Length; i++)
    		{
    			PointF previous = points[(i - 1 + points.Length) % points.Length];
    			PointF current = points[i];
    			PointF next = points[(i + 1) % points.Length];
    			bool num = roundedCorners == null || i >= roundedCorners.Length || roundedCorners[i];
    			float offset = Math.Min(Distance(previous, current), Distance(current, next)) * roundness;
    			if (!num || offset < 0.5f)
    			{
    				corners[i] = new RoundedCorner(current, current, current, rounded: false);
    				continue;
    			}
    			hasRoundedCorner = true;
    			corners[i] = new RoundedCorner(MoveTowards(current, previous, offset), current, MoveTowards(current, next, offset), rounded: true);
    		}
    		if (!hasRoundedCorner)
    		{
    			return AddPolygon(slide, points);
    		}
    		PointF first = (corners[0].Rounded ? corners[0].After : corners[0].Corner);
    		Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder = slide.Shapes.BuildFreeform(MsoEditingType.msoEditingAuto, first.X, first.Y);
    		for (int j = 1; j < corners.Length; j++)
    		{
    			if (corners[j].Rounded)
    			{
    				AddLineNode(builder, corners[j].Before);
    				AddCurveNode(builder, corners[j].Corner, corners[j].After);
    			}
    			else
    			{
    				AddLineNode(builder, corners[j].Corner);
    			}
    		}
    		if (corners[0].Rounded)
    		{
    			AddLineNode(builder, corners[0].Before);
    			AddCurveNode(builder, corners[0].Corner, corners[0].After);
    		}
    		else
    		{
    			AddLineNode(builder, corners[0].Corner);
    		}
    		return builder.ConvertToShape();
    	}
    
    	private static void AddLineNode(Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder, PointF point)
    	{
    		builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, point.X, point.Y);
    	}
    
    	private static void AddCurveNode(Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder, PointF control, PointF end)
    	{
    		builder.AddNodes(MsoSegmentType.msoSegmentCurve, MsoEditingType.msoEditingAuto, control.X, control.Y, control.X, control.Y, end.X, end.Y);
    	}
    
    	private static void ApplyShapeStyle(Microsoft.Office.Interop.PowerPoint.Shape shape, int fillRgb, FeatureBlockOptions options, float lineFactor)
    	{
    		shape.Fill.Visible = MsoTriState.msoTrue;
    		shape.Fill.ForeColor.RGB = fillRgb;
    		shape.Fill.Transparency = 0f;
    		shape.Line.Visible = MsoTriState.msoTrue;
    		shape.Line.ForeColor.RGB = ParseRgb(options.StrokeColor);
    		shape.Line.Weight = Math.Max(0.25f, options.StrokeWidthPt * lineFactor);
    		shape.Line.DashStyle = MsoLineDashStyle.msoLineSolid;
    	}
    
    	private static void ApplyLineStyle(Microsoft.Office.Interop.PowerPoint.Shape shape, FeatureBlockOptions options, float lineFactor)
    	{
    		shape.Fill.Visible = MsoTriState.msoFalse;
    		shape.Line.Visible = MsoTriState.msoTrue;
    		shape.Line.ForeColor.RGB = ParseRgb(options.StrokeColor);
    		shape.Line.Weight = Math.Max(0.25f, options.StrokeWidthPt * lineFactor);
    		shape.Line.DashStyle = MsoLineDashStyle.msoLineSolid;
    	}
    
    	private static void TrySetRoundness(Microsoft.Office.Interop.PowerPoint.Shape shape, float roundness)
    	{
    		try
    		{
    			if (shape.Adjustments.Count > 0)
    			{
    				shape.Adjustments[1] = Math.Max(0f, Math.Min(0.5f, roundness));
    			}
    		}
    		catch
    		{
    		}
    	}
    
    	private static int InterpolateColor(FeatureBlockOptions options, int x, int y, int z)
    	{
    		string direction = (options.GradientDirection ?? "x").Trim().ToLowerInvariant();
    		double tx = ((options.CountX <= 1) ? 0.0 : ((double)x / (double)(options.CountX - 1)));
    		double ty = ((options.CountY <= 1) ? 0.0 : ((double)y / (double)(options.CountY - 1)));
    		double tz = ((options.CountZ <= 1) ? 0.0 : ((double)z / (double)(options.CountZ - 1)));
    		double t = Math.Max(0.0, Math.Min(1.0, direction switch
    		{
    			"diag" => (tx + ty + tz) / 3.0, 
    			"yz" => (ty + tz) / 2.0, 
    			"xz" => (tx + tz) / 2.0, 
    			"xy" => (tx + ty) / 2.0, 
    			"z" => tz, 
    			"y" => ty, 
    			_ => tx, 
    		}));
    		if (options.GradientReverse)
    		{
    			t = 1.0 - t;
    		}
    		t = Math.Pow(t, Math.Max(0.1, Math.Min(4.0, options.GradientAmount)));
    		ColorParts start = Rgb(ParseRgb(options.StartColor));
    		ColorParts end = Rgb(ParseRgb(options.EndColor));
    		return Rgb((int)Math.Round((double)start.R + (double)(end.R - start.R) * t), (int)Math.Round((double)start.G + (double)(end.G - start.G) * t), (int)Math.Round((double)start.B + (double)(end.B - start.B) * t));
    	}
    
    	private static int Lighten(int rgb, double amount)
    	{
    		ColorParts c = Rgb(rgb);
    		return Rgb((int)((double)c.R + (double)(255 - c.R) * amount), (int)((double)c.G + (double)(255 - c.G) * amount), (int)((double)c.B + (double)(255 - c.B) * amount));
    	}
    
    	private static int Darken(int rgb, double amount)
    	{
    		ColorParts c = Rgb(rgb);
    		return Rgb((int)((double)c.R * (1.0 - amount)), (int)((double)c.G * (1.0 - amount)), (int)((double)c.B * (1.0 - amount)));
    	}
    
    	private static FeatureBlockOptions Normalize(FeatureBlockOptions options)
    	{
    		options = options ?? new FeatureBlockOptions();
    		options.Mode = (string.Equals(options.Mode, "2d", StringComparison.OrdinalIgnoreCase) ? "2d" : "3d");
    		options.VisualStyle = (string.Equals(options.VisualStyle, "rough", StringComparison.OrdinalIgnoreCase) ? "rough" : "plain");
    		options.CountX = Clamp(options.CountX, 1, 32);
    		options.CountY = Clamp(options.CountY, 1, 24);
    		options.CountZ = Clamp(options.CountZ, 1, 16);
    		options.BlockWidthPt = Clamp(options.BlockWidthPt, 6f, 80f);
    		options.BlockHeightPt = Clamp(options.BlockHeightPt, 6f, 80f);
    		options.BlockDepthPt = Clamp(options.BlockDepthPt, 2f, 48f);
    		options.GapPt = Clamp(options.GapPt, 0f, 16f);
    		options.Roundness = Clamp(options.Roundness, 0f, 0.5f);
    		options.StrokeWidthPt = Clamp(options.StrokeWidthPt, 0.25f, 6f);
    		options.GradientAmount = Math.Max(0.1, Math.Min(4.0, options.GradientAmount));
    		options.EditDirection = (options.EditDirection ?? string.Empty).Trim().ToLowerInvariant();
    		options.EditDelta = Clamp(options.EditDelta, -1, 1);
    		return options;
    	}
    
    	private static void ApplyDirectionalAnchor(FeatureBlockOptions previous, FeatureBlockOptions next, ref float left, ref float top)
    	{
    		if (next != null && next.EditDelta != 0 && !string.IsNullOrWhiteSpace(next.EditDirection))
    		{
    			float cellWidth = previous.BlockWidthPt + previous.GapPt;
    			float cellHeight = previous.BlockHeightPt + previous.GapPt;
    			float dx = previous.BlockDepthPt * 0.58f;
    			float dy = previous.BlockDepthPt * 0.42f;
    			switch (next.EditDirection)
    			{
    			case "left":
    				left -= (float)next.EditDelta * cellWidth;
    				break;
    			case "up":
    				top -= (float)next.EditDelta * cellHeight;
    				break;
    			case "front":
    				left -= (float)next.EditDelta * dx;
    				top += (float)next.EditDelta * dy;
    				break;
    			}
    		}
    	}
    
    	private static float GroupTopToOriginTop(float groupTop, FeatureBlockOptions options)
    	{
    		if (options == null || string.Equals(options.Mode, "2d", StringComparison.OrdinalIgnoreCase))
    		{
    			return groupTop;
    		}
    		return groupTop + (float)Math.Max(1, options.CountZ) * options.BlockDepthPt * 0.42f;
    	}
    
    	private static PointF CenterOrigin(Slide slide, FeatureBlockOptions options, bool is3D)
    	{
    		PageSetup page = ((Presentation)slide.Parent).PageSetup;
    		float width = (float)options.CountX * (options.BlockWidthPt + options.GapPt);
    		float height = (float)options.CountY * (options.BlockHeightPt + options.GapPt);
    		if (is3D)
    		{
    			width += (float)options.CountZ * options.BlockDepthPt * 0.58f;
    			height += (float)options.CountZ * options.BlockDepthPt * 0.42f;
    		}
    		return P(page.SlideWidth / 2f - width / 2f, page.SlideHeight / 2f - height / 2f + (is3D ? ((float)options.CountZ * options.BlockDepthPt * 0.22f) : 0f));
    	}
    
    	private string SerializeOptions(FeatureBlockOptions options)
    	{
    		return serializer.Serialize(options);
    	}
    
    	private FeatureBlockOptions DeserializeOptions(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return new FeatureBlockOptions();
    		}
    		if (value.TrimStart().StartsWith("{", StringComparison.Ordinal))
    		{
    			return Normalize(serializer.Deserialize<FeatureBlockOptions>(value));
    		}
    		string[] parts = value.Split('|');
    		FeatureBlockOptions options = new FeatureBlockOptions();
    		if (parts.Length != 0)
    		{
    			options.Mode = parts[0];
    		}
    		if (parts.Length > 1)
    		{
    			options.VisualStyle = parts[1];
    		}
    		if (parts.Length > 2)
    		{
    			options.CountX = ParseInt(parts[2], options.CountX);
    		}
    		if (parts.Length > 3)
    		{
    			options.CountY = ParseInt(parts[3], options.CountY);
    		}
    		if (parts.Length > 4)
    		{
    			options.CountZ = ParseInt(parts[4], options.CountZ);
    		}
    		if (parts.Length > 5)
    		{
    			options.BlockWidthPt = ParseFloat(parts[5], options.BlockWidthPt);
    		}
    		if (parts.Length > 6)
    		{
    			options.BlockHeightPt = ParseFloat(parts[6], options.BlockHeightPt);
    		}
    		if (parts.Length > 7)
    		{
    			options.BlockDepthPt = ParseFloat(parts[7], options.BlockDepthPt);
    		}
    		if (parts.Length > 8)
    		{
    			options.StartColor = parts[8];
    		}
    		if (parts.Length > 9)
    		{
    			options.EndColor = parts[9];
    		}
    		if (parts.Length > 10)
    		{
    			options.GradientDirection = parts[10];
    		}
    		if (parts.Length > 11)
    		{
    			options.GradientReverse = string.Equals(parts[11], "true", StringComparison.OrdinalIgnoreCase);
    		}
    		return Normalize(options);
    	}
    
    	private static bool IsRoughVisual(FeatureBlockOptions options)
    	{
    		return string.Equals(options?.VisualStyle, "rough", StringComparison.OrdinalIgnoreCase);
    	}
    
    	private static int ParseRgb(string hex)
    	{
    		string value = (hex ?? "#111111").TrimStart('#');
    		if (value.Length != 6)
    		{
    			return 1118481;
    		}
    		int r = int.Parse(value.Substring(0, 2), NumberStyles.HexNumber);
    		int g = int.Parse(value.Substring(2, 2), NumberStyles.HexNumber);
    		int b = int.Parse(value.Substring(4, 2), NumberStyles.HexNumber);
    		return Rgb(r, g, b);
    	}
    
    	private static int Rgb(int r, int g, int b)
    	{
    		r = Clamp(r, 0, 255);
    		g = Clamp(g, 0, 255);
    		b = Clamp(b, 0, 255);
    		return r + (g << 8) + (b << 16);
    	}
    
    	private static ColorParts Rgb(int rgb)
    	{
    		return new ColorParts(rgb & 0xFF, (rgb >> 8) & 0xFF, (rgb >> 16) & 0xFF);
    	}
    
    	private static int Clamp(int value, int min, int max)
    	{
    		return Math.Max(min, Math.Min(max, value));
    	}
    
    	private static float Clamp(float value, float min, float max)
    	{
    		return Math.Max(min, Math.Min(max, value));
    	}
    
    	private static int ParseInt(string value, int fallback)
    	{
    		if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result))
    		{
    			return fallback;
    		}
    		return result;
    	}
    
    	private static float ParseFloat(string value, float fallback)
    	{
    		if (!float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result))
    		{
    			return fallback;
    		}
    		return result;
    	}
    
    	private static PointF P(float x, float y)
    	{
    		return new PointF(x, y);
    	}
    
    	private static float Distance(PointF left, PointF right)
    	{
    		return (float)Math.Sqrt(Math.Pow(left.X - right.X, 2.0) + Math.Pow(left.Y - right.Y, 2.0));
    	}
    
    	private static PointF CubeOrigin(FeatureBlockOptions options, float originX, float originY, int x, int y, int z)
    	{
    		float dx = options.BlockDepthPt * 0.58f;
    		float dy = options.BlockDepthPt * 0.42f;
    		return P(originX + (float)x * (options.BlockWidthPt + options.GapPt) + (float)z * dx, originY + (float)y * (options.BlockHeightPt + options.GapPt) - (float)z * dy);
    	}
    
    	private static PointF MoveTowards(PointF from, PointF to, float distance)
    	{
    		float length = Distance(from, to);
    		if (length <= 0.001f)
    		{
    			return from;
    		}
    		float ratio = distance / length;
    		return P(from.X + (to.X - from.X) * ratio, from.Y + (to.Y - from.Y) * ratio);
    	}
    }

    public enum FeatureBlockMutationResult
    {
    	Failed,
    	Inserted,
    	Updated
    }
}
