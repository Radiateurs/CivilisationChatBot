const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_claim")
    .setDescription("Claim GM role (only works if no GM exists yet)"),

  async execute(interaction, { db }) {
    const existing = await new Promise((resolve, reject) => {
      db.raw.get(
        `SELECT user_id FROM players WHERE role = 'gm' LIMIT 1`,
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (existing) {
      return interaction.reply({
        content: "❌ A GM already exists. Only a GM can assign new GMs.",
        ephemeral: true
      });
    }

    await new Promise((resolve, reject) => {
      db.raw.run(
        `INSERT INTO players(user_id, civ_id, role)
         VALUES(?, -1, 'gm')
         ON CONFLICT(user_id) DO UPDATE SET role = 'gm'`,
        [interaction.user.id],
        (err) => err ? reject(err) : resolve()
      );
    });

    return interaction.reply({
      content: "👑 You are now the Game Master.",
      ephemeral: true
    });
  }
};
