using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Security.Permissions;
using System.Windows.Forms;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;
using Microsoft.Office.Tools;
using Microsoft.VisualStudio.Tools.Applications.Runtime;
using RoughPptAddin.Ribbon;
using RoughPptAddin.Services;

namespace RoughPptAddin;

[StartupObject(0)]
[PermissionSet(SecurityAction.Demand, Name = "FullTrust")]
public sealed class ThisAddIn : AddInBase
{
	private RoughAddInController controller;

	internal CustomTaskPaneCollection CustomTaskPanes;

	internal Microsoft.Office.Interop.PowerPoint.Application Application;

	private object missing = Type.Missing;

	public RoughAddInController Controller => controller;

	private void ThisAddIn_Startup(object sender, EventArgs e)
	{
		controller = new RoughAddInController(Application, CustomTaskPanes);
		controller.Start();
	}

	private void ThisAddIn_Shutdown(object sender, EventArgs e)
	{
		controller?.Dispose();
	}

	private void InternalStartup()
	{
		base.Startup += ThisAddIn_Startup;
		base.Shutdown += ThisAddIn_Shutdown;
	}

	protected override IRibbonExtensibility CreateRibbonExtensibilityObject()
	{
		return new RoughRibbon(() => controller);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	public ThisAddIn(Factory factory, IServiceProvider serviceProvider)
		: base(factory, serviceProvider, "AddIn", "ThisAddIn")
	{
		Globals.Factory = factory;
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	protected override void Initialize()
	{
		base.Initialize();
		Application = GetHostItem<Microsoft.Office.Interop.PowerPoint.Application>(typeof(Microsoft.Office.Interop.PowerPoint.Application), "Application");
		Globals.ThisAddIn = this;
		System.Windows.Forms.Application.EnableVisualStyles();
		InitializeCachedData();
		InitializeControls();
		InitializeComponents();
		InitializeData();
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	protected override void FinishInitialization()
	{
		InternalStartup();
		OnStartup();
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	protected override void InitializeDataBindings()
	{
		BeginInitialization();
		BindToData();
		EndInitialization();
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void InitializeCachedData()
	{
		if (base.DataHost != null && base.DataHost.IsCacheInitialized)
		{
			base.DataHost.FillCachedData(this);
		}
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void InitializeControls()
	{
		CustomTaskPanes = Globals.Factory.CreateCustomTaskPaneCollection(null, null, "CustomTaskPanes", "CustomTaskPanes", this);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void InitializeComponents()
	{
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void InitializeData()
	{
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void BindToData()
	{
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Advanced)]
	private void StartCaching(string memberName)
	{
		base.DataHost.StartCaching(this, memberName);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Advanced)]
	private void StopCaching(string memberName)
	{
		base.DataHost.StopCaching(this, memberName);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Advanced)]
	private bool IsCached(string memberName)
	{
		return base.DataHost.IsCached(this, memberName);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void BeginInitialization()
	{
		BeginInit();
		CustomTaskPanes.BeginInit();
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	private void EndInitialization()
	{
		CustomTaskPanes.EndInit();
		EndInit();
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Advanced)]
	private bool NeedsFill(string memberName)
	{
		return base.DataHost.NeedsFill(this, memberName);
	}

	[DebuggerNonUserCode]
	[EditorBrowsable(EditorBrowsableState.Never)]
	protected override void OnShutdown()
	{
		CustomTaskPanes?.Dispose();
		base.OnShutdown();
	}
}
