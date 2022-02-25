import FrameworkClient from "strike-discord-framework";
import Logger from "strike-discord-framework/dist/logger";
import { WebSocket, WebSocketServer } from "ws";
import { spawn } from "child_process";
import { MessageEmbed, TextChannel } from "discord.js";
import { CollectionManager } from "strike-discord-framework/dist/collectionManager";

enum GameState {
	mission = "Mission",
	briefing = "Briefing"
}

interface LobbyDataMessage {
	lobbies: RawLobby[];
}

interface RawLobby {
	lobbyName: string;
	ownerName: string;
	ownerId: string;
	scenarioName: string;
	scenarioId: string;
	maxPlayers: string;
	feature: string;
	envIdx: string;
	gameVersion: string;
	briefingRoom: string;
	passwordHash: string;
	ld_GameState: string;
	mUtc: null;
	playerCount: number;
}

interface Lobby {
	name: string;
	ownerName: string;
	ownerId: string;
	scenarioName: string;
	scenarioId: string;
	maxPlayers: number,
	gameVersion: string,
	gameState: GameState,
	playerCount: number,
}

const missions = [
	"F/A-26B Naval Strike Mission",
	"F-45 Cooperative Mission",
	"Free Flight / Airshow",
	"Urban Liberation",
	"A2A BVR Combat",
	"Arctic Assault",
	"Midnight Assassin"
];

function parseRawLobby(lobby: RawLobby): Lobby {
	let gameState: GameState;

	switch (lobby.ld_GameState) {
		case "Mission": gameState = GameState.mission; break;
		case "Briefing": gameState = GameState.briefing; break;
	}

	return {
		name: lobby.lobbyName,
		ownerName: lobby.ownerName,
		ownerId: lobby.ownerId,
		scenarioName: lobby.scenarioName,
		scenarioId: lobby.scenarioId,
		maxPlayers: parseInt(lobby.maxPlayers),
		gameVersion: lobby.gameVersion,
		gameState: gameState,
		playerCount: lobby.playerCount,
	};
}

function parseGameVersion(ver: string) {
	if (ver.includes("m"))
		return "Modded";
	if (ver.includes("p"))
		return "Public Testing";
	return "Stable";
}

interface MessageLocator {
	id: string;
	channel: string;
	guild: string;
}

const PORT = 38560;
class Application {
	public log: Logger;
	private server: WebSocketServer;
	private socket: WebSocket;

	private lobbies: Lobby[] = [];
	public displayMessages: CollectionManager<string, MessageLocator>;

	constructor(private framework: FrameworkClient) {
		this.log = framework.log;
	}

	async init() {
		this.server = new WebSocketServer({ port: PORT });
		this.displayMessages = await this.framework.database.collection("messages", false, "id");

		this.server.on("listening", () => {
			this.log.info(`Websocket server listening on ${PORT}`);
			this.createManagerProcess();
		});

		this.server.on("connection", (socket) => {
			this.log.info(`New socket connection established`);
			this.socket = socket;

			this.socket.on("error", (e) => {
				this.log.warn(`Lobby manager process returned an error`);
				this.log.warn(e);
			});

			this.socket.on("close", () => {
				this.log.warn(`Lobby manager closed!`);
				this.createManagerProcess();
			});

			this.socket.on("message", (m) => this.handleLobbyMessage(m.toString()));

			let intv = setInterval(() => {
				if (socket.readyState != socket.OPEN) clearInterval(intv);
				else socket.send("ping");
			}, 1000);
		});

		this.server.on("error", (e) => this.log.error(e));
	}

	createManagerProcess() {
		this.log.info(`Creating lobby manager process`);
		const manager = spawn(`${process.cwd()}/../../VtolLobbyManager/bin/Debug/net5.0/VtolLobbyManager`);
		manager.stdout.on("data", (chunk) => {
			this.log.info("Lobby Manager: " + chunk.toString().trim());
		});
		manager.on("spawn", () => {
			this.log.info(`VTOL lobby manager has started! Waiting for websocket connection.`);
		});
	}

	handleLobbyMessage(message: string) {
		if (!message || message.length < 2) return this.log.info(`Got invalid message from lobby manager: ${message}`);
		const data = JSON.parse(message) as LobbyDataMessage;
		this.lobbies = data.lobbies.map(l => parseRawLobby(l));
		this.updateLobbyData();
	}

	async updateLobbyData() {
		// const channel = await this.framework.client.channels.fetch("946514347067330591") as TextChannel;
		// await channel.send({ embeds: [this.makeLobbiesEmbed()] });
		const emb = this.makeLobbiesEmbed();
		const messageLocators = await this.displayMessages.get();
		const proms = messageLocators.map(async mloc => {
			const guild = await this.framework.client.guilds.fetch(mloc.guild);
			const channel = guild?.channels.cache.get(mloc.channel) as TextChannel;
			const message = await channel?.messages.fetch(mloc.id);
			if (!message) {
				this.log.error(`Unable to resolve message. mloc: ${JSON.stringify(mloc)}`);
				await this.displayMessages.remove(mloc.id);
			} else {
				await message.edit({ embeds: [emb] });
			}
		});

		await Promise.all(proms);
	}

	makeLobbiesEmbed(): MessageEmbed {
		const emb = new MessageEmbed({
			title: "VTOL VR Lobbies:"
		});

		this.lobbies.sort((a, b) => b.playerCount - a.playerCount).forEach(lobby => {
			emb.addField(lobby.name, this.lobbyToString(lobby), true);
		});

		emb.setTimestamp();

		return emb;
	}

	makeLobbiesEmbedOldCringWayThatImNotUsingBecauseIGotBullied(): MessageEmbed {
		const emb = new MessageEmbed({
			title: "Lobbies"
		});

		const lobbyMissionMap: Record<string, Lobby[]> = {};
		missions.forEach(type => lobbyMissionMap[type] = []);
		lobbyMissionMap["Custom"] = [];

		this.lobbies.forEach(lobby => {
			if (missions.includes(lobby.scenarioName)) lobbyMissionMap[lobby.scenarioName].push(lobby);
			else lobbyMissionMap["Custom"].push(lobby);
		});
		Object.keys(lobbyMissionMap).forEach(mission => {
			if (lobbyMissionMap[mission].length > 0) {
				const str = lobbyMissionMap[mission]
					.sort((a, b) => b.playerCount - a.playerCount)
					.map(l => this.lobbyToStringOldCringWayThatImNotUsingBecauseIGotBullied(l))
					.join("\n");

				emb.addField(mission, str);
			}
		});

		return emb;
	}

	lobbyToString(lobby: Lobby): string {
		return `Host: ${lobby.ownerName}\n${lobby.scenarioName}\n${lobby.playerCount}/${lobby.maxPlayers} Players\n${lobby.gameState}\n${lobby.gameVersion}`;
	}

	lobbyToStringOldCringWayThatImNotUsingBecauseIGotBullied(lobby: Lobby): string {
		let str = `**${lobby.name}** hosted by ${lobby.ownerName} (${lobby.playerCount}/${lobby.maxPlayers})`;
		if (parseGameVersion(lobby.gameVersion) != "Stable") str += ` on ${parseGameVersion(lobby.gameVersion)} branch`;
		if (!missions.includes(lobby.scenarioName)) str += ` __${lobby.scenarioName}__`;
		return str;
	}
}

export { Application };