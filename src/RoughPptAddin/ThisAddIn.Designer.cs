using System;
using Microsoft.Office.Tools;

namespace RoughPptAddin;

internal sealed class Globals
{
	private static ThisAddIn thisAddIn;

	private static Factory factory;

	internal static ThisAddIn ThisAddIn
	{
		get
		{
			return thisAddIn;
		}
		set
		{
			if (thisAddIn == null)
			{
				thisAddIn = value;
				return;
			}
			throw new NotSupportedException();
		}
	}

	internal static Factory Factory
	{
		get
		{
			return factory;
		}
		set
		{
			if (factory == null)
			{
				factory = value;
				return;
			}
			throw new NotSupportedException();
		}
	}

	private Globals()
	{
	}
}
