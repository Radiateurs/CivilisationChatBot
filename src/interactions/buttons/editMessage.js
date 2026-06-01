const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

module.exports = {
  customIdPrefix: "edit_message:",

  async execute(interaction, { db }) {
    const id = Number(interaction.customId.split(":")[1]);

    const gm = await db.players.getByUserId(interaction.user.id);
    if (!gm || gm.role !== "gm") {
      return interaction.reply({ content: "GM only.", ephemeral: true });
    }

    const pending = await db.pendingMessages.getById(id);
    if (!pending || pending.status !== "pending") {
      return interaction.reply({
        content: "This message is no longer pending.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`edit_message_modal:${id}`)
      .setTitle(`Edit message #${id}`);

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Diplomatic message")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(pending.body)
      .setRequired(true)
      .setMaxLength(1800);

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput)
    );

    return interaction.showModal(modal);
  }
};