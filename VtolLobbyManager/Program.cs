using System;

namespace VtolLobbyManager
{
    class Program
    {
        public Application app;
        static public Program instance;
        static public void Main(string[] args)
        {
            instance = new Program();
            instance.Start();
        }

        public void Start()
        {
            app = new Application();
            app.Start().GetAwaiter().GetResult();
        }
    }
}
