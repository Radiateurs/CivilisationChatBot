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
    async postToGmMailbox({ title, content, components = [] }) {
      if (!gmMailboxChannelId) {
        console.warn("[GM MAILBOX] gmMailboxChannelId is not set.");
        return null;
      }

      try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(gmMailboxChannelId);

        if (!channel || !channel.isTextBased()) {
          console.warn("[GM MAILBOX] Channel not found or not text-based.");
          return null;
        }

        return await channel.send({
          content: `🛂 **${title}**\n${content}`,
          components
        });
      } catch (err) {
        console.warn("[GM MAILBOX] Failed to post:", err?.message || err);
        return null;
      }
    },
    async dmCivOwnerById({ targetCivId, body }) {
      const row = await new Promise((resolve, reject) => {
        db.raw.get(
          `SELECT user_id FROM players WHERE civ_id = ? ORDER BY rowid ASC LIMIT 1`,
          [targetCivId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (!row) {
        return { ok: false, reason: "NO_OWNER" };
      }

      try {
        const user = await client.users.fetch(row.user_id);
        await user.send(`📨 **Diplomatic message received**\n> ${body}`);
        return { ok: true };
      } catch (err) {
        await this.postToGmMailbox({
          title: "DM delivery failed",
          content:
            `**Target Civ ID:** ${targetCivId}\n` +
            `**Owner User ID:** ${row.user_id}\n\n` +
            `**Message:**\n> ${body}\n\n` +
            `**Error:** ${err?.message || err}`
        });

        return { ok: false, reason: "DM_FAILED" };
      }
    },
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
