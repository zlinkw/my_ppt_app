using System.Collections.Generic;

namespace RoughPptAddin.Models
{
    public sealed class CatalogItem
    {
    	public string EnumName { get; set; }
    
    	public string DisplayName { get; set; }
    
    	public string DisplayNameZh { get; set; }
    
    	public string Category { get; set; }
    
    	public string GenerationStrategy { get; set; }
    
    	public string RecipeId { get; set; }
    
    	public string Fidelity { get; set; }
    
    	public bool Insertable { get; set; } = true;
    }

    public sealed class ChartDataset
    {
    	public int SchemaVersion { get; set; } = 1;
    
    	public ChartSourceInfo Source { get; set; } = new ChartSourceInfo();
    
    	public List<string> Fields { get; set; } = new List<string>();
    
    	public List<Dictionary<string, object>> Rows { get; set; } = new List<Dictionary<string, object>>();
    
    	public List<ChartPoint> Points { get; set; } = new List<ChartPoint>();
    
    	public List<ChartSeries> Series { get; set; } = new List<ChartSeries>();
    
    	public List<ChartRecommendation> Recommendations { get; set; } = new List<ChartRecommendation>();
    
    	public List<string> Errors { get; set; } = new List<string>();
    
    	public List<string> Warnings { get; set; } = new List<string>();
    }

    public sealed class ChartPoint
    {
    	public string Id { get; set; }
    
    	public string Label { get; set; }
    
    	public object X { get; set; }
    
    	public double? Y { get; set; }
    
    	public string Method { get; set; }
    
    	public string Dataset { get; set; }
    
    	public string Split { get; set; }
    
    	public object Fold { get; set; }
    
    	public object Seed { get; set; }
    
    	public string Metric { get; set; }
    
    	public double? Value { get; set; }
    
    	public double? Mean { get; set; }
    
    	public double? Std { get; set; }
    
    	public object Ci { get; set; }
    
    	public double? PValue { get; set; }
    
    	public double? AdjustedPValue { get; set; }
    
    	public bool? Significant { get; set; }
    
    	public string CaseId { get; set; }
    
    	public string PatientId { get; set; }
    
    	public string Subgroup { get; set; }
    
    	public string ErrorType { get; set; }
    
    	public string SourcePath { get; set; }
    }

    public sealed class ChartRecommendation
    {
    	public string ChartType { get; set; }
    
    	public string Title { get; set; }
    
    	public string Reason { get; set; }
    
    	public int Priority { get; set; }
    }

    public sealed class ChartSeries
    {
    	public string Id { get; set; }
    
    	public string Label { get; set; }
    
    	public string Metric { get; set; }
    
    	public string Dataset { get; set; }
    
    	public string Split { get; set; }
    
    	public List<ChartPoint> Points { get; set; } = new List<ChartPoint>();
    }

    public sealed class ChartSourceInfo
    {
    	public string Path { get; set; }
    
    	public string Kind { get; set; }
    
    	public string Type { get; set; }
    
    	public double Confidence { get; set; }
    }

    public sealed class FeatureBlockOptions
    {
    	public string Mode { get; set; } = "3d";
    
    	public string VisualStyle { get; set; } = "plain";
    
    	public int CountX { get; set; } = 3;
    
    	public int CountY { get; set; } = 3;
    
    	public int CountZ { get; set; } = 3;
    
    	public float BlockWidthPt { get; set; } = 24f;
    
    	public float BlockHeightPt { get; set; } = 20f;
    
    	public float BlockDepthPt { get; set; } = 12f;
    
    	public float GapPt { get; set; }
    
    	public float Roundness { get; set; }
    
    	public string StartColor { get; set; } = "#f8b6c8";
    
    	public string EndColor { get; set; } = "#c97a96";
    
    	public string StrokeColor { get; set; } = "#000000";
    
    	public float StrokeWidthPt { get; set; } = 0.8f;
    
    	public string GradientDirection { get; set; } = "x";
    
    	public bool GradientReverse { get; set; }
    
    	public double GradientAmount { get; set; } = 1.0;
    
    	public string EditDirection { get; set; } = string.Empty;
    
    	public int EditDelta { get; set; }
    }

    public sealed class PaletteLayoutInfo
    {
    	public string Id { get; set; }
    
    	public string PaletteId { get; set; }
    
    	public string DisplayName { get; set; }
    
    	public string StrokeHex { get; set; }
    
    	public string FillHex { get; set; }
    
    	public string FeatureStartHex { get; set; }
    
    	public string FeatureEndHex { get; set; }
    
    	public string AccentHex { get; set; }
    
    	public string BackgroundHex { get; set; }
    
    	public List<string> ColorHexes { get; set; } = new List<string>();
    
    	public List<string> ShapeFillHexes { get; set; } = new List<string>();
    
    	public List<string> ShapeStrokeHexes { get; set; } = new List<string>();
    }

    public sealed class PaletteSchemeInfo
    {
    	public string Id { get; set; }
    
    	public string DisplayName { get; set; }
    
    	public string Kind { get; set; } = "user-palette";
    
    	public string Source { get; set; }
    
    	public string CreatedAtUtc { get; set; }
    
    	public bool BuiltIn { get; set; }
    
    	public List<string> Keywords { get; set; } = new List<string>();
    
    	public List<ZoteroSwatchInfo> Swatches { get; set; } = new List<ZoteroSwatchInfo>();
    
    	public List<PaletteLayoutInfo> Layouts { get; set; } = new List<PaletteLayoutInfo>();
    }

    public sealed class RoughDrawable
    {
    	public List<RoughPath> Paths { get; set; } = new List<RoughPath>();
    }

    public sealed class RoughPath
    {
    	public bool Closed { get; set; }
    
    	public string Stroke { get; set; }
    
    	public float StrokeWidthPt { get; set; }
    
    	public string Role { get; set; } = "outerJitter";
    
    	public List<RoughSegment> Segments { get; set; } = new List<RoughSegment>();
    }

    public static class RoughPathRoles
    {
    	public const string InnerFillBoundary = "innerFillBoundary";
    
    	public const string InnerBoundary = "innerBoundary";
    
    	public const string OuterJitter = "outerJitter";
    
    	public const string Texture = "texture";
    
    	public const string HitArea = "hitArea";
    }

    public sealed class RoughSegment
    {
    	public string Type { get; set; }
    
    	public float[] Data { get; set; }
    }

    public sealed class RoughShapeRequest
    {
    	public string AssetId { get; set; }
    
    	public string GroupId { get; set; }
    
    	public string NativeCarrierId { get; set; }
    
    	public string InnerFillCarrierId { get; set; }
    
    	public string InnerBoundaryId { get; set; }
    
    	public List<string> OuterJitterIds { get; set; } = new List<string>();
    
    	public string SourceMsoType { get; set; }
    
    	public string ShapeKind { get; set; }
    
    	public float Left { get; set; }
    
    	public float Top { get; set; }
    
    	public float Width { get; set; }
    
    	public float Height { get; set; }
    
    	public List<float> Adjustments { get; set; } = new List<float>();
    
    	public int StyleVersion { get; set; } = 1;
    
    	public int GeometryVersion { get; set; } = 1;
    
    	public RoughStyle Style { get; set; } = new RoughStyle();
    }

    public sealed class RoughStyle
    {
    	public string Stroke { get; set; } = "#111111";
    
    	public float StrokeWidthPt { get; set; } = 2f;
    
    	public double Roughness { get; set; } = 0.8;
    
    	public double Bowing { get; set; } = 0.35;
    
    	public double EdgeJitterPt { get; set; } = 1.35;
    
    	public double MaxRandomnessOffset { get; set; } = 1.35;
    
    	public int StrokePasses { get; set; } = 1;
    
    	public double CurveSampling { get; set; } = 1.0;
    
    	public double FragmentStrokeDensity { get; set; }
    
    	public string RoughEngine { get; set; } = "nativeWarp";
    
    	public string RoughSource { get; set; } = "native";
    
    	public string FillSource { get; set; } = "auto";
    
    	public double FillWeight { get; set; } = -1.0;
    
    	public double HachureGap { get; set; } = -1.0;
    
    	public double CurveFitting { get; set; } = 0.95;
    
    	public bool PreserveVertices { get; set; } = true;
    
    	public bool DisableMultiStroke { get; set; }
    
    	public bool DisableMultiStrokeFill { get; set; } = true;
    
    	public double TldrawOffsetPt { get; set; } = 0.67;
    
    	public string RoughMode { get; set; } = "classic";
    
    	public int NestedLayers { get; set; } = 2;
    
    	public double NestedOverlap { get; set; } = 0.55;
    
    	public double NestedGapPt { get; set; } = 4.0;
    
    	public double NestedJitterPt { get; set; } = 0.8;
    
    	public string NestedDirection { get; set; } = "leftDownToRightUp";
    
    	public int Seed { get; set; } = 12345;
    
    	public string FillStyle { get; set; } = "none";
    
    	public double BrushWidthPt { get; set; } = 5.0;
    
    	public double BrushDensity { get; set; } = 1.0;
    
    	public double BrushAngleDeg { get; set; } = -8.0;
    
    	public double BrushJitterPt { get; set; } = 1.2;
    
    	public double BrushOverlap { get; set; } = 0.35;
    
    	public string DashStyle { get; set; } = "solid";
    
    	public string ArrowheadStyle { get; set; } = "rough";
    
    	public string ArrowheadPosition { get; set; } = "end";
    
    	public double ArrowheadLengthPt { get; set; } = 14.0;
    
    	public double ArrowheadWidthPt { get; set; } = 10.0;
    
    	public double StrokeTransparency { get; set; }
    
    	public string FillColor { get; set; } = "#ffffff";
    
    	public double FillTransparency { get; set; }
    
    	public string FillMode { get; set; } = "none";
    
    	public int NativeStyleVersion { get; set; } = 1;
    }

    public sealed class UserAssetImportResult
    {
    	public List<UserAssetInfo> Imported { get; set; } = new List<UserAssetInfo>();
    
    	public int SkippedDuplicateCount { get; set; }
    
    	public bool Cancelled { get; set; }
    }

    public sealed class UserAssetInfo
    {
    	public string Id { get; set; }
    
    	public string DisplayName { get; set; }
    
    	public string Kind { get; set; }
    
    	public string CreatedAtUtc { get; set; }
    
    	public int ShapeCount { get; set; }
    
    	public string TemplatePath { get; set; }
    
    	public string ThumbnailPath { get; set; }
    
    	public string ContentSha256 { get; set; }
    
    	public bool NativeOnly { get; set; } = true;
    
    	public List<string> Keywords { get; set; } = new List<string>();
    }

    public sealed class ZlkChartRenderResult
    {
    	public string PresentationPath { get; set; }
    
    	public int SlideIndex { get; set; }
    
    	public int ShapeCount { get; set; }
    
    	public string ChartType { get; set; }
    
    	public List<string> Warnings { get; set; } = new List<string>();
    }

    public sealed class ZlkChartSpec
    {
    	public string ChartType { get; set; } = "genericTable";
    
	public string Title { get; set; } = "SimpleExperiment 实验结果";
    
    	public string Reason { get; set; }
    }

    public sealed class ZlkClusterPlotRequest
    {
    	public int SchemaVersion { get; set; } = 1;
    
    	public string RequestId { get; set; }
    
    	public string ProjectRoot { get; set; }
    
    	public List<string> SourcePaths { get; set; } = new List<string>();
    
    	public string PlottingContractPath { get; set; }
    
    	public string SelectedResultId { get; set; }
    
    	public string RunKey { get; set; }
    
    	public string ArchiveKey { get; set; }
    
    	public string ChartType { get; set; } = "auto";
    
    	public ZlkPlotTarget Target { get; set; } = new ZlkPlotTarget();
    
    	public string StyleMode { get; set; } = "activePpt";
    
    	public string SourceLabel { get; set; }
    
    	public ZlkMarkdownSummary MarkdownSummary { get; set; }
    }

    public sealed class ZlkMarkdownSummary
    {
    	public string Path { get; set; }
    
    	public string Text { get; set; }
    }

    public sealed class ZlkPlotSourceFile
    {
    	public string SourcePath { get; set; }
    
    	public string FullPath { get; set; }
    
    	public string Content { get; set; }
    }

    public sealed class ZlkPlotTarget
    {
    	public string PresentationPath { get; set; }
    
    	public bool CreateIfMissing { get; set; }
    
    	public string SlideMode { get; set; } = "append";
    }

    public sealed class ZoteroImageInfo
    {
    	public string ImageId { get; set; }
    
    	public string Title { get; set; }
    
    	public string Year { get; set; }
    
    	public string Doi { get; set; }
    
    	public int PageNumber { get; set; }
    
    	public string SourceRegionKey { get; set; }
    
    	public string PreviewDuplicateKey { get; set; }
    
    	public string ZoteroOpenPdfUri { get; set; }
    
    	public string ZoteroSelectPdfUri { get; set; }
    
    	public string ParentItemKey { get; set; }
    
    	public string PdfAttachmentKey { get; set; }
    
    	public string LibraryId { get; set; }
    
    	public string LibraryType { get; set; }
    
    	public string GroupId { get; set; }
    
    	public string BboxJson { get; set; }
    
    	public string ThumbnailDataUrl { get; set; }
    
    	public string ImageCategory { get; set; }
    
    	public string ColorFamily { get; set; }
    
    	public string CreatedAt { get; set; }
    
    	public List<string> StyleTags { get; set; } = new List<string>();
    
    	public List<ZoteroSwatchInfo> Swatches { get; set; } = new List<ZoteroSwatchInfo>();
    
    	public ZoteroTraceInfo Trace { get; set; } = new ZoteroTraceInfo();
    }

    public sealed class ZoteroPaletteInfo
    {
    	public string Status { get; set; }
    
    	public string DatabasePath { get; set; }
    
    	public string DatabaseSource { get; set; }
    
    	public bool DatabaseFound { get; set; }
    
    	public List<ZoteroSwatchInfo> Swatches { get; set; } = new List<ZoteroSwatchInfo>();
    }

    public sealed class ZoteroSwatchInfo
    {
    	public string Hex { get; set; }
    
    	public string BaseHex { get; set; }
    
    	public string Variant { get; set; }
    
    	public string Role { get; set; }
    
    	public string SourceTitle { get; set; }
    
    	public string ImageId { get; set; }
    }

    public sealed class ZoteroTraceInfo
    {
    	public string ImageId { get; set; }
    
    	public string ParentItemKey { get; set; }
    
    	public string PdfAttachmentKey { get; set; }
    
    	public int PageNumber { get; set; }
    
    	public string SourceRegionKey { get; set; }
    
    	public string PreviewDuplicateKey { get; set; }
    
    	public string LibraryId { get; set; }
    
    	public string LibraryType { get; set; }
    
    	public string GroupId { get; set; }
    
    	public string BboxJson { get; set; }
    
    	public string ZoteroOpenPdfUri { get; set; }
    
    	public string SelectParentItemUri { get; set; }
    
    	public string SelectPdfAttachmentUri { get; set; }
    
    	public string Title { get; set; }
    }
}
