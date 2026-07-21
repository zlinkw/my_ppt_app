using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using RoughPptAddin.Models;

namespace RoughPptAddin.Services;

public sealed class ShapeRegenerator : IDisposable
{
	private sealed class PendingRegeneration
	{
		public string Key { get; set; }

		public Microsoft.Office.Interop.PowerPoint.Shape Shape { get; set; }

		public RoughStyle StyleOverride { get; set; }
	}

	private readonly Application application;

	private readonly RoughJsBridge bridge;

	private readonly PptFreeformWriter writer;

	private readonly MetadataService metadata;

	private readonly PptStyleSynchronizer styleSynchronizer;

	private readonly object pendingSync = new object();

	private readonly List<PendingRegeneration> pendingRegenerations = new List<PendingRegeneration>();

	private readonly List<string> lastRoughGroupIds = new List<string>();

	private bool isRegenerating;

	public ShapeRegenerator(Application application, RoughJsBridge bridge, PptFreeformWriter writer, MetadataService metadata, PptStyleSynchronizer styleSynchronizer)
	{
		this.application = application;
		this.bridge = bridge;
		this.writer = writer;
		this.metadata = metadata;
		this.styleSynchronizer = styleSynchronizer;
	}

	public void Start()
	{
		application.AfterShapeSizeChange += OnAfterShapeSizeChange;
	}

	public int RefreshSelection()
	{
		return RefreshSelection(null);
	}

	public int RefreshSelection(RoughStyle styleOverride)
	{
		Selection selection = application.ActiveWindow?.Selection;
		List<Microsoft.Office.Interop.PowerPoint.Shape> targets = ResolveSelectionTargets(selection);
		if (targets.Count == 0 && styleOverride != null)
		{
			targets = ResolveRememberedTargets();
		}
		foreach (Microsoft.Office.Interop.PowerPoint.Shape target in targets)
		{
			QueueRegeneration(target, styleOverride);
		}
		return targets.Count;
	}

	public async Task<int> RefreshSelectionNowAsync(RoughStyle styleOverride)
	{
		Selection selection = application.ActiveWindow?.Selection;
		List<Microsoft.Office.Interop.PowerPoint.Shape> targets = ResolveSelectionTargets(selection);
		if (targets.Count == 0 && styleOverride != null)
		{
			targets = ResolveRememberedTargets();
		}
		int completed = 0;
		foreach (Microsoft.Office.Interop.PowerPoint.Shape target in targets)
		{
			if (await RegenerateWithTimeoutAsync(target, styleOverride, TimeSpan.FromSeconds(20.0)).ConfigureAwait(continueOnCapturedContext: true))
			{
				completed++;
			}
		}
		return completed;
	}

	public void RememberSelection(Selection selection)
	{
		List<Microsoft.Office.Interop.PowerPoint.Shape> targets = ResolveSelectionTargets(selection);
		if (targets.Count == 0)
		{
			return;
		}
		lock (lastRoughGroupIds)
		{
			lastRoughGroupIds.Clear();
			foreach (Microsoft.Office.Interop.PowerPoint.Shape target in targets)
			{
				if (metadata.TryRead(target, out var request) && !string.IsNullOrWhiteSpace(request.GroupId) && !lastRoughGroupIds.Contains(request.GroupId))
				{
					lastRoughGroupIds.Add(request.GroupId);
				}
			}
		}
	}

	public void Dispose()
	{
		application.AfterShapeSizeChange -= OnAfterShapeSizeChange;
	}

	private void OnAfterShapeSizeChange(Microsoft.Office.Interop.PowerPoint.Shape shp)
	{
		QueueRegeneration(shp, null);
	}

	private void QueueRegeneration(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle styleOverride)
	{
		shape = ResolveRoughGroup(shape);
		if (!metadata.TryRead(shape, out var request))
		{
			return;
		}
		string key = RegenerationKey(shape, request);
		bool startDrain = false;
		lock (pendingSync)
		{
			PendingRegeneration existing = pendingRegenerations.Find((PendingRegeneration item) => string.Equals(item.Key, key, StringComparison.Ordinal));
			if (existing == null)
			{
				pendingRegenerations.Add(new PendingRegeneration
				{
					Key = key,
					Shape = shape,
					StyleOverride = styleOverride
				});
			}
			else
			{
				existing.Shape = shape;
				if (styleOverride != null)
				{
					existing.StyleOverride = styleOverride;
				}
			}
			if (!isRegenerating)
			{
				isRegenerating = true;
				startDrain = true;
			}
		}
		if (startDrain)
		{
			DrainPendingAsync();
		}
	}

	private async Task DrainPendingAsync()
	{
		bool restart = false;
		try
		{
			while (true)
			{
				await Task.Delay(120).ConfigureAwait(continueOnCapturedContext: true);
				List<PendingRegeneration> batch;
				lock (pendingSync)
				{
					if (pendingRegenerations.Count == 0)
					{
						break;
					}
					batch = new List<PendingRegeneration>(pendingRegenerations);
					pendingRegenerations.Clear();
					goto IL_00d9;
				}
				IL_00d9:
				foreach (PendingRegeneration pending in batch)
				{
					await RegenerateAsync(pending.Shape, pending.StyleOverride).ConfigureAwait(continueOnCapturedContext: true);
				}
			}
		}
		finally
		{
			lock (pendingSync)
			{
				isRegenerating = false;
				if (pendingRegenerations.Count > 0)
				{
					isRegenerating = true;
					restart = true;
				}
			}
		}
		if (restart)
		{
			DrainPendingAsync();
		}
	}

	private async Task<bool> RegenerateWithTimeoutAsync(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle styleOverride, TimeSpan timeout)
	{
		Task<bool> task = RegenerateAsync(shape, styleOverride);
		if (await Task.WhenAny(task, Task.Delay(timeout)).ConfigureAwait(continueOnCapturedContext: true) != task)
		{
			AddInLogger.Error("手绘对象重绘超时。", new TimeoutException("重绘选区超过 " + timeout.TotalSeconds + " 秒未完成。"));
			return false;
		}
		return await task.ConfigureAwait(continueOnCapturedContext: true);
	}

	private async Task<bool> RegenerateAsync(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughStyle styleOverride)
	{
		try
		{
			shape = ResolveRoughGroup(shape);
			if (!metadata.TryRead(shape, out var request))
			{
				return false;
			}
			if (!bridge.IsReady)
			{
				await bridge.WaitUntilReadyAsync(TimeSpan.FromSeconds(10.0)).ConfigureAwait(continueOnCapturedContext: true);
			}
			request.Left = shape.Left;
			request.Top = shape.Top;
			request.Width = shape.Width;
			request.Height = shape.Height;
			styleSynchronizer?.Capture(shape, request);
			if (styleOverride != null)
			{
				request.Style = styleOverride;
			}
			RoughDrawable drawable = await bridge.GenerateAsync(request).ConfigureAwait(continueOnCapturedContext: true);
			bool nativeFormatsApplied = false;
			bool preserveNativeFormats = styleOverride == null;
			Microsoft.Office.Interop.PowerPoint.Shape replaced = writer.ReplaceVisiblePaths(shape, request, drawable, delegate(Microsoft.Office.Interop.PowerPoint.Shape oldGroup, Microsoft.Office.Interop.PowerPoint.Shape newGroup)
			{
				if (!preserveNativeFormats)
				{
					return false;
				}
				nativeFormatsApplied = styleSynchronizer?.ApplyNativeFormats(oldGroup, newGroup, request) ?? false;
				return nativeFormatsApplied;
			});
			if (styleOverride != null || !nativeFormatsApplied)
			{
				styleSynchronizer?.Apply(replaced, request);
			}
			else
			{
				styleSynchronizer?.ApplyStructuralDefaults(replaced, request);
			}
			RememberGroup(replaced);
			return true;
		}
		catch (Exception exception)
		{
			AddInLogger.Error("手绘对象重绘失败。", exception);
			return false;
		}
	}

	private List<Microsoft.Office.Interop.PowerPoint.Shape> ResolveSelectionTargets(Selection selection)
	{
		List<Microsoft.Office.Interop.PowerPoint.Shape> targets = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
		try
		{
			if (selection?.ShapeRange == null || selection.ShapeRange.Count == 0)
			{
				return targets;
			}
			for (int i = 1; i <= selection.ShapeRange.Count; i++)
			{
				AddDistinctTarget(targets, ResolveRoughGroup(selection.ShapeRange[i]));
			}
		}
		catch
		{
		}
		if (targets.Count > 0)
		{
			RememberGroups(targets);
		}
		return targets;
	}

	private List<Microsoft.Office.Interop.PowerPoint.Shape> ResolveRememberedTargets()
	{
		List<Microsoft.Office.Interop.PowerPoint.Shape> targets = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
		List<string> ids = new List<string>();
		lock (lastRoughGroupIds)
		{
			ids.AddRange(lastRoughGroupIds);
		}
		foreach (string id in ids)
		{
			AddDistinctTarget(targets, FindRoughGroupById(id));
		}
		return targets;
	}

	private Microsoft.Office.Interop.PowerPoint.Shape ResolveRoughGroup(Microsoft.Office.Interop.PowerPoint.Shape shape)
	{
		if (shape == null)
		{
			return null;
		}
		if (!metadata.TryRead(shape, out var request))
		{
			return null;
		}
		if (shape.Type == MsoShapeType.msoGroup && string.IsNullOrWhiteSpace(metadata.ReadRole(shape)))
		{
			return shape;
		}
		return FindRoughGroupById(request.GroupId);
	}

	private Microsoft.Office.Interop.PowerPoint.Shape FindRoughGroupById(string groupId)
	{
		if (string.IsNullOrWhiteSpace(groupId))
		{
			return null;
		}
		if (!(application.ActiveWindow?.View?.Slide is Slide slide))
		{
			return null;
		}
		for (int i = 1; i <= slide.Shapes.Count; i++)
		{
			Microsoft.Office.Interop.PowerPoint.Shape candidate = slide.Shapes[i];
			if (candidate.Type == MsoShapeType.msoGroup && metadata.TryRead(candidate, out var request) && string.Equals(request.GroupId, groupId, StringComparison.OrdinalIgnoreCase))
			{
				return candidate;
			}
		}
		return null;
	}

	private void RememberGroups(IList<Microsoft.Office.Interop.PowerPoint.Shape> targets)
	{
		lock (lastRoughGroupIds)
		{
			lastRoughGroupIds.Clear();
			foreach (Microsoft.Office.Interop.PowerPoint.Shape target in targets)
			{
				if (metadata.TryRead(target, out var request) && !string.IsNullOrWhiteSpace(request.GroupId) && !lastRoughGroupIds.Contains(request.GroupId))
				{
					lastRoughGroupIds.Add(request.GroupId);
				}
			}
		}
	}

	private void RememberGroup(Microsoft.Office.Interop.PowerPoint.Shape target)
	{
		if (target == null || !metadata.TryRead(target, out var request) || string.IsNullOrWhiteSpace(request.GroupId))
		{
			return;
		}
		lock (lastRoughGroupIds)
		{
			lastRoughGroupIds.Remove(request.GroupId);
			lastRoughGroupIds.Insert(0, request.GroupId);
		}
	}

	private void AddDistinctTarget(IList<Microsoft.Office.Interop.PowerPoint.Shape> targets, Microsoft.Office.Interop.PowerPoint.Shape target)
	{
		if (target == null || !metadata.TryRead(target, out var request))
		{
			return;
		}
		foreach (Microsoft.Office.Interop.PowerPoint.Shape existing in targets)
		{
			if (metadata.TryRead(existing, out var existingRequest) && string.Equals(existingRequest.GroupId, request.GroupId, StringComparison.OrdinalIgnoreCase))
			{
				return;
			}
		}
		targets.Add(target);
	}

	private static string RegenerationKey(Microsoft.Office.Interop.PowerPoint.Shape shape, RoughShapeRequest request)
	{
		if (!string.IsNullOrWhiteSpace(request?.GroupId))
		{
			return request.GroupId;
		}
		try
		{
			string tag = shape.Tags["PPT_ROUGH_GROUP_ID"];
			if (!string.IsNullOrWhiteSpace(tag))
			{
				return tag;
			}
		}
		catch
		{
		}
		try
		{
			if (!string.IsNullOrWhiteSpace(shape.Name))
			{
				return shape.Name;
			}
		}
		catch
		{
		}
		return Guid.NewGuid().ToString("N");
	}
}
