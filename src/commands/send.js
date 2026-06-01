const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

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

    const pending = await db.pendingMessages.create({
      fromCiv: player.civ_id,
      toCiv: target.id,
      senderUserId: interaction.user.id,
      body
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_message:${pending.id}`)
        .setLabel("Approve & Send")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`edit_message:${pending.id}`)
        .setLabel("Edit & Send")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`reject_message:${pending.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
    );

    await delivery.postToGmMailbox({
      title: `Pending diplomatic message #${pending.id}`,
      content:
        `**From Civ:** ${player.civ_name}\n` +
        `**To Civ:** ${target.name}\n` +
        `**Sender:** ${interaction.user.displayName || interaction.user.username}\n\n` +
        `**Message:**\n> ${body}`,
      components: [row]
    });

    return interaction.reply({
      content: "📨 Your diplomatic message has been submitted to the GM for review.",
      ephemeral: true
    });
  }
};
