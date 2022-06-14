import FrameworkClient from "strike-discord-framework";
import Logger from "strike-discord-framework/dist/logger";
import { WebSocket, WebSocketServer } from "ws";
import { spawn } from "child_process";
import { Channel, Message, MessageEmbed, TextChannel } from "discord.js";
import { CollectionManager } from "strike-discord-framework/dist/collectionManager";

enum GameState {
	mission = "Mission",
	briefing = "Briefing",
	debrief = "Debrief"
}

interface LobbyDataMessage {
	lobbies: RawLobby[];
}

interface PlayerLobbyMessage {
	steamId: string;
	name: string;
	lobbyId: string;
	lobbyName: string;
	lobbyMission: string;
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
	modCount: string;
	loadedMods: string;
	id: string;
}

interface Lobby {
	name: string;
	ownerName: string;
	ownerId: string;
	scenarioName: string;
	scenarioId: string;
	maxPlayers: number;
	gameVersion: string;
	gameState: GameState;
	playerCount: number;
	modCount: number;
	loadedMods: string[];
	startedAt: Date;
	id: string;
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
		case "Debrief": gameState = GameState.debrief; break;
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
		modCount: lobby.modCount ? parseInt(lobby.modCount) : 0,
		loadedMods: lobby.loadedMods ? lobby.loadedMods.split(",") : [],
		startedAt: new Date(lobby.mUtc),
		id: lobby.id,
	};
}

function parseGameVersion(ver: string) {
	if (ver.includes("m"))
		return "Modded";
	if (ver.includes("p"))
		return "Public Testing";
	return "Stable";
}

type VTOLVersion = "f" | "p" | "m";
const names: Record<VTOLVersion, string> = {
	"f": "Stable",
	"p": "Public Testing",
	"m": "Modded"
};
interface ServerDisplayConfig {
	messages: Record<VTOLVersion, MessageLocator | null>;
	shownTypes: string;
	channel: string;
	id: string;
}

interface MessageLocator {
	id: string;
	channel: string;
	guild: string;
}

interface PlayerStalkConfig {
	guildId: string;
	channelId: string;
	steamId: string;
}

function isLobbyDataMessage(value: any): value is LobbyDataMessage {
	return value.lobbies != null && Array.isArray(value.lobbies);
}

class Application {
	public log: Logger;
	private server: WebSocketServer;
	private socket: WebSocket;

	public lobbies: Lobby[] = [];
	public prevLobbies: Lobby[] = [];
	// public displayMessages: CollectionManager<string, MessageLocator>;
	public configs: CollectionManager<string, ServerDisplayConfig>;
	public stalks: CollectionManager<string, PlayerStalkConfig>;
	public lobbyHistory: CollectionManager<string, Lobby>;

	lastKnownLocations: Record<string, string> = {};

	constructor(private framework: FrameworkClient) {
		this.log = framework.log;
	}

	async init() {
		const port = parseInt(process.env.PORT);
		const displayMessages = await this.framework.database.collection<string, MessageLocator>("messages", false, "id");
		this.lobbyHistory = await this.framework.database.collection("lobbies", false, "id");
		this.configs = await this.framework.database.collection("configs", false, "id");
		this.stalks = await this.framework.database.collection("stalks", false, "channelId");

		this.server = new WebSocketServer({ port: port });

		this.server.on("listening", () => {
			this.log.info(`Websocket server listening on ${port}`);
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

		// Migrate old configs
		const messages = await displayMessages.get();
		messages.map(async msg => {
			const existing = await this.configs.get(msg.guild);
			if (existing) {
				this.log.info(`Skipping config migration as ${msg.guild} already has a new one!`);
				return;
			}

			this.log.info(`Migrating config for ${msg.guild} (channel: ${msg.channel} msg: ${msg.id})`);
			const config: ServerDisplayConfig = {
				id: msg.guild,
				messages: { "f": msg, "m": null, p: null },
				channel: msg.channel,
				shownTypes: "fpm"
			};
			this.configs.add(config);
		});

		this.server.on("error", (e) => this.log.error(e));
	}

	createManagerProcess() {
		this.log.info(`Creating lobby manager process`);
		const manager = spawn(`${process.cwd()}/../../VtolLobbyManager/bin/Debug/net5.0/VtolLobbyManager`);
		manager.stdout.on("data", (chunk) => {
			this.log.info("Lobby Manager: " + chunk.toString().trim());
		});
		manager.stderr.on("data", (chunk) => {
			this.log.info("Lobby Manager: " + chunk.toString().trim());
		});
		manager.on("spawn", () => {
			this.log.info(`VTOL lobby manager has started! Waiting for websocket connection.`);
		});
	}

	compareLobbies(a: Lobby, b: Lobby) {
		return JSON.stringify(a) == JSON.stringify(b);
	}

	handleLobbyMessage(message: string) {
		if (!message || message.length < 2) return this.log.info(`Got invalid message from lobby manager: ${message}`);
		const data = JSON.parse(message) as LobbyDataMessage | PlayerLobbyMessage;
		if (isLobbyDataMessage(data)) {
			this.lobbies = data.lobbies.map(l => parseRawLobby(l));

			this.lobbies.forEach(lobby => {
				const old = this.prevLobbies.find(pl => pl.id == lobby.id);
				if (!old || !this.compareLobbies(old, lobby)) {
					this.lobbyHistory.add(lobby);
				}
			});
			this.prevLobbies = [...this.lobbies];
			this.updateLobbyData();
		} else {
			this.handlePlayerLobbyMessage(data);
		}

	}

	async handlePlayerLobbyMessage(message: PlayerLobbyMessage) {
		if (this.lastKnownLocations[message.steamId] == message.lobbyId) return;

		const stalkedPlayers = await this.stalks.get();
		const notifs = stalkedPlayers.filter(p => p.steamId == message.steamId);
		if (notifs.length == 0) return;

		this.log.info(`Found ${message.name} in ${message.lobbyName} playing ${message.lobbyMission}`);
		this.lastKnownLocations[message.steamId] = message.lobbyId;

		const emb = new MessageEmbed({
			title: `${message.name} found!`,
			description: `${message.name} is currently playing in the lobby called "${message.lobbyName}" doing ${message.lobbyMission}`
		});
		notifs.forEach(async notif => {
			const guild = this.framework.client.guilds.resolve(notif.guildId);
			if (!guild) return;
			const channel = await guild.channels.fetch(notif.channelId).catch(() => { });
			if (!channel) return;
			await (channel as TextChannel).send({ embeds: [emb] });
		});
	}

	async updateLobbyData() {
		const configs = await this.configs.get();
		const proms = configs.map(async config => {
			const guild = await this.framework.client.guilds.fetch(config.id).catch(() => { });

			if (!guild) {
				this.log.error(`Unable to resolve message. mloc: ${JSON.stringify(config)}`);
				await this.configs.remove(config.id);
				return;
			}

			config.shownTypes.split("").forEach(async (type: VTOLVersion) => {
				const emb = this.makeLobbiesEmbed(type);
				const channel = guild.channels.cache.get(config.channel) as TextChannel;
				if (!channel) return;
				if (!config.messages[type]) {
					// Create new message
					const msg = await channel.send({ embeds: [emb] });
					config.messages[type] = {
						id: msg.id,
						channel: channel.id,
						guild: channel.guild.id
					};

					await this.configs.update(config, config.id);
				} else {
					const message = await channel?.messages.fetch(config.messages[type].id).catch(() => { });
					if (!message) {
						this.log.error(`Unable to resolve message. config: ${JSON.stringify(config)}`);
						config.messages[type] = null;
						await this.configs.update(config, config.id);
					} else {
						try {
							await message.edit({ embeds: [emb] });
						} catch (e) {
							this.log.error(`Unable to edit message!`);
							this.log.error(e);
						}
					}
				}
			});
		});

		await Promise.all(proms);
	}

	makeLobbiesEmbed(type: VTOLVersion): MessageEmbed {
		const emb = new MessageEmbed({
			title: `VTOL VR ${names[type]} Lobbies:`
		});

		this.lobbies
			.filter(l => l.gameVersion.includes(type))
			.sort((a, b) => b.playerCount - a.playerCount)
			.forEach((lobby, idx) => {
				if (lobby.name && lobby.name.length > 1) {
					let safeName = lobby.name.trim().length > 0 ? lobby.name.trim() : "<name empty>";
					emb.addField(safeName, this.lobbyToString(lobby), true);
				}
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
		const duration = new Date(Date.now() - lobby.startedAt.getTime());
		const pad = (v: number) => v.toString().length > 1 ? v.toString() : '0' + v.toString();
		const time = lobby.gameState == GameState.mission ? `(${duration.getUTCHours()}:${pad(duration.getMinutes())})` : "";
		let str = `Host: ${lobby.ownerName}\n${lobby.scenarioName}\n${lobby.playerCount}/${lobby.maxPlayers} Players\n${lobby.gameState ? lobby.gameState : "Mission"} ${time}\n${lobby.gameVersion}`;
		if (parseGameVersion(lobby.gameVersion) == "Modded") str += ` (${lobby.modCount} mod${lobby.modCount != 1 ? "s" : ""} loaded)`;
		return str;
	}

	lobbyToStringOldCringWayThatImNotUsingBecauseIGotBullied(lobby: Lobby): string {
		let str = `**${lobby.name}** hosted by ${lobby.ownerName} (${lobby.playerCount}/${lobby.maxPlayers})`;
		if (parseGameVersion(lobby.gameVersion) != "Stable") str += ` on ${parseGameVersion(lobby.gameVersion)} branch`;
		if (!missions.includes(lobby.scenarioName)) str += ` __${lobby.scenarioName}__`;
		return str;
	}
}

export { Application, parseGameVersion, PlayerStalkConfig };
