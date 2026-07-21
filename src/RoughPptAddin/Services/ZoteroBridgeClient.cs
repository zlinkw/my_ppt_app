using System.Data.SQLite;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Text;
using System.Web;
using System;

namespace RoughPptAddin.Services
{
    public sealed class ZoteroBridgeClient
    {
    	private const string DefaultEndpoint = "http://127.0.0.1:23119/pdf-image-saver/bridge";
    
    	public bool GetStatus()
    	{
    		return GetStatusResult().Success;
    	}
    
    	public bool OpenPdfByImageId(string imageId)
    	{
    		return OpenPdfByImageIdResult(imageId).Success;
    	}
    
    	public bool SelectParentItemByImageId(string imageId)
    	{
    		return SelectParentItemByImageIdResult(imageId).Success;
    	}
    
    	public bool SelectPdfAttachmentByImageId(string imageId)
    	{
    		return SelectPdfAttachmentByImageIdResult(imageId).Success;
    	}
    
    	public ZoteroBridgeResult GetStatusResult()
    	{
    		return SendActionResult("getStatus", null);
    	}
    
    	public ZoteroBridgeResult OpenPdfByImageIdResult(string imageId)
    	{
    		return SendActionResult("openPdfByImageId", imageId);
    	}
    
    	public ZoteroBridgeResult SelectParentItemByImageIdResult(string imageId)
    	{
    		return SendActionResult("selectParentItemByImageId", imageId);
    	}
    
    	public ZoteroBridgeResult SelectPdfAttachmentByImageIdResult(string imageId)
    	{
    		return SendActionResult("selectPdfAttachmentByImageId", imageId);
    	}
    
    	private ZoteroBridgeResult SendActionResult(string action, string imageId)
    	{
    		ZoteroBridgeResult result = new ZoteroBridgeResult
    		{
    			Command = (action ?? string.Empty)
    		};
    		try
    		{
    			string token = ReadBridgeState("token");
    			string status = ReadBridgeState("status");
    			if (IsBridgeDisabledState(token, status))
    			{
    				result.BridgeUnavailable = true;
    				result.Error = "Zotero 本地连接当前未启用或未注册。";
    				result.ResponseText = status ?? string.Empty;
    				return result;
    			}
    			HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ResolveBridgeEndpoint(ReadBridgeState("endpoint")));
    			request.Method = "POST";
    			request.ContentType = "application/x-www-form-urlencoded; charset=utf-8";
    			request.Timeout = 1200;
    			request.ReadWriteTimeout = 1200;
    			request.Headers["X-Rough-Ppt-Token"] = token ?? string.Empty;
    			string command = ((action == "getStatus") ? "status" : action);
    			string payload = "token=" + HttpUtility.UrlEncode(token ?? string.Empty) + "&command=" + HttpUtility.UrlEncode(command) + "&image_id=" + HttpUtility.UrlEncode(imageId ?? string.Empty);
    			byte[] bytes = Encoding.UTF8.GetBytes(payload);
    			request.ContentLength = bytes.Length;
    			using (Stream stream = request.GetRequestStream())
    			{
    				stream.Write(bytes, 0, bytes.Length);
    			}
    			using HttpWebResponse response = (HttpWebResponse)request.GetResponse();
    			using StreamReader reader = new StreamReader(response.GetResponseStream() ?? Stream.Null, Encoding.UTF8);
    			string text = reader.ReadToEnd();
    			result.StatusCode = (int)response.StatusCode;
    			result.ResponseText = text ?? string.Empty;
    			ApplyResponseText(result, text);
    			result.Success = response.StatusCode == HttpStatusCode.OK && !result.BridgeUnavailable && (string.IsNullOrWhiteSpace(text) || text.IndexOf("\"ok\":false", StringComparison.OrdinalIgnoreCase) < 0);
    			return result;
    		}
    		catch (WebException ex)
    		{
    			result.Error = ex.Message;
    			if (ex.Response is HttpWebResponse response2)
    			{
    				result.StatusCode = (int)response2.StatusCode;
    				using (response2)
    				{
    					using StreamReader reader2 = new StreamReader(response2.GetResponseStream() ?? Stream.Null, Encoding.UTF8);
    					string text2 = reader2.ReadToEnd();
    					result.ResponseText = text2 ?? string.Empty;
    					ApplyResponseText(result, text2);
    				}
    			}
    			else
    			{
    				result.BridgeUnavailable = true;
    			}
    			return result;
    		}
    		catch
    		{
    			result.BridgeUnavailable = true;
    			return result;
    		}
    	}
    
    	private static void ApplyResponseText(ZoteroBridgeResult result, string text)
    	{
    		result.Error = ExtractJsonString(text, "error") ?? result.Error;
    		result.FallbackUsed = ExtractJsonBool(text, "fallback_used");
    		result.SourcePreviewDuplicateKey = ExtractJsonString(text, "preview_duplicate_key");
    		result.HasRegisteredField = HasJsonKey(text, "registered");
    		result.Registered = ExtractJsonBool(text, "registered");
    		if (result.HasRegisteredField && !result.Registered)
    		{
    			result.BridgeUnavailable = true;
    			if (string.IsNullOrWhiteSpace(result.Error))
    			{
    				result.Error = "Zotero 本地连接当前未注册。";
    			}
    		}
    	}
    
    	private static bool IsStatusCommand(string command)
    	{
    		if (!string.Equals(command, "getStatus", StringComparison.OrdinalIgnoreCase))
    		{
    			return string.Equals(command, "status", StringComparison.OrdinalIgnoreCase);
    		}
    		return true;
    	}
    
    	private static string ReadBridgeState(string key)
    	{
    		string dbPath = ZoteroImageLibraryPathResolver.ResolveDatabasePath();
    		if (!File.Exists(dbPath))
    		{
    			return null;
    		}
    		try
    		{
    			using SQLiteConnection connection = new SQLiteConnection("Data Source=" + dbPath + ";Version=3;Read Only=True;FailIfMissing=True;");
    			connection.Open();
    			using SQLiteCommand command = new SQLiteCommand("SELECT value FROM bridge_state WHERE key=@key LIMIT 1", connection);
    			command.Parameters.AddWithValue("@key", key ?? string.Empty);
    			return Convert.ToString(command.ExecuteScalar());
    		}
    		catch
    		{
    			return null;
    		}
    	}
    
    	private static bool IsBridgeDisabledState(string token, string status)
    	{
    		if (string.IsNullOrWhiteSpace(token))
    		{
    			return true;
    		}
    		if (string.IsNullOrWhiteSpace(status))
    		{
    			return false;
    		}
    		if (status.IndexOf("\"registered\":false", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("\"registered\": false", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("disabled", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("shutdown", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("stopped", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("unregistered", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		if (status.IndexOf("invalid-shared-db-path", StringComparison.OrdinalIgnoreCase) >= 0)
    		{
    			return true;
    		}
    		return false;
    	}
    
    	private static string ResolveBridgeEndpoint(string endpoint)
    	{
    		if (string.Equals((endpoint ?? string.Empty).Trim(), "/pdf-image-saver/bridge", StringComparison.Ordinal))
    		{
    			return "http://127.0.0.1:23119/pdf-image-saver/bridge";
    		}
    		string.Equals((endpoint ?? string.Empty).Trim(), "http://127.0.0.1:23119/pdf-image-saver/bridge", StringComparison.OrdinalIgnoreCase);
    		return "http://127.0.0.1:23119/pdf-image-saver/bridge";
    	}
    
    	private static string ExtractJsonString(string text, string key)
    	{
    		if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(key))
    		{
    			return null;
    		}
    		Match match = Regex.Match(text, "\"" + Regex.Escape(key) + "\"\\s*:\\s*\"(?<value>(?:\\\\.|[^\"])*)\"", RegexOptions.IgnoreCase);
    		if (!match.Success)
    		{
    			return null;
    		}
    		return Regex.Unescape(match.Groups["value"].Value);
    	}
    
    	private static bool ExtractJsonBool(string text, string key)
    	{
    		if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(key))
    		{
    			return false;
    		}
    		Match match = Regex.Match(text, "\"" + Regex.Escape(key) + "\"\\s*:\\s*(?<value>true|false)", RegexOptions.IgnoreCase);
    		if (match.Success)
    		{
    			return string.Equals(match.Groups["value"].Value, "true", StringComparison.OrdinalIgnoreCase);
    		}
    		return false;
    	}
    
    	private static bool HasJsonKey(string text, string key)
    	{
    		if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(key))
    		{
    			return false;
    		}
    		return Regex.IsMatch(text, "\"" + Regex.Escape(key) + "\"\\s*:", RegexOptions.IgnoreCase);
    	}
    }

    public sealed class ZoteroBridgeResult
    {
    	public string Command { get; set; }
    
    	public bool Success { get; set; }
    
    	public bool BridgeUnavailable { get; set; }
    
    	public int StatusCode { get; set; }
    
    	public bool FallbackUsed { get; set; }
    
    	public bool HasRegisteredField { get; set; }
    
    	public bool Registered { get; set; }
    
    	public string SourcePreviewDuplicateKey { get; set; }
    
    	public string Error { get; set; }
    
    	public string ResponseText { get; set; }
    
    	public bool RejectedInvalidUri
    	{
    		get
    		{
    			if (!Success && !BridgeUnavailable && !string.IsNullOrWhiteSpace(Error))
    			{
    				return Error.IndexOf("invalid", StringComparison.OrdinalIgnoreCase) >= 0;
    			}
    			return false;
    		}
    	}
    }
}
