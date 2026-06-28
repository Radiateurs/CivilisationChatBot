const { SlashCommandBuilder } = require("discord.js");
const { requireGM } = require("../../services/authService");

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const units = [
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["min", 60],
    ["sec", 1],
  ];

  const parts = [];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count > 0) {
      parts.push(`${count} ${name}${count === 1 ? "" : "s"}`);
      seconds -= count * size;
    }
    if (parts.length >= 2) break;
  }

  return parts.length ? parts.join(" ") : "0 sec";
}

async function resolveOwnerLabel(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return user.globalName || user.username || userId;
  } catch {
    return userId;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gm_diplomacies")
    .setDescription("[GM] List all civilizations and their diplomacy rules."),

  async execute(interaction, { db }) {
    const gm = await db.players.getByUserId(interaction.user.id);
    if (!requireGM(gm, interaction)) return;

    const [civs, rules] = await Promise.all([
      new Promise((resolve, reject) => {
        db.raw.all(
          `
          SELECT c.id, c.name, p.user_id
          FROM civs c
          LEFT JOIN players p ON p.civ_id = c.id
          ORDER BY c.name COLLATE NOCASE ASC, p.user_id ASC
          `,
          [],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      }),
      new Promise((resolve, reject) => {
        db.raw.all(
          `
          SELECT
            pr.interval_seconds,
            pr.max_messages,
            pr.window_type,
            cs.id AS civ_small_id,
            cs.name AS civ_small_name,
            cl.id AS civ_large_id,
            cl.name AS civ_large_name
          FROM pair_rules pr
          JOIN civs cs ON cs.id = pr.civ_small
          JOIN civs cl ON cl.id = pr.civ_large
          ORDER BY cs.name COLLATE NOCASE ASC, cl.name COLLATE NOCASE ASC
          `,
          [],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      })
    ]);

    const civMap = new Map();
    for (const row of civs) {
      if (!civMap.has(row.id)) {
        civMap.set(row.id, { id: row.id, name: row.name, owners: [] });
      }

      if (row.user_id) {
        civMap.get(row.id).owners.push(row.user_id);
      }
    }

    const rulesByCiv = new Map();
    for (const row of rules) {
      const addRule = (civId, otherName, intervalSeconds, maxMessages, windowType) => {
        if (!rulesByCiv.has(civId)) {
          rulesByCiv.set(civId, []);
        }

        rulesByCiv.get(civId).push({
          otherName,
          intervalSeconds,
          maxMessages,
          windowType
        });
      };

      addRule(row.civ_small_id, row.civ_large_name, row.interval_seconds, row.max_messages, row.window_type);
      addRule(row.civ_large_id, row.civ_small_name, row.interval_seconds, row.max_messages, row.window_type);
    }

    const entries = [];
    for (const civ of [...civMap.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))) {
      const ownerIds = [...new Set(civ.owners)];
      const ownerNames = await Promise.all(ownerIds.map(userId => resolveOwnerLabel(interaction.client, userId)));
      const ownersLabel = ownerNames.length ? ownerNames.join(", ") : "no owner";

      const relatedRules = (rulesByCiv.get(civ.id) || [])
        .sort((a, b) => a.otherName.localeCompare(b.otherName, undefined, { sensitivity: "base" }))
        .map((rule, index) => {
          const cadence = `every ${formatDuration(rule.intervalSeconds)}`;
          return `${index + 1}. ${rule.otherName} (${cadence})`;
        });

      if (relatedRules.length) {
        entries.push(`* **${civ.name}** (${ownersLabel}) has ${relatedRules.length} diplomacy:`);
        entries.push(...relatedRules.map(line => `  ${line}`));
      } else {
        entries.push(`* **${civ.name}** (${ownersLabel}) has 0 diplomacy.`);
      }
    }

    const body = entries.slice(0, 80).join("\n");
    const footer = entries.length > 80 ? `\n…and ${entries.length - 80} more.` : "";

    return interaction.reply({
      content: `📜 **All civilizations and diplomacy**\n${body}${footer}`,
      ephemeral: true
    });
  }
};
