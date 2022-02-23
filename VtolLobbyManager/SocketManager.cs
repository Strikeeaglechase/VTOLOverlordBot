using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Websocket.Client;

namespace VtolLobbyManager
{
    class SocketManager
    {
        private bool hasInit = false;

        private WebsocketClient client;

        public void Init()
        {
            Console.WriteLine("Setting up websocket client!");
        }
    }
}
