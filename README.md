# Discord "hi" Bot

An always-on Discord bot built with [discord.js](https://discord.js.org/). It:

- Registers a `/hi [user]` slash command anyone in your server can use
- Registers a `/ping` command as a second example, to show how to add more
- On startup, automatically DMs "hi" to a specific username (set via `GREET_USERNAME`)

## 1. Create the bot in Discord's Developer Portal

1. Go to https://discord.com/developers/applications and click **New Application**.
2. Give it a name, then go to the **Bot** tab.
3. Click **Reset Token** to get your bot token — save it, you'll need it below.
4. Under **Privileged Gateway Intents**, enable **Server Members Intent** (required to look up `c_a_l_l` by username).
5. Go to **OAuth2 → URL Generator**:
   - Scopes: check `bot` and `applications.commands`
   - Bot Permissions: check `Send Messages`, `Read Messages/View Channels`
   - Copy the generated URL, open it in your browser, and invite the bot to your server.
6. On the **General Information** page, copy your **Application ID** (this is your `CLIENT_ID`).
7. In Discord, enable Developer Mode (User Settings → Advanced), then right-click your server icon → **Copy Server ID** (this is your `GUILD_ID`).

## 2. Configure the project

```bash
cd discord-bot
cp .env.example .env
```

Edit `.env` and fill in:
- `DISCORD_TOKEN` — the bot token from step 3 above
- `CLIENT_ID` — your Application ID
- `GUILD_ID` — your server ID
- `GREET_USERNAME` — the exact Discord **username** (not nickname) to auto-DM "hi" on startup, e.g. `c_a_l_l`

## 3. Install and run

```bash
npm install
npm run deploy   # registers the /hi and /ping slash commands to your server
npm start        # starts the bot and keeps it running
```

You should see `Logged in as YourBot#1234` in the console. If `GREET_USERNAME` matches someone in the server, they'll get a DM saying "hi 👋" shortly after startup.

## 4. Keeping it running 24/7

`npm start` only runs while your terminal is open. To keep the bot online continuously, either:
- Run it on a small always-on server/VPS with a process manager like [pm2](https://pm2.keymetrics.io/) (`pm2 start index.js`), or
- Deploy it to a host like Railway, Render, or Fly.io.

## Adding more commands

Drop a new file in `commands/`, following the shape of `commands/hi.js`, then run `npm run deploy` again to register it. `index.js` loads every file in that folder automatically — no other code changes needed.

## Notes

- A user's DMs must allow messages from server members for the auto-greet to work; if their DMs are closed, you'll see an error logged instead of a crash.
- Keep your `.env` file private — anyone with your bot token can control your bot.
