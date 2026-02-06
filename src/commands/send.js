const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("send")
        .setDescription("Send an anonymous diplomatic message to another civilization.")
        .addStringOption(o => o.setName("civ").setDescription("Target civilization name").setRequired(true))
        .addStringOption(o => o.setName("message").setDescription("Message text").setRequired(true)),

    async execute(interaction, { db, rateLimiter, delivery }) {
        const player = await db.players.getByUserId(interaction.user.id);
        if (!player) {
            return interaction.reply({ content: "You are not registered yet.", ephemeral: true });
        }
        if (!player.civ_id) {
            return interaction.reply({ content: "You are not assigned to a civilization yet.", ephemeral: true });
        }

        const targetName = interaction.options.getString("civ", true);
        const body = interaction.options.getString("message", true);

        const target = await db.civs.getByName(targetName);
        if (!target) {
            return interaction.reply({ content: "Unknown target civilization.", ephemeral: true });
        }
        if (target.id === player.civ_id) {
            return interaction.reply({ content: "You can't message your own civilization.", ephemeral: true });
        }

        const allowed = await rateLimiter.canSend(player.civ_id, target.id);
        if (!allowed.ok) {
            return interaction.reply({ content: allowed.reason, ephemeral: true });
        }

        // Deliver (DM owner or fallback to GM mailbox)
        const delivered = await delivery.dmCivOwnerOrMailbox({
            targetCivId: target.id,
            targetCivName: target.name,
            fromCivName: player.civ_name || `civ_id=${player.civ_id}`,
            fromDiscordName: interaction.user.displayName || interaction.user.username,
            body
        });

        // IMPORTANT: Keep your current behavior:
        // - If DM fails, you currently do NOT record the send (because you reply with failure).
        // We'll match that: record only on success.
        if (!delivered.ok) {
            if (delivered.reason === "NO_OWNER") {
                return interaction.reply({ content: "🤔 It appears this civilization doesn't have a letterbox....", ephemeral: true });
            }
            return interaction.reply({ content: "💀 It appears your messenger did not made it to its destination...", ephemeral: true });
        }

        await rateLimiter.recordSend(player.civ_id, target.id, body);
        return interaction.reply({ content: `Sent anonymously to **${target.name}**.`, ephemeral: true });
    }
};
