import { Command, CommandEvent } from "strike-discord-framework/dist/command.js";
import { Application, parseGameVersion } from "../../application.js";
import { CommandRun } from "strike-discord-framework/dist/argumentParser.js";
import { MessageEmbed } from "discord.js";

class Query extends Command {
	name = "query";
	help = {
		msg: "Displays more detailed information about a lobby",
		usage: "<lobby name>"
	};
	allowDM = false;
	@CommandRun
	async run({ message, framework, app }: CommandEvent<Application>, query: string) {
		const lobby = app.lobbies.find(l => l.name.startsWith(query));
		if (!lobby) return framework.error(`Unable to find a lobby with the name "${query}"`);

		const emb = new MessageEmbed({ title: lobby.name });
		emb.addField("Hosted by", `${lobby.ownerName} (${lobby.ownerId})`);
		emb.addField("Running mission", `${lobby.scenarioName} - ${lobby.gameState} (${lobby.scenarioId})`);
		emb.addField("Players", `${lobby.playerCount} of ${lobby.maxPlayers}`);
		emb.addField("Game version", `${parseGameVersion(lobby.gameVersion)} (${lobby.gameVersion})`);
		if (parseGameVersion(lobby.gameVersion) == "Modded") {
			emb.addField(`Mods (${lobby.modCount})`, lobby.loadedMods.join("\n"));
		}
		return emb;
	}
}
export default Query;