using Steamworks.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace VtolLobbyManager
{
	public class VTOLLobbyInfo
	{
		public string lobbyName;
		public string ownerName;
		public string ownerId;
		public string scenarioName;
		public string scenarioId;
		public string maxPlayers;
		public string feature;
		public string envIdx;
		public string gameVersion;
		public string briefingRoom;
		public string passwordHash;
		public string ld_GameState;
		public string mUtc;
		public int playerCount;
		public string modCount;
		public string loadedMods;

		public Lobby lobby;
		public VTOLLobbyInfo(Lobby lobby)
		{
			this.lobby = lobby;
			playerCount = lobby.MemberCount;

			lobbyName = lobby.GetData("lName");
			ownerName = lobby.GetData("oName");
			ownerId = lobby.GetData("oId");
			scenarioName = lobby.GetData("scn");
			scenarioId = lobby.GetData("scID");
			maxPlayers = lobby.GetData("maxP");
			feature = lobby.GetData("feature");
			envIdx = lobby.GetData("envIdx");
			briefingRoom = lobby.GetData("brtype");
			passwordHash = lobby.GetData("pwh");
			ld_GameState = lobby.GetData("gState");
			gameVersion = lobby.GetData("ver");
			mUtc = lobby.GetData("mUtc");
			if (gameVersion.Contains("m"))
			{
				modCount = lobby.GetData("lModCount");
				loadedMods = lobby.GetData("lMods");
			}

			// Console.WriteLine($"Found VTOL Lobby | Name: {lobbyName} , Owner: {ownerName} , Scenario: {scenarioName} , Players: {playerCount}/{maxPlayers} , PP: {int.Parse(passwordHash) != 0}");
		}
	}
}
