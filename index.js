require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in your .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // REQUIRED for automod, logs, and autoresponders
  ],
});

// --- Load commands dynamically from commands/ ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// --- Load events dynamically from events/ ---
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) {
  fs.mkdirSync(eventsPath, { recursive: true });
}
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── Global Error Handlers to Prevent Bot Crashes ─────────────────────────────
process.on('unhandledRejection', error => {
  console.error('⚠️ UNHANDLED PROMISE REJECTION:', error);
});

process.on('uncaughtException', error => {
  console.error('⚠️ UNCAUGHT EXCEPTION:', error);
});

client.login(DISCORD_TOKEN);
