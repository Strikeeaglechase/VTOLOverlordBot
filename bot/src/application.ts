import FrameworkClient from "strike-discord-framework";
import Logger from "strike-discord-framework/dist/logger";
import { WebSocket, WebSocketServer } from "ws";
import { execSync, spawn } from "child_process";

const PORT = 38560;
class Application {
	public log: Logger;
	private server: WebSocketServer;
	private socket: WebSocket;
	private socketOpen = false;

	constructor(private framework: FrameworkClient) {
		this.log = framework.log;
	}

	async init() {
		this.server = new WebSocketServer({ port: PORT });

		this.server.on("listening", () => {
			this.log.info(`Websocket server listening on ${PORT}`);
			this.createManagerProcess();
		});

		this.server.on("connection", (socket) => {
			this.socket = socket;

			this.socket.on("error", (e) => {
				this.log.warn(`Lobby manager process returned an error`);
				this.log.warn(e);
			});

			this.socket.on("close", () => {
				this.log.warn(`Lobby manager closed!`);
				this.socketOpen = false;
				this.createManagerProcess();
			});

			this.socket.on("message", (m) => this.handleLobbyMessage(m.toString()));
		});

		this.server.on("error", (e) => this.log.error(e));
	}

	createManagerProcess() {
		this.log.info(`Creating lobby manager process`);
		const manager = spawn(`${process.cwd()}/../../VtolLobbyManager/bin/Debug/net5.0/VtolLobbyManager`);
		manager.stdout.on("data", (chunk) => {
			// this.log.info("Lobby Manager: " + chunk.toString().trim());
		});
		manager.on("spawn", () => {
			this.log.info(`VTOL lobby manager has started! Waiting for websocket connection.`);
		});
	}

	handleLobbyMessage(message: string) {

	}
}

export { Application };