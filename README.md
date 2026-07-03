# 🤖 SmurfxBot

> A modern all-in-one Discord management bot built with **discord.js v14**.

SmurfxBot is designed to simplify Discord server management by combining powerful moderation tools, detailed activity logging, server management utilities, and a unique meme-karma system into one lightweight bot.

---

## ✨ Features

- 🛡️ Advanced Auto Moderation
- 📋 Detailed Server Logging
- 🗂️ Channel Management
- 🔥 Meme Karma System
- 🧭 Interactive Help Menu
- ⚡ Modern Slash Commands
- 🎨 Dashboard-style Configuration
- 🚀 Lightweight & Fast

---

# 🛡️ Auto Moderation

Protect your server using an intelligent moderation system.

### Features

- Custom Regex Filters
- Profanity Detection
- Obscenity Detection
- Detects bypass attempts (`f u c k`, `a$$`, etc.)
- Allowlist & Blocklist
- Configurable punishments
- Interactive dashboard using Buttons & Modals

Supported actions:

- Warn
- Delete Message
- Timeout *(Coming Soon)*

---

# 📋 Logging

Track almost everything happening in your Discord server.

### Message Events

- Message Delete
- Message Edit
- Attachment Logs

### Channel Events

- Channel Created
- Channel Deleted
- Channel Renamed
- Category Updates
- Permission Changes
- Channel Moves

### Audit Logs

Automatically records:

- Executor
- Timestamp
- Before & After Changes

All logs are displayed using clean color-coded embeds.

---

# 🗂️ Channel Management

Create and organize channels in seconds.

### Supports

- Text Channels
- Voice Channels
- Categories

### Unicode Channel Styles

Create stylish channel names using Unicode fonts.

Examples:

```
𝗔𝗻𝗻𝗼𝘂𝗻𝗰𝗲𝗺𝗲𝗻𝘁𝘀
𝑮𝒂𝒎𝒆𝒔
𝕸𝖊𝖒𝖊𝖘
```

Bulk delete channels safely with confirmation prompts.

---

# 🔥 Meme Karma

A complete engagement system for meme communities.

Features include:

- 👍 Automatic Voting
- 👎 Downvote Detection
- Karma Calculation
- Leaderboards
- User Profiles
- Hall of Fame
- Karma Rewards
- Strict Meme Channels

Messages that aren't memes can automatically be removed in Strict Mode.

---

# 🧭 Interactive Help

Instead of remembering dozens of commands, simply run:

```bash
/help
```

Browse every feature using buttons and interactive menus.

---

# 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| discord.js v14 | Discord API |
| Obscenity | Profanity Detection |
| Cron Jobs | Scheduled Tasks |
| SQLite / MongoDB / JSON | Storage |

---

# 📂 Project Structure

```text
discord/
├── commands/
│   ├── automod.js
│   ├── channel.js
│   ├── help.js
│   ├── karma.js
│   └── logging.js
│
├── events/
├── utils/
├── data/
│
├── deploy-commands.js
├── clear-guild-commands.js
├── index.js
├── package.json
└── .env
```

---

# ⚙️ Installation

Clone the repository.

```bash
git clone https://github.com/yourusername/SmurfxBot.git
```

Install dependencies.

```bash
npm install
```

Create a `.env` file.

```env
DISCORD_TOKEN=YOUR_TOKEN
CLIENT_ID=YOUR_CLIENT_ID
GUILD_ID=YOUR_TEST_SERVER
```

---

# 🚀 Deploy Commands

Guild Commands

```bash
npm run deploy
```

Global Commands

```bash
npm run deploy:global
```

If switching from guild commands to global commands, clear old guild commands first.

```bash
node clear-guild-commands.js
```

---

# ▶️ Start

```bash
node index.js
```

---

# 🌐 Deployment

SmurfxBot can run on any Node.js hosting platform.

Recommended hosts:

- Oracle Cloud Free
- Railway
- Render
- Pella
- VPS
- Raspberry Pi

> **Important**
>
> Never run multiple instances of the bot simultaneously, as duplicate instances can cause moderation actions and logs to trigger multiple times.

---

# 📌 Roadmap

- [ ] Timeout Support
- [ ] Ticket System
- [ ] Reaction Roles
- [ ] AI Moderation
- [ ] Welcome Messages
- [ ] Starboard
- [ ] Temporary Channels
- [ ] Dashboard Website

---

# 🤝 Contributing

Pull requests are welcome.

If you'd like to suggest a feature or report a bug, please open an Issue first.

---
