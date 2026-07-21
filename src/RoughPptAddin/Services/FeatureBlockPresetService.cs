using System;
using System.IO;
using System.Web.Script.Serialization;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class FeatureBlockPresetService
{
	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();

	private static string StoreDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin");

	private static string StorePath => Path.Combine(StoreDirectory, "feature-block-default.json");

	public FeatureBlockOptions Load()
	{
		try
		{
			if (!File.Exists(StorePath))
			{
				return new FeatureBlockOptions();
			}
			return Sanitize(serializer.Deserialize<FeatureBlockOptions>(File.ReadAllText(StorePath)) ?? new FeatureBlockOptions());
		}
		catch
		{
			return new FeatureBlockOptions();
		}
	}

	public FeatureBlockOptions Save(FeatureBlockOptions options)
	{
		FeatureBlockOptions sanitized = Sanitize(options ?? new FeatureBlockOptions());
		Directory.CreateDirectory(StoreDirectory);
		File.WriteAllText(StorePath, serializer.Serialize(sanitized));
		return sanitized;
	}

	private static FeatureBlockOptions Sanitize(FeatureBlockOptions options)
	{
		options.EditDirection = string.Empty;
		options.EditDelta = 0;
		return options;
	}
}
