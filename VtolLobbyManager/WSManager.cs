using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Websocket.Client;

namespace VtolLobbyManager
{
	class WSManager
	{
		private WebsocketClient client;
		public void Init()
		{
			string port = "";
			foreach (var line in File.ReadAllLines("../../bot/dist/.env"))
			{
				var parts = line.Split('=');
				if (parts[0] == "PORT") port = parts[1];
			}
			Console.WriteLine($"Got port from ENV file: {port}");

			Console.WriteLine("Setting up websocket");
			client = new WebsocketClient(new Uri($"ws://localhost:{port}"));

			client.Start();
		}

		public void Send(object message)
		{
			client.Send(message.ToJSON());
		}
	}
}