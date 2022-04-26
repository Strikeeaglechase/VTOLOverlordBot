using Steamworks;
using Steamworks.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace VtolLobbyManager
{
	public class LobbyData
	{
		public VTOLLobbyInfo[] lobbies;

		public LobbyData(List<VTOLLobbyInfo> lobbies)
		{
			this.lobbies = lobbies.ToArray();
		}
	}
}