using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class CatalogService
{
	private sealed class CatalogRoot
	{
		public List<CatalogItem> Items { get; set; } = new List<CatalogItem>();
	}

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 8388608
	};

	public IReadOnlyList<CatalogItem> Load(string catalogPath)
	{
		string json = File.ReadAllText(catalogPath);
		return serializer.Deserialize<CatalogRoot>(json).Items;
	}
}
