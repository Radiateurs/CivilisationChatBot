const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_setrule")
    .setDescription("[GM] Set diplomacy cadence between two civilizations.")
    .addStringOption(o =>
      o.setName("civ1").setDescription("Civilization 1").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("civ2").setDescription("Civilization 2").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("interval_seconds")
        .setDescription("Seconds between messages (e.g. 86400)")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("max_messages")
        .setDescription("Usually 1")
        .setRequired(true)
    ),

  async execute(interaction, { db }) {
    const gm = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(gm, interaction)) return;

    const civ1 = await db.civs.getByName(interaction.options.getString("civ1", true));
    const civ2 = await db.civs.getByName(interaction.options.getString("civ2", true));

    if (!civ1 || !civ2) {
      return interaction.reply({
        content: "Unknown civilization name(s).",
        ephemeral: true
      });
    }

    const interval = interaction.options.getInteger("interval_seconds", true);
    const max = interaction.options.getInteger("max_messages", true);
    const [small, large] = canonicalPair(civ1.id, civ2.id);

    db.raw.run(
      `INSERT INTO pair_rules(civ_small, civ_large, interval_seconds, max_messages, window_type)
       VALUES(?, ?, ?, ?, 'cooldown')
       ON CONFLICT(civ_small, civ_large)
       DO UPDATE SET
         interval_seconds = excluded.interval_seconds,
         max_messages = excluded.max_messages`,
      [small, large, interval, max],
      (err) => {
        if (err) {
          return interaction.reply({
            content: `Error: ${err.message}`,
            ephemeral: true
          });
        }

        interaction.reply({
          content:
            `Rule set for **${civ1.name} ↔ ${civ2.name}**: ` +
            `${max} msg / ${interval}s (cooldown).`,
          ephemeral: true
        });
      }
    );
  }
};
