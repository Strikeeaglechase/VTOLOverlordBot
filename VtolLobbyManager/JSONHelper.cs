using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;

namespace VtolLobbyManager
{
	public static class JSONHelper
	{
		public static string ToJSON<T>(this T obj)
		{
			var opts = new JsonSerializerOptions();
			opts.IncludeFields = true;
			return JsonSerializer.Serialize(obj, typeof(T), opts);
		}
	}
}
