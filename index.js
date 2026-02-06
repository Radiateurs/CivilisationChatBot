const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { token, guildId, gmChannelId } = require("../config.json");
const { loadCommands, registerCommands } = require("./commands/_loader");
const createDb = require("./services/db");
const createDelivery = require("./services/deliveryService");
const rateLimiter = require("./services/rateLimitService");

const db = createDb("../bot.db");
const commands = loadCommands();

console.log("Loaded commands:", [...commands.keys()]);

// ---------- Discord setup ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands(client, commands, token, guildId);
  console.log("Commands registered");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = commands.get(interaction.commandName);
  if (!cmd) {
    interaction.reply({ content: "Unrecognized command... Try something else!", ephemeral: true })
  };

  const delivery = createDelivery({
    client,
    guildId,
    gmMailboxChannelId: gmChannelId,
    db
  });

  await cmd.execute(interaction, { db, rateLimiter, delivery });
});

client.login(token);
