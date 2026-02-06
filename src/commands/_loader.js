const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

function loadCommands(dir = __dirname, commands = new Map()) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadCommands(fullPath, commands);
    } else if (entry.endsWith(".js") && !entry.startsWith("_")) {
      const cmd = require(fullPath);

      if (!cmd?.data?.name || typeof cmd.execute !== "function") {
        console.warn(`[COMMAND LOADER] Skipping invalid command: ${fullPath}`);
        continue;
      }

      if (commands.has(cmd.data.name)) {
        console.warn(`[COMMAND LOADER] Duplicate command name: ${cmd.data.name}`);
        continue;
      }

      commands.set(cmd.data.name, cmd);
    }
  }
  return commands;
}

async function registerCommands(client, commands, token, guildId) {
  const rest = new REST({ version: "10" }).setToken(token);
  const appId = (await client.application.fetch()).id;

  await rest.put(
    Routes.applicationGuildCommands(appId, guildId),
    { body: [...commands.values()].map(c => c.data.toJSON()) }
  );

  console.log(`[COMMAND LOADER] Registered ${commands.size} commands`);
}

module.exports = { loadCommands, registerCommands };
