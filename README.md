🤖 SmurfxBot

A modern all-in-one Discord management bot built with discord.js v14.

SmurfxBot combines intelligent moderation, advanced logging, server management, and a unique meme-karma system into one fast, lightweight package designed for modern Discord communities.

✨ Highlights
⚡ Modern Slash Command Interface
🛡️ Intelligent Auto Moderation
📊 Comprehensive Server Logging
😂 Community Meme Karma System
🗂️ Powerful Channel Management
🎨 Interactive Dashboard-style Menus
🚀 Lightweight & Fast
🔒 Secure Permission Checks
📈 Designed for Growing Communities
🚀 Features
🛡️ Auto Moderation

Protect your server without filling it with dozens of commands.

Features
Custom Regex Filters
Advanced Profanity Detection
Obscenity Library Integration
Detects bypass attempts

Examples:

f u c k
a$$
b!tch
Server Allowlist
Server Blocklist
Severity Levels
Warn
Delete Message
Timeout
Interactive Dashboard
Button & Modal Based Configuration
📋 Advanced Logging

Track everything happening inside your server.

Message Logs
Message Delete
Message Edit
Attachment Logs
Channel Logs
Channel Creation
Channel Deletion
Channel Rename
Category Changes
Permission Updates
Channel Movement
Audit Logs

Automatically detects

Moderator
Executor
Timestamp
Before / After Changes

Everything is displayed using beautiful color-coded embeds.

🗂️ Channel Manager

Powerful server organization tools.

Create
Text Channels
Voice Channels
Categories
Delete
Single Channel
Bulk Delete
Category Delete
Styling

Create channel names using Unicode fonts.

Examples

𝗚𝗔𝗠𝗘𝗦
𝑨𝒏𝒏𝒐𝒖𝒏𝒄𝒆𝒎𝒆𝒏𝒕𝒔
𝕸𝖊𝖒𝖊𝖘

Interactive menus mean no complicated command syntax.

🔥 Meme Karma System

A community engagement system designed specifically for meme servers.

Automatically
Adds 👍 👎 reactions
Starts vote timer
Calculates vote ratio
Awards Karma
Removes Karma for low-quality posts
Includes
Leaderboard
User Profiles
Karma Roles
Hall of Fame
Strict Meme Mode

Strict Mode automatically removes non-meme posts from designated channels.

🧭 Interactive Help System

No more endless command lists.

/help

Opens an interactive category browser where users can quickly navigate every feature using buttons.

🛠 Tech Stack
Technology	Usage
Node.js	Runtime
discord.js v14	Discord API
Obscenity	Smart Profanity Detection
Cron Jobs	Scheduled Karma Processing
SQLite / MongoDB / JSON	Database (Configurable)
📂 Project Structure
discord/
│
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
⚙️ Installation

Clone the repository

git clone https://github.com/yourusername/SmurfxBot.git

Install dependencies

npm install

Create a .env file

DISCORD_TOKEN=YOUR_TOKEN
CLIENT_ID=YOUR_CLIENT_ID
GUILD_ID=YOUR_TEST_SERVER
Register Commands

Guild Commands (Instant)

npm run deploy

Global Commands

npm run deploy:global

If switching from guild commands to global commands:

node clear-guild-commands.js
Start
node index.js
🌐 Deployment

SmurfxBot can run on any Node.js hosting platform.

Recommended
✅ Oracle Cloud Always Free
✅ Railway
✅ Render
✅ Pella
✅ VPS
✅ Raspberry Pi

Never run multiple instances of the bot simultaneously.

Running duplicate instances may cause moderation actions, logs, and events to execute more than once.

📌 Planned Features
 Timeout Action for AutoMod
 Ticket System
 Reaction Roles
 Server Dashboard
 AI Moderation Assistant
 Welcome & Goodbye System
 Starboard
 Temporary Channels
 Music Module
 /conspiracy Fun Command
❤️ Why SmurfxBot?

Unlike many Discord bots that rely on dozens of confusing subcommands, SmurfxBot focuses on a clean, interactive experience with buttons, menus, and modals. Every feature is built with usability, performance, and modern Discord design principles in mind.

📄 License

MIT License (or your preferred license)
