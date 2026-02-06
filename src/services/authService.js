module.exports = {
  requireGM(player, interaction) {
    if (!player || player.role !== "gm") {
      interaction.reply({ content: "GM only.", ephemeral: true });
      return false;
    }
    return true;
  }
};
