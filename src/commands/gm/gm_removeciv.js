const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

function runDelete(db, query, params) {
  return new Promise((resolve, reject) => {
    db.raw.run(query, params, (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_removeciv")
    .setDescription("[GM] Remove a civilization and its related data.")
    .addStringOption(o =>
      o.setName("name").setDescription("Civilization name").setRequired(true)
    ),

  async execute(interaction, { db }) {
    const gm = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(gm, interaction)) return;

    const name = interaction.options.getString("name", true);

    const civ = await new Promise((resolve, reject) => {
      db.raw.get(
        `SELECT id, name FROM civs WHERE LOWER(name) = LOWER(?)`,
        [name],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!civ) {
      return interaction.reply({
        content: `No civilization named **${name}** was found.`,
        ephemeral: true
      });
    }

    await runDelete(db, `DELETE FROM players WHERE civ_id = ?`, [civ.id]);
    await runDelete(db, `DELETE FROM pair_rules WHERE civ_small = ? OR civ_large = ?`, [civ.id, civ.id]);
    await runDelete(db, `DELETE FROM pair_usage WHERE from_civ = ? OR to_civ = ?`, [civ.id, civ.id]);
    await runDelete(db, `DELETE FROM messages WHERE from_civ = ? OR to_civ = ?`, [civ.id, civ.id]);
    await runDelete(db, `DELETE FROM pending_messages WHERE from_civ = ? OR to_civ = ?`, [civ.id, civ.id]);
    await runDelete(db, `DELETE FROM civs WHERE id = ?`, [civ.id]);

    return interaction.reply({
      content: `Removed civilization **${civ.name}** and its related data.`,
      ephemeral: true
    });
  }
};
