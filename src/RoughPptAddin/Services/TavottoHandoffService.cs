using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace RoughPptAddin.Services;

public sealed class TavottoHandoffResult
{
	public string Version { get; set; }
	public string Project { get; set; }
	public string ArtifactPath { get; set; }
	public string LaunchMode { get; set; }
	public bool Parameterizable { get; set; }
}

/// <summary>
/// Uses Tavotto's documented v1 CLI handoff. Release packages carry v0.15.0 as a separate process.
/// </summary>
public static class TavottoHandoffService
{
	private const int ProtocolVersion = 1;
	private const string BundledVersion = "0.15.0";
	private const int MaxJsonBytes = 32768;
	private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();
	private static readonly HashSet<string> FigureExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
	{
		".pdf", ".svg", ".png", ".jpg", ".jpeg", ".eps", ".tif", ".tiff"
	};

	public static TavottoHandoffResult Check()
	{
		string cli = ResolveCli();
		Dictionary<string, object> result = RunJson(cli, 15000, "doctor", "--json");
		AssertBundledVersion(cli, result);
		return new TavottoHandoffResult { Version = ReadString(result, "version") };
	}

	public static TavottoHandoffResult OpenCurrentSvg(ResearchSvgDocument document)
	{
		if (document == null || string.IsNullOrWhiteSpace(document.CachedPath))
		{
			throw new InvalidOperationException("请先在科研绘图工作区生成或导入 SVG。");
		}
		Check();
		if (new FileInfo(document.CachedPath).Length > ResearchChartStudioService.MaxSvgBytes)
		{
			throw new InvalidDataException("当前 SVG 超过 4 MB。请重新生成图表。");
		}
		byte[] bytes = File.ReadAllBytes(document.CachedPath);
		if (bytes.LongLength == 0 || bytes.LongLength > ResearchChartStudioService.MaxSvgBytes)
		{
			throw new InvalidDataException("当前 SVG 内容无效或超过 4 MB。请重新生成图表。");
		}
		using (SHA256 sha = SHA256.Create())
		{
			string hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", string.Empty);
			if (!string.Equals(hash, document.Sha256, StringComparison.OrdinalIgnoreCase))
			{
				throw new InvalidDataException("当前 SVG 已变化，请重新生成或导入后再交给 Tavotto。");
			}
			string project = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "RoughPptAddin", "Tavotto");
			Directory.CreateDirectory(project);
			string stem = "research-chart-" + hash.Substring(0, 12).ToLowerInvariant();
			string target = Path.Combine(project, stem + ".svg");
			if (File.Exists(target) && (new FileInfo(target).Length != bytes.Length || !File.ReadAllBytes(target).SequenceEqual(bytes)))
			{
				target = Path.Combine(project, stem + "-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + ".svg");
			}
			if (!File.Exists(target))
			{
				File.WriteAllBytes(target, bytes);
			}
			return OpenFigure(target);
		}
	}

	public static TavottoHandoffResult OpenFigure(string figurePath)
	{
		string fullPath = Path.GetFullPath(figurePath ?? string.Empty);
		if (!FigureExtensions.Contains(Path.GetExtension(fullPath)) || !File.Exists(fullPath))
		{
			throw new InvalidOperationException("请选择已有的 PDF、SVG 或 Tavotto 支持的图像文件。");
		}
		string cli = ResolveCli();
		Dictionary<string, object> health = RunJson(cli, 15000, "doctor", "--json");
		AssertBundledVersion(cli, health);
		Dictionary<string, object> opened = RunJson(cli, 60000, "open", fullPath, "--json");
		Dictionary<string, object> registry = ReadObject(opened, "registry");
		Dictionary<string, object> launch = ReadObject(opened, "launch");
		return new TavottoHandoffResult
		{
			Version = ReadString(health, "version"),
			Project = ReadString(opened, "project"),
			ArtifactPath = fullPath,
			LaunchMode = ReadString(launch, "mode"),
			Parameterizable = ReadBool(registry, "parameterizable")
		};
	}

	private static string ResolveCli()
	{
		string explicitPath = Environment.GetEnvironmentVariable("TAVOTTO_CLI");
		if (!string.IsNullOrWhiteSpace(explicitPath))
		{
			string resolved = ExistingCli(explicitPath);
			if (resolved == null)
			{
				throw new InvalidOperationException("TAVOTTO_CLI 指向的命令行程序不存在。请检查该环境变量。");
			}
			return resolved;
		}
		string bundledRoot = BundledRoot();
		string bundledCli = Path.Combine(bundledRoot, "sidecar", "Tavotto", "tavotto-cli.exe");
		if (Directory.Exists(bundledRoot))
		{
			if (!File.Exists(Path.Combine(bundledRoot, "bundle.json")) || !File.Exists(bundledCli) || !File.Exists(Path.Combine(bundledRoot, "Tavotto.exe")))
			{
				throw new InvalidOperationException("插件内置 Tavotto 文件不完整，请重新安装插件。");
			}
			return bundledCli;
		}
		foreach (string directory in (Environment.GetEnvironmentVariable("PATH") ?? string.Empty).Split(';'))
		{
			foreach (string name in new[] { "tavotto.exe", "tavotto-cli.exe" })
			{
				try
				{
					string candidate = ExistingCli(Path.Combine(directory.Trim().Trim('"'), name));
					if (candidate != null) return candidate;
				}
				catch (ArgumentException) { /* Ignore malformed PATH entries. */ }
			}
		}
		string config = Environment.GetEnvironmentVariable("TAVOTTO_CONFIG_DIR");
		if (string.IsNullOrWhiteSpace(config))
		{
			config = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Tavotto");
		}
		string manifestPath = Path.Combine(config, "install.json");
		if (File.Exists(manifestPath) && new FileInfo(manifestPath).Length <= MaxJsonBytes)
		{
			try
			{
				Dictionary<string, object> manifest = Serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(manifestPath, Encoding.UTF8));
				if (ReadInt(manifest, "protocol") == ProtocolVersion && string.Equals(ReadString(manifest, "product"), "Tavotto", StringComparison.OrdinalIgnoreCase))
				{
					string candidate = ExistingCli(ReadString(manifest, "cli"));
					if (candidate != null) return candidate;
				}
			}
			catch (Exception ex) when (ex is ArgumentException || ex is InvalidOperationException || ex is IOException)
			{
				// A stale manifest does not hide a valid installed CLI.
			}
		}
		List<string> roots = new List<string>
		{
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Tavotto"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Tavotto"),
			Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Tavotto")
		};
		using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Tavotto"))
		{
			string installed = key?.GetValue("InstallLocation") as string;
			if (!string.IsNullOrWhiteSpace(installed)) roots.Add(installed);
		}
		foreach (string root in roots)
		{
			string candidate = ExistingCli(Path.Combine(root, "sidecar", "Tavotto", "tavotto-cli.exe"));
			if (candidate != null) return candidate;
		}
		throw new InvalidOperationException("未找到 Tavotto 命令行。请先安装 Tavotto 桌面版或 pipx 版，然后重试。");
	}

	private static string BundledRoot()
	{
		return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin", "publish", "third-party", "Tavotto");
	}

	private static bool IsBundledCli(string cli)
	{
		return string.Equals(cli, Path.Combine(BundledRoot(), "sidecar", "Tavotto", "tavotto-cli.exe"), StringComparison.OrdinalIgnoreCase);
	}

	private static void AssertBundledVersion(string cli, Dictionary<string, object> response)
	{
		if (IsBundledCli(cli) && !string.Equals(ReadString(response, "version"), BundledVersion, StringComparison.Ordinal))
		{
			throw new InvalidOperationException("插件内置 Tavotto 版本不符；需要 " + BundledVersion + "，请重新安装插件。");
		}
	}

	private static string ExistingCli(string candidate)
	{
		if (string.IsNullOrWhiteSpace(candidate)) return null;
		candidate = candidate.Trim().Trim('"');
		if (!Path.IsPathRooted(candidate)) return null;
		string fullPath = Path.GetFullPath(candidate);
		if (string.Equals(Path.GetFileName(fullPath), "Tavotto.exe", StringComparison.OrdinalIgnoreCase)) return null;
		return File.Exists(fullPath) ? fullPath : null;
	}

	private static Dictionary<string, object> RunJson(string cli, int timeoutMs, params string[] args)
	{
		ProcessStartInfo start = new ProcessStartInfo
		{
			FileName = cli,
			Arguments = string.Join(" ", args.Select(QuoteArgument)),
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
			WindowStyle = ProcessWindowStyle.Hidden,
			StandardOutputEncoding = Encoding.UTF8,
			StandardErrorEncoding = Encoding.UTF8
		};
		if (IsBundledCli(cli))
		{
			start.EnvironmentVariables["TAVOTTO_DESKTOP_APP"] = Path.Combine(BundledRoot(), "Tavotto.exe");
			start.EnvironmentVariables["TAVOTTO_NO_UPDATE_CHECK"] = "1";
		}
		StringBuilder stdout = new StringBuilder();
		StringBuilder stderr = new StringBuilder();
		using (Process process = new Process { StartInfo = start })
		{
			process.OutputDataReceived += (sender, e) => AppendBounded(stdout, e.Data);
			process.ErrorDataReceived += (sender, e) => AppendBounded(stderr, e.Data);
			process.Start();
			process.BeginOutputReadLine();
			process.BeginErrorReadLine();
			if (!process.WaitForExit(timeoutMs))
			{
				try { process.Kill(); } catch { /* The timeout remains the reported failure. */ }
				throw new TimeoutException("Tavotto 命令行响应超时，请检查其安装或稍后重试。");
			}
			process.WaitForExit();
			string output = stdout.ToString().Trim();
			if (output.Length == 0 || output.Length > MaxJsonBytes)
			{
				throw new InvalidOperationException("Tavotto 未返回有效的 JSON 结果。" + (stderr.Length > 0 ? " " + stderr.ToString().Trim() : string.Empty));
			}
			Dictionary<string, object> result;
			try { result = Serializer.Deserialize<Dictionary<string, object>>(output); }
			catch (ArgumentException ex) { throw new InvalidDataException("Tavotto 返回的 JSON 无法解析。", ex); }
			if (ReadInt(result, "protocol") != ProtocolVersion)
			{
				throw new NotSupportedException("Tavotto 命令行协议版本不兼容；需要 v1。");
			}
			if (process.ExitCode != 0 || !ReadBool(result, "ok"))
			{
				string message = ReadString(result, "error");
				string code = ReadString(result, "code");
				throw new InvalidOperationException("Tavotto 处理失败" + (code.Length > 0 ? "（" + code + "）" : string.Empty) + "：" + (message.Length > 0 ? message : "请检查 Tavotto 诊断信息。"));
			}
			return result;
		}
	}

	private static void AppendBounded(StringBuilder builder, string line)
	{
		if (line == null) return;
		lock (builder)
		{
			if (builder.Length < MaxJsonBytes + 1)
			{
				builder.AppendLine(line);
			}
		}
	}

	private static string QuoteArgument(string value)
	{
		StringBuilder quoted = new StringBuilder("\"");
		int slashes = 0;
		foreach (char c in value)
		{
			if (c == '\\') { slashes++; continue; }
			if (c == '"')
			{
				quoted.Append('\\', slashes * 2 + 1).Append('"');
				slashes = 0;
				continue;
			}
			quoted.Append('\\', slashes).Append(c);
			slashes = 0;
		}
		quoted.Append('\\', slashes * 2).Append('"');
		return quoted.ToString();
	}

	private static Dictionary<string, object> ReadObject(Dictionary<string, object> values, string key)
	{
		return values != null && values.TryGetValue(key, out object value) ? value as Dictionary<string, object> : null;
	}

	private static string ReadString(Dictionary<string, object> values, string key)
	{
		return values != null && values.TryGetValue(key, out object value) ? Convert.ToString(value) ?? string.Empty : string.Empty;
	}

	private static int ReadInt(Dictionary<string, object> values, string key)
	{
		return values != null && values.TryGetValue(key, out object value) && int.TryParse(Convert.ToString(value), out int result) ? result : 0;
	}

	private static bool ReadBool(Dictionary<string, object> values, string key)
	{
		return values != null && values.TryGetValue(key, out object value) && value is bool result && result;
	}
}
