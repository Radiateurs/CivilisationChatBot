const { SlashCommandBuilder } = require("discord.js");

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const units = [
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["min", 60],
    ["sec", 1],
  ];

  const parts = [];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count > 0) {
      parts.push(`${count} ${name}${count === 1 ? "" : "s"}`);
      seconds -= count * size;
    }
    if (parts.length >= 2) break; // keep it short (e.g. "1 day 3 hours")
  }

  return parts.length ? parts.join(" ") : "0 sec";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("diplomacy")
        .setDescription("List known civilizations and messaging cadence you have with them."),

    async execute(interaction, { db }) {
        if (interaction.commandName === "diplomacy") {
            const player = await db.players.getByUserId(interaction.user.id);
            if (!player || !player.civ_id) {
                return interaction.reply({ content: "You are not registered to a civilization yet.", ephemeral: true });
            }

            // Rules for any pair involving player's civ
            const rows = await new Promise((resolve, reject) => {
                db.raw.all(
                    `
                    SELECT
                        pr.interval_seconds,
                        pr.max_messages,
                        pr.window_type,
                        cs.id AS civ_small_id,
                        cs.name AS civ_small_name,
                        cl.id AS civ_large_id,
                        cl.name AS civ_large_name
                    FROM pair_rules pr
                    JOIN civs cs ON cs.id = pr.civ_small
                    JOIN civs cl ON cl.id = pr.civ_large
                    WHERE pr.civ_small = ? OR pr.civ_large = ?
                    ORDER BY
                        pr.interval_seconds ASC,
                        (CASE WHEN pr.civ_small = ? THEN cl.name ELSE cs.name END) COLLATE NOCASE ASC
                    `,
                    [player.civ_id, player.civ_id, player.civ_id],
                    (err, rows) => (err ? reject(err) : resolve(rows))
                );
            });

            if (!rows.length) {
                return interaction.reply({
                    content: `No diplomacy rules found for **${player.civ_name ?? "your civilization"}** yet.`,
                    ephemeral: true
                });
            }

            const lines = rows.map(r => {
                const otherName = (r.civ_small_id === player.civ_id) ? r.civ_large_name : r.civ_small_name;
                const cadence = `${r.max_messages} msg / ${formatDuration(r.interval_seconds)}`;
                const model = r.window_type ? ` (${r.window_type})` : "";
                return `• **${otherName}** — ${cadence}${model}`;
            });

            // Keep under Discord message limits; trim if huge
            const header = `📜 **Diplomacy for ${player.civ_name ?? "your civilization"}**\n`;
            const body = lines.slice(0, 40).join("\n");
            const footer = lines.length > 40 ? `\n…and ${lines.length - 40} more.` : "";

            return interaction.reply({
                content: header + body + footer,
                ephemeral: true
            });
        }
    }
};