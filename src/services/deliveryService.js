async function postToGmMailbox({ client, guildId, gmMailboxChannelId, title, content }) {
  if (!gmMailboxChannelId) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(gmMailboxChannelId);
    if (!channel || !channel.isTextBased()) return;

    await channel.send(`🛑 **${title}**\n${content}`);
  } catch (e) {
    console.warn("[GM MAILBOX] Failed to post:", e?.message || e);
  }
}

module.exports = function createDeliveryService({ client, guildId, gmMailboxChannelId, db }) {
  return {
    postToGmMailbox: (title, content) =>
      postToGmMailbox({ client, guildId, gmMailboxChannelId, title, content }),

    async dmCivOwnerOrMailbox({ targetCivId, targetCivName, fromCivName, fromDiscordName, body }) {
      // owner = first row for civ
      const row = await new Promise((resolve, reject) => {
        db.raw.get(
          `SELECT user_id FROM players WHERE civ_id = ? ORDER BY rowid ASC LIMIT 1`,
          [targetCivId],
          (err, r) => (err ? reject(err) : resolve(r))
        );
      });

      if (!row) {
        await postToGmMailbox({
          client, guildId, gmMailboxChannelId,
          title: "No owner found for target civilization",
          content:
            `**To Civ:** ${targetCivName} (id=${targetCivId})\n` +
            `**From Civ:** ${fromCivName} (${fromDiscordName})\n\n` +
            `**Message:**\n> ${body}`
        });
        return { ok: false, reason: "NO_OWNER" };
      }

      try {
        const user = await client.users.fetch(row.user_id);

        // Optional: always log to GM mailbox (you currently do)
        await postToGmMailbox({
          client, guildId, gmMailboxChannelId,
          title: "Message sent between civilizations",
          content:
            `**To Civ:** ${targetCivName} (id=${targetCivId})\n` +
            `**From Civ:** ${fromCivName} (${fromDiscordName})\n\n` +
            `**Message:**\n> ${body}`
        });

        await user.send(`📨 **Diplomatic message received from ${fromCivName}**\n> ${body}`);
        return { ok: true };
      } catch (e) {
        const reason = e?.message || String(e);

        await postToGmMailbox({
          client, guildId, gmMailboxChannelId,
          title: "DM delivery failed",
          content:
            `**To Civ:** ${targetCivName} (id=${targetCivId})\n` +
            `**From Civ:** ${fromCivName} (${fromDiscordName})\n\n` +
            `**Message:**\n> ${body}\n\nDM Error: ${reason}`
        });

        return { ok: false, reason: "DM_FAILED" };
      }
    }
  };
};
