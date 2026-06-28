const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_removeplayer")
    .setDescription("[GM] Remove a player from the roster.")
    .addUserOption(o =>
      o.setName("user").setDescription("Player to remove").setRequired(true)
    ),

  async execute(interaction, { db }) {
    const gm = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(gm, interaction)) return;

    const targetUser = interaction.options.getUser("user", true);

    await new Promise((resolve, reject) => {
      db.raw.run(
        `DELETE FROM players WHERE user_id = ?`,
        [targetUser.id],
        (err) => (err ? reject(err) : resolve())
      );
    });

    return interaction.reply({
      content: `Removed **${targetUser.username}** from the roster.`,
      ephemeral: true
    });
  }
};
