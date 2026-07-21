using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class AutomationServer : IDisposable
{
	private readonly Func<ZlkClusterPlotRequest, Task<ZlkChartRenderResult>> plotHandler;

	private readonly SemaphoreSlim plotGate = new SemaphoreSlim(1, 1);

	private readonly JavaScriptSerializer serializer = new JavaScriptSerializer
	{
		MaxJsonLength = 16777216
	};

	private readonly CancellationTokenSource cancellation = new CancellationTokenSource();

	private HttpListener listener;

	private string token;

	private string endpoint;

	private Task loopTask;

	public string Endpoint => endpoint;

	private static string StateRoot => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin");

	private static string DiscoveryPath => Path.Combine(StateRoot, "automation.json");

	private static string TokenPath => Path.Combine(StateRoot, "automation.token");

	public AutomationServer(Func<ZlkClusterPlotRequest, Task<ZlkChartRenderResult>> plotHandler)
	{
		this.plotHandler = plotHandler ?? throw new ArgumentNullException("plotHandler");
	}

	public void Start()
	{
		if (listener != null)
		{
			return;
		}
		token = CreateToken();
		for (int attempt = 0; attempt < 32; attempt++)
		{
			string prefix = "http://127.0.0.1:" + (49152 + Math.Abs(Guid.NewGuid().GetHashCode() % 12000)).ToString(CultureInfo.InvariantCulture) + "/";
			try
			{
				HttpListener candidate = new HttpListener();
				candidate.Prefixes.Add(prefix);
				candidate.Start();
				listener = candidate;
				endpoint = prefix.TrimEnd('/');
				WriteDiscoveryFiles();
				loopTask = Task.Run(() => ListenLoopAsync(cancellation.Token));
				AddInLogger.Info("ZLK 自动绘图 loopback 已启动：" + endpoint);
				return;
			}
			catch (Exception exception)
			{
				AddInLogger.Error("ZLK 自动绘图端口启动失败。", exception);
			}
		}
		throw new InvalidOperationException("无法启动 ZLK 自动绘图本机服务。请检查本机端口权限。");
	}

	public void Dispose()
	{
		cancellation.Cancel();
		try
		{
			listener?.Stop();
			((IDisposable)listener)?.Dispose();
		}
		catch
		{
		}
		try
		{
			if (loopTask != null && !loopTask.Wait(TimeSpan.FromSeconds(2.0)))
			{
				AddInLogger.Info("ZLK 自动绘图服务仍有请求在退出。");
			}
		}
		catch
		{
		}
		TryDelete(DiscoveryPath);
		TryDelete(TokenPath);
		plotGate.Dispose();
	}

	private async Task ListenLoopAsync(CancellationToken cancel)
	{
		while (!cancel.IsCancellationRequested && listener != null && listener.IsListening)
		{
			HttpListenerContext context = null;
			try
			{
				context = await listener.GetContextAsync().ConfigureAwait(continueOnCapturedContext: false);
				Task.Run(() => HandleAsync(context, cancel), cancel);
			}
			catch (ObjectDisposedException)
			{
				break;
			}
			catch (HttpListenerException)
			{
				break;
			}
			catch (Exception ex3)
			{
				AddInLogger.Error("ZLK 自动绘图服务接收请求失败。", ex3);
				if (context != null)
				{
					await WriteErrorAsync(context, 500, "自动绘图服务接收请求失败：" + ex3.Message).ConfigureAwait(continueOnCapturedContext: false);
				}
			}
		}
	}

	private async Task HandleAsync(HttpListenerContext context, CancellationToken cancel)
	{
		try
		{
			if (!IsTokenValid(context.Request))
			{
				await WriteErrorAsync(context, 401, "自动绘图令牌无效。").ConfigureAwait(continueOnCapturedContext: false);
				return;
			}
			string path = context.Request.Url.AbsolutePath.TrimEnd('/');
			if (string.Equals(path, "/health", StringComparison.OrdinalIgnoreCase))
			{
				if (!string.Equals(context.Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
				{
					await WriteErrorAsync(context, 405, "接口方法不支持。").ConfigureAwait(continueOnCapturedContext: false);
					return;
				}
				await WriteJsonAsync(context, 200, new Dictionary<string, object>
				{
					["ok"] = true,
					["schemaVersion"] = 1,
					["pid"] = Process.GetCurrentProcess().Id,
					["endpoint"] = endpoint
				}).ConfigureAwait(continueOnCapturedContext: false);
				return;
			}
			if (string.Equals(path, "/api/zlk-cluster/plot", StringComparison.OrdinalIgnoreCase))
			{
				if (!string.Equals(context.Request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
				{
					await WriteErrorAsync(context, 405, "接口方法不支持。").ConfigureAwait(continueOnCapturedContext: false);
					return;
				}
				if (await plotGate.WaitAsync(0, cancel).ConfigureAwait(continueOnCapturedContext: false))
				{
					try
					{
						string body = await ReadBodyAsync(context.Request, 1048576, cancel).ConfigureAwait(continueOnCapturedContext: false);
						ZlkClusterPlotRequest request = serializer.Deserialize<ZlkClusterPlotRequest>(body) ?? new ZlkClusterPlotRequest();
						if (string.IsNullOrWhiteSpace(request.ChartType))
						{
							request.ChartType = "auto";
						}
						if (string.IsNullOrWhiteSpace(request.StyleMode))
						{
							request.StyleMode = "activePpt";
						}
						ZlkChartRenderResult result = await plotHandler(request).ConfigureAwait(continueOnCapturedContext: false);
						await WriteJsonAsync(context, 200, new Dictionary<string, object>
						{
							["ok"] = true,
							["presentationPath"] = result.PresentationPath,
							["slideIndex"] = result.SlideIndex,
							["shapeCount"] = result.ShapeCount,
							["chartType"] = result.ChartType,
							["warnings"] = result.Warnings ?? new List<string>()
						}).ConfigureAwait(continueOnCapturedContext: false);
						return;
					}
					finally
					{
						plotGate.Release();
					}
				}
				await WriteErrorAsync(context, 409, "已有 PPT 自动绘图请求正在执行，请等待完成后再试。").ConfigureAwait(continueOnCapturedContext: false);
				return;
			}
			await WriteErrorAsync(context, 404, "未知自动绘图接口。").ConfigureAwait(continueOnCapturedContext: false);
		}
		catch (Exception ex)
		{
			AddInLogger.Error("ZLK 自动绘图请求失败。", ex);
			await WriteErrorAsync(context, 500, "自动绘图失败：" + ex.Message).ConfigureAwait(continueOnCapturedContext: false);
		}
	}

	private bool IsTokenValid(HttpListenerRequest request)
	{
		if (request == null || string.IsNullOrEmpty(token))
		{
			return false;
		}
		string auth = request.Headers["Authorization"] ?? string.Empty;
		if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) && string.Equals(auth.Substring("Bearer ".Length).Trim(), token, StringComparison.Ordinal))
		{
			return true;
		}
		if (!string.Equals((request.Headers["X-Rough-Ppt-Token"] ?? string.Empty).Trim(), token, StringComparison.Ordinal))
		{
			return string.Equals((request.Headers["X-RoughPpt-Automation-Token"] ?? string.Empty).Trim(), token, StringComparison.Ordinal);
		}
		return true;
	}

	private void WriteDiscoveryFiles()
	{
		Directory.CreateDirectory(StateRoot);
		File.WriteAllText(TokenPath, token, Encoding.UTF8);
		Dictionary<string, object> discovery = new Dictionary<string, object>
		{
			["endpoint"] = endpoint,
			["baseUrl"] = endpoint,
			["tokenPath"] = TokenPath,
			["pid"] = Process.GetCurrentProcess().Id,
			["startedAt"] = DateTime.UtcNow.ToString("o"),
			["schemaVersion"] = 1
		};
		File.WriteAllText(DiscoveryPath, serializer.Serialize(discovery), Encoding.UTF8);
	}

	private async Task<string> ReadBodyAsync(HttpListenerRequest request, int maxBytes, CancellationToken cancel)
	{
		using MemoryStream memory = new MemoryStream();
		byte[] buffer = new byte[8192];
		int read;
		while ((read = await request.InputStream.ReadAsync(buffer, 0, buffer.Length, cancel).ConfigureAwait(continueOnCapturedContext: false)) > 0)
		{
			memory.Write(buffer, 0, read);
			if (memory.Length > maxBytes)
			{
				throw new InvalidOperationException("请求体过大。");
			}
		}
		return Encoding.UTF8.GetString(memory.ToArray());
	}

	private Task WriteErrorAsync(HttpListenerContext context, int status, string message)
	{
		return WriteJsonAsync(context, status, new Dictionary<string, object>
		{
			["ok"] = false,
			["error"] = (string.IsNullOrWhiteSpace(message) ? "自动绘图失败。" : message)
		});
	}

	private async Task WriteJsonAsync(HttpListenerContext context, int status, object payload)
	{
		string json = serializer.Serialize(payload);
		byte[] bytes = Encoding.UTF8.GetBytes(json);
		context.Response.StatusCode = status;
		context.Response.ContentType = "application/json; charset=utf-8";
		context.Response.ContentLength64 = bytes.Length;
		await context.Response.OutputStream.WriteAsync(bytes, 0, bytes.Length).ConfigureAwait(continueOnCapturedContext: false);
		context.Response.OutputStream.Dispose();
	}

	private static string CreateToken()
	{
		byte[] bytes = new byte[32];
		using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
		{
			rng.GetBytes(bytes);
		}
		return Convert.ToBase64String(bytes);
	}

	private static void TryDelete(string path)
	{
		try
		{
			if (File.Exists(path))
			{
				File.Delete(path);
			}
		}
		catch
		{
		}
	}
}
