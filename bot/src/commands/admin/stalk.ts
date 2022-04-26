import { Command, CommandEvent } from "strike-discord-framework/dist/command.js";
import { Application, parseGameVersion, PlayerStalkConfig } from "../../application.js";
import { CommandRun } from "strike-discord-framework/dist/argumentParser.js";
import { MessageEmbed } from "discord.js";

class Query extends Command {
	name = "stalk";
	help = {
		msg: "Starts stalking a user and will notify whenever they are online",
		usage: "<steamid>"
	};
	allowDM = false;
	@CommandRun
	async run({ message, framework, app }: CommandEvent<Application>, steamid: string) {
		const stalk: PlayerStalkConfig = {
			channelId: message.channel.id,
			guildId: message.guild.id,
			steamId: steamid
		};
		await app.stalks.add(stalk);
		return framework.success(`A notification will be sent here whenever a user with the steam id ${steamid} is online`);
	}
}
export default Query;