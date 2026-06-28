module.exports = {
  customIdPrefix: "reject_message:",

  async execute(interaction, { db }) {
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

    await db.pendingMessages.markStatus(id, "rejected");

    return interaction.editReply({
      content: `❌ Message #${id} rejected.`,
      components: []
    });
  }
};