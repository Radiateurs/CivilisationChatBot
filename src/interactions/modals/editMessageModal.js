module.exports = {
  customIdPrefix: "edit_message_modal:",

  async execute(interaction, { db, rateLimiter, delivery }) {
    const id = Number(interaction.customId.split(":")[1]);

    const gm = await db.players.getByUserId(interaction.user.id);
    if (!gm || gm.role !== "gm") {
      return interaction.reply({ content: "GM only.", flags: 64 });
    }

    const pending = await db.pendingMessages.getById(id);
    if (!pending || pending.status !== "pending") {
      return interaction.reply({
        content: "This message is no longer pending.",
        flags: 64
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const editedBody = interaction.fields.getTextInputValue("message");

    await delivery.dmCivOwnerById({
      targetCivId: pending.to_civ,
      body: editedBody
    });

    await rateLimiter.recordSend(pending.from_civ, pending.to_civ, editedBody);
    await db.pendingMessages.markStatus(id, "sent_modified");

    return interaction.editReply({
      content: `✅ Edited message #${id} sent.`
    });
  }
};