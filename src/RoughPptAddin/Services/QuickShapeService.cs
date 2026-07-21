using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace RoughPptAddin.Services;

public sealed class QuickShapeService
{
	private sealed class QuickShapeStore
	{
		public List<string> Shapes { get; set; } = new List<string>();
	}

	private const int MaxQuickShapes = 12;

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();

	private static readonly string[] DefaultShapes = new string[6] { "msoShapeLine", "msoShapeLineArrow", "msoShapeRectangle", "msoShapeOval", "msoShapeRoundedRectangle", "msoShapeRightArrow" };

	private static string StoreDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin");

	private static string StorePath => Path.Combine(StoreDirectory, "quick-shapes.json");

	public IList<string> List()
	{
		List<string> stored = Load();
		if (!File.Exists(StorePath))
		{
			return DefaultShapes.ToList();
		}
		return stored;
	}

	public IList<string> Pin(string enumName)
	{
		enumName = Normalize(enumName);
		if (string.IsNullOrWhiteSpace(enumName))
		{
			return List();
		}
		List<string> shapes = List().ToList();
		shapes.RemoveAll((string item) => string.Equals(item, enumName, StringComparison.OrdinalIgnoreCase));
		shapes.Insert(0, enumName);
		Save(shapes.Take(12).ToList());
		return List();
	}

	public IList<string> Unpin(string enumName)
	{
		enumName = Normalize(enumName);
		List<string> shapes = List().ToList();
		shapes.RemoveAll((string item) => string.Equals(item, enumName, StringComparison.OrdinalIgnoreCase));
		Save(shapes.Take(12).ToList());
		return List();
	}

	private List<string> Load()
	{
		try
		{
			string path = StorePath;
			if (!File.Exists(path))
			{
				return new List<string>();
			}
			return (from item in (serializer.Deserialize<QuickShapeStore>(File.ReadAllText(path))?.Shapes ?? new List<string>()).Select(Normalize)
				where !string.IsNullOrWhiteSpace(item)
				select item).Distinct(StringComparer.OrdinalIgnoreCase).Take(12).ToList();
		}
		catch
		{
			return new List<string>();
		}
	}

	private void Save(IList<string> shapes)
	{
		Directory.CreateDirectory(StoreDirectory);
		QuickShapeStore root = new QuickShapeStore
		{
			Shapes = shapes.ToList()
		};
		File.WriteAllText(StorePath, serializer.Serialize(root));
	}

	private static string Normalize(string enumName)
	{
		return (enumName ?? string.Empty).Trim();
	}
}
