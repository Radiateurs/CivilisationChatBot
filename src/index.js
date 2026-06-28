const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { token, guildId, gmChannelId } = require("../config.json");
const { loadCommands, registerCommands } = require("./commands/_loader");
const { loadInteractionHandlers, findHandler } = require("./interactions/_loader");
const createDb = require("./services/db");
const createDelivery = require("./services/deliveryService");
const createRateLimiter = require("./services/rateLimitService");
const db = createDb("../bot.db");
const commands = loadCommands();
const interactionHandlers = loadInteractionHandlers();
const rateLimiter = createRateLimiter(db);

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
  const delivery = createDelivery({
    client,
    guildId,
    gmMailboxChannelId: gmChannelId,
    db
  });

  const ctx = {
    db,
    rateLimiter,
    delivery,
    client,
    config: { guildId, gmChannelId }
  };

  try {
    if (interaction.isButton()) {
      const handler = findHandler(interactionHandlers.buttons, interaction.customId);
      if (!handler) return;

      return handler.execute(interaction, ctx);
    }

    if (interaction.isModalSubmit()) {
      const handler = findHandler(interactionHandlers.modals, interaction.customId);
      if (!handler) return;

      return handler.execute(interaction, ctx);
    }

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      return command.execute(interaction, ctx);
    }
  } catch (e) {
    console.error(e);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }

});

client.login(token);
