const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("whoami")
    .setDescription("Shows your civilization (only you can see it)."),

  async execute(interaction, { db }) {
    const player = await db.players.getByUserId(interaction.user.id);
    if (!player) {
      return interaction.reply({ content: "You are not registered yet.", ephemeral: true });
    }
    return interaction.reply({
      content: `You are **${player.civ_name}**.`,
      ephemeral: true
    });
  }
};