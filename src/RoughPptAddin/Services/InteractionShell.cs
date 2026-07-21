using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public static class InteractionShell
{
	public static Microsoft.Office.Interop.PowerPoint.Shape Create(Slide slide, RoughShapeRequest request)
	{
		float width = ((request.Width <= 0f) ? 1f : request.Width);
		float height = ((request.Height <= 0f) ? 1f : request.Height);
		Microsoft.Office.Interop.PowerPoint.FreeformBuilder freeformBuilder = slide.Shapes.BuildFreeform(MsoEditingType.msoEditingAuto, request.Left, request.Top);
		freeformBuilder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, request.Left + width, request.Top);
		freeformBuilder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, request.Left + width, request.Top + height);
		freeformBuilder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, request.Left, request.Top + height);
		freeformBuilder.AddNodes(MsoSegmentType.msoSegmentLine, MsoEditingType.msoEditingAuto, request.Left, request.Top);
		Microsoft.Office.Interop.PowerPoint.Shape shape = freeformBuilder.ConvertToShape();
		shape.Name = "Rough_InteractionShell";
		shape.Fill.Visible = MsoTriState.msoFalse;
		shape.Line.Visible = MsoTriState.msoFalse;
		return shape;
	}
}
