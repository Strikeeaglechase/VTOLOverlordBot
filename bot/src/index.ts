import { Intents, IntentsString } from "discord.js";
import { config as dotenvConfig } from "dotenv";
import FrameworkClient from "strike-discord-framework";
import { FrameworkClientOptions } from "strike-discord-framework/dist/interfaces";
import { Application } from "./application.js";
dotenvConfig();


const frameworkOptions: FrameworkClientOptions = {
	commandsPath: `${process.cwd()}/commands/`,
	databaseOpts: {
		databaseName: process.env.DB_NAME + (process.env.IS_DEV == "true" ? "-dev" : ""),
		url: process.env.DB_URL
	},
	loggerOpts: {
		filePath: `${process.cwd()}/../logs/`,
		logChannels: {
			INFO: process.env.LOG_CHANNEL,
			ERROR: process.env.ERR_CHANNEL,
			WARN: process.env.ERR_CHANNEL
		},
		logToFile: true
	},
	clientOptions: {
		intents: Object.keys(Intents.FLAGS) as IntentsString[],
		partials: ["CHANNEL", "MESSAGE"]
	},
	defaultPrefix: "$",
	name: "ATCBot2",
	token: process.env.TOKEN,
	ownerID: "272143648114606083",
	dmPrefixOnPing: true,
	dmErrorSilently: false,
	permErrorSilently: false,
};


const frameClient = new FrameworkClient(frameworkOptions);
async function init() {
	const application = new Application(frameClient);
	await frameClient.init(application);
	await frameClient.loadBotCommands(`${process.cwd()}/../node_modules/strike-discord-framework/dist/defaultCommands/`);
	await frameClient.permissions.setPublic("command.misc", true);

	await application.init();
	process.on("unhandledRejection", (error) => {
		application.log.error(error);
	});
	process.on("uncaughtException", (error) => {
		application.log.error(error);
	});
}
init();