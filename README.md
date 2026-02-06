# 🏛️ Civilization Diplomacy Discord Bot

A Discord bot designed for **asynchronous, anonymous diplomacy** between player-owned civilizations in a text-based strategy / role-play game.

Each civilization is owned by **exactly one Discord user**.  
The bot allows civilizations to communicate **privately**, **anonymously**, and at a **controlled pace** defined by the Game Master (GM).

Think: envoys, couriers, distance-based diplomacy, and fog of war.

---

## ✨ Features

- 🕵️ **Anonymous diplomacy**  
  Players never see Discord usernames or IDs of other civilizations.

- 📩 **Private messages via bot DMs**  
  Messages are delivered **only** to the owning player of the target civilization.

- ⏳ **Rate-limited communication**  
  Control how often civilizations may communicate:
  - Daily (near neighbors)
  - Weekly (distant empires)
  - Any custom interval

- 👑 **Game Master (GM) controls**
  - Register civilizations
  - Assign owners
  - Define diplomacy cadence
  - Promote additional GMs

- 🗃️ **Persistent storage**
  - SQLite database
  - Survives restarts
  - Simple to back up

- 🔒 **Fog of war friendly**
  - No shared channels
  - No accidental leaks
  - Optional GM oversight

---

## 🧠 Core Design Rules

- **1 Civilization = 1 Discord User**
- All diplomacy goes **through the bot**
- Players **cannot bypass pacing**
- The GM is the sole authority over rules

---

## 🛠️ Tech Stack

- **Node.js** (v16.11+, recommended v18 or v20)
- **discord.js v14**
- **SQLite3**
- Slash commands only (no prefix commands)

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd CivilizationChatBot
