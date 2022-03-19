import { Arg, CommandRun } from "strike-discord-framework/dist/argumentParser";
import { Command, CommandEvent } from "strike-discord-framework/dist/command.js";
import { Application } from "../../application.js";

class Create extends Command {
	name = "create";
	help = {
		msg: "Creates a new display message. Specify version to limit to only some types of lobbies (ie `m` for modded)",
		usage: "<version>"
	};
	allowDM = false;

	@CommandRun
	async run({ message, framework, app }: CommandEvent<Application>, @Arg({ optional: true }) limitVersions: string) {
		if (!message.member.permissions.has("ADMINISTRATOR")) {
			return framework.error(`Only an administrator can run this command`);
		}

		const existing = await app.displayMessages.collection.findOne({ guild: message.guild.id });
		if (existing) {
			const conf = await framework.utils.reactConfirm(`A display message already exists in <#${existing.channel}>, would you like to overwrite it?`, message);
			if (!conf) return;
			await app.displayMessages.remove(existing.id);
		}

		const msg = await message.channel.send({ embeds: [{ title: "VTOL VR Lobbies:" }] });
		await app.displayMessages.add({

			id: msg.id,
			channel: msg.channel.id,
			guild: msg.guild.id
		});

		await message.delete().catch(() => { });
	}
}
export default Create;