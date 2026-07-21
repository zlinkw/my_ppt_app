using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class SelectionCaptureService
{
	private readonly Application application;

	private readonly string templateRoot;

	private readonly string thumbnailRoot;

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 4194304
	};

	private const long MaxSharePackageBytes = 26214400L;

	private const long MaxSharePackageUncompressedBytes = 83886080L;

	private static readonly HashSet<string> AllowedPackageExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".json", ".pptx", ".png" };

	public SelectionCaptureService(Application application)
		: this(application, GetDefaultTemplateRoot(), GetDefaultThumbnailRoot())
	{
	}

	public SelectionCaptureService(Application application, string templateRoot)
		: this(application, templateRoot, GetSiblingThumbnailRoot(templateRoot))
	{
	}

	public SelectionCaptureService(Application application, string templateRoot, string thumbnailRoot)
	{
		this.application = application;
		this.templateRoot = templateRoot;
		this.thumbnailRoot = thumbnailRoot;
	}

	public UserAssetInfo SaveCurrentSelection()
	{
		Selection selection = application.ActiveWindow?.Selection;
		if (selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
		{
			throw new InvalidOperationException("未选择 PowerPoint 形状。");
		}
		string text = templateRoot;
		Directory.CreateDirectory(text);
		string assetId = "user-selection-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
		string pptxPath = Path.Combine(text, assetId + ".pptx");
		string metadataPath = Path.Combine(text, assetId + ".json");
		Directory.CreateDirectory(thumbnailRoot);
		string thumbnailPath = Path.Combine(thumbnailRoot, assetId + ".png");
		Presentation capture = null;
		try
		{
			capture = application.Presentations.Add(MsoTriState.msoFalse);
			Slide slide = capture.Slides.Add(1, PpSlideLayout.ppLayoutBlank);
			PasteWithRetry(slide.Shapes, delegate
			{
				selection.ShapeRange.Copy();
			});
			ExportThumbnail(slide, thumbnailPath);
			capture.SaveAs(pptxPath, PpSaveAsFileType.ppSaveAsOpenXMLPresentation, MsoTriState.msoFalse);
		}
		finally
		{
			capture?.Close();
		}
		UserAssetInfo info = new UserAssetInfo
		{
			Id = assetId,
			DisplayName = "选区 " + DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
			Kind = "user-native-template",
			CreatedAtUtc = DateTime.UtcNow.ToString("o"),
			ShapeCount = selection.ShapeRange.Count,
			TemplatePath = pptxPath,
			ThumbnailPath = thumbnailPath,
			ContentSha256 = ComputeFileSha256(pptxPath),
			NativeOnly = true,
			Keywords = new List<string> { "用户", "已保存", "ppt", "原生", "选区" }
		};
		File.WriteAllText(metadataPath, serializer.Serialize(info));
		return info;
	}

	public IList<UserAssetInfo> ListUserAssets()
	{
		string root = templateRoot;
		if (!Directory.Exists(root))
		{
			return new List<UserAssetInfo>();
		}
		List<UserAssetInfo> assets = new List<UserAssetInfo>();
		string[] files = Directory.GetFiles(root, "*.json");
		foreach (string metadataPath in files)
		{
			UserAssetInfo info = ReadAssetInfo(metadataPath);
			if (info != null && File.Exists(info.TemplatePath))
			{
				NormalizeThumbnailPath(info);
				assets.Add(info);
			}
		}
		assets.Sort((UserAssetInfo left, UserAssetInfo right) => string.Compare(right.CreatedAtUtc, left.CreatedAtUtc, StringComparison.OrdinalIgnoreCase));
		return assets;
	}

	public string ExportUserAssets(string packagePath, IEnumerable<string> assetIds = null)
	{
		IList<UserAssetInfo> assets = ListUserAssets();
		HashSet<string> selectedIds = new HashSet<string>((assetIds ?? new List<string>()).Where((string id) => !string.IsNullOrWhiteSpace(id)), StringComparer.OrdinalIgnoreCase);
		if (selectedIds.Count > 0)
		{
			assets = assets.Where((UserAssetInfo userAssetInfo) => selectedIds.Contains(userAssetInfo.Id)).ToList();
		}
		if (assets.Count == 0)
		{
			throw new InvalidOperationException((selectedIds.Count > 0) ? "勾选的素材不存在或已被删除。" : "没有可导出的用户素材。");
		}
		if (string.IsNullOrWhiteSpace(packagePath))
		{
			packagePath = GetDefaultExportPath();
		}
		packagePath = EnsureZipPath(packagePath);
		string targetDirectory = Path.GetDirectoryName(packagePath);
		if (!string.IsNullOrWhiteSpace(targetDirectory))
		{
			Directory.CreateDirectory(targetDirectory);
		}
		string stagingRoot = Path.Combine(Path.GetTempPath(), "RoughPptAssetExport-" + Guid.NewGuid().ToString("N"));
		string templatesRoot = Path.Combine(stagingRoot, "templates");
		string thumbnailsRoot = Path.Combine(stagingRoot, "thumbnails");
		Directory.CreateDirectory(templatesRoot);
		Directory.CreateDirectory(thumbnailsRoot);
		try
		{
			foreach (UserAssetInfo asset in assets)
			{
				if (File.Exists(asset.TemplatePath))
				{
					string packageId = SanitizeFileName(asset.Id);
					string packageTemplateName = packageId + ".pptx";
					string packageThumbnailName = ((!string.IsNullOrWhiteSpace(asset.ThumbnailPath) && File.Exists(asset.ThumbnailPath)) ? (packageId + Path.GetExtension(asset.ThumbnailPath)) : null);
					UserAssetInfo packageInfo = new UserAssetInfo
					{
						Id = asset.Id,
						DisplayName = asset.DisplayName,
						Kind = asset.Kind,
						CreatedAtUtc = asset.CreatedAtUtc,
						ShapeCount = asset.ShapeCount,
						TemplatePath = packageTemplateName,
						ThumbnailPath = packageThumbnailName,
						ContentSha256 = ComputeFileSha256(asset.TemplatePath),
						NativeOnly = true,
						Keywords = (asset.Keywords ?? new List<string>())
					};
					File.WriteAllText(Path.Combine(templatesRoot, packageId + ".json"), serializer.Serialize(packageInfo));
					File.Copy(asset.TemplatePath, Path.Combine(templatesRoot, packageTemplateName), overwrite: true);
					if (!string.IsNullOrWhiteSpace(asset.ThumbnailPath) && File.Exists(asset.ThumbnailPath))
					{
						File.Copy(asset.ThumbnailPath, Path.Combine(thumbnailsRoot, packageThumbnailName), overwrite: true);
					}
				}
			}
			Dictionary<string, object> manifest = new Dictionary<string, object>
			{
				["version"] = "0.1.0",
				["kind"] = "rough-ppt-native-asset-package",
				["format"] = "zip",
				["safeForSocialTransfer"] = true,
				["exportedAtUtc"] = DateTime.UtcNow.ToString("o"),
				["assetCount"] = assets.Count,
				["selectedAssetCount"] = ((selectedIds.Count > 0) ? assets.Count : 0),
				["maxPackageBytes"] = 26214400L,
				["nativeOnly"] = true
			};
			File.WriteAllText(Path.Combine(stagingRoot, "manifest.json"), serializer.Serialize(manifest));
			if (File.Exists(packagePath))
			{
				File.Delete(packagePath);
			}
			ZipFile.CreateFromDirectory(stagingRoot, packagePath, CompressionLevel.Optimal, includeBaseDirectory: false);
			if (new FileInfo(packagePath).Length > 26214400)
			{
				File.Delete(packagePath);
				throw new InvalidOperationException("素材包超过 25 MB。请减少勾选素材数量后重新分享。");
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

	public UserAssetImportResult ImportUserAssets(string packagePath)
	{
		if (string.IsNullOrWhiteSpace(packagePath) || !File.Exists(packagePath))
		{
			throw new FileNotFoundException("未找到素材包。", packagePath);
		}
		if (!string.Equals(Path.GetExtension(packagePath), ".zip", StringComparison.OrdinalIgnoreCase))
		{
			throw new InvalidOperationException("只支持导入 .zip 分享素材包。");
		}
		if (new FileInfo(packagePath).Length > 26214400)
		{
			throw new InvalidOperationException("素材包超过 25 MB，请让分享者减少素材数量后重新导出。");
		}
		Directory.CreateDirectory(templateRoot);
		string extractRoot = Path.Combine(Path.GetTempPath(), "RoughPptAssetImport-" + Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(extractRoot);
		try
		{
			SafeExtractZip(packagePath, extractRoot);
			string path = Path.Combine(extractRoot, "manifest.json");
			if (!File.Exists(path))
			{
				throw new InvalidOperationException("素材包缺少 manifest.json。");
			}
			if (!File.ReadAllText(path).Contains("rough-ppt-native-asset-package"))
			{
				throw new InvalidOperationException("素材包 manifest 类型不正确。");
			}
			string templatesRoot = Path.Combine(extractRoot, "templates");
			string thumbnailsRoot = Path.Combine(extractRoot, "thumbnails");
			if (!Directory.Exists(templatesRoot))
			{
				throw new InvalidOperationException("素材包缺少 templates 文件夹。");
			}
			Directory.CreateDirectory(thumbnailRoot);
			UserAssetImportResult result = new UserAssetImportResult();
			HashSet<string> knownContentHashes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (UserAssetInfo item in ListUserAssets())
			{
				string existingHash = TryComputeFileSha256(item.TemplatePath);
				if (!string.IsNullOrWhiteSpace(existingHash))
				{
					knownContentHashes.Add(existingHash);
				}
			}
			string[] files = Directory.GetFiles(templatesRoot, "*.json");
			foreach (string metadataPath in files)
			{
				UserAssetInfo sourceInfo = ReadAssetInfo(metadataPath);
				if (sourceInfo == null)
				{
					continue;
				}
				string sourcePptx = ResolveTemplatePath(metadataPath, sourceInfo);
				if (!File.Exists(sourcePptx))
				{
					continue;
				}
				string sourceContentHash = ComputeFileSha256(sourcePptx);
				if (knownContentHashes.Contains(sourceContentHash))
				{
					result.SkippedDuplicateCount++;
					continue;
				}
				string sourceThumbnail = ResolveThumbnailPath(metadataPath, thumbnailsRoot, sourceInfo);
				string importedId = ResolveImportedId(sourceInfo.Id);
				string targetPptx = Path.Combine(templateRoot, importedId + ".pptx");
				string path2 = Path.Combine(templateRoot, importedId + ".json");
				string targetThumbnail = ((!string.IsNullOrWhiteSpace(sourceThumbnail)) ? Path.Combine(thumbnailRoot, importedId + Path.GetExtension(sourceThumbnail)) : null);
				sourceInfo.Id = importedId;
				sourceInfo.TemplatePath = targetPptx;
				sourceInfo.ThumbnailPath = targetThumbnail;
				sourceInfo.ContentSha256 = sourceContentHash;
				sourceInfo.NativeOnly = true;
				if (sourceInfo.Keywords == null)
				{
					sourceInfo.Keywords = new List<string>();
				}
				if (!sourceInfo.Keywords.Contains("已导入"))
				{
					sourceInfo.Keywords.Add("已导入");
				}
				File.Copy(sourcePptx, targetPptx, overwrite: true);
				if (!string.IsNullOrWhiteSpace(sourceThumbnail) && File.Exists(sourceThumbnail))
				{
					File.Copy(sourceThumbnail, targetThumbnail, overwrite: true);
				}
				File.WriteAllText(path2, serializer.Serialize(sourceInfo));
				knownContentHashes.Add(sourceContentHash);
				result.Imported.Add(sourceInfo);
			}
			if (result.Imported.Count == 0 && result.SkippedDuplicateCount == 0)
			{
				throw new InvalidOperationException("素材包中没有可导入的原生素材。");
			}
			return result;
		}
		finally
		{
			if (Directory.Exists(extractRoot))
			{
				Directory.Delete(extractRoot, recursive: true);
			}
		}
	}

	public Microsoft.Office.Interop.PowerPoint.ShapeRange InsertAsset(string assetId)
	{
		if (string.IsNullOrWhiteSpace(assetId))
		{
			throw new ArgumentException("素材 ID 不能为空。", "assetId");
		}
		UserAssetInfo info = FindAsset(assetId);
		if (info == null)
		{
			throw new InvalidOperationException("未找到已保存素材：" + assetId);
		}
		if (!(application.ActiveWindow?.View?.Slide is Slide targetSlide))
		{
			throw new InvalidOperationException("当前没有可用幻灯片。");
		}
		Presentation sourcePresentation = null;
		try
		{
			sourcePresentation = application.Presentations.Open(info.TemplatePath, MsoTriState.msoTrue, MsoTriState.msoFalse, MsoTriState.msoFalse);
			Slide sourceSlide = sourcePresentation.Slides[1];
			if (sourceSlide.Shapes.Count == 0)
			{
				throw new InvalidOperationException("已保存素材中没有形状。");
			}
			Microsoft.Office.Interop.PowerPoint.ShapeRange pasted = PasteWithRetry(targetSlide.Shapes, delegate
			{
				sourceSlide.Shapes.Range(Type.Missing).Copy();
			});
			CenterOnSlide(pasted);
			return pasted;
		}
		finally
		{
			sourcePresentation?.Close();
		}
	}

	public UserAssetInfo DeleteAsset(string assetId)
	{
		if (string.IsNullOrWhiteSpace(assetId))
		{
			throw new ArgumentException("素材 ID 不能为空。", "assetId");
		}
		UserAssetInfo info = FindAsset(assetId);
		if (info == null)
		{
			throw new InvalidOperationException("未找到已保存素材：" + assetId);
		}
		DeleteFileIfSafe(Path.Combine(templateRoot, SanitizeFileName(info.Id) + ".json"), templateRoot);
		DeleteFileIfSafe(info.TemplatePath, templateRoot);
		DeleteFileIfSafe(info.ThumbnailPath, thumbnailRoot);
		return info;
	}

	private UserAssetInfo FindAsset(string assetId)
	{
		foreach (UserAssetInfo asset in ListUserAssets())
		{
			if (string.Equals(asset.Id, assetId, StringComparison.OrdinalIgnoreCase))
			{
				return asset;
			}
		}
		return null;
	}

	private static void DeleteFileIfSafe(string path, string expectedRoot)
	{
		if (!string.IsNullOrWhiteSpace(path) && !string.IsNullOrWhiteSpace(expectedRoot))
		{
			string fullPath = Path.GetFullPath(path);
			string fullRoot = Path.GetFullPath(expectedRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
			if (!fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
			{
				throw new InvalidOperationException("素材文件路径不在允许删除的素材库目录内。");
			}
			if (File.Exists(fullPath))
			{
				File.Delete(fullPath);
			}
		}
	}

	private UserAssetInfo ReadAssetInfo(string metadataPath)
	{
		try
		{
			UserAssetInfo info = serializer.Deserialize<UserAssetInfo>(File.ReadAllText(metadataPath));
			if (info == null || string.IsNullOrWhiteSpace(info.Id))
			{
				return null;
			}
			if (string.IsNullOrWhiteSpace(info.DisplayName))
			{
				info.DisplayName = info.Id;
			}
			if (string.IsNullOrWhiteSpace(info.TemplatePath))
			{
				info.TemplatePath = Path.ChangeExtension(metadataPath, ".pptx");
			}
			if (info.Keywords == null)
			{
				info.Keywords = new List<string>();
			}
			NormalizeThumbnailPath(info);
			return info;
		}
		catch
		{
			return null;
		}
	}

	private void CenterOnSlide(Microsoft.Office.Interop.PowerPoint.ShapeRange range)
	{
		Presentation presentation = application.ActivePresentation;
		if (presentation != null && range != null)
		{
			float slideWidth = presentation.PageSetup.SlideWidth;
			float slideHeight = presentation.PageSetup.SlideHeight;
			range.Left = (slideWidth - range.Width) / 2f;
			range.Top = (slideHeight - range.Height) / 2f;
		}
	}

	private static Microsoft.Office.Interop.PowerPoint.ShapeRange PasteWithRetry(Microsoft.Office.Interop.PowerPoint.Shapes targetShapes, Action copyAction)
	{
		Exception lastError = null;
		for (int attempt = 0; attempt < 6; attempt++)
		{
			copyAction();
			Thread.Sleep(120 + attempt * 80);
			try
			{
				return targetShapes.Paste();
			}
			catch (COMException ex)
			{
				lastError = ex;
				Thread.Sleep(180 + attempt * 120);
			}
		}
		throw new InvalidOperationException("剪贴板尚未准备好，无法粘贴 PPT 原生素材。", lastError);
	}

	private string ResolveImportedId(string sourceId)
	{
		string baseId = (string.IsNullOrWhiteSpace(sourceId) ? "imported-asset" : SanitizeFileName(sourceId));
		string candidate = baseId;
		if (!File.Exists(Path.Combine(templateRoot, candidate + ".json")))
		{
			return candidate;
		}
		return baseId + "-imported-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
	}

	private static string ResolveTemplatePath(string metadataPath, UserAssetInfo info)
	{
		string directoryName = Path.GetDirectoryName(metadataPath);
		string templateName = (string.IsNullOrWhiteSpace(info.TemplatePath) ? Path.ChangeExtension(Path.GetFileName(metadataPath), ".pptx") : Path.GetFileName(info.TemplatePath));
		return Path.Combine(directoryName, templateName);
	}

	private static string ResolveThumbnailPath(string metadataPath, string packageThumbnailRoot, UserAssetInfo info)
	{
		if (info == null)
		{
			return null;
		}
		string thumbnailName = (string.IsNullOrWhiteSpace(info.ThumbnailPath) ? (SanitizeFileName(info.Id) + ".png") : Path.GetFileName(info.ThumbnailPath));
		if (string.IsNullOrWhiteSpace(thumbnailName))
		{
			return null;
		}
		string metadataDirectory = Path.GetDirectoryName(metadataPath);
		string[] array = new string[3]
		{
			Path.Combine(metadataDirectory, thumbnailName),
			Path.Combine(packageThumbnailRoot ?? string.Empty, thumbnailName),
			Path.Combine(packageThumbnailRoot ?? string.Empty, SanitizeFileName(info.Id) + Path.GetExtension(thumbnailName))
		};
		foreach (string candidate in array)
		{
			if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate))
			{
				return candidate;
			}
		}
		return null;
	}

	private static void SafeExtractZip(string packagePath, string extractRoot)
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
						throw new InvalidOperationException("素材包包含不安全路径。");
					}
					if (!AllowedPackageExtensions.Contains(Path.GetExtension(entryName)))
					{
						throw new InvalidOperationException("素材包包含不允许的文件类型：" + entryName);
					}
					totalUncompressed += entry.Length;
					if (totalUncompressed > 83886080)
					{
						throw new InvalidOperationException("素材包解压后过大，请减少素材数量后重新分享。");
					}
					string target = Path.GetFullPath(Path.Combine(extractRoot, entryName));
					if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
					{
						throw new InvalidOperationException("素材包包含路径穿越风险。");
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

	private void NormalizeThumbnailPath(UserAssetInfo info)
	{
		if (info != null && (string.IsNullOrWhiteSpace(info.ThumbnailPath) || !File.Exists(info.ThumbnailPath)))
		{
			string candidate = Path.Combine(thumbnailRoot, SanitizeFileName(info.Id) + ".png");
			info.ThumbnailPath = (File.Exists(candidate) ? candidate : null);
		}
	}

	private static void ExportThumbnail(Slide slide, string thumbnailPath)
	{
		string directory = Path.GetDirectoryName(thumbnailPath);
		if (!string.IsNullOrWhiteSpace(directory))
		{
			Directory.CreateDirectory(directory);
		}
		slide.Export(thumbnailPath, "PNG", 320, 180);
		if (!File.Exists(thumbnailPath))
		{
			throw new InvalidOperationException("PowerPoint 未能创建素材缩略图。");
		}
	}

	private static string SanitizeFileName(string value)
	{
		char[] invalid = Path.GetInvalidFileNameChars();
		char[] chars = (value ?? "asset").ToCharArray();
		for (int i = 0; i < chars.Length; i++)
		{
			if (Array.IndexOf(invalid, chars[i]) >= 0)
			{
				chars[i] = '-';
			}
		}
		return new string(chars);
	}

	private static string ComputeFileSha256(string path)
	{
		using FileStream stream = File.OpenRead(path);
		using SHA256 sha256 = SHA256.Create();
		return BitConverter.ToString(sha256.ComputeHash(stream)).Replace("-", string.Empty).ToLowerInvariant();
	}

	private static string TryComputeFileSha256(string path)
	{
		try
		{
			return (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) ? null : ComputeFileSha256(path);
		}
		catch (IOException)
		{
			return null;
		}
		catch (UnauthorizedAccessException)
		{
			return null;
		}
	}

	private static string GetDefaultExportPath()
	{
		string text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "RoughPptAddin", "exports");
		Directory.CreateDirectory(text);
		return Path.Combine(text, "rough-share-assets-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + ".zip");
	}

	private static string EnsureZipPath(string packagePath)
	{
		if (!string.Equals(Path.GetExtension(packagePath), ".zip", StringComparison.OrdinalIgnoreCase))
		{
			return Path.ChangeExtension(packagePath, ".zip");
		}
		return packagePath;
	}

	private static string GetDefaultTemplateRoot()
	{
		return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "RoughPptAddin", "assets", "user", "templates");
	}

	private static string GetDefaultThumbnailRoot()
	{
		return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "RoughPptAddin", "assets", "user", "thumbnails");
	}

	private static string GetSiblingThumbnailRoot(string templateRoot)
	{
		string parent = Path.GetDirectoryName(templateRoot);
		if (string.IsNullOrWhiteSpace(parent))
		{
			return Path.Combine(templateRoot, "thumbnails");
		}
		return Path.Combine(parent, "thumbnails");
	}
}
