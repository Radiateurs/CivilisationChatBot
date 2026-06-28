const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function getCivByName(db, name) {
  return new Promise((resolve, reject) => {
    db.raw.get(
      `SELECT id, name FROM civs WHERE LOWER(name) = LOWER(?)`,
      [name],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_removerule")
    .setDescription("[GM] Remove the diplomacy rule between two civilizations.")
    .addStringOption(o =>
      o.setName("civ1").setDescription("Civilization 1").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("civ2").setDescription("Civilization 2").setRequired(true)
    ),

  async execute(interaction, { db }) {
    const gm = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(gm, interaction)) return;

    const civ1Name = interaction.options.getString("civ1", true);
    const civ2Name = interaction.options.getString("civ2", true);

    const [civ1, civ2] = await Promise.all([
      getCivByName(db, civ1Name),
      getCivByName(db, civ2Name)
    ]);

    if (!civ1 || !civ2) {
      return interaction.reply({
        content: "Unknown civilization name(s).",
        ephemeral: true
      });
    }

    const [small, large] = canonicalPair(civ1.id, civ2.id);

    await new Promise((resolve, reject) => {
      db.raw.run(
        `DELETE FROM pair_rules WHERE civ_small = ? AND civ_large = ?`,
        [small, large],
        (err) => (err ? reject(err) : resolve())
      );
    });

    return interaction.reply({
      content: `Removed the diplomacy rule between **${civ1.name}** and **${civ2.name}**.`,
      ephemeral: true
    });
  }
};
