using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace RoughPptAddin.Services;

public sealed class UpdateCheckResult
{
	public string Status { get; set; } = "unknown";

	public string Message { get; set; } = "";

	public string CurrentVersion { get; set; } = "";

	public string LatestVersion { get; set; } = "";

	public string ReleaseUrl { get; set; } = "";

	public DateTime CheckedAtUtc { get; set; }
}

public sealed class GitHubUpdateService
{
	private const string ApiUrl = "https://api.github.com/repos/zlinkw/my_ppt_app/releases/latest";
	private const string ReleasesUrl = "https://github.com/zlinkw/my_ppt_app/releases";
	private const long MaxResponseBytes = 1048576L;

	private readonly JavaScriptSerializer serializer = new()
	{
		MaxJsonLength = 1048576
	};

	static GitHubUpdateService()
	{
		ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
	}

	public UpdateCheckResult Check()
	{
		UpdateCheckResult result = new()
		{
			ReleaseUrl = ReleasesUrl,
			CheckedAtUtc = DateTime.UtcNow
		};
		try
		{
			result.CurrentVersion = ReadInstalledVersion();
			if (string.IsNullOrWhiteSpace(result.CurrentVersion))
			{
				result.Status = "error";
				result.Message = "无法读取当前安装版本，请重新打包安装。";
				return result;
			}

			Dictionary<string, object> release = FetchLatestRelease(out bool notFound);
			if (notFound)
			{
				result.Status = "no-release";
				result.Message = "GitHub 还没有正式 Release；当前已是可获得的最新版本。";
				return result;
			}
			if (release == null)
			{
				result.Status = "error";
				result.Message = "GitHub 返回的更新信息无效。";
				return result;
			}
			if (IsTrue(release, "draft") || IsTrue(release, "prerelease"))
			{
				result.Status = "no-stable-release";
				result.Message = "GitHub 最新条目不是正式版；继续使用当前稳定安装包。";
				return result;
			}

			result.LatestVersion = NormalizeVersionTag(ReadString(release, "tag_name"));
			if (string.IsNullOrWhiteSpace(result.LatestVersion))
			{
				result.Status = "error";
				result.Message = "GitHub Release 缺少可用版本号。";
				return result;
			}

			int comparison = CompareVersions(result.CurrentVersion, result.LatestVersion);
			if (comparison < 0)
			{
				result.Status = "update-available";
				result.Message = $"发现新版本 v{result.LatestVersion}。请关闭 PowerPoint 后运行新版安装包。";
			}
			else
			{
				result.Status = "up-to-date";
				result.Message = $"当前已是最新正式版本 v{result.CurrentVersion}。";
			}
			return result;
		}
		catch (Exception exception)
		{
			result.Status = "error";
			result.Message = "检查更新失败：" + exception.Message;
			AddInLogger.Error("检查 GitHub 更新失败。", exception);
			return result;
		}
	}

	public static void OpenReleasesPage()
	{
		Process.Start(new ProcessStartInfo
		{
			FileName = ReleasesUrl,
			UseShellExecute = true
		});
	}

	private string ReadInstalledVersion()
	{
		string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "build-info.json");
		if (!File.Exists(path))
		{
			return "";
		}
		Dictionary<string, object> info = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(path, Encoding.UTF8));
		return info == null ? "" : ReadString(info, "version");
	}

	private Dictionary<string, object> FetchLatestRelease(out bool notFound)
	{
		notFound = false;
		HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ApiUrl);
		request.Method = "GET";
		request.UserAgent = "RoughPptAddin-UpdateChecker";
		request.Accept = "application/vnd.github+json";
		request.Timeout = 10000;
		request.ReadWriteTimeout = 10000;
		try
		{
			using HttpWebResponse response = (HttpWebResponse)request.GetResponse();
			if (response.StatusCode != HttpStatusCode.OK)
			{
				throw new InvalidOperationException("GitHub HTTP " + (int)response.StatusCode);
			}
			using Stream stream = response.GetResponseStream();
			string body = ReadBoundedText(stream, MaxResponseBytes);
			return serializer.Deserialize<Dictionary<string, object>>(body);
		}
		catch (WebException exception) when (exception.Response is HttpWebResponse response && response.StatusCode == HttpStatusCode.NotFound)
		{
			notFound = true;
			return null;
		}
	}

	private static string ReadBoundedText(Stream stream, long maximumBytes)
	{
		using MemoryStream output = new();
		byte[] buffer = new byte[81920];
		int read;
		while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
		{
			if (output.Length + read > maximumBytes)
			{
				throw new InvalidDataException("GitHub 更新响应超过 1 MB 上限。");
			}
			output.Write(buffer, 0, read);
		}
		return Encoding.UTF8.GetString(output.ToArray());
	}

	private static bool IsTrue(Dictionary<string, object> values, string key)
	{
		return values.TryGetValue(key, out object value) && value is bool flag && flag;
	}

	private static string ReadString(Dictionary<string, object> values, string key)
	{
		return values.TryGetValue(key, out object value) ? Convert.ToString(value)?.Trim() ?? "" : "";
	}

	private static string NormalizeVersionTag(string value)
	{
		value = (value ?? "").Trim();
		if (value.StartsWith("v", StringComparison.OrdinalIgnoreCase))
		{
			value = value.Substring(1);
		}
		int separator = value.IndexOf('-');
		if (separator >= 0)
		{
			value = value.Substring(0, separator);
		}
		return value.Trim();
	}

	private static int CompareVersions(string left, string right)
	{
		long[] leftParts = ParseVersion(left);
		long[] rightParts = ParseVersion(right);
		for (int index = 0; index < 3; index++)
		{
			if (leftParts[index] < rightParts[index]) return -1;
			if (leftParts[index] > rightParts[index]) return 1;
		}
		return 0;
	}

	private static long[] ParseVersion(string value)
	{
		long[] parts = new long[3];
		string[] segments = (value ?? "").Split('.');
		for (int index = 0; index < Math.Min(parts.Length, segments.Length); index++)
		{
			string digits = "";
			foreach (char character in segments[index])
			{
				if (character < '0' || character > '9')
				{
					break;
				}
				digits += character;
			}
			parts[index] = long.TryParse(digits, out long parsed) ? parsed : 0L;
		}
		return parts;
	}
}
