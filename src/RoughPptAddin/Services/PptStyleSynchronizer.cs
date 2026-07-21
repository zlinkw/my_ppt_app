using System;
using System.Collections.Generic;
using System.Globalization;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class PptStyleSynchronizer
{
	private readonly MetadataService metadata;

	public PptStyleSynchronizer(MetadataService metadata)
	{
		this.metadata = metadata;
	}

	public void Capture(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (shape != null && request?.Style != null)
		{
			Microsoft.Office.Interop.PowerPoint.Shape carrier = FindByRole(shape, "nativeCarrier");
			if (carrier != null)
			{
				request.Adjustments = CaptureAdjustments(carrier);
				CaptureCarrierBounds(shape, carrier, request);
			}
			Microsoft.Office.Interop.PowerPoint.Shape innerBoundary = FindByRole(shape, "innerBoundary");
			if (innerBoundary != null)
			{
				CaptureLine(innerBoundary, request.Style);
			}
			Microsoft.Office.Interop.PowerPoint.Shape innerFill = FindByRole(shape, "innerFillBoundary");
			if (innerFill != null)
			{
				CaptureFill(innerFill, request.Style);
			}
		}
	}

	public void Apply(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (shape == null || request?.Style == null)
		{
			return;
		}
		ForEachChild(shape, delegate(Microsoft.Office.Interop.PowerPoint.Shape child)
		{
			string text = metadata.ReadRole(child);
			switch (text)
			{
			case "innerFillBoundary":
				ApplyFill(child, request.Style);
				child.Line.Visible = MsoTriState.msoFalse;
				break;
			case "texture":
				ApplyTextureLine(child, request.Style);
				child.Fill.Visible = MsoTriState.msoFalse;
				break;
			case "innerBoundary":
			case "outerJitter":
				ApplyLine(child, request.Style, IsThreeDRecipe(request.SourceMsoType));
				child.Fill.Visible = MsoTriState.msoFalse;
				break;
			case "hitArea":
			case "nativeCarrier":
				if (text == "nativeCarrier")
				{
					ApplyAdjustments(child, request);
				}
				child.Line.Visible = MsoTriState.msoFalse;
				child.Fill.Visible = MsoTriState.msoFalse;
				break;
			}
		});
	}

	public void ApplyStructuralDefaults(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (shape == null)
		{
			return;
		}
		ForEachChild(shape, delegate(Microsoft.Office.Interop.PowerPoint.Shape child)
		{
			string text = metadata.ReadRole(child);
			switch (text)
			{
			case "innerFillBoundary":
				child.Line.Visible = MsoTriState.msoFalse;
				break;
			case "innerBoundary":
			case "outerJitter":
			case "texture":
				child.Fill.Visible = MsoTriState.msoFalse;
				if (child.Line.Visible == MsoTriState.msoFalse)
				{
					child.Line.Visible = MsoTriState.msoTrue;
				}
				break;
			case "hitArea":
			case "nativeCarrier":
				if (text == "nativeCarrier")
				{
					ApplyAdjustments(child, request);
				}
				child.Line.Visible = MsoTriState.msoFalse;
				child.Fill.Visible = MsoTriState.msoFalse;
				break;
			}
		});
	}

	public bool ApplyNativeFormats(Microsoft.Office.Interop.PowerPoint.Shape sourceGroup, Microsoft.Office.Interop.PowerPoint.Shape targetGroup, RoughShapeRequest request)
	{
		if (sourceGroup == null || targetGroup == null || request == null)
		{
			return false;
		}
		bool applied = false;
		Microsoft.Office.Interop.PowerPoint.Shape sourceFill = FindByRole(sourceGroup, "innerFillBoundary");
		Microsoft.Office.Interop.PowerPoint.Shape targetFill = FindByRole(targetGroup, "innerFillBoundary");
		if (CopyFormat(sourceFill, targetFill))
		{
			CopyText(sourceFill, targetFill);
			targetFill.Line.Visible = MsoTriState.msoFalse;
			CaptureFill(targetFill, request.Style);
			applied = true;
		}
		Microsoft.Office.Interop.PowerPoint.Shape sourceBoundary = FindByRole(sourceGroup, "innerBoundary");
		Microsoft.Office.Interop.PowerPoint.Shape targetBoundary = FindByRole(targetGroup, "innerBoundary");
		if (CopyFormat(sourceBoundary, targetBoundary))
		{
			targetBoundary.Line.Visible = MsoTriState.msoTrue;
			targetBoundary.Fill.Visible = MsoTriState.msoFalse;
			ForceSolidForThreeD(targetBoundary, request);
			CaptureLine(targetBoundary, request.Style);
			applied = true;
		}
		if (sourceBoundary != null)
		{
			foreach (Microsoft.Office.Interop.PowerPoint.Shape overlay in FindByRoles(targetGroup, "outerJitter", "texture"))
			{
				if (CopyFormat(sourceBoundary, overlay))
				{
					overlay.Line.Visible = MsoTriState.msoTrue;
					overlay.Fill.Visible = MsoTriState.msoFalse;
					ForceSolidForThreeD(overlay, request);
					if (metadata.ReadRole(overlay) == "texture")
					{
						ApplyTextureLine(overlay, request.Style);
					}
					applied = true;
				}
			}
		}
		ApplyStructuralDefaults(targetGroup, request);
		return applied;
	}

	public bool ApplyNativeShapeFormat(Microsoft.Office.Interop.PowerPoint.Shape sourceShape, Microsoft.Office.Interop.PowerPoint.Shape targetGroup, RoughShapeRequest request)
	{
		if (sourceShape == null || targetGroup == null || request == null)
		{
			return false;
		}
		bool applied = false;
		Microsoft.Office.Interop.PowerPoint.Shape targetFill = FindByRole(targetGroup, "innerFillBoundary");
		if (CopyFormat(sourceShape, targetFill))
		{
			CopyText(sourceShape, targetFill);
			targetFill.Line.Visible = MsoTriState.msoFalse;
			CaptureFill(targetFill, request.Style);
			applied = true;
		}
		Microsoft.Office.Interop.PowerPoint.Shape targetBoundary = FindByRole(targetGroup, "innerBoundary");
		if (CopyFormat(sourceShape, targetBoundary))
		{
			targetBoundary.Line.Visible = MsoTriState.msoTrue;
			targetBoundary.Fill.Visible = MsoTriState.msoFalse;
			ForceSolidForThreeD(targetBoundary, request);
			CaptureLine(targetBoundary, request.Style);
			applied = true;
		}
		if (targetBoundary != null)
		{
			foreach (Microsoft.Office.Interop.PowerPoint.Shape overlay in FindByRoles(targetGroup, "outerJitter", "texture"))
			{
				if (CopyFormat(targetBoundary, overlay))
				{
					overlay.Line.Visible = MsoTriState.msoTrue;
					overlay.Fill.Visible = MsoTriState.msoFalse;
					ForceSolidForThreeD(overlay, request);
					if (metadata.ReadRole(overlay) == "texture")
					{
						ApplyTextureLine(overlay, request.Style);
					}
					applied = true;
				}
			}
		}
		ApplyStructuralDefaults(targetGroup, request);
		return applied;
	}

	private void CaptureLine(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		try
		{
			if (shape.Line.Visible != MsoTriState.msoFalse)
			{
				style.Stroke = ToHex(shape.Line.ForeColor.RGB);
				style.StrokeWidthPt = shape.Line.Weight;
				style.StrokeTransparency = shape.Line.Transparency;
				style.DashStyle = FromDashStyle(shape.Line.DashStyle);
				try
				{
					CaptureArrowheads(shape, style);
				}
				catch
				{
				}
				style.NativeStyleVersion++;
			}
		}
		catch
		{
		}
	}

	private void CaptureFill(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		try
		{
			if (shape.Fill.Visible == MsoTriState.msoFalse)
			{
				style.FillMode = "none";
				style.FillTransparency = 0.0;
				style.NativeStyleVersion++;
			}
			else if (shape.Fill.Type != MsoFillType.msoFillSolid)
			{
				style.FillMode = "native";
				style.FillTransparency = shape.Fill.Transparency;
				style.NativeStyleVersion++;
			}
			else
			{
				style.FillMode = "solid";
				style.FillColor = ToHex(shape.Fill.ForeColor.RGB);
				style.FillTransparency = shape.Fill.Transparency;
				style.NativeStyleVersion++;
			}
		}
		catch
		{
		}
	}

	private static void ApplyLine(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style, bool forceSolid = false)
	{
		shape.Line.Visible = MsoTriState.msoTrue;
		shape.Line.ForeColor.RGB = ParseRgb(style.Stroke);
		shape.Line.Weight = style.StrokeWidthPt;
		shape.Line.Transparency = (float)Math.Max(0.0, Math.Min(1.0, style.StrokeTransparency));
		shape.Line.DashStyle = (forceSolid ? MsoLineDashStyle.msoLineSolid : ToDashStyle(style.DashStyle));
		try
		{
			ApplyArrowheads(shape.Line, style);
		}
		catch
		{
		}
	}

	private static void ApplyTextureLine(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		shape.Line.Visible = MsoTriState.msoTrue;
		shape.Line.ForeColor.RGB = ParseRgb(style.FillColor);
		shape.Line.Transparency = (float)Math.Max(0.0, Math.Min(1.0, style.FillTransparency));
		shape.Line.DashStyle = MsoLineDashStyle.msoLineSolid;
		if (IsBrushFill(style))
		{
			shape.Line.Weight = (float)Math.Max(0.7, style.BrushWidthPt);
		}
		else
		{
			shape.Line.Weight = (float)Math.Max(0.35, (style.FillWeight > 0.0) ? style.FillWeight : ((double)style.StrokeWidthPt * 0.5));
		}
	}

	private static bool IsBrushFill(RoughStyle style)
	{
		string a = (style?.FillStyle ?? "none").Trim();
		string fillSource = (style?.FillSource ?? "auto").Trim();
		if (!string.Equals(a, "brush", StringComparison.OrdinalIgnoreCase))
		{
			return string.Equals(fillSource, "brush", StringComparison.OrdinalIgnoreCase);
		}
		return true;
	}

	private static void ApplyFill(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		string mode = (style.FillMode ?? style.FillStyle ?? "none").Trim().ToLowerInvariant();
		if (mode == "none")
		{
			shape.Fill.Visible = MsoTriState.msoFalse;
			return;
		}
		if (mode == "native")
		{
			shape.Fill.Visible = MsoTriState.msoTrue;
			return;
		}
		shape.Fill.Visible = MsoTriState.msoTrue;
		shape.Fill.ForeColor.RGB = ParseRgb(style.FillColor);
		shape.Fill.Transparency = (float)Math.Max(0.0, Math.Min(1.0, style.FillTransparency));
	}

	private static bool CopyFormat(Microsoft.Office.Interop.PowerPoint.Shape source, Microsoft.Office.Interop.PowerPoint.Shape target)
	{
		if (source == null || target == null)
		{
			return false;
		}
		try
		{
			source.PickUp();
			target.Apply();
			return true;
		}
		catch
		{
			return false;
		}
	}

	private static void ForceSolidForThreeD(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (!IsThreeDRecipe(request?.SourceMsoType) || shape == null)
		{
			return;
		}
		try
		{
			shape.Line.DashStyle = MsoLineDashStyle.msoLineSolid;
		}
		catch
		{
		}
	}

	private static bool IsThreeDRecipe(string sourceMsoType)
	{
		if (!string.IsNullOrWhiteSpace(sourceMsoType))
		{
			return sourceMsoType.StartsWith("rough3d", StringComparison.OrdinalIgnoreCase);
		}
		return false;
	}

	private static void CopyText(Microsoft.Office.Interop.PowerPoint.Shape source, Microsoft.Office.Interop.PowerPoint.Shape target)
	{
		if (source == null || target == null)
		{
			return;
		}
		try
		{
			if (source.HasTextFrame == MsoTriState.msoTrue && target.HasTextFrame == MsoTriState.msoTrue && source.TextFrame.HasText == MsoTriState.msoTrue)
			{
				target.TextFrame.TextRange.Text = source.TextFrame.TextRange.Text;
			}
		}
		catch
		{
		}
	}

	private static List<float> CaptureAdjustments(Microsoft.Office.Interop.PowerPoint.Shape shape)
	{
		List<float> values = new List<float>();
		try
		{
			Microsoft.Office.Interop.PowerPoint.Adjustments adjustments = shape.Adjustments;
			for (int i = 1; i <= adjustments.Count; i++)
			{
				values.Add(adjustments[i]);
			}
		}
		catch
		{
		}
		return values;
	}

	private static void CaptureCarrierBounds(Microsoft.Office.Interop.PowerPoint.Shape group, Microsoft.Office.Interop.PowerPoint.Shape carrier, RoughShapeRequest request)
	{
		if (group == null || carrier == null || request == null)
		{
			return;
		}
		try
		{
			request.Width = Math.Max(1f, carrier.Width);
			request.Height = Math.Max((!ShapeKindMapper.IsLineLike(request.SourceMsoType)) ? 1 : 0, carrier.Height);
		}
		catch
		{
		}
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

	private Microsoft.Office.Interop.PowerPoint.Shape FindByRole(Microsoft.Office.Interop.PowerPoint.Shape shape, string role)
	{
		Microsoft.Office.Interop.PowerPoint.Shape result = null;
		ForEachChild(shape, delegate(Microsoft.Office.Interop.PowerPoint.Shape child)
		{
			if (result == null && metadata.ReadRole(child) == role)
			{
				result = child;
			}
		});
		return result;
	}

	private IList<Microsoft.Office.Interop.PowerPoint.Shape> FindByRoles(Microsoft.Office.Interop.PowerPoint.Shape shape, params string[] roles)
	{
		List<Microsoft.Office.Interop.PowerPoint.Shape> results = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
		ForEachChild(shape, delegate(Microsoft.Office.Interop.PowerPoint.Shape child)
		{
			string text = metadata.ReadRole(child);
			string[] array = roles;
			foreach (string text2 in array)
			{
				if (text == text2)
				{
					results.Add(child);
					break;
				}
			}
		});
		return results;
	}

	private static void ForEachChild(Microsoft.Office.Interop.PowerPoint.Shape shape, Action<Microsoft.Office.Interop.PowerPoint.Shape> action)
	{
		if (shape.Type == MsoShapeType.msoGroup)
		{
			for (int i = 1; i <= shape.GroupItems.Count; i++)
			{
				action(shape.GroupItems[i]);
			}
		}
		else
		{
			action(shape);
		}
	}

	private static string FromDashStyle(MsoLineDashStyle dashStyle)
	{
		switch (dashStyle)
		{
		case MsoLineDashStyle.msoLineDash:
		case MsoLineDashStyle.msoLineLongDash:
			return "dash";
		case MsoLineDashStyle.msoLineSquareDot:
		case MsoLineDashStyle.msoLineRoundDot:
			return "dot";
		case MsoLineDashStyle.msoLineDashDot:
		case MsoLineDashStyle.msoLineLongDashDot:
			return "dash-dot";
		default:
			return "solid";
		}
	}

	private static MsoLineDashStyle ToDashStyle(string dashStyle)
	{
		return (dashStyle ?? "solid").Trim().ToLowerInvariant() switch
		{
			"dash" => MsoLineDashStyle.msoLineDash, 
			"dot" => MsoLineDashStyle.msoLineRoundDot, 
			"dash-dot" => MsoLineDashStyle.msoLineDashDot, 
			_ => MsoLineDashStyle.msoLineSolid, 
		};
	}

	private static string FromArrowheadStyle(MsoArrowheadStyle arrowheadStyle)
	{
		return arrowheadStyle switch
		{
			MsoArrowheadStyle.msoArrowheadTriangle => "triangle", 
			MsoArrowheadStyle.msoArrowheadOpen => "open", 
			MsoArrowheadStyle.msoArrowheadStealth => "stealth", 
			_ => "none", 
		};
	}

	private static MsoArrowheadStyle ToArrowheadStyle(string arrowheadStyle)
	{
		return (arrowheadStyle ?? "none").Trim().ToLowerInvariant() switch
		{
			"open" => MsoArrowheadStyle.msoArrowheadOpen, 
			"triangle" => MsoArrowheadStyle.msoArrowheadTriangle, 
			"stealth" => MsoArrowheadStyle.msoArrowheadStealth, 
			_ => MsoArrowheadStyle.msoArrowheadNone, 
		};
	}

	private static void CaptureArrowheads(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle style)
	{
		MsoArrowheadStyle begin = shape.Line.BeginArrowheadStyle;
		MsoArrowheadStyle end = shape.Line.EndArrowheadStyle;
		bool hasBegin = begin != MsoArrowheadStyle.msoArrowheadNone;
		bool hasEnd = end != MsoArrowheadStyle.msoArrowheadNone;
		style.ArrowheadPosition = ((hasBegin && hasEnd) ? "both" : (hasBegin ? "start" : "end"));
		style.ArrowheadStyle = (hasEnd ? FromArrowheadStyle(end) : (hasBegin ? FromArrowheadStyle(begin) : "none"));
	}

	private static void ApplyArrowheads(Microsoft.Office.Interop.PowerPoint.LineFormat line, RoughStyle style)
	{
		MsoArrowheadStyle arrow = ToArrowheadStyle(style?.ArrowheadStyle);
		string position = (style?.ArrowheadPosition ?? "end").Trim().ToLowerInvariant();
		bool useBegin = arrow != MsoArrowheadStyle.msoArrowheadNone && (position == "start" || position == "both");
		bool useEnd = arrow != MsoArrowheadStyle.msoArrowheadNone && (position != "start" || position == "both");
		line.BeginArrowheadStyle = ((!useBegin) ? MsoArrowheadStyle.msoArrowheadNone : arrow);
		line.EndArrowheadStyle = ((!useEnd) ? MsoArrowheadStyle.msoArrowheadNone : arrow);
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

	private static string ToHex(int rgb)
	{
		return "#" + (rgb & 0xFF).ToString("X2") + ((rgb >> 8) & 0xFF).ToString("X2") + ((rgb >> 16) & 0xFF).ToString("X2");
	}
}
