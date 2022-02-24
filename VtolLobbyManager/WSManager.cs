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
			Console.WriteLine("Setting up websocket");
			client = new WebsocketClient(new Uri("ws://localhost:38560"));

			client.Start();
		}

		public void Send(object message)
		{
			client.Send(message.ToJSON());
		}
	}
}