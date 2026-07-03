// Smart deployment script supporting:
// --test   : registers commands to guild only (instant) and clears global commands.
// --live   : registers commands globally (takes up to 1 hour) and clears guild commands.
// --status : checks and prints currently registered commands in guild and global scopes.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const readline = require('readline');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Validate base environment credentials
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in your .env file.');
  process.exit(1);
}

const hasTest = process.argv.includes('--test');
const hasLive = process.argv.includes('--live');
const hasStatus = process.argv.includes('--status');

if (!hasTest && !hasLive && !hasStatus) {
  console.error('❌ You must specify a mode flag: --test, --live, or --status.');
  console.error('Use package scripts: npm run deploy:test | npm run deploy:live | npm run deploy:status');
  process.exit(1);
}

// Require GUILD_ID only when checking/registering to guild
if ((hasTest || hasStatus) && !GUILD_ID) {
  console.error('❌ GUILD_ID is required in your .env file for --test or --status modes.');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Read commands folder
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

(async () => {
  try {
    // ── MODE: STATUS ─────────────────────────────────────────────────────────
    if (hasStatus) {
      console.log('🔍 Checking registered slash commands status...');
      const guildCmds = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
      const globalCmds = await rest.get(Routes.applicationCommands(CLIENT_ID));

      console.log('\n--- 📁 GUILD SCOPE ---');
      console.log(`Guild ID: ${GUILD_ID}`);
      console.log(`Count: ${guildCmds.length}`);
      console.log(`Commands: ${guildCmds.map(c => `/${c.name}`).join(', ') || '*None*'}`);

      console.log('\n--- 🌎 GLOBAL SCOPE ---');
      console.log(`Count: ${globalCmds.length}`);
      console.log(`Commands: ${globalCmds.map(c => `/${c.name}`).join(', ') || '*None*'}`);
      return;
    }

    // ── MODE: TEST (Guild only) ──────────────────────────────────────────────
    if (hasTest) {
      console.log('🧹 Preparing test deployment. Clearing global commands to prevent duplication...');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log('✅ Global commands cleared.');

      console.log(`⚙️ Registering ${commands.length} commands to test server (Guild ID: ${GUILD_ID})...`);
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log('✅ Test server commands registered successfully (instant update).');
      return;
    }

    // ── MODE: LIVE (Global only) ──────────────────────────────────────────────
    if (hasLive) {
      console.log('⚠️ WARNING: You are deploying commands GLOBALLY.');
      console.log('This will make them available across all servers the bot is in.');
      console.log('This operation will clear all guild-specific commands to prevent duplication.');
      console.log('Note: Global changes can take up to 1 hour to propagate in the Discord client.');

      const confirm = await askQuestion('\nDo you want to proceed? (yes/no): ');
      if (confirm.toLowerCase().trim() !== 'yes') {
        console.log('🚫 Deployment cancelled.');
        return;
      }

      if (GUILD_ID) {
        console.log(`🧹 Clearing guild commands for Guild ID: ${GUILD_ID} to prevent duplication...`);
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
        console.log('✅ Guild commands cleared.');
      } else {
        console.log('ℹ️ No GUILD_ID found, skipped clearing guild commands.');
      }

      console.log(`⚙️ Registering ${commands.length} commands globally...`);
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log('✅ Global commands registered successfully.');
      return;
    }

  } catch (error) {
    console.error('❌ Operation failed:', error);
  }
})();
