SmurfxBot

A custom Discord bot built with discord.js v14, featuring server management, auto-moderation, activity logging, and a community meme-karma system — all organized into clean, dashboard-style slash commands.


✨ Features

🗂️ Channel Management (/channel)


Create channels and categories with custom Unicode font styling (bold, italic, script, fraktur, etc.)
Delete single or multiple channels/categories at once (bulk delete with confirmation)
Interactive menu-driven flow — no need to memorize subcommands


🛡️ Auto-Moderation (/automod)


Custom regex filter system (add/remove/list patterns)
Toxicity/profanity detection powered by the obscenity library (catches evasion tricks like f u c k or a$$)
Per-server allowlist/blocklist for full control over what gets flagged
Configurable actions per severity level (warn / delete / timeout)
Single dashboard command with buttons and modals instead of a wall of subcommands


📋 Logging (/logging)


Message edit/delete logs (with content + attachments)
Full channel & category change tracking (create, delete, rename, permission changes, moves) with executor info pulled from the audit log
Color-coded embeds, fully toggleable per log type


🔥 Meme Karma System (/karma)


Dedicated meme channel with auto 👍/👎 reactions on every post
Karma awarded/deducted based on vote ratio after a set voting window
Leaderboard, user profiles, and karma-based role rewards
"Strict mode" auto-deletes non-meme messages to keep the channel on-topic
Hall of Fame reposting for top-voted memes


🧭 Help (/help)


Single interactive command with category browsing (no more digging through dozens of top-level commands)



🛠️ Tech Stack


Runtime: Node.js
Library: discord.js v14
Moderation: obscenity (profanity/evasion detection)
Scheduling: cron-based jobs (for karma voting windows)
Storage: (fill in — e.g. SQLite / MongoDB / JSON)



📁 Project Structure

discord/
├── commands/
│   ├── automod.js
│   ├── channel.js
│   ├── help.js
│   ├── karma.js
│   └── logging.js
├── events/
├── data/
├── utils/
├── deploy-commands.js      # registers slash commands (guild/global modes)
├── clear-guild-commands.js # clears leftover guild-specific commands
├── index.js                # bot entry point
├── package.json
└── .env                    # secrets (not committed)


⚙️ Setup


Clone/download the project and install dependencies:


bash   npm install


Create a .env file with the following:


   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_application_client_id
   GUILD_ID=your_test_server_id


Deploy slash commands:


bash   npm run deploy          # guild-only, instant — for testing
   npm run deploy:global   # global — works in every server (takes up to 1hr to propagate)

⚠️ Don't run both without clearing one first — leftover guild commands will show up as duplicates alongside global ones. Use node clear-guild-commands.js to wipe guild-specific commands once you've gone global.


Start the bot:


bash   node index.js


🌐 Hosting

Currently deployable on any Node.js-compatible host. Recommended for 24/7 uptime:


Pella — free tier with GitHub-based deploys
Oracle Cloud Always Free — permanent free VM, more technical setup


⚠️ Only run one instance of the bot at a time (local OR hosted, never both) — running duplicates causes every event (logs, automod actions, etc.) to fire multiple times.


📌 Roadmap / Ideas


 Fix automod timeout action (currently deletes flagged messages but doesn't apply timeout)
 Reaction roles dashboard
 Ticket system
 /conspiracy — fun activity-pattern-based "conspiracy theory" generator for members



📄 License

(Add your license here, e.g. MIT)
