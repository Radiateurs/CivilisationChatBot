const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { token, guildId } = require("./config.json");

const db = new sqlite3.Database("./bot.db");

// ---------- DB init ----------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS civs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS players (
    user_id TEXT PRIMARY KEY,
    civ_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    FOREIGN KEY(civ_id) REFERENCES civs(id)
  )`);

  // canonical civ pair (small_id, large_id)
  db.run(`CREATE TABLE IF NOT EXISTS pair_rules (
    civ_small INTEGER NOT NULL,
    civ_large INTEGER NOT NULL,
    interval_seconds INTEGER NOT NULL,   -- for cooldown
    max_messages INTEGER NOT NULL,       -- usually 1 for cooldown
    window_type TEXT NOT NULL DEFAULT 'cooldown',
    PRIMARY KEY(civ_small, civ_large),
    FOREIGN KEY(civ_small) REFERENCES civs(id),
    FOREIGN KEY(civ_large) REFERENCES civs(id)
  )`);

  // directional usage: from_small_to_large and from_large_to_small separately
  db.run(`CREATE TABLE IF NOT EXISTS pair_usage (
    from_civ INTEGER NOT NULL,
    to_civ INTEGER NOT NULL,
    last_sent_at INTEGER, -- unix seconds
    window_start_at INTEGER,
    used_count INTEGER DEFAULT 0,
    PRIMARY KEY(from_civ, to_civ)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_civ INTEGER NOT NULL,
    to_civ INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    body TEXT NOT NULL
  )`);
});

// ---------- Helpers ----------
function nowSec() { return Math.floor(Date.now() / 1000); }

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function getPlayer(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT players.user_id, players.role, civs.id as civ_id, civs.name as civ_name
       FROM players JOIN civs ON players.civ_id = civs.id
       WHERE players.user_id = ?`,
      [userId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

function getCivByName(name) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM civs WHERE LOWER(name) = LOWER(?)`, [name], (err, row) =>
      err ? reject(err) : resolve(row)
    );
  });
}

function getRule(civA, civB) {
  const [small, large] = canonicalPair(civA, civB);
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pair_rules WHERE civ_small = ? AND civ_large = ?`,
      [small, large],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

async function canSend(fromCiv, toCiv) {
  const rule = await getRule(fromCiv, toCiv);
  if (!rule) {
    return { ok: false, reason: "No diplomacy rule set for that pair yet." };
  }

  const t = nowSec();

  // cooldown model: max_messages per interval (usually 1)
  // directional usage row keyed by (fromCiv, toCiv)
  const usage = await new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM pair_usage WHERE from_civ = ? AND to_civ = ?`,
      [fromCiv, toCiv],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });

  if (!usage || !usage.last_sent_at) {
    return { ok: true, rule };
  }

  const elapsed = t - usage.last_sent_at;
  if (elapsed >= rule.interval_seconds) {
    return { ok: true, rule };
  }

  const wait = rule.interval_seconds - elapsed;
  return { ok: false, rule, reason: `Rate limit: try again in ${wait} seconds.`, waitSeconds: wait };
}

async function recordSend(fromCiv, toCiv, body) {
  const t = nowSec();
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO pair_usage(from_civ, to_civ, last_sent_at, window_start_at, used_count)
       VALUES(?, ?, ?, ?, 1)
       ON CONFLICT(from_civ, to_civ) DO UPDATE SET
         last_sent_at = excluded.last_sent_at`,
      [fromCiv, toCiv, t, t],
      (err) => err ? reject(err) : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO messages(from_civ, to_civ, sent_at, body) VALUES(?, ?, ?, ?)`,
      [fromCiv, toCiv, t, body],
      (err) => err ? reject(err) : resolve()
    );
  });
}

// ---------- Discord setup ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName("whoami")
    .setDescription("Shows your civilization (only you can see it)."),

  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send an anonymous diplomatic message to another civilization.")
    .addStringOption(o => o.setName("civ").setDescription("Target civilization name").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Message text").setRequired(true)),

  // GM group
  new SlashCommandBuilder()
    .setName("gm_addciv")
    .setDescription("[GM] Create a civilization.")
    .addStringOption(o => o.setName("name").setDescription("Civ name").setRequired(true)),

  new SlashCommandBuilder()
    .setName("gm_addplayer")
    .setDescription("[GM] Assign a player to a civilization.")
    .addUserOption(o => o.setName("user").setDescription("Player").setRequired(true))
    .addStringOption(o => o.setName("civ").setDescription("Civ name").setRequired(true)),

  new SlashCommandBuilder()
    .setName("gm_setrule")
    .setDescription("[GM] Set diplomacy cadence between two civs (cooldown model).")
    .addStringOption(o => o.setName("civ1").setDescription("Civ 1").setRequired(true))
    .addStringOption(o => o.setName("civ2").setDescription("Civ 2").setRequired(true))
    .addIntegerOption(o => o.setName("interval_seconds").setDescription("Seconds between messages (e.g. 86400)").setRequired(true))
    .addIntegerOption(o => o.setName("max_messages").setDescription("Usually 1").setRequired(true)),

  new SlashCommandBuilder()
    .setName("gm_claim")
    .setDescription("Claim GM role (only works if no GM exists yet)")
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(
    Routes.applicationCommands((await client.application.fetch()).id),
    { body: commands }
  );
}

function requireGM(player) {
  return player && player.role === "gm";
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log("Commands registered");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "whoami") {
      const player = await getPlayer(interaction.user.id);
      if (!player) return interaction.reply({ content: "You are not registered yet.", ephemeral: true });
      return interaction.reply({ content: `You are **${player.civ_name}**.`, ephemeral: true });
    }

    if (interaction.commandName === "send") {
      const player = await getPlayer(interaction.user.id);
      if (!player) return interaction.reply({ content: "You are not registered yet.", ephemeral: true });

      const targetName = interaction.options.getString("civ", true);
      const body = interaction.options.getString("message", true);

      const target = await getCivByName(targetName);
      if (!target) return interaction.reply({ content: "Unknown target civilization.", ephemeral: true });
      if (target.id === player.civ_id) return interaction.reply({ content: "You can't message your own civilization.", ephemeral: true });

      const allowed = await canSend(player.civ_id, target.id);
      if (!allowed.ok) return interaction.reply({ content: allowed.reason, ephemeral: true });

      // Deliver to the owner (first player) of the target civ
      db.get(
        `SELECT user_id FROM players WHERE civ_id = ? ORDER BY rowid ASC LIMIT 1`,
        [target.id],
        async (err, row) => {
          if (err) {
            console.error(err);
            return;
          }

          if (!row) {
            console.warn("No owner found for target civilization");
            return interaction.reply({ content: `🤔 It appears this civilization doesn't have a letterbox....`, ephemeral: true });
          }

          try {
            const user = await client.users.fetch(row.user_id);
            await user.send(`📨 **Diplomatic message received from ${player.civ_name}**\n> ${body}`);
          } catch (e) {
            // DM failed (user has DMs closed or blocked the bot)
            console.warn("Failed to deliver DM to civ owner:", e.message);
            return interaction.reply({ content: `💀 It appears your messenger did not made it to its destination...`, ephemeral: true });
          }
        }
      );

      await recordSend(player.civ_id, target.id, body);
      return interaction.reply({ content: `Sent anonymously to **${target.name}**.`, ephemeral: true });
    }

    if (interaction.commandName === "gm_claim") {
      // Check if a GM already exists
      db.get(
        `SELECT user_id FROM players WHERE role = 'gm' LIMIT 1`,
        async (err, row) => {
          if (err) {
            console.error(err);
            return interaction.reply({ content: "Database error.", ephemeral: true });
          }

          if (row) {
            return interaction.reply({
              content: "❌ A GM already exists. Only a GM can assign new GMs.",
              ephemeral: true
            });
          }

          // Promote this user to GM
          db.run(
            `INSERT INTO players(user_id, civ_id, role)
         VALUES(?, -1, 'gm')
         ON CONFLICT(user_id) DO UPDATE SET role = 'gm'`,
            [interaction.user.id],
            (err) => {
              if (err) {
                console.error(err);
                return interaction.reply({ content: "Failed to claim GM role.", ephemeral: true });
              }

              interaction.reply({
                content: "👑 You are now the Game Master.",
                ephemeral: true
              });
            }
          );
        }
      );
    }

    // GM commands
    if (interaction.commandName.startsWith("gm_")) {
      const player = await getPlayer(interaction.user.id);
      if (!requireGM(player)) {
        return interaction.reply({ content: "GM only.", ephemeral: true });
      }

      if (interaction.commandName === "gm_addciv") {
        const name = interaction.options.getString("name", true);
        db.run(`INSERT INTO civs(name) VALUES(?)`, [name], (err) => {
          if (err) return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
          return interaction.reply({ content: `Created civ **${name}**.`, ephemeral: true });
        });
        return;
      }

      if (interaction.commandName === "gm_addplayer") {
        const user = interaction.options.getUser("user", true);
        const civName = interaction.options.getString("civ", true);
        const civ = await getCivByName(civName);
        if (!civ) return interaction.reply({ content: "Unknown civ.", ephemeral: true });

        db.run(
          `INSERT INTO players(user_id, civ_id, role) VALUES(?, ?, 'player')
           ON CONFLICT(user_id) DO UPDATE SET civ_id = excluded.civ_id`,
          [user.id, civ.id],
          (err) => {
            if (err) return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
            return interaction.reply({ content: `Assigned ${user.username} to **${civ.name}**.`, ephemeral: true });
          }
        );
        return;
      }

      if (interaction.commandName === "gm_setrule") {
        const civ1 = await getCivByName(interaction.options.getString("civ1", true));
        const civ2 = await getCivByName(interaction.options.getString("civ2", true));
        if (!civ1 || !civ2) return interaction.reply({ content: "Unknown civ name(s).", ephemeral: true });

        const interval = interaction.options.getInteger("interval_seconds", true);
        const max = interaction.options.getInteger("max_messages", true);

        const [small, large] = canonicalPair(civ1.id, civ2.id);
        db.run(
          `INSERT INTO pair_rules(civ_small, civ_large, interval_seconds, max_messages, window_type)
           VALUES(?, ?, ?, ?, 'cooldown')
           ON CONFLICT(civ_small, civ_large) DO UPDATE SET interval_seconds = excluded.interval_seconds, max_messages = excluded.max_messages`,
          [small, large, interval, max],
          (err) => {
            if (err) return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
            return interaction.reply({ content: `Rule set for **${civ1.name} ↔ ${civ2.name}**: ${max} msg / ${interval}s (cooldown).`, ephemeral: true });
          }
        );
        return;
      }
    }

  } catch (e) {
    console.error(e);
    if (!interaction.replied) {
      interaction.reply({ content: "Something went wrong.", ephemeral: true }).catch(() => { });
    }
  }
});

client.login(token);
