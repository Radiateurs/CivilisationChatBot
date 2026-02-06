const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("gm_addplayer")
        .setDescription("[GM] Assign a player to a civilization.")
        .addUserOption(o =>
            o.setName("user").setDescription("Player").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("civ").setDescription("Civilization name").setRequired(true)
        ),

    async execute(interaction, { db }) {
        const gm = await db.players.getByUserId(interaction.user.id);
        if (!requireGM(gm, interaction)) return;

        const user = interaction.options.getUser("user", true);
        const civName = interaction.options.getString("civ", true);

        let civ = await db.civs.getByName(civName);
        if (!civ) {
            try {
                civ = await db.civs.createCiv(civName);
            } catch {
                return interaction.reply({
                    content: `Error: ${err.message}`,
                    ephemeral: true
                });
            }
        }

        db.raw.run(
            `INSERT INTO players(user_id, civ_id, role)
       VALUES(?, ?, 'player')
       ON CONFLICT(user_id) DO UPDATE SET civ_id = excluded.civ_id`,
            [user.id, civ.id],
            (err) => {
                if (err) {
                    return interaction.reply({
                        content: `Error: ${err.message}`,
                        ephemeral: true
                    });
                }

                interaction.reply({
                    content: `Assigned ${user.username} to **${civ.name}**.`,
                    ephemeral: true
                });
            }
        );
    }
};
