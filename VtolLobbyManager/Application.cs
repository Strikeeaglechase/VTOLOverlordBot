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
		private WSManager socket;

		async public Task Start()
		{
			Console.WriteLine("Starting lobby manager");

			socket = new WSManager();
			socket.Init();
			Steamworks.SteamClient.Init(667970, true);
			GetLobbies();
			while (true)
			{
				Thread.Sleep(1000 / 60);

				long cur = DateTimeOffset.Now.ToUnixTimeMilliseconds();
				if (cur - lastRefresh > 30 * 1000)
				{
					GetLobbies();
					lastRefresh = cur;
				}
			}
		}
		async private void GetLobbies()
		{
			LobbyQuery lobbyQuery = SteamMatchmaking.LobbyList.FilterDistanceWorldwide().WithMaxResults(100)
											.WithHigher("maxP", 1).WithEqual("lReady", 1).WithEqual("pwh", 0);
			Lobby[] vtolLobbies = await lobbyQuery.RequestAsync();
			List<VTOLLobbyInfo> lobbyInfos = new List<VTOLLobbyInfo>();

			vtolLobbies.ToList().ForEach(lobbyData =>
			{
				VTOLLobbyInfo lobbyInfo = new VTOLLobbyInfo(lobbyData);
				lobbyInfos.Add(lobbyInfo);
				// Console.WriteLine($"{lobbyInfo.lobbyName} hosted by {lobbyInfo.ownerName} Players: {lobbyInfo.playerCount}/{lobbyInfo.maxPlayers}, {lobbyInfo.scenarioName}  {lobbyInfo.gameVersion}.");
			});

			socket.Send(new LobbyData(lobbyInfos));
		}
	}
}
