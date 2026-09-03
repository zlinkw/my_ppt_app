using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using System.Text;
using System.Windows.Forms;
using System.Xml;
using Microsoft.Office.Core;
using RoughPptAddin.Models;
using RoughPptAddin.Services;

namespace RoughPptAddin.Ribbon;

[ComVisible(true)]
public class RoughRibbon : IRibbonExtensibility
{
	private struct FeatureDirectionCommand(string direction, int delta)
	{
		public string Direction { get; } = direction;

		public int Delta { get; } = delta;
	}

	private sealed class ShapeMenuGroup
	{
		public string Id { get; }

		public string Title { get; }

		public IReadOnlyList<ShapeMenuItem> Items { get; }

		public ShapeMenuGroup(string id, string title, params ShapeMenuItem[] items)
		{
			Id = id;
			Title = title;
			Items = items;
		}
	}

	private sealed class ShapeMenuItem
	{
		public string EnumName { get; }

		public string Label { get; }

		public string ImageMso { get; }

		public ShapeMenuItem(string enumName, string label, string imageMso)
		{
			EnumName = enumName;
			Label = label;
			ImageMso = imageMso;
		}
	}

	private static class ShapeIconFactory
	{
		private const int RibbonRenderScale = 2;

		public static object Create(string enumName, int width, int height, string identity = null)
		{
			Bitmap bitmap = CreateBitmap(enumName, width * 2, height * 2, identity, 2f);
			bitmap.SetResolution(192f, 192f);
			return PictureConverter.ToPicture(bitmap);
		}

		public static Bitmap CreateBitmap(string enumName, int width, int height, string identity = null, float drawingScale = 1f)
		{
			Bitmap bitmap = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
			using Graphics graphics = Graphics.FromImage(bitmap);
			using Pen pen = new Pen(Color.FromArgb(17, 17, 17), 2f);
			using SolidBrush fill = new SolidBrush(Color.Transparent);
			graphics.SmoothingMode = SmoothingMode.AntiAlias;
			graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
			graphics.Clear(Color.Transparent);
			graphics.ScaleTransform(drawingScale, drawingScale);
			float logicalWidth = (float)width / drawingScale;
			float logicalHeight = (float)height / drawingScale;
			DrawShape(bounds: new RectangleF(4.5f, 4.5f, logicalWidth - 9f, logicalHeight - 9f), graphics: graphics, pen: pen, fill: fill, enumName: enumName ?? string.Empty);
			return bitmap;
		}

		private static void DrawShape(Graphics graphics, Pen pen, Brush fill, string enumName, RectangleF bounds)
		{
			string name = enumName.ToLowerInvariant();
			if (name.StartsWith("rough3d", StringComparison.OrdinalIgnoreCase))
			{
				DrawThreeD(graphics, pen, name, bounds);
				return;
			}
			if (name.Contains("line") || name.Contains("connector"))
			{
				DrawLine(graphics, pen, bounds, name.Contains("arrow"));
				return;
			}
			if (name.Contains("mathplus"))
			{
				DrawPlus(graphics, pen, bounds);
				return;
			}
			if (name.Contains("mathminus"))
			{
				graphics.DrawLine(pen, bounds.Left + 4f, MidY(bounds), bounds.Right - 4f, MidY(bounds));
				return;
			}
			if (name.Contains("mathmultiply") || name.Contains("mathnotequal"))
			{
				graphics.DrawLine(pen, bounds.Left + 5f, bounds.Top + 5f, bounds.Right - 5f, bounds.Bottom - 5f);
				graphics.DrawLine(pen, bounds.Right - 5f, bounds.Top + 5f, bounds.Left + 5f, bounds.Bottom - 5f);
				return;
			}
			if (name.Contains("mathdivide"))
			{
				graphics.DrawLine(pen, bounds.Left + 4f, MidY(bounds), bounds.Right - 4f, MidY(bounds));
				graphics.FillEllipse(Brushes.White, MidX(bounds) - 2f, bounds.Top + 3f, 4f, 4f);
				graphics.DrawEllipse(pen, MidX(bounds) - 2f, bounds.Top + 3f, 4f, 4f);
				graphics.FillEllipse(Brushes.White, MidX(bounds) - 2f, bounds.Bottom - 7f, 4f, 4f);
				graphics.DrawEllipse(pen, MidX(bounds) - 2f, bounds.Bottom - 7f, 4f, 4f);
				return;
			}
			if (name.Contains("actionbutton"))
			{
				using (GraphicsPath path = RoundedRectangle(bounds, 3.5f))
				{
					graphics.FillPath(fill, path);
					graphics.DrawPath(pen, path);
				}
				DrawActionGlyph(graphics, pen, name, bounds);
				return;
			}
			using (GraphicsPath path2 = BuildClosedPath(name, bounds))
			{
				graphics.FillPath(fill, path2);
				graphics.DrawPath(pen, path2);
			}
			if (name.Contains("doubleoval"))
			{
				RectangleF inset = RectangleF.Inflate(bounds, -4f, -4f);
				graphics.DrawEllipse(pen, inset);
			}
		}

		private static GraphicsPath BuildClosedPath(string name, RectangleF b)
		{
			if (name.Contains("oval") || name.Contains("donut"))
			{
				GraphicsPath graphicsPath = new GraphicsPath();
				graphicsPath.AddEllipse(b);
				return graphicsPath;
			}
			if (name.Contains("rounded") || name.Contains("round"))
			{
				return RoundedRectangle(b, Math.Min(b.Width, b.Height) * 0.18f);
			}
			if (name.Contains("diamond") || name.Contains("decision"))
			{
				return Polygon(new PointF[4]
				{
					new PointF(MidX(b), b.Top),
					new PointF(b.Right, MidY(b)),
					new PointF(MidX(b), b.Bottom),
					new PointF(b.Left, MidY(b))
				});
			}
			if (name.Contains("triangle"))
			{
				return Polygon(new PointF[3]
				{
					new PointF(MidX(b), b.Top),
					new PointF(b.Right, b.Bottom),
					new PointF(b.Left, b.Bottom)
				});
			}
			if (name.Contains("trapezoid"))
			{
				return Polygon(new PointF[4]
				{
					new PointF(b.Left + b.Width * 0.2f, b.Top),
					new PointF(b.Right - b.Width * 0.2f, b.Top),
					new PointF(b.Right, b.Bottom),
					new PointF(b.Left, b.Bottom)
				});
			}
			if (name.Contains("parallelogram"))
			{
				return Polygon(new PointF[4]
				{
					new PointF(b.Left + b.Width * 0.2f, b.Top),
					new PointF(b.Right, b.Top),
					new PointF(b.Right - b.Width * 0.2f, b.Bottom),
					new PointF(b.Left, b.Bottom)
				});
			}
			if (name.Contains("pentagon"))
			{
				return RegularPolygon(b, 5, -90.0);
			}
			if (name.Contains("hexagon"))
			{
				return RegularPolygon(b, 6, 30.0);
			}
			if (name.Contains("octagon"))
			{
				return RegularPolygon(b, 8, 22.5);
			}
			if (name.Contains("10pointstar"))
			{
				return Star(b, 10);
			}
			if (name.Contains("12pointstar"))
			{
				return Star(b, 12);
			}
			if (name.Contains("16pointstar") || name.Contains("24pointstar") || name.Contains("32pointstar"))
			{
				return Star(b, 16);
			}
			if (name.Contains("star") || name.Contains("explosion"))
			{
				return Star(b, 5);
			}
			if (name.Contains("arrow"))
			{
				return BlockArrow(b);
			}
			if (name.Contains("callout"))
			{
				return Callout(b);
			}
			if (name.Contains("cloud"))
			{
				return Cloud(b);
			}
			if (name.Contains("chartplus"))
			{
				return ChartGlyph(b, "plus");
			}
			if (name.Contains("chartstar"))
			{
				return ChartGlyph(b, "star");
			}
			if (name.Contains("chartx"))
			{
				return ChartGlyph(b, "x");
			}
			if (name.Contains("flowchartofflinestorage"))
			{
				return OfflineStorage(b);
			}
			if (name.Contains("leftRightRibbon".ToLowerInvariant()))
			{
				return LeftRightRibbon(b);
			}
			if (name.Contains("curveddownribbon") || name.Contains("curvedupribbon") || name.Contains("ribbon"))
			{
				return Ribbon(b);
			}
			if (name.Contains("doublewave"))
			{
				return Wave(b, twice: true);
			}
			if (name.Contains("wave"))
			{
				return Wave(b, twice: false);
			}
			if (name.Contains("foldedcorner"))
			{
				return FoldedCorner(b);
			}
			if (name.Contains("halfframe"))
			{
				return HalfFrame(b);
			}
			if (name.Contains("frame"))
			{
				return Frame(b);
			}
			if (name.Contains("funnel"))
			{
				return Funnel(b);
			}
			if (name.Contains("gear6"))
			{
				return Gear(b, 6);
			}
			if (name.Contains("gear9"))
			{
				return Gear(b, 9);
			}
			if (name.Contains("scroll"))
			{
				return Scroll(b);
			}
			if (name.Contains("tabs"))
			{
				return Tabs(b);
			}
			if (name.Contains("heart"))
			{
				return Heart(b);
			}
			if (name.Contains("sun"))
			{
				return Star(b, 12);
			}
			if (name.Contains("moon"))
			{
				return Moon(b);
			}
			if (name.Contains("flowchartterminator"))
			{
				return RoundedRectangle(b, b.Height * 0.45f);
			}
			GraphicsPath graphicsPath2 = new GraphicsPath();
			graphicsPath2.AddRectangle(b);
			return graphicsPath2;
		}

		private static void DrawThreeD(Graphics graphics, Pen pen, string name, RectangleF b)
		{
			if (name.Contains("cylinder"))
			{
				graphics.DrawEllipse(pen, b.Left + b.Width * 0.12f, b.Top + b.Height * 0.08f, b.Width * 0.76f, b.Height * 0.26f);
				graphics.DrawLine(pen, b.Left + b.Width * 0.12f, b.Top + b.Height * 0.21f, b.Left + b.Width * 0.12f, b.Bottom - b.Height * 0.21f);
				graphics.DrawLine(pen, b.Right - b.Width * 0.12f, b.Top + b.Height * 0.21f, b.Right - b.Width * 0.12f, b.Bottom - b.Height * 0.21f);
				graphics.DrawArc(pen, b.Left + b.Width * 0.12f, b.Bottom - b.Height * 0.34f, b.Width * 0.76f, b.Height * 0.26f, 0f, 180f);
			}
			else if (name.Contains("cone"))
			{
				graphics.DrawLine(pen, MidX(b), b.Top + 2f, b.Left + b.Width * 0.14f, b.Bottom - b.Height * 0.18f);
				graphics.DrawLine(pen, MidX(b), b.Top + 2f, b.Right - b.Width * 0.14f, b.Bottom - b.Height * 0.18f);
				graphics.DrawArc(pen, b.Left + b.Width * 0.14f, b.Bottom - b.Height * 0.28f, b.Width * 0.72f, b.Height * 0.22f, 0f, 180f);
				graphics.DrawLine(pen, MidX(b), b.Top + 2f, MidX(b), b.Bottom - b.Height * 0.12f);
			}
			else if (name.Contains("sphere"))
			{
				graphics.DrawEllipse(pen, RectangleF.Inflate(b, -2f, -2f));
				graphics.DrawArc(pen, b.Left + 2f, b.Top + b.Height * 0.35f, b.Width - 4f, b.Height * 0.28f, 0f, 360f);
				graphics.DrawArc(pen, b.Left + b.Width * 0.34f, b.Top + 2f, b.Width * 0.32f, b.Height - 4f, 90f, 180f);
				graphics.DrawArc(pen, b.Left + b.Width * 0.34f, b.Top + 2f, b.Width * 0.32f, b.Height - 4f, -90f, 180f);
			}
			else if (name.Contains("pyramid"))
			{
				PointF top = new PointF(MidX(b), b.Top + 2f);
				PointF left = new PointF(b.Left + 2f, b.Bottom - 3f);
				PointF right = new PointF(b.Right - 2f, b.Bottom - 3f);
				PointF back = new PointF(b.Left + b.Width * 0.34f, b.Top + b.Height * 0.62f);
				graphics.DrawPolygon(pen, new PointF[3] { top, right, left });
				graphics.DrawLine(pen, top, back);
				graphics.DrawLine(pen, back, left);
				graphics.DrawLine(pen, back, right);
			}
			else if (name.Contains("stack"))
			{
				DrawCube(graphics, pen, new RectangleF(b.Left + b.Width * 0.18f, b.Top + 1f, b.Width * 0.72f, b.Height * 0.54f));
				DrawCube(graphics, pen, new RectangleF(b.Left + 1f, b.Top + b.Height * 0.34f, b.Width * 0.72f, b.Height * 0.54f));
			}
			else
			{
				DrawCube(graphics, pen, b);
			}
		}

		private static void DrawCube(Graphics graphics, Pen pen, RectangleF b)
		{
			PointF a = new PointF(b.Left + b.Width * 0.08f, b.Top + b.Height * 0.3f);
			PointF d = new PointF(b.Left + b.Width * 0.32f, b.Top + b.Height * 0.08f);
			PointF c = new PointF(b.Right - b.Width * 0.08f, b.Top + b.Height * 0.08f);
			PointF g = new PointF(b.Right - b.Width * 0.08f, b.Bottom - b.Height * 0.28f);
			PointF f = new PointF(b.Left + b.Width * 0.68f, b.Bottom - b.Height * 0.08f);
			PointF e = new PointF(b.Left + b.Width * 0.08f, b.Bottom - b.Height * 0.08f);
			PointF frontTopRight = new PointF(b.Left + b.Width * 0.68f, b.Top + b.Height * 0.3f);
			graphics.DrawPolygon(pen, new PointF[6] { d, c, g, f, e, a });
			graphics.DrawLine(pen, a, frontTopRight);
			graphics.DrawLine(pen, frontTopRight, c);
			graphics.DrawLine(pen, frontTopRight, f);
		}

		private static GraphicsPath Polygon(PointF[] points)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddPolygon(points);
			return graphicsPath;
		}

		private static GraphicsPath RegularPolygon(RectangleF b, int count, double startDegrees)
		{
			List<PointF> points = new List<PointF>();
			float radius = Math.Min(b.Width, b.Height) / 2f;
			for (int i = 0; i < count; i++)
			{
				double angle = Math.PI / 180.0 * (startDegrees + (double)i * 360.0 / (double)count);
				points.Add(new PointF(MidX(b) + (float)Math.Cos(angle) * radius, MidY(b) + (float)Math.Sin(angle) * radius));
			}
			return Polygon(points.ToArray());
		}

		private static GraphicsPath Star(RectangleF b, int points)
		{
			List<PointF> values = new List<PointF>();
			float outer = Math.Min(b.Width, b.Height) / 2f;
			float inner = outer * 0.45f;
			for (int i = 0; i < points * 2; i++)
			{
				float radius = ((i % 2 == 0) ? outer : inner);
				double angle = -Math.PI / 2.0 + (double)i * Math.PI / (double)points;
				values.Add(new PointF(MidX(b) + (float)Math.Cos(angle) * radius, MidY(b) + (float)Math.Sin(angle) * radius));
			}
			return Polygon(values.ToArray());
		}

		private static GraphicsPath ChartGlyph(RectangleF b, string glyph)
		{
			GraphicsPath path = new GraphicsPath();
			path.AddEllipse(b);
			RectangleF inner = RectangleF.Inflate(b, (0f - b.Width) * 0.26f, (0f - b.Height) * 0.26f);
			if (glyph == "plus")
			{
				path.StartFigure();
				path.AddLine(MidX(inner), inner.Top, MidX(inner), inner.Bottom);
				path.StartFigure();
				path.AddLine(inner.Left, MidY(inner), inner.Right, MidY(inner));
			}
			else if (glyph == "x")
			{
				path.StartFigure();
				path.AddLine(inner.Left, inner.Top, inner.Right, inner.Bottom);
				path.StartFigure();
				path.AddLine(inner.Right, inner.Top, inner.Left, inner.Bottom);
			}
			else
			{
				using GraphicsPath star = Star(inner, 5);
				path.AddPath(star, connect: false);
			}
			return path;
		}

		private static GraphicsPath OfflineStorage(RectangleF b)
		{
			return Polygon(new PointF[5]
			{
				new PointF(b.Left + b.Width * 0.18f, b.Top),
				new PointF(b.Right, b.Top),
				new PointF(b.Right - b.Width * 0.18f, b.Bottom),
				new PointF(b.Left, b.Bottom),
				new PointF(b.Left + b.Width * 0.18f, b.Top)
			});
		}

		private static GraphicsPath LeftRightRibbon(RectangleF b)
		{
			return Polygon(new PointF[6]
			{
				new PointF(b.Left, b.Top + b.Height * 0.24f),
				new PointF(b.Left + b.Width * 0.18f, MidY(b)),
				new PointF(b.Left, b.Bottom - b.Height * 0.24f),
				new PointF(b.Right, b.Bottom - b.Height * 0.24f),
				new PointF(b.Right - b.Width * 0.18f, MidY(b)),
				new PointF(b.Right, b.Top + b.Height * 0.24f)
			});
		}

		private static GraphicsPath Ribbon(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddBezier(b.Left, b.Top + b.Height * 0.34f, b.Left + b.Width * 0.28f, b.Top, b.Right - b.Width * 0.28f, b.Bottom, b.Right, b.Top + b.Height * 0.32f);
			graphicsPath.AddLine(b.Right, b.Bottom - b.Height * 0.24f, b.Left, b.Bottom - b.Height * 0.24f);
			graphicsPath.CloseFigure();
			return graphicsPath;
		}

		private static GraphicsPath Wave(RectangleF b, bool twice)
		{
			GraphicsPath path = new GraphicsPath();
			float y = (twice ? (b.Top + b.Height * 0.36f) : MidY(b));
			path.AddBezier(b.Left, y, b.Left + b.Width * 0.25f, y - b.Height * 0.28f, b.Left + b.Width * 0.25f, y + b.Height * 0.28f, MidX(b), y);
			path.AddBezier(MidX(b), y, b.Left + b.Width * 0.75f, y - b.Height * 0.28f, b.Left + b.Width * 0.75f, y + b.Height * 0.28f, b.Right, y);
			if (twice)
			{
				float y2 = b.Top + b.Height * 0.64f;
				path.StartFigure();
				path.AddBezier(b.Left, y2, b.Left + b.Width * 0.25f, y2 - b.Height * 0.28f, b.Left + b.Width * 0.25f, y2 + b.Height * 0.28f, MidX(b), y2);
				path.AddBezier(MidX(b), y2, b.Left + b.Width * 0.75f, y2 - b.Height * 0.28f, b.Left + b.Width * 0.75f, y2 + b.Height * 0.28f, b.Right, y2);
			}
			return path;
		}

		private static GraphicsPath FoldedCorner(RectangleF b)
		{
			GraphicsPath graphicsPath = Polygon(new PointF[5]
			{
				new PointF(b.Left, b.Top),
				new PointF(b.Right - b.Width * 0.24f, b.Top),
				new PointF(b.Right, b.Top + b.Height * 0.24f),
				new PointF(b.Right, b.Bottom),
				new PointF(b.Left, b.Bottom)
			});
			graphicsPath.StartFigure();
			graphicsPath.AddLine(b.Right - b.Width * 0.24f, b.Top, b.Right - b.Width * 0.24f, b.Top + b.Height * 0.24f);
			graphicsPath.AddLine(b.Right - b.Width * 0.24f, b.Top + b.Height * 0.24f, b.Right, b.Top + b.Height * 0.24f);
			return graphicsPath;
		}

		private static GraphicsPath Frame(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddRectangle(b);
			graphicsPath.AddRectangle(RectangleF.Inflate(b, (0f - b.Width) * 0.2f, (0f - b.Height) * 0.2f));
			return graphicsPath;
		}

		private static GraphicsPath HalfFrame(RectangleF b)
		{
			return Polygon(new PointF[6]
			{
				new PointF(b.Left, b.Top),
				new PointF(b.Right, b.Top),
				new PointF(b.Right, b.Top + b.Height * 0.24f),
				new PointF(b.Left + b.Width * 0.24f, b.Top + b.Height * 0.24f),
				new PointF(b.Left + b.Width * 0.24f, b.Bottom),
				new PointF(b.Left, b.Bottom)
			});
		}

		private static GraphicsPath Funnel(RectangleF b)
		{
			return Polygon(new PointF[6]
			{
				new PointF(b.Left, b.Top),
				new PointF(b.Right, b.Top),
				new PointF(b.Left + b.Width * 0.62f, b.Top + b.Height * 0.54f),
				new PointF(b.Left + b.Width * 0.62f, b.Bottom),
				new PointF(b.Left + b.Width * 0.38f, b.Bottom),
				new PointF(b.Left + b.Width * 0.38f, b.Top + b.Height * 0.54f)
			});
		}

		private static GraphicsPath Gear(RectangleF b, int teeth)
		{
			List<PointF> values = new List<PointF>();
			float outerX = b.Width / 2f;
			float outerY = b.Height / 2f;
			for (int i = 0; i < teeth * 4; i++)
			{
				float radius = ((i % 4 == 0 || i % 4 == 3) ? 1f : 0.72f);
				double angle = -Math.PI / 2.0 + (double)i * 2.0 * Math.PI / (double)(teeth * 4);
				values.Add(new PointF(MidX(b) + (float)Math.Cos(angle) * outerX * radius, MidY(b) + (float)Math.Sin(angle) * outerY * radius));
			}
			return Polygon(values.ToArray());
		}

		private static GraphicsPath Scroll(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddRectangle(new RectangleF(b.Left + b.Width * 0.12f, b.Top + b.Height * 0.18f, b.Width * 0.76f, b.Height * 0.64f));
			graphicsPath.AddArc(b.Left, b.Top + b.Height * 0.08f, b.Width * 0.28f, b.Height * 0.28f, 90f, 270f);
			graphicsPath.AddArc(b.Right - b.Width * 0.28f, b.Bottom - b.Height * 0.36f, b.Width * 0.28f, b.Height * 0.28f, -90f, 270f);
			return graphicsPath;
		}

		private static GraphicsPath Tabs(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddRectangle(b);
			graphicsPath.StartFigure();
			graphicsPath.AddLine(b.Left + b.Width * 0.3f, b.Top, b.Left + b.Width * 0.3f, b.Top + b.Height * 0.28f);
			graphicsPath.AddLine(b.Left, b.Top + b.Height * 0.28f, b.Left + b.Width * 0.3f, b.Top + b.Height * 0.28f);
			graphicsPath.StartFigure();
			graphicsPath.AddLine(b.Right - b.Width * 0.3f, b.Bottom, b.Right - b.Width * 0.3f, b.Bottom - b.Height * 0.28f);
			graphicsPath.AddLine(b.Right, b.Bottom - b.Height * 0.28f, b.Right - b.Width * 0.3f, b.Bottom - b.Height * 0.28f);
			return graphicsPath;
		}

		private static GraphicsPath BlockArrow(RectangleF b)
		{
			return Polygon(new PointF[7]
			{
				new PointF(b.Left, b.Top + b.Height * 0.32f),
				new PointF(b.Left + b.Width * 0.58f, b.Top + b.Height * 0.32f),
				new PointF(b.Left + b.Width * 0.58f, b.Top),
				new PointF(b.Right, MidY(b)),
				new PointF(b.Left + b.Width * 0.58f, b.Bottom),
				new PointF(b.Left + b.Width * 0.58f, b.Top + b.Height * 0.68f),
				new PointF(b.Left, b.Top + b.Height * 0.68f)
			});
		}

		private static GraphicsPath Callout(RectangleF b)
		{
			return Polygon(new PointF[7]
			{
				new PointF(b.Left, b.Top),
				new PointF(b.Right, b.Top),
				new PointF(b.Right, b.Top + b.Height * 0.72f),
				new PointF(b.Left + b.Width * 0.55f, b.Top + b.Height * 0.72f),
				new PointF(b.Left + b.Width * 0.34f, b.Bottom),
				new PointF(b.Left + b.Width * 0.34f, b.Top + b.Height * 0.72f),
				new PointF(b.Left, b.Top + b.Height * 0.72f)
			});
		}

		private static GraphicsPath Cloud(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddEllipse(b.Left, b.Top + b.Height * 0.28f, b.Width * 0.38f, b.Height * 0.48f);
			graphicsPath.AddEllipse(b.Left + b.Width * 0.22f, b.Top + b.Height * 0.08f, b.Width * 0.42f, b.Height * 0.58f);
			graphicsPath.AddEllipse(b.Left + b.Width * 0.48f, b.Top + b.Height * 0.24f, b.Width * 0.42f, b.Height * 0.5f);
			graphicsPath.AddRectangle(new RectangleF(b.Left + b.Width * 0.18f, b.Top + b.Height * 0.46f, b.Width * 0.62f, b.Height * 0.3f));
			return graphicsPath;
		}

		private static GraphicsPath Heart(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddBezier(MidX(b), b.Bottom, b.Left - b.Width * 0.12f, b.Top + b.Height * 0.42f, b.Left + b.Width * 0.18f, b.Top, MidX(b), b.Top + b.Height * 0.28f);
			graphicsPath.AddBezier(MidX(b), b.Top + b.Height * 0.28f, b.Right - b.Width * 0.18f, b.Top, b.Right + b.Width * 0.12f, b.Top + b.Height * 0.42f, MidX(b), b.Bottom);
			graphicsPath.CloseFigure();
			return graphicsPath;
		}

		private static GraphicsPath Moon(RectangleF b)
		{
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddArc(b, 90f, 180f);
			graphicsPath.AddBezier(MidX(b), b.Bottom, b.Right - b.Width * 0.1f, b.Bottom - b.Height * 0.25f, b.Right - b.Width * 0.1f, b.Top + b.Height * 0.25f, MidX(b), b.Top);
			graphicsPath.CloseFigure();
			return graphicsPath;
		}

		private static GraphicsPath RoundedRectangle(RectangleF b, float radius)
		{
			float d = Math.Max(1f, radius * 2f);
			GraphicsPath graphicsPath = new GraphicsPath();
			graphicsPath.AddArc(b.Left, b.Top, d, d, 180f, 90f);
			graphicsPath.AddArc(b.Right - d, b.Top, d, d, 270f, 90f);
			graphicsPath.AddArc(b.Right - d, b.Bottom - d, d, d, 0f, 90f);
			graphicsPath.AddArc(b.Left, b.Bottom - d, d, d, 90f, 90f);
			graphicsPath.CloseFigure();
			return graphicsPath;
		}

		private static void DrawLine(Graphics graphics, Pen pen, RectangleF b, bool arrow)
		{
			graphics.DrawLine(pen, b.Left + 2f, b.Bottom - 4f, b.Right - 3f, b.Top + 4f);
			if (arrow)
			{
				PointF tip = new PointF(b.Right - 3f, b.Top + 4f);
				graphics.DrawLine(pen, tip, new PointF(tip.X - 8f, tip.Y + 1f));
				graphics.DrawLine(pen, tip, new PointF(tip.X - 2f, tip.Y + 8f));
			}
		}

		private static void DrawPlus(Graphics graphics, Pen pen, RectangleF b)
		{
			graphics.DrawLine(pen, MidX(b), b.Top + 3f, MidX(b), b.Bottom - 3f);
			graphics.DrawLine(pen, b.Left + 3f, MidY(b), b.Right - 3f, MidY(b));
		}

		private static void DrawActionGlyph(Graphics graphics, Pen pen, string name, RectangleF b)
		{
			if (name.Contains("home"))
			{
				using (GraphicsPath path = Polygon(new PointF[5]
				{
					new PointF(MidX(b), b.Top + 6f),
					new PointF(b.Right - 7f, MidY(b)),
					new PointF(b.Right - 8f, b.Bottom - 7f),
					new PointF(b.Left + 8f, b.Bottom - 7f),
					new PointF(b.Left + 7f, MidY(b))
				}))
				{
					graphics.DrawPath(pen, path);
					return;
				}
			}
			if (name.Contains("information"))
			{
				graphics.DrawString("i", new Font("Segoe UI", 12f, FontStyle.Bold), Brushes.Black, MidX(b) - 3f, MidY(b) - 9f);
			}
			else
			{
				DrawLine(graphics, pen, RectangleF.Inflate(b, -7f, -7f), arrow: true);
			}
		}

		private static float MidX(RectangleF b)
		{
			return b.Left + b.Width / 2f;
		}

		private static float MidY(RectangleF b)
		{
			return b.Top + b.Height / 2f;
		}
	}

	private static class FunctionalIconFactory
	{
		public static object Create(string controlId, int width, int height)
		{
			return MaterialSymbolIconFactory.Create(MaterialSymbolIconFactory.SymbolForControl(controlId), width, height, Color.FromArgb(35, 43, 54));
		}
	}

	private static class ShortcutIconFactory
	{
		public static object Create(string shortcutId, int width, int height)
		{
			return Create(shortcutId, shortcutId, width, height);
		}

		public static object Create(string shortcutId, string controlId, int width, int height)
		{
			return MaterialSymbolIconFactory.Create(MaterialSymbolIconFactory.SymbolForShortcut(shortcutId), width, height, AccentColor(shortcutId));
		}

		private static Color AccentColor(string shortcutId)
		{
			if (string.Equals(shortcutId, "strokeBlackShortcut", StringComparison.OrdinalIgnoreCase))
			{
				return Color.Black;
			}
			if (string.Equals(shortcutId, "strokeBlueShortcut", StringComparison.OrdinalIgnoreCase))
			{
				return Color.FromArgb(15, 108, 189);
			}
			if (string.Equals(shortcutId, "strokeRedShortcut", StringComparison.OrdinalIgnoreCase))
			{
				return Color.FromArgb(196, 43, 28);
			}
			if (string.Equals(shortcutId, "strokeGreenShortcut", StringComparison.OrdinalIgnoreCase))
			{
				return Color.FromArgb(16, 124, 65);
			}
			return Color.FromArgb(35, 43, 54);
		}
	}

	private static class StylePresetIconFactory
	{
		public static object Create(string presetId, int width, int height)
		{
			return Create(presetId, presetId, width, height);
		}

		public static object Create(string presetId, string controlId, int width, int height)
		{
			return MaterialSymbolIconFactory.Create(MaterialSymbolIconFactory.SymbolForStylePreset(presetId), width, height, Color.FromArgb(35, 43, 54));
		}
	}

	private static class LibraryIconFactory
	{
		public static object Create(int width, int height)
		{
			return Create("openPane", width, height);
		}

		public static object Create(string controlId, int width, int height)
		{
			return MaterialSymbolIconFactory.Create(MaterialSymbolIconFactory.SymbolForLibraryControl(controlId), width, height, Color.FromArgb(35, 43, 54));
		}
	}

	private static class MaterialSymbolIconFactory
	{
		private const string FontResourceName = "RoughPptAddin.Resources.MaterialSymbolsRounded.subset.ttf";

		private const int RibbonRenderScale = 2;

		private static readonly PrivateFontCollection FontCollection;

		private static readonly Dictionary<string, object> ImageCache;

		private static readonly object ImageCacheSync;

		private static readonly byte[] FontBytes;

		private static readonly IntPtr FontMemory;

		public const char Neurology = '\ue10e';

		public const char Check = '\ue668';

		public const char ArrowForward = '\ue5c8';

		public const char Inventory = '\ue1a1';

		public const char Brush = '\ue3ae';

		public const char SelectAll = '\ue162';

		public const char Monitoring = '\uf190';

		public const char Close = '\ue5cd';

		public const char Stylus = '\uf604';

		public const char Download = '\uf090';

		public const char ViewInAr = '\uefc9';

		public const char FormatColorFill = '\ue23a';

		public const char FolderOpen = '\ue2c8';

		public const char Image = '\ue3f4';

		public const char Info = '\ue88e';

		public const char AddBox = '\ue146';

		public const char Layers = '\ue53b';

		public const char LocalLibrary = '\ue54b';

		public const char History = '\ue8b3';

		public const char ArrowCircleRight = '\ueaaa';

		public const char FormatColorReset = '\ue23b';

		public const char Palette = '\ue40a';

		public const char AccountTree = '\ue97a';

		public const char Edit = '\uf097';

		public const char Add = '\ue145';

		public const char Refresh = '\ue5d5';

		public const char Sync = '\ue627';

		public const char Save = '\ue161';

		public const char Search = '\uef7a';

		public const char Category = '\ue72c';

		public const char Share = '\ue80d';

		public const char AutoAwesome = '\ue65f';

		public const char BorderColor = '\ue22b';

		public const char Tune = '\ue429';

		public const char DashboardCustomize = '\ue99b';

		public const char Delete = '\ue92e';

		public const char Upload = '\uf09b';

		public const char Gesture = '\ue155';

		public const char Article = '\uef87';

		public const char Draw = '\ue746';

		public const char Texture = '\ue421';

		public const char StylusNote = '\uf603';

		public const char Schema = '\ue4fd';

		public const char InkMarker = '\ue6d2';

		public const char ScatterPlot = '\ue268';

		public const char Grain = '\ue3ea';

		public const char GridOn = '\ue3ec';

		public const char GridView = '\ue9b0';

		public const char Width = '\uf730';

		public const char Square = '\ueb36';

		public const char ArrowBack = '\ue5c4';

		public const char ArrowUpward = '\ue5d8';

		public const char ArrowDownward = '\ue5db';

		public const char ArrowOutward = '\uf8ce';

		public const char Remove = '\ue15b';

		public const char MoreHoriz = '\ue5d3';

		public const char Menu = '\ue5d2';

		public const char DockToRight = '\uf7e4';

		public const char Apps = '\ue5c3';

		public const char FormatShapes = '\ue25e';

		public const char Favorite = '\ue87e';

		public const char Dataset = '\uf8ee';

		public const char FormatPaint = '\ue243';

		public const char FormatInkHighlighter = '\uf82b';

		public const char InkPen = '\ue6d3';

		public const char LineStyle = '\ue919';

		static MaterialSymbolIconFactory()
		{
			FontCollection = new PrivateFontCollection();
			ImageCache = new Dictionary<string, object>(StringComparer.Ordinal);
			ImageCacheSync = new object();
			using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("RoughPptAddin.Resources.MaterialSymbolsRounded.subset.ttf"))
			{
				if (stream == null)
				{
					throw new InvalidOperationException("Material Symbols Rounded font resource is missing.");
				}
				FontBytes = new byte[checked((int)stream.Length)];
				int read;
				for (int offset = 0; offset < FontBytes.Length; offset += read)
				{
					read = stream.Read(FontBytes, offset, FontBytes.Length - offset);
					if (read <= 0)
					{
						break;
					}
				}
			}
			FontMemory = Marshal.AllocCoTaskMem(FontBytes.Length);
			Marshal.Copy(FontBytes, 0, FontMemory, FontBytes.Length);
			FontCollection.AddMemoryFont(FontMemory, FontBytes.Length);
			if (FontCollection.Families.Length == 0)
			{
				throw new InvalidOperationException("Material Symbols Rounded static font could not be loaded by GDI+.");
			}
		}

		public static object Create(char symbol, int width, int height, Color color)
		{
			string[] array = new string[7];
			int num = symbol;
			array[0] = num.ToString("X4");
			array[1] = "|";
			array[2] = color.ToArgb().ToString();
			array[3] = "|";
			array[4] = width.ToString();
			array[5] = "x";
			array[6] = height.ToString();
			string cacheKey = string.Concat(array);
			lock (ImageCacheSync)
			{
				if (ImageCache.TryGetValue(cacheKey, out var cached))
				{
					return cached;
				}
			}
			int renderWidth = width * 2;
			int renderHeight = height * 2;
			Bitmap bitmap = new Bitmap(renderWidth, renderHeight, PixelFormat.Format32bppPArgb);
			bitmap.SetResolution(192f, 192f);
			using (Graphics graphics = Graphics.FromImage(bitmap))
			{
				using SolidBrush brush = new SolidBrush(color);
				using Font font = new Font(FontCollection.Families[0], (float)renderHeight * 0.8f, FontStyle.Regular, GraphicsUnit.Pixel);
				using StringFormat format = (StringFormat)StringFormat.GenericTypographic.Clone();
				graphics.Clear(Color.Transparent);
				graphics.SmoothingMode = SmoothingMode.AntiAlias;
				graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
				graphics.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
				format.Alignment = StringAlignment.Center;
				format.LineAlignment = StringAlignment.Center;
				graphics.DrawString(symbol.ToString(), font, brush, new RectangleF(0f, -1f, renderWidth, renderHeight), format);
			}
			object picture = PictureConverter.ToPicture(bitmap);
			lock (ImageCacheSync)
			{
				ImageCache[cacheKey] = picture;
				return picture;
			}
		}

		public static void WarmUp()
		{
			Create('\ue5c3', 32, 32, Color.FromArgb(35, 43, 54));
		}

		public static char SymbolForLibraryControl(string controlId)
		{
			string id = (controlId ?? string.Empty).ToLowerInvariant();
			if (ContainsAny(id, "recent"))
			{
				return '\ue8b3';
			}
			if (ContainsAny(id, "asset"))
			{
				return '\ue1a1';
			}
			if (ContainsAny(id, "pane", "open"))
			{
				return '\uf7e4';
			}
			return '\ue54b';
		}

		public static char SymbolForControl(string controlId)
		{
			string id = (controlId ?? string.Empty).ToLowerInvariant();
			switch (id)
			{
			case "compactcommonmenu":
				return '\ue5c3';
			case "compactselectionmenu":
				return '\ue162';
			case "papersuitemenu":
				return '\ue97a';
			case "paperstructurepresetmenu":
				return '\ue10e';
			case "startassettoolsmenu":
				return '\ue1a1';
			case "startfeatureblockmenu":
				return '\ue9b0';
			case "primarymoremenu":
				return '\ue5d3';
			case "quickshapemanagemenu":
				return '\ue87e';
			case "featuremorepresetmenu":
				return '\ue5d3';
			case "featuredirectionmenu":
				return '\uf8ce';
			default:
				if (ContainsAny(id, "search", "find"))
				{
					return '\uef7a';
				}
				if (ContainsAny(id, "delete", "remove"))
				{
					return '\ue92e';
				}
				if (ContainsAny(id, "close"))
				{
					return '\ue5cd';
				}
				if (ContainsAny(id, "import", "download"))
				{
					return '\uf090';
				}
				if (ContainsAny(id, "export", "share"))
				{
					return '\ue80d';
				}
				if (ContainsAny(id, "save"))
				{
					return '\ue161';
				}
				if (ContainsAny(id, "refresh", "redraw"))
				{
					return '\ue5d5';
				}
				if (ContainsAny(id, "convert", "rough", "scribble"))
				{
					return '\uf604';
				}
				if (ContainsAny(id, "inspect", "info", "empty"))
				{
					return '\ue88e';
				}
				if (ContainsAny(id, "next", "forward"))
				{
					return '\ueaaa';
				}
				if (ContainsAny(id, "carrier", "select", "selection"))
				{
					return '\ue162';
				}
				if (ContainsAny(id, "asset", "library", "recentasset"))
				{
					return '\ue1a1';
				}
				if (ContainsAny(id, "chart", "plot", "zlk"))
				{
					return '\uf190';
				}
				if (ContainsAny(id, "zotero", "image"))
				{
					return '\ue3f4';
				}
				if (ContainsAny(id, "palette", "color"))
				{
					return '\ue40a';
				}
				if (ContainsAny(id, "left"))
				{
					return '\ue5c4';
				}
				if (ContainsAny(id, "right"))
				{
					return '\ue5c8';
				}
				if (ContainsAny(id, "up"))
				{
					return '\ue5d8';
				}
				if (ContainsAny(id, "down"))
				{
					return '\ue5db';
				}
				if (ContainsAny(id, "front", "back"))
				{
					return '\uf8ce';
				}
				if (ContainsAny(id, "gap"))
				{
					return '\uf730';
				}
				if (ContainsAny(id, "round"))
				{
					return '\ueb36';
				}
				if (ContainsAny(id, "gradient"))
				{
					return '\ue40a';
				}
				if (ContainsAny(id, "volume", "3d", "stack"))
				{
					return '\uefc9';
				}
				if (ContainsAny(id, "attention", "matrix", "grid"))
				{
					return '\ue3ec';
				}
				if (ContainsAny(id, "feature"))
				{
					return '\ue9b0';
				}
				if (ContainsAny(id, "paper", "preset", "medical", "ai", "structure"))
				{
					return '\ue97a';
				}
				if (ContainsAny(id, "fill"))
				{
					return '\ue23a';
				}
				if (ContainsAny(id, "stroke", "line"))
				{
					return '\ue22b';
				}
				if (ContainsAny(id, "style", "template", "combo"))
				{
					return '\ue429';
				}
				if (ContainsAny(id, "shape", "catalog", "gallery"))
				{
					return '\ue72c';
				}
				if (ContainsAny(id, "pane", "window", "open"))
				{
					return '\uf7e4';
				}
				if (ContainsAny(id, "quick", "pin", "favorite", "add"))
				{
					return '\ue146';
				}
				if (ContainsAny(id, "menu", "more", "common"))
				{
					return '\ue5d2';
				}
				return '\ue65f';
			}
		}

		public static char SymbolForShortcut(string shortcutId)
		{
			string id = (shortcutId ?? string.Empty).ToLowerInvariant();
			if (ContainsAny(id, "fillnone"))
			{
				return '\ue23b';
			}
			if (ContainsAny(id, "fill"))
			{
				return '\ue23a';
			}
			if (ContainsAny(id, "arrow"))
			{
				return '\ue5c8';
			}
			if (ContainsAny(id, "line", "dash"))
			{
				return '\ue919';
			}
			if (ContainsAny(id, "stroke"))
			{
				return '\ue22b';
			}
			if (ContainsAny(id, "template"))
			{
				return '\ue99b';
			}
			if (ContainsAny(id, "asset"))
			{
				return '\ue1a1';
			}
			if (ContainsAny(id, "boundary", "source", "brush"))
			{
				return '\ue6d3';
			}
			return '\ue429';
		}

		public static char SymbolForStylePreset(string presetId)
		{
			string id = (presetId ?? string.Empty).ToLowerInvariant();
			if (ContainsAny(id, "gentle"))
			{
				return '\ue155';
			}
			if (ContainsAny(id, "paper"))
			{
				return '\uef87';
			}
			if (ContainsAny(id, "bold"))
			{
				return '\ue746';
			}
			if (ContainsAny(id, "nested"))
			{
				return '\ue53b';
			}
			if (ContainsAny(id, "textured"))
			{
				return '\ue421';
			}
			if (ContainsAny(id, "roughjs"))
			{
				return '\uf603';
			}
			if (ContainsAny(id, "excalidraw"))
			{
				return '\uf82b';
			}
			if (ContainsAny(id, "drawio"))
			{
				return '\ue97a';
			}
			if (ContainsAny(id, "d2"))
			{
				return '\ue4fd';
			}
			if (ContainsAny(id, "tldraw"))
			{
				return '\ue6d2';
			}
			if (ContainsAny(id, "brush"))
			{
				return '\ue3ae';
			}
			if (ContainsAny(id, "densefragments"))
			{
				return '\ue3ea';
			}
			if (ContainsAny(id, "fragments"))
			{
				return '\ue268';
			}
			return '\ue243';
		}

		private static bool ContainsAny(string value, params string[] needles)
		{
			return needles.Any((string needle) => value.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0);
		}
	}

	private sealed class PictureConverter : AxHost
	{
		private PictureConverter()
			: base(string.Empty)
		{
		}

		public static object ToPicture(Image image)
		{
			return AxHost.GetIPictureDispFromPicture(image);
		}
	}

	private const string ShapePrefix = "roughShape_";

	private const string QuickShapePrefix = "quickShape_";

	private const string QuickRemovePrefix = "quickRemove_";

	private const string RecentAssetPrefix = "recentAsset_";

	private const int MaxRibbonQuickShapes = 12;

	private const int MaxRibbonRecentAssets = 12;

	private static readonly string[] StylePresetIds = new string[21]
	{
		"stylePresetGentle", "stylePresetPaper", "stylePresetBold", "stylePresetNested", "stylePresetTextured", "stylePresetRoughJs", "stylePresetExcalidraw", "stylePresetDrawio", "stylePresetD2", "stylePresetTldraw",
		"stylePresetBrush", "stylePresetFragments", "stylePresetDenseFragments", "startStyleRoughJs", "startStyleExcalidraw", "startStyleDrawio", "startStyleD2", "startStyleTldraw", "startStyleBrush", "startStyleFragments",
		"startStyleDenseFragments"
	};

	private static readonly string[] VisibleStylePresetControlIds = new string[8] { "startStyleRoughJs", "startStyleExcalidraw", "startStyleDrawio", "startStyleD2", "startStyleTldraw", "startStyleBrush", "startStyleFragments", "startStyleDenseFragments" };

	private static RoughRibbon activeInstance;

	private readonly Func<RoughAddInController> getController;

	private readonly Dictionary<string, object> shapeImageCache = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

	private IRibbonUI ribbon;

	private ShapeGalleryWindow shapeGalleryWindow;

	private string currentStylePresetId = "stylePresetPaper";

	private const string RibbonXmlNamespace = "http://schemas.microsoft.com/office/2009/07/customui";

	private static readonly IReadOnlyList<ShapeMenuGroup> ShapeMenuGroups = new ShapeMenuGroup[9]
	{
		new ShapeMenuGroup("Recent", "最近使用的形状", S("msoShapeRectangle", "矩形", "ShapeRectangle"), S("msoShapeRoundedRectangle", "圆角矩形", "ShapeRoundedRectangle"), S("msoShapeOval", "椭圆", "ShapeOval"), S("msoShapeLine", "直线", "ShapeLine"), S("msoShapeLineArrow", "直线箭头", "ShapeLineArrow"), S("msoShapeRightArrow", "右箭头", "ShapeRightArrow"), S("msoShapeDiamond", "菱形", "ShapeDiamond"), S("msoShapeIsoscelesTriangle", "三角形", "ShapeIsoscelesTriangle")),
		new ShapeMenuGroup("Lines", "线条", S("msoShapeLine", "直线", "ShapeLine"), S("msoShapeLineArrow", "直线箭头", "ShapeLineArrow"), S("msoShapeCurve", "曲线", "ShapeCurve"), S("msoShapeStraightConnector", "直线连接符", "ShapeStraightConnector"), S("msoShapeElbowConnector", "肘形连接符", "ShapeElbowConnector"), S("msoShapeCurvedConnector", "曲线连接符", "ShapeCurveConnector"), S("msoShapeArc", "弧线", "ShapeArc"), S("msoShapeBlockArc", "块弧", "ShapeBlockArc")),
		new ShapeMenuGroup("Rectangles", "矩形", S("msoShapeRectangle", "矩形", "ShapeRectangle"), S("msoShapeRoundedRectangle", "圆角矩形", "ShapeRoundedRectangle"), S("msoShapeRound1Rectangle", "单圆角矩形", "ShapeRound1Rectangle"), S("msoShapeRound2SameRectangle", "双同侧圆角矩形", "ShapeRound2SameRectangle"), S("msoShapeRound2DiagRectangle", "双对角圆角矩形", "ShapeRound2DiagRectangle"), S("msoShapeSnip1Rectangle", "单剪角矩形", "ShapeSnip1Rectangle"), S("msoShapeSnip2SameRectangle", "双同侧剪角矩形", "ShapeSnip2SameRectangle"), S("msoShapeSnip2DiagRectangle", "双对角剪角矩形", "ShapeSnip2DiagRectangle"), S("msoShapeSnipRoundRectangle", "剪角圆角矩形", "ShapeSnipRoundRectangle"), S("msoShapeDashedRectangle", "虚线框", "ShapeRectangle")),
		new ShapeMenuGroup("Basic", "基本形状", S("msoShapeOval", "椭圆", "ShapeOval"), S("msoShapeIsoscelesTriangle", "等腰三角形", "ShapeIsoscelesTriangle"), S("msoShapeRightTriangle", "直角三角形", "ShapeRightTriangle"), S("msoShapeParallelogram", "平行四边形", "ShapeParallelogram"), S("msoShapeTrapezoid", "梯形", "ShapeTrapezoid"), S("msoShapeDiamond", "菱形", "ShapeDiamond"), S("msoShapePentagon", "五边形", "ShapePentagon"), S("msoShapeHexagon", "六边形", "ShapeHexagon"), S("msoShapeOctagon", "八边形", "ShapeOctagon"), S("msoShapeCube", "立方体", "ShapeCube"), S("msoShapeCan", "圆柱", "ShapeCan"), S("msoShapeDonut", "圆环", "ShapeDonut"), S("msoShapeNoSymbol", "禁止符号", "ShapeNoSymbol"), S("msoShapeSmileyFace", "笑脸", "ShapeSmileyFace"), S("msoShapeHeart", "心形", "ShapeHeart"), S("msoShapeLightningBolt", "闪电", "ShapeLightningBolt"), S("msoShapeSun", "太阳", "ShapeSun"), S("msoShapeMoon", "月亮", "ShapeMoon"), S("msoShapeCloud", "云形", "ShapeCloud"), S("msoShapeDoubleOval", "双圈", "ShapeOval")),
		new ShapeMenuGroup("Arrows", "箭头总汇", S("msoShapeRightArrow", "右箭头", "ShapeRightArrow"), S("msoShapeLeftArrow", "左箭头", "ShapeLeftArrow"), S("msoShapeUpArrow", "上箭头", "ShapeUpArrow"), S("msoShapeDownArrow", "下箭头", "ShapeDownArrow"), S("msoShapeLeftRightArrow", "左右箭头", "ShapeLeftRightArrow"), S("msoShapeUpDownArrow", "上下箭头", "ShapeUpDownArrow"), S("msoShapeQuadArrow", "四向箭头", "ShapeQuadArrow"), S("msoShapeBentArrow", "折弯箭头", "ShapeBentArrow"), S("msoShapeUTurnArrow", "U 形箭头", "ShapeUTurnArrow"), S("msoShapeCircularArrow", "环形箭头", "ShapeCircularArrow"), S("msoShapeCurvedRightArrow", "右弧形箭头", "ShapeCurvedRightArrow"), S("msoShapeNotchedRightArrow", "缺口右箭头", "ShapeNotchedRightArrow")),
		new ShapeMenuGroup("Math", "公式形状", S("msoShapeMathPlus", "加号", "ShapeMathPlus"), S("msoShapeMathMinus", "减号", "ShapeMathMinus"), S("msoShapeMathMultiply", "乘号", "ShapeMathMultiply"), S("msoShapeMathDivide", "除号", "ShapeMathDivide"), S("msoShapeMathEqual", "等号", "ShapeMathEqual"), S("msoShapeMathNotEqual", "不等号", "ShapeMathNotEqual")),
		new ShapeMenuGroup("Flowchart", "流程图", S("msoShapeFlowchartProcess", "流程图过程", "ShapeFlowchartProcess"), S("msoShapeFlowchartAlternateProcess", "流程图备用过程", "ShapeFlowchartAlternateProcess"), S("msoShapeFlowchartDecision", "流程图判断", "ShapeFlowchartDecision"), S("msoShapeFlowchartData", "流程图数据", "ShapeFlowchartData"), S("msoShapeFlowchartPredefinedProcess", "流程图预定义过程", "ShapeFlowchartPredefinedProcess"), S("msoShapeFlowchartInternalStorage", "流程图内部存储", "ShapeFlowchartInternalStorage"), S("msoShapeFlowchartDocument", "流程图文档", "ShapeFlowchartDocument"), S("msoShapeFlowchartMultidocument", "流程图多文档", "ShapeFlowchartMultidocument"), S("msoShapeFlowchartTerminator", "流程图终止", "ShapeFlowchartTerminator"), S("msoShapeFlowchartPreparation", "流程图准备", "ShapeFlowchartPreparation"), S("msoShapeFlowchartManualInput", "流程图手动输入", "ShapeFlowchartManualInput"), S("msoShapeFlowchartManualOperation", "流程图手动操作", "ShapeFlowchartManualOperation")),
		new ShapeMenuGroup("Stars", "星与旗帜", S("msoShape4pointStar", "4 角星", "ShapeStar"), S("msoShape5pointStar", "5 角星", "ShapeStar"), S("msoShape8pointStar", "8 角星", "ShapeSeal8"), S("msoShape16pointStar", "16 角星", "ShapeSeal16"), S("msoShape24pointStar", "24 角星", "ShapeSeal24"), S("msoShapeExplosion1", "爆炸形 1", "ShapeExplosion1"), S("msoShapeExplosion2", "爆炸形 2", "ShapeExplosion2"), S("msoShapeWave", "波形", "ShapeWave"), S("msoShapeDoubleWave", "双波形", "ShapeDoubleWave"), S("msoShapeUpRibbon", "上弯带形", "ShapeUpRibbon"), S("msoShapeDownRibbon", "下弯带形", "ShapeDownRibbon")),
		new ShapeMenuGroup("Callouts", "标注", S("msoShapeRectangularCallout", "矩形标注", "ShapeRectangularCallout"), S("msoShapeRoundedRectangularCallout", "圆角矩形标注", "ShapeRoundedRectangularCallout"), S("msoShapeOvalCallout", "椭圆标注", "ShapeOvalCallout"), S("msoShapeCloudCallout", "云形标注", "ShapeCloudCallout"), S("msoShapeLineCallout1", "线条标注 1", "ShapeLineCallout1"), S("msoShapeLineCallout2", "线条标注 2", "ShapeLineCallout2"), S("msoShapeLineCallout3", "线条标注 3", "ShapeLineCallout3"), S("msoShapeLineCallout4", "线条标注 4", "ShapeLineCallout4"))
	};

	private static readonly IReadOnlyList<string> CategoryOrder = new string[11]
	{
		"lines", "rectangles", "basic", "arrows", "math", "flowchart", "stars-and-banners", "callouts", "three-d-rough", "three-d-plain",
		"action-buttons"
	};

	private static readonly IReadOnlyList<ShapeMenuItem> KnownImages = (from item in ShapeMenuGroups.SelectMany((ShapeMenuGroup @group) => @group.Items)
		group item by item.EnumName into @group
		select @group.First()).ToList();

	private RoughAddInController Controller
	{
		get
		{
			if (getController != null)
			{
				return getController();
			}
			return null;
		}
	}

	public RoughRibbon(Func<RoughAddInController> getController)
	{
		this.getController = getController;
		activeInstance = this;
	}

	public string GetCustomUI(string ribbonID)
	{
		try
		{
			AddInLogger.Info("GetCustomUI ribbonID=" + ribbonID);
			return BuildConsolidatedRibbonXml("<customUI xmlns='http://schemas.microsoft.com/office/2009/07/customui' onLoad='OnRibbonLoad'>\n  <ribbon>\r\n    <tabs>\r\n      <tab id='roughDiagramTab' label='手绘图形 Rough'>\r\n        <group id='roughCompactFindGroup' label='常用'>\r\n          <menu id='compactCommonMenu' label='常用功能' getImage='GetFunctionalImage' showImage='true' size='large' itemSize='large' screentip='打开常用功能清单' supertip='Ribbon 过载或分组折叠时，从这里直接找到形状、搜索、模板、素材和特征块等高频入口；选区动作集中在旁边的“选区操作”。'>\r\n            <button id='compactShapeGallery' label='形状图库' getImage='GetFunctionalImage' showImage='true' onAction='OpenShapeGallery' screentip='打开形状图库' supertip='打开可调整大小的 PPT 原生形状手绘版图库，适合 Ribbon 折叠时快速插入常用形状。'/>\r\n            <button id='compactSearchPane' label='功能搜索' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='打开功能搜索' supertip='打开右侧窗格并聚焦功能搜索，用中文关键词定位形状、模板、填充、素材和特征块。'/>\r\n            <button id='compactQuickInsert' label='快速插入' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='管理常用形状' supertip='打开右侧窗格并直接展开快速插入添加图库，把常用 PPT 原生形状固定到顶部和右侧快速插入栏。'/>\r\n            <button id='compactTemplateSelect' label='模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位模板选择' supertip='打开右侧窗格并直接定位风格模板选择；模板管理仍以右侧窗格作为兜底。'/>\r\n            <button id='compactAssetSelect' label='素材' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位素材选择' supertip='打开右侧素材库并定位选择素材；插入、删除、导入和分享仍可在右侧完整管理。'/>\r\n            <button id='compactSaveAsset' label='保存素材' getImage='GetFunctionalImage' showImage='true' onAction='SaveSelectionAsAsset' screentip='保存当前选区' supertip='把当前 PowerPoint 选区保存为本机原生可编辑素材，之后可从素材库或搜索入口快速插入。'/>\r\n            <button id='compactFeatureBlock' label='特征块' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock' screentip='插入特征块' supertip='按当前特征块默认参数直接插入 2D 或 3D 特征块；需要改参数时再进入右侧窗格。'/>\r\n          </menu>\r\n          <menu id='compactSelectionMenu' label='选区操作' getImage='GetFunctionalImage' showImage='true' size='large' itemSize='large' screentip='打开选区操作' supertip='集中当前选区的下一步、转换手绘、重绘、检查、选择载体和论文风格入口，减少在多个顶部按钮间查找。'>\r\n            <button id='compactSelectionNext' label='下一步' getImage='GetFunctionalImage' showImage='true' onAction='RunSelectionNextAction' screentip='按选区执行下一步' supertip='无选区时打开形状图库；普通对象转换手绘；手绘对象重绘选区；特征块按当前参数更新。'/>\r\n            <button id='compactConvertSelection' label='转换手绘' getImage='GetFunctionalImage' showImage='true' onAction='ConvertSelectionToRough' screentip='转换当前选区' supertip='把选中的 PowerPoint 原生形状批量转换为当前风格的手绘原生可编辑对象。'/>\r\n            <button id='compactRefreshShape' label='重绘选区' getImage='GetFunctionalImage' showImage='true' onAction='RefreshSelection' screentip='重绘当前选区' supertip='按当前可见风格参数和形状尺寸重新生成选中手绘对象。'/>\r\n            <button id='compactInspectSelection' label='检查选区' getImage='GetFunctionalImage' showImage='true' onAction='InspectSelection' screentip='检查当前选区' supertip='检查当前选区的原生对象、手绘元数据和图层角色；右侧窗格仍保留完整状态显示。'/>\r\n            <button id='compactSelectCarrier' label='选择载体' getImage='GetFunctionalImage' showImage='true' onAction='SelectNativeCarrier' screentip='选择原生载体' supertip='选中手绘组内隐藏的 PPT 原生载体，方便调整原生调整点后再重绘选区。'/>\r\n            <button id='compactPaperStyle' label='论文风格' getImage='GetStylePresetImage' showImage='true' onAction='ApplyPaperStylePreset' screentip='应用论文默认风格' supertip='把后续插入、转换和重绘默认切到论文框图手绘风格；右侧窗格仍可继续精细调整。'/>\r\n          </menu>\r\n          <menu id='paperSuiteMenu' label='论文套件' getImage='GetFunctionalImage' showImage='true' size='large' itemSize='large' screentip='论文框图套件' supertip='集中插入论文常用节点、判断、数据、分组框、箭头线、高亮框和特征图预设；完整参数仍由右侧窗格兜底。'>\r\n            <button id='paperSuiteNode' label='论文节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入论文节点' supertip='插入白底黑线圆角节点，适合论文框图普通模块。'/>\r\n            <button id='paperSuiteData' label='数据节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入数据节点' supertip='插入蓝线浅填数据节点，适合输入、输出或数据模块。'/>\r\n            <button id='paperSuiteDecision' label='判断节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入判断节点' supertip='插入白底黑线判断节点，适合流程分支。'/>\r\n            <button id='paperSuiteGroup' label='分组虚线' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入分组虚线框' supertip='插入无填充黑色虚线分组框，用于论文框图模块分区。'/>\r\n            <button id='paperSuiteHighlight' label='高亮框' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入高亮框' supertip='插入浅黄色涂刷高亮节点，用于突出重点区域。'/>\r\n            <button id='paperSuiteArrow' label='粗箭头' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入粗箭头线' supertip='插入粗线末尾箭头，用于论文流程连接。'/>\r\n            <button id='paperSuiteMatrix' label='论文矩阵' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入论文矩阵' supertip='插入 4x4 二维小块矩阵，适合网络结构和特征图示意。'/>\r\n            <button id='paperSuiteVolume' label='体数据块' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入体数据块' supertip='插入 4x3x3 三维体数据块，适合 3D 医学或体素特征示意。'/>\r\n            <button id='paperSuiteAttention' label='注意力图' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入注意力图' supertip='插入 5x5 二维注意力热图，适合论文可视化模块。'/>\r\n            <menu id='paperStructurePresetMenu' label='智能/医学结构' getImage='GetFunctionalImage' showImage='true' itemSize='large' screentip='插入智能模型和医学论文图结构' supertip='插入通用智能模型、大模型、图文多模态、医学图像报告、表格、分类和诊断结构预设；均为 PPT 原生对象，非复刻单篇论文图。'>\n              <button id='paperPresetTransformerEncoder' label='Transformer 编码器' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 Transformer 编码器结构' supertip='插入自注意力、前馈网络、残差归一化和输出特征组成的通用编码器示意；非复刻单篇论文图。'/>\r\n              <button id='paperPresetEncoderDecoder' label='编码器-解码器' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入编码器-解码器结构' supertip='插入输入、编码器、潜变量、解码器和输出组成的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetVisionTransformer' label='视觉编码器' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入视觉编码器结构' supertip='插入图像、Patch、嵌入、视觉编码器和分类节点组成的通用视觉编码结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetContrastiveDualTower' label='图文对比双塔' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入图文对比双塔' supertip='插入图像塔、文本塔、投影头、相似度矩阵和对比目标组成的通用双塔结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMultimodalFusion' label='多模态融合' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入多模态融合结构' supertip='插入影像、报告、表格三分支编码和跨模态融合、分类诊断输出；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedicalImageReport' label='图像-报告流程' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学图像报告流程' supertip='插入医学影像、视觉特征、ROI、报告生成和诊断输出组成的通用流程；非复刻单篇论文图。'/>\r\n              <button id='paperPresetUnetSegmentation' label='医学分割流程' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学分割流程' supertip='插入编码器、瓶颈、解码器、跳连和分割掩膜组成的通用分割示意；非复刻单篇论文图。'/>\r\n              <button id='paperPresetClassificationDiagnosis' label='分类诊断头' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入分类诊断头' supertip='插入池化、分类头、诊断头、概率校准和解释输出组成的通用预测头；非复刻单篇论文图。'/>\r\n              <button id='paperPresetLargeModelRag' label='大模型诊断 RAG' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入大模型诊断 RAG' supertip='插入多模态输入、知识检索、多模态大模型、诊断建议和人工复核组成的通用流程；非复刻单篇论文图。'/>\r\n              <button id='paperPresetClinicalValidation' label='临床验证流程' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入临床验证流程' supertip='插入训练、验证、外部测试、指标、曲线、校准和报告输出组成的通用验证流程；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedicalTriModalDiagnosis' label='三模态医学诊断' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入三模态医学诊断结构' supertip='插入图像、报告文本、表格变量三路编码，融合后输出分类、风险和解释证据的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedicalVlmReportDiagnosis' label='医学 VLM 报告诊断' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学 VLM 报告诊断结构' supertip='插入视觉编码器、提示词、医学 VLM/LLM、结构化报告和诊断分类闭环；非复刻单篇论文图。'/>\r\n              <button id='paperPresetTabularClinicalBranch' label='表格临床分支' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入表格临床分支' supertip='插入人口学、检验指标、病史、EHR、缺失值处理和表格编码器组成的通用临床变量分支；非复刻单篇论文图。'/>\r\n              <button id='paperPresetCrossModalAttentionFusion' label='跨模态注意力融合' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入跨模态注意力融合结构' supertip='插入图像、文本、表格 token 经 Cross Attention 和门控融合形成共享表示的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetLlmAdapterFineTune' label='LLM Adapter 微调' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 LLM Adapter 微调结构' supertip='插入冻结 LLM/VLM 主干、Adapter、LoRA、Prompt 和医学任务头组成的参数高效微调结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetDiagnosisEvaluationPanel' label='诊断评估面板' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入诊断评估面板' supertip='插入 ROC、PR、校准、决策曲线、混淆矩阵、亚组分析和失败案例组成的诊断评估面板；非复刻单篇论文图。'/>\r\n              <button id='paperPresetTransformerDecoderBlock' label='Transformer 解码器块' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 Transformer 解码器块' supertip='插入掩码自注意力、交叉注意力、前馈网络和输出投影组成的通用解码结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetBlip2QformerBridge' label='Q-Former VLM 桥接' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 Q-Former VLM 桥接结构' supertip='插入视觉特征、Query Transformer、语义 token 和冻结 LLM 组成的通用 VLM 桥接结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedicalInstructionVlm' label='医学指令 VLM' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学指令 VLM 结构' supertip='插入医学图像、临床指令、多模态对齐和诊断问答输出组成的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedclipSemanticMatching' label='MedCLIP 语义匹配' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 MedCLIP 语义匹配结构' supertip='插入医学图文双分支、语义相似度矩阵和零样本诊断输出组成的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetSelfSupervisedMaePretrain' label='自监督预训练' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入自监督预训练流程' supertip='插入未标注影像、遮挡重建、预训练迁移和下游微调组成的通用流程；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMultimodalRagReportTable' label='报告表格 RAG' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入报告表格 RAG 结构' supertip='插入图像、报告、表格、知识检索、证据引用和结构化输出组成的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetSwinUnetr3DSegmentation' label='3D Swin UNETR 分割' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入 3D Swin UNETR 分割结构' supertip='插入 3D 影像、层级 Transformer 编码、UNETR 解码和病灶掩膜组成的通用分割结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetTabTransformerRisk' label='表格 Transformer 风险' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入表格 Transformer 风险结构' supertip='插入临床变量、表格 Transformer、风险评分、校准概率和临床分层组成的通用结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetClinicalDeploymentMonitoring' label='临床部署监测' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入临床部署监测流程' supertip='插入上线输入、部署模型、漂移监测、性能反馈、人审告警和再训练闭环组成的通用流程；非复刻单篇论文图。'/>\r\n              <button id='paperPresetFederatedLearningMedical' label='多中心联邦学习' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入多中心联邦学习结构' supertip='插入多医院本地训练、安全聚合、全局模型和外部验证组成的通用联邦学习结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetDiffusionAugmentation' label='医学扩散增强' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学扩散增强流程' supertip='插入真实数据、条件扩散生成、合成样本、质控筛选和下游训练组成的通用扩散增强结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetSurvivalOutcomePrediction' label='生存预后预测' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入生存预后预测结构' supertip='插入多源输入、时间编码、风险函数、生存曲线和预后分层组成的通用预后预测结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetActiveLearningAnnotation' label='主动学习标注' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入主动学习标注闭环' supertip='插入未标注池、模型不确定性、医生标注和增量训练组成的通用主动学习闭环；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMoeExpertRouting' label='专家路由 MoE' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入专家路由 MoE 结构' supertip='插入路由门控、专家网络、Top-k 激活和加权融合组成的通用 MoE 结构；非复刻单篇论文图。'/>\n              <button id='paperPresetLongitudinalFollowupDiagnosis' label='纵向随访诊断' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入纵向随访诊断结构' supertip='插入多时间点影像、报告、表格、时序编码、进展趋势和风险预警组成的通用随访诊断结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetWeaklySupervisedMil' label='弱监督 MIL' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入弱监督 MIL 结构' supertip='插入 Patch 包、编码器、注意力池化、高权重病灶和切片级诊断组成的通用弱监督 MIL 结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetMedicalKnowledgeGraphReasoning' label='医学知识图谱推理' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学知识图谱推理结构' supertip='插入实体链接、关系抽取、医学知识图谱、路径推理和诊断解释组成的通用推理结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetTeacherStudentDistillation' label='教师学生蒸馏' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入教师学生蒸馏结构' supertip='插入教师模型、学生模型、蒸馏损失、性能保持和临床部署组成的通用模型压缩结构；非复刻单篇论文图。'/>\r\n              <button id='paperPresetFoundationPromptTuning' label='医学基础模型提示调优' getImage='GetFunctionalImage' showImage='true' onAction='InsertPaperStructurePreset' screentip='插入医学基础模型提示调优结构' supertip='插入医学输入、可学习 Prompt、冻结基础模型、诊断分类和结构化输出组成的通用提示调优结构；非复刻单篇论文图。'/>\r\n            </menu>\r\n          </menu>\r\n        </group>\r\n        <group id='roughStartShortcutGroup' label='开始'>\r\n          <button id='startOpenPane' label='右侧窗格' getImage='GetLibraryImage' showImage='true' size='large' onAction='OpenPane' screentip='打开右侧完整窗格' supertip='打开右侧窗格作为完整参数、素材库、形状图库和故障兜底入口；顶部按钮只复制高频一键动作。'/>\r\n          <button id='startSelectionNext' label='下一步' getImage='GetFunctionalImage' showImage='true' size='large' onAction='RunSelectionNextAction' screentip='按选区执行下一步' supertip='无选区时打开形状图库；普通对象转换手绘；手绘对象重绘选区；特征块按当前参数更新，减少回到右侧窗格判断的步骤。'/>\r\n          <button id='startShapeGallery' label='形状图库' getImage='GetFunctionalImage' showImage='true' size='large' onAction='OpenShapeGallery' screentip='打开顶部形状图库' supertip='直接打开可调整大小的 PPT 原生形状手绘版图库，点击即可插入 Rough.js 视觉的原生可编辑对象。'/>\r\n          <button id='startConvertSelection' label='转换手绘' getImage='GetFunctionalImage' showImage='true' size='large' onAction='ConvertSelectionToRough' screentip='一键转换当前选区' supertip='把选中的 PowerPoint 原生形状批量转换为当前风格的手绘原生可编辑对象，减少进入右侧窗格的步骤。'/>\r\n          <button id='startRefreshShape' label='重绘选区' getImage='GetFunctionalImage' showImage='true' size='large' onAction='RefreshSelection' screentip='一键重绘当前选区' supertip='按当前可见风格参数和形状尺寸重新生成选中手绘对象；适合调整大小、颜色或风格后立即刷新。'/>\r\n          <button id='startInspectSelection' label='检查选区' getImage='GetFunctionalImage' showImage='true' size='large' onAction='InspectSelection' screentip='一键检查当前选区' supertip='直接检查当前选区的原生对象、手绘元数据和图层角色；右侧窗格仍保留完整状态显示。'/>\r\n          <button id='startSelectCarrier' label='选择载体' getImage='GetFunctionalImage' showImage='true' size='large' onAction='SelectNativeCarrier' screentip='一键选择原生载体' supertip='选中手绘组内隐藏的 PPT 原生载体，方便调整圆角、箭头等 PowerPoint 原生调整点后再重绘。'/>\r\n          <menu id='startAssetToolsMenu' label='素材常用' getImage='GetLibraryImage' showImage='true' size='large' itemSize='large' screentip='素材和常用形状' supertip='收纳快速插入、刷新常用、保存素材、导入素材和分享素材等入口；最近素材继续在开始区直接可见，完整管理仍在右侧素材库。'>\r\n            <button id='startQuickInsert' label='快速插入' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='管理常用形状' supertip='打开右侧窗格并直接展开快速插入添加图库，把常用 PPT 原生形状固定到顶部和右侧快速插入栏。'/>\r\n            <button id='startRefreshQuickShapes' label='刷新常用' getImage='GetFunctionalImage' showImage='true' onAction='RefreshQuickShapes' screentip='刷新顶部快速插入' supertip='重新读取本机固定的常用形状并刷新顶部快速插入按钮；不会修改幻灯片内容。'/>\r\n            <button id='startSaveAsset' label='保存素材' getImage='GetFunctionalImage' showImage='true' onAction='SaveSelectionAsAsset' screentip='一键保存当前选区' supertip='把当前 PowerPoint 选区保存为本机原生可编辑素材，之后可从素材库或搜索入口快速插入。'/>\r\n            <button id='startImportAssets' label='导入素材' getImage='GetFunctionalImage' showImage='true' onAction='ImportAssets' screentip='一键导入并自动去重' supertip='从顶部直接导入本机 zip 分享素材包；按原生 PPT 模板内容自动跳过已有和包内重复素材，素材选择、删除和完整管理仍保留在右侧素材库。'/>\n            <button id='startExportAssets' label='分享素材' getImage='GetFunctionalImage' showImage='true' onAction='ExportAssets' screentip='一键分享素材包' supertip='从顶部直接进入素材包分享流程；需要选择具体素材时可打开右侧素材库精细管理。'/>\r\n          </menu>\r\n          <dynamicMenu id='startRecentAssetMenu' label='最近素材' getImage='GetLibraryImage' getContent='GetRecentAssetMenu' screentip='插入最近素材' supertip='从顶部直接插入最近保存的 PPT 原生可编辑素材；管理、删除和选择分享仍在右侧素材库完成。'/>\r\n          <button id='startRefreshAssets' label='刷新素材' getImage='GetFunctionalImage' showImage='true' size='large' onAction='RefreshUserAssets' screentip='一键刷新素材库' supertip='从顶部直接重新读取本机素材库并刷新右侧素材列表；插入、删除、选择和分享仍可在右侧素材库继续完成。'/>\r\n          <button id='startPaperStyle' label='论文风格' getImage='GetStylePresetImage' showImage='true' size='large' onAction='ApplyPaperStylePreset' screentip='应用论文默认风格' supertip='把后续插入、转换和重绘默认切到论文框图手绘风格；右侧窗格仍可继续精细调整。'/>\r\n          <menu id='startStylePresetMenu' label='风格模板' getImage='GetStylePresetImage' showImage='true' size='large' itemSize='large' screentip='选择风格模板' supertip='收纳 Rough.js 原版、Excalidraw、draw.io、D2、tldraw、涂刷和碎线等常用风格模板；右侧风格窗格仍可继续精调。'>\r\n            <toggleButton id='startStyleRoughJs' label='原版风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用 Rough.js 原版' supertip='从开始区直接切换为本机 Rough.js 原版边界和默认填充参数；右侧风格窗格仍可继续精调。'/>\r\n            <toggleButton id='startStyleExcalidraw' label='白板风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用 Excalidraw 风格' supertip='从开始区直接切换为 Excalidraw 白板手绘视觉，后续插入、转换和重绘使用该模板。'/>\r\n            <toggleButton id='startStyleDrawio' label='图表风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用 draw.io 草图' supertip='从开始区直接切换为 draw.io 图表草图风格，适合流程图和结构示意图。'/>\r\n            <toggleButton id='startStyleD2' label='D2 风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用 D2 草图' supertip='从开始区直接切换为 D2 草图风格，减少进入右侧模板列表寻找的步骤。'/>\r\n            <toggleButton id='startStyleTldraw' label='手线风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用 tldraw 手线' supertip='从开始区直接切换为 tldraw 手绘线风格，适合轻量白板式论文图。'/>\r\n            <toggleButton id='startStyleBrush' label='涂刷风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用涂刷填充' supertip='从开始区直接切换为宽刷涂色风格，权威填充仍保持 PPT 原生闭合可编辑对象。'/>\r\n            <toggleButton id='startStyleFragments' label='碎线风格' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用短笔画碎线' supertip='从开始区直接切换为短笔画碎线边界，适合更明显的手绘描边。'/>\r\n            <toggleButton id='startStyleDenseFragments' label='密集碎线' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='一键应用密集碎线' supertip='从开始区直接切换为更密集的短笔画边界，右侧窗格仍可修改随机和填充参数。'/>\r\n          <gallery id='startStyleGallery' label='风格模板库' getImage='GetStylePresetImage' showImage='true' showItemLabel='true' columns='4' rows='4' itemWidth='64' itemHeight='48' getItemCount='GetStylePresetGalleryItemCount' getItemID='GetStylePresetGalleryItemId' getItemImage='GetStylePresetGalleryItemImage' getItemLabel='GetStylePresetGalleryItemLabel' getItemScreentip='GetStylePresetGalleryItemScreentip' onAction='ApplyStylePresetFromGallery' screentip='浏览全部风格模板' supertip='以图库预览全部 13 个内置风格模板，悬浮见中文说明，点击直接应用到选中对象；自定义模板仍在右侧窗格管理。'/>\r\n            <menuSeparator id='stylePresetManageSep' title='模板管理'/>\r\n            <button id='startTemplateSave' label='保存模板' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='保存风格模板' supertip='打开右侧窗格并定位到模板保存，把当前风格参数保存为新的自定义模板；预置模板不会被覆盖。'/>\r\n            <button id='startTemplateRename' label='重命名模板' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='重命名风格模板' supertip='打开右侧窗格并定位到模板重命名，重命名当前自定义模板；预置模板不能重命名。'/>\r\n          </menu>\r\n          <menu id='startStyleComboMenu' label='组合样式' getImage='GetShortcutImage' showImage='true' size='large' itemSize='large' screentip='选择常用组合样式' supertip='收纳黑白论文、蓝线浅填、虚线分组、涂刷高亮和粗箭头线等常用组合，减少开始区横向按钮数量。'>\r\n            <button id='startComboPaper' label='黑白论文' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='一键应用黑白论文组合' supertip='从顶部直接应用黑色线条、白色不透明填充、常规线宽和实线组合；完整风格参数仍保留在右侧窗格。'/>\r\n            <button id='startComboBlueSketch' label='蓝线浅填' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='一键应用蓝线浅填组合' supertip='从顶部直接应用蓝色线条、浅蓝填充、常规线宽和手绘边界组合，适合论文模块框。'/>\r\n            <button id='startComboDashedFrame' label='虚线分组' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='一键应用虚线分组组合' supertip='从顶部直接应用无填充、黑色虚线和轻微手绘边界组合，适合论文框图分组边界。'/>\r\n            <button id='startComboBrushHighlight' label='涂刷高亮' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='一键应用涂刷高亮组合' supertip='从顶部直接应用浅黄色宽刷填充和黑色边线组合，用于突出重点区域。'/>\r\n            <button id='startComboArrowLine' label='粗箭头线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='一键应用粗箭头线组合' supertip='从顶部直接应用粗线、实线和末尾手绘箭头组合，后续直线类对象直接使用。'/>\r\n          </menu>\r\n          <button id='startSearchPane' label='功能搜索' getImage='GetFunctionalImage' showImage='true' size='large' onAction='OpenPaneSection' screentip='打开功能搜索' supertip='打开右侧窗格并聚焦功能搜索，用中文关键词定位形状、模板、填充、素材和特征块等完整功能。'/>\r\n          <menu id='startFeatureBlockMenu' label='特征块' getImage='GetFunctionalImage' showImage='true' size='large' itemSize='large' screentip='插入特征块' supertip='收纳普通、2D、3D 和手绘特征块入口；完整行列、层数、颜色和方向参数仍在右侧特征块窗格。'>\r\n            <button id='startFeatureBlock' label='特征块' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock' screentip='一键插入特征块' supertip='按当前特征块默认参数直接插入 2D 或 3D 特征块；需要改行列、层数和颜色时再进入右侧窗格。'/>\r\n            <button id='startFeatureBlock2D' label='2D 特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock2D' screentip='一键插入二维特征块' supertip='从顶部直接按当前参数插入 2D 特征网格；右侧窗格仍可继续修改行列、颜色、间距和渐变。'/>\r\n            <button id='startFeatureBlock3D' label='3D 特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock3D' screentip='一键插入三维特征块' supertip='从顶部直接按当前参数插入 3D 特征堆叠；默认适合论文特征图，完整参数仍在右侧窗格。'/>\r\n            <button id='startRoughFeatureBlock' label='手绘特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertRoughFeatureBlock' screentip='一键插入手绘特征块' supertip='从顶部直接插入手绘视觉特征块；二维网格会按单块手绘逻辑生成，最终仍为 PPT 原生可编辑对象。'/>\r\n          </menu>\r\n        </group>\r\n        <group id='roughPrimaryOneClickGroup' label='高频一键'>\r\n          <button id='primaryLine' label='直线' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘直线' supertip='从顶部靠前位置直接插入 Rough.js 视觉的 PPT 原生可编辑直线；长度变化后可一键重绘自然扰动。'/>\r\n          <button id='primaryRectangle' label='矩形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘矩形' supertip='从顶部靠前位置直接插入 Rough.js 视觉的 PPT 原生可编辑矩形；完整形状库仍在右侧窗格。'/>\r\n          <button id='primaryRoundedRectangle' label='圆角矩形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘圆角矩形' supertip='从顶部靠前位置直接插入手绘圆角矩形，后续仍可用 PPT 原生调整点修改圆角后重绘。'/>\r\n          <button id='primaryArrow' label='箭头' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘箭头' supertip='从顶部靠前位置直接插入手绘箭头线，长度变化后可一键重绘自然扰动。'/>\r\n          <button id='primaryOval' label='椭圆' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘椭圆' supertip='从顶部靠前位置直接插入 Rough.js 视觉的 PPT 原生可编辑椭圆；颜色、线宽和填充仍按当前风格参数。'/>\r\n          <button id='primaryPaperNode' label='论文节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入黑白论文节点' supertip='直接插入黑线白底圆角节点；右侧窗格仍可作为完整风格参数兜底。'/>\r\n          <button id='primaryBlueNode' label='蓝色节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入蓝线浅填节点' supertip='直接插入蓝色线条和浅蓝填充的论文模块节点，减少先选形状再调样式的步骤。'/>\r\n          <button id='primaryHighlightBox' label='高亮框' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入涂刷高亮框' supertip='直接插入浅黄色涂刷高亮节点，用于突出论文框图重点区域。'/>\r\n          <menu id='primaryMoreShapeMenu' label='更多形状' getImage='GetCommonShapeImage' showImage='true' itemSize='large' screentip='插入更多常用形状' supertip='收纳菱形、三角、双圈、梯形和虚线框等次高频形状；按钮仍复用原一键插入逻辑。'>\r\n            <button id='primaryDiamond' label='菱形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘菱形' supertip='插入 Rough.js 视觉的 PPT 原生可编辑菱形，适合流程判断或论文模块。'/>\r\n            <button id='primaryTriangle' label='三角' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘三角形' supertip='插入 Rough.js 视觉的 PPT 原生可编辑三角形，旋转和缩放后仍可重绘。'/>\r\n            <button id='primaryDoubleCircle' label='双圈' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘双圈' supertip='插入手绘双圈/圆环形状，适合强调节点或终止状态。'/>\r\n            <button id='primaryTrapezoid' label='梯形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘梯形' supertip='插入 Rough.js 视觉的 PPT 原生可编辑梯形，完整形状库仍可作为兜底。'/>\r\n            <button id='primaryDashedFrame' label='虚线框' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘虚线框' supertip='插入无填充虚线分组框，适合论文框图分组边界。'/>\r\n          </menu>\r\n          <menu id='primaryComponentMenu' label='论文组件' getImage='GetComponentShapeImage' showImage='true' itemSize='large' screentip='插入更多论文组件' supertip='收纳分组虚线、粗箭头、判断节点、数据节点和备注标注；按钮仍复用原组件插入逻辑。'>\r\n            <button id='primaryDashedGroup' label='分组虚线' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入分组虚线框' supertip='插入无填充黑色虚线分组框；右侧窗格仍保留完整风格和素材管理入口。'/>\r\n            <button id='primaryArrowLine' label='粗箭头' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入粗箭头线' supertip='插入粗线末尾箭头，用于论文流程连接；长度、旋转和缩放后仍可重绘。'/>\r\n            <button id='primaryDecisionNode' label='判断节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入判断节点' supertip='插入白底黑线手绘判断节点，适合论文流程分支。'/>\r\n            <button id='primaryDataNode' label='数据节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入数据节点' supertip='插入蓝线浅填数据节点，适合输入、输出或数据模块。'/>\r\n            <button id='primaryNoteCallout' label='备注标注' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入备注标注' supertip='插入涂刷高亮标注，适合给论文图补充说明。'/>\r\n          </menu>\r\n          <menu id='primaryFillMenu' label='填充' getImage='GetShortcutImage' showImage='true' itemSize='large' screentip='设置常用填充' supertip='收纳白填充、无填充、涂刷、黄填充、蓝填充和全不透明等填充相关快捷项。'>\r\n            <button id='primaryWhiteFill' label='白填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='设为白色填充' supertip='把后续插入和当前手绘选区设为白色不透明填充；完整填充参数仍在右侧窗格。'/>\r\n            <button id='primaryNoFill' label='无填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='关闭填充' supertip='把后续插入和当前手绘选区切换为无填充，适合分组框和辅助边界。'/>\r\n            <button id='primaryBrushFill' label='涂刷' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用宽刷填充' supertip='把后续插入和当前手绘选区切换为宽刷涂色填充；右侧窗格仍可精调刷宽和重合度。'/>\r\n            <button id='primaryYellowFill' label='黄填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅黄色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅黄色，适合论文高亮区域。'/>\r\n            <button id='primaryBlueFill' label='蓝填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅蓝色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅蓝色，适合模块节点背景。'/>\r\n            <button id='primaryAllOpaque' label='全不透' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条和填充不透明' supertip='同时把线条透明度和填充透明度设为 0，恢复清晰论文图默认效果。'/>\r\n          <button id='fillCustomPane' label='更多填充' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位填充纹理参数' supertip='打开右侧风格区并定位填充纹理参数组，可调整填充来源、透明度、纹理和宽刷涂刷。'/>\r\n            </menu>\r\n          <menu id='primaryLineMenu' label='线条' getImage='GetShortcutImage' showImage='true' itemSize='large' screentip='设置常用线条' supertip='收纳线色、线宽、虚实线和箭头相关快捷项。'>\r\n            <button id='primaryBlackStroke' label='黑线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为黑色' supertip='把后续插入和当前手绘选区的权威线条设为纯黑不透明。'/>\r\n            <button id='primaryBlueStroke' label='蓝线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为蓝色' supertip='把后续插入和当前手绘选区的权威线条设为蓝色不透明。'/>\r\n            <button id='primaryBoldLine' label='粗线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为粗线' supertip='把后续插入和当前手绘选区线宽设为 4 磅，适合强调主流程。'/>\r\n            <button id='primaryDashLine' label='虚线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为虚线' supertip='把后续插入和当前手绘选区线型设为虚线，适合分组、跳连和弱关系。'/>\r\n            <button id='primaryEndArrow' label='末箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用末尾箭头' supertip='把后续插入和当前手绘选区设为末尾箭头，适合流程连接线。'/>\r\n            <button id='primaryNormalLine' label='常规线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为常规宽度' supertip='把后续插入和当前手绘选区线宽设为 2 磅，用于从粗线或细线快速恢复论文默认线宽。'/>\r\n            <button id='primarySolidLine' label='实线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为实线' supertip='把后续插入和当前手绘选区线型切换为实线，适合从虚线框或点划线快速恢复。'/>\r\n            <button id='primaryNoArrow' label='无箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='关闭箭头' supertip='把后续直线类对象和当前直线手绘组选区切换为无箭头，避免连接线保留旧箭头样式。'/>\r\n          <button id='lineCustomPane' label='更多线条' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位线条参数' supertip='打开右侧风格区并定位线条参数组，可调整虚线、箭头和多笔画。'/>\r\n            </menu>\r\n          <menu id='primaryMoreMenu' label='更多' getImage='GetFunctionalImage' showImage='true' itemSize='large' screentip='打开更多高频入口' supertip='收纳换一版、模板定位和素材定位等低频入口。'>\r\n            <button id='primaryRandomSeed' label='换一版' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='换一版手绘扰动' supertip='更换随机种子，让后续插入和当前手绘选区使用另一组自然手绘扰动。'/>\r\n            <button id='primaryTemplateSelect' label='模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位模板选择' supertip='打开右侧窗格并直接定位风格模板选择；模板管理仍以右侧窗格作为兜底。'/>\r\n            <button id='primaryAssetSelect' label='素材' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位素材选择' supertip='打开右侧素材库并定位选择素材；插入、删除、导入和分享仍可在右侧完整管理。'/>\r\n          </menu>\r\n        </group>\r\n        <group id='roughLibraryGroup' label='素材'>\r\n          <button id='openPane' label='素材库' getImage='GetLibraryImage' showImage='true' onAction='OpenPane' screentip='打开手绘图形窗格' supertip='显示所有 PPT 原生形状的 Rough.js 版本，并管理已保存的原生素材。'/>\r\n          <button id='saveAsset' label='保存素材' getImage='GetFunctionalImage' showImage='true' onAction='SaveSelectionAsAsset' screentip='保存当前选区' supertip='把当前选中的 PowerPoint 原生对象保存到本机素材库，之后可一键插入。'/>\r\n          <button id='importAssets' label='导入素材' getImage='GetFunctionalImage' showImage='true' onAction='ImportAssets' screentip='导入分享素材包并去重' supertip='从本机 zip 分享素材包导入 PPT 原生可编辑素材，并按原生模板内容自动跳过重复项。'/>\n          <button id='exportAssets' label='分享素材' getImage='GetFunctionalImage' showImage='true' onAction='ExportAssets' screentip='分享素材包' supertip='把本机素材库导出为适合社交平台传输的 zip 分享素材包；需要选择具体素材时可打开右侧窗格精细管理。'/>\r\n        </group>\r\n        <group id='roughShapeGroup' label='形状'>\r\n          <button id='roughShapeMenu' label='形状图库' getImage='GetFunctionalImage' showImage='true' onAction='OpenShapeGallery' screentip='打开形状图库' supertip='打开与素材库“PPT 原生形状手绘版”一致的图标图库；窗口边缘可拖动调整宽度和高度，点击图标插入 Rough.js 视觉的 PPT 原生可编辑对象。'/>\r\n          <menu id='shapeCommonMenu' label='常用形状' getImage='GetCommonShapeImage' showImage='true' itemSize='large' screentip='插入常用手绘形状' supertip='收纳直线、箭头、矩形、圆角矩形、椭圆、菱形、三角、虚线框、曲线、双圈、梯形和多边形等常用形状；所有子项仍为 PPT 原生可编辑对象。'>\r\n            <button id='commonLine' label='直线' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘直线' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑直线；右侧窗格仍可继续选择全量形状。'/>\r\n            <button id='commonArrow' label='箭头' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘箭头' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑箭头线；长度变化会重新生成自然扰动。'/>\r\n            <button id='commonRectangle' label='矩形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘矩形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑矩形。'/>\r\n            <button id='commonRoundedRectangle' label='圆角矩形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘圆角矩形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑圆角矩形。'/>\r\n            <button id='commonOval' label='椭圆' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘椭圆' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑椭圆。'/>\r\n            <button id='commonDiamond' label='菱形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘菱形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑菱形。'/>\r\n            <button id='commonTriangle' label='三角形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘三角形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑等腰三角形。'/>\r\n            <button id='commonDashedFrame' label='虚线框' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘虚线框' supertip='一键插入无填充的 Rough.js 手绘虚线框，适合论文框图分组边界。'/>\r\n            <button id='commonCurve' label='曲线' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘曲线' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑曲线。'/>\r\n            <button id='commonDoubleCircle' label='双圈' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘双圈' supertip='一键插入圆环形双圈边界，最终仍是 PPT 原生可编辑对象。'/>\r\n            <button id='commonTrapezoid' label='梯形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘梯形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑梯形。'/>\r\n            <button id='commonPentagon' label='多边形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘多边形' supertip='一键插入正五边形作为常用多边形入口；更多多边形可打开完整形状图库。'/>\r\n            <button id='commonHexagon' label='六边形' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘六边形' supertip='一键插入 Rough.js 视觉的 PPT 原生可编辑六边形。'/>\r\n            <button id='commonBidirectionalArrow' label='双向箭头' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘双向箭头' supertip='一键插入常用于论文流程图的左右双向箭头。'/>\r\n            <button id='commonCubeRough' label='立方体' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘立方体' supertip='一键插入 Rough.js 风格三维立方体堆叠，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonCylinderRough' label='圆柱体' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘圆柱体' supertip='一键插入 Rough.js 风格三维圆柱体，最终为 PPT 原生可编辑对象。'/>\r\n          </menu>\r\n          <menu id='shapeConnectorFlowMenu' label='连接流程' getImage='GetCommonShapeImage' showImage='true' itemSize='large' screentip='插入连接和流程图形状' supertip='收纳连接符和流程图过程、判断、数据、终止、文档、准备等入口，减少顶部并列按钮组。'>\r\n            <button id='commonStraightConnector' label='直线连接' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入直线连接符' supertip='一键插入 Rough.js 视觉的 PPT 原生直线连接符，适合流程图节点连接。'/>\r\n            <button id='commonElbowConnector' label='肘形连接' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入肘形连接符' supertip='一键插入 Rough.js 视觉的 PPT 原生肘形连接符，适合论文框图直角连线。'/>\r\n            <button id='commonCurvedConnector' label='曲线连接' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入曲线连接符' supertip='一键插入 Rough.js 视觉的 PPT 原生曲线连接符。'/>\r\n            <button id='commonFlowProcess' label='过程' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图过程' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图过程形状。'/>\r\n            <button id='commonFlowDecision' label='判断' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图判断' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图判断形状。'/>\r\n            <button id='commonFlowData' label='数据' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图数据' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图数据形状。'/>\r\n            <button id='commonFlowTerminator' label='终止' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图终止' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图终止形状。'/>\r\n            <button id='commonFlowDocument' label='文档' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图文档' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图文档形状。'/>\r\n            <button id='commonFlowPreparation' label='准备' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入流程图准备' supertip='一键插入 Rough.js 视觉的 PPT 原生流程图准备形状。'/>\r\n          </menu>\r\n          <menu id='shapeCalloutMenu' label='标注' getImage='GetCommonShapeImage' showImage='true' itemSize='large' screentip='插入常用标注形状' supertip='收纳矩形、圆角、椭圆和云形标注，适合论文图补充说明。'>\r\n            <button id='commonRectCallout' label='矩形标注' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入矩形标注' supertip='一键插入 Rough.js 视觉的 PPT 原生矩形标注。'/>\r\n            <button id='commonRoundRectCallout' label='圆角标注' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入圆角矩形标注' supertip='一键插入 Rough.js 视觉的 PPT 原生圆角矩形标注。'/>\r\n            <button id='commonOvalCallout' label='椭圆标注' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入椭圆标注' supertip='一键插入 Rough.js 视觉的 PPT 原生椭圆标注。'/>\r\n            <button id='commonCloudCallout' label='云形标注' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入云形标注' supertip='一键插入 Rough.js 视觉的 PPT 原生云形标注。'/>\r\n          </menu>\r\n          <menu id='shapePaperComponentMenu' label='论文组件' getImage='GetComponentShapeImage' showImage='true' itemSize='large' screentip='插入论文组件' supertip='收纳白底节点、蓝色节点、高亮框、分组虚线、粗箭头、判断节点、数据节点和备注标注，减少顶部重复按钮组。'>\r\n            <button id='componentPaperNode' label='白底节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入白底论文节点' supertip='一键插入白底、黑色边线、常规线宽的手绘圆角矩形节点，减少先选风格再选形状的步骤。'/>\r\n            <button id='componentBlueNode' label='蓝色节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入蓝色论文节点' supertip='一键插入蓝色线条和浅蓝填充的手绘圆角矩形节点，适合论文模块框。'/>\r\n            <button id='componentHighlightBox' label='高亮框' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入涂刷高亮框' supertip='一键插入浅黄色宽刷填充的手绘圆角矩形，高亮重点区域且保持 PPT 原生可编辑对象。'/>\r\n            <button id='componentDashedFrame' label='分组虚线' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入虚线分组框' supertip='一键插入无填充黑色虚线手绘矩形，适合论文框图分组边界。'/>\r\n            <button id='componentArrowLine' label='粗箭头' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入粗箭头线' supertip='一键插入粗线末尾箭头，长度、旋转和缩放后仍可按当前对象尺寸重绘。'/>\r\n            <button id='componentDecision' label='判断节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入判断节点' supertip='一键插入白底黑线手绘流程图判断节点，适合论文流程分支。'/>\r\n            <button id='componentDataNode' label='数据节点' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入数据节点' supertip='一键插入蓝线浅填的手绘流程图数据节点，适合输入、输出或数据模块。'/>\r\n            <button id='componentNoteCallout' label='备注标注' getImage='GetComponentShapeImage' showImage='true' onAction='InsertComponentShape' screentip='插入备注标注' supertip='一键插入涂刷高亮风格的圆角标注，适合在论文图中补充说明。'/>\r\n          </menu>\r\n          <menu id='shapeThreeDMenu' label='三维' getImage='GetCommonShapeImage' showImage='true' itemSize='large' screentip='插入三维形状' supertip='收纳普通和手绘三维立方体、圆柱、圆锥、棱锥、球体和堆叠块，最终仍为 PPT 原生可编辑对象。'>\r\n            <button id='commonCubePlain' label='普通立方体' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通立方体' supertip='一键插入普通三维立方体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonCylinderPlain' label='普通圆柱' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通圆柱' supertip='一键插入普通三维圆柱体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonConePlain' label='普通圆锥' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通圆锥' supertip='一键插入普通三维圆锥体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonPyramidPlain' label='普通棱锥' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通棱锥' supertip='一键插入普通三维棱锥体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonSpherePlain' label='普通球体' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通球体' supertip='一键插入普通三维球体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonStackPlain' label='普通堆叠' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入普通堆叠块' supertip='一键插入普通三维堆叠块，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonConeRough' label='手绘圆锥' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘圆锥' supertip='一键插入 Rough.js 风格三维圆锥体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonPyramidRough' label='手绘棱锥' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘棱锥' supertip='一键插入 Rough.js 风格三维棱锥体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonSphereRough' label='手绘球体' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘球体' supertip='一键插入 Rough.js 风格三维球体，最终为 PPT 原生可编辑对象。'/>\r\n            <button id='commonStackRough' label='手绘堆叠' getImage='GetCommonShapeImage' showImage='true' onAction='InsertCommonShape' screentip='插入手绘堆叠块' supertip='一键插入 Rough.js 风格三维堆叠块，最终为 PPT 原生可编辑对象。'/>\r\n          </menu>\r\n        </group>\r\n        <group id='roughStylePresetGroup' label='一键风格'>\r\n          <toggleButton id='stylePresetGentle' label='轻微' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用轻微手绘风格' supertip='把后续插入和转换默认切换为轻微手绘边界，适合不想过度扭曲的论文图。'/>\r\n          <toggleButton id='stylePresetPaper' label='论文' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用论文框图风格' supertip='把后续插入和转换默认切换为论文框图手绘风格；右侧窗格仍可继续精调。'/>\r\n          <toggleButton id='stylePresetBold' label='粗线' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用粗线草图风格' supertip='把后续插入和转换默认切换为更粗、更明显的草图边界。'/>\r\n          <toggleButton id='stylePresetNested' label='嵌套' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用嵌套双线风格' supertip='把后续插入和转换默认切换为多层错位边界，填充仍保持闭合可编辑语义。'/>\r\n          <toggleButton id='stylePresetTextured' label='纹理' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用纹理草稿风格' supertip='把后续插入和转换默认切换为带 Rough.js 填充纹理的草稿视觉。'/>\r\n          <toggleButton id='stylePresetRoughJs' label='原版' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用 Rough.js 原版风格' supertip='把后续插入和转换默认切换为本机 Rough.js 原版边界风格。'/>\r\n          <toggleButton id='stylePresetExcalidraw' label='白板' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用 Excalidraw 风格' supertip='把后续插入和转换默认切换为 Excalidraw 手绘视觉和填充参数。'/>\r\n          <toggleButton id='stylePresetDrawio' label='图表' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用 draw.io 手绘风格' supertip='把后续插入和转换默认切换为 draw.io 草图风格参数。'/>\r\n          <toggleButton id='stylePresetD2' label='D2 图' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用 D2 草图风格' supertip='把后续插入和转换默认切换为 D2 草图风格参数。'/>\r\n          <toggleButton id='stylePresetTldraw' label='手线' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用 tldraw 手绘线风格' supertip='把后续插入和转换默认切换为 tldraw 手绘线视觉参数。'/>\r\n          <toggleButton id='stylePresetBrush' label='涂刷' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用涂刷填充风格' supertip='把后续插入和转换默认切换为宽刷涂刷填充风格，填充纹理由 PPT 原生可编辑线条承载。'/>\r\n          <toggleButton id='stylePresetFragments' label='碎线' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用短笔画碎线风格' supertip='把后续插入和转换默认切换为边缘短笔画较多的手绘风格。'/>\r\n          <toggleButton id='stylePresetDenseFragments' label='密集碎线' getImage='GetStylePresetImage' showImage='true' getPressed='GetStylePresetPressed' onAction='ApplyRibbonStylePreset' screentip='应用密集短笔画风格' supertip='把后续插入和转换默认切换为短笔画更多的手绘边界。'/>\r\n        </group>\r\n        <group id='roughVariationShortcutGroup' label='扰动快捷'>\r\n          <button id='randomSeedShortcut' label='换一版' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='换一版手绘扰动' supertip='立即更换随机种子，后续插入和当前手绘选区会使用另一组自然手绘扰动。'/>\r\n          <button id='classicModeShortcut' label='普通边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='关闭嵌套边界' supertip='把手绘模式切回普通边界，保留当前线条、填充和来源设置。'/>\r\n          <button id='nestedTwoShortcut' label='二层嵌套' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用二层嵌套边界' supertip='把手绘模式切换为二层等尺寸错位边界，适合更明显的手绘叠线效果。'/>\r\n          <button id='nestedThreeShortcut' label='三层嵌套' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用三层嵌套边界' supertip='把手绘模式切换为三层等尺寸错位边界，视觉更像多次描边。'/>\r\n          <button id='nestedReverseShortcut' label='反向嵌套' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换嵌套错位方向' supertip='启用嵌套模式并切换多层边界错位方向，用于快速比较两种叠线方向。'/>\r\n        </group>\r\n        <group id='roughFillShortcutGroup' label='填充快捷'>\r\n          <button id='fillNoneShortcut' label='无填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='关闭填充' supertip='把后续插入和当前手绘选区切换为无填充，只保留 Rough.js 手绘边界。'/>\r\n          <button id='fillSolidShortcut' label='纯色' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用纯色填充' supertip='把后续插入和当前手绘选区切换为 PPT 原生闭合纯色填充，填充边界继续贴合手绘外边界。'/>\r\n          <button id='fillWhiteShortcut' label='白底' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用白色填充' supertip='把填充改为不透明白色，适合论文框图背景遮盖和分组强调。'/>\r\n          <button id='fillBrushShortcut' label='涂刷' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用宽刷涂色' supertip='把填充纹理切换为自研宽刷涂刷效果，权威填充仍由 PPT 原生闭合边界承载。'/>\r\n          <button id='fillHachureShortcut' label='斜线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用斜线纹理' supertip='把填充纹理切换为 Rough.js 类斜线填充，纹理为 PPT 原生可编辑线条。'/>\r\n          <button id='fillCrossShortcut' label='交叉' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用交叉纹理' supertip='把填充纹理切换为交叉线填充，适合需要更明显区分区域的论文图。'/>\r\n          <button id='fillDotsShortcut' label='点状' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用点状纹理' supertip='把填充纹理切换为点状纹理，纹理由 PPT 原生可编辑线条承载。'/>\r\n          <button id='fillDashedTextureShortcut' label='短划' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用短划纹理' supertip='把填充纹理切换为短划纹理，适合更轻的草图填充。'/>\r\n          <button id='fillZigzagShortcut' label='锯齿' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用锯齿纹理' supertip='把填充纹理切换为锯齿纹理，用于更明显的手绘填充方向。'/>\r\n          <button id='fillZigzagLineShortcut' label='折线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用折线纹理' supertip='把填充纹理切换为折线纹理，保留 PPT 原生闭合填充边界。'/>\r\n        </group>\r\n        <group id='roughLineShortcutGroup' label='线条快捷'>\r\n          <button id='lineThinShortcut' label='细线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换细线' supertip='把后续插入和当前手绘选区的内层权威线宽设为 1 磅。'/>\r\n          <button id='lineNormalShortcut' label='常规' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换常规线宽' supertip='把后续插入和当前手绘选区的内层权威线宽设为 2 磅。'/>\r\n          <button id='lineBoldShortcut' label='粗线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换粗线' supertip='把后续插入和当前手绘选区的内层权威线宽设为 4 磅。'/>\r\n          <button id='dashSolidShortcut' label='实线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换实线' supertip='把后续插入和当前手绘选区切换为实线边界。'/>\r\n          <button id='dashDashShortcut' label='虚线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换虚线' supertip='把后续插入和当前手绘选区切换为虚线边界，虚线长度随对象尺寸重新生成。'/>\r\n          <button id='dashDotShortcut' label='点线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换点线' supertip='把后续插入和当前手绘选区切换为点线边界。'/>\r\n          <button id='dashDashDotShortcut' label='点划线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换点划线' supertip='把后续插入和当前手绘选区切换为点划线边界。'/>\r\n          <button id='arrowNoneShortcut' label='无箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='关闭箭头' supertip='把后续直线类对象和当前直线手绘组选区切换为无箭头。'/>\r\n          <button id='arrowStartShortcut' label='起始箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用起始箭头' supertip='把后续直线类对象和当前直线手绘组选区切换为起点手绘箭头。'/>\r\n          <button id='arrowEndShortcut' label='末尾箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用末尾箭头' supertip='把后续直线类对象和当前直线手绘组选区切换为末尾手绘箭头。'/>\r\n          <button id='arrowBothShortcut' label='双向箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='启用双向箭头' supertip='把后续直线类对象和当前直线手绘组选区切换为两端手绘箭头。'/>\r\n          <button id='arrowTriangleShortcut' label='三角箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换三角箭头' supertip='把后续直线类对象和当前直线手绘组选区的箭头样式切换为三角箭头。'/>\r\n          <button id='arrowOpenShortcut' label='开放箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换开放箭头' supertip='把后续直线类对象和当前直线手绘组选区的箭头样式切换为开放箭头。'/>\r\n          <button id='arrowStealthShortcut' label='锐角箭头' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换锐角箭头' supertip='把后续直线类对象和当前直线手绘组选区的箭头样式切换为锐角箭头。'/>\r\n        </group>\r\n        <group id='roughSourceShortcutGroup' label='来源快捷'>\r\n          <button id='boundaryRoughJsShortcut' label='原版边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 Rough.js 边界' supertip='把后续插入和当前手绘选区的可见边界切换为本机 Rough.js 原版笔画来源；右侧风格面板仍可继续精调。'/>\r\n          <button id='boundaryExcalidrawShortcut' label='白板边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 Excalidraw 边界' supertip='把后续插入和当前手绘选区的可见边界切换为 Excalidraw 白板风格来源。'/>\r\n          <button id='boundaryDrawioShortcut' label='图表边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 draw.io 边界' supertip='把后续插入和当前手绘选区的可见边界切换为 draw.io 草图风格来源。'/>\r\n          <button id='boundaryD2Shortcut' label='D2 边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 D2 边界' supertip='把后续插入和当前手绘选区的可见边界切换为 D2 草图风格来源。'/>\r\n          <button id='boundaryTldrawShortcut' label='手线边界' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 tldraw 边界' supertip='把后续插入和当前手绘选区的可见边界切换为 tldraw 手绘线来源。'/>\r\n        </group>\r\n        <group id='roughFillSourceShortcutGroup' label='填充来源'>\r\n          <button id='fillSourceAutoShortcut' label='跟随填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充来源跟随边界' supertip='把填充纹理来源改为自动跟随当前边界来源，后续插入和当前手绘选区都会同步。'/>\r\n          <button id='fillSourceRoughJsShortcut' label='原版填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 Rough.js 填充' supertip='把填充纹理切换为 Rough.js 原版斜线纹理，同时保留 PPT 原生闭合填充边界。'/>\r\n          <button id='fillSourceExcalidrawShortcut' label='白板填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 Excalidraw 填充' supertip='把填充纹理切换为 Excalidraw 来源实填充，同时保留 PPT 原生闭合填充边界。'/>\r\n          <button id='fillSourceDrawioShortcut' label='图表填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 draw.io 填充' supertip='把填充纹理切换为 draw.io 来源斜线纹理，适合图表草图风格。'/>\r\n          <button id='fillSourceD2Shortcut' label='D2 填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 D2 填充' supertip='把填充纹理切换为 D2 来源斜线纹理，并使用 D2 默认纹理间距。'/>\r\n          <button id='fillSourceTldrawShortcut' label='手线填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换 tldraw 填充' supertip='把填充纹理切换为 tldraw 来源短划纹理，方便与任意边界来源混用。'/>\r\n          <button id='fillSourceBrushShortcut' label='宽刷填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='切换宽刷填充' supertip='把填充纹理切换为本插件自研宽刷涂刷来源，纹理仍是 PPT 原生可编辑线条。'/>\r\n        </group>\r\n        <group id='roughColorShortcutGroup' label='颜色快捷'>\r\n          <button id='strokeBlackShortcut' label='黑色线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条改为黑色' supertip='把后续插入和当前手绘选区的内层权威线条颜色改为纯黑。'/>\r\n          <button id='strokeBlueShortcut' label='蓝色线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条改为蓝色' supertip='把后续插入和当前手绘选区的内层权威线条颜色改为论文常用蓝色。'/>\r\n          <button id='strokeRedShortcut' label='红色线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条改为红色' supertip='把后续插入和当前手绘选区的内层权威线条颜色改为强调红色。'/>\r\n          <button id='strokeGreenShortcut' label='绿色线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条改为绿色' supertip='把后续插入和当前手绘选区的内层权威线条颜色改为对比绿色。'/>\r\n          <button id='fillYellowShortcut' label='黄色填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅黄色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅黄色。'/>\r\n          <button id='fillBlueShortcut' label='蓝色填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅蓝色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅蓝色。'/>\r\n          <button id='fillPinkShortcut' label='粉色填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅粉色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅粉色。'/>\r\n          <button id='fillGreenShortcut' label='绿色填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充改为浅绿色' supertip='把后续插入和当前手绘选区的 PPT 原生闭合填充改为浅绿色。'/>\r\n        </group>\r\n        <group id='roughTransparencyShortcutGroup' label='透明度'>\r\n          <button id='fillOpaqueShortcut' label='填充不透' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充设为不透明' supertip='把后续插入和当前手绘选区的 PPT 原生填充透明度设为 0，保持当前填充颜色和纹理设置。'/>\r\n          <button id='fillHalfShortcut' label='半透填充' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='填充设为半透明' supertip='把后续插入和当前手绘选区启用纯色填充并设为 50% 透明，适合叠放论文框图。'/>\r\n          <button id='strokeOpaqueShortcut' label='线条不透' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为不透明' supertip='把后续插入和当前手绘选区的内层权威线条透明度设为 0。'/>\r\n          <button id='strokeLightShortcut' label='淡化线条' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条设为 30% 透明' supertip='把后续插入和当前手绘选区的线条透明度设为 30%，用于降低辅助元素视觉重量。'/>\r\n          <button id='allOpaqueShortcut' label='全部不透' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='线条和填充不透明' supertip='同时把线条透明度和填充透明度设为 0，恢复清晰论文图默认效果。'/>\r\n        </group>\r\n        <group id='roughTemplateShortcutGroup' label='模板操作'>\r\n          <button id='templateApplyPane' label='应用模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位应用模板' supertip='打开右侧风格区并精确定位“应用”按钮，按当前模板选择应用到面板参数和选中对象。'/>\r\n          <button id='templateSavePane' label='保存模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位保存模板' supertip='打开右侧风格区并精确定位“保存模板”按钮，把当前参数保存为自定义模板。'/>\r\n          <button id='templateRenamePane' label='重命名模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位重命名模板' supertip='打开右侧风格区并精确定位“重命名”按钮；预置模板不能重命名。'/>\r\n          <button id='templateSelectPane' label='选择模板' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位模板下拉框' supertip='打开右侧风格区并定位模板选择框，用于切换 Rough.js、Excalidraw、draw.io、D2、tldraw 或自定义模板。'/>\r\n        </group>\r\n        <group id='roughAssetShortcutGroup' label='素材操作'>\r\n          <button id='assetSelectPane' label='选择素材' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位选择素材' supertip='打开右侧素材库并定位“全选/清空”按钮，便于选择要分享的素材。'/>\r\n          <button id='assetRefreshPane' label='刷新素材' getImage='GetShortcutImage' showImage='true' onAction='RefreshUserAssets' screentip='一键刷新素材' supertip='直接重新读取本机素材库并刷新顶部最近素材菜单；右侧素材库已打开时会同步更新列表。'/>\r\n          <button id='assetImportPane' label='导入素材包' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位导入素材包' supertip='打开右侧素材库并定位“导入”按钮，从安全 zip 分享素材包导入素材。'/>\r\n          <button id='assetSharePane' label='分享素材包' getImage='GetShortcutImage' showImage='true' onAction='OpenPaneSection' screentip='定位分享素材包' supertip='打开右侧素材库并定位“分享”按钮，可先选择素材再导出 zip 分享包。'/>\r\n        </group>\r\n        <group id='roughComboShortcutGroup' label='一键组合'>\r\n          <button id='comboPaperShortcut' label='黑白论文' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='应用黑白论文组合' supertip='一键设置黑色线条、白色不透明填充、常规线宽和实线，适合论文框图默认外观。'/>\r\n          <button id='comboBlueSketchShortcut' label='蓝线浅填' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='应用蓝色草图组合' supertip='一键设置蓝色线条、浅蓝填充、常规线宽和 Rough.js 边界。'/>\r\n          <button id='comboDashedFrameShortcut' label='虚线分组' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='应用虚线分组组合' supertip='一键设置无填充、黑色虚线和轻微手绘边界，适合分组框。'/>\r\n          <button id='comboBrushHighlightShortcut' label='涂刷高亮' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='应用涂刷高亮组合' supertip='一键设置浅黄色宽刷填充和黑色边线，用于突出重点区域。'/>\r\n          <button id='comboArrowLineShortcut' label='粗箭头线' getImage='GetShortcutImage' showImage='true' onAction='ApplyStyleShortcut' screentip='应用粗箭头线组合' supertip='一键设置粗线、实线和末尾手绘箭头，后续直线类对象直接使用。'/>\r\n        </group>\r\n        <group id='roughPaneShortcutGroup' label='窗格入口'>\r\n          <button id='openShapesPane' label='形状窗格' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位形状图库' supertip='打开右侧窗格并定位到 PPT 原生形状手绘版图库；顶部形状按钮仍可直接插入常用形状。'/>\r\n          <button id='openSearchPane' label='功能搜索' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位功能搜索' supertip='打开右侧窗格并聚焦全局搜索，可输入重绘、转换、填充、模板、素材等关键词快速定位。'/>\r\n          <button id='openPaperPresetPane' label='预设窗格' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位论文图预设' supertip='打开右侧窗格并定位到智能模型、大模型、多模态和医学论文图预设；会恢复全部分类，便于快速查找。'/>\n          <button id='openStylePane' label='风格窗格' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位风格参数' supertip='打开右侧窗格并定位到完整风格参数区，用于精调 Rough.js、填充、线条和纹理。'/>\r\n          <button id='openFeaturePane' label='特征窗格' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位特征块参数' supertip='打开右侧窗格并定位到 2D/3D 特征块工具，用于修改行列层数、颜色和方向。'/>\r\n          <button id='openAssetPane' label='素材窗格' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaneSection' screentip='定位我的素材' supertip='打开右侧窗格并定位到素材库，用于插入、删除、导入或分享本机素材。'/>\r\n        </group>\r\n        <group id='roughQuickGroup' label='快速插入'>\r\n          <button id='quickShape_0' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_1' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_2' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_3' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_4' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_5' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_6' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_7' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_8' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_9' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_10' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <button id='quickShape_11' getLabel='GetQuickShapeLabel' getScreentip='GetQuickShapeScreentip' getSupertip='GetQuickShapeSupertip' getImage='GetQuickShapeImage' getVisible='GetQuickShapeVisible' showImage='true' showLabel='false' onAction='InsertQuickShape'/>\r\n          <dynamicMenu id='quickShapeManageMenu' label='管理' getImage='GetFunctionalImage' getContent='GetQuickShapeManageMenu' screentip='管理快速插入' supertip='Ribbon 原生右键会显示 PowerPoint 菜单；请用这里移除快速插入栏中的固定形状，或打开素材库管理。'/>\r\n        </group>\r\n        <group id='roughFeatureGroup' label='特征块'>\r\n          <button id='insertFeatureBlock' label='特征块' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock' screentip='插入特征块' supertip='按任务窗格中的特征块参数插入 PPT 原生可编辑的 2D 或 3D 方块堆叠。'/>\r\n          <button id='insertFeatureBlock2D' label='2D 特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock2D' screentip='插入二维特征块' supertip='按当前特征块参数快速插入 2D 网格；右侧窗格仍可继续修改行列、颜色和间距。'/>\r\n          <button id='insertFeatureBlock3D' label='3D 特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertFeatureBlock3D' screentip='插入三维特征块' supertip='按当前特征块参数快速插入 3D 方块堆叠；默认 3x3x3、无圆角、零间距、黑色边线。'/>\r\n          <button id='insertRoughFeatureBlock' label='手绘特征' getImage='GetFunctionalImage' showImage='true' onAction='InsertRoughFeatureBlock' screentip='插入手绘特征块' supertip='按当前特征块参数快速插入手绘视觉的特征块，二维网格会对单块执行手绘重绘。'/>\r\n          <button id='saveFeatureDefault' label='保存默认' getImage='GetFunctionalImage' showImage='true' onAction='SaveFeatureDefault' screentip='保存特征块默认参数' supertip='把当前顶部或右侧窗格同步过来的特征块参数保存为本机默认值。'/>\r\n        </group>\r\n        <group id='roughFeaturePresetGroup' label='特征预设'>\r\n          <button id='featurePresetPaperMatrix' label='论文矩阵' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入论文矩阵特征块' supertip='一键插入 4x4 二维小块矩阵，蓝白渐变、黑色细边线，适合网络结构和特征图示意。'/>\r\n          <button id='featurePresetPaperVolume' label='体数据块' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入体数据特征块' supertip='一键插入 4x3x3 三维体数据块，蓝绿渐变、零间距、黑色细边线，适合 3D 医学或体素特征示意。'/>\r\n          <button id='featurePresetAttentionMap' label='注意力图' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入注意力图特征块' supertip='一键插入 5x5 二维注意力热图，粉黄渐变和黑色细边线，适合论文可视化模块。'/>\r\n          <menu id='featureMorePresetMenu' label='更多预设' getImage='GetFunctionalImage' showImage='true' itemSize='large' screentip='更多特征块预设' supertip='收纳基础 2D/3D、手绘特征、长条特征、间距、圆角和渐变方向等低频预设；完整参数仍在右侧特征块窗格。'>\r\n            <button id='featurePreset2DGrid' label='二维 3x3' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入二维 3x3 特征块' supertip='一键使用无圆角、零间距、黑色边线的 3x3 二维特征网格；若已选中特征块则更新选区。'/>\r\n            <button id='featurePreset3DStack' label='三维 3x3x3' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入三维 3x3x3 特征块' supertip='一键使用无圆角、零间距、黑色边线的 3x3x3 三维特征堆叠；若已选中特征块则更新选区。'/>\r\n            <button id='featurePreset2DRoughGrid' label='手绘二维' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入手绘二维特征块' supertip='一键插入 3x3 手绘二维特征网格，零间距时共享边不会重复描边。'/>\r\n            <button id='featurePreset3DRoughStack' label='手绘三维' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入手绘三维特征块' supertip='一键插入 3x3x3 手绘三维特征堆叠，输出仍为 PPT 原生可编辑对象。'/>\r\n            <button id='featurePresetPaperStrip' label='长条特征' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='插入长条特征块' supertip='一键插入 6x2 横向二维特征条，紫蓝渐变和轻微间距，适合论文中间层特征序列。'/>\r\n            <button id='featureGapZero' label='间距 0' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='特征块间距设为 0' supertip='把当前特征块参数的方块间距设为 0 并插入或更新选中特征块。'/>\r\n            <button id='featureGapFour' label='间距 4' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='特征块间距设为 4' supertip='把当前特征块参数的方块间距设为 4 磅并插入或更新选中特征块。'/>\r\n            <button id='featureNoRound' label='无圆角' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='特征块圆角归零' supertip='把当前特征块圆角设为 0 并插入或更新选中特征块，避免三维堆叠圆角遮挡。'/>\r\n            <button id='featureReverseGradient' label='反向渐变' getImage='GetFunctionalImage' showImage='true' onAction='ApplyFeatureShortcut' screentip='反向特征块渐变' supertip='对调当前特征块渐变方向上的起止颜色，并插入或更新选中特征块。'/>\r\n          </menu>\r\n        </group>\r\n        <group id='roughFeatureDirectionGroup' label='特征方向'>\r\n          <menu id='featureDirectionMenu' label='调整方向' getImage='GetFunctionalImage' showImage='true' itemSize='large' screentip='按方向增删特征块' supertip='收纳左、右、上、下、前、后六个方向的增删入口，避免顶部特征方向按钮平铺；完整尺寸参数仍在右侧窗格。'>\r\n            <button id='featureLeftMinus' label='左减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从左侧删除一列' supertip='按当前特征块参数或选中特征块参数，从左侧删除一列并保持右侧位置语义。'/>\r\n            <button id='featureLeftPlus' label='左加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向左侧增加一列' supertip='按当前特征块参数或选中特征块参数，向左侧增加一列并保持右侧位置语义。'/>\r\n            <button id='featureRightMinus' label='右减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从右侧删除一列' supertip='按当前特征块参数或选中特征块参数，从右侧删除一列并保持左侧位置语义。'/>\r\n            <button id='featureRightPlus' label='右加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向右侧增加一列' supertip='按当前特征块参数或选中特征块参数，向右侧增加一列并保持左侧位置语义。'/>\r\n            <button id='featureUpMinus' label='上减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从上方删除一行' supertip='按当前特征块参数或选中特征块参数，从上方删除一行并保持下方位置语义。'/>\r\n            <button id='featureUpPlus' label='上加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向上方增加一行' supertip='按当前特征块参数或选中特征块参数，向上方增加一行并保持下方位置语义。'/>\r\n            <button id='featureDownMinus' label='下减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从下方删除一行' supertip='按当前特征块参数或选中特征块参数，从下方删除一行并保持上方位置语义。'/>\r\n            <button id='featureDownPlus' label='下加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向下方增加一行' supertip='按当前特征块参数或选中特征块参数，向下方增加一行并保持上方位置语义。'/>\r\n            <button id='featureFrontMinus' label='前减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从前方删除一层' supertip='仅对三维特征块生效；从前方删除一层并保持后方位置语义。'/>\r\n            <button id='featureFrontPlus' label='前加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向前方增加一层' supertip='仅对三维特征块生效；向前方增加一层并保持后方位置语义。'/>\r\n            <button id='featureBackMinus' label='后减' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='从后方删除一层' supertip='仅对三维特征块生效；从后方删除一层并保持前方位置语义。'/>\r\n            <button id='featureBackPlus' label='后加' getImage='GetFunctionalImage' showImage='true' onAction='AdjustFeatureBlockDirection' screentip='向后方增加一层' supertip='仅对三维特征块生效；向后方增加一层并保持前方位置语义。'/>\r\n          </menu>\r\n        </group>\r\n        <group id='roughActionGroup' label='对象操作'>\r\n          <button id='convertSelection' label='转换手绘' getImage='GetFunctionalImage' showImage='true' onAction='ConvertSelectionToRough' screentip='转换选中原生形状' supertip='把当前选中的一个或多个 PowerPoint 原生形状替换为 Rough.js 手绘视觉的 PPT 原生可编辑对象；已生成的 Rough 手绘组会自动跳过。'/>\r\n          <button id='refreshShape' label='重绘选区' getImage='GetFunctionalImage' showImage='true' onAction='RefreshSelection' screentip='重绘手绘选区' supertip='按当前 PPT 尺寸、调整点和内层权威样式重新生成 Rough.js 视觉层。'/>\r\n          <button id='selectCarrier' label='选择载体' getImage='GetFunctionalImage' showImage='true' onAction='SelectNativeCarrier' screentip='选择原生载体' supertip='选中 Rough 组内隐藏的 PowerPoint 原生载体；调整 PowerPoint 调整点后点击“重绘选区”。'/>\r\n          <button id='inspectShape' label='一键检查' getImage='GetFunctionalImage' showImage='true' onAction='InspectSelection' screentip='检查手绘元数据' supertip='查看当前选区的原生对象、图层角色和重绘元数据，便于定位问题。'/>\r\n        </group>\r\n      <group id='roughDedupHiddenGroup' label='去重隐藏'>\r\n          <button id='openResearchChartStudio' label='科研绘图室' getImage='GetFunctionalImage' showImage='true' size='large' onAction='OpenResearchChartStudio' screentip='打开科研绘图室' supertip='打开独立科研绘图工作区，在本机配置数据并预览，确认后插入 PPT 原生可编辑图表；失败时回退右侧科研绘图区。'/>\r\n          <toggleButton id='assetSelectAll' getImage='GetFunctionalImage' showImage='true' size='large' getPressed='GetAssetSelectAllPressed' getLabel='GetAssetSelectAllLabel' onAction='ToggleAssetSelectAll' screentip='全选或清空素材' supertip='勾选当前筛选出的全部素材便于分享，清空则取消全部勾选；完整管理仍在右侧素材库。'/>\r\n          </group>\r\n      </tab>\r\n    </tabs>\r\n  </ribbon>\r\n</customUI>");
		}
		catch (Exception ex)
		{
			AddInLogger.Error("GetCustomUI失败 ribbonID=" + ribbonID + ",返回最小tab保底。", ex);
			return "<customUI xmlns='http://schemas.microsoft.com/office/2009/07/customui' onLoad='OnRibbonLoad'><ribbon><tabs><tab id='roughDiagramTab' label='手绘图形 Rough'><group id='roughFallbackGroup' label='常用'><button id='fallbackOpenPane' label='打开窗格' getImage='GetFunctionalImage' screentip='打开任务窗格' supertip='打开右侧任务窗格。' onAction='OpenPane'/></group></tab></tabs></ribbon></customUI>";
		}
	}

	private static string BuildConsolidatedRibbonXml(string sourceXml)
	{
		const string libraryButton = "<button id='openPaperImageLibrary' label='打开论文图片库' getImage='GetFunctionalImage' showImage='true' onAction='OpenPaperImageLibrary' screentip='打开 Zotero 论文图片库' supertip='运行中的 Zotero 会先刷新同一完整图库；离线时只读打开上次生成页。PPT 不复制图库界面，也不直接执行删除、导入或分享。'/>";
		const string UsageGuideButton = "<button id='openUsageGuide' label='使用说明' getImage='GetFunctionalImage' showImage='true' onAction='OpenUsageGuide' screentip='打开使用说明' supertip='打开独立使用说明窗口，随 PowerPoint 并排显示；失败时回退右侧窗格提示。'/>";
		string exportAssetsButton = "<button id='exportAssets'";
		int exportAssetsIndex = sourceXml.IndexOf(exportAssetsButton, StringComparison.Ordinal);
		if (exportAssetsIndex < 0)
		{
			AddInLogger.Error("Ribbon重组:未找到exportAssets,跳过论文库按钮注入,直接返回源XML以保住整tab。", null);
			return sourceXml;
		}
		sourceXml = sourceXml.Insert(exportAssetsIndex, UsageGuideButton + libraryButton);
		XmlDocument source = new XmlDocument();
		source.LoadXml(sourceXml);
		XmlDocument output = new XmlDocument();
		output.LoadXml("<customUI xmlns='http://schemas.microsoft.com/office/2009/07/customui' onLoad='OnRibbonLoad'><ribbon><tabs><tab id='roughDiagramTab' label='手绘图形 Rough'/></tabs></ribbon></customUI>");
		XmlNamespaceManager namespaceManager = new XmlNamespaceManager(output.NameTable);
		namespaceManager.AddNamespace("r", "http://schemas.microsoft.com/office/2009/07/customui");
		XmlNode tab = output.SelectSingleNode("//r:tab", namespaceManager);
		AppendRibbonGroup(source, output, tab, "roughMainGroup", "常用", new string[7] { "startShapeGallery", "startConvertSelection", "startRefreshShape", "startSelectCarrier", "startInspectSelection", "startSearchPane", "startOpenPane" });
		AppendExistingRibbonGroup(source, output, tab, "roughQuickGroup");
		AppendRibbonGroup(source, output, tab, "roughStyleGroup", "风格", new string[4] { "startStylePresetMenu", "startStyleComboMenu", "primaryFillMenu", "primaryLineMenu" }, forceLarge: true);
		AppendRibbonGroup(source, output, tab, "roughResearchGroup", "论文与特征", new string[11] { "openResearchChartStudio", "paperSuiteMenu", "insertFeatureBlock2D", "insertFeatureBlock3D", "insertRoughFeatureBlock", "featurePresetPaperMatrix", "featurePresetPaperVolume", "featurePresetAttentionMap", "featureMorePresetMenu", "featureDirectionMenu", "saveFeatureDefault" });
		AppendRibbonGroup(source, output, tab, "roughLibraryGroup", "素材", new string[7] { "saveAsset", "assetSelectAll", "startRecentAssetMenu", "startRefreshAssets", "importAssets", "exportAssets", "openPaperImageLibrary" });
		return output.OuterXml;
	}

	private static void AppendRibbonGroup(XmlDocument source, XmlDocument output, XmlNode tab, string groupId, string label, IEnumerable<string> controlIds, bool forceLarge = false)
	{
		XmlElement group = output.CreateElement("group", "http://schemas.microsoft.com/office/2009/07/customui");
		group.SetAttribute("id", groupId);
		group.SetAttribute("label", label);
		foreach (string controlId in controlIds)
		{
			XmlElement sourceControl = FindRibbonElement(source, controlId);
			if (sourceControl == null)
			{
				continue;
			}
			XmlNode control = output.ImportNode(sourceControl, deep: true);
			if (string.Equals(controlId, "paperSuiteMenu", StringComparison.Ordinal))
			{
				RemoveRibbonDescendant(control, "paperSuiteMatrix");
				RemoveRibbonDescendant(control, "paperSuiteVolume");
				RemoveRibbonDescendant(control, "paperSuiteAttention");
			}
			if (forceLarge && control.Attributes?["size"] == null)
			{
				((XmlElement)control).SetAttribute("size", "large");
			}
			group.AppendChild(control);
		}
		tab.AppendChild(group);
	}

	private static void AppendExistingRibbonGroup(XmlDocument source, XmlDocument output, XmlNode tab, string groupId)
	{
		XmlElement found = FindRibbonElement(source, groupId);
		if (found == null)
		{
			return;
		}
		tab.AppendChild(output.ImportNode(found, deep: true));
	}

	private static XmlElement FindRibbonElement(XmlDocument document, string id)
	{
		XmlElement element = document.SelectSingleNode("//*[@id='" + id + "']") as XmlElement;
		if (element == null)
		{
			AddInLogger.Error("Ribbon重组:缺失控件已跳过,保留其余分组可见:id=" + id, null);
		}
		return element;
	}

	private static void RemoveRibbonDescendant(XmlNode root, string id)
	{
		XmlNode node = root.SelectSingleNode(".//*[@id='" + id + "']");
		node?.ParentNode?.RemoveChild(node);
	}

	public void OnRibbonLoad(IRibbonUI ribbonUi)
	{
		ribbon = ribbonUi;
		MaterialSymbolIconFactory.WarmUp();
		ribbon?.Invalidate();
	}

	public static void InvalidateActiveQuickShapes()
	{
		activeInstance?.InvalidateQuickShapes();
	}

	public static void InvalidateActiveRecentAssets()
	{
		activeInstance?.InvalidateRecentAssets();
	}

	public static void SetActiveStylePreset(string stylePresetId)
	{
		activeInstance?.SetActiveStylePresetCore(stylePresetId ?? string.Empty);
	}

	public string GetShapeMenu(IRibbonControl control)
	{
		StringBuilder builder = new StringBuilder();
		builder.Append("<menu xmlns='http://schemas.microsoft.com/office/2009/07/customui'>");
		foreach (ShapeMenuGroup group in LoadShapeMenuGroups())
		{
			builder.Append("<menuSeparator id='sep");
			builder.Append(EscapeId(group.Id));
			builder.Append("' title='");
			builder.Append(Xml(group.Title));
			builder.Append("'/>");
			builder.Append("<gallery id='roughGallery_");
			builder.Append(EscapeId(group.Id));
			builder.Append("' label='");
			builder.Append(Xml(group.Title));
			builder.Append("' showLabel='false' showItemLabel='false' columns='12' rows='3' itemWidth='28' itemHeight='28' getItemCount='GetShapeMenuGalleryItemCount' getItemID='GetShapeMenuGalleryItemId' getItemImage='GetShapeMenuGalleryItemImage' getItemLabel='GetShapeMenuGalleryItemLabel' getItemScreentip='GetShapeMenuGalleryItemScreentip' onAction='InsertShapeFromGallery' screentip='");
			builder.Append(Xml(group.Title));
			builder.Append("' supertip='");
			builder.Append(Xml(group.Title));
			builder.Append("：只显示形状图标，悬浮时显示形状名称。'/>");
		}
		builder.Append("</menu>");
		return builder.ToString();
	}

	public string GetQuickShapeManageMenu(IRibbonControl control)
	{
		StringBuilder builder = new StringBuilder();
		builder.Append("<menu xmlns='http://schemas.microsoft.com/office/2009/07/customui'>");
		builder.Append("<button id='quickManageOpenPane' label='打开素材库和快速插入管理' getImage='GetFunctionalImage' onAction='OpenPane' screentip='打开管理窗格' supertip='打开右侧窗格，在快速插入栏中添加、刷新或移除常用形状。'/>");
		IList<string> shapes = Controller?.ListQuickShapes() ?? new List<string>();
		if (shapes.Count == 0)
		{
			builder.Append("<button id='quickManageEmpty' label='暂无固定形状' getImage='GetFunctionalImage' enabled='false' screentip='暂无固定形状' supertip='当前快速插入栏没有固定形状。'/>");
		}
		else
		{
			builder.Append("<menuSeparator id='quickManageSep' title='移除固定形状'/>");
			for (int i = 0; i < shapes.Count && i < 12; i++)
			{
				string enumName = shapes[i] ?? string.Empty;
				builder.Append("<");
				builder.Append("button id='");
				builder.Append("quickRemove_");
				builder.Append(i.ToString(CultureInfo.InvariantCulture));
				builder.Append("_");
				builder.Append(EscapeId(enumName));
				builder.Append("' label='移除：");
				builder.Append(Xml(FindShapeLabel(enumName)));
				builder.Append("' getImage='GetQuickShapeRemoveImage' onAction='UnpinQuickShapeFromMenu' screentip='从快速插入移除' supertip='从快速插入栏移除此固定形状；不会删除幻灯片中的已有对象。'/>");
			}
		}
		builder.Append("</menu>");
		return builder.ToString();
	}

	public string GetRecentAssetMenu(IRibbonControl control)
	{
		StringBuilder builder = new StringBuilder();
		builder.Append("<menu xmlns='http://schemas.microsoft.com/office/2009/07/customui'>");
		builder.Append("<button id='recentAssetOpenPane' label='打开素材库' getImage='GetFunctionalImage' onAction='OpenPaneSection' screentip='打开素材库' supertip='打开右侧窗格并定位到我的素材，用于管理、删除、选择导出或插入完整素材列表。'/>");
		IList<UserAssetInfo> assets = Controller?.ListUserAssets() ?? new List<UserAssetInfo>();
		if (assets.Count == 0)
		{
			builder.Append("<button id='recentAssetEmpty' label='暂无已保存素材' getImage='GetFunctionalImage' enabled='false' screentip='暂无素材' supertip='当前本机素材库没有可插入的已保存素材；可先选择 PPT 对象并点击保存素材。'/>");
		}
		else
		{
			builder.Append("<menuSeparator id='recentAssetSep' title='最近保存素材'/>");
			for (int i = 0; i < assets.Count && i < 12; i++)
			{
				UserAssetInfo asset = assets[i];
				string displayName = (string.IsNullOrWhiteSpace(asset.DisplayName) ? asset.Id : asset.DisplayName);
				builder.Append("<");
				builder.Append("button id='");
				builder.Append("recentAsset_");
				builder.Append(i.ToString(CultureInfo.InvariantCulture));
				builder.Append("' label='");
				builder.Append(Xml(displayName));
				builder.Append("' getImage='GetRecentAssetImage' onAction='InsertRecentAssetFromMenu' screentip='插入最近素材' supertip='插入“");
				builder.Append(Xml(displayName));
				builder.Append("”这一 PPT 原生可编辑素材；不会删除或修改素材库。'/>");
			}
		}
		builder.Append("</menu>");
		return builder.ToString();
	}

	public void OpenPane(IRibbonControl control)
	{
		try
		{
			Controller?.ShowTaskPane();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenPane失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("OpenPane失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void OpenShapeGallery(IRibbonControl control)
	{
		try
		{
			if (shapeGalleryWindow == null || shapeGalleryWindow.IsDisposed)
			{
				shapeGalleryWindow = new ShapeGalleryWindow(delegate(string enumName)
				{
					Controller?.InsertShape(enumName);
				}, delegate(string enumName)
				{
					Controller?.PinQuickShape(enumName);
				}, delegate(string enumName)
				{
					Controller?.UnpinQuickShape(enumName);
				}, () => Controller?.ListQuickShapes(), () => Controller?.GetPowerPointWindowHandle() ?? IntPtr.Zero, delegate(string message, bool isError)
				{
					if (Controller == null)
					{
						MessageBox.Show(message, "Rough 手绘图形");
					}
					else
					{
						Controller.ShowTaskPaneSection("catalog");
						Controller.NotifyRibbonStatus(message, isError);
					}
				});
			}
			shapeGalleryWindow.ShowNearCursor();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenShapeGallery失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("OpenShapeGallery失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertLine(IRibbonControl control)
	{
		try
		{
			Controller?.InsertShape("msoShapeLine");
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertLine失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertLine失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertArrow(IRibbonControl control)
	{
		try
		{
			Controller?.InsertShape("msoShapeLineArrow");
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertArrow失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertArrow失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertRectangle(IRibbonControl control)
	{
		try
		{
			Controller?.InsertShape("msoShapeRectangle");
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertRectangle失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertRectangle失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertEllipse(IRibbonControl control)
	{
		try
		{
			Controller?.InsertShape("msoShapeOval");
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertEllipse失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertEllipse失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertCommonShape(IRibbonControl control)
	{
		try
		{
			string enumName = CommonShapeEnum(control?.Id);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				if (string.Equals(control?.Id, "commonDashedFrame", StringComparison.OrdinalIgnoreCase) || string.Equals(control?.Id, "primaryDashedFrame", StringComparison.OrdinalIgnoreCase))
				{
					Controller?.InsertShape(enumName, DashedFrameStyle());
				}
				else
				{
					Controller?.InsertShape(enumName);
				}
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertCommonShape失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertCommonShape失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertComponentShape(IRibbonControl control)
	{
		try
		{
			string enumName = ComponentShapeEnum(control?.Id);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				Controller?.InsertShape(enumName, ComponentShapeStyle(control?.Id));
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertComponentShape失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertComponentShape失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public object GetCommonShapeImage(IRibbonControl control)
	{
		string enumName = CommonShapeEnum(control?.Id);
		if (!string.IsNullOrWhiteSpace(enumName))
		{
			return GetLocalShapeImageForEnum(enumName, control?.Id);
		}
		return FunctionalIconFactory.Create(control?.Id, 32, 32);
	}

	public object GetComponentShapeImage(IRibbonControl control)
	{
		string enumName = ComponentShapeEnum(control?.Id);
		if (!string.IsNullOrWhiteSpace(enumName))
		{
			return GetLocalShapeImageForEnum(enumName, control?.Id);
		}
		return FunctionalIconFactory.Create(control?.Id, 32, 32);
	}

	public void ApplyRibbonStylePreset(IRibbonControl control, bool pressed)
	{
		try
		{
			string presetId = StylePresetTargetId(control?.Id);
			RoughStyle style = RibbonStylePreset(presetId);
			if (style != null)
			{
				currentStylePresetId = presetId;
				Controller?.ApplyRoughStylePreset(style, StylePresetLabel(presetId));
				InvalidateStylePresets();
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ApplyRibbonStylePreset失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ApplyRibbonStylePreset失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public bool GetStylePresetPressed(IRibbonControl control)
	{
		return string.Equals(StylePresetTargetId(control?.Id), currentStylePresetId, StringComparison.OrdinalIgnoreCase);
	}

	public object GetStylePresetImage(IRibbonControl control)
	{
		return StylePresetIconFactory.Create(StylePresetTargetId(control?.Id), control?.Id, 32, 32);
	}

	private static readonly string[] BuiltInStyleGalleryPresetIds = new string[13]
	{
		"stylePresetGentle", "stylePresetPaper", "stylePresetBold", "stylePresetNested", "stylePresetTextured", "stylePresetRoughJs", "stylePresetExcalidraw", "stylePresetDrawio", "stylePresetD2", "stylePresetTldraw",
		"stylePresetBrush", "stylePresetFragments", "stylePresetDenseFragments"
	};

	public int GetStylePresetGalleryItemCount(IRibbonControl control)
	{
		return BuiltInStyleGalleryPresetIds.Length;
	}

	public string GetStylePresetGalleryItemId(IRibbonControl control, int index)
	{
		if (index < 0 || index >= BuiltInStyleGalleryPresetIds.Length)
		{
			return string.Empty;
		}
		return BuiltInStyleGalleryPresetIds[index];
	}

	public string GetStylePresetGalleryItemLabel(IRibbonControl control, int index)
	{
		if (index < 0 || index >= BuiltInStyleGalleryPresetIds.Length)
		{
			return string.Empty;
		}
		return StylePresetLabel(BuiltInStyleGalleryPresetIds[index]);
	}

	public string GetStylePresetGalleryItemScreentip(IRibbonControl control, int index)
	{
		if (index < 0 || index >= BuiltInStyleGalleryPresetIds.Length)
		{
			return string.Empty;
		}
		return "应用" + StylePresetLabel(BuiltInStyleGalleryPresetIds[index]);
	}

	public object GetStylePresetGalleryItemImage(IRibbonControl control, int index)
	{
		if (index < 0 || index >= BuiltInStyleGalleryPresetIds.Length)
		{
			return null;
		}
		return StylePresetIconFactory.Create(BuiltInStyleGalleryPresetIds[index], "startStyleGallery", 64, 48);
	}

	public void ApplyStylePresetFromGallery(IRibbonControl control, string selectedId, int selectedIndex)
	{
		try
		{
			string presetId = (!string.IsNullOrWhiteSpace(selectedId) ? selectedId : ((selectedIndex >= 0 && selectedIndex < BuiltInStyleGalleryPresetIds.Length) ? BuiltInStyleGalleryPresetIds[selectedIndex] : null));
			RoughStyle style = (!string.IsNullOrWhiteSpace(presetId) ? RibbonStylePreset(presetId) : null);
			if (style != null)
			{
				currentStylePresetId = presetId;
				Controller?.ApplyRoughStylePreset(style, StylePresetLabel(presetId));
				InvalidateStylePresets();
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ApplyStylePresetFromGallery失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ApplyStylePresetFromGallery失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void OpenResearchChartStudio(IRibbonControl control)
	{
		try
		{
			Controller?.ShowResearchChartStudio();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenResearchChartStudio失败：" + ex.Message, isError: true);
			}
			catch { }
			try
			{
				Controller?.ShowTaskPaneSection("charts");
			}
			catch { }
		}
	}

	private bool assetSelectAllPressed;

	public bool GetAssetSelectAllPressed(IRibbonControl control)
	{
		return assetSelectAllPressed;
	}

	public string GetAssetSelectAllLabel(IRibbonControl control)
	{
		return (assetSelectAllPressed ? "清空选择" : "全选素材");
	}

	public void ToggleAssetSelectAll(IRibbonControl control, bool pressed)
	{
		try
		{
			assetSelectAllPressed = pressed;
			Controller?.ShowTaskPaneSection("assetSelect");
			Controller?.NotifyRibbonStatus((pressed ? "已在右侧素材库定位全选入口，可一键勾选当前筛选素材。" : "已取消横条全选态，右侧素材库保持可管理。"), isError: false);
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ToggleAssetSelectAll失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ToggleAssetSelectAll失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ApplyPaperStylePreset(IRibbonControl control)
	{
		try
		{
			RoughStyle style = RibbonStylePreset("stylePresetPaper");
			if (style != null)
			{
				currentStylePresetId = "stylePresetPaper";
				Controller?.ApplyRoughStylePreset(style, "论文风格");
				InvalidateStylePresets();
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ApplyPaperStylePreset失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ApplyPaperStylePreset失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ApplyStyleShortcut(IRibbonControl control)
	{
		try
		{
			string shortcutId = StyleShortcutTargetId(control?.Id);
			if (CanApplyStyleShortcut(shortcutId))
			{
				currentStylePresetId = string.Empty;
				Controller?.ApplyRoughStyleShortcut(delegate(RoughStyle style)
				{
					ApplyStyleShortcutPatch(shortcutId, style);
				}, StyleShortcutLabel(shortcutId));
				InvalidateStylePresets();
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ApplyStyleShortcut失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ApplyStyleShortcut失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public object GetShortcutImage(IRibbonControl control)
	{
		return ShortcutIconFactory.Create(StyleShortcutTargetId(control?.Id), control?.Id, 32, 32);
	}

	public object GetFunctionalImage(IRibbonControl control)
	{
		return FunctionalIconFactory.Create(control?.Id, 32, 32);
	}

	public void OpenPaneSection(IRibbonControl control)
	{
		try
		{
			string section = PaneSectionForControl(control?.Id);
			if (!string.IsNullOrWhiteSpace(section))
			{
				Controller?.ShowTaskPaneSection(section);
			}
			else
			{
				Controller?.ShowTaskPane();
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenPaneSection失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("OpenPaneSection失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void OpenUsageGuide(IRibbonControl control)
	{
		try
		{
			Controller?.ShowUsageGuide();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenUsageGuide失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("OpenUsageGuide失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void OpenPaperImageLibrary(IRibbonControl control)
	{
		try
		{
			Controller?.OpenPaperImageLibrary();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("OpenPaperImageLibrary失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("OpenPaperImageLibrary失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertQuickShape(IRibbonControl control)
	{
		try
		{
			string enumName = GetQuickShapeEnum(control);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				Controller?.InsertShape(enumName);
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertQuickShape失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertQuickShape失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void RefreshQuickShapes(IRibbonControl control)
	{
		try
		{
			InvalidateQuickShapes();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("RefreshQuickShapes失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("RefreshQuickShapes失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void UnpinQuickShapeFromMenu(IRibbonControl control)
	{
		try
		{
			string enumName = ParseQuickRemoveEnum(control?.Id);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				Controller?.UnpinQuickShape(enumName);
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("UnpinQuickShapeFromMenu失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("UnpinQuickShapeFromMenu失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public object GetQuickShapeRemoveImage(IRibbonControl control)
	{
		string enumName = ParseQuickRemoveEnum(control?.Id);
		if (!string.IsNullOrWhiteSpace(enumName))
		{
			return GetLocalShapeImageForEnum(enumName, control?.Id);
		}
		return FunctionalIconFactory.Create(control?.Id, 32, 32);
	}

	public void InsertRecentAssetFromMenu(IRibbonControl control)
	{
		string assetId = GetRecentAssetId(control);
		if (string.IsNullOrWhiteSpace(assetId))
		{
			return;
		}
		try
		{
			Controller?.InsertUserAsset(assetId);
		}
		catch (Exception ex)
		{
			if (Controller == null)
			{
				MessageBox.Show("插入素材失败：" + ex.Message, "Rough 手绘图形");
				return;
			}
			Controller.ShowTaskPaneSection("library");
			Controller.NotifyRibbonStatus("插入素材失败：" + ex.Message, isError: true);
		}
	}

	public object GetRecentAssetImage(IRibbonControl control)
	{
		return GetLibraryImage(control);
	}

	public void RunSelectionNextAction(IRibbonControl control)
	{
		try
		{
			Controller?.RunSelectionNextAction();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("RunSelectionNextAction失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("RunSelectionNextAction失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ConvertSelectionToRough(IRibbonControl control)
	{
		try
		{
			Controller?.ConvertSelectionToRough(null);
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ConvertSelectionToRough失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ConvertSelectionToRough失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void RefreshSelection(IRibbonControl control)
	{
		try
		{
			Controller?.RefreshSelection();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("RefreshSelection失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("RefreshSelection失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void SelectNativeCarrier(IRibbonControl control)
	{
		try
		{
			Controller?.SelectNativeCarrier();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("SelectNativeCarrier失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("SelectNativeCarrier失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InspectSelection(IRibbonControl control)
	{
		try
		{
			Controller?.InspectSelection();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InspectSelection失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InspectSelection失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void SaveSelectionAsAsset(IRibbonControl control)
	{
		try
		{
			Controller?.SaveSelectionAsAsset();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("SaveSelectionAsAsset失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("SaveSelectionAsAsset失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertFeatureBlock(IRibbonControl control)
	{
		try
		{
			Controller?.InsertFeatureBlockFromPreset();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertFeatureBlock失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertFeatureBlock失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertFeatureBlock2D(IRibbonControl control)
	{
		try
		{
			Controller?.InsertFeatureBlockFromPreset("2d", null);
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertFeatureBlock2D失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertFeatureBlock2D失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertFeatureBlock3D(IRibbonControl control)
	{
		try
		{
			Controller?.InsertFeatureBlockFromPreset("3d", null);
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertFeatureBlock3D失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertFeatureBlock3D失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertRoughFeatureBlock(IRibbonControl control)
	{
		try
		{
			Controller?.InsertFeatureBlockFromPreset(null, "rough");
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertRoughFeatureBlock失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertRoughFeatureBlock失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void SaveFeatureDefault(IRibbonControl control)
	{
		try
		{
			Controller?.SaveCurrentFeatureBlockPreset();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("SaveFeatureDefault失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("SaveFeatureDefault失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ApplyFeatureShortcut(IRibbonControl control)
	{
		try
		{
			Controller?.ApplyFeatureBlockShortcut(FeatureShortcutTargetId(control?.Id));
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ApplyFeatureShortcut失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ApplyFeatureShortcut失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertPaperStructurePreset(IRibbonControl control)
	{
		try
		{
			Controller?.InsertPaperStructurePreset(PaperStructurePresetTargetId(control?.Id));
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertPaperStructurePreset失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertPaperStructurePreset失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void AdjustFeatureBlockDirection(IRibbonControl control)
	{
		try
		{
			FeatureDirectionCommand adjustment = FeatureDirectionAdjustment(control?.Id);
			if (!string.IsNullOrWhiteSpace(adjustment.Direction))
			{
				Controller?.AdjustFeatureBlockFromPreset(adjustment.Direction, adjustment.Delta);
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("AdjustFeatureBlockDirection失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("AdjustFeatureBlockDirection失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ImportAssets(IRibbonControl control)
	{
		try
		{
			Controller?.ImportUserAssetsFromRibbon();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ImportAssets失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ImportAssets失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void ExportAssets(IRibbonControl control)
	{
		try
		{
			Controller?.ExportUserAssetsFromRibbon();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("ExportAssets失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("ExportAssets失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void RefreshUserAssets(IRibbonControl control)
	{
		try
		{
			Controller?.RefreshUserAssetsFromRibbon();
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("RefreshUserAssets失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("RefreshUserAssets失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public object GetLibraryImage(IRibbonControl control)
	{
		return LibraryIconFactory.Create(control?.Id, 32, 32);
	}

	public void InsertShapeFromMenu(IRibbonControl control)
	{
		try
		{
			string enumName = ParseEnumNameFromControlId(control?.Id);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				Controller?.InsertShape(enumName);
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertShapeFromMenu失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertShapeFromMenu失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public void InsertShapeFromGallery(IRibbonControl control, string selectedId, int selectedIndex)
	{
		try
		{
			ShapeMenuItem item = GetGalleryItem(control, selectedIndex);
			if (item == null && !string.IsNullOrWhiteSpace(selectedId))
			{
				string enumName = ParseEnumNameFromControlId(selectedId);
				if (!string.IsNullOrWhiteSpace(enumName))
				{
					Controller?.InsertShape(enumName);
				}
			}
			else if (item != null)
			{
				Controller?.InsertShape(item.EnumName);
			}
		}
		catch (Exception ex)
		{
			try
			{
				Controller?.NotifyRibbonStatus("InsertShapeFromGallery失败：" + ex.Message, isError: true);
			}
			catch { }
			if (Controller == null)
			{
				MessageBox.Show("InsertShapeFromGallery失败：" + ex.Message, "手绘图形");
			}
		}
	}

	public int GetShapeMenuGalleryItemCount(IRibbonControl control)
	{
		return ShapeItemsForGallery(control?.Id).Count;
	}

	public string GetShapeMenuGalleryItemId(IRibbonControl control, int index)
	{
		ShapeMenuItem item = GetGalleryItem(control, index);
		if (item != null)
		{
			return "roughShape_" + index.ToString(CultureInfo.InvariantCulture) + "_" + item.EnumName;
		}
		return string.Empty;
	}

	public string GetShapeMenuGalleryItemLabel(IRibbonControl control, int index)
	{
		return GetGalleryItem(control, index)?.Label ?? string.Empty;
	}

	public string GetShapeMenuGalleryItemScreentip(IRibbonControl control, int index)
	{
		return GetGalleryItem(control, index)?.Label ?? string.Empty;
	}

	public object GetShapeMenuGalleryItemImage(IRibbonControl control, int index)
	{
		try
		{
			ShapeMenuItem item = GetGalleryItem(control, index);
			if (item != null)
			{
				return GetShapeImageForEnum(item.EnumName);
			}
			return FunctionalIconFactory.Create(control?.Id, 32, 32);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("GetShapeMenuGalleryItemImage失败，返回占位图标。control=" + control?.Id + " index=" + index, ex);
			return FunctionalIconFactory.Create(control?.Id, 32, 32);
		}
	}

	public object GetShapeImage(IRibbonControl control)
	{
		string enumName = ParseEnumNameFromControlId(control?.Id);
		if (string.IsNullOrWhiteSpace(enumName))
		{
			return FunctionalIconFactory.Create(control?.Id, 32, 32);
		}
		return GetShapeImageForEnum(enumName, control?.Id);
	}

	public bool GetQuickShapeVisible(IRibbonControl control)
	{
		return !string.IsNullOrWhiteSpace(GetQuickShapeEnum(control));
	}

	public string GetQuickShapeLabel(IRibbonControl control)
	{
		return GetQuickShapeDisplayName(control);
	}

	public string GetQuickShapeScreentip(IRibbonControl control)
	{
		string displayName = GetQuickShapeDisplayName(control);
		if (!string.IsNullOrWhiteSpace(displayName))
		{
			return "快速插入：" + displayName;
		}
		return "快速插入";
	}

	public string GetQuickShapeSupertip(IRibbonControl control)
	{
		string displayName = GetQuickShapeDisplayName(control);
		if (!string.IsNullOrWhiteSpace(displayName))
		{
			return "插入“" + displayName + "”的 Rough.js 视觉 PPT 原生可编辑形状。";
		}
		return "快速插入栏暂无固定形状。";
	}

	public object GetQuickShapeImage(IRibbonControl control)
	{
		try
		{
			string enumName = GetQuickShapeEnum(control);
			if (!string.IsNullOrWhiteSpace(enumName))
			{
				return GetLocalShapeImageForEnum(enumName);
			}
			return FunctionalIconFactory.Create(control?.Id, 32, 32);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("GetQuickShapeImage失败，返回占位图标。control=" + control?.Id, ex);
			return FunctionalIconFactory.Create(control?.Id, 32, 32);
		}
	}

	private string GetQuickShapeDisplayName(IRibbonControl control)
	{
		string enumName = GetQuickShapeEnum(control);
		if (!string.IsNullOrWhiteSpace(enumName))
		{
			return FindShapeLabel(enumName);
		}
		return string.Empty;
	}

	private object GetLocalShapeImageForEnum(string enumName, string identity = null)
	{
		string key = "local|" + (enumName ?? string.Empty) + "|" + (identity ?? string.Empty);
		if (shapeImageCache.TryGetValue(key, out var cached))
		{
			return cached;
		}
		object image = ShapeIconFactory.Create(enumName, 32, 32, identity);
		shapeImageCache[key] = image;
		return image;
	}

	private object GetShapeImageForEnum(string enumName, string identity = null)
	{
		string key = "shape|" + (enumName ?? string.Empty) + "|" + (identity ?? string.Empty);
		if (shapeImageCache.TryGetValue(key, out var cached))
		{
			return cached;
		}
		object image = ShapeIconFactory.Create(enumName, 32, 32, identity);
		shapeImageCache[key] = image;
		return image;
	}

	private void InvalidateQuickShapes()
	{
		if (ribbon == null)
		{
			return;
		}
		try
		{
			for (int i = 0; i < 12; i++)
			{
				ribbon.InvalidateControl("quickShape_" + i.ToString(CultureInfo.InvariantCulture));
			}
			ribbon.InvalidateControl("quickShapeManageMenu");
		}
		catch
		{
		}
	}

	private void InvalidateRecentAssets()
	{
		if (ribbon == null)
		{
			return;
		}
		try
		{
			ribbon.InvalidateControl("startRecentAssetMenu");
		}
		catch
		{
		}
	}

	private void InvalidateStylePresets()
	{
		if (ribbon == null)
		{
			return;
		}
		try
		{
			string[] visibleStylePresetControlIds = VisibleStylePresetControlIds;
			foreach (string id in visibleStylePresetControlIds)
			{
				ribbon.InvalidateControl(id);
			}
			ribbon.InvalidateControl("startStyleGallery");
			ribbon.InvalidateControl("assetSelectAll");
		}
		catch
		{
		}
	}

	private void SetActiveStylePresetCore(string stylePresetId)
	{
		string targetId = StylePresetTargetId(stylePresetId);
		currentStylePresetId = (StylePresetIds.Contains(targetId ?? string.Empty) ? targetId : string.Empty);
		InvalidateStylePresets();
	}

	private string GetQuickShapeEnum(IRibbonControl control)
	{
		int index = ParseQuickShapeIndex(control?.Id);
		if (index < 0)
		{
			return null;
		}
		IList<string> shapes = Controller?.ListQuickShapes();
		if (shapes == null || index >= shapes.Count)
		{
			return null;
		}
		return shapes[index];
	}

	private string GetRecentAssetId(IRibbonControl control)
	{
		int index = ParseRecentAssetIndex(control?.Id);
		if (index < 0)
		{
			return null;
		}
		IList<UserAssetInfo> assets = Controller?.ListUserAssets();
		if (assets == null || index >= assets.Count)
		{
			return null;
		}
		return assets[index]?.Id;
	}

	private static string CommonShapeEnum(string controlId)
	{
		switch (controlId ?? string.Empty)
		{
		case "primaryLine":
		case "commonLine":
			return "msoShapeLine";
		case "commonArrow":
		case "primaryArrow":
			return "msoShapeLineArrow";
		case "commonRectangle":
			return "msoShapeRectangle";
		case "commonDashedFrame":
		case "primaryRectangle":
		case "primaryDashedFrame":
			return "msoShapeRectangle";
		case "commonRoundedRectangle":
		case "primaryRoundedRectangle":
			return "msoShapeRoundedRectangle";
		case "primaryOval":
		case "commonOval":
			return "msoShapeOval";
		case "commonDiamond":
		case "primaryDiamond":
			return "msoShapeDiamond";
		case "primaryTriangle":
		case "commonTriangle":
			return "msoShapeIsoscelesTriangle";
		case "commonCurve":
			return "msoShapeCurve";
		case "commonDoubleCircle":
		case "primaryDoubleCircle":
			return "msoShapeDonut";
		case "commonTrapezoid":
		case "primaryTrapezoid":
			return "msoShapeTrapezoid";
		case "commonPentagon":
			return "msoShapeRegularPentagon";
		case "commonHexagon":
			return "msoShapeHexagon";
		case "commonBidirectionalArrow":
			return "msoShapeLeftRightArrow";
		case "commonCubeRough":
			return "rough3dCubeRough";
		case "commonCylinderRough":
			return "rough3dCylinderRough";
		case "commonStraightConnector":
			return "msoShapeStraightConnector";
		case "commonElbowConnector":
			return "msoShapeElbowConnector";
		case "commonCurvedConnector":
			return "msoShapeCurvedConnector";
		case "commonFlowProcess":
			return "msoShapeFlowchartProcess";
		case "commonFlowDecision":
			return "msoShapeFlowchartDecision";
		case "commonFlowData":
			return "msoShapeFlowchartData";
		case "commonFlowTerminator":
			return "msoShapeFlowchartTerminator";
		case "commonFlowDocument":
			return "msoShapeFlowchartDocument";
		case "commonFlowPreparation":
			return "msoShapeFlowchartPreparation";
		case "commonRectCallout":
			return "msoShapeRectangularCallout";
		case "commonRoundRectCallout":
			return "msoShapeRoundedRectangularCallout";
		case "commonOvalCallout":
			return "msoShapeOvalCallout";
		case "commonCloudCallout":
			return "msoShapeCloudCallout";
		case "commonCubePlain":
			return "rough3dCubePlain";
		case "commonCylinderPlain":
			return "rough3dCylinderPlain";
		case "commonConePlain":
			return "rough3dConePlain";
		case "commonPyramidPlain":
			return "rough3dPyramidPlain";
		case "commonSpherePlain":
			return "rough3dSpherePlain";
		case "commonStackPlain":
			return "rough3dStackPlain";
		case "commonConeRough":
			return "rough3dConeRough";
		case "commonPyramidRough":
			return "rough3dPyramidRough";
		case "commonSphereRough":
			return "rough3dSphereRough";
		case "commonStackRough":
			return "rough3dStackRough";
		default:
			return string.Empty;
		}
	}

	private static RoughStyle DashedFrameStyle()
	{
		return new RoughStyle
		{
			FillMode = "none",
			FillStyle = "none",
			DashStyle = "dash",
			StrokeWidthPt = 2f,
			Roughness = 0.8,
			Bowing = 0.35,
			EdgeJitterPt = 1.35,
			MaxRandomnessOffset = 1.35,
			StrokePasses = 1,
			CurveSampling = 1.0,
			FragmentStrokeDensity = 0.0,
			FillTransparency = 0.0
		};
	}

	private static string ComponentShapeEnum(string controlId)
	{
		switch (controlId ?? string.Empty)
		{
		case "componentPaperNode":
		case "primaryPaperNode":
		case "paperSuiteNode":
			return "msoShapeRoundedRectangle";
		case "componentBlueNode":
		case "primaryBlueNode":
		case "primaryHighlightBox":
		case "paperSuiteHighlight":
		case "componentHighlightBox":
			return "msoShapeRoundedRectangle";
		case "primaryDashedGroup":
		case "paperSuiteGroup":
		case "componentDashedFrame":
			return "msoShapeRectangle";
		case "componentArrowLine":
		case "primaryArrowLine":
		case "paperSuiteArrow":
			return "msoShapeLineArrow";
		case "paperSuiteDecision":
		case "componentDecision":
		case "primaryDecisionNode":
			return "msoShapeFlowchartDecision";
		case "paperSuiteData":
		case "componentDataNode":
		case "primaryDataNode":
			return "msoShapeFlowchartData";
		case "primaryNoteCallout":
		case "componentNoteCallout":
			return "msoShapeRoundedRectangularCallout";
		default:
			return string.Empty;
		}
	}

	private static RoughStyle ComponentShapeStyle(string controlId)
	{
		RoughStyle style = new RoughStyle();
		switch (controlId ?? string.Empty)
		{
		case "primaryDataNode":
		case "primaryBlueNode":
		case "componentDataNode":
		case "componentBlueNode":
		case "paperSuiteData":
			ApplyStyleShortcutPatch("comboBlueSketchShortcut", style);
			break;
		case "primaryHighlightBox":
		case "paperSuiteHighlight":
		case "componentNoteCallout":
		case "primaryNoteCallout":
		case "componentHighlightBox":
			ApplyStyleShortcutPatch("comboBrushHighlightShortcut", style);
			break;
		case "paperSuiteGroup":
		case "componentDashedFrame":
		case "primaryDashedGroup":
			ApplyStyleShortcutPatch("comboDashedFrameShortcut", style);
			break;
		case "paperSuiteArrow":
		case "componentArrowLine":
		case "primaryArrowLine":
			ApplyStyleShortcutPatch("comboArrowLineShortcut", style);
			break;
		default:
			ApplyStyleShortcutPatch("comboPaperShortcut", style);
			break;
		}
		return style;
	}

	private static FeatureDirectionCommand FeatureDirectionAdjustment(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"featureLeftMinus" => new FeatureDirectionCommand("left", -1), 
			"featureLeftPlus" => new FeatureDirectionCommand("left", 1), 
			"featureRightMinus" => new FeatureDirectionCommand("right", -1), 
			"featureRightPlus" => new FeatureDirectionCommand("right", 1), 
			"featureUpMinus" => new FeatureDirectionCommand("up", -1), 
			"featureUpPlus" => new FeatureDirectionCommand("up", 1), 
			"featureDownMinus" => new FeatureDirectionCommand("down", -1), 
			"featureDownPlus" => new FeatureDirectionCommand("down", 1), 
			"featureFrontMinus" => new FeatureDirectionCommand("front", -1), 
			"featureFrontPlus" => new FeatureDirectionCommand("front", 1), 
			"featureBackMinus" => new FeatureDirectionCommand("back", -1), 
			"featureBackPlus" => new FeatureDirectionCommand("back", 1), 
			_ => new FeatureDirectionCommand(string.Empty, 0), 
		};
	}

	private static bool CanApplyStyleShortcut(string controlId)
	{
		switch (controlId ?? string.Empty)
		{
		case "lineThinShortcut":
		case "arrowEndShortcut":
		case "fillNoneShortcut":
		case "fillPinkShortcut":
		case "lineBoldShortcut":
		case "fillBlueShortcut":
		case "fillDotsShortcut":
		case "dashDashShortcut":
		case "fillHalfShortcut":
		case "strokeRedShortcut":
		case "allOpaqueShortcut":
		case "arrowNoneShortcut":
		case "arrowBothShortcut":
		case "arrowOpenShortcut":
		case "fillWhiteShortcut":
		case "nestedTwoShortcut":
		case "fillGreenShortcut":
		case "fillSolidShortcut":
		case "dashSolidShortcut":
		case "fillBrushShortcut":
		case "fillCrossShortcut":
		case "nestedThreeShortcut":
		case "fillHachureShortcut":
		case "strokeLightShortcut":
		case "classicModeShortcut":
		case "dashDashDotShortcut":
		case "strokeBlackShortcut":
		case "strokeGreenShortcut":
		case "fillDashedTextureShortcut":
		case "fillSourceRoughJsShortcut":
		case "randomSeedShortcut":
		case "comboPaperShortcut":
		case "arrowStartShortcut":
		case "boundaryD2Shortcut":
		case "strokeBlueShortcut":
		case "fillYellowShortcut":
		case "fillZigzagShortcut":
		case "lineNormalShortcut":
		case "fillOpaqueShortcut":
		case "fillZigzagLineShortcut":
		case "fillSourceAutoShortcut":
		case "comboArrowLineShortcut":
		case "boundaryDrawioShortcut":
		case "boundaryTldrawShortcut":
		case "arrowTriangleShortcut":
		case "nestedReverseShortcut":
		case "arrowStealthShortcut":
		case "fillSourceD2Shortcut":
		case "strokeOpaqueShortcut":
		case "boundaryRoughJsShortcut":
		case "fillSourceBrushShortcut":
		case "comboBlueSketchShortcut":
		case "fillSourceDrawioShortcut":
		case "fillSourceTldrawShortcut":
		case "comboDashedFrameShortcut":
		case "dashDotShortcut":
		case "boundaryExcalidrawShortcut":
		case "fillSourceExcalidrawShortcut":
		case "comboBrushHighlightShortcut":
			return true;
		default:
			return false;
		}
	}

	private static string StyleShortcutTargetId(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"startStyleComboMenu" => "comboPaperShortcut", 
			"startComboPaper" => "comboPaperShortcut", 
			"startComboBlueSketch" => "comboBlueSketchShortcut", 
			"startComboDashedFrame" => "comboDashedFrameShortcut", 
			"startComboBrushHighlight" => "comboBrushHighlightShortcut", 
			"startComboArrowLine" => "comboArrowLineShortcut", 
			"primaryWhiteFill" => "fillWhiteShortcut", 
			"primaryNoFill" => "fillNoneShortcut", 
			"primaryBrushFill" => "fillBrushShortcut", 
			"primaryBlackStroke" => "strokeBlackShortcut", 
			"primaryBlueStroke" => "strokeBlueShortcut", 
			"primaryBoldLine" => "lineBoldShortcut", 
			"primaryDashLine" => "dashDashShortcut", 
			"primaryEndArrow" => "arrowEndShortcut", 
			"primaryRandomSeed" => "randomSeedShortcut", 
			"primaryYellowFill" => "fillYellowShortcut", 
			"primaryBlueFill" => "fillBlueShortcut", 
			"primaryNormalLine" => "lineNormalShortcut", 
			"primarySolidLine" => "dashSolidShortcut", 
			"primaryNoArrow" => "arrowNoneShortcut", 
			"primaryAllOpaque" => "allOpaqueShortcut", 
			_ => controlId, 
		};
	}

	private static string FeatureShortcutTargetId(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"paperSuiteMatrix" => "featurePresetPaperMatrix", 
			"paperSuiteVolume" => "featurePresetPaperVolume", 
			"paperSuiteAttention" => "featurePresetAttentionMap", 
			_ => controlId, 
		};
	}

	private static string PaperStructurePresetTargetId(string controlId)
	{
		return PaperStructurePresetService.NormalizePresetId(controlId);
	}

	private static string StylePresetTargetId(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"startStylePresetMenu" => "stylePresetRoughJs", 
			"startStyleRoughJs" => "stylePresetRoughJs", 
			"startStyleExcalidraw" => "stylePresetExcalidraw", 
			"startStyleDrawio" => "stylePresetDrawio", 
			"startStyleD2" => "stylePresetD2", 
			"startStyleTldraw" => "stylePresetTldraw", 
			"startStyleBrush" => "stylePresetBrush", 
			"startStyleFragments" => "stylePresetFragments", 
			"startStyleDenseFragments" => "stylePresetDenseFragments", 
			_ => controlId, 
		};
	}

	private static void ApplyStyleShortcutPatch(string controlId, RoughStyle style)
	{
		if (style == null)
		{
			return;
		}
		string text = controlId ?? string.Empty;
		if (text == null)
		{
			return;
		}
		switch (text.Length)
		{
		case 16:
			switch (text[4])
			{
			case 'N':
				if (text == "fillNoneShortcut")
				{
					style.FillMode = "none";
					style.FillStyle = "none";
					style.FillSource = "auto";
					style.FillTransparency = 0.0;
				}
				break;
			case 'D':
				if (!(text == "fillDotsShortcut"))
				{
					if (text == "dashDashShortcut")
					{
						style.DashStyle = "dash";
					}
					break;
				}
				style.FillMode = "solid";
				style.FillSource = "roughjs";
				style.FillStyle = "dots";
				style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
				style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
				style.FillTransparency = 0.0;
				break;
			case 'T':
				if (text == "lineThinShortcut")
				{
					style.StrokeWidthPt = 1f;
				}
				break;
			case 'B':
				if (!(text == "lineBoldShortcut"))
				{
					if (text == "fillBlueShortcut")
					{
						ApplySolidFillColor(style, "#d7ecff");
					}
				}
				else
				{
					style.StrokeWidthPt = 4f;
				}
				break;
			case 'w':
				if (text == "arrowEndShortcut")
				{
					style.ArrowheadStyle = "rough";
					style.ArrowheadPosition = "end";
				}
				break;
			case 'P':
				if (text == "fillPinkShortcut")
				{
					ApplySolidFillColor(style, "#fde2e8");
				}
				break;
			case 'H':
				if (text == "fillHalfShortcut")
				{
					style.FillMode = "solid";
					if (string.Equals(style.FillStyle, "none", StringComparison.OrdinalIgnoreCase))
					{
						style.FillStyle = "solid";
					}
					style.FillTransparency = 0.5;
				}
				break;
			}
			break;
		case 17:
			switch (text[4])
			{
			case 'S':
				if (!(text == "fillSolidShortcut"))
				{
					if (text == "dashSolidShortcut")
					{
						style.DashStyle = "solid";
					}
				}
				else
				{
					style.FillMode = "solid";
					style.FillStyle = "solid";
					style.FillSource = "auto";
					style.FillTransparency = 0.0;
				}
				break;
			case 'W':
				if (text == "fillWhiteShortcut")
				{
					style.FillMode = "solid";
					style.FillColor = "#ffffff";
					style.FillStyle = "solid";
					style.FillSource = "auto";
					style.FillTransparency = 0.0;
				}
				break;
			case 'B':
				if (text == "fillBrushShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "brush";
					style.FillStyle = "brush";
					style.BrushWidthPt = Math.Max(5.0, style.BrushWidthPt);
					style.BrushDensity = Math.Max(1.1, style.BrushDensity);
					style.BrushOverlap = Math.Max(0.35, style.BrushOverlap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'C':
				if (text == "fillCrossShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "roughjs";
					style.FillStyle = "cross-hatch";
					style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
					style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'w':
				switch (text)
				{
				case "arrowNoneShortcut":
					style.ArrowheadStyle = "none";
					style.ArrowheadPosition = "end";
					break;
				case "arrowBothShortcut":
					style.ArrowheadStyle = "rough";
					style.ArrowheadPosition = "both";
					break;
				case "arrowOpenShortcut":
					style.ArrowheadStyle = "open";
					break;
				}
				break;
			case 'k':
				if (text == "strokeRedShortcut")
				{
					style.Stroke = "#c42b1c";
					style.StrokeTransparency = 0.0;
				}
				break;
			case 'G':
				if (text == "fillGreenShortcut")
				{
					ApplySolidFillColor(style, "#dff3df");
				}
				break;
			case 'p':
				if (text == "allOpaqueShortcut")
				{
					style.StrokeTransparency = 0.0;
					style.FillTransparency = 0.0;
				}
				break;
			case 'e':
				if (text == "nestedTwoShortcut")
				{
					style.RoughMode = "nested";
					style.NestedLayers = 2;
				}
				break;
			}
			break;
		case 19:
			switch (text[8])
			{
			case 'u':
				if (text == "fillHachureShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "roughjs";
					style.FillStyle = "hachure";
					style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
					style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'D':
				if (text == "dashDashDotShortcut")
				{
					style.DashStyle = "dash-dot";
				}
				break;
			case 'a':
				if (text == "strokeBlackShortcut")
				{
					style.Stroke = "#000000";
					style.StrokeTransparency = 0.0;
				}
				break;
			case 'e':
				if (text == "strokeGreenShortcut")
				{
					style.Stroke = "#107c41";
					style.StrokeTransparency = 0.0;
				}
				break;
			case 'g':
				if (text == "strokeLightShortcut")
				{
					style.StrokeTransparency = 0.3;
				}
				break;
			case 'o':
				if (text == "classicModeShortcut")
				{
					style.RoughMode = "classic";
				}
				break;
			case 'r':
				if (text == "nestedThreeShortcut")
				{
					style.RoughMode = "nested";
					style.NestedLayers = 3;
					style.NestedOverlap = Math.Max(0.5, style.NestedOverlap);
				}
				break;
			}
			break;
		case 25:
			switch (text[4])
			{
			case 'D':
				if (text == "fillDashedTextureShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "roughjs";
					style.FillStyle = "dashed";
					style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
					style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'S':
				if (text == "fillSourceRoughJsShortcut")
				{
					ApplyFillSource(style, "roughjs", "hachure", -1.0, -1.0);
				}
				break;
			}
			break;
		case 18:
			switch (text[4])
			{
			case 'Z':
				if (text == "fillZigzagShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "roughjs";
					style.FillStyle = "zigzag";
					style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
					style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'N':
				if (text == "lineNormalShortcut")
				{
					style.StrokeWidthPt = 2f;
				}
				break;
			case 'w':
				if (text == "arrowStartShortcut")
				{
					style.ArrowheadStyle = "rough";
					style.ArrowheadPosition = "start";
				}
				break;
			case 'd':
				if (text == "boundaryD2Shortcut")
				{
					ApplyBoundarySource(style, "d2", "roughJs", preserveVertices: false, 0.95);
					style.Bowing = Math.Max(2.0, style.Bowing);
					style.EdgeJitterPt = Math.Max(1.1, style.EdgeJitterPt);
				}
				break;
			case 'k':
				if (text == "strokeBlueShortcut")
				{
					style.Stroke = "#0f6cbd";
					style.StrokeTransparency = 0.0;
				}
				break;
			case 'Y':
				if (text == "fillYellowShortcut")
				{
					ApplySolidFillColor(style, "#fff2cc");
				}
				break;
			case 'O':
				if (text == "fillOpaqueShortcut")
				{
					style.FillTransparency = 0.0;
				}
				break;
			case 'o':
				if (!(text == "randomSeedShortcut"))
				{
					if (text == "comboPaperShortcut")
					{
						style.Stroke = "#000000";
						style.StrokeWidthPt = 2f;
						style.StrokeTransparency = 0.0;
						style.DashStyle = "solid";
						style.ArrowheadStyle = "none";
						style.FillMode = "solid";
						style.FillStyle = "solid";
						style.FillSource = "auto";
						style.FillColor = "#ffffff";
						style.FillTransparency = 0.0;
					}
				}
				else
				{
					style.Seed = (int)(DateTime.UtcNow.Ticks % 2147483000);
					if (style.Seed <= 0)
					{
						style.Seed = 1;
					}
				}
				break;
			}
			break;
		case 22:
			switch (text[8])
			{
			case 'a':
				if (text == "fillZigzagLineShortcut")
				{
					style.FillMode = "solid";
					style.FillSource = "roughjs";
					style.FillStyle = "zigzag-line";
					style.FillWeight = ((style.FillWeight < 0.0) ? 1.0 : style.FillWeight);
					style.HachureGap = ((style.HachureGap < 0.0) ? 8.0 : style.HachureGap);
					style.FillTransparency = 0.0;
				}
				break;
			case 'D':
				if (text == "boundaryDrawioShortcut")
				{
					ApplyBoundarySource(style, "drawio", "roughJs", preserveVertices: true, 1.0);
					style.Roughness = Math.Max(2.0, style.Roughness);
					style.Bowing = Math.Max(1.0, style.Bowing);
					style.EdgeJitterPt = Math.Max(1.55, style.EdgeJitterPt);
				}
				break;
			case 'T':
				if (text == "boundaryTldrawShortcut")
				{
					ApplyBoundarySource(style, "tldraw", "nativeWarp", preserveVertices: true, style.CurveFitting);
					style.TldrawOffsetPt = Math.Max(0.67, style.TldrawOffsetPt);
					style.EdgeJitterPt = Math.Max(0.67, style.EdgeJitterPt);
				}
				break;
			case 'c':
				if (text == "fillSourceAutoShortcut")
				{
					style.FillSource = "auto";
				}
				break;
			case 'o':
				if (text == "comboArrowLineShortcut")
				{
					style.StrokeWidthPt = 4f;
					style.StrokeTransparency = 0.0;
					style.DashStyle = "solid";
					style.ArrowheadStyle = "rough";
					style.ArrowheadPosition = "end";
				}
				break;
			}
			break;
		case 21:
			switch (text[0])
			{
			case 'a':
				if (text == "arrowTriangleShortcut")
				{
					style.ArrowheadStyle = "triangle";
				}
				break;
			case 'n':
				if (text == "nestedReverseShortcut")
				{
					style.RoughMode = "nested";
					style.NestedDirection = (string.Equals(style.NestedDirection, "leftDownToRightUp", StringComparison.OrdinalIgnoreCase) ? "leftUpToRightDown" : "leftDownToRightUp");
				}
				break;
			}
			break;
		case 20:
			switch (text[0])
			{
			case 'a':
				if (text == "arrowStealthShortcut")
				{
					style.ArrowheadStyle = "stealth";
				}
				break;
			case 'f':
				if (text == "fillSourceD2Shortcut")
				{
					ApplyFillSource(style, "d2", "hachure", 2.0, 16.0);
				}
				break;
			case 's':
				if (text == "strokeOpaqueShortcut")
				{
					style.StrokeTransparency = 0.0;
				}
				break;
			}
			break;
		case 23:
			switch (text[0])
			{
			case 'b':
				if (text == "boundaryRoughJsShortcut")
				{
					ApplyBoundarySource(style, "roughjs", "roughJs", preserveVertices: false, 0.95);
					style.DisableMultiStrokeFill = false;
				}
				break;
			case 'f':
				if (text == "fillSourceBrushShortcut")
				{
					ApplyFillSource(style, "brush", "brush", style.FillWeight, style.HachureGap);
					style.BrushWidthPt = Math.Max(5.0, style.BrushWidthPt);
					style.BrushDensity = Math.Max(1.1, style.BrushDensity);
					style.BrushOverlap = Math.Max(0.35, style.BrushOverlap);
				}
				break;
			case 'c':
				if (text == "comboBlueSketchShortcut")
				{
					style.Stroke = "#0f6cbd";
					style.StrokeWidthPt = 2f;
					style.StrokeTransparency = 0.0;
					style.DashStyle = "solid";
					style.FillMode = "solid";
					style.FillStyle = "solid";
					style.FillSource = "auto";
					style.FillColor = "#d7ecff";
					style.FillTransparency = 0.0;
					ApplyBoundarySource(style, "roughjs", "roughJs", preserveVertices: false, Math.Max(0.95, style.CurveFitting));
				}
				break;
			case 'd':
			case 'e':
				break;
			}
			break;
		case 24:
			switch (text[10])
			{
			case 'D':
				if (text == "fillSourceDrawioShortcut")
				{
					ApplyFillSource(style, "drawio", "hachure", -1.0, -1.0);
				}
				break;
			case 'T':
				if (text == "fillSourceTldrawShortcut")
				{
					ApplyFillSource(style, "tldraw", "dashed", -1.0, -1.0);
				}
				break;
			case 'd':
				if (text == "comboDashedFrameShortcut")
				{
					style.Stroke = "#000000";
					style.StrokeWidthPt = 2f;
					style.StrokeTransparency = 0.0;
					style.DashStyle = "dash";
					style.ArrowheadStyle = "none";
					style.FillMode = "none";
					style.FillStyle = "none";
					style.FillSource = "auto";
				}
				break;
			}
			break;
		case 15:
			if (text == "dashDotShortcut")
			{
				style.DashStyle = "dot";
			}
			break;
		case 26:
			if (text == "boundaryExcalidrawShortcut")
			{
				ApplyBoundarySource(style, "excalidraw", "roughJs", preserveVertices: true, 1.0);
				style.EdgeJitterPt = Math.Max(1.45, style.EdgeJitterPt);
				style.FragmentStrokeDensity = Math.Max(0.15, style.FragmentStrokeDensity);
			}
			break;
		case 28:
			if (text == "fillSourceExcalidrawShortcut")
			{
				ApplyFillSource(style, "excalidraw", "solid", 1.0, 8.0);
			}
			break;
		case 27:
			if (text == "comboBrushHighlightShortcut")
			{
				style.Stroke = "#000000";
				style.StrokeWidthPt = 2f;
				style.StrokeTransparency = 0.0;
				style.FillMode = "solid";
				style.FillColor = "#fff2cc";
				style.FillTransparency = 0.0;
				ApplyFillSource(style, "brush", "brush", style.FillWeight, style.HachureGap);
				style.BrushWidthPt = Math.Max(6.0, style.BrushWidthPt);
				style.BrushDensity = Math.Max(1.2, style.BrushDensity);
				style.BrushOverlap = Math.Max(0.4, style.BrushOverlap);
			}
			break;
		}
	}

	private static void ApplyBoundarySource(RoughStyle style, string source, string engine, bool preserveVertices, double curveFitting)
	{
		style.RoughSource = source;
		style.RoughEngine = engine;
		style.PreserveVertices = preserveVertices;
		style.DisableMultiStroke = false;
		if (curveFitting > 0.0)
		{
			style.CurveFitting = curveFitting;
		}
	}

	private static void ApplyFillSource(RoughStyle style, string source, string fillStyle, double fillWeight, double hachureGap)
	{
		style.FillMode = "solid";
		style.FillSource = source;
		style.FillStyle = fillStyle;
		style.FillTransparency = 0.0;
		if (fillWeight >= 0.0 || string.Equals(source, "roughjs", StringComparison.OrdinalIgnoreCase) || string.Equals(source, "drawio", StringComparison.OrdinalIgnoreCase))
		{
			style.FillWeight = fillWeight;
		}
		if (hachureGap >= 0.0 || string.Equals(source, "roughjs", StringComparison.OrdinalIgnoreCase) || string.Equals(source, "drawio", StringComparison.OrdinalIgnoreCase))
		{
			style.HachureGap = hachureGap;
		}
	}

	private static void ApplySolidFillColor(RoughStyle style, string color)
	{
		style.FillMode = "solid";
		style.FillStyle = "solid";
		style.FillColor = color;
		style.FillTransparency = 0.0;
	}

	private static string StyleShortcutLabel(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"fillNoneShortcut" => "无填充", 
			"fillSolidShortcut" => "纯色填充", 
			"fillWhiteShortcut" => "白色填充", 
			"fillBrushShortcut" => "涂刷填充", 
			"fillHachureShortcut" => "斜线纹理", 
			"fillCrossShortcut" => "交叉纹理", 
			"fillDotsShortcut" => "点状纹理", 
			"fillDashedTextureShortcut" => "短划纹理", 
			"fillZigzagShortcut" => "锯齿纹理", 
			"fillZigzagLineShortcut" => "折线纹理", 
			"lineThinShortcut" => "细线", 
			"lineNormalShortcut" => "常规线宽", 
			"lineBoldShortcut" => "粗线", 
			"dashSolidShortcut" => "实线", 
			"dashDashShortcut" => "虚线", 
			"dashDotShortcut" => "点线", 
			"dashDashDotShortcut" => "点划线", 
			"arrowNoneShortcut" => "无箭头", 
			"arrowStartShortcut" => "起始箭头", 
			"arrowEndShortcut" => "末尾箭头", 
			"arrowBothShortcut" => "双向箭头", 
			"arrowTriangleShortcut" => "三角箭头", 
			"arrowOpenShortcut" => "开放箭头", 
			"arrowStealthShortcut" => "锐角箭头", 
			"boundaryRoughJsShortcut" => "Rough.js 原版边界", 
			"boundaryExcalidrawShortcut" => "Excalidraw 边界", 
			"boundaryDrawioShortcut" => "draw.io 边界", 
			"boundaryD2Shortcut" => "D2 边界", 
			"boundaryTldrawShortcut" => "tldraw 边界", 
			"fillSourceAutoShortcut" => "填充来源跟随边界", 
			"fillSourceRoughJsShortcut" => "Rough.js 填充来源", 
			"fillSourceExcalidrawShortcut" => "Excalidraw 填充来源", 
			"fillSourceDrawioShortcut" => "draw.io 填充来源", 
			"fillSourceD2Shortcut" => "D2 填充来源", 
			"fillSourceTldrawShortcut" => "tldraw 填充来源", 
			"fillSourceBrushShortcut" => "宽刷填充来源", 
			"strokeBlackShortcut" => "黑色线条", 
			"strokeBlueShortcut" => "蓝色线条", 
			"strokeRedShortcut" => "红色线条", 
			"strokeGreenShortcut" => "绿色线条", 
			"fillYellowShortcut" => "黄色填充", 
			"fillBlueShortcut" => "蓝色填充", 
			"fillPinkShortcut" => "粉色填充", 
			"fillGreenShortcut" => "绿色填充", 
			"fillOpaqueShortcut" => "填充不透明", 
			"fillHalfShortcut" => "半透明填充", 
			"strokeOpaqueShortcut" => "线条不透明", 
			"strokeLightShortcut" => "淡化线条", 
			"allOpaqueShortcut" => "全部不透明", 
			"randomSeedShortcut" => "换一版手绘扰动", 
			"classicModeShortcut" => "普通边界", 
			"nestedTwoShortcut" => "二层嵌套", 
			"nestedThreeShortcut" => "三层嵌套", 
			"nestedReverseShortcut" => "反向嵌套", 
			"comboPaperShortcut" => "黑白论文组合", 
			"comboBlueSketchShortcut" => "蓝线浅填组合", 
			"comboDashedFrameShortcut" => "虚线分组组合", 
			"comboBrushHighlightShortcut" => "涂刷高亮组合", 
			"comboArrowLineShortcut" => "粗箭头线组合", 
			_ => "顶部快捷样式", 
		};
	}

	private static string PaneSectionForControl(string controlId)
	{
		switch (controlId ?? string.Empty)
		{
		case "openShapesPane":
			return "catalog";
		case "openSearchPane":
			return "search";
		case "openPaperPresetPane":
			return "paperPresets";
		case "openStylePane":
			return "style";
		case "openFeaturePane":
			return "featureBlock";
		case "recentAssetOpenPane":
		case "openAssetPane":
			return "library";
		case "templateApplyPane":
			return "templateApply";
		case "templateSavePane":
			return "templateSave";
		case "startTemplateSave":
			return "templateSave";
		case "templateRenamePane":
			return "templateRename";
		case "startTemplateRename":
			return "templateRename";
		case "templateSelectPane":
			return "templateSelect";
		case "assetSelectPane":
			return "assetSelect";
		case "assetRefreshPane":
			return "assetRefresh";
		case "assetImportPane":
			return "assetImport";
		case "assetSharePane":
			return "assetShare";
		case "compactTemplateSelect":
		case "primaryTemplateSelect":
			return "templateSelect";
		case "primaryAssetSelect":
		case "compactAssetSelect":
			return "assetSelect";
		case "startSearchPane":
		case "compactSearchPane":
			return "search";
		case "startQuickInsert":
		case "compactQuickInsert":
			return "quickInsert";
		default:
			return string.Empty;
		}
	}

	private static string StylePresetLabel(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"stylePresetGentle" => "轻微手绘", 
			"stylePresetPaper" => "论文框图", 
			"stylePresetBold" => "粗线草图", 
			"stylePresetNested" => "嵌套边界", 
			"stylePresetTextured" => "纹理填充", 
			"stylePresetRoughJs" => "Rough.js 原版", 
			"stylePresetExcalidraw" => "白板风格", 
			"stylePresetDrawio" => "图表风格", 
			"stylePresetD2" => "D2 风格", 
			"stylePresetTldraw" => "手线风格", 
			"stylePresetBrush" => "涂刷风格", 
			"stylePresetFragments" => "碎线风格", 
			"stylePresetDenseFragments" => "密集碎线", 
			_ => "风格模板", 
		};
	}

	private static RoughStyle RibbonStylePreset(string controlId)
	{
		return (controlId ?? string.Empty) switch
		{
			"stylePresetGentle" => new RoughStyle
			{
				Roughness = 0.55,
				Bowing = 0.2,
				EdgeJitterPt = 0.85,
				MaxRandomnessOffset = 0.8,
				StrokePasses = 1,
				CurveSampling = 0.8,
				FragmentStrokeDensity = 0.0,
				RoughMode = "classic",
				FillSource = "auto",
				FillStyle = "none"
			}, 
			"stylePresetPaper" => new RoughStyle
			{
				Roughness = 0.8,
				Bowing = 0.35,
				EdgeJitterPt = 1.35,
				MaxRandomnessOffset = 1.35,
				StrokePasses = 1,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.0,
				RoughMode = "classic",
				FillSource = "auto",
				FillStyle = "none"
			}, 
			"stylePresetBold" => new RoughStyle
			{
				StrokeWidthPt = 2.8f,
				Roughness = 1.25,
				Bowing = 0.7,
				EdgeJitterPt = 2.1,
				MaxRandomnessOffset = 1.9,
				StrokePasses = 2,
				CurveSampling = 1.25,
				FragmentStrokeDensity = 0.4,
				RoughMode = "classic",
				FillSource = "auto",
				FillStyle = "none"
			}, 
			"stylePresetNested" => new RoughStyle
			{
				Roughness = 0.9,
				Bowing = 0.35,
				EdgeJitterPt = 1.35,
				MaxRandomnessOffset = 1.25,
				StrokePasses = 1,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.0,
				RoughMode = "nested",
				NestedLayers = 2,
				NestedOverlap = 0.58,
				NestedGapPt = 5.0,
				NestedJitterPt = 0.55,
				NestedDirection = "leftDownToRightUp",
				FillSource = "auto",
				FillStyle = "none"
			}, 
			"stylePresetTextured" => new RoughStyle
			{
				Roughness = 1.05,
				Bowing = 0.55,
				EdgeJitterPt = 1.7,
				MaxRandomnessOffset = 1.7,
				StrokePasses = 2,
				CurveSampling = 1.1,
				FragmentStrokeDensity = 0.6,
				RoughMode = "classic",
				FillMode = "solid",
				FillSource = "roughjs",
				FillStyle = "hachure"
			}, 
			"stylePresetRoughJs" => new RoughStyle
			{
				StrokeWidthPt = 1f,
				Roughness = 1.0,
				Bowing = 1.0,
				EdgeJitterPt = 1.25,
				MaxRandomnessOffset = 2.0,
				StrokePasses = 2,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.0,
				RoughEngine = "roughJs",
				RoughSource = "roughjs",
				FillSource = "roughjs",
				PreserveVertices = false,
				DisableMultiStroke = false,
				DisableMultiStrokeFill = false,
				CurveFitting = 0.95,
				FillWeight = -1.0,
				HachureGap = -1.0,
				Seed = 0,
				RoughMode = "classic",
				FillStyle = "none"
			}, 
			"stylePresetExcalidraw" => new RoughStyle
			{
				StrokeWidthPt = 2f,
				Roughness = 1.0,
				Bowing = 1.0,
				EdgeJitterPt = 1.45,
				MaxRandomnessOffset = 2.0,
				StrokePasses = 2,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.15,
				RoughEngine = "roughJs",
				RoughSource = "excalidraw",
				FillMode = "solid",
				FillSource = "excalidraw",
				PreserveVertices = true,
				DisableMultiStroke = false,
				DisableMultiStrokeFill = false,
				CurveFitting = 1.0,
				FillWeight = 1.0,
				HachureGap = 8.0,
				Seed = 1,
				RoughMode = "classic",
				FillStyle = "solid"
			}, 
			"stylePresetDrawio" => new RoughStyle
			{
				Roughness = 2.0,
				Bowing = 1.0,
				EdgeJitterPt = 1.55,
				MaxRandomnessOffset = 2.0,
				StrokePasses = 2,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.2,
				RoughEngine = "roughJs",
				RoughSource = "drawio",
				FillSource = "drawio",
				PreserveVertices = true,
				DisableMultiStroke = false,
				DisableMultiStrokeFill = false,
				CurveFitting = 1.0,
				FillWeight = -1.0,
				HachureGap = -1.0,
				Seed = 1,
				RoughMode = "classic",
				FillStyle = "none"
			}, 
			"stylePresetD2" => new RoughStyle
			{
				Roughness = 1.0,
				Bowing = 2.0,
				EdgeJitterPt = 1.1,
				MaxRandomnessOffset = 2.0,
				StrokePasses = 2,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.05,
				RoughEngine = "roughJs",
				RoughSource = "d2",
				FillMode = "solid",
				FillSource = "d2",
				PreserveVertices = false,
				DisableMultiStroke = false,
				DisableMultiStrokeFill = false,
				CurveFitting = 0.95,
				FillWeight = 2.0,
				HachureGap = 16.0,
				Seed = 1,
				RoughMode = "classic",
				FillStyle = "solid"
			}, 
			"stylePresetTldraw" => new RoughStyle
			{
				Roughness = 0.75,
				Bowing = 0.35,
				EdgeJitterPt = 0.67,
				MaxRandomnessOffset = 1.1,
				StrokePasses = 2,
				CurveSampling = 1.15,
				FragmentStrokeDensity = 0.15,
				RoughEngine = "nativeWarp",
				RoughSource = "tldraw",
				FillSource = "tldraw",
				TldrawOffsetPt = 0.67,
				RoughMode = "classic",
				FillStyle = "none"
			}, 
			"stylePresetBrush" => new RoughStyle
			{
				Roughness = 0.9,
				Bowing = 0.45,
				EdgeJitterPt = 1.35,
				MaxRandomnessOffset = 1.35,
				StrokePasses = 1,
				CurveSampling = 1.0,
				FragmentStrokeDensity = 0.15,
				RoughMode = "classic",
				FillMode = "solid",
				FillSource = "brush",
				FillStyle = "brush",
				BrushWidthPt = 6.0,
				BrushDensity = 1.2,
				BrushAngleDeg = -8.0,
				BrushJitterPt = 1.35,
				BrushOverlap = 0.45
			}, 
			"stylePresetFragments" => new RoughStyle
			{
				Roughness = 1.05,
				Bowing = 0.55,
				EdgeJitterPt = 1.25,
				MaxRandomnessOffset = 1.55,
				StrokePasses = 1,
				CurveSampling = 0.9,
				FragmentStrokeDensity = 3.0,
				RoughMode = "classic",
				FillStyle = "none"
			}, 
			"stylePresetDenseFragments" => new RoughStyle
			{
				Roughness = 1.05,
				Bowing = 0.55,
				EdgeJitterPt = 1.25,
				MaxRandomnessOffset = 1.55,
				StrokePasses = 1,
				CurveSampling = 0.9,
				FragmentStrokeDensity = 3.0,
				RoughMode = "classic",
				FillStyle = "none"
			}, 
			_ => null, 
		};
	}

	private static int ParseQuickShapeIndex(string id)
	{
		id = id ?? string.Empty;
		if (!id.StartsWith("quickShape_", StringComparison.OrdinalIgnoreCase))
		{
			return -1;
		}
		if (!int.TryParse(id.Substring("quickShape_".Length), out var index) || index < 0 || index >= 12)
		{
			return -1;
		}
		return index;
	}

	private static int ParseRecentAssetIndex(string id)
	{
		id = id ?? string.Empty;
		if (!id.StartsWith("recentAsset_", StringComparison.OrdinalIgnoreCase))
		{
			return -1;
		}
		if (!int.TryParse(id.Substring("recentAsset_".Length), out var index) || index < 0 || index >= 12)
		{
			return -1;
		}
		return index;
	}

	private static string ParseQuickRemoveEnum(string id)
	{
		id = id ?? string.Empty;
		if (!id.StartsWith("quickRemove_", StringComparison.OrdinalIgnoreCase))
		{
			return string.Empty;
		}
		string payload = id.Substring("quickRemove_".Length);
		int separator = payload.IndexOf("_", StringComparison.OrdinalIgnoreCase);
		if (separator >= 0)
		{
			return payload.Substring(separator + 1).Replace("_", string.Empty);
		}
		return string.Empty;
	}

	public static string GetImageMsoForShape(string enumName, string category = null)
	{
		return ImageMsoForEnum(enumName, category);
	}

	public static IReadOnlyList<string> GetImageMsoCandidatesForShape(string enumName, string category = null)
	{
		return ImageMsoCandidatesForEnum(enumName, category);
	}

	private static string ParseEnumNameFromControlId(string id)
	{
		id = id ?? string.Empty;
		if (!id.StartsWith("roughShape_", StringComparison.OrdinalIgnoreCase))
		{
			return string.Empty;
		}
		string payload = id.Substring("roughShape_".Length);
		int enumStart = payload.IndexOf("msoShape", StringComparison.OrdinalIgnoreCase);
		if (enumStart >= 0)
		{
			return payload.Substring(enumStart).Replace("_", string.Empty);
		}
		return string.Empty;
	}

	private static string Xml(string value)
	{
		return SecurityElement.Escape(value ?? string.Empty);
	}

	private static string EscapeId(string value)
	{
		return (value ?? string.Empty).Replace("-", "_");
	}

	private static string FindShapeLabel(string enumName)
	{
		foreach (ShapeMenuItem item in LoadShapeMenuGroups().SelectMany((ShapeMenuGroup group) => group.Items))
		{
			if (string.Equals(item.EnumName, enumName, StringComparison.OrdinalIgnoreCase))
			{
				return item.Label;
			}
		}
		if (!string.IsNullOrWhiteSpace(enumName) && enumName.StartsWith("msoShape", StringComparison.OrdinalIgnoreCase))
		{
			return enumName.Substring("msoShape".Length);
		}
		return enumName ?? string.Empty;
	}

	private static string FindCategoryForEnum(string enumName)
	{
		try
		{
			foreach (CatalogItem item in new CatalogService().Load(ResolveCatalogPath()))
			{
				if (string.Equals(item.EnumName, enumName, StringComparison.OrdinalIgnoreCase))
				{
					return item.Category;
				}
			}
		}
		catch
		{
		}
		if (enumName == null || !enumName.StartsWith("rough3d", StringComparison.OrdinalIgnoreCase))
		{
			return null;
		}
		return "three-d";
	}

	private static IReadOnlyList<ShapeMenuItem> ShapeItemsForGallery(string controlId)
	{
		string groupId = ParseGalleryGroupId(controlId);
		foreach (ShapeMenuGroup group in LoadShapeMenuGroups())
		{
			if (string.Equals(EscapeId(group.Id), groupId, StringComparison.OrdinalIgnoreCase))
			{
				return group.Items;
			}
		}
		return Array.Empty<ShapeMenuItem>();
	}

	private static ShapeMenuItem GetGalleryItem(IRibbonControl control, int index)
	{
		IReadOnlyList<ShapeMenuItem> items = ShapeItemsForGallery(control?.Id);
		if (index < 0 || index >= items.Count)
		{
			return null;
		}
		return items[index];
	}

	private static string ParseGalleryGroupId(string controlId)
	{
		controlId = controlId ?? string.Empty;
		if (!controlId.StartsWith("roughGallery_", StringComparison.OrdinalIgnoreCase))
		{
			return string.Empty;
		}
		return controlId.Substring("roughGallery_".Length);
	}

	private static IReadOnlyList<ShapeMenuGroup> LoadShapeMenuGroups()
	{
		try
		{
			string catalogPath = ResolveCatalogPath();
			List<CatalogItem> items = (from item in new CatalogService().Load(catalogPath)
				where item.Insertable
				select item).ToList();
			if (items.Count < 180)
			{
				return ShapeMenuGroups;
			}
			List<ShapeMenuGroup> list = new List<ShapeMenuGroup>();
			list.Add(new ShapeMenuGroup("Recent", "最近使用的形状", S("msoShapeRectangle", "矩形", "ShapeRectangle"), S("msoShapeRoundedRectangle", "圆角矩形", "ShapeRoundedRectangle"), S("msoShapeOval", "椭圆", "ShapeOval"), S("msoShapeLine", "直线", "ShapeLine"), S("msoShapeLineArrow", "直线箭头", "ShapeLineArrow"), S("msoShapeRightArrow", "右箭头", "ShapeRightArrow"), S("msoShapeDiamond", "菱形", "ShapeDiamond"), S("msoShapeIsoscelesTriangle", "三角形", "ShapeIsoscelesTriangle")));
			List<ShapeMenuGroup> groups = list;
			foreach (string category in CategoryOrder)
			{
				ShapeMenuItem[] categoryItems = (from item in items
					where IsCategoryMenuItem(item, category)
					orderby item.DisplayNameZh, item.EnumName
					select S(item.EnumName, item.DisplayNameZh, ImageMsoFor(item))).ToArray();
				if (categoryItems.Length != 0)
				{
					groups.Add(new ShapeMenuGroup(category, CategoryTitle(category), categoryItems));
				}
			}
			return groups;
		}
		catch
		{
			return ShapeMenuGroups;
		}
	}

	private static string ResolveCatalogPath()
	{
		string[] candidates = new string[2]
		{
			Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "autoshape-catalog.json"),
			Path.Combine(Path.GetDirectoryName(typeof(RoughRibbon).Assembly.Location) ?? string.Empty, "ui", "autoshape-catalog.json")
		};
		string[] array = candidates;
		foreach (string candidate in array)
		{
			if (File.Exists(candidate))
			{
				return candidate;
			}
		}
		return candidates[0];
	}

	private static string CategoryTitle(string category)
	{
		return (category ?? string.Empty).Trim().ToLowerInvariant() switch
		{
			"lines" => "线条", 
			"rectangles" => "矩形", 
			"basic" => "基本形状", 
			"arrows" => "箭头总汇", 
			"math" => "公式形状", 
			"flowchart" => "流程图", 
			"stars-and-banners" => "星与旗帜", 
			"callouts" => "标注", 
			"three-d" => "三维对象", 
			"three-d-rough" => "三维对象（手绘）", 
			"three-d-plain" => "三维对象（普通）", 
			"action-buttons" => "动作按钮", 
			_ => "其他形状", 
		};
	}

	private static string ImageMsoFor(CatalogItem item)
	{
		return ImageMsoForEnum(item?.EnumName ?? string.Empty, item?.Category);
	}

	private static string ImageMsoForEnum(string enumName, string category = null)
	{
		IReadOnlyList<string> candidates = ImageMsoCandidatesForEnum(enumName, category);
		if (candidates.Count != 0)
		{
			return candidates[0];
		}
		return "ShapesInsertGallery";
	}

	private static IReadOnlyList<string> ImageMsoCandidatesForEnum(string enumName, string category = null)
	{
		List<string> candidates = new List<string>();
		string sourceEnum = enumName ?? string.Empty;
		AddKnownImageMsoCandidates(candidates, sourceEnum);
		foreach (ShapeMenuItem known in KnownImages)
		{
			if (string.Equals(known.EnumName, sourceEnum, StringComparison.OrdinalIgnoreCase))
			{
				AddCandidate(candidates, known.ImageMso);
			}
		}
		if (sourceEnum.StartsWith("msoShape", StringComparison.OrdinalIgnoreCase) && !sourceEnum.Equals("msoShapeNotPrimitive", StringComparison.OrdinalIgnoreCase))
		{
			AddCandidate(candidates, "Shape" + sourceEnum.Substring("msoShape".Length));
		}
		switch ((category ?? string.Empty).Trim().ToLowerInvariant())
		{
		case "lines":
			AddCandidate(candidates, "ShapeStraightConnector");
			AddCandidate(candidates, "ShapeCurve");
			break;
		case "rectangles":
			AddCandidate(candidates, "ShapeRectangle");
			break;
		case "arrows":
			AddCandidate(candidates, "ShapeRightArrow");
			break;
		case "math":
			AddCandidate(candidates, "ShapeMathPlus");
			break;
		case "flowchart":
			AddCandidate(candidates, "ShapeFlowchartProcess");
			break;
		case "stars-and-banners":
			AddCandidate(candidates, "ShapeStar");
			AddCandidate(candidates, "ShapeSeal8");
			break;
		case "callouts":
			AddCandidate(candidates, "ShapeRectangularCallout");
			break;
		case "three-d-plain":
		case "three-d-rough":
		case "three-d":
			AddCandidate(candidates, "ShapeCube");
			AddCandidate(candidates, "ShapeCan");
			AddCandidate(candidates, "Object3D");
			break;
		}
		AddCandidate(candidates, "ShapesInsertGallery");
		return candidates;
	}

	private static void AddKnownImageMsoCandidates(IList<string> candidates, string enumName)
	{
		string text = enumName ?? string.Empty;
		if (text == null)
		{
			return;
		}
		switch (text.Length)
		{
		case 16:
			switch (text[8])
			{
			default:
				return;
			case 'u':
				if (text == "rough3dCubeRough" || text == "rough3dCubePlain")
				{
					AddCandidate(candidates, "ShapeCube");
					AddCandidate(candidates, "ShapeBevel");
				}
				return;
			case 'o':
				break;
			case 'T':
				if (text == "msoShapeTriangle")
				{
					AddCandidate(candidates, "ShapeIsoscelesTriangle");
				}
				return;
			}
			if (!(text == "rough3dConeRough") && !(text == "rough3dConePlain"))
			{
				break;
			}
			goto IL_033a;
		case 20:
			switch (text[15])
			{
			default:
				return;
			case 'R':
				if (!(text == "rough3dCylinderRough"))
				{
					return;
				}
				break;
			case 'P':
				if (!(text == "rough3dCylinderPlain"))
				{
					return;
				}
				break;
			}
			AddCandidate(candidates, "ShapeCan");
			AddCandidate(candidates, "ShapeFlowchartDatabase");
			break;
		case 19:
			switch (text[8])
			{
			default:
				return;
			case 'y':
				break;
			case 'L':
				if (text == "msoShapeLineInverse")
				{
					AddCandidate(candidates, "ShapeStraightConnector");
					AddCandidate(candidates, "ControlLine");
				}
				return;
			case '1':
				if (text == "msoShape16pointStar")
				{
					AddCandidate(candidates, "ShapeSeal16");
				}
				return;
			case '2':
				if (text == "msoShape24pointStar")
				{
					AddCandidate(candidates, "ShapeSeal24");
				}
				return;
			case '3':
				if (text == "msoShape32pointStar")
				{
					AddCandidate(candidates, "ShapeStar");
					AddCandidate(candidates, "ShapeSeal24");
				}
				return;
			}
			if (!(text == "rough3dPyramidRough") && !(text == "rough3dPyramidPlain"))
			{
				break;
			}
			goto IL_033a;
		case 18:
			switch (text[8])
			{
			case 'p':
				break;
			case 'D':
				if (text == "msoShapeDoubleOval")
				{
					AddCandidate(candidates, "ShapeOval");
				}
				return;
			case '4':
				if (!(text == "msoShape4pointStar"))
				{
					return;
				}
				goto IL_0437;
			case '5':
				if (!(text == "msoShape5pointStar"))
				{
					return;
				}
				goto IL_0437;
			case '8':
				if (text == "msoShape8pointStar")
				{
					AddCandidate(candidates, "ShapeSeal8");
				}
				return;
			default:
				return;
				IL_0437:
				AddCandidate(candidates, "ShapeStar");
				return;
			}
			if (!(text == "rough3dSphereRough") && !(text == "rough3dSpherePlain"))
			{
				break;
			}
			goto IL_033a;
		case 17:
			switch (text[12])
			{
			default:
				return;
			case 'R':
				if (!(text == "rough3dStackRough"))
				{
					return;
				}
				break;
			case 'P':
				if (!(text == "rough3dStackPlain"))
				{
					return;
				}
				break;
			case 'A':
				if (text == "msoShapeLineArrow")
				{
					AddCandidate(candidates, "ShapeStraightConnectorArrow");
					AddCandidate(candidates, "ShapeLineArrow");
					AddCandidate(candidates, "ShapeRightArrow");
				}
				return;
			}
			goto IL_033a;
		case 23:
			switch (text[8])
			{
			case 'C':
				if (text == "msoShapeCurvedConnector")
				{
					AddCandidate(candidates, "ShapeCurveConnector");
					AddCandidate(candidates, "ShapeCurvedConnector");
					AddCandidate(candidates, "ShapeCurve");
				}
				break;
			case 'D':
				if (text == "msoShapeDashedRectangle")
				{
					AddCandidate(candidates, "ShapeRectangle");
				}
				break;
			}
			break;
		case 12:
			if (text == "msoShapeLine")
			{
				AddCandidate(candidates, "ShapeStraightConnector");
				AddCandidate(candidates, "ControlLine");
				AddCandidate(candidates, "ShapeLine");
			}
			break;
		case 13:
			if (text == "msoShapeCurve")
			{
				AddCandidate(candidates, "ShapeCurve");
				AddCandidate(candidates, "ControlCurve");
			}
			break;
		case 25:
			if (text == "msoShapeStraightConnector")
			{
				AddCandidate(candidates, "ShapeStraightConnector");
				AddCandidate(candidates, "ConnectorStraight");
			}
			break;
		case 22:
			if (text == "msoShapeElbowConnector")
			{
				AddCandidate(candidates, "ShapeElbowConnector");
				AddCandidate(candidates, "ConnectorElbow");
			}
			break;
		case 14:
		case 15:
		case 21:
		case 24:
			break;
			IL_033a:
			AddCandidate(candidates, "Object3D");
			AddCandidate(candidates, "ShapeCube");
			break;
		}
	}

	private static void AddCandidate(IList<string> candidates, string imageMso)
	{
		if (string.IsNullOrWhiteSpace(imageMso))
		{
			return;
		}
		foreach (string candidate in candidates)
		{
			if (string.Equals(candidate, imageMso, StringComparison.OrdinalIgnoreCase))
			{
				return;
			}
		}
		candidates.Add(imageMso);
	}

	private static bool IsCategoryMenuItem(CatalogItem item, string category)
	{
		string enumName = item?.EnumName ?? string.Empty;
		string itemCategory = item?.Category ?? string.Empty;
		if (string.Equals(category, "math", StringComparison.OrdinalIgnoreCase))
		{
			return enumName.StartsWith("msoShapeMath", StringComparison.OrdinalIgnoreCase);
		}
		if (string.Equals(category, "basic", StringComparison.OrdinalIgnoreCase) && enumName.StartsWith("msoShapeMath", StringComparison.OrdinalIgnoreCase))
		{
			return false;
		}
		return string.Equals(itemCategory, category, StringComparison.OrdinalIgnoreCase);
	}

	private static ShapeMenuItem S(string enumName, string label, string imageMso)
	{
		return new ShapeMenuItem(enumName, label, imageMso);
	}
}
