module.exports = {
  customIdPrefix: "approve_message:",

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

    await interaction.deferUpdate();

    await delivery.dmCivOwnerById({
      targetCivId: pending.to_civ,
      body: pending.body
    });

    await rateLimiter.recordSend(pending.from_civ, pending.to_civ, pending.body);
    await db.pendingMessages.markStatus(id, "sent");

    return interaction.editReply({
      content: `✅ Message #${id} approved and sent.`,
      components: []
    });
  }
};