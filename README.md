# 🏛️ Civilisation Chat Bot

A Discord bot designed for asynchronous, anonymous, GM-driven civilization gameplay.

Players control individual civilizations, receive private messages from the Game Master (GM), and communicate with other civilizations under strict, configurable diplomatic cadence rules (daily, weekly, etc.).

Ideal for slow-burn, narrative, text-based strategy games.

---

## ✨ Core Concepts

- One player = one civilization
- Only the GM knows who owns which civilization
- Civilizations communicate anonymously
- Messaging is rate-limited per civilization pair
- If a DM cannot be delivered, messages fall back to a private GM mailbox
- All data is persisted in SQLite

---

## 🧱 Project Structure

CivilisationChatBot/
├─ config.json
├─ bot.db
├─ src/
│  ├─ index.js                 (Bot entry point / dispatcher)
│  ├─ commands/
│  │  ├─ _loader.js            (Recursive command loader)
│  │  ├─ send.js               (/send)
│  │  ├─ diplomacy.js          (/diplomacy)
│  │  └─ gm/
│  │     ├─ gm_claim.js
│  │     ├─ gm_addplayer.js    (Also creates civilizations)
│  │     └─ gm_setrule.js
│  ├─ services/
│  │  ├─ authService.js        (GM guard)
│  │  ├─ deliveryService.js    (DM + GM mailbox fallback)
│  │  ├─ rateLimitService.js   (Cooldown logic)
│  │  └─ db/
│  │     └─ index.js           (SQLite + repositories)
└─ README.md

---

## ⚙️ Setup

### 1. Create a Discord application

- Go to https://discord.com/developers/applications
- Create a new application and bot
- Copy the Bot Token

---

### 2. Invite the bot to your server

Use the OAuth2 URL Generator.

Scopes:
- bot
- applications.commands

Recommended permissions:
- Send Messages
- Read Messages
- Use Slash Commands
- Send DMs

---

### 3. Create config.json

Create a file named config.json at the project root:

```json
{
  "token": "YOUR_BOT_TOKEN",
  "guildId": "YOUR_GUILD_ID",
  "gmChannelId": "GM_MAILBOX_CHANNEL_ID"
}
```

Notes:
- gmChannelId must point to a private channel visible only to the GM and the bot
- This channel is used as a fallback mailbox if DMs fail
- Do NOT commit config.json

---

### 4. Install and run

```sh
npm install
node src/index.js
```

Expected output:

```
Logged in as <botname>
[COMMAND LOADER] Registered X commands
```

---

## 🎮 Gameplay Flow

### Step 1 — Claim GM role

```
/gm_claim
```

This command only works if no GM exists yet.

---

### Step 2 — Assign players (and create civilizations)

Example:

```
/gm_addplayer user:@Alice civ:Rome
```

What this does:
- Creates the civilization Rome if it does not exist
- Assigns Alice as the sole owner
- One user can only own one civilization

There is no separate /gm_addciv command.

---

### Step 3 — Define diplomacy cadence

Example:

```
/gm_setrule civ1:Rome civ2:Carthage interval_seconds:86400 max_messages:1
```

Common values:
- Daily messages → 86400
- Weekly messages → 604800

Rules are bidirectional, but message usage is tracked per direction.

---

### Step 4 — Players send anonymous messages

Example:

```
/send civ:Carthage message:"We propose a trade agreement."
```

Behavior:
- Recipient sees: "Diplomatic message received from Rome"
- Sender is anonymous at the Discord level
- If DM delivery fails, the message is sent to the GM mailbox

---

### Step 5 — Players view known diplomacy

```
/diplomacy
```

Shows:
- Known civilizations
- Messaging cadence with each
- Only information relevant to the player’s civilization

---

## 🛡️ GM Mailbox (Fail-Safe)

If:
- a player has DMs disabled
- or blocks the bot

Then:
- the message is posted to the GM mailbox channel
- includes sender civ, target civ, message content, and error details

No messages are silently lost.

---

## 🧠 Rate Limiting Model

- Rules are stored per civilization pair (canonical order)
- Usage is stored directionally
- Cooldown model:
  - max_messages per interval_seconds
  - typically 1 message per interval

This allows realistic distance-based diplomacy pacing.

---

## 🧪 Debugging and Common Issues

### Commands do not appear

- Restart the bot
- Wait ~10 seconds
- Refresh Discord (Ctrl + R)
- Ensure the command loader is recursive

---

### “GM only” but I am GM

Check the database:

```sql
SELECT user_id, role FROM players;
```

---

### Module not found errors

Ensure src/index.js loads config correctly:

```
require("../config.json")
```

---

## 🔒 Design Philosophy

- Minimal UI, maximal narrative
- Strong GM authority without micromanagement
- Asynchronous by design
- Anonymous by default
- No real-time spam

---

## 🚀 Possible Extensions

- Alliances and wars
- Treaties with expiration
- GM force-send
- Message inspection tools
- Web dashboard
- Save-state exports

---

## 📜 License

MIT — use freely, but do not blame the bot when wars break out.
