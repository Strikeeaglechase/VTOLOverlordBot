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
	class Application
	{
		private long lastRefresh = DateTimeOffset.Now.ToUnixTimeMilliseconds();
		private long lastLobbySearch = DateTimeOffset.Now.ToUnixTimeMilliseconds();
		private WSManager socket;

		async public Task Start()
		{
			Console.WriteLine("Starting lobby manager");

			socket = new WSManager();
			socket.Init();
			Steamworks.SteamClient.Init(667970, true);
			GetLobbies(true);
			while (true)
			{
				Thread.Sleep(1000 / 60);

				long cur = DateTimeOffset.Now.ToUnixTimeMilliseconds();
				if (cur - lastRefresh > 30 * 1000)
				{
					GetLobbies(cur - lastLobbySearch > 300 * 1000);
					lastRefresh = cur;
				}
			}
		}
		async private void GetLobbies(bool doPlayerSearch)
		{
			LobbyQuery lobbyQuery = SteamMatchmaking.LobbyList.FilterDistanceWorldwide().WithMaxResults(100)
											.WithHigher("maxP", 1).WithEqual("lReady", 1).WithEqual("pwh", 0);
			Lobby[] vtolLobbies = await lobbyQuery.RequestAsync();
			List<VTOLLobbyInfo> lobbyInfos = new List<VTOLLobbyInfo>();

			vtolLobbies.ToList().ForEach(lobbyData =>
			{
				VTOLLobbyInfo lobbyInfo = new VTOLLobbyInfo(lobbyData);
				lobbyInfos.Add(lobbyInfo);

				if (doPlayerSearch) CheckLobbyForPlayers(lobbyData, lobbyInfo);
			});

			socket.Send(new LobbyData(lobbyInfos));
		}

		private async void CheckLobbyForPlayers(Lobby lobbyData, VTOLLobbyInfo lobbyInfo)
		{
			var steamworksLobby = await SteamMatchmaking.JoinLobbyAsync(lobbyData.Id);
			foreach (var member in steamworksLobby.Value.Members)
			{
				var data = new PlayerLocatorInfo(member.Id, member.Name, lobbyData.Id.Value, lobbyInfo.lobbyName, lobbyInfo.scenarioName);
				socket.Send(data);
			}

			steamworksLobby.Value.Leave();
		}

		class PlayerLocatorInfo
		{
			public string steamId;
			public string name;
			public string lobbyId;
			public string lobbyName;
			public string lobbyMission;
			public PlayerLocatorInfo(SteamId steamId, string name, ulong lobbyId, string lobbyName, string lobbyMission)
			{
				this.steamId = steamId.ToString();
				this.name = name;
				this.lobbyId = lobbyId.ToString();
				this.lobbyName = lobbyName;
				this.lobbyMission = lobbyMission;
			}
		}
	}
}
