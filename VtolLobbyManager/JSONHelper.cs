using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace VtolLobbyManager
{
	public static class JSONHelper
	{
		public static string ToJSON(this object obj)
		{
			JavaScriptSerializer serializer = new JavaScriptSerializer();
			return serializer.Serialize(obj);
		}
	}
}
