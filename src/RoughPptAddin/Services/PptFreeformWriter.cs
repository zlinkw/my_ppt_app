using System;
using System.Collections.Generic;
using System.Globalization;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class PptFreeformWriter
{
	private readonly MetadataService metadata;

	public PptFreeformWriter(MetadataService metadata)
	{
		this.metadata = metadata;
	}

	public Microsoft.Office.Interop.PowerPoint.Shape InsertGroup(Slide slide, RoughShapeRequest request, RoughDrawable drawable)
	{
		List<Microsoft.Office.Interop.PowerPoint.Shape> shapes = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
		request.NativeCarrierId = string.Empty;
		request.InnerFillCarrierId = string.Empty;
		request.InnerBoundaryId = string.Empty;
		request.OuterJitterIds = new List<string>();
		Microsoft.Office.Interop.PowerPoint.Shape nativeCarrier = CreateNativeCarrier(slide, request);
		if (nativeCarrier != null)
		{
			nativeCarrier.Name = UniqueName("Rough_NativeCarrier");
			request.NativeCarrierId = nativeCarrier.Name;
			metadata.WriteRole(nativeCarrier, "nativeCarrier");
			metadata.Write(nativeCarrier, request);
			shapes.Add(nativeCarrier);
		}
		bool hasExplicitFillBoundary = HasRolePath(drawable, "innerFillBoundary");
		IDictionary<RoughPath, RoughPath> fillBoundaryOverrides = BuildFillBoundaryOverrides(drawable);
		foreach (RoughPath path in drawable.Paths)
		{
			if (string.Equals(path.Role, "hitArea", StringComparison.OrdinalIgnoreCase))
			{
				continue;
			}
			if (string.Equals(path.Role, "innerFillBoundary", StringComparison.OrdinalIgnoreCase))
			{
				if (!path.Closed)
				{
					continue;
				}
				if (!fillBoundaryOverrides.TryGetValue(path, out var fillPath))
				{
					fillPath = path;
				}
				Microsoft.Office.Interop.PowerPoint.Shape innerFill = CreateFreeform(slide, request, fillPath, "Rough_InnerFillCarrier", "innerFillBoundary", lineVisible: false, fillCarrier: true);
				if (innerFill != null)
				{
					if (string.IsNullOrWhiteSpace(request.InnerFillCarrierId))
					{
						request.InnerFillCarrierId = innerFill.Name;
					}
					metadata.Write(innerFill, request);
					shapes.Add(innerFill);
				}
				continue;
			}
			if (!hasExplicitFillBoundary && path.Closed && string.Equals(path.Role, "innerBoundary", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(request.InnerFillCarrierId))
			{
				Microsoft.Office.Interop.PowerPoint.Shape innerFill2 = CreateFreeform(slide, request, path, "Rough_InnerFillCarrier", "innerFillBoundary", lineVisible: false, fillCarrier: true);
				if (innerFill2 != null)
				{
					request.InnerFillCarrierId = innerFill2.Name;
					metadata.Write(innerFill2, request);
					shapes.Add(innerFill2);
				}
			}
			Microsoft.Office.Interop.PowerPoint.Shape shape = CreateVisibleOverlay(slide, request, path);
			if (shape != null)
			{
				if (string.Equals(path.Role, "innerBoundary", StringComparison.OrdinalIgnoreCase))
				{
					request.InnerBoundaryId = shape.Name;
				}
				else if (string.Equals(path.Role, "outerJitter", StringComparison.OrdinalIgnoreCase))
				{
					request.OuterJitterIds.Add(shape.Name);
				}
				metadata.Write(shape, request);
				shapes.Add(shape);
			}
		}
		if (shapes.Count == 0)
		{
			throw new InvalidOperationException("Rough 生成结果没有可写入的 PPT 原生路径。");
		}
		Microsoft.Office.Interop.PowerPoint.Shape hitArea = CreateHitArea(slide, request, drawable);
		hitArea.Name = UniqueName("Rough_HitArea");
		metadata.WriteRole(hitArea, "hitArea");
		metadata.Write(hitArea, request);
		shapes.Add(hitArea);
		string[] names = new string[shapes.Count];
		for (int i = 0; i < shapes.Count; i++)
		{
			names[i] = shapes[i].Name;
		}
		Microsoft.Office.Interop.PowerPoint.Shape group = slide.Shapes.Range(names).Group();
		group.Name = "Rough_" + request.SourceMsoType;
		metadata.Write(group, request);
		return group;
	}

	public Microsoft.Office.Interop.PowerPoint.Shape ReplaceVisiblePaths(Microsoft.Office.Interop.PowerPoint.Shape group, RoughShapeRequest request, RoughDrawable drawable, Func<Microsoft.Office.Interop.PowerPoint.Shape, Microsoft.Office.Interop.PowerPoint.Shape, bool> beforeDelete = null)
	{
		Slide slide = (Slide)group.Parent;
		float left = group.Left;
		float top = group.Top;
		float rotation = group.Rotation;
		int zOrderPosition = group.ZOrderPosition;
		Microsoft.Office.Interop.PowerPoint.Shape newGroup = null;
		try
		{
			newGroup = InsertGroup(slide, request, drawable);
			beforeDelete?.Invoke(group, newGroup);
		}
		catch
		{
			try
			{
				newGroup?.Delete();
			}
			catch
			{
			}
			throw;
		}
		group.Delete();
		newGroup.Left = left;
		newGroup.Top = top;
		newGroup.Rotation = rotation;
		RestoreZOrder(newGroup, zOrderPosition);
		newGroup.Select();
		return newGroup;
	}

	private Microsoft.Office.Interop.PowerPoint.Shape CreateVisibleOverlay(Slide slide, RoughShapeRequest request, RoughPath path)
	{
		string role = (string.IsNullOrWhiteSpace(path.Role) ? "outerJitter" : path.Role);
		string name = "Rough_OuterJitterOverlay";
		if (string.Equals(role, "innerBoundary", StringComparison.OrdinalIgnoreCase))
		{
			name = "Rough_InnerBoundaryOverlay";
		}
		else if (string.Equals(role, "texture", StringComparison.OrdinalIgnoreCase))
		{
			name = "Rough_TextureOverlay";
		}
		return CreateFreeform(slide, request, path, name, role, lineVisible: true, fillCarrier: false);
	}

	private Microsoft.Office.Interop.PowerPoint.Shape CreateFreeform(Slide slide, RoughShapeRequest request, RoughPath path, string name, string role, bool lineVisible, bool fillCarrier)
	{
		if (path.Segments == null || path.Segments.Count == 0)
		{
			return null;
		}
		RoughSegment first = path.Segments[0];
		if (first.Type != "move" || first.Data == null || first.Data.Length < 2)
		{
			return null;
		}
		Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder = slide.Shapes.BuildFreeform(MsoEditingType.msoEditingAuto, request.Left + first.Data[0], request.Top + first.Data[1]);
		for (int i = 1; i < path.Segments.Count; i++)
		{
			RoughSegment segment = path.Segments[i];
			AddSegment(builder, request, segment);
		}
		if (path.Closed)
		{
			builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, request.Left + first.Data[0], request.Top + first.Data[1]);
		}
		Microsoft.Office.Interop.PowerPoint.Shape shape = builder.ConvertToShape();
		shape.Name = UniqueName(name);
		metadata.WriteRole(shape, role);
		if (lineVisible)
		{
			shape.Line.Visible = MsoTriState.msoTrue;
			shape.Line.ForeColor.RGB = ParseRgb(path.Stroke ?? request.Style.Stroke);
			shape.Line.Weight = ((path.StrokeWidthPt > 0f) ? path.StrokeWidthPt : request.Style.StrokeWidthPt);
			ApplyLineStyle(shape.Line, request);
		}
		else
		{
			shape.Line.Visible = MsoTriState.msoFalse;
		}
		ApplyFillStyle(shape.Fill, request, fillCarrier);
		return shape;
	}

	private Microsoft.Office.Interop.PowerPoint.Shape CreateHitArea(Slide slide, RoughShapeRequest request, RoughDrawable drawable)
	{
		RoughPath hitAreaPath = FindRolePath(drawable, "hitArea");
		if (hitAreaPath != null)
		{
			Microsoft.Office.Interop.PowerPoint.Shape hitArea = CreateFreeform(slide, request, hitAreaPath, "Rough_HitArea", "hitArea", lineVisible: false, fillCarrier: false);
			if (hitArea != null)
			{
				return hitArea;
			}
		}
		return InteractionShell.Create(slide, request);
	}

	private static string UniqueName(string prefix)
	{
		return prefix + "_" + Guid.NewGuid().ToString("N").Substring(0, 8);
	}

	private Microsoft.Office.Interop.PowerPoint.Shape CreateNativeCarrier(Slide slide, RoughShapeRequest request)
	{
		try
		{
			Microsoft.Office.Interop.PowerPoint.Shape shape;
			if (ShapeKindMapper.IsNativeLine(request.SourceMsoType))
			{
				shape = slide.Shapes.AddLine(request.Left, request.Top, request.Left + request.Width, request.Top + request.Height);
				if (IsLineArrow(request.SourceMsoType))
				{
					ApplyArrowheadStyle(shape.Line, request, roughAsTriangle: true);
				}
			}
			else if (ShapeKindMapper.IsConnector(request.SourceMsoType))
			{
				shape = slide.Shapes.AddConnector(ConnectorTypeFor(request.SourceMsoType), request.Left, request.Top, request.Left + request.Width, request.Top + request.Height);
			}
			else
			{
				MsoAutoShapeType parsed = (MsoAutoShapeType)Enum.Parse(typeof(MsoAutoShapeType), request.SourceMsoType, ignoreCase: true);
				shape = slide.Shapes.AddShape(parsed, request.Left, request.Top, Math.Max(1f, request.Width), Math.Max(1f, request.Height));
			}
			shape.Line.Visible = MsoTriState.msoFalse;
			shape.Fill.Visible = MsoTriState.msoFalse;
			ApplyAdjustments(shape, request);
			return shape;
		}
		catch
		{
			return null;
		}
	}

	private static RoughPath FindInnerFillPath(RoughDrawable drawable)
	{
		if (drawable?.Paths == null)
		{
			return null;
		}
		foreach (RoughPath path in drawable.Paths)
		{
			if (path.Closed && string.Equals(path.Role, "innerFillBoundary", StringComparison.OrdinalIgnoreCase))
			{
				return path;
			}
		}
		foreach (RoughPath path2 in drawable.Paths)
		{
			if (path2.Closed && string.Equals(path2.Role, "innerBoundary", StringComparison.OrdinalIgnoreCase))
			{
				return path2;
			}
		}
		foreach (RoughPath path3 in drawable.Paths)
		{
			if (path3.Closed)
			{
				return path3;
			}
		}
		return null;
	}

	private static IDictionary<RoughPath, RoughPath> BuildFillBoundaryOverrides(RoughDrawable drawable)
	{
		Dictionary<RoughPath, RoughPath> result = new Dictionary<RoughPath, RoughPath>();
		List<RoughPath> paths = drawable?.Paths;
		if (paths == null)
		{
			return result;
		}
		for (int i = 0; i < paths.Count; i++)
		{
			RoughPath path = paths[i];
			if (!path.Closed || !string.Equals(path.Role, "innerFillBoundary", StringComparison.OrdinalIgnoreCase))
			{
				continue;
			}
			for (int j = i + 1; j < paths.Count; j++)
			{
				RoughPath candidate = paths[j];
				if (string.Equals(candidate.Role, "innerFillBoundary", StringComparison.OrdinalIgnoreCase))
				{
					break;
				}
				if (candidate.Closed && string.Equals(candidate.Role, "innerBoundary", StringComparison.OrdinalIgnoreCase))
				{
					if (SamePathGeometry(path, candidate, 0.001f))
					{
						result[path] = candidate;
					}
					break;
				}
			}
		}
		return result;
	}

	private static bool SamePathGeometry(RoughPath left, RoughPath right, float epsilon)
	{
		if (left?.Segments == null || right?.Segments == null)
		{
			return false;
		}
		if (left.Segments.Count != right.Segments.Count)
		{
			return false;
		}
		for (int i = 0; i < left.Segments.Count; i++)
		{
			RoughSegment leftSegment = left.Segments[i];
			RoughSegment rightSegment = right.Segments[i];
			if (!string.Equals(leftSegment.Type, rightSegment.Type, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}
			float[] leftData = leftSegment.Data ?? new float[0];
			float[] rightData = rightSegment.Data ?? new float[0];
			if (leftData.Length != rightData.Length)
			{
				return false;
			}
			for (int j = 0; j < leftData.Length; j++)
			{
				if (Math.Abs(leftData[j] - rightData[j]) > epsilon)
				{
					return false;
				}
			}
		}
		return true;
	}

	private static RoughPath FindRolePath(RoughDrawable drawable, string role)
	{
		if (drawable?.Paths == null)
		{
			return null;
		}
		foreach (RoughPath path in drawable.Paths)
		{
			if (string.Equals(path.Role, role, StringComparison.OrdinalIgnoreCase))
			{
				return path;
			}
		}
		return null;
	}

	private static bool HasRolePath(RoughDrawable drawable, string role)
	{
		return FindRolePath(drawable, role) != null;
	}

	private static void ApplyFillStyle(Microsoft.Office.Interop.PowerPoint.FillFormat fill, RoughShapeRequest request, bool fillCarrier)
	{
		if (!fillCarrier)
		{
			fill.Visible = MsoTriState.msoFalse;
			return;
		}
		RoughStyle style = request.Style ?? new RoughStyle();
		if ((style.FillMode ?? style.FillStyle ?? "none").Trim().ToLowerInvariant() == "none")
		{
			fill.Visible = MsoTriState.msoFalse;
			return;
		}
		fill.Visible = MsoTriState.msoTrue;
		fill.ForeColor.RGB = ParseRgb(style.FillColor);
		fill.Transparency = (float)Math.Max(0.0, Math.Min(1.0, style.FillTransparency));
	}

	private static void ApplyAdjustments(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (request?.Adjustments == null || request.Adjustments.Count == 0)
		{
			return;
		}
		try
		{
			Microsoft.Office.Interop.PowerPoint.Adjustments adjustments = shape.Adjustments;
			int count = Math.Min(adjustments.Count, request.Adjustments.Count);
			for (int i = 1; i <= count; i++)
			{
				adjustments[i] = request.Adjustments[i - 1];
			}
		}
		catch
		{
		}
	}

	private static void AddSegment(Microsoft.Office.Interop.PowerPoint.FreeformBuilder builder, RoughShapeRequest request, RoughSegment segment)
	{
		if (segment?.Data != null)
		{
			if (segment.Type == "curve" && segment.Data.Length >= 6)
			{
				builder.AddNodes(MsoSegmentType.msoSegmentCurve, MsoEditingType.msoEditingCorner, request.Left + segment.Data[0], request.Top + segment.Data[1], request.Left + segment.Data[2], request.Top + segment.Data[3], request.Left + segment.Data[4], request.Top + segment.Data[5]);
			}
			else if (segment.Data.Length >= 2)
			{
				builder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingCorner, request.Left + segment.Data[0], request.Top + segment.Data[1]);
			}
		}
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
		return r + (g << 8) + (b << 16);
	}

	private static void ApplyLineStyle(Microsoft.Office.Interop.PowerPoint.LineFormat line, RoughShapeRequest request)
	{
		line.DashStyle = (IsThreeDRecipe(request?.SourceMsoType) ? MsoLineDashStyle.msoLineSolid : MapDashStyle(request.Style?.DashStyle));
		if (IsLineArrow(request.SourceMsoType) && !((request.Style?.ArrowheadStyle ?? "rough").Trim().ToLowerInvariant() == "rough"))
		{
			ApplyArrowheadStyle(line, request, roughAsTriangle: false);
		}
	}

	private static MsoLineDashStyle MapDashStyle(string dashStyle)
	{
		return (dashStyle ?? "solid").Trim().ToLowerInvariant() switch
		{
			"dash" => MsoLineDashStyle.msoLineDash, 
			"dot" => MsoLineDashStyle.msoLineRoundDot, 
			"dash-dot" => MsoLineDashStyle.msoLineDashDot, 
			_ => MsoLineDashStyle.msoLineSolid, 
		};
	}

	private static MsoArrowheadStyle MapArrowheadStyle(string arrowheadStyle)
	{
		return (arrowheadStyle ?? "none").Trim().ToLowerInvariant() switch
		{
			"open" => MsoArrowheadStyle.msoArrowheadOpen, 
			"triangle" => MsoArrowheadStyle.msoArrowheadTriangle, 
			"stealth" => MsoArrowheadStyle.msoArrowheadStealth, 
			_ => MsoArrowheadStyle.msoArrowheadNone, 
		};
	}

	private static void ApplyArrowheadStyle(Microsoft.Office.Interop.PowerPoint.LineFormat line, RoughShapeRequest request, bool roughAsTriangle)
	{
		string arrowheadStyle = (request.Style?.ArrowheadStyle ?? "rough").Trim().ToLowerInvariant();
		MsoArrowheadStyle arrow = ((arrowheadStyle == "rough" && roughAsTriangle) ? MsoArrowheadStyle.msoArrowheadTriangle : MapArrowheadStyle(arrowheadStyle));
		string position = (request.Style?.ArrowheadPosition ?? "end").Trim().ToLowerInvariant();
		bool useBegin = arrow != MsoArrowheadStyle.msoArrowheadNone && (position == "start" || position == "both");
		bool useEnd = arrow != MsoArrowheadStyle.msoArrowheadNone && (position != "start" || position == "both");
		line.BeginArrowheadStyle = ((!useBegin) ? MsoArrowheadStyle.msoArrowheadNone : arrow);
		line.EndArrowheadStyle = ((!useEnd) ? MsoArrowheadStyle.msoArrowheadNone : arrow);
	}

	private static bool IsLineArrow(string sourceMsoType)
	{
		return string.Equals(ShapeKindMapper.CleanMsoShapeName(sourceMsoType), "LineArrow", StringComparison.OrdinalIgnoreCase);
	}

	private static bool IsThreeDRecipe(string sourceMsoType)
	{
		if (!string.IsNullOrWhiteSpace(sourceMsoType))
		{
			return sourceMsoType.StartsWith("rough3d", StringComparison.OrdinalIgnoreCase);
		}
		return false;
	}

	private static MsoConnectorType ConnectorTypeFor(string sourceMsoType)
	{
		string name = ShapeKindMapper.CleanMsoShapeName(sourceMsoType);
		if (string.Equals(name, "ElbowConnector", StringComparison.OrdinalIgnoreCase))
		{
			return MsoConnectorType.msoConnectorElbow;
		}
		if (string.Equals(name, "CurvedConnector", StringComparison.OrdinalIgnoreCase))
		{
			return MsoConnectorType.msoConnectorCurve;
		}
		return MsoConnectorType.msoConnectorStraight;
	}

	private static void RestoreZOrder(Microsoft.Office.Interop.PowerPoint.Shape shape, int targetPosition)
	{
		int guard = 0;
		while (shape.ZOrderPosition > targetPosition && guard < 512)
		{
			shape.ZOrder(MsoZOrderCmd.msoSendBackward);
			guard++;
		}
	}
}
