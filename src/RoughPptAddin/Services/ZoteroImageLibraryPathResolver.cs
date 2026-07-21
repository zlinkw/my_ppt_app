using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System;

namespace RoughPptAddin.Services
{
    internal static class ZoteroImageLibraryPathResolver
    {
    	public const string DatabaseRelativePath = "ZLK\\paper-image-library\\paper_images.sqlite";
    
    	public const string LibraryLocatorRelativePath = "ZLK\\paper-image-library\\library.json";
    
    	public const int LocatorSchemaVersion = 1;
    
    	public const int DatabaseSchemaVersion = 2;
    
    	public const string LocatorProducer = "zotero-pdf-image-saver";
    
    	public static string DefaultDatabasePath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZLK\\paper-image-library\\paper_images.sqlite");
    
    	public static string LibraryLocatorPath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZLK\\paper-image-library\\library.json");
    
    	public static string ResolveDatabasePath()
    	{
    		return ResolveDatabasePathInfo().DatabasePath;
    	}
    
    	public static ZoteroImageLibraryPathInfo ResolveDatabasePathInfo()
    	{
    		if (IsCanonicalDatabasePath(ReadLibraryLocatorDatabasePath()))
    		{
    			return new ZoteroImageLibraryPathInfo
    			{
    				DatabasePath = DefaultDatabasePath,
    				Source = "library.json",
    				SourceDescription = "library.json 定位文件已生效",
    				LocatorPath = LibraryLocatorPath
    			};
    		}
    		return new ZoteroImageLibraryPathInfo
    		{
    			DatabasePath = DefaultDatabasePath,
    			Source = "default",
    			SourceDescription = (File.Exists(LibraryLocatorPath) ? "library.json 未指向固定共享 DB 路径，已回落默认 DB 路径" : "library.json 尚未发布，已使用默认 DB 路径"),
    			LocatorPath = LibraryLocatorPath
    		};
    	}
    
    	public static string MissingDatabaseHint()
    	{
    		return "插件只接受定位文件 " + LibraryLocatorPath + " 中指向固定共享 DB 路径 " + DefaultDatabasePath + " 的 databasePath；其它路径会被拒绝。";
    	}
    
    	private static string ReadLibraryLocatorDatabasePath()
    	{
    		string path = LibraryLocatorPath;
    		if (!File.Exists(path))
    		{
    			return null;
    		}
    		try
    		{
    			string json = File.ReadAllText(path, Encoding.UTF8);
    			Dictionary<string, object> values = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
    			if (values == null)
    			{
    				return null;
    			}
    			if (!MatchesInt(values, "schemaVersion", 1))
    			{
    				return null;
    			}
    			if (!MatchesInt(values, "databaseSchemaVersion", 2))
    			{
    				return null;
    			}
    			if (!string.Equals(StringValue(values, "producer"), "zotero-pdf-image-saver", StringComparison.Ordinal))
    			{
    				return null;
    			}
    			if (!IsIsoDateTimeText(StringValue(values, "updatedAt")))
    			{
    				return null;
    			}
    			return StringValue(values, "databasePath");
    		}
    		catch
    		{
    			return null;
    		}
    	}
    
    	private static bool IsCanonicalDatabasePath(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return false;
    		}
    		try
    		{
    			string fullPath = Path.GetFullPath(value.Trim());
    			string fileName = Path.GetFileName(fullPath).TrimEnd('.', ' ');
    			if (string.Equals(fileName, "zotero.sqlite", StringComparison.OrdinalIgnoreCase))
    			{
    				return false;
    			}
    			if (string.Equals(fileName, "zotero.sqlite-wal", StringComparison.OrdinalIgnoreCase))
    			{
    				return false;
    			}
    			if (string.Equals(fileName, "zotero.sqlite-shm", StringComparison.OrdinalIgnoreCase))
    			{
    				return false;
    			}
    			if (fileName.StartsWith("zotero.sqlite:", StringComparison.OrdinalIgnoreCase))
    			{
    				return false;
    			}
    			return string.Equals(fullPath, DefaultDatabasePath, StringComparison.OrdinalIgnoreCase);
    		}
    		catch
    		{
    			return false;
    		}
    	}
    
    	private static bool MatchesInt(IDictionary<string, object> values, string key, int expected)
    	{
    		try
    		{
    			if (!values.TryGetValue(key, out var value))
    			{
    				return false;
    			}
    			return Convert.ToInt32(value, CultureInfo.InvariantCulture) == expected;
    		}
    		catch
    		{
    			return false;
    		}
    	}
    
    	private static string StringValue(IDictionary<string, object> values, string key)
    	{
    		if (!values.TryGetValue(key, out var value))
    		{
    			return null;
    		}
    		return Convert.ToString(value, CultureInfo.InvariantCulture);
    	}
    
    	private static bool IsIsoDateTimeText(string value)
    	{
    		if (string.IsNullOrWhiteSpace(value))
    		{
    			return false;
    		}
    		DateTimeOffset _;
    		return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _);
    	}
    }

    internal sealed class ZoteroImageLibraryPathInfo
    {
    	public string DatabasePath { get; set; }
    
    	public string Source { get; set; }
    
    	public string SourceDescription { get; set; }
    
    	public string LocatorPath { get; set; }
    }
}
