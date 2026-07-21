using System;
using System.IO;
using System.Text;

namespace RoughPptAddin.Services;

public static class AddInLogger
{
	private static readonly object Sync = new object();

	public static string LogPath => Path.Combine(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RoughPptAddin", "logs"), "addin.log");

	public static void Info(string message)
	{
		Write("INFO", message, null);
	}

	public static void Error(string message, Exception exception)
	{
		Write("ERROR", message, exception);
	}

	private static void Write(string level, string message, Exception exception)
	{
		try
		{
			lock (Sync)
			{
				Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
				File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " [" + level + "] " + message + ((exception == null) ? string.Empty : (Environment.NewLine + exception)) + Environment.NewLine, Encoding.UTF8);
			}
		}
		catch
		{
		}
	}
}
