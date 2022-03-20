import { Arg, CommandRun } from "strike-discord-framework/dist/argumentParser.js";
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

		const existing = await app.configs.collection.findOne({ id: message.guild.id });
		if (existing) {
			const conf = await framework.utils.reactConfirm(`A display message already exists in <#${existing.channel}>, would you like to overwrite it?`, message);
			if (!conf) return;
			await app.configs.remove(existing.id);
		}
		if (!limitVersions) limitVersions = 'fpm';
		await app.configs.add({
			id: message.guild.id,
			messages: { f: null, p: null, m: null },
			channel: message.channel.id,
			shownTypes: limitVersions
		});

		await message.delete().catch(() => { });
		const tempM = await message.channel.send(framework.success(`Message will be created in <30 seconds`));
		await new Promise(res => setTimeout(res, 2500));
		await tempM.delete();
	}
}
export default Create;