const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_addciv")
    .setDescription("[GM] Create a civilization.")
    .addStringOption(o =>
      o.setName("name").setDescription("Civilization name").setRequired(true)
    ),

  async execute(interaction, { db }) {
    const player = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(player, interaction)) return;

    const name = interaction.options.getString("name", true);

    db.raw.run(
      `INSERT INTO civs(name) VALUES(?)`,
      [name],
      (err) => {
        if (err) {
          return interaction.reply({
            content: `Error: ${err.message}`,
            ephemeral: true
          });
        }
        interaction.reply({
          content: `Created civilization **${name}**.`,
          ephemeral: true
        });
      }
    );
  }
};
